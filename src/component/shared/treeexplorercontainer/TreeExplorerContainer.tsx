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
  FnIsClientOrProspectFeature,
  FnIsTicketsNoFilterFeature,
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
import { useMainAppContext } from '../context/hooks/MainAppHooks.ts'
import { kebabMenuEnums, ProspectEnums, SettingEnums, RmsEnums } from '../../constants/Feature.ts'
import { useStatusBarContext } from '../context/hooks/StatusBarHooks.ts'
import { useRmsContext } from '../context/hooks/RmsHooks.ts'
import { FnFilterRmsEqidTree, FnBuildRmsEqidTree } from '../../features/rms/allcommon/FnFilterRmsEqidTree.ts'
import { FnUpdateTreeNodeBasedOnKey } from '../allcommon/tree/FnUpdateTreeNodeBasedOnKey.ts'
import { FnCopyToClipboard } from '../allcommon/basic/FnCopyToClipboard.ts'

const isRmsEqidFeature = (featureId?: string) => {
  if (!featureId) return false;
  const fid = String(featureId).toLowerCase().trim();
  return featureId === RmsEnums.EQID || featureId === '402' || fid === '402' || fid === 'eqid';
};

const isReviewDeletedFeature = (featureId?: string) => {
  if (!featureId) return false;
  const fid = String(featureId).toLowerCase().trim();
  return (
    featureId === ProspectEnums.ReviewDeleted ||
    featureId === '258' ||
    featureId === SettingEnums.Delete ||
    featureId === '920' ||
    fid === 'review deleted' ||
    fid === 'delete'
  );
};

const isRecordDeleted = (status?: string | number | null) => {
  const st = String(status ?? '').trim().toLowerCase();
  return st === 'deleted' || st === 'tobedeleted' || st === 'delete';
};

function buildFeatureTreeProps(allowCheckbox = false, hideKebabMenu = false): IFeatureTree {
  return {
    hideKebabMenu,
    allowCheckbox,
    allowIcon: false,
    hideCopyIcon: false,
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
  const mainAppContext = useMainAppContext()
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
  const statusBarContext = useStatusBarContext()
  let rmsContext: ReturnType<typeof useRmsContext> | undefined;
  try {
    rmsContext = useRmsContext();
  } catch {
    // Handled if outside RmsProvider
  }
  const { getBusinesses, updateBusiness } = useBusinesses()
  const treeDataRef = useRef<ITreeNode[] | undefined>(undefined)
  const originalTreeDataRef = useRef<ITreeNode[]>([])
  const getContactsRef = useRef<ReturnType<typeof useContacts>['getContacts'] | null>(null)
  const contactsRequestRef = useRef(0)

  const prevFeatureIdRef = useRef<string>(undefined)
  const [expandedBusinessId, setExpandedBusinessId] = useState('')
  const { getContacts, updateContact } = useContacts(expandedBusinessId)
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

  const handleKebabMenuSelect = useCallback((selectedItem: any, nodeParam?: ITreeNode | ISelectedNodeInfo) => {
    const payload = selectedItem?.payload ?? selectedItem;
    const targetNode = (nodeParam && 'node' in nodeParam)
      ? nodeParam.node
      : (nodeParam as ITreeNode | undefined) ?? defaultSelectedNodeInfo?.node;
    if (treeExplorerContainerProps.handleKebabMenuSelect && targetNode) {
      treeExplorerContainerProps.handleKebabMenuSelect(selectedItem, {
        event: 'select',
        selected: true,
        node: targetNode,
        selectedNodes: [targetNode],
      });
      return;
    }
    const label = String(payload?.Label ?? '').trim().toLowerCase();
    const alias = String(payload?.Alias ?? '').trim().toLowerCase();

    const isUnapproved = label === kebabMenuEnums.Unapprove || label === kebabMenuEnums.Unapproved;
    const isBlock = label === kebabMenuEnums.Block || label === kebabMenuEnums.Blocked;
    const isDelete = label === kebabMenuEnums.Delete || label === kebabMenuEnums.Deleted;
    const isServices = label === kebabMenuEnums.Services || alias === 'service';
    const isCopy = label === kebabMenuEnums.Copy;
    const isAddBusiness = label === kebabMenuEnums.AddBusiness;
    const isAddContact = label === kebabMenuEnums.AddContact;

    if (isServices) {
      const bid = targetNode?.bid ?? '';
      const cid = targetNode?.cid ?? targetNode?.NodeEntID ?? '';
      const url = new URL(window.location.href);
      url.searchParams.set('bid', bid);
      url.searchParams.set('cid', cid);
      const newTab = window.open(url.toString(), '_blank');
      if (newTab) {
        newTab.document.title = 'Service';
      }
    } else if (isCopy && targetNode) {
      FnCopyToClipboard(targetNode.TableLabel ? `${targetNode.TableLabel}` : (targetNode.Name ? targetNode.Name : ''));
    } else if (isAddBusiness) {
      const message = payload?.Tooltip || 'Add Business';
      alert(message);
    } else if (isAddContact) {
      const message = payload?.Tooltip || 'Add Contact';
      alert(message);
    } else if (targetNode) {
      if (isUnapproved || isBlock || isDelete) {
        const isContact = Boolean(
          targetNode.NodeType?.toLowerCase() === "contact" ||
          targetNode.treetype?.toLowerCase() === "contact" ||
          targetNode.NodeEntityname?.toLowerCase() === "contact" ||
          (targetNode.cid && targetNode.cid !== targetNode.bid)
        );

        const cid = String(targetNode.cid || targetNode.NodeEntID || targetNode.key);
        let parentBid = String(targetNode.bid || targetNode.parentEntID || '').trim();
        if (!parentBid || parentBid.toLowerCase() === 'root-businesses' || parentBid.toLowerCase() === 'businesses') {
          const foundInContext = smDataContext.datasets?.contacts?.find(
            (c) => String(c.cid).toLowerCase() === cid.toLowerCase()
          );
          if (foundInContext?.bid) {
            parentBid = String(foundInContext.bid);
          } else {
            const match = cid.match(/bid_\d+/i);
            if (match) {
              parentBid = match[0];
            }
          }
        }

        if (isUnapproved) {
          targetNode.verified = false;
          targetNode.IsAuthorized = false;
          if (isContact) {
            void firestore.updateDocument({
              pathSegments: ['businesses', parentBid, 'contacts', cid],
              data: { verified: false, monitor: false },
              allowedKeys: ['verified', 'monitor'],
            }).catch((err) => console.warn('firestore updateDocument contact unapproved error:', err));
            if (smDataContext.datasets?.contacts) {
              smDataContext.updateDataset('contacts', smDataContext.datasets.contacts.map((c) =>
                String(c.cid).toLowerCase() === cid.toLowerCase() ? { ...c, verified: false, monitor: false } : c
              ));
            }
          } else {
            const bid = String(targetNode.bid || targetNode.NodeEntID || targetNode.key);
            void firestore.updateDocument({
              pathSegments: ['businesses', bid],
              data: { verified: false },
              allowedKeys: ['verified'],
            }).catch((err) => console.warn('firestore updateDocument business unapproved error:', err));
            if (smDataContext.datasets?.businesses) {
              smDataContext.updateDataset('businesses', smDataContext.datasets.businesses.map((b) =>
                String(b.bid).toLowerCase() === bid.toLowerCase() ? { ...b, verified: false } : b
              ));
            }
          }
        } else if (isBlock) {
          targetNode.status = 'Blocked';
          targetNode.NodeState = 'Blocked';
          targetNode.Description = 'Blocked';
          if (isContact) {
            void firestore.updateDocument({
              pathSegments: ['businesses', parentBid, 'contacts', cid],
              data: { status: 'Blocked' },
              allowedKeys: ['status'],
            }).catch((err) => console.warn('firestore updateDocument contact Blocked error:', err));
            if (smDataContext.datasets?.contacts) {
              smDataContext.updateDataset('contacts', smDataContext.datasets.contacts.map((c) =>
                String(c.cid).toLowerCase() === cid.toLowerCase() ? { ...c, status: 'Blocked' } : c
              ));
            }
          } else {
            const bid = String(targetNode.bid || targetNode.NodeEntID || targetNode.key);
            void firestore.updateDocument({
              pathSegments: ['businesses', bid],
              data: { status: 'Blocked' },
              allowedKeys: ['status'],
            }).catch((err) => console.warn('firestore updateDocument business Blocked error:', err));
            if (smDataContext.datasets?.businesses) {
              smDataContext.updateDataset('businesses', smDataContext.datasets.businesses.map((b) =>
                String(b.bid).toLowerCase() === bid.toLowerCase() ? { ...b, status: 'Blocked' } : b
              ));
            }
          }
        } else if (isDelete) {
          targetNode.status = 'deleted';
          targetNode.NodeState = 'deleted';
          targetNode.Description = 'deleted';
          if (isContact) {
            void firestore.updateDocument({
              pathSegments: ['businesses', parentBid, 'contacts', cid],
              data: { status: 'deleted' },
              allowedKeys: ['status'],
            }).catch((err) => console.warn('firestore updateDocument contact deleted error:', err));
            if (smDataContext.datasets?.contacts) {
              smDataContext.updateDataset('contacts', smDataContext.datasets.contacts.map((c) =>
                String(c.cid).toLowerCase() === cid.toLowerCase() ? { ...c, status: 'deleted' } : c
              ));
            }
          } else {
            const bid = String(targetNode.bid || targetNode.NodeEntID || targetNode.key);
            void firestore.updateDocument({
              pathSegments: ['businesses', bid],
              data: { status: 'deleted' },
              allowedKeys: ['status'],
            }).catch((err) => console.warn('firestore updateDocument business deleted error:', err));
            if (smDataContext.datasets?.businesses) {
              smDataContext.updateDataset('businesses', smDataContext.datasets.businesses.map((b) =>
                String(b.bid).toLowerCase() === bid.toLowerCase() ? { ...b, status: 'deleted' } : b
              ));
            }
          }
        }

        commonVariableContext.setReloadTreeFor({
          featureId: String(treeExplorerContainerProps.featureId),
          entId: String(targetNode.cid || targetNode.key || targetNode.NodeEntID || targetNode.bid),
          dropNodeEntId: isContact ? parentBid : undefined,
          timestamp: Date.now(),
        });
      }
    }
  }, [treeExplorerContainerProps.handleKebabMenuSelect, treeExplorerContainerProps.featureId, defaultSelectedNodeInfo, smDataContext, firestore, commonVariableContext]);

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
    if (currentTree && node.key) {
      void handleSelectedKeyChange(currentTree, node.key, info);
    }
    treeExplorerContainerProps.handleNodeSelect?.([node.key], info, expandedKeys, currentTree)
  }

  const setBusinessTree = (nodes: ITreeNode[], targetIdToSelect?: string, isMenuSwitch?: boolean) => {
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
    treeDataRef.current = treeNodes
    originalTreeDataRef.current = treeNodes
    contactsRequestRef.current += 1
    setExpandedBusinessId('')

    const urlParams = new URLSearchParams(window.location.search);
    const prevNode = defaultSelectedNodeInfo?.node;
    let prevBid = (targetIdToSelect || urlParams.get('bid') || '').trim();
    if (!prevBid && prevNode) {
      if (prevNode.NodeType === 'Root' || prevNode.key === 'root-businesses') {
        prevBid = '';
      } else if (prevNode.NodeType === 'Business' || String(prevNode.key || '').startsWith('bid_')) {
        prevBid = String(prevNode.NodeEntID || prevNode.key || (prevNode as any).bid || '').trim();
      } else if (prevNode.NodeType === 'Contact' || String(prevNode.key || '').startsWith('cid_')) {
        prevBid = String((prevNode as any).bid || prevNode.parentEntID || '').trim();
      } else {
        prevBid = String((prevNode as any).bid || prevNode.NodeEntID || prevNode.key || '').trim();
      }
    }
    if (!prevBid && !prevNode && smDataContext.selection?.bid) {
      prevBid = String(smDataContext.selection.bid).trim();
    }

    const targetNode = prevBid
      ? nodes.find((n) => {
        const nKey = String(n.NodeEntID || n.key || (n as any).bid || '').trim().toLowerCase();
        return nKey === prevBid.toLowerCase();
      })
      : undefined;

    if (targetNode) {
      // Previous selected node's business node is found in current feature:
      // Remove contact expand keys and set expanded key to root and this business node
      const nextExpanded = [treeNodes[0].key, targetNode.key];
      setDefaultExpandedKeys(nextExpanded);
      setExpandedBusinessId(targetNode.key);
      selectNode(targetNode, nextExpanded, treeNodes, 'select');

      if (!businessesOnly) {
        void (async () => {
          try {
            const records = await fetchContactsFromApi(targetNode.key);
            await applyContactsToBusiness(targetNode.key, records ?? [], false);
          } catch (e) {
            console.warn('Failed to load contacts for auto-selected business:', e);
          }
        })();
      }
    } else if (treeNodes.length > 0) {
      // Business node NOT found in current feature: select root node of bs
      const rootKey = [treeNodes[0].key];
      setDefaultExpandedKeys(rootKey);
      selectNode(treeNodes[0], rootKey, treeNodes, 'auto-select');
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
    statusBarContext?.setIsLoading?.(true);
    statusBarContext?.setLoadingLabel?.('Loading...');
    try {
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
      let businesses: IBusinessDoc[];
      if (isRmsEqidFeature(treeExplorerContainerProps.featureId)) {
        let eqidDocs = rmsContext?.eqid ?? [];
        if ((!eqidDocs || eqidDocs.length === 0) && rmsContext?.loadEqid) {
          eqidDocs = (await rmsContext.loadEqid()) ?? [];
        }
        const rmsResult = FnFilterRmsEqidTree(uniqueBusinesses, eqidDocs, mergedForm);
        businesses = rmsResult.filteredBusinesses;
      } else {
        businesses = filterBusinessRecords(uniqueBusinesses, mergedForm, treeExplorerContainerProps.featureId);
        const isReviewDeleted = isReviewDeletedFeature(treeExplorerContainerProps.featureId);

        if (isReviewDeleted) {
          const contactPromises = uniqueBusinesses.map(async (b) => {
            const bid = String(b.bid || (b as any).EntID || (b as any).id || '').trim();
            if (!bid) return [];
            return fetchContactsFromApi(bid);
          });
          const allResults = await Promise.all(contactPromises);
          const allFetchedContacts: IContactDoc[] = [];
          allResults.forEach((records, idx) => {
            const bid = String(uniqueBusinesses[idx].bid || (uniqueBusinesses[idx] as any).EntID || (uniqueBusinesses[idx] as any).id || '').trim();
            const docs = FnMapToContactDocs(records, bid);
            allFetchedContacts.push(...docs);
          });

          smDataContext.setDatasets((prev) => {
            const existing = prev.contacts ?? [];
            const merged = [...existing];
            for (const doc of allFetchedContacts) {
              const idx = merged.findIndex(
                (c) => String(c.cid).toLowerCase() === String(doc.cid).toLowerCase()
              );
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...doc };
              } else {
                merged.push(doc);
              }
            }
            return { ...prev, contacts: merged };
          });

          const deletedBids = new Set(
            allFetchedContacts
              .filter((c) => isRecordDeleted(c.status ?? (c as any).Status ?? (c as any).NodeState))
              .map((c) => String(c.bid ?? '').trim().toLowerCase())
          );
          businesses = businesses.filter((business) => {
            const bid = String(business.bid || (business as any).EntID || (business as any).id || '').toLowerCase();
            const isBsDeleted = isRecordDeleted(business.status ?? (business as any).Status ?? (business as any).NodeState);
            return isBsDeleted || deletedBids.has(bid);
          });
        } else if (hasActiveContactFilters(mergedForm)) {
          const matchingBids = new Set(
            smDataContext
              .getContactsForTree("", mergedForm)
              .map((contact) => String(contact.bid ?? '').toLowerCase())
          );
          businesses = businesses.filter((business) => {
            const bid = String(business.bid || (business as any).EntID || (business as any).id || '').toLowerCase();
            return matchingBids.has(bid);
          });
        }
      }
      const businessNodes = FnMapBusinessesToTreeNodes(businesses, featureProps, treeExplorerContainerProps.featureId, handleKebabMenuSelect);

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

        const combinedRaw = [...contextContacts, ...apiContacts];
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

        let filteredContacts: IContactDoc[];
        if (isRmsEqidFeature(treeExplorerContainerProps.featureId)) {
          let eqidDocs = rmsContext?.eqid ?? [];
          if ((!eqidDocs || eqidDocs.length === 0) && rmsContext?.loadEqid) {
            eqidDocs = (await rmsContext.loadEqid()) ?? [];
          }
          if ((!eqidDocs || eqidDocs.length === 0) && firestore) {
            try {
              const res = await firestore.queryDocuments({ pathSegments: ['eqid'] });
              if (res?.data && Array.isArray(res.data)) {
                eqidDocs = (res.data as any[]).map((d) => ({
                  ...d,
                  eqid: String(d.eqid || d.id || d.key || '').trim(),
                }));
                rmsContext?.setEqid?.(eqidDocs);
              }
            } catch (e) {
              console.warn('Direct query eqid error in refreshTreeAndSelectNode:', e);
            }
          }
          const rmsResult = FnFilterRmsEqidTree([], eqidDocs, filterFormDataRef.current, uniqueContactsForBid);
          filteredContacts = rmsResult.filterContactsForBid(uniqueContactsForBid, targetBusinessId);
        } else {
          const isReviewDeletedNode = isReviewDeletedFeature(treeExplorerContainerProps.featureId);
          const contactsToFilterForBid = isReviewDeletedNode
            ? uniqueContactsForBid.filter((c) => isRecordDeleted(c.status ?? (c as any).Status ?? (c as any).NodeState))
            : uniqueContactsForBid;

          filteredContacts = filterContactRecords(
            contactsToFilterForBid,
            filterFormDataRef.current,
            targetBusinessId
          );
        }
        const contactNodes = FnMapContactsToTreeNodes(
          filteredContacts,
          featureProps,
          treeExplorerContainerProps.featureId,
          targetBusinessId,
          handleKebabMenuSelect
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
    } finally {
      statusBarContext?.setIsLoading?.(false);
      statusBarContext?.setLoadingLabel?.(undefined);
    }
  };

  /*Filters sample businesses (and contact-gated businesses) then maps to tree nodes. */
  const applyBusinessTreeFromFilter = async (
    form: IDCFilterControlValues,
    featureProps: IFeatureTree,
    featureId: string,
    source?: IBusinessDoc[],
    isMenuSwitch?: boolean,
    eqidSource?: any[],
    contactsSource?: IContactDoc[]
  ) => {
    const autoFilter = FnGetClientExplorerAutoFilter(featureId)
    const mergedForm: IDCFilterControlValues = { ...autoFilter, ...form }
    const sourceBusinesses = source ?? smDataContext.datasets.businesses ?? []
    const isReviewDeleted = isReviewDeletedFeature(featureId);
    const isRmsEqid = isRmsEqidFeature(featureId);

    if (isRmsEqid) {
      let eqidData = eqidSource ?? rmsContext?.eqid ?? [];
      if ((!eqidData || eqidData.length === 0) && rmsContext?.loadEqid) {
        eqidData = (await rmsContext.loadEqid()) ?? [];
      }
      if ((!eqidData || eqidData.length === 0) && firestore) {
        try {
          const res = await firestore.queryDocuments({ pathSegments: ['eqid'] });
          if (res?.data && Array.isArray(res.data)) {
            eqidData = (res.data as any[]).map((d) => ({
              ...d,
              eqid: String(d.eqid || d.id || d.key || '').trim(),
            }));
            rmsContext?.setEqid?.(eqidData);
          }
        } catch (e) {
          console.warn('Direct query eqid error in applyBusinessTreeFromFilter:', e);
        }
      }

      let resolvedBusinesses = sourceBusinesses;
      if (!resolvedBusinesses.length) {
        try {
          const apiBs = await getBusinesses().catch(() => null);
          if (apiBs?.length) {
            resolvedBusinesses = FnMapToBusinessDocs(apiBs);
            smDataContext.setDatasets((prev) => ({ ...prev, businesses: resolvedBusinesses }));
          }
        } catch {}
      }

      const filterRes = FnFilterRmsEqidTree(resolvedBusinesses, eqidData, mergedForm);
      const matchingBidsList = Array.from(filterRes.matchingBids);
      const existingContacts = smDataContext.datasets.contacts ?? [];
      const bidsMissingContacts = matchingBidsList.filter(
        (bid) => !existingContacts.some((c) => String(c.bid).trim().toLowerCase() === bid)
      );

      let allKnownContacts = contactsSource ?? existingContacts;
      if (bidsMissingContacts.length > 0) {
        try {
          const contactArrays = await Promise.all(
            bidsMissingContacts.map(async (bid) => {
              const recs = await fetchContactsFromApi(bid);
              return FnMapToContactDocs(recs, bid);
            })
          );
          const newlyFetched = contactArrays.flat();
          if (newlyFetched.length > 0) {
            smDataContext.setDatasets((prev) => {
              const existing = prev.contacts ?? [];
              const merged = [...existing];
              for (const doc of newlyFetched) {
                const idx = merged.findIndex(
                  (c) => String(c.cid).toLowerCase() === String(doc.cid).toLowerCase() &&
                         String(c.bid).toLowerCase() === String(doc.bid).toLowerCase()
                );
                if (idx >= 0) {
                  merged[idx] = { ...merged[idx], ...doc };
                } else {
                  merged.push(doc);
                }
              }
              return { ...prev, contacts: merged };
            });
            allKnownContacts = [...allKnownContacts, ...newlyFetched];
          }
        } catch (e) {
          console.warn('Error fetching missing contacts for RMS EQID:', e);
        }
      }

      const treeNodes = FnBuildRmsEqidTree(
        resolvedBusinesses,
        allKnownContacts,
        eqidData,
        mergedForm,
        featureProps,
        featureId,
        treeExplorerContainerProps.wrapWithRootLabel ?? 'Businesses',
        handleKebabMenuSelect
      );

      setTreeData(treeNodes);
      setOriginalTreeData(treeNodes);
      treeDataRef.current = treeNodes;
      originalTreeDataRef.current = treeNodes;
      contactsRequestRef.current += 1;
      setExpandedBusinessId('');

      const urlParams = new URLSearchParams(window.location.search);
      const prevNode = defaultSelectedNodeInfo?.node;
      let prevBid = (urlParams.get('bid') || '').trim();
      let prevCid = (urlParams.get('cid') || '').trim();

      if (!prevBid && prevNode) {
        if (prevNode.NodeType === 'Root' || prevNode.key === 'root-businesses') {
          prevBid = '';
        } else if (prevNode.NodeType === 'Business' || String(prevNode.key || '').startsWith('bid_')) {
          prevBid = String(prevNode.NodeEntID || prevNode.key || (prevNode as any).bid || '').trim();
        } else if (prevNode.NodeType === 'Contact' || String(prevNode.key || '').startsWith('cid_')) {
          prevBid = String((prevNode as any).bid || prevNode.parentEntID || '').trim();
          prevCid = String(prevNode.NodeEntID || prevNode.key || (prevNode as any).cid || '').trim();
        }
      }
      if (!prevBid && !prevNode && smDataContext.selection?.bid) {
        prevBid = String(smDataContext.selection.bid).trim();
      }

      const businessNodes = treeNodes[0]?.children ?? [];
      let targetNodeToSelect: ITreeNode | undefined;
      let expandedKeysToSet: Key[] = ['root-businesses'];

      if (prevBid) {
        const foundBusiness = businessNodes.find((bn) => {
          const bKey = String(bn.NodeEntID || bn.key || (bn as any).bid || '').trim().toLowerCase();
          return bKey === prevBid.toLowerCase();
        });
        if (foundBusiness) {
          expandedKeysToSet = ['root-businesses', foundBusiness.key];
          if (prevCid) {
            const foundContact = foundBusiness.children?.find((cn) => {
              const cKey = String(cn.NodeEntID || cn.key || (cn as any).cid || '').trim().toLowerCase();
              return cKey === prevCid.toLowerCase();
            });
            targetNodeToSelect = foundContact ?? foundBusiness;
          } else {
            targetNodeToSelect = foundBusiness;
          }
        }
      }

      if (!targetNodeToSelect && treeNodes.length > 0) {
        targetNodeToSelect = treeNodes[0];
        expandedKeysToSet = ['root-businesses'];
      }

      setDefaultExpandedKeys(expandedKeysToSet);
      if (targetNodeToSelect) {
        selectNode(targetNodeToSelect, expandedKeysToSet, treeNodes, isMenuSwitch ? 'select' : 'auto-select');
      }
      return;
    }

    let businesses: IBusinessDoc[];
    businesses = filterBusinessRecords(sourceBusinesses, mergedForm, featureId);

    if (isReviewDeleted) {
      const deletedBids = new Set(
        (smDataContext.datasets.contacts ?? [])
          .filter((c) => isRecordDeleted(c.status ?? (c as any).Status ?? (c as any).NodeState))
          .map((contact) => String(contact.bid ?? '').toLowerCase())
      );
      businesses = businesses.filter((business) => {
        const bid = String(business.bid || (business as any).EntID || (business as any).id || '').toLowerCase();
        const isBsDeleted = isRecordDeleted(business.status ?? (business as any).Status ?? (business as any).NodeState);
        return isBsDeleted || deletedBids.has(bid);
      });
    } else if (hasActiveContactFilters(mergedForm)) {
      const matchingBids = new Set(
        smDataContext
          .getContactsForTree("", mergedForm)
          .map((contact) => String(contact.bid ?? '').toLowerCase())
      );
      businesses = businesses.filter((business) => {
        const bid = String(business.bid || (business as any).EntID || (business as any).id || '').toLowerCase();
        return matchingBids.has(bid);
      });
    }

    setBusinessTree(FnMapBusinessesToTreeNodes(businesses, featureProps, featureId, handleKebabMenuSelect), undefined, isMenuSwitch)
  }

  // Reload business tree when featureId changes.
  // For Client and Prospect menus: uses cached businesses dataset.
  // For other menus: calls hook to load data into bs tree and then filters it.
  useEffect(() => {
    if (!treeExplorerContainerProps.featureId) return

    const configKey = `${treeExplorerContainerProps.featureId}-${!!treeExplorerContainerProps.allowCheckbox}`
    if (prevFeatureIdRef.current === configKey) return

    setDefaultExpandedKeys(['root-businesses'])
    setExpandedBusinessId('')

    const isClientOrProspect = FnIsClientOrProspectFeature(
      treeExplorerContainerProps.featureId,
      mainAppContext.featureRecords
    )

    // For Client and Prospect menus, use cached businesses once loaded
    if (isClientOrProspect) {
      if (!smDataContext.isBusinessesLoaded) {
        smDataContext.loadBusinessesOnce()
        return
      }
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

      const isReviewDeleted = isReviewDeletedFeature(treeExplorerContainerProps.featureId);

      if (isReviewDeleted) {
        void (async () => {
          statusBarContext?.setIsLoading?.(true);
          statusBarContext?.setLoadingLabel?.('Loading contacts...');
          try {
            let currentBusinesses = smDataContext.datasets.businesses ?? [];
            if (!currentBusinesses.length) {
              const apiBs = await getBusinesses().catch(() => null);
              if (apiBs?.length) {
                currentBusinesses = FnMapToBusinessDocs(apiBs);
                smDataContext.setDatasets((prev) => ({ ...prev, businesses: currentBusinesses }));
              }
            }

            const contactPromises = currentBusinesses.map(async (b) => {
              const bid = String(b.bid || (b as any).EntID || (b as any).id || '').trim();
              if (!bid) return [];
              return fetchContactsFromApi(bid);
            });
            const allResults = await Promise.all(contactPromises);
            const allFetchedContacts: IContactDoc[] = [];
            allResults.forEach((records, idx) => {
              const bid = String(currentBusinesses[idx].bid || (currentBusinesses[idx] as any).EntID || (currentBusinesses[idx] as any).id || '').trim();
              const docs = FnMapToContactDocs(records, bid);
              allFetchedContacts.push(...docs);
            });

            smDataContext.setDatasets((prev) => {
              const existing = prev.contacts ?? [];
              const merged = [...existing];
              for (const doc of allFetchedContacts) {
                const idx = merged.findIndex(
                  (c) => String(c.cid).toLowerCase() === String(doc.cid).toLowerCase()
                );
                if (idx >= 0) {
                  merged[idx] = { ...merged[idx], ...doc };
                } else {
                  merged.push(doc);
                }
              }
              return { ...prev, contacts: merged };
            });

            const deletedBids = new Set(
              allFetchedContacts
                .filter((c) => isRecordDeleted(c.status ?? (c as any).Status ?? (c as any).NodeState))
                .map((c) => String(c.bid ?? '').trim().toLowerCase())
            );

            const matchingBusinesses = currentBusinesses.filter((b) => {
              const bid = String(b.bid || (b as any).EntID || (b as any).id || '').trim().toLowerCase();
              const isBsDeleted = isRecordDeleted(b.status ?? (b as any).Status ?? (b as any).NodeState);
              return isBsDeleted || deletedBids.has(bid);
            });

            setBusinessTree(FnMapBusinessesToTreeNodes(matchingBusinesses, featureProps, treeExplorerContainerProps.featureId, handleKebabMenuSelect), undefined, true);
          } catch (err) {
            console.warn('Failed to load contacts for review deleted:', err);
            applyBusinessTreeFromFilter(autoFilter, featureProps, treeExplorerContainerProps.featureId, undefined, true);
          } finally {
            statusBarContext?.setIsLoading?.(false);
            statusBarContext?.setLoadingLabel?.(undefined);
          }
        })();
      } else {
        applyBusinessTreeFromFilter(autoFilter, featureProps, treeExplorerContainerProps.featureId, undefined, true);
      }
    } else {
      // If menu is not selected in Client and Prospect, call hook and load data into bs tree
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

      const currentConfigKey = configKey
      const loadFromHook = async () => {
        try {
          if (isRmsEqidFeature(treeExplorerContainerProps.featureId)) {
            statusBarContext?.setIsLoading?.(true);
            statusBarContext?.setLoadingLabel?.('Loading RMS EQID...');

            // 1. Get all records from eqid table
            let eqidDocs = rmsContext?.eqid ?? [];
            if (!eqidDocs || eqidDocs.length === 0) {
              if (rmsContext?.loadEqid) {
                eqidDocs = (await rmsContext.loadEqid()) ?? [];
              }
              if ((!eqidDocs || eqidDocs.length === 0) && firestore) {
                try {
                  const res = await firestore.queryDocuments({ pathSegments: ['eqid'] });
                  if (res?.data && Array.isArray(res.data)) {
                    eqidDocs = (res.data as any[]).map((d) => ({
                      ...d,
                      eqid: String(d.eqid || d.id || d.key || '').trim(),
                    }));
                    rmsContext?.setEqid?.(eqidDocs);
                  }
                } catch (e) {
                  console.warn('Direct query eqid error in loadFromHook:', e);
                }
              }
            }

            // 2. Get businesses
            let currentBusinesses = smDataContext.datasets.businesses ?? [];
            if (!currentBusinesses.length) {
              const apiBusinesses = await getBusinesses().catch(() => null);
              if (apiBusinesses?.length) {
                currentBusinesses = FnMapToBusinessDocs(apiBusinesses);
                smDataContext.setDatasets((prev) => ({
                  ...prev,
                  businesses: currentBusinesses,
                }));
              }
            }

            if (prevFeatureIdRef.current !== currentConfigKey) {
              return;
            }

            // 3. Match bid and cid of eqid table with BS tree
            const rmsFilterResult = FnFilterRmsEqidTree(currentBusinesses, eqidDocs, autoFilter);
            const matchingBids = Array.from(rmsFilterResult.matchingBids);

            // Fetch contacts for matching businesses
            const contactPromises = matchingBids.map(async (bid) => {
              const records = await fetchContactsFromApi(bid);
              return FnMapToContactDocs(records, bid);
            });
            const fetchedContactArrays = await Promise.all(contactPromises);
            const allFetchedContacts = fetchedContactArrays.flat();

            // Merge contacts into smDataContext
            smDataContext.setDatasets((prev) => {
              const existing = prev.contacts ?? [];
              const merged = [...existing];
              for (const doc of allFetchedContacts) {
                const idx = merged.findIndex(
                  (c) => String(c.cid).toLowerCase() === String(doc.cid).toLowerCase() &&
                         String(c.bid).toLowerCase() === String(doc.bid).toLowerCase()
                );
                if (idx >= 0) {
                  merged[idx] = { ...merged[idx], ...doc };
                } else {
                  merged.push(doc);
                }
              }
              return { ...prev, contacts: merged };
            });

            const combinedContacts = [
              ...(smDataContext.datasets.contacts ?? []),
              ...allFetchedContacts,
            ];

            // 4. Build and apply BS tree
            await applyBusinessTreeFromFilter(
              autoFilter,
              featureProps,
              treeExplorerContainerProps.featureId,
              currentBusinesses,
              true,
              eqidDocs,
              combinedContacts
            );
            return;
          }

          const apiBusinesses = await getBusinesses();
          if (prevFeatureIdRef.current !== currentConfigKey) {
            return;
          }
          if (apiBusinesses?.length) {
            const mapped = FnMapToBusinessDocs(apiBusinesses);
            smDataContext.setDatasets((prev) => ({
              ...prev,
              businesses: mapped,
            }));
            await applyBusinessTreeFromFilter(autoFilter, featureProps, treeExplorerContainerProps.featureId, mapped, true);
            return;
          }
        } catch (err) {
          console.warn('Failed to load businesses from hook for feature:', treeExplorerContainerProps.featureId, err);
        } finally {
          statusBarContext?.setIsLoading?.(false);
          statusBarContext?.setLoadingLabel?.(undefined);
        }
        if (prevFeatureIdRef.current === currentConfigKey) {
          await applyBusinessTreeFromFilter(autoFilter, featureProps, treeExplorerContainerProps.featureId, undefined, true);
        }
      };

      void loadFromHook();
    }
  }, [
    treeExplorerContainerProps.featureId,
    treeExplorerContainerProps.uniqueName,
    treeExplorerContainerProps.allowCheckbox,
    smDataContext.isBusinessesLoaded,
    mainAppContext.featureRecords,
    getBusinesses,
  ])

  useEffect(() => {
    if (!commonVariableContext.reloadTreeFor) return;
    const { featureId, entId, dropNodeEntId } = commonVariableContext.reloadTreeFor;
    if (featureId && String(featureId) !== String(treeExplorerContainerProps.featureId)) return;
    void refreshTreeAndSelectNode(entId, dropNodeEntId);
  }, [commonVariableContext.reloadTreeFor]);

  useEffect(() => {
    if (!isRmsEqidFeature(treeExplorerContainerProps.featureId)) return;
    if (!featureTreeProps || !rmsContext?.eqid?.length) return;
    void applyBusinessTreeFromFilter(
      filterFormDataRef.current,
      featureTreeProps,
      treeExplorerContainerProps.featureId,
      undefined,
      false,
      rmsContext.eqid
    );
  }, [rmsContext?.eqid, treeExplorerContainerProps.featureId, featureTreeProps]);

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

    const combined = [...contextContacts, ...apiContacts];
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

    const isReviewDeletedNode = isReviewDeletedFeature(treeExplorerContainerProps.featureId);

    const contactsToFilter = isReviewDeletedNode
      ? mappedContacts.filter((c) => isRecordDeleted(c.status ?? (c as any).Status ?? (c as any).NodeState))
      : mappedContacts;

    let filteredContacts: IContactDoc[];
    if (isRmsEqidFeature(treeExplorerContainerProps.featureId)) {
      let eqidDocs = rmsContext?.eqid ?? [];
      if ((!eqidDocs || eqidDocs.length === 0) && rmsContext?.loadEqid) {
        eqidDocs = (await rmsContext.loadEqid()) ?? [];
      }
      if ((!eqidDocs || eqidDocs.length === 0) && firestore) {
        try {
          const res = await firestore.queryDocuments({ pathSegments: ['eqid'] });
          if (res?.data && Array.isArray(res.data)) {
            eqidDocs = (res.data as any[]).map((d) => ({
              ...d,
              eqid: String(d.eqid || d.id || d.key || '').trim(),
            }));
            rmsContext?.setEqid?.(eqidDocs);
          }
        } catch (e) {
          console.warn('Direct query eqid error in applyContactsToBusiness:', e);
        }
      }
      const rmsResult = FnFilterRmsEqidTree([], eqidDocs, filterFormDataRef.current, mappedContacts);
      filteredContacts = rmsResult.filterContactsForBid(mappedContacts, businessId);
    } else {
      filteredContacts = filterContactRecords(
        contactsToFilter,
        filterFormDataRef.current,
        businessId
      );
    }
    const activeFeatureProps = featureTreeProps ?? buildFeatureTreeProps(!!treeExplorerContainerProps.allowCheckbox);
    const activeFeatureId = treeContainerFlatDataProps?.featureId ?? treeExplorerContainerProps.featureId ?? '';
    const contactNodes = FnMapContactsToTreeNodes(
      filteredContacts,
      activeFeatureProps,
      activeFeatureId,
      businessId,
      handleKebabMenuSelect
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
      activeFeatureProps,
      activeFeatureId,
      false,
      0
    );
    const updatedOriginalData = await FnAddSubNode(
      clearedOriginal,
      businessId,
      uniqueContactNodes,
      activeFeatureProps,
      activeFeatureId,
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

  const handleSelectedKeyChange = useCallback(async (
    currentTreeData: ITreeNode[],
    selectedKey: Key,
    selectedNodeInfo?: ISelectedNodeInfo | null
  ) => {
    if (treeContainerFlatDataProps && selectedKey) {
      const activeFeatureProps = featureTreeProps ?? buildFeatureTreeProps(!!treeExplorerContainerProps.allowCheckbox);
      const activeNodeInfo = selectedNodeInfo ?? defaultSelectedNodeInfo;
      const updatedTreeData = await FnUpdateTreeNodeBasedOnKey(
        currentTreeData,
        selectedKey,
        !activeFeatureProps.hideCopyIcon,
        !activeFeatureProps.hideKebabMenu,
        {
          ...treeContainerFlatDataProps,
          featureTreeProps: activeFeatureProps,
        },
        activeNodeInfo,
        handleKebabMenuSelect
      );
      setTreeData([...updatedTreeData]);
    }
  }, [treeContainerFlatDataProps, featureTreeProps, defaultSelectedNodeInfo, handleKebabMenuSelect, treeExplorerContainerProps.allowCheckbox]);

  const handleNodeSelect = async (selectedKeys: Key[], info: ISelectedNodeInfo, expandedNodeKeys?: Key[]) => {
    setDefaultSelectedKeys(selectedKeys)
    setDefaultSelectedNodeInfo(info)
    smDataContext.setExplorerSelection(info.node, getAppliedFilterJson(filterFormDataRef.current))
    if (treeData && selectedKeys.length > 0) {
      void handleSelectedKeyChange(treeData, selectedKeys[0], info);
    }
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
      if (featureTreeProps && treeExplorerContainerProps.featureId) {
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
              isShowFilterControl={!treeExplorerContainerProps.subTreeFeatureId && !FnIsTicketsNoFilterFeature(treeExplorerContainerProps.featureId)}
              lensDirty={(searchText || '').length > 0}
              filterDirty={isFilterChange}
              searchInputValue={searchText || ''}
              hideSearchControl={false}
              hideRightMouseMenu={!!treeExplorerContainerProps.subTreeFeatureId || FnIsTicketsNoFilterFeature(treeExplorerContainerProps.featureId)}
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
                key={treeExplorerContainerProps.featureId}
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
          key={`filter-${treeExplorerContainerProps.featureId ?? 'tree'}-${smDataContext.datasets.contacts?.length ?? 0}`}
          uniqueName={`${treeExplorerContainerProps.uniqueName}-filter-form`}
          allowHeader={true}
          isFilterChange={isFilterChange}
          controlValues={filterFormData}
          featureId={treeExplorerContainerProps.featureId}
          headerText="Filter Business / Contact"
          handleActionImageClick={handleFilterActionClick}
          handleFilterFormChange={handleFilterFormChange}
        />
      )}
    </div>
  )
}

export { TreeExplorerContainer }
