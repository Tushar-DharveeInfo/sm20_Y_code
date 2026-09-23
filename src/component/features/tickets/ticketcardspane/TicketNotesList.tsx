import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Notes } from '@n20a/libavnotes';
import type { INote } from '@n20a/libavnotes';
import '@n20a/libavnotes/style.css';
import '../../../shared/sidebar/notes/FqaNotes.css';
import './TicketNotesList.css';
import { Attach24x24 } from '@n20a/libicon';
import { Image } from '../../../shared/basic/image/Image';
import { Label } from '../../../shared/basic/label/Label';
import { FilterKeywordControl } from '../../../shared/searchfilter/filterkeywordcontrol/FilterKeywordControl';
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable';
import { FnFormatDateWithAppFormat } from '../../../appcontainer/allcommon/FnFormatDateWithAppFormat';
import type { ITicketNoteDoc, ITicketDoc } from '../../../shared/allinterface/IDatasets';
import { useFileDownload } from '@n20a/libfsdb';
import { useStatusBarContext } from '../../../shared/context/hooks/StatusBarHooks';
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks';

interface ITicketNotesListProps {
    uniqueName: string;
    ticketId: string | null;
    ticket?: ITicketDoc | null;
    ticketnotes: ITicketNoteDoc[];
    currentUserName?: string;
    onAddNote?: (note: ITicketNoteDoc) => void;
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

/** Sort notes oldest → newest (A-Z by datecreated) — latest at bottom. */
function sortNotesOldestFirst(notes: ITicketNoteDoc[]): ITicketNoteDoc[] {
    return [...notes].sort((a, b) => {
        const ta = a.datecreated ? new Date(a.datecreated).getTime() : 0;
        const tb = b.datecreated ? new Date(b.datecreated).getTime() : 0;
        return ta - tb; // ascending (oldest first, newest at bottom)
    });
}

const TicketNotesList: React.FC<ITicketNotesListProps> = ({
    uniqueName,
    ticketId,
    ticket,
    ticketnotes,
    currentUserName = 'Sales Exec',
    onAddNote,
}) => {
    const [filterText, setFilterText] = useState('');
    const [localNotes, setLocalNotes] = useState<ITicketNoteDoc[]>([]);
    const [editingItem, setEditingItem] = useState<ITicketNoteDoc | null>(null);
    const [refreshToken, setRefreshToken] = useState<number>(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const statusBarContext = useStatusBarContext();
    const mainAppContext = useMainAppContext();
    const { downloadSingleFile } = useFileDownload();

    const bucketName = mainAppContext.authSession?.bucketName ?? 'n20-bucket-01';
    const baseFolder = mainAppContext.authSession?.baseFolder ?? 'sm';

    const getStoragePath = useCallback(
        (filename: string): string => {
            if (!filename) return '';
            if (filename.includes('/')) return filename;
            return `${bucketName}/${baseFolder}/nz-notes-error/tickets/${filename}`;
        },
        [bucketName, baseFolder]
    );

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

    const allNotesForTicket = useMemo(() => {
        if (!ticketId) return [];
        const targetId = String(ticketId).trim();
        const base = ticketnotes.filter(
            (n) => String(n.ticketid ?? '').trim() === targetId
        );
        const added = localNotes.filter(
            (n) => String(n.ticketid ?? '').trim() === targetId
        );
        return [...base, ...added];
    }, [ticketId, ticketnotes, localNotes]);

    const sorted = useMemo(() => sortNotesOldestFirst(allNotesForTicket), [allNotesForTicket]);

    const filtered = useMemo(() => {
        if (!filterText.trim()) return sorted;
        const query = filterText.trim().toLowerCase();
        return sorted.filter((n) =>
            (n.notes ?? '').toLowerCase().includes(query)
        );
    }, [sorted, filterText]);

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
    // Reset editor and search filter when switching tickets
    useEffect(() => {
        resetEditor();
        setFilterText('');
    }, [ticketId, resetEditor]);

    // Auto-scroll to bottom of list when notes change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [filtered.length]);



    const handleSelectCardToEdit = useCallback((item: ITicketNoteDoc) => {
        setEditingItem(item);
        const cleanName = getCleanFileName(item.filename || '');
        setNoteDetails({
            maxAudioRecordingTime: 60000,
            maxVideoRecordingTime: 60000,
            noteId: `${Date.now()}`,
            noteTitle: '',
            notecontent: item.notes || '',
            notefile: undefined,
            notefileName: cleanName || undefined,
            noteaudio: undefined,
            noteCreatedAt: new Date(),
        });
        setRefreshToken((v) => v + 1);
    }, []);

    // Download attached file from cloud storage or fallback to local generation
    const handleDownloadFile = useCallback(
        async (item: ITicketNoteDoc, e?: React.MouseEvent) => {
            e?.stopPropagation?.();
            const rawFileName = String(item.filename || '').trim();
            const cleanName = getCleanFileName(rawFileName) || `note_${item.ticketid}_attachment.txt`;

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
                const fileText = `Attachment: ${cleanName}\nTicket ID: ${item.ticketid}\nDate: ${item.datecreated}\nNote: ${item.notes}`;
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
                console.error('TicketNotesList: download error', err);
                const fileText = `Attachment: ${cleanName}\nTicket ID: ${item.ticketid}\nDate: ${item.datecreated}\nNote: ${item.notes}`;
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
        },
        [downloadSingleFile, getStoragePath, statusBarContext]
    );

    const handleSendNotes = useCallback(
        (message: INote) => {
            const noteText = message.notecontent?.trim() ?? '';
            if (!noteText || !ticketId) return;

            if (editingItem) {
                // Update existing note
                setLocalNotes((prev) =>
                    prev.map((n) =>
                        n === editingItem
                            ? { ...n, notes: noteText, filename: message.notefileName || n.filename }
                            : n
                    )
                );
                resetEditor();
                return;
            }

            const newDoc: ITicketNoteDoc = {
                bid: ticket?.bid ?? '',
                cid: ticket?.cid ?? '',
                ticketid: ticketId,
                monitorupdated: new Date().toISOString(),
                monitor: false,
                notes: noteText,
                filename: message.notefileName || undefined,
                datecreated: new Date().toISOString(),
            };

            setLocalNotes((prev) => [...prev, newDoc]);
            onAddNote?.(newDoc);
            resetEditor();
        },
        [ticketId, ticket, editingItem, onAddNote, resetEditor]
    );

    const handleDeleteAttachment = useCallback(() => {
        setNoteDetails((prev) =>
            prev
                ? {
                    ...prev,
                    notefile: undefined,
                    notefileName: undefined,
                }
                : undefined
        );
    }, []);

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
                            <Label uniqueName={`${uniqueName}-notes-header`} label="Notes" />
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
                        {!ticketId ? (
                            <div className="nz-notes-empty" style={{ padding: '10px', textAlign: 'center', opacity: 0.7 }}>
                                <Label uniqueName="notes-select" label="Select a ticket to view notes" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="nz-notes-empty" style={{ padding: '10px', textAlign: 'center', opacity: 0.7 }}>
                                <Label
                                    uniqueName="notes-empty"
                                    label={allNotesForTicket.length === 0 ? 'No notes for this ticket' : 'No notes matching filter'}
                                />
                            </div>
                        ) : (
                            filtered.map((item, index) => {
                                const isSelected = editingItem === item;
                                const formattedDate = FnFormatDateWithAppFormat(item.datecreated, true);
                                const cleanName = getCleanFileName(item.filename || '');
                                const tooltipText = cleanName
                                    ? `Click to download ${cleanName}`
                                    : 'Click to download attachment';

                                return (
                                    <div
                                        className={`nz-node-list-box ${isSelected ? 'nz-node-list-box-selected' : ''}`}
                                        key={item.ticketid ? `${item.ticketid}-${index}` : index}
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
                                                <Label uniqueName={`notes-${index}`} label={item.notes} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {ticketId && (
                        <div className="nz-notes-container">
                            {noteDetails && (
                                <Notes
                                    {...noteDetails}
                                    key={refreshToken}
                                    allowAudio={false}
                                    allowVideo={false}
                                    sendNote={handleSendNotes}
                                    sendTooltip={editingItem ? 'Update Note' : 'Send Note'}
                                    handleDelete={handleDeleteAttachment}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export { TicketNotesList };
export type { ITicketNotesListProps };
export default TicketNotesList;
