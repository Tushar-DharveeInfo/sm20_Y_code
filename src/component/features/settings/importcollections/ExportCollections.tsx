import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TextControl } from '@n20a/libform';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { useFirestore, type CollectionName } from '@n20a/libfsdb';

type FirestoreRecord = Record<string, unknown> & {
    id?: string;
    path?: string;
};

type ParentScope = 'root' | 'business' | 'ticket' | 'order' | 'sub' | 'mfg';

type CollectionDescriptor = {
    name: CollectionName;
    isRoot: boolean;
    parentScope: ParentScope;
};

const EXPORT_FILE_NAME = 'ExportedCollections.xlsx';
const QUERY_PAGE_SIZE = 1000;
const MAX_EXPORT_DOCUMENTS = 31999;
// Bound how many parent documents (businesses, mfg docs, etc.) are traversed at once so a
// deep collection (e.g. thousands of mfg docs) doesn't run thousands of sequential round trips.
const TRAVERSAL_CONCURRENCY = 8;
// Fail a single network call instead of letting the whole export hang forever on one stuck request.
const REQUEST_TIMEOUT_MS = 30_000;
// How often to report progress while traversing a large list of parent documents.
const PROGRESS_LOG_INTERVAL = 100;

const COLLECTION_DESCRIPTORS: readonly CollectionDescriptor[] = [
    { name: 'ap', isRoot: true, parentScope: 'root' },
    { name: 'reminder', isRoot: true, parentScope: 'root' },
    { name: 'prospect', isRoot: true, parentScope: 'root' },
    { name: 'tenantidmap', isRoot: true, parentScope: 'root' },
    { name: 'eqid', isRoot: true, parentScope: 'root' },
    { name: 'mfg', isRoot: true, parentScope: 'root' },
    { name: 'businesses', isRoot: true, parentScope: 'root' },
    { name: 'contacts', isRoot: false, parentScope: 'business' },
    { name: 'notes', isRoot: false, parentScope: 'business' },
    { name: 'tickets', isRoot: false, parentScope: 'business' },
    { name: 'activities', isRoot: false, parentScope: 'business' },
    { name: 'orders', isRoot: false, parentScope: 'business' },
    { name: 'subs', isRoot: false, parentScope: 'business' },
    { name: 'eqidallocated', isRoot: false, parentScope: 'mfg' },
    { name: 'mfgvsprodline', isRoot: false, parentScope: 'mfg' },
    { name: 'mfgvsmfgeqtype', isRoot: false, parentScope: 'mfg' },
    { name: 'mfgvsmfgrelation', isRoot: false, parentScope: 'mfg' },
    { name: 'ticketnotes', isRoot: false, parentScope: 'ticket' },
    { name: 'downloads', isRoot: false, parentScope: 'sub' },
    { name: 'carts', isRoot: false, parentScope: 'order' },
    { name: 'supporthoursused', isRoot: false, parentScope: 'order' },
] as const;

class ExportLimitError extends Error {
    constructor(collectionName: CollectionName) {
        super(`Skipped "${collectionName}" because it has 32000 or more documents.`);
        this.name = 'ExportLimitError';
    }
}

class RequestTimeoutError extends Error {
    constructor(label: string, timeoutMs: number) {
        super(`Timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${label}.`);
        this.name = 'RequestTimeoutError';
    }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new RequestTimeoutError(label, timeoutMs));
        }, timeoutMs);

        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

// Runs `worker` over `items` with at most `concurrency` calls in flight at once, instead of
// awaiting each item one at a time. If `worker` throws (e.g. ExportLimitError), already
// in-flight calls are allowed to settle but no further items are scheduled.
async function mapWithConcurrency<TItem, TResult>(
    items: readonly TItem[],
    concurrency: number,
    worker: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> {
    const results: TResult[] = new Array(items.length);
    let nextIndex = 0;
    let firstError: unknown;

    async function runNext(): Promise<void> {
        while (firstError === undefined) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            if (currentIndex >= items.length) {
                return;
            }
            try {
                results[currentIndex] = await worker(items[currentIndex], currentIndex);
            } catch (error) {
                if (firstError === undefined) {
                    firstError = error;
                }
                return;
            }
        }
    }

    const workerCount = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(Array.from({ length: workerCount }, () => runNext()));

    if (firstError !== undefined) {
        throw firstError;
    }

    return results;
}

function isTimestampShape(value: unknown): value is { seconds?: number; nanoseconds?: number; _seconds?: number; _nanoseconds?: number } {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const timestampCandidate = value as { seconds?: unknown; nanoseconds?: unknown; _seconds?: unknown; _nanoseconds?: unknown };
    return (
        typeof timestampCandidate.seconds === 'number' ||
        typeof timestampCandidate._seconds === 'number'
    );
}

function normalizeCellValue(value: unknown): string | number | boolean | null {
    if (value == null) {
        return null;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (isTimestampShape(value)) {
        const seconds = typeof value.seconds === 'number' ? value.seconds : value._seconds;
        const nanoseconds = typeof value.nanoseconds === 'number' ? value.nanoseconds : value._nanoseconds;
        if (typeof seconds === 'number') {
            const millis = (seconds * 1000) + Math.floor((nanoseconds ?? 0) / 1_000_000);
            return new Date(millis).toISOString();
        }
    }

    return JSON.stringify(value);
}

function getIdentifier(doc: FirestoreRecord, preferredField: string): string {
    const preferredValue = String(doc[preferredField] ?? '').trim();
    if (preferredValue) {
        return preferredValue;
    }

    const idValue = String(doc.id ?? '').trim();
    if (idValue) {
        return idValue;
    }

    return '';
}

// Firestore path segments can't be blank or contain "/" (the backend rejects the whole
// request with a 400 if any segment does); these would otherwise also be used as query
// path segments so filter them out before issuing a doomed request.
function isUsablePathSegment(value: string): boolean {
    return value.length > 0 && !value.includes('/');
}

// Extracts a usable identifier from each record, reporting how many records were skipped
// because they had no identifier or one that can't be used as a Firestore path segment.
function extractUsableIdentifiers(records: readonly FirestoreRecord[], field: string): { ids: string[]; skipped: number } {
    const ids: string[] = [];
    let skipped = 0;

    for (const record of records) {
        const identifier = getIdentifier(record, field);
        if (isUsablePathSegment(identifier)) {
            ids.push(identifier);
        } else if (identifier) {
            // Non-empty but unusable (e.g. contains "/"), as opposed to simply missing.
            skipped += 1;
        }
    }

    return { ids, skipped };
}

function createWorksheetRows(docs: FirestoreRecord[]): Array<Record<string, string | number | boolean | null>> {
    return docs.map((doc) => {
        const row: Record<string, string | number | boolean | null> = {};

        Object.entries(doc).forEach(([key, value]) => {
            if (key === 'id' || key === 'path' || value === undefined) {
                return;
            }
            row[key] = normalizeCellValue(value);
        });

        if (Object.keys(row).length === 0 && typeof doc.id === 'string' && doc.id.trim()) {
            row.id = doc.id.trim();
        }

        return row;
    });
}

function createWorksheet(rows: Array<Record<string, string | number | boolean | null>>): XLSX.WorkSheet {
    if (rows.length === 0) {
        return XLSX.utils.aoa_to_sheet([['No records found']]);
    }

    const headerSet = new Set<string>();
    rows.forEach((row) => {
        Object.keys(row).forEach((key) => headerSet.add(key));
    });

    const headers = Array.from(headerSet);
    if (headers.length === 0) {
        return XLSX.utils.aoa_to_sheet([['No exportable fields found']]);
    }

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    worksheet['!cols'] = headers.map((header) => {
        const valueWidth = rows.reduce((maxWidth, row) => {
            const nextValue = row[header];
            const nextWidth = nextValue == null ? 0 : String(nextValue).length;
            return Math.max(maxWidth, nextWidth);
        }, header.length);

        return { wch: Math.min(Math.max(valueWidth + 2, 14), 60) };
    });

    return worksheet;
}

const ExportCollections = () => {
    const cfg = (window as Window & { APP_CONFIG?: Record<string, string> }).APP_CONFIG ?? {};
    const firestore = useFirestore();

    const [selectedCollections, setSelectedCollections] = useState<CollectionName[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const [hasExportStarted, setHasExportStarted] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [logLines, setLogLines] = useState<string[]>([]);
    const bottomPaneRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (bottomPaneRef.current) {
            bottomPaneRef.current.scrollTop = bottomPaneRef.current.scrollHeight;
        }
    }, [logLines]);

    const appendLog = useCallback((line: string) => {
        setLogLines((prev) => [...prev, line]);
    }, []);

    const selectedDescriptors = useMemo(
        () => COLLECTION_DESCRIPTORS.filter((descriptor) => selectedCollections.includes(descriptor.name)),
        [selectedCollections],
    );

    const handleCollectionChecked = useCallback((collectionName: CollectionName, checked: boolean) => {
        setSelectedCollections((prev) => {
            if (checked) {
                return prev.includes(collectionName) ? prev : [...prev, collectionName];
            }
            return prev.filter((name) => name !== collectionName);
        });
    }, []);

    const fetchAllDocumentsForPath = useCallback(async (
        collectionName: CollectionName,
        pathSegments: string[],
        maxDocuments?: number,
    ): Promise<FirestoreRecord[]> => {
        const docs: FirestoreRecord[] = [];
        let pageToken: string | undefined;

        while (true) {
            const result = await withTimeout(
                firestore.queryDocuments({
                    pathSegments,
                    limit: QUERY_PAGE_SIZE,
                    ...(pageToken ? { pageToken } : {}),
                }),
                REQUEST_TIMEOUT_MS,
                `query "${pathSegments.join('/')}"`,
            );

            if (!result.success) {
                throw new Error(result.error || result.details || `Unable to query ${collectionName}.`);
            }

            const batch = Array.isArray(result.data) ? (result.data as FirestoreRecord[]) : [];
            docs.push(...batch);

            if (typeof maxDocuments === 'number' && docs.length > maxDocuments) {
                throw new ExportLimitError(collectionName);
            }

            const nextPageToken = result.pagination?.nextPageToken ?? null;
            if (!nextPageToken || batch.length === 0 || batch.length < QUERY_PAGE_SIZE) {
                break;
            }

            pageToken = nextPageToken;
        }

        return docs;
    }, [firestore]);

    const handleExport = useCallback(async () => {
        if (selectedDescriptors.length === 0 || isExporting) {
            return;
        }

        setHasExportStarted(true);
        setIsExporting(true);
        setStatusMessage('');
        setLogLines([]);

        const workbook = XLSX.utils.book_new();
        const exportedCollections: Array<{ name: CollectionName; count: number }> = [];
        const skippedCollections: string[] = [];
        const businessChildrenCache = new Map<string, FirestoreRecord[]>();
        const nestedCollectionCache = new Map<string, FirestoreRecord[]>();
        const mfgChildrenCache = new Map<string, FirestoreRecord[]>();
        let businessesCache: FirestoreRecord[] | null = null;
        let mfgCache: FirestoreRecord[] | null = null;

        const getBusinesses = async (): Promise<FirestoreRecord[]> => {
            if (!businessesCache) {
                appendLog('Loading businesses for collection traversal...');
                businessesCache = await fetchAllDocumentsForPath('businesses', ['businesses']);
                appendLog(`Loaded ${businessesCache.length} business record(s).`);
            }
            return businessesCache;
        };

        const getMfgDocuments = async (): Promise<FirestoreRecord[]> => {
            if (!mfgCache) {
                appendLog('Loading mfg documents for collection traversal...');
                mfgCache = await fetchAllDocumentsForPath('mfg', ['mfg']);
                appendLog(`Loaded ${mfgCache.length} mfg record(s).`);
            }
            return mfgCache;
        };

        const getBusinessScopedCollection = async (
            bid: string,
            collectionName: Extract<CollectionName, 'contacts' | 'notes' | 'tickets' | 'activities' | 'orders' | 'subs'>,
            maxDocuments?: number,
        ): Promise<FirestoreRecord[]> => {
            const cacheKey = `${collectionName}:${bid}`;
            if (!businessChildrenCache.has(cacheKey)) {
                businessChildrenCache.set(
                    cacheKey,
                    await fetchAllDocumentsForPath(collectionName, ['businesses', bid, collectionName], maxDocuments),
                );
            }
            return businessChildrenCache.get(cacheKey) ?? [];
        };

        const getNestedCollection = async (
            cacheKey: string,
            collectionName: Extract<CollectionName, 'ticketnotes' | 'carts' | 'supporthoursused' | 'downloads'>,
            pathSegments: string[],
            maxDocuments?: number,
        ): Promise<FirestoreRecord[]> => {
            if (!nestedCollectionCache.has(cacheKey)) {
                nestedCollectionCache.set(cacheKey, await fetchAllDocumentsForPath(collectionName, pathSegments, maxDocuments));
            }
            return nestedCollectionCache.get(cacheKey) ?? [];
        };

        const getMfgScopedCollection = async (
            mfgKey: string,
            collectionName: Extract<CollectionName, 'eqidallocated' | 'mfgvsprodline' | 'mfgvsmfgeqtype' | 'mfgvsmfgrelation'>,
            maxDocuments?: number,
        ): Promise<FirestoreRecord[]> => {
            const cacheKey = `${collectionName}:${mfgKey}`;
            if (!mfgChildrenCache.has(cacheKey)) {
                mfgChildrenCache.set(
                    cacheKey,
                    await fetchAllDocumentsForPath(collectionName, ['mfg', mfgKey, collectionName], maxDocuments),
                );
            }
            return mfgChildrenCache.get(cacheKey) ?? [];
        };

        const fetchCollectionDocuments = async (descriptor: CollectionDescriptor): Promise<FirestoreRecord[]> => {
            const collectedDocs: FirestoreRecord[] = [];
            const appendCollected = (docs: FirestoreRecord[]) => {
                collectedDocs.push(...docs);
            };
            const remainingAllowed = () => MAX_EXPORT_DOCUMENTS - collectedDocs.length;

            // Fetches one child collection per item with bounded concurrency instead of awaiting
            // each item sequentially, and periodically logs progress (based on actual completions,
            // not array index, since concurrent calls can finish out of order) so a long
            // traversal (e.g. thousands of mfg docs) doesn't look stuck. A failure for one item
            // (e.g. a 400 from the backend for that specific parent) is logged and skipped rather
            // than aborting the whole collection, so partial failures stay visible instead of
            // silently discarding the entire worksheet or silently dropping the failed item.
            const traverseItems = async <TItem,>(
                items: readonly TItem[],
                itemLabel: string,
                describeItem: (item: TItem) => string,
                fetchForItem: (item: TItem) => Promise<FirestoreRecord[]>,
            ): Promise<void> => {
                let processed = 0;
                let failed = 0;
                await mapWithConcurrency(items, TRAVERSAL_CONCURRENCY, async (item) => {
                    try {
                        const docs = await fetchForItem(item);
                        appendCollected(docs);
                    } catch (error) {
                        if (error instanceof ExportLimitError) {
                            throw error;
                        }
                        failed += 1;
                        const message = error instanceof Error ? error.message : String(error);
                        appendLog(`Warning: failed to fetch "${descriptor.name}" for ${itemLabel} "${describeItem(item)}": ${message}`);
                    }
                    processed += 1;
                    if (processed % PROGRESS_LOG_INTERVAL === 0 || processed === items.length) {
                        const failureSuffix = failed > 0 ? ` (${failed} failed)` : '';
                        appendLog(`Fetched "${descriptor.name}" for ${processed}/${items.length} ${itemLabel} record(s)...${failureSuffix}`);
                    }
                    if (collectedDocs.length > MAX_EXPORT_DOCUMENTS) {
                        throw new ExportLimitError(descriptor.name);
                    }
                });
            };

            // Flattens `{ bid, childId }` pairs across every business for a two-level traversal
            // (business -> tickets/orders/subs -> nested collection), fetching each business's
            // children concurrently rather than one business at a time.
            const getFlattenedChildren = async (
                childCollectionName: Extract<CollectionName, 'tickets' | 'orders' | 'subs'>,
                childIdField: string,
            ): Promise<Array<{ bid: string; childId: string }>> => {
                const businesses = await getBusinesses();
                const { ids: bids, skipped: skippedBusinesses } = extractUsableIdentifiers(businesses, 'bid');
                if (skippedBusinesses > 0) {
                    appendLog(`Skipped ${skippedBusinesses} business record(s) with an unusable "bid" (blank or contains "/").`);
                }

                const childrenPerBusiness = await mapWithConcurrency(bids, TRAVERSAL_CONCURRENCY, async (bid) => {
                    const children = await getBusinessScopedCollection(bid, childCollectionName);
                    const { ids: childIds } = extractUsableIdentifiers(children, childIdField);
                    return childIds.map((childId) => ({ bid, childId }));
                });

                return childrenPerBusiness.flat();
            };

            switch (descriptor.parentScope) {
                case 'root':
                    return fetchAllDocumentsForPath(descriptor.name, [descriptor.name], MAX_EXPORT_DOCUMENTS);

                case 'business': {
                    const businesses = await getBusinesses();
                    const { ids: bids, skipped: skippedBusinesses } = extractUsableIdentifiers(businesses, 'bid');
                    if (skippedBusinesses > 0) {
                        appendLog(`Skipped ${skippedBusinesses} business record(s) with an unusable "bid" (blank or contains "/").`);
                    }

                    await traverseItems(bids, 'business', (bid) => bid, (bid) => getBusinessScopedCollection(
                        bid,
                        descriptor.name as Extract<CollectionName, 'contacts' | 'notes' | 'tickets' | 'activities' | 'orders' | 'subs'>,
                        remainingAllowed(),
                    ));
                    return collectedDocs;
                }

                case 'ticket': {
                    const entries = await getFlattenedChildren('tickets', 'ticketid');
                    await traverseItems(
                        entries,
                        'ticket',
                        ({ bid, childId }) => `${bid}/${childId}`,
                        ({ bid, childId }) => getNestedCollection(
                            `${descriptor.name}:${bid}:${childId}`,
                            'ticketnotes',
                            ['businesses', bid, 'tickets', childId, 'ticketnotes'],
                            remainingAllowed(),
                        ),
                    );
                    return collectedDocs;
                }

                case 'order': {
                    const entries = await getFlattenedChildren('orders', 'orderid');
                    await traverseItems(
                        entries,
                        'order',
                        ({ bid, childId }) => `${bid}/${childId}`,
                        ({ bid, childId }) => getNestedCollection(
                            `${descriptor.name}:${bid}:${childId}`,
                            descriptor.name as Extract<CollectionName, 'carts' | 'supporthoursused'>,
                            ['businesses', bid, 'orders', childId, descriptor.name],
                            remainingAllowed(),
                        ),
                    );
                    return collectedDocs;
                }

                case 'sub': {
                    const entries = await getFlattenedChildren('subs', 'subsid');
                    await traverseItems(
                        entries,
                        'sub',
                        ({ bid, childId }) => `${bid}/${childId}`,
                        ({ bid, childId }) => getNestedCollection(
                            `${descriptor.name}:${bid}:${childId}`,
                            'downloads',
                            ['businesses', bid, 'subs', childId, 'downloads'],
                            remainingAllowed(),
                        ),
                    );
                    return collectedDocs;
                }

                case 'mfg': {
                    const mfgDocs = await getMfgDocuments();
                    const { ids: mfgKeys, skipped: skippedMfgDocs } = extractUsableIdentifiers(mfgDocs, 'mfgkey');
                    if (skippedMfgDocs > 0) {
                        appendLog(`Skipped ${skippedMfgDocs} mfg record(s) with an unusable "mfgkey" (blank or contains "/").`);
                    }

                    await traverseItems(mfgKeys, 'mfg', (mfgKey) => mfgKey, (mfgKey) => getMfgScopedCollection(
                        mfgKey,
                        descriptor.name as Extract<CollectionName, 'eqidallocated' | 'mfgvsprodline' | 'mfgvsmfgeqtype' | 'mfgvsmfgrelation'>,
                        remainingAllowed(),
                    ));
                    return collectedDocs;
                }
            }
        };

        try {
            appendLog(`Preparing export for ${selectedDescriptors.length} collection(s)...`);

            for (const descriptor of selectedDescriptors) {
                appendLog(`Fetching "${descriptor.name}"...`);
                try {
                    const docs = await fetchCollectionDocuments(descriptor);
                    const rows = createWorksheetRows(docs);
                    const worksheet = createWorksheet(rows);

                    XLSX.utils.book_append_sheet(workbook, worksheet, descriptor.name);
                    exportedCollections.push({ name: descriptor.name, count: docs.length });
                    appendLog(`Added worksheet "${descriptor.name}" with ${docs.length} document(s).`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : `Failed to export ${descriptor.name}.`;
                    skippedCollections.push(descriptor.name);
                    appendLog(message);
                }
            }

            if (exportedCollections.length === 0) {
                setStatusMessage('No workbook was created because every selected collection was skipped or failed.');
                return;
            }

            const workbookArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const workbookBlob = new Blob([workbookArray], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            saveAs(workbookBlob, EXPORT_FILE_NAME);

            const exportedSummary = exportedCollections
                .map((collection) => `${collection.name} (${collection.count})`)
                .join(', ');

            if (skippedCollections.length > 0) {
                setStatusMessage(
                    `Downloaded ${EXPORT_FILE_NAME} with ${exportedCollections.length} worksheet(s). Skipped: ${skippedCollections.join(', ')}.`,
                );
            } else {
                setStatusMessage(`Downloaded ${EXPORT_FILE_NAME} with worksheet(s): ${exportedSummary}.`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Export failed. Please try again.';
            console.error('ExportCollections: failed to export collections', error);
            setStatusMessage(message);
            appendLog(message);
        } finally {
            setIsExporting(false);
        }
    }, [appendLog, fetchAllDocumentsForPath, isExporting, selectedDescriptors]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div
                style={{
                    padding: '16px',
                    borderBottom: '1px solid var(--borderandscrollbar, #ccc)',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: '1 1 auto',
                    minHeight: 0,
                    gap: '16px',
                }}
            >
                <div style={{ overflowY: 'auto', minHeight: 0, paddingRight: '4px' }}>
                    <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>Export Collections to Excel</h2>
                    <TextControl
                        id="firebaseProject"
                        name="firebaseProject"
                        label="Firebase Project"
                        value={cfg.FIREBASE_PROJECT_ID ?? ''}
                        readOnly
                    />

                    <TextControl
                        id="bucket"
                        name="bucket"
                        label="Firebase Bucket"
                        value={cfg.FIREBASE_BUCKET ?? ''}
                        readOnly
                    />

                    <TextControl
                        id="fsdb"
                        name="fsdb"
                        label="Firestore DB Name"
                        value={cfg.FIREBASE_FSDB ?? 'default'}
                        readOnly
                    />

                    <div style={{ marginTop: '16px' }}>
                        <div style={{ marginBottom: '-10px', fontWeight: 600 }}>Collections ({COLLECTION_DESCRIPTORS.length})</div>
                        <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: 'var(--text-secondary, #666)' }}>
                            Each checked collection is exported to its own worksheet in {EXPORT_FILE_NAME}.
                            Collections with 32000 or more documents are skipped.
                        </p>                        
                        <div
                            style={{
                                border: '1px solid var(--borderandscrollbar, #ccc)',
                                borderRadius: '6px',
                                padding: '12px',
                                maxHeight: 'clamp(140px, 30vh, 280px)',
                                overflowY: 'auto',
                                backgroundColor: 'var(--surface, #fff)',
                            }}
                        >
                            {COLLECTION_DESCRIPTORS.map((descriptor) => {
                                const label = descriptor.isRoot ? `${descriptor.name} [Root]` : descriptor.name;
                                const isChecked = selectedCollections.includes(descriptor.name);
                                return (
                                    <label
                                        key={descriptor.name}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '4px 0',
                                            cursor: isExporting ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        <span
                                            style={{
                                                position: 'relative',
                                                display: 'inline-flex',
                                                width: '16px',
                                                height: '16px',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                disabled={isExporting}
                                                onChange={(event) => handleCollectionChecked(descriptor.name, event.target.checked)}
                                                style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    margin: 0,
                                                    width: '16px',
                                                    height: '16px',
                                                    opacity: 0,
                                                    cursor: isExporting ? 'not-allowed' : 'pointer',
                                                }}
                                            />
                                            <span
                                                aria-hidden
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '4px',
                                                    border: `1px solid ${isChecked ? 'var(--primary, #1a73e8)' : 'var(--borderandscrollbar, #999)'}`,
                                                    backgroundColor: isChecked ? 'var(--primary, #1a73e8)' : 'var(--surface, #fff)',
                                                    color: '#fff',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '12px',
                                                    fontWeight: 700,
                                                    lineHeight: 1,
                                                    transition: 'background-color 0.2s, border-color 0.2s, opacity 0.2s',
                                                    opacity: isExporting ? 0.6 : 1,
                                                }}
                                            >
                                                {isChecked ? '✓' : ''}
                                            </span>
                                        </span>
                                        <span>{label}</span>
                                    </label>
                                );
                            })}
                        </div>
                        {statusMessage && (
                            <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--text-secondary, #444)' }}>
                                {statusMessage}
                            </p>
                        )}
                    </div>
                </div>

                <button
                    title="Export selected collections to Excel"
                    disabled={isExporting || selectedCollections.length === 0}
                    onClick={handleExport}
                    style={{
                        padding: '10px 28px',
                        fontSize: '14px',
                        fontWeight: 600,
                        letterSpacing: '0.4px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: isExporting || selectedCollections.length === 0 ? 'not-allowed' : 'pointer',
                        backgroundColor: isExporting || selectedCollections.length === 0
                            ? 'var(--borderandscrollbar, #ccc)'
                            : 'var(--primary, #1a73e8)',
                        color: '#fff',
                        transition: 'background-color 0.2s, opacity 0.2s',
                        opacity: isExporting || selectedCollections.length === 0 ? 0.6 : 1,
                        minWidth: '140px',
                        alignSelf: 'flex-start',
                        flexShrink: 0,
                    }}
                >
                    {isExporting ? 'Exporting…' : 'Export'}
                </button>
            </div>
            {hasExportStarted && (
                <div
                    ref={bottomPaneRef}
                    style={{
                        flex: '0 0 auto',
                        minHeight: 96,
                        maxHeight: '28%',
                        overflow: 'auto',
                        padding: '16px',
                        borderTop: '1px solid var(--borderandscrollbar, #ccc)',
                    }}
                >
                    {logLines.map((line, index) => (
                        <div
                            key={index}
                            style={{ fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: '2px' }}
                        >
                            {line}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ExportCollections;
export { ExportCollections };
