import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Notes } from '@n20a/libavnotes';
import type { INote } from '@n20a/libavnotes';
import '@n20a/libavnotes/style.css';
import { DateControl } from '@n20a/libform';
import '@n20a/libform/style.css';
import { Attach24x24, Delete24x24, Info24x24 } from '@n20a/libicon';
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable';
import { handleContainerKeyDown } from '../../allcommon/basic/FnHandleContainerKeyDown';
import { IImage } from '../../allinterface/basic/IImage';
import { ActionImage } from '../../basic/actionimage/ActionImage';
import { Label } from '../../basic/label/Label';
import { Image } from '../../basic/image/Image';
import { YesNoFormContainer } from '../../basic/yesnoformcontainer/YesNoFormContainer';
import { useMainAppContext } from '../../context/hooks/MainAppHooks';
import { useStatusBarContext } from '../../context/hooks/StatusBarHooks';
import { useSmDataContext } from '../../context/hooks/SmDataHooks';
import { useTodos, useFileDownload, useFileDelete } from '@n20a/libfsdb';
import type { ITodoDoc } from '@n20a/libfsdb';
import { useUploadRemoteFile } from '../../allcommon/UploadRemoteFileHooks';
import { ITreeNode } from '../../allinterface/tree/ITreeControl';
import { ClientEnums } from '../../../constants/Feature';
import './AddToDo.css';
import '../../../features/appqa/todo/ToDo.css';
import '../notes/FqaNotes.css';

interface IAddToDo {
	uniqueName: string;
	featureId?: string;
	selectedNode?: ITreeNode;
}

interface ITodoItem extends ITodoDoc {
	id?: string;
	bid: string;
	cid: string;
	datecreated?: string;
}

function getFormattedDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function getTomorrowDateString(): string {
	const d = new Date();
	d.setDate(d.getDate() + 1);
	return getFormattedDate(d);
}

function getTodayDateString(): string {
	return getFormattedDate(new Date());
}

function parseToIsoDate(dateStr: string): string {
	if (!dateStr) return '';
	const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (slashMatch) {
		const m = slashMatch[1].padStart(2, '0');
		const d = slashMatch[2].padStart(2, '0');
		const y = slashMatch[3];
		return `${y}-${m}-${d}`;
	}
	const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
	if (isoMatch) {
		const y = isoMatch[1];
		const m = isoMatch[2].padStart(2, '0');
		const d = isoMatch[3].padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const parsed = Date.parse(dateStr);
	if (!isNaN(parsed)) {
		return getFormattedDate(new Date(parsed));
	}
	return '';
}

function isDateInFuture(dateStr: string): boolean {
	if (!dateStr) return false;
	const iso = parseToIsoDate(dateStr);
	if (!iso) return false;
	const todayStr = getTodayDateString();
	return iso > todayStr;
}

function isBusinessExplorerNode(node?: ITreeNode): boolean {
	const nodeType = node?.NodeType?.toLowerCase() ?? '';
	return nodeType === 'business' || nodeType === 'contact';
}

function resolveBidCid(selection: { bid?: string; cid?: string }, node?: ITreeNode): { bid: string; cid: string } {
	const bidFromSelection = String(selection.bid ?? '').trim();
	const cidFromSelection = String(selection.cid ?? '').trim();
	if (bidFromSelection) {
		return { bid: bidFromSelection, cid: cidFromSelection };
	}

	if (!isBusinessExplorerNode(node)) {
		return { bid: '', cid: '' };
	}

	if (String(node?.NodeType ?? '').toLowerCase() === 'contact') {
		return {
			bid: String(node?.bid ?? node?.parentEntID ?? '').trim(),
			cid: String(node?.cid ?? node?.NodeEntID ?? node?.key ?? '').trim(),
		};
	}

	return {
		bid: String(node?.bid ?? node?.NodeEntID ?? node?.key ?? '').trim(),
		cid: '',
	};
}

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

function getCleanFileName(rawName: string): string {
	if (!rawName) return '';
	const base = rawName.split('/').pop() || rawName;
	const match = base.match(/^[^-]+-[^-]+-\d{12}-(.*)$/);
	return match ? match[1] : base;
}

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

function mapToTodoItem(record: Record<string, unknown>, index: number, defaultBid?: string, defaultCid?: string): ITodoItem {
	const docId = String(record.id || record.todoid || record.docId || `todo_${index}`);
	const rawFileName = record.filename ? String(record.filename).trim() : undefined;
	const bid = String(record.bid ?? defaultBid ?? '').trim();
	const cid = String(record.cid ?? defaultCid ?? '').trim();
	return {
		id: docId,
		bid,
		cid,
		btype: String(record.btype ?? ''),
		status: String(record.status ?? 'Open'),
		whattodo: String(record.whattodo ?? record.title ?? record.message ?? ''),
		duedate: String(record.duedate ?? ''),
		addedby: String(record.addedby ?? ''),
		filename: rawFileName,
		datecreated: record.datecreated ? String(record.datecreated) : undefined,
	};
}

function getTargetFeatureForBid(
	item: ITodoItem,
	businesses?: Array<{ bid?: string; btype?: string; tag?: string; bname?: string }>
): string {
	const textToCheck = `${item.btype || ''} ${item.whattodo || ''} ${item.filename || ''}`.toLowerCase();
	if (
		textToCheck.includes('visio') ||
		textToCheck.includes('vss') ||
		textToCheck.includes('stencil')
	) {
		return ClientEnums.VisioStencils;
	}

	const business = businesses?.find((b) => b.bid === item.bid);
	if (business) {
		const bText = `${business.tag || ''} ${business.btype || ''} ${business.bname || ''}`.toLowerCase();
		if (bText.includes('visio') || bText.includes('enduser') || bText.includes('stencil')) {
			return ClientEnums.VisioStencils;
		}
	}

	return ClientEnums.NetZoom;
}

const AddToDo = (props: IAddToDo) => {
	const mainAppContext = useMainAppContext();
	const statusBarContext = useStatusBarContext();
	const smDataContext = useSmDataContext();
	const userInfo = mainAppContext.authSession;
	const authSession = mainAppContext.authSession;
	const userBid = String(authSession?.bid ?? userInfo?.bid ?? '').trim();
	const userCid = String(authSession?.cid ?? userInfo?.cid ?? '').trim();
	const noteby = authSession?.displayName ?? authSession?.username ?? userInfo?.username ?? userInfo?.email ?? 'User';
	const bucketName = authSession?.bucketName ?? 'n20-bucket-01';
	const baseFolder = authSession?.baseFolder ?? 'sm';

	// Resolve selected bid & cid from tree selection or node
	const resolvedTarget = useMemo(() => {
		return resolveBidCid(smDataContext.selection, props.selectedNode);
	}, [smDataContext.selection, props.selectedNode]);

	const selectedBid = resolvedTarget.bid;
	const selectedCid = resolvedTarget.cid;

	// Due Date state (must be in future, after today)
	const minFutureDate = useMemo(() => getTomorrowDateString(), []);
	const [dueDate, setDueDate] = useState<string>(getTomorrowDateString());
	const [dateError, setDateError] = useState<string>('');

	const createActivityLogRef = useRef(mainAppContext.createActivityLog);
	useEffect(() => {
		createActivityLogRef.current = mainAppContext.createActivityLog;
	}, [mainAppContext.createActivityLog]);

	const getStoragePath = useCallback((filename: string): string => {
		if (!filename) return '';
		if (filename.includes('/')) return filename;
		return `${bucketName}/${baseFolder}/smfiles/tickets/${filename}`;
	}, [bucketName, baseFolder]);

	const { loading, error, getTodos, todos, createTodo, updateTodo, deleteTodo } = useTodos();
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
		noteId: 'add-todo-note',
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

	// Filter and sort todos for selected bid / cid
	useEffect(() => {
		if (Array.isArray(todos)) {
			const mapped = todos.map((item, index) => mapToTodoItem(item, index, userBid, userCid));
			// Filter by selected bid / cid if available
			const filtered = mapped.filter((item) => {
				if (selectedBid && selectedCid) {
					return item.bid === selectedBid && item.cid === selectedCid;
				}
				if (selectedBid) {
					return item.bid === selectedBid;
				}
				return true;
			});
			const sorted = [...filtered].sort((a, b) => parseTodoDate(a) - parseTodoDate(b));
			setTodoItems(sorted);
		} else if (todos === null) {
			setTodoItems([]);
		}
	}, [todos, selectedBid, selectedCid, userBid, userCid]);

	// Auto-scroll to bottom of list when items update
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
				console.error('AddToDo: downloadSingleFile failed', res?.error, res?.message);
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
				console.error('AddToDo: no downloadUrl returned', res);
			}
		} catch (err) {
			console.error('AddToDo: handleDownloadFile error', err);
		} finally {
			statusBarContext?.setIsLoading?.(false);
			statusBarContext?.setLoadingLabel?.('');
		}
	}, [downloadSingleFile, getStoragePath, statusBarContext]);

	const resetEditor = useCallback(() => {
		setSelectedItem(null);
		setDueDate(getTomorrowDateString());
		setDateError('');
		setNoteDetailsState({
			maxAudioRecordingTime: 0,
			maxVideoRecordingTime: 0,
			noteId: 'add-todo-note',
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

	const handleSelectTodo = useCallback(async (item: ITodoItem) => {
		if (selectedItem === item) {
			resetEditor();
			return;
		}

		setSelectedItem(item);
		if (item.duedate) {
			const rawDate = String(item.duedate).slice(0, 10);
			if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
				setDueDate(rawDate);
			}
		}

		const textContent = String(item.whattodo ?? '');
		const rawFileName = String(item.filename || '').trim();
		const hasFile = Boolean(rawFileName && !rawFileName.startsWith('sample-file-'));

		if (!hasFile) {
			setNoteDetailsState({
				maxAudioRecordingTime: 0,
				maxVideoRecordingTime: 0,
				noteId: item.id || 'add-todo-note',
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
			noteId: item.id || 'add-todo-note',
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
				console.error('AddToDo: downloadSingleFile failed', res?.error, res?.message);
				return;
			}
			const downloadUrl = res?.blobUrl;
			if (downloadUrl) {
				const response = await fetch(downloadUrl);
				const fileBlob = await response.blob();

				setNoteDetailsState({
					maxAudioRecordingTime: 0,
					maxVideoRecordingTime: 0,
					noteId: item.id || 'add-todo-note',
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
			console.error('AddToDo: error downloading file for edit', err);
		} finally {
			statusBarContext?.setIsLoading?.(false);
			statusBarContext?.setLoadingLabel?.('');
		}
	}, [selectedItem, resetEditor, downloadSingleFile, getStoragePath, statusBarContext]);

	const handleCardClick = useCallback(async (item: ITodoItem, event?: React.MouseEvent) => {
		void handleSelectTodo(item);

		const bid = String(item.bid || '').trim();
		const cid = String(item.cid || '').trim();

		if (bid && cid) {
			const targetFeature = getTargetFeatureForBid(item, smDataContext.datasets.businesses);
			const origin = window.location.origin;
			const pathname = window.location.pathname;
			const params = new URLSearchParams();
			params.set('bid', bid);
			params.set('cid', cid);
			params.set('feature', targetFeature);
			params.set('isnew', '1');

			const url = `${origin}${pathname}?${params.toString()}`;
			window.open(url, '_blank', 'noopener,noreferrer');
		}
	}, [handleSelectTodo, smDataContext.datasets.businesses]);

	const handleDeleteAttachment = useCallback(
		(objectType: 'file' | 'audio' | 'video', _objectData?: Blob | File) => {
			void objectType;
			void _objectData;
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

	const sendTodo = useCallback(async (message: INote) => {
		const content = String(message.notecontent ?? '').trim();
		if (!content) {
			return;
		}

		// Validate future due date
		if (!dueDate || !isDateInFuture(dueDate)) {
			setDateError('Due date must be in the future (after current date)');
			return;
		}
		setDateError('');

		const isoDueDate = parseToIsoDate(dueDate) || dueDate;

		const effectiveBid = selectedBid || userBid;
		const effectiveCid = selectedCid || userCid;
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
						console.error('AddToDo: uploadRemoteFile failed', uploadResult?.error, uploadResult?.message);
					}
				} catch (err) {
					console.error('AddToDo: uploadRemoteFile error', err);
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
					console.warn('AddToDo: error deleting previous attachment', err);
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
				whattodo: content,
				duedate: isoDueDate,
				addedby: selectedItem.addedby || userShortName,
				filename: finalFileName,
			};

			setTodoItems((prev) =>
				prev.map((item) =>
					item === selectedItem || (todoId && item.id === todoId)
						? {
							...item,
							whattodo: content,
							duedate: isoDueDate,
							filename: finalFileName,
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
							console.error('AddToDo: createActivityLog failed', logErr);
						}
					} else {
						console.error('AddToDo: updateTodo failed', result?.error);
					}
				}
				await getTodos();
			} catch (err) {
				console.error('Error updating todo:', err);
			}
			return;
		}

		// CREATE MODE
		const finalFilename = uploadedFileName || '';
		const newDocId = `todo_${effectiveCid || effectiveBid}_${Date.now()}`;
		const newTodoDoc: Record<string, unknown> = {
			bid: effectiveBid,
			cid: effectiveCid,
			btype: 'Standard',
			status: 'Open',
			whattodo: content,
			duedate: isoDueDate,
			addedby: userShortName,
			filename: finalFilename,
		};

		const optimisticRow: ITodoItem = {
			id: newDocId,
			bid: effectiveBid,
			cid: effectiveCid,
			btype: 'Standard',
			status: 'Open',
			whattodo: content,
			duedate: isoDueDate,
			addedby: userShortName,
			filename: finalFilename,
			datecreated: now,
		};

		setTodoItems((prev) => [...prev, optimisticRow]);
		resetEditor();

		try {
			const result = await createTodo(newTodoDoc);
			if (result && result.success !== false) {
				const createdId = result.id || newDocId;
				try {
					await createActivityLogRef.current?.(`${effectiveCid || noteby} of ${effectiveBid} created todo ${createdId} successfully.`);
				} catch (logErr) {
					console.error('AddToDo: createActivityLog failed', logErr);
				}
			} else {
				console.error('AddToDo: createTodo failed', result?.error);
			}
			await getTodos();
		} catch (err) {
			console.error('Error creating todo:', err);
		}
	}, [dueDate, selectedBid, userBid, selectedCid, userCid, userInfo, authSession, selectedItem, resetEditor, noteby, getStoragePath, deleteFiles, updateTodo, getTodos, createTodo, uploadRemoteFile, bucketName, baseFolder, statusBarContext]);

	const deleteImage: IImage = {
		uniqueName: 'add-todo-delete-icon',
		source: (
			<Delete24x24
				size={FnGetCssVariable('--image-size-2')}
				fill="none"
				strokeWidth={1}
			/>
		),
		w: 'var(--image-size-2)',
		type: 'svg',
		tooltip: 'Click to Delete',
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

			const rawFileName = String(deleteItem.filename || '').trim();
			statusBarContext?.setIsLoading?.(true);
			statusBarContext?.setLoadingLabel?.('Deleting todo...');
			try {
				if (rawFileName && !rawFileName.startsWith('sample-file-')) {
					try {
						statusBarContext?.setLoadingLabel?.('Deleting attachment...');
						const storagePath = getStoragePath(rawFileName);
						await deleteFiles([storagePath]);
					} catch (err) {
						console.error('AddToDo: error deleting file from cloud storage', err);
					}
				}

				setTodoItems((prev) => prev.filter((item) => item !== deleteItem && item.id !== deleteItem.id));

				const todoId = deleteItem.id;
				if (todoId) {
					statusBarContext?.setLoadingLabel?.('Deleting todo...');
					const result = await deleteTodo(todoId);
					if (result && result.success !== false) {
						try {
							await createActivityLogRef.current?.(`${selectedCid || noteby} of ${selectedBid || userBid} deleted todo ${todoId} successfully.`);
						} catch (logErr) {
							console.error('AddToDo: createActivityLog failed', logErr);
						}
					} else {
						console.error('AddToDo: deleteTodo failed', result?.error);
					}
				}
				await getTodos();
			} catch (err) {
				console.error('Error deleting todo:', err);
			} finally {
				statusBarContext?.setIsLoading?.(false);
				statusBarContext?.setLoadingLabel?.('');
			}
		}
		setDeleteOpen(false);
		setDeleteItem(null);
	};

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
						uniqueName={`${props.uniqueName}-attach-${index}`}
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
					uniqueName={`${props.uniqueName}-info-${index}`}
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

	const targetSummary = useMemo(() => {
		if (selectedBid && selectedCid) {
			return `Showing ToDo for Business: ${selectedBid} · Contact: ${selectedCid}`;
		}
		if (selectedBid) {
			return `Showing ToDo for Business: ${selectedBid}`;
		}
		return '';
	}, [selectedBid, selectedCid]);

	return (
		<div
			className="nz-node-list-Container nz-fqa-add-todo"
			tabIndex={1}
			onKeyDown={handleContainerKeyDown}
			key={props.uniqueName}
		>
			<div className="nz-notes-list-main-div">
				<div className="nz-notes-list-with-msg-box">
					<div className="nz-sub-header">
						<Label
							uniqueName={`${props.uniqueName}-header`}
							label="Add to ToDo"
						/>
					</div>

					<div className="nz-notes-list-scroll" ref={scrollRef}>
						{loading && (
							<div className="nz-notes-loading" style={{ padding: '10px', textAlign: 'center' }}>
								<Label uniqueName="todo-loading" label="Loading todos..." />
							</div>
						)}
						{error && (
							<div className="nz-notes-error" style={{ padding: '10px', color: 'var(--danger, #ff4d4f)' }}>
								<Label uniqueName="todo-error" label={typeof error === 'string' ? error : 'Failed to load todos'} />
							</div>
						)}
						{!loading && !error && todoItems.length === 0 && (
							<div className="nz-notes-empty" style={{ padding: '10px', textAlign: 'center', opacity: 0.7 }}>
								<Label uniqueName="todo-empty" label="No to-do items found" />
							</div>
						)}
						{todoItems.map((item, index) => {
							const todoKey = item.id ? item.id : `${item.bid}-${item.cid}-${index}`;
							const message = item.whattodo ?? '';
							const isSelected = selectedItem === item || (selectedItem?.id && item.id === selectedItem.id);
							return (
								<div
									className={`nz-node-list-box${isSelected ? ' nz-node-list-box-selected' : ''}`}
									key={todoKey}
									onClick={(e) => handleCardClick(item, e)}
									style={{ cursor: 'pointer' }}
									title={item.bid && item.cid ? `Click to launch SM for BID: ${item.bid}, CID: ${item.cid}` : undefined}
								>
									<div className="nz-node-list-delete">
										<div
											onClick={(event) => event.stopPropagation()}
											onKeyDown={(event) => event.stopPropagation()}
										>
											<ActionImage
												image={deleteImage}
												w="var(--node_height)"
												h="var(--node_height)"
												uniqueName={`${props.uniqueName}-delete-${index}`}
												actionCode="delete"
												disabled={false}
												handleMouse={() => handleDelete(item)}
											/>
										</div>
										<div className="nz-note-date">
											<Label
												uniqueName={`${props.uniqueName}-status-${index}`}
												label={item.status || ''}
											/>
											{item.duedate && (
												<span className="nz-todo-badge-duedate" title={`Due Date: ${item.duedate}`}>
													Due: {String(item.duedate).slice(0, 10)}
												</span>
											)}
										</div>
										<div className="nz-note-user">
											<Label
												uniqueName={`${props.uniqueName}-type-${index}`}
												label={[item.btype, item.bid ? `bid: ${item.bid}` : '', item.cid ? `cid: ${item.cid}` : ''].filter(Boolean).join(' · ')}
											/>
										</div>
									</div>
									<div className="nz-info-div">
										{renderTodoIcon(item, index)}
										<div className="nz-nodes-text">
											<Label
												uniqueName={`${props.uniqueName}-text-${index}`}
												label={message}
											/>
										</div>
									</div>
								</div>
							);
						})}
					</div>
					<div className="nz-todo-editor-section">
						<div className="nz-todo-due-date-row">
							<DateControl
								id={`${props.uniqueName}-duedate`}
								name="dueDate"
								label="Due Date:"
								value={dueDate}
								min={minFutureDate}
								onChange={(val) => {
									const strVal = String(val ?? '');
									setDueDate(strVal);
									if (!isDateInFuture(strVal)) {
										setDateError('Due date must be in the future (after current date)');
									} else {
										setDateError('');
									}
								}}
							/>

							{selectedItem && (
								<button
									type="button"
									onClick={resetEditor}
									className="nz-todo-cancel-edit-btn"
									title="clear"
								>
									Clear
								</button>
							)}

							{dateError && (
								<div className="nz-todo-date-error">
									{dateError}
								</div>
							)}
						</div>

						{targetSummary && (
							<div className="nz-todo-target-info">
								{targetSummary}
							</div>
						)}

						<div className="nz-notes-container">
							{noteDetailsState && (
								<Notes
									key={`${notesKey}-${selectedItem?.id ?? 'new'}`}
									{...noteDetailsState}
									allowAudio={false}
									allowVideo={false}
									sendTooltip={selectedItem ? 'Update To Do' : 'Add To Do'}
									sendNote={sendTodo}
									handleDelete={handleDeleteAttachment}
								/>
							)}
						</div>
					</div>
				</div>
			</div>
			<YesNoFormContainer
				isOpen={deleteOpen}
				uniqueName={`${props.uniqueName}-delete`}
				message="Are you sure you want to delete this to-do?"
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

export { AddToDo, AddToDo as ToDo };
export default AddToDo;
