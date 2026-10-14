import type { IBusinessDoc, IContactDoc, ITicketDoc } from "@n20a/libfsdb";
import type { ITreeNode } from "../../../shared/allinterface/tree/ITreeControl";
import type { IFeatureTree } from "../../../shared/allinterface/tree/ITreeForFlatDataContainer";
import { FnMapBusinessesToTreeNodes } from "../../../shared/allcommon/tree/FnMapBusinessesToTreeNodes";
import { FnMapContactsToTreeNodes } from "../../../shared/allcommon/tree/FnMapContactsToTreeNodes";
import { FnGetSourceDataset } from "../../../shared/allcommon/FnLoadSampleDatasets";
import { TicketsEnums } from "../../../constants/Feature";

export interface IFnFilterTicketTreeResult {
    /** The matching ticket records after applying feature status filter */
    matchingTickets: ITicketDoc[];
    /** Set of lowercase BIDs present in matching ticket records */
    matchingBids: Set<string>;
    /** Set of lowercase `${bid}__${cid}` pairs present in matching ticket records */
    matchingBidCidPairs: Set<string>;
    /** Map of lowercase BID -> Set of lowercase CIDs present in matching ticket records */
    matchingCidsByBid: Map<string, Set<string>>;
    /** Filtered business records matching the tickets criteria */
    filteredBusinesses: IBusinessDoc[];
    /** Filtered contact records matching the tickets criteria */
    filteredContacts: IContactDoc[];
    /** Helper to test if a given BID is in matching tickets */
    isBidMatching: (bid?: string) => boolean;
    /** Helper to test if a given (BID, CID) pair is in matching tickets */
    isContactMatching: (bid?: string, cid?: string) => boolean;
    /** Helper to filter an array of contacts for a specific BID */
    filterContactsForBid: (contacts: IContactDoc[], bid?: string) => IContactDoc[];
    /** Helper to filter tree nodes directly */
    filterTreeNodes: (nodes: ITreeNode[]) => ITreeNode[];
}

/**
 * Normalizes an identifier string for case-insensitive and trimmed comparison.
 */
export function cleanId(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

/**
 * Normalizes a BID by stripping common prefixes (e.g. "bid_104" -> "104", "bid-104" -> "104").
 */
export function normalizeBidKey(value: unknown): string {
    const s = cleanId(value);
    if (!s) return "";
    return s.replace(/^bid[_-]?/i, "");
}

/**
 * Checks if the given featureId is Requests Received (Menu 300, Feature 308).
 */
export function isRequestsReceivedFeature(featureId?: string): boolean {
    if (!featureId) return false;
    return (
        featureId === TicketsEnums.RequestsReceived
    );
}

/**
 * Checks if the given featureId is Approved Tickets (Menu 300, Feature 312).
 */
export function isApprovedTicketsFeature(featureId?: string): boolean {
    if (!featureId) return false;
    return (
        featureId === TicketsEnums.ApprovedTickets
    );
}

/**
 * Checks if the given featureId is either Requests Received or Approved Tickets.
 */
export function isTicketsFeature(featureId?: string): boolean {
    return isRequestsReceivedFeature(featureId) || isApprovedTicketsFeature(featureId);
}

/**
 * Step 1: Filter full tickets dataset based on selected feature:
 * - In case of Requests Received: display 'Open' (or 'received')
 * - In case of Approved Tickets: display 'InProgress' (or 'in progress', 'released', 'approved', 'accepted', 'close', 'closed', 'resolved')
 *
 * @param tickets Full tickets dataset
 * @param featureId Current active feature ID
 */
export function filterTicketsByFeature(
    tickets: ITicketDoc[] = [],
    featureId?: string
): ITicketDoc[] {
    const isApproved = isApprovedTicketsFeature(featureId);
    const isRequests = isRequestsReceivedFeature(featureId);

    if (!isApproved && !isRequests) {
        return tickets;
    }

    return tickets.filter((t) => {
        const s = String(t.status ?? "").trim().toLowerCase().replace(/[-_]/g, " ");
        if (isApproved) {
            return (
                s === "inprogress" ||
                s === "in progress" ||
                s === "released" ||
                s === "approved" ||
                s === "accepted" ||
                s === "close" ||
                s === "closed" ||
                s.startsWith("close") ||
                s === "resolved" ||
                s === "pending" ||
                s === "need info"
            );
        }
        // Requests received: Open / Received / Not Accepted / Request / New
        return (
            s === "open" ||
            s === "received" ||
            s === "recied" ||
            s === "receive" ||
            s.startsWith("receiv") ||
            s.startsWith("rec") ||
            s === "not accepted" ||
            s === "discarded" ||
            s === "request" ||
            s === "requested" ||
            s.startsWith("req") ||
            s === "new"
        );
    });
}

/**
 * Step 2: Build Business Tree based on tickets Data:
 * In tickets we have bid and cid. Based on bid and cid we display the BS tree:
 * - Only businesses whose BID is in the filtered tickets are displayed.
 * - Under each business, only contacts whose CID matches the filtered tickets for that BID are displayed.
 *
 * @param businesses Source businesses to filter
 * @param tickets Full tickets dataset
 * @param featureId Active feature ID (Requests Received or Approved Tickets)
 * @param contacts Optional source contacts to filter
 */
export function FnFilterTicketTree(
    businesses: IBusinessDoc[] = [],
    tickets: ITicketDoc[] = [],
    featureId?: string,
    contacts: IContactDoc[] = []
): IFnFilterTicketTreeResult {
    // 1. Filter tickets according to active feature
    const matchingTickets = filterTicketsByFeature(tickets, featureId);

    // 2. Extract matching BIDs, CIDs, and BID+CID pairs
    const matchingBids = new Set<string>();
    const matchingNormBids = new Set<string>();
    const matchingBidCidPairs = new Set<string>();
    const matchingCidsByBid = new Map<string, Set<string>>();

    for (const item of matchingTickets) {
        let bid = cleanId(item.bid);
        let cid = cleanId(item.cid);
        if (!bid && item.ticketid) {
            const m = String(item.ticketid).match(/bid[_-]?\d+/i);
            if (m) bid = cleanId(m[0]);
        }
        if (!cid && item.ticketid) {
            const m = String(item.ticketid).match(/cid[_-]?bid[_-]?\d+[_-]?\d+/i);
            if (m) cid = cleanId(m[0]);
        }
        if (bid && /^\d+$/.test(bid)) {
            bid = `bid_${bid}`;
        }

        if (bid) {
            const norm = normalizeBidKey(bid);
            matchingBids.add(bid);
            matchingNormBids.add(norm);
            if (!matchingCidsByBid.has(bid)) {
                matchingCidsByBid.set(bid, new Set<string>());
            }
            if (!matchingCidsByBid.has(norm)) {
                matchingCidsByBid.set(norm, new Set<string>());
            }
            if (cid) {
                matchingCidsByBid.get(bid)!.add(cid);
                matchingCidsByBid.get(norm)!.add(cid);
                matchingBidCidPairs.add(`${bid}__${cid}`);
                matchingBidCidPairs.add(`${norm}__${cid}`);
            }
        }
    }

    const isBidMatching = (bid?: string): boolean => {
        if (!bid) return false;
        const c = cleanId(bid);
        const n = normalizeBidKey(bid);
        return matchingBids.has(c) || matchingNormBids.has(n);
    };

    const isContactMatching = (bid?: string, cid?: string): boolean => {
        const b = cleanId(bid);
        const bn = normalizeBidKey(bid);
        const c = cleanId(cid);
        if (!b || !c) return false;
        return (
            matchingBidCidPairs.has(`${b}__${c}`) ||
            matchingBidCidPairs.has(`${bn}__${c}`) ||
            (matchingCidsByBid.get(b)?.has(c) ?? false) ||
            (matchingCidsByBid.get(bn)?.has(c) ?? false)
        );
    };

    // 3. Filter businesses: only keep businesses whose BID matches the filtered tickets
    const filteredBusinesses: IBusinessDoc[] = [];
    const seenBids = new Set<string>();

    const sourceBusinesses = (businesses && businesses.length > 0)
        ? businesses
        : (FnGetSourceDataset('businesses') || []);

    for (const b of sourceBusinesses) {
        const bid = cleanId(b.bid || (b as any).EntID || (b as any).id);
        const norm = normalizeBidKey(bid);
        if (bid && (matchingBids.has(bid) || matchingNormBids.has(norm))) {
            if (!seenBids.has(bid) && !seenBids.has(norm)) {
                seenBids.add(bid);
                seenBids.add(norm);
                filteredBusinesses.push(b);
            }
        }
    }

    // Ensure all matching BIDs have a business entry even if missing from sourceBusinesses
    const fallbackAllBs = FnGetSourceDataset('businesses') || [];
    for (const bid of matchingBids) {
        const norm = normalizeBidKey(bid);
        if (!seenBids.has(bid) && !seenBids.has(norm)) {
            seenBids.add(bid);
            seenBids.add(norm);
            const foundInAll = fallbackAllBs.find((ab) => {
                const abBid = cleanId(ab.bid || (ab as any).EntID || (ab as any).id);
                return abBid === bid || normalizeBidKey(abBid) === norm;
            });
            filteredBusinesses.push({
                ...(foundInAll ?? {}),
                bid: foundInAll?.bid || (bid.startsWith("bid_") ? bid : `bid_${bid}`),
                bname: foundInAll?.bname,
            } as IBusinessDoc);
        }
    }

    const sampleContacts = FnGetSourceDataset('contacts') || [];
    const allFallbackContacts = (contacts && contacts.length > 0)
        ? [...contacts, ...sampleContacts.filter((sc: any) => !contacts.some((c) => cleanId(c.cid) === cleanId(sc.cid)))]
        : sampleContacts;

    // 4. Helper to filter contacts for a specific business
    const filterContactsForBid = (contactsToFilter: IContactDoc[], targetBid?: string): IContactDoc[] => {
        const fallbackBid = cleanId(targetBid);
        const fallbackNormBid = normalizeBidKey(targetBid);
        const result: IContactDoc[] = [];
        const seenCids = new Set<string>();

        const sourceContactsList = (contactsToFilter && contactsToFilter.length > 0)
            ? contactsToFilter
            : allFallbackContacts.filter((c) => {
                const cb = cleanId(c.bid);
                return cb === fallbackBid || normalizeBidKey(cb) === fallbackNormBid;
            });

        for (const c of sourceContactsList) {
            const b = cleanId(c.bid) || fallbackBid;
            const cid = cleanId(c.cid || (c as any).EntID || (c as any).id);
            if (b && cid && isContactMatching(b, cid)) {
                if (!seenCids.has(cid)) {
                    seenCids.add(cid);
                    result.push(c);
                }
            }
        }

        // If specific business was requested, ensure any CIDs in tickets but not in contactsToFilter are represented
        const expectedCids = matchingCidsByBid.get(fallbackBid) || matchingCidsByBid.get(fallbackNormBid);
        if (expectedCids) {
            for (const cid of expectedCids) {
                if (!seenCids.has(cid)) {
                    seenCids.add(cid);
                    const foundInAllContacts = allFallbackContacts.find(
                        (ac) => cleanId(ac.cid || (ac as any).EntID || (ac as any).id) === cid
                    );
                    result.push({
                        ...(foundInAllContacts ?? {}),
                        bid: targetBid || fallbackBid,
                        cid,
                        cname: foundInAllContacts?.cname || cid,
                    } as IContactDoc);
                }
            }
        }

        return result;
    };

    // 5. Filter global contacts
    const filteredContacts = contacts.filter((c) => {
        const b = cleanId(c.bid);
        const cid = cleanId(c.cid || (c as any).EntID || (c as any).id);
        return isContactMatching(b, cid);
    });

    // 6. Helper to filter an existing tree of ITreeNode
    const filterTreeNodes = (nodes: ITreeNode[]): ITreeNode[] => {
        return nodes
            .map((node) => {
                const nodeType = String(node.NodeType || "").toLowerCase();
                const nodeKey = cleanId(node.key || node.NodeEntID || (node as any).bid);

                if (nodeType === "root") {
                    const children = node.children ? filterTreeNodes(node.children) : [];
                    const baseLabel = String(node.Name || node.title || "Businesses").replace(/\s*\(\d+\)$/, "").trim();
                    const newLabel = `${baseLabel} (${children.length})`;
                    return {
                        ...node,
                        Name: newLabel,
                        title: newLabel,
                        Description: newLabel,
                        children,
                        HasChildren: children.length > 0 ? 1 : 0,
                        isLeaf: children.length === 0,
                    };
                }

                if (nodeType === "business") {
                    if (!isBidMatching(nodeKey)) {
                        return null;
                    }
                    const children = node.children ? filterTreeNodes(node.children) : [];
                    return {
                        ...node,
                        children,
                        HasChildren: children.length > 0 ? 1 : (matchingCidsByBid.get(nodeKey)?.size ?? 0) > 0 ? 1 : 0,
                    };
                }

                if (nodeType === "contact") {
                    const parentBid = cleanId((node as any).bid || node.parentEntID);
                    if (!isContactMatching(parentBid, nodeKey)) {
                        return null;
                    }
                    return node;
                }

                return node;
            })
            .filter((n): n is ITreeNode => n !== null);
    };

    return {
        matchingTickets,
        matchingBids,
        matchingBidCidPairs,
        matchingCidsByBid,
        filteredBusinesses,
        filteredContacts,
        isBidMatching,
        isContactMatching,
        filterContactsForBid,
        filterTreeNodes,
    };
}

/**
 * Builds the complete ITreeNode hierarchy for [Tickets] Requests Received & Approved Tickets:
 * Root Node ("Businesses (N)")
 *   |-- Business Nodes (only those whose BID matches the filtered tickets)
 *         |-- Contact Nodes (only those whose CID matches the filtered tickets for that BID)
 */
export function FnBuildTicketBsTree(
    businesses: IBusinessDoc[] = [],
    contacts: IContactDoc[] = [],
    tickets: ITicketDoc[] = [],
    featureProps?: IFeatureTree,
    featureId?: string,
    wrapWithRootLabel: string = "Businesses",
    handleKebabMenuSelect?: (selectedItem: any) => void
): ITreeNode[] {
    const filterResult = FnFilterTicketTree(businesses, tickets, featureId, contacts);
    const { filteredBusinesses, filterContactsForBid, matchingCidsByBid } = filterResult;

    const baseLabel = wrapWithRootLabel.replace(/\s*\(\d+\)$/, "").trim() || "Businesses";
    const rootLabel = `${baseLabel} (${filteredBusinesses.length})`;

    const businessNodes = FnMapBusinessesToTreeNodes(
        filteredBusinesses,
        featureProps,
        featureId,
        handleKebabMenuSelect
    ).map((bNode) => {
        const rawBid = bNode.NodeEntID || bNode.key || (bNode as any).bid;
        const businessBid = cleanId(rawBid);
        const contactsForThisBid = contacts.filter((c) => {
            const cBid = cleanId(c.bid);
            return cBid ? cBid === businessBid : false;
        });
        const matchedContacts = filterContactsForBid(contactsForThisBid, String(rawBid || businessBid));
        const contactNodes = FnMapContactsToTreeNodes(
            matchedContacts,
            featureProps,
            featureId,
            bNode.key as string,
            handleKebabMenuSelect
        );

        const hasMatchingCids = (matchingCidsByBid.get(businessBid)?.size ?? 0) > 0;
        const hasChildren = contactNodes.length > 0 || hasMatchingCids;

        return {
            ...bNode,
            parentEntID: "root-businesses",
            children: contactNodes,
            HasChildren: hasChildren ? 1 : 0,
            isLeaf: !hasChildren,
        };
    });

    const rootNode: ITreeNode = {
        key: "root-businesses",
        NodeEntID: "root-businesses",
        EntID: "root-businesses",
        NodeEntityname: "Businesses",
        NodeType: "Root",
        Name: rootLabel,
        Description: rootLabel,
        NodeState: null,
        IsAuthorized: false,
        title: rootLabel,
        icon: null,
        children: businessNodes.map((bn) => ({ ...bn, parentEntID: "root-businesses" })),
        treetype: "Root",
        Type: "Root",
        parentEntID: null,
        stepNo: 0,
        HasChildren: businessNodes.length > 0 ? 1 : 0,
        isLeaf: businessNodes.length === 0,
        checkable: false,
    };

    return [rootNode];
}
