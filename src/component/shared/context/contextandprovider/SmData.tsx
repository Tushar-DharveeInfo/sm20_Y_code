
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBusinesses } from "@n20a/libfsdb";
import { IAppContextWrapper } from "../allinterface/IAppContextWrapper";
import { IExplorerSelection, ISmData, ISmDatasetCache } from "../allinterface/ISmData";
import type { CollectionName, ICollectionDocMap, IContactDoc } from "../../allinterface/IDatasets";
import type { IFilterControlValues } from "../../allinterface/searchfilter/IFilterFormContainer";
import type { ITreeNode } from "../../allinterface/tree/ITreeControl";
import {
    emptyScopedDatasets,
    sourceContacts,
} from "../../allcommon/FnLoadSampleDatasets";
import { FnLoadScopedDatasets } from "../../allcommon/dataset/FnFilterScopedDataset";
import { FnMapToBusinessDocs } from "../../allcommon/dataset/FnMapToBusinessDoc";
import { filterContactRecords } from "../../allcommon/searchfilter/FnFilterBusinessContactRecords";

const FILTER_OP = "==" as const;

function toFilterJsonString(values: IFilterControlValues): string {
    return JSON.stringify(
        Object.entries(values ?? {}).map(([field, value]) => ({
            field,
            op: FILTER_OP,
            value: String(value),
        }))
    );
}

const SmDataContext = createContext<ISmData | undefined>(undefined);

function emptySelection(): IExplorerSelection {
    return { filterJson: {} };
}

function selectionCacheKey(selection: IExplorerSelection): string {
    return JSON.stringify({
        bid: selection.bid ?? "",
        cid: selection.cid ?? "",
        filterJson: selection.filterJson ?? {},
    });
}

function normalizeId(value: unknown): string | undefined {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    return String(value);
}

function extractBidCid(node?: ITreeNode): Pick<IExplorerSelection, "bid" | "cid"> {
    if (!node) {
        return {};
    }
    const nodeType = String(node.NodeType ?? "").toLowerCase();
    if (nodeType === "root") {
        return {};
    }
    if (nodeType === "contact") {
        return {
            bid: normalizeId(node.bid ?? node.parentEntID),
            cid: normalizeId(node.cid ?? node.NodeEntID ?? node.key),
        };
    }
    if (nodeType === "business") {
        return {
            bid: normalizeId(node.bid ?? node.NodeEntID ?? node.key),
        };
    }
    return {
        bid: normalizeId(node.bid),
        cid: normalizeId(node.cid),
    };
}

function createEmptyCache(): ISmDatasetCache {
    return {
        businesses: [],
        ...emptyScopedDatasets(),
    };
}

function SmDataProvider({ children }: IAppContextWrapper) {
    const [datasets, setDatasets] = useState<ISmDatasetCache>(createEmptyCache);
    const [selection, setSelection] = useState<IExplorerSelection>(emptySelection);
    const [filterJson, setFilterJson] = useState<string>(toFilterJsonString({})); // applied explorer filter json
    // console.log('filterJson SmDataProvider', filterJson)
    // console.log('selection SmDataProvider', selection)
    const [selectedNode, setSelectedNode] = useState<ITreeNode>();
    const [isBusinessesLoaded, setIsBusinessesLoaded] = useState(false);
    const [isScopedDatasetsLoaded, setIsScopedDatasetsLoaded] = useState(true);
    const businessesLoadedRef = useRef(false);
    const selectionKeyRef = useRef(selectionCacheKey(emptySelection()));

    const { getBusinesses, businesses, loading, error } = useBusinesses();

    const loadBusinessesOnce = useCallback(() => {
        if (businessesLoadedRef.current) {
            return;
        }
        businessesLoadedRef.current = true;
        void getBusinesses();
    }, [getBusinesses]);

    useEffect(() => {
        if (loading || !businesses) {
            return;
        }
        setDatasets((prev) => ({
            ...prev,
            businesses: FnMapToBusinessDocs(businesses),
        }));
        setIsBusinessesLoaded(true);
    }, [businesses, loading, error]);

    const setExplorerSelection = useCallback((node: ITreeNode | undefined, nextFilterJson: IFilterControlValues) => {
        const { bid, cid } = extractBidCid(node);
        const appliedFilterJson = nextFilterJson ?? {};
        const filterJsonString = toFilterJsonString(appliedFilterJson);
        setFilterJson(filterJsonString);
        const nextSelection: IExplorerSelection = {
            bid,
            cid,
            filterJson: appliedFilterJson,
        };
        const nextKey = selectionCacheKey(nextSelection);
        if (nextKey === selectionKeyRef.current) {
            setSelectedNode(node);
            return;
        }
        selectionKeyRef.current = nextKey;
        setSelectedNode(node);
        setSelection(nextSelection);
        setIsScopedDatasetsLoaded(false);
        setDatasets((prev) => ({
            businesses: prev.businesses,
            ...emptyScopedDatasets(),
            contacts: prev.contacts,
        }));
        const scoped = FnLoadScopedDatasets(nextSelection);
        setDatasets((prev) => {
            const hasRealContacts = nextSelection.bid
                ? prev.contacts.some((c) => c.bid === nextSelection.bid)
                : false;
            return {
                businesses: prev.businesses,
                ...scoped,
                contacts: hasRealContacts ? prev.contacts : scoped.contacts,
            };
        });
        setIsScopedDatasetsLoaded(true);
    }, []);

    const setFilterJsonValue = useCallback((nextFilterJson: IFilterControlValues) => {
        const appliedFilterJson = nextFilterJson ?? {};
        const filterJsonString = toFilterJsonString(appliedFilterJson);
        setFilterJson((prev) => (prev === filterJsonString ? prev : filterJsonString));
        setSelection((prev) => ({
            ...prev,
            filterJson: appliedFilterJson,
        }));
    }, []);

    const updateDataset = useCallback(<K extends CollectionName>(name: K, records: ICollectionDocMap[K][]) => {
        setDatasets((prev) => ({
            ...prev,
            [name]: records,
        }));
    }, []);

    const getContactsForTree = useCallback((bid: string, filterJson: IFilterControlValues): IContactDoc[] => {
        return filterContactRecords(sourceContacts, filterJson, bid || undefined);
    }, []);

    const contextValue = useMemo((): ISmData => ({
        datasets,
        selection,
        filterJson,
        selectedNode,
        isBusinessesLoaded,
        isScopedDatasetsLoaded,
        loadBusinessesOnce,
        setExplorerSelection,
        setFilterJson: setFilterJsonValue,
        updateDataset,
        getContactsForTree,
        setDatasets,
    }), [
        datasets,
        selection,
        filterJson,
        selectedNode,
        isBusinessesLoaded,
        isScopedDatasetsLoaded,
        loadBusinessesOnce,
        setExplorerSelection,
        setFilterJsonValue,
        updateDataset,
        getContactsForTree,
        setDatasets,
    ]);

    return (
        <SmDataContext.Provider value={contextValue}>
            {children}
        </SmDataContext.Provider>
    );
}

export { SmDataContext, SmDataProvider };
