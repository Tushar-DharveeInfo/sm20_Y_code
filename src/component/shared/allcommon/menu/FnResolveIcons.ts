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
    MyProfile24x24,
    MyActivities24x24,

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
    XLSX24x24,

    // Newly imported icons for smFeatures Labels & Aliases
    Delegate24x24,
    BusinessServices24x24,
    InboundAssets24x24,
    AddBin24x24,
    Back24x24,
    Delete24x24,
    Manufacturer24x24,
    File24x24,
    FAQ24x24,
    Send24x24,
    TestAPI24x24,
    AssetAssignment24x24,


    Accessory24x24,
    Appliance24x24,
    AV24x24,
    BladeEnclosure24x24,
    BladeFiber24x24,
    BladeServer24x24,
    BladeStorage24x24,
    Cable24x24,
    Card24x24,
    Chassis24x24,
    CircuitBreaker24x24,
    Connector24x24,
    CoolingUnit24x24,
    Cooling24x24,
    Display24x24,
    Door24x24,
    Enclosure24x24,
    Fan24x24,
    Frame24x24,
    Furniture24x24,
    GeneratorSet24x24,
    Logical24x24,
    MainFrame24x24,
    Module24x24,
    MountAccessory24x24,
    Networking24x24,
    OtherDevice24x24,
    PatchPanel24x24,
    PDU24x24,
    PowerGrid24x24,
    PowerModule24x24,
    Power24x24,
    Printer24x24,
    RackChassis24x24,
    RackDoor24x24,
    Rack24x24,
    RFIDLocatorTag24x24,
    RFIDReader24x24,
    RFIDSensorTag24x24,
    RFIDTag24x24,
    Router24x24,
    Security24x24,
    Sensor24x24,
    Server24x24,
    Shelf24x24,
    SmartPDU24x24,
    SNMPGateway24x24,
    Storage24x24,
    SurfaceMountBox24x24,
    Switch24x24,
    Telco24x24,
    UPS24x24,
    UtilityPower24x24,
    WallMountBox24x24,
    Watermark24x24,
    Workstation24x24,
    Copy24x24

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
    EULA24x24: Eula24x24,
    FAQ24x24,
    FAQEnums24x24: FAQ24x24,
    FAQ: FAQ24x24,
    About24x24: Info24x24,
    About: Info24x24,
    AboutNetZoom24x24: N,
    AboutNetZoom: N,
    MyProfile24x24,
    MyActivities24x24,
    SelectColumns24x24,
    Excel24x24,
    XLSX24x24,
    Copy24x24,
    // Label lookups keep VisioStencils24x24 / NetZoom24x24 / NZIcon24x24 keys.
    VisioStencils24x24: Visio,
    VisioStencilsBrochure24x24: Visio,
    VisioStencils: Visio,
    Visio,
    NetZoom24x24: N,
    NetZoomBrochure24x24: N,
    NetZoom: N,
    NZIcon24x24: N,
    NZIcon: N,
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

    // Newly imported icons & smFeatures.json Labels / Aliases
    Delegate24x24,
    Delegate: Delegate24x24,
    Impersonate24x24: Delegate24x24,
    Impersonate: Delegate24x24,

    BusinessServices24x24,
    BusinessServices: BusinessServices24x24,
    MCS24x24: BusinessServices24x24,
    MCS: BusinessServices24x24,

    InboundAssets24x24,
    InboundAssets: InboundAssets24x24,
    InbountAssets24x24: InboundAssets24x24,
    InbountAssets: InboundAssets24x24,
    Prospect24x24: InboundAssets24x24,
    Prospect: InboundAssets24x24,

    AddBin24x24,
    AddBin: AddBin24x24,
    Recent24x24: AddBin24x24,
    Recent: AddBin24x24,

    Back24x24,
    Back: Back24x24,
    Past24x24: Back24x24,
    Past: Back24x24,

    Delete24x24,
    Delete: Delete24x24,
    ReviewDeleted24x24: Delete24x24,
    ReviewDeleted: Delete24x24,

    Manufacturer24x24,
    Manufacturer: Manufacturer24x24,
    Tickets24x24: Manufacturer24x24,
    Tickets: Manufacturer24x24,

    File24x24,
    File: File24x24,
    Documents24x24: File24x24,
    Documents: File24x24,

    LibraryColor: LibraryColor128x128,
    LibraryColor24x24: LibraryColor128x128,
    DeviceLibrary24x24: LibraryColor128x128,
    DeviceLibrary: LibraryColor128x128,
    EQID24x24: LibraryColor128x128,
    EQID: LibraryColor128x128,
    RMSLibrary24x24: LibraryColor128x128,
    RMSLibrary: LibraryColor128x128,

    ReviewDeviceLibrary24x24: N,
    ReviewDeviceLibrary: N,
    ReviewVisioStencils24x24: Visio,
    ReviewVisioStencils: Visio,

    RMS24x24: Theme24x24,
    RMS: Theme24x24,

    MyRequests: MyRequests24x24,
    RequestsReceived24x24: MyRequests24x24,
    RequestsReceived: MyRequests24x24,
    ApprovedTickets24x24: MyRequests24x24,
    ApprovedTickets: MyRequests24x24,

    DataTable: DataTable24x24,
    CatalogandDiscounts24x24: DataTable24x24,
    CatalogandDiscounts: DataTable24x24,

    xlsx: XLSX24x24,
    xlsx24x24: XLSX24x24,
    DownloadExcelTemplates24x24: XLSX24x24,
    DownloadExcelTemplates: XLSX24x24,

    Tenant: Tenant24x24,
    ClientIdentityManagement24x24: Tenant24x24,
    ClientIdentityManagement: Tenant24x24,

    Calendar: Calendar24x24,
    DailyScheduler24x24: Calendar24x24,
    DailyScheduler: Calendar24x24,
    DailySchedular24x24: Calendar24x24,
    DailySchedular: Calendar24x24,

    HypervisorNode: HypervisorNode24x24,
    SAASInstance24x24: HypervisorNode24x24,
    SAASInstance: HypervisorNode24x24,

    Team: Team24x24,
    Client24x24: Team24x24,
    Client: Team24x24,

    Diagnostics: Diagnostics24x24,
    SSIandOtherServices24x24: Diagnostics24x24,
    SSIandOtherServices: Diagnostics24x24,

    Authorized: Authorized24x24,
    Reseller24x24: Authorized24x24,
    Reseller: Authorized24x24,

    Approve: Approve24x24,
    Followup24x24: Approve24x24,
    Followup: Approve24x24,

    SelectColumns: SelectColumns24x24,

    orders: Orders24x24,
    Orders: Orders24x24,
    Order24x24: Orders24x24,
    Order: Orders24x24,
    List24x24: Orders24x24,
    List: Orders24x24,

    Service: Services24x24,
    Service24x24: Services24x24,

    Send24x24,
    Send: Send24x24,
    Email24x24: Send24x24,
    Email: Send24x24,
    Mail24x24: Send24x24,
    Mail: Send24x24,

    Task: Task24x24,
    ToDo24x24: Task24x24,
    ToDo: Task24x24,

    TestAPI24x24,
    Test: TestAPI24x24,
    Test24x24: TestAPI24x24,

    Setting: Setting24x24,
    Settings: Setting24x24,
    Settings24x24: Setting24x24,

    AssetAssignment24x24,
    AssetAssignment: AssetAssignment24x24,
    AssetAssigment24x24: AssetAssignment24x24,
    AssetAssigment: AssetAssignment24x24,


    Accessory24x24,
    Appliance24x24,
    AV24x24,
    BladeEnclosure24x24,
    BladeFiber24x24,
    BladeServer24x24,
    BladeStorage24x24,
    Cable24x24,
    Card24x24,
    Chassis24x24,
    CircuitBreaker24x24,
    Connector24x24,
    CoolingUnit24x24,
    Cooling24x24,
    Display24x24,
    Door24x24,
    Enclosure24x24,
    Fan24x24,
    Frame24x24,
    Furniture24x24,
    GeneratorSet24x24,
    Logical24x24,
    MainFrame24x24,
    Module24x24,
    MountAccessory24x24,
    Networking24x24,
    OtherDevice24x24,
    PatchPanel24x24,
    PDU24x24,
    PowerGrid24x24,
    PowerModule24x24,
    Power24x24,
    Printer24x24,
    RackChassis24x24,
    RackDoor24x24,
    Rack24x24,
    RFIDLocatorTag24x24,
    RFIDReader24x24,
    RFIDSensorTag24x24,
    RFIDTag24x24,
    Router24x24,
    Security24x24,
    Sensor24x24,
    Server24x24,
    Shelf24x24,
    SmartPDU24x24,
    SNMPGateway24x24,
    Storage24x24,
    SurfaceMountBox24x24,
    Switch24x24,
    Telco24x24,
    UPS24x24,
    UtilityPower24x24,
    WallMountBox24x24,
    Watermark24x24,
    Workstation24x24,
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
    AssetAssignment24x24,

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
            // console.log('fileName FnResolveIcons:', fileName);
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
