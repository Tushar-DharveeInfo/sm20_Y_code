import type { ITicketDoc } from '@n20a/libfsdb';
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
 * Determines whether a ticket record represents a deleted, discarded, or not accepted ticket.
 */
export function isTicketDeleted(t: unknown): boolean {
    if (!t || typeof t !== 'object') return false;
    const ticket = t as Record<string, unknown>;
    const s = String(ticket.status ?? ticket.Status ?? '').trim().toLowerCase().replace(/[-_\s]+/g, '');
    const isDel = ticket.isdeleted ?? ticket.isDeleted ?? ticket.deleted ?? ticket.isDelete ?? ticket.isdelete;
    if (isDel === true || isDel === 1 || isDel === '1' || isDel === 'true') {
        return true;
    }
    return (
        s === 'deleted' ||
        s === 'tobedeleted' ||
        s === 'delete' ||
        s === 'notaccepted' ||
        s === 'discarded'
    );
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
        return cachedFullTickets.filter((t) => !isTicketDeleted(t));
    }
    return [];
}

/**
 * Updates the global cached tickets.
 */
export function setFullTicketsCache(tickets: ITicketDoc[]): void {
    cachedFullTickets = tickets.filter((t) => !isTicketDeleted(t));
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
    if (isTicketDeleted({ status: newStatus })) {
        return removeTicketFromStore(ticketId);
    }
    const list = getFullTicketsCached();
    const updatedTime = lastupdated || new Date().toISOString();
    const cleanTid = String(ticketId).trim().toLowerCase();

    cachedFullTickets = list
        .filter((t) => !isTicketDeleted(t))
        .map((t) => {
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
    if (isTicketDeleted(updates)) {
        return removeTicketFromStore(ticketId);
    }
    const list = getFullTicketsCached();
    const updatedTime = updates.lastupdated || new Date().toISOString();
    const cleanTid = String(ticketId).trim().toLowerCase();

    cachedFullTickets = list
        .filter((t) => !isTicketDeleted(t))
        .map((t) => {
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

    return cachedFullTickets;
}

/**
 * Adds a cloned or newly created ticket to the full tickets cache.
 * Returns the updated tickets array.
 */
export function addTicketToStore(newTicket: ITicketDoc): ITicketDoc[] {
    const list = getFullTicketsCached();
    cachedFullTickets = [newTicket, ...list];
    return cachedFullTickets;
}

/**
 * Removes a ticket from the full tickets cache.
 * Returns the updated tickets array.
 */
export function removeTicketFromStore(ticketId: string): ITicketDoc[] {
    const list = getFullTicketsCached();
    const cleanTid = String(ticketId).trim().toLowerCase();
    cachedFullTickets = list.filter((t) => {
        const tId = String(t.ticketid || (t as any).id || '').trim().toLowerCase();
        return tId !== cleanTid;
    });
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
 * 2. Queries tickets per business via firestore.queryDocuments (matching useBusinessTickets hook path).
 * 3. Returns empty array if firestore query returns empty or fails.
 */
export async function loadFullTickets(
    firestore?: IFirestoreContextValue | null,
    forceRefresh: boolean = false,
    knownBusinesses?: Array<{ bid?: string; EntID?: string; id?: string }>
): Promise<ITicketDoc[]> {
    if (!forceRefresh && isFirestoreLoaded && cachedFullTickets && cachedFullTickets.length > 0) {
        return cachedFullTickets;
    }

    if (firestore && typeof firestore.queryDocuments === 'function') {
        try {
            let businessList = knownBusinesses && knownBusinesses.length > 0 ? knownBusinesses : [];
            if (businessList.length === 0) {
                const bRes = await firestore.queryDocuments({ pathSegments: ['businesses'] });
                businessList = Array.isArray(bRes?.data)
                    ? (bRes.data as any[])
                    : Array.isArray((bRes?.data as any)?.data)
                        ? ((bRes.data as any).data as any[])
                        : [];
            }
            const bids = businessList
                .map((b: any) => String(b.bid || b.EntID || b.id || '').trim())
                .filter(Boolean);

            if (bids.length > 0) {
                const results = await Promise.allSettled(
                    bids.map((bid) => firestore.queryDocuments({ pathSegments: ['businesses', bid, 'tickets'] }))
                );
                const rawList: Record<string, unknown>[] = [];
                results.forEach((r, idx) => {
                    if (r.status === 'fulfilled' && r.value?.data) {
                        const bid = bids[idx];
                        const list = Array.isArray(r.value.data)
                            ? (r.value.data as Record<string, unknown>[])
                            : Array.isArray((r.value.data as any)?.data)
                                ? ((r.value.data as any).data as Record<string, unknown>[])
                                : [];
                        for (const d of list) {
                            rawList.push({ ...d, bid: d.bid || bid });
                        }
                    }
                });

                if (rawList.length > 0) {
                    const mapped: ITicketDoc[] = rawList
                        .filter((d: any) => !isTicketDeleted(d))
                        .map((d: any) => {
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
            }
        } catch (err) {
            console.warn('Failed to query tickets per business from Firestore:', err);
        }
    }

    if (!cachedFullTickets || cachedFullTickets.length === 0) {
        setFullTicketsCache([]);
    }
    isFirestoreLoaded = true;
    return cachedFullTickets ?? [];
}
