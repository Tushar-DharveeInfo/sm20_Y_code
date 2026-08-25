
import { Key } from "rc-tree/lib/interface";
import { CheckInfo, DraggableConfig, DraggableFn } from "rc-tree/lib/Tree";
import { ITreeNode, ISelectedNodeInfo } from "./ITreeControl";
import { IActionImageForSubMenu } from "../basic/IActionImageList";

// this will be used for return type for function FnCheckToSkipNodeForFeature
interface IShouldSkip {
    shouldSkip: boolean;
    foundInChildren: boolean;
    isCheckedInChildren: boolean;
}
//this will be used for return type for function FnGetVisibleNodesBasedOnExpandedKeys
interface IFilterResults {
    visibleTree: ITreeNode[] | null;
    selectedNodeInfo: ITreeNode | null;
}


interface IFeatureTree {
    hideKebabMenu?: boolean;// if true kebab menu on node will not show
    allowCheckbox?: boolean;// Whether checkboxes are enabled for nodes
    allowIcon?: boolean;// Whether icons should be displayed for nodes
    hideCopyIcon?: boolean;// if true copy icon on node will not show
    reuseFromCache?: boolean;// whether to reuse from cache but it will used for treeContainerForFlatData
    instanceName?: string;// instancename for the tree unique to apply condition if needed
    isAllowDrag?: boolean;// to allow drag on node
    isAllowDrop?: boolean;// to allow drop on node
    allowCheckStrictly?: boolean;// Whether checkboxes follow strict hierarchy rules
    allowInternalDrag?: boolean | DraggableFn | DraggableConfig | undefined;// Whether internal drag-and-drop is enabled
    multiRootNode?: boolean;// whether tree is multiroot or not
    openAllNodes?: boolean;// Whether all nodes should be expanded by default
    allowCustomCheck?: boolean;//If true user need to handle handleCheck event 
    disableSelection?: boolean;// Disable selection of node
}


interface ITreeForFlatDataContainer {
    uniqueName: string; // Unique identifier for the TreeControl component
    flatAPIData: any; // API data that are flat and can be converted to hierarchy
    featureId: string;// featureId that will be handled  
    featureTreeProps: IFeatureTree;//Tree Control props 
    isSiteByTenant?: boolean;// This flag will change the hierarchy of Tree in Google Map 
    isFloorTree?: boolean;// indicates that whether tree is for Floor Pane or not 
    allowAPICallOnExpand?: boolean; // Whether API calls are allowed on node expansion
    allowAdd?: boolean; // Whether adding nodes is allowed
    allowEdit?: boolean; // Whether editing nodes is allowed
    allowDelete?: boolean; // Whether deleting nodes is allowed
    allowMultiple?: boolean; // Whether multiple node selection is allowed
    className?: string; // Optional CSS class name for styling
    treeDataFor?: string; // This is used for Device Model whether it is "0" forLibrary or "1" for Inventory 
    selectedNodeExplorer?: { event: 'select'; selected: boolean; node: ITreeNode; selectedNodes: ITreeNode[]; nativeEvent: MouseEvent; }; // Explorer pane node if needed
    handleAIClick?: (event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>, actionCode?: string) => void; // Callback for AI button click
    handleNodeCheck?: (checked: Key[] | { checked: Key[]; halfChecked: Key[]; }, info: CheckInfo<ITreeNode>) => void;
    handleNodeSelect?: (selectedKeys: Key[], info: ISelectedNodeInfo, expandedKeys: Key[]) => void;
    handleKebabMenuSelect?: (selectedItem: IActionImageForSubMenu) => void;//Handle kebabmeu select action if needed
}
export type { ITreeForFlatDataContainer, IFeatureTree, IShouldSkip, IFilterResults }