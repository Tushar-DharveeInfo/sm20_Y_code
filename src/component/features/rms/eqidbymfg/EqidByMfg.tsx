import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Key } from 'rc-tree/lib/interface';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { FeatureQARange, RmsEnums } from '../../../constants/Feature';
import { Label } from '../../../shared/basic/label/Label';
import type { ISelectedNodeInfo, ITreeNode } from '../../../shared/allinterface/tree/ITreeControl';
import type { IFeatureTree } from '../../../shared/allinterface/tree/ITreeForHierarchicalDataContainer';
import { TreeForHierarchicalDataContainer } from '../../../shared/tree/treeforhierarchicaldatacontainer/TreeForHierarchicalDataContainer';
import { SearchControl } from '../../../shared/searchfilter/searchcontrol/SearchControl';
import { FnSearchKeywordInLocalTree } from '../../../shared/allcommon/tree/FnSearchKeywordInLocalTree';
import { SettingsLibForm } from '../../../shared/settingsform/settingslibform/SettingsLibForm';
import { useRmsContext } from '../../../shared/context/hooks/RmsHooks';
import { useSelectedNodeContext } from '../../../shared/context/hooks/SelectedNodeHooks';
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks';
import { useStatusBarContext } from '../../../shared/context/hooks/StatusBarHooks';
import { ActionImage } from '../../../shared/basic/actionimage/ActionImage';
import { OpenSidebar24x24 } from '@n20a/libicon';
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable';
import { SidebarContainer } from '../../../appcontainer/sidebarcontainer/SidebarContainer';
import type { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { buildEqidByMfgTree } from './EqidByMfgTree';
import {
    buildMfgReadOnlyControls,
    buildProdlineReadOnlyControls,
    buildEqtypeReadOnlyControls,
    buildEqidReadOnlyControls,
    buildShapeStyleReadOnlyControls,
} from './EqidByMfgControls';
import './EqidByMfg.css';

interface IEqidByMfgProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
}

const featureTreeProps: IFeatureTree = {
    hideKebabMenu: false,
    hideCopyIcon: true,
    allowIcon: true,
    instanceName: 'nz-eqid-by-mfg-tree',
};

function findNodeByEqid(nodes: ITreeNode[], targetEqid: string): ITreeNode | null {
    const cleanTarget = (targetEqid || '').trim().toLowerCase();
    if (!cleanTarget) return null;
    for (const node of nodes) {
        const raw = String(
            node.nodeType ?? node.NodeType ?? node.treetype ?? node.NodeEntityname ?? ''
        ).toLowerCase();
        if (raw === 'eqid') {
            const eqid = String((node as any).eqid || (node as any).EQID || node.Name || '').trim().toLowerCase();
            if (eqid === cleanTarget) {
                return node;
            }
        }
        if (node.children && node.children.length > 0) {
            const found = findNodeByEqid(node.children, cleanTarget);
            if (found) return found;
        }
    }
    return null;
}

export const EqidByMfg: React.FC<IEqidByMfgProps> = (props) => {
    const {
        uniqueName = 'feature-rms-eqid-by-mfg',
        featureId = RmsEnums.EQIDByMfg || '404',
        headerText = '[RMS] EQID by Mfg',
    } = props;

    const rmsContext = useRmsContext();
    const selectedNodeContext = useSelectedNodeContext();
    const mainAppContext = useMainAppContext();
    const statusBarContext = useStatusBarContext();

    const [searchText, setSearchText] = useState<string>('');
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
    const [selectedNode, setSelectedNode] = useState<ITreeNode | null>(null);
    const [selectedNodeInfo, setSelectedNodeInfo] = useState<ISelectedNodeInfo | null>(null);
    const [activeTicketCard, setActiveTicketCard] = useState<ITreeNode | null>(null);

    // Sidebar state for FQA
    const [isSidebar, setIsSidebar] = useState<string>('sidebarClose');
    const [isShowSidebar, setIsShowSidebar] = useState<boolean>(false);
    const [selectedKebabMenu, setSelectedKebabMenu] = useState<any>(null);

    // Clear selected ticket card in context on unmount
    useEffect(() => {
        return () => {
            selectedNodeContext?.setSelectedTicketCard?.(null);
            rmsContext?.setSelectedTicketCard?.(null);
        };
    }, []);

    // Initial data load for EQID and Mfg datasets
    useEffect(() => {
        let isMounted = true;
        const loadInitialData = async () => {
            if (rmsContext?.eqid?.length === 0 && rmsContext?.loadEqid) {
                try {
                    await rmsContext.loadEqid();
                } catch (err) {
                    console.warn('EqidByMfg: Failed to load eqid dataset:', err);
                }
            }
            if (rmsContext?.mfg?.length === 0 && rmsContext?.loadMfg) {
                try {
                    await rmsContext.loadMfg();
                } catch (err) {
                    console.warn('EqidByMfg: Failed to load mfg dataset:', err);
                }
            }
        };

        void loadInitialData();

        return () => {
            isMounted = false;
            statusBarContext?.setIsLoading?.(false);
        };
    }, []);

    // Build the hierarchical tree from the EQID dataset
    const treeData = useMemo(() => {
        return buildEqidByMfgTree(rmsContext?.eqid ?? [], rmsContext?.mfg ?? []);
    }, [rmsContext?.eqid, rmsContext?.mfg]);

    // Filter FQA items for MenuID 404 (with 402 fallback)
    const featureQAData = useMemo(() => {
        const allRecords = mainAppContext?.featureRecords ?? [];
        let records = allRecords.filter((item) => {
            const featNum = Number(item._Feature ?? item.Feature ?? 0);
            return (
                String(item.MenuID) === '404' &&
                Number.isFinite(featNum) &&
                featNum > FeatureQARange.MIN &&
                featNum < FeatureQARange.MAX
            );
        });

        if (records.length === 0) {
            records = allRecords.filter((item) => {
                const featNum = Number(item._Feature ?? item.Feature ?? 0);
                return (
                    String(item.MenuID) === '402' &&
                    Number.isFinite(featNum) &&
                    featNum > FeatureQARange.MIN &&
                    featNum < FeatureQARange.MAX
                );
            });
        }

        // Deduplicate by Label so duplicate QA icons never appear
        const seenLabels = new Set<string>();
        const uniqueList: IFeatureItem[] = [];
        for (const item of records) {
            const labelKey = String(item.Label ?? item._Feature ?? item.Feature ?? '').trim().toLowerCase();
            if (labelKey && !seenLabels.has(labelKey)) {
                seenLabels.add(labelKey);
                uniqueList.push(item);
            }
        }
        return uniqueList.sort((a, b) => Number(a.SortOrder || 0) - Number(b.SortOrder || 0));
    }, [mainAppContext?.featureRecords]);

    // Set initial expanded and selected keys when treeData is ready
    // Select root node ONLY; do not expand inside root node first node
    const hasInitializedRef = useRef<boolean>(false);
    useEffect(() => {
        if (treeData.length > 0 && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            const rootNode = treeData[0];
            setExpandedKeys([rootNode.key]);
            setSelectedKeys([rootNode.key]);
            setSelectedNode(rootNode);
            setSelectedNodeInfo({
                event: 'select',
                selected: true,
                node: rootNode,
                selectedNodes: [rootNode],
            });
        }
    }, [treeData]);

    // Keep selected node and its properties in sync when treeData is refreshed (e.g. after updating properties in sidebar)
    useEffect(() => {
        if (!hasInitializedRef.current || treeData.length === 0 || !selectedNode) return;

        const currentEqid = String(
            (selectedNode as any)?.eqid ||
            (selectedNode as any)?.EQID ||
            (selectedNode as any)?.eqidRecord?.EQID ||
            (selectedNode as any)?.eqidRecord?.eqid ||
            ''
        ).trim().toLowerCase();

        const findNodeAndAncestors = (
            nodes: ITreeNode[],
            targetKey: Key,
            targetEqid?: string,
            ancestors: Key[] = []
        ): { node: ITreeNode; ancestors: Key[] } | null => {
            for (const n of nodes) {
                const raw = String(
                    n.nodeType ?? n.NodeType ?? n.treetype ?? n.NodeEntityname ?? ''
                ).toLowerCase();
                const nodeEqid = String((n as any).eqid || (n as any).EQID || n.Name || '').trim().toLowerCase();
                const isMatch = n.key === targetKey || (Boolean(targetEqid) && raw === 'eqid' && nodeEqid === targetEqid);

                if (isMatch) {
                    return { node: n, ancestors };
                }
                if (n.children && n.children.length > 0) {
                    const found = findNodeAndAncestors(n.children, targetKey, targetEqid, [...ancestors, n.key]);
                    if (found) return found;
                }
            }
            return null;
        };

        const result = findNodeAndAncestors(treeData, selectedNode.key, currentEqid);
        if (result && result.node) {
            const updatedNode = result.node;
            if (updatedNode !== selectedNode) {
                setSelectedNode(updatedNode);
                setSelectedKeys([updatedNode.key]);
                if (result.ancestors.length > 0) {
                    setExpandedKeys((prev) => Array.from(new Set([...prev, ...result.ancestors])));
                }
                setSelectedNodeInfo({
                    event: 'select',
                    selected: true,
                    node: updatedNode,
                    selectedNodes: [updatedNode],
                });

                const raw = String(
                    updatedNode.nodeType ?? updatedNode.NodeType ?? updatedNode.treetype ?? updatedNode.NodeEntityname ?? ''
                ).toLowerCase();
                if (raw === 'eqid') {
                    const eqidRecord = ((updatedNode as any)?.eqidRecord ?? updatedNode) as Record<string, any>;
                    const resolvedEqid = String(eqidRecord?.EQID || eqidRecord?.eqid || (updatedNode as any)?.eqid || updatedNode?.Name || '');
                    const ticketNode = {
                        key: `ticket-${resolvedEqid}`,
                        NodeEntID: resolvedEqid,
                        Name: `${eqidRecord?.Manufacturer || eqidRecord?.mfg || 'Device'} ${eqidRecord?.ProdNo || eqidRecord?.prodno || resolvedEqid}`,
                        Label: `${eqidRecord?.Manufacturer || eqidRecord?.mfg || 'Device'} ${eqidRecord?.ProdNo || eqidRecord?.prodno || resolvedEqid}`,
                        NodeType: 'Ticket',
                        treetype: 'Ticket',
                        ticketid: resolvedEqid,
                        eqid: resolvedEqid,
                        EQID: resolvedEqid,
                        prodno: eqidRecord?.ProdNo || eqidRecord?.prodno || '',
                        mfg: eqidRecord?.Manufacturer || eqidRecord?.mfg || '',
                        Manufacturer: eqidRecord?.Manufacturer || eqidRecord?.mfg || '',
                        prodline: eqidRecord?.ProdLine || eqidRecord?.prodline || '',
                        ProdLine: eqidRecord?.ProdLine || eqidRecord?.prodline || '',
                        eqtype: eqidRecord?.EqType || eqidRecord?.eqtype || '',
                        EqType: eqidRecord?.EqType || eqidRecord?.eqtype || '',
                        ...eqidRecord,
                    } as unknown as ITreeNode;
                    setActiveTicketCard(ticketNode);
                    selectedNodeContext?.setSelectedTicketCard?.(ticketNode);
                    rmsContext?.setSelectedTicketCard?.(ticketNode);
                }
            }
        }
    }, [treeData]);

    // Handle kebab menu selection on ShapeStyle or EqType nodes
    const handleKebabMenuSelect = useCallback(
        (selectedItem: any, node?: ITreeNode) => {
            const targetNode = node ?? selectedNode;
            const itemLabel = String(selectedItem?.Label || selectedItem?.name || selectedItem?.actionCode || '').trim().toLowerCase();
            const isAddEqid = itemLabel === 'add eqid' || itemLabel.includes('add eqid') || String(selectedItem?.Alias || '').toLowerCase() === 'addeqid';

            if (isAddEqid) {
                // User clicked "Add EQID" on an EqType node
                // EQID record is shown in sidebar with no fields filled, user is expected to fill all fields starting from Acronym
                const blankTicketNode = {
                    key: `new-eqid-${Date.now()}`,
                    NodeEntID: '',
                    Name: 'New EQID',
                    Label: 'New EQID',
                    NodeType: 'EQID',
                    treetype: 'EQID',
                    nodeType: 'EQID',
                    isNewRecord: true,
                    ticketid: '',
                    eqid: '',
                    EQID: '',
                    Acronym: '',
                    Manufacturer: '',
                    mfg: '',
                    mfgkey: '',
                    ProdLine: '',
                    prodline: '',
                    EqType: '',
                    eqtype: '',
                    ProdNo: '',
                    prodno: '',
                    SubTitle: '',
                    Description: '',
                } as unknown as ITreeNode;

                setActiveTicketCard(blankTicketNode);
                selectedNodeContext?.setSelectedTicketCard?.(blankTicketNode);
                rmsContext?.setSelectedTicketCard?.(blankTicketNode);
                const eqidFqaItem = featureQAData.find(
                    (f) => f.Label === 'EQID' || String(f.Feature) === '4040' || String(f._Feature) === '4040'
                ) ?? null;
                setSelectedKebabMenu(eqidFqaItem);
                setIsShowSidebar(true);
                setIsSidebar('sidebarOpen');
                return;
            }

            const parentEqid = String((targetNode as any)?.eqid || targetNode?.Name || '').trim();
            if (parentEqid) {
                const matchingEqid = (rmsContext?.eqid ?? []).find(
                    (e: any) => String(e.EQID || e.eqid || '').trim().toLowerCase() === parentEqid.toLowerCase()
                );
                const resolved = (matchingEqid ?? targetNode) as Record<string, any>;
                const targetRawType = String(
                    (targetNode as any)?.nodeType ??
                    (targetNode as any)?.NodeType ??
                    (targetNode as any)?.treetype ??
                    ''
                ).toLowerCase();
                const isShapeStyle = targetRawType === 'shapestyle' || targetRawType === 'shapestyles';
                const shapeId = String(
                    (targetNode as any)?.shapeId ||
                    (targetNode as any)?.ShapeID ||
                    (targetNode as any)?.shapeStyleData?.styleId ||
                    (targetNode as any)?.styleId ||
                    ''
                ).trim();
                const ticketNode = {
                    key: shapeId ? `ticket-${parentEqid}-${shapeId}` : `ticket-${parentEqid}`,
                    NodeEntID: parentEqid,
                    Name: `${resolved.Manufacturer || resolved.mfg || 'Device'} ${resolved.ProdNo || resolved.prodno || parentEqid}`,
                    Label: `${resolved.Manufacturer || resolved.mfg || 'Device'} ${resolved.ProdNo || resolved.prodno || parentEqid}`,
                    NodeType: 'Ticket',
                    treetype: 'Ticket',
                    ticketid: parentEqid,
                    eqid: parentEqid,
                    EQID: parentEqid,
                    prodno: resolved.ProdNo || resolved.prodno || '',
                    mfg: resolved.Manufacturer || resolved.mfg || '',
                    Manufacturer: resolved.Manufacturer || resolved.mfg || '',
                    prodline: resolved.ProdLine || resolved.prodline || '',
                    ProdLine: resolved.ProdLine || resolved.prodline || '',
                    eqtype: resolved.EqType || resolved.eqtype || '',
                    EqType: resolved.EqType || resolved.eqtype || '',
                    ...resolved,
                    ...(shapeId ? {
                        shapeId,
                        ShapeID: shapeId,
                        shapeStyleData: (targetNode as any)?.shapeStyleData,
                        selectedShapeStyleNode: targetNode,
                    } : {}),
                } as unknown as ITreeNode;
                setActiveTicketCard(ticketNode);
                selectedNodeContext?.setSelectedTicketCard?.(ticketNode);
                rmsContext?.setSelectedTicketCard?.(ticketNode);
                selectedNodeContext?.setSelectedNode?.(targetNode);
            }
            setSelectedKebabMenu(selectedItem);
            setIsShowSidebar(true);
            setIsSidebar('sidebarOpen');
        },
        [selectedNode, rmsContext?.eqid, selectedNodeContext, rmsContext]
    );

    // Handle node selection in the tree
    const handleNodeSelect = useCallback(
        (newSelectedKeys: Key[], info: ISelectedNodeInfo, newExpandedKeys?: Key[]) => {
            setSelectedKeys(newSelectedKeys);
            setSelectedKebabMenu(null);
            const node = info?.node ?? null;
            setSelectedNode(node);
            setSelectedNodeInfo(info);
            selectedNodeContext?.setSelectedNode?.(node ?? undefined);
            if (newExpandedKeys) {
                setExpandedKeys(newExpandedKeys);
            }

            const raw = String(
                node?.nodeType ?? node?.NodeType ?? node?.treetype ?? node?.NodeEntityname ?? ''
            ).toLowerCase();

            if (raw === 'eqid') {
                const eqidRecord = ((node as any)?.eqidRecord ?? node) as Record<string, any>;
                const resolvedEqid = String(eqidRecord?.EQID || eqidRecord?.eqid || (node as any)?.eqid || node?.Name || '');
                const ticketNode = {
                    key: `ticket-${resolvedEqid}`,
                    NodeEntID: resolvedEqid,
                    Name: `${eqidRecord?.Manufacturer || eqidRecord?.mfg || 'Device'} ${eqidRecord?.ProdNo || eqidRecord?.prodno || resolvedEqid}`,
                    Label: `${eqidRecord?.Manufacturer || eqidRecord?.mfg || 'Device'} ${eqidRecord?.ProdNo || eqidRecord?.prodno || resolvedEqid}`,
                    NodeType: 'Ticket',
                    treetype: 'Ticket',
                    ticketid: resolvedEqid,
                    eqid: resolvedEqid,
                    EQID: resolvedEqid,
                    prodno: eqidRecord?.ProdNo || eqidRecord?.prodno || '',
                    mfg: eqidRecord?.Manufacturer || eqidRecord?.mfg || '',
                    Manufacturer: eqidRecord?.Manufacturer || eqidRecord?.mfg || '',
                    prodline: eqidRecord?.ProdLine || eqidRecord?.prodline || '',
                    ProdLine: eqidRecord?.ProdLine || eqidRecord?.prodline || '',
                    eqtype: eqidRecord?.EqType || eqidRecord?.eqtype || '',
                    EqType: eqidRecord?.EqType || eqidRecord?.eqtype || '',
                    ...eqidRecord,
                } as unknown as ITreeNode;
                setActiveTicketCard(ticketNode);
                selectedNodeContext?.setSelectedTicketCard?.(ticketNode);
                rmsContext?.setSelectedTicketCard?.(ticketNode);
                const eqidFqaItem = featureQAData.find(
                    (f) => f.Label === 'EQID' || String(f.Feature) === '4040' || String(f._Feature) === '4040'
                ) ?? null;
                setSelectedKebabMenu(eqidFqaItem);
                setIsShowSidebar(true);
                setIsSidebar('sidebarOpen');
            } else if (raw === 'shapestyle' || raw === 'shapestyles') {
                const parentEqid = String((node as any)?.eqid || '').trim();
                if (parentEqid) {
                    const matchingEqid = (rmsContext?.eqid ?? []).find(
                        (e: any) => String(e.EQID || e.eqid || '').trim().toLowerCase() === parentEqid.toLowerCase()
                    );
                    const resolved = (matchingEqid ?? node) as Record<string, any>;
                    const shapeId = String(
                        (node as any)?.shapeId ||
                        (node as any)?.ShapeID ||
                        (node as any)?.shapeStyleData?.styleId ||
                        (node as any)?.styleId ||
                        ''
                    ).trim();
                    const ticketNode = {
                        key: shapeId ? `ticket-${parentEqid}-${shapeId}` : `ticket-${parentEqid}`,
                        NodeEntID: parentEqid,
                        Name: `${resolved.Manufacturer || resolved.mfg || 'Device'} ${resolved.ProdNo || resolved.prodno || parentEqid}`,
                        Label: `${resolved.Manufacturer || resolved.mfg || 'Device'} ${resolved.ProdNo || resolved.prodno || parentEqid}`,
                        NodeType: 'Ticket',
                        treetype: 'Ticket',
                        ticketid: parentEqid,
                        eqid: parentEqid,
                        EQID: parentEqid,
                        prodno: resolved.ProdNo || resolved.prodno || '',
                        mfg: resolved.Manufacturer || resolved.mfg || '',
                        Manufacturer: resolved.Manufacturer || resolved.mfg || '',
                        prodline: resolved.ProdLine || resolved.prodline || '',
                        ProdLine: resolved.ProdLine || resolved.prodline || '',
                        eqtype: resolved.EqType || resolved.eqtype || '',
                        EqType: resolved.EqType || resolved.eqtype || '',
                        ...resolved,
                        shapeId: shapeId,
                        ShapeID: shapeId,
                        shapeStyleData: (node as any)?.shapeStyleData,
                        selectedShapeStyleNode: node,
                    } as unknown as ITreeNode;
                    setActiveTicketCard(ticketNode);
                    selectedNodeContext?.setSelectedTicketCard?.(ticketNode);
                    rmsContext?.setSelectedTicketCard?.(ticketNode);
                }
            } else {
                setActiveTicketCard(null);
                selectedNodeContext?.setSelectedTicketCard?.(null);
                rmsContext?.setSelectedTicketCard?.(null);
                setSelectedKebabMenu(null);
                setIsSidebar('sidebarClose');
                setIsShowSidebar(false);
            }
        },
        [rmsContext?.eqid, selectedNodeContext, rmsContext, featureQAData]
    );

    // Handle node expansion / collapse
    const handleNodeExpand = useCallback((newExpandedKeys: Key[]) => {
        setExpandedKeys(newExpandedKeys);
    }, []);

    // Handle tree keyword search
    const handleKeywordSearch = useCallback(
        (keyword: string) => {
            const query = (keyword || '').trim();
            if (!query) return;

            const { foundNode, parentNodes } = FnSearchKeywordInLocalTree(query, treeData, searchHistory);
            if (foundNode) {
                setSearchHistory((prev) => [...prev, String(foundNode.key || foundNode.NodeEntID)]);
                const keysToExpand = parentNodes.map((n) => n.key);
                setExpandedKeys((prev) => Array.from(new Set([...prev, ...keysToExpand])));
                setSelectedKeys([foundNode.key]);
                setSelectedNode(foundNode);
                setSelectedNodeInfo({
                    event: 'select',
                    selected: true,
                    node: foundNode,
                    selectedNodes: [foundNode],
                });
            } else if (searchHistory.length > 0) {
                // Wrap around search
                setSearchHistory([]);
                const secondTry = FnSearchKeywordInLocalTree(query, treeData, []);
                if (secondTry.foundNode) {
                    setSearchHistory([String(secondTry.foundNode.key || secondTry.foundNode.NodeEntID)]);
                    const keysToExpand = secondTry.parentNodes.map((n) => n.key);
                    setExpandedKeys((prev) => Array.from(new Set([...prev, ...keysToExpand])));
                    setSelectedKeys([secondTry.foundNode.key]);
                    setSelectedNode(secondTry.foundNode);
                    setSelectedNodeInfo({
                        event: 'select',
                        selected: true,
                        node: secondTry.foundNode,
                        selectedNodes: [secondTry.foundNode],
                    });
                }
            }
        },
        [treeData, searchHistory]
    );

    // Determine the active node type
    const activeNodeType = useMemo(() => {
        if (!selectedNode) return null;
        const raw = String(
            selectedNode.nodeType ?? selectedNode.NodeType ?? selectedNode.treetype ?? selectedNode.NodeEntityname ?? ''
        ).toLowerCase();

        if (raw === 'root') return 'Root';
        if (raw === 'mfg' || raw === 'manufacturer') return 'Mfg';
        if (raw === 'prodline' || raw === 'productline') return 'ProdLine';
        if (raw === 'eqtype' || raw === 'equipmenttype' || raw === 'mfgeqtype') return 'EqType';
        if (raw === 'eqid') return 'EQID';
        if (raw === 'shapestyle' || raw === 'shapestyles') return 'ShapeStyle';
        return 'Mfg';
    }, [selectedNode]);

    // Build the read-only controls for the right-side pane
    const activeControls = useMemo(() => {
        if (!selectedNode) return [];

        switch (activeNodeType) {
            case 'Root':
                return [];
            case 'Mfg': {
                const mfgName = String(selectedNode.mfgName || selectedNode.Name || selectedNode.title || '');
                const acronym = String(selectedNode.acronym || selectedNode.Description || mfgName.substring(0, 4).toUpperCase());
                return buildMfgReadOnlyControls(mfgName, acronym, selectedNode.mfgRecord);
            }
            case 'ProdLine': {
                const mfgName = String(selectedNode.mfgName || '');
                const prodline = String(selectedNode.prodline || selectedNode.Name || '');
                const totalEqtypes = Number(selectedNode.totalEqtypes ?? selectedNode.children?.length ?? 0);
                const totalEqids = Number(selectedNode.totalEqids ?? 0);
                return buildProdlineReadOnlyControls(mfgName, prodline, totalEqtypes, totalEqids);
            }
            case 'EqType': {
                const mfgName = String(selectedNode.mfgName || '');
                const prodline = String(selectedNode.prodline || '');
                const eqtype = String(selectedNode.eqtype || selectedNode.Name || '');
                const totalEqids = Number(selectedNode.totalEqids ?? selectedNode.children?.length ?? 0);
                return buildEqtypeReadOnlyControls(mfgName, prodline, eqtype, totalEqids);
            }
            case 'EQID': {
                const record = selectedNode.eqidRecord ?? selectedNode;
                return buildEqidReadOnlyControls(record);
            }
            case 'ShapeStyle': {
                const data = selectedNode.shapeStyleData ?? {
                    eqid: selectedNode.eqid,
                    styleName: selectedNode.Name,
                    styleId: selectedNode.key,
                    description: selectedNode.description,
                };
                return buildShapeStyleReadOnlyControls(data);
            }
            default:
                return [];
        }
    }, [selectedNode, activeNodeType]);

    // Build profileString for prefilling SettingsLibForm
    const activeProfileString = useMemo(() => {
        if (!selectedNode) return '';

        switch (activeNodeType) {
            case 'Root':
                return '';
            case 'Mfg': {
                const mfgName = String(selectedNode.mfgName || selectedNode.Name || '');
                const acronym = String(selectedNode.acronym || mfgName.substring(0, 4).toUpperCase());
                const mfgRec = selectedNode.mfgRecord;
                return JSON.stringify([
                    {
                        Acronym: acronym,
                        MfgName: mfgName,
                        Website: mfgRec?.website || '',
                        Address: mfgRec?.address || '',
                    },
                ]);
            }
            case 'ProdLine': {
                return JSON.stringify([
                    {
                        Manufacturer: selectedNode.mfgName || '',
                        ProdLine: selectedNode.prodline || selectedNode.Name || '',
                        TotalEqTypes: String(selectedNode.totalEqtypes ?? selectedNode.children?.length ?? 0),
                        TotalEQIDs: String(selectedNode.totalEqids ?? 0),
                    },
                ]);
            }
            case 'EqType': {
                return JSON.stringify([
                    {
                        Manufacturer: selectedNode.mfgName || '',
                        ProdLine: selectedNode.prodline || '',
                        EqType: selectedNode.eqtype || selectedNode.Name || '',
                        TotalEQIDs: String(selectedNode.totalEqids ?? selectedNode.children?.length ?? 0),
                    },
                ]);
            }
            case 'EQID': {
                const r = selectedNode.eqidRecord ?? selectedNode;
                return JSON.stringify([
                    {
                        EQID: r.EQID || r.eqid || '',
                        ProdNo: r.ProdNo || r.prodno || '',
                        Manufacturer: r.Manufacturer || r.mfg || '',
                        Acronym: r.Acronym || '',
                        ProdLine: r.ProdLine || r.prodline || '',
                        EqType: r.EqType || r.eqtype || '',
                        SubTitle: r.SubTitle || r.subtitle || '',
                        Description: r.Description || r.description || '',
                        Height: r.Height ?? r.height ?? '',
                        Width: r.Width ?? r.width ?? '',
                        Depth: r.Depth ?? r.depth ?? '',
                        Weight: r.Weight ?? r.weight ?? '',
                        Watts: r.Watts ?? r.watts ?? '',
                        CopperPorts: r.CopperPorts ?? r.copperports ?? '',
                        FiberPorts: r.FiberPorts ?? r.fiberports ?? '',
                        Slots: r.Slots ?? r.slots ?? '',
                    },
                ]);
            }
            case 'ShapeStyle': {
                const d = selectedNode.shapeStyleData ?? selectedNode;
                return JSON.stringify([
                    {
                        EQID: d.eqid || selectedNode.eqid || '',
                        ShapeName: d.styleName || selectedNode.Name || '',
                        ShapeID: d.styleId || selectedNode.key || '',
                        Description: d.description || '',
                    },
                ]);
            }
            default:
                return '';
        }
    }, [selectedNode, activeNodeType]);

    // Active form header
    const activeFormHeader = useMemo(() => {
        if (!selectedNode) return 'Properties';
        switch (activeNodeType) {
            case 'Root':
                return '';
            case 'Mfg':
                return `Manufacturer (${selectedNode.Name})`;
            case 'ProdLine':
                return `Product Line (${selectedNode.Name})`;
            case 'EqType':
                return `Equipment Type (${selectedNode.Name})`;
            case 'EQID':
                return `EQID (${selectedNode.Name})`;
            case 'ShapeStyle':
                return `Shape Style (${selectedNode.Name})`;
            default:
                return `Properties (${selectedNode.Name})`;
        }
    }, [selectedNode, activeNodeType]);

    // Right-pane selection header
    const rightPaneHeader = useMemo(() => {
        if (!selectedNode) return 'Properties';
        if (activeNodeType === 'Root') return 'Manufacturers';
        return `${activeNodeType ? `${activeNodeType}: ` : ''}${selectedNode.Name}`;
    }, [selectedNode, activeNodeType]);

    const isLoading = rmsContext?.loading && treeData.length === 0;

    return (
        <div className="nz-eqid-by-mfg-feature" key={uniqueName}>
            <Splitter className="nz-w-100 nz-h-100 nz-eqid-by-mfg-splitter" tabIndex={-1}>
                {/* Pane 1: Tree Pane */}
                <SplitterPanel
                    tabIndex={-1}
                    size={28}
                    minSize={15}
                    className="nz-d-flex-column nz-eqid-by-mfg-tree-pane"
                >
                    <div className="nz-sub-header nz-d-flex-row nz-align-center">
                        <Label uniqueName={`${uniqueName}-header`} label={headerText} fontWeight="bold" />
                    </div>
                    <div className="nz-eqid-by-mfg-search">
                        <SearchControl
                            uniqueName={`${uniqueName}-search`}
                            searchInputValue={searchText}
                            hideSearchControl={false}
                            hideRightMouseMenu={true}
                            isShowFilterControl={false}
                            lensDirty={searchText.trim().length > 0}
                            searchValueChange={(val) => {
                                setSearchText(val);
                                setSearchHistory([]);
                            }}
                            handleLensMouse={() => {
                                if (searchText.trim().length > 0) {
                                    handleKeywordSearch(searchText);
                                }
                            }}
                            filterDirty={false}
                            handleFilterMouse={() => undefined}
                        />
                    </div>
                    <div
                        className={`nz-eqid-by-mfg-tree-body${isLoading ? ' nz-eqid-by-mfg-tree-body-loading' : ''
                            }`}
                    >
                        {isLoading && <Label uniqueName={`${uniqueName}-loading`} label="loading..." />}
                        {!isLoading && treeData.length === 0 && (
                            <div style={{ padding: 12 }}>
                                <Label uniqueName={`${uniqueName}-empty`} label="No EQID records found" />
                            </div>
                        )}
                        {treeData.length > 0 && (
                            <TreeForHierarchicalDataContainer
                                uniqueName={`${uniqueName}-tree`}
                                featureId={featureId}
                                apiData={treeData}
                                allowGenerateTreeData={false}
                                allowAPICallOnExpand={false}
                                featureTreeProps={featureTreeProps}
                                defaultExpandedKeys={expandedKeys}
                                defaultSelectedKeys={selectedKeys}
                                defaultSelectedNodeInfo={selectedNodeInfo || undefined}
                                autoFocus={false}
                                handleNodeSelect={handleNodeSelect}
                                handleNodeExpand={handleNodeExpand}
                                handleKebabMenuSelect={handleKebabMenuSelect}
                            />
                        )}
                    </div>
                </SplitterPanel>

                {/* Pane 2: Right-Side Details Pane (Read-Only Mode) */}
                <SplitterPanel
                    tabIndex={-1}
                    size={72}
                    minSize={25}
                    className="nz-d-flex-column nz-eqid-by-mfg-detail-pane"
                >
                    <div className="nz-sub-header nz-d-flex-row nz-align-center nz-justify-between">
                        <Label uniqueName={`${uniqueName}-selection`} label={rightPaneHeader} fontWeight="bold" />
                        {(activeNodeType === 'EQID' || activeNodeType === 'ShapeStyle' || Boolean(selectedNodeContext?.selectedTicketCard)) && (
                            <div className="nz-d-flex-row nz-align-center">
                                <ActionImage
                                    uniqueName={`${uniqueName}-info-ai`}
                                    image={{
                                        uniqueName: `${uniqueName}-info-image`,
                                        source: (
                                            <OpenSidebar24x24
                                                size={FnGetCssVariable('--image-size-2')}
                                                fill="none"
                                                strokeWidth={1}
                                            />
                                        ),
                                        w: 'var(--image-size-2)',
                                        tooltip: 'Click to view ticket details in sidebar',
                                        type: 'svg',
                                    }}
                                    w={'var(--node_height)'}
                                    h={'var(--node_height)'}
                                    actionCode={'information'}
                                    handleMouse={() => {
                                        setIsShowSidebar((prev) => !prev);
                                        setIsSidebar((prev) => (prev === 'sidebarOpen' ? 'sidebarClose' : 'sidebarOpen'));
                                    }}
                                />
                            </div>
                        )}
                    </div>
                    <div className="nz-eqid-by-mfg-detail-body">
                        {selectedNode && activeNodeType !== 'Root' && activeControls.length > 0 ? (
                            <div className="nz-eqid-by-mfg-detail-form-container">
                                <SettingsLibForm
                                    key={`form-${selectedNode.key}-${activeNodeType}-${activeProfileString}`}
                                    uniqueName={`${uniqueName}-active-form`}
                                    featureId={featureId}
                                    id={String(selectedNode.key)}
                                    headerText=""
                                    controls={activeControls}
                                    profileString={activeProfileString}
                                    allowShowHeader={false}
                                    allowShowSectionHeader={true}
                                    isDisableForm={true}
                                    isAutoSave={false}
                                    handleSaveForm={() => undefined}
                                    handleValueChange={() => undefined}
                                    handleValueChangeExternal={() => undefined}
                                />
                            </div>
                        ) : (
                            <div className="nz-wh-100 nz-d-flex-hv-left nz-eqid-by-mfg-detail-empty">
                                <Label
                                    uniqueName={`${uniqueName}-detail-empty`}
                                    label="Select a node to view its properties."
                                />
                            </div>
                        )}
                    </div>
                </SplitterPanel>
            </Splitter>

            {/* Sidebar with FQA for selected EQID */}
            {Boolean(activeTicketCard || selectedNodeContext?.selectedTicketCard || activeNodeType === 'EQID') &&
                isSidebar === 'sidebarOpen' &&
                isShowSidebar &&
                featureQAData.length > 0 && (
                    <SidebarContainer
                        key={`sidebar-${activeTicketCard?.key || activeTicketCard?.EQID || activeTicketCard?.eqid || (selectedNode as any)?.eqid || selectedNode?.Name || ''}-${activeTicketCard?.ShapeID || (selectedNode as any)?.ShapeID || ''}`}
                        uniqueName={`${uniqueName}-sidebar`}
                        isShowSidebar={isShowSidebar}
                        featureQaList={featureQAData}
                        selectedNode={
                            (selectedNode && String((selectedNode as any)?.nodeType || (selectedNode as any)?.NodeType).toLowerCase() === 'shapestyle')
                                ? {
                                    ...selectedNode,
                                    eqid: (selectedNode as any)?.eqid || (activeTicketCard as any)?.eqid || (activeTicketCard as any)?.EQID,
                                    EQID: (selectedNode as any)?.EQID || (activeTicketCard as any)?.EQID || (activeTicketCard as any)?.eqid,
                                    ShapeID: (selectedNode as any)?.ShapeID || (selectedNode as any)?.shapeId || (selectedNode as any)?.shapeStyleData?.styleId || (activeTicketCard as any)?.ShapeID,
                                    shapeId: (selectedNode as any)?.shapeId || (selectedNode as any)?.ShapeID || (selectedNode as any)?.shapeStyleData?.styleId || (activeTicketCard as any)?.shapeId,
                                }
                                : (activeTicketCard ?? (selectedNodeContext?.selectedTicketCard as ITreeNode) ?? selectedNode ?? undefined)
                        }
                        featureId={featureId}
                        headerText={
                            (activeTicketCard as any)?.prodno ||
                            (selectedNodeContext?.selectedTicketCard as any)?.prodno ||
                            (selectedNodeContext?.selectedTicketCard as any)?.ticketid ||
                            selectedNode?.Name ||
                            ''
                        }
                        selectedFeatureQa={selectedKebabMenu ?? null}
                        showPopupSidebar={false}
                        handleReloadTree={async () => {
                            if (rmsContext?.loadEqid) {
                                await rmsContext.loadEqid();
                            }
                        }}
                        handleCloseSidebar={() => {
                            setIsSidebar('sidebarClose');
                            setIsShowSidebar(false);
                        }}
                    />
                )}
        </div>
    );
};

export default EqidByMfg;
