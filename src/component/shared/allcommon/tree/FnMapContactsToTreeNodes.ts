import { IContactDoc } from "../../allinterface/IDatasets";
import { ITreeNode } from "../../allinterface/tree/ITreeControl";
import { IFeatureTree } from "../../allinterface/tree/ITreeForFlatDataContainer";
import { TreeNodeTitle } from "../../tree/treenodetitle/TreeNodeTitle";

/**
 * Maps contact records to ITreeNode[].
 * Accepts data from sample JSON or a future API response so the call  can swap sources.
 *
 * - title / Name: cname
 * - IsAuthorized: monitor (rendered as check icon in TreeNodeTitle)
 * - Description: status (used as node tooltip)
 * - icon: not set (null)
 */
const FnMapContactsToTreeNodes = (
    contacts: IContactDoc[],
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
            Name: contact.cname,
            Description: contact.status,
            NodeState: contact.status,
            IsAuthorized: contact.monitor,
            title: contact.cname,
            icon: null,
            children: [],
            treetype: "Contact",
            Type: contact.contacttype,
            parentEntID: parentEntID ?? contact.bid,
            stepNo: 1,
            HasChildren: 0,
            isLeaf: true,
            checkable: false,
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
