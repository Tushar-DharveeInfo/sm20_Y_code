import React, { useMemo, useState, useEffect } from 'react';
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
        if (featureId === TicketsEnums.ApprovedTickets || featureId === '312') return 'accepted';
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

    // Sourced tickets
    const rawTickets: ITicketDoc[] = useMemo(() => {
        const ctxTickets = smDataContext.datasets?.tickets;
        if (ctxTickets && ctxTickets.length > 0 && scope.nodeType !== 'Root') {
            return ctxTickets;
        }
        return FnGetSourceDataset('tickets') || [];
    }, [smDataContext.datasets?.tickets, scope.nodeType]);

    // Sourced contacts
    const contacts: IContactDoc[] = useMemo(() => {
        const ctxContacts = smDataContext.datasets?.contacts;
        if (ctxContacts && ctxContacts.length > 0) {
            return ctxContacts;
        }
        return FnGetSourceDataset('contacts') || [];
    }, [smDataContext.datasets?.contacts]);


    // Sourced ticket notes
    const ticketnotes: ITicketNoteDoc[] = useMemo(() => {
        const ctxNotes = smDataContext.datasets?.ticketnotes;
        if (ctxNotes && ctxNotes.length > 0 && scope.nodeType !== 'Root') {
            return ctxNotes;
        }
        return FnGetSourceDataset('ticketnotes') || [];
    }, [smDataContext.datasets?.ticketnotes, scope.nodeType]);

    // Filter tickets by library mode ('received' vs 'accepted')
    const modeFilteredTickets = useMemo(() => {
        return filterTicketsByLibraryMode(rawTickets, effectiveMode);
    }, [rawTickets, effectiveMode]);

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

    // Selected ticket state
    const [selectedTicket, setSelectedTicket] = useState<ITicketDoc | null>(null);

    // Auto-select first ticket when scoped list changes or maintain current if still present
    useEffect(() => {
        setSelectedTicket((prev) => {
            if (scopedTickets.length === 0) return null;
            if (prev && scopedTickets.some((t) => t.ticketid === prev.ticketid)) {
                return prev;
            }
            return scopedTickets[0];
        });
    }, [scopedTickets]);

    const handleSelectTicket = (ticket: ITicketDoc) => {
        setSelectedTicket(ticket);
    };


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
                        tickets={scopedTickets}
                        contacts={contacts}
                        purchasedSkus={purchasedSkus}
                        selectedTicketId={selectedTicket?.ticketid ?? null}
                        onSelectTicket={handleSelectTicket}
                        onSkuClick={onSkuClick}
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
                    />
                </SplitterPanel>
            </Splitter>
        </div>
    );
};

export { TicketCardsPane };
export type { ITicketCardsPaneProps };
export default TicketCardsPane;
