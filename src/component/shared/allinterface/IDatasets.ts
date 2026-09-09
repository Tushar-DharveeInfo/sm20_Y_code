
export interface IBusinessDoc {
    bid: string;
    btype: string;  //mcs, reseller, consultant, enduser
    status: string;
    tag?: string;
    verified: boolean;
    salesexec: string;
    bname: string;
    country: string;
    state: string;
    daysnoticeperiod?: number;
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
    subsupdated: string;
    downloadupdated: string;

    amcexpirydate?: string;
    mcsexpirydate?: string;
    saasexpirydate?: string;
    onpremexpirydate?: string;
    estimatedusers?: number;
    estimatedracks?: number;
    estimateddcsites?: number;
}


export interface IContactDoc {
    bid: string;
    cid: string;
    monitorupdated: string;
    monitor: boolean;
    contacttype: string;  //contact, shipto, billto
    role: string;         //admin, sales, support, ceo, decision maker, other
    status: string;
    ctag?: string;
    cname: string;
    email: string;
    phone: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    country: string;
    zip: string;
    countrycode: string;
    timezoneoffset: number;
    donotcallme: boolean;
    removemefrommailinglist: boolean;
    smsoptin: boolean;
    datecreated: string;
    dateupdated: string;
}


export interface INoteDoc {
    bid: string;
    cid: string;
    monitorupdated: string;
    monitor: boolean;
    noteby: string;//who added notes
    noteid: string;
    message: string;
    filename: string;
    datecreated: string;
}


export interface ITicketDoc {
    bid: string;
    cid: string;
    monitorupdated: string;
    monitor: boolean;
    ticketid: string;
    tickettype: string;   //vss or support
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

export interface ITicketNoteDoc {
    bid: string;
    cid: string;
    ticketid: string;
    monitorupdated: string;
    monitor: boolean;
    notes: string;
    filename?: string;  //optional, to save file name of uploaded file
    datecreated: string;
}

export interface IActivityDoc {
    bid: string;
    cid: string;
    monitorupdated: string;
    monitor: boolean;
    activityid: string;
    message: string;
    datecreated: string;
}

export interface IOrderDoc {
    bid: string;
    cid: string;
    monitorupdated: string;
    monitor: boolean;
    invoiceid: string;
    orderid: string;
    expirydate: string; //if expiry date exists that will mean record is for a quote (not order);

    title: string;
    filename?: string;
    status: string;
    amount: number;
    datecreated: string;
}

export interface ICartDoc {
    bid: string;
    cid: string;
    orderid: string;
    sortorder?: number;
    productsku: string;
    name: string;
    description: string;
    price: number;
    discountpercent?: number;
    taxable?: boolean;

    qty: number;
    years: number;
    hours?: number;
    nodes?: number;
    StartDate?: Date;
}

export interface ISupportHoursUsedDoc {
    bid: string;
    cid: string;
    orderid: string;
    ticketid?: string; //optional, to link the support hours used to a specific ticket
    hoursused: number;
    purpose: string;
    datecreated: string;
}

export interface ISubDoc {
    bid: string;
    cid: string;
    orderid: string;
    monitorupdated: string;
    monitor: boolean;
    purchaser: string;
    subsid: string;
    product: string;
    status: string;     //blocked, active, expired, cancelled
    statusupdatedby: string;
    statusreason: string;
    startdate: string;
    enddate: string;
    datecreated: string;
}

export interface IVssDownloadDoc {
    bid: string;
    cid: string;
    subsid: string;
    monitorupdated: string;
    monitor: boolean;
    filename: string;
    dateused: string;
}

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

export interface IProspectDoc {
    bid: string;
    cid: string;
    status: string;
    whattodo: string;
}


