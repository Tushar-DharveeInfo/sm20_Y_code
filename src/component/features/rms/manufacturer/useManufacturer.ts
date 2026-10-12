import { useCallback, useEffect, useRef, useState } from 'react';
import { useFirestore } from '@n20a/libfsdb';
import { useRmsContext } from '../../../shared/context/hooks/RmsHooks';
import { useStatusBarContext } from '../../../shared/context/hooks/StatusBarHooks';
import {
    addMfgVsMfgEqtype,
    addMfgVsProdline,
    deleteMfg,
    deleteMfgVsMfgEqtype,
    deleteMfgVsProdline,
    fetchEQIDAllocated,
    fetchMfgVsMfgEqtype,
    fetchMfgVsProdline,
} from '../../../shared/sidebar/rms/eqidsidebar/MfgCollectionsService';
import type { IMfgRecord } from '../../../shared/context/allinterface/IRms';

export function normalizeMfgKey(key: string): string {
    return (key || '').trim().toUpperCase();
}

export interface IManufacturerData {
    acronym: string;
    mfgName: string;
    address?: string;
    website?: string;
}

export interface IUseManufacturerResult {
    loading: boolean;
    error: string | null;
    statusMessage: string;
    setStatusMessage: (msg: string) => void;
    manufacturers: IMfgRecord[];
    findMfg: (acronym: string) => IMfgRecord | undefined;
    loadAllMfg: (refresh?: boolean) => Promise<IMfgRecord[] | null>;
    loadProdlines: (acronym: string) => Promise<string[]>;
    loadEqtypes: (acronym: string) => Promise<string[]>;
    addManufacturer: (data: IManufacturerData) => Promise<{ success: boolean; error?: string }>;
    updateManufacturer: (data: IManufacturerData, original: IMfgRecord) => Promise<{ success: boolean; error?: string }>;
    deleteManufacturer: (acronym: string) => Promise<{ success: boolean; error?: string }>;
    genericModifyMappingTable: (
        tableType: 'relation' | 'prodline' | 'eqtype',
        acronym: string,
        itemValue: string,
        isDelete: boolean
    ) => Promise<{ success: boolean; result?: Record<string, string[]>; error?: string }>;
    addProdline: (acronym: string, prodline: string) => Promise<{ success: boolean; error?: string }>;
    deleteProdline: (acronym: string, prodline: string) => Promise<{ success: boolean; error?: string }>;
    addMfgEqtype: (acronym: string, eqtype: string) => Promise<{ success: boolean; error?: string }>;
    deleteMfgEqtype: (acronym: string, eqtype: string) => Promise<{ success: boolean; error?: string }>;
    addMfgRelation: (acronym: string, relatedKey: string) => Promise<{ success: boolean; error?: string }>;
    deleteMfgRelation: (acronym: string, relatedKey: string) => Promise<{ success: boolean; error?: string }>;
    isManufacturerInUse: (acronym: string) => Promise<boolean>;
}

export function useManufacturer(): IUseManufacturerResult {
    const firestore = useFirestore();
    const rmsContext = useRmsContext();
    const statusBarContext = useStatusBarContext();

    const [loading, setLoading] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    const prodlineCacheRef = useRef(rmsContext.mfgVsProdline);
    const eqtypeCacheRef = useRef(rmsContext.mfgVsMfgEqtype);
    prodlineCacheRef.current = rmsContext.mfgVsProdline;
    eqtypeCacheRef.current = rmsContext.mfgVsMfgEqtype;

    const { mfg, loadMfg: rmsLoadMfg } = rmsContext;

    // Load initial manufacturers list if empty
    useEffect(() => {
        if (mfg.length === 0) {
            setLoading(true);
            void rmsLoadMfg().finally(() => {
                setLoading(false);
            });
        }
    }, [mfg.length, rmsLoadMfg]);

    // Sync status bar loading
    useEffect(() => {
        const isBusy = loading && mfg.length === 0;
        if (isBusy) {
            statusBarContext?.setIsLoading?.(true);
            statusBarContext?.setLoadingLabel?.('Loading...');
        } else {
            statusBarContext?.setIsLoading?.(false);
            statusBarContext?.setLoadingLabel?.(undefined);
        }
    }, [loading, mfg.length, statusBarContext]);

    const findMfg = useCallback((acronym: string): IMfgRecord | undefined => {
        const target = normalizeMfgKey(acronym);
        return mfg.find((row) => normalizeMfgKey(row.mfgkey) === target);
    }, [mfg]);

    const loadAllMfg = useCallback(async (refresh?: boolean): Promise<IMfgRecord[] | null> => {
        setLoading(true);
        try {
            return await rmsLoadMfg(refresh);
        } finally {
            setLoading(false);
        }
    }, [rmsLoadMfg]);

    const loadProdlines = useCallback(async (acronym: string): Promise<string[]> => {
        const key = normalizeMfgKey(acronym);
        if (!key) return [];
        if (Object.prototype.hasOwnProperty.call(prodlineCacheRef.current, key)) {
            return prodlineCacheRef.current[key] ?? [];
        }
        if (!firestore) return [];
        const list = await fetchMfgVsProdline(acronym, firestore);
        const sorted = [...list].sort((a, b) => a.localeCompare(b));
        rmsContext.setMfgVsProdline((prev) => (
            Object.prototype.hasOwnProperty.call(prev, key) ? prev : { ...prev, [key]: sorted }
        ));
        return sorted;
    }, [firestore, rmsContext]);

    const loadEqtypes = useCallback(async (acronym: string): Promise<string[]> => {
        const key = normalizeMfgKey(acronym);
        if (!key) return [];
        if (Object.prototype.hasOwnProperty.call(eqtypeCacheRef.current, key)) {
            return eqtypeCacheRef.current[key] ?? [];
        }
        if (!firestore) return [];
        const list = await fetchMfgVsMfgEqtype(acronym, firestore);
        const sorted = [...list].sort((a, b) => a.localeCompare(b));
        rmsContext.setMfgVsMfgEqtype((prev) => (
            Object.prototype.hasOwnProperty.call(prev, key) ? prev : { ...prev, [key]: sorted }
        ));
        return sorted;
    }, [firestore, rmsContext]);

    const isManufacturerInUse = useCallback(async (acronym: string): Promise<boolean> => {
        const key = normalizeMfgKey(acronym);
        if (!key) return false;

        const record = findMfg(acronym);
        const name = (record?.mfgname || '').trim().toLowerCase();

        // 1. Check prodlines
        let prodlines = rmsContext.mfgVsProdline[key];
        if (!prodlines && firestore) {
            prodlines = await fetchMfgVsProdline(acronym, firestore);
        }
        if ((prodlines ?? []).length > 0) return true;

        // 2. Check equipment types
        let eqtypes = rmsContext.mfgVsMfgEqtype[key];
        if (!eqtypes && firestore) {
            eqtypes = await fetchMfgVsMfgEqtype(acronym, firestore);
        }
        if ((eqtypes ?? []).length > 0) return true;

        // 3. Check relations
        const relations = rmsContext.mfgRelation[key] ?? record?.relatedmfgs ?? [];
        if (relations.length > 0) return true;

        // 4. Check active eqid documents
        const usedByEqid = rmsContext.eqid.some((doc) => {
            const row = doc as unknown as Record<string, unknown>;
            const docAcronym = String(row.Acronym ?? row.acronym ?? '').trim();
            const docMfg = String(row.Manufacturer ?? row.manufacturer ?? '').trim();
            return normalizeMfgKey(docAcronym) === key || docMfg.toLowerCase() === name;
        });
        if (usedByEqid) return true;

        // 5. Check EQIDAllocated
        if (firestore) {
            const allocated = await fetchEQIDAllocated(acronym, firestore);
            if (allocated.length > 0) return true;
        }

        return false;
    }, [findMfg, firestore, rmsContext]);

    const addManufacturer = useCallback(async (
        data: IManufacturerData
    ): Promise<{ success: boolean; error?: string }> => {
        const acronym = data.acronym.trim();
        const mfgName = data.mfgName.trim();
        if (!acronym || !mfgName) {
            return { success: false, error: 'Enter Acronym and MfgName.' };
        }
        if (!firestore) {
            return { success: false, error: 'Cloud save is unavailable.' };
        }

        const normKey = normalizeMfgKey(acronym);
        const normName = mfgName.toLowerCase();
        const exists = rmsContext.mfg.some(
            (row) => normalizeMfgKey(row.mfgkey) === normKey || row.mfgname.trim().toLowerCase() === normName
        );
        if (exists) {
            return { success: false, error: 'Acronym and Mfg already exists.' };
        }

        const newRecord: IMfgRecord = {
            mfgkey: acronym,
            mfgname: mfgName,
            address: (data.address || '').trim(),
            website: (data.website || '').trim(),
            relatedmfgs: [],
        };

        try {
            await firestore.upsertDocument({
                pathSegments: ['mfg', acronym],
                data: {
                    [acronym]: mfgName,
                    mfgkey: acronym,
                    mfgname: mfgName,
                    address: newRecord.address,
                    website: newRecord.website,
                    relatedmfgs: [],
                    lastupdated: new Date().toISOString(),
                },
            });
        } catch {
            return { success: false, error: 'Unable to add manufacturer.' };
        }

        rmsContext.setMfg((prev) => [...prev, newRecord]);
        setStatusMessage('Added Mfg.');
        return { success: true };
    }, [firestore, rmsContext]);

    const updateManufacturer = useCallback(async (
        data: IManufacturerData,
        original: IMfgRecord
    ): Promise<{ success: boolean; error?: string }> => {
        const acronym = data.acronym.trim();
        const mfgName = data.mfgName.trim();
        if (!acronym || !mfgName) {
            return { success: false, error: 'Enter Acronym and MfgName.' };
        }
        if (!firestore) {
            return { success: false, error: 'Cloud save is unavailable.' };
        }

        const originalKey = normalizeMfgKey(original.mfgkey);
        const nextKey = normalizeMfgKey(acronym);
        const isKeyChanged = originalKey !== nextKey;

        if (isKeyChanged) {
            const inUse = await isManufacturerInUse(original.mfgkey);
            if (inUse) {
                return { success: false, error: 'Acronym and Mfg is in use.' };
            }
            const exists = rmsContext.mfg.some(
                (row) => normalizeMfgKey(row.mfgkey) === nextKey
            );
            if (exists) {
                return { success: false, error: 'Acronym already exists.' };
            }
        }

        const related = original.relatedmfgs ?? [];
        const savedKey = isKeyChanged ? acronym : original.mfgkey;

        try {
            await firestore.upsertDocument({
                pathSegments: ['mfg', savedKey],
                data: {
                    [savedKey]: mfgName,
                    mfgkey: savedKey,
                    mfgname: mfgName,
                    address: (data.address || '').trim(),
                    website: (data.website || '').trim(),
                    relatedmfgs: related,
                    lastupdated: new Date().toISOString(),
                },
            });

            if (isKeyChanged) {
                await deleteMfg(original.mfgkey, firestore);
            }
        } catch {
            return { success: false, error: 'Unable to save manufacturer.' };
        }

        const updatedRecord: IMfgRecord = {
            mfgkey: savedKey,
            mfgname: mfgName,
            address: (data.address || '').trim(),
            website: (data.website || '').trim(),
            relatedmfgs: related,
        };

        rmsContext.setMfg((prev) => {
            const filtered = prev.filter((row) => normalizeMfgKey(row.mfgkey) !== originalKey);
            return [...filtered, updatedRecord];
        });

        if (isKeyChanged) {
            rmsContext.setMfgRelation((prev) => {
                const next = { ...prev };
                if (next[originalKey]) {
                    next[nextKey] = next[originalKey];
                    delete next[originalKey];
                }
                return next;
            });
        }

        setStatusMessage('Saved Mfg.');
        return { success: true };
    }, [firestore, isManufacturerInUse, rmsContext]);

    const deleteManufacturer = useCallback(async (
        acronym: string
    ): Promise<{ success: boolean; error?: string }> => {
        const record = findMfg(acronym);
        if (!record || !firestore) {
            return { success: false, error: 'Manufacturer not found or cloud unavailable.' };
        }

        const inUse = await isManufacturerInUse(record.mfgkey);
        if (inUse) {
            return { success: false, error: 'Acronym and Mfg is in use.' };
        }

        const removed = await deleteMfg(record.mfgkey, firestore);
        if (!removed) {
            return { success: false, error: 'Unable to delete manufacturer.' };
        }

        const key = normalizeMfgKey(record.mfgkey);
        rmsContext.setMfg((prev) => prev.filter((row) => normalizeMfgKey(row.mfgkey) !== key));
        rmsContext.setMfgVsProdline((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        rmsContext.setMfgVsMfgEqtype((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        rmsContext.setMfgRelation((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });

        setStatusMessage('Deleted Mfg.');
        return { success: true };
    }, [findMfg, firestore, isManufacturerInUse, rmsContext]);

    /**
     * Generic function to add or delete items in mapping tables (MfgRelation, Prodline, MfgEqType).
     * Returns { [MfgAcronym]: [<items>, ...] } and syncs with cache and cloud.
     */
    const genericModifyMappingTable = useCallback(async (
        tableType: 'relation' | 'prodline' | 'eqtype',
        acronym: string,
        itemValue: string,
        isDelete: boolean
    ): Promise<{ success: boolean; result?: Record<string, string[]>; error?: string }> => {
        const label = tableType === 'relation' ? 'MfgRelation' : tableType === 'prodline' ? 'Prodline' : 'MfgEqType';
        const trimmed = itemValue.trim();
        if (!trimmed) {
            return { success: false, error: isDelete ? `Select a ${label} to delete.` : `Enter a ${label}.` };
        }

        const row = findMfg(acronym);
        if (!row) {
            return { success: false, error: 'Manufacturer not found.' };
        }

        const normKey = normalizeMfgKey(row.mfgkey);
        let current = tableType === 'relation'
            ? (rmsContext.mfgRelation[normKey] ?? rmsContext.mfgRelation[row.mfgkey] ?? row.relatedmfgs ?? [])
            : tableType === 'prodline'
                ? (rmsContext.mfgVsProdline[normKey] ?? rmsContext.mfgVsProdline[row.mfgkey] ?? [])
                : (rmsContext.mfgVsMfgEqtype[normKey] ?? rmsContext.mfgVsMfgEqtype[row.mfgkey] ?? []);

        // Fallback fetch if current mapping is empty
        if (current.length === 0) {
            if (tableType === 'prodline' && firestore) {
                const fetched = await fetchMfgVsProdline(acronym, firestore);
                if (fetched.length > 0) current = fetched;
            } else if (tableType === 'eqtype') {
                const fetched = firestore ? await fetchMfgVsMfgEqtype(acronym, firestore) : [];
                if (fetched.length > 0) current = fetched;
            }
        }

        const exists = current.some((item) => item.trim().toLowerCase() === trimmed.toLowerCase());
        if (!isDelete && exists) {
            return { success: false, error: `${label} already exists.` };
        }

        const updated = (isDelete
            ? current.filter((item) => item.trim().toLowerCase() !== trimmed.toLowerCase())
            : [...current, trimmed]
        ).sort((a, b) => a.localeCompare(b));

        if (tableType === 'relation') {
            if (firestore) {
                try {
                    await firestore.upsertDocument({
                        pathSegments: ['mfg', row.mfgkey],
                        data: {
                            [row.mfgkey]: row.mfgname,
                            mfgkey: row.mfgkey,
                            mfgname: row.mfgname,
                            address: row.address ?? '',
                            website: row.website ?? '',
                            relatedmfgs: updated,
                            lastupdated: new Date().toISOString(),
                        },
                    });
                } catch (err) {
                    console.warn('Unable to save MfgRelation to cloud:', err);
                }
            }

            rmsContext.setMfg((prev) => prev.map((item) => (
                item.mfgkey === row.mfgkey ? { ...item, relatedmfgs: updated } : item
            )));
            rmsContext.setMfgRelation((prev) => ({
                ...prev,
                [normKey]: updated,
                [row.mfgkey]: updated,
            }));
        } else if (tableType === 'prodline') {
            if (firestore) {
                try {
                    if (isDelete) {
                        await deleteMfgVsProdline(row.mfgkey, trimmed, firestore);
                    } else {
                        await addMfgVsProdline({ [row.mfgkey]: updated }, firestore);
                    }
                } catch (err) {
                    console.warn('Unable to save Prodline to cloud:', err);
                }
            }
            rmsContext.setMfgVsProdline((prev) => ({
                ...prev,
                [normKey]: updated,
                [row.mfgkey]: updated,
            }));
        } else {
            if (firestore) {
                try {
                    if (isDelete) {
                        await deleteMfgVsMfgEqtype(row.mfgkey, trimmed, firestore);
                    } else {
                        await addMfgVsMfgEqtype({ [row.mfgkey]: updated }, firestore);
                    }
                } catch (err) {
                    console.warn('Unable to save MfgEqType to cloud:', err);
                }
            }
            rmsContext.setMfgVsMfgEqtype((prev) => ({
                ...prev,
                [normKey]: updated,
                [row.mfgkey]: updated,
            }));
        }

        const msg = `${isDelete ? 'Deleted' : 'Added'} ${label}.`;
        setStatusMessage(msg);
        return { success: true, result: { [row.mfgkey]: updated } };
    }, [findMfg, firestore, rmsContext, setStatusMessage]);

    const addProdline = useCallback(
        (acronym: string, prodline: string) => genericModifyMappingTable('prodline', acronym, prodline, false),
        [genericModifyMappingTable]
    );

    const deleteProdline = useCallback(
        (acronym: string, prodline: string) => genericModifyMappingTable('prodline', acronym, prodline, true),
        [genericModifyMappingTable]
    );

    const addMfgEqtype = useCallback(
        (acronym: string, eqtype: string) => genericModifyMappingTable('eqtype', acronym, eqtype, false),
        [genericModifyMappingTable]
    );

    const deleteMfgEqtype = useCallback(
        (acronym: string, eqtype: string) => genericModifyMappingTable('eqtype', acronym, eqtype, true),
        [genericModifyMappingTable]
    );

    const addMfgRelation = useCallback(
        (acronym: string, relatedKey: string) => genericModifyMappingTable('relation', acronym, relatedKey, false),
        [genericModifyMappingTable]
    );

    const deleteMfgRelation = useCallback(
        (acronym: string, relatedKey: string) => genericModifyMappingTable('relation', acronym, relatedKey, true),
        [genericModifyMappingTable]
    );

    return {
        loading,
        error: rmsContext.error,
        statusMessage,
        setStatusMessage,
        manufacturers: rmsContext.mfg,
        findMfg,
        loadAllMfg,
        loadProdlines,
        loadEqtypes,
        addManufacturer,
        updateManufacturer,
        deleteManufacturer,
        genericModifyMappingTable,
        addProdline,
        deleteProdline,
        addMfgEqtype,
        deleteMfgEqtype,
        addMfgRelation,
        deleteMfgRelation,
        isManufacturerInUse,
    };
}
