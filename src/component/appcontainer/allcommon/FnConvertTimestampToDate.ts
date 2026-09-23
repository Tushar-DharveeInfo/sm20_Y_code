import { FnConvertDateToUtcOrUtcToLocalDate } from "../../shared/allcommon/FnConvertDateToUtcOrUtcToLocalDate";

type TTimestampDateInput =
    | string
    | number
    | Date
    | {
          toDate?: () => Date;
          toMillis?: () => number;
          seconds?: number;
          _seconds?: number;
          nanoseconds?: number;
          _nanoseconds?: number;
          type?: string;
          [key: string]: any;
      }
    | null
    | undefined;

/**
 * Converts a Firestore Timestamp, Date, epoch number, or string to an ISO string.
 */
const FnParseTimestampToISO = (dateInput: TTimestampDateInput): string => {
    if (dateInput == null || dateInput === "") {
        return "";
    }

    if (typeof dateInput === "string") {
        return dateInput.trim();
    }

    if (dateInput instanceof Date) {
        return isNaN(dateInput.getTime()) ? "" : dateInput.toISOString();
    }

    if (typeof dateInput === "number") {
        const fromNumber = new Date(dateInput);
        return isNaN(fromNumber.getTime()) ? "" : fromNumber.toISOString();
    }

    if (typeof dateInput === "object") {
        if (typeof dateInput.toDate === "function") {
            const fromToDate = dateInput.toDate();
            if (fromToDate instanceof Date && !isNaN(fromToDate.getTime())) {
                return fromToDate.toISOString();
            }
        }

        if (typeof dateInput.toMillis === "function") {
            const fromMillis = new Date(dateInput.toMillis());
            if (!isNaN(fromMillis.getTime())) {
                return fromMillis.toISOString();
            }
        }

        const seconds =
            typeof dateInput.seconds === "number"
                ? dateInput.seconds
                : typeof dateInput._seconds === "number"
                    ? dateInput._seconds
                    : undefined;

        const nanos =
            typeof dateInput.nanoseconds === "number"
                ? dateInput.nanoseconds
                : typeof dateInput._nanoseconds === "number"
                    ? dateInput._nanoseconds
                    : 0;

        if (typeof seconds === "number") {
            const fromSeconds = new Date(seconds * 1000 + Math.floor(nanos / 1_000_000));
            if (!isNaN(fromSeconds.getTime())) {
                return fromSeconds.toISOString();
            }
        }
    }

    return "";
};

/**
 * Converts Firestore Timestamp (or Date/string/number) to local or UTC formatted date string.
 */
const FnConvertTimestampToDate = (
    dateInput: TTimestampDateInput,
    toUTC: boolean = false,
    showTime: boolean = true
): string => {
    const isoString = FnParseTimestampToISO(dateInput);
    if (!isoString) {
        return "";
    }
    return FnConvertDateToUtcOrUtcToLocalDate(isoString, toUTC, showTime);
};

export { FnConvertTimestampToDate, FnParseTimestampToISO };
export type { TTimestampDateInput };
