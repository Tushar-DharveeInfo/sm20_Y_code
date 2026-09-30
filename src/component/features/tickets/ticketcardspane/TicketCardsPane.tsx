import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { TicketCardList } from './TicketCardList';
import { TicketNotesList } from './TicketNotesList';
import type { ITicketDoc, IContactDoc, ITicketNoteDoc } from '../../../shared/allinterface/IDatasets';
import { ITreeNode } from '../../../shared/allinterface/tree/ITreeControl';
import { ILibraryTicketMode, filterTicketsByLibraryMode } from '../../appqa/allcommon/FnBuildTicketTree';
import { useSmDataContext } from '../../../shared/context/hooks/SmDataHooks';
import { useSelectedNodeContext } from '../../../shared/context/hooks/SelectedNodeHooks';
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks';
import { FnGetSourceDataset } from '../../../shared/allcommon/FnLoadSampleDatasets';
import { TicketsEnums } from '../../../constants/Feature';
import { useBusinessTickets, useTicketNotes, type IFirestoreQueryFilter } from '@n20a/libfsdb';
import './TicketCardsPane.css';

interface ITicketCardsPaneProps {
    uniqueName?: string;
    featureId?: string;
    libraryMode?: ILibraryTicketMode;
    selectedNode?: ITreeNode;
    treeData?: ITreeNode[];
    headerText?: string;
    onSkuClick?: (sku: string, ticket: ITicketDoc) => void;
}

const DEFAULT_PURCHASED_SKUS = ['netzoom', 'visiostencils', 'ssi', 'amc'];

function formatTimestampOrDate(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
        const sec = (value as { seconds: number }).seconds;
        return new Date(sec * 1000).toISOString();
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    return String(value);
}

function FnMapToTicketDoc(record: Record<string, unknown>, fallbackBid: string): ITicketDoc {
    return {
        bid: String(record.bid || fallbackBid || ''),
        cid: String(record.cid || record.contactid || ''),
        monitorupdated: formatTimestampOrDate(record.monitorupdated),
        monitor: Boolean(record.monitor),
        ticketid: String(record.ticketid || record.id || ''),
        tickettype: String(record.tickettype || ''),
        subscription: String(record.subscription || ''),
        mfg: String(record.mfg || ''),
        eqtype: String(record.eqtype || ''),
        prodno: String(record.prodno || ''),
        moreinfo: String(record.moreinfo || ''),
        status: String(record.status || ''),
        daterequested: formatTimestampOrDate(record.daterequested),
        datereleased: formatTimestampOrDate(record.datereleased),
        lastupdated: formatTimestampOrDate(record.lastupdated),
    };
}

function FnMapToTicketNoteDoc(
    record: Record<string, unknown>,
    fallbackBid: string,
    fallbackTicketId: string
): ITicketNoteDoc {
    return {
        bid: String(record.bid || fallbackBid || ''),
        cid: String(record.cid || record.contactid || ''),
        ticketid: String(record.ticketid || fallbackTicketId || ''),
        monitorupdated: formatTimestampOrDate(record.monitorupdated),
        monitor: Boolean(record.monitor),
        notes: String(record.notes || record.text || record.note || ''),
        filename: record.filename ? String(record.filename) : undefined,
        datecreated: formatTimestampOrDate(
            record.datecreated || record.createdat || record.createdAt || new Date().toISOString()
        ),
    };
}

/** Sort tickets newest → oldest by daterequested (Z-A). */
function sortTicketsNewestFirst(tickets: ITicketDoc[]): ITicketDoc[] {
    return [...tickets].sort((a, b) => {
        const ta = a.daterequested ? new Date(a.daterequested).getTime() : 0;
        const tb = b.daterequested ? new Date(b.daterequested).getTime() : 0;
        return tb - ta; // descending (newest first)
    });
}

function resolveScopeFromNode(
    node?: ITreeNode,
    selection?: { bid?: string; cid?: string }
): { nodeType: 'Root' | 'Business' | 'Contact'; bid?: string; cid?: string } {
    const cidFromSel = selection?.cid ? String(selection.cid).trim() : '';
    const bidFromSel = selection?.bid ? String(selection.bid).trim() : '';

    if (cidFromSel) {
        return { nodeType: 'Contact', bid: bidFromSel || undefined, cid: cidFromSel };
    }
    if (bidFromSel) {
        return { nodeType: 'Business', bid: bidFromSel };
    }

    if (!node || !node.NodeType || node.NodeType === 'Root') {
        return { nodeType: 'Root' };
    }

    const type = String(node.NodeType).toLowerCase();
    if (type === 'contact') {
        const cid = String(node.cid ?? node.NodeEntID ?? node.key ?? '').trim();
        const bid = String(node.bid ?? node.parentEntID ?? '').trim();
        return { nodeType: 'Contact', bid: bid || undefined, cid: cid || undefined };
    }

    if (type === 'business') {
        const bid = String(node.bid ?? node.NodeEntID ?? node.key ?? '').trim();
        return { nodeType: 'Business', bid: bid || undefined };
    }

    return { nodeType: 'Root' };
}

const TicketCardsPane: React.FC<ITicketCardsPaneProps> = (props) => {
    const {
        uniqueName = 'ticket-cards-pane',
        featureId,
        libraryMode: propMode,
        selectedNode,
        onSkuClick,
    } = props;

    const smDataContext = useSmDataContext();
    const selectedNodeContext = useSelectedNodeContext();
    const mainAppContext = useMainAppContext();

    // Determine library mode: 'received' (status <> Approved) or 'accepted' (status == Approved)
    const effectiveMode: ILibraryTicketMode = useMemo(() => {
        if (propMode) return propMode;
        if (featureId === TicketsEnums.ApprovedTickets) return 'accepted';
        return 'received';
    }, [propMode, featureId]);

    // Determine active tree node
    const activeNode =
        selectedNode ??
        smDataContext.selectedNode ??
        selectedNodeContext?.selectedNode ??
        selectedNodeContext?.selectedNodeExplorer?.node;

    // Resolve scope
    const scope = useMemo(() => {
        return resolveScopeFromNode(activeNode, smDataContext.selection);
    }, [activeNode, smDataContext.selection]);

    const effectiveBid = useMemo(() => {
        return scope.bid ? String(scope.bid).trim() : '';
    }, [scope.bid]);

    const isRequestsReceived =
        featureId === TicketsEnums.RequestsReceived ||
        (!featureId && propMode === 'received');

    const isApprovedTickets =
        featureId === TicketsEnums.ApprovedTickets ||
        (!featureId && propMode === 'accepted');

    const ticketQueryFilters = useMemo<IFirestoreQueryFilter[] | undefined>(() => {
        if (isRequestsReceived) {
            return [{ field: 'status', op: '==', value: 'Received' }];
        }
        if (isApprovedTickets) {
            return [{ field: 'status', op: '==', value: 'Released' }];
        }
        return undefined;
    }, [isRequestsReceived, isApprovedTickets]);

    const ticketFetchByFilter = useMemo(() => {
        if (!ticketQueryFilters || ticketQueryFilters.length === 0) return undefined;
        return {
            featurecmd: 'tickets',
            fileterjson: JSON.stringify(ticketQueryFilters),
        };
    }, [ticketQueryFilters]);

    // Call useBusinessTickets hook based on selected node business id
    const {
        tickets: apiTickets,
        getTickets,
    } = useBusinessTickets(effectiveBid);

    useEffect(() => {
        if (effectiveBid) {
            void getTickets(ticketQueryFilters, ticketFetchByFilter);
        }
    }, [effectiveBid, getTickets, ticketQueryFilters, ticketFetchByFilter]);

    const mappedApiTickets = useMemo<ITicketDoc[] | null>(() => {
        if (!effectiveBid || !Array.isArray(apiTickets)) {
            return null;
        }
        return apiTickets.map((r) => FnMapToTicketDoc(r, effectiveBid));
    }, [effectiveBid, apiTickets]);

    // Keep smDataContext synchronized with tickets loaded from Firestore
    useEffect(() => {
        if (effectiveBid && mappedApiTickets !== null) {
            smDataContext.setDatasets((prev) => {
                const otherTickets = (prev.tickets ?? []).filter((t) => t.bid !== effectiveBid);
                return {
                    ...prev,
                    tickets: [...otherTickets, ...mappedApiTickets],
                };
            });
        }
    }, [effectiveBid, mappedApiTickets]);

    // Purchased SKUs from IMainApp
    const purchasedSkus = useMemo(() => {
        const fromContext =
            mainAppContext?.purchasedSkus ??
            mainAppContext?.getPurchasedSkus?.() ??
            mainAppContext?.authSession?.purchasedSkus;

        if (Array.isArray(fromContext) && fromContext.length > 0) {
            return fromContext;
        }
        return DEFAULT_PURCHASED_SKUS;
    }, [mainAppContext]);

    // Sourced tickets: hook tickets when available, else scoped dataset / fallback
    const rawTickets: ITicketDoc[] = useMemo(() => {
        if (effectiveBid) {
            if (mappedApiTickets !== null) {
                return mappedApiTickets;
            }
            const ctxTickets = (smDataContext.datasets?.tickets || []).filter(
                (t) => t.bid === effectiveBid
            );
            if (ctxTickets.length > 0) {
                return ctxTickets;
            }
            return [];
        }
        // Root node
        const ctxTickets = smDataContext.datasets?.tickets;
        if (ctxTickets && ctxTickets.length > 0) {
            return ctxTickets;
        }
        return FnGetSourceDataset('tickets') || [];
    }, [effectiveBid, mappedApiTickets, smDataContext.datasets?.tickets]);

    // Sourced contacts
    const contacts: IContactDoc[] = useMemo(() => {
        const ctxContacts = smDataContext.datasets?.contacts;
        if (ctxContacts && ctxContacts.length > 0) {
            return ctxContacts;
        }
        return FnGetSourceDataset('contacts') || [];
    }, [smDataContext.datasets?.contacts]);

    // Filter tickets by library mode ('received' vs 'accepted') or feature status
    const modeFilteredTickets = useMemo(() => {
        if (isRequestsReceived) {
            return rawTickets.filter(
                (ticket) => (ticket.status ?? '').trim().toLowerCase() === 'received'
            );
        }
        if (isApprovedTickets) {
            return rawTickets.filter(
                (ticket) => (ticket.status ?? '').trim().toLowerCase() === 'released'
            );
        }
        return filterTicketsByLibraryMode(rawTickets, effectiveMode);
    }, [rawTickets, effectiveMode, isRequestsReceived, isApprovedTickets]);

    // Scope tickets by selected node:
    // Root -> all businesses
    // Business -> all contacts of selected business
    // Contact -> selected contact of selected business
    const scopedTickets = useMemo(() => {
        if (scope.nodeType === 'Contact') {
            return modeFilteredTickets.filter((t) => {
                const bOk = scope.bid ? t.bid === scope.bid : true;
                const cOk = scope.cid ? t.cid === scope.cid : true;
                return bOk && cOk;
            });
        }
        if (scope.nodeType === 'Business' && scope.bid) {
            return modeFilteredTickets.filter((t) => t.bid === scope.bid);
        }
        // Root: all tickets across all businesses
        return modeFilteredTickets;
    }, [modeFilteredTickets, scope]);

    const sortedScopedTickets = useMemo(() => {
        return sortTicketsNewestFirst(scopedTickets);
    }, [scopedTickets]);

    // Selected ticket state
    const [selectedTicket, setSelectedTicket] = useState<ITicketDoc | null>(null);

    const prevNodeKeyRef = useRef<string>('');
    const currentNodeKey = String(
        activeNode?.key ?? activeNode?.NodeEntID ?? scope.bid ?? ''
    );

    // Auto-select first ticket by default when tickets change or when active node changes
    useEffect(() => {
        const nodeChanged = prevNodeKeyRef.current !== currentNodeKey;
        if (nodeChanged) {
            prevNodeKeyRef.current = currentNodeKey;
        }

        setSelectedTicket((prev) => {
            if (sortedScopedTickets.length === 0) return null;
            // Always select first ticket when the selected tree node changes
            if (nodeChanged) {
                return sortedScopedTickets[0];
            }
            // Keep current selection if still present in the list
            if (prev && sortedScopedTickets.some((t) => t.ticketid === prev.ticketid)) {
                return prev;
            }
            // By default, select 1st ticket
            return sortedScopedTickets[0];
        });
    }, [sortedScopedTickets, currentNodeKey]);

    // Load ticket notes using useTicketNotes hook for selected ticket
    const selectedTicketBid = selectedTicket?.bid
        ? String(selectedTicket.bid).trim()
        : effectiveBid;
    const selectedTicketId = selectedTicket?.ticketid
        ? String(selectedTicket.ticketid).trim()
        : '';

    const {
        items: apiNotes,
        getItems: getTicketNotes,
        createItem: createTicketNote,
    } = useTicketNotes(selectedTicketBid, selectedTicketId);

    useEffect(() => {
        if (selectedTicketBid && selectedTicketId) {
            void getTicketNotes();
        }
    }, [selectedTicketBid, selectedTicketId, getTicketNotes]);

    const mappedApiNotes = useMemo<ITicketNoteDoc[] | null>(() => {
        if (!selectedTicketBid || !selectedTicketId || !Array.isArray(apiNotes)) {
            return null;
        }
        return apiNotes.map((r) =>
            FnMapToTicketNoteDoc(r, selectedTicketBid, selectedTicketId)
        );
    }, [selectedTicketBid, selectedTicketId, apiNotes]);

    useEffect(() => {
        if (selectedTicketBid && selectedTicketId && mappedApiNotes !== null) {
            smDataContext.setDatasets((prev) => {
                const otherNotes = (prev.ticketnotes ?? []).filter(
                    (n) => n.ticketid !== selectedTicketId
                );
                return {
                    ...prev,
                    ticketnotes: [...otherNotes, ...mappedApiNotes],
                };
            });
        }
    }, [selectedTicketBid, selectedTicketId, mappedApiNotes]);

    // Sourced ticket notes
    const ticketnotes: ITicketNoteDoc[] = useMemo(() => {
        if (selectedTicketBid && selectedTicketId) {
            if (mappedApiNotes !== null) {
                return mappedApiNotes;
            }
            const ctxNotes = (smDataContext.datasets?.ticketnotes || []).filter(
                (n) => n.ticketid === selectedTicketId
            );
            if (ctxNotes.length > 0) {
                return ctxNotes;
            }
            return [];
        }
        const ctxNotes = smDataContext.datasets?.ticketnotes;
        if (ctxNotes && ctxNotes.length > 0 && scope.nodeType !== 'Root') {
            return ctxNotes;
        }
        return FnGetSourceDataset('ticketnotes') || [];
    }, [
        selectedTicketBid,
        selectedTicketId,
        mappedApiNotes,
        smDataContext.datasets?.ticketnotes,
        scope.nodeType,
    ]);

    const handleSelectTicket = (ticket: ITicketDoc) => {
        setSelectedTicket(ticket);
    };

    const handleStatusChange = (ticket: ITicketDoc, newStatus: string) => {
        ticket.status = newStatus;
        ticket.lastupdated = new Date().toISOString();

        if (selectedTicket?.ticketid === ticket.ticketid) {
            setSelectedTicket({ ...ticket, status: newStatus, lastupdated: ticket.lastupdated });
        }

        if (smDataContext.datasets?.tickets) {
            const updated = smDataContext.datasets.tickets.map((t) =>
                t.ticketid === ticket.ticketid
                    ? { ...t, status: newStatus, lastupdated: ticket.lastupdated }
                    : t
            );
            smDataContext.updateDataset?.('tickets', updated);
        }
        void getTickets(ticketQueryFilters, ticketFetchByFilter);
    };

    const handleAddNote = useCallback(
        async (newNote: ITicketNoteDoc) => {
            if (!selectedTicketBid || !selectedTicketId) return;
            try {
                await createTicketNote({
                    bid: selectedTicketBid,
                    cid: newNote.cid || selectedTicket?.cid || '',
                    ticketid: selectedTicketId,
                    notes: newNote.notes,
                    filename: newNote.filename || '',
                    datecreated: newNote.datecreated || new Date().toISOString(),
                    monitor: false,
                    monitorupdated: new Date().toISOString(),
                });
                void getTicketNotes();
            } catch (err) {
                console.error('Failed to create ticket note in Firestore:', err);
            }
        },
        [selectedTicketBid, selectedTicketId, selectedTicket?.cid, createTicketNote, getTicketNotes]
    );

    return (
        <div className="nz-ticket-cards-pane-container" key={uniqueName}>
            <Splitter tabIndex={-1} className="nz-ticket-cards-pane-content">
                <SplitterPanel
                    tabIndex={-1}
                    size={45}
                    minSize={25}
                    className="nz-ticket-cards-left-panel"
                >
                    <TicketCardList
                        uniqueName={`${uniqueName}-card-list`}
                        tickets={sortedScopedTickets}
                        contacts={contacts}
                        purchasedSkus={purchasedSkus}
                        selectedTicketId={selectedTicket?.ticketid ?? null}
                        onSelectTicket={handleSelectTicket}
                        onSkuClick={onSkuClick}
                        onStatusChange={handleStatusChange}
                    />
                </SplitterPanel>
                <SplitterPanel
                    tabIndex={-1}
                    size={55}
                    minSize={25}
                    className="nz-ticket-cards-right-panel"
                >
                    <TicketNotesList
                        uniqueName={`${uniqueName}-notes`}
                        ticketId={selectedTicket?.ticketid ?? null}
                        ticket={selectedTicket}
                        ticketnotes={ticketnotes}
                        onAddNote={handleAddNote}
                    />
                </SplitterPanel>
            </Splitter>
        </div>
    );
};

export { TicketCardsPane };
export type { ITicketCardsPaneProps };
export default TicketCardsPane;
