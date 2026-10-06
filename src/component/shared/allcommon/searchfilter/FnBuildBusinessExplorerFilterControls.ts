// Builds libform filter controls from cached businesses/contacts; combos start with ANY.
import type { IBusinessDoc, IContactDoc } from "../../allinterface/IDatasets";
import type { IControl } from "../../allinterface/settingsform/ISettingsLibForm";
import { DisplayControlEnums } from "../../alldefaultprops/basic/DefaultPropsFormContainer";
import type { IDCFilterControlValues } from "../../allinterface/searchfilter/IFilterFormContainer";
import {
    FILTER_ANY,
    FnGetDistinctBusinessCountry,
    FnGetDistinctBusinessFiscalQuarter,
    FnGetDistinctBusinessNoticePeriod,
    FnGetDistinctBusinessSalesExec,
    FnGetDistinctBusinessState,
    FnGetDistinctBusinessStatus,
    FnGetDistinctBusinessTag,
    FnGetDistinctBusinessType,
    FnGetDistinctContactStatus,
    FnGetDistinctContactTag,
    FnGetDistinctContactType,
    FnWithAnyOption,
} from "./FnGetDistinctDatasetValues";
import { FnIsClientMenuFeature, FnIsProspectFilterFeature } from "./FnGetClientExplorerAutoFilter";
import { RmsEnums } from "../../../constants/Feature";

const NOTICE_PERIOD_VALUES = ["15", "30", "45", "60", "90", "120", "180"]; // fallback notice-period values
const FIN_YEAR_QUARTERS = ["Q1", "Q2", "Q3", "Q4"]; // fallback fiscal-quarter values
const DATE_TYPE_FIELDS = [
    "datecreated",
    "dateupdated",
    "updatedby",
    "contactsupdated",
    "notesupdated",
    "ticketsupdated",
    "ticketnotesupdated",
    "activitiesupdated",
    "ordersupdated",
    "subsupdated",
    "downloadupdated",
    "amcexpirydate",
    "mcsexpirydate",
    "saasexpirydate",
    "onpremexpirydate",
];

const BUSINESS_DATE_FIELDS_CONFIG = [
    { name: "contactsupdated", label: "Contacts updated", isExpiry: false },
    { name: "notesupdated", label: "Notes updated", isExpiry: false },
    { name: "ticketsupdated", label: "Tickets updated", isExpiry: false },
    { name: "ticketnotesupdated", label: "Ticket notes updated", isExpiry: false },
    { name: "activitiesupdated", label: "Activities updated", isExpiry: false },
    { name: "ordersupdated", label: "Orders updated", isExpiry: false },
    { name: "subsupdated", label: "Subscriptions updated", isExpiry: false },
    { name: "downloadupdated", label: "Download updated", isExpiry: false },
    { name: "amcexpirydate", label: "AMC expiry date", isExpiry: true },
    { name: "mcsexpirydate", label: "MCS expiry date", isExpiry: true },
    { name: "saasexpirydate", label: "SaaS expiry date", isExpiry: true },
    { name: "onpremexpirydate", label: "On-prem expiry date", isExpiry: true },
    { name: "datecreated", label: "Date created", isExpiry: false },
    { name: "dateupdated", label: "Date updated", isExpiry: false },
] as const;

// Date-range max is today so start/end stay in the past.
function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
}

function isCheckboxValueChecked(value: unknown): boolean {
    if (value === true || value === 1 || value === "1") return true;
    if (typeof value === "string") {
        const lower = value.trim().toLowerCase();
        return lower === "true" || lower === "yes" || lower === "1";
    }
    return false;
}

// Restore a saved combo value, or ANY when the field was not applied.
function comboValue(applied: IDCFilterControlValues, name: string): string {
    const value = applied[name];
    if (value === undefined || value === null || value === "") {
        return FILTER_ANY;
    }
    return String(value);
}

function makeControl(partial: {
    name: string;
    label: string;
    group: string;
    sortOrder: number;
    displayControl: string;
    value?: string;
    options?: Array<{ label: string; value: string }>;
    maxDate?: string;
}): IControl {
    return {
        CanChange: 1,
        IsRequired: 0,
        GroupName: "APForm_BusinessFilter",
        GroupNameDesc: "",
        SubGroupEntID: "",
        SubGroupName: "FormControl",
        SubGroupNameDesc: "",
        _AP: partial.name,
        PropertyLabel: partial.label,
        NameDesc: partial.label,
        DefaultAPValue: partial.value ?? "",
        Value: partial.value ?? "",
        ValueDesc: "",
        SortOrder: partial.sortOrder,
        MaxInstances: 0,
        InputMask: "",
        RegEx: "",
        DisplayGroupControl: partial.group,
        DisplayControl: partial.displayControl,
        ChangeEvent: "",
        Secured: false,
        IsNZ: false,
        EntID: partial.name,
        RecID: partial.name,
        LastUpdated: "",
        EntityName: "AP",
        Name: partial.name,
        disabled: false,
        Options: partial.options,
        MaxDate: partial.maxDate,
    };
}

// Business + contact filter fields for SettingsLibForm (distinct cache values + dynamic lists).
function FnBuildBusinessExplorerFilterControls(
    businesses: IBusinessDoc[],
    contacts: IContactDoc[],
    applied: IDCFilterControlValues = {},
    featureId?: string
): IControl[] {
    const businessGroup = "Filter Business";
    const contactGroup = "Filter Contact";

    const distinctNoticePeriods = FnGetDistinctBusinessNoticePeriod(businesses);
    const noticePeriodOptions = FnWithAnyOption(
        distinctNoticePeriods.length > 0 ? distinctNoticePeriods : NOTICE_PERIOD_VALUES
    );

    const distinctFiscalQuarters = FnGetDistinctBusinessFiscalQuarter(businesses);
    const fiscalQuarterOptions = FnWithAnyOption(
        distinctFiscalQuarters.length > 0 ? distinctFiscalQuarters : FIN_YEAR_QUARTERS
    );

    // RMS Menu: EQID Feature (402) filters
    if (featureId === RmsEnums.EQID || featureId === "402") {
        const rmsGroup = "Filter EQID";

        return [
            makeControl({
                name: "DataReady",
                label: "Data ready",
                group: rmsGroup,
                sortOrder: 1,
                displayControl: DisplayControlEnums.TrueFalseControl,
                value: isCheckboxValueChecked(applied.DataReady) ? "true" : "false",
            }),
            makeControl({
                name: "ShapeReady",
                label: "Shape ready",
                group: rmsGroup,
                sortOrder: 2,
                displayControl: DisplayControlEnums.TrueFalseControl,
                value: isCheckboxValueChecked(applied.ShapeReady) ? "true" : "false",
            }),
            makeControl({
                name: "isReleased",
                label: "Is released",
                group: rmsGroup,
                sortOrder: 3,
                displayControl: DisplayControlEnums.TrueFalseControl,
                value: isCheckboxValueChecked(applied.isReleased) ? "true" : "false",
            }),
            makeControl({
                name: "ApprovedDate_StartDate",
                label: "Approved date from",
                group: rmsGroup,
                sortOrder: 4,
                displayControl: DisplayControlEnums.DateControl,
                value: applied["ApprovedDate_StartDate"] ?? applied["ApprovedDateStartDate"] ?? applied["ApprovedDate"] ?? "",
                maxDate: todayIsoDate(),
            }),
            makeControl({
                name: "ApprovedDate_EndDate",
                label: "Approved date to",
                group: rmsGroup,
                sortOrder: 5,
                displayControl: DisplayControlEnums.DateControl,
                value: applied["ApprovedDate_EndDate"] ?? applied["ApprovedDateEndDate"] ?? "",
                maxDate: todayIsoDate(),
            }),
            makeControl({
                name: "ReleasedDate_StartDate",
                label: "Released date from",
                group: rmsGroup,
                sortOrder: 6,
                displayControl: DisplayControlEnums.DateControl,
                value: applied["ReleasedDate_StartDate"] ?? applied["ReleasedDateStartDate"] ?? applied["ReleasedDate"] ?? "",
                maxDate: todayIsoDate(),
            }),
            makeControl({
                name: "ReleasedDate_EndDate",
                label: "Released date to",
                group: rmsGroup,
                sortOrder: 7,
                displayControl: DisplayControlEnums.DateControl,
                value: applied["ReleasedDate_EndDate"] ?? applied["ReleasedDateEndDate"] ?? "",
                maxDate: todayIsoDate(),
            }),
        ];
    }

    // If this is a Client menu feature ([Client] NetZoom, VisioStencils, SSI…, MCS, Reseller),
    // offer the specific filters requested:
    // btype, salesexecutive, Country, State, Status, Notice Period, Fiscal Quarter,
    // Contact type, Contact Status, Contact Tag.
    if (FnIsClientMenuFeature(featureId)) {
        return [
            makeControl({
                name: "btype",
                label: "Type",
                group: businessGroup,
                sortOrder: 1,
                displayControl: DisplayControlEnums.ComboBoxControl,
                value: comboValue(applied, "btype"),
                options: FnWithAnyOption(FnGetDistinctBusinessType(businesses)),
            }),
            makeControl({
                name: "salesexec",
                label: "Sales exec",
                group: businessGroup,
                sortOrder: 2,
                displayControl: DisplayControlEnums.ComboBoxControl,
                value: comboValue(applied, "salesexec"),
                options: FnWithAnyOption(FnGetDistinctBusinessSalesExec(businesses)),
            }),
            makeControl({
                name: "country",
                label: "Country",
                group: businessGroup,
                sortOrder: 3,
                displayControl: DisplayControlEnums.ComboBoxControl,
                value: comboValue(applied, "country"),
                options: FnWithAnyOption(FnGetDistinctBusinessCountry(businesses)),
            }),
            makeControl({
                name: "state",
                label: "State",
                group: businessGroup,
                sortOrder: 4,
                displayControl: DisplayControlEnums.ComboBoxControl,
                value: comboValue(applied, "state"),
                options: FnWithAnyOption(FnGetDistinctBusinessState(businesses)),
            }),
            makeControl({
                name: "status",
                label: "Status",
                group: businessGroup,
                sortOrder: 5,
                displayControl: DisplayControlEnums.ComboBoxControl,
                value: comboValue(applied, "status"),
                options: FnWithAnyOption(FnGetDistinctBusinessStatus(businesses)),
            }),
            makeControl({
                name: "daysnoticeperiod",
                label: "Notice period",
                group: businessGroup,
                sortOrder: 6,
                displayControl: DisplayControlEnums.ComboBoxControl,
                value: comboValue(applied, "daysnoticeperiod"),
                options: noticePeriodOptions,
            }),
            makeControl({
                name: "mmfinyear",
                label: "Fiscal quarter",
                group: businessGroup,
                sortOrder: 7,
                displayControl: DisplayControlEnums.ComboBoxControl,
                value: comboValue(applied, "mmfinyear"),
                options: fiscalQuarterOptions,
            }),
            ...BUSINESS_DATE_FIELDS_CONFIG.flatMap((df, idx) => {
                const startVal = applied[`${df.name}_StartDate`] ?? applied[`${df.name}StartDate`] ?? "";
                const endVal = applied[`${df.name}_EndDate`] ?? applied[`${df.name}EndDate`] ?? "";
                const maxDate = df.isExpiry ? undefined : todayIsoDate();
                return [
                    makeControl({
                        name: `${df.name}_StartDate`,
                        label: df.label,
                        group: businessGroup,
                        sortOrder: 8 + idx * 2,
                        displayControl: DisplayControlEnums.DateControl,
                        value: startVal,
                        maxDate,
                    }),
                    makeControl({
                        name: `${df.name}_EndDate`,
                        label: df.label,
                        group: businessGroup,
                        sortOrder: 9 + idx * 2,
                        displayControl: DisplayControlEnums.DateControl,
                        value: endVal,
                        maxDate,
                    }),
                ];
            }),
            makeControl({
                name: "contacttype",
                label: "Contact type",
                group: contactGroup,
                sortOrder: 8 + BUSINESS_DATE_FIELDS_CONFIG.length * 2,
                displayControl: DisplayControlEnums.ComboBoxControl,
                value: comboValue(applied, "contacttype"),
                options: FnWithAnyOption(FnGetDistinctContactType(contacts)),
            }),
            makeControl({
                name: "cstatus",
                label: "Contact status",
                group: contactGroup,
                sortOrder: 9 + BUSINESS_DATE_FIELDS_CONFIG.length * 2,
                displayControl: DisplayControlEnums.ComboBoxControl,
                value: comboValue(applied, "cstatus"),
                options: FnWithAnyOption(FnGetDistinctContactStatus(contacts)),
            }),
            makeControl({
                name: "ctags",
                label: "Contact tags",
                group: contactGroup,
                sortOrder: 10 + BUSINESS_DATE_FIELDS_CONFIG.length * 2,
                displayControl: DisplayControlEnums.ComboBoxControl,
                value: comboValue(applied, "ctags"),
                options: FnWithAnyOption(FnGetDistinctContactTag(contacts)),
            }),
        ];
    }

    // If this is a Prospect feature ([Prospect] Followup, Recent, Past),
    // offer only the requested filters:
    // Country: Dynamically created Country list
    // DateUpdated: <date range>
    if (FnIsProspectFilterFeature(featureId)) {
        const startVal = applied.dateupdated_StartDate ?? applied.dateupdatedStartDate ?? applied.lastupdated_StartDate ?? applied.lastupdatedStartDate ?? "";
        const endVal = applied.dateupdated_EndDate ?? applied.dateupdatedEndDate ?? applied.lastupdated_EndDate ?? applied.lastupdatedEndDate ?? "";
        return [
            makeControl({
                name: "country",
                label: "Country",
                group: businessGroup,
                sortOrder: 1,
                displayControl: DisplayControlEnums.ComboBoxControl,
                value: comboValue(applied, "country"),
                options: FnWithAnyOption(FnGetDistinctBusinessCountry(businesses)),
            }),
            makeControl({
                name: "dateupdated_StartDate",
                label: "Date updated",
                group: businessGroup,
                sortOrder: 2,
                displayControl: DisplayControlEnums.DateControl,
                value: startVal,
                maxDate: todayIsoDate(),
            }),
            makeControl({
                name: "dateupdated_EndDate",
                label: "Date updated",
                group: businessGroup,
                sortOrder: 3,
                displayControl: DisplayControlEnums.DateControl,
                value: endVal,
                maxDate: todayIsoDate(),
            }),
        ];
    }

    return [
        makeControl({
            name: "verified",
            label: "Verified",
            group: businessGroup,
            sortOrder: 1,
            displayControl: DisplayControlEnums.TrueFalseControl,
            value: applied.verified === "true" || applied.verified === "1" ? "true" : "false",
        }),
        makeControl({
            name: "bname",
            label: "Business prefix",
            group: businessGroup,
            sortOrder: 2,
            displayControl: DisplayControlEnums.EditTextControl,
            value: applied.bname ?? "",
        }),
        makeControl({
            name: "status",
            label: "Status",
            group: businessGroup,
            sortOrder: 3,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "status"),
            options: FnWithAnyOption(FnGetDistinctBusinessStatus(businesses)),
        }),
        makeControl({
            name: "btype",
            label: "Type",
            group: businessGroup,
            sortOrder: 4,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "btype"),
            options: FnWithAnyOption(FnGetDistinctBusinessType(businesses)),
        }),
        makeControl({
            name: "tag",
            label: "Tag",
            group: businessGroup,
            sortOrder: 5,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "tag"),
            options: FnWithAnyOption(FnGetDistinctBusinessTag(businesses)),
        }),
        makeControl({
            name: "salesexec",
            label: "Sales exec",
            group: businessGroup,
            sortOrder: 6,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "salesexec"),
            options: FnWithAnyOption(FnGetDistinctBusinessSalesExec(businesses)),
        }),
        makeControl({
            name: "country",
            label: "Country",
            group: businessGroup,
            sortOrder: 7,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "country"),
            options: FnWithAnyOption(FnGetDistinctBusinessCountry(businesses)),
        }),
        makeControl({
            name: "state",
            label: "State",
            group: businessGroup,
            sortOrder: 8,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "state"),
            options: FnWithAnyOption(FnGetDistinctBusinessState(businesses)),
        }),
        makeControl({
            name: "daysnoticeperiod",
            label: "Notice period",
            group: businessGroup,
            sortOrder: 9,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "daysnoticeperiod"),
            options: noticePeriodOptions,
        }),
        makeControl({
            name: "mmfinyear",
            label: "Fiscal quarter",
            group: businessGroup,
            sortOrder: 10,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "mmfinyear"),
            options: fiscalQuarterOptions,
        }),
        ...BUSINESS_DATE_FIELDS_CONFIG.flatMap((df, idx) => {
            const startVal = applied[`${df.name}_StartDate`] ?? applied[`${df.name}StartDate`] ?? "";
            const endVal = applied[`${df.name}_EndDate`] ?? applied[`${df.name}EndDate`] ?? "";
            const maxDate = df.isExpiry ? undefined : todayIsoDate();
            return [
                makeControl({
                    name: `${df.name}_StartDate`,
                    label: df.label,
                    group: businessGroup,
                    sortOrder: 11 + idx * 2,
                    displayControl: DisplayControlEnums.DateControl,
                    value: startVal,
                    maxDate,
                }),
                makeControl({
                    name: `${df.name}_EndDate`,
                    label: df.label,
                    group: businessGroup,
                    sortOrder: 12 + idx * 2,
                    displayControl: DisplayControlEnums.DateControl,
                    value: endVal,
                    maxDate,
                }),
            ];
        }),
        makeControl({
            name: "cverified",
            label: "Contact verified",
            group: contactGroup,
            sortOrder: 11 + BUSINESS_DATE_FIELDS_CONFIG.length * 2,
            displayControl: DisplayControlEnums.TrueFalseControl,
            value: applied.cverified === "true" || applied.cverified === "1" ? "true" : "false",
        }),
        makeControl({
            name: "contacttype",
            label: "Contact type",
            group: contactGroup,
            sortOrder: 12 + BUSINESS_DATE_FIELDS_CONFIG.length * 2,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "contacttype"),
            options: FnWithAnyOption(FnGetDistinctContactType(contacts)),
        }),
        makeControl({
            name: "cstatus",
            label: "Contact status",
            group: contactGroup,
            sortOrder: 13 + BUSINESS_DATE_FIELDS_CONFIG.length * 2,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "cstatus"),
            options: FnWithAnyOption(FnGetDistinctContactStatus(contacts)),
        }),
        makeControl({
            name: "ctags",
            label: "Contact tags",
            group: contactGroup,
            sortOrder: 14 + BUSINESS_DATE_FIELDS_CONFIG.length * 2,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "ctags"),
            options: FnWithAnyOption(FnGetDistinctContactTag(contacts)),
        }),
    ];
}

export {
    BUSINESS_DATE_FIELDS_CONFIG,
    DATE_TYPE_FIELDS,
    FIN_YEAR_QUARTERS,
    FnBuildBusinessExplorerFilterControls,
    NOTICE_PERIOD_VALUES,
};
