import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActivities, useBusinesses, useContacts, useFirestore } from '@n20a/libfsdb';
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

/**
 * Checks if a contact is the primary contact created with a company (cid === bid or cid = bid).
 * Such primary contacts can only be deleted when the business record itself is deleted.
 */
export function isPrimaryCompanyContact(cid?: string, bid?: string): boolean {
    if (!cid || !bid) return false;
    const cleanCid = String(cid).trim().toLowerCase();
    const cleanBid = String(bid).trim().toLowerCase();
    return cleanCid === cleanBid || cleanCid === `cid_${cleanBid}` || cleanCid.startsWith(`cid_${cleanBid}_1`);
}

function flattenFormData(profileDataStr: string): Record<string, unknown> {
    let parsedData: Record<string, unknown> = {};
    try {
        const parsed = JSON.parse(profileDataStr);
        if (parsed && typeof parsed === 'object' && 'TableSections' in parsed) {
            const sections = parsed.TableSections as Record<string, Record<string, unknown>>;
            for (const sec of Object.values(sections)) {
                if (sec && typeof sec === 'object') {
                    Object.assign(parsedData, sec);
                }
            }
        } else if (Array.isArray(parsed)) {
            parsedData = parsed[0] || {};
        } else {
            parsedData = parsed || {};
        }
    } catch {
        parsedData = {};
    }

    // Normalize keys from libcountry AddressForm (Address1 -> address1, etc.)
    if (parsedData.Address1 && !parsedData.address1) parsedData.address1 = parsedData.Address1;
    if (parsedData.Address2 && !parsedData.address2) parsedData.address2 = parsedData.Address2;
    if (parsedData.City && !parsedData.city) parsedData.city = parsedData.City;
    if (parsedData.State && !parsedData.state) parsedData.state = parsedData.State;
    if (parsedData.Country && !parsedData.country) parsedData.country = parsedData.Country;
    if (parsedData.Zip && !parsedData.zip) parsedData.zip = parsedData.Zip;

    return parsedData;
}

function normalizeFormKey(k: string): string {
    return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function unwrapControlValue(val: unknown): unknown {
    if (val !== null && typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
        return (val as Record<string, unknown>).value;
    }
    return val;
}

function extractValuesFromForm(values: Record<string, unknown>, controls: IControl[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (!values) return result;
    const valueEntries = Object.entries(values);

    for (const col of controls) {
        const colName = col.Name;
        const colNameLower = colName.toLowerCase();
        const normColName = normalizeFormKey(colName);
        const groupClean = normalizeFormKey(col.DisplayGroupControl ?? 'Default');

        // 1. Direct exact key match
        if (values[colName] !== undefined) {
            result[colName] = unwrapControlValue(values[colName]);
            continue;
        }

        // 2. Search entries in values
        let foundValue: unknown = undefined;
        for (const [k, v] of valueEntries) {
            if (v === undefined) continue;
            const kLower = k.toLowerCase();
            const normK = normalizeFormKey(k);

            // Case-insensitive direct match
            if (kLower === colNameLower || normK === normColName) {
                foundValue = v;
                break;
            }

            // Key starts with normalized group + colName (e.g. contactdetails_cname)
            if (normK.startsWith(`${groupClean}${normColName}`)) {
                foundValue = v;
                break;
            }

            // Key ends with _colname or contains _colname_
            if (kLower.endsWith(`_${colNameLower}`) || kLower.includes(`_${colNameLower}_`) || normK.endsWith(normColName)) {
                foundValue = v;
                break;
            }
        }

        if (foundValue !== undefined) {
            result[colName] = unwrapControlValue(foundValue);
        }
    }

    // Also extract standard address keys if provided in values
    const addrKeys = ['country', 'state', 'city', 'address1', 'address2', 'zip'];
    for (const addrKey of addrKeys) {
        if (result[addrKey] === undefined) {
            for (const [k, v] of valueEntries) {
                if (v !== undefined && (k.toLowerCase() === addrKey || normalizeFormKey(k) === addrKey)) {
                    result[addrKey] = unwrapControlValue(v);
                    break;
                }
            }
        }
    }

    return result;
}

const ALLOWED_CONTACT_FIELDS = new Set([
    'bid',
    'cid',
    'monitorupdated',
    'monitor',
    'verified',
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

function generateAutoBid(existingBusinesses: Array<{ bid?: string; EntID?: string; id?: string }>): string {
    let maxNum = 100;
    for (const b of existingBusinesses) {
        const idVal = b?.bid || b?.EntID || b?.id || '';
        const match = idVal.match(/^bid_(\d+)$/i);
        if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
                maxNum = num;
            }
        }
    }
    let candidate = `bid_${maxNum + 1}`;
    while (existingBusinesses.some((b) => {
        const idVal = (b.bid || b.EntID || b.id || '').toLowerCase();
        return idVal === candidate.toLowerCase();
    })) {
        maxNum++;
        candidate = `bid_${maxNum + 1}`;
    }
    return candidate;
}

function generateAutoCid(parentBid: string, existingContacts: Array<{ cid?: string; bid?: string; EntID?: string; id?: string }>): string {
    const cleanBid = (parentBid || 'bid_100').trim();
    let maxIndex = 0;
    const prefix = `cid_${cleanBid}_`.toLowerCase();
    for (const c of existingContacts) {
        const cidStr = (c?.cid || c?.EntID || c?.id || '').trim();
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
    while (existingContacts.some((c) => {
        const cidStr = (c.cid || c.EntID || c.id || '').toLowerCase();
        return cidStr === candidate.toLowerCase();
    })) {
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
        address1: '',
        address2: '',
        city: '',
        zip: '',
        daysnoticeperiod: 30,
        mmfinyear: 12,
        relatedbids: '',
        datecreated: todayIsoDate(),
        dateupdated: todayIsoDate(),
        amcexpirydate: '',
        mcsexpirydate: '',
        saasexpirydate: '',
        onpremexpirydate: '',
        // First contact fields (used when adding a company)
        first_contact_cname: '',
        first_contact_email: '',
        first_contact_phone: '',
        first_contact_type: 'primary',
    });

    const contactValuesRef = useRef<Record<string, unknown>>({
        cid: isUpdate ? contactId : (contactId || generateAutoCid(selectedParentBid || defaultParentBid, smDataContext.datasets?.contacts ?? [])),
        bid: defaultParentBid,
        cname: '',
        contacttype: 'contact',
        status: 'Active',
        monitor: false,
        verified: false,
        email: '',
        phone: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: '',
        country: 'United States',
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
                address1: selectedBusiness.address1 || (selectedBusiness as any).address_street || '',
                address2: selectedBusiness.address2 || (selectedBusiness as any).address_line2 || '',
                city: selectedBusiness.city || (selectedBusiness as any).address_city || '',
                zip: selectedBusiness.zip || (selectedBusiness as any).address_zip || '',
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
            const currentBid = String(businessValuesRef.current.bid || businessId || '').trim();
            const isTaken = (smDataContext.datasets?.businesses ?? []).some(
                (b) => String(b.bid || (b as any).EntID || (b as any).id || '').trim().toLowerCase() === currentBid.toLowerCase()
            );
            if (!currentBid || currentBid === 'bid_101' || !currentBid.startsWith('bid_') || isTaken || businessId !== autoBid) {
                setBusinessId(autoBid);
                businessValuesRef.current.bid = autoBid;
            }
        }
    }, [isUpdate, selectedBusiness, smDataContext.datasets?.businesses, mode, props.selectedNode]);

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
                verified: toBoolean((selectedContact as any).verified ?? selectedContact.monitor, false),
                email: selectedContact.email || '',
                phone: selectedContact.phone || (selectedContact as any).phone1 || '',
                address1: selectedContact.address1 || (selectedContact as any).address_street || '',
                address2: selectedContact.address2 || '',
                city: selectedContact.city || (selectedContact as any).address_city || '',
                state: selectedContact.state || (selectedContact as any).address_state || '',
                zip: selectedContact.zip || (selectedContact as any).address_zip || '',
                country: selectedContact.country || (selectedContact as any).address_country || 'United States',
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
    const firestore = useFirestore();
    const { createBusiness, updateBusiness } = useBusinesses();
    const { createContact, updateContact } = useContacts(selectedParentBid || 'bid_100');
    const { createActivity } = useActivities(
        mode === 'contact'
            ? (selectedParentBid || defaultParentBid || 'bid_100')
            : (businessId || defaultParentBid || 'bid_100')
    );

    // Business Controls for SettingsLibForm
    const businessControls: IControl[] = useMemo(() => {
        const groupCompany = 'Company Details';
        const groupFirstContact = 'First Contact Details';

        const controls: IControl[] = [
            makeControl({
                name: 'bid',
                label: 'Business ID',
                group: groupCompany,
                sortOrder: 1,
                displayControl: DisplayControlEnums.EditTextControl,
                value: isUpdate ? businessId : String(businessValuesRef.current.bid || businessId || ''),
                isRequired: 1,
                disabled: true,
            }),
            makeControl({
                name: 'bname',
                label: 'Company Name',
                group: groupCompany,
                sortOrder: 2,
                displayControl: DisplayControlEnums.EditTextControl,
                isRequired: 1,
                value: String(businessValuesRef.current.bname ?? ''),
            }),
            makeControl({
                name: 'btype',
                label: 'Business Type',
                group: groupCompany,
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
                group: groupCompany,
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
                group: groupCompany,
                sortOrder: 5,
                displayControl: DisplayControlEnums.TrueFalseControl,
                value: toBoolean(businessValuesRef.current.verified, false) ? 'true' : 'false',
            }),
            makeControl({
                name: 'salesexec',
                label: 'Sales Executive',
                group: groupCompany,
                sortOrder: 6,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(businessValuesRef.current.salesexec ?? ''),
            }),
            makeControl({
                name: 'daysnoticeperiod',
                label: 'Notice Period (Days)',
                group: groupCompany,
                sortOrder: 7,
                displayControl: DisplayControlEnums.SpinControl,
                value: String(businessValuesRef.current.daysnoticeperiod ?? '30'),
            }),
            makeControl({
                name: 'mmfinyear',
                label: 'Financial Year Month',
                group: groupCompany,
                sortOrder: 8,
                displayControl: DisplayControlEnums.SpinControl,
                value: String(businessValuesRef.current.mmfinyear ?? '12'),
            }),
            makeControl({
                name: 'relatedbids',
                label: 'Related BIDs',
                group: groupCompany,
                sortOrder: 9,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(businessValuesRef.current.relatedbids ?? ''),
            }),
        ];

        // When adding a new company, also collect First Contact info in the same form
        if (!isUpdate) {
            controls.push(
                makeControl({
                    name: 'first_contact_cname',
                    label: 'First Contact Name',
                    group: groupFirstContact,
                    sortOrder: 10,
                    displayControl: DisplayControlEnums.EditTextControl,
                    isRequired: 1,
                    value: String(businessValuesRef.current.first_contact_cname ?? ''),
                }),
                makeControl({
                    name: 'first_contact_email',
                    label: 'First Contact Email',
                    group: groupFirstContact,
                    sortOrder: 11,
                    displayControl: DisplayControlEnums.EmailControl,
                    isRequired: 1,
                    value: String(businessValuesRef.current.first_contact_email ?? ''),
                }),
                makeControl({
                    name: 'first_contact_phone',
                    label: 'First Contact Phone',
                    group: groupFirstContact,
                    sortOrder: 12,
                    displayControl: DisplayControlEnums.EditTextControl,
                    isRequired: 1,
                    value: String(businessValuesRef.current.first_contact_phone ?? ''),
                }),
                makeControl({
                    name: 'first_contact_type',
                    label: 'Contact Type',
                    group: groupFirstContact,
                    sortOrder: 13,
                    displayControl: DisplayControlEnums.ComboBoxControl,
                    options: [
                        { label: 'Primary Contact', value: 'primary' },
                        { label: 'Representative', value: 'representative' },
                        { label: 'Admin', value: 'admin' },
                        { label: 'Billing', value: 'billing' },
                        { label: 'Technical', value: 'technical' },
                    ],
                    value: String(businessValuesRef.current.first_contact_type ?? 'primary'),
                })
            );
        }

        // Address controls (processed by SettingsLibForm via libcountry AddressForm)
        const groupAddress = 'Address Details';
        controls.push(
            makeControl({
                name: 'address1',
                label: 'Street Address',
                group: groupAddress,
                sortOrder: 20,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(businessValuesRef.current.address1 ?? ''),
            }),
            makeControl({
                name: 'address2',
                label: 'Suite / Apt',
                group: groupAddress,
                sortOrder: 21,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(businessValuesRef.current.address2 ?? ''),
            }),
            makeControl({
                name: 'city',
                label: 'City',
                group: groupAddress,
                sortOrder: 22,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(businessValuesRef.current.city ?? ''),
            }),
            makeControl({
                name: 'state',
                label: 'State',
                group: groupAddress,
                sortOrder: 23,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(businessValuesRef.current.state ?? 'CA'),
            }),
            makeControl({
                name: 'country',
                label: 'Country',
                group: groupAddress,
                sortOrder: 24,
                displayControl: DisplayControlEnums.EditTextControl,
                isRequired: 1,
                value: String(businessValuesRef.current.country ?? 'United States'),
            }),
            makeControl({
                name: 'zip',
                label: 'Zip Code',
                group: groupAddress,
                sortOrder: 25,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(businessValuesRef.current.zip ?? ''),
            })
        );

        return controls;
    }, [isUpdate, businessId]);

    // Contact Controls for SettingsLibForm:
    // Requires 5 fields when adding/updating contact: business (bid), name (cname), email, phone, country
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
                isRequired: 1, // 1. Business required
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
                isRequired: 1, // 2. Name required
                value: String(contactValuesRef.current.cname ?? ''),
            }),
            makeControl({
                name: 'email',
                label: 'Email',
                group,
                sortOrder: 4,
                displayControl: DisplayControlEnums.EmailControl,
                isRequired: 1, // 3. Email required
                value: String(contactValuesRef.current.email ?? ''),
            }),
            makeControl({
                name: 'phone',
                label: 'Phone',
                group,
                sortOrder: 5,
                displayControl: DisplayControlEnums.EditTextControl,
                isRequired: 1, // 4. Phone required
                value: String(contactValuesRef.current.phone ?? ''),
            }),
            makeControl({
                name: 'country',
                label: 'Country',
                group,
                sortOrder: 6,
                displayControl: DisplayControlEnums.EditTextControl,
                isRequired: 1, // 5. Country required
                value: String(contactValuesRef.current.country ?? 'United States'),
            }),
            makeControl({
                name: 'contacttype',
                label: 'Contact Type',
                group,
                sortOrder: 7,
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
                sortOrder: 8,
                displayControl: DisplayControlEnums.ComboBoxControl,
                options: [
                    { label: 'Active', value: 'Active' },
                    { label: 'Inactive', value: 'Inactive' },
                ],
                value: String(contactValuesRef.current.status ?? 'Active'),
            }),
            makeControl({
                name: 'verified',
                label: 'Verified',
                group,
                sortOrder: 9,
                displayControl: DisplayControlEnums.TrueFalseControl,
                value: toBoolean(contactValuesRef.current.verified !== undefined ? contactValuesRef.current.verified : contactValuesRef.current.monitor, false) ? 'true' : 'false',
            }),
            makeControl({
                name: 'address1',
                label: 'Street Address',
                group,
                sortOrder: 10,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(contactValuesRef.current.address1 ?? ''),
            }),
            makeControl({
                name: 'address2',
                label: 'Suite / Apt',
                group,
                sortOrder: 11,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(contactValuesRef.current.address2 ?? ''),
            }),
            makeControl({
                name: 'city',
                label: 'City',
                group,
                sortOrder: 12,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(contactValuesRef.current.city ?? ''),
            }),
            makeControl({
                name: 'state',
                label: 'State',
                group,
                sortOrder: 13,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(contactValuesRef.current.state ?? ''),
            }),
            makeControl({
                name: 'zip',
                label: 'Zip Code',
                group,
                sortOrder: 14,
                displayControl: DisplayControlEnums.EditTextControl,
                value: String(contactValuesRef.current.zip ?? ''),
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

    const checkIsBusinessValid = useCallback(() => {
        const bid = String(businessValuesRef.current.bid ?? businessId ?? '').trim();
        const bname = String(businessValuesRef.current.bname ?? '').trim();
        const country = String(businessValuesRef.current.country ?? businessValuesRef.current.Country ?? 'United States').trim();

        if (!bid || !bname) return false;

        const existingBusinesses = smDataContext.datasets?.businesses ?? [];
        if (!isUpdate) {
            const duplicateBid = existingBusinesses.some(
                (b) => (b.bid || (b as any).EntID || (b as any).id || '').toLowerCase() === bid.toLowerCase()
            );
            if (duplicateBid) return false;
        }

        if (!isUpdate) {
            const firstContactName = String(businessValuesRef.current.first_contact_cname ?? '').trim();
            const firstContactEmail = String(businessValuesRef.current.first_contact_email ?? '').trim();
            const firstContactPhone = String(businessValuesRef.current.first_contact_phone ?? '').trim();
            if (!firstContactName || !firstContactEmail || !firstContactPhone || !country) {
                return false;
            }
        }
        return true;
    }, [businessId, isUpdate, smDataContext.datasets?.businesses]);

    const checkIsContactValid = useCallback(() => {
        const parentBid = String(contactValuesRef.current.bid ?? selectedParentBid ?? '').trim();
        const cname = String(contactValuesRef.current.cname ?? '').trim();
        const email = String(contactValuesRef.current.email ?? '').trim();
        const phone = String(contactValuesRef.current.phone ?? '').trim();
        const country = String(contactValuesRef.current.country ?? contactValuesRef.current.Country ?? 'United States').trim();

        if (!parentBid || !cname || !email || !phone || !country) {
            return false;
        }

        const existingContacts = smDataContext.datasets?.contacts ?? [];
        if (!isUpdate) {
            const cid = String(contactValuesRef.current.cid ?? contactId ?? '').trim();
            if (cid) {
                const duplicateCid = existingContacts.some(
                    (c: any) => (c.cid || c.EntID || c.id || '').toLowerCase() === cid.toLowerCase()
                );
                if (duplicateCid) return false;
            }
        }
        return true;
    }, [contactId, isUpdate, selectedParentBid, smDataContext.datasets?.contacts]);

    const handleBusinessValuesChangeExternal = useCallback((values: Record<string, unknown>) => {
        const extracted = extractValuesFromForm(values, businessControls);
        Object.assign(businessValuesRef.current, extracted);
        const valid = checkIsBusinessValid();
        setIsFormChanged(valid);
        FnHideShowSaveIconForForm(valid ? 'show' : 'hide');
    }, [businessControls, checkIsBusinessValid]);

    const handleContactValuesChangeExternal = useCallback((values: Record<string, unknown>) => {
        const extracted = extractValuesFromForm(values, contactControls);
        Object.assign(contactValuesRef.current, extracted);
        if (extracted.verified !== undefined || extracted.monitor !== undefined) {
            const v = extracted.verified !== undefined ? extracted.verified : extracted.monitor;
            const b = toBoolean(v, false);
            contactValuesRef.current.verified = b;
            contactValuesRef.current.monitor = b;
        }
        if (extracted.bid) {
            setSelectedParentBid(String(extracted.bid));
        }
        const valid = checkIsContactValid();
        setIsFormChanged(valid);
        FnHideShowSaveIconForForm(valid ? 'show' : 'hide');
    }, [contactControls, checkIsContactValid]);

    const handleBusinessValueChange = useCallback((value: any, name: string | undefined) => {
        if (!name) return;
        let normalizedValue = value;
        if (value === 'true' || value === true || value === 1 || value === '1') {
            normalizedValue = true;
        } else if (value === 'false' || value === false || value === 0 || value === '0') {
            normalizedValue = false;
        } else if (value !== null && typeof value === 'object' && 'value' in value) {
            normalizedValue = value.value;
        }
        businessValuesRef.current[name] = normalizedValue;
        const valid = checkIsBusinessValid();
        setIsFormChanged(valid);
        FnHideShowSaveIconForForm(valid ? 'show' : 'hide');
    }, [checkIsBusinessValid]);

    const handleContactValueChange = useCallback((value: any, name: string | undefined) => {
        if (!name) return;
        let normalizedValue = value;
        if (value === 'true' || value === true || value === 1 || value === '1') {
            normalizedValue = true;
        } else if (value === 'false' || value === false || value === 0 || value === '0') {
            normalizedValue = false;
        } else if (value !== null && typeof value === 'object' && 'value' in value) {
            normalizedValue = value.value;
        }
        contactValuesRef.current[name] = normalizedValue;
        if (name === 'verified' || name === 'monitor') {
            contactValuesRef.current.verified = normalizedValue;
            contactValuesRef.current.monitor = normalizedValue;
        }

        if (name === 'bid' && normalizedValue) {
            setSelectedParentBid(String(normalizedValue));
        }
        const valid = checkIsContactValid();
        setIsFormChanged(valid);
        FnHideShowSaveIconForForm(valid ? 'show' : 'hide');
    }, [checkIsContactValid]);

    // Save Business (Add or Update)
    // When a company is added, also creates the first contact in the same form with cid = bid (contacted = bid)
    const handleSaveBusiness = useCallback(async (profileDataStr: string) => {
        const parsedData = flattenFormData(profileDataStr);

        const effectiveBid = isUpdate
            ? (businessId || String(selectedBusiness?.bid ?? ''))
            : String(parsedData.bid ?? businessValuesRef.current.bid ?? businessId ?? '').trim();

        if (!effectiveBid) {
            statusBarContext.setFetchError(['Business ID is required']);
            return;
        }

        const bname = String(parsedData.bname ?? businessValuesRef.current.bname ?? '').trim();
        if (!bname) {
            statusBarContext.setFetchError(['Company Name is required']);
            return;
        }

        const existingBusinesses = smDataContext.datasets?.businesses ?? [];
        if (!isUpdate) {
            const existingBid = existingBusinesses.some(
                (b) => (b.bid || (b as any).EntID || (b as any).id || '').toLowerCase() === effectiveBid.toLowerCase()
            );
            if (existingBid) {
                statusBarContext.setFetchError([`Business ID "${effectiveBid}" already exists. Please enter a unique Business ID.`]);
                return;
            }
        }

        // When adding a new company, validate required first contact fields
        const firstContactName = String(
            parsedData.first_contact_cname ?? businessValuesRef.current.first_contact_cname ?? ''
        ).trim();
        const firstContactEmail = String(
            parsedData.first_contact_email ?? businessValuesRef.current.first_contact_email ?? ''
        ).trim();
        const firstContactPhone = String(
            parsedData.first_contact_phone ?? businessValuesRef.current.first_contact_phone ?? ''
        ).trim();
        const country = String(
            parsedData.country ?? businessValuesRef.current.country ?? ''
        ).trim();

        if (!isUpdate) {
            if (!firstContactName) {
                statusBarContext.setFetchError(['First Contact Name is required']);
                return;
            }
            if (!firstContactEmail) {
                statusBarContext.setFetchError(['First Contact Email is required']);
                return;
            }
            if (!firstContactPhone) {
                statusBarContext.setFetchError(['First Contact Phone is required']);
                return;
            }
            if (!country) {
                statusBarContext.setFetchError(['Country is required']);
                return;
            }
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
            country: country || 'United States',
            state: String(merged.state ?? '').trim(),
            address1: String(merged.address1 ?? '').trim(),
            address2: String(merged.address2 ?? '').trim(),
            city: String(merged.city ?? '').trim(),
            zip: String(merged.zip ?? '').trim(),
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

            let updatedContacts = smDataContext.datasets?.contacts ?? [];

            // In Add Company mode, create the first contact with cid = cid_bid_uniq_1 and bid = bid
            if (!isUpdate) {
                const primaryCid = generateAutoCid(effectiveBid, smDataContext.datasets?.contacts ?? []);
                const firstContactType = String(
                    parsedData.first_contact_type ?? businessValuesRef.current.first_contact_type ?? 'primary'
                ).trim();

                const firstContactDoc: IContactDoc & { verified?: boolean } = {
                    bid: effectiveBid,
                    cid: primaryCid, // Unique primary contact ID, e.g. cid_bid_544_1
                    cname: firstContactName,
                    email: firstContactEmail,
                    phone: firstContactPhone,
                    contacttype: firstContactType,
                    status: 'Active',
                    monitor: false,
                    verified: false,
                    ctag: 'primary',
                    address1: String(merged.address1 ?? '').trim(),
                    address2: String(merged.address2 ?? '').trim(),
                    city: String(merged.city ?? '').trim(),
                    state: String(merged.state ?? '').trim(),
                    country: country || 'United States',
                    zip: String(merged.zip ?? '').trim(),
                    datecreated: new Date().toISOString(),
                    dateupdated: new Date().toISOString(),
                    monitorupdated: new Date().toISOString(),
                    role: '',
                    countrycode: '',
                    timezoneoffset: 0,
                    donotcallme: false,
                    removemefrommailinglist: false,
                    smsoptin: false
                };

                try {
                    await firestore.createDocument({
                        pathSegments: ['businesses', effectiveBid, 'contacts'],
                        data: filterAllowedFields(firstContactDoc as unknown as Record<string, unknown>, ALLOWED_CONTACT_FIELDS),
                    });
                } catch (cErr) {
                    console.warn('createDocument for primary contact in add company:', cErr);
                }

                updatedContacts = [
                    ...updatedContacts.filter((c) => c.cid !== effectiveBid),
                    firstContactDoc,
                ];
            }

            if (smDataContext?.updateDataset) {
                const existingBusinesses = (smDataContext.datasets?.businesses ?? []).filter(
                    (b) => (b.bid || (b as any).EntID || (b as any).id) !== newDoc.bid
                );
                smDataContext.updateDataset('businesses', [
                    ...existingBusinesses,
                    newDoc,
                ]);
                smDataContext.updateDataset('contacts', updatedContacts);
            }

            const userCid = String(
                mainAppContext.authSession?.cid ||
                mainAppContext.authSession?.username ||
                'User'
            ).trim();
            const logAction = isUpdate ? 'updated' : 'created';
            const logMsg = `${userCid} of ${effectiveBid} ${logAction} business ${effectiveBid} with primary contact successfully.`;
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
                    address1: '',
                    address2: '',
                    city: '',
                    zip: '',
                    daysnoticeperiod: 30,
                    mmfinyear: 12,
                    relatedbids: '',
                    datecreated: todayIsoDate(),
                    dateupdated: todayIsoDate(),
                    amcexpirydate: '',
                    mcsexpirydate: '',
                    saasexpirydate: '',
                    onpremexpirydate: '',
                    first_contact_cname: '',
                    first_contact_email: '',
                    first_contact_phone: '',
                    first_contact_type: 'primary',
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
    }, [businessId, isUpdate, selectedBusiness, createBusiness, updateBusiness, createContact, createActivity, mainAppContext, smDataContext, statusBarContext, commonVariableContext, props]);

    // Save Contact (Add or Update)
    // Enforces the 5 required fields: business, name, email, phone, country
    const handleSaveContact = useCallback(async (profileDataStr: string) => {
        const parsedData = flattenFormData(profileDataStr);

        const effectiveCid = isUpdate
            ? (contactId || String(selectedContact?.cid ?? ''))
            : String(parsedData.cid ?? contactValuesRef.current.cid ?? contactId ?? '').trim();

        if (!effectiveCid) {
            statusBarContext.setFetchError(['Contact ID is required']);
            return;
        }

        if (!isUpdate) {
            const existing = (smDataContext.datasets?.contacts ?? []).some(
                (c: any) => (c.cid || c.EntID || c.id || '').toLowerCase() === effectiveCid.toLowerCase()
            );
            if (existing) {
                statusBarContext.setFetchError([`Contact ID "${effectiveCid}" already exists. Please enter a unique Contact ID.`]);
                return;
            }
        }

        const parentBid = String(parsedData.bid ?? contactValuesRef.current.bid ?? selectedParentBid ?? '').trim();
        const cname = String(parsedData.cname ?? contactValuesRef.current.cname ?? '').trim();
        const email = String(parsedData.email ?? contactValuesRef.current.email ?? '').trim();
        const phone = String(parsedData.phone ?? contactValuesRef.current.phone ?? '').trim();
        const country = String(parsedData.country ?? contactValuesRef.current.country ?? '').trim();

        // Enforce 5 required fields for contact: business, name, email, phone, country
        if (!parentBid) {
            statusBarContext.setFetchError(['Business is required']);
            return;
        }
        if (!cname) {
            statusBarContext.setFetchError(['Contact Name is required']);
            return;
        }
        if (!email) {
            statusBarContext.setFetchError(['Email is required']);
            return;
        }
        if (!phone) {
            statusBarContext.setFetchError(['Phone is required']);
            return;
        }
        if (!country) {
            statusBarContext.setFetchError(['Country is required']);
            return;
        }

        const merged: Record<string, unknown> = {
            ...contactValuesRef.current,
            ...parsedData,
            bid: parentBid,
            cid: effectiveCid,
            cname,
            email,
            phone,
            country,
        };

        const isVerified = toBoolean(
            merged.verified !== undefined ? merged.verified : merged.monitor,
            false
        );

        const rawData: Record<string, unknown> = {
            bid: parentBid,
            cid: effectiveCid,
            cname,
            contacttype: String(merged.contacttype ?? 'contact'),
            status: String(merged.status ?? 'Active'),
            verified: isVerified,
            monitor: isVerified,
            monitorupdated: toIsoString(merged.monitorupdated, new Date().toISOString()),
            email,
            phone,
            address1: String(merged.address1 ?? '').trim(),
            address2: String(merged.address2 ?? '').trim(),
            city: String(merged.city ?? '').trim(),
            state: String(merged.state ?? '').trim(),
            zip: String(merged.zip ?? '').trim(),
            country,
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

            const newDoc: IContactDoc & { verified?: boolean } = {
                ...(rawData as unknown as IContactDoc),
                verified: isVerified,
                monitor: isVerified,
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
                    verified: false,
                    email: '',
                    phone: '',
                    address1: '',
                    address2: '',
                    city: '',
                    state: '',
                    zip: '',
                    country: 'United States',
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
                    key={`profile-${isUpdate ? `update-${businessId}` : 'add-business'}`}
                    uniqueName={`${props.uniqueName || 'profile-add'}-business-form`}
                    id={isUpdate ? businessId : undefined}
                    controls={businessControls}
                    profileString={businessProfileString}
                    allowShowHeader={true}
                    allowShowSectionHeader={true}
                    headerText={isUpdate ? 'Update Business' : 'Add Business'}
                    isDisableForm={false}
                    isAutoSave={false}
                    isAddressFormRequired={true}
                    isFormValueChangedExternal={isFormChanged}
                    handleValueChange={handleBusinessValueChange}
                    handleValueChangeExternal={handleBusinessValuesChangeExternal}
                    handleSaveForm={handleSaveBusiness}
                />
            ) : (
                <SettingsLibForm
                    key={`profile-${isUpdate ? `update-${contactId}` : 'add-contact'}`}
                    uniqueName={`${props.uniqueName || 'profile-add'}-contact-form`}
                    id={isUpdate ? contactId : undefined}
                    controls={contactControls}
                    profileString={contactProfileString}
                    allowShowHeader={true}
                    allowShowSectionHeader={true}
                    headerText={isUpdate ? 'Update Contact' : 'Add Contact'}
                    isDisableForm={false}
                    isAutoSave={false}
                    isAddressFormRequired={true}
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
