import { ITreeNode } from "../../../shared/allinterface/entity/ITreeNode"
import { IFeatureTree } from "../../../shared/allinterface/tree/ITreeForHierarchicalDataContainer"
import { TreeNodeIcon } from "../../../shared/tree/treenodeicon/TreeNodeIcon"
import { TreeNodeTitle } from "../../../shared/tree/treenodetitle/TreeNodeTitle"
import { FnFormatTicketDateOnly } from "../../../shared/allcommon/tree/FnFormatTicketDate"
import { ITicket } from "../../../shared/allinterface/tree/ITicket"
import { ITicketFilterValues } from "../../library/librarytickets/ticketexplorercontainer/TicketFilterForm"

function formatDateRequested(value: Date | string): string {
    return FnFormatTicketDateOnly(value)
}

function createBaseNode(params: {
    key: string
    name: string
    nodeType: string
    parentEntID: string | null
    isLeaf: boolean
    ticket?: ITicket
    description?: string
}): ITreeNode {
    const node: ITreeNode = {
        key: params.key,
        NodeEntID: params.key,
        EntID: params.key,
        NodeEntityname: params.nodeType === 'Mfg' ? params.name : params.nodeType,
        NodeType: params.nodeType,
        Name: params.name,
        Description: params.description ?? params.name,
        NodeState: params.ticket?.Status ?? null,
        IsAuthorized: false,
        title: params.name,
        icon: null,
        children: [],
        treetype: params.nodeType,
        Type: params.nodeType,
        parentEntID: params.parentEntID,
        stepNo: 0,
        HasChildren: params.isLeaf ? 0 : 1,
        isLeaf: params.isLeaf,
        checkable: false,
        ticketRecord: params.ticket,
        Status: params.ticket?.Status,
    }
    return node
}

function finalizeNode(
    node: ITreeNode,
    featureTreeProps?: IFeatureTree,
    featureId?: string
): ITreeNode {
    if (featureTreeProps && featureId) {
        node.title = TreeNodeTitle(
            node,
            featureTreeProps,
            featureId,
            false,
            false
        )
        if (featureTreeProps.allowIcon && node.NodeType === 'Mfg') {
            node.icon = TreeNodeIcon(node, featureTreeProps.instanceName ?? '')
        }
    } else {
        node.title = node.Name ?? node.title
    }
    return node
}

/*Filters tickets: All unchecked → Pending only. */
export function filterTickets(
    tickets: ITicket[],
    filter: ITicketFilterValues
): ITicket[] {
    if (filter.showAll) return [...tickets]
    return tickets.filter((ticket) => ticket.Status === 'Pending')
}

/*Library ticket list modes (Received = not Accepted, Approved = Accepted only). */
export type ILibraryTicketMode = 'received' | 'accepted' | 'all' | 'mcs'

export interface ILibraryBusinessScope {
    /*Root / all businesses → no scope. */
    nodeType?: string | null
    businessName?: string | null
    contactName?: string | null
    bid?: string | null
    cid?: string | null
}

/*Apply Library Received / Accepted status filter. */
export function filterTicketsByLibraryMode(
    tickets: ITicket[],
    mode?: ILibraryTicketMode
): ITicket[] {
    if (!mode || mode === 'all' || mode === 'mcs') return [...tickets]
    if (mode === 'accepted') {
        return tickets.filter((ticket) => ticket.Status === 'Accepted')
    }
    // received: tickets not yet accepted
    return tickets.filter((ticket) => ticket.Status !== 'Accepted')
}

/**
 * Scope tickets by business explorer selection:
 * - Root → all tickets
 * - Business → tickets for that business name
 * - Contact (CID leaf) → tickets for that business + contact
 */
export function filterTicketsByBusinessScope(
    tickets: ITicket[],
    scope?: ILibraryBusinessScope | null
): ITicket[] {
    if (!scope?.nodeType || scope.nodeType === 'Root') {
        return [...tickets]
    }

    if (scope.nodeType === 'Contact') {
        return tickets.filter((ticket) => {
            const businessOk = scope.businessName
                ? ticket.Business === scope.businessName
                : true
            const contactOk = scope.contactName
                ? ticket.contact === scope.contactName
                : true
            return businessOk && contactOk
        })
    }

    if (scope.nodeType === 'Business') {
        if (!scope.businessName) return [...tickets]
        return tickets.filter((ticket) => ticket.Business === scope.businessName)
    }

    return [...tickets]
}

/**
 * Builds ticket tree from filter mode:
 * - By Mfg: By Mfg → Mfg → ProdNo (leaf)
 * - By DateRequested: By Requested Date → Date → Mfg → ProdNo (leaf)
 */
export function buildTicketTree(
    tickets: ITicket[],
    filter: ITicketFilterValues,
    featureTreeProps?: IFeatureTree,
    featureId?: string,
    libraryMode?: ILibraryTicketMode,
    businessScope?: ILibraryBusinessScope | null
): ITreeNode[] {
    const statusFiltered = filterTicketsByLibraryMode(tickets, libraryMode)
    const scoped = filterTicketsByBusinessScope(statusFiltered, businessScope)
    const filtered = filterTickets(scoped, filter)
    const rootLabel = filter.byMfg ? 'By Mfg' : 'By Requested Date'
    const rootKey = filter.byMfg ? 'root##by-mfg' : 'root##by-requested-date'

    const children = filter.byMfg
        ? buildByMfgTree(filtered, featureTreeProps, featureId, rootKey)
        : buildByDateTree(filtered, featureTreeProps, featureId, rootKey)

    const rootNode = createBaseNode({
        key: rootKey,
        name: rootLabel,
        nodeType: 'Root',
        parentEntID: null,
        isLeaf: children.length === 0,
        description: rootLabel,
    })
    rootNode.children = children

    return [finalizeNode(rootNode, featureTreeProps, featureId)]
}

function buildByMfgTree(
    tickets: ITicket[],
    featureTreeProps?: IFeatureTree,
    featureId?: string,
    parentEntID: string | null = null
): ITreeNode[] {
    const byMfg = new Map<string, ITicket[]>()
    tickets.forEach((ticket) => {
        const list = byMfg.get(ticket.Mfg) ?? []
        list.push(ticket)
        byMfg.set(ticket.Mfg, list)
    })

    const mfgNames = [...byMfg.keys()].sort((a, b) => a.localeCompare(b))

    return mfgNames.map((mfg) => {
        const mfgTickets = byMfg.get(mfg) ?? []
        mfgTickets.sort((a, b) => a.ProdNo.localeCompare(b.ProdNo))

        const mfgNode = createBaseNode({
            key: `mfg##${mfg}`,
            name: mfg,
            nodeType: 'Mfg',
            parentEntID,
            isLeaf: false,
            description: mfg,
        })

        mfgNode.children = mfgTickets.map((ticket) =>
            finalizeNode(
                createBaseNode({
                    key: `prod##${mfg}##${ticket.ProdNo}##${ticket.Ticket}`,
                    name: ticket.ProdNo,
                    nodeType: 'ProdNo',
                    parentEntID: mfgNode.key,
                    isLeaf: true,
                    ticket,
                    description: `${ticket.Ticket} · ${ticket.Status}`,
                }),
                featureTreeProps,
                featureId
            )
        )

        return finalizeNode(mfgNode, featureTreeProps, featureId)
    })
}

function daySortKey(value: Date | string): number {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return 0
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function buildByDateTree(
    tickets: ITicket[],
    featureTreeProps?: IFeatureTree,
    featureId?: string,
    parentEntID: string | null = null
): ITreeNode[] {
    const byDate = new Map<number, { label: string; tickets: ITicket[] }>()
    tickets.forEach((ticket) => {
        const sortKey = daySortKey(ticket.dateRequested)
        const existing = byDate.get(sortKey)
        if (existing) {
            existing.tickets.push(ticket)
            return
        }
        byDate.set(sortKey, {
            label: formatDateRequested(ticket.dateRequested),
            tickets: [ticket],
        })
    })

    // Date Z-A (newest first) — sort by day timestamp, not display label
    const dateGroups = [...byDate.entries()].sort((a, b) => b[0] - a[0])

    return dateGroups.map(([sortKey, group]) => {
        const dateLabel = group.label
        const byMfg = new Map<string, ITicket[]>()
        group.tickets.forEach((ticket) => {
            const list = byMfg.get(ticket.Mfg) ?? []
            list.push(ticket)
            byMfg.set(ticket.Mfg, list)
        })

        const dateNode = createBaseNode({
            key: `date##${sortKey}`,
            name: dateLabel,
            nodeType: 'Date',
            parentEntID,
            isLeaf: false,
            description: `Requested ${dateLabel}`,
        })

        const mfgNames = [...byMfg.keys()].sort((a, b) => a.localeCompare(b))
        dateNode.children = mfgNames.map((mfg) => {
            const mfgTickets = (byMfg.get(mfg) ?? []).sort((a, b) =>
                a.ProdNo.localeCompare(b.ProdNo)
            )
            const mfgNode = createBaseNode({
                key: `date##${sortKey}##mfg##${mfg}`,
                name: mfg,
                nodeType: 'Mfg',
                parentEntID: dateNode.key,
                isLeaf: false,
                description: mfg,
            })
            mfgNode.children = mfgTickets.map((ticket) =>
                finalizeNode(
                    createBaseNode({
                        key: `prod##${sortKey}##${mfg}##${ticket.ProdNo}##${ticket.Ticket}`,
                        name: ticket.ProdNo,
                        nodeType: 'ProdNo',
                        parentEntID: mfgNode.key,
                        isLeaf: true,
                        ticket,
                        description: `${ticket.Ticket} · ${ticket.Status}`,
                    }),
                    featureTreeProps,
                    featureId
                )
            )
            return finalizeNode(mfgNode, featureTreeProps, featureId)
        })

        return finalizeNode(dateNode, featureTreeProps, featureId)
    })
}

/*Finds the first ProdNo (ticket) leaf in the tree. */
export function findFirstTicketLeaf(nodes: ITreeNode[]): ITreeNode | null {
    for (const node of nodes) {
        if (node.NodeType === 'ProdNo' && node.ticketRecord) return node
        if (node.children?.length) {
            const found = findFirstTicketLeaf(node.children)
            if (found) return found
        }
    }
    return null
}

/*Ancestor keys from root to the leaf (excluding the leaf). */
export function getAncestorKeys(nodes: ITreeNode[], leafKey: string): string[] {
    const path: string[] = []

    const walk = (list: ITreeNode[], ancestors: string[]): boolean => {
        for (const node of list) {
            if (node.key === leafKey) {
                path.push(...ancestors)
                return true
            }
            if (node.children?.length && walk(node.children, [...ancestors, node.key])) {
                return true
            }
        }
        return false
    }

    walk(nodes, [])
    return path
}
