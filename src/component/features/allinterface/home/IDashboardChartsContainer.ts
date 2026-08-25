import { ITreeNode } from "../../../shared/allinterface/tree/ITreeControl";

interface IDashboardChartsContainer {
    uniqueName: string;
    featureId: string;
    headerText: string;
    showPopupQa?: boolean;
    selectedNode?: ITreeNode;
    purpose?: string;
    handleShowUserMessage?: (messageText: string) => void;
}

export type { IDashboardChartsContainer };
