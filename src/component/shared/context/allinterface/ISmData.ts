import type {
    CollectionName,
    IActivityDoc,
    IBusinessDoc,
    ICollectionDocMap,
    IContactDoc,
    IDownloadDoc,
    INoteDoc,
    IOrderDoc,
    IProspectDoc,
    IQuoteDoc,
    ISubDoc,
    ITicketDoc,
    ITicketNoteDoc,
    ITodoDoc,
} from "../../allinterface/IDatasets";
import type { IDCFilterControlValues } from "../../allinterface/searchfilter/IFilterFormContainer";
import type { ITreeNode } from "../../allinterface/tree/ITreeControl";

/** Selected business-explorer node plus the applied filter json used as the scoped-dataset cache key. */
interface IExplorerSelection {
    bid?: string;
    cid?: string;
    filterJson: IDCFilterControlValues;
}

type ISmDatasetCache = {
    [K in CollectionName]: ICollectionDocMap[K][];
};

interface ISmData {
    datasets: ISmDatasetCache;
    selection: IExplorerSelection;
    /** Applied business-explorer filter json (keys with ANY/empty omitted). */
    filterJson: IDCFilterControlValues;
    selectedNode?: ITreeNode;
    isBusinessesLoaded: boolean;
    isScopedDatasetsLoaded: boolean;
    /** Load businesses once per session and keep them in cache. */
    loadBusinessesOnce: () => void;
    /**
     * Store the selected node and filter json. Reloads every non-business dataset
     * only when bid, cid, or filter json actually changed.
     */
    setExplorerSelection: (node: ITreeNode | undefined, filterJson: IDCFilterControlValues) => void;
    /** Store the applied filter json independently of node selection. */
    setFilterJson: (filterJson: IDCFilterControlValues) => void;
    /** Always read/write through the session cache. */
    updateDataset: <K extends CollectionName>(name: K, records: ICollectionDocMap[K][]) => void;
    /** Contacts for tree expand, from the full source (not the scoped cache). */
    getContactsForTree: (bid: string, filterJson: IDCFilterControlValues) => IContactDoc[];
}

export type {
    CollectionName,
    IActivityDoc,
    IBusinessDoc,
    IContactDoc,
    IDownloadDoc,
    IExplorerSelection,
    INoteDoc,
    IOrderDoc,
    IProspectDoc,
    IQuoteDoc,
    ISmData,
    ISmDatasetCache,
    ISubDoc,
    ITicketDoc,
    ITicketNoteDoc,
    ITodoDoc,
};
