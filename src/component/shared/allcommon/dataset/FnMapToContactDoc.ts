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
        bid: asString(bid || record.bid),
        cid: asString(record.cid || record.id || (record as any).EntID),
        monitorupdated: asString(record.monitorupdated),
        monitor: asBoolean(record.monitor ?? (record as any).verified),
        contacttype: asString(record.contacttype || (record as any).ctype),
        role: asString(record.role),
        status: asString(record.status),
        ctag: asString(record.ctag),
        cname: asString(record.cname || (record as any).contact || (record as any).name),
        email: asString(record.email),
        phone: asString(record.phone || (record as any).phone1),
        address1: asString(record.address1 || (record as any).address_street),
        address2: asString(record.address2),
        city: asString(record.city || (record as any).address_city),
        state: asString(record.state || (record as any).address_state),
        country: asString(record.country || (record as any).address_country),
        zip: asString(record.zip || (record as any).address_zip),
        countrycode: asString(record.countrycode),
        timezoneoffset: asNumber(record.timezoneoffset),
        donotcallme: asBoolean(record.donotcallme),
        removemefrommailinglist: asBoolean(record.removemefrommailinglist),
        smsoptin: asBoolean(record.smsoptin),
        datecreated: asString(record.datecreated || (record as any).dateCreated),
        dateupdated: asString(record.dateupdated || (record as any).dateUpdated),
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
