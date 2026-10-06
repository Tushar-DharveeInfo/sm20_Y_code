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
    setDatasets: Dispatch<SetStateAction<IRmsDatasetCache>>;

    // Fetch / loader functions
    loadEqid: (refresh?: boolean) => Promise<IEqidDoc[] | null>;
    loadMfgEqType: (refresh?: boolean) => Promise<IMfgEqTypeDoc[]>;
    loadEQIDAllocated: (refresh?: boolean) => Promise<IEqidAllocatedDoc[] | null>;
    loadAllRmsData: (refresh?: boolean) => Promise<void>;
}

export type {
    IEqidDoc,
    IMfgEqTypeDoc,
    IEqidAllocatedDoc,
    IRmsDatasetCache,
    IRms,
    IRms as IRmsContext,
};
