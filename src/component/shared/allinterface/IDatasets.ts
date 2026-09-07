/*
Make sure the contents of this file are identical to other copies of this file in sm20, service20 projects.
*/

// Firestore document interfaces mirroring the collections defined in CollectionsAndFieldsPolicy.json.
// Field lists reflect the union of each collection's "write"/"select" arrays in that policy file.

/** Top-level collection: businesses */
export interface IBusinessDoc {
    bid: string;
    btype: string;
    status: string;
    tag: string;
    verified: boolean;
    salesexec: string;
    bname: string;
    country: string;
    state: string;
    daysnoticeperiod: number;
    mmfinyear: number;
    relatedbids: string[];
    datecreated: string;
    dateupdated: string;
    name: string;
    updatedby: string;
    createdby: string;
    contactsupdated: string;
    notesupdated: string;
    ticketsupdated: string;
    ticketnotesupdated: string;
    activitiesupdated: string;
    ordersupdated: string;
    quoteupdated: string;
    subsupdated: string;
    downloadupdated: string;
}

/** Subcollection: businesses/{bid}/contacts */
export interface IContactDoc {
    bid: string;
    cid: string;
    monitorupdated: string;
    monitor: boolean;
    contacttype: string;
    role: string;
    status: string;
    ctag: string;
    cname: string;
    email: string;
    phone: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    country: string;
    zip: string;
    countrycode: string;
    timezoneoffset: number;
    datecreated: string;
    dateupdated: string;
}

/** Subcollection: businesses/{bid}/notes */
export interface INoteDoc {
    bid: string;
    cid: string;
    monitorupdated: string;
    monitor: boolean;
    noteid: string;
    message: string;
    filename: string;
    datecreated: string;
}

/** Subcollection: businesses/{bid}/tickets */
export interface ITicketDoc {
    bid: string;
    cid: string;
    monitorupdated: string;
    monitor: boolean;
    ticketid: string;
    tickettype: string;
    subscription: string;
    mfg: string;
    eqtype: string;
    prodno: string;
    moreinfo: string;
    status: string;
    daterequested: string;
    datereleased: string;
    lastupdated: string;
}

/** Subcollection: businesses/{bid}/tickets/{ticketid}/ticketnotes */
export interface ITicketNoteDoc {
    bid: string;
    cid: string;
    ticketid: string;
    monitorupdated: string;
    monitor: boolean;
    notes: string;
    datecreated: string;
}

/** Subcollection: businesses/{bid}/activities */
export interface IActivityDoc {
    bid: string;
    cid: string;
    monitorupdated: string;
    monitor: boolean;
    activityid: string;
    message: string;
    datecreated: string;
}

/** Subcollection: businesses/{bid}/orders */
export interface IOrderDoc {
    bid: string;
    cid: string;
    monitorupdated: string;
    monitor: boolean;
    orderid: string;
    title: string;
    filename: string;
    status: string;
    amount: number;
    datecreated: string;
}

/** Subcollection: businesses/{bid}/quotes */
export interface IQuoteDoc {
    bid: string;
    cid: string;
    monitorupdated: string;
    monitor: boolean;
    orderid: string;
    title: string;
    filename: string;
    status: string;
    amount: number;
    datecreated: string;
}

/** Subcollection: businesses/{bid}/subs */
export interface ISubDoc {
    bid: string;
    cid: string;
    monitorupdated: string;
    monitor: boolean;
    purchaser: string;
    subsid: string;
    product: string;
    status: string;
    startdate: string;
    enddate: string;
    datecreated: string;
}

/** Subcollection: businesses/{bid}/subs/{subsid}/downloads */
export interface IDownloadDoc {
    bid: string;
    cid: string;
    subsid: string;
    monitorupdated: string;
    monitor: boolean;
    filename: string;
    dateused: string;
}

/** Top-level collection: todo */
export interface ITodoDoc {
    bid: string;
    cid: string;
    btype: string;
    status: string;
    whattodo: string;
    duedate: string;
    addedby: string;
    filename?: string;
}

/** Top-level collection: prospect */
export interface IProspectDoc {
    bid: string;
    cid: string;
    status: string;
    whattodo: string;
}

/** Maps each collection name from CollectionsAndFieldsPolicy.json to its document interface. */
export interface ICollectionDocMap {
    businesses: IBusinessDoc;
    contacts: IContactDoc;
    notes: INoteDoc;
    tickets: ITicketDoc;
    ticketnotes: ITicketNoteDoc;
    activities: IActivityDoc;
    orders: IOrderDoc;
    quotes: IQuoteDoc;
    subs: ISubDoc;
    downloads: IDownloadDoc;
    todo: ITodoDoc;
    prospect: IProspectDoc;
}

export type CollectionName = keyof ICollectionDocMap;
