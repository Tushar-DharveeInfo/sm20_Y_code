
import { useEffect, useRef, useState } from 'react'
import { OpenSidebar24x24 } from '@n20a/libicon'
import { Splitter, SplitterPanel, SplitterResizeEndEvent } from 'primereact/splitter'
import { Key } from 'rc-tree/lib/interface'
import { useSearchParams } from 'react-router-dom'
import './ExplorerContainer.css'
import { FeatureQARange, LibraryEnums } from '../../constants/Feature';
// import { FnFindNearestNodeByType } from '../../shared/allcommon/FnFindNearestNodeByType'
import { useCommonVariableContext } from '../../shared/context/hooks/CommonVariableHooks'
import { useSelectedNodeContext } from '../../shared/context/hooks/SelectedNodeHooks'
import { useSessionContext } from '../../shared/context/hooks/SessionHooks'
// import { useStatusBarContext } from '../../shared/context/hooks/StatusBarHooks'
import { ISession } from '../../shared/context/allinterface/ISession'
import { IFeatureItem } from '../../shared/context/allinterface/IMainApp'
import { IMenuItem } from '../../shared/allinterface/menu/IMainMenu'
import { ISelectedNodeInfo, ITreeNode } from '../../shared/allinterface/tree/ITreeControl'

import { Label } from '../../shared/basic/label/Label'
import { ActionImage } from '../../shared/basic/actionimage/ActionImage'
import { FnGetCssVariable } from '../allcommon/FnGetCssVariable'
import { DcExplorerContainer } from '../../shared/dcexplorercontainer/DcExplorerContainer'
import { SidebarContainer } from '../sidebarcontainer/SidebarContainer'
import { FeatureRenderContainer } from '../featurecontainer/FeatureRenderContainer'
import { ILibraryTicketMode } from '../../features/library/librarytickets/ticketexplorercontainer/TicketExplorerContainer'
import { YesNoFormContainer } from '../../shared/basic/yesnoformcontainer/YesNoFormContainer'
import { useMainAppContext } from '../../shared/context/hooks/MainAppHooks'
import { CheckInfo } from 'rc-tree/lib/Tree'

const ReuseDataForFeatures: string[] = [];

interface IExplorerContainer {
    uniqueName: string;//unique identifier for the control
    featureId: string;
    featureData: IFeatureItem[];
    allowShowHeader: boolean;
    originalTreeData?: ITreeNode[];
    selectedKebabMenu?: IMenuItem;// for handle kebabmenu to select featureQa
    subTreeFeatureId?: string;// this will be used for second tree in the page to render
    headerText?: string;
    selectedFeatureData?: IMenuItem;
    selectedNodeExplorer?: ISelectedNodeInfo;// for use in sidebar to show properties 
    tabIndex?: string;
    selectedNodeForCustomization?: ITreeNode;
    updateOriginalTreeDataset?: (updatedTreedata: ITreeNode[], expandedKeys: Key[], selectedKeys: Key[], userTreeData: ITreeNode[] | null) => void;
    handleReloadTree?: (featureId: string, entID?: string) => void;
    handleCloseSidebar?: () => void;
    clearCacheTreeData?: () => void;
    updateStatusBarData?: (statusBarObject: string, isReplace?: boolean) => void;
    handleShowUserMessage?: (messageText: string, container?: HTMLDivElement, isShowAsPrompt?: boolean) => void;

}
const ExplorerContainer = (explorerContainerProps: IExplorerContainer) => {
    console.log('explorerContainerProps', explorerContainerProps)
    const [selectedNodeInfo, setSelectedNodeInfo] = useState<ISelectedNodeInfo>();
    const [isShowSidebar, setIsShowSidebar] = useState<boolean>(false);
    const [originalTreeData, setOriginalTreeData] = useState<ITreeNode[]>([]);
    const [originalTreeDataForInventory, setOriginalTreeDataForInventory] = useState<ITreeNode[]>([]);
    const [featureQAData, setFeatureQAData] = useState<IFeatureItem[]>();
    const [showSidebarFullWidth, setShowSidebarFullWidth] = useState<boolean>(false);
    const [isSidebar, setIsSidebar] = useState<string | undefined>("sidebarOpen");
    const [libraryMode, setLibraryMode] = useState<ILibraryTicketMode>("all")
    const [defaultCheckedKeys, setDefaultCheckedKeys] = useState<Key[]>([]);
    const [manuallyNodeSelected, setManuallyNodeSelected] = useState<boolean>(false);
    const [confirmMessage, setConfirmMessage] = useState<string>("");
    const [isShowOkButton, setIsShowOkButton] = useState<boolean>();
    const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
    // The feature-change effect that used to pick the explorer is commented out, so the BS tree is always rendered.
    const [explorerToRender, setExplorerToRender] = useState<"BS" | "NONE" | "MCS">("BS");
    const [activeView] = useState<"INVENTORY" | "DEFAULT">("DEFAULT");
    const [treeData, setTreeData] = useState<ITreeNode[]>();
    const [selectedKebabMenuExplorer] = useState<IMenuItem>();

    const [isShowSidebarIcon] = useState<boolean>(true);

    const [searchParams] = useSearchParams();

    // const mainAppContext = useMainAppContext();
    const commonVariableContext = useCommonVariableContext();
    // const statusBarContext = useStatusBarContext();
    const sessionContext = useSessionContext();
    const selectedNodeContext = useSelectedNodeContext();
    const mainAppContext = useMainAppContext();

    // const isAllowNewAuditRef = useRef<boolean>(false);
    const originalTreeDataRef = useRef<ITreeNode[]>(explorerContainerProps.originalTreeData);
    const defaultCheckedKeyRef = useRef<Key[]>([]);
    const featureIdRef = useRef(explorerContainerProps.featureId);
    const outerTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // const navigate = useNavigate();

    // Clears explorer tree refs when container unmounts.
    useEffect(() => {
        return () => {
            originalTreeDataRef.current = []
            defaultCheckedKeyRef.current = []
        }
    }, [])

    // Keeps latest feature id in ref for deferred callbacks.
    useEffect(() => {
        featureIdRef.current = explorerContainerProps.featureId;
        const fnGetLibMode = () => {
            if (LibraryEnums.RequestsReceived === explorerContainerProps.featureId) {
                return "received"
            } else if (LibraryEnums.ApprovedTickets === explorerContainerProps.featureId) {
                return "accepted"
            } else {
                return "all"
            }
        }
        setDefaultCheckedKeys([])
        const MSCTree = [LibraryEnums.McsDevelopment, LibraryEnums.ApprovedTickets, LibraryEnums.RequestsReceived] as string[]
        if (explorerContainerProps.featureId && MSCTree.includes(explorerContainerProps.featureId)) {
            setExplorerToRender("MCS");
        } else {
            setExplorerToRender("BS");
        }
        setLibraryMode(fnGetLibMode() as ILibraryTicketMode) //fnGetLibMode()
        // setSelectedFloorNode(undefined);
    }, [explorerContainerProps.featureId]);

    // Opens sidebar when node is selected directly from native tree events.
    useEffect(() => {
        setManuallyNodeSelected(false);
        if (explorerContainerProps.selectedNodeExplorer?.nativeEvent) {
            setIsShowSidebar(true);
        }
    }, [explorerContainerProps.selectedNodeExplorer?.nativeEvent,
    explorerContainerProps.selectedNodeExplorer?.node?.NodeType
    ])

    // Clears transient timeout handles on unmount.
    useEffect(() => {
        return () => {
            if (outerTimeoutIdRef.current) clearTimeout(outerTimeoutIdRef.current);
            if (retryTimeoutIdRef.current) clearTimeout(retryTimeoutIdRef.current);
        };
    }, []);

    // Handles tree selection, session updates, and contextual layout/sidebar state.
    const handleNodeSelect = async (_selectedKeys: Key[], info: ISelectedNodeInfo, _expandedKeys: Key[], newTreeData?: ITreeNode[], _isSiteByTenant?: "AllSites" | "TenantsBySite" | "SitesByTenant", isShowSidebar?: boolean) => {

        if (!explorerContainerProps.subTreeFeatureId) {
            selectedNodeContext.setSelectedNodeExplorer(info.node);
        }

        else {
            selectedNodeContext.setSelectedNode(info.node);
            setSelectedNodeInfo(info);
        }
        // Open sidebar when this feature has QA tabs in smFeatures.
        const hasSidebarQa = (explorerContainerProps.featureData ?? []).some((item) => {
            const qaId = Number(item._Feature);
            return (
                String(item.MenuID) === String(explorerContainerProps.featureId)
                && Number.isFinite(qaId)
                && qaId > FeatureQARange.MIN
                && qaId < FeatureQARange.MAX
            );
        });
        if (hasSidebarQa || isShowSidebar) {
            setIsShowSidebar(true);
            setIsSidebar('sidebarOpen');
        }
        if (info.event === "select") {
            setManuallyNodeSelected(true);
        }
        else {
            const sidebarVar = sessionContext.SessionList.find((sessionvar) => { return sessionvar.VariableName === "Sidebar" });
            if (sidebarVar && sidebarVar.SessionValue === "1") {
                setIsShowSidebar(true);
            }
        }

        if (!selectedKebabMenuExplorer) {
            const node = info?.node;

            if (info.selected) {
                setTreeData(newTreeData);
                setSelectedNodeInfo(info)

            }
        }

        if (explorerToRender === "BS") {
            mainAppContext?.setBusinessSelectedNode?.(info.node);
        }
    }


    // Builds sidebar QA tabs from smFeatures (featureRecords) for the selected menu.
    useEffect(() => {
        if (!explorerContainerProps.featureId) {
            setFeatureQAData([]);
            return;
        }

        const featureId = String(explorerContainerProps.featureId);
        const filteredQa = (explorerContainerProps.featureData ?? [])
            .filter((item) => {
                const qaId = Number(item._Feature);
                return (
                    String(item.MenuID) === featureId
                    && Number.isFinite(qaId)
                    && qaId > FeatureQARange.MIN
                    && qaId < FeatureQARange.MAX
                );
            })
            .sort((a, b) => Number(a.SortOrder) - Number(b.SortOrder));
        setFeatureQAData(filteredQa);
    }, [explorerContainerProps.featureId, explorerContainerProps.featureData]);



    // Opens sidebar and persists sidebar-open session flag.
    // SESSION.UpdateSession is commented out for sample data, so the flag is kept in the local session context only.
    const handleClickInformation = () => {
        const sidebarVariable: ISession = { VariableContext: "Optional", VariableName: "Sidebar", SessionValue: "1" };
        const hasSidebarVariable = sessionContext.SessionList.some((sessionvar) => { return sessionvar.VariableName === sidebarVariable.VariableName });
        if (hasSidebarVariable) {
            sessionContext.UpdateRowName(sidebarVariable);
        }
        else {
            sessionContext.setSessionList([...sessionContext.SessionList, sidebarVariable]);
        }
        setIsShowSidebar(true);
        setIsSidebar('sidebarOpen');
    }

    // Keeps sidebar width aligned with right pane after splitter resize.
    const handleExplorerResizeEnd = (event: SplitterResizeEndEvent) => {
        if (event.sizes) {
            const rightPane = document.querySelector('.nz-layout-with-sidebar-pane') as HTMLElement | null;
            const sidebarDiv = document.querySelector('.nz-info-bar .MuiPaper-root') as HTMLElement | null;
            const sidebarContainer = document.querySelector('.nz-qa-sidebar-container') as HTMLElement | null;
            if (!rightPane || !sidebarContainer) {
                return;
            }
            if (sidebarDiv && sidebarContainer && isShowSidebar && sidebarDiv.offsetWidth > rightPane.offsetWidth) {
                sidebarDiv.style.setProperty("width", `${rightPane.offsetWidth}px`, "important");
                sidebarContainer.style.width = rightPane.offsetWidth + "px";
                commonVariableContext.setSidebarWidth(rightPane.offsetWidth);
            }
            if (showSidebarFullWidth) {
                // make sidebar full width of right pane if floor 
                if (rightPane) {
                    const width = (rightPane as HTMLElement).getBoundingClientRect().width;
                    const sidebarDiv = document.querySelector('.nz-qa-sidebar-container .MuiPaper-root') as HTMLElement | null;
                    sidebarContainer.style.width = width + "px";
                    if (sidebarDiv) {
                        sidebarDiv.style.width = width + "px";
                    }
                }
            }
        }
    }

    // Stores latest original tree datasets for feature-specific cache behavior.
    const updateOriginalTreeDataset = async (updatedTreedata: ITreeNode[], expandedKeys: Key[], selectedKeys: Key[], userTreeData: ITreeNode[] | null) => {

        if (explorerContainerProps.updateOriginalTreeDataset) {
            explorerContainerProps.updateOriginalTreeDataset(updatedTreedata, expandedKeys, selectedKeys, userTreeData);
        }
    }

    // Handles kebab menu actions and renders feature-specific controls/popups.
    const handleKebabMenuSelect = async () => {

    }


    // Clears cached original tree data based on active feature cache rules.
    const handleClearCacheTreeData = (): void => {
        if (explorerContainerProps.featureId && ReuseDataForFeatures.includes(explorerContainerProps.featureId)) {
            setOriginalTreeDataForInventory([]);
        }
        else {
            setOriginalTreeData([]);
            originalTreeDataRef.current = [];
            setOriginalTreeDataForInventory([]);
        }
        explorerContainerProps.clearCacheTreeData?.();
    }

    function handleNodeCheck(checked: any, info: CheckInfo<ITreeNode>): void {
        throw new Error('Function not implemented.')
    }


    function handleConfirmYesClick(): void {

    }

    const FnRedirectService = () => {
        const url = new URL(window.location.href);

        url.searchParams.set("bid", selectedNodeInfo?.node.bid ?? "");
        url.searchParams.set("cid", selectedNodeInfo?.node.NodeEntID ?? "");

        const newTab = window.open(url.toString(), "_blank");

        if (newTab) {
            newTab.document.title = "Service";
        }
    };

    return (
        <div key={explorerContainerProps.uniqueName} id="FeatureContainer" className="nz-explorer-container" >
            <div className="nz-feature-explorer-container">
                {explorerToRender !== "NONE" && activeView !== "INVENTORY" && <Splitter className='nz-w-100 nz-h-100' onResizeEnd={handleExplorerResizeEnd} tabIndex={-1}>
                    <SplitterPanel tabIndex={-1} size={25} minSize={10} className={`nz-d-flex-column nz-justify-center nz-explorer-pane${!explorerContainerProps.subTreeFeatureId ? " nz-dc-explorer-pane nz-exp-pane" : " nz-pane-1"}`}>
                        {explorerContainerProps.allowShowHeader &&
                            <div className='nz-sub-header  nz-d-flex-row nz-align-center nz-justify-between nz-explorer-header'>
                                <Label uniqueName={explorerContainerProps.uniqueName + "header"} label={explorerContainerProps.headerText ?? ""} fontWeight="bold" />
                            </div>}

                        {explorerToRender === "BS" && <DcExplorerContainer
                            uniqueName={`${explorerContainerProps.uniqueName}-dc-explorer`}
                            featureId={explorerContainerProps.featureId}
                            subTreeFeatureId={explorerContainerProps.subTreeFeatureId}
                            selectedNodeExplorer={explorerContainerProps.selectedNodeExplorer}
                            isReloadTreeCache={explorerContainerProps.selectedFeatureData?.isReloadCache}
                            defaultCheckedKeys={defaultCheckedKeys}
                            originalTreeData={explorerContainerProps.originalTreeData ? explorerContainerProps.originalTreeData : originalTreeData}
                            handleNodeSelect={handleNodeSelect}
                            handleNodeCheck={handleNodeCheck}
                            updateOriginalTreeDataset={updateOriginalTreeDataset}
                            handleKebabMenuSelect={handleKebabMenuSelect}
                            clearCacheTreeData={handleClearCacheTreeData}
                            updateStatusBarData={explorerContainerProps.updateStatusBarData}
                            handleShowUserMessage={explorerContainerProps.handleShowUserMessage}
                        />}

                        {explorerToRender === "MCS" && <DcExplorerContainer
                            uniqueName={`${explorerContainerProps.uniqueName}-business-explorer`}
                            featureId={explorerContainerProps.featureId}
                            wrapWithRootLabel="Businesses"
                            handleNodeSelect={handleNodeSelect}
                        />}
                    </SplitterPanel>
                    <SplitterPanel tabIndex={-1} size={75} minSize={10} className={`nz-d-flex-column nz-align-center nz-layout-with-sidebar-pane${!explorerContainerProps.subTreeFeatureId ? " nz-pane-1" : " nz-pane-2"}`}>
                        <div className='nz-h-40-px nz-d-flex-row nz-align-center nz-justify-between nz-sub-header nz-w-100'>
                            <div className="nz-d-flex-row nz-align-center nz-w-100">
                                <div className='nz-fq-container-header'>
                                    <Label uniqueName={`${explorerContainerProps.uniqueName}-fqa-container`}
                                        label={selectedNodeInfo?.node ? `${selectedNodeInfo.node.NodeType}: ${selectedNodeInfo.node.Name}` : "Layout"}
                                    />
                                </div>
                            </div>
                            {featureQAData?.length && isShowSidebarIcon ? <ActionImage uniqueName={`${explorerContainerProps.uniqueName}-explorer-tree-info-ai`}
                                image={{
                                    uniqueName: `${explorerContainerProps.uniqueName}-explorer-tree-info-image`,
                                    source: <OpenSidebar24x24 size={FnGetCssVariable('--image-size-2')}
                                        fill="none"
                                        strokeWidth={1} />,
                                    w: 'var(--image-size-2)',
                                    tooltip: "Click to view node details in sidebar",
                                    type: "svg"
                                }} w={'var(--node_height)'} h={'var(--node_height)'} actionCode={'information'} handleMouse={handleClickInformation} /> : <></>
                            }
                        </div>
                        <div className='nz-wh-100 nz-d-flex-hv-left nz-feature-explorer-right-pane' style={{ overflow: 'hidden' }}>
                            <FeatureRenderContainer
                                key={explorerContainerProps.featureId}
                                allowFeatureToRender={true}
                                asRightPane={true}
                                selectedNode={selectedNodeInfo?.node}
                                treeData={treeData}
                                featureContainerProps={{
                                    uniqueName: explorerContainerProps.uniqueName,
                                    featureId: explorerContainerProps.featureId,
                                    allowShowHeader: explorerContainerProps.allowShowHeader,
                                    headerText: explorerContainerProps.headerText,
                                    selectedFeatureData: explorerContainerProps.selectedFeatureData,
                                    updateStatusBarData: explorerContainerProps.updateStatusBarData,
                                }}
                                handleShowUserMessage={explorerContainerProps.handleShowUserMessage ?? (() => undefined)}
                            />
                        </div>
                    </SplitterPanel>
                </Splitter>}
                {(explorerContainerProps.selectedNodeExplorer || selectedNodeInfo?.node) && isSidebar &&
                    featureQAData?.length ?
                    <SidebarContainer
                        uniqueName={`${explorerContainerProps.uniqueName}-sidebar`}
                        isShowSidebar={isShowSidebar}
                        featureQaList={featureQAData ?? []}
                        selectedNode={
                            explorerContainerProps.subTreeFeatureId
                                ? explorerContainerProps.selectedNodeExplorer && !manuallyNodeSelected
                                    ? explorerContainerProps.selectedNodeExplorer.node
                                    : selectedNodeInfo?.node
                                : selectedNodeInfo?.node
                        }
                        featureId={explorerContainerProps.featureId}
                        selectedNodeExplorer={explorerContainerProps.selectedNodeExplorer ? explorerContainerProps.selectedNodeExplorer.node : undefined}
                        subTreeFeatureId={explorerContainerProps.subTreeFeatureId}
                        fullView={showSidebarFullWidth}
                        headerText={""}
                        selectedFeatureQa={selectedKebabMenuExplorer ?? null}
                        showPopupSidebar={false}
                        selectedMenuFeature={explorerContainerProps.selectedFeatureData}
                        treeData={treeData?.length ? treeData
                            : originalTreeData?.length ? originalTreeData
                                : originalTreeDataForInventory}
                        handleCloseSidebar={() => {
                            setIsSidebar('sidebarClose');
                            setIsShowSidebar(false);
                            if (explorerContainerProps.handleCloseSidebar) {
                                explorerContainerProps.handleCloseSidebar();
                            }
                        }}
                        handleReloadTree={explorerContainerProps.handleReloadTree}
                    /> : <></>
                }
            </div>
            <YesNoFormContainer
                isOpen={isConfirmOpen}
                uniqueName={'appqatask-confirm'}
                message={confirmMessage}
                showOkButton={isShowOkButton}
                // container={yesNoDialogContainerRef.current}
                handleYesButtonClick={handleConfirmYesClick}
                handleNoButtonClick={() => {
                    setConfirmMessage("");
                    setIsConfirmOpen(false);
                }}
                handleOkButtonClick={() => {
                    setConfirmMessage("");
                    setIsConfirmOpen(false);
                    FnRedirectService()
                }} />
        </div >
    )
}
export { ExplorerContainer }
