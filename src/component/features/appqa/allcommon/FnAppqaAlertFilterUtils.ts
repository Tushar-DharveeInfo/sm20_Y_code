import { IOptionItem } from '@n20a/libform';
import { FnParseJsonSafely } from '../../../appcontainer/allcommon/FnParseJsonSafely';
import { FnGetSessionVariableFromStorage } from '../../../shared/allcommon/basic/FnGetSessionVariableFromStorage';
import { FnHandleAPIResponse } from '../../../shared/allcommon/basic/FnHandleAPIResponse';
import {
    formatFilterLogDate,
    getFilterLogDefaultEndDate,
    getFilterLogDefaultStartDate,
    resolveFilterLogDateRange,
} from '../../../shared/allcommon/basic/FnFilterLogDates';
import { DisplayControlEnums } from '../../../shared/alldefaultprops/basic/DefaultPropsFormContainer';
import { IControl } from '../../../shared/allinterface/settingsform/ISettingsLibForm';
import { ISession } from '../../../shared/context/allinterface/ISession';
import { IAppqaAlertFilterValues, IAppqaAlertRawRecord } from '../alerts/IAlerts';
import { FnGetAppDateFormat } from '../../../shared/allcommon/basic/FnGetAppDateFormat';
import { FnConvertDateToUtcOrUtcToDate } from '../../../appcontainer/allcommon/FnConvertDateToUtcOrUtcToDate';
import { filterEnabledUsers } from '../../../shared/allcommon/basic/FnIsAuthorizedUser';

/* Formats a date for alert filter StartDate / EndDate — same rules as ForensicLog. */
export const formatAppqaAlertFilterDate = (dateValue: unknown): string =>
    formatFilterLogDate(dateValue);

export const getDefaultAppqaAlertStartDate = (): string => getFilterLogDefaultStartDate();

export const getDefaultAppqaAlertEndDate = (): string => getFilterLogDefaultEndDate();

type IDateRangeField = { startDate?: unknown; endDate?: unknown };

const isDateRangeField = (value: unknown): value is IDateRangeField =>
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && ('startDate' in value || 'endDate' in value);

/* Maps dateRange control value or flat StartDate / EndDate into filter fields. */
export const areAppqaAlertFilterValuesEqual = (
    left: IAppqaAlertFilterValues,
    right: IAppqaAlertFilterValues
): boolean =>
    left.TenantName === right.TenantName
    && left.AssignedTo === right.AssignedTo
    && left.Severity === right.Severity
    && left.Status === right.Status
    && formatAppqaAlertFilterDate(left.StartDate) === formatAppqaAlertFilterDate(right.StartDate)
    && formatAppqaAlertFilterDate(left.EndDate) === formatAppqaAlertFilterDate(right.EndDate)
    && left.Keywords === right.Keywords
    && left.AndOR === right.AndOR;

export const resolveAppqaAlertDateFilterValues = (
    value: unknown,
    name: string | undefined,
    previous: Pick<IAppqaAlertFilterValues, 'StartDate' | 'EndDate'>
): Pick<IAppqaAlertFilterValues, 'StartDate' | 'EndDate'> => {
    if (name === 'dateRange' && isDateRangeField(value)) {
        return {
            StartDate: formatAppqaAlertFilterDate(value.startDate) || previous.StartDate,
            EndDate: formatAppqaAlertFilterDate(value.endDate) || previous.EndDate,
        };
    }

    if (name === 'StartDate') {
        return {
            ...previous,
            StartDate: formatAppqaAlertFilterDate(value),
        };
    }

    if (name === 'EndDate') {
        return {
            ...previous,
            EndDate: formatAppqaAlertFilterDate(value),
        };
    }

    return previous;
};

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeCompare = (value: unknown): string => normalizeText(value).toLowerCase();

export const getSessionLoginUserName = (sessionList: ISession[]): string => {
    const userDetails = FnGetSessionVariableFromStorage(
        'RequestedBy',
        'LoginShortName',
        sessionList
    );
    return userDetails?.[0]?.SessionValue?.trim() ?? '';
};

// Resolves current session user to AssignedTo dropdown UserName value.
export const getSessionUserNameForAssignedTo = (sessionList: ISession[]): string => {
    const sessionUserName = FnGetSessionVariableFromStorage(
        'RequestedBy',
        'LoginShortName',
        sessionList
    )?.[0]?.SessionValue?.trim();

    if (sessionUserName) {
        return sessionUserName;
    }

    const loginUser = getSessionLoginUserName(sessionList);
    if (!loginUser) {
        return '';
    }

    const strippedLoginUser = loginUser.replace(/^.*\\/, '').trim();
    return strippedLoginUser || loginUser;
};

export const toLibFormOptions = (values: string[]): IOptionItem[] =>
    values.map((value) => ({
        label: value,
        value,
    }));

const isUserRecord = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const record = value as Record<string, unknown>;
    return Boolean(record._User || record.LoginUser || record.UserName);
};

const looksLikeJsonString = (value: string): boolean => {
    const trimmed = value.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
};

const findUsersInPayload = (value: unknown): Record<string, unknown>[] => {
    let parsedValue: unknown = value;
    if (typeof value === 'string') {
        if (!looksLikeJsonString(value)) {
            return [];
        }
        parsedValue = FnParseJsonSafely(value);
    }

    if (Array.isArray(parsedValue)) {
        if (parsedValue.some(isUserRecord)) {
            return parsedValue.filter(isUserRecord);
        }
        for (const item of parsedValue) {
            const childUsers = findUsersInPayload(item);
            if (childUsers.length) {
                return childUsers;
            }
        }
    }

    if (parsedValue && typeof parsedValue === 'object') {
        for (const key of Object.keys(parsedValue as Record<string, unknown>)) {
            const childUsers = findUsersInPayload(
                (parsedValue as Record<string, unknown>)[key]
            );
            if (childUsers.length) {
                return childUsers;
            }
        }
    }

    return [];
};

const extractUserName = (user: Record<string, unknown>): string => {
    for (const key of ['UserName']) {
        const userName = normalizeText(user[key]);
        if (userName) {
            return userName;
        }
    }
    return '';
};

export const parseAssignToUserNames = (response: unknown): string[] => {
    if (!response || typeof response !== 'object') {
        return [];
    }

    const usersJson = 'usersJson' in response
        ? (response as { usersJson: unknown }).usersJson
        : response;

    let userData = findUsersInPayload(usersJson);
    if (!userData.length) {
        const extracted = FnHandleAPIResponse(usersJson, 'Users');
        userData = Array.isArray(extracted)
            ? extracted.filter(isUserRecord)
            : [];
    }

    userData = filterEnabledUsers(userData);

    const users: string[] = [];
    for (const element of userData) {
        const userName = extractUserName(element);
        if (userName) {
            users.push(userName);
        }
    }

    return users.sort((a, b) => (a.trim() ?? "").localeCompare(
        b.trim() ?? "",
        undefined,
        { sensitivity: "base" }
    ));
};

export const resolveAssignedToFromSession = (
    options: string[],
    sessionUserName: string
): string => {
    const normalizedSessionUser = normalizeCompare(
        sessionUserName.replace(/^.*\\/, '').trim() || sessionUserName
    );

    if (!options.length) {
        return sessionUserName;
    }

    if (!normalizedSessionUser) {
        return options[0];
    }

    const matched = options.find(
        (option) => normalizeCompare(option) === normalizedSessionUser
    );
    return matched ?? sessionUserName;
};

const toApiSeverityFilter = (value: string): string => {
    const normalized = normalizeCompare(value);
    if (!normalized || normalized === 'all') {
        return '';
    }
    return normalizeText(value);
};

const toApiStatusFilter = (value: string): string => {
    const normalized = normalizeCompare(value);
    if (!normalized || normalized === 'all') {
        return '';
    }
    if (normalized === 'open') {
        return 'Open';
    }
    if (normalized === 'close' || normalized === 'closed') {
        return 'Close';
    }
    return normalizeText(value);
};

export const toApiAndOrFilter = (value: unknown): string => {
    const normalized = normalizeCompare(value);
    if (normalized === 'or') {
        return 'OR';
    }
    return 'And';
};

const toApiAssignedToFilter = (value: string): string => {
    const normalized = normalizeText(value);
    if (!normalized || normalizeCompare(normalized) === 'all') {
        return '';
    }
    return normalized;
};

const toApiOptionalNameFilter = (value: unknown): string => {
    const normalized = normalizeText(value);
    if (!normalized || normalizeCompare(normalized) === 'all') {
        return '';
    }
    return normalized;
};

/* API filterJsonString payload for `/alert/get_filtered_logs`. */
export const buildAppqaAlertFilterPayload = (
    filters: IAppqaAlertFilterValues
): Record<string, string> => {
    const { StartDate, EndDate } = resolveFilterLogDateRange(filters.StartDate, filters.EndDate);

    return {
        StartDate,
        EndDate,
        AssignedTo: toApiAssignedToFilter(filters.AssignedTo),
        AndOR: toApiAndOrFilter(filters.AndOR),
        Keywords: normalizeText(filters.Keywords),
        SiteName: toApiOptionalNameFilter(filters.SiteName),
        tenantName: toApiOptionalNameFilter(filters.TenantName),
        Severity: toApiSeverityFilter(filters.Severity),
        Status: toApiStatusFilter(filters.Status),
    };
};
const formatDate = (dateValue: unknown): string => {
    /*Format year/month/day using app date format without UTC timezone shift. */
    const padDatePart = (value: number) => value.toString().padStart(2, '0');

    const formatLocalCalendarDate = (year: number, month: number, day: number): string => {
        const format = FnGetAppDateFormat();
        if (format === 'MM/dd/yyyy') {
            return `${padDatePart(month)}/${padDatePart(day)}/${year}`;
        }
        return `${padDatePart(day)}/${padDatePart(month)}/${year}`;
    };
    if (dateValue == null || dateValue === '') {
        return '';
    }

    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
        return formatLocalCalendarDate(
            dateValue.getFullYear(),
            dateValue.getMonth() + 1,
            dateValue.getDate()
        );
    }

    const dateText = String(dateValue).trim();
    if (!dateText) {
        return '';
    }

    // Date picker value (e.g. 04/05/2026) — do not run through UTC conversion.
    const slashParts = dateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashParts) {
        const first = Number(slashParts[1]);
        const second = Number(slashParts[2]);
        const year = Number(slashParts[3]);
        const format = FnGetAppDateFormat();
        if (format === 'MM/dd/yyyy') {
            return formatLocalCalendarDate(year, first, second);
        }
        return formatLocalCalendarDate(year, second, first);
    }

    // ISO date only (YYYY-MM-DD) — use date parts as-is, not UTC midnight.
    const isoParts = dateText.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoParts) {
        return formatLocalCalendarDate(
            Number(isoParts[1]),
            Number(isoParts[2]),
            Number(isoParts[3])
        );
    }

    return FnConvertDateToUtcOrUtcToDate(dateText, false, false);
};
export const buildDefaultAppqaAlertFilters = (
    sessionList: ISession[]
): IAppqaAlertFilterValues => {
    const defaultSite = FnGetSessionVariableFromStorage('Location', 'SiteName', sessionList);
    const defaultTenant = FnGetSessionVariableFromStorage('Filter', 'TenantName', sessionList);
    const getDefaultEndDate = (): string => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        return formatDate(tomorrow);
    };
    return {
        SiteName: defaultSite?.[0]?.SessionValue?.trim() ?? '',
        TenantName: defaultTenant?.[0]?.SessionValue?.trim() ?? '',
        AssignedTo: getSessionUserNameForAssignedTo(sessionList),
        Severity: 'Critical',
        Status: 'Open',
        StartDate: formatDate(new Date()),
        EndDate: getDefaultEndDate(),
        Keywords: '',
        AndOR: 'And',
    };
};

export const ASSIGNED_TO_ALL_OPTION: IOptionItem = { label: 'All', value: 'All' };

/* Combo display value — SettingsContainer treats empty string as undefined. */
export const toAssignedToDisplayValue = (value: string): string => {
    const normalized = normalizeText(value);
    if (!normalized || normalizeCompare(normalized) === 'all') {
        return 'All';
    }
    return normalized;
};

/* Filter / libalerts value — empty string means no AssignedTo filter. */
export const toAssignedToFilterValue = (value: string): string => {
    const normalized = normalizeText(value);
    if (!normalized || normalizeCompare(normalized) === 'all') {
        return '';
    }
    return normalized;
};

export const toLibAlertsSeverityFilter = (value: string): string => {
    const normalized = normalizeText(value);
    if (!normalized || normalizeCompare(normalized) === 'all') {
        return 'All';
    }
    return normalized;
};

export const toLibAlertsStatusFilter = (value: string): string => {
    const normalized = normalizeCompare(value);
    if (!normalized || normalized === 'all') {
        return 'all';
    }
    if (normalized === 'open') {
        return 'open';
    }
    if (normalized === 'close' || normalized === 'closed') {
        return 'closed';
    }
    return 'all';
};

export const buildAppqaAlertLogComponentKey = (
    filters: IAppqaAlertFilterValues
): string => [
    filters.SiteName,
    filters.TenantName,
    filters.AssignedTo,
    filters.Severity,
    filters.Status,
    filters.StartDate,
    filters.EndDate,
].join('|');

export const SEVERITY_OPTIONS: IOptionItem[] = [
    { label: 'All', value: 'All' },
    { label: 'Critical', value: 'Critical' },
    { label: 'Warning', value: 'Warning' },
    { label: 'Normal', value: 'Normal' },
];

export const STATUS_OPTIONS: IOptionItem[] = [
    { label: 'All', value: 'All' },
    { label: 'Open', value: 'Open' },
    { label: 'Close', value: 'Close' },
];

const createAppqaAlertComboControl = (
    name: string,
    label: string,
    sortOrder: number,
    options: IOptionItem[],
    value: string
): IControl => ({
    CanChange: 1,
    IsRequired: 0,
    GroupName: 'APForm_AppqaAlertFilter',
    GroupNameDesc: '',
    SubGroupEntID: '',
    SubGroupName: 'FormControl',
    SubGroupNameDesc: '',
    _AP: name,
    PropertyLabel: label,
    NameDesc: label,
    DefaultAPValue: value,
    Value: value,
    ValueDesc: '',
    SortOrder: sortOrder,
    MaxInstances: 0,
    InputMask: '',
    RegEx: '',
    DisplayGroupControl: 'Default',
    DisplayControl: DisplayControlEnums.ComboBoxControl,
    ChangeEvent: '',
    Secured: false,
    IsNZ: true,
    EntID: '',
    RecID: '',
    LastUpdated: '',
    EntityName: 'AP',
    Name: name,
    disabled: false,
    Options: options,
});

const createAppqaAlertDateControl = (
    name: 'StartDate' | 'EndDate',
    label: string,
    sortOrder: number,
    value: string
): IControl => ({
    CanChange: 1,
    IsRequired: 0,
    GroupName: 'APForm_AppqaAlertFilter',
    GroupNameDesc: '',
    SubGroupEntID: '',
    SubGroupName: 'FormControl',
    SubGroupNameDesc: '',
    _AP: name,
    PropertyLabel: label,
    NameDesc: label,
    DefaultAPValue: value,
    Value: value,
    ValueDesc: '',
    SortOrder: sortOrder,
    MaxInstances: 0,
    InputMask: '',
    RegEx: '',
    DisplayGroupControl: 'Default',
    DisplayControl: DisplayControlEnums.DateControl,
    ChangeEvent: '',
    Secured: false,
    IsNZ: true,
    EntID: '',
    RecID: '',
    LastUpdated: '',
    EntityName: 'AP',
    Name: name,
    disabled: false,
});

export const mergeAssignToUserOptions = (
    controls: IControl[],
    assignToUserNames: string[],
    assignedToValue = ''
): IControl[] =>
    controls.map((control) =>
        control.Name === 'AssignedTo'
            ? {
                ...control,
                Options: [
                    ASSIGNED_TO_ALL_OPTION,
                    ...toLibFormOptions(assignToUserNames),
                ],
                Value: toAssignedToDisplayValue(assignedToValue || String(control.Value ?? '')),
                DefaultAPValue: toAssignedToDisplayValue(assignedToValue || String(control.DefaultAPValue ?? '')),
            }
            : control
    );

export const buildAppqaAlertFilterComboControls = (
    assignToUserNames: string[],
    filterValues: IAppqaAlertFilterValues
): IControl[] => {
    const assignedToOptions: IOptionItem[] = [
        ASSIGNED_TO_ALL_OPTION,
        ...toLibFormOptions(assignToUserNames),
    ];

    return [
        createAppqaAlertComboControl(
            'AssignedTo',
            'AssignedTo',
            1,
            assignedToOptions,
            toAssignedToDisplayValue(filterValues.AssignedTo ?? '')
        ),
        createAppqaAlertComboControl(
            'AlertSeverity',
            'Severity',
            2,
            SEVERITY_OPTIONS,
            filterValues.Severity || 'All'
        ),
        createAppqaAlertComboControl(
            'Status',
            'Status',
            3,
            STATUS_OPTIONS,
            filterValues.Status || 'All'
        ),
        createAppqaAlertDateControl(
            'StartDate',
            'Start Date',
            4,
            filterValues.StartDate || getDefaultAppqaAlertStartDate()
        ),
        createAppqaAlertDateControl(
            'EndDate',
            'End Date',
            5,
            filterValues.EndDate || getDefaultAppqaAlertEndDate()
        ),
    ];
};

const parseFilterCalendarDay = (value: unknown): number | null => {
    const text = normalizeText(value);
    if (!text) {
        return null;
    }

    const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slash) {
        const first = Number(slash[1]);
        const second = Number(slash[2]);
        const year = Number(slash[3]);
        if (first > 12) {
            return Date.UTC(year, second - 1, first);
        }
        return Date.UTC(year, first - 1, second);
    }

    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
        return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const matchesKeywords = (
    record: IAppqaAlertRawRecord,
    keywords: string,
    andOr: string
): boolean => {
    const terms = keywords
        .split(/\s+/)
        .map((term) => term.trim().toLowerCase())
        .filter(Boolean);
    if (!terms.length) {
        return true;
    }

    const haystack = [
        record.HTML,
        record.AlertProfileName,
        record.EntityName,
        record.AssignedTo,
        record.AlertQueueName,
        record.testName,
        record.TenantName,
    ]
        .join(" ")
        .toLowerCase();

    const isOr = normalizeCompare(andOr) === "or";
    return isOr
        ? terms.some((term) => haystack.includes(term))
        : terms.every((term) => haystack.includes(term));
};

/* Client-side stand-in for ALERT.GetFilteredLogs filterJsonString rules. */
export const filterAppqaAlertRecords = (
    records: IAppqaAlertRawRecord[],
    filters: IAppqaAlertFilterValues
): IAppqaAlertRawRecord[] => {
    const severity = normalizeCompare(filters.Severity);
    const status = normalizeCompare(filters.Status);
    const assignedTo = normalizeCompare(filters.AssignedTo);
    const tenantName = normalizeCompare(filters.TenantName);
    const startDay = parseFilterCalendarDay(filters.StartDate);
    const endDay = parseFilterCalendarDay(filters.EndDate);

    return records.filter((record) => {
        if (severity && severity !== "all") {
            if (normalizeCompare(record.Severity) !== severity) {
                return false;
            }
        }

        if (status && status !== "all") {
            if (status === "open" && record.IsClosed) {
                return false;
            }
            if (
                (status === "close" || status === "closed")
                && !record.IsClosed
            ) {
                return false;
            }
        }

        if (assignedTo && assignedTo !== "all") {
            if (normalizeCompare(record.AssignedTo) !== assignedTo) {
                return false;
            }
        }

        if (tenantName && tenantName !== "all") {
            if (normalizeCompare(record.TenantName) !== tenantName) {
                return false;
            }
        }

        const deliveredDay = parseFilterCalendarDay(record.LastDelivered);
        if (startDay != null && deliveredDay != null && deliveredDay < startDay) {
            return false;
        }
        if (endDay != null && deliveredDay != null && deliveredDay > endDay) {
            return false;
        }

        if (!matchesKeywords(record, filters.Keywords, filters.AndOR)) {
            return false;
        }

        return true;
    });
};
