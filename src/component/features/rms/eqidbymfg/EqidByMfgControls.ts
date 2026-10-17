import { DisplayControlEnums } from '../../../shared/alldefaultprops/basic/DefaultPropsFormContainer';
import type { IControl } from '../../../shared/allinterface/settingsform/ISettingsLibForm';
import type { IMfgRecord, IEqidDoc } from '../../../shared/context/allinterface/IRms';

export function createReadOnlyControl(
    name: string,
    label: string,
    displayControl: string,
    sortOrder: number,
    extra?: Partial<IControl>
): IControl {
    return {
        CanChange: 0,
        IsRequired: 0,
        GroupName: extra?.GroupName ?? 'Properties',
        GroupNameDesc: extra?.GroupNameDesc ?? 'Properties',
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
        DisplayGroupControl: extra?.DisplayGroupControl ?? 'Properties',
        DisplayControl: displayControl,
        ChangeEvent: '',
        Secured: false,
        IsNZ: false,
        EntID: name,
        RecID: name,
        LastUpdated: '',
        EntityName: extra?.EntityName ?? 'Properties',
        Name: name,
        disabled: true,
        IsReadOnly: true,
        ...extra,
    };
}

/**
 * Builds read-only controls for Manufacturer node
 */
export function buildMfgReadOnlyControls(
    mfgName: string,
    acronym: string,
    mfgRecord?: IMfgRecord | null
): IControl[] {
    const website = mfgRecord?.website ?? '';
    const address = mfgRecord?.address ?? '';

    return [
        createReadOnlyControl('Acronym', 'Acronym', DisplayControlEnums.EditTextControl, 1, {
            Value: acronym,
            DefaultAPValue: acronym,
            DisplayGroupControl: 'Manufacturer',
            GroupName: 'Manufacturer',
        }),
        createReadOnlyControl('MfgName', 'Manufacturer Name', DisplayControlEnums.EditTextControl, 2, {
            Value: mfgName,
            DefaultAPValue: mfgName,
            DisplayGroupControl: 'Manufacturer',
            GroupName: 'Manufacturer',
        }),
        createReadOnlyControl('Website', 'Website', DisplayControlEnums.EditTextControl, 3, {
            Value: website,
            DefaultAPValue: website,
            DisplayGroupControl: 'Manufacturer',
            GroupName: 'Manufacturer',
        }),
        createReadOnlyControl('Address', 'Address', DisplayControlEnums.EditTextControl, 4, {
            Value: address,
            DefaultAPValue: address,
            DisplayGroupControl: 'Manufacturer',
            GroupName: 'Manufacturer',
        }),
    ];
}

/**
 * Builds read-only controls for Product Line node
 */
export function buildProdlineReadOnlyControls(
    mfgName: string,
    prodline: string,
    totalEqtypes: number,
    totalEqids: number
): IControl[] {
    return [
        createReadOnlyControl('Manufacturer', 'Manufacturer', DisplayControlEnums.EditTextControl, 1, {
            Value: mfgName,
            DefaultAPValue: mfgName,
            DisplayGroupControl: 'ProductLine',
            GroupName: 'ProductLine',
        }),
        createReadOnlyControl('ProdLine', 'Product Line', DisplayControlEnums.EditTextControl, 2, {
            Value: prodline,
            DefaultAPValue: prodline,
            DisplayGroupControl: 'ProductLine',
            GroupName: 'ProductLine',
        }),
        createReadOnlyControl('TotalEqTypes', 'Equipment Types Count', DisplayControlEnums.EditTextControl, 3, {
            Value: String(totalEqtypes),
            DefaultAPValue: String(totalEqtypes),
            DisplayGroupControl: 'ProductLine',
            GroupName: 'ProductLine',
        }),
        createReadOnlyControl('TotalEQIDs', 'EQID Count', DisplayControlEnums.EditTextControl, 4, {
            Value: String(totalEqids),
            DefaultAPValue: String(totalEqids),
            DisplayGroupControl: 'ProductLine',
            GroupName: 'ProductLine',
        }),
    ];
}

/**
 * Builds read-only controls for Equipment Type node
 */
export function buildEqtypeReadOnlyControls(
    mfgName: string,
    prodline: string,
    eqtype: string,
    totalEqids: number
): IControl[] {
    return [
        createReadOnlyControl('Manufacturer', 'Manufacturer', DisplayControlEnums.EditTextControl, 1, {
            Value: mfgName,
            DefaultAPValue: mfgName,
            DisplayGroupControl: 'EquipmentType',
            GroupName: 'EquipmentType',
        }),
        createReadOnlyControl('ProdLine', 'Product Line', DisplayControlEnums.EditTextControl, 2, {
            Value: prodline,
            DefaultAPValue: prodline,
            DisplayGroupControl: 'EquipmentType',
            GroupName: 'EquipmentType',
        }),
        createReadOnlyControl('EqType', 'Equipment Type', DisplayControlEnums.EditTextControl, 3, {
            Value: eqtype,
            DefaultAPValue: eqtype,
            DisplayGroupControl: 'EquipmentType',
            GroupName: 'EquipmentType',
        }),
        createReadOnlyControl('TotalEQIDs', 'EQID Count', DisplayControlEnums.EditTextControl, 4, {
            Value: String(totalEqids),
            DefaultAPValue: String(totalEqids),
            DisplayGroupControl: 'EquipmentType',
            GroupName: 'EquipmentType',
        }),
    ];
}

/**
 * Builds read-only controls for EQID node
 */
export function buildEqidReadOnlyControls(eqidRecord: IEqidDoc | any): IControl[] {
    const eqid = String(eqidRecord?.EQID || eqidRecord?.eqid || eqidRecord?.id || '');
    const mfg = String(eqidRecord?.Manufacturer || eqidRecord?.mfg || '');
    const acronym = String(eqidRecord?.Acronym || '');
    const prodline = String(eqidRecord?.ProdLine || eqidRecord?.prodline || eqidRecord?.ProductLine || '');
    const eqtype = String(eqidRecord?.EqType || eqidRecord?.eqtype || eqidRecord?.EquipmentType || eqidRecord?.mfgeqtype || '');
    const prodno = String(eqidRecord?.ProdNo || eqidRecord?.prodno || '');
    const subtitle = String(eqidRecord?.SubTitle || eqidRecord?.subtitle || '');
    const description = String(eqidRecord?.Description || eqidRecord?.description || '');
    const height = String(eqidRecord?.Height ?? eqidRecord?.height ?? '');
    const width = String(eqidRecord?.Width ?? eqidRecord?.width ?? '');
    const depth = String(eqidRecord?.Depth ?? eqidRecord?.depth ?? '');
    const weight = String(eqidRecord?.Weight ?? eqidRecord?.weight ?? '');
    const watts = String(eqidRecord?.Watts ?? eqidRecord?.watts ?? '');
    const copperPorts = String(eqidRecord?.CopperPorts ?? eqidRecord?.copperports ?? '');
    const fiberPorts = String(eqidRecord?.FiberPorts ?? eqidRecord?.fiberports ?? '');
    const slots = String(eqidRecord?.Slots ?? eqidRecord?.slots ?? '');

    return [
        createReadOnlyControl('EQID', 'EQID', DisplayControlEnums.EditTextControl, 1, {
            Value: eqid,
            DefaultAPValue: eqid,
            DisplayGroupControl: 'EQID',
            GroupName: 'EQID',
        }),
        createReadOnlyControl('ProdNo', 'Product Number (Part #)', DisplayControlEnums.EditTextControl, 2, {
            Value: prodno,
            DefaultAPValue: prodno,
            DisplayGroupControl: 'EQID',
            GroupName: 'EQID',
        }),
        createReadOnlyControl('Manufacturer', 'Manufacturer', DisplayControlEnums.EditTextControl, 3, {
            Value: mfg,
            DefaultAPValue: mfg,
            DisplayGroupControl: 'EQID',
            GroupName: 'EQID',
        }),
        createReadOnlyControl('Acronym', 'Acronym', DisplayControlEnums.EditTextControl, 4, {
            Value: acronym,
            DefaultAPValue: acronym,
            DisplayGroupControl: 'EQID',
            GroupName: 'EQID',
        }),
        createReadOnlyControl('ProdLine', 'Product Line', DisplayControlEnums.EditTextControl, 5, {
            Value: prodline,
            DefaultAPValue: prodline,
            DisplayGroupControl: 'EQID',
            GroupName: 'EQID',
        }),
        createReadOnlyControl('EqType', 'Equipment Type', DisplayControlEnums.EditTextControl, 6, {
            Value: eqtype,
            DefaultAPValue: eqtype,
            DisplayGroupControl: 'EQID',
            GroupName: 'EQID',
        }),
        createReadOnlyControl('SubTitle', 'Sub Title', DisplayControlEnums.EditTextControl, 7, {
            Value: subtitle,
            DefaultAPValue: subtitle,
            DisplayGroupControl: 'EQID',
            GroupName: 'EQID',
        }),
        createReadOnlyControl('Description', 'Description', DisplayControlEnums.EditTextControl, 8, {
            Value: description,
            DefaultAPValue: description,
            DisplayGroupControl: 'EQID',
            GroupName: 'EQID',
        }),
        createReadOnlyControl('Height', 'Height (RU / In)', DisplayControlEnums.EditTextControl, 9, {
            Value: height,
            DefaultAPValue: height,
            DisplayGroupControl: 'Specifications',
            GroupName: 'Specifications',
        }),
        createReadOnlyControl('Width', 'Width', DisplayControlEnums.EditTextControl, 10, {
            Value: width,
            DefaultAPValue: width,
            DisplayGroupControl: 'Specifications',
            GroupName: 'Specifications',
        }),
        createReadOnlyControl('Depth', 'Depth', DisplayControlEnums.EditTextControl, 11, {
            Value: depth,
            DefaultAPValue: depth,
            DisplayGroupControl: 'Specifications',
            GroupName: 'Specifications',
        }),
        createReadOnlyControl('Weight', 'Weight', DisplayControlEnums.EditTextControl, 12, {
            Value: weight,
            DefaultAPValue: weight,
            DisplayGroupControl: 'Specifications',
            GroupName: 'Specifications',
        }),
        createReadOnlyControl('Watts', 'Watts', DisplayControlEnums.EditTextControl, 13, {
            Value: watts,
            DefaultAPValue: watts,
            DisplayGroupControl: 'Specifications',
            GroupName: 'Specifications',
        }),
        createReadOnlyControl('CopperPorts', 'Copper Ports', DisplayControlEnums.EditTextControl, 14, {
            Value: copperPorts,
            DefaultAPValue: copperPorts,
            DisplayGroupControl: 'Ports & Slots',
            GroupName: 'Ports & Slots',
        }),
        createReadOnlyControl('FiberPorts', 'Fiber Ports', DisplayControlEnums.EditTextControl, 15, {
            Value: fiberPorts,
            DefaultAPValue: fiberPorts,
            DisplayGroupControl: 'Ports & Slots',
            GroupName: 'Ports & Slots',
        }),
        createReadOnlyControl('Slots', 'Slots', DisplayControlEnums.EditTextControl, 16, {
            Value: slots,
            DefaultAPValue: slots,
            DisplayGroupControl: 'Ports & Slots',
            GroupName: 'Ports & Slots',
        }),
    ];
}

/**
 * Builds read-only controls for ShapeStyle node
 */
export function buildShapeStyleReadOnlyControls(shapeStyleData: {
    eqid: string;
    styleName: string;
    styleId?: string;
    description?: string;
    raw?: any;
}): IControl[] {
    const eqid = String(shapeStyleData.eqid || '');
    const styleName = String(shapeStyleData.styleName || '');
    const styleId = String(shapeStyleData.styleId || '');
    const description = String(shapeStyleData.description || styleName);
    const orientation = styleId.includes(':V') ? 'Vertical' : styleId.includes(':H') ? 'Horizontal' : 'Standard';

    return [
        createReadOnlyControl('EQID', 'Parent EQID', DisplayControlEnums.EditTextControl, 1, {
            Value: eqid,
            DefaultAPValue: eqid,
            DisplayGroupControl: 'ShapeStyle',
            GroupName: 'ShapeStyle',
        }),
        createReadOnlyControl('ShapeName', 'Shape Style', DisplayControlEnums.EditTextControl, 2, {
            Value: styleName,
            DefaultAPValue: styleName,
            DisplayGroupControl: 'ShapeStyle',
            GroupName: 'ShapeStyle',
        }),
        createReadOnlyControl('ShapeID', 'Shape ID', DisplayControlEnums.EditTextControl, 3, {
            Value: styleId,
            DefaultAPValue: styleId,
            DisplayGroupControl: 'ShapeStyle',
            GroupName: 'ShapeStyle',
        }),
        createReadOnlyControl('Description', 'Description', DisplayControlEnums.EditTextControl, 4, {
            Value: description,
            DefaultAPValue: description,
            DisplayGroupControl: 'ShapeStyle',
            GroupName: 'ShapeStyle',
        }),
        createReadOnlyControl('Orientation', 'Orientation', DisplayControlEnums.EditTextControl, 5, {
            Value: orientation,
            DefaultAPValue: orientation,
            DisplayGroupControl: 'ShapeStyle',
            GroupName: 'ShapeStyle',
        }),
    ];
}

/**
 * Builds read-only controls for Root (Manufacturers) node
 */
export function buildRootReadOnlyControls(totalMfg: number): IControl[] {
    return [
        createReadOnlyControl('Node', 'Node', DisplayControlEnums.EditTextControl, 1, {
            Value: 'Manufacturers',
            DefaultAPValue: 'Manufacturers',
        }),
        createReadOnlyControl('TotalManufacturers', 'Total Manufacturers', DisplayControlEnums.EditTextControl, 2, {
            Value: String(totalMfg),
            DefaultAPValue: String(totalMfg),
        }),
    ];
}

