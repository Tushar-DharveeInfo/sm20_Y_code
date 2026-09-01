import React, { useEffect, useRef, useState } from 'react'
import { Key } from 'rc-tree/lib/interface'
import './DCExplorerContainer.css'
import {
  filterBusinessRecords,
  getAppliedFilterJson,
  hasActiveContactFilters,
  normalizeFilterFieldName,
} from '../allcommon/searchfilter/FnFilterBusinessContactRecords.ts'
import { useSmDataContext } from '../context/hooks/SmDataHooks.ts'
import {
  FnGetClientExplorerAutoFilter,
} from '../allcommon/searchfilter/FnGetClientExplorerAutoFilter.ts'
import { FnAddSubNode } from '../allcommon/tree/FnAddSubNode.ts'
import { FnMapBusinessesToTreeNodes } from '../allcommon/tree/FnMapBusinessesToTreeNodes.ts'
import { FnMapContactsToTreeNodes } from '../allcommon/tree/FnMapContactsToTreeNodes.ts'
import { FnSearchKeywordInLocalTree } from '../allcommon/FnSearchKeywordInLocalTree.ts'
import { IDCFilterControlValues } from '../allinterface/searchfilter/IFilterFormContainer.ts'
import { IDcExplorerContainer } from './IDcExplorerContainer.ts'
import { IExpandedNodeInfo, ISelectedNodeInfo, ITreeNode } from '../allinterface/tree/ITreeControl.ts'
import { IFeatureTree, ITreeForFlatDataContainer } from '../allinterface/tree/ITreeForFlatDataContainer.ts'
import { FilterFormContainer } from '../searchfilter/filterformcontainer/FilterFormContainer.tsx'
import { SearchControl } from '../searchfilter/searchcontrol/SearchControl.tsx'
import { TreeControl } from '../tree/treecontrol/TreeControl.tsx'

function buildFeatureTreeProps(): IFeatureTree {
  return {
    hideKebabMenu: true,
    allowCheckbox: false,
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

const DcExplorerContainer = (dcExplorerContainerProps: IDcExplorerContainer) => {
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

  const prevFeatureIdRef = useRef<string>(undefined)

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
    dcExplorerContainerProps.handleNodeSelect?.([node.key], info, expandedKeys, currentTree)
  }

  const setBusinessTree = (nodes: ITreeNode[]) => {
    const rootLabel = dcExplorerContainerProps.wrapWithRootLabel
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
    if (!dcExplorerContainerProps.featureId) return
    if (!smDataContext.isBusinessesLoaded) return
    if (prevFeatureIdRef.current === dcExplorerContainerProps.featureId) return
    prevFeatureIdRef.current = dcExplorerContainerProps.featureId

    const featureProps = buildFeatureTreeProps()
    const autoFilter = FnGetClientExplorerAutoFilter(dcExplorerContainerProps.featureId)
    setFeatureTreeProps(featureProps)
    setIsShowFilterForm(false)
    setIsFilterChange(false)
    setFilterFormData(autoFilter)
    filterFormDataRef.current = autoFilter
    setTreeContainerFlatDataProps({
      uniqueName: `${dcExplorerContainerProps.uniqueName}-dce-flat`,
      flatAPIData: null,
      featureId: dcExplorerContainerProps.featureId,
      featureTreeProps: featureProps,
    })

    // TODO: replace sampleBusinesses with API response when available
    applyBusinessTreeFromFilter(autoFilter, featureProps, dcExplorerContainerProps.featureId)
  }, [dcExplorerContainerProps.featureId, dcExplorerContainerProps.uniqueName, smDataContext.isBusinessesLoaded])

  const handleNodeExpand = async (expandedNodeKeys: Key[], info: IExpandedNodeInfo) => {
    if (!info?.expanded || !info.node || !treeContainerFlatDataProps || !featureTreeProps) return
    if (info.node.NodeType !== 'Business') {
      setDefaultExpandedKeys(expandedNodeKeys)
      return
    }

    // Reuse cached children when already loaded.
    if (info.node.children?.length) {
      setDefaultExpandedKeys(expandedNodeKeys)
      selectNode(info.node.children[0], expandedNodeKeys, treeData ?? [], 'select')
      return
    }

    const contactsForBusiness = smDataContext.getContactsForTree(
      String(info.node.NodeEntID ?? info.node.key),
      filterFormData
    )
    const contactNodes = FnMapContactsToTreeNodes(
      contactsForBusiness,
      featureTreeProps,
      treeContainerFlatDataProps.featureId,
      info.node.NodeEntID
    )
    const updatedTreeData = await FnAddSubNode(
      treeData ?? [],
      info.node.key,
      contactNodes,
      featureTreeProps,
      treeContainerFlatDataProps.featureId,
      false,
      info.node.stepNo
    )
    const updatedOriginalData = await FnAddSubNode(
      originalTreeData,
      info.node.key,
      contactNodes,
      featureTreeProps,
      treeContainerFlatDataProps.featureId,
      true,
      info.node.stepNo
    )
    setTreeData(updatedTreeData)
    setOriginalTreeData(updatedOriginalData)
    setDefaultExpandedKeys(expandedNodeKeys)

    if (contactNodes.length > 0) {
      selectNode(contactNodes[0], expandedNodeKeys, updatedTreeData, 'select')
    }
  }

  const handleNodeSelect = (selectedKeys: Key[], info: ISelectedNodeInfo, expandedNodeKeys?: Key[]) => {
    setDefaultSelectedKeys(selectedKeys)
    setDefaultSelectedNodeInfo(info)
    smDataContext.setExplorerSelection(info.node, getAppliedFilterJson(filterFormDataRef.current))
    dcExplorerContainerProps.handleNodeSelect?.(
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
      const autoFilter = FnGetClientExplorerAutoFilter(dcExplorerContainerProps.featureId)
      setFilterFormData(autoFilter)
      filterFormDataRef.current = autoFilter
      isFilterChangeRef.current = false
      setIsFilterChange(false)
      setIsShowFilterForm(false)
      if (featureTreeProps && dcExplorerContainerProps.featureId) {
        applyBusinessTreeFromFilter(autoFilter, featureTreeProps, dcExplorerContainerProps.featureId)
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
      if (isFilterChangeRef.current && featureTreeProps && dcExplorerContainerProps.featureId) {
        const appliedFilterJson = getAppliedFilterJson(filterFormDataRef.current)
        setFilterFormData(appliedFilterJson)
        filterFormDataRef.current = appliedFilterJson
        applyBusinessTreeFromFilter(appliedFilterJson, featureTreeProps, dcExplorerContainerProps.featureId)
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
              uniqueName={`${dcExplorerContainerProps.uniqueName}-search`}
              isShowFilterControl={!dcExplorerContainerProps.subTreeFeatureId}
              lensDirty={(searchText || '').length > 0}
              filterDirty={isFilterChange}
              searchInputValue={searchText || ''}
              hideSearchControl={false}
              hideRightMouseMenu={!!dcExplorerContainerProps.subTreeFeatureId}
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
                autoFocus={!dcExplorerContainerProps.subTreeFeatureId}
                defaultExpandedKeys={defaultExpandedKeys}
                defaultSelectedKeys={defaultSelectedKeys}
                defaultCheckedKeys={[]}
                defaultSelectedNodeInfo={defaultSelectedNodeInfo || undefined}
                allowCheckbox={false}
                allowIcon={false}
                allowInternalDrag={false}
                allowMultiple={false}
                className="nz-dce-tree-for-flat-data"
                handleNodeExpand={handleNodeExpand}
                handleNodeSelect={handleNodeSelect}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <FilterFormContainer
          uniqueName={`${dcExplorerContainerProps.uniqueName}-filter-form`}
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

export { DcExplorerContainer }
