import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Key } from 'rc-tree/lib/interface';
import { kebabMenuEnums, RmsEnums } from '../../../constants/Feature';
import { Label } from '../../../shared/basic/label/Label';
import type { IExpandedNodeInfo, ISelectedNodeInfo, ITreeNode } from '../../../shared/allinterface/tree/ITreeControl';
import type { IFeatureTree } from '../../../shared/allinterface/tree/ITreeForHierarchicalDataContainer';
import { useRmsContext } from '../../../shared/context/hooks/RmsHooks';
import { useStatusBarContext } from '../../../shared/context/hooks/StatusBarHooks';
import { SettingsLibForm } from '../../../shared/settingsform/settingslibform/SettingsLibForm';
import { TreeForHierarchicalDataContainer } from '../../../shared/tree/treeforhierarchicaldatacontainer/TreeForHierarchicalDataContainer';
import { TreeNodeIcon } from '../../../shared/tree/treenodeicon/TreeNodeIcon';
import { YesNoFormContainer } from '../../../shared/basic/yesnoformcontainer/YesNoFormContainer';
import { FnHideShowSaveIconForForm } from '../../../shared/allcommon/basic/FnHideShowSaveIconForForm';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { SearchControl } from '../../../shared/searchfilter/searchcontrol/SearchControl';
import { FnSearchKeywordInLocalTree } from '../../../shared/allcommon/tree/FnSearchKeywordInLocalTree';
import { EQTypeVsSections } from '@n20a/libform';
import MfgVsProdlineData from '../../../shared/sidebar/rms/rmscollection/MfgVsProdline.json';
import {
    useManufacturer,
    normalizeMfgKey,
} from './useManufacturer';
import {
    buildMfgDetailsControls,
    buildProdlinePaneControls,
    buildEqtypePaneControls,
    buildRelationPaneControls,
    parseMfgAddress,
    serializeMfgAddress,
    parseProfileString,
    getFieldValue,
    extractFieldValue,
    setDomInputValue,
    type IMfgAddressData,
} from './ManufacturerControls';
import './Manufacturer.css';

interface IManufacturerProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
}

const ROOT_KEY = 'rms-mfg-root';

function mfgNodeKey(acronym: string): string {
    return `mfg__${normalizeMfgKey(acronym)}`;
}

function prodlineNodeKey(acronym: string, prodline: string): string {
    return `prodline__${normalizeMfgKey(acronym)}__${encodeURIComponent(prodline)}`;
}

function eqtypeNodeKey(acronym: string, prodline: string, eqtype: string): string {
    return `eqtype__${normalizeMfgKey(acronym)}__${encodeURIComponent(prodline)}__${encodeURIComponent(eqtype)}`;
}

function updateNodeChildrenInTree(
    tree: ITreeNode[],
    targetKey: Key,
    newChildren: ITreeNode[]
): ITreeNode[] {
    let changed = false;
    const updated: ITreeNode[] = [];
    const len = tree.length;
    for (let i = 0; i < len; i++) {
        const node = tree[i];
        if (node.key === targetKey) {
            changed = true;
            updated.push({
                ...node,
                children: newChildren,
                HasChildren: newChildren.length,
                isLeaf: newChildren.length === 0,
            });
        } else if (node.children && node.children.length > 0) {
            const updatedChildren = updateNodeChildrenInTree(node.children, targetKey, newChildren);
            if (updatedChildren !== node.children) {
                changed = true;
                updated.push({
                    ...node,
                    children: updatedChildren,
                });
            } else {
                updated.push(node);
            }
        } else {
            updated.push(node);
        }
    }
    return changed ? updated : tree;
}

function appendChildToNodeInTree(
    tree: ITreeNode[],
    parentKey: Key,
    childNode: ITreeNode
): ITreeNode[] {
    let changed = false;
    const updated: ITreeNode[] = [];
    const len = tree.length;
    for (let i = 0; i < len; i++) {
        const node = tree[i];
        if (node.key === parentKey) {
            changed = true;
            const existing = node.children ?? [];
            let alreadyExists = false;
            const newChildren: ITreeNode[] = [];
            for (let j = 0; j < existing.length; j++) {
                const c = existing[j];
                if (c.key === childNode.key) {
                    alreadyExists = true;
                    newChildren.push(childNode);
                } else {
                    newChildren.push(c);
                }
            }
            if (!alreadyExists) {
                newChildren.push(childNode);
                newChildren.sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? '')));
            }
            updated.push({
                ...node,
                children: newChildren,
                HasChildren: newChildren.length,
                isLeaf: newChildren.length === 0,
            });
        } else if (node.children && node.children.length > 0) {
            const updatedChildren = appendChildToNodeInTree(node.children, parentKey, childNode);
            if (updatedChildren !== node.children) {
                changed = true;
                updated.push({ ...node, children: updatedChildren });
            } else {
                updated.push(node);
            }
        } else {
            updated.push(node);
        }
    }
    return changed ? updated : tree;
}

function removeChildFromNodeInTree(
    tree: ITreeNode[],
    parentKey: Key,
    childKey: Key
): ITreeNode[] {
    let changed = false;
    const updated: ITreeNode[] = [];
    const len = tree.length;
    for (let i = 0; i < len; i++) {
        const node = tree[i];
        if (node.key === parentKey) {
            changed = true;
            const existing = node.children ?? [];
            const newChildren: ITreeNode[] = [];
            for (let j = 0; j < existing.length; j++) {
                const c = existing[j];
                if (c.key !== childKey) {
                    newChildren.push(c);
                }
            }
            updated.push({
                ...node,
                children: newChildren,
                HasChildren: newChildren.length,
                isLeaf: newChildren.length === 0,
            });
        } else if (node.children && node.children.length > 0) {
            const updatedChildren = removeChildFromNodeInTree(node.children, parentKey, childKey);
            if (updatedChildren !== node.children) {
                changed = true;
                updated.push({ ...node, children: updatedChildren });
            } else {
                updated.push(node);
            }
        } else {
            updated.push(node);
        }
    }
    return changed ? updated : tree;
}

const featureTreeProps: IFeatureTree = {
    hideKebabMenu: false,
    hideCopyIcon: true,
    allowIcon: true,
    instanceName: 'nz-mfg-tree',
};

type FormMode = 'mfg' | 'prodline' | 'mfgeqtype' | 'mfgrelation';

const emptyAddress: IMfgAddressData = {
    Address1: '',
    Address2: '',
    City: '',
    State: '',
    Country: '',
    Zip: '',
    CountryCode: '',
};

const Manufacturer = (props: IManufacturerProps) => {
    const {
        uniqueName = 'feature-rms-manufacturer',
        featureId = RmsEnums.Manufacturer,
        headerText = 'Manufacturers',
    } = props;

    const rmsContext = useRmsContext();
    const statusBarContext = useStatusBarContext();

    // Ensure status bar loading indicator is cleared when unmounting
    useEffect(() => {
        return () => {
            statusBarContext?.setIsLoading?.(false);
        };
    }, [statusBarContext]);
    const {
        loading,
        startLoading,
        stopLoading,
        error,
        setStatusMessage,
        manufacturers,
        findMfg,
        loadProdlines,
        loadEqtypes,
        addManufacturer,
        updateManufacturer,
        deleteManufacturer,
        addProdline,
        deleteProdline,
        addMfgEqtype,
        deleteMfgEqtype,
        addMfgRelation,
        deleteMfgRelation,
        isManufacturerInUse,
    } = useManufacturer();

    const [formMode, setFormMode] = useState<FormMode>('mfg');
    const [SelectedMfgAcronym, setSelectedMfgAcronym] = useState<string>('');
    const [SelectedMfgProdline, setSelectedMfgProdline] = useState<string>('');
    const [SelectedMfgEqtype, setSelectedMfgEqtype] = useState<string>('');
    const [searchText, setSearchText] = useState<string>('');
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const prevSearchTextRef = useRef<string>('');
    const [expandedKeys, setExpandedKeys] = useState<Key[]>([ROOT_KEY]);
    const [commandNode, setCommandNodeState] = useState<ITreeNode | null>(null);
    const commandNodeRef = useRef<ITreeNode | null>(null);
    const setCommandNode = useCallback((node: ITreeNode | null) => {
        commandNodeRef.current = node;
        setCommandNodeState(node);
    }, []);

    const mfgIcon = useMemo(
        () => featureTreeProps.allowIcon ? TreeNodeIcon({ NodeType: 'Mfg' } as ITreeNode, featureTreeProps.instanceName ?? '') : null,
        []
    );
    const prodlineIcon = useMemo(
        () => featureTreeProps.allowIcon ? TreeNodeIcon({ NodeType: 'Prodline' } as ITreeNode, featureTreeProps.instanceName ?? '') : null,
        []
    );
    const eqtypeIcon = useMemo(
        () => featureTreeProps.allowIcon ? TreeNodeIcon({ NodeType: 'MfgEqtype' } as ITreeNode, featureTreeProps.instanceName ?? '') : null,
        []
    );

    // Form baseline record (stable during typing so SettingsLibForm doesn't reset)
    const [initialFormData, setInitialFormData] = useState<{
        mode: FormMode;
        acronym: string;
        mfgName: string;
        website: string;
        address: IMfgAddressData;
        isExisting: boolean;
        prodline: string;
        eqtype: string;
        relation: string;
    }>({
        mode: 'mfg',
        acronym: '',
        mfgName: '',
        website: '',
        address: emptyAddress,
        isExisting: false,
        prodline: '',
        eqtype: '',
        relation: '',
    });

    const [isFieldsFilled, setIsFieldsFilled] = useState<boolean>(false);
    const [dirtyFlag, setDirtyFlag] = useState<boolean>(false);
    const dirtyFlagRef = useRef<boolean>(false);

    const setIsDirty = useCallback((dirty: boolean) => {
        dirtyFlagRef.current = dirty;
        setDirtyFlag(dirty);
    }, []);

    const setIsFormChanged = setIsDirty;

    // Refs to store values during typing without lag
    const formAcronymRef = useRef<string>('');
    const formMfgNameRef = useRef<string>('');
    const formWebsiteRef = useRef<string>('');
    const formAddressRef = useRef<IMfgAddressData>(emptyAddress);
    const formProdlineRef = useRef<string>('');
    const formEqtypeRef = useRef<string>('');
    const formRelationRef = useRef<string>('');
    const formContainerRef = useRef<HTMLDivElement>(null);
    const [formSessionId, setFormSessionId] = useState<string>('init');

    // Entered values state for real-time Add vs Edit mode detection
    const [enteredAcronym, setEnteredAcronym] = useState<string>('');
    const [enteredMfgName, setEnteredMfgName] = useState<string>('');
    const [enteredProdline, setEnteredProdline] = useState<string>('');
    const [enteredEqtype, setEnteredEqtype] = useState<string>('');

    // Confirmation / Message Dialog
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
        setStatusMessage(msg);
    }, [setStatusMessage]);

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

    // Options for combo boxes
    const acronymOptions = useMemo(() => {
        const result: { value: string; label: string }[] = [];
        const len = manufacturers.length;
        for (let i = 0; i < len; i++) {
            const k = manufacturers[i].mfgkey;
            result.push({ value: k, label: k });
        }
        result.sort((a, b) => a.label.localeCompare(b.label));
        return result;
    }, [manufacturers]);

    const nameOptions = useMemo(() => {
        const result: { value: string; label: string }[] = [];
        const len = manufacturers.length;
        for (let i = 0; i < len; i++) {
            const n = manufacturers[i].mfgname;
            result.push({ value: n, label: n });
        }
        result.sort((a, b) => a.label.localeCompare(b.label));
        return result;
    }, [manufacturers]);

    const prodlineOptions = useMemo(() => {
        const names = new Set<string>();
        const prodlineLists = Object.values(rmsContext.mfgVsProdline);
        for (let i = 0; i < prodlineLists.length; i++) {
            const list = prodlineLists[i];
            for (let j = 0; j < list.length; j++) {
                names.add(list[j]);
            }
        }
        const currentUpper = (SelectedMfgAcronym || '').toUpperCase();
        const mfgData = MfgVsProdlineData as Record<string, string[]>[];
        for (let i = 0; i < mfgData.length; i++) {
            const entry = mfgData[i];
            for (const k in entry) {
                if (k.toUpperCase() === currentUpper || currentUpper.startsWith(k.toUpperCase())) {
                    const list = entry[k];
                    for (let j = 0; j < list.length; j++) {
                        names.add(list[j]);
                    }
                }
            }
        }
        if (names.size < 30) {
            const limit = Math.min(100, mfgData.length);
            for (let i = 0; i < limit; i++) {
                const entry = mfgData[i];
                for (const k in entry) {
                    const list = entry[k];
                    for (let j = 0; j < list.length; j++) {
                        names.add(list[j]);
                    }
                }
            }
        }
        const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
        const options: { value: string; label: string }[] = [];
        for (let i = 0; i < sortedNames.length; i++) {
            options.push({ value: sortedNames[i], label: sortedNames[i] });
        }
        return options;
    }, [SelectedMfgAcronym, rmsContext.mfgVsProdline]);

    const eqtypeOptions = useMemo(() => {
        const names = new Set<string>();
        const sectionKeys = Object.keys(EQTypeVsSections);
        for (let i = 0; i < sectionKeys.length; i++) {
            names.add(sectionKeys[i]);
        }
        const eqtypeLists = Object.values(rmsContext.mfgVsMfgEqtype);
        for (let i = 0; i < eqtypeLists.length; i++) {
            const list = eqtypeLists[i];
            for (let j = 0; j < list.length; j++) {
                names.add(list[j]);
            }
        }
        const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
        const options: { value: string; label: string }[] = [];
        for (let i = 0; i < sortedNames.length; i++) {
            options.push({ value: sortedNames[i], label: sortedNames[i] });
        }
        return options;
    }, [rmsContext.mfgVsMfgEqtype]);

    const relationOptions = useMemo(() => {
        return acronymOptions;
    }, [acronymOptions]);

    // Case 1: Manufacturer uniqueness (both Acronym and MfgName must not match any existing manufacturer record)
    const isMfgUnique = useMemo(() => {
        const curAcronym = (enteredAcronym || formAcronymRef.current || initialFormData.acronym || '').trim();
        const curMfgName = (enteredMfgName || formMfgNameRef.current || initialFormData.mfgName || '').trim();
        if (!curAcronym || !curMfgName) return false;

        const acronymExists = manufacturers.some(
            (m) => normalizeMfgKey(m.mfgkey) === normalizeMfgKey(curAcronym)
        );
        const nameExists = manufacturers.some(
            (m) => m.mfgname.trim().toLowerCase() === curMfgName.toLowerCase()
        );
        return !acronymExists && !nameExists;
    }, [enteredAcronym, enteredMfgName, initialFormData.acronym, initialFormData.mfgName, manufacturers]);

    // Case 2: Prodline uniqueness (entered value does not match any existing Prodline in combo data)
    const isProdlineUnique = useMemo(() => {
        const cur = (enteredProdline || formProdlineRef.current || initialFormData.prodline || '').trim().toLowerCase();
        if (!cur) return false;
        return !prodlineOptions.some(
            (opt) => opt.value.trim().toLowerCase() === cur || opt.label.trim().toLowerCase() === cur
        );
    }, [enteredProdline, initialFormData.prodline, prodlineOptions]);

    // Case 3: MfgEqType uniqueness (entered value does not match any existing MfgEqType in combo data)
    const isEqtypeUnique = useMemo(() => {
        const cur = (enteredEqtype || formEqtypeRef.current || initialFormData.eqtype || '').trim().toLowerCase();
        if (!cur) return false;
        return !eqtypeOptions.some(
            (opt) => opt.value.trim().toLowerCase() === cur || opt.label.trim().toLowerCase() === cur
        );
    }, [enteredEqtype, eqtypeOptions, initialFormData.eqtype]);

    // Apply active node selection and trigger background relation loads
    const applySelection = useCallback((node: ITreeNode) => {
        const acronym = String(node.mfgAcronym ?? '').trim();
        const prodline = String(node.prodline ?? '').trim();
        const eqtype = String(node.eqtype ?? '').trim();
        const nodeTypeLower = String(node.NodeType ?? '').toLowerCase();

        setIsFormChanged(false);

        if (nodeTypeLower === 'mfg') {
            setSelectedMfgAcronym(acronym);
            setSelectedMfgProdline('');
            setSelectedMfgEqtype('');
            setFormMode('mfg');

            const match = findMfg(acronym);
            if (match) {
                const addr = parseMfgAddress(match.address);
                formAcronymRef.current = match.mfgkey;
                formMfgNameRef.current = match.mfgname;
                formWebsiteRef.current = match.website ?? '';
                formAddressRef.current = addr;
                setEnteredAcronym(match.mfgkey);
                setEnteredMfgName(match.mfgname);
                setEnteredProdline('');
                setEnteredEqtype('');

                setInitialFormData({
                    mode: 'mfg',
                    acronym: match.mfgkey,
                    mfgName: match.mfgname,
                    website: match.website ?? '',
                    address: addr,
                    isExisting: true,
                    prodline: '',
                    eqtype: '',
                    relation: '',
                });
                setIsFieldsFilled(true);
            } else {
                formAcronymRef.current = acronym;
                formMfgNameRef.current = '';
                formWebsiteRef.current = '';
                formAddressRef.current = emptyAddress;
                setEnteredAcronym(acronym);
                setEnteredMfgName('');
                setEnteredProdline('');
                setEnteredEqtype('');

                setInitialFormData({
                    mode: 'mfg',
                    acronym,
                    mfgName: '',
                    website: '',
                    address: emptyAddress,
                    isExisting: false,
                    prodline: '',
                    eqtype: '',
                    relation: '',
                });
                setIsFieldsFilled(Boolean(acronym));
            }

            if (acronym) {
                startLoading();
                void loadProdlines(acronym).finally(() => {
                    stopLoading();
                });
            }
            return;
        }

        if (nodeTypeLower === 'prodline') {
            setSelectedMfgAcronym(acronym);
            setSelectedMfgProdline(prodline);
            setSelectedMfgEqtype('');
            setFormMode('prodline');
            formProdlineRef.current = prodline;
            setEnteredAcronym(acronym);
            setEnteredMfgName('');
            setEnteredProdline(prodline);
            setEnteredEqtype('');
            setInitialFormData({
                mode: 'prodline',
                acronym,
                mfgName: '',
                website: '',
                address: emptyAddress,
                isExisting: true,
                prodline,
                eqtype: '',
                relation: '',
            });
            setIsFieldsFilled(Boolean(acronym && prodline));

            if (acronym) {
                setExpandedKeys((prev) => Array.from(new Set([...prev, ROOT_KEY, mfgNodeKey(acronym)])));
                startLoading();
                void loadProdlines(acronym).finally(() => {
                    stopLoading();
                });
            }
            return;
        }

        if (nodeTypeLower === 'mfgeqtype') {
            setSelectedMfgAcronym(acronym);
            setSelectedMfgProdline(prodline);
            setSelectedMfgEqtype(eqtype);
            setFormMode('mfgeqtype');
            formEqtypeRef.current = eqtype;
            setEnteredAcronym(acronym);
            setEnteredMfgName('');
            setEnteredProdline(prodline);
            setEnteredEqtype(eqtype);
            setInitialFormData({
                mode: 'mfgeqtype',
                acronym,
                mfgName: '',
                website: '',
                address: emptyAddress,
                isExisting: true,
                prodline,
                eqtype,
                relation: '',
            });
            setIsFieldsFilled(Boolean(acronym && prodline && eqtype));

            if (acronym) {
                const keysToPreserve: Key[] = [ROOT_KEY, mfgNodeKey(acronym)];
                if (prodline) {
                    keysToPreserve.push(prodlineNodeKey(acronym, prodline));
                }
                setExpandedKeys((prev) => Array.from(new Set([...prev, ...keysToPreserve])));
                startLoading();
                void Promise.all([loadProdlines(acronym), loadEqtypes(acronym)]).finally(() => {
                    stopLoading();
                });
            }
            return;
        }

        // Root or other
        setSelectedMfgAcronym('');
        setSelectedMfgProdline('');
        setSelectedMfgEqtype('');
        setFormMode('mfg');
        formAcronymRef.current = '';
        formMfgNameRef.current = '';
        formWebsiteRef.current = '';
        formAddressRef.current = emptyAddress;
        setEnteredAcronym('');
        setEnteredMfgName('');
        setEnteredProdline('');
        setEnteredEqtype('');
        setInitialFormData({
            mode: 'mfg',
            acronym: '',
            mfgName: '',
            website: '',
            address: emptyAddress,
            isExisting: false,
            prodline: '',
            eqtype: '',
            relation: '',
        });
        setIsFieldsFilled(false);
    }, [findMfg, loadEqtypes, loadProdlines, startLoading, stopLoading]);


    // Delete actions
    const handleDeleteMfg = useCallback(async (targetAcronym: string) => {
        const cleanAcronym = targetAcronym.trim();
        if (!cleanAcronym) return;
        const inUse = await isManufacturerInUse(cleanAcronym);
        if (inUse) {
            showMessageDialog('Acronym and Mfg is in use.');
            return;
        }
        const res = await deleteManufacturer(cleanAcronym);
        if (res.success) {
            setSelectedMfgAcronym('');
            setSelectedMfgProdline('');
            setSelectedMfgEqtype('');
            setFormMode('mfg');
            formAcronymRef.current = '';
            formMfgNameRef.current = '';
            formWebsiteRef.current = '';
            formAddressRef.current = emptyAddress;
            setEnteredAcronym('');
            setEnteredMfgName('');
            setEnteredProdline('');
            setEnteredEqtype('');
            setInitialFormData({
                mode: 'mfg',
                acronym: '',
                mfgName: '',
                website: '',
                address: emptyAddress,
                isExisting: false,
                prodline: '',
                eqtype: '',
                relation: '',
            });
            setIsFieldsFilled(false);
            setIsFormChanged(false);
            FnHideShowSaveIconForForm('hide');
            setCommandNode(null);
            setExpandedKeys((prev) => Array.from(new Set([...prev, ROOT_KEY])));
            showMessageDialog('Deleted successfully.');
        } else if (res.error) {
            showMessageDialog(res.error);
        }
    }, [deleteManufacturer, isManufacturerInUse, showMessageDialog]);

    const handleDeleteProdline = useCallback(async (targetAcronym: string, prodlineToDelete: string) => {
        const cleanAcronym = targetAcronym.trim();
        const cleanProdline = prodlineToDelete.trim();
        if (!cleanAcronym || !cleanProdline) return;
        const res = await deleteProdline(cleanAcronym, cleanProdline);
        if (res.success) {
            setTreeData((prev) => removeChildFromNodeInTree(prev, mfgNodeKey(cleanAcronym), prodlineNodeKey(cleanAcronym, cleanProdline)));
            const mfgRecord = findMfg(cleanAcronym);
            const mfgTitle = mfgRecord?.mfgname || cleanAcronym;
            const parentKey = mfgNodeKey(cleanAcronym);

            setSelectedMfgAcronym(cleanAcronym);
            setSelectedMfgProdline('');
            setSelectedMfgEqtype('');
            setFormMode('mfg');

            const parentNode: ITreeNode = {
                key: parentKey,
                NodeType: 'Mfg',
                mfgAcronym: cleanAcronym,
                mfgName: mfgTitle,
                title: mfgTitle,
                Name: mfgTitle,
                NodeEntityname: null,
                NodeEntID: null,
                stepNo: 0,
                parentEntID: null,
                Description: null,
                children: [],
                treetype: '',
                Type: null,
                icon: null,
                HasChildren: null
            };
            setCommandNode(parentNode);
            setExpandedKeys((prev) => Array.from(new Set([...prev, ROOT_KEY, parentKey])));

            if (mfgRecord) {
                const addr = parseMfgAddress(mfgRecord.address);
                formAcronymRef.current = mfgRecord.mfgkey;
                formMfgNameRef.current = mfgRecord.mfgname;
                formWebsiteRef.current = mfgRecord.website ?? '';
                formAddressRef.current = addr;
                setEnteredAcronym(mfgRecord.mfgkey);
                setEnteredMfgName(mfgRecord.mfgname);
                setEnteredProdline('');
                setEnteredEqtype('');
                setInitialFormData({
                    mode: 'mfg',
                    acronym: mfgRecord.mfgkey,
                    mfgName: mfgRecord.mfgname,
                    website: mfgRecord.website ?? '',
                    address: addr,
                    isExisting: true,
                    prodline: '',
                    eqtype: '',
                    relation: '',
                });
                setIsFieldsFilled(true);
            }
            setIsFormChanged(false);
            FnHideShowSaveIconForForm('hide');
            showMessageDialog('Deleted successfully.');
        } else if (res.error) {
            showMessageDialog(res.error);
        }
    }, [deleteProdline, findMfg, showMessageDialog]);

    const handleDeleteEqtype = useCallback(async (targetAcronym: string, eqtypeToDelete: string, targetProdline?: string) => {
        const cleanAcronym = targetAcronym.trim();
        const cleanEqtype = eqtypeToDelete.trim();
        if (!cleanAcronym || !cleanEqtype) return;
        const res = await deleteMfgEqtype(cleanAcronym, cleanEqtype);
        if (res.success) {
            const parentProdline = String(targetProdline ?? commandNodeRef.current?.prodline ?? SelectedMfgProdline).trim();
            const parentKey = prodlineNodeKey(cleanAcronym, parentProdline);
            const eKey = eqtypeNodeKey(cleanAcronym, parentProdline, cleanEqtype);
            setTreeData((prev) => removeChildFromNodeInTree(prev, parentKey, eKey));

            setSelectedMfgAcronym(cleanAcronym);
            setSelectedMfgProdline(parentProdline);
            setSelectedMfgEqtype('');
            setFormMode('prodline');
            formProdlineRef.current = parentProdline;
            setEnteredAcronym(cleanAcronym);
            setEnteredMfgName('');
            setEnteredProdline(parentProdline);
            setEnteredEqtype('');
            setInitialFormData({
                mode: 'prodline',
                acronym: cleanAcronym,
                mfgName: '',
                website: '',
                address: emptyAddress,
                isExisting: true,
                prodline: parentProdline,
                eqtype: '',
                relation: '',
            });
            setIsFieldsFilled(Boolean(cleanAcronym && parentProdline));

            const parentNode: ITreeNode = {
                key: parentKey,
                NodeType: 'Prodline',
                mfgAcronym: cleanAcronym,
                prodline: parentProdline,
                title: parentProdline,
                Name: parentProdline,
                NodeEntityname: null,
                NodeEntID: null,
                stepNo: 0,
                parentEntID: null,
                Description: null,
                children: [],
                treetype: '',
                Type: null,
                icon: null,
                HasChildren: null
            };
            setCommandNode(parentNode);
            setExpandedKeys((prev) => Array.from(new Set([...prev, ROOT_KEY, mfgNodeKey(cleanAcronym), parentKey])));
            setIsFormChanged(false);
            FnHideShowSaveIconForForm('hide');
            showMessageDialog('Deleted successfully.');
        } else if (res.error) {
            showMessageDialog(res.error);
        }
    }, [SelectedMfgProdline, deleteMfgEqtype, showMessageDialog]);

    const handleDeleteRelation = useCallback(async (targetAcronym: string, relationToDelete: string) => {
        const cleanAcronym = targetAcronym.trim();
        const cleanRelation = relationToDelete.trim();
        if (!cleanAcronym || !cleanRelation) return;
        const res = await deleteMfgRelation(cleanAcronym, cleanRelation);
        if (res.success) {
            formRelationRef.current = '';
            setInitialFormData((prev) => ({ ...prev, relation: '' }));
            setIsFieldsFilled(false);
            setIsFormChanged(false);
            FnHideShowSaveIconForForm('hide');
            showMessageDialog('Deleted successfully.');
        } else if (res.error) {
            showMessageDialog(res.error);
        }
    }, [deleteMfgRelation, showMessageDialog]);

    // Handle kebab menu selection (switches right side form directly, prompts for delete!)
    const handleKebabMenuSelect = useCallback((selectedItem: unknown, node?: ITreeNode) => {
        const itemObj = selectedItem as { payload?: { Label?: string }; Label?: string } | undefined;
        const payload = itemObj?.payload ?? itemObj;
        const label = String(payload?.Label ?? '').trim().toLowerCase();
        const activeNode = node ?? commandNodeRef.current;
        if (!activeNode) return;

        applySelection(activeNode);
        const nodeTypeLower = String(activeNode.NodeType ?? '').toLowerCase();
        const acronym = String(activeNode.mfgAcronym ?? '').trim();
        const prodline = String(activeNode.prodline ?? '').trim();
        const eqtype = String(activeNode.eqtype ?? '').trim();

        const ancestorKeys: Key[] = [ROOT_KEY];
        if (acronym) {
            ancestorKeys.push(mfgNodeKey(acronym));
        }
        if (acronym && prodline) {
            ancestorKeys.push(prodlineNodeKey(acronym, prodline));
        }
        setExpandedKeys((prev) => Array.from(new Set([...prev, ...ancestorKeys])));
        setCommandNode(activeNode);
        setStatusMessage('');
        setFormSessionId(`kebab-${String(activeNode.key)}-${label}-${Date.now()}`);

        if (nodeTypeLower === 'mfg') {
            if (label === kebabMenuEnums.Add) {
                setFormMode('mfg');
                formAcronymRef.current = '';
                formMfgNameRef.current = '';
                formWebsiteRef.current = '';
                formAddressRef.current = emptyAddress;
                setEnteredAcronym('');
                setEnteredMfgName('');
                setEnteredProdline('');
                setEnteredEqtype('');
                setInitialFormData({
                    mode: 'mfg',
                    acronym: '',
                    mfgName: '',
                    website: '',
                    address: emptyAddress,
                    isExisting: false,
                    prodline: '',
                    eqtype: '',
                    relation: '',
                });
                setIsFieldsFilled(false);
                setIsFormChanged(false);
                FnHideShowSaveIconForForm('hide');
            } else if (label === kebabMenuEnums.Delete) {
                void (async () => {
                    const inUse = await isManufacturerInUse(acronym);
                    if (inUse) {
                        showMessageDialog('Acronym and Mfg is in use.');
                        return;
                    }
                    const mfgRecord = findMfg(acronym);
                    const displayName = mfgRecord?.mfgname || acronym;
                    showConfirmDeleteDialog(
                        `Are you sure you want to delete manufacturer "${displayName}"?`,
                        () => { void handleDeleteMfg(acronym); }
                    );
                })();
            } else if (label === kebabMenuEnums.EditMfgRelation || label === kebabMenuEnums.Relate) {
                setFormMode('mfgrelation');
                const rels = rmsContext.mfgRelation[normalizeMfgKey(acronym)] ?? [];
                const firstRel = rels[0] ?? '';
                formRelationRef.current = firstRel;
                setInitialFormData((prev) => ({
                    ...prev,
                    mode: 'mfgrelation',
                    acronym,
                    relation: firstRel,
                }));
                setIsFieldsFilled(Boolean(acronym && firstRel));
                setIsFormChanged(false);
                FnHideShowSaveIconForForm('hide');
            } else if (label === kebabMenuEnums.EditMfg || label === kebabMenuEnums.Edit) {
                setFormMode('mfg');
                const row = findMfg(acronym);
                setEnteredAcronym(acronym);
                setEnteredMfgName(row?.mfgname || '');
                setEnteredProdline('');
                setEnteredEqtype('');
                setIsFormChanged(false);
                FnHideShowSaveIconForForm('hide');
            }
        } else if (nodeTypeLower === 'prodline') {
            if (label === kebabMenuEnums.EditProdline || label === kebabMenuEnums.Edit) {
                setFormMode('prodline');
                formProdlineRef.current = prodline;
                setEnteredAcronym(acronym);
                setEnteredMfgName('');
                setEnteredProdline(prodline);
                setEnteredEqtype('');
                setInitialFormData((prev) => ({
                    ...prev,
                    mode: 'prodline',
                    acronym,
                    prodline,
                }));
                setIsFieldsFilled(Boolean(acronym && prodline));
                setIsFormChanged(false);
                FnHideShowSaveIconForForm('hide');
            } else if (label === kebabMenuEnums.Delete) {
                showConfirmDeleteDialog(
                    `Are you sure you want to delete product line "${prodline}"?`,
                    () => { void handleDeleteProdline(acronym, prodline); }
                );
            }
        } else if (nodeTypeLower === 'mfgeqtype') {
            if (label === kebabMenuEnums.EditMfgEqType || label === kebabMenuEnums.Edit) {
                setFormMode('mfgeqtype');
                formEqtypeRef.current = eqtype;
                setEnteredAcronym(acronym);
                setEnteredMfgName('');
                setEnteredProdline(prodline);
                setEnteredEqtype(eqtype);
                setInitialFormData((prev) => ({
                    ...prev,
                    mode: 'mfgeqtype',
                    acronym,
                    prodline,
                    eqtype,
                }));
                setIsFieldsFilled(Boolean(acronym && prodline && eqtype));
                setIsFormChanged(false);
                FnHideShowSaveIconForForm('hide');
            } else if (label === kebabMenuEnums.Delete) {
                showConfirmDeleteDialog(
                    `Are you sure you want to delete equipment type "${eqtype}"?`,
                    () => { void handleDeleteEqtype(acronym, eqtype, prodline); }
                );
            }
        }
    }, [
        applySelection,
        findMfg,
        handleDeleteEqtype,
        handleDeleteMfg,
        handleDeleteProdline,
        isManufacturerInUse,
        rmsContext.mfgRelation,
        setCommandNode,
        setStatusMessage,
        showConfirmDeleteDialog,
        showMessageDialog,
    ]);

    // Synchronize DOM inputs and React state when typing into form fields
    const handleFormInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
        const target = e.target as HTMLInputElement;
        if (!target || target.tagName !== 'INPUT') return;

        const identifier = (target.name || target.id || '').toLowerCase();

        if (formMode === 'mfg') {
            if (identifier.includes('acronym')) {
                const typedAcronym = target.value;
                formAcronymRef.current = typedAcronym;
                setEnteredAcronym(typedAcronym);
                setIsDirty(true);

                const match = findMfg(typedAcronym);
                const container = formContainerRef.current;
                const mfgInput = container?.querySelector<HTMLInputElement>(
                    'input[id*="MfgName" i], input[name*="MfgName" i]'
                );
                const webInput = container?.querySelector<HTMLInputElement>(
                    'input[id*="Website" i], input[name*="Website" i]'
                );

                if (match) {
                    const addr = parseMfgAddress(match.address);
                    formMfgNameRef.current = match.mfgname;
                    formWebsiteRef.current = match.website ?? '';
                    formAddressRef.current = addr;
                    setSelectedMfgAcronym(match.mfgkey);
                    setEnteredMfgName(match.mfgname);

                    if (mfgInput && mfgInput.value !== match.mfgname) {
                        setDomInputValue(mfgInput, match.mfgname);
                    }
                    if (webInput && webInput.value !== (match.website ?? '')) {
                        setDomInputValue(webInput, match.website ?? '');
                    }

                    setInitialFormData({
                        mode: 'mfg',
                        acronym: match.mfgkey,
                        mfgName: match.mfgname,
                        website: match.website ?? '',
                        address: addr,
                        isExisting: true,
                        prodline: '',
                        eqtype: '',
                        relation: '',
                    });
                    setIsFieldsFilled(true);
                } else {
                    const isFilled = Boolean(typedAcronym.trim() && formMfgNameRef.current.trim());
                    setIsFieldsFilled(isFilled);
                }
                const isFilled = Boolean(formAcronymRef.current.trim() && formMfgNameRef.current.trim());
                FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
            } else if (identifier.includes('mfgname')) {
                formMfgNameRef.current = target.value;
                setEnteredMfgName(target.value);
                setIsDirty(true);
                const isFilled = Boolean(formAcronymRef.current.trim() && target.value.trim());
                setIsFieldsFilled(isFilled);
                FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
            } else if (identifier.includes('website')) {
                formWebsiteRef.current = target.value;
                setIsDirty(true);
                const isFilled = Boolean(formAcronymRef.current.trim() && formMfgNameRef.current.trim());
                setIsFieldsFilled(isFilled);
                FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
            }
        } else if (formMode === 'prodline') {
            if (identifier.includes('prodline')) {
                const typedVal = target.value;
                formProdlineRef.current = typedVal;
                setEnteredProdline(typedVal);
                setIsDirty(true);
                const isFilled = Boolean(SelectedMfgAcronym?.trim() && typedVal.trim());
                setIsFieldsFilled(isFilled);
                FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
            }
        } else if (formMode === 'mfgeqtype') {
            if (identifier.includes('eqtype') || identifier.includes('mfgeqtype')) {
                const typedVal = target.value;
                formEqtypeRef.current = typedVal;
                setEnteredEqtype(typedVal);
                setIsDirty(true);
                const isFilled = Boolean(SelectedMfgAcronym?.trim() && SelectedMfgProdline?.trim() && typedVal.trim());
                setIsFieldsFilled(isFilled);
                FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
            }
        }
    }, [findMfg, formMode, setSelectedMfgAcronym, setIsDirty, SelectedMfgAcronym, SelectedMfgProdline]);

    // Handle typing / field changes in SettingsLibForm
    const handleFormValuesChangeExternal = useCallback((values: Record<string, unknown>) => {
        setIsDirty(true);

        if (formMode === 'mfg') {
            const rawAcronym = extractFieldValue(values, 'Acronym');
            const rawName = extractFieldValue(values, 'MfgName');
            const rawWebsite = extractFieldValue(values, 'Website');

            // Address values from AddressForm or flat fields
            const rawAddr1 = extractFieldValue(values, 'Address1');
            const rawAddr2 = extractFieldValue(values, 'Address2');
            const rawCity = extractFieldValue(values, 'City');
            const rawState = extractFieldValue(values, 'State');
            const rawCountry = extractFieldValue(values, 'Country');
            const rawZip = extractFieldValue(values, 'Zip');
            const rawCountryCode = extractFieldValue(values, 'CountryCode');

            formAddressRef.current = {
                Address1: rawAddr1 !== undefined && rawAddr1 !== '' ? rawAddr1 : formAddressRef.current.Address1,
                Address2: rawAddr2 !== undefined && rawAddr2 !== '' ? rawAddr2 : formAddressRef.current.Address2,
                City: rawCity !== undefined && rawCity !== '' ? rawCity : formAddressRef.current.City,
                State: rawState !== undefined && rawState !== '' ? rawState : formAddressRef.current.State,
                Country: rawCountry !== undefined && rawCountry !== '' ? rawCountry : formAddressRef.current.Country,
                Zip: rawZip !== undefined && rawZip !== '' ? rawZip : formAddressRef.current.Zip,
                CountryCode: rawCountryCode !== undefined && rawCountryCode !== '' ? rawCountryCode : formAddressRef.current.CountryCode,
            };

            // Did Acronym change?
            if (rawAcronym !== undefined && rawAcronym !== formAcronymRef.current) {
                formAcronymRef.current = rawAcronym;
                setEnteredAcronym(rawAcronym);

                const match = findMfg(rawAcronym);
                const container = formContainerRef.current;
                const mfgInput = container?.querySelector<HTMLInputElement>(
                    'input[id*="MfgName" i], input[name*="MfgName" i]'
                );
                const webInput = container?.querySelector<HTMLInputElement>(
                    'input[id*="Website" i], input[name*="Website" i]'
                );

                if (match) {
                    const addr = parseMfgAddress(match.address);
                    formMfgNameRef.current = match.mfgname;
                    formWebsiteRef.current = match.website ?? '';
                    formAddressRef.current = addr;
                    setSelectedMfgAcronym(match.mfgkey);
                    setEnteredMfgName(match.mfgname);

                    if (mfgInput && mfgInput.value !== match.mfgname) {
                        setDomInputValue(mfgInput, match.mfgname);
                    }
                    if (webInput && webInput.value !== (match.website ?? '')) {
                        setDomInputValue(webInput, match.website ?? '');
                    }

                    setInitialFormData({
                        mode: 'mfg',
                        acronym: match.mfgkey,
                        mfgName: match.mfgname,
                        website: match.website ?? '',
                        address: addr,
                        isExisting: true,
                        prodline: '',
                        eqtype: '',
                        relation: '',
                    });
                    setIsFieldsFilled(true);
                } else {
                    const isFilled = Boolean(rawAcronym.trim() && formMfgNameRef.current.trim());
                    setIsFieldsFilled(isFilled);
                }
            } else {
                if (rawName !== undefined && rawName !== formMfgNameRef.current) {
                    formMfgNameRef.current = rawName;
                    setEnteredMfgName(rawName);
                }
                if (rawWebsite !== undefined && rawWebsite !== formWebsiteRef.current) {
                    formWebsiteRef.current = rawWebsite;
                }
                const isFilled = Boolean(formAcronymRef.current.trim() && formMfgNameRef.current.trim());
                setIsFieldsFilled(isFilled);
            }
            return;
        }

        if (formMode === 'prodline') {
            const val = extractFieldValue(values, 'Prodline') ?? extractFieldValue(values, 'Mfg_Prodline') ?? extractFieldValue(values, 'Value') ?? '';
            formProdlineRef.current = val;
            setEnteredProdline(val);
            setIsFieldsFilled(Boolean(SelectedMfgAcronym?.trim() && val.trim()));
            return;
        }

        if (formMode === 'mfgeqtype') {
            const val = extractFieldValue(values, 'MfgEqType') ?? extractFieldValue(values, 'Mfg_MfgEqType') ?? extractFieldValue(values, 'Value') ?? '';
            formEqtypeRef.current = val;
            setEnteredEqtype(val);
            setIsFieldsFilled(Boolean(SelectedMfgAcronym?.trim() && SelectedMfgProdline?.trim() && val.trim()));
            return;
        }

        if (formMode === 'mfgrelation') {
            const val = extractFieldValue(values, 'MfgRelation') ?? extractFieldValue(values, 'Mfg_MfgRelation') ?? extractFieldValue(values, 'Value') ?? '';
            formRelationRef.current = val;
            setIsFieldsFilled(Boolean(SelectedMfgAcronym?.trim() && val.trim()));
            return;
        }
    }, [findMfg, formMode, setSelectedMfgAcronym, setIsDirty, SelectedMfgAcronym, SelectedMfgProdline]);

    const handleFormValueChange = useCallback((value: unknown, name?: string) => {
        setIsDirty(true);
        const val = getFieldValue(value);
        if (formMode === 'mfg') {
            if (name?.toLowerCase() === 'acronym') {
                if (val !== formAcronymRef.current) {
                    formAcronymRef.current = val;
                    setEnteredAcronym(val);
                    const match = findMfg(val);
                    const container = formContainerRef.current;
                    const mfgInput = container?.querySelector<HTMLInputElement>(
                        'input[id*="MfgName" i], input[name*="MfgName" i]'
                    );
                    const webInput = container?.querySelector<HTMLInputElement>(
                        'input[id*="Website" i], input[name*="Website" i]'
                    );
                    if (match) {
                        const addr = parseMfgAddress(match.address);
                        formMfgNameRef.current = match.mfgname;
                        formWebsiteRef.current = match.website ?? '';
                        formAddressRef.current = addr;
                        setSelectedMfgAcronym(match.mfgkey);
                        setEnteredMfgName(match.mfgname);

                        if (mfgInput && mfgInput.value !== match.mfgname) {
                            setDomInputValue(mfgInput, match.mfgname);
                        }
                        if (webInput && webInput.value !== (match.website ?? '')) {
                            setDomInputValue(webInput, match.website ?? '');
                        }

                        setInitialFormData({
                            mode: 'mfg',
                            acronym: match.mfgkey,
                            mfgName: match.mfgname,
                            website: match.website ?? '',
                            address: addr,
                            isExisting: true,
                            prodline: '',
                            eqtype: '',
                            relation: '',
                        });
                        setIsFieldsFilled(true);
                    } else {
                        const isFilled = Boolean(val.trim() && formMfgNameRef.current.trim());
                        setIsFieldsFilled(isFilled);
                    }
                }
            } else if (name?.toLowerCase() === 'mfgname') {
                formMfgNameRef.current = val;
                setEnteredMfgName(val);
                const isFilled = Boolean(formAcronymRef.current.trim() && val.trim());
                setIsFieldsFilled(isFilled);
                FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
            } else if (name?.toLowerCase() === 'website') {
                formWebsiteRef.current = val;
                const isFilled = Boolean(formAcronymRef.current.trim() && formMfgNameRef.current.trim());
                setIsFieldsFilled(isFilled);
                FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
            }
        } else if (formMode === 'prodline') {
            formProdlineRef.current = val;
            setEnteredProdline(val);
            const isFilled = Boolean(SelectedMfgAcronym?.trim() && val.trim());
            setIsFieldsFilled(isFilled);
            FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
        } else if (formMode === 'mfgeqtype') {
            formEqtypeRef.current = val;
            setEnteredEqtype(val);
            const isFilled = Boolean(SelectedMfgAcronym?.trim() && SelectedMfgProdline?.trim() && val.trim());
            setIsFieldsFilled(isFilled);
            FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
        } else if (formMode === 'mfgrelation') {
            formRelationRef.current = val;
            const isFilled = Boolean(SelectedMfgAcronym?.trim() && val.trim());
            setIsFieldsFilled(isFilled);
            FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
        }
    }, [findMfg, formMode, setSelectedMfgAcronym, setIsDirty, SelectedMfgAcronym, SelectedMfgProdline]);

    // Save Handlers for each mode
    const handleSaveMfg = useCallback(async (mergedProfile?: Record<string, unknown>) => {
        try {
            const acronymFromProfile = extractFieldValue(mergedProfile ?? {}, 'Acronym');
            const mfgNameFromProfile = extractFieldValue(mergedProfile ?? {}, 'MfgName');
            const websiteFromProfile = extractFieldValue(mergedProfile ?? {}, 'Website');

            const acronym = getFieldValue(acronymFromProfile ?? formAcronymRef.current ?? initialFormData.acronym).trim();
            const mfgName = getFieldValue(mfgNameFromProfile ?? formMfgNameRef.current ?? initialFormData.mfgName).trim();
            const website = getFieldValue(websiteFromProfile ?? formWebsiteRef.current ?? initialFormData.website).trim();

            // Extract address from mergedProfile or formAddressRef
            const addrData: Partial<IMfgAddressData> = {
                Address1: getFieldValue(extractFieldValue(mergedProfile ?? {}, 'Address1') ?? formAddressRef.current.Address1),
                Address2: getFieldValue(extractFieldValue(mergedProfile ?? {}, 'Address2') ?? formAddressRef.current.Address2),
                City: getFieldValue(extractFieldValue(mergedProfile ?? {}, 'City') ?? formAddressRef.current.City),
                State: getFieldValue(extractFieldValue(mergedProfile ?? {}, 'State') ?? formAddressRef.current.State),
                Country: getFieldValue(extractFieldValue(mergedProfile ?? {}, 'Country') ?? formAddressRef.current.Country),
                Zip: getFieldValue(extractFieldValue(mergedProfile ?? {}, 'Zip') ?? formAddressRef.current.Zip),
                CountryCode: getFieldValue(extractFieldValue(mergedProfile ?? {}, 'CountryCode') ?? formAddressRef.current.CountryCode),
            };
            const address = serializeMfgAddress(addrData);

            if (!acronym || !mfgName) {
                showMessageDialog('Enter Acronym and MfgName.');
                return;
            }

            const isMfgModeAdd = !initialFormData.isExisting || isMfgUnique;
            if (!isMfgModeAdd) {
                const originalRecord = findMfg(SelectedMfgAcronym) || findMfg(acronym);
                if (!originalRecord) {
                    showMessageDialog('Manufacturer record not found.');
                    return;
                }
                const res = await updateManufacturer({ acronym, mfgName, address, website }, originalRecord);
                if (res.success) {
                    setSelectedMfgAcronym(acronym);
                    formAcronymRef.current = acronym;
                    formMfgNameRef.current = mfgName;
                    formWebsiteRef.current = website;
                    formAddressRef.current = addrData as IMfgAddressData;
                    setEnteredAcronym(acronym);
                    setEnteredMfgName(mfgName);
                    setInitialFormData((prev) => ({
                        ...prev,
                        acronym,
                        mfgName,
                        website,
                        address: addrData as IMfgAddressData,
                        isExisting: true,
                    }));
                    setIsFormChanged(false);
                    FnHideShowSaveIconForForm('hide');
                    showMessageDialog('Updated successfully.');
                } else if (res.error) {
                    showMessageDialog(res.error);
                }
            } else {
                // Check for duplicate acronym or name
                const normKey = normalizeMfgKey(acronym);
                const normName = mfgName.toLowerCase();
                const isDup = manufacturers.some(
                    (m) => normalizeMfgKey(m.mfgkey) === normKey || m.mfgname.trim().toLowerCase() === normName
                );
                if (isDup) {
                    showMessageDialog('Acronym and Mfg already exists.');
                    return;
                }

                const res = await addManufacturer({ acronym, mfgName, address, website });
                if (res.success) {
                    setSelectedMfgAcronym(acronym);
                    formAcronymRef.current = acronym;
                    formMfgNameRef.current = mfgName;
                    formWebsiteRef.current = website;
                    formAddressRef.current = addrData as IMfgAddressData;
                    setEnteredAcronym(acronym);
                    setEnteredMfgName(mfgName);
                    setInitialFormData((prev) => ({
                        ...prev,
                        acronym,
                        mfgName,
                        website,
                        address: addrData as IMfgAddressData,
                        isExisting: true,
                    }));
                    setIsFormChanged(false);
                    FnHideShowSaveIconForForm('hide');
                    showMessageDialog('Created successfully.');
                } else if (res.error) {
                    showMessageDialog(res.error);
                }
            }
        } catch (err: unknown) {
            console.error('Error saving manufacturer:', err);
            const msg = err instanceof Error ? err.message : 'Failed to save manufacturer.';
            showMessageDialog(msg);
        } finally {
            if (!dirtyFlagRef.current) {
                FnHideShowSaveIconForForm('hide');
            }
        }
    }, [
        SelectedMfgAcronym,
        addManufacturer,
        findMfg,
        initialFormData.acronym,
        initialFormData.isExisting,
        initialFormData.mfgName,
        initialFormData.website,
        isMfgUnique,
        manufacturers,
        setSelectedMfgAcronym,
        showMessageDialog,
        updateManufacturer,
    ]);

    const handleSaveProdline = useCallback(async (mergedProfile?: Record<string, unknown>) => {
        try {
            const val = getFieldValue(mergedProfile?.Prodline ?? formProdlineRef.current ?? initialFormData.prodline ?? SelectedMfgProdline).trim();
            if (!SelectedMfgAcronym) {
                showMessageDialog('Select a manufacturer.');
                return;
            }
            if (!val) {
                showMessageDialog('Enter a Prodline.');
                return;
            }

            const normVal = val.toLowerCase();
            const isMatchInCombo = prodlineOptions.some(
                (opt) => opt.value.trim().toLowerCase() === normVal ||
                         opt.label.trim().toLowerCase() === normVal
            );

            if (isMatchInCombo) {
                setSelectedMfgProdline(val);
                formProdlineRef.current = val;
                setEnteredProdline(val);
                setInitialFormData((prev) => ({ ...prev, prodline: val }));
                setIsFormChanged(false);
                FnHideShowSaveIconForForm('hide');
                showMessageDialog('Updated successfully.');
            } else {
                const res = await addProdline(SelectedMfgAcronym, val);
                if (res.success) {
                    const newProdlineNode: ITreeNode = {
                        key: prodlineNodeKey(SelectedMfgAcronym, val),
                        NodeEntityname: 'Prodline',
                        NodeEntID: val,
                        stepNo: 2,
                        parentEntID: mfgNodeKey(SelectedMfgAcronym),
                        Description: `${SelectedMfgAcronym} / ${val}`,
                        title: val,
                        children: [],
                        treetype: 'Prodline',
                        Name: val,
                        Type: 'Prodline',
                        icon: prodlineIcon,
                        HasChildren: 1,
                        isLeaf: false,
                        NodeType: 'Prodline',
                        mfgAcronym: SelectedMfgAcronym,
                        prodline: val,
                    };
                    setTreeData((prev) => appendChildToNodeInTree(prev, mfgNodeKey(SelectedMfgAcronym), newProdlineNode));

                    setSelectedMfgProdline(val);
                    formProdlineRef.current = val;
                    setEnteredProdline(val);
                    setInitialFormData((prev) => ({ ...prev, prodline: val }));
                    setExpandedKeys((prev) => Array.from(new Set([
                        ...prev,
                        ROOT_KEY,
                        mfgNodeKey(SelectedMfgAcronym),
                    ])));
                    setIsFormChanged(false);
                    FnHideShowSaveIconForForm('hide');
                    showMessageDialog('Created successfully.');
                } else if (res.error) {
                    showMessageDialog(res.error);
                }
            }
        } catch (err: unknown) {
            console.error('Error saving Prodline:', err);
            const msg = err instanceof Error ? err.message : 'Failed to save Prodline.';
            showMessageDialog(msg);
        } finally {
            if (!dirtyFlagRef.current) {
                FnHideShowSaveIconForForm('hide');
            }
        }
    }, [
        SelectedMfgAcronym,
        SelectedMfgProdline,
        addProdline,
        initialFormData.prodline,
        prodlineIcon,
        prodlineOptions,
        showMessageDialog,
    ]);

    const handleSaveEqtype = useCallback(async (mergedProfile?: Record<string, unknown>) => {
        try {
            const val = getFieldValue(mergedProfile?.MfgEqType ?? formEqtypeRef.current ?? initialFormData.eqtype ?? SelectedMfgEqtype).trim();
            if (!SelectedMfgAcronym) {
                showMessageDialog('Select a manufacturer.');
                return;
            }
            if (!val) {
                showMessageDialog('Enter a MfgEqType.');
                return;
            }

            const normVal = val.toLowerCase();
            const isMatchInCombo = eqtypeOptions.some(
                (opt) => opt.value.trim().toLowerCase() === normVal ||
                         opt.label.trim().toLowerCase() === normVal
            );

            if (isMatchInCombo) {
                setSelectedMfgEqtype(val);
                formEqtypeRef.current = val;
                setEnteredEqtype(val);
                setInitialFormData((prev) => ({ ...prev, eqtype: val }));
                setIsFormChanged(false);
                FnHideShowSaveIconForForm('hide');
                showMessageDialog('Updated successfully.');
            } else {
                const res = await addMfgEqtype(SelectedMfgAcronym, val);
                if (res.success) {
                    const parentKey = prodlineNodeKey(SelectedMfgAcronym, SelectedMfgProdline);
                    const newEqtypeNode: ITreeNode = {
                        key: eqtypeNodeKey(SelectedMfgAcronym, SelectedMfgProdline, val),
                        NodeEntityname: 'MfgEqtype',
                        NodeEntID: val,
                        stepNo: 3,
                        parentEntID: parentKey,
                        Description: val,
                        title: val,
                        children: [],
                        treetype: 'MfgEqtype',
                        Name: val,
                        Type: 'MfgEqtype',
                        icon: eqtypeIcon,
                        HasChildren: 0,
                        isLeaf: true,
                        NodeType: 'MfgEqtype',
                        mfgAcronym: SelectedMfgAcronym,
                        prodline: SelectedMfgProdline,
                        eqtype: val,
                    };
                    setTreeData((prev) => appendChildToNodeInTree(prev, parentKey, newEqtypeNode));

                    setSelectedMfgEqtype(val);
                    formEqtypeRef.current = val;
                    setEnteredEqtype(val);
                    setInitialFormData((prev) => ({ ...prev, eqtype: val }));
                    setExpandedKeys((prev) => Array.from(new Set([
                        ...prev,
                        ROOT_KEY,
                        mfgNodeKey(SelectedMfgAcronym),
                        prodlineNodeKey(SelectedMfgAcronym, SelectedMfgProdline),
                    ])));
                    setIsFormChanged(false);
                    FnHideShowSaveIconForForm('hide');
                    showMessageDialog('Created successfully.');
                } else if (res.error) {
                    showMessageDialog(res.error);
                }
            }
        } catch (err: unknown) {
            console.error('Error saving MfgEqType:', err);
            const msg = err instanceof Error ? err.message : 'Failed to save MfgEqType.';
            showMessageDialog(msg);
        } finally {
            if (!dirtyFlagRef.current) {
                FnHideShowSaveIconForForm('hide');
            }
        }
    }, [
        SelectedMfgAcronym,
        SelectedMfgEqtype,
        SelectedMfgProdline,
        addMfgEqtype,
        eqtypeIcon,
        eqtypeOptions,
        initialFormData.eqtype,
        showMessageDialog,
    ]);

    const handleSaveRelation = useCallback(async (mergedProfile?: Record<string, unknown>) => {
        try {
            const val = getFieldValue(mergedProfile?.MfgRelation ?? formRelationRef.current ?? initialFormData.relation).trim();
            if (!SelectedMfgAcronym) {
                showMessageDialog('Select a manufacturer.');
                return;
            }
            if (!val) {
                showMessageDialog('Enter a MfgRelation.');
                return;
            }
            const normKey = normalizeMfgKey(SelectedMfgAcronym);
            const currentList = rmsContext.mfgRelation[normKey] ?? [];
            const exists = currentList.some((r) => r.trim().toLowerCase() === val.toLowerCase());

            if (exists) {
                formRelationRef.current = val;
                setInitialFormData((prev) => ({ ...prev, relation: val }));
                setIsFormChanged(false);
                FnHideShowSaveIconForForm('hide');
                showMessageDialog('Updated successfully.');
            } else {
                const res = await addMfgRelation(SelectedMfgAcronym, val);
                if (res.success) {
                    formRelationRef.current = val;
                    setInitialFormData((prev) => ({ ...prev, relation: val }));
                    setIsFormChanged(false);
                    FnHideShowSaveIconForForm('hide');
                    showMessageDialog('Created successfully.');
                } else if (res.error) {
                    showMessageDialog(res.error);
                }
            }
        } catch (err: unknown) {
            console.error('Error saving MfgRelation:', err);
            const msg = err instanceof Error ? err.message : 'Failed to save MfgRelation.';
            showMessageDialog(msg);
        } finally {
            if (!dirtyFlagRef.current) {
                FnHideShowSaveIconForForm('hide');
            }
        }
    }, [SelectedMfgAcronym, addMfgRelation, initialFormData.relation, rmsContext.mfgRelation, showMessageDialog]);

    // Unified Save dispatcher from SettingsLibForm
    const handleSaveCurrentForm = useCallback(async (profileData?: string) => {
        try {
            let merged: Record<string, unknown> = {};
            if (profileData) {
                merged = parseProfileString(profileData);
            }

            if (formMode === 'mfg') {
                await handleSaveMfg(merged);
            } else if (formMode === 'prodline') {
                await handleSaveProdline(merged);
            } else if (formMode === 'mfgeqtype') {
                await handleSaveEqtype(merged);
            } else if (formMode === 'mfgrelation') {
                await handleSaveRelation(merged);
            }
        } catch (err: unknown) {
            console.error('Error in handleSaveCurrentForm:', err);
            const msg = err instanceof Error ? err.message : 'Save operation failed.';
            showMessageDialog(msg);
        }
    }, [formMode, handleSaveEqtype, handleSaveMfg, handleSaveProdline, handleSaveRelation, showMessageDialog]);

    const sortedMfg = useMemo(() => {
        return [...manufacturers].sort((a, b) =>
            (a.mfgname || '').localeCompare(b.mfgname || '') || (a.mfgkey || '').localeCompare(b.mfgkey || '')
        );
    }, [manufacturers]);

    // Filter manufacturers by search text
    const filteredMfg = useMemo(() => {
        const query = searchText.trim().toLowerCase();
        if (!query) return sortedMfg;
        return sortedMfg.filter((row) => {
            const mfgName = String(row.mfgname || '').toLowerCase();
            const mfgKey = String(row.mfgkey || '').toLowerCase();
            if (mfgName.includes(query) || mfgKey.includes(query)) {
                return true;
            }
            const key = normalizeMfgKey(row.mfgkey);
            const prodlines = rmsContext.mfgVsProdline[key] ?? [];
            if (prodlines.some((p) => String(p).toLowerCase().includes(query))) {
                return true;
            }
            const eqtypes = rmsContext.mfgVsMfgEqtype[key] ?? [];
            if (eqtypes.some((e) => String(e).toLowerCase().includes(query))) {
                return true;
            }
            return false;
        });
    }, [rmsContext.mfgVsMfgEqtype, rmsContext.mfgVsProdline, searchText, sortedMfg]);

    // Build hierarchical tree base data (Root + Manufacturer nodes), preserving loaded subtrees
    const buildBaseTree = useCallback((prevTree?: ITreeNode[]): ITreeNode[] => {
        const rootLabel = headerText.replace(/^\[[^\]]+\]\s*/, '').trim() || 'Manufacturer';
        const mfgNodes: ITreeNode[] = [];
        const mfgLen = filteredMfg.length;

        // Preserve already-loaded subtrees from prevTree if present
        const existingMap = new Map<Key, ITreeNode>();
        if (prevTree && prevTree.length > 0 && prevTree[0].children) {
            const rootChildren = prevTree[0].children;
            for (let i = 0; i < rootChildren.length; i++) {
                existingMap.set(rootChildren[i].key, rootChildren[i]);
            }
        }

        for (let i = 0; i < mfgLen; i++) {
            const row = filteredMfg[i];
            const acronym = row.mfgkey;
            const mKey = mfgNodeKey(acronym);
            const existing = existingMap.get(mKey);

            if (existing) {
                mfgNodes.push({
                    ...existing,
                    title: row.mfgname,
                    Name: row.mfgname,
                    TableLabel: row.mfgname,
                    mfgName: row.mfgname,
                });
            } else {
                mfgNodes.push({
                    key: mKey,
                    NodeEntityname: 'Mfg',
                    NodeEntID: acronym,
                    stepNo: 1,
                    parentEntID: ROOT_KEY,
                    Description: acronym,
                    title: row.mfgname,
                    children: [],
                    treetype: 'Mfg',
                    Name: row.mfgname,
                    TableLabel: row.mfgname,
                    Type: 'Mfg',
                    icon: mfgIcon,
                    HasChildren: 1,
                    isLeaf: false,
                    NodeType: 'Mfg',
                    mfgAcronym: acronym,
                    mfgName: row.mfgname,
                });
            }
        }

        const rootNode: ITreeNode = {
            key: ROOT_KEY,
            NodeEntityname: 'Root',
            NodeEntID: ROOT_KEY,
            stepNo: 0,
            parentEntID: null,
            Description: rootLabel,
            title: rootLabel,
            children: mfgNodes,
            treetype: 'Root',
            Name: `${rootLabel} (${mfgNodes.length})`,
            TableLabel: `${rootLabel} (${mfgNodes.length})`,
            Type: 'Root',
            icon: null,
            HasChildren: mfgNodes.length,
            isLeaf: mfgNodes.length === 0,
            NodeType: 'Root',
        };

        return [rootNode];
    }, [filteredMfg, headerText, mfgIcon]);

    const [treeData, setTreeData] = useState<ITreeNode[]>(() => buildBaseTree());

    useEffect(() => {
        setTreeData((prev) => buildBaseTree(prev));
    }, [buildBaseTree]);

    const isSelectedInFiltered = useMemo(() => {
        if (!SelectedMfgAcronym) return true;
        return filteredMfg.some((m) => normalizeMfgKey(m.mfgkey) === normalizeMfgKey(SelectedMfgAcronym));
    }, [SelectedMfgAcronym, filteredMfg]);

    const selectedKey = useMemo(() => {
        if (!isSelectedInFiltered) {
            return ROOT_KEY;
        }
        if (formMode === 'mfgeqtype' && SelectedMfgEqtype && SelectedMfgProdline && SelectedMfgAcronym) {
            return eqtypeNodeKey(SelectedMfgAcronym, SelectedMfgProdline, SelectedMfgEqtype);
        }
        if (formMode === 'prodline' && SelectedMfgProdline && SelectedMfgAcronym) {
            return prodlineNodeKey(SelectedMfgAcronym, SelectedMfgProdline);
        }
        if (SelectedMfgAcronym) {
            return mfgNodeKey(SelectedMfgAcronym);
        }
        return ROOT_KEY;
    }, [SelectedMfgAcronym, SelectedMfgEqtype, SelectedMfgProdline, formMode, isSelectedInFiltered]);

    const defaultSelectedKeys = useMemo(() => [selectedKey], [selectedKey]);

    const defaultSelectedNodeInfo = useMemo<ISelectedNodeInfo | undefined>(() => {
        if (selectedKey === ROOT_KEY && treeData.length > 0) {
            return {
                event: 'select',
                selected: true,
                node: treeData[0],
                selectedNodes: [treeData[0]],
            };
        }
        return undefined;
    }, [selectedKey, treeData]);

    // Initial load: ensure root node is set as default command node
    useEffect(() => {
        if (!SelectedMfgAcronym && treeData.length > 0 && !commandNode) {
            setCommandNode(treeData[0]);
        }
    }, [SelectedMfgAcronym, commandNode, treeData]);

    // When searching, auto-expand the root and matched manufacturer nodes
    useEffect(() => {
        const query = searchText.trim().toLowerCase();
        const prevQuery = prevSearchTextRef.current.trim().toLowerCase();
        prevSearchTextRef.current = searchText;

        if (query) {
            const keysToExpand: Key[] = [ROOT_KEY];
            for (let i = 0; i < filteredMfg.length; i++) {
                const row = filteredMfg[i];
                const mKey = mfgNodeKey(row.mfgkey);
                keysToExpand.push(mKey);
                const normKey = normalizeMfgKey(row.mfgkey);
                const prodlines = rmsContext.mfgVsProdline[normKey] ?? [];
                for (let j = 0; j < prodlines.length; j++) {
                    const p = prodlines[j];
                    const eqtypes = rmsContext.mfgVsMfgEqtype[normKey] ?? [];
                    if (
                        String(p).toLowerCase().includes(query) ||
                        eqtypes.some((e) => String(e).toLowerCase().includes(query))
                    ) {
                        keysToExpand.push(prodlineNodeKey(row.mfgkey, p));
                    }
                }
            }
            setExpandedKeys(Array.from(new Set(keysToExpand)));
        } else if (prevQuery && !query) {
            const baseKeys: Key[] = [ROOT_KEY];
            if (SelectedMfgAcronym) {
                baseKeys.push(mfgNodeKey(SelectedMfgAcronym));
                if (SelectedMfgProdline) {
                    baseKeys.push(prodlineNodeKey(SelectedMfgAcronym, SelectedMfgProdline));
                }
            }
            setExpandedKeys(Array.from(new Set(baseKeys)));
        }
    }, [filteredMfg, SelectedMfgAcronym, SelectedMfgProdline, rmsContext.mfgVsMfgEqtype, rmsContext.mfgVsProdline, searchText]);

    // Handle node selection in the tree
    const handleNodeSelect = useCallback((
        _selectedKeys: Key[],
        info: ISelectedNodeInfo,
        expandedNodeKeys?: Key[]
    ) => {
        if (info.event === 'auto-select-expand' && expandedNodeKeys) {
            setExpandedKeys(expandedNodeKeys);
        }
        applySelection(info.node);
        setCommandNode(info.node);
        setStatusMessage('');
        setFormSessionId(`node-${String(info.node.key)}`);
    }, [applySelection, setStatusMessage]);

    // Search or Search Next in the local tree
    const handleKeywordSearch = useCallback((value: string) => {
        const query = value.trim();
        if (!query || !treeData.length) return;

        const result = FnSearchKeywordInLocalTree(query, treeData, searchHistory);
        if (result?.foundNode) {
            const parentKeys: Key[] = [];
            if (result.parentNodes && result.parentNodes.length > 0) {
                for (let i = 0; i < result.parentNodes.length; i++) {
                    parentKeys.push(result.parentNodes[i].key);
                }
            } else {
                parentKeys.push(ROOT_KEY);
            }
            const nodeKey = result.foundNode.key;
            setExpandedKeys((prev) => Array.from(new Set([...prev, ...parentKeys, nodeKey])));
            handleNodeSelect([nodeKey], {
                event: 'select',
                selected: true,
                node: result.foundNode,
                selectedNodes: [result.foundNode],
            }, parentKeys);
            const historyToAdd = [String(nodeKey)];
            if (result.foundNode.NodeEntID) {
                historyToAdd.push(String(result.foundNode.NodeEntID));
            }
            setSearchHistory((prev) => [...prev, ...historyToAdd]);
        } else if (searchHistory.length > 0) {
            // Loop back to start if reached end of results
            const wrapResult = FnSearchKeywordInLocalTree(query, treeData, []);
            if (wrapResult?.foundNode) {
                const parentKeys: Key[] = [];
                if (wrapResult.parentNodes && wrapResult.parentNodes.length > 0) {
                    for (let i = 0; i < wrapResult.parentNodes.length; i++) {
                        parentKeys.push(wrapResult.parentNodes[i].key);
                    }
                } else {
                    parentKeys.push(ROOT_KEY);
                }
                const nodeKey = wrapResult.foundNode.key;
                setExpandedKeys((prev) => Array.from(new Set([...prev, ...parentKeys, nodeKey])));
                handleNodeSelect([nodeKey], {
                    event: 'select',
                    selected: true,
                    node: wrapResult.foundNode,
                    selectedNodes: [wrapResult.foundNode],
                }, parentKeys);
                const historyToAdd = [String(nodeKey)];
                if (wrapResult.foundNode.NodeEntID) {
                    historyToAdd.push(String(wrapResult.foundNode.NodeEntID));
                }
                setSearchHistory(historyToAdd);
            }
        }
    }, [handleNodeSelect, searchHistory, treeData]);

    // Helper: recursively resolve single-child descent for manufacturer down to leaf or branching level
    const resolveSingleChildDescentForMfg = useCallback(async (
        acronym: string,
        mfgName: string,
        baseKeys: Key[]
    ): Promise<{ keysToExpand: Key[]; targetNode: ITreeNode; childrenToInsert: ITreeNode[] }> => {
        const mKey = mfgNodeKey(acronym);
        const keys: Key[] = Array.from(new Set([...baseKeys, mKey]));

        const prodlines = await loadProdlines(acronym);

        if (prodlines.length > 1) {
            // Multiple prodlines: do not call API to load mfgeqtypes
            const prodlineNodes: ITreeNode[] = [];
            const pLen = prodlines.length;
            for (let i = 0; i < pLen; i++) {
                const p = prodlines[i];
                prodlineNodes.push({
                    key: prodlineNodeKey(acronym, p),
                    NodeEntityname: 'Prodline',
                    NodeEntID: p,
                    stepNo: 2,
                    parentEntID: mKey,
                    Description: `${acronym} / ${p}`,
                    title: p,
                    children: [],
                    treetype: 'Prodline',
                    Name: p,
                    Type: 'Prodline',
                    icon: prodlineIcon,
                    HasChildren: 1,
                    isLeaf: false,
                    NodeType: 'Prodline',
                    mfgAcronym: acronym,
                    prodline: p,
                });
            }
            const targetNode = prodlineNodes[0];
            return { keysToExpand: keys, targetNode, childrenToInsert: prodlineNodes };
        }

        if (prodlines.length === 1) {
            // Single prodline: load eqtypes and auto-descend down to end node (eqtype)
            const p0 = prodlines[0];
            const p0Key = prodlineNodeKey(acronym, p0);
            keys.push(p0Key);

            const eqtypes = await loadEqtypes(acronym);

            const eqtypeNodes: ITreeNode[] = [];
            const eLen = eqtypes.length;
            for (let i = 0; i < eLen; i++) {
                const eqtype = eqtypes[i];
                eqtypeNodes.push({
                    key: eqtypeNodeKey(acronym, p0, eqtype),
                    NodeEntityname: 'MfgEqtype',
                    NodeEntID: eqtype,
                    stepNo: 3,
                    parentEntID: p0Key,
                    Description: eqtype,
                    title: eqtype,
                    children: [],
                    treetype: 'MfgEqtype',
                    Name: eqtype,
                    Type: 'MfgEqtype',
                    icon: eqtypeIcon,
                    HasChildren: 0,
                    isLeaf: true,
                    NodeType: 'MfgEqtype',
                    mfgAcronym: acronym,
                    prodline: p0,
                    eqtype,
                });
            }

            const p0Node: ITreeNode = {
                key: p0Key,
                NodeType: 'Prodline',
                treetype: 'Prodline',
                NodeEntityname: 'Prodline',
                NodeEntID: p0,
                stepNo: 2,
                parentEntID: mKey,
                Description: `${acronym} / ${p0}`,
                title: p0,
                children: eqtypeNodes,
                Name: p0,
                Type: 'Prodline',
                icon: prodlineIcon,
                HasChildren: eqtypeNodes.length,
                isLeaf: eqtypeNodes.length === 0,
                mfgAcronym: acronym,
                prodline: p0,
            };

            const targetNode = eqtypeNodes.length >= 1 ? eqtypeNodes[0] : p0Node;
            return { keysToExpand: keys, targetNode, childrenToInsert: [p0Node] };
        }

        // prodlines.length === 0
        const targetNode: ITreeNode = {
            key: mKey,
            NodeType: 'Mfg',
            treetype: 'Mfg',
            NodeEntityname: 'Mfg',
            NodeEntID: acronym,
            stepNo: 1,
            parentEntID: ROOT_KEY,
            Description: acronym,
            title: mfgName,
            children: [],
            Name: mfgName,
            TableLabel: mfgName,
            Type: 'Mfg',
            icon: mfgIcon,
            HasChildren: 0,
            isLeaf: true,
            mfgAcronym: acronym,
            mfgName,
        };
        return { keysToExpand: keys, targetNode, childrenToInsert: [] };
    }, [eqtypeIcon, loadEqtypes, loadProdlines, mfgIcon, prodlineIcon]);

    // Handle node expansion in the tree with single-child level descent down to end level
    const handleNodeExpand = useCallback(async (expandedNodeKeys: Key[], info: IExpandedNodeInfo) => {
        if (!info || !info.node) {
            setExpandedKeys(expandedNodeKeys);
            return;
        }

        const nodeTypeLower = String(info.node.NodeType ?? '').toLowerCase();
        const nodeKey = info.node.key;

        // Node collapsed: collapse subtree and select collapsed node
        if (!info.expanded) {
            const targetKey = String(nodeKey);
            const acronym = String(info.node.mfgAcronym ?? info.node.NodeEntID ?? '').trim();

            let updatedKeys = (expandedNodeKeys as string[]).filter((k) => k !== targetKey);
            if (nodeTypeLower === 'mfg' && acronym) {
                const normKey = normalizeMfgKey(acronym);
                updatedKeys = updatedKeys.filter(
                    (k) => !k.startsWith(`prodline__${normKey}__`) && !k.startsWith(`eqtype__${normKey}__`)
                );
            } else if (nodeTypeLower === 'prodline' && acronym) {
                const prodline = String(info.node.prodline ?? info.node.NodeEntID ?? '').trim();
                const prefix = `eqtype__${normalizeMfgKey(acronym)}__${encodeURIComponent(prodline)}__`;
                updatedKeys = updatedKeys.filter((k) => !k.startsWith(prefix));
            } else if (nodeTypeLower === 'root' || targetKey === ROOT_KEY) {
                updatedKeys = [];
            }
            setExpandedKeys(updatedKeys);
            applySelection(info.node);
            setCommandNode(info.node);
            setStatusMessage('');
            setFormSessionId(`node-${targetKey}`);
            return;
        }

        // Node expanded: single child auto-expansion down to end level or branching level
        const baseExpanded = Array.from(new Set([...expandedNodeKeys, nodeKey]));

        startLoading();
        try {
            if (nodeTypeLower === 'mfg') {
                const acronym = String(info.node.mfgAcronym ?? info.node.NodeEntID ?? '').trim();
                const mfgRecord = findMfg(acronym);
                const mfgName = mfgRecord?.mfgname || String(info.node.mfgName || info.node.title || acronym);

                const { keysToExpand, targetNode, childrenToInsert } = await resolveSingleChildDescentForMfg(
                    acronym,
                    mfgName,
                    baseExpanded
                );

                setTreeData((prev) => updateNodeChildrenInTree(prev, mfgNodeKey(acronym), childrenToInsert));
                setExpandedKeys(Array.from(new Set(keysToExpand)));
                applySelection(targetNode);
                setCommandNode(targetNode);
                setStatusMessage('');
                setFormSessionId(`node-${String(targetNode.key)}`);
                return;
            }

            if (nodeTypeLower === 'prodline') {
                const acronym = String(info.node.mfgAcronym ?? '').trim();
                const prodline = String(info.node.prodline ?? info.node.NodeEntID ?? '').trim();
                const pKey = prodlineNodeKey(acronym, prodline);
                const keysToExpand = Array.from(new Set([...baseExpanded, pKey]));

                const eqtypes = await loadEqtypes(acronym);

                const eqtypeNodes: ITreeNode[] = [];
                const eLen = eqtypes.length;
                for (let i = 0; i < eLen; i++) {
                    const e = eqtypes[i];
                    eqtypeNodes.push({
                        key: eqtypeNodeKey(acronym, prodline, e),
                        NodeType: 'MfgEqtype',
                        treetype: 'MfgEqtype',
                        NodeEntityname: 'MfgEqtype',
                        NodeEntID: e,
                        stepNo: 3,
                        parentEntID: pKey,
                        Description: e,
                        title: e,
                        children: [],
                        Name: e,
                        Type: 'MfgEqtype',
                        icon: eqtypeIcon,
                        HasChildren: 0,
                        isLeaf: true,
                        mfgAcronym: acronym,
                        prodline,
                        eqtype: e,
                    });
                }

                setTreeData((prev) => updateNodeChildrenInTree(prev, pKey, eqtypeNodes));

                const targetNode = eqtypeNodes.length >= 1 ? eqtypeNodes[0] : info.node;
                setExpandedKeys(keysToExpand);
                applySelection(targetNode);
                setCommandNode(targetNode);
                setStatusMessage('');
                setFormSessionId(`node-${String(targetNode.key)}`);
                return;
            }

            if (nodeTypeLower === 'root' || nodeKey === ROOT_KEY) {
                const keysToExpand = Array.from(new Set([...baseExpanded, ROOT_KEY]));

                if (filteredMfg.length === 1) {
                    const m0 = filteredMfg[0];
                    const { keysToExpand: descentKeys, targetNode, childrenToInsert } = await resolveSingleChildDescentForMfg(
                        m0.mfgkey,
                        m0.mfgname,
                        keysToExpand
                    );
                    setTreeData((prev) => updateNodeChildrenInTree(prev, mfgNodeKey(m0.mfgkey), childrenToInsert));
                    setExpandedKeys(Array.from(new Set(descentKeys)));
                    applySelection(targetNode);
                    setCommandNode(targetNode);
                    setStatusMessage('');
                    setFormSessionId(`node-${String(targetNode.key)}`);
                    return;
                }

                if (filteredMfg.length > 1) {
                    const m0 = filteredMfg[0];
                    const m0Key = mfgNodeKey(m0.mfgkey);
                    const m0Node: ITreeNode = {
                        key: m0Key,
                        NodeType: 'Mfg',
                        treetype: 'Mfg',
                        NodeEntityname: 'Mfg',
                        NodeEntID: m0.mfgkey,
                        stepNo: 1,
                        parentEntID: ROOT_KEY,
                        Description: m0.mfgkey,
                        title: m0.mfgname,
                        children: [],
                        Name: m0.mfgname,
                        TableLabel: m0.mfgname,
                        Type: 'Mfg',
                        icon: mfgIcon,
                        HasChildren: 1,
                        isLeaf: false,
                        mfgAcronym: m0.mfgkey,
                        mfgName: m0.mfgname,
                    };
                    setExpandedKeys(keysToExpand);
                    applySelection(m0Node);
                    setCommandNode(m0Node);
                    setStatusMessage('');
                    setFormSessionId(`node-${m0Key}`);
                    return;
                }

                // filteredMfg.length === 0
                setExpandedKeys(keysToExpand);
                applySelection(info.node);
                setCommandNode(info.node);
                setStatusMessage('');
                setFormSessionId(`node-${ROOT_KEY}`);
                return;
            }

            // Fallback for leaf nodes or other types
            setExpandedKeys(baseExpanded);
            applySelection(info.node);
            setCommandNode(info.node);
            setStatusMessage('');
            setFormSessionId(`node-${String(info.node.key)}`);
        } finally {
            stopLoading();
        }
    }, [
        applySelection,
        eqtypeIcon,
        filteredMfg,
        findMfg,
        loadEqtypes,
        mfgIcon,
        prodlineIcon,
        resolveSingleChildDescentForMfg,
        setCommandNode,
        setStatusMessage,
        startLoading,
        stopLoading,
    ]);

    // Controls for current active form (derived from initialFormData so typing doesn't recreate them)
    const activeControls = useMemo(() => {
        if (formMode === 'mfg') {
            return buildMfgDetailsControls(
                initialFormData.isExisting ? 'edit-mfg' : 'add-mfg',
                initialFormData.isExisting ? {
                    mfgkey: initialFormData.acronym,
                    mfgname: initialFormData.mfgName,
                    address: serializeMfgAddress(initialFormData.address),
                    website: initialFormData.website,
                } : null,
                acronymOptions,
                nameOptions
            );
        }
        if (formMode === 'prodline') {
            return buildProdlinePaneControls(SelectedMfgAcronym || initialFormData.acronym, initialFormData.prodline, prodlineOptions);
        }
        if (formMode === 'mfgeqtype') {
            return buildEqtypePaneControls(SelectedMfgAcronym || initialFormData.acronym, SelectedMfgProdline || initialFormData.prodline, initialFormData.eqtype, eqtypeOptions);
        }
        if (formMode === 'mfgrelation') {
            return buildRelationPaneControls(SelectedMfgAcronym || initialFormData.acronym, initialFormData.relation, relationOptions);
        }
        return [];
    }, [
        SelectedMfgAcronym,
        SelectedMfgProdline,
        acronymOptions,
        eqtypeOptions,
        formMode,
        initialFormData,
        nameOptions,
        prodlineOptions,
        relationOptions,
    ]);

    // Profile JSON string for prefilling SettingsLibForm (stable during typing)
    const activeProfileString = useMemo(() => {
        if (formMode === 'mfg') {
            return JSON.stringify([{
                Acronym: initialFormData.acronym,
                MfgName: initialFormData.mfgName,
                Website: initialFormData.website,
                Address1: initialFormData.address.Address1 ?? '',
                Address2: initialFormData.address.Address2 ?? '',
                City: initialFormData.address.City ?? '',
                State: initialFormData.address.State ?? '',
                Country: initialFormData.address.Country ?? '',
                Zip: initialFormData.address.Zip ?? '',
                CountryCode: initialFormData.address.CountryCode ?? '',
                TimezoneOffset: '',
            }]);
        }
        if (formMode === 'prodline') {
            return JSON.stringify([{
                Acronym: SelectedMfgAcronym || initialFormData.acronym,
                Prodline: initialFormData.prodline,
            }]);
        }
        if (formMode === 'mfgeqtype') {
            return JSON.stringify([{
                Acronym: SelectedMfgAcronym || initialFormData.acronym,
                Prodline: SelectedMfgProdline || initialFormData.prodline,
                MfgEqType: initialFormData.eqtype,
            }]);
        }
        if (formMode === 'mfgrelation') {
            return JSON.stringify([{
                Acronym: SelectedMfgAcronym || initialFormData.acronym,
                MfgRelation: initialFormData.relation,
            }]);
        }
        return '';
    }, [
        SelectedMfgAcronym,
        SelectedMfgProdline,
        formMode,
        initialFormData,
    ]);

    // Form validity: true only when required fields are filled
    const isFormValid = isFieldsFilled;

    // Check whether current active form is in Edit mode (existing node)
    const isEditMode = useMemo(() => {
        if (formMode === 'mfg') {
            if (!initialFormData.isExisting) return false;
            return !isMfgUnique;
        }
        if (formMode === 'prodline') {
            if (!initialFormData.prodline) return false;
            return !isProdlineUnique;
        }
        if (formMode === 'mfgeqtype') {
            if (!initialFormData.eqtype) return false;
            return !isEqtypeUnique;
        }
        if (formMode === 'mfgrelation') return Boolean(initialFormData.relation);
        return false;
    }, [formMode, initialFormData.isExisting, initialFormData.prodline, initialFormData.eqtype, initialFormData.relation, isMfgUnique, isProdlineUnique, isEqtypeUnique]);

    // Save button visibility: in Edit mode, only ON when dirtyFlag is true; in Add mode, ON when required fields valid
    const isSaveButtonVisible = useMemo(() => {
        if (!isFormValid) return false;
        if (isEditMode) {
            return dirtyFlag;
        }
        return true;
    }, [isEditMode, dirtyFlag, isFormValid]);

    // Reset dirty flag on node selection / form session change
    useEffect(() => {
        setIsDirty(false);
    }, [formSessionId, setIsDirty]);

    // Synchronize Save icon display with dirty/valid state
    useEffect(() => {
        FnHideShowSaveIconForForm(isSaveButtonVisible ? 'show' : 'hide');
    }, [isSaveButtonVisible, formSessionId]);

    // Active form header
    const activeFormHeader = useMemo(() => {
        if (formMode === 'mfg') {
            if (initialFormData.isExisting && !isMfgUnique) {
                const mfgTitle = initialFormData.mfgName || initialFormData.acronym || SelectedMfgAcronym;
                return mfgTitle ? `Edit (${mfgTitle})` : 'Edit Manufacturer';
            }
            return 'Add Manufacturer';
        }
        if (formMode === 'prodline') {
            if (initialFormData.prodline && !isProdlineUnique) {
                const prodlineTitle = initialFormData.prodline || SelectedMfgProdline;
                return prodlineTitle ? `Edit (${prodlineTitle})` : 'Edit ProdLine';
            }
            return 'Add ProdLine';
        }
        if (formMode === 'mfgeqtype') {
            if (initialFormData.eqtype && !isEqtypeUnique) {
                const eqtypeTitle = initialFormData.eqtype || SelectedMfgEqtype;
                return eqtypeTitle ? `Edit (${eqtypeTitle})` : 'Edit MfgEqType';
            }
            return 'Add MfgEqType';
        }
        if (formMode === 'mfgrelation') {
            return initialFormData.relation ? `Edit (${initialFormData.relation})` : 'Edit MfgRelation';
        }
        return '';
    }, [SelectedMfgAcronym, SelectedMfgEqtype, SelectedMfgProdline, formMode, initialFormData.acronym, initialFormData.eqtype, initialFormData.isExisting, initialFormData.mfgName, initialFormData.prodline, initialFormData.relation, isEqtypeUnique, isMfgUnique, isProdlineUnique]);

    // Selected node label for top header (always shows the selected node's name)
    const selectedNodeName = useMemo(() => {
        const rootLabel = headerText.replace(/^\[[^\]]+\]\s*/, '').trim() || 'Manufacturer';
        if (selectedKey === ROOT_KEY || (!SelectedMfgAcronym && !initialFormData.acronym)) {
            return `${rootLabel} (${filteredMfg.length})`;
        }
        if (formMode === 'mfgeqtype') {
            return SelectedMfgEqtype || initialFormData.eqtype || 'Add MfgEqType';
        }
        if (formMode === 'prodline') {
            return SelectedMfgProdline || initialFormData.prodline || 'Add ProdLine';
        }
        if (formMode === 'mfgrelation') {
            return `${SelectedMfgAcronym} Relations`;
        }
        if (formMode === 'mfg') {
            if (initialFormData.isExisting || SelectedMfgAcronym) {
                const row = findMfg(initialFormData.acronym || SelectedMfgAcronym);
                return row?.mfgname || initialFormData.mfgName || SelectedMfgAcronym;
            }
            return 'Add Manufacturer';
        }
        return `${rootLabel} (${filteredMfg.length})`;
    }, [SelectedMfgAcronym, SelectedMfgEqtype, SelectedMfgProdline, filteredMfg.length, findMfg, formMode, headerText, initialFormData.acronym, initialFormData.eqtype, initialFormData.isExisting, initialFormData.mfgName, initialFormData.prodline, selectedKey]);

    const showTreeLoading = loading && manufacturers.length === 0;

    return (
        <div className="nz-mfg-feature" key={uniqueName}>
            <Splitter className="nz-w-100 nz-h-100 nz-mfg-splitter" tabIndex={-1}>
                <SplitterPanel
                    tabIndex={-1}
                    size={28}
                    minSize={15}
                    className="nz-d-flex-column nz-mfg-tree-pane"
                >
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
                            searchValueChange={(val) => {
                                setSearchText(val);
                                setSearchHistory([]);
                            }}
                            handleLensMouse={() => {
                                if (searchText.trim().length > 0) {
                                    handleKeywordSearch(searchText);
                                }
                            }}
                            filterDirty={false}
                            handleFilterMouse={() => undefined}
                        />
                    </div>
                    <div className={`nz-mfg-tree-body${showTreeLoading ? ' nz-mfg-tree-body-loading' : ''}`}>
                        {showTreeLoading && (
                            <Label uniqueName={`${uniqueName}-loading`} label="loading..." />
                        )}
                        {!loading && error && manufacturers.length === 0 && (
                            <div style={{ padding: 12 }}>
                                <Label uniqueName={`${uniqueName}-error`} label={error} />
                            </div>
                        )}
                        {!loading && !error && manufacturers.length === 0 && (
                            <div style={{ padding: 12 }}>
                                <Label uniqueName={`${uniqueName}-empty`} label="No manufacturers found" />
                            </div>
                        )}
                        {manufacturers.length > 0 && (
                            <TreeForHierarchicalDataContainer
                                uniqueName={`${uniqueName}-tree`}
                                featureId={featureId}
                                apiData={treeData}
                                allowGenerateTreeData={false}
                                allowAPICallOnExpand={true}
                                featureTreeProps={featureTreeProps}
                                defaultExpandedKeys={expandedKeys}
                                defaultSelectedKeys={defaultSelectedKeys}
                                defaultSelectedNodeInfo={defaultSelectedNodeInfo}
                                autoFocus={false}
                                handleNodeSelect={handleNodeSelect}
                                handleNodeExpand={handleNodeExpand}
                                handleKebabMenuSelect={handleKebabMenuSelect}
                            />
                        )}
                    </div>
                </SplitterPanel>
                <SplitterPanel
                    tabIndex={-1}
                    size={72}
                    minSize={25}
                    className="nz-d-flex-column nz-mfg-detail-pane"
                >
                    <div className="nz-sub-header nz-d-flex-row nz-align-center">
                        <Label
                            uniqueName={`${uniqueName}-selection`}
                            label={selectedNodeName}
                            fontWeight="bold"
                        />
                    </div>
                    <div className="nz-mfg-detail-body">
                        <div
                            className="nz-mfg-detail-form-container"
                            ref={formContainerRef}
                            onInput={handleFormInput}
                        >
                            <SettingsLibForm
                                key={`form-${formMode}-${formSessionId}`}
                                uniqueName={`${uniqueName}-active-form`}
                                featureId={featureId}
                                id={initialFormData.isExisting ? (initialFormData.acronym || SelectedMfgAcronym) : (formMode === 'mfg' ? '' : SelectedMfgAcronym)}
                                headerText={activeFormHeader}
                                controls={activeControls}
                                profileString={activeProfileString}
                                allowShowHeader={true}
                                allowShowSectionHeader={true}
                                isDisableForm={false}
                                isAddressFormRequired={formMode === 'mfg'}
                                isAutoSave={false}
                                isFormValueChangedExternal={isSaveButtonVisible}
                                handleSaveForm={handleSaveCurrentForm}
                                handleValueChange={handleFormValueChange}
                                handleValueChangeExternal={handleFormValuesChangeExternal}
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

export { Manufacturer };
export default Manufacturer;
