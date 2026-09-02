
import { FnCheckAllowCheckbox } from "./FnCheckAllowCheckbox";
import { FnDeepClone } from "../basic/FnDeepClone";
import { IFeatureTree } from "../../allinterface/tree/ITreeForHierarchicalDataContainer";
import { ITreeNode } from "../../allinterface/tree/ITreeControl";
import { TreeNodeIcon } from "../../tree/treenodeicon/TreeNodeIcon";
import { TreeNodeTitle } from "../../tree/treenodetitle/TreeNodeTitle";

// This function allows to add subnode under a node with matching key
const FnAddSubNode = async (
    tree: ITreeNode[],
    parentKey: string,
    newNode: ITreeNode[],
    treeDataPorps?: IFeatureTree,
    featureId?: string,
    updateOriginalTree?: boolean,
    stepNo?: number
): Promise<ITreeNode[]> => {
    const result = FnDeepClone(tree); // Clone to prevent mutation
    try {
        let isFound = false;

        const updateNode = (nodes: ITreeNode[], nodeIndex: number = 0): void => {
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                node.stepNo = nodeIndex + 1;
                node.NaturalSortorder = i;
                if (treeDataPorps && featureId) {

                    node.title = TreeNodeTitle(node, treeDataPorps);
                    node.checkable = FnCheckAllowCheckbox(node, featureId);

                    if (treeDataPorps.allowIcon) {
                        node.icon = TreeNodeIcon(node, treeDataPorps.instanceName ?? "");
                    }

                }
                if (node.children) {
                    updateNode(node.children, nodeIndex + 1);
                }
            }
        };

        const addNode = (nodes: ITreeNode[]): void => {
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (node.key === parentKey) {
                    isFound = true;
                    node.children = newNode;
                    if (newNode.length) {
                        node.isLeaf = false;
                        node.HasChildren = 1;
                    }
                    else {
                        node.isLeaf = true;
                        node.HasChildren = 0;
                    }
                    return;
                }
                if (node.children) {
                    addNode(node.children);
                    if (isFound) return;
                }
            }
        };

        if (!updateOriginalTree) {
            updateNode(newNode, stepNo); // Prepare new children first
        }

        addNode(result); // Then add them into cloned tree
        return result;

    } catch (error) {
        console.error(
            "Error in function(FnAddSubNode): ",
            error
        );
        return result
    }
};


export { FnAddSubNode }