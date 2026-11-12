import type { Dispatch, SetStateAction } from "react";
import type {
    CollectionName,
    IActivityDoc,
    IBusinessDoc,
    ICollectionDocMap,
    IContactDoc,
    IVssDownloadDoc,
    INoteDoc,
    IOrderDoc,
    IProspectDoc,
    ITicketDoc,
    ITicketNoteDoc,
    IReminderDoc,
} from "@n20a/libfsdb";
import type { IFilterControlValues } from "../../allinterface/searchfilter/IFilterFormContainer";
import type { ITreeNode } from "../../allinterface/tree/ITreeControl";

import type { IFeatureForHelp } from "./IMainApp";

interface IUserRecord {
    email: string;
    displayName?: string;
    uid?: string;
    bid?: string;
    cid?: string;
}

/** Selected business-explorer node plus the applied filter json used as the scoped-dataset cache key. */
interface IExplorerSelection {
    bid?: string;
    cid?: string;
    selectedtenantshortname?: string;
    filterJson: IFilterControlValues;
}

type ISmDatasetCache = {
    [K in CollectionName]: ICollectionDocMap[K][];
};

interface ISmData {
    /** User data for tenant users (used in impersonate, status bar, etc.). */
    userData: IUserRecord[];
    setUserData: Dispatch<SetStateAction<IUserRecord[]>>;
    /** Fetch tenant users once and store in userData. */
    loadUsersOnce: () => void;

    /**
     * Writes a single activity-log document to Firestore.
     * User identity (bid, cid, displayName, username, email) is taken
     * automatically from the current `authSession` stored in this context —
     * the caller only needs to supply the human-readable message string.
     */
    createActivityLog: (message: string) => Promise<void>;

    datasets: ISmDatasetCache;
    selection: IExplorerSelection;
    /** Applied filter json string, e.g. '[{"field":"status","op":"==","value":"Active"}]'. */
    filterJson: string;
    selectedNode?: ITreeNode;
    isBusinessesLoaded: boolean;
    isScopedDatasetsLoaded: boolean;
    /** Load businesses once per session and keep them in cache. */
    loadBusinessesOnce: () => void;
    /**
     * Store the selected node and filter json. Reloads every non-business dataset
     * only when bid, cid, or filter json actually changed.
     */
    setExplorerSelection: (node: ITreeNode | undefined, filterJson: IFilterControlValues) => void;
    /** Convert filter key/values to json string and store when the value changes. */
    setFilterJson: (filterJson: IFilterControlValues) => void;
    /** Always read/write through the session cache. */
    updateDataset: <K extends CollectionName>(name: K, records: ICollectionDocMap[K][]) => void;
    /** Contacts for tree expand, from the full source (not the scoped cache). */
    getContactsForTree: (bid: string, filterJson: IFilterControlValues) => IContactDoc[];
    /** Direct dataset cache state setter. */
    setDatasets: Dispatch<SetStateAction<ISmDatasetCache>>;
    /** Returns stencil name for a given EQID, or null when not found/unavailable. */
    getStencilName: (EQID: string) => string | null;

    purchasedSkus?: string[];
    setPurchasedSkus: React.Dispatch<React.SetStateAction<string[] | undefined>>;
    getPurchasedSkus: () => string[] | undefined;

    alertRecords: Record<string, any>[];
    setAlertRecords: React.Dispatch<
        React.SetStateAction<Record<string, any>[]>
    >;

    businessSelectedNode?: ITreeNode | undefined;
    setBusinessSelectedNode: React.Dispatch<
        React.SetStateAction<ITreeNode | undefined>
    >;


    selectedFeatureForHelp?: IFeatureForHelp;
    setSelectedFeatureForHelp: React.Dispatch<
        React.SetStateAction<IFeatureForHelp | undefined>
    >;
}

export type {
    IUserRecord,
    CollectionName,
    IActivityDoc,
    IBusinessDoc,
    IContactDoc,
    IVssDownloadDoc,
    IExplorerSelection,
    INoteDoc,
    IOrderDoc,
    IProspectDoc,
    ISmData,
    ISmDatasetCache,
    ITicketDoc,
    ITicketNoteDoc,
    IReminderDoc,
};
