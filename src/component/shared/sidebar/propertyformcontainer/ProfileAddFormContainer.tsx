import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActivities, useBusinesses, useContacts } from '@n20a/libfsdb';
import { SettingsLibForm, IControl } from '../../settingsform/settingslibform/SettingsLibForm';
import { DisplayControlEnums } from '../../alldefaultprops/basic/DefaultPropsFormContainer';
import { useSmDataContext } from '../../context/hooks/SmDataHooks';
import { useStatusBarContext } from '../../context/hooks/StatusBarHooks';
import { useCommonVariableContext } from '../../context/hooks/CommonVariableHooks';
import { useMainAppContext } from '../../context/hooks/MainAppHooks';
import { FnLogActivity } from '../../allcommon/basic/FnLogActivity';
import type { IBusinessDoc, IContactDoc } from '../../allinterface/IDatasets';
import type { ITreeNode } from '../../allinterface/tree/ITreeControl';
import { FnHideShowSaveIconForForm } from '../../allcommon/basic/FnHideShowSaveIconForForm';
import './ProfileAddFormContainer.css';

interface IProfileAddFormContainerProps {
    uniqueName?: string;
    initialMode?: 'business' | 'contact';
    actionType?: 'add' | 'update';
    selectedNode?: ITreeNode;
    treeData?: ITreeNode[] | null;
    featureId: string;
    subTreeFeatureId?: string;
    handleReloadTree?: (featureId: string, entID?: string) => void;
    onClose?: () => void;
}

function extractValuesFromForm(values: Record<string, unknown>, controls: IControl[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (!values) return result;
    for (const col of controls) {
        if (values[col.Name] !== undefined) {
            result[col.Name] = values[col.Name];
            continue;
        }
        const prefix = `${col.DisplayGroupControl ?? 'Default'}_${col.Name}_`;
        const matchingKey = Object.keys(values).find((k) => k.startsWith(prefix));
        if (matchingKey !== undefined && values[matchingKey] !== undefined) {
            result[col.Name] = values[matchingKey];
        }
    }
    return result;
}

const ALLOWED_CONTACT_FIELDS = new Set([
    'bid',
    'cid',
    'monitorupdated',
    'monitor',
    'contacttype',
    'role',
    'status',
    'ctag',
    'cname',
    'email',
    'phone',
    'address1',
    'address2',
    'city',
    'state',
    'country',
    'zip',
    'countrycode',
    'timezoneoffset',
    'donotcallme',
    'removemefrommailinglist',
    'smsoptin',
    'datecreated',
    'dateupdated'
]);

const ALLOWED_BUSINESS_FIELDS = new Set([
    'bid',
    'btype',
    'status',
    'tag',
    'verified',
    'salesexec',
    'bname',
    'country',
    'state',
    'daysnoticeperiod',
    'mmfinyear',
    'relatedbids',
    'datecreated',
    'dateupdated',
    'name',
    'updatedby',
    'createdby',
    'contactsupdated',
    'notesupdated',
    'ticketsupdated',
    'ticketnotesupdated',
    'activitiesupdated',
    'ordersupdated',
    'subsupdated',
    'downloadupdated',
    'amcexpirydate',
    'mcsexpirydate',
    'saasexpirydate',
    'onpremexpirydate',
    'estimatedusers',
    'estimatedracks',
    'estimateddcsites'
]);

function filterAllowedFields(raw: Record<string, unknown>, allowedSet: Set<string>): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
        if (allowedSet.has(key.toLowerCase()) && val !== undefined) {
            filtered[key.toLowerCase()] = val;
        }
    }
    return filtered;
}

function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
}

function formatDateValue(val: unknown, fallback?: string): string {
    if (!val) return fallback ?? '';
    const str = String(val).trim();
    if (!str) return fallback ?? '';
    if (str.length >= 10 && str.charAt(4) === '-' && str.charAt(7) === '-') {
        return str.slice(0, 10);
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
    }
    return str;
}

function toIsoString(val: unknown, fallback?: string): string {
    if (!val) return fallback ?? '';
    const str = String(val).trim();
    if (!str) return fallback ?? '';
    try {
        const d = new Date(str);
        return !isNaN(d.getTime()) ? d.toISOString() : str;
    } catch {
        return str;
    }
}

function toBoolean(val: unknown, defaultValue: boolean = false): boolean {
    if (val === undefined || val === null || val === '') return defaultValue;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    const s = String(val).trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
    return defaultValue;
}

function generateAutoBid(existingBusinesses: Array<{ bid?: string }>): string {
    let maxNum = 100;
    for (const b of existingBusinesses) {
        const match = b?.bid?.match(/^bid_(\d+)$/i);
        if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
                maxNum = num;
            }
        }
    }
    let candidate = `bid_${maxNum + 1}`;
    while (existingBusinesses.some((b) => (b.bid || '').toLowerCase() === candidate.toLowerCase())) {
        maxNum++;
        candidate = `bid_${maxNum + 1}`;
    }
    return candidate;
}

function generateAutoCid(parentBid: string, existingContacts: Array<{ cid?: string; bid?: string }>): string {
    const cleanBid = (parentBid || 'bid_100').trim();
    let maxIndex = 0;
    const prefix = `cid_${cleanBid}_`.toLowerCase();
    for (const c of existingContacts) {
        const cidStr = (c?.cid || '').trim();
        if (cidStr.toLowerCase().startsWith(prefix)) {
            const suffix = cidStr.slice(prefix.length);
            const num = parseInt(suffix, 10);
            if (!isNaN(num) && num > maxIndex) {
                maxIndex = num;
            }
        }
    }
    let nextIndex = maxIndex + 1;
    let candidate = `cid_${cleanBid}_${nextIndex}`;
    while (existingContacts.some((c) => (c.cid || '').toLowerCase() === candidate.toLowerCase())) {
        nextIndex++;
        candidate = `cid_${cleanBid}_${nextIndex}`;
    }
    return candidate;
}

function makeControl(partial: {
    name: string;
    label: string;
    group: string;
    sortOrder: number;
    displayControl: string;
    value?: string | boolean | number;
    isRequired?: number;
    disabled?: boolean;
    options?: Array<{ label: string; value: string }>;
}): IControl {
    return {
        CanChange: partial.disabled ? 0 : 1,
        IsRequired: partial.isRequired ?? 0,
        GroupName: 'APForm_ProfileAdd',
        GroupNameDesc: '',
        SubGroupEntID: '',
        SubGroupName: 'FormControl',
        SubGroupNameDesc: '',
        _AP: partial.name,
        PropertyLabel: partial.label,
        NameDesc: partial.label,
        DefaultAPValue: partial.value !== undefined ? String(partial.value) : '',
        Value: partial.value !== undefined ? String(partial.value) : '',
        ValueDesc: '',
        SortOrder: partial.sortOrder,
        MaxInstances: 0,
        InputMask: '',
        RegEx: '',
        DisplayGroupControl: partial.group,
        DisplayControl: partial.displayControl,
        ChangeEvent: '',
        Secured: false,
        IsNZ: false,
        EntID: partial.name,
        RecID: partial.name,
        LastUpdated: '',
        EntityName: 'AP',
        Name: partial.name,
        disabled: partial.disabled ?? false,
        IsReadOnly: partial.disabled ?? false,
        Options: partial.options,
    };
}

const ProfileAddFormContainer = (props: IProfileAddFormContainerProps) => {
    const smDataContext = useSmDataContext();
    const statusBarContext = useStatusBarContext();
    const commonVariableContext = useCommonVariableContext();
    const mainAppContext = useMainAppContext();

    const isUpdate = props.actionType === 'update';

    // Determine initial mode
    const [mode, setMode] = useState<'business' | 'contact'>(() => {
        if (props.initialMode) return props.initialMode;
        if (props.selectedNode) {
            const t = String(props.selectedNode.NodeEntityname || props.selectedNode.NodeType || props.selectedNode.treetype || '').toLowerCase();
            if (t === 'contact' || (Boolean(props.selectedNode.cid) && props.selectedNode.cid !== props.selectedNode.bid)) {
                return 'contact';
            }
        }
        return 'business';
    });

    useEffect(() => {
        if (props.initialMode) {
            setMode(props.initialMode);
        }
    }, [props.initialMode]);

    // Available businesses list for contact dropdown
    const availableBusinesses = useMemo(() => {
        const list = smDataContext.datasets?.businesses ?? [];
        return list.map((b) => ({
            label: `${b.bname || b.name || b.bid} (${b.bid})`,
            value: b.bid,
        }));
    }, [smDataContext.datasets?.businesses]);

    // Preselected parent bid
    const defaultParentBid = useMemo(() => {
        if (props.selectedNode?.bid) {
            return String(props.selectedNode.bid);
        }
        if (availableBusinesses.length > 0) {
            return availableBusinesses[0].value;
        }
        return 'bid_100';
    }, [props.selectedNode?.bid, availableBusinesses]);

    // Find existing business when updating
    const selectedBusiness = useMemo((): IBusinessDoc | undefined => {
        if (!isUpdate || !props.selectedNode) return undefined;
        const bid = String(
            props.selectedNode.bid ||
            props.selectedNode.NodeEntID ||
            props.selectedNode.EntID ||
            props.selectedNode.key ||
            ''
        );
        const list = smDataContext.datasets?.businesses ?? [];
        return list.find(
            (b) =>
                b.bid?.toLowerCase() === bid.toLowerCase() ||
                (b.bname || b.name || '').toLowerCase() === (props.selectedNode?.Name || props.selectedNode?.bname || '').toLowerCase()
        );
    }, [isUpdate, props.selectedNode, smDataContext.datasets?.businesses]);

    // Find existing contact when updating
    const selectedContact = useMemo((): IContactDoc | undefined => {
        if (!isUpdate || !props.selectedNode) return undefined;
        const cid = String(
            props.selectedNode.cid ||
            props.selectedNode.NodeEntID ||
            props.selectedNode.EntID ||
            props.selectedNode.key ||
            ''
        );
        const list = smDataContext.datasets?.contacts ?? [];
        return list.find(
            (c: any) =>
                c.cid?.toLowerCase() === cid.toLowerCase() ||
                (c.cname || c.contact || '').toLowerCase() === (props.selectedNode?.Name || props.selectedNode?.contact || '').toLowerCase()
        ) as IContactDoc | undefined;
    }, [isUpdate, props.selectedNode, smDataContext.datasets?.contacts]);

    // Form changed state to control Save button visibility (starts false, set true on user edit)
    const [isFormChanged, setIsFormChanged] = useState<boolean>(false);

    useEffect(() => {
        setIsFormChanged(false);
        FnHideShowSaveIconForForm('hide');
    }, [mode, isUpdate, props.selectedNode]);

    // Selected parent business for contact
    const [selectedParentBid, setSelectedParentBid] = useState<string>(() => {
        if (isUpdate && selectedContact?.bid) return selectedContact.bid;
        return defaultParentBid;
    });

    // Entity IDs
    const [businessId, setBusinessId] = useState<string>(() => {
        if (isUpdate && selectedBusiness?.bid) return selectedBusiness.bid;
        if (!isUpdate) return generateAutoBid(smDataContext.datasets?.businesses ?? []);
        return '';
    });

    const [contactId, setContactId] = useState<string>(() => {
        if (isUpdate && selectedContact?.cid) return selectedContact.cid;
        if (!isUpdate) return generateAutoCid(defaultParentBid, smDataContext.datasets?.contacts ?? []);
        return '';
    });

    // Draft values store
    const businessValuesRef = useRef<Record<string, unknown>>({
        bid: isUpdate ? businessId : (businessId || generateAutoBid(smDataContext.datasets?.businesses ?? [])),
        bname: '',
        btype: 'consultant',
        status: 'Active',
        verified: false,
        salesexec: '',
        country: 'United States',
        state: 'CA',
        daysnoticeperiod: 30,
        mmfinyear: 12,
        relatedbids: '',
        datecreated: todayIsoDate(),
        dateupdated: todayIsoDate(),
        amcexpirydate: '',
        mcsexpirydate: '',
        saasexpirydate: '',
        onpremexpirydate: '',
    });

    const contactValuesRef = useRef<Record<string, unknown>>({
        cid: isUpdate ? contactId : (contactId || generateAutoCid(selectedParentBid || defaultParentBid, smDataContext.datasets?.contacts ?? [])),
        bid: defaultParentBid,
        cname: '',
        contacttype: 'contact',
        status: 'Active',
        monitor: false,
        email: '',
        phone: '',
        address1: '',
        city: '',
        state: '',
        zip: '',
        country: '',
        datecreated: todayIsoDate(),
        dateupdated: todayIsoDate(),
        monitorupdated: todayIsoDate(),
    });

    // Populate existing business data in update mode, or auto-generate bid in add mode
    useEffect(() => {
        if (isUpdate && selectedBusiness) {
            const bid = selectedBusiness.bid || businessId;
            setBusinessId(bid);
            businessValuesRef.current = {
                bid,
                bname: selectedBusiness.bname || selectedBusiness.name || '',
                btype: selectedBusiness.btype || 'consultant',
                status: selectedBusiness.status || 'Active',
                verified: toBoolean(selectedBusiness.verified, false),
                salesexec: selectedBusiness.salesexec || '',
                country: selectedBusiness.country || 'United States',
                state: selectedBusiness.state || 'CA',
                daysnoticeperiod: selectedBusiness.daysnoticeperiod ?? 30,
                mmfinyear: selectedBusiness.mmfinyear ?? 12,
                relatedbids: Array.isArray(selectedBusiness.relatedbids)
                    ? selectedBusiness.relatedbids.join(', ')
                    : String(selectedBusiness.relatedbids ?? ''),
                datecreated: formatDateValue(selectedBusiness.datecreated, todayIsoDate()),
                dateupdated: formatDateValue(selectedBusiness.dateupdated, todayIsoDate()),
                amcexpirydate: formatDateValue(selectedBusiness.amcexpirydate, ''),
                mcsexpirydate: formatDateValue(selectedBusiness.mcsexpirydate, ''),
                saasexpirydate: formatDateValue(selectedBusiness.saasexpirydate, ''),
                onpremexpirydate: formatDateValue(selectedBusiness.onpremexpirydate, ''),
            };
        } else if (!isUpdate) {
            const autoBid = generateAutoBid(smDataContext.datasets?.businesses ?? []);
            setBusinessId(autoBid);
            businessValuesRef.current.bid = autoBid;
        }
    }, [isUpdate, selectedBusiness, smDataContext.datasets?.businesses]);

    // Populate existing contact data in update mode
    useEffect(() => {
        if (isUpdate && selectedContact) {
            const cid = selectedContact.cid || contactId;
            const bid = selectedContact.bid || selectedParentBid;
            setContactId(cid);
            if (selectedContact.bid) {
                setSelectedParentBid(selectedContact.bid);
            }
            contactValuesRef.current = {
                cid,
                bid,
                cname: selectedContact.cname || (selectedContact as any).contact || '',
                contacttype: selectedContact.contacttype || (selectedContact as any).ctype || 'contact',
                status: selectedContact.status || 'Active',
                monitor: toBoolean(selectedContact.monitor ?? (selectedContact as any).verified, false),
                email: selectedContact.email || '',
                phone: selectedContact.phone || (selectedContact as any).phone1 || '',
                address1: selectedContact.address1 || (selectedContact as any).address_street || '',
                city: selectedContact.city || (selectedContact as any).address_city || '',
                state: selectedContact.state || (selectedContact as any).address_state || '',
                zip: selectedContact.zip || (selectedContact as any).address_zip || '',
                country: selectedContact.country || (selectedContact as any).address_country || '',
                datecreated: formatDateValue(selectedContact.datecreated, todayIsoDate()),
                dateupdated: formatDateValue(selectedContact.dateupdated, todayIsoDate()),
                monitorupdated: formatDateValue(selectedContact.monitorupdated, todayIsoDate()),
            };
        }
    }, [isUpdate, selectedContact]);

    useEffect(() => {
        if (!isUpdate && defaultParentBid) {
            setSelectedParentBid(defaultParentBid);
            contactValuesRef.current.bid = defaultParentBid;
        }
    }, [isUpdate, defaultParentBid]);

    // In Add mode, dynamically update auto CID when selectedParentBid or contacts change
    useEffect(() => {
        if (!isUpdate && selectedParentBid) {
            const autoCid = generateAutoCid(selectedParentBid, smDataContext.datasets?.contacts ?? []);
            setContactId(autoCid);
            contactValuesRef.current.cid = autoCid;
            contactValuesRef.current.bid = selectedParentBid;
        }
    }, [isUpdate, selectedParentBid, smDataContext.datasets?.contacts]);

    // Hooks from libfsdb
    const { createBusiness, updateBusiness } = useBusinesses();
    const { createContact, updateContact } = useContacts(selectedParentBid || 'bid_100');
    const { createActivity } = useActivities(
        mode === 'contact'
            ? (selectedParentBid || defaultParentBid || 'bid_100')
            : (businessId || defaultParentBid || 'bid_100')
    );

    // Business Controls for SettingsLibForm
    const businessControls: IControl[] = useMemo(() => {
        const group = 'Business Details';
        return [
            makeControl({
                name: 'bid',
                label: 'Business ID',
                group,
                sortOrder: 1,
                displayControl: DisplayControlEnums.EditTextControl,
                value: isUpdate ? businessId : String(businessValuesRef.current.bid || businessId || ''),
                isRequired: 1,
                disabled: true,
            }),
            makeControl({
                name: 'bname',
                label: 'Company Name',
                group,
                sortOrder: 2,
                displayControl: DisplayControlEnums.EditTextControl,
                isRequired: 1,
                value: String(businessValuesRef.current.bname ?? ''),
            }),
            makeControl({
                name: 'btype',
                label: 'Business Type',
                group,
                sortOrder: 3,
                displayControl: DisplayControlEnums.ComboBoxControl,
                options: [
                    { label: 'Consultant', value: 'consultant' },
                    { label: 'End User', value: 'enduser' },
                    { label: 'Partner', value: 'partner' },
                    { label: 'Vendor', value: 'vendor' },
                ],
                value: String(businessValuesRef.current.btype ?? 'consultant'),
            }),
            makeControl({
                name: 'status',
                label: 'Status',
                group,
                sortOrder: 4,
                displayControl: DisplayControlEnums.ComboBoxControl,
                options: [
                    { label: 'Active', value: 'Active' },
                    { label: 'Inactive', value: 'Inactive' },
                ],
                value: String(businessValuesRef.current.status ?? 'Active'),
            }),
            makeControl({
                name: 'verified',
                label: 'Verified',
                group,
                sortOrder: 5,
                displayControl: DisplayControlEnums.TrueFalseControl,
                value: toBoolean(businessValuesRef.current.verified, false) ? 'true' : 'false',
            }),
            makeControl({
                name: 'salesexec',
                label: 'Sales Executive',
                group,
                sortOrder: 6,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(businessValuesRef.current.salesexec ?? ''),
            }),
            makeControl({
                name: 'country',
                label: 'Country',
                group,
                sortOrder: 7,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(businessValuesRef.current.country ?? 'United States'),
            }),
            makeControl({
                name: 'state',
                label: 'State',
                group,
                sortOrder: 8,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(businessValuesRef.current.state ?? 'CA'),
            }),
            makeControl({
                name: 'daysnoticeperiod',
                label: 'Notice Period (Days)',
                group,
                sortOrder: 9,
                displayControl: DisplayControlEnums.SpinControl,
                value: String(businessValuesRef.current.daysnoticeperiod ?? '30'),
            }),
            makeControl({
                name: 'mmfinyear',
                label: 'Financial Year Month',
                group,
                sortOrder: 10,
                displayControl: DisplayControlEnums.SpinControl,
                value: String(businessValuesRef.current.mmfinyear ?? '12'),
            }),
            makeControl({
                name: 'relatedbids',
                label: 'Related BIDs',
                group,
                sortOrder: 11,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(businessValuesRef.current.relatedbids ?? ''),
            }),
            makeControl({
                name: 'datecreated',
                label: 'Date Created',
                group,
                sortOrder: 12,
                displayControl: DisplayControlEnums.DateControl,
                value: String(businessValuesRef.current.datecreated ?? todayIsoDate()),
                disabled: true,
            }),
            makeControl({
                name: 'dateupdated',
                label: 'Date Updated',
                group,
                sortOrder: 13,
                displayControl: DisplayControlEnums.DateControl,
                value: String(businessValuesRef.current.dateupdated ?? todayIsoDate()),
                disabled: true,
            }),
            makeControl({
                name: 'amcexpirydate',
                label: 'AMC Expiry Date',
                group,
                sortOrder: 14,
                displayControl: DisplayControlEnums.DateControl,
                value: String(businessValuesRef.current.amcexpirydate ?? ''),
            }),
            makeControl({
                name: 'mcsexpirydate',
                label: 'MCS Expiry Date',
                group,
                sortOrder: 15,
                displayControl: DisplayControlEnums.DateControl,
                value: String(businessValuesRef.current.mcsexpirydate ?? ''),
            }),
            makeControl({
                name: 'saasexpirydate',
                label: 'SaaS Expiry Date',
                group,
                sortOrder: 16,
                displayControl: DisplayControlEnums.DateControl,
                value: String(businessValuesRef.current.saasexpirydate ?? ''),
            }),
            makeControl({
                name: 'onpremexpirydate',
                label: 'On-Prem Expiry Date',
                group,
                sortOrder: 17,
                displayControl: DisplayControlEnums.DateControl,
                value: String(businessValuesRef.current.onpremexpirydate ?? ''),
            }),
        ];
    }, [isUpdate, businessId]);

    // Contact Controls for SettingsLibForm
    const contactControls: IControl[] = useMemo(() => {
        const group = 'Contact Details';
        return [
            makeControl({
                name: 'cid',
                label: 'Contact ID',
                group,
                sortOrder: 1,
                displayControl: DisplayControlEnums.EditTextControl,
                value: isUpdate ? contactId : String(contactValuesRef.current.cid || contactId || ''),
                isRequired: 1,
                disabled: true,
            }),
            makeControl({
                name: 'bid',
                label: 'Parent Business',
                group,
                sortOrder: 2,
                displayControl: DisplayControlEnums.ComboBoxControl,
                isRequired: 1,
                options: availableBusinesses,
                value: selectedParentBid,
                disabled: isUpdate,
            }),
            makeControl({
                name: 'cname',
                label: 'Contact Name',
                group,
                sortOrder: 3,
                displayControl: DisplayControlEnums.EditTextControl,
                isRequired: 1,
                value: String(contactValuesRef.current.cname ?? ''),
            }),
            makeControl({
                name: 'contacttype',
                label: 'Contact Type',
                group,
                sortOrder: 4,
                displayControl: DisplayControlEnums.ComboBoxControl,
                options: [
                    { label: 'Contact', value: 'contact' },
                    { label: 'Representative', value: 'representative' },
                    { label: 'Admin', value: 'admin' },
                    { label: 'Billing', value: 'billing' },
                    { label: 'Technical', value: 'technical' },
                ],
                value: String(contactValuesRef.current.contacttype ?? 'contact'),
            }),
            makeControl({
                name: 'status',
                label: 'Status',
                group,
                sortOrder: 5,
                displayControl: DisplayControlEnums.ComboBoxControl,
                options: [
                    { label: 'Active', value: 'Active' },
                    { label: 'Inactive', value: 'Inactive' },
                ],
                value: String(contactValuesRef.current.status ?? 'Active'),
            }),
            makeControl({
                name: 'monitor',
                label: 'Verified / Monitor',
                group,
                sortOrder: 6,
                displayControl: DisplayControlEnums.TrueFalseControl,
                value: toBoolean(contactValuesRef.current.monitor, false) ? 'true' : 'false',
            }),
            makeControl({
                name: 'email',
                label: 'Email',
                group,
                sortOrder: 7,
                displayControl: DisplayControlEnums.EmailControl,
                value: String(contactValuesRef.current.email ?? ''),
            }),
            makeControl({
                name: 'phone',
                label: 'Phone',
                group,
                sortOrder: 8,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(contactValuesRef.current.phone ?? ''),
            }),
            makeControl({
                name: 'address1',
                label: 'Street Address',
                group,
                sortOrder: 9,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(contactValuesRef.current.address1 ?? ''),
            }),
            makeControl({
                name: 'city',
                label: 'City',
                group,
                sortOrder: 10,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(contactValuesRef.current.city ?? ''),
            }),
            makeControl({
                name: 'state',
                label: 'State',
                group,
                sortOrder: 11,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(contactValuesRef.current.state ?? ''),
            }),
            makeControl({
                name: 'zip',
                label: 'Zip Code',
                group,
                sortOrder: 12,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(contactValuesRef.current.zip ?? ''),
            }),
            makeControl({
                name: 'country',
                label: 'Country',
                group,
                sortOrder: 13,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(contactValuesRef.current.country ?? ''),
            }),
            makeControl({
                name: 'datecreated',
                label: 'Date Created',
                group,
                sortOrder: 14,
                displayControl: DisplayControlEnums.DateControl,
                value: String(contactValuesRef.current.datecreated ?? todayIsoDate()),
                disabled: true,
            }),
            makeControl({
                name: 'dateupdated',
                label: 'Date Updated',
                group,
                sortOrder: 15,
                displayControl: DisplayControlEnums.DateControl,
                value: String(contactValuesRef.current.dateupdated ?? todayIsoDate()),
                disabled: true,
            }),
            makeControl({
                name: 'monitorupdated',
                label: 'Monitor Updated Date',
                group,
                sortOrder: 16,
                displayControl: DisplayControlEnums.DateControl,
                value: String(contactValuesRef.current.monitorupdated ?? ''),
            }),
        ];
    }, [contactId, availableBusinesses, selectedParentBid, isUpdate]);

    // Initial profile strings for SettingsLibForm
    const businessProfileString = useMemo(() => {
        return JSON.stringify([businessValuesRef.current]);
    }, [businessId, isUpdate, selectedBusiness]);

    const contactProfileString = useMemo(() => {
        return JSON.stringify([contactValuesRef.current]);
    }, [contactId, isUpdate, selectedContact, selectedParentBid]);

    const handleBusinessValuesChangeExternal = useCallback((values: Record<string, unknown>) => {
        setIsFormChanged(true);
        const extracted = extractValuesFromForm(values, businessControls);
        Object.assign(businessValuesRef.current, extracted);
    }, [businessControls]);

    const handleContactValuesChangeExternal = useCallback((values: Record<string, unknown>) => {
        setIsFormChanged(true);
        const extracted = extractValuesFromForm(values, contactControls);
        Object.assign(contactValuesRef.current, extracted);
        if (extracted.bid) {
            setSelectedParentBid(String(extracted.bid));
        }
    }, [contactControls]);

    const handleBusinessValueChange = useCallback((value: any, name: string | undefined) => {
        if (!name) return;
        setIsFormChanged(true);
        let normalizedValue = value;
        if (value === 'true' || value === true || value === 1 || value === '1') {
            normalizedValue = true;
        } else if (value === 'false' || value === false || value === 0 || value === '0') {
            normalizedValue = false;
        }
        businessValuesRef.current[name] = normalizedValue;
    }, []);

    const handleContactValueChange = useCallback((value: any, name: string | undefined) => {
        if (!name) return;
        setIsFormChanged(true);
        let normalizedValue = value;
        if (value === 'true' || value === true || value === 1 || value === '1') {
            normalizedValue = true;
        } else if (value === 'false' || value === false || value === 0 || value === '0') {
            normalizedValue = false;
        }
        contactValuesRef.current[name] = normalizedValue;

        if (name === 'bid' && value) {
            setSelectedParentBid(String(value));
        }
    }, []);

    // Save Business (Add or Update)
    const handleSaveBusiness = useCallback(async (profileDataStr: string) => {
        let parsedData: Record<string, unknown> = {};
        try {
            const parsed = JSON.parse(profileDataStr);
            parsedData = Array.isArray(parsed) ? parsed[0] || {} : parsed || {};
        } catch {
            parsedData = {};
        }

        const effectiveBid = isUpdate
            ? (businessId || String(selectedBusiness?.bid ?? ''))
            : String(parsedData.bid ?? businessValuesRef.current.bid ?? businessId ?? '').trim();

        if (!effectiveBid) {
            statusBarContext.setFetchError(['Business ID is required']);
            return;
        }

        if (!isUpdate) {
            const existing = (smDataContext.datasets?.businesses ?? []).some(
                (b) => (b.bid || '').toLowerCase() === effectiveBid.toLowerCase()
            );
            if (existing) {
                statusBarContext.setFetchError([`Business ID "${effectiveBid}" already exists`]);
                return;
            }
        }

        const bname = String(parsedData.bname ?? businessValuesRef.current.bname ?? '').trim();
        if (!bname) {
            statusBarContext.setFetchError(['Company Name is required']);
            return;
        }

        const merged: Record<string, unknown> = {
            ...businessValuesRef.current,
            ...parsedData,
            bid: effectiveBid,
            bname,
        };

        const rawData: Record<string, unknown> = {
            bid: effectiveBid,
            bname,
            name: bname,
            btype: String(merged.btype ?? 'consultant'),
            status: String(merged.status ?? 'Active'),
            verified: toBoolean(merged.verified, false),
            salesexec: String(merged.salesexec ?? '').trim(),
            country: String(merged.country ?? '').trim(),
            state: String(merged.state ?? '').trim(),
            daysnoticeperiod: Number(merged.daysnoticeperiod) || 0,
            mmfinyear: Number(merged.mmfinyear) || 0,
            relatedbids: merged.relatedbids
                ? (Array.isArray(merged.relatedbids)
                    ? merged.relatedbids
                    : String(merged.relatedbids).split(',').map((s) => s.trim()).filter(Boolean))
                : [],
            datecreated: toIsoString(merged.datecreated, new Date().toISOString()),
            dateupdated: new Date().toISOString(),
            amcexpirydate: merged.amcexpirydate ? toIsoString(merged.amcexpirydate) : undefined,
            mcsexpirydate: merged.mcsexpirydate ? toIsoString(merged.mcsexpirydate) : undefined,
            saasexpirydate: merged.saasexpirydate ? toIsoString(merged.saasexpirydate) : undefined,
            onpremexpirydate: merged.onpremexpirydate ? toIsoString(merged.onpremexpirydate) : undefined,
        };

        const fsdbPayload = filterAllowedFields(rawData, ALLOWED_BUSINESS_FIELDS);

        statusBarContext.setIsLoading(true);
        statusBarContext.setLoadingLabel(isUpdate ? 'Updating business...' : 'Creating business...');

        try {
            if (isUpdate) {
                const res = await updateBusiness(effectiveBid, fsdbPayload);
                if (res && !res.success) {
                    console.error('updateBusiness error:', res.error);
                    statusBarContext.setFetchError([res.error ?? 'Failed to update business']);
                }
            } else {
                const res = await createBusiness(fsdbPayload);
                if (res && !res.success) {
                    console.error('createBusiness error:', res.error);
                    statusBarContext.setFetchError([res.error ?? 'Failed to create business']);
                }
            }

            const newDoc: IBusinessDoc = {
                ...(rawData as unknown as IBusinessDoc),
            };

            if (smDataContext?.updateDataset) {
                const existingBusinesses = (smDataContext.datasets?.businesses ?? []).filter(
                    (b) => (b.bid || (b as any).EntID || (b as any).id) !== newDoc.bid
                );
                smDataContext.updateDataset('businesses', [
                    ...existingBusinesses,
                    newDoc,
                ]);
            }

            const userCid = String(
                mainAppContext.authSession?.cid ||
                mainAppContext.authSession?.username ||
                'User'
            ).trim();
            const logAction = isUpdate ? 'updated' : 'created';
            const logMsg = `${userCid} of ${effectiveBid} ${logAction} business ${effectiveBid} successfully.`;
            void FnLogActivity({
                bid: effectiveBid,
                cid: userCid,
                message: logMsg,
                createActivity,
                createActivityLog: mainAppContext.createActivityLog,
                updateDataset: smDataContext?.updateDataset,
                currentActivities: smDataContext?.datasets?.activities,
            });

            commonVariableContext.setReloadTreeFor({ featureId: props.featureId, entId: effectiveBid });
            props.handleReloadTree?.(props.featureId, effectiveBid);

            if (!isUpdate) {
                const nextBid = generateAutoBid([
                    ...(smDataContext.datasets?.businesses ?? []),
                    newDoc,
                ]);
                setBusinessId(nextBid);
                businessValuesRef.current = {
                    bid: nextBid,
                    bname: '',
                    btype: 'consultant',
                    status: 'Active',
                    verified: false,
                    salesexec: '',
                    country: 'United States',
                    state: 'CA',
                    daysnoticeperiod: 30,
                    mmfinyear: 12,
                    relatedbids: '',
                    datecreated: todayIsoDate(),
                    dateupdated: todayIsoDate(),
                    amcexpirydate: '',
                    mcsexpirydate: '',
                    saasexpirydate: '',
                    onpremexpirydate: '',
                };
            }

            setIsFormChanged(false);
            FnHideShowSaveIconForForm('hide');
            props.onClose?.();
        } catch (err) {
            console.error('Failed to save business:', err);
            statusBarContext.setFetchError([isUpdate ? 'Failed to update business' : 'Failed to create business']);
        } finally {
            statusBarContext.setIsLoading(false);
            statusBarContext.setLoadingLabel(undefined);
        }
    }, [businessId, isUpdate, selectedBusiness, createBusiness, updateBusiness, createActivity, mainAppContext, smDataContext, statusBarContext, commonVariableContext, props]);

    // Save Contact (Add or Update)
    const handleSaveContact = useCallback(async (profileDataStr: string) => {
        let parsedData: Record<string, unknown> = {};
        try {
            const parsed = JSON.parse(profileDataStr);
            parsedData = Array.isArray(parsed) ? parsed[0] || {} : parsed || {};
        } catch {
            parsedData = {};
        }

        const effectiveCid = isUpdate
            ? (contactId || String(selectedContact?.cid ?? ''))
            : String(parsedData.cid ?? contactValuesRef.current.cid ?? contactId ?? '').trim();

        if (!effectiveCid) {
            statusBarContext.setFetchError(['Contact ID is required']);
            return;
        }

        if (!isUpdate) {
            const existing = (smDataContext.datasets?.contacts ?? []).some(
                (c: any) => (c.cid || '').toLowerCase() === effectiveCid.toLowerCase()
            );
            if (existing) {
                statusBarContext.setFetchError([`Contact ID "${effectiveCid}" already exists`]);
                return;
            }
        }

        const parentBid = String(parsedData.bid ?? contactValuesRef.current.bid ?? selectedParentBid ?? '').trim();
        const cname = String(parsedData.cname ?? contactValuesRef.current.cname ?? '').trim();

        if (!parentBid) {
            statusBarContext.setFetchError(['Parent Business is required']);
            return;
        }
        if (!cname) {
            statusBarContext.setFetchError(['Contact Name is required']);
            return;
        }

        const merged: Record<string, unknown> = {
            ...contactValuesRef.current,
            ...parsedData,
            bid: parentBid,
            cid: effectiveCid,
        };

        const rawData: Record<string, unknown> = {
            bid: parentBid,
            cid: effectiveCid,
            cname,
            contacttype: String(merged.contacttype ?? 'contact'),
            status: String(merged.status ?? 'Active'),
            monitor: toBoolean(merged.monitor !== undefined ? merged.monitor : merged.verified, false),
            monitorupdated: toIsoString(merged.monitorupdated, new Date().toISOString()),
            email: String(merged.email ?? '').trim(),
            phone: String(merged.phone ?? '').trim(),
            address1: String(merged.address1 ?? '').trim(),
            city: String(merged.city ?? '').trim(),
            state: String(merged.state ?? '').trim(),
            zip: String(merged.zip ?? '').trim(),
            country: String(merged.country ?? '').trim(),
            datecreated: toIsoString(merged.datecreated, new Date().toISOString()),
            dateupdated: new Date().toISOString(),
        };

        const fsdbPayload = filterAllowedFields(rawData, ALLOWED_CONTACT_FIELDS);

        statusBarContext.setIsLoading(true);
        statusBarContext.setLoadingLabel(isUpdate ? 'Updating contact...' : 'Creating contact...');

        try {
            if (isUpdate) {
                const res = await updateContact(effectiveCid, fsdbPayload);
                if (res && !res.success) {
                    console.error('updateContact error:', res.error);
                    statusBarContext.setFetchError([res.error ?? 'Failed to update contact']);
                }
            } else {
                const res = await createContact(fsdbPayload);
                if (res && !res.success) {
                    console.error('createContact error:', res.error);
                    statusBarContext.setFetchError([res.error ?? 'Failed to create contact']);
                }
            }

            const newDoc: IContactDoc = {
                ...(rawData as unknown as IContactDoc),
            };

            if (smDataContext?.updateDataset) {
                const existingContacts = (smDataContext.datasets?.contacts ?? []).filter(
                    (c) => (c.cid || (c as any).EntID || (c as any).id) !== newDoc.cid
                );
                smDataContext.updateDataset('contacts', [
                    ...existingContacts,
                    newDoc,
                ]);
            }

            const userCid = String(
                mainAppContext.authSession?.cid ||
                mainAppContext.authSession?.username ||
                'User'
            ).trim();
            const logAction = isUpdate ? 'updated' : 'created';
            const logMsg = `${userCid} of ${parentBid} ${logAction} contact ${effectiveCid} successfully.`;
            void FnLogActivity({
                bid: parentBid,
                cid: userCid,
                message: logMsg,
                createActivity,
                createActivityLog: mainAppContext.createActivityLog,
                updateDataset: smDataContext?.updateDataset,
                currentActivities: smDataContext?.datasets?.activities,
            });

            commonVariableContext.setReloadTreeFor({
                featureId: props.featureId,
                entId: effectiveCid,
                dropNodeEntId: parentBid,
            });
            props.handleReloadTree?.(props.featureId, effectiveCid);

            if (!isUpdate) {
                const nextCid = generateAutoCid(parentBid, [
                    ...(smDataContext.datasets?.contacts ?? []),
                    newDoc,
                ]);
                setContactId(nextCid);
                contactValuesRef.current = {
                    cid: nextCid,
                    bid: parentBid,
                    cname: '',
                    contacttype: 'contact',
                    status: 'Active',
                    monitor: false,
                    email: '',
                    phone: '',
                    address1: '',
                    city: '',
                    state: '',
                    zip: '',
                    country: '',
                    datecreated: todayIsoDate(),
                    dateupdated: todayIsoDate(),
                    monitorupdated: todayIsoDate(),
                };
            }

            setIsFormChanged(false);
            FnHideShowSaveIconForForm('hide');
            props.onClose?.();
        } catch (err) {
            console.error('Failed to save contact:', err);
            statusBarContext.setFetchError([isUpdate ? 'Failed to update contact' : 'Failed to create contact']);
        } finally {
            statusBarContext.setIsLoading(false);
            statusBarContext.setLoadingLabel(undefined);
        }
    }, [contactId, selectedParentBid, isUpdate, selectedContact, createContact, updateContact, createActivity, mainAppContext, smDataContext, statusBarContext, commonVariableContext, props]);

    return (
        <div className="nz-profile-add-container">
            {mode === 'business' ? (
                <SettingsLibForm
                    key={`profile-${isUpdate ? `update-${businessId}` : `add-business-${businessId}`}`}
                    uniqueName={`${props.uniqueName || 'profile-add'}-business-form`}
                    id={isUpdate ? businessId : undefined}
                    controls={businessControls}
                    profileString={businessProfileString}
                    allowShowHeader={true}
                    allowShowSectionHeader={true}
                    headerText={isUpdate ? 'Update Business' : 'Add Business'}
                    isDisableForm={false}
                    isAutoSave={false}
                    isFormValueChangedExternal={isFormChanged}
                    handleValueChange={handleBusinessValueChange}
                    handleValueChangeExternal={handleBusinessValuesChangeExternal}
                    handleSaveForm={handleSaveBusiness}
                />
            ) : (
                <SettingsLibForm
                    key={`profile-${isUpdate ? `update-${contactId}` : `add-contact-${selectedParentBid}-${contactId}`}`}
                    uniqueName={`${props.uniqueName || 'profile-add'}-contact-form`}
                    id={isUpdate ? contactId : undefined}
                    controls={contactControls}
                    profileString={contactProfileString}
                    allowShowHeader={true}
                    allowShowSectionHeader={true}
                    headerText={isUpdate ? 'Update Contact' : 'Add Contact'}
                    isDisableForm={false}
                    isAutoSave={false}
                    isFormValueChangedExternal={isFormChanged}
                    handleValueChange={handleContactValueChange}
                    handleValueChangeExternal={handleContactValuesChangeExternal}
                    handleSaveForm={handleSaveContact}
                />
            )}
        </div>
    );
};

export { ProfileAddFormContainer };
export type { IProfileAddFormContainerProps };
