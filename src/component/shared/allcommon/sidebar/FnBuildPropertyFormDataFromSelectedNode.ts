import type { ITreeNode } from "../../allinterface/tree/ITreeControl";
import { FnIsRootBusinessNode } from "../tree/FnIsRootBusinessNode";
import { DisplayControlEnums } from "../../alldefaultprops/basic/DefaultPropsFormContainer";

type IDataset = Record<string, Record<string, unknown>[]>;

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
            options = [
                { label: "Consultant", value: "consultant" },
                { label: "End User", value: "enduser" },
                { label: "Partner", value: "partner" },
                { label: "Vendor", value: "vendor" },
            ];
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

/* Resolves a flat property record from the selected tree node. */
const resolvePropertyRecordFromSelectedNode = (
    node: ITreeNode
): Record<string, unknown> => {
    const entityName = String(node.NodeEntityname || node.NodeType || "").toLowerCase();
    const entId = String(node.NodeEntID || node.EntID || node.key || "");

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
): IPropertyFormPackage | undefined => {
    if (FnIsRootBusinessNode(node)) {
        return undefined;
    }
    const entityName = String(node.NodeEntityname || node.NodeType || "Business");
    const record = resolvePropertyRecordFromSelectedNode(node);
    return buildEditTextPropertyFormFromRecord(record, {
        entityName,
        tableName: `_${entityName}`,
        tableLabel: entityName,
    });
};

export {
    buildEditTextPropertyFormFromRecord,
    buildPropertyFormDataFromSelectedNode,
    resolvePropertyRecordFromSelectedNode,
};
export type { IPropertyFormPackage };
