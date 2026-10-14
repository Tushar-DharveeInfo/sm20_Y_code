import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { TicketCardList } from './TicketCardList';
import { TicketNotesList } from './TicketNotesList';
import type { ITicketDoc, IContactDoc, ITicketNoteDoc } from '../../../db/IDatasets';
import { ITreeNode } from '../../../shared/allinterface/tree/ITreeControl';
import { ILibraryTicketMode, filterTicketsByLibraryMode } from '../../appqa/allcommon/FnBuildTicketTree';
import { useSmDataContext } from '../../../shared/context/hooks/SmDataHooks';
import { useSelectedNodeContext } from '../../../shared/context/hooks/SelectedNodeHooks';
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks';
import { useCommonVariableContext } from '../../../shared/context/hooks/CommonVariableHooks';
import { useRmsContext } from '../../../shared/context/hooks/RmsHooks';
import { FnGetSourceDataset } from '../../../shared/allcommon/FnLoadSampleDatasets';
import { TicketsEnums, RmsEnums } from '../../../constants/Feature';
import { useBusinessTickets, useFirestore, useTicketNotes, type IFirestoreQueryFilter } from '@n20a/libfsdb';
import {
    loadFullTickets,
    getFullTicketsCached,
    updateTicketStatusInStore,
} from '../allcommon/TicketsDataStore';
import {
    filterTicketsByFeature,
    normalizeBidKey,
} from '../allcommon/FnFilterTicketTree';
import { isTicketInProcess } from '../../rms/allcommon/FnFilterRmsEqidTree';
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
        eqid: record.eqid ? String(record.eqid) : ((record as any).EQID ? String((record as any).EQID) : undefined),
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
        eqid: record.eqid ? String(record.eqid) : ((record as any).EQID ? String((record as any).EQID) : undefined),
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
    const rmsContext = useRmsContext();
    const commonVariableContext = useCommonVariableContext();
    const firestore = useFirestore();

    const isRmsEqid =
        featureId === RmsEnums.EQID ||
        featureId === '404';

    // Determine library mode: 'Open' vs 'InProgress'
    const effectiveMode: ILibraryTicketMode = useMemo(() => {
        if (propMode === 'InProgress') return 'InProgress';
        if (propMode === 'Open') return 'Open';
        if (featureId === TicketsEnums.ApprovedTickets || isRmsEqid) return 'InProgress';
        return 'Open';
    }, [propMode, featureId, isRmsEqid]);

    // Determine active tree node
    const candidateNodes = [
        selectedNode,
        smDataContext.selectedNode,
        selectedNodeContext?.selectedNode,
        selectedNodeContext?.selectedNodeExplorer,
        (selectedNodeContext?.selectedNodeExplorer as any)?.node,
    ];
    const isTicketNode = (node?: ITreeNode | null) =>
        Boolean(
            node && (
                String(node.NodeType || '').toLowerCase() === 'ticket' ||
                String(node.treetype || '').toLowerCase() === 'ticket' ||
                Boolean((node as any).ticketid)
            )
        );
    const activeNode =
        candidateNodes.find((n) => n && !isTicketNode(n)) ??
        selectedNode ??
        ({ NodeType: 'Root', key: 'root' } as ITreeNode);

    const activeNodeKey = activeNode?.key ?? activeNode?.NodeEntID ?? '';
    const activeNodeType = activeNode?.NodeType ?? '';
    const selBid = smDataContext.selection?.bid ?? '';
    const selCid = smDataContext.selection?.cid ?? '';

    // Resolve scope
    const scope = useMemo(() => {
        return resolveScopeFromNode(activeNode, smDataContext.selection);
    }, [activeNodeKey, activeNodeType, selBid, selCid]);

    const effectiveBid = useMemo(() => {
        return scope.bid ? String(scope.bid).trim() : '';
    }, [scope.bid]);

    const isApprovedTickets =
        featureId === TicketsEnums.ApprovedTickets ||
        isRmsEqid ||
        propMode === 'InProgress' ||
        effectiveMode === 'InProgress';

    const isRequestsReceived =
        !isApprovedTickets &&
        (featureId === TicketsEnums.RequestsReceived ||
            propMode === 'Open' ||
            effectiveMode === 'Open');

    // Step 1: Ensure full tickets data is loaded across all businesses
    useEffect(() => {
        void loadFullTickets(firestore);
        if (isRmsEqid && (!rmsContext?.eqid || rmsContext.eqid.length === 0) && rmsContext?.loadEqid) {
            void rmsContext.loadEqid();
        }
    }, [firestore, featureId, isRmsEqid, rmsContext]);

    const ticketQueryFilters = useMemo<IFirestoreQueryFilter[] | undefined>(() => {
        if (isApprovedTickets) {
            return [{ field: 'status', op: '==', value: 'InProgress' }];
        }
        if (isRequestsReceived) {
            return [{ field: 'status', op: '==', value: 'Open' }];
        }
        return undefined;
    }, [isApprovedTickets, isRequestsReceived]);

    const ticketFetchByFilter = useMemo(() => {
        if (!ticketQueryFilters || ticketQueryFilters.length === 0) return undefined;
        return {
            featurecmd: 'tickets',
            fileterjson: JSON.stringify(ticketQueryFilters),
        };
    }, [ticketQueryFilters]);

    // Call useBusinessTickets hook only if not in standard tickets feature
    const {
        tickets: apiTickets,
        getTickets,
    } = useBusinessTickets(effectiveBid);

    useEffect(() => {
        if (isRmsEqid && effectiveBid) {
            void getTickets(ticketQueryFilters, ticketFetchByFilter);
        }
    }, [isRmsEqid, effectiveBid, getTickets, ticketQueryFilters, ticketFetchByFilter]);

    const mappedApiTickets = useMemo<ITicketDoc[] | null>(() => {
        if (!effectiveBid || !Array.isArray(apiTickets)) {
            return null;
        }
        return apiTickets.map((r) => FnMapToTicketDoc(r, effectiveBid));
    }, [effectiveBid, apiTickets]);

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

    // Store version counter to trigger rawTickets recomputation on ticket updates
    const [ticketStoreVersion, setTicketStoreVersion] = useState(0);

    // Sourced tickets: uses full tickets cache (or scoped by business if selected)
    const rawTickets: ITicketDoc[] = useMemo(() => {
        const allTickets = getFullTicketsCached();
        if (effectiveBid) {
            const cleanBid = effectiveBid.trim().toLowerCase();
            const normBid = normalizeBidKey(cleanBid);
            return allTickets.filter((t) => {
                const tBid = String(t.bid || '').trim().toLowerCase();
                const tNormBid = normalizeBidKey(tBid);
                return tBid === cleanBid || tNormBid === normBid;
            });
        }
        return allTickets;
    }, [effectiveBid, ticketStoreVersion]);

    // Sourced contacts
    const contacts: IContactDoc[] = useMemo(() => {
        const ctxContacts = smDataContext.datasets?.contacts;
        if (ctxContacts && ctxContacts.length > 0) {
            return ctxContacts;
        }
        return FnGetSourceDataset('contacts') || [];
    }, [smDataContext.datasets?.contacts]);

    // Filter tickets by active feature (Requests Received = Open/Received; Approved Tickets = InProgress/Closed/etc.; RMS EQID = EQID match + In Process)
    const modeFilteredTickets = useMemo(() => {
        if (isRmsEqid) {
            const eqidDocs = rmsContext?.eqid ?? [];
            const eqidTicketIds = new Set<string>();
            for (const item of eqidDocs) {
                const tid = String(
                    item.ticketid ||
                    (item as any).TicketId ||
                    (item as any).TicketID ||
                    (item as any).ticketId ||
                    ''
                ).trim().toLowerCase();
                if (tid) eqidTicketIds.add(tid);
            }
            return rawTickets.filter((t) => {
                const tid = String(t.ticketid || (t as any).TicketId || (t as any).id || '').trim().toLowerCase();
                if (!tid || !eqidTicketIds.has(tid)) return false;
                return isTicketInProcess(t.status || (t as any).Status);
            });
        }
        if (featureId) {
            return filterTicketsByFeature(rawTickets, featureId);
        }
        return filterTicketsByLibraryMode(rawTickets, effectiveMode);
    }, [isRmsEqid, rmsContext?.eqid, rawTickets, featureId, effectiveMode]);

    // Scope tickets by selected node:
    // Root -> all businesses
    // Business -> all contacts of selected business
    // Contact -> selected contact of selected business
    const scopedTickets = useMemo(() => {
        if (scope.nodeType === 'Contact') {
            const cleanBid = (scope.bid || '').trim().toLowerCase();
            const normBid = normalizeBidKey(cleanBid);
            const cleanCid = (scope.cid || '').trim().toLowerCase();
            return modeFilteredTickets.filter((t) => {
                const tBid = (t.bid || '').trim().toLowerCase();
                const tNormBid = normalizeBidKey(tBid);
                const tCid = (t.cid || '').trim().toLowerCase();
                const bOk = cleanBid ? tBid === cleanBid || tNormBid === normBid : true;
                const cOk = cleanCid ? tCid === cleanCid : true;
                return bOk && cOk;
            });
        }
        if (scope.nodeType === 'Business' && scope.bid) {
            const cleanBid = (scope.bid || '').trim().toLowerCase();
            const normBid = normalizeBidKey(cleanBid);
            return modeFilteredTickets.filter((t) => {
                const tBid = (t.bid || '').trim().toLowerCase();
                const tNormBid = normalizeBidKey(tBid);
                return tBid === cleanBid || tNormBid === normBid;
            });
        }
        // Root: all tickets across all businesses
        return modeFilteredTickets;
    }, [modeFilteredTickets, scope.nodeType, scope.bid, scope.cid]);

    const sortedScopedTickets = useMemo(() => {
        return sortTicketsNewestFirst(scopedTickets);
    }, [scopedTickets]);

    // Selected ticket state
    const [selectedTicket, setSelectedTicket] = useState<ITicketDoc | null>(() => {
        const fromCtx =
            (selectedNodeContext?.selectedTicketCard as any) ||
            (rmsContext?.selectedTicketCard as any);
        if (fromCtx?.ticketid) {
            return fromCtx as ITicketDoc;
        }
        return null;
    });

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

            const existingSelection =
                prev ??
                (selectedNodeContextRef.current?.selectedTicketCard as any) ??
                (rmsContextRef.current?.selectedTicketCard as any);

            // Keep current selection if still present in sortedScopedTickets and matches current scope
            if (existingSelection && sortedScopedTickets.some((t) => t.ticketid === existingSelection.ticketid)) {
                if (!nodeChanged) {
                    return existingSelection;
                }
                const matchesScope =
                    (!scope.bid || existingSelection.bid === scope.bid) &&
                    (!scope.cid || existingSelection.cid === scope.cid);
                if (matchesScope) {
                    return existingSelection;
                }
            }

            // Always select first ticket when the selected tree node changes to a different scope
            if (nodeChanged) {
                return sortedScopedTickets[0];
            }
            // Keep current selection if still present in the list
            if (existingSelection && sortedScopedTickets.some((t) => t.ticketid === existingSelection.ticketid)) {
                return existingSelection;
            }
            // By default, select 1st ticket
            return sortedScopedTickets[0];
        });
    }, [sortedScopedTickets, currentNodeKey, scope.bid, scope.cid]);

    // Synchronize selected ticket with selectedNodeContext and rmsContext so sidebar tabs display the selected EQID
    const prevSyncedTicketIdRef = useRef<string | null>(null);
    const selectedNodeContextRef = useRef(selectedNodeContext);
    selectedNodeContextRef.current = selectedNodeContext;
    const rmsContextRef = useRef(rmsContext);
    rmsContextRef.current = rmsContext;
    const isRmsEqidRef = useRef(isRmsEqid);
    isRmsEqidRef.current = isRmsEqid;

    useEffect(() => {
        if (!isRmsEqid) {
            if (prevSyncedTicketIdRef.current !== null) {
                prevSyncedTicketIdRef.current = null;
                selectedNodeContextRef.current?.setSelectedTicketCard?.(null);
                rmsContextRef.current?.setSelectedTicketCard?.(null);
            }
            return;
        }

        const currentTicketId = selectedTicket?.ticketid ?? null;
        if (prevSyncedTicketIdRef.current === currentTicketId) {
            return;
        }
        prevSyncedTicketIdRef.current = currentTicketId;

        if (selectedTicket) {
            const matchingEqidRecord = (rmsContextRef.current?.eqid ?? []).find(
                (e: any) => e.ticketid && e.ticketid === selectedTicket.ticketid
            );
            const resolvedEqid = (selectedTicket as any).eqid || (selectedTicket as any).EQID || matchingEqidRecord?.EQID || matchingEqidRecord?.eqid || '';
            const ticketNode = {
                key: `ticket-${selectedTicket.ticketid}`,
                NodeEntID: selectedTicket.ticketid,
                Name: `${selectedTicket.mfg || 'Device'} ${selectedTicket.prodno || selectedTicket.ticketid}`,
                Label: `${selectedTicket.mfg || 'Device'} ${selectedTicket.prodno || selectedTicket.ticketid}`,
                NodeType: 'Ticket',
                treetype: 'Ticket',
                ticketid: selectedTicket.ticketid,
                eqid: resolvedEqid,
                EQID: resolvedEqid,
                ...selectedTicket,
            } as unknown as ITreeNode;
            selectedNodeContextRef.current?.setSelectedTicketCard?.(ticketNode);
            rmsContextRef.current?.setSelectedTicketCard?.(ticketNode);
        } else {
            selectedNodeContextRef.current?.setSelectedTicketCard?.(null);
            rmsContextRef.current?.setSelectedTicketCard?.(null);
        }
    }, [selectedTicket?.ticketid, isRmsEqid]);

    // Clear selected ticket card on component unmount
    useEffect(() => {
        return () => {
            if (isRmsEqidRef.current) {
                prevSyncedTicketIdRef.current = null;
                selectedNodeContextRef.current?.setSelectedTicketCard?.(null);
                rmsContextRef.current?.setSelectedTicketCard?.(null);
            }
        };
    }, []);

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

    const prevSyncedNotesTicketIdRef = useRef<string>('');
    useEffect(() => {
        if (selectedTicketBid && selectedTicketId && mappedApiNotes !== null) {
            const cacheKey = `${selectedTicketId}-${mappedApiNotes.length}`;
            if (prevSyncedNotesTicketIdRef.current === cacheKey) {
                return;
            }
            prevSyncedNotesTicketIdRef.current = cacheKey;
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

    const handleSelectTicket = useCallback((ticket: ITicketDoc) => {
        setSelectedTicket(ticket);
        if (isRmsEqid) {
            const matchingEqidRecord = (rmsContext?.eqid ?? []).find(
                (e: any) => e.ticketid && e.ticketid === ticket.ticketid
            );
            const resolvedEqid = (ticket as any).eqid || (ticket as any).EQID || matchingEqidRecord?.EQID || matchingEqidRecord?.eqid || '';
            const ticketNode = {
                key: `ticket-${ticket.ticketid}`,
                NodeEntID: ticket.ticketid,
                Name: `${ticket.mfg || 'Device'} ${ticket.prodno || ticket.ticketid}`,
                Label: `${ticket.mfg || 'Device'} ${ticket.prodno || ticket.ticketid}`,
                NodeType: 'Ticket',
                treetype: 'Ticket',
                ticketid: ticket.ticketid,
                eqid: resolvedEqid,
                EQID: resolvedEqid,
                ...ticket,
            } as unknown as ITreeNode;
            prevSyncedTicketIdRef.current = ticket.ticketid;
            selectedNodeContext?.setSelectedTicketCard?.(ticketNode);
            rmsContext?.setSelectedTicketCard?.(ticketNode);
        }
    }, [isRmsEqid, rmsContext?.eqid, selectedNodeContext, rmsContext]);

    const handleStatusChange = async (ticket: ITicketDoc, newStatus: string) => {
        const nowIso = new Date().toISOString();
        ticket.status = newStatus;
        ticket.lastupdated = nowIso;

        if (selectedTicket?.ticketid === ticket.ticketid) {
            const updated = { ...ticket, status: newStatus, lastupdated: nowIso };
            setSelectedTicket(updated);
            if (isRmsEqid) {
                const matchingEqidRecord = (rmsContext?.eqid ?? []).find(
                    (e: any) => e.ticketid && e.ticketid === ticket.ticketid
                );
                const resolvedEqid = (ticket as any).eqid || (ticket as any).EQID || matchingEqidRecord?.EQID || matchingEqidRecord?.eqid || '';
                const ticketNode = {
                    key: `ticket-${ticket.ticketid}`,
                    NodeEntID: ticket.ticketid,
                    Name: `${ticket.mfg || 'Device'} ${ticket.prodno || ticket.ticketid}`,
                    Label: `${ticket.mfg || 'Device'} ${ticket.prodno || ticket.ticketid}`,
                    NodeType: 'Ticket',
                    treetype: 'Ticket',
                    ticketid: ticket.ticketid,
                    eqid: resolvedEqid,
                    EQID: resolvedEqid,
                    ...updated,
                } as unknown as ITreeNode;
                selectedNodeContext?.setSelectedTicketCard?.(ticketNode);
                rmsContext?.setSelectedTicketCard?.(ticketNode);
            }
        }

        // 1. Update ticket in global tickets store
        updateTicketStatusInStore(ticket.ticketid, newStatus, nowIso);
        setTicketStoreVersion((v) => v + 1);

        // 2. Keep smDataContext.datasets.tickets in sync
        if (smDataContext.datasets?.tickets) {
            const updated = smDataContext.datasets.tickets.map((t) =>
                t.ticketid === ticket.ticketid
                    ? { ...t, status: newStatus, lastupdated: nowIso }
                    : t
            );
            smDataContext.updateDataset?.('tickets', updated);
        }

        const ticketId = String(ticket.ticketid || ((ticket as unknown as Record<string, unknown>).id as string) || '').trim();
        let bid = String(ticket.bid || '').trim();
        if (!bid && ticketId) {
            const m = ticketId.match(/bid[_-]?\d+/i);
            if (m) bid = m[0];
        }
        if (bid && /^\d+$/.test(bid)) {
            bid = `bid_${bid}`;
        }

        // 3. Single API call: update ticket document in Firestore
        if (bid && ticketId && firestore) {
            try {
                await firestore.updateDocument({
                    pathSegments: ['businesses', bid, 'tickets', ticketId],
                    data: { status: newStatus, lastupdated: nowIso },
                    allowedKeys: ['status', 'lastupdated'],
                });
            } catch (fsErr) {
                console.warn('Failed to update ticket document via firestore.updateDocument:', fsErr);
            }
        }

        // 4. Trigger BS tree reload (BS tree strictly depends on tickets)
        const targetFeatureId = String(featureId || TicketsEnums.RequestsReceived);
        commonVariableContext.setReloadTreeFor({
            featureId: targetFeatureId,
            entId: bid,
            timestamp: Date.now(),
        });
    };

    const handleAddNote = useCallback(
        async (newNote: ITicketNoteDoc) => {
            if (!selectedTicketBid || !selectedTicketId) return;
            try {
                const noteEqid = newNote.eqid || selectedTicket?.eqid || (selectedTicket as any)?.EQID || '';
                await createTicketNote({
                    bid: selectedTicketBid,
                    cid: newNote.cid || selectedTicket?.cid || '',
                    ticketid: selectedTicketId,
                    notes: newNote.notes,
                    filename: newNote.filename || '',
                    datecreated: newNote.datecreated || new Date().toISOString(),
                    monitor: false,
                    monitorupdated: new Date().toISOString(),
                    ...(noteEqid ? { eqid: noteEqid } : {}),
                });
                void getTicketNotes();
            } catch (err) {
                console.error('Failed to create ticket note in Firestore:', err);
            }
        },
        [selectedTicketBid, selectedTicketId, selectedTicket, createTicketNote, getTicketNotes]
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
