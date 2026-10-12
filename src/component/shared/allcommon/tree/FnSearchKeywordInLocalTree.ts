import { ITreeNode } from "../../allinterface/tree/ITreeControl";


// this function locally search keyword in the tree node by traversing it
function FnSearchKeywordInLocalTree(
    searchText: string,
    treeData: ITreeNode[],
    excludeEntIDs: string[],
    parentNodes: ITreeNode[] = []
): { foundNode: ITreeNode | null, parentNodes: ITreeNode[] } {
    try {
        const query = (searchText || '').trim().toLowerCase();
        if (!query) return { foundNode: null, parentNodes: [] };

        for (const node of treeData) {
            const nameLower = (node.Name || '').toLowerCase();
            const entIdLower = (node.NodeEntID || '').toLowerCase();
            const titleLower = typeof node.title === 'string' ? node.title.toLowerCase() : '';
            const descLower = (node.Description || '').toLowerCase();
            const tableLabelLower = (node.TableLabel || '').toLowerCase();

            const isMatch =
                nameLower.includes(query) ||
                entIdLower.includes(query) ||
                titleLower.includes(query) ||
                descLower.includes(query) ||
                tableLabelLower.includes(query);

            const isExcluded =
                (node.NodeEntID && excludeEntIDs.includes(node.NodeEntID)) ||
                (node.key && excludeEntIDs.includes(String(node.key)));

            const isRootNode =
                node.NodeType?.toLowerCase() === 'root' ||
                node.treetype?.toLowerCase() === 'root' ||
                node.NodeEntityname?.toLowerCase() === 'root' ||
                String(node.key).toLowerCase() === 'root';

            if (isMatch && !isExcluded && !isRootNode) {
                return { foundNode: node, parentNodes };
            }

            // If the node has children, traverse them recursively
            if (node.children && node.children.length > 0) {
                const result = FnSearchKeywordInLocalTree(searchText, node.children, excludeEntIDs, [...parentNodes, node]);
                if (result.foundNode) {
                    return result;
                }
            }
        }
    } catch (error) {
        console.error(
            "Error in function(FnSearchKeywordInLocalTree): ",
            error
        );
    }
    // Return null if no matching node is found
    return { foundNode: null, parentNodes: [] };
}

export { FnSearchKeywordInLocalTree }