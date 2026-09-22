import React, { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Key } from 'rc-tree/lib/interface'
import './TreeExplorerContainer.css'
import {
  filterBusinessRecords,
  filterContactRecords,
  getAppliedFilterJson,
  hasActiveContactFilters,
  normalizeFilterFieldName,
} from '../allcommon/searchfilter/FnFilterBusinessContactRecords.ts'
import { FnMapToBusinessDocs } from '../allcommon/dataset/FnMapToBusinessDoc.ts'
import { FnMapToContactDocs } from '../allcommon/dataset/FnMapToContactDoc.ts'
import type { IBusinessDoc, IContactDoc } from '../allinterface/IDatasets.ts'
import { useSmDataContext } from '../context/hooks/SmDataHooks.ts'
import {
  FnGetClientExplorerAutoFilter,
} from '../allcommon/searchfilter/FnGetClientExplorerAutoFilter.ts'
import { FnAddSubNode } from '../allcommon/tree/FnAddSubNode.ts'
import { FnMapBusinessesToTreeNodes } from '../allcommon/tree/FnMapBusinessesToTreeNodes.ts'
import { FnMapContactsToTreeNodes } from '../allcommon/tree/FnMapContactsToTreeNodes.ts'
import { FnSearchKeywordInLocalTree } from '../allcommon/FnSearchKeywordInLocalTree.ts'
import { IDCFilterControlValues } from '../allinterface/searchfilter/IFilterFormContainer.ts'
import { ITreeExplorerContainer } from './ITreeExplorerContainer.ts'
import { IExpandedNodeInfo, ISelectedNodeInfo, ITreeNode } from '../allinterface/tree/ITreeControl.ts'
import { IFeatureTree, ITreeForFlatDataContainer } from '../allinterface/tree/ITreeForFlatDataContainer.ts'
import { FilterFormContainer } from '../searchfilter/filterformcontainer/FilterFormContainer.tsx'
import { SearchControl } from '../searchfilter/searchcontrol/SearchControl.tsx'
import { TreeControl } from '../tree/treecontrol/TreeControl.tsx'
import { useBusinesses, useContacts, useFirestore } from '@n20a/libfsdb'
import { useCommonVariableContext } from '../context/hooks/CommonVariableHooks.ts'

function buildFeatureTreeProps(allowCheckbox = false): IFeatureTree {
  return {
    hideKebabMenu: true,
    allowCheckbox,
    allowIcon: false,
    hideCopyIcon: true,
    reuseFromCache: false,
    instanceName: 'dc_explorer_tree',
    isAllowDrag: false,
    isAllowDrop: false,
    allowCheckStrictly: false,
    allowInternalDrag: false,
    multiRootNode: false,
    openAllNodes: false,
    allowCustomCheck: false,
    disableSelection: false,
  }
}

function getBusinessNodeId(node: ITreeNode): string {
  return String(node.NodeEntID ?? node.key ?? '')
}

function isBusinessNode(node?: ITreeNode): boolean {
  return String(node?.NodeType ?? '').toLowerCase() === 'business'
}

function clearBusinessContactChildren(nodes: ITreeNode[]): ITreeNode[] {
  return nodes.map((node) => {
    if (isBusinessNode(node)) {
      return { ...node, children: [], HasChildren: 1, isLeaf: false }
    }
    if (node.children?.length) {
      return { ...node, children: clearBusinessContactChildren(node.children) }
    }
    return node
  })
}

function accordionExpandedKeys(tree: ITreeNode[] | undefined, businessKey: Key): Key[] {
  const rootKey = tree?.[0]?.NodeType === 'Root' ? tree[0].key : undefined
  return rootKey ? [rootKey, businessKey] : [businessKey]
}

const TreeExplorerContainer = (treeExplorerContainerProps: ITreeExplorerContainer) => {
  const smDataContext = useSmDataContext()
  const commonVariableContext = useCommonVariableContext()
  const [featureTreeProps, setFeatureTreeProps] = useState<IFeatureTree | null>(null)
  const [treeContainerFlatDataProps, setTreeContainerFlatDataProps] = useState<ITreeForFlatDataContainer>()
  const [treeData, setTreeData] = useState<ITreeNode[]>()
  /*Cached business tree including any contacts loaded on expand. */
  const [originalTreeData, setOriginalTreeData] = useState<ITreeNode[]>([])
  const [defaultExpandedKeys, setDefaultExpandedKeys] = useState<Key[]>([])
  const [defaultSelectedKeys, setDefaultSelectedKeys] = useState<Key[]>([])
  const [defaultSelectedNodeInfo, setDefaultSelectedNodeInfo] = useState<ISelectedNodeInfo | null>(null)
  const [searchText, setSearchText] = useState<string | null>(null)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [isShowFilterForm, setIsShowFilterForm] = useState(false)
  const [isFilterChange, setIsFilterChange] = useState(false)
  const [filterFormData, setFilterFormData] = useState<IDCFilterControlValues>({})
  const filterFormDataRef = useRef<IDCFilterControlValues>({})
  const isFilterChangeRef = useRef(false)
  const firestore = useFirestore()
  const { getBusinesses } = useBusinesses()
  const treeDataRef = useRef<ITreeNode[] | undefined>(undefined)
  const originalTreeDataRef = useRef<ITreeNode[]>([])
  const getContactsRef = useRef<ReturnType<typeof useContacts>['getContacts'] | null>(null)
  const contactsRequestRef = useRef(0)

  const prevFeatureIdRef = useRef<string>(undefined)
  const [expandedBusinessId, setExpandedBusinessId] = useState('')
  const { getContacts } = useContacts(expandedBusinessId)
  getContactsRef.current = getContacts
  treeDataRef.current = treeData
  originalTreeDataRef.current = originalTreeData

  const fetchContactsFromApi = useCallback(async (bid: string): Promise<Record<string, unknown>[]> => {
    if (!bid) return []
    try {
      const res = await firestore.queryDocuments({
        pathSegments: ['businesses', bid, 'contacts'],
      })
      return (res?.data ?? []) as Record<string, unknown>[]
    } catch (err) {
      console.warn('fetchContactsFromApi error for bid:', bid, err)
      return []
    }
  }, [firestore])



  useEffect(() => {
    filterFormDataRef.current = filterFormData
  }, [filterFormData])

  useEffect(() => {
    isFilterChangeRef.current = isFilterChange
  }, [isFilterChange])

  const selectNode = (
    node: ITreeNode,
    expandedKeys: Key[],
    currentTree: ITreeNode[],
    event: ISelectedNodeInfo['event'] = 'auto-select'
  ) => {
    const info: ISelectedNodeInfo = {
      event,
      selected: true,
      node,
      selectedNodes: [node],
    }
    setDefaultSelectedKeys([node.key])
    setDefaultSelectedNodeInfo(info)
    smDataContext.setExplorerSelection(node, getAppliedFilterJson(filterFormDataRef.current))
    treeExplorerContainerProps.handleNodeSelect?.([node.key], info, expandedKeys, currentTree)
  }

  const setBusinessTree = (nodes: ITreeNode[], targetIdToSelect?: string) => {
    const rawRootLabel = treeExplorerContainerProps.wrapWithRootLabel ?? 'Businesses'
    const baseLabel = rawRootLabel.replace(/\s*\(\d+\)$/, '').trim() || 'Businesses'
    const rootLabel = `${baseLabel} (${nodes.length})`

    const businessesOnly = !!treeExplorerContainerProps.businessesOnly
    const childNodes = businessesOnly
      ? nodes.map((node) => ({ ...node, isLeaf: true, HasChildren: 0 }))
      : nodes

    const treeNodes: ITreeNode[] = [{
      key: 'root-businesses',
      NodeEntID: 'root-businesses',
      EntID: 'root-businesses',
      NodeEntityname: 'Businesses',
      NodeType: 'Root',
      Name: rootLabel,
      Description: rootLabel,
      NodeState: null,
      IsAuthorized: false,
      title: rootLabel,
      icon: null,
      children: childNodes.map((node) => ({ ...node, parentEntID: 'root-businesses' })),
      treetype: 'Root',
      Type: 'Root',
      parentEntID: null,
      stepNo: 0,
      HasChildren: nodes.length > 0 ? 1 : 0,
      isLeaf: nodes.length === 0,
      checkable: false,
    }]

    setTreeData(treeNodes)
    setOriginalTreeData(treeNodes)
    contactsRequestRef.current += 1
    setExpandedBusinessId('')

    const urlParams = new URLSearchParams(window.location.search);
    const targetBid = targetIdToSelect || urlParams.get('bid')?.trim() || String(smDataContext.selection?.bid ?? '').trim();
    const targetNode = targetBid
      ? nodes.find((n) => n.NodeEntID === targetBid || n.key === targetBid || (n as any).bid === targetBid)
      : undefined;

    if (targetNode) {
      setDefaultExpandedKeys([treeNodes[0].key, targetNode.key]);
      selectNode(targetNode, [treeNodes[0].key, targetNode.key], treeNodes, 'select');
    } else if (treeNodes.length > 0) {
      setDefaultExpandedKeys(treeNodes[0] ? [treeNodes[0].key] : []);
      selectNode(treeNodes[0], [treeNodes[0].key], treeNodes);
    } else {
      setDefaultExpandedKeys([]);
      setDefaultSelectedKeys([]);
      setDefaultSelectedNodeInfo(null);
      smDataContext.setExplorerSelection(undefined, getAppliedFilterJson(filterFormDataRef.current));
    }
    return treeNodes;
  }

  const refreshTreeAndSelectNode = async (targetEntId?: string, hintParentBid?: string) => {
    if (!treeExplorerContainerProps.featureId) return;
    const featureProps = featureTreeProps ?? buildFeatureTreeProps(!!treeExplorerContainerProps.allowCheckbox);

    // Refresh businesses from API to include any newly added business
    const apiBusinesses = await getBusinesses().catch(() => null);
    if (apiBusinesses?.length) {
      smDataContext.setDatasets((prev) => ({
        ...prev,
        businesses: FnMapToBusinessDocs(apiBusinesses),
      }));
    }

    const autoFilter = FnGetClientExplorerAutoFilter(treeExplorerContainerProps.featureId);
    const mergedForm: IDCFilterControlValues = { ...autoFilter, ...filterFormDataRef.current };

    const sourceBusinesses = [
      ...(smDataContext.datasets.businesses ?? []),
      ...(apiBusinesses?.length ? FnMapToBusinessDocs(apiBusinesses) : []),
    ];

    const seenBids = new Set<string>();
    const uniqueBusinesses: IBusinessDoc[] = [];
    for (const b of sourceBusinesses) {
      const bid = String(b.bid || (b as any).EntID || (b as any).id || '').trim();
      if (bid) {
        const lower = bid.toLowerCase();
        if (!seenBids.has(lower)) {
          seenBids.add(lower);
          uniqueBusinesses.push(b);
        }
      } else {
        uniqueBusinesses.push(b);
      }
    }
    let businesses = filterBusinessRecords(uniqueBusinesses, mergedForm);
    if (hasActiveContactFilters(mergedForm)) {
      const matchingBids = new Set(
        smDataContext.getContactsForTree("", mergedForm).map((contact) => contact.bid)
      );
      businesses = businesses.filter((business) => matchingBids.has(business.bid));
    }
    const businessNodes = FnMapBusinessesToTreeNodes(businesses, featureProps, treeExplorerContainerProps.featureId);

    let parentBid = hintParentBid ? String(hintParentBid).trim() : '';

    const cleanTargetId = (targetEntId ?? '').trim();
    const isBusinessTarget = Boolean(
      cleanTargetId &&
      (
        cleanTargetId.toLowerCase().startsWith('bid_') ||
        uniqueBusinesses.some(
          (b) => String(b.bid || (b as any).EntID || (b as any).id || '').trim().toLowerCase() === cleanTargetId.toLowerCase()
        )
      )
    );

    let targetBusinessId = '';
    if (isBusinessTarget) {
      targetBusinessId = cleanTargetId;
    } else if (parentBid) {
      targetBusinessId = parentBid;
    } else if (cleanTargetId) {
      const allKnownContacts = smDataContext.datasets.contacts ?? [];
      const foundContact = allKnownContacts.find(
        (c) => String(c.cid || (c as any).EntID || (c as any).id || '').trim().toLowerCase() === cleanTargetId.toLowerCase()
      );
      if (foundContact?.bid && foundContact.bid.toLowerCase() !== cleanTargetId.toLowerCase()) {
        targetBusinessId = String(foundContact.bid);
      } else if (cleanTargetId.toLowerCase().startsWith('cid_')) {
        const parts = cleanTargetId.split('_');
        if (parts.length >= 3) {
          targetBusinessId = `${parts[1]}_${parts[2]}`;
        }
      }
    }

    // If target business ID is identified and not in businessesOnly mode, load contacts and bind subnodes
    if (targetBusinessId && !treeExplorerContainerProps.businessesOnly) {
      const rawRootLabel = treeExplorerContainerProps.wrapWithRootLabel ?? 'Businesses';
      const baseLabel = rawRootLabel.replace(/\s*\(\d+\)$/, '').trim() || 'Businesses';
      const rootLabel = `${baseLabel} (${businessNodes.length})`;
      const treeNodes: ITreeNode[] = [{
        key: 'root-businesses',
        NodeEntID: 'root-businesses',
        EntID: 'root-businesses',
        NodeEntityname: 'Businesses',
        NodeType: 'Root',
        Name: rootLabel,
        Description: rootLabel,
        NodeState: null,
        IsAuthorized: false,
        title: rootLabel,
        icon: null,
        children: businessNodes.map((node) => ({ ...node, parentEntID: 'root-businesses' })),
        treetype: 'Root',
        Type: 'Root',
        parentEntID: null,
        stepNo: 0,
        HasChildren: businessNodes.length > 0 ? 1 : 0,
        isLeaf: businessNodes.length === 0,
        checkable: false,
      }];

      // Call contact API for the selected business node
      const apiRecords = await fetchContactsFromApi(targetBusinessId);
      const apiContacts = FnMapToContactDocs(apiRecords, targetBusinessId);

      // Merge API contacts with any in-memory contacts for this bid, deduplicating by cid
      const contextContacts = (smDataContext.datasets.contacts ?? []).filter(
        (c) => String(c.bid).trim().toLowerCase() === targetBusinessId.toLowerCase()
      );

      const combinedRaw = [...apiContacts, ...contextContacts];
      const seenCids = new Set<string>();
      const uniqueContactsForBid: IContactDoc[] = [];
      for (const c of combinedRaw) {
        const cid = String(c.cid || (c as any).EntID || (c as any).id || '').trim().toLowerCase();
        if (cid) {
          if (!seenCids.has(cid)) {
            seenCids.add(cid);
            uniqueContactsForBid.push(c);
          }
        } else {
          uniqueContactsForBid.push(c);
        }
      }

      smDataContext.setDatasets((prev) => ({
        ...prev,
        contacts: [
          ...(prev.contacts ?? []).filter(
            (c) => String(c.bid).trim().toLowerCase() !== targetBusinessId.toLowerCase()
          ),
          ...uniqueContactsForBid,
        ],
      }));

      const filteredContacts = filterContactRecords(
        uniqueContactsForBid,
        filterFormDataRef.current,
        targetBusinessId
      );
      const contactNodes = FnMapContactsToTreeNodes(
        filteredContacts,
        featureProps,
        treeExplorerContainerProps.featureId,
        targetBusinessId
      );
      const seenNodeKeys = new Set<string>();
      const uniqueContactNodes = contactNodes.filter((cn) => {
        const key = String(cn.key ?? cn.NodeEntID ?? cn.EntID ?? '').trim().toLowerCase();
        if (key && seenNodeKeys.has(key)) return false;
        if (key) seenNodeKeys.add(key);
        return true;
      });

      const updatedTreeData = await FnAddSubNode(
        treeNodes,
        targetBusinessId,
        uniqueContactNodes,
        featureProps,
        treeExplorerContainerProps.featureId,
        false,
        0
      );
      const updatedOriginalData = await FnAddSubNode(
        treeNodes,
        targetBusinessId,
        uniqueContactNodes,
        featureProps,
        treeExplorerContainerProps.featureId,
        true,
        0
      );

      const nextExpandedKeys = ['root-businesses', targetBusinessId];
      setTreeData(updatedTreeData);
      setOriginalTreeData(updatedOriginalData);
      setDefaultExpandedKeys(nextExpandedKeys);

      const targetCidClean = cleanTargetId.toLowerCase();
      let nodeToSelect: ITreeNode | undefined;

      if (!isBusinessTarget) {
        nodeToSelect = uniqueContactNodes.find((cn) => {
          const nodeKey = String(cn.key ?? cn.NodeEntID ?? (cn as any).cid ?? '').trim().toLowerCase();
          return nodeKey === targetCidClean;
        });
      }

      if (!nodeToSelect && uniqueContactNodes.length > 0) {
        nodeToSelect = uniqueContactNodes[0];
      }

      if (!nodeToSelect) {
        // Fallback to selecting the Business node if no contacts exist
        nodeToSelect = businessNodes.find(
          (n) => n.NodeEntID === targetBusinessId || n.key === targetBusinessId || (n as any).bid === targetBusinessId
        );
      }

      if (nodeToSelect) {
        selectNode(nodeToSelect, nextExpandedKeys, updatedTreeData, 'select');
      }
    } else {
      setBusinessTree(businessNodes, cleanTargetId);
    }
  };

  /*Filters sample businesses (and contact-gated businesses) then maps to tree nodes. */
  const applyBusinessTreeFromFilter = (
    form: IDCFilterControlValues,
    featureProps: IFeatureTree,
    featureId: string
  ) => {
    const autoFilter = FnGetClientExplorerAutoFilter(featureId)
    const mergedForm: IDCFilterControlValues = { ...autoFilter, ...form }
    let businesses = filterBusinessRecords(smDataContext.datasets.businesses, mergedForm)
    if (hasActiveContactFilters(mergedForm)) {
      const matchingBids = new Set(
        smDataContext.getContactsForTree("", mergedForm).map((contact) => contact.bid)
      )
      businesses = businesses.filter((business) => matchingBids.has(business.bid))
    }
    setBusinessTree(FnMapBusinessesToTreeNodes(businesses, featureProps, featureId))
  }

  // Reload business tree when featureId changes (Client menu auto-filters included).
  useEffect(() => {
    if (!treeExplorerContainerProps.featureId) return
    if (!smDataContext.isBusinessesLoaded) return
    const configKey = `${treeExplorerContainerProps.featureId}-${!!treeExplorerContainerProps.allowCheckbox}`
    if (prevFeatureIdRef.current === configKey) return
    prevFeatureIdRef.current = configKey

    const featureProps = buildFeatureTreeProps(!!treeExplorerContainerProps.allowCheckbox)
    const autoFilter = FnGetClientExplorerAutoFilter(treeExplorerContainerProps.featureId)
    setFeatureTreeProps(featureProps)
    setIsShowFilterForm(false)
    setIsFilterChange(false)
    setFilterFormData(autoFilter)
    filterFormDataRef.current = autoFilter
    setTreeContainerFlatDataProps({
      uniqueName: `${treeExplorerContainerProps.uniqueName}-dce-flat`,
      flatAPIData: null,
      featureId: treeExplorerContainerProps.featureId,
      featureTreeProps: featureProps,
    })

    applyBusinessTreeFromFilter(autoFilter, featureProps, treeExplorerContainerProps.featureId)
  }, [treeExplorerContainerProps.featureId, treeExplorerContainerProps.uniqueName, treeExplorerContainerProps.allowCheckbox, smDataContext.isBusinessesLoaded])

  useEffect(() => {
    if (!commonVariableContext.reloadTreeFor) return;
    const { featureId, entId, dropNodeEntId } = commonVariableContext.reloadTreeFor;
    if (featureId && featureId !== treeExplorerContainerProps.featureId) return;
    void refreshTreeAndSelectNode(entId, dropNodeEntId);
  }, [commonVariableContext.reloadTreeFor]);

  const applyContactsToBusiness = async (
    businessId: string,
    records: Record<string, unknown>[] | null,
    autoSelectFirstChild: boolean = true
  ) => {
    if (!featureTreeProps || !treeContainerFlatDataProps) {
      return
    }
    const apiContacts = FnMapToContactDocs(records, businessId);
    const contextContacts = (smDataContext.datasets.contacts ?? []).filter(
      (c) => String(c.bid).trim().toLowerCase() === businessId.trim().toLowerCase()
    );

    const combined = [...apiContacts, ...contextContacts];
    const seenCids = new Set<string>();
    const mappedContacts: IContactDoc[] = [];
    for (const c of combined) {
      const cid = String(c.cid || (c as any).EntID || (c as any).id || '').trim().toLowerCase();
      if (cid) {
        if (!seenCids.has(cid)) {
          seenCids.add(cid);
          mappedContacts.push(c);
        }
      } else {
        mappedContacts.push(c);
      }
    }

    smDataContext.setDatasets((prev) => ({
      ...prev,
      contacts: [
        ...(prev.contacts ?? []).filter(
          (c) => String(c.bid).trim().toLowerCase() !== businessId.trim().toLowerCase()
        ),
        ...mappedContacts,
      ],
    }));

    const filteredContacts = filterContactRecords(
      mappedContacts,
      filterFormDataRef.current,
      businessId
    );
    const contactNodes = FnMapContactsToTreeNodes(
      filteredContacts,
      featureTreeProps,
      treeContainerFlatDataProps.featureId,
      businessId
    );
    const seenNodeKeys = new Set<string>();
    const uniqueContactNodes = contactNodes.filter((cn) => {
      const key = String(cn.key ?? cn.NodeEntID ?? cn.EntID ?? '').trim().toLowerCase();
      if (key && seenNodeKeys.has(key)) return false;
      if (key) seenNodeKeys.add(key);
      return true;
    });

    const clearedTree = clearBusinessContactChildren(treeDataRef.current ?? []);
    const clearedOriginal = clearBusinessContactChildren(originalTreeDataRef.current);
    const updatedTreeData = await FnAddSubNode(
      clearedTree,
      businessId,
      uniqueContactNodes,
      featureTreeProps,
      treeContainerFlatDataProps.featureId,
      false,
      0
    );
    const updatedOriginalData = await FnAddSubNode(
      clearedOriginal,
      businessId,
      uniqueContactNodes,
      featureTreeProps,
      treeContainerFlatDataProps.featureId,
      true,
      0
    );
    const nextExpandedKeys = accordionExpandedKeys(updatedTreeData, businessId);
    setTreeData(updatedTreeData);
    setOriginalTreeData(updatedOriginalData);
    setDefaultExpandedKeys(nextExpandedKeys);
    if (autoSelectFirstChild && uniqueContactNodes.length > 0) {
      selectNode(uniqueContactNodes[0], nextExpandedKeys, updatedTreeData, 'select');
    }
  };

  const handleNodeExpand = async (expandedNodeKeys: Key[], info: IExpandedNodeInfo) => {
    if (!info?.node || !treeContainerFlatDataProps || !featureTreeProps) return

    // When businessesOnly is active, never load contacts — just track expanded keys
    if (treeExplorerContainerProps.businessesOnly) {
      setDefaultExpandedKeys(expandedNodeKeys)
      return
    }

    if (!isBusinessNode(info.node)) {
      if (info.expanded) {
        setDefaultExpandedKeys(expandedNodeKeys)
      }
      return
    }

    if (!info.expanded) {
      contactsRequestRef.current += 1
      setExpandedBusinessId('')
      setDefaultExpandedKeys(expandedNodeKeys)
      return
    }

    const businessId = getBusinessNodeId(info.node)
    if (!businessId) {
      return
    }

    const requestId = contactsRequestRef.current + 1
    contactsRequestRef.current = requestId

    flushSync(() => {
      setDefaultExpandedKeys(expandedNodeKeys)
      setExpandedBusinessId(businessId)
    })

    const records = await fetchContactsFromApi(businessId)
    if (requestId !== contactsRequestRef.current) {
      return
    }
    await applyContactsToBusiness(businessId, records ?? [], true)
  }

  const handleNodeSelect = async (selectedKeys: Key[], info: ISelectedNodeInfo, expandedNodeKeys?: Key[]) => {
    setDefaultSelectedKeys(selectedKeys)
    setDefaultSelectedNodeInfo(info)
    smDataContext.setExplorerSelection(info.node, getAppliedFilterJson(filterFormDataRef.current))
    treeExplorerContainerProps.handleNodeSelect?.(
      selectedKeys,
      info,
      expandedNodeKeys ?? defaultExpandedKeys,
      treeData
    )

    // Fetch and bind contacts data into dataset on selection without expanding the node
    if (isBusinessNode(info.node) && !treeExplorerContainerProps.businessesOnly) {
      const businessId = getBusinessNodeId(info.node)
      if (businessId) {
        const records = await fetchContactsFromApi(businessId)
        if (records?.length) {
          const apiContacts = FnMapToContactDocs(records, businessId)
          smDataContext.setDatasets((prev) => ({
            ...prev,
            contacts: [
              ...(prev.contacts ?? []).filter(
                (c) => String(c.bid).trim().toLowerCase() !== businessId.trim().toLowerCase()
              ),
              ...apiContacts,
            ],
          }))
        }
      }
    }
  }

  const handleFilterActionClick = (
    event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
    actionCode?: string
  ) => {
    if (!event) return
    if (actionCode === 'close') {
      const autoFilter = FnGetClientExplorerAutoFilter(treeExplorerContainerProps.featureId)
      setFilterFormData(autoFilter)
      filterFormDataRef.current = autoFilter
      isFilterChangeRef.current = false
      setIsFilterChange(false)
      setIsShowFilterForm(false)
      if (featureTreeProps && treeExplorerContainerProps.featureId) {
        applyBusinessTreeFromFilter(autoFilter, featureTreeProps, treeExplorerContainerProps.featureId)
      }
      return
    }
    handleFilterClick()
  }

  // Track draft filter edits until apply; map libform field names to control names.
  const handleFilterFormChange = (value: string | undefined, name: string) => {
    if (value === undefined) return
    const field = normalizeFilterFieldName(name)
    if (!field) return
    setFilterFormData((prev) => {
      const next = { ...prev, [field]: value }
      filterFormDataRef.current = next
      return next
    })
    isFilterChangeRef.current = true
    setIsFilterChange(true)
  }

  // Apply saved filter json (drop ANY) and refresh the explorer tree, or open the form.
  const handleFilterClick = () => {
    if (isShowFilterForm) {
      if (isFilterChangeRef.current && featureTreeProps && treeExplorerContainerProps.featureId) {
        const appliedFilterJson = getAppliedFilterJson(filterFormDataRef.current)
        setFilterFormData(appliedFilterJson)
        filterFormDataRef.current = appliedFilterJson
        applyBusinessTreeFromFilter(appliedFilterJson, featureTreeProps, treeExplorerContainerProps.featureId)
      }
      // Clear dirty after apply/close — yellow only while filter form has pending edits
      isFilterChangeRef.current = false
      setIsFilterChange(false)
      setIsShowFilterForm(false)
      return
    }
    setIsShowFilterForm(true)
  }

  const handleKeywordSearch = (value: string) => {
    if (!treeData) return
    const foundedNode = FnSearchKeywordInLocalTree(value, treeData, searchHistory)
    if (foundedNode?.foundNode) {
      const parentKeys = foundedNode.parentNodes?.map((node) => node.key) ?? []
      setDefaultExpandedKeys(parentKeys)
      selectNode(foundedNode.foundNode, parentKeys, treeData, 'found-select')
      setSearchHistory((prev) => [...prev, value])
    }
  }

  if (treeData === undefined) {
    return <div className="nz-wh-100 nz-d-flex-hv-left">Loading...</div>
  }

  const displayTreeData = treeData

  return (
    <div className="nz-dc-explorer-container nz-dc-tree-container">
      {!isShowFilterForm ? (
        <div className="nz-wh-100 nz-dce-search-tree-container">
          <div className="nz-dce-search-container">
            <SearchControl
              uniqueName={`${treeExplorerContainerProps.uniqueName}-search`}
              isShowFilterControl={!treeExplorerContainerProps.subTreeFeatureId}
              lensDirty={(searchText || '').length > 0}
              filterDirty={isFilterChange}
              searchInputValue={searchText || ''}
              hideSearchControl={false}
              hideRightMouseMenu={!!treeExplorerContainerProps.subTreeFeatureId}
              searchValueChange={(value: string) => {
                setSearchText(value)
                setSearchHistory([])
              }}
              handleFilterMouse={handleFilterClick}
              handleLensMouse={() => {
                if (searchText && searchText.length > 0) {
                  handleKeywordSearch(searchText)
                }
              }}
            />
          </div>
          <div className="nz-dce-tree-container">
            {featureTreeProps &&
              treeContainerFlatDataProps &&
              displayTreeData.length > 0 ? (
              <TreeControl
                uniqueName={treeContainerFlatDataProps.uniqueName}
                treeData={displayTreeData}
                featureId={treeContainerFlatDataProps.featureId}
                autoFocus={!treeExplorerContainerProps.subTreeFeatureId}
                defaultExpandedKeys={defaultExpandedKeys}
                defaultSelectedKeys={defaultSelectedKeys}
                defaultCheckedKeys={treeExplorerContainerProps.defaultCheckedKeys ?? []}
                defaultSelectedNodeInfo={defaultSelectedNodeInfo || undefined}
                allowCheckbox={treeExplorerContainerProps.allowCheckbox ?? false}
                allowCheckStrictly={false}
                allowIcon={false}
                allowInternalDrag={false}
                allowAdd={treeExplorerContainerProps.allowAdd ?? false}
                addLabel={treeExplorerContainerProps.addLabel}
                addTooltip={treeExplorerContainerProps.addTooltip}
                addActionCode={treeExplorerContainerProps.addActionCode}
                disableAdd={treeExplorerContainerProps.disableAdd}
                allowAddBusiness={treeExplorerContainerProps.allowAddBusiness}
                allowAddContact={treeExplorerContainerProps.allowAddContact}
                allowMultiple={false}
                className="nz-dce-tree-for-flat-data"
                allowAPICallOnExpand={true}
                handleNodeExpand={handleNodeExpand}
                handleAIClick={treeExplorerContainerProps.handleAIClick}
                handleNodeSelect={handleNodeSelect}
                handleNodeCheck={treeExplorerContainerProps.handleNodeCheck}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <FilterFormContainer
          uniqueName={`${treeExplorerContainerProps.uniqueName}-filter-form`}
          allowHeader={true}
          isFilterChange={isFilterChange}
          controlValues={filterFormData}
          headerText="Filter Business / Contact"
          handleActionImageClick={handleFilterActionClick}
          handleFilterFormChange={handleFilterFormChange}
        />
      )}
    </div>
  )
}

export { TreeExplorerContainer }
