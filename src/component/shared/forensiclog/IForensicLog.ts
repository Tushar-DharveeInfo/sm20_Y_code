import { IForensicLogPaginationPayload, TGridRowData } from "../tablegrid/IBasicGrid"
import { ITreeNode } from "../tree/ITreeControl"

interface IForensicLog {
    uniqueName: string
    featureId: string // feature id
    isSetting: boolean // it indicate render for settings or not 
    loginType: string // we are passing user and node base on setting and logs
    selectedNode?: ITreeNode // selected node for tree
    allowSort?: boolean // allow sort column or not
    hideSearchControl?: boolean
    handleUpdateHeaderTitle?: (title: string) => void; // to update header title
    handleShowUserMessage?: (messageText: string) => void;
}

interface IForensicLogPayload {
    sessionId?: string;
    filterJsonString: string;
    startPage: number;
    recordCount: number;
}

type IDateRangeField = { startDate?: unknown; endDate?: unknown };

/* Column metadata returned by GetFilteredLog in ColumnList. */
interface IForensicLogColumn {
    PropertyLabel: string;
    PName: string;
    DisplayControl?: string;
    ExcludeDataGridField?: boolean | number | string;
}

/* Cached grid payload used for render, export, and dynamic pagination. */
interface IForensicLogTableData {
    Dataset: TGridRowData | null;
    ColumnList: IForensicLogColumn[] | null;
    apiParams: IForensicLogPayload & IForensicLogPaginationPayload;
}

/* Parsed filter profile from SearchControlWithFilter / download. */
interface IForensicLogFilterFormData extends Record<string, unknown> {
    Users?: string;
    UserName?: string;
    ANDOR?: string;
    Keywords?: string;
    FilterBy?: string;
    SiteName?: string;
    TenantName?: string;
    CompanyName?: string;
}
export type { IForensicLog, IForensicLogPayload, IDateRangeField, IForensicLogColumn, IForensicLogTableData, IForensicLogFilterFormData }