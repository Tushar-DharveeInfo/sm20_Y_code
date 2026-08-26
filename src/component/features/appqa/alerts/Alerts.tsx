import { useCallback, useEffect, useRef, useState } from "react";
import { handleNestedZoneContainerKeyDown } from "../../../shared/allcommon/basic/FnHandleContainerKeyDown";
import { ICascadeFilterContext } from "../../../shared/searchfilter/searchcontrolwithfilter/ISearchControlWithFilter";
import { Alertlog, IAlertLogRecord } from "@n20a/libalerts";
import "@n20a/libalerts/style.css";
import "./AppqaAlerts.css";
import { useSessionContext } from "../../../shared/context/hooks/SessionHooks";
import { IAppqaAlerts } from "./IAlerts";
import { Label } from "../../../shared/basic/label/Label";
import { SearchControlWithFilter } from "../../../shared/searchfilter/searchcontrolwithfilter/SearchControlWithFilter";
import { AppqaAlertFilterForm } from "./AlertFilterForm";
import { IAppqaAlertFilterValues, type IAppqaAlertRawRecord } from "./IAlerts";
import {
    buildDefaultAppqaAlertFilters,
    filterAppqaAlertRecords,
    toApiAndOrFilter,
} from "../allcommon/FnAppqaAlertFilterUtils";
import sampleAppqaAlertRawRecords from "../../../../smsampledata/appqa/AlertsSampleData.json";

const getValidHtml = (value: unknown): string => {
    try {
        if (typeof value !== "string" || !value.trim()) {
            return "";
        }

        return value
            .replace(/\\{1,}\/+/g, "/")
            .replace(/\\"/g, '"')
            .trim();
    } catch (error) {
        console.error("getValidHtml error:", error);
        return "";
    }
};

const mapToAlertLogRecord = (data: Record<string, unknown>): IAlertLogRecord => {
    return {
        AlertSeverity: data.Severity as IAlertLogRecord["AlertSeverity"],
        IsClosed: Boolean(data.IsClosed),
        _AlertQueue: String(data.AlertQueueName ?? ""),
        AssignedTo: String(data.AssignedTo ?? ""),
        AttemptCount: Number(data.AttemptCount ?? 0),
        LastDelivered: String(data.LastDelivered ?? ""),
        AlertProfileName: String(data.AlertProfileName ?? ""),
        HTML: typeof data.HTML === "string" ? getValidHtml(data.HTML) : "",
        EntityName: String(data.EntityName ?? ""),
        EntId: String(data.EntID ?? ""),
        AlertEntityName: String(data.AlertEntityName ?? ""),
        AlertEntID: String(data.AlertEntID ?? ""),
        FileUID: data.FileUID != null ? String(data.FileUID) : undefined,
        FileType: data.FileType != null ? String(data.FileType) : undefined,
        UsersToNotifyJson:
            data.UsersToNotifyJson != null
                ? String(data.UsersToNotifyJson)
                : undefined,
        AlertID: "",
    };
};

const emptyFilterValues: IAppqaAlertFilterValues = {
    SiteName: "",
    TenantName: "",
    AssignedTo: "",
    Severity: "All",
    Status: "All",
    StartDate: "",
    EndDate: "",
    Keywords: "",
    AndOR: "And",
};

const AppqaAlerts = (appqaAlertsProps: IAppqaAlerts) => {
    const [alertRecords, setAlertRecords] = useState<IAlertLogRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterOpen, setFilterOpen] = useState(false);
    const [appliedFilterValues, setAppliedFilterValues] =
        useState<IAppqaAlertFilterValues>(emptyFilterValues);
    const [hasUserAppliedFilter, setHasUserAppliedFilter] = useState(false);
    const [filterFormKey, setFilterFormKey] = useState(0);
    const sessionContext = useSessionContext();
    const sessionListRef = useRef(sessionContext.SessionList);
    const handleShowUserMessageRef = useRef(appqaAlertsProps.handleShowUserMessage);
    const initialFetchStartedRef = useRef(false);
    const hasUserAppliedFilterRef = useRef(false);
    const appliedFilterValuesRef = useRef(appliedFilterValues);
    const filterValuesRef = useRef<IAppqaAlertFilterValues>(emptyFilterValues);
    const allSampleRecordsRef = useRef<IAppqaAlertRawRecord[]>([
        ...(sampleAppqaAlertRawRecords as IAppqaAlertRawRecord[]),
    ]);

    appliedFilterValuesRef.current = appliedFilterValues;
    sessionListRef.current = sessionContext.SessionList;
    handleShowUserMessageRef.current = appqaAlertsProps.handleShowUserMessage;

    const applyAlertDataset = useCallback((parsed: IAppqaAlertRawRecord[]) => {
        setAlertRecords(
            parsed.map((item) => mapToAlertLogRecord(item as any))
        );
    }, []);

    const fetchFilteredAlerts = useCallback(
        (
            filters: IAppqaAlertFilterValues,
            options?: { onComplete?: () => void }
        ) => {
            // SAMPLE DATA: ALERT.GetFilteredLogs API commented out.
            // axiosInterceptor({ url: ALERT.GetFilteredLogs, data: { sessionId, filterJsonString, ... } });
            try {
                const filtered = filterAppqaAlertRecords(
                    allSampleRecordsRef.current,
                    filters
                );
                applyAlertDataset(filtered);
            } catch (error) {
                console.error(
                    "AppqaAlerts: failed to process filtered alert response",
                    error
                );
                handleShowUserMessageRef.current?.("Invalid data to show");
                applyAlertDataset([]);
            } finally {
                setLoading(false);
                options?.onComplete?.();
            }
        },
        [applyAlertDataset]
    );

    const fetchFilteredAlertsRef = useRef(fetchFilteredAlerts);
    fetchFilteredAlertsRef.current = fetchFilteredAlerts;

    useEffect(() => {
        if (initialFetchStartedRef.current) {
            return;
        }
        initialFetchStartedRef.current = true;
        const defaults = buildDefaultAppqaAlertFilters(sessionListRef.current);
        filterValuesRef.current = defaults;
        setAppliedFilterValues(defaults);
        setLoading(true);
        fetchFilteredAlertsRef.current(defaults);
    }, []);

    const handleFilterFormClick = useCallback(() => {
        setFilterOpen((previous) => {
            const opening = !previous;
            if (opening) {
                if (hasUserAppliedFilterRef.current) {
                    filterValuesRef.current = { ...appliedFilterValuesRef.current };
                }
                setFilterFormKey((key) => key + 1);
            }
            return opening;
        });
    }, []);

    const handleFilterChange = useCallback(
        (
            values: IAppqaAlertFilterValues,
            options?: { isDefault?: boolean }
        ) => {
            if (options?.isDefault && hasUserAppliedFilterRef.current) {
                return;
            }
            filterValuesRef.current = values;

            if (options?.isDefault && !hasUserAppliedFilterRef.current) {
                setAppliedFilterValues(values);
                fetchFilteredAlertsRef.current(values);
            }
        },
        []
    );

    const applyAlertFilters = useCallback(
        (appliedFilters: IAppqaAlertFilterValues) => {
            filterValuesRef.current = appliedFilters;
            setAppliedFilterValues(appliedFilters);
            hasUserAppliedFilterRef.current = true;
            setHasUserAppliedFilter(true);
            fetchFilteredAlertsRef.current(appliedFilters);
        },
        []
    );

    const handleFilterFormData = useCallback(
        (_data: Record<string, unknown>) => {
            const appliedFilters: IAppqaAlertFilterValues = {
                ...filterValuesRef.current,
                Keywords: appliedFilterValuesRef.current.Keywords ?? "",
                AndOR: appliedFilterValuesRef.current.AndOR ?? "And",
            };
            setFilterOpen(false);
            applyAlertFilters(appliedFilters);
        },
        [applyAlertFilters]
    );

    const handleLensFormData = useCallback(
        (data: Record<string, unknown>) => {
            const appliedFilters: IAppqaAlertFilterValues = {
                ...appliedFilterValuesRef.current,
                Keywords: String(data.Keywords ?? "").trim(),
                AndOR: toApiAndOrFilter(data.AndOR ?? data.ANDOR),
            };
            applyAlertFilters(appliedFilters);
        },
        [applyAlertFilters]
    );

    const handleOnRefreshStatus = useCallback(async (): Promise<void> => {
        fetchFilteredAlertsRef.current(appliedFilterValuesRef.current);
    }, []);

    const renderAppqaAlertFilterForm = useCallback(
        (context: ICascadeFilterContext) => (
            <AppqaAlertFilterForm
                key={filterFormKey}
                uniqueName={context.uniqueName}
                loginType={context.loginType}
                profileSiteName={context.profileSiteName}
                hasUserAppliedFilter={hasUserAppliedFilter}
                initialFilterValues={
                    hasUserAppliedFilter
                        ? appliedFilterValues
                        : filterValuesRef.current
                }
                onCascadeValuesChange={context.onValuesChange}
                onFilterChange={handleFilterChange}
            />
        ),
        [
            appliedFilterValues,
            filterFormKey,
            hasUserAppliedFilter,
            handleFilterChange,
        ]
    );

    const handleAssignToMe = async (
        _entityName: string,
        entId: string,
        _code: string
    ): Promise<void> => {
        const loginuser = sessionContext.SessionList.find(
            (item) => item.VariableName === "LoginShortName"
        );

        const alertToUpdate = allSampleRecordsRef.current.find(
            (item) => item.EntID === entId
        );
        if (alertToUpdate && loginuser?.SessionValue) {
            // SAMPLE DATA: EM.AddUpdateTableRecord API commented out.
            // axiosInterceptor({ url: EM.AddUpdateTableRecord, ... });
            alertToUpdate.AssignedTo = loginuser.SessionValue;
            appqaAlertsProps.handleShowUserMessage?.(
                "Alert is assigned to: " + alertToUpdate.AssignedTo
            );
            fetchFilteredAlertsRef.current(appliedFilterValuesRef.current);
        } else {
            appqaAlertsProps.handleShowUserMessage?.(
                "Something went wrong while assign alert"
            );
        }
    };

    const handleStatusChange = async (
        _entityName: string,
        entId: string,
        code: string
    ): Promise<void> => {
        const alertToUpdate = allSampleRecordsRef.current.find(
            (item) => item.EntID === entId
        );
        if (alertToUpdate) {
            // SAMPLE DATA: EM.AddUpdateTableRecord API commented out.
            // axiosInterceptor({ url: EM.AddUpdateTableRecord, ... });
            if (code?.toLowerCase() === "close") {
                alertToUpdate.IsClosed = true;
            } else {
                alertToUpdate.IsClosed = false;
            }
            appqaAlertsProps.handleShowUserMessage?.(
                "Status of alert: "
                + alertToUpdate.AlertProfileName
                + " is changed with: "
                + (code ?? "close")
            );
            handleOnRefreshStatus();
        } else {
            appqaAlertsProps.handleShowUserMessage?.(
                "Something went wrong while change status of alert"
            );
        }
    };

    if (loading) {
        return (
            <div className="nz-wh-100 nz-d-flex-hv-left">Loading alert logs...</div>
        );
    }

    return (
        <div
            className="nz-appqa-alerts-container"
            tabIndex={1}
            onKeyDown={handleNestedZoneContainerKeyDown}
            key={appqaAlertsProps.uniqueName}
        >
            <div className="nz-sub-header">
                <Label
                    uniqueName={`${appqaAlertsProps.uniqueName}-task-header`}
                    label={`${appqaAlertsProps.headerText}`}
                />
            </div>
            <div
                className={`nz-appqa-alerts-search-control ${filterOpen ? "nz-appqa-alerts-search-control-open" : ""
                    }`}
            >
                <SearchControlWithFilter
                    uniqueName={`${appqaAlertsProps.uniqueName}-alert-filter`}
                    controls={[]}
                    filterIconTooltip="Filter"
                    fromProfileString={JSON.stringify(appliedFilterValues)}
                    allowSiteUserCascade
                    loginType="user"
                    cascadeControlNames={["sitename", "tenantname", "assignedto"]}
                    renderCascadeFilter={renderAppqaAlertFilterForm}
                    handleFilterFormData={handleFilterFormData}
                    handleLensFormData={handleLensFormData}
                    handleFilterFormClick={handleFilterFormClick}
                    searchProps={{
                        uniqueName: `${appqaAlertsProps.uniqueName}-alert-search`,
                        isShowFilterControl: true,
                        hideRightMouseMenu: false,
                        lensDirty: false,
                        filterDirty: false,
                        searchInputValue: "",
                        hideSearchControl: false,
                        searchValueChange: () => undefined,
                        handleFilterMouse: () => undefined,
                        handleLensMouse: () => undefined,
                    }}
                />
            </div>
            <div
                className="nz-appqa-alerts-body"
                style={{ display: filterOpen ? "none" : "block" }}
            >
                <Alertlog
                    alertRecords={alertRecords}
                    onRefreshStatus={handleOnRefreshStatus}
                    onAssignToMe={handleAssignToMe}
                    onStatusChange={handleStatusChange}
                />
            </div>
        </div>
    );
};

export default AppqaAlerts;
