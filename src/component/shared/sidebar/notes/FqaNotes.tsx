
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IImage } from '../../allinterface/basic/IImage';
import { Notes } from '@n20a/libavnotes';
import type { INote } from '@n20a/libavnotes';
import { useStatusBarContext } from '../../context/hooks/StatusBarHooks';
import { useSessionContext } from '../../context/hooks/SessionHooks';
import { useMainAppContext } from '../../context/hooks/MainAppHooks';
import './FqaNotes.css';
import '@n20a/libavnotes/style.css';
import { FilterKeywordControl } from '../../searchfilter/filterkeywordcontrol/FilterKeywordControl';
import { FnConvertTimestampToDate, FnParseTimestampToISO } from '../../../appcontainer/allcommon/FnConvertTimestampToDate';
import { FnGetSessionVariableFromStorage } from '../../allcommon/basic/FnGetSessionVariableFromStorage';
import { ITreeNode } from '../../allinterface/tree/ITreeControl';
import { YesNoFormContainer } from '../../basic/yesnoformcontainer/YesNoFormContainer';
import { ActionImage } from '../../basic/actionimage/ActionImage';
import { Label } from '../../basic/label/Label';
import { Image } from '../../basic/image/Image';
import { Attach24x24, Close24x24, Delete24x24, Info24x24, Mic24x24, Video24x24 } from '@n20a/libicon';
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable';
import { ISession } from '../../context/allinterface/ISession';
import { useBusinessNotes, useFileDownload, useFileDelete } from '@n20a/libfsdb';
import { useUploadRemoteFile } from '../../allcommon/UploadRemoteFileHooks';

const CLOUD_BUCKET = 'n20-bucket-01';

interface IFqaNotes {
	uniqueName: string; // A unique identifier for notes
	hideSearchControl: boolean;
	selectedNode: ITreeNode;
}

interface INoteItems {
	EntityName?: string | null;
	LastUpdated?: string | null; // ISO timestamp, could also be Date if you parse it
	NodeType?: string | null;
	NotesMAX: string;
	NotesType?: string | null;
	UserName?: string | null;
	audio?: unknown;
	file?: unknown;
	fileObj?: any;
	video?: unknown;
	FileUID?: string | null;
	noteid?: string;
	message?: string;
	filename?: string | null;
	[key: string]: any;
}

/**
 * Converts a note document / row into a numeric timestamp for chronological sorting.
 */
function parseNoteDate(item: Record<string, any>): number {
	const rawDate = item.datecreated ?? item.LastUpdated ?? item.lastupdated ?? item.monitorupdated;
	if (rawDate != null && rawDate !== '') {
		if (typeof rawDate === 'number') {
			return rawDate;
		}
		if (rawDate instanceof Date) {
			return rawDate.getTime();
		}
		if (typeof rawDate === 'object') {
			if ('toDate' in rawDate && typeof (rawDate as { toDate: () => Date }).toDate === 'function') {
				return (rawDate as { toDate: () => Date }).toDate().getTime();
			}
			if ('seconds' in rawDate && typeof (rawDate as { seconds: number }).seconds === 'number') {
				return (rawDate as { seconds: number }).seconds * 1000;
			}
		}
		if (typeof rawDate === 'string') {
			const parsed = Date.parse(rawDate);
			if (!isNaN(parsed)) {
				return parsed;
			}
		}
	}
	const noteId = String(item.id ?? item.noteid ?? item._noteid ?? '');
	const match = noteId.match(/_(\d{10,13})$/);
	if (match) {
		const ts = Number(match[1]);
		if (!isNaN(ts)) return ts;
	}
	return 0;
}

/**
 * Prepares a unique file name prefixed with "{bid}-{cid}-{yymmddhhmmss}".
 */
function generateUniqueFileName(bid: string, cid: string, originalName: string, defaultExt = 'png'): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	const yymmddhhmmss = `${String(now.getFullYear()).slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
	const cleanName = originalName.trim() || `attachment.${defaultExt}`;
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
 * Builds the Firebase Cloud Storage path for tickets attachments.
 * Format: ${bucketName}/${baseFolder}/smfiles/tickets/${filename}
 */
function buildStoragePathForTickets(filename: string): string {
	if (!filename) return '';
	if (filename.includes('/')) return filename;
	const cfg = () => (window as Window & { APP_CONFIG?: Record<string, string> }).APP_CONFIG ?? {};
	const c = cfg();
	const baseFolder = c.BASE_FOLDER ?? 'sm';
	const bucketName = c.BUCKET_NAME ?? c.FIREBASE_BUCKET ?? CLOUD_BUCKET ?? 'n20-bucket-01';
	return `${bucketName}/${baseFolder}/smfiles/tickets/${filename}`;
}

/**
 * Detects whether a note item contains audio, video, generic file, or plain message.
 */
function getNoteFileType(item: INoteItems): 'audio' | 'video' | 'file' | 'message' {
	const rawFileName = String(item.filename || item.FileUID || '').toLowerCase().trim();
	const type = String(item.NotesType || '').toLowerCase().trim();

	if (type === 'audio') return 'audio';
	if (type === 'video') return 'video';

	if (rawFileName && !rawFileName.startsWith('sample-file-')) {
		if (
			rawFileName.endsWith('.mp3') ||
			rawFileName.endsWith('.wav') ||
			rawFileName.endsWith('.ogg') ||
			rawFileName.endsWith('.m4a') ||
			rawFileName.endsWith('.aac') ||
			rawFileName.endsWith('.flac') ||
			rawFileName.endsWith('.oga') ||
			rawFileName.includes('audio')
		) {
			return 'audio';
		}
		if (
			rawFileName.endsWith('.mp4') ||
			rawFileName.endsWith('.mov') ||
			rawFileName.endsWith('.avi') ||
			rawFileName.endsWith('.mkv') ||
			rawFileName.endsWith('.webm') ||
			rawFileName.includes('video')
		) {
			return 'video';
		}
		return 'file';
	}

	if (type === 'image' || type === 'file') return 'file';
	return 'message';
}

/**
 * Reads a Blob/File as pure Base64 (without the "data:<type>;base64," prefix).
 */
function fileToBase64(file: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = String(reader.result ?? '');
			const base64 = result.includes(',') ? result.split(',')[1] : result;
			resolve(base64);
		};
		reader.onerror = (error) => reject(error);
		reader.readAsDataURL(file);
	});
}

const searchProps = {
	uniqueName: 'filtericon',
	isShowFilterControl: true,
	lensDirty: false,
	filterDirty: false,
	searchInputValue: '',
};

const FqaNotes = (props: IFqaNotes) => {
	const [editingItem, setEditingItem] = useState<INoteItems | null>(null);
	const [deleteItem, setDeleteItem] = useState<INoteItems | null>(null);
	const [noteDetails, setNoteDetails] = useState<INote>();
	const [searchText, setSearchText] = useState<string>('');
	const [notesItems, setNoteItems] = useState<INoteItems[]>([]);
	const [lensDirty, setLensDirty] = useState<boolean>(false);
	const [originalNotesItems, setOriginalNotesItems] = useState<INoteItems[]>([]);
	const [searchControlProps] = useState<any>(searchProps);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [confirmMessage, setConfirmMessage] = useState('');
	const [showOkButton, setShowOkButton] = useState<boolean>(false);
	const [refreshToken, setRefreshToken] = useState<number>(0);
	const [fileUploading, setFileUploading] = useState<boolean>(false);

	const scrollRef = useRef<HTMLDivElement>(null);

	const statusBarContext = useStatusBarContext();
	const sessionContext = useSessionContext();
	const mainAppContext = useMainAppContext();

	const authSession = mainAppContext?.authSession;
	const businessId = String(props.selectedNode?.bid ?? authSession?.bid ?? props.selectedNode?.NodeEntID ?? '').trim();
	const cid = String(props.selectedNode?.cid ?? authSession?.cid ?? '').trim();

	const { loading, error, getNotes, notes, deleteNote, createNote, updateNote } = useBusinessNotes(businessId);
	const { upload: uploadRemoteFile, uploading: remoteUploading, progress: uploadProgress, error: remoteUploadError } = useUploadRemoteFile();
	const { downloadSingleFile, downloading } = useFileDownload();
	const { deleteFiles, deleting } = useFileDelete();

	const isHideAVNotes = useMemo(() => {
		const avNotesRecord = mainAppContext?.apRecords?.find(
			(item) =>
				item?.Name?.toLowerCase() === 'avnotes' ||
				item?._AP?.toLowerCase() === 'avnotes'
		);
		if (!avNotesRecord) return false;
		const value =
			avNotesRecord.Value !== undefined &&
				avNotesRecord.Value !== null &&
				avNotesRecord.Value !== ''
				? avNotesRecord.Value
				: avNotesRecord.DefaultAPValue;
		const strValue = String(value ?? '').trim().toLowerCase();
		return strValue === '1' || strValue === 'true';
	}, [mainAppContext?.apRecords]);

	// Auto-scroll to bottom of list when notes change
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [notesItems.length]);

	// Reset editor to blank create mode
	const resetEditor = useCallback(() => {
		setEditingItem(null);
		setNoteDetails({
			maxAudioRecordingTime: 60000,
			maxVideoRecordingTime: 60000,
			noteId: `${Date.now()}`,
			noteTitle: '',
			notecontent: '',
			notefile: undefined,
			notefileName: undefined,
			noteaudio: undefined,
			notevideo: undefined,
			noteCreatedAt: new Date(),
		});
		setRefreshToken((v) => v + 1);
	}, []);

	// Download attached file from cloud storage
	const handleDownloadFile = useCallback(async (item: INoteItems, e?: React.MouseEvent) => {
		e?.stopPropagation?.();
		const rawFileName = String(item.filename || item.FileUID || '').trim();
		if (!rawFileName || rawFileName.startsWith('sample-file-')) return;

		const storagePath = buildStoragePathForTickets(rawFileName);

		statusBarContext?.setIsLoading?.(true);
		statusBarContext?.setLoadingLabel?.('Downloading file...');
		try {
			const res = await downloadSingleFile(storagePath);
			if (!res?.success) {
				console.error('FqaNotes: downloadSingleFile failed', res?.error, res?.message);
				return;
			}
			const downloadUrl = res?.blobUrl;
			if (downloadUrl) {
				const cleanName = getCleanFileName(rawFileName);
				const link = document.createElement('a');
				link.href = downloadUrl;
				link.download = cleanName || 'download';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			} else {
				console.error('FqaNotes: downloadSingleFile failed', res?.error);
			}
		} catch (err) {
			console.error('FqaNotes: handleDownloadFile error', err);
		} finally {
			statusBarContext?.setIsLoading?.(false);
			statusBarContext?.setLoadingLabel?.('');
		}
	}, [downloadSingleFile, statusBarContext]);

	// Select a note card to view & edit in the bottom Notes control
	const handleSelectCardToEdit = useCallback(async (item: INoteItems) => {
		setEditingItem(item);
		const textContent = String(item.NotesMAX ?? item.message ?? '');
		const rawFileName = String(item.filename || item.FileUID || '').trim();
		const noteId = String(item.noteid ?? item.id ?? item._noteid ?? Date.now());
		const noteFileType = getNoteFileType(item);

		if (!rawFileName || rawFileName.startsWith('sample-file-')) {
			setNoteDetails({
				maxAudioRecordingTime: 60000,
				maxVideoRecordingTime: 60000,
				noteId,
				noteTitle: '',
				notecontent: textContent,
				notefile: undefined,
				notefileName: undefined,
				noteaudio: undefined,
				notevideo: undefined,
				noteCreatedAt: new Date(),
			});
			setRefreshToken((v) => v + 1);
			return;
		}

		const cleanName = getCleanFileName(rawFileName);

		// Show note text immediately while file is being fetched
		setNoteDetails({
			maxAudioRecordingTime: 60000,
			maxVideoRecordingTime: 60000,
			noteId,
			noteTitle: '',
			notecontent: textContent,
			notefile: undefined,
			notefileName: noteFileType === 'file' ? cleanName : undefined,
			noteaudio: undefined,
			notevideo: undefined,
			noteCreatedAt: new Date(),
		});
		setRefreshToken((v) => v + 1);

		const storagePath = buildStoragePathForTickets(rawFileName);

		statusBarContext?.setIsLoading?.(true);
		statusBarContext?.setLoadingLabel?.('Loading attachment...');
		try {
			const res = await downloadSingleFile(storagePath);
			if (!res?.success) {
				console.error('FqaNotes: downloadSingleFile failed', res?.error, res?.message);
				return;
			}
			const downloadUrl = res?.blobUrl;
			if (downloadUrl) {
				const response = await fetch(downloadUrl);
				const rawBlob = await response.blob();

				let fileBlob = rawBlob;
				if (noteFileType === 'audio') {
					const mime = rawBlob.type && rawBlob.type !== 'application/octet-stream'
						? rawBlob.type
						: (cleanName.endsWith('.mp3') ? 'audio/mpeg' : cleanName.endsWith('.wav') ? 'audio/wav' : 'audio/webm');
					fileBlob = new Blob([rawBlob], { type: mime });
				} else if (noteFileType === 'video') {
					const mime = rawBlob.type && rawBlob.type !== 'application/octet-stream'
						? rawBlob.type
						: (cleanName.endsWith('.webm') ? 'video/webm' : 'video/mp4');
					fileBlob = new Blob([rawBlob], { type: mime });
				}

				setNoteDetails({
					maxAudioRecordingTime: 60000,
					maxVideoRecordingTime: 60000,
					noteId,
					noteTitle: '',
					notecontent: textContent,
					notefile: noteFileType === 'file' ? fileBlob : undefined,
					notefileName: noteFileType === 'file' ? cleanName : undefined,
					noteaudio: noteFileType === 'audio' ? fileBlob : undefined,
					notevideo: noteFileType === 'video' ? fileBlob : undefined,
					noteCreatedAt: new Date(),
				});
				setRefreshToken((v) => v + 1);
			}
		} catch (err) {
			console.error('FqaNotes: failed to fetch attached file for note editor', err);
		} finally {
			statusBarContext?.setIsLoading?.(false);
			statusBarContext?.setLoadingLabel?.('');
		}
	}, [downloadSingleFile, statusBarContext]);

	// Remove file/audio/video attachment inside Notes control
	const handleDeleteAttachment = useCallback(
		(objectType: 'file' | 'audio' | 'video', _objectData?: Blob | File) => {
			void objectType;
			void _objectData;
			setNoteDetails((prev) =>
				prev
					? {
						...prev,
						notefile: undefined,
						notefileName: undefined,
						noteaudio: undefined,
						notevideo: undefined,
					}
					: undefined
			);
			setEditingItem((prev) =>
				prev
					? {
						...prev,
						filename: '',
						FileUID: '',
					}
					: null
			);
		},
		[]
	);

	// Fetch notes for businessId
	const getNotesDetails = useCallback(async () => {
		resetEditor();
		if (businessId) {
			await getNotes();
		} else {
			setNoteItems([]);
			setOriginalNotesItems([]);
		}
	}, [businessId, getNotes, resetEditor]);

	useEffect(() => {
		if (businessId) {
			getNotesDetails();
		} else {
			resetEditor();
			setNoteItems([]);
			setOriginalNotesItems([]);
		}
	}, [businessId, getNotesDetails, resetEditor]);

	// Sync local list with Firestore notes hook (sorted ascending by date)
	useEffect(() => {
		if (Array.isArray(notes)) {
			const mappedNotes: INoteItems[] = notes.filter(Boolean).map((item: any) => {
				const rawFileName = String(item.filename ?? item.FileUID ?? '').trim();
				let inferredType = 'Message';
				if (rawFileName && !rawFileName.startsWith('sample-file-')) {
					const lower = rawFileName.toLowerCase();
					if (
						lower.endsWith('.mp3') ||
						lower.endsWith('.wav') ||
						lower.endsWith('.ogg') ||
						lower.endsWith('.m4a') ||
						lower.endsWith('.aac') ||
						lower.endsWith('.flac') ||
						lower.endsWith('.oga') ||
						lower.includes('audio')
					) {
						inferredType = 'Audio';
					} else if (
						lower.endsWith('.mp4') ||
						lower.endsWith('.mov') ||
						lower.endsWith('.avi') ||
						lower.endsWith('.mkv') ||
						lower.endsWith('.webm') ||
						lower.includes('video')
					) {
						inferredType = 'Video';
					} else {
						inferredType = 'File';
					}
				}
				const existingType = String(item.NotesType ?? '').trim();
				const resolvedType =
					existingType && existingType.toLowerCase() !== 'message'
						? (existingType.toLowerCase() === 'image' ? 'File' : existingType)
						: inferredType;

				return {
					...item,
					noteid: String(item.noteid ?? item.id ?? item.RecID ?? ''),
					EntityName: item.EntityName ?? item.bid ?? '',
					NodeType: item.NodeType ?? 'Business',
					NotesMAX: String(item.NotesMAX ?? item.message ?? item.NotesMax ?? ''),
					NotesType: resolvedType,
					UserName: item.UserName ?? item.noteby ?? item.createdby ?? '',
					LastUpdated: FnParseTimestampToISO(item.LastUpdated ?? item.datecreated ?? item.monitorupdated),
					FileUID: rawFileName,
					filename: rawFileName,
				};
			});
			// Sort ascending by date so new notes appear at the bottom/end of the list
			const sortedNotes = [...mappedNotes].sort((a, b) => parseNoteDate(a) - parseNoteDate(b));
			setOriginalNotesItems(sortedNotes);
			if (searchText) {
				const q = searchText.toLowerCase();
				setNoteItems(
					sortedNotes.filter((element) =>
						(element.NotesMAX ?? '').toLowerCase().includes(q) ||
						(element.filename ?? '').toLowerCase().includes(q) ||
						(element.UserName ?? '').toLowerCase().includes(q) ||
						(element.NotesType ?? '').toLowerCase().includes(q)
					)
				);
			} else {
				setNoteItems(sortedNotes);
			}
		} else if (notes === null) {
			setNoteItems([]);
			setOriginalNotesItems([]);
		}
	}, [notes, searchText]);

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

	// Create or Update note
	const sendNotes = useCallback(async (message: INote) => {
		const noteText = message.notecontent?.trim() ?? '';

		if (!noteText) {
			setNoteDetails(message);
			setConfirmMessage(
				'Please enter a note before saving. If you attach a file, audio, or video, include a note describing it.'
			);
			setShowOkButton(true);
			setDeleteOpen(true);
			return;
		}

		const now = new Date().toISOString();

		let LoginUserName: ISession[] | null = FnGetSessionVariableFromStorage('RequestedBy', 'LoginShortName', sessionContext.SessionList);
		const userName = (LoginUserName && LoginUserName.length > 0 && LoginUserName[0].SessionValue)
			? String(LoginUserName[0].SessionValue)
			: (authSession?.displayName || authSession?.username || authSession?.cid || 'User');

		// ── Upload attached file if present ──
		let uploadedFileName = '';
		const attachedData = message.notefile || message.noteaudio || message.notevideo;

		if (attachedData) {
			const rawFileName = message.notefileName
				|| (attachedData instanceof File ? attachedData.name : '')
				|| (message.notevideo ? 'video.mp4' : message.noteaudio ? 'audio.webm' : 'image.png');

			// If editing and user kept the original attachment without replacing it:
			const existingFileName = editingItem
				? String(editingItem.filename || editingItem.FileUID || '').trim()
				: '';
			const isSameAsExisting = Boolean(
				existingFileName && getCleanFileName(existingFileName) === rawFileName
			);

			if (isSameAsExisting) {
				uploadedFileName = existingFileName;
			} else {
				const defaultExt = message.notevideo ? 'mp4' : message.noteaudio ? 'webm' : 'png';
				uploadedFileName = generateUniqueFileName(businessId, cid, rawFileName, defaultExt);

				const cfg = () => (window as Window & { APP_CONFIG?: Record<string, string> }).APP_CONFIG ?? {};
				const c = cfg();
				const baseFolder = c.BASE_FOLDER ?? 'sm';
				const bucketName = c.BUCKET_NAME ?? c.FIREBASE_BUCKET ?? CLOUD_BUCKET ?? 'n20-bucket-01';

				setFileUploading(true);
				statusBarContext?.setIsLoading?.(true);
				statusBarContext?.setLoadingLabel?.('Uploading file...');
				try {
					const uploadResult = await uploadRemoteFile({
						source: attachedData,
						bucket: bucketName,
						baseFolder: baseFolder,
						fileName: `smfiles/tickets/${uploadedFileName}`,
					});
					if (!uploadResult?.success) {
						console.error('FqaNotes: uploadRemoteFile failed', uploadResult?.error, uploadResult?.message);
					}
				} catch (err) {
					console.error('FqaNotes: uploadRemoteFile error', err);
				} finally {
					setFileUploading(false);
					statusBarContext?.setIsLoading?.(false);
					statusBarContext?.setLoadingLabel?.('');
				}
			}
		}

		// ── EDIT MODE: update existing note ──
		if (editingItem) {
			const noteIdToUpdate = String(
				editingItem.id ?? editingItem.noteid ?? editingItem._noteid ?? editingItem.FileUID ?? ''
			);
			const finalFileName = uploadedFileName || '';
			const previousFileName = String(editingItem.filename || editingItem.FileUID || '').trim();

			// If previous file attachment was replaced or removed, delete it from Cloud Storage
			if (previousFileName && previousFileName !== finalFileName && !previousFileName.startsWith('sample-file-')) {
				try {
					statusBarContext?.setIsLoading?.(true);
					statusBarContext?.setLoadingLabel?.('Deleting previous file...');
					const oldStoragePath = buildStoragePathForTickets(previousFileName);
					await deleteFiles([oldStoragePath]);
				} catch (err) {
					console.warn('FqaNotes: error deleting previous attachment', err);
				} finally {
					statusBarContext?.setIsLoading?.(false);
					statusBarContext?.setLoadingLabel?.('');
				}
			}

			let updatedNotesType = editingItem.NotesType || 'Message';
			if (message.notevideo) updatedNotesType = 'Video';
			else if (message.noteaudio) updatedNotesType = 'Audio';
			else if (message.notefile) updatedNotesType = 'File';
			else if (!finalFileName) updatedNotesType = 'Message';

			// Optimistic update in local list
			const applyUpdate = (prev: INoteItems[]) =>
				prev.map((item) => {
					const itemId = String(item.id ?? item.noteid ?? item._noteid ?? item.FileUID ?? '');
					if (item === editingItem || (noteIdToUpdate && itemId === noteIdToUpdate)) {
						return {
							...item,
							NotesMAX: noteText,
							message: noteText,
							NotesType: updatedNotesType,
							LastUpdated: now,
							monitorupdated: now,
							FileUID: finalFileName,
							filename: finalFileName,
						};
					}
					return item;
				});

			setNoteItems(applyUpdate);
			setOriginalNotesItems(applyUpdate);
			resetEditor();

			if (noteIdToUpdate && businessId && updateNote) {
				const updatePayload: Record<string, unknown> = {
					message: noteText,
					monitorupdated: now,
					filename: finalFileName,
					noteby: userName,
				};
				const result = await updateNote(noteIdToUpdate, updatePayload);
				if (result && result.success !== false) {
					await mainAppContext?.createActivityLog?.(`${cid} of ${businessId} updated note ${noteIdToUpdate} successfully.`);
				} else {
					console.error('FqaNotes: updateNote failed', result?.error);
				}
			}
			return;
		}

		// ── CREATE MODE: Add a new note (appended to end of list) ──
		let notesType = 'Message';
		if (message.notevideo) notesType = 'Video';
		else if (message.noteaudio) notesType = 'Audio';
		else if (message.notefile) notesType = 'File';

		const noteid = `note_${cid}_${Date.now()}`;
		const finalFilename = uploadedFileName || '';

		const notePayload = {
			bid: businessId,
			cid,
			noteid,
			noteby: userName,
			message: noteText,
			filename: finalFilename,
			datecreated: now,
			monitorupdated: now,
			monitor: false,
		};

		const optimisticRow: INoteItems = {
			EntityName: props.selectedNode?.NodeEntityname ?? 'Business',
			LastUpdated: now,
			NodeType: props.selectedNode?.NodeType ?? 'Business',
			NotesMAX: noteText,
			NotesType: notesType,
			UserName: userName,
			noteid,
			_noteid: noteid,
			filename: finalFilename,
			FileUID: finalFilename,
		};

		setNoteItems((prev) => [...prev, optimisticRow]);
		setOriginalNotesItems((prev) => [...prev, optimisticRow]);
		resetEditor();

		if (businessId && createNote) {
			const result = await createNote(notePayload as unknown as Record<string, unknown>);
			if (result && result.success !== false) {
				await mainAppContext?.createActivityLog?.(`${cid} of ${businessId} created note ${noteid} successfully.`);
			} else {
				console.error('FqaNotes: createNote failed', result?.error);
			}
		}
	}, [editingItem, resetEditor, updateNote, businessId, cid, sessionContext.SessionList, authSession, props.selectedNode, createNote, uploadRemoteFile, mainAppContext]);

	// Search filter
	const searchValueChange = (value: string): void => {
		setSearchText(value);
		setLensDirty(value.length ? true : false);
		if (!value.length) {
			setNoteItems(originalNotesItems);
		}
	};

	const handleKeywordSearchResult = async (event?: MouseEvent) => {
		void event;
		const q = searchText.toLowerCase();
		setNoteItems(
			originalNotesItems.filter((element) =>
				(element.NotesMAX ?? '').toLowerCase().includes(q) ||
				(element.filename ?? '').toLowerCase().includes(q) ||
				(element.UserName ?? '').toLowerCase().includes(q)
			)
		);
	};

	// Delete note
	const handleDelete = (item: INoteItems) => {
		setShowOkButton(false);
		setConfirmMessage('Are you sure you want to delete this note?');
		setDeleteOpen(true);
		setDeleteItem(item);
	};

	const handleConfirmYesClick = async () => {
		const itemToDelete = deleteItem;
		setDeleteItem(null);
		setDeleteOpen(false);

		if (itemToDelete) {
			const rawFileName = String(itemToDelete.filename || itemToDelete.FileUID || '').trim();
			const noteid = String(itemToDelete.noteid ?? itemToDelete.id ?? itemToDelete._noteid ?? '');

			if (editingItem === itemToDelete) {
				resetEditor();
			}
			setNoteItems((prev) => prev.filter((i) => i !== itemToDelete));
			setOriginalNotesItems((prev) => prev.filter((i) => i !== itemToDelete));

			statusBarContext?.setIsLoading?.(true);
			statusBarContext?.setLoadingLabel?.('Deleting note...');
			try {
				// 1. If file exists, delete the file FIRST from Cloud Storage
				if (rawFileName && !rawFileName.startsWith('sample-file-')) {
					try {
						statusBarContext?.setLoadingLabel?.('Deleting file...');
						const storagePath = buildStoragePathForTickets(rawFileName);
						await deleteFiles([storagePath]);
					} catch (storageErr) {
						console.warn('FqaNotes: Cloud storage file deletion failed or file already removed', storageErr);
					}
				}

				// 2. Then delete the note document from Firestore
				if (noteid && businessId && deleteNote) {
					statusBarContext?.setLoadingLabel?.('Deleting note...');
					const result = await deleteNote(noteid);
					if (result && result.success !== false) {
						await mainAppContext?.createActivityLog?.(`${cid} of ${businessId} deleted note ${noteid} successfully.`);
					} else {
						console.error('FqaNotes: deleteNote failed', result?.error);
					}
				}
			} catch (err) {
				console.error('FqaNotes: delete operation failed', err);
			} finally {
				statusBarContext?.setIsLoading?.(false);
				statusBarContext?.setLoadingLabel?.('');
			}
		}
	};

	const renderNoteCardIcon = (item: INoteItems, index: number) => {
		const rawFileName = String(item.filename || item.FileUID || '').trim();
		const hasFile = Boolean(rawFileName && !rawFileName.startsWith('sample-file-'));
		const fileType = getNoteFileType(item);
		const cleanName = getCleanFileName(rawFileName);

		if (hasFile && fileType === 'audio') {
			return (
				<div
					className="nz-info-image"
					style={{ cursor: 'pointer' }}
					onClick={(e) => {
						e.stopPropagation();
						void handleDownloadFile(item, e);
						void handleSelectCardToEdit(item);
					}}
				>
					<Image
						uniqueName={`audio-${index}`}
						source={
							<Mic24x24
								size={FnGetCssVariable('--image-size-1')}
								fill="none"
								strokeWidth={1}
							/>
						}
						w="var(--image-size-2)"
						tooltip={`Audio: Click to download or select to play (${cleanName || 'audio'})`}
					/>
				</div>
			);
		}

		if (hasFile && fileType === 'video') {
			return (
				<div
					className="nz-info-image"
					style={{ cursor: 'pointer' }}
					onClick={(e) => {
						e.stopPropagation();
						void handleDownloadFile(item, e);
						void handleSelectCardToEdit(item);
					}}
				>
					<Image
						uniqueName={`video-${index}`}
						source={
							<Video24x24
								size={FnGetCssVariable('--image-size-1')}
								fill="none"
								strokeWidth={1}
							/>
						}
						w="var(--image-size-2)"
						tooltip={`Video: Click to download or select to play (${cleanName || 'video'})`}
					/>
				</div>
			);
		}

		if (hasFile) {
			return (
				<div
					className="nz-info-image"
					style={{ cursor: 'pointer' }}
					onClick={(e) => {
						e.stopPropagation();
						void handleDownloadFile(item, e);
						void handleSelectCardToEdit(item);
					}}
				>
					<Image
						uniqueName={`attach-${index}`}
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
					uniqueName={`info-${index}`}
					source={
						<Info24x24
							size={FnGetCssVariable('--image-size-1')}
							fill="none"
							strokeWidth={1}
						/>
					}
					w="var(--image-size-2)"
					tooltip={item.NotesType ?? 'Message'}
				/>
			</div>
		);
	};

	const deleteImage: IImage = {
		uniqueName: 'delete-icon',
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

	const clearImage: IImage = {
		uniqueName: 'clear-icon',
		source: (
			<Close24x24
				size={FnGetCssVariable('--image-size-2')}
				fill="none"
				strokeWidth={1}
			/>
		),
		w: 'var(--image-size-2)',
		type: 'svg',
		tooltip: 'Click to Clear',
	};
	return (
		<div className="nz-node-list-Container" key={props.uniqueName}>
			<div className="nz-notes-list-main-div">
				<div className="nz-notes-list-with-msg-box">
					<div className="nz-sub-header">
						<Label uniqueName="Notes-header" label="Notes" />
						{editingItem && (
							<ActionImage
								image={clearImage}
								w="var(--node_height)"
								h="var(--node_height)"
								uniqueName={`deleteicon`}
								actionCode="delete"
								disabled={false}
								handleMouse={(e) => {
									resetEditor();
								}}
							/>

						)}
					</div>
					{!props.hideSearchControl && searchControlProps && (
						<div className="nz-notes-search">
							<FilterKeywordControl
								{...searchControlProps}
								searchInputValue={searchText}
								filterDirty={lensDirty}
								handleFilterMouse={handleKeywordSearchResult}
								searchValueChange={searchValueChange}
								filterIconTooltip="Filter"
							/>
						</div>
					)}
					<div className="nz-notes-list-scroll" ref={scrollRef}>
						{loading && (
							<div className="nz-notes-loading" style={{ padding: '10px', textAlign: 'center' }}>
								<Label uniqueName="notes-loading" label="Loading notes..." />
							</div>
						)}
						{error && (
							<div className="nz-notes-error" style={{ padding: '10px', color: 'var(--danger, #ff4d4f)' }}>
								<Label uniqueName="notes-error" label={typeof error === 'string' ? error : 'Failed to load notes'} />
							</div>
						)}
						{!loading && !error && notesItems.length === 0 && (
							<div className="nz-notes-empty" style={{ padding: '10px', textAlign: 'center', opacity: 0.7 }}>
								<Label uniqueName="notes-empty" label="No notes available" />
							</div>
						)}
						{notesItems.map((item, index) => {
							const isSelected = editingItem
								? editingItem === item || (editingItem.noteid && item.noteid === editingItem.noteid)
								: false;

							const rawFileName = String(item.filename || item.FileUID || '').trim();
							const hasFile = Boolean(rawFileName && !rawFileName.startsWith('sample-file-'));

							return (
								<div
									className={`nz-node-list-box ${isSelected ? 'nz-node-list-box-selected' : ''}`}
									key={item.noteid || index}
									onClick={() => handleSelectCardToEdit(item)}
									style={{ cursor: 'pointer' }}
								>
									<div className="nz-node-list-delete">
										<ActionImage
											image={deleteImage}
											w="var(--node_height)"
											h="var(--node_height)"
											uniqueName={`deleteicon-${index}`}
											actionCode="delete"
											disabled={false}
											handleMouse={(e) => {
												e?.stopPropagation?.();
												handleDelete(item);
											}}
										/>
										<div className="nz-note-date">
											<Label
												uniqueName={`date-${index}`}
												label={`${FnConvertTimestampToDate(item.LastUpdated, false, true)}`}
											/>
										</div>
										<div className="nz-note-user">
											<Label
												uniqueName={`user-${index}`}
												label={`${item.UserName ?? item.noteby ?? ''}`}
											/>
										</div>
									</div>
									<div className="nz-info-div">
										{renderNoteCardIcon(item, index)}
										<div className="nz-nodes-text">
											<Label uniqueName={`notes-${index}`} label={item.NotesMAX || item.message || ''} />
										</div>
									</div>
								</div>
							);
						})}
					</div>
					<div className="nz-notes-container">

						{noteDetails && (
							<Notes
								{...noteDetails}
								key={refreshToken}
								allowAudio={!isHideAVNotes}
								allowVideo={!isHideAVNotes}
								sendNote={sendNotes}
								sendTooltip={editingItem ? 'Update Note' : 'Send Note'}
								handleDelete={handleDeleteAttachment}
							/>
						)}
					</div>
				</div>
			</div>
			<YesNoFormContainer
				isOpen={deleteOpen}
				uniqueName={props.uniqueName}
				message={confirmMessage}
				showOkButton={showOkButton}
				handleYesButtonClick={handleConfirmYesClick}
				handleNoButtonClick={() => {
					setDeleteOpen(false);
				}}
				handleOkButtonClick={() => {
					setDeleteOpen(false);
				}}
			/>
		</div>
	);
};

export { FqaNotes };
export type { IFqaNotes, INoteItems };