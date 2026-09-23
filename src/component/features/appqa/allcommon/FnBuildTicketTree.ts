import { IFeatureTree } from "../../../shared/allinterface/tree/ITreeForHierarchicalDataContainer";
import { TreeNodeIcon } from "../../../shared/tree/treenodeicon/TreeNodeIcon";
import { TreeNodeTitle } from "../../../shared/tree/treenodetitle/TreeNodeTitle";
import { FnFormatTicketDateOnly } from "../../../shared/allcommon/tree/FnFormatTicketDate";
import type { ITicketDoc } from "../../../shared/allinterface/IDatasets";
import { ITicketFilterValues } from "../../library/librarytickets/ticketexplorercontainer/TicketFilterForm";
import { ITreeNode } from "../../../shared/allinterface/tree/ITreeControl";

type NodeContext = {
    featureTreeProps?: IFeatureTree;
    featureId?: string;
};

type DateGroup = {
    dateValue: Date | string | null | undefined;
    manufacturers: Map<string, ITicketDoc[]>;
};

function ticketStatus(ticket: ITicketDoc): string {
    return (ticket.status ?? "").trim();
}

/** Leaf node Status used for Released / Accepted / Received / Open icons. */
function toLeafNodeStatus(status: string): "Released" | "Accepted" | "Received" | "Open" {
    const normalized = status.toLowerCase();
    if (normalized === "released") {
        return "Released";
    }
    if (normalized === "accepted" || normalized === "resolved") {
        return "Accepted";
    }
    if (normalized === "open") {
        return "Open";
    }
    return "Received";
}

function isClosedLibraryStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return normalized === "accepted" || normalized === "resolved" || normalized === "released";
}

function isOpenLibraryStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return (
        normalized === "pending" ||
        normalized === "open" ||
        normalized === "in progress" ||
        normalized === "need info"
    );
}

// =========================================================
// FILTERS
// =========================================================

/* Filters tickets: All unchecked → open/pending only. */
export function filterTickets(
    tickets: ITicketDoc[],
    filter: ITicketFilterValues
): ITicketDoc[] {
    if (filter.showAll) return [...tickets];
    return tickets.filter((ticket) => isOpenLibraryStatus(ticketStatus(ticket)));
}

/* Library ticket list modes (Received = not Accepted, Approved = Accepted only). */
export type ILibraryTicketMode = "received" | "accepted" | "all" | "mcs";

export interface ILibraryBusinessScope {
    /* Root / all businesses → no scope. */
    nodeType?: string | null;
    businessName?: string | null;
    contactName?: string | null;
    bid?: string | null;
    cid?: string | null;
}

/* Apply Library Received / Accepted status filter. */
export function filterTicketsByLibraryMode(
    tickets: ITicketDoc[],
    mode?: ILibraryTicketMode
): ITicketDoc[] {
    if (!mode || mode === "all" || mode === "mcs") return [...tickets];
    if (mode === "accepted") {
        return tickets.filter((ticket) => isClosedLibraryStatus(ticketStatus(ticket)));
    }
    // received: tickets not yet accepted / resolved
    return tickets.filter((ticket) => !isClosedLibraryStatus(ticketStatus(ticket)));
}

/**
 * Scope tickets by business explorer selection:
 * - Root → all tickets
 * - Business → tickets for that business name
 * - Contact (CID leaf) → tickets for that business + contact
 */
export function filterTicketsByBusinessScope(
    tickets: ITicketDoc[],
    scope?: ILibraryBusinessScope | null
): ITicketDoc[] {
    if (!scope?.nodeType || scope.nodeType === "Root") {
        return [...tickets];
    }

    if (scope.nodeType === "Contact") {
        return tickets.filter((ticket) => {
            const businessOk = scope.bid ? ticket.bid === scope.bid : true;
            const contactOk = scope.cid ? ticket.cid === scope.cid : true;
            return businessOk && contactOk;
        });
    }

    if (scope.nodeType === "Business") {
        if (!scope.bid) return [...tickets];
        return tickets.filter((ticket) => ticket.bid === scope.bid);
    }

    return [...tickets];
}

// =========================================================
// MAIN BUILDER
// =========================================================

/**
 * Builds ticket tree matching service20 logic:
 * Root: Tickets (or By Requested Date)
 *   > Support tickets (Category static node)
 *   > Mfg (MfgGroup static node)
 *       > [Manufacturer] (Mfg)
 *           > [Ticket/ProdNo] (ProdNo)
 */
export function buildTicketTree(
    tickets: ITicketDoc[],
    filter: ITicketFilterValues,
    featureTreeProps?: IFeatureTree,
    featureId?: string,
    libraryMode?: ILibraryTicketMode,
    businessScope?: ILibraryBusinessScope | null
): ITreeNode[] {
    const context: NodeContext = {
        featureTreeProps,
        featureId,
    };

    const statusFiltered = filterTicketsByLibraryMode(tickets, libraryMode);
    const scoped = filterTicketsByBusinessScope(statusFiltered, businessScope);
    const filteredTickets = filterTickets(scoped, filter);

    const rootKey = filter.byMfg
        ? "root##tickets"
        : "root##by-requested-date";

    const rootLabel = filter.byMfg
        ? "Tickets"
        : "By Requested Date";

    if (filteredTickets.length === 0) {
        const rootNode = createNode({
            key: rootKey,
            name: rootLabel,
            nodeType: "Root",
            parentEntID: null,
            isLeaf: false,
            description: rootLabel,
        });

        const supportNode = createNode({
            key: `${rootKey}##support-tickets`,
            name: "Support tickets",
            nodeType: "Category",
            parentEntID: rootKey,
            isLeaf: true,
            description: "Support tickets",
        });

        const mfgGroupNode = createNode({
            key: `${rootKey}##mfg-group`,
            name: "Mfg",
            nodeType: "MfgGroup",
            parentEntID: rootKey,
            isLeaf: true,
            description: "Mfg",
        });

        rootNode.children = [
            finalizeNode(supportNode, context),
            finalizeNode(mfgGroupNode, context),
        ];

        return [finalizeNode(rootNode, context)];
    }

    let children: ITreeNode[];

    if (filter.byMfg) {
        children = buildMfgTreeOptimized(
            filteredTickets,
            rootKey,
            context
        );
    } else {
        children = buildDateTreeOptimized(
            filteredTickets,
            rootKey,
            context
        );
    }

    const rootNode = createNode({
        key: rootKey,
        name: rootLabel,
        nodeType: "Root",
        parentEntID: null,
        isLeaf: children.length === 0,
        description: rootLabel,
    });

    rootNode.children = children;

    return [finalizeNode(rootNode, context)];
}

// =========================================================
// BY MANUFACTURER
// =========================================================

function buildMfgTreeOptimized(
    tickets: ITicketDoc[],
    rootKey: string,
    context: NodeContext
): ITreeNode[] {
    const sortedTickets = [...tickets].sort(compareProdNo);

    const mfgMap = new Map<string, ITicketDoc[]>();
    const supportTickets: ITicketDoc[] = [];

    for (const ticket of sortedTickets) {
        const rawMfg = ticket.mfg && ticket.mfg.trim();
        if (rawMfg && rawMfg.toLowerCase() !== "support tickets") {
            let group = mfgMap.get(rawMfg);
            if (group) {
                group.push(ticket);
            } else {
                mfgMap.set(rawMfg, [ticket]);
            }
        } else {
            supportTickets.push(ticket);
        }
    }

    // 1. Sub Node 1: Support tickets (Category static node)
    const supportTicketsKey = `${rootKey}##support-tickets`;
    const supportTicketsChildren = supportTickets.map((ticket, index) =>
        createTicketNode(
            ticket,
            supportTicketsKey,
            `prod##support##${ticket.prodno || ticket.ticketid || index}##${ticket.ticketid || index}`,
            context
        )
    );

    const supportTicketsNode = createNode({
        key: supportTicketsKey,
        name: "Support tickets",
        nodeType: "Category",
        parentEntID: rootKey,
        isLeaf: supportTicketsChildren.length === 0,
        description: "Support tickets",
    });
    supportTicketsNode.children = supportTicketsChildren;
    const finalizedSupportNode = finalizeNode(supportTicketsNode, context);

    // 2. Sub Node 2: Mfg (MfgGroup static node) -> Manufacturers -> Tickets
    const mfgGroupKey = `${rootKey}##mfg-group`;
    const manufacturers = Array.from(mfgMap.keys()).sort(compareString);

    const mfgChildren: ITreeNode[] = new Array(manufacturers.length);

    for (let i = 0; i < manufacturers.length; i++) {
        const mfg = manufacturers[i];
        const mfgTickets = mfgMap.get(mfg)!;
        mfgChildren[i] = createMfgNodeOptimized(
            mfg,
            mfgTickets,
            `mfg##${mfg}`,
            mfgGroupKey,
            `prod##${mfg}##`,
            context
        );
    }

    const mfgGroupNode = createNode({
        key: mfgGroupKey,
        name: "Mfg",
        nodeType: "MfgGroup",
        parentEntID: rootKey,
        isLeaf: mfgChildren.length === 0,
        description: "Mfg",
    });
    mfgGroupNode.children = mfgChildren;
    const finalizedMfgGroupNode = finalizeNode(mfgGroupNode, context);

    return [finalizedSupportNode, finalizedMfgGroupNode];
}

// =========================================================
// BY DATE
// =========================================================

function buildDateTreeOptimized(
    tickets: ITicketDoc[],
    rootKey: string,
    context: NodeContext
): ITreeNode[] {
    const sortedTickets = [...tickets].sort(compareProdNo);

    const dateMap = new Map<number, DateGroup>();
    const supportTickets: ITicketDoc[] = [];

    for (const ticket of sortedTickets) {
        const rawMfg = ticket.mfg && ticket.mfg.trim();
        if (rawMfg && rawMfg.toLowerCase() !== "support tickets") {
            const dateKey = daySortKey(ticket.daterequested);
            let dateGroup = dateMap.get(dateKey);
            if (!dateGroup) {
                dateGroup = {
                    dateValue: ticket.daterequested,
                    manufacturers: new Map<string, ITicketDoc[]>(),
                };
                dateMap.set(dateKey, dateGroup);
            }
            let mfgTickets = dateGroup.manufacturers.get(rawMfg);
            if (mfgTickets) {
                mfgTickets.push(ticket);
            } else {
                dateGroup.manufacturers.set(rawMfg, [ticket]);
            }
        } else {
            supportTickets.push(ticket);
        }
    }

    // 1. Sub Node 1: Support tickets (Category static node)
    const supportTicketsKey = `${rootKey}##support-tickets`;
    const supportTicketsChildren = supportTickets.map((ticket, index) =>
        createTicketNode(
            ticket,
            supportTicketsKey,
            `prod##support##${ticket.prodno || ticket.ticketid || index}##${ticket.ticketid || index}`,
            context
        )
    );

    const supportTicketsNode = createNode({
        key: supportTicketsKey,
        name: "Support tickets",
        nodeType: "Category",
        parentEntID: rootKey,
        isLeaf: supportTicketsChildren.length === 0,
        description: "Support tickets",
    });
    supportTicketsNode.children = supportTicketsChildren;
    const finalizedSupportNode = finalizeNode(supportTicketsNode, context);

    // 2. Sub Node 2: Mfg (MfgGroup static node) -> Date -> Manufacturer -> Tickets
    const mfgGroupKey = `${rootKey}##mfg-group`;

    const dateEntries = Array.from(dateMap.entries()).sort(compareDateDescending);
    const dateChildren: ITreeNode[] = new Array(dateEntries.length);

    for (let dateIndex = 0; dateIndex < dateEntries.length; dateIndex++) {
        const [sortKey, dateGroup] = dateEntries[dateIndex];
        const dateLabel = formatDateRequested(dateGroup.dateValue);
        const dateNodeKey = `${mfgGroupKey}##date##${sortKey}`;

        const dateNode = createNode({
            key: dateNodeKey,
            name: dateLabel,
            nodeType: "date",
            parentEntID: mfgGroupKey,
            isLeaf: false,
            description: `Requested ${dateLabel}`,
        });

        dateNode.title = dateLabel;
        dateNode.TableLabel = dateLabel;

        const manufacturers = Array.from(dateGroup.manufacturers.keys()).sort(compareString);
        const mfgChildren = new Array<ITreeNode>(manufacturers.length);

        for (let mfgIndex = 0; mfgIndex < manufacturers.length; mfgIndex++) {
            const mfg = manufacturers[mfgIndex];
            const mfgTickets = dateGroup.manufacturers.get(mfg)!;
            mfgTickets.sort(compareProdNo);

            mfgChildren[mfgIndex] = createMfgNodeOptimized(
                mfg,
                mfgTickets,
                `${dateNodeKey}##mfg##${mfg}`,
                dateNode.key,
                `prod##${sortKey}##${mfg}##`,
                context
            );
        }

        dateNode.children = mfgChildren;
        dateChildren[dateIndex] = finalizeNode(dateNode, context);
    }

    const mfgGroupNode = createNode({
        key: mfgGroupKey,
        name: "Mfg",
        nodeType: "MfgGroup",
        parentEntID: rootKey,
        isLeaf: dateChildren.length === 0,
        description: "Mfg",
    });
    mfgGroupNode.children = dateChildren;
    const finalizedMfgGroupNode = finalizeNode(mfgGroupNode, context);

    return [finalizedSupportNode, finalizedMfgGroupNode];
}

// =========================================================
// MFG NODE
// =========================================================

function createMfgNodeOptimized(
    mfg: string,
    tickets: ITicketDoc[],
    mfgKey: string,
    parentKey: string,
    ticketKeyPrefix: string,
    context: NodeContext
): ITreeNode {
    const mfgNode = createNode({
        key: mfgKey,
        name: mfg,
        nodeType: "Mfg",
        parentEntID: parentKey,
        isLeaf: false,
        description: mfg,
    });

    const ticketChildren = new Array<ITreeNode>(tickets.length);

    for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        ticketChildren[i] = createTicketNode(
            ticket,
            mfgNode.key,
            `${ticketKeyPrefix}${ticket.prodno || ticket.ticketid || i}##${ticket.ticketid || i}`,
            context
        );
    }

    mfgNode.children = ticketChildren;

    return finalizeNode(mfgNode, context);
}

// =========================================================
// TICKET NODE
// =========================================================

function createTicketNode(
    ticket: ITicketDoc,
    parentKey: string,
    key: string,
    context: NodeContext
): ITreeNode {
    const prodNoName =
        (ticket.prodno && ticket.prodno.trim()) ? ticket.prodno.trim() : (ticket.ticketid || "Ticket");

    const node = createNode({
        key,
        name: prodNoName,
        nodeType: "ProdNo",
        parentEntID: parentKey,
        isLeaf: true,
        ticket,
        description: `${ticket.ticketid || "Ticket"} · ${ticket.status || "Pending"}`,
    });

    return finalizeNode(node, context);
}

// =========================================================
// CREATE BASE NODE
// =========================================================

function createNode(params: {
    key: string;
    name: string;
    nodeType: string;
    parentEntID: string | null;
    isLeaf: boolean;
    ticket?: ITicketDoc;
    description?: string;
}): ITreeNode {
    const {
        key,
        name,
        nodeType,
        parentEntID,
        isLeaf,
        ticket,
        description,
    } = params;

    let resolvedName = (name ?? "").trim();
    if (!resolvedName) {
        if (nodeType === "Mfg") {
            resolvedName = "Support Ticket";
        } else if (ticket) {
            resolvedName = ticket.prodno?.trim() || ticket.ticketid?.trim() || ticket.tickettype?.trim() || "Ticket";
        }
    }
    const resolvedDesc = (description ?? "").trim() || resolvedName;
    const leafStatus = ticket ? toLeafNodeStatus(ticketStatus(ticket)) : undefined;

    return {
        key,
        NodeEntID: key,
        EntID: key,
        NodeEntityname: nodeType === "Mfg" ? resolvedName : nodeType,
        NodeType: nodeType,
        Name: resolvedName,
        TableLabel: resolvedName,
        Description: resolvedDesc,
        NodeState: leafStatus ?? (ticket?.status ?? null),
        IsAuthorized: false,
        title: resolvedName,
        icon: null,
        children: [],
        treetype: nodeType,
        Type: nodeType,
        parentEntID,
        stepNo: 0,
        HasChildren: isLeaf ? 0 : 1,
        isLeaf,
        checkable: false,
        ticketId: ticket?.ticketid ?? null,
        Status: leafStatus ?? ticket?.status,
        ticket,
        ticketRecord: ticket,
    };
}

// =========================================================
// FINALIZE NODE
// =========================================================

function finalizeNode(
    node: ITreeNode,
    context: NodeContext
): ITreeNode {
    const { featureTreeProps, featureId } = context;

    if (featureTreeProps && featureId) {
        node.title = TreeNodeTitle(
            node,
            featureTreeProps
        );
        if (featureTreeProps.allowIcon && node.NodeType === "Mfg") {
            node.icon = TreeNodeIcon(
                node,
                featureTreeProps.instanceName ?? ""
            );
        }
    } else {
        node.title = node.TableLabel ?? node.Name ?? node.title;
    }

    return node;
}

// =========================================================
// COMPARATORS
// =========================================================

function compareString(a: string, b: string): number {
    return a.localeCompare(b);
}

function compareProdNo(a: ITicketDoc, b: ITicketDoc): number {
    const aLabel = (a.prodno && a.prodno.trim()) ? a.prodno.trim() : (a.ticketid || "");
    const bLabel = (b.prodno && b.prodno.trim()) ? b.prodno.trim() : (b.ticketid || "");
    return aLabel.localeCompare(bLabel);
}

function compareDateDescending(
    a: [number, DateGroup],
    b: [number, DateGroup]
): number {
    return b[0] - a[0];
}

// =========================================================
// DATE HELPERS
// =========================================================

function formatDateRequested(value: Date | string | null | undefined): string {
    if (!value) {
        return "Unknown Date";
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return (typeof value === "string" && value.trim())
            ? value.trim()
            : "Unknown Date";
    }

    const formatted = FnFormatTicketDateOnly(date);

    if (formatted?.trim()) {
        return formatted.trim();
    }

    const pad = (n: number) => n.toString().padStart(2, "0");

    return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
}

function daySortKey(value: Date | string | null | undefined): number {
    if (!value) {
        return 0;
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 0;
    }

    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    ).getTime();
}

// =========================================================
// TREE TRAVERSAL HELPERS
// =========================================================

/* Finds the first ProdNo (ticket) leaf in the tree. */
export function findFirstTicketLeaf(nodes: ITreeNode[]): ITreeNode | null {
    if (!nodes?.length) {
        return null;
    }

    for (const node of nodes) {
        if (node.isLeaf && (node.NodeType === "ProdNo" || node.ticket || node.ticketRecord)) {
            return node;
        }
        if (node.children?.length) {
            const found = findFirstTicketLeaf(node.children);
            if (found) return found;
        }
    }

    return null;
}

/* Ancestor keys from root to the leaf (excluding the leaf). */
export function getAncestorKeys(nodes: ITreeNode[], leafKey: string): string[] {
    const path: string[] = [];

    const walk = (currentNodes: ITreeNode[], ancestors: string[]): boolean => {
        for (const node of currentNodes) {
            if (node.key === leafKey) {
                path.push(...ancestors);
                return true;
            }
            if (node.children?.length && walk(node.children, [...ancestors, node.key])) {
                return true;
            }
        }
        return false;
    };

    walk(nodes, []);
    return path;
}

export { buildTicketTree as FnBuildTicketTree };
