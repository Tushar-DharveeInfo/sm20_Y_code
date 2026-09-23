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


// Appqa Constants — ids match public/smFeatures.json MenuID 10 items
enum AppQA {
    Signout = "41",
    Help = "42",
    Theme = "43",
    Launch = "44",
    Notify = "45",
    Alerts = "46",
    Log = "47",
    Report = "48",
    ToDo = "49",
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
    Delete = "258",
    All = "254",
    Verify = "256",
}

// Library menu feature ids — match public/smFeatures.json MenuID 300
enum TicketsEnums {
    Tickets = "300",
    DeviceLibrary = "304",
    RequestsReceived = "308",
    ApprovedTickets = "312",
}

enum RmsEnums {
    McsDevelopment = "404",
}

// Services menu feature ids — match public/smFeatures.json MenuID 500
enum ServicesEnums {
    Service = "500",
    Services = "502",
    CatalogAndDiscounts = "504",
    DownloadExcelTempates = "506",
}

// FAQ menu feature ids — match public/smFeatures.json MenuID 600
enum FAQEnums {
    FAQEnums = "600",
    FAQ = "602",
    KBDOCS = "604",
}

// About menu feature ids — match public/smFeatures.json MenuID 990
enum AboutEnums {
    About = "990",
    AboutNetZoom = "992",
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
    ListContacts = "List Contacts"
}

export {
    FeatureMenuRange, AppQA, AppQARange
    , HomeEnums
    , ClientEnums
    , ProspectEnums
    , ServicesEnums
    , TicketsEnums
    , RmsEnums
    , FAQEnums
    , AboutEnums
    , deviceModelTabs
    , FeatureQARange
    , SidebarEnum
    , KebabMenuRange
}
