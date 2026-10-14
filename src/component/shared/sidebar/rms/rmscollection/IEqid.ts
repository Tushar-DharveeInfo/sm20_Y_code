import { IEqidDoc } from "@n20a/libfsdb";


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

interface IShapeStyle {
  Style: string;
  StyleAcronym: string;
  Description: string;
  PrintOrder: number;
}

interface IShape {
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

interface IEqidRelation {
  EQID: string;
  RelatedEQID: string;
  RelationType: string;
  DateCreated: Date;
  LastUpdated: Date;
}

interface IEQIDEditFormProfile {
  EQIDRecord: IEqidDoc;
  getAcronym?: () => string[]; //return both acronym + manufacture names
  getMfg?: () => string[];   //return only unique manufacture names
  getEQIDAllocated?: (mfgkey: string) => string[];
  getEqType?: () => string[];
  getMfgProdLine?: (mfgkey: string) => string[];
  getMfgEqType?: (eqtype: string) => string[];
  SaveEQID?: (updatedEQIDRecord: IEqidDoc) => void;
}

export type { IEqidDoc, IEqidShapes, IShapeStyle, IShape, IEqidRelation, IEQIDEditFormProfile };
