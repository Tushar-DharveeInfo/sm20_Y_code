import type { Dispatch, SetStateAction } from "react";
import type { IEqidDoc } from "@n20a/libfsdb";

/**
 * Interface representing a document from the 'mfgeqtype' collection.
 */
export interface IMfgEqTypeDoc {
    [key: string]: any;
}

/**
 * Interface representing a document from the 'eqidallocated' collection.
 */
export interface IEqidAllocatedDoc {
    [key: string]: any;
}

/**
 * Dataset cache structure for RMS context.
 */
export interface IRmsDatasetCache {
    eqid: IEqidDoc[];
    mfgEqType: IMfgEqTypeDoc[];
    EQIDAllocated: IEqidAllocatedDoc[];
}

/**
 * RMS Context interface containing datasets, states, setters, and loader functions.
 */
interface IRms {
    // Datasets
    eqid: IEqidDoc[];
    mfgEqType: IMfgEqTypeDoc[];
    EQIDAllocated: IEqidAllocatedDoc[];
    eqidAllocated: IEqidAllocatedDoc[];
    /** Cached rows from the mfg table. */
    mfg: IMfgRecord[];
    /** Prodline names keyed by manufacturer acronym. */
    mfgVsProdline: Record<string, string[]>;
    /** MfgEqType names keyed by manufacturer acronym. */
    mfgVsMfgEqtype: Record<string, string[]>;
    /** Related manufacturers keyed by manufacturer acronym. */
    mfgRelation: Record<string, string[]>;
    datasets: IRmsDatasetCache;

    // Loading & Error states
    loading: boolean;
    isLoading: boolean;
    error: string | null;

    // Setters
    setEqid: Dispatch<SetStateAction<IEqidDoc[]>>;
    setMfgEqType: Dispatch<SetStateAction<IMfgEqTypeDoc[]>>;
    setEQIDAllocated: Dispatch<SetStateAction<IEqidAllocatedDoc[]>>;
    setEqidAllocated: Dispatch<SetStateAction<IEqidAllocatedDoc[]>>;
    setMfg: Dispatch<SetStateAction<IMfgRecord[]>>;
    setMfgVsProdline: Dispatch<SetStateAction<Record<string, string[]>>>;
    setMfgVsMfgEqtype: Dispatch<SetStateAction<Record<string, string[]>>>;
    setMfgRelation: Dispatch<SetStateAction<Record<string, string[]>>>;
    setDatasets: Dispatch<SetStateAction<IRmsDatasetCache>>;

    // Selected ticket card for RMS
    selectedTicketCard?: any;
    setSelectedTicketCard?: Dispatch<SetStateAction<any>>;

    // Fetch / loader functions
    loadEqid: (refresh?: boolean) => Promise<IEqidDoc[] | null>;
    loadMfgEqType: (refresh?: boolean) => Promise<IMfgEqTypeDoc[]>;
    loadEQIDAllocated: (refresh?: boolean) => Promise<IEqidAllocatedDoc[] | null>;
    loadMfg: (refresh?: boolean) => Promise<IMfgRecord[] | null>;
    loadAllRmsData: (refresh?: boolean) => Promise<void>;
}

/** One row from the mfg table, cached for the manufacturer tree. */
export interface IMfgRecord {
    mfgkey: string;
    mfgname: string;
    address?: string;
    website?: string;
    relatedmfgs?: string[];
}

/** Top-level collection: mfg */
export interface IMfg {
    [mfgkey: string]: string;
}
export type IMfgDoc = IMfg;

/** mfg sub-collection: eqidallocated */
export interface IEQIDAllocated {
    [mfgkey: string]: string[];
}

/** mfg sub-collection: mfgvsprodline */
export interface IMfgVsProdline {
    [mfgkey: string]: string[];
}
export type IMfgVsProdlineDoc = IMfgVsProdline;

/** mfg sub-collection: mfgvsmfgeqtype */
export interface IMfgVsMfgEqtype {
    [mfgkey: string]: string[];
}
export type IMfgVsMfgEqtypeDoc = IMfgVsMfgEqtype;

export type {
    IEqidDoc,
    IMfgEqTypeDoc,
    IEqidAllocatedDoc,
    IRmsDatasetCache,
    IRms,
    IRms as IRmsContext,
};
