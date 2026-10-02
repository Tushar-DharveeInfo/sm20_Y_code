
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OpenSidebar24x24 } from '@n20a/libicon'
import { Splitter, SplitterPanel, SplitterResizeEndEvent } from 'primereact/splitter'
import { Key } from 'rc-tree/lib/interface'
import './ExplorerContainer.css'
import { FeatureQARange, TicketsEnums, RmsEnums, kebabMenuEnums, SettingEnums } from '../../constants/Feature';
// import { FnFindNearestNodeByType } from '../../shared/allcommon/FnFindNearestNodeByType'
import { useCommonVariableContext } from '../../shared/context/hooks/CommonVariableHooks'
import { useSelectedNodeContext } from '../../shared/context/hooks/SelectedNodeHooks'
import { useSessionContext } from '../../shared/context/hooks/SessionHooks'
import { useStatusBarContext } from '../../shared/context/hooks/StatusBarHooks'
import { useFirestore } from '@n20a/libfsdb'
import { ISession } from '../../shared/context/allinterface/ISession'
import { IFeatureItem } from '../../shared/context/allinterface/IMainApp'
import { IMenuItem } from '../../shared/allinterface/menu/IMainMenu'
import { ISelectedNodeInfo, ITreeNode } from '../../shared/allinterface/tree/ITreeControl'

import { Label } from '../../shared/basic/label/Label'
import { ActionImage } from '../../shared/basic/actionimage/ActionImage'
import { FnGetCssVariable } from '../allcommon/FnGetCssVariable'
import { TreeExplorerContainer } from '../../shared/treeexplorercontainer/TreeExplorerContainer'
import { SettingsInstanceList } from '../../shared/settingsform/settingsinstancelist/SettingsInstanceList'
import { IActionLabelItem } from '../../shared/allinterface/basic/IActionLabelItem'
import { FnMapBusinessesToTreeNodes } from '../../shared/allcommon/tree/FnMapBusinessesToTreeNodes'
import { FnIsRootBusinessNode } from '../../shared/allcommon/tree/FnIsRootBusinessNode'
import { FnCopyToClipboard } from '../../shared/allcommon/basic/FnCopyToClipboard'
import { useSmDataContext } from '../../shared/context/hooks/SmDataHooks'
import { SidebarContainer } from '../sidebarcontainer/SidebarContainer'
import { FeatureRenderContainer } from '../featurecontainer/FeatureRenderContainer'
import { YesNoFormContainer } from '../../shared/basic/yesnoformcontainer/YesNoFormContainer'
import { useMainAppContext } from '../../shared/context/hooks/MainAppHooks'


interface IExplorerContainer {
    uniqueName: string;//unique identifier for the control
    featureId: string;
    bid?: string;
    cid?: string;
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
    const [featureQAData, setFeatureQAData] = useState<IFeatureItem[]>();
    const [isSidebar, setIsSidebar] = useState<string | undefined>("sidebarClose");
    const [defaultCheckedKeys, setDefaultCheckedKeys] = useState<Key[]>([]);
    const [manuallyNodeSelected, setManuallyNodeSelected] = useState<boolean>(false);
    const [confirmMessage, setConfirmMessage] = useState<string>("");
    const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
    const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{
        targetNode: ITreeNode;
        action: 'unapproved' | 'block' | 'delete';
    } | null>(null);
    const [pendingPermanentDelete, setPendingPermanentDelete] = useState<{
        type: 'contact' | 'business';
        bid: string;
        cid?: string;
        contactList?: any[];
        targetNode: ITreeNode;
    } | null>(null);
    // The feature-change effect that used to pick the explorer is commented out, so the BUSINESSTREE tree is always rendered.
    const [explorerToRender, setExplorerToRender] = useState<"BUSINESSTREE" | "NONE" | "MCS" | "SAASINSTANCE" | "CLIENTIDENTITY">("BUSINESSTREE");
    const [treeData, setTreeData] = useState<ITreeNode[]>();
    const [selectedKebabMenuExplorer, setSelectedKebabMenuExplorer] = useState<IMenuItem | IFeatureItem>();
    const [profileAddMode, setProfileAddMode] = useState<"business" | "contact" | null>(null);

    const [isShowSidebarIcon] = useState<boolean>(true);

    const commonVariableContext = useCommonVariableContext();
    const sessionContext = useSessionContext();
    const selectedNodeContext = useSelectedNodeContext();
    const mainAppContext = useMainAppContext();
    const smDataContext = useSmDataContext();
    const statusBarContext = useStatusBarContext();
    const firestore = useFirestore();

    const saasCompanyItems: IActionLabelItem[] = useMemo(() => {
        const businesses = smDataContext.datasets?.businesses ?? [];
        return businesses
            .map((business) => ({
                label: business.bname,
                actionCode: business.bid,
                tooltip: business.bname,
                profileString: JSON.stringify([{ Enabled: business.verified ?? true, Public: true, AddEdit: false }]),
                subGroupName: "SAASInstance",
                isInUse: true,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [smDataContext.datasets?.businesses]);

    const [selectedSaasItem, setSelectedSaasItem] = useState<IActionLabelItem | null>(null);

    const originalTreeDataRef = useRef<ITreeNode[]>(explorerContainerProps.originalTreeData);
    const defaultCheckedKeyRef = useRef<Key[]>([]);
    const featureIdRef = useRef(explorerContainerProps.featureId);
    const outerTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        setDefaultCheckedKeys([])
        const MSCTree = [RmsEnums.McsDevelopment, TicketsEnums.ApprovedTickets, TicketsEnums.RequestsReceived] as string[]
        if (explorerContainerProps.featureId && MSCTree.includes(explorerContainerProps.featureId)) {
            setExplorerToRender("MCS");
            //     else if (explorerContainerProps.featureId === SettingsEnums.Instance) {
            //     setExplorerToRender("SAASINSTANCE");
            // } else if (explorerContainerProps.featureId === SettingsEnums.ClientIdentity) {
            //     setExplorerToRender("CLIENTIDENTITY");
        }
        else {
            setExplorerToRender("BUSINESSTREE");
        }
    }, [explorerContainerProps.featureId]);

    const applySaasBidToContext = useCallback((bid?: string) => {
        const filterJson = smDataContext.selection.filterJson ?? {};
        if (!bid) {
            smDataContext.setExplorerSelection(undefined, filterJson);
            return;
        }
        const businesses = smDataContext.datasets?.businesses ?? [];
        const business = businesses.find((row) => row.bid === bid);
        const node = business ? FnMapBusinessesToTreeNodes([business])[0] : undefined;
        smDataContext.setExplorerSelection(node, filterJson);
        if (node) {
            setSelectedNodeInfo({
                event: "select",
                selected: true,
                node,
                selectedNodes: [node],
            });
        }
    }, [smDataContext]);

    useEffect(() => {
        if (explorerToRender !== "SAASINSTANCE" && explorerToRender !== "CLIENTIDENTITY") {
            return;
        }
        const contextBid = smDataContext.selection.bid;
        const fromContext = contextBid
            ? saasCompanyItems.find((item) => item.actionCode === contextBid)
            : undefined;
        const nextItem = fromContext ?? (saasCompanyItems.length > 0 ? saasCompanyItems[0] : null);
        setSelectedSaasItem(nextItem);
        applySaasBidToContext(nextItem?.actionCode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [explorerToRender, saasCompanyItems]);

    const handleSelectSaasListItem = (
        _event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
        actionCode?: string
    ) => {
        if (!actionCode) {
            return;
        }
        const item = saasCompanyItems.find((company) => company.actionCode === actionCode);
        if (!item) {
            return;
        }
        setSelectedSaasItem(item);
        applySaasBidToContext(item.actionCode);
    };

    const handleSaasActionButtonClick = (
        _event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
        actionCode?: string
    ) => {
        if (actionCode === "add") {
            setSelectedSaasItem(null);
            applySaasBidToContext(undefined);
        }
    };

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
    const handleNodeSelect = async (_selectedKeys: Key[], info: ISelectedNodeInfo, _expandedKeys: Key[], newTreeData?: ITreeNode[], isShowSidebar?: boolean) => {

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
        // Open sidebar on a user click, not on the tree's first auto-select.
        const isAutoSelection =
            info.event === "auto-select"
            || info.event === "found-select"
            || info.event === "auto-select-expand";
        if (!isAutoSelection && (hasSidebarQa || isShowSidebar)) {
            setIsShowSidebar(false);
            setIsSidebar('sidebarClose');
        }
        if (info.event === "select" || info.nativeEvent) {
            setManuallyNodeSelected(true);
        }
        else {
            const sidebarVar = sessionContext.SessionList.find((sessionvar) => { return sessionvar.VariableName === "Sidebar" });
            if (sidebarVar && sidebarVar.SessionValue === "1") {
                setIsShowSidebar(true);
            }
        }

        if (info.selected) {
            setProfileAddMode(null);
            setSelectedKebabMenuExplorer(undefined);
            setTreeData(newTreeData);
            setSelectedNodeInfo(info);
        }

        if (explorerToRender === "BUSINESSTREE") {
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
        const explorerNode = selectedNodeContext.selectedNodeExplorer ?? selectedNodeContext.selectedNode;
        if (!selectedNodeInfo?.node && explorerNode) {
            setSelectedNodeInfo({
                event: "select",
                selected: true,
                node: explorerNode,
                selectedNodes: [explorerNode],
            });
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

        }
    }

    // Stores latest original tree datasets for feature-specific cache behavior.
    const updateOriginalTreeDataset = async (updatedTreedata: ITreeNode[], expandedKeys: Key[], selectedKeys: Key[], userTreeData: ITreeNode[] | null) => {

        if (explorerContainerProps.updateOriginalTreeDataset) {
            explorerContainerProps.updateOriginalTreeDataset(updatedTreedata, expandedKeys, selectedKeys, userTreeData);
        }
    }


    const FnRedirectService = (node?: ITreeNode) => {
        const targetNode = node ?? selectedNodeInfo?.node ?? selectedNodeContext.selectedNodeExplorer;
        const url = new URL(window.location.href);

        url.searchParams.set("bid", targetNode?.bid ?? "");
        url.searchParams.set("cid", targetNode?.NodeEntID ?? targetNode?.cid ?? "");

        const newTab = window.open(url.toString(), "_blank");

        if (newTab) {
            newTab.document.title = "Service";
        }
    };

    
    /**
     * Writes an activity log entry for every kebab-menu status change.
     * Called after a successful Firestore write so only committed changes are logged.
     */
    const createStatusChangeLog = async (
        action: string,
        nodeType: 'contact' | 'business',
        bid: string,
        cid?: string
    ): Promise<void> => {
        try {
            const message = nodeType === 'contact'
                ? `Status changed to [${action}] for contact: ${cid ?? ''} of business: ${bid}`
                : `Status changed to [${action}] for business: ${bid}`;
            await mainAppContext.createActivityLog?.(message);
        } catch (err) {
            console.warn('createStatusChangeLog failed:', err);
        }
    };

    const performStatusUpdate = async (targetNode: ITreeNode, action: 'unapproved' | 'block' | 'delete') => {
        statusBarContext?.setIsLoading?.(true);
        statusBarContext?.setLoadingLabel?.('Loading...');

        try {
            const isContact = Boolean(
                targetNode.NodeType?.toLowerCase() === "contact" ||
                targetNode.treetype?.toLowerCase() === "contact" ||
                targetNode.NodeEntityname?.toLowerCase() === "contact" ||
                (targetNode.cid && targetNode.cid !== targetNode.bid)
            );

            const cid = String(targetNode.cid || targetNode.NodeEntID || targetNode.key);
            let parentBid = String(targetNode.bid || targetNode.parentEntID || '').trim();
            if (!parentBid || parentBid.toLowerCase() === 'root-businesses' || parentBid.toLowerCase() === 'businesses') {
                const foundInContext = smDataContext.datasets?.contacts?.find(
                    (c) => String(c.cid).toLowerCase() === cid.toLowerCase()
                );
                if (foundInContext?.bid) {
                    parentBid = String(foundInContext.bid);
                } else {
                    const match = cid.match(/bid_\d+/i);
                    if (match) {
                        parentBid = match[0];
                    }
                }
            }

            if (action === 'unapproved') {
                // unapproved, simply update record with verified = false
                targetNode.verified = false;
                targetNode.IsAuthorized = false;

                if (isContact) {
                    try {
                        await firestore.updateDocument({
                            pathSegments: ['businesses', parentBid, 'contacts', cid],
                            data: { monitor: false },
                            allowedKeys: ['monitor'],
                        });
                    } catch (e) {
                        console.warn("firestore updateDocument contact unapproved failed:", e);
                    }
                    if (smDataContext.datasets?.contacts) {
                        const nextContacts = smDataContext.datasets.contacts.map((c) =>
                            String(c.cid).toLowerCase() === cid.toLowerCase()
                                ? { ...c, monitor: false }
                                : c
                        );
                        smDataContext.updateDataset("contacts", nextContacts);
                    }
                } else {
                    const bid = String(targetNode.bid || targetNode.NodeEntID || targetNode.key);
                    try {
                        await firestore.updateDocument({
                            pathSegments: ['businesses', bid],
                            data: { verified: false },
                            allowedKeys: ['verified'],
                        });
                    } catch (e) {
                        console.warn("firestore updateDocument business unapproved failed:", e);
                    }
                    if (smDataContext.datasets?.businesses) {
                        const nextBusinesses = smDataContext.datasets.businesses.map((b) =>
                            String(b.bid).toLowerCase() === bid.toLowerCase()
                                ? { ...b, verified: false }
                                : b
                        );
                        smDataContext.updateDataset("businesses", nextBusinesses);
                    }
                }
            } else if (action === 'block') {
                // Block, simply update record with status = Blocked
                targetNode.status = "Blocked";
                targetNode.NodeState = "Blocked";
                targetNode.Description = "Blocked";

                if (isContact) {
                    try {
                        await firestore.updateDocument({
                            pathSegments: ['businesses', parentBid, 'contacts', cid],
                            data: { status: "Blocked" },
                            allowedKeys: ['status'],
                        });
                    } catch (e) {
                        console.warn("firestore updateDocument contact Blocked failed:", e);
                    }
                    if (smDataContext.datasets?.contacts) {
                        const nextContacts = smDataContext.datasets.contacts.map((c) =>
                            String(c.cid).toLowerCase() === cid.toLowerCase()
                                ? { ...c, status: "Blocked" }
                                : c
                        );
                        smDataContext.updateDataset("contacts", nextContacts);
                    }
                } else {
                    const bid = String(targetNode.bid || targetNode.NodeEntID || targetNode.key);
                    try {
                        await firestore.updateDocument({
                            pathSegments: ['businesses', bid],
                            data: { status: "Blocked" },
                            allowedKeys: ['status'],
                        });
                    } catch (e) {
                        console.warn("firestore updateDocument business Blocked failed:", e);
                    }
                    if (smDataContext.datasets?.businesses) {
                        const nextBusinesses = smDataContext.datasets.businesses.map((b) =>
                            String(b.bid).toLowerCase() === bid.toLowerCase()
                                ? { ...b, status: "Blocked" }
                                : b
                        );
                        smDataContext.updateDataset("businesses", nextBusinesses);
                    }
                }
            } else if (action === 'delete') {
                // Delete, simply update record with status = deleted
                targetNode.status = "deleted";
                targetNode.NodeState = "deleted";
                targetNode.Description = "deleted";

                if (isContact) {
                    try {
                        await firestore.updateDocument({
                            pathSegments: ['businesses', parentBid, 'contacts', cid],
                            data: { status: "deleted" },
                            allowedKeys: ['status'],
                        });
                    } catch (e) {
                        console.warn("firestore updateDocument contact deleted failed:", e);
                    }
                    if (smDataContext.datasets?.contacts) {
                        const nextContacts = smDataContext.datasets.contacts.map((c) =>
                            String(c.cid).toLowerCase() === cid.toLowerCase()
                                ? { ...c, status: "deleted" }
                                : c
                        );
                        smDataContext.updateDataset("contacts", nextContacts);
                    }
                } else {
                    const bid = String(targetNode.bid || targetNode.NodeEntID || targetNode.key);
                    try {
                        await firestore.updateDocument({
                            pathSegments: ['businesses', bid],
                            data: { status: "deleted" },
                            allowedKeys: ['status'],
                        });
                    } catch (e) {
                        console.warn("firestore updateDocument business deleted failed:", e);
                    }
                    if (smDataContext.datasets?.businesses) {
                        const nextBusinesses = smDataContext.datasets.businesses.map((b) =>
                            String(b.bid).toLowerCase() === bid.toLowerCase()
                                ? { ...b, status: "deleted" }
                                : b
                        );
                        smDataContext.updateDataset("businesses", nextBusinesses);
                    }
                }
            }

            // Log the status change
            const nodeTypeForLog = isContact ? 'contact' : 'business';
            const bidForLog = isContact ? parentBid : String(targetNode.bid || targetNode.NodeEntID || targetNode.key);
            await createStatusChangeLog(action, nodeTypeForLog, bidForLog, isContact ? cid : undefined);

            // Trigger tree update
            commonVariableContext.setReloadTreeFor({
                featureId: String(explorerContainerProps.featureId),
                entId: String(targetNode.cid || targetNode.key || targetNode.NodeEntID || targetNode.bid),
                dropNodeEntId: isContact ? parentBid : undefined,
                timestamp: Date.now(),
            });
        } finally {
            statusBarContext?.setIsLoading?.(false);
            statusBarContext?.setLoadingLabel?.(undefined);
        }
    };

    const performPermanentDelete = async (info: {
        type: 'contact' | 'business';
        bid: string;
        cid?: string;
        contactList?: any[];
        targetNode: ITreeNode;
    }) => {
        statusBarContext?.setIsLoading?.(true);
        statusBarContext?.setLoadingLabel?.('Deleting...');

        try {
            if (info.type === 'contact') {
                const cid = info.cid!;
                const bid = info.bid;

                // Delete from businesses/{bid}/contacts/{cid}
                try {
                    await firestore.deleteDocument({
                        pathSegments: ['businesses', bid, 'contacts', cid],
                    });
                } catch (e) {
                    console.warn("firestore deleteDocument contact failed:", e);
                }

                // Delete from prospect/{cid}
                try {
                    await firestore.deleteDocument({
                        pathSegments: ['prospect', cid],
                    });
                } catch (e) {
                    console.warn("firestore deleteDocument prospect failed:", e);
                }

                // Update local datasets in smDataContext
                if (smDataContext.datasets?.contacts) {
                    const nextContacts = smDataContext.datasets.contacts.filter(
                        (c) => String(c.cid).toLowerCase() !== cid.toLowerCase()
                    );
                    smDataContext.updateDataset('contacts', nextContacts);
                }
                if (smDataContext.datasets?.prospect) {
                    const nextProspects = smDataContext.datasets.prospect.filter(
                        (p) => String((p as any).cid || (p as any).id || (p as any).EntID).toLowerCase() !== cid.toLowerCase()
                    );
                    smDataContext.updateDataset('prospect', nextProspects);
                }

                // Log the permanent delete
                await createStatusChangeLog('permanently deleted', 'contact', bid, cid);

                commonVariableContext.setReloadTreeFor({
                    featureId: String(explorerContainerProps.featureId),
                    entId: cid,
                    dropNodeEntId: bid,
                    timestamp: Date.now(),
                });
            } else {
                // Delete business node and all its contacts
                const bid = info.bid;
                let contactsToDelete = info.contactList ?? [];
                if (contactsToDelete.length === 0) {
                    contactsToDelete = (smDataContext.datasets?.contacts ?? []).filter(
                        (c) => String(c.bid || '').toLowerCase() === bid.toLowerCase()
                    );
                }

                // Delete all contacts for the selected business from all tables
                for (const contact of contactsToDelete) {
                    const cid = String(contact.cid || contact.EntID || contact.id || '');
                    if (cid) {
                        try {
                            await firestore.deleteDocument({
                                pathSegments: ['businesses', bid, 'contacts', cid],
                            });
                        } catch (e) {
                            console.warn(`firestore deleteDocument contact ${cid} failed:`, e);
                        }
                        try {
                            await firestore.deleteDocument({
                                pathSegments: ['prospect', cid],
                            });
                        } catch (e) {
                            console.warn(`firestore deleteDocument prospect ${cid} failed:`, e);
                        }
                    }
                }

                // Delete the business document businesses/{bid}
                try {
                    await firestore.deleteDocument({
                        pathSegments: ['businesses', bid],
                    });
                } catch (e) {
                    console.warn(`firestore deleteDocument business ${bid} failed:`, e);
                }

                // Update local datasets in smDataContext
                const deletedCidSet = new Set(
                    contactsToDelete.map((c) => String(c.cid || c.EntID || c.id || '').toLowerCase())
                );
                if (smDataContext.datasets?.contacts) {
                    const nextContacts = smDataContext.datasets.contacts.filter(
                        (c) => String(c.bid || '').toLowerCase() !== bid.toLowerCase() && !deletedCidSet.has(String(c.cid).toLowerCase())
                    );
                    smDataContext.updateDataset('contacts', nextContacts);
                }
                if (smDataContext.datasets?.prospect) {
                    const nextProspects = smDataContext.datasets.prospect.filter(
                        (p) => !deletedCidSet.has(String((p as any).cid || (p as any).id || (p as any).EntID).toLowerCase())
                    );
                    smDataContext.updateDataset('prospect', nextProspects);
                }
                if (smDataContext.datasets?.businesses) {
                    const nextBusinesses = smDataContext.datasets.businesses.filter(
                        (b) => String(b.bid).toLowerCase() !== bid.toLowerCase()
                    );
                    smDataContext.updateDataset('businesses', nextBusinesses);
                }

                // Log the permanent business delete
                await createStatusChangeLog('permanently deleted', 'business', bid);

                commonVariableContext.setReloadTreeFor({
                    featureId: String(explorerContainerProps.featureId),
                    entId: bid,
                    timestamp: Date.now(),
                });
            }
        } finally {
            statusBarContext?.setIsLoading?.(false);
            statusBarContext?.setLoadingLabel?.(undefined);
        }
    };

    const handleConfirmYes = async () => {
        setIsConfirmOpen(false);
        setConfirmMessage("");

        if (pendingPermanentDelete) {
            const deleteInfo = pendingPermanentDelete;
            setPendingPermanentDelete(null);
            await performPermanentDelete(deleteInfo);
            return;
        }

        if (!pendingStatusUpdate) return;
        const { targetNode, action } = pendingStatusUpdate;
        setPendingStatusUpdate(null);
        await performStatusUpdate(targetNode, action);
    };

    const handleConfirmNo = () => {
        setIsConfirmOpen(false);
        setConfirmMessage("");
        setPendingStatusUpdate(null);
        setPendingPermanentDelete(null);
    };

    const handleKebabMenuSelect = async (selectedItem: any, selectedNodeInfoParam?: ISelectedNodeInfo) => {
        const payload = selectedItem?.payload ?? selectedItem;
        const targetNode = selectedNodeInfoParam?.node ?? selectedNodeInfo?.node ?? selectedNodeContext.selectedNodeExplorer;
        const label = String(payload?.Label ?? '').trim().toLowerCase();
        const alias = String(payload?.Alias ?? '').trim().toLowerCase();

        const isUnapproved = label === kebabMenuEnums.Unapprove || label === kebabMenuEnums.Unapproved;
        const isBlock = label === kebabMenuEnums.Block || label === kebabMenuEnums.Blocked;
        const isDelete = label === kebabMenuEnums.Delete || label === kebabMenuEnums.Deleted;
        const isServices = label === kebabMenuEnums.Services || alias === 'service';
        const isCopy = label === kebabMenuEnums.Copy;
        const isAddBusiness = label === kebabMenuEnums.AddBusiness;
        const isAddContact = label === kebabMenuEnums.AddContact;

        const isSettingDeleteFeature =
            String(explorerContainerProps.featureId) === SettingEnums.Delete ||
            String(explorerContainerProps.featureId) === '920' ||
            String(explorerContainerProps.featureId).toLowerCase() === 'delete';

        if (isSettingDeleteFeature && isDelete) {
            if (!targetNode || FnIsRootBusinessNode(targetNode)) return;

            const isContact = Boolean(
                targetNode.NodeType?.toLowerCase() === "contact" ||
                targetNode.treetype?.toLowerCase() === "contact" ||
                targetNode.NodeEntityname?.toLowerCase() === "contact" ||
                (targetNode.cid && targetNode.cid !== targetNode.bid)
            );

            if (isContact) {
                const cid = String(targetNode.cid || targetNode.NodeEntID || targetNode.key);
                let parentBid = String(targetNode.bid || targetNode.parentEntID || '').trim();
                if (!parentBid || parentBid.toLowerCase() === 'root-businesses' || parentBid.toLowerCase() === 'businesses') {
                    const foundInContext = smDataContext.datasets?.contacts?.find(
                        (c) => String(c.cid).toLowerCase() === cid.toLowerCase()
                    );
                    if (foundInContext?.bid) {
                        parentBid = String(foundInContext.bid);
                    } else {
                        const match = cid.match(/bid_\d+/i);
                        if (match) {
                            parentBid = match[0];
                        }
                    }
                }

                setPendingPermanentDelete({
                    type: 'contact',
                    bid: parentBid,
                    cid: cid,
                    targetNode: targetNode,
                });
                setConfirmMessage(`Are you sure you wish to permanently delete contact:${cid} for business: ${parentBid}`);
                setIsConfirmOpen(true);
                return;
            } else {
                // Business node
                const bid = String(targetNode.bid || targetNode.NodeEntID || targetNode.key);
                let contactList = smDataContext.getContactsForTree ? smDataContext.getContactsForTree(bid, {}) : [];
                if (!contactList || contactList.length === 0) {
                    const fromDataset = (smDataContext.datasets?.contacts ?? []).filter(
                        (c) => String(c.bid || '').toLowerCase() === bid.toLowerCase()
                    );
                    if (fromDataset.length > 0) {
                        contactList = fromDataset;
                    } else {
                        try {
                            const res = await firestore.queryDocuments({
                                pathSegments: ['businesses', bid, 'contacts'],
                            });
                            if (res?.data && Array.isArray(res.data)) {
                                contactList = res.data as any;
                            }
                        } catch (e) {
                            console.warn("Failed to query contacts from firestore:", e);
                        }
                    }
                }
                const contactCount = contactList.length;

                setPendingPermanentDelete({
                    type: 'business',
                    bid: bid,
                    contactList: contactList,
                    targetNode: targetNode,
                });
                setConfirmMessage(`There are ${contactCount} contacts. Are you sure you wish to permanently delete all contacts for business: ${bid}?`);
                setIsConfirmOpen(true);
                return;
            }
        }

        if (isUnapproved || isBlock || isDelete) {
            if (!targetNode) return;

            const action = isUnapproved ? 'unapproved' : (isBlock ? 'block' : 'delete');
            setPendingStatusUpdate({ targetNode, action });
            setConfirmMessage("Are you sure you want to update status?");
            setIsConfirmOpen(true);
            return;
        }

        if (isServices) {
            FnRedirectService(targetNode);
        } else if (isCopy && targetNode) {
            FnCopyToClipboard(targetNode.TableLabel ? `${targetNode.TableLabel}` : (targetNode.Name ? targetNode.Name : ''));
        } else if (isAddBusiness) {
            const message = payload?.Tooltip || 'Add Business';
            alert(message);
            if (explorerContainerProps.handleShowUserMessage) {
                explorerContainerProps.handleShowUserMessage(message);
            }
        } else if (isAddContact) {
            const message = payload?.Tooltip || 'Add Contact';
            alert(message);
            if (explorerContainerProps.handleShowUserMessage) {
                explorerContainerProps.handleShowUserMessage(message);
            }
        }
    };

    const activeSelectedNode = selectedNodeInfo?.node ?? selectedNodeContext.selectedNodeExplorer ?? selectedNodeContext.selectedNode;
    const isRootNode = !activeSelectedNode || FnIsRootBusinessNode(activeSelectedNode);
    const isContactNode = Boolean(
        activeSelectedNode?.NodeType?.toLowerCase() === "contact" ||
        activeSelectedNode?.treetype?.toLowerCase() === "contact" ||
        (activeSelectedNode?.cid && activeSelectedNode?.cid !== activeSelectedNode?.bid)
    );
    const isBusinessNode = !isRootNode && !isContactNode;

    const selectedBusinessName =
        activeSelectedNode?.bname ||
        activeSelectedNode?.Name ||
        (typeof activeSelectedNode?.title === "string" ? activeSelectedNode.title : "") ||
        "";

    const hasSidebarQa = Boolean(featureQAData && featureQAData.length > 0);
    // User logic:
    // Root node selected -> + btn with label "Add New Business"
    // Business node selected -> + btn with label "Add New Contact for <selected business name>"
    // Contact node selected -> hide + button
    // Sidebar QA not found -> hide + button completely
    const allowTreeAdd = hasSidebarQa && !isContactNode;
    const addLabel = isRootNode
        ? "Add New Business"
        : selectedBusinessName
            ? `Add New Contact for ${selectedBusinessName}`
            : "Add New Contact";
    const addTooltip = addLabel;
    const addActionCode = isRootNode ? "addBusiness" : "addContact";

    const handleAIClick = (
        _event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
        actionCode?: string
    ) => {
        const mode: "business" | "contact" =
            actionCode === "addContact" || (!isRootNode && isBusinessNode)
                ? "contact"
                : "business";

        setProfileAddMode(mode);

        const profileQa = featureQAData?.find(
            (item) => item.Label?.toLowerCase() === "profile"
        );
        if (profileQa) {
            setSelectedKebabMenuExplorer(profileQa);
        }

        const fallbackNode =
            selectedNodeInfo?.node ??
            selectedNodeContext.selectedNodeExplorer ??
            selectedNodeContext.selectedNode ??
            (treeData?.[0] as ITreeNode | undefined);
        if (fallbackNode && !selectedNodeInfo?.node) {
            setSelectedNodeInfo({
                event: "select",
                selected: true,
                node: fallbackNode,
                selectedNodes: [fallbackNode],
            });
        }

        setIsShowSidebar(true);
        setIsSidebar("sidebarOpen");

        const sidebarVariable: ISession = {
            VariableContext: "Optional",
            VariableName: "Sidebar",
            SessionValue: "1",
        };
        if (sessionContext.SessionList.some((s) => s.VariableName === "Sidebar")) {
            sessionContext.UpdateRowName(sidebarVariable);
        } else {
            sessionContext.setSessionList([...sessionContext.SessionList, sidebarVariable]);
        }
    };

    const handleReloadTree = (featureId: string, entID?: string) => {
        commonVariableContext.setReloadTreeFor({
            featureId,
            entId: entID ?? "",
        });
        explorerContainerProps.handleReloadTree?.(featureId, entID);
    };

    return (
        <div key={explorerContainerProps.uniqueName} id="FeatureContainer" className="nz-explorer-container" >
            <div className="nz-feature-explorer-container">
                {explorerToRender !== "NONE" && <Splitter className='nz-w-100 nz-h-100' onResizeEnd={handleExplorerResizeEnd} tabIndex={-1}>
                    <SplitterPanel tabIndex={-1} size={25} minSize={10} className={`nz-d-flex-column nz-justify-center nz-explorer-pane${!explorerContainerProps.subTreeFeatureId ? " nz-dc-explorer-pane nz-exp-pane" : " nz-pane-1"}`}>
                        {explorerContainerProps.allowShowHeader &&
                            <div className='nz-sub-header  nz-d-flex-row nz-align-center nz-justify-between nz-explorer-header'>
                                <Label uniqueName={explorerContainerProps.uniqueName + "header"} label={explorerContainerProps.headerText ?? ""} fontWeight="bold" />
                            </div>}
                        {/* left Pane(explorer) render container*/}
                        {explorerToRender === "BUSINESSTREE" && <TreeExplorerContainer
                            uniqueName={`${explorerContainerProps.uniqueName}-dc-explorer`}
                            featureId={explorerContainerProps.featureId}
                            subTreeFeatureId={explorerContainerProps.subTreeFeatureId}
                            selectedNodeExplorer={explorerContainerProps.selectedNodeExplorer}
                            isReloadTreeCache={explorerContainerProps.selectedFeatureData?.isReloadCache}
                            originalTreeData={explorerContainerProps.originalTreeData}
                            allowAdd={allowTreeAdd}
                            addLabel={addLabel}
                            addTooltip={addTooltip}
                            addActionCode={addActionCode}
                            handleNodeSelect={handleNodeSelect}
                            updateOriginalTreeDataset={updateOriginalTreeDataset}
                            handleAIClick={handleAIClick}
                            handleKebabMenuSelect={handleKebabMenuSelect}
                        />}

                        {explorerToRender === "MCS" && <TreeExplorerContainer
                            uniqueName={`${explorerContainerProps.uniqueName}-business-explorer`}
                            featureId={explorerContainerProps.featureId}
                            wrapWithRootLabel="Businesses"
                            allowAdd={allowTreeAdd}
                            addLabel={addLabel}
                            addTooltip={addTooltip}
                            addActionCode={addActionCode}
                            handleNodeSelect={handleNodeSelect}
                            handleAIClick={handleAIClick}
                            handleKebabMenuSelect={handleKebabMenuSelect}
                        />}

                        {(explorerToRender === "SAASINSTANCE" || explorerToRender === "CLIENTIDENTITY") && (
                            <div className="nz-form-instance-container nz-w-100 nz-h-100">
                                <SettingsInstanceList
                                    uniqueName={`${explorerContainerProps.uniqueName}-alist`}
                                    actionLabelItems={saasCompanyItems}
                                    isAddMode={selectedSaasItem === null}
                                    selectedItem={selectedSaasItem || undefined}
                                    allowFilter={true}
                                    handleSelectListItem={handleSelectSaasListItem}
                                    handleActionButtonClick={handleSaasActionButtonClick}
                                    allowAdd={false}
                                    allowDelete={false}
                                    showEditButton={false}
                                    allowTestApi={false}
                                    allowPreflight={false}
                                    disableAdd={false}
                                    disableEdit={!selectedSaasItem}
                                    disableDelete={!selectedSaasItem}
                                    disableTestApi={true}
                                />
                            </div>
                        )}
                    </SplitterPanel>

                    <SplitterPanel tabIndex={-1} size={75} minSize={10} className={`nz-d-flex-column nz-align-center nz-layout-with-sidebar-pane${!explorerContainerProps.subTreeFeatureId ? " nz-pane-1" : " nz-pane-2"}`}>
                        {explorerToRender !== "SAASINSTANCE" && explorerToRender !== "CLIENTIDENTITY" && (
                            <div className='nz-h-40-px nz-d-flex-row nz-align-center nz-justify-between nz-sub-header nz-w-100'>
                                <div className="nz-d-flex-row nz-align-center nz-w-100">
                                    <div className='nz-fq-container-header'>
                                        <Label uniqueName={`${explorerContainerProps.uniqueName}-fqa-container`}
                                            label={selectedNodeInfo?.node ? `${selectedNodeInfo.node.NodeType}: ${selectedNodeInfo.node.Name}` : "Layout"}
                                        />
                                    </div>
                                </div>
                                {featureQAData?.length && isShowSidebarIcon && treeData?.length ? <ActionImage uniqueName={`${explorerContainerProps.uniqueName}-explorer-tree-info-ai`}
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
                        )}
                        {/* right Pane render container*/}
                        <div className='nz-wh-100 nz-d-flex-hv-left nz-feature-explorer-right-pane' style={{ overflow: 'hidden' }}>
                            <FeatureRenderContainer
                                key={explorerContainerProps.featureId}
                                doNotRenderExplorerTree={true}
                                asRightPane={true}
                                selectedNode={selectedNodeInfo?.node}
                                treeData={treeData}
                                featureContainerProps={{
                                    uniqueName: explorerContainerProps.uniqueName,
                                    featureId: explorerContainerProps.featureId,
                                    bid: explorerContainerProps.bid ?? (explorerContainerProps.selectedFeatureData?.bid as string) ?? smDataContext.selection.bid ?? mainAppContext.authSession?.bid ?? '',
                                    cid: explorerContainerProps.cid ?? (explorerContainerProps.selectedFeatureData?.cid as string) ?? smDataContext.selection.cid ?? mainAppContext.authSession?.cid ?? '',
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
                {/* siderbar render container */}
                {(explorerContainerProps.selectedNodeExplorer || selectedNodeInfo?.node || selectedNodeContext.selectedNodeExplorer) && isSidebar === "sidebarOpen" &&
                    featureQAData?.length ?
                    <SidebarContainer
                        uniqueName={`${explorerContainerProps.uniqueName}-sidebar`}
                        isShowSidebar={isShowSidebar}
                        profileAddMode={profileAddMode}
                        onResetProfileAddMode={() => setProfileAddMode(null)}
                        featureQaList={featureQAData ?? []}
                        selectedNode={
                            explorerContainerProps.subTreeFeatureId
                                ? explorerContainerProps.selectedNodeExplorer && !manuallyNodeSelected
                                    ? explorerContainerProps.selectedNodeExplorer.node
                                    : selectedNodeInfo?.node ?? selectedNodeContext.selectedNodeExplorer
                                : selectedNodeInfo?.node ?? selectedNodeContext.selectedNodeExplorer
                        }
                        featureId={explorerContainerProps.featureId}
                        subTreeFeatureId={explorerContainerProps.subTreeFeatureId}
                        headerText={""}
                        selectedFeatureQa={selectedKebabMenuExplorer ?? null}
                        showPopupSidebar={false}
                        selectedMenuFeature={explorerContainerProps.selectedFeatureData}
                        treeData={treeData ?? undefined}
                        handleCloseSidebar={() => {
                            setIsSidebar('sidebarClose');
                            setIsShowSidebar(false);
                            if (explorerContainerProps.handleCloseSidebar) {
                                explorerContainerProps.handleCloseSidebar();
                            }
                        }}
                        handleReloadTree={handleReloadTree}
                    /> : <></>
                }
            </div>
            <YesNoFormContainer
                isOpen={isConfirmOpen}
                uniqueName={'status-update-confirm'}
                message={confirmMessage}
                dialogTitle={"Confirm"}
                handleYesButtonClick={handleConfirmYes}
                handleNoButtonClick={handleConfirmNo}
                handleOkButtonClick={handleConfirmNo}
            />
        </div >
    )
}
export { ExplorerContainer }
