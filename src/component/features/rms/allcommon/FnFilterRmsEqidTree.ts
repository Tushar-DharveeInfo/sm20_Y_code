import type { IBusinessDoc, IContactDoc, ITicketDoc } from "@n20a/libfsdb";
import type { IEqidDoc } from "../../../shared/context/allinterface/IRms";
import type { IDCFilterControlValues } from "../../../shared/allinterface/searchfilter/IFilterFormContainer";
import type { ITreeNode } from "../../../shared/allinterface/tree/ITreeControl";
import type { IFeatureTree } from "../../../shared/allinterface/tree/ITreeForFlatDataContainer";
import { FnFilterEqidRecords } from "./FnFilterEqidRecords";
import { FnMapBusinessesToTreeNodes } from "../../../shared/allcommon/tree/FnMapBusinessesToTreeNodes";
import { FnMapContactsToTreeNodes } from "../../../shared/allcommon/tree/FnMapContactsToTreeNodes";
import { RmsEnums } from "../../../constants/Feature";
import { getFullTicketsCached } from "../../tickets/allcommon/TicketsDataStore";
import { normalizeBidKey } from "../../tickets/allcommon/FnFilterTicketTree";

export interface IFnFilterRmsEqidTreeResult {
    /** The matching EQID records after applying the filter */
    matchingEqids: IEqidDoc[];
    /** The final filtered tickets whose Ticket ID matches an EQID record and has status In Process */
    matchingTickets: ITicketDoc[];
    /** Set of lowercase BIDs present in filtered tickets */
    matchingBids: Set<string>;
    /** Set of lowercase normalized BIDs (e.g. without 'bid_' prefix) */
    matchingNormBids: Set<string>;
    /** Set of lowercase `${bid}__${cid}` pairs present in filtered tickets */
    matchingBidCidPairs: Set<string>;
    /** Map of lowercase BID -> Set of lowercase CIDs present in filtered tickets */
    matchingCidsByBid: Map<string, Set<string>>;
    /** Filtered business records matching the criteria */
    filteredBusinesses: IBusinessDoc[];
    /** Filtered contact records matching the criteria */
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
 * Checks whether a ticket status represents "In Process" / "InProgress".
 */
export function isTicketInProcess(status?: string): boolean {
    if (!status) return false;
    const clean = cleanId(status).replace(/[\s_-]+/g, "");
    return clean === "inprocess" || clean === "inprogress";
}

/**
 * Dedicated function to filter Business Tree (BS Tree) records for [RMS] EQID.
 * 
 * Flow:
 * Step 1: Load and cache EQID table data (handled by caller / React Context).
 * Step 2: Match EQID Records with Tickets (each EQID contains a TicketId; extract all valid Ticket IDs).
 * Step 3: Filter Tickets by Status ("In Process" / "InProgress").
 * Step 4: Extract BID and CID from final filtered Tickets records to generate the BS Tree.
 * 
 * @param businesses Source businesses to filter
 * @param eqidRecords Cached records from the 'eqid' table
 * @param filters Current RMS filter form values
 * @param contacts Optional source contacts to filter
 * @param tickets Optional source tickets to filter (defaults to getFullTicketsCached())
 * @returns Filtered businesses, contacts, and tree-filtering helpers
 */
export function FnFilterRmsEqidTree(
    businesses: IBusinessDoc[] = [],
    eqidRecords: IEqidDoc[] = [],
    filters: IDCFilterControlValues = {},
    contacts: IContactDoc[] = [],
    tickets: ITicketDoc[] = []
): IFnFilterRmsEqidTreeResult {
    // 1. Filter EQID records according to active filter criteria if any
    const matchingEqids = FnFilterEqidRecords(eqidRecords, filters);

    // 2. Step 2: Extract all valid Ticket IDs from EQID records using a Set for O(1) lookups
    const eqidTicketIds = new Set<string>();
    const eqidByTicketId = new Map<string, IEqidDoc>();

    for (const item of matchingEqids) {
        const tid = cleanId(
            item.ticketid ||
            (item as any).TicketId ||
            (item as any).TicketID ||
            (item as any).ticketId
        );
        if (tid) {
            eqidTicketIds.add(tid);
            if (!eqidByTicketId.has(tid)) {
                eqidByTicketId.set(tid, item);
            }
        }
    }

    // 3. Step 3: Match Tickets with EQID records & filter tickets where status is "In Process"
    const allTickets = (tickets && tickets.length > 0)
        ? tickets
        : getFullTicketsCached();

    const matchingTickets: ITicketDoc[] = [];
    const seenTicketIds = new Set<string>();

    for (const t of allTickets) {
        const tid = cleanId(t.ticketid || (t as any).TicketId || (t as any).id);
        if (!tid || !eqidTicketIds.has(tid)) {
            continue;
        }
        if (!isTicketInProcess(t.status || (t as any).Status)) {
            continue;
        }
        if (!seenTicketIds.has(tid)) {
            seenTicketIds.add(tid);
            matchingTickets.push(t);
        }
    }

    // 4. Step 4: Extract BID and CID from final filtered Tickets records
    const matchingBids = new Set<string>();
    const matchingNormBids = new Set<string>();
    const matchingBidCidPairs = new Set<string>();
    const matchingCidsByBid = new Map<string, Set<string>>();

    for (const item of matchingTickets) {
        const tid = cleanId(item.ticketid || (item as any).TicketId || (item as any).id);
        let bid = cleanId(item.bid);
        let cid = cleanId(item.cid);

        // Fallback to pattern matching on ticketid if not directly present on the ticket
        if (!bid && item.ticketid) {
            const m = String(item.ticketid).match(/bid[_-]?\d+/i);
            if (m) bid = cleanId(m[0]);
        }
        if (!cid && item.ticketid) {
            const m = String(item.ticketid).match(/cid[_-]?bid[_-]?\d+[_-]?\d+/i);
            if (m) cid = cleanId(m[0]);
        }

        // Fallback to matching EQID record for this ticket if still missing
        if (tid && eqidByTicketId.has(tid)) {
            const eqDoc = eqidByTicketId.get(tid)!;
            if (!bid) bid = cleanId(eqDoc.bid || (eqDoc as any).BID);
            if (!cid) cid = cleanId(eqDoc.cid || (eqDoc as any).CID);
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
        const b = cleanId(bid);
        const norm = normalizeBidKey(bid);
        return matchingBids.has(b) || matchingNormBids.has(norm);
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

    // 5. Filter businesses: only keep businesses whose BID matches the filtered tickets
    const filteredBusinesses: IBusinessDoc[] = [];
    const seenBids = new Set<string>();

    const sourceBusinesses = (businesses && businesses.length > 0)
        ? businesses
        : [];

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
    for (const bid of matchingBids) {
        const norm = normalizeBidKey(bid);
        if (!seenBids.has(bid) && !seenBids.has(norm)) {
            seenBids.add(bid);
            seenBids.add(norm);
            filteredBusinesses.push({
                bid,
                bname: bid,
            } as IBusinessDoc);
        }
    }

    // 6. Helper to filter contacts for a specific business
    const filterContactsForBid = (contactsToFilter: IContactDoc[], targetBid?: string): IContactDoc[] => {
        const fallbackBid = cleanId(targetBid);
        const fallbackNormBid = normalizeBidKey(targetBid);
        const result: IContactDoc[] = [];
        const seenCids = new Set<string>();

        for (const c of contactsToFilter) {
            const b = cleanId(c.bid) || fallbackBid;
            const cid = cleanId(c.cid || (c as any).EntID || (c as any).id);
            if (b && cid && isContactMatching(b, cid)) {
                if (!seenCids.has(cid)) {
                    seenCids.add(cid);
                    result.push(c);
                }
            }
        }

        // If specific business was requested, ensure any CIDs in filtered tickets but not in contactsToFilter are represented
        const expectedCids = matchingCidsByBid.get(fallbackBid) || (fallbackNormBid ? matchingCidsByBid.get(fallbackNormBid) : undefined);
        if (expectedCids) {
            for (const cid of expectedCids) {
                if (!seenCids.has(cid)) {
                    seenCids.add(cid);
                    const foundInAllContacts = contacts.find(
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

    // 7. Filter global contacts
    const filteredContacts = contacts.filter((c) => {
        const b = cleanId(c.bid);
        const cid = cleanId(c.cid || (c as any).EntID || (c as any).id);
        return isContactMatching(b, cid);
    });

    // 8. Helper to filter an existing tree of ITreeNode
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
                    const normKey = normalizeBidKey(nodeKey);
                    const hasCids = (matchingCidsByBid.get(nodeKey)?.size ?? 0) > 0 || (normKey ? (matchingCidsByBid.get(normKey)?.size ?? 0) > 0 : false);
                    return {
                        ...node,
                        children,
                        HasChildren: children.length > 0 ? 1 : hasCids ? 1 : 0,
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
        matchingEqids,
        matchingTickets,
        matchingBids,
        matchingNormBids,
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
 * Builds the complete ITreeNode hierarchy for [RMS] EQID:
 * Root Node ("Businesses (N)")
 *   |-- Business Nodes (only those whose BID matches the filtered tickets from matching EQID records with status In Process)
 *         |-- Contact Nodes (only those whose CID matches the filtered tickets for that BID)
 */
export function FnBuildRmsEqidTree(
    businesses: IBusinessDoc[] = [],
    contacts: IContactDoc[] = [],
    eqidRecords: IEqidDoc[] = [],
    filters: IDCFilterControlValues = {},
    featureProps?: IFeatureTree,
    featureId: string = RmsEnums.EQIDByTicket,
    wrapWithRootLabel: string = "Businesses",
    handleKebabMenuSelect?: (selectedItem: any) => void,
    tickets: ITicketDoc[] = []
): ITreeNode[] {
    const filterResult = FnFilterRmsEqidTree(businesses, eqidRecords, filters, contacts, tickets);
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
        const normBid = normalizeBidKey(businessBid);
        const contactsForThisBid = contacts.filter((c) => {
            const cBid = cleanId(c.bid);
            return cBid ? cBid === businessBid || normalizeBidKey(cBid) === normBid : false;
        });
        const matchedContacts = filterContactsForBid(contactsForThisBid, String(rawBid || businessBid));
        const contactNodes = FnMapContactsToTreeNodes(
            matchedContacts,
            featureProps,
            featureId,
            bNode.key as string,
            handleKebabMenuSelect
        );

        const hasMatchingCids = (matchingCidsByBid.get(businessBid)?.size ?? 0) > 0 || (normBid ? (matchingCidsByBid.get(normBid)?.size ?? 0) > 0 : false);
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
