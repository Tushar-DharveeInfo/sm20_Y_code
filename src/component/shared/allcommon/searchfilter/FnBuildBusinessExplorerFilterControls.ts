// Builds libform filter controls from cached businesses/contacts; combos start with ANY.
import type { IBusinessDoc, IContactDoc } from "../../allinterface/IDatasets";
import type { IControl } from "../../allinterface/settingsform/ISettingsLibForm";
import { DisplayControlEnums } from "../../alldefaultprops/basic/DefaultPropsFormContainer";
import type { IDCFilterControlValues } from "../../allinterface/searchfilter/IFilterFormContainer";
import {
    FILTER_ANY,
    FnGetDistinctBusinessCountry,
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

const NOTICE_PERIOD_VALUES = ["15", "30", "45", "60", "90", "120", "180"]; // static notice-period combo
const FIN_YEAR_QUARTERS = ["Q1", "Q2", "Q3", "Q4"]; // static fiscal-quarter combo
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
    "quoteupdated",
    "subsupdated",
    "downloadupdated",
];

// Date-range max is today so start/end stay in the past.
function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
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

// Business + contact filter fields for SettingsLibForm (distinct cache values + static lists).
function FnBuildBusinessExplorerFilterControls(
    businesses: IBusinessDoc[],
    contacts: IContactDoc[],
    applied: IDCFilterControlValues = {}
): IControl[] {
    const businessGroup = "Filter Business";
    const contactGroup = "Filter Contact";

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
            options: FnWithAnyOption(NOTICE_PERIOD_VALUES),
        }),
        makeControl({
            name: "mmfinyear",
            label: "Fiscal quarter",
            group: businessGroup,
            sortOrder: 10,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "mmfinyear"),
            options: FnWithAnyOption(FIN_YEAR_QUARTERS),
        }),
        makeControl({
            name: "selectdatetype",
            label: "Date type",
            group: businessGroup,
            sortOrder: 11,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "selectdatetype"),
            options: FnWithAnyOption(DATE_TYPE_FIELDS),
        }),
        makeControl({
            name: "StartDate",
            label: "Start date",
            group: businessGroup,
            sortOrder: 12,
            displayControl: DisplayControlEnums.DateControl,
            value: applied.StartDate ?? "",
            maxDate: todayIsoDate(),
        }),
        makeControl({
            name: "EndDate",
            label: "End date",
            group: businessGroup,
            sortOrder: 13,
            displayControl: DisplayControlEnums.DateControl,
            value: applied.EndDate ?? "",
            maxDate: todayIsoDate(),
        }),
        makeControl({
            name: "cverified",
            label: "Contact verified",
            group: contactGroup,
            sortOrder: 14,
            displayControl: DisplayControlEnums.TrueFalseControl,
            value: applied.cverified === "true" || applied.cverified === "1" ? "true" : "false",
        }),
        makeControl({
            name: "contacttype",
            label: "Contact type",
            group: contactGroup,
            sortOrder: 15,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "contacttype"),
            options: FnWithAnyOption(FnGetDistinctContactType(contacts)),
        }),
        makeControl({
            name: "cstatus",
            label: "Contact status",
            group: contactGroup,
            sortOrder: 16,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "cstatus"),
            options: FnWithAnyOption(FnGetDistinctContactStatus(contacts)),
        }),
        makeControl({
            name: "ctags",
            label: "Contact tags",
            group: contactGroup,
            sortOrder: 17,
            displayControl: DisplayControlEnums.ComboBoxControl,
            value: comboValue(applied, "ctags"),
            options: FnWithAnyOption(FnGetDistinctContactTag(contacts)),
        }),
    ];
}

export {
    DATE_TYPE_FIELDS,
    FIN_YEAR_QUARTERS,
    FnBuildBusinessExplorerFilterControls,
    NOTICE_PERIOD_VALUES,
};
