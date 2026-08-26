
import { IMenuItem } from "../menu/IMainMenu";
import { ITreeNode } from "../tree/ITreeControl";

interface ISidebarContent {
    Label: string;
    uniqueName: string; // A unique identifier for notes
    featureId: string;
    selectedNode: ITreeNode; //selected node data
    subTreeFeatureId?: string;//to handle custom logic 
    selectedNodeMenu?: IMenuItem | undefined // select nodemenu data
    treeData?: ITreeNode[] | null; // tree data for the sidebar
    selectedNodeExplorer?: ITreeNode;
    isPropertyFound?: boolean; // to check property tab is available or not
    handleReloadTree?: (featureId: string, entID?: string) => void;
    apValueChange?: (value: any, EntID: string, event: unknown, selectedData: unknown, instanceName?: string) => void; // ap form value change
    handleShowErrorDialog?: (message: string, isOpen: boolean) => void;
}

export type { ISidebarContent }