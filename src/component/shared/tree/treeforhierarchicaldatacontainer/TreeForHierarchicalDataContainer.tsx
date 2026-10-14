


import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CheckInfo } from 'rc-tree/lib/Tree';
import { EventDataNode, Key } from 'rc-tree/lib/interface';
import { NodeDragEventParams } from 'rc-tree/lib/contextTypes';
import './TreeForHierarchicalDataContainer.css'
import { FnUpdateTreeNodeBasedOnKeyForHierarchicalData } from '../../allcommon/tree/FnUpdateTreeNodeBasedOnKeyForHierarchicalData';
import { FnConvertHierarchicalDataToTree } from '../../allcommon/tree/FnConvertHierarchicalDataToTree';
import { FnAutoExpandTreeNodesHierarchy } from '../../allcommon/tree/FnAutoExpandTreeNodesHierarchy';
import { FnFindParentNode } from '../../allcommon/tree/FnFindParentNode';
import { ISelectedNodeInfo, IExpandedNodeInfo, ITreeNode } from '../../allinterface/tree/ITreeControl';
import { IConvertedTreeResponse, IStrictCheckedKeys, ITreeForHierarchicalDataContainer, TNodeCheckState } from '../../allinterface/tree/ITreeForHierarchicalDataContainer';
import { IActionImageForSubMenu } from '../../allinterface/basic/IActionImageList';
import { TreeControl } from '../treecontrol/TreeControl';

function isStrictCheckedKeys(checked: TNodeCheckState): checked is IStrictCheckedKeys {
    return !Array.isArray(checked);
}

const TreeForHierarchicalDataContainer = (treeContainerHierarchicalDataProps: ITreeForHierarchicalDataContainer) => {
    const propsRef = useRef(treeContainerHierarchicalDataProps);
    propsRef.current = treeContainerHierarchicalDataProps;

    const {
        apiData,
        allowGenerateTreeData,
        defaultExpandedKeys: propsDefaultExpandedKeys,
        defaultSelectedKeys: propsDefaultSelectedKeys,
        defaultCheckedKeys: propsDefaultCheckedKeys,
        defaultSelectedNodeInfo: propsDefaultSelectedNodeInfo,
        defaultStrictlyCheckedKeys: propsDefaultStrictlyCheckedKeys,
        featureTreeProps,
    } = treeContainerHierarchicalDataProps;

    const hideKebabMenu = featureTreeProps?.hideKebabMenu ?? false;
    const hideCopyIcon = featureTreeProps?.hideCopyIcon ?? false;
    const allowCheckStrictly = featureTreeProps?.allowCheckStrictly ?? false;

    const [treeData, setTreeData] = useState<ITreeNode[]>([]);
    const [defaultExpandedKeys, setDefaultExpandedKeys] = useState<Key[]>([]);
    const [defaultSelectedKeys, setDefaultSelectedKeys] = useState<Key[]>([]);
    const [defaultCheckedKeys, setDefaultCheckedKeys] = useState<Key[]>([]);
    const [defaultSelectedNodeInfo, setDefaultSelectedNodeInfo] = useState<ISelectedNodeInfo | null>(null);
    const [defaultStrictlyCheckedKeys, setDefaultStrictlyCheckedKeys] = useState<{
        checked: Key[];
        halfChecked: Key[];
    }>();
    const needToUpdateTreeNodeRef = useRef<boolean>(false);
    const treeDataRef = useRef(treeData);
    // Tracks the last processed selection key signature to avoid redundant tree updates.
    const lastHandledKeysRef = useRef<string>("");
    const lastApiDataRef = useRef<unknown>(null);
    const lastExpandedSignatureRef = useRef<string>("");
    const lastSelectedKeySignatureRef = useRef<string>("");

    // Clears cached tree data when the container unmounts.
    useEffect(() => {
        return () => {
            treeDataRef.current = [];
        };
    }, []);

    // Marks the tree for refresh when the context-menu refresh action is selected.
    const handleKebabMenuSelect = useCallback((selectedItem: IActionImageForSubMenu, node?: ITreeNode) => {
        propsRef.current.handleKebabMenuSelect?.(selectedItem, node);
    }, []);

    // Updates copy/kebab icons on the selected node when selection changes.
    const handleSelectedKeyChange = useCallback((currentTreeData: ITreeNode[], targetKey?: Key) => {
        const keyToUpdate = targetKey ?? defaultSelectedKeys[0];
        if (!keyToUpdate || !currentTreeData?.length) return;
        const currentProps = propsRef.current;
        const updatedTreeData = FnUpdateTreeNodeBasedOnKeyForHierarchicalData(
            currentTreeData,
            keyToUpdate,
            currentProps.featureTreeProps.hideCopyIcon === false,
            currentProps.featureTreeProps.hideKebabMenu === false,
            currentProps,
            currentProps.selectedNodeExplorer,
            handleKebabMenuSelect
        );
        treeDataRef.current = updatedTreeData;
        setTreeData([...updatedTreeData]);
    }, [defaultSelectedKeys, handleKebabMenuSelect]);

    // Builds tree state from API data when allowGenerateTreeData is true
    useEffect(() => {
        if (!allowGenerateTreeData) return;

        if (!apiData || Array.isArray(apiData)) {
            setTreeData([]);
            return;
        }
        FnConvertHierarchicalDataToTree(apiData, propsRef.current).then((result: IConvertedTreeResponse | undefined) => {
            if (result) {
                propsRef.current.handleGeneratedTreedata?.(result.treeData, propsRef.current.uniqueName);
                setTreeData(result.treeData);
                treeDataRef.current = result.treeData;
                if (propsRef.current.featureTreeProps.openAllNodes) {
                    setDefaultExpandedKeys([]);
                } else {
                    setDefaultExpandedKeys(result.expandedKeys);
                }
                if (result.selectedKey) {
                    setDefaultSelectedKeys([result.selectedKey]);
                }
                if (result.selectedNode) {
                    setDefaultSelectedNodeInfo({
                        event: 'select',
                        selected: true,
                        node: result.selectedNode,
                        selectedNodes: [result.selectedNode]
                    });
                }
            } else {
                setTreeData([]);
            }
        }).catch((error: unknown) => {
            console.error("Failed to convert hierarchical data to tree:", error);
            setTreeData([]);
        });
    }, [allowGenerateTreeData, apiData]);

    // Synchronizes pre-generated tree props when allowGenerateTreeData is false
    useEffect(() => {
        if (allowGenerateTreeData) return;

        if (!Array.isArray(apiData)) {
            return;
        }

        const targetSelectedKeys = propsDefaultSelectedKeys || [];
        const activeKey = targetSelectedKeys[0] || defaultSelectedKeys[0];
        const keySignature = activeKey ? String(activeKey) : "";

        const isNewApiData = apiData !== lastApiDataRef.current;
        const isNewSelection = keySignature !== lastHandledKeysRef.current;

        if (isNewApiData || isNewSelection) {
            lastApiDataRef.current = apiData;
            lastHandledKeysRef.current = keySignature;
            needToUpdateTreeNodeRef.current = false;

            if (activeKey && !hideKebabMenu) {
                const updated = FnUpdateTreeNodeBasedOnKeyForHierarchicalData(
                    apiData,
                    activeKey,
                    !hideCopyIcon,
                    !hideKebabMenu,
                    propsRef.current,
                    propsRef.current.selectedNodeExplorer,
                    handleKebabMenuSelect
                );
                treeDataRef.current = updated;
                setTreeData([...updated]);
            } else {
                setTreeData(apiData);
                treeDataRef.current = apiData;
            }
        }

        // Sync expanded keys only if they actually changed
        const expandedSig = (propsDefaultExpandedKeys || []).join("|");
        if (expandedSig !== lastExpandedSignatureRef.current) {
            lastExpandedSignatureRef.current = expandedSig;
            setDefaultExpandedKeys(propsDefaultExpandedKeys || []);
        }

        // Sync selected keys only if changed
        if (keySignature !== lastSelectedKeySignatureRef.current) {
            lastSelectedKeySignatureRef.current = keySignature;
            setDefaultSelectedKeys(targetSelectedKeys);
        }

        if (allowCheckStrictly) {
            setDefaultStrictlyCheckedKeys(propsDefaultStrictlyCheckedKeys);
        } else {
            setDefaultCheckedKeys(propsDefaultCheckedKeys || []);
        }
        setDefaultSelectedNodeInfo(propsDefaultSelectedNodeInfo || null);
    }, [
        allowGenerateTreeData,
        apiData,
        propsDefaultSelectedKeys,
        propsDefaultExpandedKeys,
        propsDefaultCheckedKeys,
        propsDefaultStrictlyCheckedKeys,
        propsDefaultSelectedNodeInfo,
        hideKebabMenu,
        hideCopyIcon,
        allowCheckStrictly,
        defaultSelectedKeys,
        handleKebabMenuSelect
    ]);

    // Re-renders node chrome when selected keys change and copy/kebab icons are enabled.
    useEffect(() => {
        if (
            !defaultSelectedKeys?.length ||
            (hideCopyIcon && hideKebabMenu)
        ) {
            return;
        }
        const keySignature = defaultSelectedKeys.join("|");
        if (lastHandledKeysRef.current === keySignature && needToUpdateTreeNodeRef.current === false) {
            return; // already handled
        }

        lastHandledKeysRef.current = keySignature;
        needToUpdateTreeNodeRef.current = false;
        handleSelectedKeyChange(treeDataRef.current, defaultSelectedKeys[0]);

    }, [
        defaultSelectedKeys,
        handleSelectedKeyChange,
        hideCopyIcon,
        hideKebabMenu
    ]);


    // Propagates checkbox changes and applies strict parent/child check rules when enabled.
    function handleNodeCheck(checked: TNodeCheckState, info: CheckInfo<ITreeNode>): void {
        let newChecked: TNodeCheckState = checked;
        const currentProps = propsRef.current;
        if (currentProps.featureTreeProps.allowCheckStrictly && !currentProps.featureTreeProps.allowCustomCheck) {
            if (!isStrictCheckedKeys(checked)) {
                currentProps.handleNodeCheck?.(checked, info);
                return;
            }
            const defaultCheck = checked;

            // Collects descendant keys and nodes for strict checkbox propagation.
            const getAllChildNodesAndKeys = (
                node: ITreeNode
            ): { keys: Key[]; nodes: ITreeNode[] } => {

                const keys: Key[] = [];
                const nodes: ITreeNode[] = [];

                if (node.children) {
                    node.children.forEach((child) => {
                        keys.push(child.key);
                        nodes.push(child);

                        const childData = getAllChildNodesAndKeys(child);

                        keys.push(...childData.keys);
                        nodes.push(...childData.nodes);
                    });
                }

                return { keys, nodes };
            };

            if (info.checked) {
                const childCheckedKeys = getAllChildNodesAndKeys(info.node);
                const baseMergedArray = [...new Set([...defaultCheck.checked, ...childCheckedKeys.keys])];
                const parentNode = FnFindParentNode(treeData, info.node.key);

                if (parentNode) {
                    const isHalfChecked = parentNode.children.some((nodeItem) => !baseMergedArray.includes(nodeItem.key));
                    const halfChecked = isHalfChecked
                        ? [...new Set([...defaultCheck.halfChecked, parentNode.key])]
                        : defaultCheck.halfChecked.filter(key => key !== parentNode.key);
                    const mergedArray = isHalfChecked
                        ? baseMergedArray
                        : [...baseMergedArray, parentNode.key];
                    newChecked = { checked: mergedArray, halfChecked };
                }
                else {
                    info.checkedNodes = childCheckedKeys.nodes;
                    newChecked = {
                        checked: baseMergedArray,
                        halfChecked: defaultCheck.halfChecked,
                    };
                }
                setDefaultStrictlyCheckedKeys(newChecked)
            }
            else {
                const childKeysToRemove = getAllChildNodesAndKeys(info.node);
                const baseRemovedCheckKeys = defaultCheck.checked.filter(key => !childKeysToRemove.keys.includes(key));
                const parentNode = FnFindParentNode(treeData, info.node.key);

                if (parentNode) {
                    const isHalfChecked = parentNode.children.some((nodeItem) => baseRemovedCheckKeys.includes(nodeItem.key));
                    const removedCheckKeys = baseRemovedCheckKeys.filter(key => key !== parentNode.key);
                    const halfChecked = isHalfChecked
                        ? [...new Set([...defaultCheck.halfChecked, parentNode.key])]
                        : defaultCheck.halfChecked.filter(key => key !== parentNode.key);
                    newChecked = { checked: removedCheckKeys, halfChecked };
                }
                else {
                    info.checkedNodes = [];
                    newChecked = {
                        checked: baseRemovedCheckKeys,
                        halfChecked: defaultCheck.halfChecked,
                    };
                }
                setDefaultStrictlyCheckedKeys(newChecked)
            }
        }
        else if (!currentProps.featureTreeProps.allowCustomCheck && Array.isArray(checked)) {
            setDefaultCheckedKeys(checked);
        }
        currentProps.handleNodeCheck?.(newChecked, info);
    }

    // Forwards node clicks and blocks drag on unsupported audit-session node types.
    function handleNodeClick(event: React.MouseEvent<Element, MouseEvent>, node: ITreeNode): void {
        propsRef.current.handleNodeClick?.(event, node);
    }

    // Expands nodes via callback or auto-expands hierarchy when no custom handler is provided.
    async function handleNodeExpand(expandedNodeKeys: Key[], info: IExpandedNodeInfo) {
        if (info && info.node) {
            const currentProps = propsRef.current;
            if (currentProps.featureTreeProps.instanceName === "model_by_type_treeview"
                && info.node.treetype?.toLowerCase() === "dataset" && info.node.children.length === 0
                && currentProps.handleNodeExpand
            ) {
                currentProps.handleNodeExpand(expandedNodeKeys, info);
            } else if (currentProps.handleNodeExpand) {
                setDefaultExpandedKeys(expandedNodeKeys);
                currentProps.handleNodeExpand(expandedNodeKeys, info);
            }
            else {
                const autoExpandDetails = FnAutoExpandTreeNodesHierarchy([info.node]);
                setDefaultExpandedKeys(Array.from(new Set([...defaultExpandedKeys, ...autoExpandDetails.expandedKeys])));
                if (autoExpandDetails.selectedKey !== "") {
                    setDefaultSelectedKeys([autoExpandDetails.selectedKey]);
                    autoExpandDetails.selectedNode && setDefaultSelectedNodeInfo({
                        event: 'auto-select',
                        selected: true,
                        node: autoExpandDetails.selectedNode,
                        selectedNodes: [autoExpandDetails.selectedNode]
                    });
                }
                autoExpandDetails.selectedNode && currentProps.handleNodeSelect && currentProps.handleNodeSelect([autoExpandDetails.selectedKey], {
                    event: 'auto-select',
                    selected: false,
                    node: autoExpandDetails.selectedNode,
                    selectedNodes: [autoExpandDetails.selectedNode],
                    nativeEvent: info.nativeEvent
                }, expandedNodeKeys)
            }
        }
    }

    // Syncs local selection state and forwards the select event to the parent handler.
    function handleNodeSelect(selectedKeys: Key[], info: ISelectedNodeInfo, expandedNodeKeys?: Key[]) {
        if (expandedNodeKeys) {
            setDefaultExpandedKeys(expandedNodeKeys);
        }
        setDefaultSelectedKeys([info.node.key]);
        setDefaultSelectedNodeInfo(info);
        lastHandledKeysRef.current = String(info.node.key);
        needToUpdateTreeNodeRef.current = false;
        handleSelectedKeyChange(treeDataRef.current, info.node.key);
        propsRef.current.handleNodeSelect && propsRef.current.handleNodeSelect(selectedKeys, info, expandedNodeKeys || defaultExpandedKeys);
    }

    // Delegates internal tree drag-and-drop to the parent when a handler is provided.
    const handleOnDropEvent = (info: NodeDragEventParams<ITreeNode> & {
        dragNode: EventDataNode<ITreeNode>;
        dragNodesKeys: Key[];
        dropPosition: number;
        dropToGap: boolean;
    }) => {
        if (propsRef.current.onDrop) {
            propsRef.current.onDrop(info);
        }
    }

    // Delegates drag-start events to the parent when a handler is provided.
    const handleDragStart = (info: NodeDragEventParams<ITreeNode>) => {
        if (propsRef.current.handleDragStart) {
            propsRef.current.handleDragStart(info);
        }
    }

    const currentProps = propsRef.current;
    return (
        <div className='nz-tree-container-hierarchical-data'>
            {treeData && treeData.length > 0 &&
                <TreeControl
                    uniqueName={currentProps.uniqueName}
                    treeData={treeData}
                    autoFocus={currentProps.autoFocus}
                    defaultExpandedKeys={defaultExpandedKeys}
                    defaultSelectedKeys={defaultSelectedKeys}
                    defaultCheckedKeys={defaultCheckedKeys}
                    defaultSelectedNodeInfo={defaultSelectedNodeInfo || undefined}
                    allowAPICallOnExpand={currentProps.allowAPICallOnExpand}
                    allowAdd={currentProps.allowAdd}
                    allowEdit={currentProps.allowEdit}
                    allowDelete={currentProps.allowDelete}
                    disableAdd={currentProps.disableAdd}
                    disableEdit={currentProps.disableEdit}
                    disableDelete={currentProps.disableDelete}
                    allowCheckStrictly={currentProps.featureTreeProps.allowCheckStrictly}
                    allowCheckbox={currentProps.featureTreeProps.allowCheckbox}
                    allowDefaultExpandAll={currentProps.featureTreeProps.openAllNodes}
                    allowIcon={currentProps.featureTreeProps.allowIcon}
                    allowInternalDrag={currentProps.featureTreeProps.allowInternalDrag}
                    allowMultiple={currentProps.allowMultiple}
                    className={currentProps.className}
                    defaultStrictlyCheckedKeys={defaultStrictlyCheckedKeys}
                    disableSelection={currentProps.featureTreeProps.disableSelection}
                    handleAIClick={currentProps.handleAIClick}
                    handleNodeCheck={handleNodeCheck}
                    handleNodeClick={handleNodeClick}
                    handleNodeExpand={handleNodeExpand}
                    handleNodeSelect={handleNodeSelect}
                    onDrop={handleOnDropEvent}
                    handleDragStart={handleDragStart}
                    customIcons={currentProps.customIcons}
                    handleExternalDrop={currentProps.handleExternalDrop}
                    handleDragEnd={currentProps.handleDragEnd}
                    canAcceptExternalDrop={currentProps.canAcceptExternalDrop}
                    canAllowDragDrop={currentProps.canAllowDragDrop}
                />
            }
        </div>
    )
}
const MemoizedTreeForHierarchicalDataContainer = React.memo(TreeForHierarchicalDataContainer);
export { MemoizedTreeForHierarchicalDataContainer as TreeForHierarchicalDataContainer }