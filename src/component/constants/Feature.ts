/*
Since all menu and features and QA and kebab menu are unique names, why not we directly use those string to filter or compare 
*/

// Appqa range for filter
const AppQARange = { MIN: 10, MAX: 99 };

// Feature Menu range for filter 
const FeatureMenuRange = { MIN: 100, MAX: 999 };

// Feature QA Range for filter 
const FeatureQARange = { MIN: 1000, MAX: 9999 };

// Kebab menu filter range 
const KebabMenuRange = { MIN: 10000, MAX: 99999 };


// Appqa Constants — ids match public/smFeatures.json MenuID 10 items
enum AppQA {
    Signout = "41",
    Help = "42",
    Theme = "43",
    Launch = "44",
    Notify = "45",
    Alerts = "46",
    Log = "47",
    Report = "50",
    Impersonate = "52",
    ToDo = "54",
}

// Home feature ids — match public/smFeatures.json MenuID 100
enum HomeEnums {
    Home = "100",
    HomeDashboard = "102",
    MyProfile = "104",
    MyActivities = "106",
}

// Client menu feature ids — match public/smFeatures.json MenuID 200
enum ClientEnums {
    Client = "200",
    NetZoom = "208",
    VisioStencils = "212",
    SSIAndOtherServices = "216",
    Reseller = "218",
    Mcs = "220",
}

// Prospect menu feature ids — match public/smFeatures.json MenuID 250
enum ProspectEnums {
    Prospect = "250",
    Followup = "252",
    Recent = "254",
    Past = "256",
    ReviewDeleted = "258",
    Delete = "258",
    All = "254",
    Verify = "256",
}

// Library / Tickets menu feature ids — match public/smFeatures.json MenuID 300
enum TicketsEnums {
    Tickets = "300",
    DeviceLibrary = "304",
    RequestsReceived = "308",
    ApprovedTickets = "312",
}

// RMS menu feature ids — match public/smFeatures.json MenuID 400
enum RmsEnums {
    RMS = "400",
    EQID = "402",
    RMSLibrary = "404",
    McsDevelopment = "404",
    ReviewDeviceLibrary = "406",
    ReviewVisioStencils = "408",
}

// FAQ menu feature ids — match public/smFeatures.json MenuID 600
enum FAQEnums {
    FAQEnums = "600",
    FAQ = "602",
    Documents = "604",
    KBDOCS = "604",
    CatalogAndDiscounts = "606",
    DownloadExcelTemplates = "608",
    DownloadExcelTempates = "608",
}

// Setting menu feature ids — match public/smFeatures.json MenuID 900
enum SettingEnums {
    Setting = "900",
    ClientIdentityManagement = "904",
    DailyScheduler = "908",
    SAASInstance = "912",
    Import = "916",
    Delete = "920",
    Test = "929",
}

// About menu feature ids — match public/smFeatures.json MenuID 990
enum AboutEnums {
    About = "990",
    AboutNetZoom = "992",
}

// Kebab Services menu feature ids — match public/smFeatures.json
enum KebabServicesEnums {
    NetZoomServices = "10208",
    VisioStencilsServices = "10212",
    SSIAndOtherServices = "10216",
    ResellerServices = "10218",
    McsServices = "10220",
    RequestsReceivedServices = "10308",
    ApprovedTicketsServices = "10312",
    ClientIdentityManagementServices = "10904",
}


enum kebabMenuEnums {
    Services = 'services',
    Unapprove = 'unapprove',
    Unapproved = 'unapproved',
    Block = 'block',
    Blocked = 'blocked',
    Delete = 'delete',
    Deleted = 'deleted',
    Copy = 'copy',
    AddBusiness = 'add business',
    AddContact = 'add contact',
}

// Feature QA ToDo IDs across menus — match public/smFeatures.json
enum FeatureToDoEnums {
    NetZoom = "2094",
    VisioStencils = "2134",
    SSIAndOtherServices = "2174",
    Reseller = "2194",
    Mcs = "2214",
    ProspectFollowup = "2528",
    ProspectRecent = "2548",
    ProspectPast = "2568",
    ProspectReviewDeleted = "2588",
    RequestsReceived = "3094",
    ApprovedTickets = "3134",
}

// Feature QA Profile IDs across menus — match public/smFeatures.json
enum FeatureProfileEnums {
    NetZoom = "2084",
    VisioStencils = "2124",
    SSIAndOtherServices = "2164",
    Reseller = "2184",
    Mcs = "2204",
    ProspectFollowup = "2522",
    ProspectRecent = "2542",
    ProspectPast = "2562",
    ProspectReviewDeleted = "2584",
    RequestsReceived = "3084",
    ApprovedTickets = "3124",
    SAASInstance = "9124",
}

// Feature QA List (Contacts) IDs across menus — match public/smFeatures.json
enum FeatureListEnums {
    NetZoom = "2086",
    VisioStencils = "2126",
    SSIAndOtherServices = "2166",
    Reseller = "2186",
    Mcs = "2206",
    ProspectFollowup = "2524",
    ProspectRecent = "2544",
    ProspectPast = "2564",
    ProspectReviewDeleted = "2586",
    RequestsReceived = "3086",
    ApprovedTickets = "3126",
    SAASInstance = "9126",
}

// Feature QA Email IDs across menus — match public/smFeatures.json
enum FeatureEmailEnums {
    NetZoom = "2088",
    VisioStencils = "2128",
    SSIAndOtherServices = "2168",
    Reseller = "2188",
    Mcs = "2208",
    RequestsReceived = "3088",
    ApprovedTickets = "3128",
    SAASInstance = "9128",
}

// Feature QA Log IDs across menus — match public/smFeatures.json
enum FeatureLogEnums {
    NetZoom = "2090",
    VisioStencils = "2130",
    SSIAndOtherServices = "2170",
    Reseller = "2190",
    Mcs = "2210",
    ProspectFollowup = "2526",
    ProspectRecent = "2546",
    ProspectPast = "2566",
    ProspectReviewDeleted = "2582",
    RequestsReceived = "3090",
    ApprovedTickets = "3130",
    SAASInstance = "9130",
}

// Feature QA Order IDs across menus — match public/smFeatures.json
enum FeatureOrderEnums {
    NetZoom = "2092",
    VisioStencils = "2132",
    SSIAndOtherServices = "2172",
    Reseller = "2192",
    Mcs = "2212",
    RequestsReceived = "3092",
    ApprovedTickets = "3132",
    SAASInstance = "9132",
}

// Feature QA Notes IDs across menus — match public/smFeatures.json
enum FeatureNotesEnums {
    RequestsReceived = "3082",
    ApprovedTickets = "3122",
    SAASInstance = "9122",
}

enum deviceModelTabs {
    Search = "Search library",
    Property = "Property",
    Result = "Found in Library",
}

enum SidebarEnum {
    Property = "Property",
    Log = "Log",
    Notes = "Notes",
    Alerts = "Alerts",
    ActionLog = "ActionLog",
    Assign = "Assign",
    Profile = "Profile",
    Device = "Device",
    List = "List",
    ListContacts = "List Contacts",
    ToDo = "ToDo",
    Orders = "Order",
    Email = "Email"
}

export {
    FeatureMenuRange,
    AppQA,
    AppQARange,
    kebabMenuEnums,
    HomeEnums,
    ClientEnums,
    ProspectEnums,
    TicketsEnums,
    RmsEnums,
    FAQEnums,
    SettingEnums,
    AboutEnums,
    KebabServicesEnums,
    FeatureToDoEnums,
    FeatureProfileEnums,
    FeatureListEnums,
    FeatureEmailEnums,
    FeatureLogEnums,
    FeatureOrderEnums,
    FeatureNotesEnums,
    deviceModelTabs,
    FeatureQARange,
    SidebarEnum,
    KebabMenuRange,
};
