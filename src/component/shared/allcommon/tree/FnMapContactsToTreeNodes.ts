import { IContact } from "../../allinterface/tree/IContact";
import { ITreeNode } from "../../allinterface/tree/ITreeControl";
import { IFeatureTree } from "../../allinterface/tree/ITreeForFlatDataContainer";
import { TreeNodeTitle } from "../../tree/treenodetitle/TreeNodeTitle";

/**
 * Maps contact records to ITreeNode[].
 * Accepts data from sample JSON or a future API response so the call  can swap sources.
 *
 * - title / Name: contact
 * - IsAuthorized: verified (rendered as check icon in TreeNodeTitle)
 * - Description: status (used as node tooltip)
 * - icon: not set (null)
 */
const FnMapContactsToTreeNodes = (
    contacts: IContact[],
    featureTreeProps?: IFeatureTree,
    featureId?: string,
    parentEntID?: string | null
): ITreeNode[] => {
    if (!contacts?.length) {
        return [];
    }

    return contacts.map((contact) => {
        const treeNode: ITreeNode = {
            key: contact.cid,
            NodeEntID: contact.cid,
            EntID: contact.cid,
            NodeEntityname: "Contact",
            NodeType: "Contact",
            Name: contact.contact,
            Description: contact.status,
            NodeState: contact.status,
            IsAuthorized: contact.verified,
            title: contact.contact,
            icon: null,
            children: [],
            treetype: "Contact",
            Type: contact.ctype,
            parentEntID: parentEntID ?? contact.bid,
            stepNo: 1,
            HasChildren: 0,
            isLeaf: true,
            checkable: false,
            bid: contact.bid,
            ctype: contact.ctype,
            email: contact.email,
            phone1: contact.phone1,
            phone2: contact.phone2,
            address_street: contact.address_street,
            address_city: contact.address_city,
            address_state: contact.address_state,
            address_zip: contact.address_zip,
            address_country: contact.address_country,
            dateCreated: contact.dateCreated,
            dateUpdated: contact.dateUpdated,
            verified: contact.verified,
            status: contact.status,
            contact: contact.contact,
        };

        if (featureTreeProps && featureId) {
            treeNode.title = TreeNodeTitle(
                treeNode,
                featureTreeProps,
                featureId,
                !featureTreeProps.hideKebabMenu,
                !featureTreeProps.hideCopyIcon
            );
        }

        return treeNode;
    });
};

export { FnMapContactsToTreeNodes };
