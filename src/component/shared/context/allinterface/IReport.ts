interface IReportProfileItem {
    _ReportProfile: string;
    Description: string;
    EntityNames: string;
    [key: string]: string | number | boolean | any
}

export type { IReportProfileItem }
