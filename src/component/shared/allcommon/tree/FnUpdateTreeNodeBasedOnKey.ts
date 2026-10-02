import { Key } from "rc-tree/lib/interface";
import { ITreeForFlatDataContainer } from "../../allinterface/tree/ITreeForFlatDataContainer";
import { ISelectedNodeInfo, ITreeNode } from "../../allinterface/tree/ITreeControl";
import { TreeNodeTitle } from "../../tree/treenodetitle/TreeNodeTitle";
import { IActionImageForSubMenu } from "../../allinterface/basic/IActionImageList";
import { SettingEnums } from "../../../constants/Feature";

// This function will update tree node if HideKebabMenu or HideCopyIcon is false
const FnUpdateTreeNodeBasedOnKey = async (
    treeData: ITreeNode[],            // Hierarchical tree data
    key: Key,                   // Key to match the node
    showCopyIcon: boolean,      // show/hide copy icon
    showKebabIcon: boolean,       // Show tooltip
    treeContainerProps: ITreeForFlatDataContainer,
    selectedNodeExplorer: ISelectedNodeInfo | null = null,   // Explorer node
    handleKebabMenuSelect?: (selectedItem: IActionImageForSubMenu) => void
): Promise<ITreeNode[]> => {
    try {

        // Loop through each node
        for (const item of treeData) {
            // Check if the current node matches the key
            if (item.key === key) {
                const isContactNode = Boolean(
                    item.NodeType?.toLowerCase() === "contact" ||
                    item.treetype?.toLowerCase() === "contact" ||
                    item.NodeEntityname?.toLowerCase() === "contact" ||
                    (item.cid && item.cid !== item.bid)
                );
                const isSettingDeleteFeature =
                    treeContainerProps.featureId === SettingEnums.Delete ||
                    treeContainerProps.featureId === "920" ||
                    String(treeContainerProps.featureId).toLowerCase() === "delete";
                const isRootNode = item.key === "root-businesses" || item.NodeType?.toLowerCase() === "root";
                const allowKebab = showKebabIcon && (isContactNode || (isSettingDeleteFeature && !isRootNode));

                // Update the matched node
                item.title = TreeNodeTitle(
                    item,
                    treeContainerProps.featureTreeProps,
                    treeContainerProps.featureId,
                    allowKebab,
                    showCopyIcon,
                    selectedNodeExplorer || ({ node: item } as ISelectedNodeInfo),
                    handleKebabMenuSelect
                );
                return treeData; // Return updated tree
            }

            // Recursively check children
            if (item.children && item.children.length > 0) {
                await FnUpdateTreeNodeBasedOnKey(
                    item.children,
                    key,
                    showCopyIcon,
                    showKebabIcon,
                    treeContainerProps,
                    selectedNodeExplorer,
                    handleKebabMenuSelect
                );
            }
        }
    } catch (error) {
        console.error(
            "Error in function(FnUpdateTreeNodeBasedOnKey): ",
            error
        );
    }
    // Return updated treeData
    return treeData;
};
export { FnUpdateTreeNodeBasedOnKey };
