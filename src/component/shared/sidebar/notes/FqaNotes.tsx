
import { useCallback, useEffect, useMemo, useState } from 'react'
import { IImage } from '../../allinterface/basic/IImage'
import { Notes } from '@n20a/libavnotes';
import type { INote } from '@n20a/libavnotes';
import { useStatusBarContext } from '../../context/hooks/StatusBarHooks'
import { useSessionContext } from '../../context/hooks/SessionHooks'
import { useMainAppContext } from '../../context/hooks/MainAppHooks'
import './FqaNotes.css'
import '@n20a/libavnotes/style.css'
import { FilterKeywordControl } from '../../searchfilter/filterkeywordcontrol/FilterKeywordControl';
import { FnConvertTimestampToDate, FnParseTimestampToISO } from '../../../appcontainer/allcommon/FnConvertTimestampToDate'
import { FnGetSessionVariableFromStorage } from '../../allcommon/basic/FnGetSessionVariableFromStorage'
import { FnConvertBase64Blob } from '../../allcommon/sidebar/FnConvertBase64Blob'
import { ITreeNode } from '../../allinterface/tree/ITreeControl'
import { YesNoFormContainer } from '../../basic/yesnoformcontainer/YesNoFormContainer'
import { ActionImage } from '../../basic/actionimage/ActionImage'
import { Label } from '../../basic/label/Label'
import { UploadAudio } from './UploadAudio'
import { UploadVideo } from './UploadVideo'
import { InfoMessage } from './InfoMessage'
import { Video } from './Video'
import { Image } from '../../basic/image/Image'
import { Audio } from './Audio'
import { Attach24x24, Delete24x24, Download24x24, Info24x24, Mic24x24, Video24x24 } from '@n20a/libicon';
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable';
import { ISession } from '../../context/allinterface/ISession';
import notesSampleData from '../../../../smsampledata/sidebar/NotesSampleData.json';
import { useBusinessNotes } from '@n20a/libfsdb';

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
	[key: string]: any;
}
const {
	sampleNotesFileProfileResponse,
} = notesSampleData;

const searchProps = {
	uniqueName: "filtericon",
	isShowFilterControl: true, //show filter control.
	lensDirty: false,
	filterDirty: false,
	searchInputValue: "",
};
const FqaNotes = (props: IFqaNotes) => {
	const [selectedItem, setSelectedItem] = useState<any>(null)
	const [deleteItem, setDeleteItem] = useState<any>(null)
	const [showMessage, setShowMessage] = useState<boolean>(false)
	const [uploadButton, setUploadButton] = useState<string>('')
	const [noteDetails, setNoteDetails] = useState<INote>();
	const [selectedNoteProps, setSelectedNoteProps] = useState<INote>()
	const [searchText, setSearchText] = useState<string>('');
	const [notesItems, setNoteItems] = useState<INoteItems[]>([])
	const [lensDirty, setLensDirty] = useState<boolean>(false)
	const [originalNotesItems, setOriginalNotesItems] = useState<INoteItems[]>([])
	const [searchControlProps] = useState<any>(searchProps);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [confirmMessage, setConfirmMessage] = useState("");
	const [showOkButton, setShowOkButton] = useState<boolean>(false);
	const statusBarContext = useStatusBarContext();
	const sessionContext = useSessionContext();
	const mainAppContext = useMainAppContext();
	const businessId = String(props.selectedNode?.bid ?? props.selectedNode?.NodeEntID ?? '');
	const { loading, error, getNotes, notes, deleteNote, getNote, createNote, updateNote } = useBusinessNotes(businessId);

	const isHideAVNotes = useMemo(() => {
		const avNotesRecord = mainAppContext?.apRecords?.find(
			(item) =>
				item?.Name?.toLowerCase() === "avnotes" ||
				item?._AP?.toLowerCase() === "avnotes"
		);
		if (!avNotesRecord) return false;
		const value =
			avNotesRecord.Value !== undefined &&
				avNotesRecord.Value !== null &&
				avNotesRecord.Value !== ""
				? avNotesRecord.Value
				: avNotesRecord.DefaultAPValue;
		const strValue = String(value ?? "").trim().toLowerCase();
		return strValue === "1" || strValue === "true";
	}, [mainAppContext?.apRecords]);


	const deleteImage: IImage = {
		uniqueName: `delete-icon`,
		source: <Delete24x24
			size={FnGetCssVariable('--image-size-2')}
			fill='none'
			strokeWidth={1} />,
		w: 'var(--image-size-2)',
		type: "svg",
		tooltip: "Click to Delete"
	}

	const getNotesDetails = useCallback(async () => {
		setSelectedItem(null);
		if (businessId) {
			await getNotes();
		} else {
			setNoteItems([]);
			setOriginalNotesItems([]);
		}
	}, [businessId, getNotes]);

	useEffect(() => {
		if (businessId) {
			getNotesDetails();
		} else {
			setSelectedItem(null);
			setNoteItems([]);
			setOriginalNotesItems([]);
		}
	}, [businessId, getNotesDetails]);

	useEffect(() => {
		if (Array.isArray(notes)) {
			const mappedNotes: INoteItems[] = notes.filter(Boolean).map((item: any) => ({
				...item,
				noteid: String(item.noteid ?? item.FileUID ?? item.RecID ?? ''),
				EntityName: item.EntityName ?? item.bid ?? '',
				NodeType: item.NodeType ?? 'Business',
				NotesMAX: String(item.NotesMAX ?? item.message ?? item.NotesMax ?? ''),
				NotesType: item.NotesType ?? (item.filename ? 'image' : 'Message'),
				UserName: item.UserName ?? item.noteby ?? item.createdby ?? '',
				LastUpdated: FnParseTimestampToISO(item.LastUpdated ?? item.datecreated ?? item.monitorupdated),
				FileUID: item.FileUID ?? item.noteid ?? '',
			}));
			setOriginalNotesItems(mappedNotes);
			if (searchText) {
				const filtered = mappedNotes.filter((element) =>
					element.NotesMAX?.toLowerCase().includes(searchText.toLowerCase())
				);
				setNoteItems(filtered);
			} else {
				setNoteItems(mappedNotes);
			}
		} else if (notes === null) {
			setNoteItems([]);
			setOriginalNotesItems([]);
		}
	}, [notes, searchText]);

	useEffect(() => {
		statusBarContext?.setIsLoading?.(loading);
	}, [loading, statusBarContext]);

	useEffect(() => {
		if (error) {
			statusBarContext?.setFetchError?.([error]);
		}
	}, [error, statusBarContext]);

	const apiCallForAdd = async (payload: Record<string, any>) => {
		const noteId = String(payload.noteid ?? payload.NoteID ?? payload.RecID ?? `note_${Date.now()}`);
		const message = String(payload.message ?? payload.NotesMAX ?? payload.NotesMax ?? "");
		const noteby = String(payload.UserName ?? payload.noteby ?? "");
		const cid = String(payload.cid ?? props.selectedNode?.cid ?? "");
		const filename = String(payload.FileName ?? payload.filename ?? payload.fileObj?.fileName ?? "");
		const nowIso = new Date().toISOString();

		if (businessId && createNote) {
			try {
				const firestoreNotePayload: Record<string, any> = {
					noteid: noteId,
					bid: businessId,
					cid: cid,
					message: message,
					filename: filename,
					noteby: noteby,
					monitor: false,
					datecreated: nowIso,
					monitorupdated: nowIso,
				};
				await createNote(firestoreNotePayload);
				await getNotes();
			} catch (err) {
				console.error("Error creating note:", err);
			}
		}
	}
	const sendNotes = useCallback(async (message: INote) => {
		try {
			function getFirst10Chars(text: string): string {
				if (!text) return "";
				return text.substring(0, 10);
			}
			let base64String;
			let fileName;
			let fileType: string = "Message";
			let fileObject;
			if (message.notevideo) {
				base64String = await FnConvertBase64Blob(message.notevideo, "toBase64", message.notevideo.type)
				fileName = getFirst10Chars(message.notecontent)
				fileType = "Video"
				fileObject = message.notevideo
			} else if (message.notefile) {
				base64String = await FnConvertBase64Blob(message.notefile, "toBase64", message.notefile.type)
				fileName = message.notefile && (message.notefile as Record<string, any>).name ? (message.notefile as Record<string, any>).name : getFirst10Chars(message.notecontent)

				fileType = "image"
				fileObject = message.notefile
			} else if (message.noteaudio) {
				base64String = await FnConvertBase64Blob(message.noteaudio, "toBase64", message.noteaudio.type)
				fileName = getFirst10Chars(message.notecontent)

				fileType = "Audio"
				fileObject = message.noteaudio
			}
			if (!message.notecontent?.length) {
				setConfirmMessage("Please enter a note before saving. If you attach a file, audio, or video, include a note describing it.");
				setShowOkButton(true);
				setDeleteOpen(true);
				return;
			}
			let LoginUserName: ISession[] | null = FnGetSessionVariableFromStorage("RequestedBy", "LoginShortName", sessionContext.SessionList);
			const userName = LoginUserName && LoginUserName?.length > 0 ? LoginUserName[0].SessionValue : "";
			if (!message.notefile && !message.notevideo && !message.noteaudio) {
				const payload = {
					UserName: userName,
					NotesType: fileType,
					NotesMax: message.notecontent,
					EntID: props.selectedNode.NodeEntID,
					EntityName: props.selectedNode.NodeEntityname,
				}
				await apiCallForAdd(payload)
			} else {
				function getExtensionFromMime(fileType: string, fileName: string): string {
					if (!fileType) return "";

					// If audio or video → use MIME type
					if (fileType.startsWith("audio/") || fileType.startsWith("video/")) {
						const parts = fileType.split("/");
						return parts[1]?.toLowerCase() ?? "";
					}

					// Otherwise → use filename
					if (fileName) {
						const lastDot = fileName.lastIndexOf(".");
						if (lastDot !== -1) {
							return fileName.substring(lastDot + 1).toLowerCase();
						}
					}

					return "";
				}
				function getFileCategoryFromFile(file: Blob): string {
					if (!file?.type) return "unknown";

					const mime = file.type?.toLowerCase();

					if (mime.startsWith("image/")) return "image";
					if (mime === "application/pdf") return "pdf";
					if (mime === "text/plain") return "Text";

					if (mime.includes("spreadsheet") || mime.includes("excel")) return "other";
					if (mime.includes("word")) return "other";
					if (mime.includes("powerpoint")) return "other";

					if (mime.startsWith("audio/")) return "audio";
					if (mime.startsWith("video/")) return "video";

					return "unknown";
				}

				// SAMPLE DATA: FS.UploadFileStream API commented out.
				// await axiosInterceptor({ ... }, statusBarContext);
				await apiCallForAdd({
					UserName: userName,
					NotesType: fileType,
					NotesMax: message.notecontent,
					EntID: props.selectedNode.NodeEntID,
					EntityName: props.selectedNode.NodeEntityname,
					FileUID: `sample-file-${Date.now()}`,
					FileName: fileName,
					FileExtension: getExtensionFromMime(fileObject?.type as string, fileName),
					FileCategory: getFileCategoryFromFile(fileObject as Blob),
				});
				void base64String;

			}
		} catch (error) {
			console.error("Error sending note:", error);
		}
	}, [props.selectedNode, sessionContext.SessionList])
	const getRecordingTimes = async () => {
		// SAMPLE DATA: recording limits normally come from AP init-session data.
		return {
			maxAudioRecordingTime: 60,
			maxVideoRecordingTime: 60
		};
	};
	useEffect(() => {
		const setNodeDetails = async () => {

			const data = await getRecordingTimes()
			const maxAudioRecordingTime = data.maxAudioRecordingTime && Number(data.maxAudioRecordingTime || 0)
			const maxVideoRecordingTime = data.maxVideoRecordingTime && Number(data.maxVideoRecordingTime || 0)



			setNoteDetails(
				{
					maxAudioRecordingTime: maxAudioRecordingTime * 1000, // milliseconds, load from _ap and set here
					maxVideoRecordingTime: maxVideoRecordingTime * 1000, // milliseconds

					noteId: "1",
					noteTitle: "",
					notecontent: "",
					notefile: undefined,
					noteaudio: undefined,
					notevideo: undefined,
					noteCreatedAt: new Date(),
					sendNote: sendNotes,
					allowAudio: !isHideAVNotes,
					allowVideo: !isHideAVNotes,
				});
		}
		setNodeDetails()
	}, [props.selectedNode, sendNotes, isHideAVNotes]);

	const handleDownload = (base64Data: string, fileName: string) => {
		try {
			// Remove potential Base64 headers (e.g., "data:image/svg+xml;base64,")
			const base64HeaderRemoved = base64Data.replace(/^data:image\/svg\+xml;base64,/, "");

			// Decode Base64 to binary
			const byteCharacters = atob(base64HeaderRemoved);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);

			// Create Blob with the correct MIME type (SVG in this case)
			const blob = new Blob([byteArray], { type: "image/svg+xml" });

			// Create Object URL and trigger download
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();

			// Cleanup
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Download failed:", error);
		}
	};


	const getFileTableData = async (EntID: string, EntityName: string) => {
		return new Promise((resolve) => {
			// SAMPLE DATA: NODE.GetKebabMenuData API commented out.
			// axiosInterceptor({ ... }, statusBarContext);
			void EntID;
			void EntityName;
			try {
				const parsed = JSON.parse(sampleNotesFileProfileResponse.propertyJson);
				resolve(parsed?.["PG.FileProfile"] || []);
			} catch (error) {
				console.error("File profile sample parse error:", error);
				resolve([]);
			}
		});
	};

	function downloadBase64File(base64String: string, fileName: string, extension: string) {
		try {
			// Convert base64 → byte array
			const byteCharacters = atob(base64String);
			const byteNumbers = new Array(byteCharacters.length);

			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}

			const byteArray = new Uint8Array(byteNumbers);

			// Create Blob
			const fileBlob = new Blob([byteArray]);

			// Create download link
			const blobUrl = URL.createObjectURL(fileBlob);
			const link = document.createElement("a");
			link.href = blobUrl;
			link.download = `${fileName}.${extension}`;
			document.body.appendChild(link);

			link.click();

			document.body.removeChild(link);
			URL.revokeObjectURL(blobUrl);
		} catch (error) {
			console.error("Download failed:", error);
		}
	}
	function base64ToBlob(base64: string, contentType = ""): Blob {
		try {
			statusBarContext?.setIsLoading?.(true);

			let cleanedBase64 = "";

			try {
				cleanedBase64 = base64?.includes(",")
					? base64.split(",")[1]
					: base64;
			} catch (err) {
				console.error("Base64 cleaning error:", err);
				cleanedBase64 = base64 || "";
			}

			let byteCharacters = "";

			try {
				byteCharacters = atob(cleanedBase64);
			} catch (err) {
				console.error("Base64 decode error:", err);
				statusBarContext?.setIsLoading?.(false);
				return new Blob([], { type: contentType });
			}

			const byteNumbers = new Array(byteCharacters.length);

			try {
				for (let i = 0; i < byteCharacters.length; i++) {
					byteNumbers[i] = byteCharacters.charCodeAt(i);
				}
			} catch (err) {
				console.error("Byte conversion error:", err);
			}

			const byteArray = new Uint8Array(byteNumbers);

			statusBarContext?.setIsLoading?.(false);

			return new Blob([byteArray], { type: contentType });

		} catch (error) {
			console.error("base64ToBlob error:", error);
			statusBarContext?.setIsLoading?.(false);
			return new Blob([], { type: contentType });
		}
	}

	const handleAIClick = async (item: any, iconName: string) => {
		if (iconName !== "Download_24x24.svg") {
			const noteId = String(item?.noteid ?? item?.FileUID ?? item?.RecID ?? "");
			if (noteId && businessId && getNote) {
				try {
					const noteData = await getNote(noteId);
					if (noteData) {
						item = { ...item, ...noteData };
					}
				} catch (err) {
					console.error("Error fetching note with getNote:", err);
				}
			}
			const fileObj = await getFileTableData(item.EntID, item.EntityName)
			const filterFile =
				Array.isArray(fileObj)
					? fileObj.find((file: any) => file.FileUID === item.FileUID)
					: undefined;
			if (filterFile) {
				// SAMPLE DATA: FS.GetFileStream API commented out.
				// await axiosInterceptor({ ... }, statusBarContext);
				setSelectedNoteProps({
					maxAudioRecordingTime: 60000,
					maxVideoRecordingTime: 60000,
					noteId: filterFile.FileUID,
					noteTitle: filterFile.FileName ?? "",
					notecontent: item.NotesMAX ?? "",
					noteCreatedAt: new Date(),
					sendNote: sendNotes,
				});
				setSelectedItem(item);
			}
			if (item.NotesType?.toLowerCase() !== "image")
				setSelectedItem(item)
		} else {
			handleDownload(item.fileObj.fileData, item.fileObj.fileName)
		}
	}
	const handleSvgFileName = (item: INoteItems) => {
		if (item.NotesType?.toLowerCase() === "image") {
			if (item.fileObj) {
				return {
					icon: <Download24x24 size={FnGetCssVariable('--image-size-1')}
						fill='none'
						strokeWidth={1} />, iconName: "Download_24x24.svg"
				}
			} else {
				return {
					icon: <Attach24x24 size={FnGetCssVariable('--image-size-1')}
						fill='none'
						strokeWidth={1} />, iconName: "Attach_24x24.svg"
				}
			}
		} else if (item.NotesType?.toLowerCase() === "video") {
			return {
				icon: <Video24x24 size={FnGetCssVariable('--image-size-1')}
					fill='none'
					strokeWidth={1} />, iconName: "Video_24x24.svg"
			}
		} else if (item.NotesType?.toLowerCase() === "audio") {
			return {
				icon: <Mic24x24 size={FnGetCssVariable('--image-size-1')}
					fill='none'
					strokeWidth={1} />, iconName: "Mic_24x24.svg"
			}
		} else {
			return {
				icon: <Info24x24 size={FnGetCssVariable('--image-size-1')}
					fill='none'
					strokeWidth={1} />, iconName: "Info_24x24.svg"
			}
		}
	}

	const handleSvgFileTooltip = (item: INoteItems) => {
		if (item.NotesType?.toLowerCase() === "image") {
			return "Download File"
		} else if (item.NotesType?.toLowerCase() === "video") {
			return 'View video'
		} else if (item.NotesType?.toLowerCase() === "audio") {
			return 'View Audio'
		} else {
			return "Info"
		}
	}

	const handleDelete = (item: any) => {
		setShowOkButton(false);
		setConfirmMessage("Are you sure you want to delete this note?");
		setDeleteOpen(true);
		setDeleteItem(item)
	}

	const handleKeywordSearchResult = async (event: MouseEvent) => {
		void event;

		let filterData: any = [];
		filterData = notesItems.filter((element: any) => {
			return (
				element.NotesMAX?.toLowerCase().includes(searchText?.toLowerCase())
			);
		});

		setNoteItems([...filterData]);

	};
	function searchValueChange(value: string): void {
		setSearchText(value);
		setLensDirty(value.length ? true : false);
		if (!value.length) {
			setNoteItems(originalNotesItems)
		}
	}
	const handleConfirmYesClick = async () => {
		const noteId = String(deleteItem?.noteid ?? deleteItem?.FileUID ?? deleteItem?.RecID ?? "");
		const deleteRecord = async () => {
			if (noteId && businessId && deleteNote) {
				try {
					await deleteNote(noteId);
					await getNotes();
				} catch (err) {
					console.error("Error deleting note in Firestore:", err);
				}
			}
			setNoteItems((items) => items.filter((item) => item !== deleteItem));
			setOriginalNotesItems((items) => items.filter((item) => item !== deleteItem));
		}
		if (deleteItem?.FileUID) {
			const fileStreamData = await getFileTableData(deleteItem.EntID, deleteItem.EntityName);
			const filterFile =
				Array.isArray(fileStreamData)
					? fileStreamData.find((file: any) => file.FileUID === deleteItem.FileUID)
					: undefined;
			if (filterFile) {
				await deleteRecord();
			}
			else {
				await deleteRecord()
			}
		} else {
			await deleteRecord()
		}

		setDeleteOpen(false)
	}
	const handleUpdateData = async (message: INote) => {

		let LoginUserName: ISession[] | null = FnGetSessionVariableFromStorage("RequestedBy", "LoginShortName", sessionContext.SessionList);
		const userName = (LoginUserName && LoginUserName.length > 0 && LoginUserName[0].SessionValue) ? String(LoginUserName[0].SessionValue) : "";
		const noteId = String(selectedItem?.noteid ?? selectedItem?.FileUID ?? selectedItem?.RecID ?? "");
		const nowIso = new Date().toISOString();

		const payload = {
			UserName: userName,
			NotesType: selectedItem?.NotesType ?? "Message",
			NotesMax: message.notecontent,
			NotesMAX: message.notecontent,
			message: message.notecontent,
			EntityName: selectedItem?.EntityName ?? "",
			EntID: selectedItem?.EntID,
			RecID: selectedItem?.RecID,
			noteid: noteId,
		}
		if (noteId && businessId && updateNote) {
			try {
				const firestoreUpdatePayload: Record<string, any> = {
					noteid: noteId,
					bid: businessId,
					cid: String(selectedItem?.cid ?? props.selectedNode?.cid ?? ""),
					message: message.notecontent,
					filename: String(selectedItem?.filename ?? selectedItem?.FileName ?? ""),
					noteby: userName || String(selectedItem?.noteby ?? selectedItem?.UserName ?? ""),
					monitor: Boolean(selectedItem?.monitor ?? false),
					monitorupdated: nowIso,
				};
				await updateNote(noteId, firestoreUpdatePayload);
				await getNotes();
			} catch (err) {
				console.error("Error updating note in Firestore:", err);
			}
		}
		const updateItemInList = (item: INoteItems): INoteItems => {
			if (item === selectedItem || (noteId && (item.noteid === noteId || item.FileUID === noteId))) {
				return {
					...item,
					...payload,
					NotesMAX: message.notecontent,
					LastUpdated: nowIso,
				};
			}
			return item;
		};
		setOriginalNotesItems((items) => items.map(updateItemInList));
		setNoteItems((items) => items.map(updateItemInList));
		setSelectedItem((prev: any) => prev ? { ...prev, ...payload, NotesMAX: message.notecontent, LastUpdated: nowIso } : null);
	}
	const handleDeleteNotes = (objectType: 'file' | 'audio' | 'video', objectData?: Blob | File) => {
		void objectType;
		void objectData;
	}
	void downloadBase64File;
	void base64ToBlob;

	return (
		<div className='nz-node-list-Container' key={props.uniqueName}>
			<div className='nz-notes-list-main-div'>
				{uploadButton === "audio" && <UploadAudio handleClose={() => setUploadButton('')} />}
				{uploadButton === "video" && <UploadVideo handleClose={() => setUploadButton('')} />}
				<div className='nz-notes-list-with-msg-box'>
					<div className="nz-sub-header">
						<Label uniqueName='Notes-header' label={`Notes`} />
					</div>
					{!props.hideSearchControl && searchControlProps && (
						<div className="nz-notes-search">
							<FilterKeywordControl
								{...searchControlProps}
								searchInputValue={searchText}
								filterDirty={lensDirty}
								handleFilterMouse={handleKeywordSearchResult}
								searchValueChange={searchValueChange}
								filterIconTooltip='Filter'
							/>
						</div>
					)}
					<div className={selectedItem ? 'nz-notes-only' : 'nz-notes-list-scroll'}>
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

							return (
								<div className={'nz-node-list-box'} key={index}>
									<div className='nz-node-list-delete'>
										<ActionImage image={deleteImage} w={'var(--node_height)'} h={'var(--node_height)'}
											uniqueName={`deleteicon`}
											actionCode={'delete'}
											disabled={false}
											handleMouse={() => handleDelete(item)} />
										<div className='nz-note-date'>
											<Label uniqueName='date' label={`${FnConvertTimestampToDate(item.LastUpdated, false, true)}`} />
										</div>
										<div className='nz-note-user'>
											<Label uniqueName='user' label={`${item.UserName}`} />
										</div>
									</div>
									{!selectedItem || selectedItem !== item ? <div className='nz-info-div'>
										{
											item.NotesType?.toLowerCase() === "image" || item.NotesType?.toLowerCase() === "audio" || item.NotesType?.toLowerCase() === "video" ?
												<ActionImage image={{
													uniqueName: `info-icon`,
													source: handleSvgFileName(item).icon,
													w: 'var(--image-size-2)',
													type: "svg",
													tooltip: handleSvgFileTooltip(item)
												}} w={'var(--node_height)'} h={'var(--node_height)'}
													uniqueName={`deleteicon`}
													actionCode={'info-icon'}
													disabled={false}
													handleMouse={() => handleAIClick(item, handleSvgFileName(item).iconName)} /> :
												<div className='nz-info-image'> <Image
													uniqueName={'info'}
													source={handleSvgFileName(item).icon}
													w={'var(--image-size-2)'}
													tooltip={handleSvgFileTooltip(item)}
												/></div>
										}
										<div className='nz-nodes-text'>

											{item.FileUID && item.NotesType?.toLowerCase() === "image" ? <div className='nz-downlaod-file-name'><Label uniqueName='notes' label={item.fileObj && item.fileObj?.fileName as string} /> </div> : ""}
											{item.NotesMAX.length >= 64 ?
												<div className='nz-notes-text-like-link' onClick={async () => {
													const noteId = String(item?.noteid ?? item?.FileUID ?? item?.RecID ?? "");
													if (noteId && businessId && getNote) {
														try {
															const singleNote = await getNote(noteId);
															if (singleNote) {
																item = { ...item, ...singleNote };
															}
														} catch (err) {
															console.error("Error fetching note via getNote:", err);
														}
													}
													setShowMessage(true)
													setSelectedItem(item)
												}}>
													<Label uniqueName='notes' label={item.NotesMAX} />
												</div>
												: <Label uniqueName='notes' label={item.NotesMAX} />}
										</div>
									</div >
										:
										<>
											{selectedItem && showMessage && item.NotesType?.toLowerCase() === "message" && <InfoMessage message={selectedItem.NotesMAX} handleClose={() => setSelectedItem(null)} />}
											{selectedItem && !showMessage && item.NotesType?.toLowerCase() === "video" && selectedNoteProps && <Video handleClose={() => setSelectedItem(null)} noteProps={selectedNoteProps} sendNotes={handleUpdateData} />}
											{selectedItem && !showMessage && item.NotesType?.toLowerCase() === "audio" && selectedNoteProps && <Audio handleClose={() => setSelectedItem(null)}
												noteProps={selectedNoteProps} />}
										</>}

								</div >
							)
						})}
					</div >
					<div className='nz-notes-container'>
						{!selectedItem && noteDetails && <Notes {...noteDetails} allowAudio={!isHideAVNotes}
							allowVideo={!isHideAVNotes} sendTooltip={"Send Note"} handleDelete={handleDeleteNotes} />}
					</div>
				</div >
			</div >
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
		</div >

	)
}

export { FqaNotes };
export type { IFqaNotes, INoteItems };