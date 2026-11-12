import type { IDeploymentEnv } from "../../allinterface/IApiResponse";

interface IFeatureItem {
    PopupQa?: boolean;
    MenuID: string;
    _Feature: string;
    Label: string;
    NodeType: string;
    Tooltip: string;
    FeatureTag: string;
    SortOrder: number;
    DefaultQA: boolean;
    FilterForm: string;
    SearchPrompt: string | null;
    Secured: boolean;
    Internet?: boolean;
    PaneProps?: string;
    IsNZ: boolean;
    EntID: string;
    RecID: string;
    LastUpdated: string;
    EntityName: string;
    Lock?: boolean;
    Alias?: string;
    [key: string]: string | any;
}

interface IFeatureForHelp {
    featureID: string;
    featureName: string;
}

interface IUserAuthSession {
    id: string;
    username: string;
    email: string | null;
    displayName: string;
    phoneNumber: string | null;
    authType: string;
    tenantNickname: string | null;
    bucketName: string;
    baseFolder: string;
    ImpersonatedUser: string;
    ImpersonatedEmail: string;
    bid: string;
    cid: string;
    authrole: string;
    role: string;
    toolboxRole: string;
    isAuthenticated: boolean;

    purchasedSkus?: string[];// netzoom, vss, amc, ssi, ...
    ImpersonatedDetails?: Record<string, unknown> | null;
    claims?: Record<string, unknown> | null;
    ProductName?: string;
    licenseKey?: string;
    licenseDetails?: Record<string, any>;

    smRoles: string[];
    availableApps: string[];
    permittedApps: string[];
}

interface IAp {
    apName: string; //application parameter like tax-il or tax-fl
    apValue: string; //value for the application parameter like 7.25 in percent
}

interface IMainApp {
    featureRecords: IFeatureItem[];
    setFeatureRecords: React.Dispatch<React.SetStateAction<IFeatureItem[]>>;

    authSession: IUserAuthSession | undefined;
    setAuthSession: React.Dispatch<React.SetStateAction<IUserAuthSession | undefined>>;

    ap: IAp[] | undefined;
    setAp: React.Dispatch<React.SetStateAction<IAp[] | undefined>>;
    getApValue: (apName: string) => string | undefined;

    deploymentVars: IDeploymentEnv[];
    setDeploymentVars: React.Dispatch<
        React.SetStateAction<IDeploymentEnv[]>
    >;



}

export type {
    IMainApp,
    IFeatureItem,
    IFeatureForHelp,
    IUserAuthSession,
    IAp
};
