import type { IContactDoc, IFirestoreContextValue } from '@n20a/libfsdb';
import { FnMapToContactDoc } from './FnMapToContactDoc';

export const CONTACT_SELECT_KEYS: string[] = [
    'bid',
    'cid',
    'cname',
    'email',
    'phone',
    'role',
    'status',
    'contacttype',
    'title',
    'department',
    'address1',
    'address2',
    'city',
    'state',
    'country',
    'zip',
    'countrycode',
    'timezoneoffset',
    'donotcallme',
    'removemefrommailinglist',
    'smsoptin',
    'datecreated',
    'dateupdated',
    'ctag',
    'monitor',
    'monitorupdated',
    'id',
    'EntID',
    'name',
    'contact',
    'phone1',
    'ctype',
    'verified',
    'address_street',
    'address_city',
    'address_state',
    'address_country',
    'address_zip',
    'dateCreated',
    'dateUpdated',
    'lastupdated',
];

/**
 * Global unscoped in-memory store for all contacts across all businesses.
 */
let cachedAllContacts: IContactDoc[] | null = null;
let isContactsFirestoreLoaded = false;
let inFlightContactsPromise: Promise<IContactDoc[]> | null = null;

export function getFullContactsCached(): IContactDoc[] {
    return cachedAllContacts ?? [];
}

export function setFullContactsCache(contacts: IContactDoc[]): void {
    cachedAllContacts = contacts;
}

export function updateContactInStore(contactId: string, updates: Partial<IContactDoc>): IContactDoc[] {
    const list = getFullContactsCached();
    const cleanCid = String(contactId).trim().toLowerCase();
    cachedAllContacts = list.map((c) => {
        const cId = String(c.cid || (c as any).id || '').trim().toLowerCase();
        if (cId === cleanCid) {
            return { ...c, ...updates };
        }
        return c;
    });
    return cachedAllContacts;
}

export function addContactToStore(newContact: IContactDoc): IContactDoc[] {
    const list = getFullContactsCached();
    cachedAllContacts = [newContact, ...list];
    return cachedAllContacts;
}

export function removeContactFromStore(contactId: string): IContactDoc[] {
    const list = getFullContactsCached();
    const cleanCid = String(contactId).trim().toLowerCase();
    cachedAllContacts = list.filter((c) => {
        const cId = String(c.cid || (c as any).id || '').trim().toLowerCase();
        return cId !== cleanCid;
    });
    return cachedAllContacts;
}

export function parseContactDoc(d: Record<string, unknown>, fallbackBid?: string): IContactDoc {
    let bid = String(d.bid || (d as any).businessid || (d as any).businessId || (d as any).bId || fallbackBid || '').trim();
    let cid = String(d.cid || (d as any).contactid || (d as any).contactId || (d as any).cId || d.id || (d as any).EntID || '').trim();

    // Extract bid from path if present (e.g. "businesses/bid_104/contacts/cid_104_1")
    const pathStr = String(d.path || (d as any)._path || (d as any).docPath || (d as any).__path || (d as any).ref?.path || '');
    if (!bid && pathStr) {
        const m = pathStr.match(/businesses\/([^/]+)/i);
        if (m) bid = m[1].trim();
    }

    // Extract cid from path if present
    if (!cid && pathStr) {
        const m = pathStr.match(/contacts\/([^/]+)/i);
        if (m) cid = m[1].trim();
    }

    // Extract bid from cid if missing
    if (!bid && cid) {
        const m = cid.match(/bid[_-]?\d+/i);
        if (m) bid = m[0].trim();
    }

    // If BID is purely digits like "104", normalize to "bid_104"
    if (bid && /^\d+$/.test(bid)) {
        bid = `bid_${bid}`;
    }

    return FnMapToContactDoc({ ...d, bid, cid }, bid);
}

/**
 * Merges newly fetched contacts into an existing contacts array,
 * updating matching records by (bid, cid) and appending new ones.
 */
export function mergeContactsIntoDataset(
    existing: IContactDoc[] = [],
    newContacts: IContactDoc[] = []
): IContactDoc[] {
    const merged = [...existing];
    for (const doc of newContacts) {
        const docCid = String(doc.cid || (doc as any).id || '').trim().toLowerCase();
        const docBid = String(doc.bid || '').trim().toLowerCase();
        const idx = merged.findIndex((c) => {
            const cCid = String(c.cid || (c as any).id || '').trim().toLowerCase();
            const cBid = String(c.bid || '').trim().toLowerCase();
            if (docBid && cBid) {
                return cCid === docCid && cBid === docBid;
            }
            return cCid === docCid;
        });
        if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...doc };
        } else {
            merged.push(doc);
        }
    }
    return merged;
}

/**
 * Loads all contacts across all businesses.
 * 1. Returns in-memory cache if available (unless forceRefresh is true).
 * 2. Deduplicates concurrent in-flight requests into 1 single promise.
 * 3. Uses firestore.queryDocumentsGroup({ collectionName: 'contacts', selectKeys: [...] })
 *    to fetch in 1 single network request.
 * 4. Falls back to per-business fetching if queryDocumentsGroup fails or returns empty.
 */
export async function loadAllContacts(
    firestore?: IFirestoreContextValue | null,
    forceRefresh: boolean = false,
    fallbackBids?: string[]
): Promise<IContactDoc[]> {
    if (!forceRefresh && isContactsFirestoreLoaded && cachedAllContacts && cachedAllContacts.length > 0) {
        return cachedAllContacts;
    }

    if (!forceRefresh && inFlightContactsPromise) {
        return inFlightContactsPromise;
    }

    const doLoad = async (): Promise<IContactDoc[]> => {
        try {
            let rawList: Record<string, unknown>[] = [];

            // 1. Try Collection Group query to fetch all contacts across businesses in 1 single call
            if (firestore && typeof firestore.queryDocumentsGroup === 'function') {
                try {
                    const groupRes = await firestore.queryDocumentsGroup({
                        collectionName: 'contacts',
                        selectKeys: CONTACT_SELECT_KEYS,
                    });
                    const groupItems = Array.isArray(groupRes?.data)
                        ? (groupRes.data as Record<string, unknown>[])
                        : Array.isArray((groupRes?.data as any)?.data)
                            ? ((groupRes.data as any).data as Record<string, unknown>[])
                            : [];

                    if (groupItems && groupItems.length > 0) {
                        rawList = groupItems;
                    }
                } catch (groupErr) {
                    console.warn('[loadAllContacts] queryDocumentsGroup fallback:', groupErr);
                }
            }

            // 2. Fallback to querying per-business if group query failed or returned no items
            if (rawList.length === 0 && firestore && typeof firestore.queryDocuments === 'function') {
                let bids = fallbackBids && fallbackBids.length > 0 ? fallbackBids : [];
                if (bids.length === 0) {
                    try {
                        const bRes = await firestore.queryDocuments({ pathSegments: ['businesses'] });
                        const businessList = Array.isArray(bRes?.data)
                            ? (bRes.data as any[])
                            : Array.isArray((bRes?.data as any)?.data)
                                ? ((bRes.data as any).data as any[])
                                : [];
                        bids = businessList
                            .map((b: any) => String(b.bid || b.EntID || b.id || '').trim())
                            .filter(Boolean);
                    } catch { }
                }

                if (bids.length > 0) {
                    const uniqueBids = Array.from(new Set(bids.map((b) => String(b).trim()).filter(Boolean)));
                    const results = await Promise.allSettled(
                        uniqueBids.map((bid) =>
                            firestore.queryDocuments({
                                pathSegments: ['businesses', bid, 'contacts'],
                            })
                        )
                    );
                    results.forEach((r, idx) => {
                        if (r.status === 'fulfilled' && r.value?.data) {
                            const bid = uniqueBids[idx];
                            const list = Array.isArray(r.value.data)
                                ? (r.value.data as Record<string, unknown>[])
                                : Array.isArray((r.value.data as any)?.data)
                                    ? ((r.value.data as any).data as Record<string, unknown>[])
                                    : [];
                            for (const item of list) {
                                rawList.push({ ...item, bid: item.bid || bid });
                            }
                        }
                    });
                }
            }

            if (rawList.length > 0) {
                const mapped = rawList.map((item) => parseContactDoc(item));
                cachedAllContacts = mapped;
                isContactsFirestoreLoaded = true;
                return mapped;
            }

            return cachedAllContacts ?? [];
        } finally {
            inFlightContactsPromise = null;
        }
    };

    inFlightContactsPromise = doLoad();
    return inFlightContactsPromise;
}
