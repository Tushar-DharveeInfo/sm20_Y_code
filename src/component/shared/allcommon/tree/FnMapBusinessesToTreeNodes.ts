import { IBusiness } from "../../allinterface/tree/IBusiness";
import { ITreeNode } from "../../allinterface/tree/ITreeControl";
import { IFeatureTree } from "../../allinterface/tree/ITreeForFlatDataContainer";
import { TreeNodeTitle } from "../../tree/treenodetitle/TreeNodeTitle";

/**
 * Maps business records to ITreeNode[].
 * Accepts data from sample JSON or a future API response so the call  can swap sources.
 *
 * - title / Name: bname
 * - IsAuthorized: verified (rendered as check icon in TreeNodeTitle)
 * - Description: status (used as node tooltip)
 * - icon: not set (null)
 */
const FnMapBusinessesToTreeNodes = (
    businesses: IBusiness[],
    featureTreeProps?: IFeatureTree,
    featureId?: string
): ITreeNode[] => {
    if (!businesses?.length) {
        return [];
    }

    return businesses.map((business) => {
        const treeNode: ITreeNode = {
            key: business.bid,
            NodeEntID: business.bid,
            EntID: business.bid,
            NodeEntityname: "Business",
            NodeType: "Business",
            Name: business.bname,
            Description: business.status,
            NodeState: business.status,
            IsAuthorized: business.verified,
            title: business.bname,
            icon: null,
            children: [],
            treetype: "Business",
            Type: business.btype,
            parentEntID: null,
            stepNo: 0,
            HasChildren: 1,
            isLeaf: false,
            checkable: false,
            btype: business.btype,
            salesExec: business.salesExec,
            country: business.country,
            state: business.state,
            daysNoticePeriod: business.daysNoticePeriod,
            mmFinYear: business.mmFinYear,
            relatedBids: business.relatedBids,
            dateCreated: business.dateCreated,
            dateUpdated: business.dateUpdated,
            verified: business.verified,
            status: business.status,
            bname: business.bname,
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

export { FnMapBusinessesToTreeNodes };
