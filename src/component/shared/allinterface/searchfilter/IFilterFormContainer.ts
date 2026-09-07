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
    cverified?: string;
    contacttype?: string;
    cstatus?: string;
    ctags?: string;
    [key: string]: string | undefined;
}

type IDCFilterControlValues = IFilterControlValues;

export type { IFilterFormContainer, IFilterControlValues, IDCFilterControlValues };
