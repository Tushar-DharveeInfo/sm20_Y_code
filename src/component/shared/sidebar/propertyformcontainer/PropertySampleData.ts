import type { IMenuItem } from "../../allinterface/menu/IMainMenu";
import type { IDataset } from "../../allinterface/sidebar/IPropertyFormContainer";
import type { ITreeNode } from "../../allinterface/tree/ITreeControl";
import type { IBusiness } from "../../allinterface/tree/IBusiness";
import type { IContact } from "../../allinterface/tree/IContact";
import { sampleBusinesses } from "../../../features/allcommon/FnBusinessesSampleData";
import { sampleContacts } from "../../../features/allcommon/FnContactsSampleData";
import getTableVsPropertySample from "../../../../sampledata/sidebar/GetTableVsPropertySample.json";

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
    if (key === "bname") return "Company Name";
    if (key === "btype") return "Business Type";
    if (key === "salesExec") return "Sales Executive";
    if (key === "mmFinYear") return "Financial Year Month";
    if (key === "daysNoticePeriod") return "Notice Period (Days)";
    if (key === "ctype") return "Contact Type";
    if (key === "phone1") return "Phone 1";
    if (key === "phone2") return "Phone 2";
    if (key === "address_street") return "Street Address";
    if (key === "address_city") return "City";
    if (key === "address_state") return "State";
    if (key === "address_zip") return "Zip";
    if (key === "address_country") return "Country";
    if (key === "dateCreated") return "Date Created";
    if (key === "dateUpdated") return "Date Updated";
    if (key === "relatedBids") return "Related Bids";
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
    if (typeof value === "boolean" || typeof value === "number") {
        return value;
    }
    return String(value);
};

/**
 * Builds property schema + values from a flat key/value record.
 * Every field uses DisplayControl = EditTextControl.
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
    const keys = Object.keys(record).filter((k) => k.toLowerCase() !== "cid");

    const properties = keys.map((key, index) => ({
        TableName: tableName,
        PName: key,
        Description: key,
        MaxLength: null,
        SortOrder: index + 1,
        RequiredToAddRecord: false,
        RequiredToUpdateRecord: false,
        DisplayControl: "EditTextControl",
        InputMask: "",
        PropertyLabel: toPropertyLabel(key),
        NullNotAllowed: false,
    }));

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
    btype: String(node.Type ?? node.btype ?? ""),
    status: String(node.Description ?? node.status ?? ""),
    verified: Boolean(node.IsAuthorized ?? node.verified ?? false),
    salesExec: String(node.salesExec ?? ""),
    country: String(node.country ?? ""),
    state: String(node.state ?? ""),
    daysNoticePeriod: Number(node.daysNoticePeriod ?? 0),
    mmFinYear: Number(node.mmFinYear ?? 0),
    relatedBids: String(node.relatedBids ?? ""),
    dateCreated: String(node.dateCreated ?? ""),
    dateUpdated: String(node.dateUpdated ?? ""),
});

const resolveContactFallback = (node: ITreeNode, entId: string): Record<string, unknown> => ({
    bid: String(node.bid ?? node.parentEntID ?? ""),
    cid: entId,
    ctype: String(node.Type ?? node.ctype ?? "contact"),
    status: String(node.Description ?? node.status ?? ""),
    verified: Boolean(node.IsAuthorized ?? node.verified ?? false),
    contact: String(node.Name ?? node.contact ?? ""),
    email: String(node.email ?? ""),
    phone1: String(node.phone1 ?? ""),
    phone2: String(node.phone2 ?? ""),
    address_street: String(node.address_street ?? ""),
    address_city: String(node.address_city ?? ""),
    address_state: String(node.address_state ?? ""),
    address_zip: String(node.address_zip ?? ""),
    address_country: String(node.address_country ?? ""),
    dateCreated: String(node.dateCreated ?? ""),
    dateUpdated: String(node.dateUpdated ?? ""),
});

/*Resolves a flat property record from the selected tree node (Business / Contact sample JSON). */
const resolvePropertyRecordFromSelectedNode = (
    node: ITreeNode
): Record<string, unknown> => {
    const entityName = String(node.NodeEntityname || node.NodeType || "").toLowerCase();
    const entId = String(node.NodeEntID || node.EntID || node.key || "");

    if (entityName === "business") {
        const businessId = String(node.bid || node.NodeEntID || node.EntID || node.key || "").toLowerCase();
        const business: IBusiness | undefined = sampleBusinesses.find(
            (item) => item.bid?.toLowerCase() === businessId || item.bname?.toLowerCase() === (node.Name ?? node.bname ?? "").toLowerCase()
        );
        if (business) {
            return { ...business };
        }
        return resolveBusinessFallback(node, entId);
    }

    if (entityName === "contact") {
        const contactId = String(node.cid || node.NodeEntID || node.EntID || node.key || "").toLowerCase();
        const contact: IContact | undefined = sampleContacts.find(
            (item) => item.cid?.toLowerCase() === contactId || item.contact?.toLowerCase() === (node.Name ?? node.contact ?? "").toLowerCase()
        );
        if (contact) {
            return { ...contact };
        }
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
