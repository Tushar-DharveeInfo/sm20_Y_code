import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Key } from 'rc-tree/lib/interface';
import { getEqtypes } from '@n20a/libform';
import { useActivities, useFirestore } from '@n20a/libfsdb';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { RmsEnums } from '../../../constants/Feature';
import type { ISelectedNodeInfo, ITreeNode } from '../../../shared/allinterface/tree/ITreeControl';
import type { IFeatureTree } from '../../../shared/allinterface/tree/ITreeForHierarchicalDataContainer';
import { FnSearchKeywordInLocalTree } from '../../../shared/allcommon/tree/FnSearchKeywordInLocalTree';
import { FnHideShowSaveIconForForm } from '../../../shared/allcommon/basic/FnHideShowSaveIconForForm';
import { FnLogActivity } from '../../../shared/allcommon/basic/FnLogActivity';
import { Label } from '../../../shared/basic/label/Label';
import { YesNoFormContainer } from '../../../shared/basic/yesnoformcontainer/YesNoFormContainer';
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks';
import { useRmsContext } from '../../../shared/context/hooks/RmsHooks';
import { useSmDataContext } from '../../../shared/context/hooks/SmDataHooks';
import { useStatusBarContext } from '../../../shared/context/hooks/StatusBarHooks';
import { SearchControl } from '../../../shared/searchfilter/searchcontrol/SearchControl';
import { SettingsLibForm } from '../../../shared/settingsform/settingslibform/SettingsLibForm';
import { TreeForHierarchicalDataContainer } from '../../../shared/tree/treeforhierarchicaldatacontainer/TreeForHierarchicalDataContainer';
import { TreeNodeIcon } from '../../../shared/tree/treenodeicon/TreeNodeIcon';
import { DisplayControlEnums } from '../../../shared/alldefaultprops/basic/DefaultPropsFormContainer';
import { createMfgControl } from '../manufacturer/ManufacturerControls';
import { normalizeMfgKey } from '../manufacturer/useManufacturer';
import '../manufacturer/Manufacturer.css';

interface IMfgEqTypeProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
}

const ROOT_KEY = 'rms-mfgeqtype-root';
const expandedKeys: Key[] = [ROOT_KEY];
const featureTreeProps: IFeatureTree = {
    hideKebabMenu: true,
    hideCopyIcon: true,
    allowIcon: true,
    instanceName: 'nz-mfgeqtype-tree',
};

const STORAGE_KEY = 'sm20_mfgeqtypes_list';

type FormMode = 'add' | 'edit';

const MfgEqType = (props: IMfgEqTypeProps) => {
    const {
        uniqueName = 'feature-rms-mfgeqtype',
        featureId = RmsEnums.MfgEqType,
        headerText = 'MfgEqType',
    } = props;

    const firestore = useFirestore();
    const rmsContext = useRmsContext();
    const mainAppContext = useMainAppContext();
    const smDataContext = useSmDataContext();
    const statusBarContext = useStatusBarContext();

    const targetBid = useMemo(() => {
        return String(
            mainAppContext?.authSession?.bid ||
            smDataContext?.selection?.bid ||
            ''
        ).trim();
    }, [mainAppContext?.authSession?.bid, smDataContext?.selection?.bid]);

    const { createActivity } = useActivities(targetBid || 'none');

    // List of eqtypes (stored in state and synced with localStorage / Firestore)
    const [eqtypesList, setEqtypesList] = useState<string[]>(() => {
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch {
            // fallback
        }
        const names = new Map<string, string>();
        for (const name of getEqtypes()) {
            const value = name.trim();
            if (value && !names.has(normalizeMfgKey(value))) {
                names.set(normalizeMfgKey(value), value);
            }
        }
        return [...names.values()].sort((a, b) => a.localeCompare(b));
    });

    const [formMode, setFormMode] = useState<FormMode>('add');
    const [selectedMfgEqtype, setSelectedMfgEqtype] = useState<string>('');
    const [enteredValue, setEnteredValue] = useState<string>('');
    const enteredValueRef = useRef<string>('');
    const [formSessionId, setFormSessionId] = useState<string>('init');

    const [searchText, setSearchText] = useState('');
    const [searchHistory, setSearchHistory] = useState<string[]>([]);

    // Confirmation / Information dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        showOkButton: boolean;
        onYes?: () => void;
        onNo?: () => void;
    }>({
        isOpen: false,
        title: 'Information',
        message: '',
        showOkButton: true,
    });

    const showMessageDialog = useCallback((msg: string) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Information',
            message: msg,
            showOkButton: true,
        });
        statusBarContext?.setStatusMessage?.(msg);
    }, [statusBarContext]);

    const showConfirmDeleteDialog = useCallback((message: string, onYes: () => void) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Confirm Delete',
            message,
            showOkButton: false,
            onYes,
            onNo: () => {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            },
        });
    }, []);

    // Save helper: updates state and localStorage
    const saveEqtypesList = useCallback((list: string[]) => {
        setEqtypesList(list);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (e) {
            console.warn('Failed to save MfgEqTypes to localStorage:', e);
        }
        if (rmsContext?.setMfgEqType) {
            rmsContext.setMfgEqType(list.map((name) => ({ eqtype: name })));
        }
    }, [rmsContext]);

    // Optional firestore sync
    const persistToFirestore = useCallback(async (action: 'add' | 'update' | 'delete', name: string, oldName?: string) => {
        if (!firestore) return;
        try {
            if (action === 'add') {
                await firestore.upsertDocument({
                    pathSegments: ['mfgeqtype', encodeURIComponent(name)],
                    data: { eqtype: name, lastupdated: new Date().toISOString() },
                });
            } else if (action === 'update' && oldName) {
                await firestore.deleteDocument({
                    pathSegments: ['mfgeqtype', encodeURIComponent(oldName)],
                });
                await firestore.upsertDocument({
                    pathSegments: ['mfgeqtype', encodeURIComponent(name)],
                    data: { eqtype: name, lastupdated: new Date().toISOString() },
                });
            } else if (action === 'delete') {
                await firestore.deleteDocument({
                    pathSegments: ['mfgeqtype', encodeURIComponent(name)],
                });
            }
        } catch (err) {
            console.warn(`Firestore mfgeqtype ${action} failed:`, err);
        }
    }, [firestore]);

    // Query firestore on mount if available to merge cloud items
    useEffect(() => {
        if (!firestore) return;
        firestore.queryDocuments({ pathSegments: ['mfgeqtype'] })
            .then((res: any) => {
                if (res && Array.isArray(res.data) && res.data.length > 0) {
                    const fromFs: string[] = [];
                    for (const doc of res.data) {
                        const name = String(doc.eqtype || doc.name || doc.id || '').trim();
                        if (name) fromFs.push(name);
                    }
                    if (fromFs.length > 0) {
                        setEqtypesList((prev) => {
                            const merged = new Set([...prev, ...fromFs]);
                            const sorted = [...merged].sort((a, b) => a.localeCompare(b));
                            try {
                                localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
                            } catch {}
                            return sorted;
                        });
                    }
                }
            })
            .catch(() => {
                // Ignore offline / mock errors
            });
    }, [firestore]);

    // Activity log helper for operations
    const logMfgEqTypeOperation = useCallback(async (
        action: 'created' | 'updated' | 'deleted',
        eqtype: string,
        oldEqtype?: string
    ) => {
        const userCid = String(
            mainAppContext?.authSession?.cid ||
            mainAppContext?.authSession?.username ||
            'User'
        ).trim();
        const bidPart = targetBid ? ` of ${targetBid}` : '';

        let message = '';
        if (action === 'created') {
            message = `${userCid}${bidPart} created MfgEqType "${eqtype}" successfully.`;
        } else if (action === 'updated') {
            message = `${userCid}${bidPart} updated MfgEqType from "${oldEqtype}" to "${eqtype}" successfully.`;
        } else if (action === 'deleted') {
            message = `${userCid}${bidPart} deleted MfgEqType "${eqtype}" successfully.`;
        }

        try {
            await FnLogActivity({
                bid: targetBid,
                cid: userCid,
                message,
                createActivity: targetBid ? createActivity : undefined,
                createActivityLog: mainAppContext?.createActivityLog,
                updateDataset: smDataContext?.updateDataset,
                currentActivities: smDataContext?.datasets?.activities,
            });
        } catch (err) {
            console.warn(`Failed to log MfgEqType ${action} activity:`, err);
        }
    }, [createActivity, mainAppContext, smDataContext, targetBid]);

    const eqtypeIcon = useMemo(() => TreeNodeIcon({ NodeType: 'MfgEqtype' } as ITreeNode, featureTreeProps.instanceName ?? ''), []);

    // Tree data built dynamically from eqtypesList
    const treeData = useMemo<ITreeNode[]>(() => {
        const query = searchText.trim().toLowerCase();
        const children: ITreeNode[] = eqtypesList
            .filter((name) => !query || name.toLowerCase().includes(query))
            .map((name) => ({
                key: `mfgeqtype__${encodeURIComponent(name)}`,
                NodeEntityname: 'MfgEqtype',
                NodeEntID: name,
                stepNo: 1,
                parentEntID: ROOT_KEY,
                Description: name,
                title: name,
                children: [],
                treetype: 'MfgEqtype',
                Name: name,
                TableLabel: name,
                Type: 'MfgEqtype',
                NodeType: 'MfgEqtype',
                icon: eqtypeIcon,
                HasChildren: 0,
                isLeaf: true,
                eqtype: name,
                MfgEqType: name,
            }));

        return [{
            key: ROOT_KEY,
            NodeEntityname: 'Root',
            NodeEntID: ROOT_KEY,
            stepNo: 0,
            parentEntID: null,
            Description: headerText,
            title: headerText,
            children,
            treetype: 'Root',
            Name: `${headerText} (${children.length})`,
            TableLabel: `${headerText} (${children.length})`,
            Type: 'Root',
            NodeType: 'Root',
            icon: null,
            HasChildren: children.length,
            isLeaf: children.length === 0,
        }];
    }, [eqtypesList, eqtypeIcon, headerText, searchText]);

    // Active selection
    const selectedKey = useMemo(() => {
        if (formMode === 'edit' && selectedMfgEqtype) {
            return `mfgeqtype__${encodeURIComponent(selectedMfgEqtype)}`;
        }
        return ROOT_KEY;
    }, [formMode, selectedMfgEqtype]);

    const selectedNode = useMemo(() => {
        if (selectedKey === ROOT_KEY) return treeData[0];
        return treeData[0].children.find((node) => node.eqtype === selectedMfgEqtype) ?? treeData[0];
    }, [selectedKey, selectedMfgEqtype, treeData]);

    const defaultSelectedKeys = useMemo(() => [selectedKey], [selectedKey]);
    const defaultSelectedNodeInfo = useMemo<ISelectedNodeInfo>(() => ({
        event: 'select',
        selected: true,
        node: selectedNode,
        selectedNodes: [selectedNode],
    }), [selectedNode]);

    // Form controls: single EditTextControl for MfgEqType
    const activeControls = useMemo(() => {
        const val = formMode === 'add' ? '' : selectedMfgEqtype;
        return [
            createMfgControl('MfgEqType', 'MfgEqType', DisplayControlEnums.EditTextControl, 1, {
                IsRequired: 1,
                Value: val,
                DefaultAPValue: val,
                GroupName: 'MfgEqType',
                GroupNameDesc: 'MfgEqType',
                DisplayGroupControl: 'MfgEqType',
                EntityName: 'MfgEqType',
            }),
        ];
    }, [formMode, selectedMfgEqtype]);

    const activeProfileString = useMemo(() => JSON.stringify([{
        MfgEqType: formMode === 'add' ? '' : selectedMfgEqtype,
    }]), [formMode, selectedMfgEqtype]);

    // Determine save button visibility:
    // In add mode: when entered value is non-empty
    // In edit mode: when entered value is non-empty and changed from current selectedMfgEqtype
    const isSaveButtonVisible = useMemo(() => {
        const trimmed = enteredValue.trim();
        if (!trimmed) return false;
        if (formMode === 'add') {
            return true;
        }
        return trimmed.toLowerCase() !== selectedMfgEqtype.trim().toLowerCase();
    }, [enteredValue, formMode, selectedMfgEqtype]);

    // Synchronize save icon in header
    useEffect(() => {
        FnHideShowSaveIconForForm(isSaveButtonVisible ? 'show' : 'hide');
    }, [isSaveButtonVisible, formSessionId]);

    // Add button handler (Requirement 1 & Requirement 3)
    const handleAddClick = useCallback(() => {
        setSelectedMfgEqtype('');
        setFormMode('add');
        setEnteredValue('');
        enteredValueRef.current = '';
        setFormSessionId(`add-${Date.now()}`);
        FnHideShowSaveIconForForm('hide');
    }, []);

    // Delete button handler (Requirement 4)
    const handleDeleteClick = useCallback(() => {
        if (!selectedMfgEqtype || formMode === 'add') {
            return;
        }
        showConfirmDeleteDialog(
            `Are you sure you want to delete MfgEqType '${selectedMfgEqtype}'?`,
            () => {
                const target = selectedMfgEqtype;
                const updatedList = eqtypesList.filter(
                    (item) => item.trim().toLowerCase() !== target.toLowerCase()
                );
                saveEqtypesList(updatedList);
                void persistToFirestore('delete', target);

                // Requirement 5: Log operation
                void logMfgEqTypeOperation('deleted', target);

                // Requirement 6: Refresh tree & switch to Add form
                setSelectedMfgEqtype('');
                setFormMode('add');
                setEnteredValue('');
                enteredValueRef.current = '';
                setFormSessionId(`root-${Date.now()}`);
                FnHideShowSaveIconForForm('hide');
                showMessageDialog(`MfgEqType "${target}" deleted successfully.`);
            }
        );
    }, [eqtypesList, formMode, logMfgEqTypeOperation, persistToFirestore, saveEqtypesList, selectedMfgEqtype, showConfirmDeleteDialog, showMessageDialog]);

    // Tree action panel handler: Add and Delete buttons below tree
    const handleTreeAIClick = useCallback((_e: any, actionCode?: string) => {
        if (actionCode === 'add') {
            handleAddClick();
        } else if (actionCode === 'delete') {
            handleDeleteClick();
        }
    }, [handleAddClick, handleDeleteClick]);

    // Node select handler:
    // Requirement 2: selecting MfgEqtype child shows edit textbox with edit MfgEqtype
    // Requirement 3: selecting Root node shows Add form with edit textbox to create new MfgEqtype
    const handleNodeSelect = useCallback((_keys: Key[], info: ISelectedNodeInfo) => {
        const node = info.node;
        if (!node) return;

        const isRoot = node.NodeType === 'Root' || node.key === ROOT_KEY;
        if (isRoot) {
            handleAddClick();
            return;
        }

        const val = String(node.eqtype ?? node.NodeEntID ?? node.Name ?? '').trim();
        setSelectedMfgEqtype(val);
        setFormMode('edit');
        setEnteredValue(val);
        enteredValueRef.current = val;
        setFormSessionId(`node-${val}-${Date.now()}`);
        FnHideShowSaveIconForForm('hide');
    }, [handleAddClick]);

    // Search handler
    const handleKeywordSearch = useCallback(() => {
        const query = searchText.trim();
        if (!query) return;
        const result = FnSearchKeywordInLocalTree(query, treeData, searchHistory);
        const match = result?.foundNode ? result : FnSearchKeywordInLocalTree(query, treeData, []);
        if (!match?.foundNode) return;
        handleNodeSelect([match.foundNode.key], { event: 'select', selected: true, node: match.foundNode, selectedNodes: [match.foundNode] });
        setSearchHistory(result?.foundNode ? [...searchHistory, String(match.foundNode.key)] : [String(match.foundNode.key)]);
    }, [handleNodeSelect, searchHistory, searchText, treeData]);

    // Form value changes
    const handleFormValueChangeExternal = useCallback((values: Record<string, unknown>) => {
        const raw = values['MfgEqType'] ?? values['mfgeqtype'];
        const val = typeof raw === 'string' ? raw : (raw && typeof raw === 'object' && 'value' in (raw as any)) ? String((raw as any).value) : '';
        setEnteredValue(val);
        enteredValueRef.current = val;
    }, []);

    const handleFormValueChange = useCallback((value: any, name?: string) => {
        if (!name || name.toLowerCase() === 'mfgeqtype') {
            const val = typeof value === 'string' ? value : String(value ?? '');
            setEnteredValue(val);
            enteredValueRef.current = val;
        }
    }, []);

    const handleFormInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
        const target = e.target as HTMLInputElement;
        if (!target) return;
        const name = (target.name || target.id || '').toLowerCase();
        if (name.includes('mfgeqtype') || target.tagName === 'INPUT') {
            const val = target.value;
            setEnteredValue(val);
            enteredValueRef.current = val;
        }
    }, []);

    // Save form handler: Add new or Edit existing
    const handleSaveForm = useCallback(async (profileDataJson?: string) => {
        try {
            let val = enteredValueRef.current.trim();
            if (!val && profileDataJson) {
                try {
                    const parsed = JSON.parse(profileDataJson);
                    const row = Array.isArray(parsed) ? parsed[0] : parsed;
                    val = String(row?.MfgEqType || row?.mfgeqtype || '').trim();
                } catch {
                    // Ignore
                }
            }

            if (!val) {
                showMessageDialog('Enter an MfgEqType name.');
                return;
            }

            if (formMode === 'add') {
                const exists = eqtypesList.some(
                    (item) => item.trim().toLowerCase() === val.toLowerCase()
                );
                if (exists) {
                    showMessageDialog(`MfgEqType "${val}" already exists.`);
                    return;
                }

                const updatedList = [...eqtypesList, val].sort((a, b) => a.localeCompare(b));
                saveEqtypesList(updatedList);
                void persistToFirestore('add', val);

                // Requirement 5: Log operation
                void logMfgEqTypeOperation('created', val);

                // Requirement 6: Refresh tree & select newly created node
                setSelectedMfgEqtype(val);
                setFormMode('edit');
                setEnteredValue(val);
                enteredValueRef.current = val;
                setFormSessionId(`node-${val}-${Date.now()}`);
                FnHideShowSaveIconForForm('hide');
                showMessageDialog(`MfgEqType "${val}" created successfully.`);
            } else if (formMode === 'edit') {
                if (val.toLowerCase() === selectedMfgEqtype.toLowerCase()) {
                    FnHideShowSaveIconForForm('hide');
                    return;
                }

                const exists = eqtypesList.some(
                    (item) =>
                        item.trim().toLowerCase() !== selectedMfgEqtype.toLowerCase() &&
                        item.trim().toLowerCase() === val.toLowerCase()
                );
                if (exists) {
                    showMessageDialog(`MfgEqType "${val}" already exists.`);
                    return;
                }

                const oldVal = selectedMfgEqtype;
                const updatedList = eqtypesList.map((item) =>
                    item.trim().toLowerCase() === oldVal.toLowerCase() ? val : item
                ).sort((a, b) => a.localeCompare(b));
                saveEqtypesList(updatedList);
                void persistToFirestore('update', val, oldVal);

                // Requirement 5: Log operation
                void logMfgEqTypeOperation('updated', val, oldVal);

                // Requirement 6: Refresh tree & keep node selected
                setSelectedMfgEqtype(val);
                setEnteredValue(val);
                enteredValueRef.current = val;
                setFormSessionId(`node-${val}-${Date.now()}`);
                FnHideShowSaveIconForForm('hide');
                showMessageDialog(`MfgEqType "${val}" updated successfully.`);
            }
        } catch (err) {
            console.error('Error saving MfgEqType:', err);
            showMessageDialog(err instanceof Error ? err.message : 'Save operation failed.');
        }
    }, [eqtypesList, formMode, logMfgEqTypeOperation, persistToFirestore, saveEqtypesList, selectedMfgEqtype, showMessageDialog]);

    const activeFormHeader = useMemo(() => {
        if (formMode === 'add') {
            return 'Add MfgEqType';
        }
        return selectedMfgEqtype ? `Edit (${selectedMfgEqtype})` : 'Edit MfgEqType';
    }, [formMode, selectedMfgEqtype]);

    const selectedHeaderLabel = useMemo(() => {
        if (formMode === 'add') {
            return headerText;
        }
        return selectedMfgEqtype || headerText;
    }, [formMode, headerText, selectedMfgEqtype]);

    return (
        <div className="nz-mfg-feature" key={uniqueName}>
            <Splitter className="nz-w-100 nz-h-100 nz-mfg-splitter" tabIndex={-1}>
                <SplitterPanel tabIndex={-1} size={28} minSize={15} className="nz-d-flex-column nz-mfg-tree-pane">
                    <div className="nz-sub-header nz-d-flex-row nz-align-center">
                        <Label uniqueName={`${uniqueName}-header`} label={headerText} fontWeight="bold" />
                    </div>
                    <div className="nz-mfg-search">
                        <SearchControl
                            uniqueName={`${uniqueName}-search`}
                            searchInputValue={searchText}
                            hideSearchControl={false}
                            hideRightMouseMenu={true}
                            isShowFilterControl={false}
                            lensDirty={searchText.trim().length > 0}
                            searchValueChange={(value) => { setSearchText(value); setSearchHistory([]); }}
                            handleLensMouse={handleKeywordSearch}
                            filterDirty={false}
                            handleFilterMouse={() => undefined}
                        />
                    </div>
                    <div className="nz-mfg-tree-body" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {treeData[0].children.length === 0 && (
                            <div className="nz-no-data-found nz-wh-100 nz-d-flex-hv-left">
                                <Label uniqueName={`${uniqueName}-empty`} label="No MfgEqTypes found" />
                            </div>
                        )}
                        <TreeForHierarchicalDataContainer
                            uniqueName={`${uniqueName}-tree`}
                            featureId={featureId}
                            apiData={treeData}
                            allowGenerateTreeData={false}
                            featureTreeProps={featureTreeProps}
                            defaultExpandedKeys={expandedKeys}
                            defaultSelectedKeys={defaultSelectedKeys}
                            defaultSelectedNodeInfo={defaultSelectedNodeInfo}
                            autoFocus={false}
                            allowAdd={true}
                            allowDelete={true}
                            disableAdd={false}
                            disableDelete={!selectedMfgEqtype || formMode === 'add'}
                            handleAIClick={handleTreeAIClick}
                            handleNodeSelect={handleNodeSelect}
                        />
                    </div>
                </SplitterPanel>
                <SplitterPanel tabIndex={-1} size={72} minSize={25} className="nz-d-flex-column nz-mfg-detail-pane">
                    <div className="nz-sub-header nz-d-flex-row nz-align-center">
                        <Label uniqueName={`${uniqueName}-selection`} label={selectedHeaderLabel} fontWeight="bold" />
                    </div>
                    <div className="nz-mfg-detail-body">
                        <div
                            className="nz-mfg-detail-form-container"
                            onInput={handleFormInput}
                        >
                            <SettingsLibForm
                                key={`form-${formMode}-${selectedMfgEqtype}-${formSessionId}`}
                                uniqueName={`${uniqueName}-active-form`}
                                featureId={featureId}
                                id={formMode === 'add' ? '' : selectedMfgEqtype}
                                headerText={activeFormHeader}
                                controls={activeControls}
                                profileString={activeProfileString}
                                allowShowHeader={true}
                                allowShowSectionHeader={true}
                                isDisableForm={false}
                                isAddressFormRequired={false}
                                isAutoSave={false}
                                isFormValueChangedExternal={isSaveButtonVisible}
                                handleSaveForm={handleSaveForm}
                                handleValueChange={handleFormValueChange}
                                handleValueChangeExternal={handleFormValueChangeExternal}
                            />
                        </div>
                    </div>
                </SplitterPanel>
            </Splitter>

            {/* Confirmation / Message Dialog */}
            <YesNoFormContainer
                uniqueName={`${uniqueName}-confirm-dialog`}
                isOpen={confirmDialog.isOpen}
                message={confirmDialog.message}
                dialogTitle={confirmDialog.title}
                showOkButton={confirmDialog.showOkButton}
                handleYesButtonClick={() => {
                    const cb = confirmDialog.onYes;
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                    cb?.();
                }}
                handleNoButtonClick={() => {
                    const cb = confirmDialog.onNo;
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                    cb?.();
                }}
                handleOkButtonClick={() => {
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                }}
            />
        </div>
    );
};

export { MfgEqType };
export default MfgEqType;
