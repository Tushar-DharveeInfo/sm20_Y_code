

import { ITreeNode } from "../../allinterface/tree/ITreeControl";


// This function returns whether checkbox on node is allowed or not
const FnCheckAllowCheckbox = (treeNode: ITreeNode, featureId?: string, instanceName?: string): boolean => {
    try {
        if (treeNode?.checkable !== undefined) {
            return Boolean(treeNode.checkable);
        }
        const nodeType = String(treeNode?.NodeType ?? treeNode?.treetype ?? '').toLowerCase();
        if (nodeType === 'contact') {
            return true;
        }
        return false;
    } catch (error) {
        console.error(
            "Error in function(FnCheckAllowCheckbox): ",
            error
        );
        return false;
    }
}
export { FnCheckAllowCheckbox }