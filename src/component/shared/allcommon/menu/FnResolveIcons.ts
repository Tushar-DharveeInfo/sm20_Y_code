/**
 * Icon resolver for SM menus.
 * Imports only icons needed for Labels in smFeatures.json (+ small shared/fallback set).
 */
import { getfeaturesData } from "../../context/contextandprovider/MainApp";

import {
    // Fallback / shared
    N,
    Setting24x24,
    More24x24,
    Info24x24,
    F24x24,
    R24x24,
    ThreeD24x24,
    Sites24x24,
    EntityvsTable24x24,
    Device24x24,
    User24x24,
    Import24x24,
    Approve24x24,
    Orders24x24,
    InstanceNode24x24,
    DataTable24x24,
    Task24x24,
    Reminder24x24,

    // smFeatures Labels that have matching libicon exports
    Signout24x24,
    Help24x24,
    Theme24x24,
    Launch24x24,
    Notify24x24,
    Alerts24x24,
    Log24x24,
    Report24x24,
    Home24x24,
    Buy24x24,
    Purchase24x24,
    Eula24x24,
    Visio,
    Cart24x24,
    DownloadVisioStencils24x24,
    DownloadNetZoom24x24,
    Other24x24,
    Services24x24,
    RequestSupport24x24,
    RequestDeviceModels24x24,
    MyRequests24x24,
    Profile24x24,
    Notes24x24,
    Download24x24,
    Team24x24,
    Calendar24x24,
    Tenant24x24,
    Diagnostics24x24,
    Authorized24x24,
    LibraryColor128x128,
    CreateNewDeviceEntity24x24,
    BackgroundTaskProfile24x24,
    HypervisorNode24x24,
    SelectColumns24x24,
    Excel24x24,
    XLSX24x24

} from "@n20a/libicon";

import type { ComponentType } from "react";

type IconMap = Record<string, ComponentType<any>>;

/*Normalize feature Label the same way menus build icon file names. */
const toFeatureIconKey = (label: string): string =>
    `${label.replace(/[^0-9A-Za-z_-]/g, "")}24x24`;

/*Icons that exist in @n20a/libicon for smFeatures Labels. */
const featureIconMap: IconMap = {
    Signout24x24,
    Help24x24,
    Theme24x24,
    Launch24x24,
    Notify24x24,
    Alerts24x24,
    Log24x24,
    Report24x24,
    Home24x24,
    Buy24x24,
    Purchase24x24,
    Eula24x24,
    SelectColumns24x24,
    Excel24x24,
    XLSX24x24,
    // Label lookups keep VisioStencils24x24 / NetZoom24x24 / NZIcon24x24 keys.
    VisioStencils24x24: Visio,
    Visio,
    NetZoom24x24: N,
    NZIcon24x24: N,
    N,
    Cart24x24,
    DownloadVisioStencils24x24,
    DownloadNetZoom24x24,
    Other24x24,
    Services24x24,
    RequestSupport24x24,
    RequestDeviceModels24x24,
    MyRequests24x24,
    Profile24x24,
    Notes24x24,
    Download24x24,
    Team24x24,
    Calendar24x24,
    Tenant24x24,
    Diagnostics24x24,
    Authorized24x24,
    LibraryColor128x128,
    CreateNewDeviceEntity24x24,
    BackgroundTaskProfile24x24,
    HypervisorNode24x24,
};

/**
 * smFeatures Labels without an exact libicon name → closest available icon.
 * Keys match ExpandableList / MainMenu icon lookup (`Label` + `24x24`).
 */
const smFeatureAliases: Record<string, string> = {
    EULA24x24: "Eula24x24",
    Settings24x24: "Setting24x24",
    Client24x24: "User24x24",
    ClientIdentityManagement24x24: "User24x24",
    SSIandOtherServices24x24: "Services24x24",
    Reseller24x24: "N",
    Library24x24: "Device24x24",
    DeviceLibrary24x24: "Device24x24",
    RequestsReceived24x24: "MyRequests24x24",
    ApprovedTickets24x24: "Approve24x24",
    MCSDevelopment24x24: "Task24x24",
    Resources24x24: "Help24x24",
    KnowledgeBase24x24: "Help24x24",
    CatalogandDiscounts24x24: "Purchase24x24",
    ImportTemplates24x24: "Import24x24",
    DailySchedular24x24: "Reminder24x24",
    Instance24x24: "InstanceNode24x24",
    List24x24: "DataTable24x24",
    Order24x24: "Orders24x24",
    VisioStencils24x24: "Visio",
    NetZoom24x24: "N",
    NZIcon24x24: "N",
};

/*Shared icons used by tree/submenu aliases and Settings. */
const sharedIconMap: IconMap = {
    Setting24x24,
    More24x24,
    Info24x24,
    F24x24,
    R24x24,
    ThreeD24x24,
    Sites24x24,
    EntityvsTable24x24,
    Device24x24,
    User24x24,
    Import24x24,
    Approve24x24,
    Orders24x24,
    InstanceNode24x24,
    DataTable24x24,
    Task24x24,
    Reminder24x24,

};

const rawIconMap: IconMap = {
    ...featureIconMap,
    ...sharedIconMap,
};
// normalize once
const iconMap: IconMap = Object.fromEntries(
    Object.entries(rawIconMap).map(([k, v]) => [k.toLowerCase(), v])
);

type ResolverOptions = {
    defaultIcon?: ComponentType<any>;
    aliases?: Record<string, string>;
};

const FnResolveIcons = (options?: ResolverOptions) => {
    try {
        const { defaultIcon = N, aliases = {} } = options || {};

        const normalizedAliases = Object.fromEntries(
            Object.entries(aliases).map(([k, v]) => [
                k.toLowerCase(),
                v.toLowerCase()
            ])
        );

        return (fileName?: string): ComponentType<any> => {
            console.log('fileName FnResolveIcons:', fileName);
            try {
                if (!fileName) return defaultIcon;

                const key = fileName.toLowerCase();
                const resolvedKey = normalizedAliases[key] || key;

                // 1. Exact match first
                if (iconMap[resolvedKey]) {
                    return iconMap[resolvedKey];
                }

                // 2. Find first key that starts with the filename
                const matchedEntry = Object.entries(iconMap).find(([iconKey]) =>
                    iconKey.startsWith(resolvedKey)
                );

                return matchedEntry?.[1] || defaultIcon;
            } catch (error) {
                console.error("FnResolveIcons resolver error:", error);
                return defaultIcon;
            }
        };
    } catch (error) {
        console.error("FnResolveIcons error:", error);
        return (): ComponentType<any> => N;
    }
};

/** Unique icon keys expected from feature labels (for diagnostics). */
const smFeatureIconKeys = (): string[] => {
    const features = getfeaturesData() || [];
    return [
        ...new Set(
            features
                .map((item) => item.Label)
                .filter((label): label is string => Boolean(label))
                .map(toFeatureIconKey)
        ),
    ];
};

export { FnResolveIcons, N, Setting24x24, smFeatureIconKeys, toFeatureIconKey };


