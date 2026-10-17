import type { ITicketDoc } from '@n20a/libfsdb';
import { FnGetSourceDataset, SOURCE_DATASETS } from '../../../shared/allcommon/FnLoadSampleDatasets';
import type { IFirestoreContextValue } from '@n20a/libfsdb';

function formatTimestampOrDate(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
        const sec = (value as { seconds: number }).seconds;
        return new Date(sec * 1000).toISOString();
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    return String(value);
}

/**
 * Global unscoped in-memory store for all tickets across all businesses.
 * This guarantees the tickets dataset is never wiped when selecting a specific business.
 */
let cachedFullTickets: ITicketDoc[] | null = null;
let isFirestoreLoaded = false;

/**
 * Returns the currently cached full tickets array, or falls back to sample dataset.
 */
export function getFullTicketsCached(): ITicketDoc[] {
    if (cachedFullTickets && cachedFullTickets.length > 0) {
        return cachedFullTickets;
    }
    const source = FnGetSourceDataset('tickets') || [];
    cachedFullTickets = [...source];
    return cachedFullTickets;
}

/**
 * Updates the global cached tickets and syncs SOURCE_DATASETS.tickets.
 */
export function setFullTicketsCache(tickets: ITicketDoc[]): void {
    cachedFullTickets = [...tickets];
    SOURCE_DATASETS.tickets = cachedFullTickets;
}

/**
 * Updates a single ticket's status in the full tickets cache.
 * Returns the updated tickets array.
 */
export function updateTicketStatusInStore(
    ticketId: string,
    newStatus: string,
    lastupdated?: string
): ITicketDoc[] {
    const list = getFullTicketsCached();
    const updatedTime = lastupdated || new Date().toISOString();
    const cleanTid = String(ticketId).trim().toLowerCase();

    cachedFullTickets = list.map((t) => {
        const tId = String(t.ticketid || (t as any).id || '').trim().toLowerCase();
        if (tId === cleanTid) {
            return {
                ...t,
                status: newStatus,
                lastupdated: updatedTime,
            };
        }
        return t;
    });

    SOURCE_DATASETS.tickets = cachedFullTickets;
    return cachedFullTickets;
}

/**
 * Updates a single ticket's fields in the full tickets cache.
 * Returns the updated tickets array.
 */
export function updateTicketInStore(
    ticketId: string,
    updates: Partial<ITicketDoc>
): ITicketDoc[] {
    const list = getFullTicketsCached();
    const updatedTime = updates.lastupdated || new Date().toISOString();
    const cleanTid = String(ticketId).trim().toLowerCase();

    cachedFullTickets = list.map((t) => {
        const tId = String(t.ticketid || (t as any).id || '').trim().toLowerCase();
        if (tId === cleanTid) {
            return {
                ...t,
                ...updates,
                status: updates.status || t.status,
                lastupdated: updatedTime,
            };
        }
        return t;
    });

    SOURCE_DATASETS.tickets = cachedFullTickets;
    return cachedFullTickets;
}

/**
 * Adds a cloned or newly created ticket to the full tickets cache.
 * Returns the updated tickets array.
 */
export function addTicketToStore(newTicket: ITicketDoc): ITicketDoc[] {
    const list = getFullTicketsCached();
    cachedFullTickets = [newTicket, ...list];
    SOURCE_DATASETS.tickets = cachedFullTickets;
    return cachedFullTickets;
}

/**
 * Generates a unique cloned ticket ID based on the original ticket ID and existing tickets.
 */
export function generateClonedTicketId(originalId: string, existingTickets: ITicketDoc[]): string {
    const existingIds = new Set(
        existingTickets.map((t) => String(t.ticketid || (t as any).id || '').trim().toLowerCase())
    );

    const match = originalId.match(/^(.*?)_(\d+)$/);
    if (match) {
        const prefix = match[1];
        let maxNum = parseInt(match[2], 10);
        for (const t of existingTickets) {
            const tid = String(t.ticketid || (t as any).id || '').trim();
            const m = tid.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(\\d+)$`, 'i'));
            if (m) {
                const n = parseInt(m[1], 10);
                if (n > maxNum) maxNum = n;
            }
        }
        const nextSeqId = `${prefix}_${maxNum + 1}`;
        if (!existingIds.has(nextSeqId.toLowerCase())) {
            return nextSeqId;
        }
    }

    let counter = 1;
    let candidate = `${originalId}_${counter}`;
    while (existingIds.has(candidate.toLowerCase())) {
        counter++;
        candidate = `${originalId}_${counter}`;
    }
    return candidate;
}

/**
 * Step 1: Loads full tickets data across all businesses.
 * 1. Checks if cached in memory from Firestore (unless forceRefresh is true).
 * 2. If firestore is available, queries collectionGroup('tickets').
 * 3. Falls back to sample tickets dataset if firestore query returns empty or fails.
 */
export async function loadFullTickets(
    firestore?: IFirestoreContextValue | null,
    forceRefresh: boolean = false
): Promise<ITicketDoc[]> {
    if (!forceRefresh && isFirestoreLoaded && cachedFullTickets && cachedFullTickets.length > 0) {
        return cachedFullTickets;
    }

    if (firestore && typeof firestore.queryDocumentsGroup === 'function') {
        try {
            const res = await firestore.queryDocumentsGroup({ collectionName: 'tickets' });
            const rawList: Record<string, unknown>[] = Array.isArray(res?.data)
                ? (res.data as Record<string, unknown>[])
                : Array.isArray((res?.data as any)?.data)
                    ? ((res.data as any).data as Record<string, unknown>[])
                    : [];

            if (rawList.length > 0) {
                const mapped: ITicketDoc[] = rawList.map((d: any) => {
                    let bid = String(d.bid || d.businessid || d.businessId || d.bId || '').trim();
                    let cid = String(d.cid || d.contactid || d.contactId || d.cId || '').trim();
                    const ticketid = String(d.ticketid || d.id || d._id || '').trim();

                    // Extract bid from path if present (e.g. "businesses/bid_104/tickets/ticket_1")
                    const pathStr = String(d.path || d._path || d.docPath || d.__path || d.ref?.path || '');
                    if (!bid && pathStr) {
                        const m = pathStr.match(/businesses\/([^/]+)/i);
                        if (m) bid = m[1].trim();
                    }

                    // Extract bid from ticketid if missing
                    if (!bid && ticketid) {
                        const m = ticketid.match(/bid[_-]?\d+/i);
                        if (m) bid = m[0].trim();
                    }

                    // If BID is purely digits like "104", normalize to "bid_104"
                    if (bid && /^\d+$/.test(bid)) {
                        bid = `bid_${bid}`;
                    }

                    // Extract cid from ticketid if missing
                    if (!cid && ticketid) {
                        const m = ticketid.match(/cid[_-]?bid[_-]?\d+[_-]?\d+/i);
                        if (m) cid = m[0].trim();
                    }

                    return {
                        bid,
                        cid,
                        ticketid,
                        tickettype: String(d.tickettype || ''),
                        subscription: String(d.subscription || ''),
                        mfg: String(d.mfg || ''),
                        eqtype: String(d.eqtype || ''),
                        prodno: String(d.prodno || ''),
                        moreinfo: String(d.moreinfo || ''),
                        status: String(d.status || ''),
                        daterequested: formatTimestampOrDate(d.daterequested),
                        datereleased: formatTimestampOrDate(d.datereleased),
                        lastupdated: formatTimestampOrDate(d.lastupdated),
                        eqid: d.eqid ? String(d.eqid) : undefined,
                        monitor: Boolean(d.monitor),
                        monitorupdated: formatTimestampOrDate(d.monitorupdated),
                    };
                });

                // If we already had local in-memory status overrides, merge them
                if (cachedFullTickets && cachedFullTickets.length > 0) {
                    const localStatusMap = new Map<string, { status: string; lastupdated?: string }>();
                    for (const t of cachedFullTickets) {
                        const tid = String(t.ticketid || (t as any).id || '').trim().toLowerCase();
                        if (tid && t.status) {
                            localStatusMap.set(tid, { status: t.status, lastupdated: t.lastupdated });
                        }
                    }
                    for (let i = 0; i < mapped.length; i++) {
                        const tid = String(mapped[i].ticketid || (mapped[i] as any).id || '').trim().toLowerCase();
                        const local = localStatusMap.get(tid);
                        if (local) {
                            mapped[i] = {
                                ...mapped[i],
                                status: local.status,
                                lastupdated: local.lastupdated || mapped[i].lastupdated,
                            };
                        }
                    }
                }

                isFirestoreLoaded = true;
                setFullTicketsCache(mapped);
                return mapped;
            }
        } catch (err) {
            console.warn('Failed to query tickets group from Firestore:', err);
        }
    }

    // Fallback to sample dataset
    const fallback = FnGetSourceDataset('tickets') || [];
    if (!cachedFullTickets || cachedFullTickets.length === 0) {
        setFullTicketsCache(fallback);
    }
    isFirestoreLoaded = true;
    return cachedFullTickets ?? fallback;
}
