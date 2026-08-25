import { ITreeNode } from "../../../shared/allinterface/tree/ITreeControl";

interface IChartOptions {
    series?: Record<string, unknown>[];
    splitBy?: string;
    title?: unknown;
    subtitle?: unknown;
    legend?: Record<string, unknown>;
    titleFontSize?: number;
    subtitleFontSize?: number;
    legendFontSize?: number;
    labelFontSize?: number;
    labelColor?: string;
    axisLabelFontSize?: number;
    axisTitleFontSize?: number;
}

interface IChartProfileItem {
    Enabled: boolean;
    GroupName: string;
    _ChartProfile: string;
    Description: string;
    Purpose: string;
    SortOrder: number | null;
    ChartOptions: string;
    ChartType: string;
    ChartDatasetAPI: string;
    EntityNames: string | null;
    Secured: boolean;
    IsNZ: boolean;
    EntID: string;
    RecID: string;
    EntityName: string;
}

interface IChartApiItem {
    apiname: string;
    url: string;
    payload?: Record<string, unknown>;
    response?: unknown[];
    data?: unknown[];
}

interface IDashboardChart {
    uniqueName: string;
    featureId: string;
    outputFormat: "data" | "jsx" | "png" | "svg";
    hideHeader?: boolean;
    displayPerRow?: number;
    title?: string;
    isDashboard?: boolean;
    selectedNode?: ITreeNode;
    parentClassName?: string;
    purpose?: string;
    handleShowUserMessage?: (messageText: string) => void;
}

type TChartRecord = Record<string, unknown>;
type TChartProfileRow = IChartProfileItem & { ChartData?: unknown };
type TSeriesRecord = Record<string, unknown>;

export type {
    IDashboardChart,
    IChartOptions,
    IChartProfileItem,
    IChartApiItem,
    TChartRecord,
    TChartProfileRow,
    TSeriesRecord,
};
