import { useEffect, useMemo, useState } from 'react'
import { Splitter, SplitterPanel } from 'primereact/splitter'
import TicketExplorerContainer, {
    type ILibraryBusinessScope,
    type ILibraryTicketMode,
} from '../../../shared/ticketexplorercontainer/TicketExplorerContainer'
import { ITreeNode } from '../../../shared/allinterface/tree/ITreeControl'
import type { ITicket } from '../../../shared/allinterface/tree/ITicket'
import { TicketDetailPane } from '../../../shared/ticketexplorercontainer/TicketDetailPane'
import '../allcss/LibraryTickets.css'

interface ILibraryTicketsContainer {
    uniqueName: string
    featureId: string
    headerText?: string
    /*received = not Accepted; accepted = Accepted only */
    libraryMode: ILibraryTicketMode
    selectedNode: ITreeNode
    treeData: ITreeNode[]
}

function resolveBusinessScope(
    node: ITreeNode,
    treeData?: ITreeNode[]
): ILibraryBusinessScope {
    if (node.NodeType === 'Root') {
        return { nodeType: 'Root' }
    }

    if (node.NodeType === 'Contact') {
        const parentBid = String(node.parentEntID ?? node.bid ?? '')
        const parentBusiness = findNodeByKey(treeData ?? [], parentBid)
        return {
            nodeType: 'Contact',
            cid: String(node.NodeEntID ?? node.key),
            contactName: String(node.Name ?? node.contact ?? ''),
            bid: parentBid || null,
            businessName: parentBusiness
                ? String(parentBusiness.Name ?? parentBusiness.bname ?? '')
                : null,
        }
    }

    if (node.NodeType === 'Business') {
        return {
            nodeType: 'Business',
            bid: String(node.NodeEntID ?? node.key),
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
    const [businessScope, setBusinessScope] = useState<ILibraryBusinessScope>({
        nodeType: 'Root',
    })
    const [selectedTicket, setSelectedTicket] = useState<ITicket | null>(null)

    useEffect(() => {
        setBusinessScope(resolveBusinessScope(props.selectedNode, props.treeData))
    }, [props.selectedNode, props.treeData, props.featureId])

    const ticketKey = useMemo(
        () =>
            [
                props.libraryMode,
                businessScope.nodeType,
                businessScope.bid ?? '',
                businessScope.cid ?? '',
            ].join('|'),
        [props.libraryMode, businessScope]
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
                        libraryMode={props.libraryMode}
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
