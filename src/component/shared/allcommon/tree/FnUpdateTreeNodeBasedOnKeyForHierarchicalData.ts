
import { Key } from "rc-tree/lib/interface";
import { ITreeForHierarchicalDataContainer } from "../../allinterface/tree/ITreeForHierarchicalDataContainer";
import { ISelectedNodeInfo, ITreeNode } from "../../allinterface/tree/ITreeControl";
import { TreeNodeTitle } from "../../tree/treenodetitle/TreeNodeTitle";
import { IActionImageForSubMenu } from "../../allinterface/basic/IActionImageList";

import { RmsEnums } from "../../../constants/Feature";

// This function will update tree node if HideKebabMenu or HideCopyIcon is false
const FnUpdateTreeNodeBasedOnKeyForHierarchicalData = (
    treeData: ITreeNode[],            // Hierarchical tree data
    key: Key,                   // Key to match the node
    showCopyIcon: boolean,      // show/hide copy icon
    showKebabIcon: boolean,       // Show tooltip
    treeContainerProps: ITreeForHierarchicalDataContainer,
    selectedNodeExplorer: ISelectedNodeInfo | null = null,   // Explorer node
    handleKebabMenuSelect?: (selectedItem: IActionImageForSubMenu) => void
): ITreeNode[] => {
    try {
        // Loop through each node
        for (const item of treeData) {
            // Check if the current node matches the key
            if (item.key === key) {
                const isEqidByMfg =
                    treeContainerProps.featureId === '404' ||
                    treeContainerProps.featureId === RmsEnums.EQIDByMfg;
                const isShapeStyle =
                    item.NodeType === 'ShapeStyle' ||
                    item.nodeType === 'ShapeStyle' ||
                    String(item.NodeType || '').toLowerCase() === 'shapestyle' ||
                    String(item.nodeType || '').toLowerCase() === 'shapestyle';
                const isEqType =
                    item.NodeType === 'EqType' ||
                    item.nodeType === 'EqType' ||
                    String(item.NodeType || '').toLowerCase() === 'eqtype' ||
                    String(item.nodeType || '').toLowerCase() === 'eqtype';
                const isEqid =
                    item.NodeType === 'EQID' ||
                    item.nodeType === 'EQID' ||
                    String(item.NodeType || '').toLowerCase() === 'eqid' ||
                    String(item.nodeType || '').toLowerCase() === 'eqid';
                const nodeKebabAllowed = isEqidByMfg ? (showKebabIcon && (isShapeStyle || isEqType || isEqid)) : showKebabIcon;

                // Update the matched node
                item.title = TreeNodeTitle(
                    item,
                    treeContainerProps.featureTreeProps,
                    treeContainerProps.featureId,
                    nodeKebabAllowed,
                    showCopyIcon,
                    selectedNodeExplorer || ({ node: item } as ISelectedNodeInfo),
                    handleKebabMenuSelect
                );
            } else if (typeof item.title !== 'string') {
                item.title = item.TableLabel || item.Name || item.Description || '';
            }

            // Recursively check children
            if (item.children && item.children.length > 0) {
                FnUpdateTreeNodeBasedOnKeyForHierarchicalData(
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
            "Error in function(FnUpdateTreeNodeBasedOnKeyForHierarchicalData): ",
            error
        );
    }
    // Return updated treeData
    return treeData;
};
export { FnUpdateTreeNodeBasedOnKeyForHierarchicalData }