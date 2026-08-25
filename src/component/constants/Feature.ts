/*
Since all menu and features and QA and kebab menu are unique names, why not we directly use those string to filter or compare 
*/

// Appqa range for filter
const AppQARange = { MIN: 10, MAX: 99 }

// Feature Menu range for filter 
const FeatureMenuRange = { MIN: 100, MAX: 999 }

// Feature QA Range for filter 
const FeatureQARange = { MIN: 1000, MAX: 9000 }

//Kebab menu filter range 
const KebabMenuRange = { MIN: 10000, MAX: 100000 }


// Appqa Constants — ids match sampledata/auth/smFeatures.json MenuID 10 items
enum AppQA {
    Signout = "41",
    Help = "42",
    Theme = "43",
    Launch = "44",
    Notify = "45",
    Alerts = "46",
    Log = "47",
    Report = "48",
}

// Home feature ids — match sampledata/auth/smFeatures.json MenuID 100
enum FeatureEnums {
    Home = "100",
    HomeDashboard = "102",
}

// Client menu feature ids — match smFeatures.json MenuID 200
enum ClientEnums {
    Client = "200",
    ClientIdentityManagement = "204",
    NetZoom = "208",
    VisioStencils = "212",
    SSIAndOtherServices = "216",
    Reseller = "218",
    Msc = '220'
}


// Services menu feature ids — match smFeatures.json MenuID 500
enum ServicesEnums {
    Service = "500",
    Services = "502",
    CatalogAndDiscounts = "504",
    ImportTemplates = '506'
}

// Library menu feature ids — match smFeatures.json MenuID 300
enum LibraryEnums {
    Library = "300",
    DeviceLibrary = "304",
    RequestsReceived = "308",
    ApprovedTickets = "312",
    McsDevelopment = "316",
}

// Settings menu feature ids — match smFeatures.json MenuID 900
enum SettingsEnums {
    Settings = "900",
    DailySchedular = "902",
    Instance = "910",
    Import = "920",
}

enum deviceModelTabs {
    Search = "Search",
    Property = "Property",
    Result = "Result",
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
    ListContacts = "List Contacts"
}

export {
    FeatureMenuRange, AppQA, AppQARange
    , FeatureEnums
    , ClientEnums
    , ServicesEnums
    , LibraryEnums
    , SettingsEnums
    , deviceModelTabs
    , FeatureQARange
    , SidebarEnum
    , KebabMenuRange
}
