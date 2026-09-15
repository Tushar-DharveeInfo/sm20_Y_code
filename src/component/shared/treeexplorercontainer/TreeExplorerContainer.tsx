import React, { useEffect, useRef, useState } from 'react'
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
import { FnMapToContactDocs } from '../allcommon/dataset/FnMapToContactDoc.ts'
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
import { useContacts } from '@n20a/libfsdb'

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

  const setBusinessTree = (nodes: ITreeNode[]) => {
    const rootLabel = treeExplorerContainerProps.wrapWithRootLabel
    const treeNodes = rootLabel
      ? [{
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
        children: nodes.map((node) => ({ ...node, parentEntID: 'root-businesses' })),
        treetype: 'Root',
        Type: 'Root',
        parentEntID: null,
        stepNo: 0,
        HasChildren: nodes.length > 0 ? 1 : 0,
        isLeaf: nodes.length === 0,
        checkable: false,
      } as ITreeNode]
      : nodes

    setTreeData(treeNodes)
    setOriginalTreeData(treeNodes)
    contactsRequestRef.current += 1
    setExpandedBusinessId('')
    setDefaultExpandedKeys(rootLabel && treeNodes[0] ? [treeNodes[0].key] : [])
    if (treeNodes.length > 0) {
      selectNode(treeNodes[0], rootLabel ? [treeNodes[0].key] : [], treeNodes)
    } else {
      setDefaultSelectedKeys([])
      setDefaultSelectedNodeInfo(null)
      smDataContext.setExplorerSelection(undefined, getAppliedFilterJson(filterFormDataRef.current))
    }
  }

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

    // TODO: replace sampleBusinesses with API response when available
    applyBusinessTreeFromFilter(autoFilter, featureProps, treeExplorerContainerProps.featureId)
  }, [treeExplorerContainerProps.featureId, treeExplorerContainerProps.uniqueName, treeExplorerContainerProps.allowCheckbox, smDataContext.isBusinessesLoaded])

  const applyContactsToBusiness = async (
    businessId: string,
    records: Record<string, unknown>[] | null
  ) => {
    if (!featureTreeProps || !treeContainerFlatDataProps) {
      return
    }
    const mappedContacts = FnMapToContactDocs(records, businessId)
    smDataContext.setDatasets((prev) => ({
      ...prev,
      contacts: mappedContacts,
    }))
    const filteredContacts = filterContactRecords(
      mappedContacts,
      filterFormDataRef.current,
      businessId
    )
    const contactNodes = FnMapContactsToTreeNodes(
      filteredContacts,
      featureTreeProps,
      treeContainerFlatDataProps.featureId,
      businessId
    )
    const clearedTree = clearBusinessContactChildren(treeDataRef.current ?? [])
    const clearedOriginal = clearBusinessContactChildren(originalTreeDataRef.current)
    const updatedTreeData = await FnAddSubNode(
      clearedTree,
      businessId,
      contactNodes,
      featureTreeProps,
      treeContainerFlatDataProps.featureId,
      false,
      0
    )
    const updatedOriginalData = await FnAddSubNode(
      clearedOriginal,
      businessId,
      contactNodes,
      featureTreeProps,
      treeContainerFlatDataProps.featureId,
      true,
      0
    )
    const nextExpandedKeys = accordionExpandedKeys(updatedTreeData, businessId)
    setTreeData(updatedTreeData)
    setOriginalTreeData(updatedOriginalData)
    setDefaultExpandedKeys(nextExpandedKeys)
    if (contactNodes.length > 0) {
      selectNode(contactNodes[0], nextExpandedKeys, updatedTreeData, 'select')
    }
  }

  const handleNodeExpand = async (expandedNodeKeys: Key[], info: IExpandedNodeInfo) => {
    if (!info?.node || !treeContainerFlatDataProps || !featureTreeProps) return

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

    const records = await getContactsRef.current?.()
    if (requestId !== contactsRequestRef.current) {
      return
    }
    await applyContactsToBusiness(businessId, records ?? [])
  }

  const handleNodeSelect = (selectedKeys: Key[], info: ISelectedNodeInfo, expandedNodeKeys?: Key[]) => {
    setDefaultSelectedKeys(selectedKeys)
    setDefaultSelectedNodeInfo(info)
    smDataContext.setExplorerSelection(info.node, getAppliedFilterJson(filterFormDataRef.current))
    treeExplorerContainerProps.handleNodeSelect?.(
      selectedKeys,
      info,
      expandedNodeKeys ?? defaultExpandedKeys,
      treeData
    )
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
                allowMultiple={false}
                className="nz-dce-tree-for-flat-data"
                allowAPICallOnExpand={true}
                handleNodeExpand={handleNodeExpand}
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
