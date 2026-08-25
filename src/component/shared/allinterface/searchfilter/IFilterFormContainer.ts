import { IControl } from "../settingsform/ISettingsLibForm";

interface IFilterFormContainer {
    uniqueName: string;
    allowHeader: boolean;
    controls: IControl[];
    headerText?: string;
    isFilterChange?: boolean;
    controlValues?: IDCFilterControlValues | unknown;
    handleActionImageClick?: (event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>, actionCode?: string) => void;
    handleFilterFormChange?: (value: string, name: string, id?: string) => void;
}

interface IDCFilterControlValues {
    status?: string;
    verified?: string;
    country?: string;
    state?: string;
    noticePeriod?: string;
    finYearMonth?: string;
    StartDate?: string;
    EndDate?: string;
    dateRange?: string;
    btype?: string;
    assignedTo?: string;
    tag?: string;
    contactType?: string;
    contactStatus?: string;
    contactVerified?: string;
    contactCountry?: string;
    contactState?: string;
    contactTag?: string;
    [key: string]: string | undefined;
}

export type { IFilterFormContainer, IDCFilterControlValues };
