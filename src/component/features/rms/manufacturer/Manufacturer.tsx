import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Key } from 'rc-tree/lib/interface';
import { kebabMenuEnums, RmsEnums } from '../../../constants/Feature';
import { Label } from '../../../shared/basic/label/Label';
import type { IExpandedNodeInfo, ISelectedNodeInfo, ITreeNode } from '../../../shared/allinterface/tree/ITreeControl';
import type { IFeatureTree } from '../../../shared/allinterface/tree/ITreeForHierarchicalDataContainer';
import { useRmsContext } from '../../../shared/context/hooks/RmsHooks';
import { SettingsLibForm } from '../../../shared/settingsform/settingslibform/SettingsLibForm';
import { TreeForHierarchicalDataContainer } from '../../../shared/tree/treeforhierarchicaldatacontainer/TreeForHierarchicalDataContainer';
import { TreeNodeIcon } from '../../../shared/tree/treenodeicon/TreeNodeIcon';
import { YesNoFormContainer } from '../../../shared/basic/yesnoformcontainer/YesNoFormContainer';
import { FnHideShowSaveIconForForm } from '../../../shared/allcommon/basic/FnHideShowSaveIconForForm';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { SearchControl } from '../../../shared/searchfilter/searchcontrol/SearchControl';
import { FnSearchKeywordInLocalTree } from '../../../shared/allcommon/tree/FnSearchKeywordInLocalTree';
import { EQTypeVsSections } from '../../../shared/sidebar/rms/rmscollection/EQTypeVsSections';
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
    const {
        loading,
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
    const [commandNode, setCommandNode] = useState<ITreeNode | null>(null);

    // Form fields for Mfg form
    const [formAcronym, setFormAcronym] = useState<string>('');
    const [formMfgName, setFormMfgName] = useState<string>('');
    const [formWebsite, setFormWebsite] = useState<string>('');
    const [formAddressState, setFormAddressState] = useState<IMfgAddressData>(emptyAddress);
    const [isExistingMfg, setIsExistingMfg] = useState<boolean>(false);
    const [dirtyFlag, setDirtyFlag] = useState<boolean>(false);
    const dirtyFlagRef = useRef<boolean>(false);

    const setIsDirty = useCallback((dirty: boolean) => {
        dirtyFlagRef.current = dirty;
        setDirtyFlag(dirty);
    }, []);

    const isFormChanged = dirtyFlag;
    const setIsFormChanged = setIsDirty;

    // Form fields for Prodline, Eqtype, Relation
    const [formProdlineValue, setFormProdlineValue] = useState<string>('');
    const [formEqtypeValue, setFormEqtypeValue] = useState<string>('');
    const [formRelationValue, setFormRelationValue] = useState<string>('');

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
        return manufacturers
            .map((row) => ({ value: row.mfgkey, label: row.mfgkey }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [manufacturers]);

    const nameOptions = useMemo(() => {
        return manufacturers
            .map((row) => ({ value: row.mfgname, label: row.mfgname }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [manufacturers]);

    const prodlineOptions = useMemo(() => {
        const names = new Set<string>();
        Object.values(rmsContext.mfgVsProdline).forEach((list) => list.forEach((item) => names.add(item)));
        const currentUpper = (SelectedMfgAcronym || '').toUpperCase();
        (MfgVsProdlineData as Record<string, string[]>[]).forEach((entry) => {
            Object.entries(entry).forEach(([k, list]) => {
                if (k.toUpperCase() === currentUpper || currentUpper.startsWith(k.toUpperCase())) {
                    list.forEach((item) => names.add(item));
                }
            });
        });
        if (names.size < 30) {
            (MfgVsProdlineData as Record<string, string[]>[]).slice(0, 100).forEach((entry) => {
                Object.values(entry).forEach((list) => list.forEach((item) => names.add(item)));
            });
        }
        return [...names].sort((a, b) => a.localeCompare(b)).map((item) => ({ value: item, label: item }));
    }, [SelectedMfgAcronym, rmsContext.mfgVsProdline]);

    const eqtypeOptions = useMemo(() => {
        const names = new Set<string>();
        Object.keys(EQTypeVsSections).forEach((item) => names.add(item));
        Object.values(rmsContext.mfgVsMfgEqtype).forEach((list) => list.forEach((item) => names.add(item)));
        return [...names].sort((a, b) => a.localeCompare(b)).map((item) => ({ value: item, label: item }));
    }, [rmsContext.mfgVsMfgEqtype]);

    const relationOptions = useMemo(() => {
        return acronymOptions;
    }, [acronymOptions]);

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

                setFormAcronym(match.mfgkey);
                setFormMfgName(match.mfgname);
                setFormWebsite(match.website ?? '');
                setFormAddressState(addr);
                setIsExistingMfg(true);
            } else {
                formAcronymRef.current = acronym;
                formMfgNameRef.current = '';
                formWebsiteRef.current = '';
                formAddressRef.current = emptyAddress;

                setFormAcronym(acronym);
                setFormMfgName('');
                setFormWebsite('');
                setFormAddressState(emptyAddress);
                setIsExistingMfg(false);
            }

            if (acronym) {
                void loadProdlines(acronym);
                void loadEqtypes(acronym);
            }
            return;
        }

        if (nodeTypeLower === 'prodline') {
            setSelectedMfgAcronym(acronym);
            setSelectedMfgProdline(prodline);
            setSelectedMfgEqtype('');
            setFormMode('prodline');
            formProdlineRef.current = prodline;
            setFormProdlineValue(prodline);

            if (acronym) {
                setExpandedKeys((prev) => Array.from(new Set([...prev, ROOT_KEY, mfgNodeKey(acronym)])));
                void loadProdlines(acronym);
                void loadEqtypes(acronym);
            }
            return;
        }

        if (nodeTypeLower === 'mfgeqtype') {
            setSelectedMfgAcronym(acronym);
            setSelectedMfgProdline(prodline);
            setSelectedMfgEqtype(eqtype);
            setFormMode('mfgeqtype');
            formEqtypeRef.current = eqtype;
            setFormEqtypeValue(eqtype);

            if (acronym) {
                const keysToPreserve: Key[] = [ROOT_KEY, mfgNodeKey(acronym)];
                if (prodline) {
                    keysToPreserve.push(prodlineNodeKey(acronym, prodline));
                }
                setExpandedKeys((prev) => Array.from(new Set([...prev, ...keysToPreserve])));
                void loadProdlines(acronym);
                void loadEqtypes(acronym);
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
        setFormAcronym('');
        setFormMfgName('');
        setFormWebsite('');
        setFormAddressState(emptyAddress);
        setIsExistingMfg(false);
    }, [findMfg, loadEqtypes, loadProdlines]);


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
            setFormAcronym('');
            setFormMfgName('');
            setFormWebsite('');
            setFormAddressState(emptyAddress);
            setIsExistingMfg(false);
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
            };
            setCommandNode(parentNode);
            setExpandedKeys((prev) => Array.from(new Set([...prev, ROOT_KEY, parentKey])));

            if (mfgRecord) {
                const addr = parseMfgAddress(mfgRecord.address);
                formAcronymRef.current = mfgRecord.mfgkey;
                formMfgNameRef.current = mfgRecord.mfgname;
                formWebsiteRef.current = mfgRecord.website ?? '';
                formAddressRef.current = addr;
                setFormAcronym(mfgRecord.mfgkey);
                setFormMfgName(mfgRecord.mfgname);
                setFormWebsite(mfgRecord.website ?? '');
                setFormAddressState(addr);
                setIsExistingMfg(true);
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
            const parentProdline = String(targetProdline ?? commandNode?.prodline ?? SelectedMfgProdline).trim();
            const parentKey = prodlineNodeKey(cleanAcronym, parentProdline);

            setSelectedMfgAcronym(cleanAcronym);
            setSelectedMfgProdline(parentProdline);
            setSelectedMfgEqtype('');
            setFormMode('prodline');
            formProdlineRef.current = parentProdline;
            setFormProdlineValue(parentProdline);

            const parentNode: ITreeNode = {
                key: parentKey,
                NodeType: 'Prodline',
                mfgAcronym: cleanAcronym,
                prodline: parentProdline,
                title: parentProdline,
                Name: parentProdline,
            };
            setCommandNode(parentNode);
            setExpandedKeys((prev) => Array.from(new Set([...prev, ROOT_KEY, mfgNodeKey(cleanAcronym), parentKey])));
            setIsFormChanged(false);
            FnHideShowSaveIconForForm('hide');
            showMessageDialog('Deleted successfully.');
        } else if (res.error) {
            showMessageDialog(res.error);
        }
    }, [SelectedMfgProdline, commandNode?.prodline, deleteMfgEqtype, showMessageDialog]);

    const handleDeleteRelation = useCallback(async (targetAcronym: string, relationToDelete: string) => {
        const cleanAcronym = targetAcronym.trim();
        const cleanRelation = relationToDelete.trim();
        if (!cleanAcronym || !cleanRelation) return;
        const res = await deleteMfgRelation(cleanAcronym, cleanRelation);
        if (res.success) {
            formRelationRef.current = '';
            setFormRelationValue('');
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
        const activeNode = node ?? commandNode;
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
                setFormAcronym('');
                setFormMfgName('');
                setFormWebsite('');
                setFormAddressState(emptyAddress);
                setIsExistingMfg(false);
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
                setFormRelationValue(firstRel);
                setIsFormChanged(false);
            } else if (label === kebabMenuEnums.EditMfg || label === kebabMenuEnums.Edit) {
                setFormMode('mfg');
            }
        } else if (nodeTypeLower === 'prodline') {
            if (label === kebabMenuEnums.EditProdline || label === kebabMenuEnums.Edit) {
                setFormMode('prodline');
                formProdlineRef.current = prodline;
                setFormProdlineValue(prodline);
                setIsFormChanged(false);
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
                setFormEqtypeValue(eqtype);
                setIsFormChanged(false);
            } else if (label === kebabMenuEnums.Delete) {
                showConfirmDeleteDialog(
                    `Are you sure you want to delete equipment type "${eqtype}"?`,
                    () => { void handleDeleteEqtype(acronym, eqtype, prodline); }
                );
            }
        }
    }, [
        applySelection,
        commandNode,
        findMfg,
        handleDeleteEqtype,
        handleDeleteMfg,
        handleDeleteProdline,
        isManufacturerInUse,
        rmsContext.mfgRelation,
        setStatusMessage,
        showConfirmDeleteDialog,
        showMessageDialog,
    ]);

    // Synchronize DOM inputs and React state when typing into form fields
    const handleFormInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
        if (formMode !== 'mfg') return;
        const target = e.target as HTMLInputElement;
        if (!target || target.tagName !== 'INPUT') return;

        const identifier = (target.name || target.id || '').toLowerCase();

        if (identifier.includes('acronym')) {
            const typedAcronym = target.value;
            formAcronymRef.current = typedAcronym;
            setFormAcronym(typedAcronym);
            setIsFormChanged(true);

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
                setFormMfgName(match.mfgname);
                setFormWebsite(match.website ?? '');
                setFormAddressState(addr);
                setIsExistingMfg(true);
                setSelectedMfgAcronym(match.mfgkey);

                if (mfgInput && mfgInput.value !== match.mfgname) {
                    setDomInputValue(mfgInput, match.mfgname);
                }
                if (webInput && webInput.value !== (match.website ?? '')) {
                    setDomInputValue(webInput, match.website ?? '');
                }
            } else {
                formMfgNameRef.current = '';
                formWebsiteRef.current = '';
                formAddressRef.current = emptyAddress;
                setFormMfgName('');
                setFormWebsite('');
                setFormAddressState(emptyAddress);
                setIsExistingMfg(false);
                setSelectedMfgAcronym('');

                if (mfgInput && mfgInput.value !== '') {
                    setDomInputValue(mfgInput, '');
                }
                if (webInput && webInput.value !== '') {
                    setDomInputValue(webInput, '');
                }
            }
            const isFilled = Boolean(formAcronymRef.current.trim() && formMfgNameRef.current.trim());
            FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
        } else if (identifier.includes('mfgname')) {
            formMfgNameRef.current = target.value;
            setFormMfgName(target.value);
            setIsFormChanged(true);
            const isFilled = Boolean(formAcronymRef.current.trim() && target.value.trim());
            FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
        } else if (identifier.includes('website')) {
            formWebsiteRef.current = target.value;
            setFormWebsite(target.value);
            setIsFormChanged(true);
            const isFilled = Boolean(formAcronymRef.current.trim() && formMfgNameRef.current.trim());
            FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
        }
    }, [findMfg, formMode, setSelectedMfgAcronym]);

    // Handle typing / field changes in SettingsLibForm
    const handleFormValuesChangeExternal = useCallback((values: Record<string, unknown>) => {
        setIsFormChanged(true);

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

            setFormAddressState((prev) => {
                const nextAddr: IMfgAddressData = {
                    Address1: rawAddr1 !== undefined && rawAddr1 !== '' ? rawAddr1 : prev.Address1,
                    Address2: rawAddr2 !== undefined && rawAddr2 !== '' ? rawAddr2 : prev.Address2,
                    City: rawCity !== undefined && rawCity !== '' ? rawCity : prev.City,
                    State: rawState !== undefined && rawState !== '' ? rawState : prev.State,
                    Country: rawCountry !== undefined && rawCountry !== '' ? rawCountry : prev.Country,
                    Zip: rawZip !== undefined && rawZip !== '' ? rawZip : prev.Zip,
                    CountryCode: rawCountryCode !== undefined && rawCountryCode !== '' ? rawCountryCode : prev.CountryCode,
                };
                formAddressRef.current = nextAddr;
                return nextAddr;
            });

            // Did Acronym change?
            if (rawAcronym !== undefined && rawAcronym !== formAcronymRef.current) {
                formAcronymRef.current = rawAcronym;
                setFormAcronym(rawAcronym);

                const match = findMfg(rawAcronym);
                const container = formContainerRef.current;
                const mfgInput = container?.querySelector<HTMLInputElement>(
                    'input[id*="MfgName" i], input[name*="MfgName" i]'
                );
                const webInput = container?.querySelector<HTMLInputElement>(
                    'input[id*="Website" i], input[name*="Website" i]'
                );

                if (match) {
                    // Manufacturer found in table -> populate fields and allow edit
                    const addr = parseMfgAddress(match.address);
                    formMfgNameRef.current = match.mfgname;
                    formWebsiteRef.current = match.website ?? '';
                    formAddressRef.current = addr;
                    setFormMfgName(match.mfgname);
                    setFormWebsite(match.website ?? '');
                    setFormAddressState(addr);
                    setIsExistingMfg(true);
                    setSelectedMfgAcronym(match.mfgkey);

                    if (mfgInput && mfgInput.value !== match.mfgname) {
                        setDomInputValue(mfgInput, match.mfgname);
                    }
                    if (webInput && webInput.value !== (match.website ?? '')) {
                        setDomInputValue(webInput, match.website ?? '');
                    }
                } else {
                    // Manufacturer not found -> clear MfgName, Website, Address and switch to Add
                    formMfgNameRef.current = '';
                    formWebsiteRef.current = '';
                    formAddressRef.current = emptyAddress;
                    setFormMfgName('');
                    setFormWebsite('');
                    setFormAddressState(emptyAddress);
                    setIsExistingMfg(false);
                    setSelectedMfgAcronym('');

                    if (mfgInput && mfgInput.value !== '') {
                        setDomInputValue(mfgInput, '');
                    }
                    if (webInput && webInput.value !== '') {
                        setDomInputValue(webInput, '');
                    }
                }
            } else {
                if (rawName !== undefined && rawName !== formMfgNameRef.current) {
                    formMfgNameRef.current = rawName;
                    setFormMfgName(rawName);
                }
                if (rawWebsite !== undefined && rawWebsite !== formWebsiteRef.current) {
                    formWebsiteRef.current = rawWebsite;
                    setFormWebsite(rawWebsite);
                }
            }
            return;
        }

        if (formMode === 'prodline') {
            const val = extractFieldValue(values, 'Prodline') ?? extractFieldValue(values, 'Mfg_Prodline') ?? extractFieldValue(values, 'Value') ?? '';
            formProdlineRef.current = val;
            setFormProdlineValue(val);
            return;
        }

        if (formMode === 'mfgeqtype') {
            const val = extractFieldValue(values, 'MfgEqType') ?? extractFieldValue(values, 'Mfg_MfgEqType') ?? extractFieldValue(values, 'Value') ?? '';
            formEqtypeRef.current = val;
            setFormEqtypeValue(val);
            return;
        }

        if (formMode === 'mfgrelation') {
            const val = extractFieldValue(values, 'MfgRelation') ?? extractFieldValue(values, 'Mfg_MfgRelation') ?? extractFieldValue(values, 'Value') ?? '';
            formRelationRef.current = val;
            setFormRelationValue(val);
            return;
        }
    }, [findMfg, formMode, setSelectedMfgAcronym]);

    const handleFormValueChange = useCallback((value: unknown, name?: string) => {
        setIsFormChanged(true);
        const val = getFieldValue(value);
        if (formMode === 'mfg') {
            if (name?.toLowerCase() === 'acronym') {
                if (val !== formAcronymRef.current) {
                    formAcronymRef.current = val;
                    setFormAcronym(val);
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
                        setFormMfgName(match.mfgname);
                        setFormWebsite(match.website ?? '');
                        setFormAddressState(addr);
                        setIsExistingMfg(true);
                        setSelectedMfgAcronym(match.mfgkey);

                        if (mfgInput && mfgInput.value !== match.mfgname) {
                            setDomInputValue(mfgInput, match.mfgname);
                        }
                        if (webInput && webInput.value !== (match.website ?? '')) {
                            setDomInputValue(webInput, match.website ?? '');
                        }
                    } else {
                        formMfgNameRef.current = '';
                        formWebsiteRef.current = '';
                        formAddressRef.current = emptyAddress;
                        setFormMfgName('');
                        setFormWebsite('');
                        setFormAddressState(emptyAddress);
                        setIsExistingMfg(false);
                        setSelectedMfgAcronym('');

                        if (mfgInput && mfgInput.value !== '') {
                            setDomInputValue(mfgInput, '');
                        }
                        if (webInput && webInput.value !== '') {
                            setDomInputValue(webInput, '');
                        }
                    }
                }
            } else if (name?.toLowerCase() === 'mfgname') {
                formMfgNameRef.current = val;
                setFormMfgName(val);
                const isFilled = Boolean((formAcronymRef.current || formAcronym).trim() && val.trim());
                FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
            } else if (name?.toLowerCase() === 'website') {
                formWebsiteRef.current = val;
                setFormWebsite(val);
                const isFilled = Boolean((formAcronymRef.current || formAcronym).trim() && (formMfgNameRef.current || formMfgName).trim());
                FnHideShowSaveIconForForm(isFilled ? 'show' : 'hide');
            }
        } else if (formMode === 'prodline') {
            formProdlineRef.current = val;
            setFormProdlineValue(val);
            FnHideShowSaveIconForForm(Boolean(SelectedMfgAcronym?.trim() && val.trim()) ? 'show' : 'hide');
        } else if (formMode === 'mfgeqtype') {
            formEqtypeRef.current = val;
            setFormEqtypeValue(val);
            FnHideShowSaveIconForForm(Boolean(SelectedMfgAcronym?.trim() && SelectedMfgProdline?.trim() && val.trim()) ? 'show' : 'hide');
        } else if (formMode === 'mfgrelation') {
            formRelationRef.current = val;
            setFormRelationValue(val);
            FnHideShowSaveIconForForm(Boolean(SelectedMfgAcronym?.trim() && val.trim()) ? 'show' : 'hide');
        }
    }, [findMfg, formMode, setSelectedMfgAcronym]);

    // Save Handlers for each mode
    const handleSaveMfg = useCallback(async (mergedProfile?: Record<string, unknown>) => {
        try {
            const acronymFromProfile = extractFieldValue(mergedProfile ?? {}, 'Acronym');
            const mfgNameFromProfile = extractFieldValue(mergedProfile ?? {}, 'MfgName');
            const websiteFromProfile = extractFieldValue(mergedProfile ?? {}, 'Website');

            const acronym = getFieldValue(acronymFromProfile ?? formAcronymRef.current ?? formAcronym).trim();
            const mfgName = getFieldValue(mfgNameFromProfile ?? formMfgNameRef.current ?? formMfgName).trim();
            const website = getFieldValue(websiteFromProfile ?? formWebsiteRef.current ?? formWebsite).trim();

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

            if (isExistingMfg) {
                const originalRecord = findMfg(SelectedMfgAcronym) || findMfg(acronym);
                if (!originalRecord) {
                    showMessageDialog('Manufacturer record not found.');
                    return;
                }
                const res = await updateManufacturer({ acronym, mfgName, address, website }, originalRecord);
                if (res.success) {
                    setSelectedMfgAcronym(acronym);
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
                    setIsExistingMfg(true);
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
        formAcronym,
        formMfgName,
        formWebsite,
        isExistingMfg,
        manufacturers,
        setSelectedMfgAcronym,
        showMessageDialog,
        updateManufacturer,
    ]);

    const handleSaveProdline = useCallback(async (mergedProfile?: Record<string, unknown>) => {
        try {
            const val = getFieldValue(mergedProfile?.Prodline ?? formProdlineRef.current ?? formProdlineValue ?? SelectedMfgProdline).trim();
            if (!SelectedMfgAcronym) {
                showMessageDialog('Select a manufacturer.');
                return;
            }
            if (!val) {
                showMessageDialog('Enter a Prodline.');
                return;
            }

            const normKey = normalizeMfgKey(SelectedMfgAcronym);
            const currentList = rmsContext.mfgVsProdline[normKey] ?? [];
            const exists = currentList.some((p) => p.trim().toLowerCase() === val.toLowerCase());

            if (exists) {
                setSelectedMfgProdline(val);
                setIsFormChanged(false);
                FnHideShowSaveIconForForm('hide');
                showMessageDialog('Updated successfully.');
            } else {
                const res = await addProdline(SelectedMfgAcronym, val);
                if (res.success) {
                    setSelectedMfgProdline(val);
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
        formProdlineValue,
        rmsContext.mfgVsProdline,
        showMessageDialog,
    ]);

    const handleSaveEqtype = useCallback(async (mergedProfile?: Record<string, unknown>) => {
        try {
            const val = getFieldValue(mergedProfile?.MfgEqType ?? formEqtypeRef.current ?? formEqtypeValue ?? SelectedMfgEqtype).trim();
            if (!SelectedMfgAcronym) {
                showMessageDialog('Select a manufacturer.');
                return;
            }
            if (!val) {
                showMessageDialog('Enter a MfgEqType.');
                return;
            }

            const normKey = normalizeMfgKey(SelectedMfgAcronym);
            const currentList = rmsContext.mfgVsMfgEqtype[normKey] ?? [];
            const exists = currentList.some((e) => e.trim().toLowerCase() === val.toLowerCase());

            if (exists) {
                setSelectedMfgEqtype(val);
                setIsFormChanged(false);
                FnHideShowSaveIconForForm('hide');
                showMessageDialog('Updated successfully.');
            } else {
                const res = await addMfgEqtype(SelectedMfgAcronym, val);
                if (res.success) {
                    setSelectedMfgEqtype(val);
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
        formEqtypeValue,
        rmsContext.mfgVsMfgEqtype,
        showMessageDialog,
    ]);

    const handleSaveRelation = useCallback(async (mergedProfile?: Record<string, unknown>) => {
        try {
            const val = getFieldValue(mergedProfile?.MfgRelation ?? formRelationRef.current ?? formRelationValue).trim();
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
                setIsFormChanged(false);
                FnHideShowSaveIconForForm('hide');
                showMessageDialog('Updated successfully.');
            } else {
                const res = await addMfgRelation(SelectedMfgAcronym, val);
                if (res.success) {
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
    }, [SelectedMfgAcronym, addMfgRelation, formRelationValue, rmsContext.mfgRelation, showMessageDialog]);

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

    // Filter manufacturers by search text
    const filteredMfg = useMemo(() => {
        const query = searchText.trim().toLowerCase();
        const rows = [...manufacturers].sort((a, b) =>
            (a.mfgname || '').localeCompare(b.mfgname || '') || (a.mfgkey || '').localeCompare(b.mfgkey || '')
        );
        if (!query) return rows;
        return rows.filter((row) => {
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
    }, [manufacturers, rmsContext.mfgVsMfgEqtype, rmsContext.mfgVsProdline, searchText]);

    // Build hierarchical tree data using standard ITreeNode structure
    const treeData = useMemo<ITreeNode[]>(() => {
        const rootLabel = headerText.replace(/^\[[^\]]+\]\s*/, '').trim() || 'Manufacturer';

        const mfgNodes: ITreeNode[] = filteredMfg.map((row) => {
            const acronym = row.mfgkey;
            const key = normalizeMfgKey(acronym);
            const prodlinesLoaded = Object.prototype.hasOwnProperty.call(rmsContext.mfgVsProdline, key);
            const eqtypesLoaded = Object.prototype.hasOwnProperty.call(rmsContext.mfgVsMfgEqtype, key);
            const prodlines = rmsContext.mfgVsProdline[key] ?? [];
            const eqtypes = rmsContext.mfgVsMfgEqtype[key] ?? [];

            const prodlineNodes: ITreeNode[] = prodlines.map((prodline) => {
                const eqtypeNodes: ITreeNode[] = eqtypes.map((eqtype) => ({
                    key: eqtypeNodeKey(acronym, prodline, eqtype),
                    NodeEntityname: 'MfgEqtype',
                    NodeEntID: eqtype,
                    stepNo: 3,
                    parentEntID: prodlineNodeKey(acronym, prodline),
                    Description: eqtype,
                    title: eqtype,
                    children: [],
                    treetype: 'MfgEqtype',
                    Name: eqtype,
                    Type: 'MfgEqtype',
                    icon: featureTreeProps.allowIcon ? TreeNodeIcon({ NodeType: 'MfgEqtype' } as ITreeNode, featureTreeProps.instanceName ?? '') : null,
                    HasChildren: 0,
                    isLeaf: true,
                    NodeType: 'MfgEqtype',
                    mfgAcronym: acronym,
                    prodline,
                    eqtype,
                }));

                return {
                    key: prodlineNodeKey(acronym, prodline),
                    NodeEntityname: 'Prodline',
                    NodeEntID: prodline,
                    stepNo: 2,
                    parentEntID: mfgNodeKey(acronym),
                    Description: `${acronym} / ${prodline}`,
                    title: prodline,
                    children: eqtypeNodes,
                    treetype: 'Prodline',
                    Name: prodline,
                    Type: 'Prodline',
                    icon: featureTreeProps.allowIcon ? TreeNodeIcon({ NodeType: 'Prodline' } as ITreeNode, featureTreeProps.instanceName ?? '') : null,
                    HasChildren: eqtypesLoaded ? eqtypeNodes.length : 1,
                    isLeaf: eqtypesLoaded && eqtypeNodes.length === 0,
                    NodeType: 'Prodline',
                    mfgAcronym: acronym,
                    prodline,
                };
            });

            return {
                key: mfgNodeKey(acronym),
                NodeEntityname: 'Mfg',
                NodeEntID: acronym,
                stepNo: 1,
                parentEntID: ROOT_KEY,
                Description: acronym,
                title: row.mfgname,
                children: prodlineNodes,
                treetype: 'Mfg',
                Name: row.mfgname,
                TableLabel: row.mfgname,
                Type: 'Mfg',
                icon: featureTreeProps.allowIcon ? TreeNodeIcon({ NodeType: 'Mfg' } as ITreeNode, featureTreeProps.instanceName ?? '') : null,
                HasChildren: prodlinesLoaded ? prodlineNodes.length : 1,
                isLeaf: prodlinesLoaded && prodlineNodes.length === 0,
                NodeType: 'Mfg',
                mfgAcronym: acronym,
                mfgName: row.mfgname,
            };
        });

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
    }, [filteredMfg, headerText, rmsContext.mfgVsMfgEqtype, rmsContext.mfgVsProdline]);

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
            filteredMfg.forEach((row) => {
                const mKey = mfgNodeKey(row.mfgkey);
                keysToExpand.push(mKey);
                const normKey = normalizeMfgKey(row.mfgkey);
                const prodlines = rmsContext.mfgVsProdline[normKey] ?? [];
                prodlines.forEach((p) => {
                    const eqtypes = rmsContext.mfgVsMfgEqtype[normKey] ?? [];
                    if (
                        String(p).toLowerCase().includes(query) ||
                        eqtypes.some((e) => String(e).toLowerCase().includes(query))
                    ) {
                        keysToExpand.push(prodlineNodeKey(row.mfgkey, p));
                    }
                });
            });
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
            const parentKeys = result.parentNodes?.map((n) => n.key) ?? [ROOT_KEY];
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
                const parentKeys = wrapResult.parentNodes?.map((n) => n.key) ?? [ROOT_KEY];
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

    // Handle node expansion in the tree
    const handleNodeExpand = useCallback((expandedNodeKeys: Key[], info: IExpandedNodeInfo) => {
        setExpandedKeys(expandedNodeKeys);
        if (info.expanded) {
            applySelection(info.node);
        }
    }, [applySelection]);

    // Controls for current active form
    const activeControls = useMemo(() => {
        if (formMode === 'mfg') {
            return buildMfgDetailsControls(
                isExistingMfg ? 'edit-mfg' : 'add-mfg',
                isExistingMfg ? {
                    mfgkey: formAcronym,
                    mfgname: formMfgName,
                    address: serializeMfgAddress(formAddressState),
                    website: formWebsite,
                } : null,
                acronymOptions,
                nameOptions
            );
        }
        if (formMode === 'prodline') {
            return buildProdlinePaneControls(SelectedMfgAcronym, SelectedMfgProdline, prodlineOptions);
        }
        if (formMode === 'mfgeqtype') {
            return buildEqtypePaneControls(SelectedMfgAcronym, SelectedMfgProdline, SelectedMfgEqtype, eqtypeOptions);
        }
        if (formMode === 'mfgrelation') {
            return buildRelationPaneControls(SelectedMfgAcronym, formRelationValue, relationOptions);
        }
        return [];
    }, [
        SelectedMfgAcronym,
        SelectedMfgEqtype,
        SelectedMfgProdline,
        acronymOptions,
        eqtypeOptions,
        formAcronym,
        formAddressState,
        formMfgName,
        formMode,
        formRelationValue,
        formWebsite,
        isExistingMfg,
        nameOptions,
        prodlineOptions,
        relationOptions,
    ]);

    // Profile JSON string for prefilling SettingsLibForm
    const activeProfileString = useMemo(() => {
        if (formMode === 'mfg') {
            return JSON.stringify([{
                Acronym: formAcronym,
                MfgName: formMfgName,
                Website: formWebsite,
                Address1: formAddressState.Address1 ?? '',
                Address2: formAddressState.Address2 ?? '',
                City: formAddressState.City ?? '',
                State: formAddressState.State ?? '',
                Country: formAddressState.Country ?? '',
                Zip: formAddressState.Zip ?? '',
                CountryCode: formAddressState.CountryCode ?? '',
                TimezoneOffset: '',
            }]);
        }
        if (formMode === 'prodline') {
            return JSON.stringify([{
                Acronym: SelectedMfgAcronym,
                Prodline: SelectedMfgProdline,
            }]);
        }
        if (formMode === 'mfgeqtype') {
            return JSON.stringify([{
                Acronym: SelectedMfgAcronym,
                Prodline: SelectedMfgProdline,
                MfgEqType: SelectedMfgEqtype,
            }]);
        }
        if (formMode === 'mfgrelation') {
            return JSON.stringify([{
                Acronym: SelectedMfgAcronym,
                MfgRelation: formRelationValue,
            }]);
        }
        return '';
    }, [
        SelectedMfgAcronym,
        SelectedMfgEqtype,
        SelectedMfgProdline,
        formAcronym,
        formAddressState,
        formMfgName,
        formMode,
        formRelationValue,
        formWebsite,
    ]);

    // Form validity: true only when all required values are filled
    const isFormValid = useMemo(() => {
        if (formMode === 'mfg') {
            const acr = (formAcronymRef.current ?? formAcronym ?? '').trim();
            const name = (formMfgNameRef.current ?? formMfgName ?? '').trim();
            return Boolean(acr && name);
        }
        if (formMode === 'prodline') {
            const prod = (formProdlineRef.current ?? formProdlineValue ?? SelectedMfgProdline ?? '').trim();
            return Boolean(SelectedMfgAcronym?.trim() && prod);
        }
        if (formMode === 'mfgeqtype') {
            const eq = (formEqtypeRef.current ?? formEqtypeValue ?? SelectedMfgEqtype ?? '').trim();
            return Boolean(SelectedMfgAcronym?.trim() && SelectedMfgProdline?.trim() && eq);
        }
        if (formMode === 'mfgrelation') {
            const rel = (formRelationRef.current ?? formRelationValue ?? '').trim();
            return Boolean(SelectedMfgAcronym?.trim() && rel);
        }
        return false;
    }, [
        SelectedMfgAcronym,
        SelectedMfgEqtype,
        SelectedMfgProdline,
        formAcronym,
        formEqtypeValue,
        formMfgName,
        formMode,
        formProdlineValue,
        formRelationValue,
    ]);

    // Check whether current active form is in Edit mode (existing node)
    const isEditMode = useMemo(() => {
        if (formMode === 'mfg') return isExistingMfg;
        if (formMode === 'prodline') return Boolean(SelectedMfgProdline);
        if (formMode === 'mfgeqtype') return Boolean(SelectedMfgEqtype);
        if (formMode === 'mfgrelation') return Boolean(formRelationValue);
        return false;
    }, [formMode, isExistingMfg, SelectedMfgProdline, SelectedMfgEqtype, formRelationValue]);

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
            if (isExistingMfg) {
                return `Edit (${formMfgName || formAcronym || SelectedMfgAcronym})`;
            }
            return 'Add Mfg';
        }
        if (formMode === 'prodline') {
            return SelectedMfgProdline ? `Edit (${SelectedMfgProdline})` : 'Add Prodline';
        }
        if (formMode === 'mfgeqtype') {
            return SelectedMfgEqtype ? `Edit (${SelectedMfgEqtype})` : 'Add MfgEqType';
        }
        if (formMode === 'mfgrelation') {
            return formRelationValue ? `Edit (${formRelationValue})` : 'Edit MfgRelation';
        }
        return '';
    }, [SelectedMfgAcronym, SelectedMfgEqtype, SelectedMfgProdline, formAcronym, formMfgName, formMode, formRelationValue, isExistingMfg]);

    // Selected node label for top header
    const selectedNodeName = useMemo(() => {
        const rootLabel = headerText.replace(/^\[[^\]]+\]\s*/, '').trim() || 'Manufacturer';
        if (selectedKey === ROOT_KEY || (!SelectedMfgAcronym && !formAcronym)) {
            return `${rootLabel} (${filteredMfg.length})`;
        }
        if (formMode === 'mfgeqtype' && SelectedMfgEqtype) return SelectedMfgEqtype;
        if (formMode === 'prodline' && SelectedMfgProdline) return SelectedMfgProdline;
        if (formMode === 'mfgrelation') return `${SelectedMfgAcronym} Relations`;
        if (formMode === 'mfg') {
            if (isExistingMfg) {
                const row = findMfg(formAcronym || SelectedMfgAcronym);
                return row?.mfgname || formMfgName || SelectedMfgAcronym;
            }
            return 'Add Manufacturer';
        }
        return `${rootLabel} (${filteredMfg.length})`;
    }, [SelectedMfgAcronym, SelectedMfgEqtype, SelectedMfgProdline, filteredMfg.length, findMfg, formAcronym, formMfgName, formMode, headerText, isExistingMfg, selectedKey]);

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
                                defaultSelectedKeys={[selectedKey]}
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
                                id={SelectedMfgAcronym || formAcronym || 'mfg-form'}
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
