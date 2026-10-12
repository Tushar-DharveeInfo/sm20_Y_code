interface IEqid 
{
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
  ApprovedDate: Date;
  DataReady: boolean;
  DataApprovedBy: string;
  DataApprovedDate: Date;
  ShapeReady: boolean;
  ShapeApprovedBy: string;
  ShapeApprovedDate: Date;
  isReleased: boolean;
  ReleasedDate: Date;
  Archived: boolean;
  Source: string;
  DeviceAttribute: string;
  isIntel: boolean;
  isFacility: boolean;
  isIT: boolean;
  PrivateDevice: boolean;
  LoginOwner: string;
}

interface IEqidShapes {
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
}

interface IShapeStyle 
{
  Style: string;
  StyleAcronym: string;
  Description: string;
  PrintOrder: number;
}

interface IShape
{
  EQID: string;
  Style: string;
  ShapeOrientation: string;
  RelatedShapeID: string;
  ShapeReady: boolean;
  ShapeApprovedBy: string;
  DateCreated: Date;
  LastUpdated: Date;
  ShapeID: string;
}

interface IEqidRelation
{
  EQID: string;
  RelatedEQID: string;
  RelationType: string;
  DateCreated: Date;
  LastUpdated: Date;
}

interface IEQIDEditFormProfile
{
   EQIDRecord: IEqid;
   getAcronym?: ()=>string[]; //return both acronym + manufacture names
   getMfg?: ()=>string[];   //return only unique manufacture names
   getEQIDAllocated?: (mfgkey: string)=>string[];
   getEqType?: ()=>string[];
   getMfgProdLine?: (mfgkey: string)=>string[];
   getMfgEqType?: (eqtype: string)=>string[];
   SaveEQID?:(updatedEQIDRecord: IEqid)=>void;
}

export type { IEqid, IEqidShapes, IShapeStyle, IShape, IEqidRelation, IEQIDEditFormProfile };
