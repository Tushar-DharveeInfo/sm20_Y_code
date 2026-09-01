import type { IBusinessDoc, IContactDoc } from "../../allinterface/IDatasets";

// Distinct combo values from cached businesses/contacts datasets.
const FILTER_ANY = "ANY"; // First combo option; omitted from saved filter json.

function FnNormalizeDistinctValue(value: unknown): string {
    if (value === undefined || value === null) {
        return "";
    }
    if (typeof value === "boolean") {
        return value ? "true" : "false";
    }
    return String(value).trim();
}

function FnSplitTagValues(value: unknown): string[] {
    return FnNormalizeDistinctValue(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

// Unique sorted values from a cached dataset field (optional comma-split for tags).
function FnGetDistinctValues(
    records: Array<Record<string, unknown>>,
    field: string,
    splitTags = false
): string[] {
    const unique = new Map<string, string>();
    for (const record of records) {
        const parts = splitTags
            ? FnSplitTagValues(record[field])
            : [FnNormalizeDistinctValue(record[field])];
        for (const part of parts) {
            if (!part) continue;
            const key = part.toLowerCase();
            if (!unique.has(key)) {
                unique.set(key, part);
            }
        }
    }
    return [...unique.values()].sort((a, b) => a.localeCompare(b));
}

// Prepend ANY so "no filter" is always the first combo item.
function FnWithAnyOption(values: string[]): Array<{ label: string; value: string }> {
    return [
        { label: FILTER_ANY, value: FILTER_ANY },
        ...values.map((value) => ({ label: value, value })),
    ];
}

function asRows<T>(records: T[]): Array<Record<string, unknown>> {
    return records as unknown as Array<Record<string, unknown>>;
}

function FnGetDistinctBusinessStatus(businesses: IBusinessDoc[]) {
    return FnGetDistinctValues(asRows(businesses), "status");
}

function FnGetDistinctBusinessType(businesses: IBusinessDoc[]) {
    return FnGetDistinctValues(asRows(businesses), "btype");
}

function FnGetDistinctBusinessTag(businesses: IBusinessDoc[]) {
    return FnGetDistinctValues(asRows(businesses), "tag", true);
}

function FnGetDistinctBusinessSalesExec(businesses: IBusinessDoc[]) {
    return FnGetDistinctValues(asRows(businesses), "salesexec");
}

function FnGetDistinctBusinessCountry(businesses: IBusinessDoc[]) {
    return FnGetDistinctValues(asRows(businesses), "country");
}

function FnGetDistinctBusinessState(businesses: IBusinessDoc[]) {
    return FnGetDistinctValues(asRows(businesses), "state");
}

function FnGetDistinctContactType(contacts: IContactDoc[]) {
    return FnGetDistinctValues(asRows(contacts), "contacttype");
}

function FnGetDistinctContactStatus(contacts: IContactDoc[]) {
    return FnGetDistinctValues(asRows(contacts), "status");
}

function FnGetDistinctContactTag(contacts: IContactDoc[]) {
    return FnGetDistinctValues(asRows(contacts), "ctag", true);
}

export {
    FILTER_ANY,
    FnGetDistinctBusinessCountry,
    FnGetDistinctBusinessSalesExec,
    FnGetDistinctBusinessState,
    FnGetDistinctBusinessStatus,
    FnGetDistinctBusinessTag,
    FnGetDistinctBusinessType,
    FnGetDistinctContactStatus,
    FnGetDistinctContactTag,
    FnGetDistinctContactType,
    FnGetDistinctValues,
    FnWithAnyOption,
};
