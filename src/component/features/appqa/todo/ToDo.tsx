import { useCallback, useEffect, useRef, useState } from 'react';
import { Notes } from '@n20a/libavnotes';
import type { INote } from '@n20a/libavnotes';
import '@n20a/libavnotes/style.css';
import { Attach24x24, Delete24x24, Info24x24 } from '@n20a/libicon';
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable';
import { handleContainerKeyDown } from '../../../shared/allcommon/basic/FnHandleContainerKeyDown';
import { IImage } from '../../../shared/allinterface/basic/IImage';
import { ActionImage } from '../../../shared/basic/actionimage/ActionImage';
import { Label } from '../../../shared/basic/label/Label';
import { Image } from '../../../shared/basic/image/Image';
import { YesNoFormContainer } from '../../../shared/basic/yesnoformcontainer/YesNoFormContainer';
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks';
import { useStatusBarContext } from '../../../shared/context/hooks/StatusBarHooks';
import '../../../shared/sidebar/notes/FqaNotes.css';
import './ToDo.css';
import { useTodos, useFileDownload, useFileDelete } from '@n20a/libfsdb';
import type { ITodoDoc } from '@n20a/libfsdb';
import { useUploadRemoteFile } from '../../../shared/allcommon/UploadRemoteFileHooks';
import { ClientEnums } from '../../../constants/Feature';
import { useSmDataContext } from '../../../shared/context/hooks/SmDataHooks';

interface IToDo {
	uniqueName: string;
	featureId?: string;
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

/**
 * Determines whether a ToDo card's bid belongs to NetZoom or VisioStencils.
 */
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

const ToDo = (todoProps: IToDo) => {
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
	const { upload: uploadRemoteFile, uploading: remoteUploading, progress: uploadProgress, error: remoteUploadError } = useUploadRemoteFile();
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

	// Sync local list with Firestore todos hook (sorted ascending by date)
	useEffect(() => {
		if (Array.isArray(todos)) {
			const mapped = todos.map((item, index) => mapToTodoItem(item, index, userBid, userCid));
			const sorted = [...mapped].sort((a, b) => parseTodoDate(a) - parseTodoDate(b));
			setTodoItems(sorted);
		} else if (todos === null) {
			setTodoItems([]);
		}
	}, [todos, userBid, userCid]);

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
				console.error('ToDo: downloadSingleFile failed', res?.error, res?.message);
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
				console.error('ToDo: no downloadUrl returned', res);
			}
		} catch (err) {
			console.error('ToDo: handleDownloadFile error', err);
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
		const textContent = String(item.whattodo ?? '');
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

		// Show note text immediately while file is loading
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
				console.error('ToDo: downloadSingleFile failed', res?.error, res?.message);
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
			console.error('ToDo: error downloading file for edit', err);
		} finally {
			statusBarContext?.setIsLoading?.(false);
			statusBarContext?.setLoadingLabel?.('');
		}
	}, [selectedItem, resetEditor, downloadSingleFile, getStoragePath, statusBarContext]);
	const SM_TAB_PREFIX = 'SM-';

	const getSmTabLabels = async (): Promise<string[]> => {
		const currentTitle = document.title;
		const initialLabels = currentTitle.startsWith(SM_TAB_PREFIX) ? [currentTitle] : [];
		const labels = new Set<string>(initialLabels);

		try {
			const channel = new BroadcastChannel('sm-tab-control');
			const requestId = `sm-tabs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

			const listener = (event: MessageEvent) => {
				if (event.data?.action !== 'response-sm-tab-label') return;
				if (event.data?.requestId !== requestId) return;

				const label = event.data?.label;
				if (typeof label === 'string' && label.startsWith(SM_TAB_PREFIX)) {
					labels.add(label);
				}
			};

			channel.addEventListener('message', listener);
			channel.postMessage({ action: 'request-sm-tab-label', requestId });

			await new Promise((resolve) => setTimeout(resolve, 150));

			channel.removeEventListener('message', listener);
			channel.close();
		} catch (error) {
			console.warn('Failed to query SM- tab labels:', error);
		}

		return Array.from(labels);
	};

	// Clicking on a ToDo card selects the item locally and, if bid and cid are both non-empty,
	// launches another instance of sm20 in a new browser tab with bid, cid, and auto-selected feature
	const handleCardClick = useCallback(async (item: ITodoItem, event?: React.MouseEvent) => {
		void handleSelectTodo(item);

		const bid = String(item.bid || '').trim();
		const cid = String(item.cid || '').trim();

		if (bid && cid) {
			const targetFeature = getTargetFeatureForBid(item, smDataContext.datasets.businesses);
			const origin = window.location.origin;
			const pathname = window.location.pathname;
			const params = new URLSearchParams();
			const existingSMTabs = await getSmTabLabels();
			const newTabLabel = `SM-${existingSMTabs.length + 1}`;
			params.set('bid', bid);
			params.set('cid', cid);
			params.set('feature', targetFeature);
			params.set('isnew', '1');
			params.set('tablabel', newTabLabel);

			const url = `${origin}${pathname}?${params.toString()}`;
			window.open(url, '_blank', 'noopener,noreferrer');
		}
	}, [handleSelectTodo, smDataContext.datasets.businesses]);

	// Remove file attachment inside Notes control
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

	// Create or Update todo
	const sendTodo = useCallback(async (message: INote) => {
		const content = String(message.notecontent ?? '').trim();
		if (!content) {
			return;
		}

		const authSession = mainAppContext.authSession;
		const userBid = String(userInfo?.bid ?? authSession?.bid ?? '').trim();
		const userCid = String(userInfo?.cid ?? authSession?.cid ?? '').trim();
		const userShortName = String(userInfo?.username ?? userInfo?.email ?? authSession?.displayName ?? authSession?.username ?? 'User').trim();
		const now = new Date().toISOString();

		// ── Upload attached file if present ──
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
				uploadedFileName = generateUniqueFileName(userBid, userCid, rawFileName);

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
						console.error('ToDo: uploadRemoteFile failed', uploadResult?.error, uploadResult?.message);
					}
				} catch (err) {
					console.error('ToDo: uploadRemoteFile error', err);
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

			// If previous file attachment was replaced or removed, delete it from Cloud Storage
			if (previousFileName && previousFileName !== finalFileName && !previousFileName.startsWith('sample-file-')) {
				try {
					statusBarContext?.setIsLoading?.(true);
					statusBarContext?.setLoadingLabel?.('Deleting previous attachment...');
					const oldStoragePath = getStoragePath(previousFileName);
					await deleteFiles([oldStoragePath]);
				} catch (err) {
					console.warn('ToDo: error deleting previous attachment', err);
				} finally {
					statusBarContext?.setIsLoading?.(false);
					statusBarContext?.setLoadingLabel?.('');
				}
			}

			const updatedDoc: Record<string, unknown> = {
				bid: selectedItem.bid || userBid,
				cid: selectedItem.cid || userCid,
				btype: selectedItem.btype || 'Standard',
				status: selectedItem.status || 'Open',
				whattodo: content,
				duedate: selectedItem.duedate || now,
				addedby: selectedItem.addedby || userShortName,
				filename: finalFileName,
			};

			// Optimistic local update
			setTodoItems((prev) =>
				prev.map((item) =>
					item === selectedItem || (todoId && item.id === todoId)
						? {
							...item,
							whattodo: content,
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
							await createActivityLogRef.current?.(`${userCid || noteby} of ${userBid} updated todo ${todoId} successfully.`);
						} catch (logErr) {
							console.error('ToDo: createActivityLog failed', logErr);
						}
					} else {
						console.error('ToDo: updateTodo failed', result?.error);
					}
				}
				await getTodos();
			} catch (err) {
				console.error('Error updating todo:', err);
			}
			return;
		}

		// ── CREATE MODE: Appended to the end of the list ──
		const finalFilename = uploadedFileName || '';
		const newDocId = `todo_${userCid}_${Date.now()}`;
		const newTodoDoc: Record<string, unknown> = {
			bid: userBid,
			cid: userCid,
			btype: 'Standard',
			status: 'Open',
			whattodo: content,
			duedate: now,
			addedby: userShortName,
			filename: finalFilename,
		};

		const optimisticRow: ITodoItem = {
			id: newDocId,
			bid: userBid,
			cid: userCid,
			btype: 'Standard',
			status: 'Open',
			whattodo: content,
			duedate: now,
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
					await createActivityLogRef.current?.(`${userCid || noteby} of ${userBid} created todo ${createdId} successfully.`);
				} catch (logErr) {
					console.error('ToDo: createActivityLog failed', logErr);
				}
			} else {
				console.error('ToDo: createTodo failed', result?.error);
			}
			await getTodos();
		} catch (err) {
			console.error('Error creating todo:', err);
		}
	}, [selectedItem, userInfo, authSession, userBid, userCid, noteby, createTodo, updateTodo, getTodos, uploadRemoteFile, resetEditor, bucketName, baseFolder, getStoragePath, deleteFiles, statusBarContext]);

	const deleteImage: IImage = {
		uniqueName: 'todo-delete-icon',
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

	// Delete file from Cloud Storage FIRST, then delete todo document
	const handleConfirmDelete = async () => {
		if (deleteItem) {
			if (selectedItem === deleteItem) {
				resetEditor();
			}

			const rawFileName = String(deleteItem.filename || '').trim();
			statusBarContext?.setIsLoading?.(true);
			statusBarContext?.setLoadingLabel?.('Deleting todo...');
			try {
				// Delete file from Cloud Storage FIRST if it exists
				if (rawFileName && !rawFileName.startsWith('sample-file-')) {
					try {
						statusBarContext?.setLoadingLabel?.('Deleting attachment...');
						const storagePath = getStoragePath(rawFileName);
						await deleteFiles([storagePath]);
					} catch (err) {
						console.error('ToDo: error deleting file from cloud storage', err);
					}
				}

				// Optimistic deletion
				setTodoItems((prev) => prev.filter((item) => item !== deleteItem && item.id !== deleteItem.id));

				const todoId = deleteItem.id;
				if (todoId) {
					statusBarContext?.setLoadingLabel?.('Deleting todo...');
					const result = await deleteTodo(todoId);
					if (result && result.success !== false) {
						try {
							await createActivityLogRef.current?.(`${userCid || noteby} of ${userBid} deleted todo ${todoId} successfully.`);
						} catch (logErr) {
							console.error('ToDo: createActivityLog failed', logErr);
						}
					} else {
						console.error('ToDo: deleteTodo failed', result?.error);
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
						uniqueName={`${todoProps.uniqueName}-attach-${index}`}
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
					uniqueName={`${todoProps.uniqueName}-info-${index}`}
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
			key={todoProps.uniqueName}
		>
			<div className="nz-notes-list-main-div">
				<div className="nz-notes-list-with-msg-box">
					<div className="nz-sub-header">
						<Label
							uniqueName={`${todoProps.uniqueName}-header`}
							label={`ToDo${todoItems.length > 0 ? ` (${todoItems.length})` : ''}`}
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
												uniqueName={`${todoProps.uniqueName}-delete-${index}`}
												actionCode="delete"
												disabled={false}
												handleMouse={() => handleDelete(item)}
											/>
										</div>
										<div className="nz-note-date">
											<Label
												uniqueName={`${todoProps.uniqueName}-status-${index}`}
												label={item.status || ''}
											/>
										</div>
										<div className="nz-note-user">
											<Label
												uniqueName={`${todoProps.uniqueName}-type-${index}`}
												label={[item.btype, item.bid ? `bid: ${item.bid}` : '', item.cid ? `cid: ${item.cid}` : ''].filter(Boolean).join(' · ')}
											/>
										</div>
									</div>
									<div className="nz-info-div">
										{renderTodoIcon(item, index)}
										<div className="nz-nodes-text">
											<Label
												uniqueName={`${todoProps.uniqueName}-text-${index}`}
												label={message}
											/>
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
								sendTooltip={selectedItem ? 'Update To Do' : 'Send To Do'}
								sendNote={sendTodo}
								handleDelete={handleDeleteAttachment}
							/>
						)}
					</div>
				</div>
			</div>
			<YesNoFormContainer
				isOpen={deleteOpen}
				uniqueName={`${todoProps.uniqueName}-delete`}
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

export { ToDo, ToDo as AppqaToDo };
export default ToDo;
