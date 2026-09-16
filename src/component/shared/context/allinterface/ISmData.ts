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
    ISubDoc,
    ITicketDoc,
    ITicketNoteDoc,
    ITodoDoc,
} from "../../allinterface/IDatasets";
import type { IFilterControlValues } from "../../allinterface/searchfilter/IFilterFormContainer";
import type { ITreeNode } from "../../allinterface/tree/ITreeControl";

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
}

export type {
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
    ISubDoc,
    ITicketDoc,
    ITicketNoteDoc,
    ITodoDoc,
};
