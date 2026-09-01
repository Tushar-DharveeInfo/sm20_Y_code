import { IBusinessDoc } from "../../allinterface/IDatasets";
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
    businesses: IBusinessDoc[],
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
            bid: business.bid,
            btype: business.btype,
            salesexec: business.salesexec,
            country: business.country,
            state: business.state,
            daysnoticeperiod: business.daysnoticeperiod,
            mmfinyear: business.mmfinyear,
            relatedbids: business.relatedbids,
            datecreated: business.datecreated,
            dateupdated: business.dateupdated,
            verified: business.verified,
            status: business.status,
            bname: business.bname,
            tag: business.tag,
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
