import { DisplayControlEnums } from '../../../shared/alldefaultprops/basic/DefaultPropsFormContainer';
import type { IControl } from '../../../shared/allinterface/settingsform/ISettingsLibForm';
import type { IMfgRecord } from '../../../shared/context/allinterface/IRms';

export type MfgCommand =
    | 'add-mfg'
    | 'edit-mfg'
    | 'delete-mfg'
    | 'edit-mfgrelation'
    | 'edit-prodline'
    | 'edit-mfgeqtype';

/**
 * Creates an IControl configuration for settings lib forms.
 */
export function createMfgControl(
    name: string,
    label: string,
    displayControl: string,
    sortOrder: number,
    extra?: Partial<IControl>
): IControl {
    return {
        CanChange: 1,
        IsRequired: extra?.IsRequired ?? 0,
        GroupName: 'Mfg',
        GroupNameDesc: '',
        SubGroupEntID: '',
        SubGroupName: 'FormControl',
        SubGroupNameDesc: '',
        _AP: name,
        PropertyLabel: label,
        NameDesc: label,
        DefaultAPValue: extra?.DefaultAPValue ?? '',
        Value: extra?.Value ?? '',
        ValueDesc: '',
        SortOrder: sortOrder,
        MaxInstances: 0,
        InputMask: extra?.InputMask ?? '',
        RegEx: '',
        DisplayGroupControl: 'Manufacturer',
        DisplayControl: displayControl,
        ChangeEvent: '',
        Secured: false,
        IsNZ: false,
        EntID: name,
        RecID: name,
        LastUpdated: '',
        EntityName: 'Mfg',
        Name: name,
        disabled: extra?.disabled ?? false,
        ...extra,
    };
}

export interface IMfgAddressData {
    Address1: string;
    Address2: string;
    City: string;
    State: string;
    Country: string;
    Zip: string;
    CountryCode: string;
}

export function parseMfgAddress(rawAddress?: string): IMfgAddressData {
    if (!rawAddress) {
        return { Address1: '', Address2: '', City: '', State: '', Country: '', Zip: '', CountryCode: '' };
    }
    try {
        const parsed = JSON.parse(rawAddress);
        if (parsed && typeof parsed === 'object') {
            return {
                Address1: String(parsed.Address1 ?? parsed.address1 ?? ''),
                Address2: String(parsed.Address2 ?? parsed.address2 ?? ''),
                City: String(parsed.City ?? parsed.city ?? ''),
                State: String(parsed.State ?? parsed.state ?? ''),
                Country: String(parsed.Country ?? parsed.country ?? ''),
                Zip: String(parsed.Zip ?? parsed.zip ?? ''),
                CountryCode: String(parsed.CountryCode ?? parsed.countrycode ?? ''),
            };
        }
    } catch {
        // Plain string fallback
    }
    return {
        Address1: rawAddress,
        Address2: '',
        City: '',
        State: '',
        Country: '',
        Zip: '',
        CountryCode: '',
    };
}

export function serializeMfgAddress(data: Partial<IMfgAddressData>): string {
    const hasStructured = data.City || data.State || data.Country || data.Zip || data.Address2;
    if (hasStructured) {
        return JSON.stringify({
            Address1: data.Address1 ?? '',
            Address2: data.Address2 ?? '',
            City: data.City ?? '',
            State: data.State ?? '',
            Country: data.Country ?? '',
            Zip: data.Zip ?? '',
            CountryCode: data.CountryCode ?? '',
        });
    }
    return data.Address1 ?? '';
}

/**
 * Builds controls for Add, Edit, or Delete Manufacturer forms.
 * Both Acronym and MfgName are editable combo controls, followed by Website and AddressForm fields.
 */
export function buildMfgDetailsControls(
    mode: 'add-mfg' | 'edit-mfg' | 'delete-mfg',
    currentRecord?: IMfgRecord | null,
    acronymOptions: Array<{ value: string; label: string }> = [],
    nameOptions: Array<{ value: string; label: string }> = []
): IControl[] {
    const isDelete = mode === 'delete-mfg';
    const addr = parseMfgAddress(currentRecord?.address);

    return [
        createMfgControl('Acronym', 'Acronym', DisplayControlEnums.EditComboControl, 1, {
            IsRequired: 1,
            disabled: isDelete,
            allowCustom: !isDelete,
            Options: acronymOptions,
            Value: currentRecord?.mfgkey ?? '',
            DefaultAPValue: currentRecord?.mfgkey ?? '',
            DisplayGroupControl: 'Manufacturer',
        }),
        createMfgControl('MfgName', 'MfgName', DisplayControlEnums.EditComboControl, 2, {
            IsRequired: 1,
            disabled: isDelete,
            allowCustom: !isDelete,
            Options: nameOptions,
            Value: currentRecord?.mfgname ?? '',
            DefaultAPValue: currentRecord?.mfgname ?? '',
            DisplayGroupControl: 'Manufacturer',
        }),
        createMfgControl('Website', 'Website', DisplayControlEnums.EditTextControl, 3, {
            disabled: isDelete,
            Value: currentRecord?.website ?? '',
            DefaultAPValue: currentRecord?.website ?? '',
            DisplayGroupControl: 'Manufacturer',
        }),
        // Address controls (processed by SettingsLibForm via libcountry AddressForm when isAddressFormRequired={true})
        createMfgControl('Address1', 'Address 1', DisplayControlEnums.TextControl, 4, {
            disabled: isDelete,
            Value: addr.Address1,
            DefaultAPValue: addr.Address1,
            DisplayGroupControl: 'Address',
            GroupName: 'Address',
            GroupNameDesc: 'Address',
        }),
        createMfgControl('Address2', 'Address 2', DisplayControlEnums.TextControl, 5, {
            disabled: isDelete,
            Value: addr.Address2,
            DefaultAPValue: addr.Address2,
            DisplayGroupControl: 'Address',
            GroupName: 'Address',
            GroupNameDesc: 'Address',
        }),
        createMfgControl('City', 'City', DisplayControlEnums.TextControl, 6, {
            disabled: isDelete,
            Value: addr.City,
            DefaultAPValue: addr.City,
            DisplayGroupControl: 'Address',
            GroupName: 'Address',
            GroupNameDesc: 'Address',
        }),
        createMfgControl('State', 'State', DisplayControlEnums.TextControl, 7, {
            disabled: isDelete,
            Value: addr.State,
            DefaultAPValue: addr.State,
            DisplayGroupControl: 'Address',
            GroupName: 'Address',
            GroupNameDesc: 'Address',
        }),
        createMfgControl('Country', 'Country', DisplayControlEnums.TextControl, 8, {
            disabled: isDelete,
            Value: addr.Country,
            DefaultAPValue: addr.Country,
            DisplayGroupControl: 'Address',
            GroupName: 'Address',
            GroupNameDesc: 'Address',
        }),
        createMfgControl('Zip', 'Zip', DisplayControlEnums.TextControl, 9, {
            disabled: isDelete,
            Value: addr.Zip,
            DefaultAPValue: addr.Zip,
            DisplayGroupControl: 'Address',
            GroupName: 'Address',
            GroupNameDesc: 'Address',
        }),
        createMfgControl('CountryCode', 'Country Code', DisplayControlEnums.TextControl, 10, {
            disabled: isDelete,
            Value: addr.CountryCode,
            DefaultAPValue: addr.CountryCode,
            DisplayGroupControl: 'Address',
            GroupName: 'Address',
            GroupNameDesc: 'Address',
        }),
        createMfgControl('TimezoneOffset', 'Timezone Offset', DisplayControlEnums.TextControl, 11, {
            disabled: isDelete,
            Value: '',
            DefaultAPValue: '',
            DisplayGroupControl: 'Address',
            GroupName: 'Address',
            GroupNameDesc: 'Address',
        }),
    ];
}

/**
 * Builds controls for Prodline form in the right-side pane.
 * Acronym is readonly, Prodline is an editable combo.
 */
export function buildProdlinePaneControls(
    mfgAcronym: string,
    currentProdline: string,
    prodlineOptions: Array<{ value: string; label: string }>
): IControl[] {
    return [
        createMfgControl('Acronym', 'Acronym', DisplayControlEnums.EditTextControl, 1, {
            disabled: true,
            Value: mfgAcronym,
            DefaultAPValue: mfgAcronym,
            DisplayGroupControl: 'Prodline',
            GroupName: 'Prodline',
            EntityName: 'Prodline',
        }),
        createMfgControl('Prodline', 'Prodline', DisplayControlEnums.EditComboControl, 2, {
            IsRequired: 1,
            allowCustom: true,
            Options: prodlineOptions,
            Value: currentProdline,
            DefaultAPValue: currentProdline,
            DisplayGroupControl: 'Prodline',
            GroupName: 'Prodline',
            EntityName: 'Prodline',
        }),
    ];
}

/**
 * Builds controls for MfgEqType form in the right-side pane.
 * Acronym and Prodline are readonly, MfgEqType is an editable combo.
 */
export function buildEqtypePaneControls(
    mfgAcronym: string,
    prodline: string,
    currentEqtype: string,
    eqtypeOptions: Array<{ value: string; label: string }>
): IControl[] {
    return [
        createMfgControl('Acronym', 'Acronym', DisplayControlEnums.EditTextControl, 1, {
            disabled: true,
            Value: mfgAcronym,
            DefaultAPValue: mfgAcronym,
            DisplayGroupControl: 'MfgEqType',
            GroupName: 'MfgEqType',
            EntityName: 'MfgEqType',
        }),
        createMfgControl('Prodline', 'Prodline', DisplayControlEnums.EditTextControl, 2, {
            disabled: true,
            Value: prodline,
            DefaultAPValue: prodline,
            DisplayGroupControl: 'MfgEqType',
            GroupName: 'MfgEqType',
            EntityName: 'MfgEqType',
        }),
        createMfgControl('MfgEqType', 'MfgEqType', DisplayControlEnums.EditComboControl, 3, {
            IsRequired: 1,
            allowCustom: true,
            Options: eqtypeOptions,
            Value: currentEqtype,
            DefaultAPValue: currentEqtype,
            DisplayGroupControl: 'MfgEqType',
            GroupName: 'MfgEqType',
            EntityName: 'MfgEqType',
        }),
    ];
}

/**
 * Builds controls for MfgRelation form in the right-side pane.
 * Acronym is readonly, MfgRelation is an editable combo.
 */
export function buildRelationPaneControls(
    mfgAcronym: string,
    currentRelation: string,
    relationOptions: Array<{ value: string; label: string }>
): IControl[] {
    return [
        createMfgControl('Acronym', 'Acronym', DisplayControlEnums.EditTextControl, 1, {
            disabled: true,
            Value: mfgAcronym,
            DefaultAPValue: mfgAcronym,
            DisplayGroupControl: 'MfgRelation',
            GroupName: 'MfgRelation',
            EntityName: 'MfgRelation',
        }),
        createMfgControl('MfgRelation', 'MfgRelation', DisplayControlEnums.EditComboControl, 2, {
            IsRequired: 1,
            allowCustom: true,
            Options: relationOptions,
            Value: currentRelation,
            DefaultAPValue: currentRelation,
            DisplayGroupControl: 'MfgRelation',
            GroupName: 'MfgRelation',
            EntityName: 'MfgRelation',
        }),
    ];
}

export interface IRelationControlContext {
    mfgName?: string;
    prodlineName?: string;
}

/**
 * Builds controls for list management (MfgRelation, Prodline, MfgEqType).
 * Shows Mfg (read-only text), Prodline (read-only text for MfgEqType), and the active editable combo.
 */
export function buildRelationControls(
    label: string,
    currentItems: string[],
    availableOptions: Array<{ value: string; label: string }>,
    initialValue?: string,
    context?: IRelationControlContext
): IControl[] {
    const controls: IControl[] = [];
    const mfgText = context?.mfgName ?? '';
    const prodlineText = context?.prodlineName ?? '';

    // 1. Mfg - selectedmfg with textcontrol (read-only)
    controls.push(
        createMfgControl('Mfg', 'Mfg', DisplayControlEnums.EditTextControl, 1, {
            disabled: true,
            Value: mfgText,
            DefaultAPValue: mfgText,
        })
    );

    // 2. For Edit MfgEqType: prodline - selectedline with textcontrol (read-only)
    if (label === 'MfgEqType') {
        controls.push(
            createMfgControl('SelectedProdline', 'Prodline', DisplayControlEnums.EditTextControl, 2, {
                disabled: true,
                Value: prodlineText,
                DefaultAPValue: prodlineText,
            })
        );
    }

    // 3. Merged options for the editable combo
    const optionsMap = new Map<string, string>();
    currentItems.forEach((item) => {
        const val = item.trim();
        if (val) optionsMap.set(val, val);
    });
    availableOptions.forEach((opt) => {
        const val = opt.value.trim();
        if (val && !optionsMap.has(val)) optionsMap.set(val, opt.label || val);
    });

    const combinedOptions = Array.from(optionsMap.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, labelText]) => ({ value, label: labelText }));

    const initial = initialValue ?? (currentItems.length > 0 ? currentItems[0] : '');

    // 4. The editable combo control itself
    controls.push(
        createMfgControl(label, label, DisplayControlEnums.EditComboControl, controls.length + 1, {
            allowCustom: true,
            Options: combinedOptions,
            Value: initial,
            DefaultAPValue: initial,
        })
    );

    return controls;
}

/**
 * Creates profile JSON string for prefilling SettingsLibForm.
 */
export function buildMfgProfileString(
    command: MfgCommand,
    currentRecord?: IMfgRecord | null,
    relationInitialValue?: string,
    context?: IRelationControlContext
): string {
    if (command === 'edit-mfg' || command === 'delete-mfg') {
        if (!currentRecord) return '';
        return JSON.stringify([{
            Acronym: currentRecord.mfgkey,
            MfgName: currentRecord.mfgname,
            Address: currentRecord.address ?? '',
            Website: currentRecord.website ?? '',
        }]);
    }

    const mfgText = context?.mfgName || currentRecord?.mfgname || currentRecord?.mfgkey || '';
    const prodlineText = context?.prodlineName || '';
    const val = relationInitialValue ?? '';

    if (command === 'edit-prodline') {
        return JSON.stringify([{
            Mfg: mfgText,
            Prodline: val,
            Value: val,
        }]);
    }
    if (command === 'edit-mfgeqtype') {
        return JSON.stringify([{
            Mfg: mfgText,
            SelectedProdline: prodlineText,
            MfgEqType: val,
            Value: val,
        }]);
    }
    if (command === 'edit-mfgrelation') {
        return JSON.stringify([{
            Mfg: mfgText,
            MfgRelation: val,
            Value: val,
        }]);
    }
    return '';
}

/**
 * Parses profile JSON string emitted by SettingsLibForm on save.
 */
export function parseProfileString(profileData: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(profileData) as any;
        if (parsed?.TableSections) {
            let mergedData: Record<string, unknown> = {};
            for (const secKey of Object.keys(parsed.TableSections)) {
                mergedData = { ...mergedData, ...parsed.TableSections[secKey] };
            }
            return mergedData;
        }
        if (Array.isArray(parsed) && parsed[0]) {
            return parsed[0] as Record<string, unknown>;
        }
        if (typeof parsed === 'object' && parsed !== null) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // ignore parse error
    }
    return {};
}

/**
 * Safely extracts field string value.
 */
export function getFieldValue(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'object' && value && 'value' in value) {
        return String((value as { value?: unknown }).value ?? '').trim();
    }
    return String(value).trim();
}

/**
 * Safely extracts a field value from a values map by matching fieldName,
 * case-insensitively or matching composite keys like Group_FieldName_index_...
 */
export function extractFieldValue(values: Record<string, unknown>, fieldName: string): string | undefined {
    if (!values || typeof values !== 'object') return undefined;
    if (values[fieldName] !== undefined) return getFieldValue(values[fieldName]);
    const lower = fieldName.toLowerCase();
    for (const key of Object.keys(values)) {
        const kLower = key.toLowerCase();
        if (
            kLower === lower ||
            kLower.includes(`_${lower}_`) ||
            kLower.startsWith(`${lower}_`) ||
            kLower.endsWith(`_${lower}`)
        ) {
            return getFieldValue(values[key]);
        }
    }
    return undefined;
}

/**
 * Updates a DOM input's value and dispatches events so React / libform state syncs without focus loss.
 */
export function setDomInputValue(input: HTMLInputElement, value: string): void {
    if (input.value === value) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
        nativeSetter.call(input, value);
    } else {
        input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}
