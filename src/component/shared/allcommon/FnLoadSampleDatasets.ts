import type {
    CollectionName,
    IActivityDoc,
    IBusinessDoc,
    ICollectionDocMap,
    IContactDoc,
    IDownloadDoc,
    INoteDoc,
    IOrderDoc,
    IProspectDoc,
    IQuoteDoc,
    ISubDoc,
    ITicketDoc,
    ITicketNoteDoc,
    ITodoDoc,
} from "../allinterface/IDatasets";
import type { ISmDatasetCache } from "../context/allinterface/ISmData";

import activitiesJson from "../../../smsampledata/datasets/activities.json";
import businessesJson from "../../../smsampledata/datasets/businesses.json";
import contactsJson from "../../../smsampledata/datasets/contacts.json";
import downloadsJson from "../../../smsampledata/datasets/downloads.json";
import notesJson from "../../../smsampledata/datasets/notes.json";
import ordersJson from "../../../smsampledata/datasets/orders.json";
import prospectJson from "../../../smsampledata/datasets/prospect.json";
import quotesJson from "../../../smsampledata/datasets/quotes.json";
import subsJson from "../../../smsampledata/datasets/subs.json";
import ticketnotesJson from "../../../smsampledata/datasets/ticketnotes.json";
import ticketsJson from "../../../smsampledata/datasets/tickets.json";
import todoJson from "../../../smsampledata/datasets/todo.json";

function asArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown): string {
    if (value === undefined || value === null) {
        return "";
    }
    return String(value);
}

function normalizeProspect(row: Record<string, unknown>): IProspectDoc {
    return {
        bid: asString(row.bid),
        cid: asString(row.cid),
        status: asString(row.status),
        whattodo: asString(row.whattodo),
    };
}

const sourceBusinesses: IBusinessDoc[] = [...asArray<IBusinessDoc>(businessesJson)].sort((a, b) =>
    (a.bname ?? "").localeCompare(b.bname ?? "")
);
const sourceContacts: IContactDoc[] = asArray<IContactDoc>(contactsJson);
const sourceNotes: INoteDoc[] = asArray<INoteDoc>(notesJson);
const sourceTickets: ITicketDoc[] = asArray<ITicketDoc>(ticketsJson);
const sourceTicketNotes: ITicketNoteDoc[] = asArray<ITicketNoteDoc>(ticketnotesJson);
const sourceActivities: IActivityDoc[] = asArray<IActivityDoc>(activitiesJson);
const sourceOrders: IOrderDoc[] = asArray<IOrderDoc>(ordersJson);
const sourceQuotes: IQuoteDoc[] = asArray<IQuoteDoc>(quotesJson);
const sourceSubs: ISubDoc[] = asArray<ISubDoc>(subsJson);
const sourceDownloads: IDownloadDoc[] = asArray<IDownloadDoc>(downloadsJson);
const sourceTodo: ITodoDoc[] = asArray<ITodoDoc>(todoJson);
const sourceProspect: IProspectDoc[] = asArray<Record<string, unknown>>(prospectJson).map(normalizeProspect);

const SOURCE_DATASETS: ISmDatasetCache = {
    businesses: sourceBusinesses,
    contacts: sourceContacts,
    notes: sourceNotes,
    tickets: sourceTickets,
    ticketnotes: sourceTicketNotes,
    activities: sourceActivities,
    orders: sourceOrders,
    quotes: sourceQuotes,
    subs: sourceSubs,
    downloads: sourceDownloads,
    todo: sourceTodo,
    prospect: sourceProspect,
};

const SCOPED_COLLECTION_NAMES: Exclude<CollectionName, "businesses">[] = [
    "contacts",
    "notes",
    "tickets",
    "ticketnotes",
    "activities",
    "orders",
    "quotes",
    "subs",
    "downloads",
    "todo",
    "prospect",
];

const emptyScopedDatasets = (): Omit<ISmDatasetCache, "businesses"> => ({
    contacts: [],
    notes: [],
    tickets: [],
    ticketnotes: [],
    activities: [],
    orders: [],
    quotes: [],
    subs: [],
    downloads: [],
    todo: [],
    prospect: [],
});

function FnGetSourceDataset<K extends CollectionName>(name: K): ICollectionDocMap[K][] {
    return SOURCE_DATASETS[name];
}

export {
    emptyScopedDatasets,
    FnGetSourceDataset,
    SCOPED_COLLECTION_NAMES,
    SOURCE_DATASETS,
    sourceBusinesses,
    sourceContacts,
};
