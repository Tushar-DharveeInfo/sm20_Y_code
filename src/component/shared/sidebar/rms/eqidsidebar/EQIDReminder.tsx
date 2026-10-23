import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Notes } from '@n20a/libavnotes';
import type { INote } from '@n20a/libavnotes';
import '@n20a/libavnotes/style.css';
import { Attach24x24, Cross, Delete24x24, Info24x24 } from '@n20a/libicon';
import { FnGetCssVariable } from '../../../../appcontainer/allcommon/FnGetCssVariable';
import { handleContainerKeyDown } from '../../../allcommon/basic/FnHandleContainerKeyDown';
import { IImage } from '../../../allinterface/basic/IImage';
import { ActionImage } from '../../../basic/actionimage/ActionImage';
import { Label } from '../../../basic/label/Label';
import { Image } from '../../../basic/image/Image';
import { YesNoFormContainer } from '../../../basic/yesnoformcontainer/YesNoFormContainer';
import { useMainAppContext } from '../../../context/hooks/MainAppHooks';
import { useStatusBarContext } from '../../../context/hooks/StatusBarHooks';
import '../../notes/FqaNotes.css';
import '../../../../features/appqa/reminder/Reminder.css';
import { useReminders, useFileDownload, useFileDelete, type IReminderDoc } from '@n20a/libfsdb';
type ITodoDoc = IReminderDoc;
import { useUploadRemoteFile } from '../../../allcommon/UploadRemoteFileHooks';
import { useSmDataContext } from '../../../context/hooks/SmDataHooks';
import { useSelectedNodeContext } from '../../../context/hooks/SelectedNodeHooks';
import { ITreeNode } from '../../../allinterface/tree/ITreeControl';
import { RmsEnums } from '../../../../constants/Feature';

interface IEQIDReminder {
	uniqueName?: string;
	featureId?: string;
	eqid?: string;
	ticket?: any;
	selectedNode?: ITreeNode;
}

interface ITodoItem extends ITodoDoc {
	id?: string;
	bid: string;
	cid: string;
	datecreated?: string;
}

/**
 * Generates a unique filename for Cloud Storage:
 * Format: {bid}-{cid}-{yymmddhhmmss}-{cleanName}
 */
function generateUniqueFileName(bid: string, cid: string, originalFileName: string): string {
	const now = new Date();
	const yy = String(now.getFullYear()).slice(-2);
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	const hh = String(now.getHours()).padStart(2, '0');
	const min = String(now.getMinutes()).padStart(2, '0');
	const ss = String(now.getSeconds()).padStart(2, '0');
	const yymmddhhmmss = `${yy}${mm}${dd}${hh}${min}${ss}`;

	const baseName = originalFileName ? originalFileName.split('/').pop()?.split('\\').pop() || '' : '';
	let cleanName = baseName.replace(/^[^-]+-[^-]+-\d{12}-/, '');
	if (!cleanName) {
		cleanName = 'attachment.png';
	}
	return `${bid}-${cid}-${yymmddhhmmss}-${cleanName}`;
}

/**
 * Strips the "{bid}-{cid}-{yymmddhhmmss}-" prefix to return the original clean file name.
 */
function getCleanFileName(rawName: string): string {
	if (!rawName) return '';
	const base = rawName.split('/').pop() || rawName;
	const match = base.match(/^[^-]+-[^-]+-\d{12}-(.*)$/);
	return match ? match[1] : base;
}

/**
 * Extracts a numeric timestamp from date fields for ascending sorting.
 */
function parseTodoDate(item: Record<string, any>): number {
	const raw = item.datecreated || item.duedate || item.lastupdated || item.updatedat || item.createdAt || item.dateupdated;
	if (raw) {
		if (typeof raw === 'object' && typeof raw.toDate === 'function') {
			return raw.toDate().getTime();
		}
		if (typeof raw === 'object' && typeof raw.seconds === 'number') {
			return raw.seconds * 1000;
		}
		const parsed = Date.parse(String(raw));
		if (!isNaN(parsed)) return parsed;
	}
	const id = String(item.id || item.todoid || '');
	const match = id.match(/(\d{10,})/);
	if (match) return Number(match[1]);
	return 0;
}

/** Drops a previously bound "EQID: <id> - " prefix so the visible text is the user message. */
function messageWithoutBoundEqid(message: string): string {
	const match = String(message ?? '').match(/^EQID:\s*.+?\s+-\s+([\s\S]*)$/i);
	return match ? match[1] : String(message ?? '');
}

function eqidMatches(itemEqid: string | undefined, targetEqid: string): boolean {
	const target = targetEqid.trim().toLowerCase();
	if (!target) return true;
	const item = String(itemEqid ?? '').trim().toLowerCase();
	if (!item) return false;
	if (item === target) return true;
	const itemLast = item.split('__').pop() || item;
	const targetLast = target.split('__').pop() || target;
	return itemLast === targetLast;
}

function mapToTodoItem(item: Record<string, unknown>, index: number, defaultBid: string, defaultCid: string): ITodoItem {
	const id = String(item.id || item.todoid || item.key || `todo-${index}`);
	const rawDate = item.duedate || item.due_date || item.dueDate;
	const formattedDue = rawDate ? String(rawDate) : '';

	return {
		id,
		bid: String(item.bid || defaultBid || ''),
		cid: String(item.cid || defaultCid || ''),
		btype: String(item.btype || 'Standard'),
		status: String(item.status || 'Open'),
		whattodo: String(item.whattodo || item.title || item.task || item.message || ''),
		duedate: formattedDue,
		addedby: String(item.addedby || item.createdby || item.user || 'User'),
		filename: item.filename ? String(item.filename) : undefined,
		datecreated: item.datecreated ? String(item.datecreated) : undefined,
		eqid: item.eqid ? String(item.eqid) : undefined,
	};
}

function resolveBidCid(
	selection?: { bid?: string; cid?: string },
	node?: ITreeNode | any
): { bid: string; cid: string } {
	let bid = String(selection?.bid ?? '').trim();
	let cid = String(selection?.cid ?? '').trim();

	if (bid && cid) {
		return { bid, cid };
	}

	if (node) {
		const nodeType = String(node.NodeType ?? node.treetype ?? '').toLowerCase();
		if (nodeType === 'contact') {
			if (!bid) bid = String(node.bid ?? node.parentEntID ?? '').trim();
			if (!cid) cid = String(node.cid ?? node.NodeEntID ?? node.key ?? '').trim();
		} else if (nodeType === 'business') {
			if (!bid) bid = String(node.bid ?? node.NodeEntID ?? node.key ?? '').trim();
		} else if (nodeType === 'ticket') {
			if (!bid) bid = String(node.bid ?? '').trim();
			if (!cid) cid = String(node.cid ?? '').trim();
		} else {
			if (!bid) bid = String(node.bid ?? node.parentEntID ?? '').trim();
			if (!cid) cid = String(node.cid ?? node.NodeEntID ?? '').trim();
		}
	}

	return { bid, cid };
}

const EQIDReminder = (props: IEQIDReminder) => {
	const uniqueName = props.uniqueName ?? 'eqid-reminder';
	const mainAppContext = useMainAppContext();
	const statusBarContext = useStatusBarContext();
	const smDataContext = useSmDataContext();
	const selectedNodeContext = useSelectedNodeContext();
	const userInfo = mainAppContext.authSession;
	const authSession = mainAppContext.authSession;

	const effectiveNode = props.selectedNode ?? smDataContext?.selectedNode ?? selectedNodeContext?.selectedNode;
	const resolvedTarget = useMemo(() => {
		return resolveBidCid(smDataContext?.selection, effectiveNode);
	}, [smDataContext?.selection, effectiveNode]);

	const selectedBid = resolvedTarget.bid;
	const selectedCid = resolvedTarget.cid;

	const isMfgMode =
		props.featureId === RmsEnums.EQIDByMfg ||
		props.featureId === '404' ||
		props.selectedNode?.NodeType === 'EQID' ||
		props.selectedNode?.nodeType === 'EQID';

	const activeNode = props.selectedNode ?? selectedNodeContext?.selectedNode;
	const activeTicket =
		props.ticket ??
		(selectedNodeContext as any)?.selectedTicketCard ??
		(selectedNodeContext as any)?.SelectedTicketCard ??
		(activeNode && (activeNode.ticketid || (activeNode as any).prodno || activeNode.NodeType === 'Ticket' || activeNode.NodeType === 'EQID') ? activeNode : null);

	const effectiveEqid = String(
		props.eqid ||
		props.ticket?.eqid ||
		(props.ticket as any)?.EQID ||
		activeTicket?.eqid ||
		(activeTicket as any)?.EQID ||
		activeTicket?.ticketid ||
		(activeNode as any)?.eqid ||
		(activeNode as any)?.EQID ||
		activeNode?.ticketid ||
		activeNode?.NodeEntID ||
		''
	).trim();

	const userBid = selectedBid || String(props.ticket?.bid ?? activeNode?.bid ?? authSession?.bid ?? userInfo?.bid ?? '').trim();
	const userCid = selectedCid || String(props.ticket?.cid ?? activeNode?.cid ?? authSession?.cid ?? userInfo?.cid ?? '').trim();
	const noteby = authSession?.displayName ?? authSession?.username ?? userInfo?.username ?? userInfo?.email ?? 'User';
	const bucketName = authSession?.bucketName ?? 'n20-bucket-01';
	const baseFolder = authSession?.baseFolder ?? 'sm';

	const createActivityLogRef = useRef(mainAppContext.createActivityLog);
	useEffect(() => {
		createActivityLogRef.current = mainAppContext.createActivityLog;
	}, [mainAppContext.createActivityLog]);

	const getStoragePath = useCallback((filename: string): string => {
		if (!filename) return '';
		if (filename.includes('/')) return filename;
		return `${bucketName}/${baseFolder}/smfiles/tickets/${filename}`;
	}, [bucketName, baseFolder]);

	const { loading, error, getReminders: getTodos, reminders: todos, createReminder: createTodo, updateReminder: updateTodo, deleteReminder: deleteTodo } = useReminders();
	const { upload: uploadRemoteFile, uploading: remoteUploading } = useUploadRemoteFile();
	const { downloadSingleFile, downloading } = useFileDownload();
	const { deleteFiles, deleting } = useFileDelete();

	const [todoItems, setTodoItems] = useState<ITodoItem[]>([]);
	const [selectedItem, setSelectedItem] = useState<ITodoItem | null>(null);
	const [deleteItem, setDeleteItem] = useState<ITodoItem | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [notesKey, setNotesKey] = useState(0);
	const [fileUploading, setFileUploading] = useState(false);

	const scrollRef = useRef<HTMLDivElement>(null);

	const [noteDetailsState, setNoteDetailsState] = useState<INote | undefined>({
		maxAudioRecordingTime: 0,
		maxVideoRecordingTime: 0,
		noteId: 'todo-note',
		noteTitle: '',
		notecontent: '',
		notefile: undefined,
		notefileName: undefined,
		noteaudio: undefined,
		notevideo: undefined,
		noteCreatedAt: new Date(),
		allowAudio: false,
		allowVideo: false,
	});

	useEffect(() => {
		void getTodos();
	}, [getTodos]);

	// Display todo list filtered based on selected node's bid and cid
	useEffect(() => {
		if (Array.isArray(todos)) {
			const mapped = todos.map((item, index) => mapToTodoItem(item, index, userBid, userCid));

			const filtered = mapped.filter((item) => {
				if (isMfgMode) {
					return eqidMatches(item.eqid, effectiveEqid);
				}

				const itemBid = String(item.bid || '').trim().toLowerCase();
				const itemCid = String(item.cid || '').trim().toLowerCase();
				const targetBid = selectedBid.trim().toLowerCase();
				const targetCid = selectedCid.trim().toLowerCase();

				let matchesNode = true;
				if (targetBid && targetCid) {
					matchesNode = itemBid === targetBid && itemCid === targetCid;
				} else if (targetBid) {
					matchesNode = itemBid === targetBid;
				} else if (targetCid) {
					matchesNode = itemCid === targetCid;
				}
				return matchesNode && eqidMatches(item.eqid, effectiveEqid);
			});

			const sorted = [...filtered].sort((a, b) => parseTodoDate(a) - parseTodoDate(b));
			setTodoItems(sorted);
		} else if (todos === null) {
			setTodoItems([]);
		}
	}, [todos, selectedBid, selectedCid, userBid, userCid, effectiveEqid, isMfgMode]);

	// Auto-scroll to bottom of list when todo items change
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [todoItems]);

	// Sync loading state with status bar
	useEffect(() => {
		const isBusy = Boolean(loading || remoteUploading || fileUploading || downloading || deleting);
		statusBarContext?.setIsLoading?.(isBusy);
	}, [loading, remoteUploading, fileUploading, downloading, deleting, statusBarContext]);

	useEffect(() => {
		if (error) {
			statusBarContext?.setFetchError?.([error]);
		}
	}, [error, statusBarContext]);

	// Download file from Cloud Storage to browser
	const handleDownloadFile = useCallback(async (item: ITodoItem, event?: React.MouseEvent) => {
		event?.stopPropagation?.();
		const rawFileName = String(item.filename || '').trim();
		if (!rawFileName || rawFileName.startsWith('sample-file-')) {
			return;
		}

		const storagePath = getStoragePath(rawFileName);
		const cleanName = getCleanFileName(rawFileName);

		statusBarContext?.setIsLoading?.(true);
		statusBarContext?.setLoadingLabel?.('Downloading attachment...');
		try {
			const res = await downloadSingleFile(storagePath);
			if (!res?.success) {
				console.error('FqaEqidToDo: downloadSingleFile failed', res?.error, res?.message);
				return;
			}
			const downloadUrl = res?.blobUrl;
			if (downloadUrl) {
				const link = document.createElement('a');
				link.href = downloadUrl;
				link.download = cleanName || 'attachment';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			} else {
				console.error('FqaEqidToDo: no downloadUrl returned', res);
			}
		} catch (err) {
			console.error('FqaEqidToDo: handleDownloadFile error', err);
		} finally {
			statusBarContext?.setIsLoading?.(false);
			statusBarContext?.setLoadingLabel?.('');
		}
	}, [downloadSingleFile, getStoragePath, statusBarContext]);

	// Reset the editor to empty state
	const resetEditor = useCallback(() => {
		setSelectedItem(null);
		setNoteDetailsState({
			maxAudioRecordingTime: 0,
			maxVideoRecordingTime: 0,
			noteId: 'todo-note',
			noteTitle: '',
			notecontent: '',
			notefile: undefined,
			notefileName: undefined,
			noteaudio: undefined,
			notevideo: undefined,
			noteCreatedAt: new Date(),
			allowAudio: false,
			allowVideo: false,
		});
		setNotesKey((prev) => prev + 1);
	}, []);

	// Select a todo item to view/edit in the bottom Notes control
	const handleSelectTodo = useCallback(async (item: ITodoItem) => {
		if (selectedItem === item) {
			resetEditor();
			return;
		}

		setSelectedItem(item);
		const textContent = messageWithoutBoundEqid(String(item.whattodo ?? ''));
		const rawFileName = String(item.filename || '').trim();
		const hasFile = Boolean(rawFileName && !rawFileName.startsWith('sample-file-'));

		if (!hasFile) {
			setNoteDetailsState({
				maxAudioRecordingTime: 0,
				maxVideoRecordingTime: 0,
				noteId: item.id || 'todo-note',
				noteTitle: item.status ?? '',
				notecontent: textContent,
				notefile: undefined,
				notefileName: undefined,
				noteaudio: undefined,
				notevideo: undefined,
				noteCreatedAt: new Date(),
				allowAudio: false,
				allowVideo: false,
			});
			setNotesKey((prev) => prev + 1);
			return;
		}

		const cleanName = getCleanFileName(rawFileName);

		setNoteDetailsState({
			maxAudioRecordingTime: 0,
			maxVideoRecordingTime: 0,
			noteId: item.id || 'todo-note',
			noteTitle: item.status ?? '',
			notecontent: textContent,
			notefile: undefined,
			notefileName: cleanName,
			noteaudio: undefined,
			notevideo: undefined,
			noteCreatedAt: new Date(),
			allowAudio: false,
			allowVideo: false,
		});
		setNotesKey((prev) => prev + 1);

		const storagePath = getStoragePath(rawFileName);

		statusBarContext?.setIsLoading?.(true);
		statusBarContext?.setLoadingLabel?.('Loading attachment...');
		try {
			const res = await downloadSingleFile(storagePath);
			if (!res?.success) {
				console.error('FqaEqidToDo: downloadSingleFile failed', res?.error, res?.message);
				return;
			}
			const downloadUrl = res?.blobUrl;
			if (downloadUrl) {
				const response = await fetch(downloadUrl);
				const fileBlob = await response.blob();

				setNoteDetailsState({
					maxAudioRecordingTime: 0,
					maxVideoRecordingTime: 0,
					noteId: item.id || 'todo-note',
					noteTitle: item.status ?? '',
					notecontent: textContent,
					notefile: fileBlob,
					notefileName: cleanName,
					noteaudio: undefined,
					notevideo: undefined,
					noteCreatedAt: new Date(),
					allowAudio: false,
					allowVideo: false,
				});
				setNotesKey((prev) => prev + 1);
			}
		} catch (err) {
			console.error('FqaEqidToDo: error downloading file for edit', err);
		} finally {
			statusBarContext?.setIsLoading?.(false);
			statusBarContext?.setLoadingLabel?.('');
		}
	}, [selectedItem, resetEditor, downloadSingleFile, getStoragePath, statusBarContext]);

	// Clicking on a ToDo card selects the item locally
	const handleCardClick = useCallback((item: ITodoItem, event?: React.MouseEvent) => {
		void handleSelectTodo(item);
	}, [handleSelectTodo]);

	const handleDeleteAttachment = useCallback(
		(_objectType: 'file' | 'audio' | 'video', _objectData?: Blob | File) => {
			setNoteDetailsState((prev) =>
				prev
					? {
						...prev,
						notefile: undefined,
						notefileName: undefined,
					}
					: prev
			);
			setSelectedItem((prev) =>
				prev
					? {
						...prev,
						filename: undefined,
					}
					: null
			);
		},
		[]
	);

	// Send/Add ToDo: message text stays as typed. EQID goes on the hook payload.
	const sendTodo = useCallback(async (message: INote) => {
		const rawContent = messageWithoutBoundEqid(String(message.notecontent ?? '').trim());
		if (!rawContent) {
			return;
		}

		const finalContent = rawContent;

		const authSession = mainAppContext.authSession;
		const effectiveBid = userBid || String(authSession?.bid ?? '').trim();
		const effectiveCid = userCid || String(authSession?.cid ?? '').trim();
		const userShortName = String(userInfo?.username ?? userInfo?.email ?? authSession?.displayName ?? authSession?.username ?? 'User').trim();
		const now = new Date().toISOString();

		// Upload attached file if present
		let uploadedFileName = '';
		const attachedData = message.notefile;

		if (attachedData) {
			const rawFileName = message.notefileName
				|| (attachedData instanceof File ? attachedData.name : '')
				|| 'attachment.png';

			const existingFileName = selectedItem ? String(selectedItem.filename || '').trim() : '';
			const isSameAsExisting = Boolean(
				existingFileName && getCleanFileName(existingFileName) === rawFileName
			);

			if (isSameAsExisting) {
				uploadedFileName = existingFileName;
			} else {
				uploadedFileName = generateUniqueFileName(effectiveBid, effectiveCid, rawFileName);

				setFileUploading(true);
				statusBarContext?.setIsLoading?.(true);
				statusBarContext?.setLoadingLabel?.('Uploading attachment...');
				try {
					const uploadResult = await uploadRemoteFile({
						source: attachedData,
						bucket: bucketName,
						baseFolder: baseFolder,
						fileName: `smfiles/tickets/${uploadedFileName}`,
					});
					if (!uploadResult?.success) {
						console.error('FqaEqidToDo: uploadRemoteFile failed', uploadResult?.error, uploadResult?.message);
					}
				} catch (err) {
					console.error('FqaEqidToDo: uploadRemoteFile error', err);
				} finally {
					setFileUploading(false);
					statusBarContext?.setIsLoading?.(false);
					statusBarContext?.setLoadingLabel?.('');
				}
			}
		}

		if (selectedItem) {
			const todoId = selectedItem.id;
			const finalFileName = uploadedFileName || '';
			const previousFileName = String(selectedItem.filename || '').trim();

			if (previousFileName && previousFileName !== finalFileName && !previousFileName.startsWith('sample-file-')) {
				try {
					statusBarContext?.setIsLoading?.(true);
					statusBarContext?.setLoadingLabel?.('Deleting previous attachment...');
					const oldStoragePath = getStoragePath(previousFileName);
					await deleteFiles([oldStoragePath]);
				} catch (err) {
					console.warn('FqaEqidToDo: error deleting previous attachment', err);
				} finally {
					statusBarContext?.setIsLoading?.(false);
					statusBarContext?.setLoadingLabel?.('');
				}
			}

			const updatedDoc: Record<string, unknown> = {
				bid: selectedItem.bid || effectiveBid,
				cid: selectedItem.cid || effectiveCid,
				btype: selectedItem.btype || 'Standard',
				status: selectedItem.status || 'Open',
				whattodo: finalContent,
				duedate: selectedItem.duedate || now,
				addedby: selectedItem.addedby || userShortName,
				filename: finalFileName,
				eqid: effectiveEqid,
			};

			// Optimistic local update
			setTodoItems((prev) =>
				prev.map((item) =>
					item === selectedItem || (todoId && item.id === todoId)
						? {
							...item,
							whattodo: finalContent,
							filename: finalFileName,
							eqid: effectiveEqid,
						}
						: item
				)
			);

			resetEditor();

			try {
				if (todoId) {
					const result = await updateTodo(todoId, updatedDoc);
					if (result && result.success !== false) {
						try {
							await createActivityLogRef.current?.(`${effectiveCid || noteby} of ${effectiveBid} updated todo ${todoId} successfully.`);
						} catch (logErr) {
							console.error('FqaEqidToDo: createActivityLog failed', logErr);
						}
					} else {
						console.error('FqaEqidToDo: updateTodo failed', result?.error);
					}
				}
				await getTodos();
			} catch (err) {
				console.error('Error updating todo:', err);
			}
			return;
		}

		// CREATE MODE: EQID is a payload field, not part of the message.
		const finalFilename = uploadedFileName || '';
		const newDocId = `todo_${effectiveCid || 'user'}_${Date.now()}`;
		const newTodoDoc: Record<string, unknown> = {
			bid: effectiveBid,
			cid: effectiveCid,
			btype: 'Standard',
			status: 'Open',
			whattodo: finalContent,
			duedate: now,
			addedby: userShortName,
			filename: finalFilename,
			eqid: effectiveEqid,
		};

		const optimisticRow: ITodoItem = {
			id: newDocId,
			bid: effectiveBid,
			cid: effectiveCid,
			btype: 'Standard',
			status: 'Open',
			whattodo: finalContent,
			duedate: now,
			addedby: userShortName,
			filename: finalFilename,
			datecreated: now,
			eqid: effectiveEqid,
		};

		setTodoItems((prev) => [...prev, optimisticRow]);
		resetEditor();

		try {
			const result = await createTodo(newTodoDoc);
			if (result && result.success !== false) {
				const createdId = result.id || newDocId;
				try {
					await createActivityLogRef.current?.(`${effectiveCid || noteby} of ${effectiveBid} created reminder ${createdId} successfully.`);
				} catch (logErr) {
					console.error('FqaEqidToDo: createActivityLog failed', logErr);
				}
			} else {
				console.error('FqaEqidToDo: createTodo failed', result?.error);
			}
			await getTodos();
		} catch (err) {
			console.error('Error creating todo:', err);
		}
	}, [effectiveEqid, userBid, userCid, selectedItem, userInfo, mainAppContext.authSession, noteby, createTodo, updateTodo, getTodos, uploadRemoteFile, resetEditor, bucketName, baseFolder, getStoragePath, deleteFiles, statusBarContext]);

	const deleteImage: IImage = {
		uniqueName: 'todo-delete-icon',
		source: (
			<Cross
				size={FnGetCssVariable('--image-size-2')}
				fill="none"
				strokeWidth={1}
			/>
		),
		w: 'var(--image-size-2)',
		type: 'svg',
		tooltip: 'Click to Delete',
	};

	const closeImage: IImage = {
		uniqueName: 'todo-close-icon',
		source: (
			<Delete24x24
				size={FnGetCssVariable('--image-size-2')}
				fill="none"
				strokeWidth={1}
			/>
		),
		w: 'var(--image-size-2)',
		type: 'svg',
		tooltip: 'Click to Close',
	};

	const handleDelete = (item: ITodoItem) => {
		setDeleteItem(item);
		setDeleteOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (deleteItem) {
			if (selectedItem === deleteItem) {
				resetEditor();
			}
			const todoId = deleteItem.id;
			const fileName = String(deleteItem.filename || '').trim();

			if (fileName && !fileName.startsWith('sample-file-')) {
				try {
					statusBarContext?.setIsLoading?.(true);
					statusBarContext?.setLoadingLabel?.('Deleting attached file...');
					const storagePath = getStoragePath(fileName);
					await deleteFiles([storagePath]);
				} catch (err) {
					console.warn('FqaEqidToDo: error deleting attached file', err);
				} finally {
					statusBarContext?.setIsLoading?.(false);
					statusBarContext?.setLoadingLabel?.('');
				}
			}

			setTodoItems((prev) => prev.filter((item) => item !== deleteItem && item.id !== todoId));
			setDeleteOpen(false);
			setDeleteItem(null);

			if (todoId) {
				try {
					const result = await deleteTodo(todoId);
					if (result && result.success !== false) {
						try {
							await createActivityLogRef.current?.(`${userCid || noteby} of ${userBid} deleted reminder ${todoId} successfully.`);
						} catch (logErr) {
							console.error('FqaEqidToDo: createActivityLog failed', logErr);
						}
					}
					await getTodos();
				} catch (err) {
					console.error('Error deleting todo:', err);
				}
			}
		}
	};

	const handleCloseTodo = useCallback(async (item: ITodoItem, event?: React.MouseEvent | React.KeyboardEvent) => {
		event?.stopPropagation?.();
		const todoId = item.id;
		if (!todoId) return;

		const userShortName = String(userInfo?.username ?? userInfo?.email ?? authSession?.displayName ?? authSession?.username ?? 'User').trim();
		const now = new Date().toISOString();

		setTodoItems((prev) =>
			prev.map((todo) =>
				todo === item || (todoId && todo.id === todoId)
					? { ...todo, status: 'Close' }
					: todo
			)
		);

		if (selectedItem?.id === todoId || selectedItem === item) {
			setSelectedItem((prev) => (prev ? { ...prev, status: 'Close' } : null));
			setNoteDetailsState((prev) => (prev ? { ...prev, noteTitle: 'Close' } : prev));
		}

		statusBarContext?.setIsLoading?.(true);
		statusBarContext?.setLoadingLabel?.('Closing reminder...');

		try {
			const updatedDoc: Record<string, unknown> = {
				bid: item.bid || userBid,
				cid: item.cid || userCid,
				btype: item.btype || 'Standard',
				status: 'Close',
				whattodo: messageWithoutBoundEqid(item.whattodo || ''),
				duedate: item.duedate || now,
				addedby: item.addedby || userShortName,
				filename: item.filename || '',
				eqid: item.eqid || effectiveEqid,
				...(item.datecreated ? { datecreated: item.datecreated } : {}),
			};

			const result = await updateTodo(todoId, updatedDoc);
			if (result && result.success !== false) {
				try {
					await createActivityLogRef.current?.(`${userCid || noteby} of ${userBid} closed reminder ${todoId} successfully.`);
				} catch (logErr) {
					console.error('FqaEqidToDo: createActivityLog failed', logErr);
				}
			}
			await getTodos();
		} catch (err) {
			console.error('Error Closing reminder...:', err);
		} finally {
			statusBarContext?.setIsLoading?.(false);
			statusBarContext?.setLoadingLabel?.('');
		}
	}, [selectedItem, userInfo, authSession, userBid, userCid, noteby, effectiveEqid, updateTodo, getTodos, statusBarContext]);

	const renderTodoIcon = (item: ITodoItem, index: number) => {
		const rawFileName = String(item.filename || '').trim();
		const hasFile = Boolean(rawFileName && !rawFileName.startsWith('sample-file-'));
		const cleanName = getCleanFileName(rawFileName);

		if (hasFile) {
			return (
				<div
					className="nz-info-image"
					style={{ cursor: 'pointer' }}
					onClick={(e) => {
						e.stopPropagation();
						void handleDownloadFile(item, e);
						void handleSelectTodo(item);
					}}
				>
					<Image
						uniqueName={`${uniqueName}-attach-${index}`}
						source={
							<Attach24x24
								size={FnGetCssVariable('--image-size-1')}
								fill="none"
								strokeWidth={1}
							/>
						}
						w="var(--image-size-2)"
						tooltip={`Click to download ${cleanName || 'file'}`}
					/>
				</div>
			);
		}

		return (
			<div className="nz-info-image">
				<Image
					uniqueName={`${uniqueName}-info-${index}`}
					source={
						<Info24x24
							size={FnGetCssVariable('--image-size-1')}
							fill="none"
							strokeWidth={1}
						/>
					}
					w="var(--image-size-2)"
					tooltip={item.status || 'Info'}
				/>
			</div>
		);
	};

	return (
		<div
			className="nz-node-list-Container nz-appqa-todo"
			tabIndex={1}
			onKeyDown={handleContainerKeyDown}
			key={uniqueName}
			style={{ height: '100%' }}
		>
			<div className="nz-notes-list-main-div">
				<div className="nz-notes-list-with-msg-box">
					<div className="nz-sub-header">
						<Label
							uniqueName={`${uniqueName}-header`}
							label={`EQID Reminders${todoItems.length > 0 ? ` (${todoItems.length})` : ''}`}
						/>
					</div>
					<div className="nz-notes-list-scroll" ref={scrollRef}>
						{loading && (
							<div className="nz-notes-loading" style={{ padding: '10px', textAlign: 'center' }}>
								<Label uniqueName="todo-loading" label="Loading reminders..." />
							</div>
						)}
						{error && (
							<div className="nz-notes-error" style={{ padding: '10px', color: 'var(--danger, #ff4d4f)' }}>
								<Label uniqueName="todo-error" label={typeof error === 'string' ? error : 'Failed to load reminders'} />
							</div>
						)}
						{!loading && !error && todoItems.length === 0 && (
							<div className="nz-notes-empty" style={{ padding: '10px', textAlign: 'center', opacity: 0.7 }}>
								<Label uniqueName="todo-empty" label="No EQID reminders found" />
							</div>
						)}
						{!loading && todoItems.map((item, index) => {
							const todoKey = item.id ? item.id : `${item.bid}-${item.cid}-${index}`;
							const message = messageWithoutBoundEqid(item.whattodo ?? '');
							const isSelected = selectedItem === item || (selectedItem?.id && item.id === selectedItem.id);
							const isClosed = String(item.status ?? '').trim().toLowerCase() === 'close';
							return (
								<div
									className={`nz-node-list-box${isSelected ? ' nz-node-list-box-selected' : ''}`}
									key={todoKey}
									onClick={(e) => handleCardClick(item, e)}
									style={{ cursor: 'pointer' }}
									title={item.bid && item.cid ? `Click to launch SM for BID: ${item.bid}, CID: ${item.cid}` : undefined}
								>
									<div className="nz-todo-card-inner">
										<div className="nz-todo-card-actions">
											<div
												onClick={(event) => event.stopPropagation()}
												onKeyDown={(event) => event.stopPropagation()}
											>
												<ActionImage
													image={deleteImage}
													w="var(--node_height)"
													h="var(--node_height)"
													uniqueName={`${uniqueName}-delete-${index}`}
													actionCode="delete"
													disabled={false}
													handleMouse={() => handleDelete(item)}
												/>
											</div>
											{item.status && !item.status.toLowerCase().includes('close') && (
												<div
													className={isClosed ? 'nz-todo-action-closed' : ''}
													onClick={(event) => event.stopPropagation()}
													onKeyDown={(event) => event.stopPropagation()}
												>
													<ActionImage
														image={{
															...closeImage,
															tooltip: isClosed ? 'Status is Close' : 'Click to Close',
														}}
														w="var(--node_height)"
														h="var(--node_height)"
														uniqueName={`${uniqueName}-close-${index}`}
														actionCode="close"
														disabled={false}
														handleMouse={(e) => handleCloseTodo(item, e)}
													/>
												</div>
											)}
										</div>
										<div className="nz-todo-card-content">
											<div className="nz-node-list-delete">
												<div className="nz-note-date">
													<Label
														uniqueName={`${uniqueName}-status-${index}`}
														label={item.status || ''}
													/>
												</div>
												<div className="nz-note-user">
													<Label
														uniqueName={`${uniqueName}-type-${index}`}
														label={[item.btype, item.bid ? `bid: ${item.bid}` : '', item.cid ? `cid: ${item.cid}` : ''].filter(Boolean).join(' · ')}
													/>
												</div>
											</div>
											<div className="nz-info-div">
												{renderTodoIcon(item, index)}
												<div className="nz-nodes-text">
													<Label
														uniqueName={`${uniqueName}-text-${index}`}
														label={message}
													/>
												</div>
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
					<div className="nz-notes-container">
						{selectedItem && (
							<button
								type="button"
								onClick={resetEditor}
								style={{
									background: 'none',
									border: 'none',
									color: 'var(--theme-text-color, #666)',
									cursor: 'pointer',
									fontSize: '12px',
									textDecoration: 'underline',
									padding: 0,
									position: 'absolute',
									marginRight: 12,
									right: 0,
								}}
							>
								Cancel
							</button>
						)}
						{noteDetailsState && (
							<Notes
								key={`${notesKey}-${selectedItem?.id ?? 'new'}`}
								{...noteDetailsState}
								allowAudio={false}
								allowVideo={false}
								sendTooltip={selectedItem ? 'Update Reminder' : 'Send Reminder'}
								sendNote={sendTodo}
								handleDelete={handleDeleteAttachment}
								placeholderMessage="Enter a reminder here..."
							/>
						)}
					</div>
				</div>
			</div>
			<YesNoFormContainer
				isOpen={deleteOpen}
				uniqueName={`${uniqueName}-delete`}
				message="Are you sure you want to delete this reminder?"
				showOkButton={false}
				handleYesButtonClick={handleConfirmDelete}
				handleNoButtonClick={() => {
					setDeleteOpen(false);
					setDeleteItem(null);
				}}
			/>
		</div>
	);
};

export { EQIDReminder, EQIDReminder as FqaEqidToDo, EQIDReminder as fqaeqidtodo };
export default EQIDReminder;
