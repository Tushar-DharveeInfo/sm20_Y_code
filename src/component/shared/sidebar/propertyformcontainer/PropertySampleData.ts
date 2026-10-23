import { FnGetUniqueBusinessTypeOptions } from "../../allcommon/sidebar/FnBuildPropertyFormDataFromSelectedNode";
import type { IMenuItem } from "../../allinterface/menu/IMainMenu";
import type { IDataset } from "../../allinterface/sidebar/IPropertyFormContainer";
import type { ITreeNode } from "../../allinterface/tree/ITreeControl";
import { DisplayControlEnums } from "../../alldefaultprops/basic/DefaultPropsFormContainer";



/* Property kebab submenu (Sidebar PROPERTY.GetKebabMenu). */
const samplePropertyKebabMenu: IMenuItem[] = []

const samplePropertyKebabMenuResponse = {
    kebabJson: JSON.stringify({
        KebabMenu: samplePropertyKebabMenu,
    }),
};

/*Property kebab submenu for Business nodes (matches EditText form table `_Business`). */
const sampleBusinessPropertyKebabMenuResponse = {
    kebabJson: JSON.stringify({
        KebabMenu: [
            {
                ID: 1,
                Name: "_Business",
                Label: "Business",
                Description: "Business properties",
                SortOrder: 1,
                TotalCount: 1,
            },
        ],
    }),
};

/*Property kebab submenu for Contact nodes (matches EditText form table `_Contact`). */
const sampleContactPropertyKebabMenuResponse = {
    kebabJson: JSON.stringify({
        KebabMenu: [
            {
                ID: 1,
                Name: "_Contact",
                Label: "Contact",
                Description: "Contact properties",
                SortOrder: 1,
                TotalCount: 1,
            },
        ],
    }),
};

/* Property kebab submenu for EQID. */
const sampleEqidPropertyKebabMenuResponse = {
    kebabJson: JSON.stringify({
        KebabMenu: [
            {
                ID: 1,
                Name: "property",
                Label: "Properties",
                Tooltip: "Hardware Properties",
                Description: "Hardware Properties",
                SortOrder: 1,
                TotalCount: 8,
            },
            {
                ID: 2,
                Name: "shapeStyles",
                Label: "Shape Styles",
                Tooltip: "Hardware Shapes",
                Description: "Hardware Shapes",
                SortOrder: 2,
                TotalCount: 8,
            },
            {
                ID: 3,
                Name: "powerPorts",
                Label: "Power Ports",
                Tooltip: "Hardware Power Ports (Optional)",
                Description: "Hardware Power Ports (Optional)",
                SortOrder: 3,
                TotalCount: 8,
            },
            {
                ID: 4,
                Name: "networkPorts",
                Label: "Network Ports",
                Tooltip: "Hardware Network Ports (Optional)",
                Description: "Hardware Network Ports (Optional)",
                SortOrder: 4,
                TotalCount: 8,
            },
            {
                ID: 5,
                Name: "Slot",
                Label: "Slot",
                Tooltip: "Slot",
                Description: "Slot",
                SortOrder: 5,
                TotalCount: 8,
            },
            {
                ID: 6,
                Name: "InOutport",
                Label: "InOutport",
                Tooltip: "InOutport",
                Description: "InOutport",
                SortOrder: 6,
                TotalCount: 8,
            },
            {
                ID: 7,
                Name: "url",
                Label: "URL",
                Tooltip: "Hardware URLs",
                Description: "Hardware URLs",
                SortOrder: 7,
                TotalCount: 8,
            },
            {
                ID: 8,
                Name: "eqidrelation",
                Label: "EQIDRelation",
                Tooltip: "EQID Relation",
                Description: "EQID Relation",
                SortOrder: 8,
                TotalCount: 8,
            },
        ],
    }),
};

/*
* Property values returned by NODE.GetKebabMenuData / FnNodeGetKebabMenuData.
* Source: get_kebab_menu_data / NZNode_get_entity_vs_property_tab `data.propertyJson` (parsed).
*/
const samplePropertyKebabMenuData: IDataset = {
    _test: [
        {
            _test: "Chicago",
            Desc250: "Test test-Corporate Headquarters test",
            testType: "DC",
            Managed: true,
            Locked: false,
            TileX: 24,
            TileY: 24,
            Icon: null,
            TimeZone: "5",
            DateFormat: "mm/dd/yyyy",
            Measurement: "USA",
            Country: "-1",
            RackProvisionPower: 7000,
            DataCenterSize: -1,
            PowerPeakLoad: -1,
            DcmId: "-1",
            Secured: false,
            IsNZ: true,
            EntID: "DA4FE9AA-C701-4523-9406-4490DCD4C6E4",
            RecID: "BC3C9EBB-A0CB-42B1-9236-66300CDB8D35",
            LastUpdated: "2026-07-25T13:30:00",
            EntityName: "test",
        },
    ],
};

interface IPropertyFormPackage {
    entityTables: Record<string, unknown>[];
    kebabMenuData: IDataset;
}

const toPropertyLabel = (key: string): string => {
    const k = key.toLowerCase();
    if (k === "bid") return "BID";
    if (k === "cid") return "CID";
    if (k === "bname") return "Company Name";
    if (k === "btype") return "Business Type";
    if (k === "salesexec") return "Sales Executive";
    if (k === "mmfinyear") return "Financial Year Month";
    if (k === "daysnoticeperiod") return "Notice Period (Days)";
    if (k === "relatedbids") return "Related Bids";
    if (k === "contacttype" || k === "ctype") return "Contact Type";
    if (k === "cname" || k === "contact") return "Contact Name";
    if (k === "phone" || k === "phone1") return "Phone";
    if (k === "phone2") return "Phone 2";
    if (k === "address1" || k === "address_street") return "Address 1";
    if (k === "address2" || k === "address_line2") return "Address 2";
    if (k === "city" || k === "address_city") return "City";
    if (k === "state" || k === "address_state") return "State";
    if (k === "zip" || k === "address_zip") return "Zip";
    if (k === "country" || k === "address_country") return "Country";
    if (k === "datecreated") return "Date Created";
    if (k === "dateupdated") return "Date Updated";
    if (k === "monitor") return "Monitor";
    if (k === "monitorupdated") return "Monitor Updated";
    if (k === "verified") return "Verified";
    if (k === "donotcallme") return "Do Not Call Me";
    if (k === "removemefrommailinglist") return "Remove From Mailing List";
    if (k === "smsoptin") return "SMS Opt-in";
    if (k === "timezoneoffset") return "Time Zone Offset";
    if (k === "countrycode") return "Country Code";
    if (k === "amcexpirydate") return "AMC Expiry Date";
    if (k === "mcsexpirydate") return "MCS Expiry Date";
    if (k === "saasexpirydate") return "SaaS Expiry Date";
    if (k === "onpremexpirydate") return "On-Prem Expiry Date";
    if (k === "estimatedusers") return "Estimated Users";
    if (k === "estimatedracks") return "Estimated Racks";
    if (k === "estimateddcsites") return "Estimated DC Sites";
    return key
        .replace(/_/g, " ")
        .replace(/([A-Z])/g, " $1")
        .replace(/\s+/g, " ")
        .replace(/^./, (char) => char.toUpperCase())
        .trim();
};

const toFormValue = (value: unknown): string | number | boolean | null => {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        const lower = value.trim().toLowerCase();
        if (lower === "true") return true;
        if (lower === "false") return false;
    }
    if (typeof value === "number") {
        return value;
    }
    return String(value);
};

/**
 * Builds property schema + values from a flat key/value record.
 * Uses TrueFalseControl for boolean/verify fields, EditTextControl for others.
 * ID fields (bid, cid) are marked Disabled.
 */
const buildEditTextPropertyFormFromRecord = (
    record: Record<string, unknown>,
    options?: {
        tableName?: string;
        tableLabel?: string;
        entityName?: string;
        businessTypeOptions?: Array<{ label: string; value: string }>;
    }
): IPropertyFormPackage => {
    const entityName = options?.entityName || "Business";
    const tableName = options?.tableName || `_${entityName}`;
    const tableLabel = options?.tableLabel || entityName;
    const keys = Object.keys(record);

    const properties = keys.map((key, index) => {
        const val = record[key];
        const lowerKey = key.toLowerCase();

        const isReadonlyField =
            lowerKey === "bid" ||
            lowerKey === "cid" ||
            lowerKey === "email" ||
            lowerKey === "country" ||
            lowerKey === "address_country" ||
            lowerKey === "datecreated" ||
            lowerKey === "dateupdated";

        let displayControl: string = DisplayControlEnums.EditTextControl;
        let options: { label: string; value: string }[] | undefined = undefined;

        if (lowerKey === "btype") {
            displayControl = DisplayControlEnums.ComboBoxControl;
            options = options?.businessTypeOptions && options.businessTypeOptions.length > 0
                ? options.businessTypeOptions
                : FnGetUniqueBusinessTypeOptions();
        } else if (lowerKey === "status") {
            displayControl = DisplayControlEnums.ComboBoxControl;
            options = [
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
            ];
        } else if (lowerKey === "contacttype" || lowerKey === "ctype") {
            displayControl = DisplayControlEnums.ComboBoxControl;
            options = [
                { label: "Contact", value: "contact" },
                { label: "Representative", value: "representative" },
                { label: "Admin", value: "admin" },
                { label: "Billing", value: "billing" },
                { label: "Technical", value: "technical" },
            ];
        } else if (
            lowerKey === "verified" ||
            lowerKey === "monitor" ||
            lowerKey === "donotcallme" ||
            lowerKey === "removemefrommailinglist" ||
            lowerKey === "smsoptin" ||
            typeof val === "boolean"
        ) {
            displayControl = DisplayControlEnums.TrueFalseControl;
        } else if (lowerKey === "daysnoticeperiod" || lowerKey === "mmfinyear") {
            displayControl = DisplayControlEnums.SpinControl;
        } else if (
            lowerKey.startsWith("date") ||
            lowerKey.endsWith("date") ||
            lowerKey.endsWith("updated") ||
            lowerKey.includes("date")
        ) {
            displayControl = DisplayControlEnums.DateControl;
        }

        return {
            TableName: tableName,
            PName: key,
            Description: key,
            MaxLength: null,
            SortOrder: index + 1,
            RequiredToAddRecord: false,
            RequiredToUpdateRecord: false,
            DisplayControl: displayControl,
            Disabled: isReadonlyField,
            disabled: isReadonlyField,
            InputMask: "",
            options,
            PropertyLabel: toPropertyLabel(key),
            NullNotAllowed: false,
        };
    });

    const row: Record<string, unknown> = {
        EntID: String(record.cid ?? record.bid ?? record.EntID ?? ""),
        EntityName: entityName,
        LastUpdated: String(record.dateUpdated ?? new Date().toISOString()),
    };
    for (const key of keys) {
        row[key] = toFormValue(record[key]);
    }

    const entityTables: Record<string, unknown>[] = [
        {
            entityName,
            tableName,
            tableLabel,
            isOneToManyRelation: false,
            sortOrder: 1,
            properties: JSON.stringify(properties),
            entityPgClass: true,
            description: `${tableLabel} properties`,
            isRequired: false,
            requiredToAddRecord: false,
            requiredToUpdateRecord: false,
        },
    ];

    const kebabMenuData: IDataset = {
        [tableName]: [row],
    };

    return { entityTables, kebabMenuData };
};

const resolveBusinessFallback = (node: ITreeNode, entId: string): Record<string, unknown> => ({
    bid: entId,
    bname: String(node.Name ?? node.bname ?? ""),
    name: String(node.name ?? node.bname ?? node.Name ?? ""),
    btype: String(node.Type ?? node.btype ?? ""),
    status: String(node.Description ?? node.status ?? "Active"),
    verified: Boolean(node.IsAuthorized ?? node.verified ?? false),
    salesexec: String(node.salesexec ?? node.salesExec ?? ""),
    country: String(node.country ?? ""),
    state: String(node.state ?? ""),
    daysnoticeperiod: Number(node.daysnoticeperiod ?? node.daysNoticePeriod ?? 0),
    mmfinyear: Number(node.mmfinyear ?? node.mmFinYear ?? 0),
    relatedbids: node.relatedbids ?? node.relatedBids ?? [],
    datecreated: String(node.datecreated ?? node.dateCreated ?? ""),
    dateupdated: String(node.dateupdated ?? node.dateUpdated ?? ""),
});

const resolveContactFallback = (node: ITreeNode, entId: string): Record<string, unknown> => ({
    bid: String(node.bid ?? node.parentEntID ?? ""),
    cid: entId,
    contacttype: String(node.Type ?? node.contacttype ?? node.ctype ?? "contact"),
    status: String(node.Description ?? node.status ?? "Active"),
    verified: Boolean(node.IsAuthorized ?? node.verified ?? node.monitor ?? false),
    cname: String(node.Name ?? node.cname ?? node.contact ?? ""),
    email: String(node.email ?? ""),
    phone: String(node.phone ?? node.phone1 ?? ""),
    address1: String(node.address1 ?? node.address_street ?? ""),
    city: String(node.city ?? node.address_city ?? ""),
    state: String(node.state ?? node.address_state ?? ""),
    zip: String(node.zip ?? node.address_zip ?? ""),
    country: String(node.country ?? node.address_country ?? ""),
    datecreated: String(node.datecreated ?? node.dateCreated ?? ""),
    dateupdated: String(node.dateupdated ?? node.dateUpdated ?? ""),
});

/*Resolves a flat property record from the selected tree node (Business / Contact sample JSON). */
const resolvePropertyRecordFromSelectedNode = (
    node: ITreeNode
): Record<string, unknown> => {
    const entityName = String(node.NodeEntityname || node.NodeType || "").toLowerCase();
    const entId = String(node.NodeEntID || node.EntID || node.key || "");

    if (entityName === "business") {
        return resolveBusinessFallback(node, entId);
    }

    if (entityName === "contact") {
        return resolveContactFallback(node, entId);
    }

    return resolveBusinessFallback(node, entId);
};

/**
 * Builds static EditTextControl property form package for the selected node.
 */
const buildPropertyFormDataFromSelectedNode = (
    node: ITreeNode,
    businessTypeOptions?: Array<{ label: string; value: string }>
): IPropertyFormPackage => {
    const entityName = String(node.NodeEntityname || node.NodeType || "Business");
    const record = resolvePropertyRecordFromSelectedNode(node);
    return buildEditTextPropertyFormFromRecord(record, {
        entityName,
        tableName: `_${entityName}`,
        tableLabel: entityName,
        businessTypeOptions,
    });
};

export {
    samplePropertyKebabMenuResponse,
    sampleBusinessPropertyKebabMenuResponse,
    sampleContactPropertyKebabMenuResponse,
    sampleEqidPropertyKebabMenuResponse,
    samplePropertyKebabMenuData,
    buildEditTextPropertyFormFromRecord,
    buildPropertyFormDataFromSelectedNode,
    resolvePropertyRecordFromSelectedNode,
};
export type { IPropertyFormPackage };
