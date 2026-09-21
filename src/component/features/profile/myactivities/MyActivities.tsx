
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
    uniqueName: string;//uniqueName for the control and required
    featureId: string;// feature id
    headerText?: string;// header text coming from the selected menu item
    allowSort?: boolean;// allow grid column sort, defaults to true
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

    const triggerOver500Popup = useCallback(() => {
        const msg = "More than 500 records exist. Please use filter to refine your search.";
        if (myActivitiesProps.handleShowUserMessage) {
            myActivitiesProps.handleShowUserMessage(msg);
        }
        setPopupMessage(msg);
        setIsPopupOpen(true);
    }, [myActivitiesProps]);

    const fetchActivitiesData = useCallback(async () => {
        if (!bid) {
            setActivities([]);
            return;
        }
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

    useEffect(() => {
        void fetchActivitiesData();
    }, [fetchActivitiesData]);

    useEffect(() => {
        if (!loading && activities) {
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
            DefaultAPValue: '',
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
            DefaultAPValue: '',
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
            sortable: myActivitiesProps.allowSort ?? true,
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
            sortable: myActivitiesProps.allowSort ?? true,
        },
    ], [myActivitiesProps.allowSort]);

    const allFilteredRows = useMemo(() => {
        if (!activities?.length) return [];
        let list = [...activities];

        if (appliedFilter.datecreated?.trim()) {
            const filterDateStr = appliedFilter.datecreated.trim().toLowerCase();
            list = list.filter((row) => {
                const formatted = formatActivityDate(row.datecreated).toLowerCase();
                const rawStr = String(row.datecreated || '').toLowerCase();
                return formatted.includes(filterDateStr) || rawStr.includes(filterDateStr);
            });
        }

        if (appliedFilter.message?.trim()) {
            const filterMsgStr = appliedFilter.message.trim().toLowerCase();
            list = list.filter((row) => {
                const msg = String(row.message || '').toLowerCase();
                return msg.includes(filterMsgStr);
            });
        }

        return list.sort((a, b) => {
            const timeA = parseActivityDate(a?.datecreated, a as Record<string, unknown>);
            const timeB = parseActivityDate(b?.datecreated, b as Record<string, unknown>);
            return timeB - timeA; // Descending: newest record on top
        });
    }, [activities, appliedFilter]);

    // Slice to display max 500 records on grid
    const rowData = useMemo(() => {
        return allFilteredRows.slice(0, 500);
    }, [allFilteredRows]);

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
            XLSX.utils.book_append_sheet(workbook, worksheet, 'MyActivities');

            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            saveAs(blob, 'myactivities.xlsx');
        } catch (error) {
            console.error('MyActivities: failed to export Excel', error);
            myActivitiesProps.handleShowUserMessage?.('Unable to export activities. Please try again.');
        }
    }, [rowData, myActivitiesProps]);

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
            <PopupFilterForm
                uniqueName={`${myActivitiesProps.uniqueName}-popup-filter`}
                isOpen={isFilterOpen}
                headerText="Filter Activities"
                controls={filterFormControls}
                isFilterChange={Boolean(appliedFilter.datecreated || appliedFilter.message)}
                onApplyFilter={(_filterDataJson: string, parsedData: Record<string, unknown>) => {
                    const datecreated = String(
                        parsedData.datecreated ??
                        parsedData.DateCreated ??
                        parsedData['Filter Activities_datecreated'] ??
                        ''
                    ).trim();
                    const message = String(
                        parsedData.message ??
                        parsedData.Message ??
                        parsedData['Filter Activities_message'] ??
                        ''
                    ).trim();

                    setAppliedFilter({ datecreated, message });
                    setIsFilterOpen(false);

                    // Check if matching filtered records count is >= 501
                    let list = activities ? [...activities] : [];
                    if (datecreated) {
                        const filterDateStr = datecreated.toLowerCase();
                        list = list.filter((row) => {
                            const formatted = formatActivityDate(row.datecreated).toLowerCase();
                            const rawStr = String(row.datecreated || '').toLowerCase();
                            return formatted.includes(filterDateStr) || rawStr.includes(filterDateStr);
                        });
                    }
                    if (message) {
                        const filterMsgStr = message.toLowerCase();
                        list = list.filter((row) => {
                            const msg = String(row.message || '').toLowerCase();
                            return msg.includes(filterMsgStr);
                        });
                    }

                    if (list.length >= 501) {
                        triggerOver500Popup();
                    }
                }}
                onClose={() => setIsFilterOpen(false)}
            />
            <YesNoFormContainer
                uniqueName={`${myActivitiesProps.uniqueName}-over-500-popup`}
                isOpen={isPopupOpen}
                message={popupMessage}
                dialogTitle="Information"
                showOkButton={true}
                handleOkButtonClick={() => setIsPopupOpen(false)}
            />
        </div>
    )
}

export { MyActivities }
export default MyActivities
