import { AuthSession } from '@n20a/libauth';
import { IDeploymentEnv } from '../allinterface/IApiResponse';
import type { IFeatureItem, IUserAuthSession } from '../context/allinterface/IMainApp';

type AppConfigWindow = Window & { APP_CONFIG?: Record<string, unknown>; appSettings?: Record<string, unknown> };

interface ICreateAuthSessionArgs {
    user: AuthSession;
    deploymentVars: IDeploymentEnv[];
    availableApps: string[];
    smRoles: string[];
}

const fnFormatFeature = (record: Record<string, any>) => {
    const toFeatureId = (value: string | number | undefined): string =>
        value === undefined || value === null ? "" : String(value);
    const toBool = (value: string | boolean | undefined, defaultValue = false): boolean => {
        if (typeof value === "boolean") return value;
        if (value === "1" || value === "true") return true;
        if (value === "0" || value === "false") return false;
        return defaultValue;
    };
    const featureId = toFeatureId(record._Feature ?? record.Feature);
    const menuId = toFeatureId(record.MenuID ?? featureId);

    return {
        ...record,
        EntityName: record.EntityName ?? "Feature",
        MenuID: menuId,
        _Feature: featureId,
        Label: record.Label ?? "",
        Tooltip: record.Tooltip ?? "",
        SortOrder: record.SortOrder,
        DefaultQA: toBool(record.DefaultQA),
        Secured: toBool(record.Secured),
        NodeType: record.NodeType ?? "",
        FeatureTag: record.FeatureTag ?? "",
        FilterForm: record.FilterForm ?? "",
        SearchPrompt: record.SearchPrompt ?? null,
        IsNZ: toBool(record.IsNZ, true),
        EntID: record.EntID ? String(record.EntID) : featureId,
        RecID: record.RecID ? String(record.RecID) : featureId,
        LastUpdated: record.LastUpdated ?? "",
    };
};

//converts ["a1", "a2"] to ["a1", "a2"] (array of strings)
export const parseApStringArray = (value: string | undefined): string[] => 
{
    if (!value) return [];

    const trimmed = value.trim();
    if (!trimmed) return [];

    let normalized = trimmed;
    if (normalized.startsWith("[") && normalized.endsWith("]")) {
        normalized = normalized.slice(1, -1);
    }

    return normalized
        .split(",")
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
        .map((item) => item.toLowerCase())
        .filter(Boolean);
};

const getRuntimeConfig = (): Record<string, unknown> => {
    const appWindow = window as AppConfigWindow;
    return appWindow.APP_CONFIG ?? appWindow.appSettings ?? {};
};

export const loadRuntimeConfig = async (): Promise<Record<string, unknown>> => {
    let configObj = getRuntimeConfig();

    if (Object.keys(configObj).length > 0) {
        return configObj;
    }

    try {
        const resp = await fetch('/config.js');
        if (!resp.ok) return {};

        const scriptContent = await resp.text();
        const fn = new Function('window', scriptContent);
        fn(window);
        configObj = getRuntimeConfig();
        return configObj;
    } catch (fetchErr) {
        console.warn("Failed to fetch /config.js:", fetchErr);
        return {};
    }
};

export const toDeploymentEnv = (configObj: Record<string, unknown>): IDeploymentEnv[] => {
    return Object.entries(configObj).map(([key, value]) => ({
        key,
        value: String(value),
    }));
};

export const loadFeatureRecords = async (): Promise<IFeatureItem[]> => {
    const response = await fetch('/smFeatures.json');
    if (!response.ok) {
        throw new Error(`Failed to fetch features json: ${response.status}`);
    }

    const rawFeatures = await response.json();
    if (!Array.isArray(rawFeatures)) {
        throw new Error("features json is not an array");
    }

    return rawFeatures.map(fnFormatFeature) as IFeatureItem[];
};

export const createAuthSession = ({ user, deploymentVars, availableApps, smRoles }: ICreateAuthSessionArgs): IUserAuthSession => {
    return {
        id: user.id,
        username: user.username,
        email: user.email ?? null,
        ImpersonatedUser: user.username,
        ImpersonatedEmail: user.email ?? "",
        displayName: user.displayName,
        phoneNumber: user.phoneNumber ?? null,
        authType: String(user.authType ?? ""),
        tenantNickname: user.tenantNickname ?? null,
        // bucketName: deploymentVars[0]?.FIREBASE_BUCKET ?? 'n20-bucket-01',
        bucketName: deploymentVars.find((v) => v.key === 'FIREBASE_BUCKET')?.value ?? 'n20-bucket-01',  // get FIREBASE_BUCKET from deploymentVars or use default
        baseFolder: 'sm',
        bid: user.tenantNickname ?? "",
        cid: user.email ?? "",
        authrole: (user.claims as any)?.toolboxRole || "",
        role: (user.claims as any)?.toolboxRole || "",
        toolboxRole: (user.claims as any)?.toolboxRole || "",
        smRoles,
        availableApps: availableApps,
        permittedApps: (user.claims as any)?.permittedapps || [],
        claims: user.claims ?? null,
        isAuthenticated: true,
        ProductName: (user as any)?.ProductName ?? (user as any)?.productName ?? "NetZoom",
    };
};
