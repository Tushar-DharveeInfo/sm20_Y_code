
import { EventDataNode, Key } from "rc-tree/lib/interface";
import { CheckInfo } from "rc-tree/lib/Tree";
import { NodeDragEventParams } from "rc-tree/lib/contextTypes";
import { ISelectedNodeInfo } from "../allinterface/tree/ITreeControl";
import { ITreeNode } from "../allinterface/tree/ITreeControl";
import { IActionImageForSubMenu } from "../allinterface/basic/IActionImageList";

type IFlatExplorerApiData = Record<string, unknown[]> | null;

type IHierarchyJsonResponse = {
    hierarchyJson?: string;
};

type IDeviceJsonResponse = {
    deviceJson?: string;
};

type IEmPropertyDefaults = Record<string, string | null | undefined>;

type IDeviceMorePropertyRow = Record<string, unknown>;

type IDevicePropertyItem = {
    PropertyLabel?: string;
    PropertyValue?: string;
};

type IKebabMenuPayload = Record<string, unknown> & {
    Label?: string;
};

type IWorkOrderResultData = {
    workorderProfile?: { _WorkorderProfile?: string }[];
};

type IExplorerPrevDeps = {
    featureId?: string;
    nodeId?: string | null;
    subTreeFeatureId?: string;
    uniqueName?: string;
    reloadCache?: boolean;
    hierarchyRecords?: Record<string, unknown>;
};


type ISessionUpdateApiResponse = {
    jsonSessionOutput?: unknown;
};

type IAutoExpandTreeNodesResult = {
    updatedTreeData: ITreeNode[];
    currentExpandedKeys: Key[];
    selectedNodeKey: Key[] | null;
    selectedNodeData: ISelectedNodeInfo | null;
    updatedOriginalData: ITreeNode[];
    expandedNodes: ITreeNode[];
};

type ITreeDropInfo = NodeDragEventParams<ITreeNode> & {
    dragNode: EventDataNode<ITreeNode>;
    dragNodesKeys: Key[];
    dropPosition: number;
    dropToGap: boolean;
};

interface IDcSearchParams {
    isDisableSearch: boolean;
    eqidToSearch?: string;
    hierarchyToSearch?: string;
    entId?: string;
}

interface ITreeExplorerContainer {
    uniqueName: string; // Unique name for the container instance
    featureId: string; // Unique identifier for the feature being represented
    isReloadTreeCache?: boolean;
    subTreeFeatureId?: string;//this will be used to control tree
    originalTreeData?: ITreeNode[];//for use from cache
    allowAdd?: boolean; // Enables the ability to add new items (optional)
    addLabel?: string; // Custom label for Add button
    addTooltip?: string; // Custom tooltip for Add button
    addActionCode?: string; // Custom action code for Add button
    disableAdd?: boolean; // Disable the Add button
    allowAddBusiness?: boolean; // Enables the ability to add business items (optional)
    allowAddContact?: boolean; // Enables the ability to add contact items (optional)
    allowEdit?: boolean; // Enables the ability to edit existing items (optional)
    allowDelete?: boolean; // Enables the ability to delete items (optional)
    treeDataFor?: string;// used to handle conditions for drag and drop event
    selectedNodeExplorer?: ISelectedNodeInfo;// selected node of main explorer tree
    allowCheckbox?: boolean; // Enables checkboxes on checkable nodes (e.g. contacts)
    businessesOnly?: boolean; // when true, suppress contact loading on expand (show businesses only)
    defaultCheckedKeys?: Key[];//default checked node
    defaultSelectedKeys?: Key[];//default checked node
    /*When set, wraps business nodes under a single root (e.g. "Businesses"). */
    wrapWithRootLabel?: string;
    handleAIClick?: (event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>, actionCode?: string) => void;
    handleNodeCheck?: (checked: TNodeCheckState, info: CheckInfo<ITreeNode>) => void;
    handleNodeSelect?: (selectedKeys: Key[], info: ISelectedNodeInfo, expandedKeys: Key[], newTreeData?: ITreeNode[], isShowSidebar?: boolean) => void;
    handleKebabMenuSelect?: (selectedItem: IActionImageForSubMenu, selectedNodeInfo: ISelectedNodeInfo, currentTreeData?: ITreeNode[]) => void;//Handle kebabmenu select action if needed
    updateOriginalTreeDataset?: (updatedTreedata: ITreeNode[], expandedKeys: Key[], selectedKeys: Key[], userTreeData: ITreeNode[] | null) => void;
    clearCacheTreeData?: () => void;
    updateStatusBarData?: (statusBarObject: string, isReplace?: boolean) => void;
    handleShowUserMessage?: (messageText: string, container?: HTMLDivElement, isShowAsPrompt?: boolean) => void;
}
type IStrictCheckedKeys = {
    checked: Key[];
    halfChecked: Key[];
};

type TNodeCheckState = Key[] | IStrictCheckedKeys;

export type {
    ITreeExplorerContainer,
    IFlatExplorerApiData,
    IHierarchyJsonResponse,
    IDeviceJsonResponse,
    IEmPropertyDefaults,
    IDeviceMorePropertyRow,
    IDevicePropertyItem,
    IKebabMenuPayload,
    IWorkOrderResultData,
    IExplorerPrevDeps,
    ISessionUpdateApiResponse,
    IAutoExpandTreeNodesResult,
    ITreeDropInfo,
    IDcSearchParams,
    TNodeCheckState,
    IStrictCheckedKeys
}
