import type { IBusinessDoc, IContactDoc } from "../../../shared/allinterface/IDatasets";
import type { IEqidDoc } from "../../../shared/context/allinterface/IRms";
import type { IDCFilterControlValues } from "../../../shared/allinterface/searchfilter/IFilterFormContainer";
import type { ITreeNode } from "../../../shared/allinterface/tree/ITreeControl";
import type { IFeatureTree } from "../../../shared/allinterface/tree/ITreeForFlatDataContainer";
import { FnFilterEqidRecords } from "./FnFilterEqidRecords";
import { FnMapBusinessesToTreeNodes } from "../../../shared/allcommon/tree/FnMapBusinessesToTreeNodes";
import { FnMapContactsToTreeNodes } from "../../../shared/allcommon/tree/FnMapContactsToTreeNodes";

export interface IFnFilterRmsEqidTreeResult {
    /** The matching EQID records after applying the filter */
    matchingEqids: IEqidDoc[];
    /** Set of lowercase BIDs present in matching EQID records */
    matchingBids: Set<string>;
    /** Set of lowercase `${bid}__${cid}` pairs present in matching EQID records */
    matchingBidCidPairs: Set<string>;
    /** Map of lowercase BID -> Set of lowercase CIDs present in matching EQID records */
    matchingCidsByBid: Map<string, Set<string>>;
    /** Filtered business records matching the EQID criteria */
    filteredBusinesses: IBusinessDoc[];
    /** Filtered contact records matching the EQID criteria */
    filteredContacts: IContactDoc[];
    /** Helper to test if a given BID is in matching EQIDs */
    isBidMatching: (bid?: string) => boolean;
    /** Helper to test if a given (BID, CID) pair is in matching EQIDs */
    isContactMatching: (bid?: string, cid?: string) => boolean;
    /** Helper to filter an array of contacts for a specific BID */
    filterContactsForBid: (contacts: IContactDoc[], bid?: string) => IContactDoc[];
    /** Helper to filter tree nodes directly */
    filterTreeNodes: (nodes: ITreeNode[]) => ITreeNode[];
}

/**
 * Normalizes an identifier string for case-insensitive and trimmed comparison.
 */
function cleanId(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

/**
 * Dedicated function to filter Business Tree (BS Tree) records for [RMS] EQID.
 * 
 * Only Business and Contact records whose BID and CID match the EQID table
 * (after applying active RMS filter criteria: DataReady, ShapeReady, isReleased,
 * ApprovedDate, ReleasedDate) are displayed in the tree.
 * 
 * @param businesses Source businesses to filter
 * @param eqidRecords Cached records from the 'eqid' table
 * @param filters Current RMS filter form values
 * @param contacts Optional source contacts to filter
 * @returns Filtered businesses, contacts, and tree-filtering helpers
 */
export function FnFilterRmsEqidTree(
    businesses: IBusinessDoc[] = [],
    eqidRecords: IEqidDoc[] = [],
    filters: IDCFilterControlValues = {},
    contacts: IContactDoc[] = []
): IFnFilterRmsEqidTreeResult {
    // 1. Filter EQID records according to active filter criteria
    const matchingEqids = FnFilterEqidRecords(eqidRecords, filters);

    // 2. Extract matching BIDs, CIDs, and BID+CID pairs
    const matchingBids = new Set<string>();
    const matchingBidCidPairs = new Set<string>();
    const matchingCidsByBid = new Map<string, Set<string>>();

    for (const item of matchingEqids) {
        const bid = cleanId(
            item.bid ||
            (item as any).BID ||
            (item as any).businessid ||
            (item as any).BusinessID ||
            (item as any).businessId
        );
        const cid = cleanId(
            item.cid ||
            (item as any).CID ||
            (item as any).contactid ||
            (item as any).ContactID ||
            (item as any).contactId
        );

        if (bid) {
            matchingBids.add(bid);
            if (!matchingCidsByBid.has(bid)) {
                matchingCidsByBid.set(bid, new Set<string>());
            }
            if (cid) {
                matchingCidsByBid.get(bid)!.add(cid);
                matchingBidCidPairs.add(`${bid}__${cid}`);
            }
        }
    }

    const isBidMatching = (bid?: string): boolean => {
        if (!bid) return false;
        return matchingBids.has(cleanId(bid));
    };

    const isContactMatching = (bid?: string, cid?: string): boolean => {
        const b = cleanId(bid);
        const c = cleanId(cid);
        if (!b || !c) return false;
        return matchingBidCidPairs.has(`${b}__${c}`) || (matchingCidsByBid.get(b)?.has(c) ?? false);
    };

    // 3. Filter businesses: only keep businesses whose BID matches the filtered EQID table
    const filteredBusinesses: IBusinessDoc[] = [];
    const seenBids = new Set<string>();

    for (const b of businesses) {
        const bid = cleanId(b.bid || (b as any).EntID || (b as any).id);
        if (bid && matchingBids.has(bid)) {
            if (!seenBids.has(bid)) {
                seenBids.add(bid);
                filteredBusinesses.push(b);
            }
        }
    }

    // Ensure all matching BIDs have a business entry even if missing from sourceBusinesses
    for (const bid of matchingBids) {
        if (!seenBids.has(bid)) {
            seenBids.add(bid);
            filteredBusinesses.push({
                bid,
                bname: bid,
            } as IBusinessDoc);
        }
    }

    // 4. Helper to filter contacts for a specific business
    const filterContactsForBid = (contactsToFilter: IContactDoc[], targetBid?: string): IContactDoc[] => {
        const fallbackBid = cleanId(targetBid);
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

        // If specific business was requested, ensure any CIDs in EQID table but not in contactsToFilter are represented
        if (fallbackBid && matchingCidsByBid.has(fallbackBid)) {
            const expectedCids = matchingCidsByBid.get(fallbackBid)!;
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
        matchingEqids,
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
 * Builds the complete ITreeNode hierarchy for [RMS] EQID:
 * Root Node ("Businesses (N)")
 *   |-- Business Nodes (only those whose BID matches the filtered EQID table)
 *         |-- Contact Nodes (only those whose CID matches the filtered EQID table for that BID)
 */
export function FnBuildRmsEqidTree(
    businesses: IBusinessDoc[] = [],
    contacts: IContactDoc[] = [],
    eqidRecords: IEqidDoc[] = [],
    filters: IDCFilterControlValues = {},
    featureProps?: IFeatureTree,
    featureId: string = "402",
    wrapWithRootLabel: string = "Businesses",
    handleKebabMenuSelect?: (selectedItem: any) => void
): ITreeNode[] {
    const filterResult = FnFilterRmsEqidTree(businesses, eqidRecords, filters, contacts);
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
