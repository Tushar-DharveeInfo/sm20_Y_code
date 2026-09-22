
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { AgGridReact } from 'ag-grid-react'
import type { ICellRendererParams } from 'ag-grid-community'
import { Filter24x24 } from '@n20a/libicon'
import { useFirestore, type IFirestoreQueryFilter } from '@n20a/libfsdb'
import { Label } from '../../../shared/basic/label/Label'
import { ActionImage } from '../../../shared/basic/actionimage/ActionImage'
import { BasicGrid } from '../../../shared/tablegrid/BasicGrid'
import type { IBasicGridColDef } from '../../../shared/allinterface/tablegrid/IBasicGrid'
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks'
import { FnConvertDateToUtcOrUtcToDate } from '../../../appcontainer/allcommon/FnConvertDateToUtcOrUtcToDate'
import { FnGetCssVariable } from '../../../shared/allcommon/FnGetCssVariable'
import { PopupFilterForm } from '../../../shared/searchfilter/popupfilterform/PopupFilterForm'
import { YesNoFormContainer } from '../../../shared/basic/yesnoformcontainer/YesNoFormContainer'
import type { IControl } from '../../../shared/settingsform/settingslibform/SettingsLibForm'
import './MyActivities.css'

interface IMyActivities {
    uniqueName: string;
    featureId: string;
    headerText?: string;
    allowSort?: boolean;
    handleShowUserMessage?: (messageText: string) => void;
}

function formatActivityDate(value: unknown): string {
    if (value == null || value === '') return '';
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
        if (typeof value === 'number') return value;
        if (value instanceof Date) return value.getTime();
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
            if (!isNaN(parsed)) return parsed;
        }
    }
    if (row && typeof row.activityid === 'string') {
        const match = row.activityid.match(/_(\d{10,13})$/);
        if (match) {
            const ts = Number(match[1]);
            if (!isNaN(ts)) return ts;
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

const MyActivities = (myActivitiesProps: IMyActivities) => {
    const headerTitle = myActivitiesProps.headerText ?? "My Activities";
    const mainAppContext = useMainAppContext();
    const bid = String(mainAppContext.authSession?.bid ?? '').trim();
    const cid = String(mainAppContext.authSession?.cid ?? '').trim();
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
    const latestFilterValuesRef = useRef<Record<string, unknown>>({});

    const fetchActivitiesData = useCallback(async () => {
        if (!bid) { setActivities([]); return; }
        setLoading(true);
        setError(null);
        try {
            const filters: IFirestoreQueryFilter[] | undefined = cid
                ? [{ field: 'cid', op: '==', value: cid }]
                : undefined;
            const res = await queryDocuments({
                pathSegments: ['businesses', bid, 'activities'],
                filters,
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
    }, [bid, cid, queryDocuments]);

    useEffect(() => { void fetchActivitiesData(); }, [fetchActivitiesData]);

    useEffect(() => {
        if (!loading && activities !== null) {
            if (!hasCheckedInitialLoadRef.current) {
                hasCheckedInitialLoadRef.current = true;
                if (activities.length >= 501) {
                    debugger
                    setIsFilterIconVisible(true);
                    setPopupMessage("More than 500 records exist. Please use filter to refine your search.");
                    setIsPopupOpen(true);
                } else {
                    setIsFilterIconVisible(false);
                }
            }
        }
    }, [loading, activities]);

    // profileString built from appliedFilter — used to pre-populate the filter form on reopen.
    // Because PopupFilterForm is conditionally rendered (truly unmounts/remounts), this value
    // is read fresh from appliedFilter every time the dialog opens.
    const filterProfileString = useMemo(() => {
        if (!appliedFilter.datecreated && !appliedFilter.message) return '';
        return JSON.stringify([{
            datecreated: appliedFilter.datecreated ?? '',
            message: appliedFilter.message ?? '',
        }]);
    }, [appliedFilter]);

    const filterFormControls = useMemo<IControl[]>(() => [
        {
            CanChange: 1, IsRequired: 0,
            GroupName: 'FilterDetails', GroupNameDesc: 'Filter Activities',
            SubGroupEntID: '', SubGroupName: 'FormControl', SubGroupNameDesc: '',
            _AP: 'datecreated', PropertyLabel: 'Date Created',
            NameDesc: 'Filter by date created',
            DefaultAPValue: appliedFilter.datecreated ?? '',
            Value: appliedFilter.datecreated || null,
            ValueDesc: '', SortOrder: 1, MaxInstances: 0,
            InputMask: null, RegEx: null,
            DisplayGroupControl: 'Filter Activities',
            DisplayControl: 'DateControl', ChangeEvent: '',
            Secured: false, IsNZ: true,
            EntID: 'datecreated', RecID: 'datecreated',
            LastUpdated: '', EntityName: 'Activity',
            Name: 'datecreated', disabled: false,
        },
        {
            CanChange: 1, IsRequired: 0,
            GroupName: 'FilterDetails', GroupNameDesc: 'Filter Activities',
            SubGroupEntID: '', SubGroupName: 'FormControl', SubGroupNameDesc: '',
            _AP: 'message', PropertyLabel: 'Message',
            NameDesc: 'Filter by message content',
            DefaultAPValue: appliedFilter.message ?? '',
            Value: appliedFilter.message || null,
            ValueDesc: '', SortOrder: 2, MaxInstances: 0,
            InputMask: null, RegEx: null,
            DisplayGroupControl: 'Filter Activities',
            DisplayControl: 'EditTextControl', ChangeEvent: '',
            Secured: false, IsNZ: true,
            EntID: 'message', RecID: 'message',
            LastUpdated: '', EntityName: 'Activity',
            Name: 'message', disabled: false,
        },
    ], [appliedFilter]);

    const columnDefs = useMemo<IBasicGridColDef[]>(() => [
        {
            headerName: 'Date Created', field: 'datecreated',
            width: 180, resizable: true,
            sortable: myActivitiesProps.allowSort ?? true, sort: 'desc',
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
            headerName: 'Message', field: 'message',
            flex: 1, minWidth: 220, resizable: true,
            sortable: myActivitiesProps.allowSort ?? true,
        },
    ], [myActivitiesProps.allowSort]);

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
        const rows: (string | number)[][] = [['Date Created', 'Message']];
        if (api) {
            api.forEachNodeAfterFilterAndSort((node) => {
                if (node.group) return;
                rows.push([formatActivityDate(node.data?.datecreated), node.data?.message != null ? String(node.data.message) : '']);
            });
        } else {
            rowData.forEach((row) => rows.push([formatActivityDate(row.datecreated), row.message != null ? String(row.message) : '']));
        }
        if (rows.length <= 1) return;
        try {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'MyActivities');
            saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }), 'myactivities.xlsx');
        } catch (err) {
            console.error('MyActivities: failed to export Excel', err);
            myActivitiesProps.handleShowUserMessage?.('Unable to export activities. Please try again.');
        }
    }, [rowData, myActivitiesProps]);

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

    const handleApplyFilter = useCallback((_filterDataJson: string, parsedData: Record<string, unknown>) => {
        // Merge parsedData with the real-time tracked values from latestFilterValuesRef.
        // This is critical: when the user sets ONLY the date and saves,
        // parsedData may only have keys the user actually touched. The ref has everything
        // including pre-populated values from profileString that were never re-fired by the form.
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
            debugger
            setPopupMessage("More than 500 records exist. Please use filter to refine your search.");
            setIsPopupOpen(true);
        }
    }, [activities]);


    const showGrid = !loading && !error && rowData.length > 0;

    return (
        <div key={myActivitiesProps.uniqueName} className='nz-my-activities-container nz-wh-100'>
            <div className='nz-sub-header'>
                <div className='nz-d-flex-row nz-align-center'>
                    <Label
                        uniqueName={`${myActivitiesProps.uniqueName}-header`}
                        label={headerTitle}
                        fontWeight='600'
                    />
                </div>
            </div>
            <div className='nz-my-activities-content'>
                <div className='nz-activities-grid'>
                    <div className="nz-filter-activity">
                        {isFilterIconVisible && (
                            <ActionImage
                                uniqueName={`${myActivitiesProps.uniqueName}-filter-ai`}
                                image={{
                                    uniqueName: `${myActivitiesProps.uniqueName}-filter-image`,
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
                        <div className='nz-activities-status'>Loading...</div>
                    ) : error ? (
                        <div className='nz-activities-status'>{error}</div>
                    ) : showGrid ? (
                        <BasicGrid
                            gridRef={gridRef}
                            showGrid={true}
                            uniqueName={`${myActivitiesProps.uniqueName}-grid`}
                            allowAutoSizeColumn={false}
                            containerName='nz_my_activities'
                            instanceName='nz_my_activities'
                            featureId={myActivitiesProps.featureId}
                            allowColumnResize={true}
                            isExportOnCopy={true}
                            handleDownloadData={handleDownloadExcel}
                            exportFileName='myactivities'
                            rowData={rowData}
                            isReadOnly={true}
                            allowColumnFilter={true}
                            columnDefs={columnDefs}
                            allowPagination={true}
                            paginationAutoPageSize={true}
                            allowSort={myActivitiesProps.allowSort ?? true}
                            totalRecords={rowData.length}
                            featureData={undefined}
                        />
                    ) : (
                        <div className='nz-activities-status'>Activity log details not found.</div>
                    )}
                </div>
            </div>


            {isFilterOpen && (() => {
                // Seed the ref with current applied values so handleApplyFilter has them
                // even before the user touches any field.
                latestFilterValuesRef.current = {
                    datecreated: appliedFilter.datecreated ?? '',
                    message: appliedFilter.message ?? '',
                };
                return (
                    <PopupFilterForm
                        uniqueName={`${myActivitiesProps.uniqueName}-popup-filter`}
                        isOpen={isFilterOpen}
                        headerText="Filter Activities"
                        controls={filterFormControls}
                        profileString={filterProfileString}
                        isFilterChange={Boolean(appliedFilter.datecreated || appliedFilter.message)}
                        onApplyFilter={handleApplyFilter}
                        onFilterChange={(values) => {
                            // Merge every field change into the ref so handleApplyFilter
                            // always has the latest value the user picked.
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


            {isPopupOpen && <YesNoFormContainer
                uniqueName={`${myActivitiesProps.uniqueName}-over-500-popup`}
                isOpen={isPopupOpen}
                message={popupMessage}
                dialogTitle="Information"
                showOkButton={true}
                handleOkButtonClick={() => setIsPopupOpen(false)}
            />}
        </div>
    )
}

export { MyActivities }
export default MyActivities
