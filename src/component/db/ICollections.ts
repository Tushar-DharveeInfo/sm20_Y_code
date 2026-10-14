
/*
Make sure the contents of this file are identical to copies of this file in fsdb and cloudrun
*/
// Firestore document interfaces mirroring the collections defined in CollectionsAndFieldsPolicy.json.
// Field lists reflect the union of each collection's "write"/"select" arrays in that policy file.

/** Top-level collection: businesses */
export interface IApDoc {
  app: string;
  apname: string;
  value: string;
}
/** Top-level collection: todo */
export interface ITodoDoc {
  bid: string;
  cid: string;
  btype: string;
  status: string;
  eqid: string;
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
/** Top-level collection: tenantidmap */
export interface ITenantIdMapDoc {
  tenantid: string;
  displayname: string;
  lastupdated: string;
}


export interface INetworkPort {
  ShapeID: string;
  Name: string;
  PortIndex: number;  //0-based index
  Gender: string;     //M|F|B for both
  PortType: string;   //Copper | Fiber | Other
  IsPortFiber: boolean;
}

export interface IPowerPort {
  ShapeID: string;
  Name: string;
  PortIndex: number;  //0-based index
  Gender: string;     //M|F|B for both
}

export interface IInOutPort {
  ShapeID: string;
  Name: string;
  PortIndex: number;
  Gender: string;     //In|Out|B for both
}

export interface ISlot {
  ShapeID: string;
  Name: string;
  SlotIndex: number;  //0-based index
  SlotUse: string | null; //
  SlotMountType: string;
}

/** Top-level collection: eqid */
export interface IEqidDoc {
  bid: string;  ///each eqid is develop for a bid, cid, and ticketid
  cid: string;
  ticketid: string;

  Acronym: string;
  EQID: string;
  Manufacturer: string;
  MfgProdLine: string;
  Eqtype: string;
  MfgEqtype: string;
  MfgProdNo: string;
  MfgDesc: string;
  DimUnits: string;
  Ht: number;
  Wd: number;
  Dp: number;
  isEstimatedDimension: boolean;
  RUNeeded: number;  //was RU
  Scale: number;
  WtUnits: string;
  Wt: number;
  isEstimatedWt: boolean;
  VoltUnits: string;
  VoltMin: number;
  VoltMax: number;
  AmpUnits: string;
  Amp: number;
  PowerUnits: string;
  PowerMin: number;
  PowerMax: number;
  PowerAvg: number;
  isEstimatedPower: boolean;
  PowerLoadCapacity: number;
  isEstimatedPowerLoad: boolean;
  HeatUnits: string;
  HeatMin: number;
  HeatMax: number;
  HeatAvg: number;
  isEstimatedHeat: boolean;
  RackType: string;
  TotalRU: number;
  InsideWidth: number;
  Color: string;
  DimA: number;
  DimB: number;
  DimC: number;
  DimD: number;
  DimE: number;
  DimF: number;
  DimFService: number;
  DimG: number;
  DimH: number;
  DimI: number;
  DimJ: number;
  DimR: number;
  DimRService: number;
  RackLoadUnits: string;
  LoadCapacity: number;
  isEstimatedRack: boolean;
  FirstRU: number;
  RUSpacing: number;
  RU: number;
  CableCapacity: number;
  ApprovedStatus: string;
  ApprovedBy: string;
  ApprovedDate: Date;  //make sure this props is set when ticket is accepted; it should be the date of approval/accepted ticket
  DataReady: boolean;
  DataApprovedBy: string;
  DataApprovedDate: Date;
  ShapeReady: boolean;
  ShapeApprovedBy: string;
  ShapeApprovedDate: Date;
  isReleased: boolean;  //indicates if the EQID has been released
  ReleasedDate: Date;  //the date when the EQID was released
  Archived: boolean;
  Source: string;
  DeviceAttribute: string;
  isIntel: boolean;
  isFacility: boolean;
  isIT: boolean;
  PrivateDevice: boolean;
  LoginOwner: string;

  NetworkPorts?: INetworkPort[];
  PowerPorts?: IPowerPort[];
  InOutPlugs?: IInOutPort[];
  Slots?: ISlot[];
}

////////////////////////////////////////////////////////////////////////////////////////////
/** Top-level collection: mfg */
export interface IMfgDoc {
  [mfgkey: string]: string;
}

/** mfg sub-collection: eqidallocated */
export interface IEqidAllocatedDoc {
  [mfgkey: string]: string[];
}

/** mfg sub-collection: mfgvsprodline */
export interface IMfgVsProdlineDoc {
  [mfgkey: string]: string[];
}

/** mfg sub-collection: mfgvsmfgeqtype */
export interface IMfgVsMfgEqtypeDoc {
  [mfgkey: string]: string[];
}

/** mfg sub-collection: mfgvsmfgrelation */
export interface IMfgVsMfgRelationDoc {
  [mfgkey: string]: string[];
}

////////////////////////////////////////////////////////////////////////////////////////////
/** Top-level collection: businesses */
export interface IBusinessDoc {
  bid: string;
  btype: string;  //mcs, reseller, netzoom, visiostencils, ssi
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

/** Subcollection: businesses/{bid}/contacts */
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

/** Subcollection: businesses/{bid}/notes */
export interface INoteDoc {
  bid: string;
  cid: string;
  monitorupdated: string;
  monitor: boolean;
  noteby: string;//who added notes
  noteid: string;
  important: boolean;
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
  tickettype: string;   //vss or support
  subscription: string;
  eqid: string;
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
  eqid: string;
  notes: string;
  filename?: string;  //optional, to save file name of uploaded file
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

/** Subcollection: businesses/{bid}/orders/{orderid}/supporthoursused */
export interface ISupportHoursUsedDoc {
  bid: string;
  cid: string;
  orderid: string;
  ticketid?: string; //optional, to link the support hours used to a specific ticket
  hoursused: number;
  purpose: string;
  datecreated: string;
}

/** Subcollection: businesses/{bid}/subs */
export interface ISubDoc {
  bid: string;
  cid: string;
  orderid: string;
  monitorupdated: string;
  monitor: boolean;
  purchaser: string;
  subsid: string;
  product: string;
  productkey: string;  //it is set to 'netzoom' or 'vss' or '', set '' if prouct is a service hours or else for other products
  status: string;     //blocked, active, expired, cancelled
  statusupdatedby: string;
  statusreason: string;
  UserCount: number;
  RackCount: number;
  startdate: string;
  enddate: string;
  datecreated: string;
}


/** Subcollection: businesses/{bid}/subs/{subsid}/downloads */
export interface IVssDownloadDoc {
  bid: string;
  cid: string;
  subsid: string;
  monitorupdated: string;
  monitor: boolean;
  eqid: string;
  filename: string;
  dateused: string;
}

/** Maps each collection name from CollectionsAndFieldsPolicy.json to its document interface. */
export interface ICollectionDocMap {
  ap: IApDoc;
  businesses: IBusinessDoc;
  todo: ITodoDoc;
  prospect: IProspectDoc;
  tenantidmap: ITenantIdMapDoc;
  eqid: IEqidDoc;
  mfg: IMfgDoc;

  //following are sub collecions
  eqidallocated: IEqidAllocatedDoc;
  mfgvsprodline: IMfgVsProdlineDoc;
  mfgvsmfgeqtype: IMfgVsMfgEqtypeDoc;
  mfgvsmfgrelation: IMfgVsMfgRelationDoc;

  contacts: IContactDoc;
  notes: INoteDoc;
  tickets: ITicketDoc;
  ticketnotes: ITicketNoteDoc;
  activities: IActivityDoc;
  orders: IOrderDoc;
  carts: ICartDoc;
  supporthoursused: ISupportHoursUsedDoc;
  subs: ISubDoc;
  downloads: IVssDownloadDoc;
}

export type CollectionName = keyof ICollectionDocMap;
