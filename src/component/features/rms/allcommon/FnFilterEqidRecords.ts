import type { IEqidDoc } from "../../../shared/context/allinterface/IRms";
import type { IDCFilterControlValues } from "../../../shared/allinterface/searchfilter/IFilterFormContainer";

function parseDateMs(value: unknown): number | null {
    if (!value) return null;
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value.getTime();
    }
    if (typeof value === "object" && value !== null) {
        if ("toDate" in (value as any) && typeof (value as any).toDate === "function") {
            try {
                const d = (value as any).toDate();
                if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
            } catch { }
        }
        if ("seconds" in (value as { seconds: number })) {
            return (value as { seconds: number }).seconds * 1000;
        }
        if ("_seconds" in (value as { _seconds: number })) {
            return (value as { _seconds: number })._seconds * 1000;
        }
    }
    const parsed = Date.parse(String(value));
    return isNaN(parsed) ? null : parsed;
}

function isFilterFlagChecked(value: unknown): boolean {
    if (value === true || value === 1 || value === "1") return true;
    if (typeof value === "string") {
        const lower = value.trim().toLowerCase();
        return lower === "true" || lower === "yes" || lower === "1";
    }
    return false;
}

function isItemFlagTrue(value: unknown): boolean {
    if (value === true || value === 1 || value === "1") return true;
    if (typeof value === "string") {
        const lower = value.trim().toLowerCase();
        return lower === "true" || lower === "yes" || lower === "1";
    }
    return false;
}

function getItemProperty<T = unknown>(item: Record<string, any>, ...keys: string[]): T | undefined {
    if (!item || typeof item !== "object") return undefined;
    for (const key of keys) {
        if (item[key] !== undefined && item[key] !== null) {
            return item[key] as T;
        }
    }
    const itemKeys = Object.keys(item);
    for (const key of keys) {
        const lowerKey = key.toLowerCase();
        const foundKey = itemKeys.find((k) => k.toLowerCase() === lowerKey);
        if (foundKey && item[foundKey] !== undefined && item[foundKey] !== null) {
            return item[foundKey] as T;
        }
    }
    return undefined;
}

function getFilterValue(filters: Record<string, unknown>, ...keys: string[]): unknown {
    if (!filters || typeof filters !== "object") return undefined;
    for (const key of keys) {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
            return filters[key];
        }
    }
    const filterKeys = Object.keys(filters);
    for (const key of keys) {
        const lowerKey = key.toLowerCase();
        const foundKey = filterKeys.find((k) => k.toLowerCase() === lowerKey);
        if (foundKey && filters[foundKey] !== undefined && filters[foundKey] !== null && filters[foundKey] !== "") {
            return filters[foundKey];
        }
    }
    return undefined;
}

/**
 * Filters EQID records according to RMS filter form criteria:
 * - DataReady: boolean (when checked, requires DataReady === true)
 * - ShapeReady: boolean (when checked, requires ShapeReady === true)
 * - isReleased: boolean (when checked, requires isReleased === true)
 * - ApprovedDate: Date / Date range
 * - ReleasedDate: Date / Date range
 */
export function FnFilterEqidRecords(
    records: IEqidDoc[],
    filters: IDCFilterControlValues = {}
): IEqidDoc[] {
    if (!Array.isArray(records) || records.length === 0) {
        return [];
    }

    const requireDataReady = isFilterFlagChecked(
        getFilterValue(filters, "DataReady", "dataready", "dataReady")
    );
    debugger;
    const requireShapeReady = isFilterFlagChecked(
        getFilterValue(filters, "ShapeReady", "shapeready", "shapeReady")
    );
    const requireIsReleased = isFilterFlagChecked(
        getFilterValue(filters, "isReleased", "isreleased", "IsReleased", "released")
    );

    const approvedStartMs = parseDateMs(
        getFilterValue(filters, "ApprovedDate_StartDate", "ApprovedDateStartDate", "ApprovedDate_Start", "ApprovedDate")
    );
    const approvedEndMs = parseDateMs(
        getFilterValue(filters, "ApprovedDate_EndDate", "ApprovedDateEndDate", "ApprovedDate_End")
    );

    const releasedStartMs = parseDateMs(
        getFilterValue(filters, "ReleasedDate_StartDate", "ReleasedDateStartDate", "ReleasedDate_Start", "ReleasedDate")
    );
    const releasedEndMs = parseDateMs(
        getFilterValue(filters, "ReleasedDate_EndDate", "ReleasedDateEndDate", "ReleasedDate_End")
    );

    return records.filter((item) => {
        // 1. DataReady checkbox filter
        if (requireDataReady) {
            const itemDataReady = getItemProperty(item as any, "DataReady", "dataready", "dataReady", "DATAREADY");
            if (!isItemFlagTrue(itemDataReady)) {
                return false;
            }
        }

        // 2. ShapeReady checkbox filter
        if (requireShapeReady) {
            const itemShapeReady = getItemProperty(item as any, "ShapeReady", "shapeready", "shapeReady", "SHAPEREADY");
            if (!isItemFlagTrue(itemShapeReady)) {
                return false;
            }
        }

        // 3. isReleased checkbox filter
        if (requireIsReleased) {
            const itemIsReleased = getItemProperty(item as any, "isReleased", "isreleased", "IsReleased", "released", "is_released");
            if (!isItemFlagTrue(itemIsReleased)) {
                return false;
            }
        }

        // 4. ApprovedDate filter
        if (approvedStartMs !== null || approvedEndMs !== null) {
            const itemApproved = getItemProperty(item as any, "ApprovedDate", "approveddate", "approvedDate", "dateapproved", "dateApproved", "Approved_Date");
            const itemApprovedMs = parseDateMs(itemApproved);
            if (itemApprovedMs === null) {
                return false;
            }
            if (approvedStartMs !== null && itemApprovedMs < approvedStartMs) {
                return false;
            }
            // If end date is supplied, include end of that day (+ 86400000 ms - 1 ms)
            if (approvedEndMs !== null && itemApprovedMs > (approvedEndMs + 86400000 - 1)) {
                return false;
            }
        }

        // 5. ReleasedDate filter
        if (releasedStartMs !== null || releasedEndMs !== null) {
            const itemReleased = getItemProperty(item as any, "ReleasedDate", "releaseddate", "releasedDate", "datereleased", "dateReleased", "Released_Date");
            const itemReleasedMs = parseDateMs(itemReleased);
            if (itemReleasedMs === null) {
                return false;
            }
            if (releasedStartMs !== null && itemReleasedMs < releasedStartMs) {
                return false;
            }
            if (releasedEndMs !== null && itemReleasedMs > (releasedEndMs + 86400000 - 1)) {
                return false;
            }
        }

        return true;
    });
}
