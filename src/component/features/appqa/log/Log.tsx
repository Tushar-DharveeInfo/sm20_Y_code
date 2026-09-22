import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { AgGridReact } from 'ag-grid-react'
import type { ICellRendererParams } from 'ag-grid-community'
import { Filter24x24 } from '@n20a/libicon'
import { useFirestore } from '@n20a/libfsdb'
import { Label } from '../../../shared/basic/label/Label'
import { ActionImage } from '../../../shared/basic/actionimage/ActionImage'
import { BasicGrid } from '../../../shared/tablegrid/BasicGrid'
import type { IBasicGridColDef } from '../../../shared/allinterface/tablegrid/IBasicGrid'
import type { ITreeNode } from '../../../shared/allinterface/tree/ITreeControl'
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks'
import { FnConvertDateToUtcOrUtcToDate } from '../../../appcontainer/allcommon/FnConvertDateToUtcOrUtcToDate'
import { FnGetCssVariable } from '../../../shared/allcommon/FnGetCssVariable'
import { PopupFilterForm } from '../../../shared/searchfilter/popupfilterform/PopupFilterForm'
import { YesNoFormContainer } from '../../../shared/basic/yesnoformcontainer/YesNoFormContainer'
import type { IControl } from '../../../shared/settingsform/settingslibform/SettingsLibForm'
import './Log.css'

interface ILog {
    uniqueName: string; // uniqueName for the control and required
    featureId: string; // feature id
    headerText?: string; // header text coming from the selected menu item
    allowSort?: boolean; // allow grid column sort, defaults to true
    selectedNode?: ITreeNode; // selected node data
    handleShowUserMessage?: (messageText: string) => void;
}

function formatActivityDate(value: unknown): string {
    if (value == null || value === '') {
        return '';
    }
    if (typeof value === 'string') {
        return FnConvertDateToUtcOrUtcToDate(value, false, true) || value;
    }
    if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate().toLocaleString();
    }
    if (typeof value === 'object' && 'seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
        return new Date((value as { seconds: number }).seconds * 1000).toLocaleString();
    }
    return String(value);
}

function parseActivityDate(value: unknown, row?: Record<string, unknown>): number {
    if (value != null && value !== '') {
        if (typeof value === 'number') {
            return value;
        }
        if (value instanceof Date) {
            return value.getTime();
        }
        if (typeof value === 'object') {
            if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
                return (value as { toDate: () => Date }).toDate().getTime();
            }
            if ('seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
                return (value as { seconds: number }).seconds * 1000;
            }
        }
        if (typeof value === 'string') {
            const parsed = Date.parse(value);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
    }
    // Fallback: extract timestamp if activityid ends with numeric timestamp (e.g. activity_cid_1788857795000)
    if (row && typeof row.activityid === 'string') {
        const match = row.activityid.match(/_(\d{10,13})$/);
        if (match) {
            const ts = Number(match[1]);
            if (!isNaN(ts)) {
                return ts;
            }
        }
    }
    return 0;
}

/**
 * Parse a filter date string to start/end of that calendar day (local time)
 * using the common FnConvertDateToUtcOrUtcToDate function.
 */
function parseFilterDateRange(raw: string): { start: number; end: number } | null {
    if (!raw?.trim()) return null;
    const str = raw.trim();

    try {
        let utcIsoString = '';
        // If input is in ISO format (YYYY-MM-DD), convert to local date format first
        if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
            const localFormatted = FnConvertDateToUtcOrUtcToDate(str, false, false);
            if (localFormatted) {
                utcIsoString = FnConvertDateToUtcOrUtcToDate(localFormatted, true, true);
            }
        } else {
            // Local date input (e.g. 21-09-2026 or 09/21/2026) -> convert using common function
            utcIsoString = FnConvertDateToUtcOrUtcToDate(str, true, true);
        }

        if (utcIsoString) {
            const dateObj = new Date(utcIsoString);
            if (!isNaN(dateObj.getTime())) {
                const year = dateObj.getFullYear();
                const month = dateObj.getMonth();
                const day = dateObj.getDate();
                return {
                    start: new Date(year, month, day, 0, 0, 0, 0).getTime(),
                    end: new Date(year, month, day, 23, 59, 59, 999).getTime(),
                };
            }
        }
    } catch (err) {
        console.error('Error in parseFilterDateRange using FnConvertDateToUtcOrUtcToDate:', err);
    }

    // Direct fallback if conversion did not produce a valid date
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return {
            start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime(),
            end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime(),
        };
    }

    return null;
}

function extractFieldValue(data: Record<string, unknown>, fieldName: string): string {
    if (!data || typeof data !== 'object') return '';

    if (data[fieldName] !== undefined && data[fieldName] !== null && String(data[fieldName]).trim() !== '') {
        return String(data[fieldName]);
    }

    const target = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null || String(value).trim() === '') continue;

        const kLower = key.toLowerCase();
        const cleanK = kLower.replace(/[^a-z0-9]/g, '');

        if (cleanK === target || kLower.endsWith(`_${fieldName.toLowerCase()}`) || kLower.includes(`_${fieldName.toLowerCase()}_`) || kLower.includes(fieldName.toLowerCase())) {
            return String(value);
        }
    }

    return '';
}

const Log = (logProps: ILog) => {
    const headerTitle = logProps.headerText ?? "Log";
    const mainAppContext = useMainAppContext();
    const userInfo = mainAppContext.authSession;

    const nodeType = String(logProps.selectedNode?.NodeType ?? '').trim().toLowerCase();

    // Priority 1: Check selectedNode directly for bid
    const nodeBid = String(
        logProps.selectedNode?.bid
        ?? (nodeType === 'business'
            ? logProps.selectedNode?.NodeEntID ?? logProps.selectedNode?.key
            : logProps.selectedNode?.parentEntID ?? '')
        ?? ''
    ).trim();

    const userBid = String(userInfo?.bid ?? '').trim();

    // If found in selectedNode, do not use bid from userInfo
    const bid = nodeBid || userBid;

    const { queryDocuments } = useFirestore();

    const [activities, setActivities] = useState<Record<string, unknown>[] | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const gridRef = useRef<AgGridReact>(null);

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isFilterIconVisible, setIsFilterIconVisible] = useState(false);
    const [appliedFilter, setAppliedFilter] = useState<{ datecreated?: string; message?: string }>({});
    const [popupMessage, setPopupMessage] = useState<string>('');
    const [isPopupOpen, setIsPopupOpen] = useState<boolean>(false);

    const hasCheckedInitialLoadRef = useRef(false);
    const hasShownOver500PopupRef = useRef(false);
    const latestFilterValuesRef = useRef<Record<string, unknown>>({});

    const triggerOver500Popup = useCallback(() => {
        if (hasShownOver500PopupRef.current) return;
        hasShownOver500PopupRef.current = true;
        const msg = "More than 500 records exist. Please use filter to refine your search.";
        setPopupMessage(msg);
        setIsPopupOpen(true);
    }, []);

    const fetchActivitiesData = useCallback(async () => {
        if (!bid) {
            setActivities([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await queryDocuments({
                pathSegments: ['businesses', bid, 'activities'],
                limit: 501,
            });

            if (res && res.success === false) {
                setError(res.error || res.details || 'Failed to fetch activities');
                setActivities([]);
            } else {
                setActivities(res?.data ?? []);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch activities');
            setActivities([]);
        } finally {
            setLoading(false);
        }
    }, [bid, queryDocuments]);

    useEffect(() => {
        hasCheckedInitialLoadRef.current = false;
        hasShownOver500PopupRef.current = false;
        void fetchActivitiesData();
    }, [bid, fetchActivitiesData]);

    useEffect(() => {
        if (!loading && activities !== null) {
            if (!hasCheckedInitialLoadRef.current) {
                hasCheckedInitialLoadRef.current = true;
                if (activities.length >= 501) {
                    setIsFilterIconVisible(true);
                    triggerOver500Popup();
                } else {
                    setIsFilterIconVisible(false);
                }
            }
        }
    }, [loading, activities, triggerOver500Popup]);

    // Build profileString from appliedFilter so PopupFilterForm pre-populates on reopen.
    const filterProfileString = useMemo(() => {
        const hasFilter = appliedFilter.datecreated || appliedFilter.message;
        if (!hasFilter) return '';
        return JSON.stringify([{
            datecreated: appliedFilter.datecreated ?? '',
            message: appliedFilter.message ?? '',
        }]);
    }, [appliedFilter]);

    const filterFormControls = useMemo<IControl[]>(() => [
        {
            CanChange: 1,
            IsRequired: 0,
            GroupName: 'FilterDetails',
            GroupNameDesc: 'Filter Activities',
            SubGroupEntID: '',
            SubGroupName: 'FormControl',
            SubGroupNameDesc: '',
            _AP: 'datecreated',
            PropertyLabel: 'Date Created',
            NameDesc: 'Filter by date created',
            DefaultAPValue: appliedFilter.datecreated ?? '',
            Value: appliedFilter.datecreated || null,
            ValueDesc: '',
            SortOrder: 1,
            MaxInstances: 0,
            InputMask: null,
            RegEx: null,
            DisplayGroupControl: 'Filter Activities',
            DisplayControl: 'DateControl',
            ChangeEvent: '',
            Secured: false,
            IsNZ: true,
            EntID: 'datecreated',
            RecID: 'datecreated',
            LastUpdated: '',
            EntityName: 'Activity',
            Name: 'datecreated',
            disabled: false,
        },
        {
            CanChange: 1,
            IsRequired: 0,
            GroupName: 'FilterDetails',
            GroupNameDesc: 'Filter Activities',
            SubGroupEntID: '',
            SubGroupName: 'FormControl',
            SubGroupNameDesc: '',
            _AP: 'message',
            PropertyLabel: 'Message',
            NameDesc: 'Filter by message content',
            DefaultAPValue: appliedFilter.message ?? '',
            Value: appliedFilter.message || null,
            ValueDesc: '',
            SortOrder: 2,
            MaxInstances: 0,
            InputMask: null,
            RegEx: null,
            DisplayGroupControl: 'Filter Activities',
            DisplayControl: 'EditTextControl',
            ChangeEvent: '',
            Secured: false,
            IsNZ: true,
            EntID: 'message',
            RecID: 'message',
            LastUpdated: '',
            EntityName: 'Activity',
            Name: 'message',
            disabled: false,
        },
    ], [appliedFilter]);

    const columnDefs = useMemo<IBasicGridColDef[]>(() => [
        {
            headerName: 'Date Created',
            field: 'datecreated',
            width: 180,
            resizable: true,
            sortable: logProps.allowSort ?? true,
            sort: 'desc',
            comparator: (valueA: unknown, valueB: unknown, nodeA, nodeB) => {
                const timeA = parseActivityDate(valueA, nodeA?.data as Record<string, unknown> | undefined);
                const timeB = parseActivityDate(valueB, nodeB?.data as Record<string, unknown> | undefined);
                return timeA - timeB;
            },
            cellRenderer: (params: ICellRendererParams) => (
                <span>{formatActivityDate(params.value)}</span>
            ),
        },
        {
            headerName: 'Message',
            field: 'message',
            flex: 1,
            minWidth: 220,
            resizable: true,
            sortable: logProps.allowSort ?? true,
        },
    ], [logProps.allowSort]);

    const allFilteredRows = useMemo(() => {
        if (!activities?.length) return [];
        let list = [...activities];

        if (appliedFilter.datecreated?.trim()) {
            const filterDateRaw = appliedFilter.datecreated.trim();
            const dateRange = parseFilterDateRange(filterDateRaw);
            const normalizedFilterDate = (/^\d{4}[-/]/.test(filterDateRaw)
                ? FnConvertDateToUtcOrUtcToDate(filterDateRaw, false, false)
                : filterDateRaw
            ).replace(/[-]/g, '/').toLowerCase();

            list = list.filter((row) => {
                // 1. Check timestamp range from parseFilterDateRange
                if (dateRange) {
                    const ts = parseActivityDate(row.datecreated, row as Record<string, unknown>);
                    if (ts >= dateRange.start && ts <= dateRange.end) {
                        return true;
                    }
                }

                // 2. Direct day comparison using FnConvertDateToUtcOrUtcToDate
                if (row.datecreated) {
                    const rowLocalDate = FnConvertDateToUtcOrUtcToDate(
                        String(row.datecreated),
                        false,
                        false
                    ).replace(/[-]/g, '/').toLowerCase();
                    if (rowLocalDate && rowLocalDate === normalizedFilterDate) {
                        return true;
                    }
                }

                // 3. Fallback: formatted display string or raw string includes filter text
                const fmt = formatActivityDate(row.datecreated).toLowerCase();
                const raw = String(row.datecreated || '').toLowerCase();
                return fmt.includes(filterDateRaw.toLowerCase()) || raw.includes(filterDateRaw.toLowerCase());
            });
        }

        if (appliedFilter.message?.trim()) {
            const fMsg = appliedFilter.message.trim().toLowerCase();
            list = list.filter((row) => String(row.message || '').toLowerCase().includes(fMsg));
        }

        return list.sort((a, b) => {
            const tA = parseActivityDate(a?.datecreated, a as Record<string, unknown>);
            const tB = parseActivityDate(b?.datecreated, b as Record<string, unknown>);
            return tB - tA;
        });
    }, [activities, appliedFilter]);

    const rowData = useMemo(() => allFilteredRows.slice(0, 500), [allFilteredRows]);

    const handleDownloadExcel = useCallback(() => {
        const api = gridRef.current?.api;
        const rows: (string | number)[][] = [
            ['Date Created', 'Message']
        ];

        if (api) {
            api.forEachNodeAfterFilterAndSort((node) => {
                if (node.group) return;
                const dateVal = formatActivityDate(node.data?.datecreated);
                const msgVal = node.data?.message != null ? String(node.data.message) : '';
                rows.push([dateVal, msgVal]);
            });
        } else if (rowData.length > 0) {
            rowData.forEach((row) => {
                const dateVal = formatActivityDate(row.datecreated);
                const msgVal = row.message != null ? String(row.message) : '';
                rows.push([dateVal, msgVal]);
            });
        }

        if (rows.length <= 1) {
            return;
        }

        try {
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.aoa_to_sheet(rows);
            worksheet['!cols'] = [{ wch: 25 }, { wch: 80 }];
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Log');

            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            saveAs(blob, 'log.xlsx');
        } catch (error) {
            console.error('Log: failed to export Excel', error);
            logProps.handleShowUserMessage?.('Unable to export log. Please try again.');
        }
    }, [rowData, logProps]);

    const handleApplyFilter = useCallback((_filterDataJson: string, parsedData: Record<string, unknown>) => {
        // Merge parsedData with the real-time tracked values from latestFilterValuesRef.
        const merged = { ...latestFilterValuesRef.current, ...parsedData };

        const datecreated = extractFieldValue(merged, 'datecreated').trim();
        const message = extractFieldValue(merged, 'message').trim();

        setAppliedFilter({ datecreated, message });
        setIsFilterOpen(false);

        let list = activities ? [...activities] : [];
        if (datecreated) {
            const dateRange = parseFilterDateRange(datecreated);
            const normalizedFilterDate = (/^\d{4}[-/]/.test(datecreated)
                ? FnConvertDateToUtcOrUtcToDate(datecreated, false, false)
                : datecreated
            ).replace(/[-]/g, '/').toLowerCase();

            list = list.filter((row) => {
                if (dateRange) {
                    const ts = parseActivityDate(row.datecreated, row as Record<string, unknown>);
                    if (ts >= dateRange.start && ts <= dateRange.end) {
                        return true;
                    }
                }
                if (row.datecreated) {
                    const rowLocalDate = FnConvertDateToUtcOrUtcToDate(
                        String(row.datecreated),
                        false,
                        false
                    ).replace(/[-]/g, '/').toLowerCase();
                    if (rowLocalDate && rowLocalDate === normalizedFilterDate) {
                        return true;
                    }
                }
                const fmt = formatActivityDate(row.datecreated).toLowerCase();
                return fmt.includes(datecreated.toLowerCase()) || String(row.datecreated || '').toLowerCase().includes(datecreated.toLowerCase());
            });
        }
        if (message) {
            list = list.filter((row) => String(row.message || '').toLowerCase().includes(message.toLowerCase()));
        }
        if (list.length >= 501) {
            triggerOver500Popup();
        }
    }, [activities, triggerOver500Popup]);

    const showGrid = !loading && !error && rowData.length > 0;

    return (
        <div key={logProps.uniqueName} className='nz-appqa-log-container nz-wh-100'>
            <div className='nz-sub-header'>
                <div className='nz-d-flex-row nz-align-center'>
                    <Label
                        uniqueName={`${logProps.uniqueName}-header`}
                        label={headerTitle}
                        fontWeight='600'
                    />
                </div>
            </div>
            <div className='nz-appqa-log-content'>
                <div className='nz-appqa-log-grid'>
                    <div className="nz-filter-log">
                        {isFilterIconVisible && (
                            <ActionImage
                                uniqueName={`${logProps.uniqueName}-filter-ai`}
                                image={{
                                    uniqueName: `${logProps.uniqueName}-filter-image`,
                                    source: (
                                        <Filter24x24
                                            size={FnGetCssVariable('--image-size-2')}
                                            fill="none"
                                            strokeWidth={1}
                                        />
                                    ),
                                    w: 'var(--image-size-2)',
                                    tooltip: 'Filter Activities',
                                    type: 'svg',
                                }}
                                w={'var(--node_height)'}
                                h={'var(--node_height)'}
                                actionCode="filter"
                                handleMouse={() => setIsFilterOpen(true)}
                            />
                        )}
                    </div>
                    {loading ? (
                        <div className='nz-appqa-log-status'>Loading...</div>
                    ) : error ? (
                        <div className='nz-appqa-log-status'>{error}</div>
                    ) : showGrid ? (
                        <BasicGrid
                            gridRef={gridRef}
                            showGrid={true}
                            uniqueName={`${logProps.uniqueName}-grid`}
                            allowAutoSizeColumn={false}
                            containerName='nz_appqa_log'
                            instanceName='nz_appqa_log'
                            featureId={logProps.featureId}
                            allowColumnResize={true}
                            isExportOnCopy={true}
                            handleDownloadData={handleDownloadExcel}
                            exportFileName='log'
                            rowData={rowData}
                            isReadOnly={true}
                            allowColumnFilter={true}
                            columnDefs={columnDefs}
                            allowPagination={true}
                            paginationAutoPageSize={true}
                            allowSort={logProps.allowSort ?? true}
                            totalRecords={rowData.length}
                            featureData={undefined}
                        />
                    ) : (
                        <div className='nz-appqa-log-status'>Activity log details not found.</div>
                    )}
                </div>
            </div>

            {/* Conditionally render PopupFilterForm so it unmounts/remounts on each open */}
            {isFilterOpen && (() => {
                latestFilterValuesRef.current = {
                    datecreated: appliedFilter.datecreated ?? '',
                    message: appliedFilter.message ?? '',
                };
                return (
                    <PopupFilterForm
                        uniqueName={`${logProps.uniqueName}-popup-filter`}
                        isOpen={isFilterOpen}
                        headerText="Filter Activities"
                        controls={filterFormControls}
                        profileString={filterProfileString}
                        isFilterChange={Boolean(appliedFilter.datecreated || appliedFilter.message)}
                        onApplyFilter={handleApplyFilter}
                        onFilterChange={(values) => {
                            const dateVal = extractFieldValue(values, 'datecreated');
                            const msgVal = extractFieldValue(values, 'message');
                            latestFilterValuesRef.current = {
                                ...latestFilterValuesRef.current,
                                ...values,
                                ...(dateVal ? { datecreated: dateVal } : {}),
                                ...(msgVal ? { message: msgVal } : {}),
                            };
                        }}
                        onClose={() => setIsFilterOpen(false)}
                    />
                );
            })()}

            <YesNoFormContainer
                uniqueName={`${logProps.uniqueName}-over-500-popup`}
                isOpen={isPopupOpen}
                message={popupMessage}
                dialogTitle="Information"
                showOkButton={true}
                handleOkButtonClick={() => setIsPopupOpen(false)}
            />
        </div>
    );
};

export { Log, Log as AppqaLog };
export default Log;
