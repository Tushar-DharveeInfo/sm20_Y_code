import type { CollectionName, ICollectionDocMap } from "../../allinterface/IDatasets";
import type { IExplorerSelection } from "../../context/allinterface/ISmData";
import { FnGetSourceDataset } from "../FnLoadSampleDatasets";

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

function FnFilterSourceBySelection<K extends Exclude<CollectionName, "businesses">>(
    name: K,
    selection: IExplorerSelection
): ICollectionDocMap[K][] {
    const source = FnGetSourceDataset(name);
    // Root / no business-contact selection → all records (ticket tree shows every Mfg).
    if (!selection.bid && !selection.cid) {
        return [...source];
    }
    return source.filter((row) => matchesSelection(row, selection));
}

function FnLoadScopedDatasets(selection: IExplorerSelection): {
    [K in Exclude<CollectionName, "businesses">]: ICollectionDocMap[K][];
} {
    return {
        contacts: FnFilterSourceBySelection("contacts", selection),
        notes: FnFilterSourceBySelection("notes", selection),
        tickets: FnFilterSourceBySelection("tickets", selection),
        ticketnotes: FnFilterSourceBySelection("ticketnotes", selection),
        activities: FnFilterSourceBySelection("activities", selection),
        orders: FnFilterSourceBySelection("orders", selection),
        carts: FnFilterSourceBySelection("carts", selection),
        supporthoursused: FnFilterSourceBySelection("supporthoursused", selection),
        subs: FnFilterSourceBySelection("subs", selection),
        downloads: FnFilterSourceBySelection("downloads", selection),
        todo: FnFilterSourceBySelection("todo", selection),
        prospect: FnFilterSourceBySelection("prospect", selection),
    };
}

export { FnFilterSourceBySelection, FnLoadScopedDatasets, matchesSelection };
