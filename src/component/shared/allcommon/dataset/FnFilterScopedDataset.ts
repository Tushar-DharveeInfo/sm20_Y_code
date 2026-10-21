import type { CollectionName, ICollectionDocMap } from "@n20a/libfsdb";
import type { IExplorerSelection, ISmDatasetCache } from "../../context/allinterface/ISmData";

function hasBidCid(row: unknown): row is { bid?: string | number; cid?: string | number } {
    return typeof row === "object" && row !== null;
}

function matchesSelection<T>(row: T, selection: IExplorerSelection): boolean {
    if (!hasBidCid(row)) {
        return false;
    }
    if (selection.bid && String(row.bid ?? "") !== selection.bid) {
        return false;
    }
    if (selection.cid && String(row.cid ?? "") !== selection.cid) {
        return false;
    }
    return true;
}

const emptyScopedDatasets = (): Omit<ISmDatasetCache, "businesses"> => ({
    contacts: [],
    notes: [],
    tickets: [],
    ticketnotes: [],
    activities: [],
    orders: [],
    carts: [],
    supporthoursused: [],
    subs: [],
    downloads: [],
    todo: [],
    prospect: [],
});

function FnFilterSourceBySelection<K extends Exclude<CollectionName, "businesses">>(
    name: K,
    selection: IExplorerSelection,
    source: ICollectionDocMap[K][] = []
): ICollectionDocMap[K][] {
    void name;
    // Root / no business-contact selection → all records (ticket tree shows every Mfg).
    if (!selection.bid && !selection.cid) {
        return [...source];
    }
    return source.filter((row) => matchesSelection(row, selection));
}

function FnLoadScopedDatasets(selection: IExplorerSelection): {
    [K in Exclude<CollectionName, "businesses">]: ICollectionDocMap[K][];
} {
    void selection;
    return emptyScopedDatasets();
}

export { emptyScopedDatasets, FnFilterSourceBySelection, FnLoadScopedDatasets, matchesSelection };
