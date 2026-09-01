import { useEffect, useMemo, useState } from 'react'
import { Splitter, SplitterPanel } from 'primereact/splitter'
import TicketExplorerContainer, {
    type ILibraryBusinessScope,
    type ILibraryTicketMode,
} from './ticketexplorercontainer/TicketExplorerContainer'
import { ITreeNode } from '../../../shared/allinterface/tree/ITreeControl'
import type { ITicketDoc } from '../../../shared/allinterface/IDatasets'
import { TicketDetailPane } from './ticketexplorercontainer/TicketDetailPane'
import './LibraryTickets.css'
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp'
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu'

import { useSelectedNodeContext } from '../../../shared/context/hooks/SelectedNodeHooks'
import { useSmDataContext } from '../../../shared/context/hooks/SmDataHooks'

interface ILibraryTicketsContainer {
    uniqueName: string
    featureId: string
    headerText?: string
    /*received = not Accepted; accepted = Accepted only */
    libraryMode?: ILibraryTicketMode
    mode?: ILibraryTicketMode
    selectedNode?: ITreeNode
    treeData?: ITreeNode[]
    featureData?: IFeatureItem[]
    selectedFeatureData?: IMenuItem
}

function resolveBusinessScope(
    node?: ITreeNode,
    treeData?: ITreeNode[]
): ILibraryBusinessScope {
    if (!node || node.NodeType === 'Root') {
        return { nodeType: 'Root' }
    }

    if (node.NodeType === 'Contact') {
        const parentBid = String(node.bid ?? node.parentEntID ?? '')
        const parentBusiness = findNodeByKey(treeData ?? [], parentBid)
        return {
            nodeType: 'Contact',
            cid: String(node.cid ?? node.NodeEntID ?? node.key),
            contactName: String(node.Name ?? node.cname ?? node.contact ?? ''),
            bid: parentBid || null,
            businessName: parentBusiness
                ? String(parentBusiness.Name ?? parentBusiness.bname ?? '')
                : null,
        }
    }

    if (node.NodeType === 'Business') {
        return {
            nodeType: 'Business',
            bid: String(node.bid ?? node.NodeEntID ?? node.key),
            businessName: String(node.Name ?? node.bname ?? ''),
        }
    }

    return { nodeType: 'Root' }
}

function findNodeByKey(nodes: ITreeNode[], key: string): ITreeNode | null {
    for (const node of nodes) {
        if (String(node.key) === key || String(node.NodeEntID) === key) {
            return node
        }
        if (node.children?.length) {
            const found = findNodeByKey(node.children, key)
            if (found) return found
        }
    }
    return null
}

/**
 * Library Received / Approved tickets:
 * Pane 1 — ticket tree (My Requests style)
 * Pane 2 — placeholder for tickets component
 */
const LibraryTicketsContainer = (props: ILibraryTicketsContainer) => {
    const smDataContext = useSmDataContext()
    const selectedNodeContext = useSelectedNodeContext()
    const effectiveLibraryMode = props.libraryMode ?? props.mode ?? 'all'
    const effectiveSelectedNode =
        props.selectedNode ??
        smDataContext.selectedNode ??
        selectedNodeContext?.selectedNode ??
        selectedNodeContext?.selectedNodeExplorer?.node ??
        ({ NodeType: 'Root', key: 'root' } as ITreeNode)
    const effectiveTreeData = props.treeData ?? []

    const [businessScope, setBusinessScope] = useState<ILibraryBusinessScope>({
        nodeType: 'Root',
    })
    const [selectedTicket, setSelectedTicket] = useState<ITicketDoc | null>(null)

    useEffect(() => {
        const { bid, cid } = smDataContext.selection
        if (cid) {
            setBusinessScope({
                nodeType: 'Contact',
                bid: bid ?? null,
                cid,
            })
            return
        }
        if (bid) {
            setBusinessScope({
                nodeType: 'Business',
                bid,
            })
            return
        }
        setBusinessScope(resolveBusinessScope(effectiveSelectedNode, effectiveTreeData))
    }, [effectiveSelectedNode, effectiveTreeData, props.featureId, smDataContext.selection])

    const ticketKey = useMemo(
        () =>
            [
                effectiveLibraryMode,
                businessScope.nodeType,
                businessScope.bid ?? smDataContext.selection.bid ?? '',
                businessScope.cid ?? smDataContext.selection.cid ?? '',
            ].join('|'),
        [effectiveLibraryMode, businessScope, smDataContext.selection]
    )

    return (
        <div
            key={props.uniqueName}
            className="nz-library-tickets-container nz-w-100 nz-h-100"
        >
            <Splitter tabIndex={-1} className="nz-w-100 nz-h-100 nz-library-tickets-content">
                <SplitterPanel
                    tabIndex={-1}
                    size={32}
                    minSize={15}
                    className="nz-d-flex-column nz-pane-2"
                >
                    <TicketExplorerContainer
                        key={ticketKey}
                        uniqueName={`${props.uniqueName}-ticket-tree`}
                        headerText="Tickets"
                        featureId={props.featureId}
                        libraryMode={effectiveLibraryMode}
                        businessScope={businessScope}
                        showDetailPane={false}
                        hideHeader={true}
                        handleTicketSelect={setSelectedTicket}
                    />
                </SplitterPanel>
                <SplitterPanel
                    tabIndex={-1}
                    size={40}
                    minSize={20}
                    className="nz-d-flex-column nz-pane-3 nz-layout-with-sidebar-pane"
                >
                    <div className="nz-library-tickets-right-pane nz-w-100 nz-h-100">
                        <div className="nz-library-tickets-placeholder nz-w-100 nz-h-100">
                            <TicketDetailPane
                                uniqueName={`${props.uniqueName}-ticket-detail`}
                                ticket={selectedTicket}
                            />
                        </div>

                    </div>
                </SplitterPanel>
            </Splitter>

        </div>
    )
}

export { LibraryTicketsContainer }
export default LibraryTicketsContainer
