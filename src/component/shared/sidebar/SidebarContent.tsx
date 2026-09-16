
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMainAppContext } from '../context/hooks/MainAppHooks'
import { useCommonVariableContext } from '../context/hooks/CommonVariableHooks'
import { useStatusBarContext } from '../context/hooks/StatusBarHooks'
import './SidebarContent.css'
import { SidebarEnum } from '../../constants/Feature'
import { ITreeNode } from '../allinterface/tree/ITreeControl'
import { IErrorData } from '../allinterface/IApiResponse'
// import { DeviceModel } from './devicemodel/DeviceModel'
import { Log } from '../../features/appqa/log/Log'
// import { DiagnosticLogContainer } from './diagnosticlogcontainer/DiagnosticLogContainer'
import { FqaNotes } from './notes/FqaNotes'
import { Key } from 'rc-tree/lib/interface'
import { PropertyFormContainer } from './propertyformcontainer/PropertyFormContainer'
import { ProfileAddFormContainer } from './propertyformcontainer/ProfileAddFormContainer'
import { useHelpTipContext } from '../context/hooks/HelptipHooks'
// import { Assign } from './assign/Assign'
import { AlertLog } from './alertlog/AlertLog'
import { ContactList } from './contactlist/ContactList'
import { buildPropertyFormDataFromSelectedNode } from './propertyformcontainer/PropertySampleData'
import { IMenuItem } from '../allinterface/menu/IMainMenu'
import { FnIsRootBusinessNode } from '../allcommon/tree/FnIsRootBusinessNode'

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
    profileAddMode?: 'business' | 'contact' | null;
    onResetProfileAddMode?: () => void;
    handleReloadTree?: (featureId: string, entID?: string) => void;
    apValueChange?: (value: any, EntID: string, event: unknown, selectedData: unknown, instanceName?: string) => void; // ap form value change
    handleShowErrorDialog?: (message: string, isOpen: boolean) => void;
}

const SidebarContent = (sidebarProps: ISidebarContent) => {
    console.log('sidebarProps', sidebarProps)
    const [Label, setLabel] = useState<string>("");
    const [selectedNode, setSelectedNode] = useState<ITreeNode>();
    const [actionlog, setActionlog] = useState<IErrorData[]>();
    const [isReadOnly, setIsReadOnly] = useState<boolean>(false);

    const mainAppContext = useMainAppContext();
    const commonVariableContext = useCommonVariableContext();
    const statusBarContext = useStatusBarContext();
    const helpTipsContext = useHelpTipContext();

    const lastSelectedNodeKeyRef = useRef<Key>(undefined);


    // Initialize form controls and entity information based on selected sidebar action.
    useEffect(() => {
        if (sidebarProps.Label) {
            setLabel(sidebarProps.Label)
        }

    }, [sidebarProps.Label, sidebarProps.featureId, helpTipsContext.helpTipRecords])

    // Update selected node state and determine readonly mode when node selection changes.
    useEffect(() => {
        if (sidebarProps.selectedNode) {
            if (lastSelectedNodeKeyRef.current !== sidebarProps.selectedNode.key) {
                setActionlog([]);
            }

            setIsReadOnly(false)
            setSelectedNode(sidebarProps.selectedNode)
            lastSelectedNodeKeyRef.current = sidebarProps.selectedNode.key;
        }
    }, [sidebarProps.selectedNode]);

    // Append action log entries and location details whenever new log data arrives.
    useEffect(() => {
        const newData = statusBarContext.actionLogData;
        if (!newData?.length) return;

        const existingLog: IErrorData[] = actionlog ?? [];



        const locationData = null

        // Find max id in O(n)
        let lastId = 0;
        for (const item of existingLog) {
            if (item.id != null && item.id > lastId) lastId = item.id;
        }

        // Sort incoming once (desc)
        const incoming = newData.slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

        const result: IErrorData[] = [];

        //  ADD location row (use latest incoming row as base)
        if (locationData && incoming.length > 0) {
            const base = incoming[0];

            result.push({
                ...base,
                errString:
                    typeof locationData === "string"
                        ? locationData
                        : JSON.stringify(locationData),
                id: ++lastId
            });
        }

        // Add incoming rows
        for (const item of incoming) {
            result.push({
                ...item,
                id: ++lastId
            });
        }

        // Append existing log
        for (const item of existingLog) {
            result.push(item);
        }

        setActionlog(result);
    }, [statusBarContext.actionLogData, sidebarProps.featureId]);



    // SAMPLE DATA: build EditTextControl property form from selected-node key/value record.
    const propertyFormPackage = useMemo(() => {
        if (!selectedNode) {
            return undefined;
        }
        return buildPropertyFormDataFromSelectedNode(selectedNode);
    }, [
        selectedNode?.key,
        selectedNode?.NodeEntID,
        selectedNode?.EntID,
        selectedNode?.Name,
        selectedNode?.Description,
        selectedNode?.NodeEntityname,
        selectedNode?.NodeType,
        selectedNode?.Type,
        selectedNode?.bname,
        selectedNode?.bid,
        selectedNode?.cid,
        selectedNode?.status,
        selectedNode?.verified,
        selectedNode?.salesExec,
        selectedNode?.country,
        selectedNode?.state,
        selectedNode?.daysNoticePeriod,
        selectedNode?.mmFinYear,
        selectedNode?.relatedBids,
        selectedNode?.contact,
        selectedNode?.email,
        selectedNode?.phone1,
        selectedNode?.phone2,
        selectedNode?.address_street,
        selectedNode?.address_city,
        selectedNode?.address_state,
        selectedNode?.address_zip,
        selectedNode?.address_country,
        selectedNode?.dateCreated,
        selectedNode?.dateUpdated,
    ]);

    const isProfileTab = Label === SidebarEnum.Profile || Label === "Profile";
    const isPropertyTab = Label === SidebarEnum.Property || Label === "Property" || Label === "Details";

    const renderPropertyContainer = () => {
        const isPropertyOrProfile = isPropertyTab || isProfileTab;
        const shouldShowPropertyContainer =
            selectedNode &&
            (sidebarProps.isPropertyFound || Label === "Details" || isProfileTab) &&
            isPropertyOrProfile &&
            !sidebarProps.profileAddMode &&
            !selectedNode.NodeType?.toLowerCase().includes("helptip");

        if (!shouldShowPropertyContainer || !propertyFormPackage) {
            return null;
        }

        return (
            <div
                style={{
                    height: "100%",
                    width: "100%"
                }}
            >
                {FnIsRootBusinessNode(selectedNode) || selectedNode.Name?.toLowerCase().startsWith("businesses") ?
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "start", height: "100%", padding: "16px", color: "var(--text-color-secondary, #757575)" }}>
                        Select a business or contact to view its profile
                    </div>
                    : <PropertyFormContainer
                        uniqueName={`property-container-${sidebarProps.Label}`}
                        headerText={isProfileTab ? "Profile" : "Properties"}
                        treeData={sidebarProps.treeData ?? undefined}
                        featureId={sidebarProps.featureId}
                        subTreeFeatureId={sidebarProps.subTreeFeatureId}
                        selectedNode={selectedNode}
                        isReadOnly={isReadOnly}
                        isAllowCustomAction={false}
                        selectedNodeMenu={sidebarProps.selectedNodeMenu}
                        entityTables={propertyFormPackage.entityTables}
                        kebabMenuData={propertyFormPackage.kebabMenuData}
                        handleValueChange={sidebarProps.apValueChange}
                        handleRefreshUpdatedRecord={(
                            newAddedId: string,
                            _newAddedName: string,
                            action?: "save" | "back"
                        ) => {
                            if (
                                newAddedId &&
                                action === "save" &&
                                !sidebarProps.subTreeFeatureId
                            ) {
                                commonVariableContext.setReloadTreeFor({
                                    featureId: sidebarProps.featureId,
                                    entId: newAddedId
                                });
                            } else {
                                sidebarProps.handleReloadTree?.(
                                    sidebarProps.featureId,
                                    newAddedId
                                );
                            }
                        }}
                    />}

            </div>
        );
    };

    const renderProfileAddContainer = () => {
        if (!isProfileTab || !sidebarProps.profileAddMode) {
            return null;
        }

        const isBusiness =
            selectedNode &&
            !FnIsRootBusinessNode(selectedNode) &&
            (selectedNode.NodeType?.toLowerCase() === "business" ||
                selectedNode.treetype?.toLowerCase() === "business");

        const effectiveMode: "business" | "contact" =
            sidebarProps.profileAddMode ||
            (isBusiness ? "contact" : "business");

        return (
            <div
                style={{
                    height: "100%",
                    width: "100%"
                }}
            >
                <ProfileAddFormContainer
                    uniqueName={`profile-add-${sidebarProps.uniqueName}`}
                    initialMode={effectiveMode}
                    actionType="add"
                    selectedNode={selectedNode}
                    treeData={sidebarProps.treeData}
                    featureId={sidebarProps.featureId}
                    subTreeFeatureId={sidebarProps.subTreeFeatureId}
                    handleReloadTree={sidebarProps.handleReloadTree}
                    onClose={() => {
                        sidebarProps.onResetProfileAddMode?.();
                    }}
                />
            </div>
        );
    };

    // Render sidebar content based on selected sidebar tab.
    const renderSidebarContent = () => {
        switch (Label) {
            case SidebarEnum.Alerts:
                return (
                    <AlertLog
                        uniqueName="appqa-alerts"
                        headerText='Alert Log'
                        selectedNode={selectedNode}
                    />
                );

            case SidebarEnum.Log:
                return (
                    <Log
                        featureId={sidebarProps.featureId}
                        headerText='Log'
                        selectedNode={selectedNode ?? sidebarProps.selectedNode}
                        uniqueName={`${Label}-log`}
                        handleShowUserMessage={sidebarProps.handleShowErrorDialog ? (msg) => sidebarProps.handleShowErrorDialog?.(msg, true) : undefined}
                    />
                );

            case SidebarEnum.Notes:
                return (
                    <FqaNotes
                        uniqueName="Notes"
                        hideSearchControl={false}
                        selectedNode={sidebarProps.selectedNode}
                    />
                );

            case SidebarEnum.List:
            case SidebarEnum.ListContacts:
            case "List":
            case "List Contacts":
                return (
                    <ContactList
                        uniqueName="sidebar-contact-list"
                        headerText="Contacts"
                        selectedNode={selectedNode}
                        featureId={sidebarProps.featureId}
                    />
                );
            default:
                return null;
        }
    };


    return (
        <div className="nz-sidebar-container">
            {renderPropertyContainer()}
            {renderProfileAddContainer()}
            {renderSidebarContent()}
        </div>
    );

}

export { SidebarContent }
