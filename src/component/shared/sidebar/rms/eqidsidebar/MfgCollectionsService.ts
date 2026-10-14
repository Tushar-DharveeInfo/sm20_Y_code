import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { useFirestore } from '@n20a/libfsdb';
import type { IOptionItem } from '@n20a/libform';
import { IEqidDoc } from '@n20a/libfsdb';
import { getEqtypes } from '@n20a/libform';
import EQIDAllocatedData from '../rmscollection/EQIDAllocated.json';
import MfgVsProdlineData from '../rmscollection/MfgVsProdline.json';

/** Top-level collection: mfg */
export interface IMfg {
  [mfgkey: string]: string;
}
export type IMfgDoc = IMfg;

/** mfg sub-collection: eqidallocated */
export interface IEQIDAllocated {
  [mfgkey: string]: string[];
}
export type IEqidAllocatedDoc = IEQIDAllocated;

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

type FirestoreInstance = ReturnType<typeof useFirestore> | null;

/**
 * Normalizes a key for case-insensitive lookup.
 */
function normalizeKey(key: string): string {
  return (key || '').trim().toUpperCase();
}

/**
 * Extracts key and value from an IMfg record { [mfgkey]: mfgname }.
 */
export function extractMfgEntry(record: any): { mfgkey: string; mfgname: string } {
  if (!record || typeof record !== 'object') {
    return { mfgkey: '', mfgname: '' };
  }
  if (record.mfgkey && record.mfgname) {
    return { mfgkey: String(record.mfgkey).trim(), mfgname: String(record.mfgname).trim() };
  }
  if (record.id && record[record.id]) {
    return { mfgkey: String(record.id).trim(), mfgname: String(record[record.id]).trim() };
  }
  const ignored = new Set(['id', 'path', 'lastupdated', '_id']);
  const keys = Object.keys(record).filter((k) => !ignored.has(k) && typeof record[k] === 'string');
  if (keys.length === 0) {
    if (record.id) {
      return { mfgkey: String(record.id).trim(), mfgname: String(record.name || record.id).trim() };
    }
    return { mfgkey: '', mfgname: '' };
  }
  const mfgkey = keys[0];
  const mfgname = String(record[mfgkey] ?? '').trim();
  return { mfgkey, mfgname: mfgname || mfgkey };
}

/**
 * Extracts key and string[] list from a mapping record { [mfgkey]: string[] }.
 */
export function extractListEntry(record: Record<string, string[]>): { key: string; items: string[] } {
  if (!record || typeof record !== 'object') {
    return { key: '', items: [] };
  }
  const keys = Object.keys(record);
  if (keys.length === 0) return { key: '', items: [] };
  const key = keys[0];
  const items = Array.isArray(record[key]) ? record[key] : [];
  return { key, items };
}

/**
 * Safely extracts a string array associated with cleanKey or any array field from a Firestore document.
 */
export function extractArrayFromDoc(doc: any, targetKey: string): string[] | null {
  if (!doc || typeof doc !== 'object') return null;
  const clean = (targetKey || '').trim();
  const upper = clean.toUpperCase();
  const lower = clean.toLowerCase();

  if (Array.isArray(doc[clean]) && doc[clean].length > 0) return doc[clean].map(String);
  if (Array.isArray(doc[upper]) && doc[upper].length > 0) return doc[upper].map(String);
  if (Array.isArray(doc[lower]) && doc[lower].length > 0) return doc[lower].map(String);
  if (Array.isArray(doc.prodlines) && doc.prodlines.length > 0) return doc.prodlines.map(String);
  if (Array.isArray(doc.mfgeqtypes) && doc.mfgeqtypes.length > 0) return doc.mfgeqtypes.map(String);
  if (Array.isArray(doc.eqids) && doc.eqids.length > 0) return doc.eqids.map(String);
  if (Array.isArray(doc.keys) && doc.keys.length > 0) return doc.keys.map(String);

  // Search any other array property excluding metadata fields
  const ignored = new Set(['id', 'path', 'lastupdated', '_id']);
  for (const k of Object.keys(doc)) {
    if (!ignored.has(k) && Array.isArray(doc[k]) && doc[k].length > 0) {
      return doc[k].map(String);
    }
  }

  if (Array.isArray(doc[clean])) return [];
  if (Array.isArray(doc[upper])) return [];
  if (Array.isArray(doc[lower])) return [];

  return null;
}

// ============================================================================
// CLOUD CRUD FUNCTIONS: Root collection mfg
// ============================================================================

/**
 * Fetches all mfg records from cloud Firestore root collection 'mfg'.
 */
export async function fetchAllMfg(firestore: FirestoreInstance): Promise<IMfg[]> {
  if (!firestore) return [];
  try {
    const result = await firestore.queryDocuments({ pathSegments: ['mfg'] });
    if (result && Array.isArray(result.data)) {
      return result.data.map((d: any) => {
        // Handle { [mfgkey]: mfgname } or { mfgkey, mfgname }
        if (d.mfgkey && d.mfgname) {
          return { [d.mfgkey]: d.mfgname };
        }
        if (d.id && typeof d[d.id] === 'string') {
          return { [d.id]: d[d.id] };
        }
        const cleaned: IMfg = {};
        for (const [k, v] of Object.entries(d)) {
          if (k !== 'id' && k !== 'path' && typeof v === 'string') {
            cleaned[k] = v;
          }
        }
        return cleaned;
      });
    }
  } catch (err) {
    console.warn('Failed to query root collection mfg from cloud:', err);
  }
  return [];
}

/**
 * Adds one mfg record to cloud Firestore root collection 'mfg'.
 */
export async function addMfg(record: IMfg, firestore: FirestoreInstance): Promise<boolean> {
  const { mfgkey, mfgname } = extractMfgEntry(record);
  if (!mfgkey || !firestore) return false;
  try {
    const payload = {
      [mfgkey]: mfgname,
      mfgkey,
      mfgname,
      lastupdated: new Date().toISOString(),
    };
    await firestore.upsertDocument({
      pathSegments: ['mfg', mfgkey],
      data: payload,
    });
    return true;
  } catch (err) {
    console.error(`Failed to add mfg "${mfgkey}" to cloud:`, err);
    return false;
  }
}

/**
 * Deletes one mfg record from cloud Firestore root collection 'mfg'.
 */
export async function deleteMfg(mfgkey: string, firestore: FirestoreInstance): Promise<boolean> {
  const cleanKey = (mfgkey || '').trim();
  if (!cleanKey || !firestore) return false;
  try {
    await firestore.deleteDocument({
      pathSegments: ['mfg', cleanKey],
    });
    return true;
  } catch (err) {
    console.error(`Failed to delete mfg "${cleanKey}" from cloud:`, err);
    return false;
  }
}

// ============================================================================
// CLOUD CRUD FUNCTIONS: EQIDAllocated (mfg/{mfgkey}/eqidallocated)
// ============================================================================

/**
 * Fetches allocated EQIDs for a single mfgkey from cloud.
 */
export async function fetchEQIDAllocated(mfgkey: string, firestore: FirestoreInstance): Promise<string[]> {
  const cleanKey = (mfgkey || '').trim();
  if (!cleanKey) return [];

  if (firestore) {
    try {
      const queryResult = await firestore.queryDocuments({
        pathSegments: ['mfg', cleanKey, 'eqidallocated'],
      });
      const docs = Array.isArray(queryResult?.data)
        ? queryResult.data
        : Array.isArray((queryResult as any)?.result?.data)
          ? (queryResult as any).result.data
          : [];
      for (const doc of docs) {
        const list = extractArrayFromDoc(doc, cleanKey);
        if (list && list.length > 0) {
          return list;
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch cloud EQIDAllocated for ${cleanKey}:`, err);
    }
  }

  // Fallback to local dataset
  const upper = cleanKey.toUpperCase();
  const entry = (EQIDAllocatedData as Record<string, string[]>[]).find((item) =>
    Object.keys(item).some((k) => k.toUpperCase() === upper)
  );
  if (entry) {
    const k = Object.keys(entry).find((key) => key.toUpperCase() === upper) || upper;
    return entry[k] ?? [];
  }

  const partial = (EQIDAllocatedData as Record<string, string[]>[]).find((item) => {
    const k = Object.keys(item)[0];
    return k && (upper.startsWith(k.toUpperCase()) || k.toUpperCase().startsWith(upper));
  });
  return partial ? Object.values(partial)[0] ?? [] : [];
}

/**
 * Adds an IEQIDAllocated record to cloud.
 */
export async function addEQIDAllocated(record: IEQIDAllocated, firestore: FirestoreInstance): Promise<boolean> {
  const { key: mfgkey, items: eqids } = extractListEntry(record);
  if (!mfgkey || !firestore) return false;
  try {
    await firestore.upsertDocument({
      pathSegments: ['mfg', mfgkey, 'eqidallocated', mfgkey],
      data: {
        [mfgkey]: eqids,
        mfgkey,
        lastupdated: new Date().toISOString(),
      },
    });
    return true;
  } catch (err) {
    console.error(`Failed to add EQIDAllocated for ${mfgkey}:`, err);
    return false;
  }
}

/**
 * Deletes an allocated EQID key for a manufacturer from cloud.
 */
export async function deleteEQIDAllocated(
  mfgkey: string,
  EQIDAllocatedkey: string,
  firestore: FirestoreInstance
): Promise<boolean> {
  const cleanMfg = (mfgkey || '').trim();
  const cleanKey = (EQIDAllocatedkey || '').trim();
  if (!cleanMfg || !firestore) return false;
  try {
    const current = await fetchEQIDAllocated(cleanMfg, firestore);
    const updated = current.filter((k) => k !== cleanKey);
    if (updated.length > 0) {
      await firestore.upsertDocument({
        pathSegments: ['mfg', cleanMfg, 'eqidallocated', cleanMfg],
        data: { [cleanMfg]: updated, lastupdated: new Date().toISOString() },
      });
    } else {
      await firestore.deleteDocument({
        pathSegments: ['mfg', cleanMfg, 'eqidallocated', cleanMfg],
      });
    }
    return true;
  } catch (err) {
    console.error(`Failed to delete EQIDAllocated ${cleanKey} for ${cleanMfg}:`, err);
    return false;
  }
}

// ============================================================================
// CLOUD CRUD FUNCTIONS: MfgVsProdline (mfg/{mfgkey}/mfgvsprodline)
// ============================================================================

/**
 * Fetches prodlines for a single mfgkey from cloud.
 */
export async function fetchMfgVsProdline(mfgkey: string, firestore: FirestoreInstance): Promise<string[]> {
  const cleanKey = (mfgkey || '').trim();
  if (!cleanKey) return [];

  if (firestore) {
    try {
      const queryResult = await firestore.queryDocuments({
        pathSegments: ['mfg', cleanKey, 'mfgvsprodline'],
      });
      const docs = Array.isArray(queryResult?.data)
        ? queryResult.data
        : Array.isArray((queryResult as any)?.result?.data)
          ? (queryResult as any).result.data
          : [];
      for (const doc of docs) {
        const list = extractArrayFromDoc(doc, cleanKey);
        if (list && list.length > 0) {
          return list;
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch cloud MfgVsProdline for ${cleanKey}:`, err);
    }
  }

  // Fallback to local dataset
  const upper = cleanKey.toUpperCase();
  const entry = (MfgVsProdlineData as Record<string, string[]>[]).find((item) =>
    Object.keys(item).some((k) => k.toUpperCase() === upper)
  );
  if (entry) {
    const k = Object.keys(entry).find((key) => key.toUpperCase() === upper) || upper;
    return entry[k] ?? [];
  }

  const partial = (MfgVsProdlineData as Record<string, string[]>[]).find((item) => {
    const k = Object.keys(item)[0];
    return k && (upper.startsWith(k.toUpperCase()) || k.toUpperCase().startsWith(upper));
  });
  return partial ? Object.values(partial)[0] ?? [] : [];
}

/**
 * Adds an IMfgVsProdline record to cloud.
 */
export async function addMfgVsProdline(record: IMfgVsProdline, firestore: FirestoreInstance): Promise<boolean> {
  const { key: mfgkey, items: prodlines } = extractListEntry(record);
  if (!mfgkey || !firestore) return false;
  try {
    await firestore.upsertDocument({
      pathSegments: ['mfg', mfgkey, 'mfgvsprodline', mfgkey],
      data: {
        [mfgkey]: prodlines,
        mfgkey,
        lastupdated: new Date().toISOString(),
      },
    });
    return true;
  } catch (err) {
    console.error(`Failed to add MfgVsProdline for ${mfgkey}:`, err);
    return false;
  }
}

/**
 * Deletes a prodline key for a manufacturer from cloud.
 */
export async function deleteMfgVsProdline(
  mfgkey: string,
  MfgVsProdlinekey: string,
  firestore: FirestoreInstance
): Promise<boolean> {
  const cleanMfg = (mfgkey || '').trim();
  const cleanKey = (MfgVsProdlinekey || '').trim();
  if (!cleanMfg || !firestore) return false;
  try {
    const current = await fetchMfgVsProdline(cleanMfg, firestore);
    const updated = current.filter((k) => k !== cleanKey);
    if (updated.length > 0) {
      await firestore.upsertDocument({
        pathSegments: ['mfg', cleanMfg, 'mfgvsprodline', cleanMfg],
        data: { [cleanMfg]: updated, lastupdated: new Date().toISOString() },
      });
    } else {
      await firestore.deleteDocument({
        pathSegments: ['mfg', cleanMfg, 'mfgvsprodline', cleanMfg],
      });
    }
    return true;
  } catch (err) {
    console.error(`Failed to delete MfgVsProdline ${cleanKey} for ${cleanMfg}:`, err);
    return false;
  }
}

// ============================================================================
// CLOUD CRUD FUNCTIONS: MfgVsMfgEqtype (mfg/{mfgkey}/mfgvsmfgeqtype)
// ============================================================================

/**
 * Fetches mfgeqtypes for a single mfgkey (or eqtype) from cloud.
 */
export async function fetchMfgVsMfgEqtype(mfgkey: string, firestore: FirestoreInstance): Promise<string[]> {
  const cleanKey = (mfgkey || '').trim();
  if (!cleanKey) return getEqtypes();

  if (firestore) {
    try {
      const queryResult = await firestore.queryDocuments({
        pathSegments: ['mfg', cleanKey, 'mfgvsmfgeqtype'],
      });
      const docs = Array.isArray(queryResult?.data)
        ? queryResult.data
        : Array.isArray((queryResult as any)?.result?.data)
          ? (queryResult as any).result.data
          : [];
      for (const doc of docs) {
        const list = extractArrayFromDoc(doc, cleanKey);
        if (list && list.length > 0) {
          return list;
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch cloud MfgVsMfgEqtype for ${cleanKey}:`, err);
    }
  }

  return getEqtypes();
}

/**
 * Adds an IMfgVsMfgEqtype record to cloud.
 */
export async function addMfgVsMfgEqtype(record: IMfgVsMfgEqtype, firestore: FirestoreInstance): Promise<boolean> {
  const { key: mfgkey, items: mfgeqtypes } = extractListEntry(record);
  if (!mfgkey || !firestore) return false;
  try {
    await firestore.upsertDocument({
      pathSegments: ['mfg', mfgkey, 'mfgvsmfgeqtype', mfgkey],
      data: {
        [mfgkey]: mfgeqtypes,
        mfgkey,
        lastupdated: new Date().toISOString(),
      },
    });
    return true;
  } catch (err) {
    console.error(`Failed to add MfgVsMfgEqtype for ${mfgkey}:`, err);
    return false;
  }
}

/**
 * Deletes a mfgeqtype key for a manufacturer from cloud.
 */
export async function deleteMfgVsMfgEqtype(
  mfgkey: string,
  MfgVsMfgEqtypekey: string,
  firestore: FirestoreInstance
): Promise<boolean> {
  const cleanMfg = (mfgkey || '').trim();
  const cleanKey = (MfgVsMfgEqtypekey || '').trim();
  if (!cleanMfg || !firestore) return false;
  try {
    const current = await fetchMfgVsMfgEqtype(cleanMfg, firestore);
    const updated = current.filter((k) => k !== cleanKey);
    if (updated.length > 0) {
      await firestore.upsertDocument({
        pathSegments: ['mfg', cleanMfg, 'mfgvsmfgeqtype', cleanMfg],
        data: { [cleanMfg]: updated, lastupdated: new Date().toISOString() },
      });
    } else {
      await firestore.deleteDocument({
        pathSegments: ['mfg', cleanMfg, 'mfgvsmfgeqtype', cleanMfg],
      });
    }
    return true;
  } catch (err) {
    console.error(`Failed to delete MfgVsMfgEqtype ${cleanKey} for ${cleanMfg}:`, err);
    return false;
  }
}

// ============================================================================
// CLOUD SAVE: EQID Record (eqid/{eqid})
// ============================================================================

/**
 * Saves an updated EQID record to cloud Firestore root collection 'eqid'.
 */
export async function saveEQIDToCloud(record: IEqidDoc, firestore: FirestoreInstance): Promise<boolean> {
  if (!record || !firestore) return false;
  const eqidKey = String((record as any).eqid || record.ticketid || '').trim();
  if (!eqidKey) return false;

  try {
    await firestore.upsertDocument({
      pathSegments: ['eqid', eqidKey],
      data: {
        ...(record as unknown as Record<string, unknown>),
        eqid: eqidKey,
        lastupdated: new Date().toISOString(),
      },
    });
    return true;
  } catch (err) {
    console.error(`Failed to save EQID "${eqidKey}" to cloud:`, err);
    return false;
  }
}

// ============================================================================
// REACT HOOK: useMfgCollections
// Provides cached cloud data and functions matching IEQIDEditFormProfile
// ============================================================================

export interface IUseMfgCollectionsResult {
  mfgList: IMfg[];
  mfgKeys: string[];
  mfgMap: Record<string, string>;
  mfgOptions: IOptionItem[];
  loading: boolean;
  error: string | null;

  // Functions matching IEQIDEditFormProfile
  getMfg: () => string[];
  getEQIDAllocated: (mfgkey: string) => string[];
  getMfgProdLine: (mfgkey: string) => string[];
  getMfgEqType: (eqtypeOrMfg: string) => string[];
  SaveEQID: (updatedEQIDRecord: IEqidDoc) => Promise<boolean>;

  // CRUD operations
  addMfg: (record: IMfg) => Promise<boolean>;
  deleteMfg: (mfgkey: string) => Promise<boolean>;
  addEQIDAllocated: (record: IEQIDAllocated) => Promise<boolean>;
  deleteEQIDAllocated: (mfgkey: string, key: string) => Promise<boolean>;
  addMfgVsProdline: (record: IMfgVsProdline) => Promise<boolean>;
  deleteMfgVsProdline: (mfgkey: string, key: string) => Promise<boolean>;
  addMfgVsMfgEqtype: (record: IMfgVsMfgEqtype) => Promise<boolean>;
  deleteMfgVsMfgEqtype: (mfgkey: string, key: string) => Promise<boolean>;

  // Helper
  getMfgTooltip: (mfgkey: string) => string;
  resolveMfgKey: (nameOrKey: string) => string;
}

export function useMfgCollections(firestore: FirestoreInstance): IUseMfgCollectionsResult {
  const [mfgList, setMfgList] = useState<IMfg[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // In-memory cache for subcollections
  const eqidAllocatedCacheRef = useRef<Record<string, string[]>>({});
  const mfgVsProdlineCacheRef = useRef<Record<string, string[]>>({});
  const mfgVsMfgEqtypeCacheRef = useRef<Record<string, string[]>>({});

  // 1. Initial load of all mfg records from cloud
  const loadMfgList = useCallback(async () => {
    if (!firestore) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAllMfg(firestore);
      setMfgList(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load mfg from cloud');
    } finally {
      setLoading(false);
    }
  }, [firestore]);

  useEffect(() => {
    void loadMfgList();
  }, [loadMfgList]);

  // Derived: map of mfgkey -> mfgname
  const mfgMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of mfgList) {
      const { mfgkey, mfgname } = extractMfgEntry(item);
      if (mfgkey) {
        map[mfgkey] = mfgname;
      }
    }
    return map;
  }, [mfgList]);

  // Derived: map of mfgname (lowercase) -> mfgkey
  const mfgNameToKeyMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [key, name] of Object.entries(mfgMap)) {
      if (name) {
        map[name.trim().toLowerCase()] = key;
      }
      map[key.trim().toLowerCase()] = key;
    }
    return map;
  }, [mfgMap]);

  const resolveMfgKey = useCallback((nameOrKey: string): string => {
    if (!nameOrKey) return '';
    const trimmed = nameOrKey.trim().toLowerCase();
    return mfgNameToKeyMap[trimmed] || nameOrKey.trim();
  }, [mfgNameToKeyMap]);

  // Derived: array of mfgkey strings
  const mfgKeys = useMemo(() => {
    const keys = Object.keys(mfgMap);
    if (keys.length > 0) return keys.sort();

    // Fallback: extract distinct keys from local datasets if cloud is empty
    const localKeys = new Set<string>();
    for (const item of MfgVsProdlineData as Record<string, string[]>[]) {
      const k = Object.keys(item)[0];
      if (k) localKeys.add(k);
    }
    for (const item of EQIDAllocatedData as Record<string, string[]>[]) {
      const k = Object.keys(item)[0];
      if (k) localKeys.add(k);
    }
    return Array.from(localKeys).sort();
  }, [mfgMap]);

  // Derived: IOptionItem[] with tooltip support
  const mfgOptions = useMemo<IOptionItem[]>(() => {
    return mfgKeys.map((key) => ({
      value: key,
      label: key,
      tooltip: mfgMap[key] || key,
    }));
  }, [mfgKeys, mfgMap]);

  const getMfgTooltip = useCallback((mfgkey: string): string => {
    const resolved = resolveMfgKey(mfgkey);
    const k = normalizeKey(resolved || mfgkey);
    return mfgMap[k] || mfgMap[mfgkey] || '';
  }, [mfgMap, resolveMfgKey]);

  // --------------------------------------------------------------------------
  // Prop Functions for IEQIDEditFormProfile
  // --------------------------------------------------------------------------

  // getMfg: returns string[] of display manufacturer names (ex. "Generic CommScope")
  const getMfg = useCallback((): string[] => {
    const names: string[] = [];
    const seen = new Set<string>();

    for (const [key, name] of Object.entries(mfgMap)) {
      const displayName = String(name || key).trim();
      if (displayName && !seen.has(displayName)) {
        seen.add(displayName);
        names.push(displayName);
      }
    }

    if (names.length === 0) {
      for (const key of mfgKeys) {
        if (!seen.has(key)) {
          seen.add(key);
          names.push(key);
        }
      }
    }

    return names.sort((a, b) => a.localeCompare(b));
  }, [mfgMap, mfgKeys]);

  // getEQIDAllocated: returns string[] of allocated eqids for given mfgkey (or mfg name)
  const getEQIDAllocated = useCallback((mfgkey: string): string[] => {
    const resolved = resolveMfgKey(mfgkey);
    const key = normalizeKey(resolved || mfgkey);
    if (!key) return [];

    // Check cache
    if (eqidAllocatedCacheRef.current[key]) {
      return eqidAllocatedCacheRef.current[key];
    }

    // Trigger background fetch if firestore is available
    if (firestore) {
      void fetchEQIDAllocated(key, firestore).then((res) => {
        if (res && res.length > 0) {
          eqidAllocatedCacheRef.current[key] = res;
        }
      });
    }

    // Immediate return from fallback dataset
    const entry = (EQIDAllocatedData as Record<string, string[]>[]).find((item) =>
      Object.keys(item).some((k) => k.toUpperCase() === key)
    );
    if (entry) {
      const matchKey = Object.keys(entry).find((k) => k.toUpperCase() === key) || key;
      const list = entry[matchKey] ?? [];
      eqidAllocatedCacheRef.current[key] = list;
      return list;
    }

    const partial = (EQIDAllocatedData as Record<string, string[]>[]).find((item) => {
      const k = Object.keys(item)[0];
      return k && (key.startsWith(k.toUpperCase()) || k.toUpperCase().startsWith(key));
    });
    const list = partial ? Object.values(partial)[0] ?? [] : [];
    if (list.length > 0) {
      eqidAllocatedCacheRef.current[key] = list;
    }
    return list;
  }, [firestore, resolveMfgKey]);

  // getMfgProdLine: returns string[] of prodlines for given mfgkey (or mfg name)
  const getMfgProdLine = useCallback((mfgkey: string): string[] => {
    const resolved = resolveMfgKey(mfgkey);
    const key = normalizeKey(resolved || mfgkey);
    if (!key) return [];

    if (mfgVsProdlineCacheRef.current[key]) {
      return mfgVsProdlineCacheRef.current[key];
    }

    if (firestore) {
      void fetchMfgVsProdline(key, firestore).then((res) => {
        if (res && res.length > 0) {
          mfgVsProdlineCacheRef.current[key] = res;
        }
      });
    }

    const entry = (MfgVsProdlineData as Record<string, string[]>[]).find((item) =>
      Object.keys(item).some((k) => k.toUpperCase() === key)
    );
    if (entry) {
      const matchKey = Object.keys(entry).find((k) => k.toUpperCase() === key) || key;
      const list = entry[matchKey] ?? [];
      mfgVsProdlineCacheRef.current[key] = list;
      return list;
    }

    const partial = (MfgVsProdlineData as Record<string, string[]>[]).find((item) => {
      const k = Object.keys(item)[0];
      return k && (key.startsWith(k.toUpperCase()) || k.toUpperCase().startsWith(key));
    });
    const list = partial ? Object.values(partial)[0] ?? [] : [];
    if (list.length > 0) {
      mfgVsProdlineCacheRef.current[key] = list;
    }
    return list;
  }, [firestore]);

  // getMfgEqType: returns string[] of mfgeqtypes for given eqtype / mfgkey
  const getMfgEqType = useCallback((eqtypeOrMfg: string): string[] => {
    const key = normalizeKey(eqtypeOrMfg);
    if (!key) return getEqtypes();

    if (mfgVsMfgEqtypeCacheRef.current[key]) {
      return mfgVsMfgEqtypeCacheRef.current[key];
    }

    if (firestore) {
      void fetchMfgVsMfgEqtype(key, firestore).then((res) => {
        if (res && res.length > 0) {
          mfgVsMfgEqtypeCacheRef.current[key] = res;
        }
      });
    }

    // Check MfgVsProdline fallback or getEqtypes()
    const entry = (MfgVsProdlineData as Record<string, string[]>[]).find((item) =>
      Object.keys(item).some((k) => k.toUpperCase() === key)
    );
    if (entry && entry[key] && entry[key].length > 0) {
      return entry[key];
    }

    return getEqtypes();
  }, [firestore]);

  // SaveEQID: saves updated EQID record to cloud
  const handleSaveEQID = useCallback(async (updatedEQIDRecord: IEqidDoc): Promise<boolean> => {
    const ok = await saveEQIDToCloud(updatedEQIDRecord, firestore);
    return ok;
  }, [firestore]);

  // --------------------------------------------------------------------------
  // Mutators
  // --------------------------------------------------------------------------

  const handleAddMfg = useCallback(async (record: IMfg): Promise<boolean> => {
    const ok = await addMfg(record, firestore);
    if (ok) {
      setMfgList((prev) => [...prev, record]);
    }
    return ok;
  }, [firestore]);

  const handleDeleteMfg = useCallback(async (mfgkey: string): Promise<boolean> => {
    const ok = await deleteMfg(mfgkey, firestore);
    if (ok) {
      setMfgList((prev) => prev.filter((item) => Object.keys(item)[0] !== mfgkey));
    }
    return ok;
  }, [firestore]);

  const handleAddEQIDAllocated = useCallback(async (record: IEQIDAllocated): Promise<boolean> => {
    const { key, items } = extractListEntry(record);
    const ok = await addEQIDAllocated(record, firestore);
    if (ok && key) {
      eqidAllocatedCacheRef.current[normalizeKey(key)] = items;
    }
    return ok;
  }, [firestore]);

  const handleDeleteEQIDAllocated = useCallback(async (mfgkey: string, key: string): Promise<boolean> => {
    const ok = await deleteEQIDAllocated(mfgkey, key, firestore);
    if (ok) {
      const norm = normalizeKey(mfgkey);
      const curr = eqidAllocatedCacheRef.current[norm] || [];
      eqidAllocatedCacheRef.current[norm] = curr.filter((k) => k !== key);
    }
    return ok;
  }, [firestore]);

  const handleAddMfgVsProdline = useCallback(async (record: IMfgVsProdline): Promise<boolean> => {
    const { key, items } = extractListEntry(record);
    const ok = await addMfgVsProdline(record, firestore);
    if (ok && key) {
      mfgVsProdlineCacheRef.current[normalizeKey(key)] = items;
    }
    return ok;
  }, [firestore]);

  const handleDeleteMfgVsProdline = useCallback(async (mfgkey: string, key: string): Promise<boolean> => {
    const ok = await deleteMfgVsProdline(mfgkey, key, firestore);
    if (ok) {
      const norm = normalizeKey(mfgkey);
      const curr = mfgVsProdlineCacheRef.current[norm] || [];
      mfgVsProdlineCacheRef.current[norm] = curr.filter((k) => k !== key);
    }
    return ok;
  }, [firestore]);

  const handleAddMfgVsMfgEqtype = useCallback(async (record: IMfgVsMfgEqtype): Promise<boolean> => {
    const { key, items } = extractListEntry(record);
    const ok = await addMfgVsMfgEqtype(record, firestore);
    if (ok && key) {
      mfgVsMfgEqtypeCacheRef.current[normalizeKey(key)] = items;
    }
    return ok;
  }, [firestore]);

  const handleDeleteMfgVsMfgEqtype = useCallback(async (mfgkey: string, key: string): Promise<boolean> => {
    const ok = await deleteMfgVsMfgEqtype(mfgkey, key, firestore);
    if (ok) {
      const norm = normalizeKey(mfgkey);
      const curr = mfgVsMfgEqtypeCacheRef.current[norm] || [];
      mfgVsMfgEqtypeCacheRef.current[norm] = curr.filter((k) => k !== key);
    }
    return ok;
  }, [firestore]);

  return useMemo(() => ({
    mfgList,
    mfgKeys,
    mfgMap,
    mfgOptions,
    loading,
    error,
    getMfg,
    getEQIDAllocated,
    getMfgProdLine,
    getMfgEqType,
    SaveEQID: handleSaveEQID,
    addMfg: handleAddMfg,
    deleteMfg: handleDeleteMfg,
    addEQIDAllocated: handleAddEQIDAllocated,
    deleteEQIDAllocated: handleDeleteEQIDAllocated,
    addMfgVsProdline: handleAddMfgVsProdline,
    deleteMfgVsProdline: handleDeleteMfgVsProdline,
    addMfgVsMfgEqtype: handleAddMfgVsMfgEqtype,
    deleteMfgVsMfgEqtype: handleDeleteMfgVsMfgEqtype,
    getMfgTooltip,
    resolveMfgKey,
  }), [
    mfgList,
    mfgKeys,
    mfgMap,
    mfgOptions,
    loading,
    error,
    getMfg,
    getEQIDAllocated,
    getMfgProdLine,
    getMfgEqType,
    handleSaveEQID,
    handleAddMfg,
    handleDeleteMfg,
    handleAddEQIDAllocated,
    handleDeleteEQIDAllocated,
    handleAddMfgVsProdline,
    handleDeleteMfgVsProdline,
    handleAddMfgVsMfgEqtype,
    handleDeleteMfgVsMfgEqtype,
    getMfgTooltip,
    resolveMfgKey,
  ]);
}
