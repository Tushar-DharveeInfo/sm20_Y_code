import { createContext, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useFirestore } from "@n20a/libfsdb";
import { IAppContextWrapper } from "../allinterface/IAppContextWrapper";
import type {
    IEqidAllocatedDoc,
    IEqidDoc,
    IMfgEqTypeDoc,
    IMfgRecord,
    IRms,
    IRmsDatasetCache,
} from "../allinterface/IRms";

const RmsContext = createContext<IRms | undefined>(undefined);

function withMfgDetails(row: Record<string, unknown>, record: IMfgRecord): IMfgRecord {
    return {
        ...record,
        address: typeof row.address === "string" ? row.address.trim() : "",
        website: typeof row.website === "string" ? row.website.trim() : "",
    };
}

function toMfgRecord(row: Record<string, unknown>): IMfgRecord | null {
    let related: string[] = [];
    if (Array.isArray(row.relatedmfgs)) {
        const arr = row.relatedmfgs;
        const len = arr.length;
        related = [];
        for (let i = 0; i < len; i++) {
            related.push(String(arr[i]));
        }
    }
    if (row.mfgkey) {
        const mfgkey = String(row.mfgkey).trim();
        const named = row.mfgname ?? row[mfgkey];
        return withMfgDetails(row, {
            mfgkey,
            mfgname: String(named || mfgkey).trim(),
            relatedmfgs: related,
        });
    }
    if (row.id && typeof row[String(row.id)] === "string") {
        const mfgkey = String(row.id).trim();
        return withMfgDetails(row, { mfgkey, mfgname: String(row[mfgkey]).trim(), relatedmfgs: related });
    }
    const ignored = new Set(["id", "path", "lastupdated", "_id", "relatedmfgs", "mfgkey", "mfgname", "address", "website"]);
    const keys = Object.keys(row).filter((key) => !ignored.has(key) && typeof row[key] === "string");
    if (!keys.length) {
        if (row.id) {
            const mfgkey = String(row.id).trim();
            return withMfgDetails(row, { mfgkey, mfgname: String(row.name || mfgkey).trim(), relatedmfgs: related });
        }
        return null;
    }
    const mfgkey = keys[0];
    return withMfgDetails(row, { mfgkey, mfgname: String(row[mfgkey] || mfgkey).trim(), relatedmfgs: related });
}

function RmsProvider({ children }: IAppContextWrapper) {
    // Hook to interact with Firestore database
    let firestore: ReturnType<typeof useFirestore> | null = null;
    try {
        firestore = useFirestore();
    } catch {
        // Handled when provider is instantiated outside FirestoreProvider
    }

    // 1. eqid dataset (loaded from table: eqid)
    const [eqid, setEqid] = useState<IEqidDoc[]>([]);
    const eqidRef = useRef<IEqidDoc[]>(eqid);
    eqidRef.current = eqid;

    // 2. mfgEqType dataset from table: mfgeqtype (Set empty array)
    const [mfgEqType, setMfgEqType] = useState<IMfgEqTypeDoc[]>([]);
    const mfgEqTypeRef = useRef<IMfgEqTypeDoc[]>(mfgEqType);
    mfgEqTypeRef.current = mfgEqType;

    // 3. mfg table cache for the manufacturer tree
    const [mfg, setMfg] = useState<IMfgRecord[]>([]);
    const mfgRef = useRef<IMfgRecord[]>(mfg);
    mfgRef.current = mfg;
    const [mfgVsProdline, setMfgVsProdline] = useState<Record<string, string[]>>({});
    const [mfgVsMfgEqtype, setMfgVsMfgEqtype] = useState<Record<string, string[]>>({});
    const [mfgRelation, setMfgRelation] = useState<Record<string, string[]>>({});

    // 4. EQIDAllocated dataset (loaded from table: eqidallocated)
    const [eqidAllocated, setEqidAllocated] = useState<IEqidAllocatedDoc[]>([]);
    const eqidAllocatedRef = useRef<IEqidAllocatedDoc[]>(eqidAllocated);
    eqidAllocatedRef.current = eqidAllocated;

    // 4. Selected ticket card for RMS
    const [selectedTicketCard, setSelectedTicketCardState] = useState<any>(null);
    const setSelectedTicketCard = useCallback((ticket?: any) => {
        setSelectedTicketCardState((prev: any) => {
            const next = typeof ticket === 'function' ? ticket(prev) : ticket;
            if (prev === next) return prev;
            if (!prev && !next) return prev;
            const prevId = prev?.ticketid || prev?.id || prev?.key || prev?.NodeEntID;
            const nextId = next?.ticketid || next?.id || next?.key || next?.NodeEntID;
            if (prevId && nextId && prevId === nextId) {
                return prev;
            }
            return next ?? null;
        });
    }, []);

    // Loading & error state tracking
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const hasLoadedRef = useRef<boolean>(false);

    // Load 'eqid' table from Firestore
    const loadEqid = useCallback(async (refresh?: boolean): Promise<IEqidDoc[] | null> => {
        if (!refresh && eqidRef.current.length > 0) {
            return eqidRef.current;
        }

        if (!firestore) {
            console.warn("RmsProvider: Firestore instance not available to load eqid.");
            return null;
        }

        try {
            setLoading(true);
            setError(null);
            const result = await firestore.queryDocuments({ pathSegments: ["eqid"] });
            if (result && Array.isArray(result.data)) {
                const rawDocs = result.data as unknown as Record<string, unknown>[];
                const docs: IEqidDoc[] = [];
                const len = rawDocs.length;
                for (let i = 0; i < len; i++) {
                    const d = rawDocs[i];
                    docs.push({
                        ...(d as unknown as IEqidDoc),
                        eqid: String(d.eqid || d.id || d.key || '').trim(),
                    });
                }
                setEqid(docs);
                eqidRef.current = docs;
                return docs;
            } else if (result?.error) {
                setError(result.error);
                return null;
            }
            return null;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load eqid dataset";
            console.error("Error loading eqid dataset:", err);
            setError(message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [firestore]);

    // Load 'mfgeqtype' table (Set empty array as specified)
    const loadMfgEqType = useCallback(async (_refresh?: boolean): Promise<IMfgEqTypeDoc[]> => {
        // Requirement: set empty array
        const emptyData: IMfgEqTypeDoc[] = [];
        setMfgEqType(emptyData);
        mfgEqTypeRef.current = emptyData;
        return emptyData;
    }, []);

    // Load 'eqidallocated' table from Firestore
    const loadEQIDAllocated = useCallback(async (refresh?: boolean): Promise<IEqidAllocatedDoc[] | null> => {
        if (!refresh && eqidAllocatedRef.current.length > 0) {
            return eqidAllocatedRef.current;
        }

        if (!firestore) {
            console.warn("RmsProvider: Firestore instance not available to load eqidallocated.");
            return null;
        }

        try {
            setLoading(true);
            setError(null);
            const result = await firestore.queryDocuments({ pathSegments: ["eqidallocated"] });
            if (result && Array.isArray(result.data)) {
                const rawDocs = result.data as unknown as Record<string, unknown>[];
                const docs: IEqidAllocatedDoc[] = [];
                const len = rawDocs.length;
                for (let i = 0; i < len; i++) {
                    const d = rawDocs[i];
                    docs.push({
                        ...(d as unknown as IEqidAllocatedDoc),
                        eqid: String(d.eqid || d.id || d.key || '').trim(),
                    });
                }
                setEqidAllocated(docs);
                eqidAllocatedRef.current = docs;
                return docs;
            } else if (result?.error) {
                setError(result.error);
                return null;
            }
            return null;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load eqidallocated dataset";
            console.error("Error loading eqidallocated dataset:", err);
            setError(message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [firestore]);

    const loadMfg = useCallback(async (refresh?: boolean): Promise<IMfgRecord[] | null> => {
        if (!refresh && mfgRef.current.length > 0) {
            return mfgRef.current;
        }

        if (!firestore) {
            console.warn("RmsProvider: Firestore instance not available to load mfg.");
            return null;
        }

        try {
            setLoading(true);
            setError(null);
            const result = await firestore.queryDocuments({ pathSegments: ["mfg"] });
            if (result && Array.isArray(result.data)) {
                const rawData = result.data;
                const docs: IMfgRecord[] = [];
                const len = rawData.length;
                for (let i = 0; i < len; i++) {
                    const record = toMfgRecord(rawData[i] as Record<string, unknown>);
                    if (record && record.mfgkey) {
                        docs.push(record);
                    }
                }
                setMfg(docs);
                mfgRef.current = docs;
                const relations: Record<string, string[]> = {};
                for (let i = 0; i < docs.length; i++) {
                    const row = docs[i];
                    relations[row.mfgkey.trim().toUpperCase()] = row.relatedmfgs ?? [];
                }
                setMfgRelation(relations);
                return docs;
            }
            if (result?.error) {
                setError(result.error);
                return null;
            }
            return [];
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load mfg dataset";
            console.error("Error loading mfg dataset:", err);
            setError(message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [firestore]);

    // Load all RMS datasets concurrently
    const loadAllRmsData = useCallback(async (refresh?: boolean): Promise<void> => {
        try {
            setLoading(true);
            setError(null);
            await Promise.all([
                loadEqid(refresh),
                loadMfgEqType(refresh),
                loadEQIDAllocated(refresh),
            ]);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load RMS datasets";
            console.error("Error loading RMS datasets:", err);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [loadEqid, loadMfgEqType, loadEQIDAllocated]);

    // Auto-load on mount
    useEffect(() => {
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;
        void loadAllRmsData();
    }, [loadAllRmsData]);

    // Setter for combined dataset cache
    const setDatasets: Dispatch<SetStateAction<IRmsDatasetCache>> = useCallback((action) => {
        if (typeof action === "function") {
            const currentCache: IRmsDatasetCache = {
                eqid: eqidRef.current,
                mfgEqType: mfgEqTypeRef.current,
                EQIDAllocated: eqidAllocatedRef.current,
            };
            const updated = action(currentCache);
            setEqid(updated.eqid);
            setMfgEqType(updated.mfgEqType);
            setEqidAllocated(updated.EQIDAllocated);
        } else {
            setEqid(action.eqid);
            setMfgEqType(action.mfgEqType);
            setEqidAllocated(action.EQIDAllocated);
        }
    }, []);

    const datasets: IRmsDatasetCache = useMemo(() => ({
        eqid,
        mfgEqType,
        EQIDAllocated: eqidAllocated,
    }), [eqid, mfgEqType, eqidAllocated]);

    const contextValue: IRms = useMemo(() => ({
        eqid,
        mfgEqType,
        EQIDAllocated: eqidAllocated,
        eqidAllocated,
        mfg,
        mfgVsProdline,
        mfgVsMfgEqtype,
        mfgRelation,
        datasets,
        loading,
        isLoading: loading,
        error,
        setEqid,
        setMfgEqType,
        setEQIDAllocated: setEqidAllocated,
        setEqidAllocated,
        setMfg,
        setMfgVsProdline,
        setMfgVsMfgEqtype,
        setMfgRelation,
        setDatasets,
        selectedTicketCard,
        setSelectedTicketCard,
        loadEqid,
        loadMfgEqType,
        loadEQIDAllocated,
        loadMfg,
        loadAllRmsData,
    }), [
        eqid,
        mfgEqType,
        eqidAllocated,
        mfg,
        mfgVsProdline,
        mfgVsMfgEqtype,
        mfgRelation,
        datasets,
        loading,
        error,
        selectedTicketCard,
        setDatasets,
        loadEqid,
        loadMfgEqType,
        loadEQIDAllocated,
        loadMfg,
        loadAllRmsData,
    ]);

    return (
        <RmsContext.Provider value={contextValue}>
            {children}
        </RmsContext.Provider>
    );
}

export { RmsContext, RmsProvider };
