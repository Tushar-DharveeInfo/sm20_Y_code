
import { useState, createContext, useMemo, useCallback } from "react";
import { IAppContextWrapper } from "../allinterface/IAppContextWrapper";
import { ITreeNode } from "../../allinterface/tree/ITreeControl";
import { ISelectedNode, ISelectedNodeProperty } from "../allinterface/ISelectedNode";

const SelectedNodeContext = createContext<ISelectedNode | undefined>(undefined);

function SelectedNodeProvider({ children }: IAppContextWrapper) {
    const [selectedNode, setSelectedNodeState] = useState<ITreeNode>();
    const [selectedNodeProperty, setSelectedNodePropertyState] = useState<ISelectedNodeProperty>();
    const [selectedNodeExplorer, setSelectedNodeExplorerState] = useState<ITreeNode>();

    const setSelectedNode = useCallback((node?: ITreeNode) => {
        setSelectedNodeState((prev) => {
            if (prev === node) return prev;
            if (prev?.key && node?.key && prev.key === node.key && prev.NodeType === node.NodeType && prev.status === node.status) {
                return prev;
            }
            return node;
        });
    }, []);

    const setSelectedNodeExplorer = useCallback((node?: ITreeNode) => {
        setSelectedNodeExplorerState((prev) => {
            if (prev === node) return prev;
            if (prev?.key && node?.key && prev.key === node.key && prev.NodeType === node.NodeType && prev.status === node.status) {
                return prev;
            }
            return node;
        });
    }, []);

    const setSelectedNodeProperty = useCallback((prop: ISelectedNodeProperty) => {
        setSelectedNodePropertyState(prop);
    }, []);

    const contextValue = useMemo(() => ({
        selectedNode,
        selectedNodeProperty,
        selectedNodeExplorer,
        setSelectedNode,
        setSelectedNodeProperty,
        setSelectedNodeExplorer,
    }), [
        selectedNode,
        selectedNodeProperty,
        selectedNodeExplorer,
        setSelectedNode,
        setSelectedNodeProperty,
        setSelectedNodeExplorer,
    ]);

    return (
        <SelectedNodeContext.Provider value={contextValue}>
            {children}
        </SelectedNodeContext.Provider>
    );
}

export { SelectedNodeProvider, SelectedNodeContext };
