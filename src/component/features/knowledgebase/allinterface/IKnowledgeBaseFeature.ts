/* Shared props for features on the Knowledge Base and About menus. */
interface IKnowledgeBaseFeature {
    uniqueName: string; // uniqueName for the control and required
    featureId?: string; // feature id
    headerText?: string; // header text coming from the selected menu item
    scale?: number; // render scale
    handleShowUserMessage?: (messageText: string) => void;
}

export type { IKnowledgeBaseFeature };
export default IKnowledgeBaseFeature;
