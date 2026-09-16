import type { IMenuItem } from "../../allinterface/menu/IMainMenu";
import type { IDataset } from "../../allinterface/sidebar/IPropertyFormContainer";
import type { ITreeNode } from "../../allinterface/tree/ITreeControl";
import { DisplayControlEnums } from "../../alldefaultprops/basic/DefaultPropsFormContainer";
import getTableVsPropertySample from "../../../../smsampledata/sidebar/GetTableVsPropertySample.json";

/*
* Entity tables returned by EM.GetTableVsProperty for sample node.
* Source: get_table_vs_property API `data` array.
*/
const samplePropertyEntityTables = getTableVsPropertySample.data;

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
    }
): IPropertyFormPackage => {
    const entityName = options?.entityName || "Business";
    const tableName = options?.tableName || `_${entityName}`;
    const tableLabel = options?.tableLabel || entityName;
    const keys = Object.keys(record);

    const properties = keys.map((key, index) => {
        const val = record[key];
        const lowerKey = key.toLowerCase();
        const isIdField = lowerKey === "bid" || lowerKey === "cid";
        const isAuditDateField = lowerKey === "datecreated" || lowerKey === "dateupdated";
        const isBoolean =
            typeof val === "boolean" ||
            lowerKey === "verified" ||
            lowerKey === "monitor" ||
            (typeof val === "string" && (val.toLowerCase() === "true" || val.toLowerCase() === "false"));
        const isDateField =
            lowerKey.startsWith("date") ||
            lowerKey.endsWith("date") ||
            lowerKey.endsWith("updated") ||
            lowerKey.includes("date");

        return {
            TableName: tableName,
            PName: key,
            Description: key,
            MaxLength: null,
            SortOrder: index + 1,
            RequiredToAddRecord: false,
            RequiredToUpdateRecord: false,
            DisplayControl: isBoolean
                ? DisplayControlEnums.TrueFalseControl
                : isDateField
                ? DisplayControlEnums.DateControl
                : DisplayControlEnums.EditTextControl,
            Disabled: isIdField || isAuditDateField,
            disabled: isIdField || isAuditDateField,
            InputMask: "",
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
    monitor: Boolean(node.IsAuthorized ?? node.monitor ?? node.verified ?? false),
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
    node: ITreeNode
): IPropertyFormPackage => {
    const entityName = String(node.NodeEntityname || node.NodeType || "Business");
    const record = resolvePropertyRecordFromSelectedNode(node);
    return buildEditTextPropertyFormFromRecord(record, {
        entityName,
        tableName: `_${entityName}`,
        tableLabel: entityName,
    });
};

export {
    samplePropertyEntityTables,
    samplePropertyKebabMenuResponse,
    sampleBusinessPropertyKebabMenuResponse,
    sampleContactPropertyKebabMenuResponse,
    samplePropertyKebabMenuData,
    buildEditTextPropertyFormFromRecord,
    buildPropertyFormDataFromSelectedNode,
    resolvePropertyRecordFromSelectedNode,
};
export type { IPropertyFormPackage };
