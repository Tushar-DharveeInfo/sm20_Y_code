import type { IContactDoc } from "../../allinterface/IDatasets";

function asString(value: unknown): string {
    if (value === undefined || value === null) {
        return "";
    }
    return String(value);
}

function asBoolean(value: unknown): boolean {
    if (typeof value === "boolean") {
        return value;
    }
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "true" || raw === "1";
}

function asNumber(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function FnMapToContactDoc(record: Record<string, unknown>, bid?: string): IContactDoc {
    return {
        bid: asString(record.bid || bid),
        cid: asString(record.cid || record.id),
        monitorupdated: asString(record.monitorupdated),
        monitor: asBoolean(record.monitor),
        contacttype: asString(record.contacttype),
        role: asString(record.role),
        status: asString(record.status),
        ctag: asString(record.ctag),
        cname: asString(record.cname),
        email: asString(record.email),
        phone: asString(record.phone),
        address1: asString(record.address1),
        address2: asString(record.address2),
        city: asString(record.city),
        state: asString(record.state),
        country: asString(record.country),
        zip: asString(record.zip),
        countrycode: asString(record.countrycode),
        timezoneoffset: asNumber(record.timezoneoffset),
        datecreated: asString(record.datecreated),
        dateupdated: asString(record.dateupdated),
    };
}

function FnMapToContactDocs(
    records: Record<string, unknown>[] | null | undefined,
    bid?: string
): IContactDoc[] {
    if (!records?.length) {
        return [];
    }
    return records.map((record) => FnMapToContactDoc(record, bid));
}

export { FnMapToContactDoc, FnMapToContactDocs };
