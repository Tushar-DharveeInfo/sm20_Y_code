import { IControl } from "../settingsform/ISettingsLibForm";

interface IFilterFormContainer {
    uniqueName: string;
    allowHeader: boolean;
    controls?: IControl[];
    headerText?: string;
    isFilterChange?: boolean;
    controlValues?: IFilterControlValues | unknown;
    handleActionImageClick?: (event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>, actionCode?: string) => void;
    handleFilterFormChange?: (value: string, name: string, id?: string) => void;
}

// Key/value filter json saved on apply; ANY/empty keys are omitted.
interface IFilterControlValues {
    verified?: string;
    bname?: string;
    status?: string;
    btype?: string;
    tag?: string;
    salesexec?: string;
    country?: string;
    state?: string;
    daysnoticeperiod?: string;
    mmfinyear?: string;
    selectdatetype?: string;
    StartDate?: string;
    EndDate?: string;
    dateRange?: string;
    contactsupdated_StartDate?: string;
    contactsupdated_EndDate?: string;
    notesupdated_StartDate?: string;
    notesupdated_EndDate?: string;
    ticketsupdated_StartDate?: string;
    ticketsupdated_EndDate?: string;
    ticketnotesupdated_StartDate?: string;
    ticketnotesupdated_EndDate?: string;
    activitiesupdated_StartDate?: string;
    activitiesupdated_EndDate?: string;
    ordersupdated_StartDate?: string;
    ordersupdated_EndDate?: string;
    subsupdated_StartDate?: string;
    subsupdated_EndDate?: string;
    downloadupdated_StartDate?: string;
    downloadupdated_EndDate?: string;
    amcexpirydate_StartDate?: string;
    amcexpirydate_EndDate?: string;
    mcsexpirydate_StartDate?: string;
    mcsexpirydate_EndDate?: string;
    saasexpirydate_StartDate?: string;
    saasexpirydate_EndDate?: string;
    onpremexpirydate_StartDate?: string;
    onpremexpirydate_EndDate?: string;
    datecreated_StartDate?: string;
    datecreated_EndDate?: string;
    dateupdated_StartDate?: string;
    dateupdated_EndDate?: string;
    cverified?: string;
    contacttype?: string;
    cstatus?: string;
    ctags?: string;
    [key: string]: string | undefined;
}

type IDCFilterControlValues = IFilterControlValues;

export type { IFilterFormContainer, IFilterControlValues, IDCFilterControlValues };
