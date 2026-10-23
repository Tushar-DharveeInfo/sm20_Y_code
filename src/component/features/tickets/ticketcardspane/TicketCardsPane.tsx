import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { TicketCardList } from './TicketCardList';
import { TicketNotesList } from './TicketNotesList';
import { TicketDetailPane } from '../allcommon/TicketDetailPane';
import type { ITicketDoc, IContactDoc, ITicketNoteDoc } from '@n20a/libfsdb';
import { ITreeNode } from '../../../shared/allinterface/tree/ITreeControl';
import { ILibraryTicketMode, filterTicketsByLibraryMode } from '../../appqa/allcommon/FnBuildTicketTree';
import { useSmDataContext } from '../../../shared/context/hooks/SmDataHooks';
import { useSelectedNodeContext } from '../../../shared/context/hooks/SelectedNodeHooks';
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks';
import { useCommonVariableContext } from '../../../shared/context/hooks/CommonVariableHooks';
import { useRmsContext } from '../../../shared/context/hooks/RmsHooks';
import { useStatusBarContext } from '../../../shared/context/hooks/StatusBarHooks';
import { FnHideShowSaveIconForForm } from '../../../shared/allcommon/basic/FnHideShowSaveIconForForm';
import { TicketsEnums, RmsEnums } from '../../../constants/Feature';
import { useBusinessTickets, useFirestore, useTicketNotes, type IFirestoreQueryFilter } from '@n20a/libfsdb';
import {
    loadFullTickets,
    getFullTicketsCached,
    setFullTicketsCache,
    updateTicketStatusInStore,
    updateTicketInStore,
    addTicketToStore,
    removeTicketFromStore,
    generateClonedTicketId,
    isTicketDeleted,
} from '../allcommon/TicketsDataStore';
import { YesNoFormContainer } from '../../../shared/basic/yesnoformcontainer/YesNoFormContainer';
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
    const isDel = record.isdeleted ?? record.isDeleted ?? record.deleted ?? record.isDelete ?? record.isdelete ?? (record as any).is_deleted;
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
        status: String(record.status || (record as any).Status || ''),
        daterequested: formatTimestampOrDate(record.daterequested),
        datereleased: formatTimestampOrDate(record.datereleased),
        lastupdated: formatTimestampOrDate(record.lastupdated),
        eqid: record.eqid ? String(record.eqid) : ((record as any).EQID ? String((record as any).EQID) : undefined),
        isdeleted: isDel === true || isDel === 1 || isDel === '1' || isDel === 'true',
    } as unknown as ITicketDoc;
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
    const statusBarContext = useStatusBarContext();
    const firestore = useFirestore();

    const isRmsEqid =
        featureId === RmsEnums.EQIDByTicket ||
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
        void loadFullTickets(firestore, false, smDataContext.datasets?.businesses).then((loaded) => {
            if (loaded && loaded.length > 0) {
                setTicketStoreVersion((v) => v + 1);
            }
        });
        if (isRmsEqid && (!rmsContext?.eqid || rmsContext.eqid.length === 0) && rmsContext?.loadEqid) {
            void rmsContext.loadEqid();
        }
    }, [firestore, featureId, isRmsEqid, rmsContext, smDataContext.datasets?.businesses]);

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

    // Use useBusinessTickets hook to load tickets for the selected business
    const {
        tickets: apiTickets,
        getTickets,
        deleteTicket,
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

    useEffect(() => {
        if (effectiveBid && Array.isArray(apiTickets) && apiTickets.length > 0) {
            const mapped = apiTickets.map((r) => FnMapToTicketDoc(r, effectiveBid)).filter((t) => !isTicketDeleted(t));
            const currentCached = getFullTicketsCached();
            const cleanBid = effectiveBid.trim().toLowerCase();
            const normBid = normalizeBidKey(cleanBid);
            const otherTickets = currentCached.filter((t) => {
                const tBid = String(t.bid || '').trim().toLowerCase();
                const tNormBid = normalizeBidKey(tBid);
                return tBid !== cleanBid && tNormBid !== normBid;
            });
            setFullTicketsCache([...otherTickets, ...mapped]);
            setTicketStoreVersion((v) => v + 1);
        }
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
    const [deletedTicketIds, setDeletedTicketIds] = useState<Set<string>>(new Set());

    // Sourced tickets: uses full tickets cache (or scoped by business if selected)
    const rawTickets: ITicketDoc[] = useMemo(() => {
        const isNotDeleted = (t: ITicketDoc) => {
            const tid = String(t.ticketid || (t as any).id || '').trim().toLowerCase();
            if (deletedTicketIds.has(tid)) return false;
            return !isTicketDeleted(t);
        };

        let baseTickets: ITicketDoc[] = [];
        if (effectiveBid && mappedApiTickets && mappedApiTickets.length > 0) {
            const apiNonDeleted = mappedApiTickets.filter(isNotDeleted);
            if (apiNonDeleted.length > 0) {
                baseTickets = apiNonDeleted;
            } else {
                baseTickets = [];
            }
        } else {
            const allTickets = getFullTicketsCached();
            baseTickets = allTickets.filter(isNotDeleted);
        }

        if (effectiveBid) {
            const cleanBid = effectiveBid.trim().toLowerCase();
            const normBid = normalizeBidKey(cleanBid);
            return baseTickets.filter((t) => {
                const tBid = String(t.bid || '').trim().toLowerCase();
                const tNormBid = normalizeBidKey(tBid);
                return tBid === cleanBid || tNormBid === normBid;
            });
        }
        return baseTickets;
    }, [effectiveBid, ticketStoreVersion, mappedApiTickets, deletedTicketIds]);

    // Sourced contacts
    const contacts: IContactDoc[] = useMemo(() => {
        const ctxContacts = smDataContext.datasets?.contacts;
        if (ctxContacts && ctxContacts.length > 0) {
            return ctxContacts;
        }
        return [];
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
        const isNotDeleted = (t: ITicketDoc) => {
            const tid = String(t.ticketid || (t as any).id || '').trim().toLowerCase();
            if (deletedTicketIds.has(tid)) return false;
            return !isTicketDeleted(t);
        };
        const nonDeletedModeTickets = modeFilteredTickets.filter(isNotDeleted);

        if (scope.nodeType === 'Contact') {
            const cleanBid = (scope.bid || '').trim().toLowerCase();
            const normBid = normalizeBidKey(cleanBid);
            const cleanCid = (scope.cid || '').trim().toLowerCase();
            return nonDeletedModeTickets.filter((t) => {
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
            return nonDeletedModeTickets.filter((t) => {
                const tBid = (t.bid || '').trim().toLowerCase();
                const tNormBid = normalizeBidKey(tBid);
                return tBid === cleanBid || tNormBid === normBid;
            });
        }
        // Root: all tickets across all businesses
        return nonDeletedModeTickets;
    }, [modeFilteredTickets, scope.nodeType, scope.bid, scope.cid, deletedTicketIds]);

    const sortedScopedTickets = useMemo(() => {
        const isNotDeleted = (t: ITicketDoc) => {
            const tid = String(t.ticketid || (t as any).id || '').trim().toLowerCase();
            if (deletedTicketIds.has(tid)) return false;
            return !isTicketDeleted(t);
        };
        return sortTicketsNewestFirst(scopedTickets.filter(isNotDeleted));
    }, [scopedTickets, deletedTicketIds]);

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

    // Active overlay tab for right-side pane: 'Notes' or 'Ticket Details'
    const [activeOverlayTab, setActiveOverlayTab] = useState<'Ticket Details' | 'Notes'>('Ticket Details');

    // Split ticket confirmation dialog state
    const [splitDialog, setSplitDialog] = useState<{
        isOpen: boolean;
        dialogTitle: string;
        message: string;
        showOkButton?: boolean;
        targetTicket?: ITicketDoc;
    }>({
        isOpen: false,
        dialogTitle: 'Confirm Split Ticket',
        message: '',
        showOkButton: false,
    });

    // Delete ticket confirmation dialog state
    const [deleteDialog, setDeleteDialog] = useState<{
        isOpen: boolean;
        dialogTitle: string;
        message: string;
        showOkButton?: boolean;
        targetTicket?: ITicketDoc;
    }>({
        isOpen: false,
        dialogTitle: 'Confirm Delete Ticket',
        message: '',
        showOkButton: false,
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

        const matchingEqidRecord = (rmsContext?.eqid ?? []).find(
            (e: any) =>
                (e.ticketid && String(e.ticketid).trim().toLowerCase() === String(selectedTicket?.ticketid || '').trim().toLowerCase()) ||
                (e.id && String(e.id).trim().toLowerCase() === String((selectedTicket as any)?.eqid || (selectedTicket as any)?.EQID || '').trim().toLowerCase())
        );
        const resolvedEqid =
            (selectedTicket as any)?.eqid ||
            (selectedTicket as any)?.EQID ||
            (selectedTicket as any)?.eqId ||
            matchingEqidRecord?.EQID ||
            '';

        const syncKey = selectedTicket ? `${selectedTicket.ticketid}__${resolvedEqid}` : null;
        if (prevSyncedTicketIdRef.current === syncKey) {
            return;
        }
        prevSyncedTicketIdRef.current = syncKey;

        if (selectedTicket) {
            const ticketNode = {
                ...selectedTicket,
                key: `ticket-${selectedTicket.ticketid}`,
                NodeEntID: selectedTicket.ticketid,
                Name: `${selectedTicket.mfg || 'Device'} ${selectedTicket.prodno || selectedTicket.ticketid}`,
                Label: `${selectedTicket.mfg || 'Device'} ${selectedTicket.prodno || selectedTicket.ticketid}`,
                NodeType: 'Ticket',
                treetype: 'Ticket',
                ticketid: selectedTicket.ticketid,
                ...(resolvedEqid ? { eqid: resolvedEqid, EQID: resolvedEqid } : {}),
            } as unknown as ITreeNode;
            selectedNodeContextRef.current?.setSelectedTicketCard?.(ticketNode);
            rmsContextRef.current?.setSelectedTicketCard?.(ticketNode);
        } else {
            selectedNodeContextRef.current?.setSelectedTicketCard?.(null);
            rmsContextRef.current?.setSelectedTicketCard?.(null);
        }
    }, [selectedTicket?.ticketid, isRmsEqid, rmsContext?.eqid]);

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
        return [];
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
                (e: any) =>
                    (e.ticketid && String(e.ticketid).trim().toLowerCase() === String(ticket.ticketid).trim().toLowerCase()) ||
                    (e.id && String(e.id).trim().toLowerCase() === String((ticket as any)?.eqid || (ticket as any)?.EQID || '').trim().toLowerCase())
            );
            const resolvedEqid =
                (ticket as any)?.eqid ||
                (ticket as any)?.EQID ||
                (ticket as any)?.eqId ||
                matchingEqidRecord?.EQID ||
                '';
            const ticketNode = {
                ...ticket,
                key: `ticket-${ticket.ticketid}`,
                NodeEntID: ticket.ticketid,
                Name: `${ticket.mfg || 'Device'} ${ticket.prodno || ticket.ticketid}`,
                Label: `${ticket.mfg || 'Device'} ${ticket.prodno || ticket.ticketid}`,
                NodeType: 'Ticket',
                treetype: 'Ticket',
                ticketid: ticket.ticketid,
                ...(resolvedEqid ? { eqid: resolvedEqid, EQID: resolvedEqid } : {}),
            } as unknown as ITreeNode;
            prevSyncedTicketIdRef.current = `${ticket.ticketid}__${resolvedEqid}`;
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
                const resolvedEqid = (ticket as any).eqid || (ticket as any).EQID || matchingEqidRecord?.EQID || '';
                const ticketNode = {
                    key: `ticket-${ticket.ticketid}`,
                    NodeEntID: ticket.ticketid,
                    Name: `${ticket.mfg || 'Device'} ${ticket.prodno || ticket.ticketid}`,
                    Label: `${ticket.mfg || 'Device'} ${ticket.prodno || ticket.ticketid}`,
                    NodeType: 'Ticket',
                    treetype: 'Ticket',
                    EQID: resolvedEqid,
                    ...updated,
                    ticketid: ticket.ticketid,
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

    const handleSaveTicket = useCallback(
        async (ticketId: string, updates: Partial<ITicketDoc>) => {
            if (!ticketId) return;
            statusBarContext?.setIsLoading?.(true);
            const nowIso = new Date().toISOString();

            // Strictly preserve the existing ticket status so it never changes during detail update
            const allCached = getFullTicketsCached();
            const existingInStore = allCached.find(
                (t) => String(t.ticketid || (t as any).id || '').trim().toLowerCase() === ticketId.trim().toLowerCase()
            );
            const preservedStatus = selectedTicket?.status || existingInStore?.status || updates.status || '';

            const payloadUpdates: Partial<ITicketDoc> = {
                ...updates,
                ...(preservedStatus ? { status: preservedStatus } : {}),
                lastupdated: nowIso,
                monitorupdated: nowIso,
            };

            let bid = String(selectedTicket?.bid || existingInStore?.bid || '').trim();
            if (!bid && ticketId) {
                const m = ticketId.match(/bid[_-]?\d+/i);
                if (m) bid = m[0];
            }
            if (bid && /^\d+$/.test(bid)) {
                bid = `bid_${bid}`;
            }

            try {
                // 1. Single API call: update ticket document in Firestore if available
                if (bid && ticketId && firestore) {
                    try {
                        const firestorePayload: Record<string, unknown> = {
                            lastupdated: nowIso,
                            monitorupdated: nowIso,
                        };
                        if (payloadUpdates.mfg !== undefined) firestorePayload.mfg = payloadUpdates.mfg;
                        if (payloadUpdates.eqtype !== undefined) firestorePayload.eqtype = payloadUpdates.eqtype;
                        if (payloadUpdates.prodno !== undefined) firestorePayload.prodno = payloadUpdates.prodno;
                        if (payloadUpdates.moreinfo !== undefined) firestorePayload.moreinfo = payloadUpdates.moreinfo;
                        if (preservedStatus) firestorePayload.status = preservedStatus;

                        await firestore.updateDocument({
                            pathSegments: ['businesses', bid, 'tickets', ticketId],
                            data: firestorePayload,
                        });
                    } catch (fsErr) {
                        console.warn('Failed to update ticket document via firestore.updateDocument:', fsErr);
                    }
                }

                // 2. Hide save icon on form
                FnHideShowSaveIconForForm('hide');

                // 3. Put activity log
                try {
                    const logCid = selectedTicket?.cid || (mainAppContext?.authSession as any)?.cid || 'User';
                    await mainAppContext?.createActivityLog?.(
                        `${logCid} of ${bid || 'business'} updated ticket ${ticketId} successfully.`
                    );
                } catch (logErr) {
                    console.error('TicketCardsPane: createActivityLog failed', logErr);
                }

                // 4. Update local state
                setSelectedTicket((prev) => {
                    if (prev && (prev.ticketid === ticketId || (prev as any).id === ticketId)) {
                        const updated = {
                            ...prev,
                            ...payloadUpdates,
                            status: preservedStatus || prev.status,
                        };
                        if (isRmsEqid) {
                            const matchingEqidRecord = (rmsContext?.eqid ?? []).find(
                                (e: any) => e.ticketid && e.ticketid === ticketId
                            );
                            const resolvedEqid = (updated as any).eqid || (updated as any).EQID || matchingEqidRecord?.EQID || '';
                            const ticketNode = {
                                key: `ticket-${ticketId}`,
                                NodeEntID: ticketId,
                                Name: `${updated.mfg || 'Device'} ${updated.prodno || ticketId}`,
                                Label: `${updated.mfg || 'Device'} ${updated.prodno || ticketId}`,
                                NodeType: 'Ticket',
                                treetype: 'Ticket',
                                EQID: resolvedEqid,
                                ...updated,
                                ticketid: ticketId,
                                status: preservedStatus || updated.status,
                            } as unknown as ITreeNode;
                            selectedNodeContext?.setSelectedTicketCard?.(ticketNode);
                            rmsContext?.setSelectedTicketCard?.(ticketNode);
                        }
                        return updated;
                    }
                    return prev;
                });

                // 5. Update ticket in global tickets store
                updateTicketInStore(ticketId, {
                    ...payloadUpdates,
                    ...(preservedStatus ? { status: preservedStatus } : {}),
                });
                setTicketStoreVersion((v) => v + 1);

                // 6. Keep smDataContext.datasets.tickets in sync
                if (smDataContext.datasets?.tickets) {
                    const updatedList = smDataContext.datasets.tickets.map((t) =>
                        t.ticketid === ticketId
                            ? { ...t, ...payloadUpdates, status: preservedStatus || t.status }
                            : t
                    );
                    smDataContext.updateDataset?.('tickets', updatedList);
                }

                // 7. Trigger tree reload while strictly remembering the selected node bid and cid
                const targetFeatureId = String(featureId || TicketsEnums.RequestsReceived);
                const currentBid = scope.bid ? String(scope.bid).trim() : bid;
                const currentCid = scope.nodeType === 'Contact' && scope.cid ? String(scope.cid).trim() : undefined;
                commonVariableContext.setReloadTreeFor({
                    featureId: targetFeatureId,
                    entId: currentCid || currentBid,
                    dropNodeEntId: currentBid,
                    timestamp: Date.now(),
                });
            } catch (err) {
                console.error('TicketCardsPane: Error saving ticket:', err);
            } finally {
                statusBarContext?.setIsLoading?.(false);
            }
        },
        [
            selectedTicket,
            firestore,
            mainAppContext,
            isRmsEqid,
            rmsContext,
            selectedNodeContext,
            smDataContext,
            featureId,
            commonVariableContext,
            statusBarContext,
        ]
    );

    const handlePerformSplit = useCallback(
        async (ticket: ITicketDoc) => {
            statusBarContext?.setIsLoading?.(true);
            statusBarContext?.setLoadingLabel?.('Splitting ticket...');
            try {
                const nowIso = new Date().toISOString();
                let bid = String(ticket.bid || '').trim();
                if (!bid && ticket.ticketid) {
                    const m = ticket.ticketid.match(/bid[_-]?\d+/i);
                    if (m) bid = m[0];
                }
                if (bid && /^\d+$/.test(bid)) {
                    bid = `bid_${bid}`;
                }

                const allCached = getFullTicketsCached();
                const newTicketId = generateClonedTicketId(ticket.ticketid, allCached);

                const clonedTicket: ITicketDoc = {
                    ...ticket,
                    ticketid: newTicketId,
                    bid: bid || ticket.bid,
                    status: ticket.status, // Strictly maintain the exact same status
                    daterequested: nowIso,
                    lastupdated: nowIso,
                    monitorupdated: nowIso,
                    monitor: false,
                };

                // 1. Single API call: upsert cloned ticket document in Firestore if available
                if (bid && newTicketId && firestore) {
                    try {
                        await firestore.upsertDocument({
                            pathSegments: ['businesses', bid, 'tickets', newTicketId],
                            data: clonedTicket,
                        });
                    } catch (fsErr) {
                        console.warn('Failed to upsert cloned ticket to Firestore:', fsErr);
                    }
                }

                // 2. Add to global store
                addTicketToStore(clonedTicket);
                setTicketStoreVersion((v) => v + 1);

                // 3. Keep smDataContext.datasets.tickets in sync
                if (smDataContext.datasets?.tickets) {
                    smDataContext.updateDataset?.('tickets', [clonedTicket, ...smDataContext.datasets.tickets]);
                }

                // 4. Put activity log
                const logCid = ticket.cid || (mainAppContext?.authSession as any)?.cid || 'User';
                const logMsg = `${logCid} of ${bid || 'business'} split ticket ${ticket.ticketid} to create ${newTicketId}.`;
                try {
                    await mainAppContext?.createActivityLog?.(logMsg);
                } catch (logErr) {
                    console.error('TicketCardsPane: createActivityLog failed', logErr);
                }

                // 5. Select new ticket
                setSelectedTicket(clonedTicket);
                if (isRmsEqid) {
                    const matchingEqidRecord = (rmsContext?.eqid ?? []).find(
                        (e: any) => e.ticketid && e.ticketid === ticket.ticketid
                    );
                    const resolvedEqid = (clonedTicket as any).eqid || (clonedTicket as any).EQID || matchingEqidRecord?.EQID || '';
                    const ticketNode = {
                        key: `ticket-${newTicketId}`,
                        NodeEntID: newTicketId,
                        Name: `${clonedTicket.mfg || 'Device'} ${clonedTicket.prodno || newTicketId}`,
                        Label: `${clonedTicket.mfg || 'Device'} ${clonedTicket.prodno || newTicketId}`,
                        NodeType: 'Ticket',
                        treetype: 'Ticket',
                        EQID: resolvedEqid,
                        ...clonedTicket,
                        ticketid: newTicketId,
                        status: clonedTicket.status,
                    } as unknown as ITreeNode;
                    selectedNodeContext?.setSelectedTicketCard?.(ticketNode);
                    rmsContext?.setSelectedTicketCard?.(ticketNode);
                }

                // 6. Trigger tree reload while strictly remembering the selected node bid and cid
                const targetFeatureId = String(featureId || TicketsEnums.RequestsReceived);
                const currentBid = scope.bid ? String(scope.bid).trim() : bid;
                const currentCid = scope.nodeType === 'Contact' && scope.cid ? String(scope.cid).trim() : undefined;
                commonVariableContext.setReloadTreeFor({
                    featureId: targetFeatureId,
                    entId: currentCid || currentBid,
                    dropNodeEntId: currentBid,
                    timestamp: Date.now(),
                });

                // 7. Show success confirmation message popup with OK button
                setSplitDialog({
                    isOpen: true,
                    dialogTitle: 'Split Ticket',
                    message: `Ticket "${ticket.ticketid}" was successfully split into "${newTicketId}".`,
                    showOkButton: true,
                    targetTicket: undefined,
                });
            } catch (err) {
                console.error('TicketCardsPane: Error splitting ticket:', err);
                setSplitDialog({
                    isOpen: true,
                    dialogTitle: 'Error',
                    message: 'Failed to split ticket. Please try again.',
                    showOkButton: true,
                    targetTicket: undefined,
                });
            } finally {
                statusBarContext?.setIsLoading?.(false);
                statusBarContext?.setLoadingLabel?.(undefined);
            }
        },
        [
            firestore,
            mainAppContext,
            isRmsEqid,
            rmsContext,
            selectedNodeContext,
            smDataContext,
            featureId,
            commonVariableContext,
            statusBarContext,
        ]
    );

    const handleDeleteTicketClick = useCallback((ticket: ITicketDoc) => {
        setDeleteDialog({
            isOpen: true,
            dialogTitle: 'Confirm Delete Ticket',
            message: `Are you sure you want to delete ticket "${ticket.ticketid}"?`,
            showOkButton: false,
            targetTicket: ticket,
        });
    }, []);

    const handlePerformDelete = useCallback(
        async (ticket: ITicketDoc) => {
            const ticketId = ticket.ticketid;
            if (!ticketId) return;

            // Immediately mark as deleted locally
            setDeletedTicketIds((prev) => {
                const next = new Set(prev);
                next.add(ticketId.trim().toLowerCase());
                return next;
            });

            statusBarContext?.setIsLoading?.(true);
            statusBarContext?.setLoadingLabel?.('Deleting ticket...');
            try {
                let bid = String(ticket.bid || '').trim();
                if (!bid && ticket.ticketid) {
                    const m = ticket.ticketid.match(/bid[_-]?\d+/i);
                    if (m) bid = m[0];
                }
                if (bid && /^\d+$/.test(bid)) {
                    bid = `bid_${bid}`;
                }

                // 1. Delete document from Firestore if available
                if (bid && ticketId && firestore) {
                    try {
                        await firestore.deleteDocument({
                            pathSegments: ['businesses', bid, 'tickets', ticketId],
                        });
                    } catch (fsErr) {
                        console.warn('Failed to delete ticket document from Firestore:', fsErr);
                    }
                    try {
                        await firestore.updateDocument({
                            pathSegments: ['businesses', bid, 'tickets', ticketId],
                            data: {
                                status: 'Deleted',
                                isdeleted: true,
                                lastupdated: new Date().toISOString(),
                            },
                        });
                    } catch {
                        // ignore if already deleted
                    }
                }

                // 2. Remove from global tickets store
                removeTicketFromStore(ticketId);
                setTicketStoreVersion((v) => v + 1);

                // 3. Keep smDataContext.datasets.tickets in sync
                if (smDataContext.datasets?.tickets) {
                    const updated = smDataContext.datasets.tickets.filter(
                        (t) => String(t.ticketid || (t as any).id || '').trim().toLowerCase() !== ticketId.trim().toLowerCase()
                    );
                    smDataContext.updateDataset?.('tickets', updated);
                }

                // 4. Also call deleteTicket from useBusinessTickets hook if available
                if (typeof deleteTicket === 'function') {
                    try {
                        await deleteTicket(ticketId);
                    } catch { }
                }

                // 4. Log activity
                try {
                    const logCid = ticket.cid || (mainAppContext?.authSession as any)?.cid || 'User';
                    await mainAppContext?.createActivityLog?.(
                        `${logCid} of ${bid || 'business'} deleted ticket ${ticketId} successfully.`
                    );
                } catch (logErr) {
                    console.error('TicketCardsPane: createActivityLog failed', logErr);
                }

                // 5. Update selection if currently selected ticket is the one deleted
                setSelectedTicket((prev) => {
                    const prevId = String(prev?.ticketid || (prev as any)?.id || '').trim().toLowerCase();
                    if (prevId === ticketId.trim().toLowerCase()) {
                        const remaining = sortedScopedTickets.filter(
                            (t) => String(t.ticketid || (t as any).id || '').trim().toLowerCase() !== ticketId.trim().toLowerCase()
                        );
                        const nextTicket = remaining.length > 0 ? remaining[0] : null;
                        if (isRmsEqid) {
                            if (nextTicket) {
                                const matchingEqidRecord = (rmsContext?.eqid ?? []).find(
                                    (e: any) => e.ticketid && e.ticketid === nextTicket.ticketid
                                );
                                const resolvedEqid = (nextTicket as any).eqid || (nextTicket as any).EQID || matchingEqidRecord?.EQID || matchingEqidRecord?.eqid || '';
                                const ticketNode = {
                                    key: `ticket-${nextTicket.ticketid}`,
                                    NodeEntID: nextTicket.ticketid,
                                    Name: `${nextTicket.mfg || 'Device'} ${nextTicket.prodno || nextTicket.ticketid}`,
                                    Label: `${nextTicket.mfg || 'Device'} ${nextTicket.prodno || nextTicket.ticketid}`,
                                    NodeType: 'Ticket',
                                    treetype: 'Ticket',
                                    ticketid: nextTicket.ticketid,
                                    eqid: resolvedEqid,
                                    EQID: resolvedEqid,
                                    ...nextTicket,
                                } as unknown as ITreeNode;
                                selectedNodeContext?.setSelectedTicketCard?.(ticketNode);
                                rmsContext?.setSelectedTicketCard?.(ticketNode);
                            } else {
                                selectedNodeContext?.setSelectedTicketCard?.(null);
                                rmsContext?.setSelectedTicketCard?.(null);
                            }
                        }
                        return nextTicket;
                    }
                    return prev;
                });

                // 6. Trigger tree reload while strictly remembering the selected node bid and cid
                const targetFeatureId = String(featureId || TicketsEnums.RequestsReceived);
                const currentBid = scope.bid ? String(scope.bid).trim() : bid;
                const currentCid = scope.nodeType === 'Contact' && scope.cid ? String(scope.cid).trim() : undefined;
                commonVariableContext.setReloadTreeFor({
                    featureId: targetFeatureId,
                    entId: currentCid || currentBid,
                    dropNodeEntId: currentBid,
                    timestamp: Date.now(),
                });

                setDeleteDialog((prev) => ({ ...prev, isOpen: false, targetTicket: undefined }));
            } catch (err) {
                console.error('TicketCardsPane: Error deleting ticket:', err);
                setDeleteDialog({
                    isOpen: true,
                    dialogTitle: 'Error',
                    message: 'Failed to delete ticket. Please try again.',
                    showOkButton: true,
                    targetTicket: undefined,
                });
            } finally {
                statusBarContext?.setIsLoading?.(false);
                statusBarContext?.setLoadingLabel?.(undefined);
            }
        },
        [
            firestore,
            mainAppContext,
            isRmsEqid,
            rmsContext,
            selectedNodeContext,
            smDataContext,
            sortedScopedTickets,
            featureId,
            commonVariableContext,
            statusBarContext,
        ]
    );

    const handleDialogDeleteYes = useCallback(() => {
        const target = deleteDialog.targetTicket;
        if (target) {
            void handlePerformDelete(target);
        } else {
            setDeleteDialog((prev) => ({ ...prev, isOpen: false }));
        }
    }, [deleteDialog.targetTicket, handlePerformDelete]);

    const handleDialogDeleteNo = useCallback(() => {
        setDeleteDialog((prev) => ({ ...prev, isOpen: false }));
    }, []);

    const handleDialogDeleteOk = useCallback(() => {
        setDeleteDialog((prev) => ({ ...prev, isOpen: false }));
    }, []);

    const handleSplitTicketClick = useCallback((ticket: ITicketDoc) => {
        setSplitDialog({
            isOpen: true,
            dialogTitle: 'Confirm Split Ticket',
            message: `Are you sure you want to split ticket "${ticket.ticketid}"?`,
            showOkButton: false,
            targetTicket: ticket,
        });
    }, []);

    const handleDialogYes = useCallback(() => {
        const target = splitDialog.targetTicket;
        if (target) {
            void handlePerformSplit(target);
        } else {
            setSplitDialog((prev) => ({ ...prev, isOpen: false }));
        }
    }, [splitDialog.targetTicket, handlePerformSplit]);

    const handleDialogNo = useCallback(() => {
        setSplitDialog((prev) => ({ ...prev, isOpen: false }));
    }, []);

    const handleDialogOk = useCallback(() => {
        setSplitDialog((prev) => ({ ...prev, isOpen: false }));
    }, []);

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
                        onSplitTicket={handleSplitTicketClick}
                        onDeleteTicket={handleDeleteTicketClick}
                        activeOverlayTab={activeOverlayTab}
                        onSelectOverlayTab={setActiveOverlayTab}
                    />
                </SplitterPanel>
                <SplitterPanel
                    tabIndex={-1}
                    size={55}
                    minSize={25}
                    className="nz-ticket-cards-right-panel"
                >
                    {activeOverlayTab === 'Notes' ? (
                        <TicketNotesList
                            uniqueName={`${uniqueName}-notes`}
                            ticketId={selectedTicket?.ticketid ?? null}
                            ticket={selectedTicket}
                            ticketnotes={ticketnotes}
                            onAddNote={handleAddNote}
                        />
                    ) : (
                        <TicketDetailPane
                            uniqueName={`${uniqueName}-ticket-detail`}
                            ticket={selectedTicket}
                            onSaveTicket={handleSaveTicket}
                        />
                    )}
                </SplitterPanel>
            </Splitter>

            {splitDialog.isOpen && (
                <YesNoFormContainer
                    uniqueName={`${uniqueName}-split-dialog`}
                    isOpen={splitDialog.isOpen}
                    dialogTitle={splitDialog.dialogTitle}
                    message={splitDialog.message}
                    showOkButton={splitDialog.showOkButton}
                    handleYesButtonClick={handleDialogYes}
                    handleNoButtonClick={handleDialogNo}
                    handleOkButtonClick={handleDialogOk}
                />
            )}

            {deleteDialog.isOpen && (
                <YesNoFormContainer
                    uniqueName={`${uniqueName}-delete-dialog`}
                    isOpen={deleteDialog.isOpen}
                    dialogTitle={deleteDialog.dialogTitle}
                    message={deleteDialog.message}
                    showOkButton={deleteDialog.showOkButton}
                    handleYesButtonClick={handleDialogDeleteYes}
                    handleNoButtonClick={handleDialogDeleteNo}
                    handleOkButtonClick={handleDialogDeleteOk}
                />
            )}
        </div>
    );
};

export { TicketCardsPane };
export type { ITicketCardsPaneProps };
export default TicketCardsPane;
