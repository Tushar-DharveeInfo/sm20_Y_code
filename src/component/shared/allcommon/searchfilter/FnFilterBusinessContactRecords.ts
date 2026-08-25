import { IDCFilterControlValues } from "../../allinterface/searchfilter/IFilterFormContainer";
import { IBusiness } from "../../allinterface/tree/IBusiness";
import { IContact } from "../../allinterface/tree/IContact";

function parseVerified(value: string | undefined): boolean | undefined {
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
}

function isAppliedValue(value: unknown): boolean {
    return value !== undefined && value !== null && value !== "";
}

/*Normalizes CountryForm names (United States) to sample codes (USA). */
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
    "company",
    "CompanyName",
    "status",
    "verified",
    "country",
    "state",
    "noticePeriod",
    "finYearMonth",
    "StartDate",
    "EndDate",
    "dateRange",
    "btype",
    "assignedTo",
    "tag",
    "contactType",
    "contactStatus",
    "contactVerified",
    "contactCountry",
    "contactState",
    "contactTag",
] as const;

/**
 * Maps libform keys like "Filter Business_status_0_3_0" to the control Name ("status").
 * Plain field names are returned as-is.
 */
export function normalizeFilterFieldName(key: string): string | null {
    const lowerKey = key.toLowerCase();
    const exact = (KNOWN_FILTER_FIELDS as readonly string[]).find(
        (field) => field.toLowerCase() === lowerKey
    );
    if (exact) {
        return exact;
    }
    // Prefer longer names first so "contactStatus" wins over "status"
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

/*Keeps only applied fields, using plain control names (no DisplayGroup prefixes). */
export function getAppliedFilterJson(
    form: IDCFilterControlValues
): IDCFilterControlValues {
    const applied: IDCFilterControlValues = {};
    Object.entries(form).forEach(([key, value]) => {
        if (!isAppliedValue(value)) return;
        const field = normalizeFilterFieldName(key);
        if (field) {
            applied[field] = value;
        }
    });
    return applied;
}

/*Maps Filter Business form fields onto business JSON property names (applied keys only). */
export function buildBusinessRecordFilter(
    form: IDCFilterControlValues
): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (isAppliedValue(form.bname)) filter.bname = form.bname;
    if (isAppliedValue(form.company)) filter.bname = form.company;
    if (isAppliedValue(form.CompanyName)) filter.bname = form.CompanyName;
    if (isAppliedValue(form.status)) filter.status = form.status;
    const verified = parseVerified(form.verified);
    if (verified !== undefined) filter.verified = verified;
    if (isAppliedValue(form.country)) filter.country = form.country;
    if (isAppliedValue(form.state)) filter.state = form.state;
    if (isAppliedValue(form.noticePeriod)) filter.daysNoticePeriod = Number(form.noticePeriod);
    if (isAppliedValue(form.finYearMonth)) filter.mmFinYear = Number(form.finYearMonth);
    if (isAppliedValue(form.btype)) filter.btype = form.btype;
    if (isAppliedValue(form.assignedTo)) filter.salesExec = form.assignedTo;
    if (isAppliedValue(form.tag)) filter.tag = form.tag;
    return filter;
}

/*Maps Filter Contact form fields onto contact JSON property names (applied keys only). */
export function buildContactRecordFilter(
    form: IDCFilterControlValues
): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (isAppliedValue(form.contactType)) {
        filter.ctype = String(form.contactType).toLowerCase();
    }
    if (isAppliedValue(form.contactStatus)) filter.status = form.contactStatus;
    const verified = parseVerified(form.contactVerified);
    if (verified !== undefined) filter.verified = verified;
    if (isAppliedValue(form.contactCountry)) filter.address_country = form.contactCountry;
    if (isAppliedValue(form.contactState)) filter.address_state = form.contactState;
    return filter;
}

function matchesDateUpdated(
    dateUpdated: string,
    startDate?: string,
    endDate?: string
): boolean {
    if (!startDate && !endDate) return true;
    const recordTime = new Date(dateUpdated).getTime();
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
    business: IBusiness,
    filter: Record<string, unknown>
): boolean {
    for (const key of Object.keys(filter)) {
        const filterVal = filter[key];
        if (!isAppliedValue(filterVal)) continue;
        const recordVal = (business as unknown as Record<string, unknown>)[key];
        if (key === "bname") {
            if (String(recordVal ?? "").trim().toLowerCase() !== String(filterVal).trim().toLowerCase()) return false;
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
        if (recordVal !== filterVal) return false;
    }
    return true;
}

function matchesContactFilters(
    contact: IContact,
    filter: Record<string, unknown>
): boolean {
    for (const key of Object.keys(filter)) {
        const filterVal = filter[key];
        if (!isAppliedValue(filterVal)) continue;
        const recordVal = (contact as unknown as Record<string, unknown>)[key];
        if (key === "address_country") {
            if (normalizeCountryKey(recordVal) !== normalizeCountryKey(filterVal)) return false;
            continue;
        }
        if (key === "address_state") {
            if (normalizeStateKey(recordVal) !== normalizeStateKey(filterVal)) return false;
            continue;
        }
        if (recordVal !== filterVal) return false;
    }
    return true;
}

/*Filters businesses with country/state-aware matching (+ optional dateUpdated range). */
export function filterBusinessRecords(
    businesses: IBusiness[],
    form: IDCFilterControlValues
): IBusiness[] {
    const filter = buildBusinessRecordFilter(form);
    return businesses.filter((business) => {
        if (!matchesBusinessFilters(business, filter)) {
            return false;
        }
        return matchesDateUpdated(business.dateUpdated, form.StartDate, form.EndDate);
    });
}

/*Filters contacts with country/state-aware matching. Optionally scope by bid. */
export function filterContactRecords(
    contacts: IContact[],
    form: IDCFilterControlValues,
    bid?: string
): IContact[] {
    const filter = buildContactRecordFilter(form);
    if (bid) {
        filter.bid = bid;
    }
    return contacts.filter((contact) => matchesContactFilters(contact, filter));
}

/*True when any contact-side filter is active. */
export function hasActiveContactFilters(form: IDCFilterControlValues): boolean {
    return hasActiveFilter(buildContactRecordFilter(form));
}
