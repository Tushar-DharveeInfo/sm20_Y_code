

import { ITreeNode } from "../../allinterface/tree/ITreeControl";


//This function return whether checkbox on node allowed or not
const FnCheckAllowCheckbox = (treeNode: ITreeNode, featureId: string, instanceName?: string) => {
    try {


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