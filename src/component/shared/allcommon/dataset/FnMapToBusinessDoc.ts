import type { IBusinessDoc } from "../../allinterface/IDatasets";

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

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map((item) => asString(item)).filter(Boolean);
}

function FnMapToBusinessDoc(record: Record<string, unknown>): IBusinessDoc {
    return {
        bid: asString(record.bid || record.id),
        btype: asString(record.btype),
        status: asString(record.status),
        tag: asString(record.tag),
        verified: asBoolean(record.verified),
        salesexec: asString(record.salesexec),
        bname: asString(record.bname),
        country: asString(record.country),
        state: asString(record.state),
        daysnoticeperiod: asNumber(record.daysnoticeperiod),
        mmfinyear: asNumber(record.mmfinyear),
        relatedbids: asStringArray(record.relatedbids),
        datecreated: asString(record.datecreated),
        dateupdated: asString(record.dateupdated),
        name: asString(record.name),
        updatedby: asString(record.updatedby),
        createdby: asString(record.createdby),
        contactsupdated: asString(record.contactsupdated),
        notesupdated: asString(record.notesupdated),
        ticketsupdated: asString(record.ticketsupdated),
        ticketnotesupdated: asString(record.ticketnotesupdated),
        activitiesupdated: asString(record.activitiesupdated),
        ordersupdated: asString(record.ordersupdated),
        quoteupdated: asString(record.quoteupdated),
        subsupdated: asString(record.subsupdated),
        downloadupdated: asString(record.downloadupdated),
    };
}

function FnMapToBusinessDocs(records: Record<string, unknown>[] | null | undefined): IBusinessDoc[] {
    if (!records?.length) {
        return [];
    }
    return records.map(FnMapToBusinessDoc);
}

export { FnMapToBusinessDoc, FnMapToBusinessDocs };
