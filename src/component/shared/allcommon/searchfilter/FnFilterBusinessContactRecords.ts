// Apply explorer filter json to businesses/contacts; skip ANY and empty values.
import { IBusinessDoc, IContactDoc } from "../../allinterface/IDatasets";
import { IDCFilterControlValues } from "../../allinterface/searchfilter/IFilterFormContainer";
import { FILTER_ANY } from "./FnGetDistinctDatasetValues";

function isTruthyFlag(value: unknown): boolean {
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "true" || raw === "1";
}

function parseVerified(value: string | undefined): boolean | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    if (isTruthyFlag(value)) return true;
    const raw = String(value).trim().toLowerCase();
    if (raw === "false" || raw === "0") return false;
    return undefined;
}

function isAnyValue(value: unknown): boolean {
    return String(value ?? "").trim().toUpperCase() === FILTER_ANY;
}

function isAppliedValue(value: unknown): boolean {
    if (value === undefined || value === null || value === "") return false;
    if (typeof value === "boolean") return value === true;
    if (isAnyValue(value)) return false;
    return true;
}

function normalizeCountryKey(value: unknown): string {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) return "";
    const aliases: Record<string, string> = {
        usa: "usa",
        us: "usa",
        "united states": "usa",
        "united states of america": "usa",
        uk: "uk",
        gb: "uk",
        "united kingdom": "uk",
        "great britain": "uk",
        india: "india",
        australia: "australia",
        canada: "canada",
        singapore: "singapore",
    };
    return aliases[raw] ?? raw;
}

function normalizeStateKey(value: unknown): string {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) return "";
    const aliases: Record<string, string> = {
        ca: "california",
        california: "california",
        tx: "texas",
        texas: "texas",
        ny: "new york",
        "new york": "new york",
        fl: "florida",
        florida: "florida",
        eng: "england",
        england: "england",
        mh: "maharashtra",
        maharashtra: "maharashtra",
        vic: "victoria",
        victoria: "victoria",
        on: "ontario",
        ontario: "ontario",
    };
    return aliases[raw] ?? raw;
}

const KNOWN_FILTER_FIELDS = [
    "bname",
    "status",
    "verified",
    "country",
    "state",
    "daysnoticeperiod",
    "mmfinyear",
    "StartDate",
    "EndDate",
    "dateRange",
    "btype",
    "salesexec",
    "tag",
    "selectdatetype",
    "cverified",
    "contacttype",
    "cstatus",
    "ctags",
    "noticePeriod",
    "finYearMonth",
    "assignedTo",
    "contactType",
    "contactStatus",
    "contactVerified",
    "contactTag",
] as const;

// Map libform keys like "Filter Business_status_0" to the control name ("status").
export function normalizeFilterFieldName(key: string): string | null {
    const lowerKey = key.toLowerCase();
    const exact = (KNOWN_FILTER_FIELDS as readonly string[]).find(
        (field) => field.toLowerCase() === lowerKey
    );
    if (exact) {
        return exact;
    }
    const sorted = [...KNOWN_FILTER_FIELDS].sort((a, b) => b.length - a.length);
    for (const field of sorted) {
        const lowerField = field.toLowerCase();
        if (
            lowerKey.includes(`_${lowerField}_`) ||
            lowerKey.endsWith(`_${lowerField}`) ||
            key.includes(`_${field}_`) ||
            key.endsWith(`_${field}`)
        ) {
            return field;
        }
    }
    return null;
}

// Saved filter json: only keys whose value is not ANY / empty / unchecked.
export function getAppliedFilterJson(
    form: IDCFilterControlValues
): IDCFilterControlValues {
    const applied: IDCFilterControlValues = {};
    Object.entries(form).forEach(([key, value]) => {
        if (!isAppliedValue(value)) return;
        const field = normalizeFilterFieldName(key) ?? key;
        if (field === "verified" || field === "cverified") {
            if (!isTruthyFlag(value)) return;
            applied[field] = "true";
            return;
        }
        applied[field] = String(value);
    });
    return applied;
}

function quarterNumber(value: string): number | undefined {
    const upper = value.trim().toUpperCase();
    if (upper === "Q1") return 1;
    if (upper === "Q2") return 2;
    if (upper === "Q3") return 3;
    if (upper === "Q4") return 4;
    return undefined;
}

function recordQuarter(mmfinyear: number, datecreated: string): number | undefined {
    if (mmfinyear >= 1 && mmfinyear <= 4) {
        return mmfinyear;
    }
    if (mmfinyear >= 1 && mmfinyear <= 12) {
        return Math.ceil(mmfinyear / 3);
    }
    const created = new Date(datecreated);
    if (Number.isNaN(created.getTime())) {
        return undefined;
    }
    return Math.ceil((created.getUTCMonth() + 1) / 3);
}

// Map form fields onto business document properties.
export function buildBusinessRecordFilter(
    form: IDCFilterControlValues
): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (isAppliedValue(form.bname)) filter.bname = form.bname;
    if (isAppliedValue(form.status)) filter.status = form.status;
    if (isTruthyFlag(form.verified)) filter.verified = true;
    if (isAppliedValue(form.country)) filter.country = form.country;
    if (isAppliedValue(form.state)) filter.state = form.state;
    if (isAppliedValue(form.daysnoticeperiod)) filter.daysnoticeperiod = Number(form.daysnoticeperiod);
    if (isAppliedValue(form.noticePeriod)) filter.daysnoticeperiod = Number(form.noticePeriod);
    if (isAppliedValue(form.mmfinyear)) filter.mmfinyear = form.mmfinyear;
    if (isAppliedValue(form.btype)) filter.btype = form.btype;
    if (isAppliedValue(form.salesexec)) filter.salesexec = form.salesexec;
    if (isAppliedValue(form.assignedTo)) filter.salesexec = form.assignedTo;
    if (isAppliedValue(form.tag)) filter.tag = form.tag;
    return filter;
}

// Map form fields onto contact document properties.
export function buildContactRecordFilter(
    form: IDCFilterControlValues
): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    const contactType = form.contacttype ?? form.contactType;
    if (isAppliedValue(contactType)) {
        filter.contacttype = String(contactType).toLowerCase();
    }
    const contactStatus = form.cstatus ?? form.contactStatus;
    if (isAppliedValue(contactStatus)) filter.status = contactStatus;
    const verified = parseVerified(form.cverified ?? form.contactVerified);
    if (verified === true) filter.monitor = true;
    if (isAppliedValue(form.ctags ?? form.contactTag)) {
        filter.ctag = form.ctags ?? form.contactTag;
    }
    return filter;
}

function matchesDateInRange(
    dateValue: string,
    startDate?: string,
    endDate?: string
): boolean {
    if (!startDate && !endDate) return true;
    const recordTime = new Date(dateValue).getTime();
    if (Number.isNaN(recordTime)) return false;
    if (startDate) {
        const startTime = new Date(startDate).getTime();
        if (!Number.isNaN(startTime) && recordTime < startTime) return false;
    }
    if (endDate) {
        const endTime = new Date(endDate).getTime();
        if (!Number.isNaN(endTime) && recordTime > endTime) return false;
    }
    return true;
}

function hasActiveFilter(filter: Record<string, unknown>): boolean {
    return Object.keys(filter).length > 0;
}

function matchesBusinessFilters(
    business: IBusinessDoc,
    filter: Record<string, unknown>
): boolean {
    for (const key of Object.keys(filter)) {
        const filterVal = filter[key];
        if (!isAppliedValue(filterVal)) continue;
        const recordVal = (business as unknown as Record<string, unknown>)[key];
        if (key === "bname") {
            if (!String(recordVal ?? "").trim().toLowerCase().startsWith(String(filterVal).trim().toLowerCase())) {
                return false;
            }
            continue;
        }
        if (key === "country") {
            if (normalizeCountryKey(recordVal) !== normalizeCountryKey(filterVal)) return false;
            continue;
        }
        if (key === "state") {
            if (normalizeStateKey(recordVal) !== normalizeStateKey(filterVal)) return false;
            continue;
        }
        if (key === "tag") {
            const tags = String(recordVal ?? "")
                .split(",")
                .map((item) => item.trim().toLowerCase())
                .filter(Boolean);
            const wanted = String(filterVal).trim().toLowerCase();
            if (!wanted || !tags.includes(wanted)) return false;
            continue;
        }
        if (key === "mmfinyear") {
            const wantedQuarter = quarterNumber(String(filterVal));
            const actualQuarter = recordQuarter(Number(business.mmfinyear), business.datecreated);
            if (wantedQuarter === undefined || actualQuarter !== wantedQuarter) return false;
            continue;
        }
        if (recordVal !== filterVal) return false;
    }
    return true;
}

function matchesContactFilters(
    contact: IContactDoc,
    filter: Record<string, unknown>
): boolean {
    for (const key of Object.keys(filter)) {
        const filterVal = filter[key];
        if (!isAppliedValue(filterVal)) continue;
        const recordVal = (contact as unknown as Record<string, unknown>)[key];
        if (key === "contacttype") {
            if (String(recordVal ?? "").trim().toLowerCase() !== String(filterVal).trim().toLowerCase()) return false;
            continue;
        }
        if (key === "ctag") {
            const tags = String(recordVal ?? "")
                .split(",")
                .map((item) => item.trim().toLowerCase())
                .filter(Boolean);
            const wanted = String(filterVal).trim().toLowerCase();
            if (!wanted || !tags.includes(wanted)) return false;
            continue;
        }
        if (recordVal !== filterVal) return false;
    }
    return true;
}

// Filter cached businesses by applied json, including optional date-type range.
export function filterBusinessRecords(
    businesses: IBusinessDoc[],
    form: IDCFilterControlValues
): IBusinessDoc[] {
    const filter = buildBusinessRecordFilter(form);
    const dateField = isAppliedValue(form.selectdatetype) ? form.selectdatetype : undefined;
    return businesses.filter((business) => {
        if (!matchesBusinessFilters(business, filter)) {
            return false;
        }
        if (!dateField || (!form.StartDate && !form.EndDate)) {
            return true;
        }
        const dateValue = String((business as unknown as Record<string, unknown>)[dateField] ?? "");
        return matchesDateInRange(dateValue, form.StartDate, form.EndDate);
    });
}

// Filter cached contacts by applied json, optionally scoped to a bid.
export function filterContactRecords(
    contacts: IContactDoc[],
    form: IDCFilterControlValues,
    bid?: string
): IContactDoc[] {
    const filter = buildContactRecordFilter(form);
    if (bid) {
        filter.bid = bid;
    }
    return contacts.filter((contact) => matchesContactFilters(contact, filter));
}

// True when any contact-side filter is active (tree shows only matching businesses).
export function hasActiveContactFilters(form: IDCFilterControlValues): boolean {
    return hasActiveFilter(buildContactRecordFilter(form));
}
