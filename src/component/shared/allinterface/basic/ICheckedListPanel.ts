interface IListItem {
    label: string;
    id: string;
    checked?: boolean;
    isAuthorized?: boolean;
    disableCheck?: boolean;
    Enabled?: boolean;
    [key: string]: unknown;
}

export type { IListItem };
