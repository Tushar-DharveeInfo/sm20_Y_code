import { useEffect, useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ICellRendererParams } from 'ag-grid-community'
import { useActivities } from '@n20a/libfsdb'
import { Label } from '../../../shared/basic/label/Label'
import { BasicGrid } from '../../../shared/tablegrid/BasicGrid'
import type { IBasicGridColDef } from '../../../shared/allinterface/tablegrid/IBasicGrid'
import type { ITreeNode } from '../../../shared/allinterface/tree/ITreeControl'
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks'
import { FnConvertDateToUtcOrUtcToDate } from '../../../appcontainer/allcommon/FnConvertDateToUtcOrUtcToDate'
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

const Log = (logProps: ILog) => {
    const headerTitle = logProps.headerText ?? "Log";
    const mainAppContext = useMainAppContext();
    const userInfo = mainAppContext.userInfoAndSubscription?.userInfo;

    const nodeType = String(logProps.selectedNode?.NodeType ?? '').trim().toLowerCase();

    // Priority 1: Check selectedNode directly for bid
    const nodeBid = String(
        logProps.selectedNode?.bid
        ?? (nodeType === 'business'
            ? logProps.selectedNode?.NodeEntID ?? logProps.selectedNode?.key
            : logProps.selectedNode?.parentEntID ?? '')
        ?? ''
    ).trim();

    // Priority 2: Check selectedNode directly for cid
    const nodeCid = String(
        logProps.selectedNode?.cid
        ?? (nodeType === 'contact'
            ? logProps.selectedNode?.NodeEntID ?? logProps.selectedNode?.key
            : '')
        ?? ''
    ).trim();

    const userBid = String(userInfo?.bid ?? '').trim();
    const userCid = String(userInfo?.cid ?? '').trim();

    // If found in selectedNode, do not use bid and cid from userInfo
    const bid = nodeBid || userBid;
    const cid = nodeBid ? nodeCid : (nodeCid || userCid);
    const { activities, loading, error, getActivities } = useActivities(bid);
    const gridRef = useRef<AgGridReact>(null);

    useEffect(() => {
        if (!bid) {
            return;
        }
        const filters = cid
            ? [{ field: 'cid', op: '==' as const, value: cid }]
            : undefined;
        void getActivities(filters);
    }, [bid, cid, getActivities]);

    const columnDefs = useMemo<IBasicGridColDef[]>(() => [
        {
            headerName: 'Date Created',
            field: 'datecreated',
            width: 180,
            resizable: true,
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
        },
        {
            headerName: 'Activity ID',
            field: 'activityid',
            width: 200,
            resizable: true,
        },
        {
            headerName: 'Bid',
            field: 'bid',
            width: 120,
            resizable: true,
        },
        {
            headerName: 'Cid',
            field: 'cid',
            width: 160,
            resizable: false,
        },
    ], []);

    const rowData = activities ?? [];
    const showGrid = !loading && !error && rowData.length > 0;

    return (
        <div key={logProps.uniqueName} className='nz-appqa-log-container nz-wh-100'>
            <div className='nz-sub-header'>
                <Label
                    uniqueName={`${logProps.uniqueName}-header`}
                    label={headerTitle}
                    fontWeight='600' />
            </div>
            <div className='nz-appqa-log-content'>
                <div className='nz-appqa-log-grid'>
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
        </div>
    );
};

export { Log, Log as AppqaLog };
export default Log;

