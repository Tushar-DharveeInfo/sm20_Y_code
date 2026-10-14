import { IContactDoc } from "@n20a/libfsdb";
import { ITreeNode } from "../../allinterface/tree/ITreeControl";
import { IFeatureTree } from "../../allinterface/tree/ITreeForFlatDataContainer";
import { TreeNodeTitle } from "../../tree/treenodetitle/TreeNodeTitle";
import { isTicketsFeature } from "../../../features/tickets/allcommon/FnFilterTicketTree";

/**
 * Maps contact records to ITreeNode[].
 * Accepts data from sample JSON or a future API response so the call  can swap sources.
 *
 * - title / Name: cname (or cid in Tickets features)
 * - IsAuthorized: monitor (rendered as check icon in TreeNodeTitle, false for Tickets)
 * - Description: status (used as node tooltip)
 * - icon: not set (null)
 */
const FnMapContactsToTreeNodes = (
    contacts: IContactDoc[],
    featureTreeProps?: IFeatureTree,
    featureId?: string,
    parentEntID?: string | null,
    handleKebabMenuSelect?: (selectedItem: any) => void
): ITreeNode[] => {
    if (!contacts?.length) {
        return [];
    }

    const isTickets = isTicketsFeature(featureId);

    // Contacts ordered by numeric CID for Tickets, or lastupdated z-a (descending) for others
    const sortedContacts = [...contacts].sort((a, b) => {
        if (isTickets) {
            return String(a.cid || a.cname || '').localeCompare(String(b.cid || b.cname || ''), undefined, { numeric: true });
        }
        const timeA = new Date((a as any).lastupdated || a.dateupdated || (a as any).dateUpdated || a.datecreated || 0).getTime() || 0;
        const timeB = new Date((b as any).lastupdated || b.dateupdated || (b as any).dateUpdated || b.datecreated || 0).getTime() || 0;
        if (timeB !== timeA) return timeB - timeA;
        return String(a.cname ?? a.cid ?? "").localeCompare(String(b.cname ?? b.cid ?? ""));
    });

    return sortedContacts.map((contact) => {
        const uniqueKey = (contact.cid && contact.cid.toLowerCase() !== contact.bid?.toLowerCase())
            ? contact.cid
            : `contact_${contact.cid || contact.bid}`;
        const displayName = isTickets ? (contact.cid || contact.cname) : (contact.cname || contact.cid);
        const treeNode: ITreeNode = {
            key: uniqueKey,
            NodeEntID: contact.cid,
            EntID: contact.cid,
            NodeEntityname: "Contact",
            NodeType: "Contact",
            Name: displayName,
            Description: isTickets ? "" : contact.status,
            NodeState: isTickets ? "" : contact.status,
            IsAuthorized: isTickets ? false : contact.monitor,
            title: displayName,
            icon: null,
            children: [],
            treetype: "Contact",
            Type: contact.contacttype,
            parentEntID: parentEntID ?? contact.bid,
            stepNo: 1,
            HasChildren: 0,
            isLeaf: true,
            checkable: !isTickets,
            bid: contact.bid,
            cid: contact.cid,
            contacttype: contact.contacttype,
            email: contact.email,
            phone: contact.phone,
            address1: contact.address1,
            city: contact.city,
            state: contact.state,
            country: contact.country,
            zip: contact.zip,
            datecreated: contact.datecreated,
            dateupdated: contact.dateupdated,
            monitor: contact.monitor,
            status: contact.status,
            cname: contact.cname,
            verified: isTickets ? false : ((contact as any).verified !== undefined ? Boolean((contact as any).verified) : Boolean(contact.monitor)),
        };

        if (featureTreeProps && featureId && !isTickets) {
            treeNode.title = TreeNodeTitle(
                treeNode,
                featureTreeProps,
                featureId,
                !featureTreeProps.hideKebabMenu,
                !featureTreeProps.hideCopyIcon,
                undefined,
                handleKebabMenuSelect
            );
        }

        return treeNode;
    });
};

export { FnMapContactsToTreeNodes };
