import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Notes } from '@n20a/libavnotes';
import type { INote } from '@n20a/libavnotes';
import { useStatusBarContext } from '../../../context/hooks/StatusBarHooks';
import { useSessionContext } from '../../../context/hooks/SessionHooks';
import { useMainAppContext } from '../../../context/hooks/MainAppHooks';
import { useSmDataContext } from '../../../context/hooks/SmDataHooks';
import { useSelectedNodeContext } from '../../../context/hooks/SelectedNodeHooks';
import { useRmsContext } from '../../../context/hooks/RmsHooks';
import '../../notes/FqaNotes.css';
import '@n20a/libavnotes/style.css';
import { FilterKeywordControl } from '../../../searchfilter/filterkeywordcontrol/FilterKeywordControl';
import { FnParseTimestampToISO } from '../../../../appcontainer/allcommon/FnConvertTimestampToDate';
import { FnFormatDateWithAppFormat } from '../../../../appcontainer/allcommon/FnFormatDateWithAppFormat';
import { FnGetSourceDataset } from '../../../allcommon/FnLoadSampleDatasets';
import { FnGetSessionVariableFromStorage } from '../../../allcommon/basic/FnGetSessionVariableFromStorage';
import { ITreeNode } from '../../../allinterface/tree/ITreeControl';
import { Label } from '../../../basic/label/Label';
import { Image } from '../../../basic/image/Image';
import { Attach24x24 } from '@n20a/libicon';
import { FnGetCssVariable } from '../../../../appcontainer/allcommon/FnGetCssVariable';
import { ISession } from '../../../context/allinterface/ISession';
import { useTicketNotes, useFileDownload, useFileDelete } from '@n20a/libfsdb';
import { useUploadRemoteFile } from '../../../allcommon/UploadRemoteFileHooks';

interface IEQIDNotesPaneProps {
  uniqueName?: string;
  eqid?: string;
  ticket?: any;
  selectedNode?: ITreeNode;
  hideSearchControl?: boolean;
  hideSubHeader?: boolean;
}

interface INoteItems {
  EntityName?: string | null;
  LastUpdated?: string | null;
  NodeType?: string | null;
  NotesMAX: string;
  NotesType?: string | null;
  UserName?: string | null;
  important?: boolean;
  audio?: unknown;
  file?: unknown;
  fileObj?: any;
  video?: unknown;
  FileUID?: string | null;
  noteid?: string;
  message?: string;
  filename?: string | null;
  bid?: string;
  cid?: string;
  eqid?: string;
  EQID?: string;
  ticketid?: string;
  [key: string]: any;
}

function getLastValue(value: string): string {
  return (value || '').split('__').pop() || '';
}

/**
 * Resolves bid and cid from tree selection and/or node.
 */
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

export const EQIDNotesPane: React.FC<IEQIDNotesPaneProps> = (props) => {
  const uniqueName = props.uniqueName ?? 'fqa-eqid-notes';
  const [filterText, setFilterText] = useState('');
  const [editingItem, setEditingItem] = useState<INoteItems | null>(null);
  const [noteDetails, setNoteDetails] = useState<INote | undefined>({
    maxAudioRecordingTime: 60000,
    maxVideoRecordingTime: 60000,
    noteId: `${Date.now()}`,
    noteTitle: '',
    notecontent: '',
    notefile: undefined,
    notefileName: undefined,
    noteaudio: undefined,
    noteCreatedAt: new Date(),
  });
  const [notesItems, setNoteItems] = useState<INoteItems[]>([]);
  const [refreshToken, setRefreshToken] = useState<number>(0);
  const [fileUploading, setFileUploading] = useState<boolean>(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const statusBarContext = useStatusBarContext();
  const sessionContext = useSessionContext();
  const mainAppContext = useMainAppContext();
  const smDataContext = useSmDataContext();
  const selectedNodeContext = useSelectedNodeContext();

  let rmsContext: any = null;
  try {
    rmsContext = useRmsContext();
  } catch {
    // Handled if rendered outside RmsProvider
  }

  const authSession = mainAppContext?.authSession;

  // Resolve bid and cid based on selected node and active tree selection
  const effectiveNode = props.selectedNode ?? smDataContext?.selectedNode ?? selectedNodeContext?.selectedNode;
  const resolvedTarget = useMemo(() => {
    return resolveBidCid(smDataContext?.selection, effectiveNode);
  }, [smDataContext?.selection, effectiveNode]);

  const activeNode = props.selectedNode ?? selectedNodeContext?.selectedNode;
  const selectedTicketCard =
    (selectedNodeContext as any)?.selectedTicketCard ??
    (selectedNodeContext as any)?.SelectedTicketCard ??
    (rmsContext as any)?.selectedTicketCard ??
    (rmsContext as any)?.SelectedTicketCard ??
    props.ticket ??
    (activeNode && (activeNode.ticketid || (activeNode as any).prodno || activeNode.NodeType === 'Ticket') ? activeNode : null);

  const selectedTicketId = String(
    selectedTicketCard?.ticketid ||
    selectedTicketCard?.id ||
    selectedTicketCard?.NodeEntID ||
    props.ticket?.ticketid ||
    props.ticket?.id ||
    (activeNode as any)?.ticketid ||
    activeNode?.NodeEntID ||
    ''
  ).trim();

  const selectedBid = String(
    selectedTicketCard?.bid ||
    props.ticket?.bid ||
    resolvedTarget.bid ||
    ''
  ).trim();

  const selectedCid = String(
    selectedTicketCard?.cid ||
    props.ticket?.cid ||
    resolvedTarget.cid ||
    ''
  ).trim();

  const rawTicketEqid = String(
    (selectedNodeContext as any)?.selectedTicketCard?.eqid ||
    (selectedNodeContext as any)?.selectedTicketCard?.EQID ||
    (selectedNodeContext as any)?.selectedTicketCard?.eqId ||
    (selectedNodeContext as any)?.SelectedTicketCard?.eqid ||
    (selectedNodeContext as any)?.SelectedTicketCard?.EQID ||
    (selectedNodeContext as any)?.SelectedTicketCard?.eqId ||
    (rmsContext as any)?.selectedTicketCard?.eqid ||
    (rmsContext as any)?.selectedTicketCard?.EQID ||
    (rmsContext as any)?.selectedTicketCard?.eqId ||
    selectedTicketCard?.eqid ||
    selectedTicketCard?.EQID ||
    (selectedTicketCard as any)?.eqId ||
    props.ticket?.eqid ||
    props.ticket?.EQID ||
    (props.ticket as any)?.eqId ||
    props.eqid ||
    (activeNode as any)?.eqid ||
    (activeNode as any)?.EQID ||
    ''
  ).trim();

  const matchingRmsEqidRecord = (rmsContext?.eqid ?? []).find(
    (e: any) => e.ticketid && e.ticketid === selectedTicketId
  );
  const foundEqid = rawTicketEqid || String(matchingRmsEqidRecord?.EQID || matchingRmsEqidRecord?.eqid || '').trim();
  const effectiveEqid = getLastValue(foundEqid) || foundEqid;

  const bucketName = authSession?.bucketName ?? 'n20-bucket-01';
  const baseFolder = authSession?.baseFolder ?? 'sm';

  const createActivityLogRef = useRef(mainAppContext.createActivityLog);
  useEffect(() => {
    createActivityLogRef.current = mainAppContext.createActivityLog;
  }, [mainAppContext.createActivityLog]);

  const getStoragePath = useCallback((filename: string): string => {
    if (!filename) return '';
    if (filename.includes('/')) return filename;
    return `${bucketName}/${baseFolder}/nz-notes-error/tickets/${filename}`;
  }, [bucketName, baseFolder]);

  // Hook for ticket notes: businesses/{bid}/tickets/{ticketid}/ticketnotes
  const hookBid = selectedBid || 'none';
  const hookTicketId = selectedTicketId || 'none';
  const {
    items: ticketNotes,
    loading,
    error,
    getItems: getTicketNotes,
    createItem: createTicketNote,
    updateItem: updateTicketNote,
    deleteItem: deleteTicketNote,
  } = useTicketNotes(hookBid, hookTicketId);
  const { upload: uploadRemoteFile, uploading: remoteUploading } = useUploadRemoteFile();
  const { downloadSingleFile, downloading } = useFileDownload();
  const { deleteFiles, deleting } = useFileDelete();

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
      noteCreatedAt: new Date(),
    });
    setRefreshToken((v) => v + 1);
  }, []);

  // Download attached file from cloud storage or fallback to local generation
  const handleDownloadFile = useCallback(async (item: INoteItems, e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    const rawFileName = String(item.filename || item.FileUID || '').trim();
    const cleanName = getCleanFileName(rawFileName) || `note_${item.ticketid || selectedTicketId}_attachment.txt`;

    statusBarContext?.setIsLoading?.(true);
    statusBarContext?.setLoadingLabel?.('Downloading file...');
    try {
      if (rawFileName && !rawFileName.startsWith('sample-file-')) {
        const storagePath = getStoragePath(rawFileName);
        const res = await downloadSingleFile(storagePath);
        if (res?.success && res?.blobUrl) {
          const link = document.createElement('a');
          link.href = res.blobUrl;
          link.download = cleanName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return;
        }
      }

      // Fallback for sample/mock files or when remote file is not on bucket
      const noteText = item.notes || item.NotesMAX || item.message || '';
      const fileText = `Attachment: ${cleanName}\nTicket ID: ${item.ticketid || selectedTicketId}\nDate: ${item.datecreated || item.LastUpdated}\nNote: ${noteText}`;
      const blob = new Blob([fileText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = cleanName.includes('.') ? cleanName : `${cleanName}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('EQIDNotesPane: download error', err);
      const noteText = item.notes || item.NotesMAX || item.message || '';
      const fileText = `Attachment: ${cleanName}\nTicket ID: ${item.ticketid || selectedTicketId}\nDate: ${item.datecreated || item.LastUpdated}\nNote: ${noteText}`;
      const blob = new Blob([fileText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = cleanName.includes('.') ? cleanName : `${cleanName}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      statusBarContext?.setIsLoading?.(false);
      statusBarContext?.setLoadingLabel?.('');
    }
  }, [downloadSingleFile, getStoragePath, selectedTicketId, statusBarContext]);

  // Select a note card to view & edit in the bottom Notes control
  const handleSelectCardToEdit = useCallback((item: INoteItems) => {
    setEditingItem(item);
    const textContent = String(item.notes ?? item.NotesMAX ?? item.message ?? '');
    const rawFileName = String(item.filename || item.FileUID || '').trim();
    const cleanName = getCleanFileName(rawFileName);
    const noteId = String(item.noteid ?? item.id ?? item._noteid ?? Date.now());

    setNoteDetails({
      maxAudioRecordingTime: 60000,
      maxVideoRecordingTime: 60000,
      noteId,
      noteTitle: '',
      notecontent: textContent,
      notefile: undefined,
      notefileName: cleanName || undefined,
      noteaudio: undefined,
      noteCreatedAt: new Date(),
    });
    setRefreshToken((v) => v + 1);
  }, []);

  const handleDeleteAttachment = useCallback(() => {
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
  }, []);

  // Fetch notes by selectedBid and selectedTicketId
  const getNotesDetails = useCallback(async () => {
    resetEditor();
    if (selectedBid && selectedTicketId) {
      try {
        await getTicketNotes();
      } catch (err) {
        console.warn('EQIDNotesPane: error querying ticket notes:', err);
      }
    } else {
      setNoteItems([]);
    }
  }, [selectedBid, selectedTicketId, getTicketNotes, resetEditor]);

  useEffect(() => {
    if (selectedBid && selectedTicketId) {
      void getNotesDetails();
    } else {
      resetEditor();
      setNoteItems([]);
    }
  }, [selectedBid, selectedTicketId, getNotesDetails, resetEditor]);

  // Reset editor and search filter when switching tickets
  useEffect(() => {
    resetEditor();
    setFilterText('');
  }, [selectedTicketId, resetEditor]);

  // Sync local list with Firestore ticket notes hook or fallback datasets
  useEffect(() => {

    let sourceNotes: any[] = [];
    if (Array.isArray(ticketNotes) && ticketNotes.length > 0) {
      sourceNotes = ticketNotes;
    } else {
      const ctxNotes = (smDataContext?.datasets?.ticketnotes || []).filter(
        (n: any) => String(n.ticketid ?? '').trim() === selectedTicketId
      );
      if (ctxNotes.length > 0) {
        sourceNotes = ctxNotes;
      } else if (Array.isArray(ticketNotes)) {
        sourceNotes = ticketNotes;
      } else {
        const sampleNotes = (FnGetSourceDataset('ticketnotes') || []).filter(
          (n: any) => String(n.ticketid ?? '').trim() === selectedTicketId
        );
        sourceNotes = sampleNotes;
      }
    }

    if (sourceNotes.length > 0 || Array.isArray(ticketNotes)) {
      const cleanEffectiveEqid = (getLastValue(effectiveEqid) || effectiveEqid).trim().toLowerCase();
      const cleanTicketEqid = (getLastValue(rawTicketEqid) || rawTicketEqid).trim().toLowerCase();
      // Filter: only show notes that have eqid
      const eqidFilteredNotes = sourceNotes.filter((item: any) => {
        if (!item) return false;
        const rawNoteEqid = String(item.eqid ?? item.EQID ?? (item as any)?.eqId ?? '').trim();
        if (!rawNoteEqid) {
          // eqid not found or empty on this note -> do not show note!
          return false;
        }
        if (cleanEffectiveEqid || cleanTicketEqid) {
          const cleanNoteEqid = (getLastValue(rawNoteEqid) || rawNoteEqid).trim().toLowerCase();
          return (
            cleanNoteEqid === cleanEffectiveEqid ||
            cleanNoteEqid === cleanTicketEqid ||
            rawNoteEqid.toLowerCase() === effectiveEqid.trim().toLowerCase() ||
            rawNoteEqid.toLowerCase() === rawTicketEqid.trim().toLowerCase()
          );
        }
        return true;
      });

      const mappedNotes: INoteItems[] = eqidFilteredNotes.map((item: any) => {
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

        const noteText = String(item.notes ?? item.NotesMAX ?? item.message ?? item.NotesMax ?? item.text ?? '');
        const noteId = String(item.noteid ?? item.id ?? item._noteid ?? item.RecID ?? '');
        const rawDate = item.datecreated ?? item.LastUpdated ?? item.monitorupdated;

        return {
          ...item,
          noteid: noteId,
          _noteid: noteId,
          id: noteId,
          EntityName: item.EntityName ?? item.bid ?? selectedBid ?? '',
          NodeType: item.NodeType ?? (selectedCid ? 'Contact' : 'Business'),
          NotesMAX: noteText,
          message: noteText,
          notes: noteText,
          NotesType: resolvedType,
          UserName: item.UserName ?? item.noteby ?? item.createdby ?? 'Sales Exec',
          datecreated: rawDate,
          LastUpdated: FnParseTimestampToISO(rawDate),
          important: item.important === true || item.important === 'true' || item.important === 1 || Boolean(item.important),
          FileUID: rawFileName,
          filename: rawFileName,
          bid: item.bid ?? selectedBid,
          cid: item.cid ?? selectedCid,
          eqid: item.eqid ?? (item as any)?.EQID ?? rawTicketEqid ?? effectiveEqid,
          ticketid: item.ticketid ?? selectedTicketId,
        };
      });

      // Sort ascending (A-Z) by LastUpdated date timestamp
      const sortedNotes = [...mappedNotes].sort((a, b) => {
        const dateA = parseNoteDate(a);
        const dateB = parseNoteDate(b);
        if (dateA !== dateB) return dateA - dateB;
        return String(a.noteid ?? '').localeCompare(String(b.noteid ?? ''));
      });
      setNoteItems(sortedNotes);
    } else if (ticketNotes === null) {
      setNoteItems([]);
    }
  }, [ticketNotes, selectedBid, selectedCid, effectiveEqid, rawTicketEqid, selectedTicketId, smDataContext?.datasets?.ticketnotes]);

  const filteredNotes = useMemo(() => {
    if (!filterText.trim()) return notesItems;
    const q = filterText.trim().toLowerCase();
    return notesItems.filter((element) =>
      (element.NotesMAX ?? element.notes ?? element.message ?? '').toLowerCase().includes(q) ||
      (element.filename ?? '').toLowerCase().includes(q) ||
      (element.UserName ?? '').toLowerCase().includes(q)
    );
  }, [notesItems, filterText]);

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

  // Process note creation / update after user answers the Important popup prompt
  const processSaveNote = useCallback(async (message: INote, isNoteImportant: boolean) => {
    const noteText = message.notecontent?.trim() ?? '';
    const now = new Date().toISOString();

    let LoginUserName: ISession[] | null = FnGetSessionVariableFromStorage('RequestedBy', 'LoginShortName', sessionContext.SessionList);
    const userName = (LoginUserName && LoginUserName.length > 0 && LoginUserName[0].SessionValue)
      ? String(LoginUserName[0].SessionValue)
      : (authSession?.displayName || authSession?.username);

    // ── Upload attached file if present ──
    let uploadedFileName = '';
    const attachedData = message.notefile || message.noteaudio || message.notevideo;

    if (attachedData) {
      const rawFileName = message.notefileName
        || (attachedData instanceof File ? attachedData.name : '')
        || (message.notevideo ? 'video.mp4' : message.noteaudio ? 'audio.webm' : 'image.png');

      // If editing and user kept original attachment without replacing it:
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
        uploadedFileName = generateUniqueFileName(selectedBid, selectedCid, rawFileName, defaultExt);

        setFileUploading(true);
        statusBarContext?.setIsLoading?.(true);
        statusBarContext?.setLoadingLabel?.('Uploading file...');
        try {
          const uploadResult = await uploadRemoteFile({
            source: attachedData,
            bucket: bucketName,
            baseFolder: baseFolder,
            fileName: `nz-notes-error/tickets/${uploadedFileName}`,
          });
          if (!uploadResult?.success) {
            console.error('EQIDNotesPane: uploadRemoteFile failed', uploadResult?.error, uploadResult?.message);
          }
        } catch (err) {
          console.error('EQIDNotesPane: uploadRemoteFile error', err);
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

      // If previous file attachment was replaced or removed, delete from Cloud Storage
      if (previousFileName && previousFileName !== finalFileName && !previousFileName.startsWith('sample-file-')) {
        try {
          statusBarContext?.setIsLoading?.(true);
          statusBarContext?.setLoadingLabel?.('Deleting previous file...');
          const oldStoragePath = getStoragePath(previousFileName);
          await deleteFiles([oldStoragePath]);
        } catch (err) {
          console.warn('EQIDNotesPane: error deleting previous attachment', err);
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

      // Resolve active ticket card and eqid directly from context at save time
      const activeTicketCard =
        (selectedNodeContext as any)?.selectedTicketCard ??
        (selectedNodeContext as any)?.SelectedTicketCard ??
        (rmsContext as any)?.selectedTicketCard ??
        (rmsContext as any)?.SelectedTicketCard ??
        selectedTicketCard ??
        props.ticket;

      const currentTicketEqid = String(
        activeTicketCard?.eqid ||
        activeTicketCard?.EQID ||
        (activeTicketCard as any)?.eqId ||
        rawTicketEqid ||
        effectiveEqid ||
        props.eqid ||
        ''
      ).trim();

      const targetTicketId = String(
        activeTicketCard?.ticketid ||
        activeTicketCard?.id ||
        activeTicketCard?.NodeEntID ||
        selectedTicketId ||
        props.ticket?.ticketid ||
        ''
      ).trim();

      const targetBid = String(
        activeTicketCard?.bid ||
        selectedBid ||
        props.ticket?.bid ||
        resolvedTarget.bid ||
        ''
      ).trim();

      const targetCid = String(
        activeTicketCard?.cid ||
        selectedCid ||
        props.ticket?.cid ||
        resolvedTarget.cid ||
        ''
      ).trim();

      const editEqid = String(
        currentTicketEqid ||
        editingItem.eqid ||
        editingItem.EQID ||
        (editingItem as any)?.eqId ||
        effectiveEqid ||
        ''
      ).trim();

      // Optimistic update in local list
      const applyUpdate = (prev: INoteItems[]) =>
        prev.map((item) => {
          const itemId = String(item.id ?? item.noteid ?? item._noteid ?? item.FileUID ?? '');
          if (item === editingItem || (noteIdToUpdate && itemId === noteIdToUpdate)) {
            return {
              ...item,
              NotesMAX: noteText,
              message: noteText,
              notes: noteText,
              NotesType: updatedNotesType,
              LastUpdated: now,
              monitorupdated: now,
              important: isNoteImportant,
              FileUID: finalFileName,
              filename: finalFileName,
              eqid: editEqid,
              EQID: editEqid,
              ...(targetTicketId ? { ticketid: targetTicketId } : {}),
            };
          }
          return item;
        });

      setNoteItems(applyUpdate);
      resetEditor();

      if (noteIdToUpdate && targetBid && targetTicketId && updateTicketNote) {
        const updatePayload: Record<string, unknown> = {
          notes: noteText,
          NotesMAX: noteText,
          message: noteText,
          monitorupdated: now,
          filename: finalFileName,
          noteby: userName,
          UserName: userName,
          important: isNoteImportant,
          eqid: editEqid,
          EQID: editEqid,
          ...(targetTicketId ? { ticketid: targetTicketId } : {}),
        };
        const fsdbUpdatePayload: Record<string, unknown> = {
          notes: noteText,
          monitorupdated: now,
          filename: finalFileName,
          eqid: editEqid,
          ...(targetTicketId ? { ticketid: targetTicketId } : {}),
        };
        const result = await updateTicketNote(noteIdToUpdate, fsdbUpdatePayload);
        if (result && result.success !== false) {
          smDataContext?.setDatasets?.((prev: any) => ({
            ...prev,
            ticketnotes: (prev?.ticketnotes || []).map((n: any) =>
              (n.noteid === noteIdToUpdate || n.id === noteIdToUpdate || n._noteid === noteIdToUpdate)
                ? { ...n, ...updatePayload }
                : n
            ),
          }));
          try {
            await createActivityLogRef.current?.(`${targetCid || selectedCid || userName} of ${targetBid} updated note ${noteIdToUpdate} successfully.`);
          } catch (logErr) {
            console.error('EQIDNotesPane: createActivityLog failed', logErr);
          }
          void getNotesDetails();
        } else {
          console.error('EQIDNotesPane: updateTicketNote failed', result?.error);
        }
      }
      return;
    }

    // ── CREATE MODE: Add a new note ──
    const activeTicketCard =
      (selectedNodeContext as any)?.selectedTicketCard ??
      (selectedNodeContext as any)?.SelectedTicketCard ??
      (rmsContext as any)?.selectedTicketCard ??
      (rmsContext as any)?.SelectedTicketCard ??
      selectedTicketCard ??
      props.ticket;

    const currentTicketEqid = String(
      activeTicketCard?.eqid ||
      activeTicketCard?.EQID ||
      (activeTicketCard as any)?.eqId ||
      rawTicketEqid ||
      effectiveEqid ||
      props.eqid ||
      ''
    ).trim();

    const targetTicketId = String(
      activeTicketCard?.ticketid ||
      activeTicketCard?.id ||
      activeTicketCard?.NodeEntID ||
      selectedTicketId ||
      props.ticket?.ticketid ||
      ''
    ).trim();

    const targetBid = String(
      activeTicketCard?.bid ||
      selectedBid ||
      props.ticket?.bid ||
      resolvedTarget.bid ||
      ''
    ).trim();

    const targetCid = String(
      activeTicketCard?.cid ||
      selectedCid ||
      props.ticket?.cid ||
      resolvedTarget.cid ||
      ''
    ).trim();

    let notesType = 'Message';
    if (message.notevideo) notesType = 'Video';
    else if (message.noteaudio) notesType = 'Audio';
    else if (message.notefile) notesType = 'File';

    const noteid = `note_${targetCid || selectedCid || 'user'}_${Date.now()}`;
    const finalFilename = uploadedFileName || '';

    const createEqid = currentTicketEqid || effectiveEqid || '';

    const notePayload: Record<string, unknown> = {
      bid: targetBid,
      cid: targetCid,
      ticketid: targetTicketId,
      eqid: createEqid,
      noteid,
      noteby: userName,
      UserName: userName,
      notes: noteText,
      NotesMAX: noteText,
      message: noteText,
      filename: finalFilename,
      datecreated: now,
      monitorupdated: now,
      monitor: false,
      important: isNoteImportant,
    };

    const optimisticRow: INoteItems = {
      EntityName: props.selectedNode?.NodeEntityname ?? (targetCid ? 'Contact' : 'Business'),
      LastUpdated: now,
      NodeType: props.selectedNode?.NodeType ?? (targetCid ? 'Contact' : 'Business'),
      NotesMAX: noteText,
      notes: noteText,
      message: noteText,
      NotesType: notesType,
      UserName: userName,
      noteid,
      _noteid: noteid,
      important: isNoteImportant,
      filename: finalFilename,
      FileUID: finalFilename,
      bid: targetBid,
      cid: targetCid,
      ticketid: targetTicketId,
      eqid: createEqid,
    };

    setNoteItems((prev) => [...prev, optimisticRow].sort((a, b) => parseNoteDate(a) - parseNoteDate(b)));
    smDataContext?.setDatasets?.((prev: any) => ({
      ...prev,
      ticketnotes: [...(prev?.ticketnotes || []), notePayload],
    }));
    resetEditor();

    if (targetBid && targetTicketId && createTicketNote) {
      const fsdbCreatePayload: Record<string, unknown> = {
        bid: targetBid,
        cid: targetCid,
        ticketid: targetTicketId,
        eqid: createEqid,
        notes: noteText,
        filename: finalFilename,
        datecreated: now,
        monitorupdated: now,
        monitor: false,
      };
      const result = await createTicketNote(fsdbCreatePayload);
      if (result && result.success !== false) {
        const createdId = result.id || noteid;
        try {
          await createActivityLogRef.current?.(`${targetCid || selectedCid || userName} of ${targetBid} created note ${createdId} successfully.`);
        } catch (logErr) {
          console.error('EQIDNotesPane: createActivityLog failed', logErr);
        }
        void getNotesDetails();
      } else {
        console.error('EQIDNotesPane: createTicketNote failed', result?.error);
      }
    }
  }, [editingItem, resetEditor, updateTicketNote, selectedBid, selectedCid, effectiveEqid, rawTicketEqid, selectedTicketId, selectedTicketCard, selectedNodeContext, rmsContext, sessionContext.SessionList, authSession, props.selectedNode, props.ticket, props.eqid, createTicketNote, uploadRemoteFile, bucketName, baseFolder, getStoragePath, deleteFiles, statusBarContext, mainAppContext, getNotesDetails, smDataContext]);

  // When user sends a note, save or update directly without popup prompt
  const sendNotes = useCallback(
    async (message: INote) => {
      const noteText = message.notecontent?.trim() ?? '';
      if (!noteText || !selectedTicketId) return;

      await processSaveNote(message, false);
    },
    [selectedTicketId, processSaveNote]
  );

  return (
    <div className="nz-node-list-Container" key={uniqueName}>
      <div className="nz-notes-list-main-div">
        <div className="nz-notes-list-with-msg-box">
          {editingItem ? (
            <div
              className="nz-sub-header nz-d-flex-row nz-align-center nz-justify-between"
              style={{ height: '28px', padding: '0 8px' }}
            >
              <Label uniqueName="editing-note-header" label="Editing Note" />
              <button
                type="button"
                style={{
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  fontSize: '13px',
                  color: 'inherit',
                }}
                onClick={resetEditor}
                title="Cancel edit"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="nz-sub-header">
              <Label uniqueName={`${uniqueName}-notes-header`} label="EQID Notes" />
            </div>
          )}

          <div className="nz-notes-search">
            <FilterKeywordControl
              uniqueName={`${uniqueName}-filter`}
              searchInputValue={filterText}
              filterDirty={Boolean(filterText)}
              searchValueChange={(val: string) => setFilterText(val)}
              handleFilterMouse={() => { }}
              filterIconTooltip="Filter"
            />
          </div>

          <div className="nz-notes-list-scroll" ref={scrollRef}>
            {!selectedTicketId ? (
              <div className="nz-notes-empty" style={{ padding: '10px', textAlign: 'center', opacity: 0.7 }}>
                <Label uniqueName="notes-select" label="Select a ticket to view notes" />
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="nz-notes-empty" style={{ padding: '10px', textAlign: 'center', opacity: 0.7 }}>
                <Label
                  uniqueName="notes-empty"
                  label={notesItems.length === 0 ? 'No notes with EQID found' : 'No notes matching filter'}
                />
              </div>
            ) : (
              filteredNotes.map((item, index) => {
                const isSelected = editingItem
                  ? editingItem === item || (Boolean(editingItem.noteid) && item.noteid === editingItem.noteid)
                  : false;
                const formattedDate = FnFormatDateWithAppFormat(item.datecreated || item.LastUpdated, true);
                const currentUserName = item.UserName || item.noteby || item.createdby || 'Sales Exec';
                const cleanName = getCleanFileName(item.filename || item.FileUID || '');
                const tooltipText = cleanName
                  ? `Click to download ${cleanName}`
                  : 'Click to download attachment';
                const isImportantNote = Boolean(item.important);

                return (
                  <div
                    className={`nz-node-list-box ${isImportantNote ? 'nz-note-important' : ''} ${isSelected ? 'nz-node-list-box-selected' : ''}`}
                    key={item.ticketid ? `${item.ticketid}-${index}` : (item.noteid ? `${item.noteid}-${index}` : index)}
                    title={isImportantNote ? 'Important.' : undefined}
                    onClick={() => handleSelectCardToEdit(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="nz-node-list-delete">
                      <div className="nz-note-date">
                        <Label
                          uniqueName={`date-${index}`}
                          label={formattedDate}
                        />
                      </div>
                      <div className="nz-note-user">
                        <Label
                          uniqueName={`user-${index}`}
                          label={currentUserName}
                        />
                      </div>
                    </div>
                    <div className="nz-info-div">
                      <div
                        className="nz-info-image"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDownloadFile(item, e);
                          handleSelectCardToEdit(item);
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
                          tooltip={tooltipText}
                        />
                      </div>
                      <div className="nz-nodes-text">
                        <Label uniqueName={`notes-${index}`} label={item.notes || item.NotesMAX || item.message || ''} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {selectedTicketId && (
            <div className="nz-notes-container">
              {noteDetails && (
                <Notes
                  {...noteDetails}
                  key={refreshToken}
                  allowAudio={false}
                  allowVideo={false}
                  sendNote={sendNotes}
                  sendTooltip={editingItem ? 'Update Note' : 'Send Note'}
                  handleDelete={handleDeleteAttachment}
                  placeholderMessage="Enter a notes here..."
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EQIDNotesPane;
