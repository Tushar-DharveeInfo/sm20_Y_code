
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { AgGridReact } from 'ag-grid-react'
import type { ICellRendererParams } from 'ag-grid-community'
import { Filter24x24 } from '@n20a/libicon'
import { useFirestore, type IFirestoreQueryFilter } from '@n20a/libfsdb'
import { DisplayControlEnums } from '../../../shared/alldefaultprops/basic/DefaultPropsFormContainer'
import { Label } from '../../../shared/basic/label/Label'
import { ActionImage } from '../../../shared/basic/actionimage/ActionImage'
import { BasicGrid } from '../../../shared/tablegrid/BasicGrid'
import type { IBasicGridColDef } from '../../../shared/allinterface/tablegrid/IBasicGrid'
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks'
import { FnConvertDateToUtcOrUtcToLocalDate } from '../../../shared/allcommon/FnConvertDateToUtcOrUtcToLocalDate'
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

interface IActivitiesFilter {
    startDate?: string;
    endDate?: string;
    message?: string;
}

function formatActivityDate(value: unknown): string {
    if (value == null || value === '') return '';
    if (typeof value === 'string') {
        return FnConvertDateToUtcOrUtcToLocalDate(value, false, true) || value;
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
 * Parse a filter date string to start or end of that calendar day (local time timestamp).
 */
function parseFilterDateBoundary(raw: string, isEndOfDay: boolean): number | null {
    if (!raw?.trim()) return null;
    const str = raw.trim();

    try {
        let utcIsoString = '';
        if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
            const localFormatted = FnConvertDateToUtcOrUtcToLocalDate(str, false, false);
            if (localFormatted) {
                utcIsoString = FnConvertDateToUtcOrUtcToLocalDate(localFormatted, true, true);
            }
        } else {
            utcIsoString = FnConvertDateToUtcOrUtcToLocalDate(str, true, true);
        }

        if (utcIsoString) {
            const dateObj = new Date(utcIsoString);
            if (!isNaN(dateObj.getTime())) {
                const year = dateObj.getFullYear();
                const month = dateObj.getMonth();
                const day = dateObj.getDate();
                return isEndOfDay
                    ? new Date(year, month, day, 23, 59, 59, 999).getTime()
                    : new Date(year, month, day, 0, 0, 0, 0).getTime();
            }
        }
    } catch (err) {
        console.error('Error in parseFilterDateBoundary using FnConvertDateToUtcOrUtcToLocalDate:', err);
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return isEndOfDay
            ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
            : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
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

function extractDateRangeValues(data: Record<string, unknown>): { startDate: string; endDate: string } {
    let startDate = '';
    let endDate = '';

    for (const [key, value] of Object.entries(data)) {
        if ((key === 'dateRange' || key.toLowerCase().includes('daterange')) && value && typeof value === 'object') {
            const range = value as { startDate?: unknown; endDate?: unknown };
            if (range.startDate != null && String(range.startDate).trim() !== '') {
                startDate = String(range.startDate).trim();
            }
            if (range.endDate != null && String(range.endDate).trim() !== '') {
                endDate = String(range.endDate).trim();
            }
        }
    }

    if (!startDate) {
        startDate = extractFieldValue(data, 'StartDate') || extractFieldValue(data, 'startDate');
    }
    if (!endDate) {
        endDate = extractFieldValue(data, 'EndDate') || extractFieldValue(data, 'endDate');
    }

    return { startDate, endDate };
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
    const [appliedFilter, setAppliedFilter] = useState<IActivitiesFilter>({});
    const [popupMessage, setPopupMessage] = useState<string>('');
    const [isPopupOpen, setIsPopupOpen] = useState<boolean>(false);

    const hasCheckedInitialLoadRef = useRef(false);
    const latestFilterValuesRef = useRef<Record<string, unknown>>({});
    const queryDocumentsRef = useRef(queryDocuments);
    queryDocumentsRef.current = queryDocuments;

    const fetchActivitiesData = useCallback(async () => {
        if (!bid) { setActivities([]); return; }
        setLoading(true);
        setError(null);
        try {
            const filters: IFirestoreQueryFilter[] | undefined = cid
                ? [{ field: 'cid', op: '==', value: cid }]
                : undefined;
            const res = await queryDocumentsRef.current({
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
    }, [bid, cid]);

    useEffect(() => { void fetchActivitiesData(); }, [fetchActivitiesData]);

    useEffect(() => {
        if (!loading && activities !== null) {
            if (!hasCheckedInitialLoadRef.current) {
                hasCheckedInitialLoadRef.current = true;
                if (activities.length >= 501) {
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
        if (!appliedFilter.startDate && !appliedFilter.endDate && !appliedFilter.message) return '';
        return JSON.stringify([{
            StartDate: appliedFilter.startDate ?? '',
            EndDate: appliedFilter.endDate ?? '',
            message: appliedFilter.message ?? '',
        }]);
    }, [appliedFilter]);

    const filterFormControls = useMemo<IControl[]>(() => [
        {
            CanChange: 1, IsRequired: 0,
            GroupName: 'FilterDetails', GroupNameDesc: 'Filter Activities',
            SubGroupEntID: '', SubGroupName: 'FormControl', SubGroupNameDesc: '',
            _AP: 'StartDate', PropertyLabel: 'Date Created',
            NameDesc: 'Filter activities by start date',
            DefaultAPValue: appliedFilter.startDate ?? '',
            Value: appliedFilter.startDate || null,
            ValueDesc: '', SortOrder: 1, MaxInstances: 0,
            InputMask: null, RegEx: null,
            DisplayGroupControl: 'Filter Activities',
            DisplayControl: DisplayControlEnums.DateControl, ChangeEvent: '',
            Secured: false, IsNZ: true,
            EntID: 'StartDate', RecID: 'StartDate',
            LastUpdated: '', EntityName: 'Activity',
            Name: 'StartDate', disabled: false,
        },
        {
            CanChange: 1, IsRequired: 0,
            GroupName: 'FilterDetails', GroupNameDesc: 'Filter Activities',
            SubGroupEntID: '', SubGroupName: 'FormControl', SubGroupNameDesc: '',
            _AP: 'EndDate', PropertyLabel: 'End Date',
            NameDesc: 'Filter activities by end date',
            DefaultAPValue: appliedFilter.endDate ?? '',
            Value: appliedFilter.endDate || null,
            ValueDesc: '', SortOrder: 2, MaxInstances: 0,
            InputMask: null, RegEx: null,
            DisplayGroupControl: 'Filter Activities',
            DisplayControl: DisplayControlEnums.DateControl, ChangeEvent: '',
            Secured: false, IsNZ: true,
            EntID: 'EndDate', RecID: 'EndDate',
            LastUpdated: '', EntityName: 'Activity',
            Name: 'EndDate', disabled: false,
        },
        {
            CanChange: 1, IsRequired: 0,
            GroupName: 'FilterDetails', GroupNameDesc: 'Filter Activities',
            SubGroupEntID: '', SubGroupName: 'FormControl', SubGroupNameDesc: '',
            _AP: 'message', PropertyLabel: 'Message',
            NameDesc: 'Filter by message content',
            DefaultAPValue: appliedFilter.message ?? '',
            Value: appliedFilter.message || null,
            ValueDesc: '', SortOrder: 3, MaxInstances: 0,
            InputMask: null, RegEx: null,
            DisplayGroupControl: 'Filter Activities',
            DisplayControl: DisplayControlEnums.EditTextControl, ChangeEvent: '',
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

        const hasStartDate = Boolean(appliedFilter.startDate?.trim());
        const hasEndDate = Boolean(appliedFilter.endDate?.trim());

        if (hasStartDate || hasEndDate) {
            const startTs = hasStartDate ? parseFilterDateBoundary(appliedFilter.startDate!.trim(), false) : null;
            const endTs = hasEndDate ? parseFilterDateBoundary(appliedFilter.endDate!.trim(), true) : null;

            list = list.filter((row) => {
                const ts = parseActivityDate(row.datecreated, row as Record<string, unknown>);
                if (!ts) return false;
                if (startTs != null && ts < startTs) return false;
                if (endTs != null && ts > endTs) return false;
                return true;
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

    const handleApplyFilter = useCallback((_filterDataJson: string, parsedData: Record<string, unknown>) => {
        // Merge parsedData with the real-time tracked values from latestFilterValuesRef.
        // This is critical: when the user sets ONLY the date and saves,
        // parsedData may only have keys the user actually touched. The ref has everything
        // including pre-populated values from profileString that were never re-fired by the form.
        const merged = { ...latestFilterValuesRef.current, ...parsedData };

        const { startDate, endDate } = extractDateRangeValues(merged);
        const message = extractFieldValue(merged, 'message').trim();

        setAppliedFilter({ startDate, endDate, message });
        setIsFilterOpen(false);

        let list = activities ? [...activities] : [];
        if (startDate || endDate) {
            const startTs = startDate ? parseFilterDateBoundary(startDate, false) : null;
            const endTs = endDate ? parseFilterDateBoundary(endDate, true) : null;

            list = list.filter((row) => {
                const ts = parseActivityDate(row.datecreated, row as Record<string, unknown>);
                if (!ts) return false;
                if (startTs != null && ts < startTs) return false;
                if (endTs != null && ts > endTs) return false;
                return true;
            });
        }
        if (message) {
            list = list.filter((row) => String(row.message || '').toLowerCase().includes(message.toLowerCase()));
        }
        if (list.length >= 501) {
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
                    StartDate: appliedFilter.startDate ?? '',
                    EndDate: appliedFilter.endDate ?? '',
                    startDate: appliedFilter.startDate ?? '',
                    endDate: appliedFilter.endDate ?? '',
                    message: appliedFilter.message ?? '',
                };
                return (
                    <PopupFilterForm
                        uniqueName={`${myActivitiesProps.uniqueName}-popup-filter`}
                        isOpen={isFilterOpen}
                        headerText="Filter Activities"
                        controls={filterFormControls}
                        profileString={filterProfileString}
                        isFilterChange={Boolean(appliedFilter.startDate || appliedFilter.endDate || appliedFilter.message)}
                        onApplyFilter={handleApplyFilter}
                        onFilterChange={(values) => {
                            // Merge every field change into the ref so handleApplyFilter
                            // always has the latest value the user picked.
                            const { startDate, endDate } = extractDateRangeValues(values);
                            const msgVal = extractFieldValue(values, 'message');
                            latestFilterValuesRef.current = {
                                ...latestFilterValuesRef.current,
                                ...values,
                                ...(startDate ? { StartDate: startDate, startDate } : {}),
                                ...(endDate ? { EndDate: endDate, endDate } : {}),
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
