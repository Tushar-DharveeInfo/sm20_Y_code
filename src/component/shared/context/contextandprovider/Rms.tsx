import { createContext, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useFirestore } from "@n20a/libfsdb";
import { IAppContextWrapper } from "../allinterface/IAppContextWrapper";
import type {
    IEqidAllocatedDoc,
    IEqidDoc,
    IMfgEqTypeDoc,
    IRms,
    IRmsDatasetCache,
} from "../allinterface/IRms";

const RmsContext = createContext<IRms | undefined>(undefined);

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

    // 3. EQIDAllocated dataset (loaded from table: eqidallocated)
    const [eqidAllocated, setEqidAllocated] = useState<IEqidAllocatedDoc[]>([]);
    const eqidAllocatedRef = useRef<IEqidAllocatedDoc[]>(eqidAllocated);
    eqidAllocatedRef.current = eqidAllocated;

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
                const docs = (result.data as unknown as IEqidDoc[]).map((d: any) => ({
                    ...d,
                    eqid: String(d.eqid || d.id || d.key || '').trim(),
                }));
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
                const docs = (result.data as unknown as IEqidAllocatedDoc[]).map((d: any) => ({
                    ...d,
                    eqid: String(d.eqid || d.id || d.key || '').trim(),
                }));
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
        datasets,
        loading,
        isLoading: loading,
        error,
        setEqid,
        setMfgEqType,
        setEQIDAllocated: setEqidAllocated,
        setEqidAllocated,
        setDatasets,
        loadEqid,
        loadMfgEqType,
        loadEQIDAllocated,
        loadAllRmsData,
    }), [
        eqid,
        mfgEqType,
        eqidAllocated,
        datasets,
        loading,
        error,
        setDatasets,
        loadEqid,
        loadMfgEqType,
        loadEQIDAllocated,
        loadAllRmsData,
    ]);

    return (
        <RmsContext.Provider value={contextValue}>
            {children}
        </RmsContext.Provider>
    );
}

export { RmsContext, RmsProvider };
