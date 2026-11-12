/*
When toUTC is true, the function assumes dateInput is in the app's local display format (e.g. "03/15/2024 14:30:00" or "03/15/2024 02:30 PM") or ISO format.
A Date object is built using the local timezone components and converted to UTC representation via .toISOString(), stripping the milliseconds portion if showTime is true, or returning "yyyy-MM-dd" if showTime is false.

When toUTC is false, the function expects dateInput to represent a UTC timestamp (ISO string, SQL timestamp, or display format) and renders it in the app's local display format (MM/dd/yyyy or dd/MM/yyyy), optionally appending 12-hour clock time with AM/PM if showTime is true.
*/

import { FnGetAppDateFormat } from "./basic/FnGetAppDateFormat";

const FnConvertDateToUtcOrUtcToLocalDate = (
    dateInput: string,
    toUTC: boolean,
    showTime: boolean = true
): string => {
    if (!dateInput || typeof dateInput !== "string" || !dateInput.trim().length) {
        return "";
    }

    const trimmed = dateInput.trim();
    const format = FnGetAppDateFormat(); // "MM/dd/yyyy" or "dd/MM/yyyy"
    const isMonthFirst = !format || format.toUpperCase().startsWith("MM");
    const pad = (n: number) => n.toString().padStart(2, "0");

    try {
        const formatAMPM = (date: Date): string => {
            let hours = date.getHours();
            const minutes = pad(date.getMinutes());
            const ampm = hours >= 12 ? "PM" : "AM";

            hours = hours % 12;
            hours = hours ? hours : 12;

            return `${pad(hours)}:${minutes} ${ampm}`;
        };

        const parsePartsWithAmPm = (inputStr: string, monthFirst: boolean) => {
            const isPM = /pm/i.test(inputStr);
            const isAM = /am/i.test(inputStr);
            const cleaned = inputStr.replace(/\s*(am|pm)\s*/i, "").trim();

            const isoMatch = cleaned.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
            let year = 0,
                month = 0,
                day = 0,
                hours = 0,
                minutes = 0,
                seconds = 0;
            let hasTime = false;

            if (isoMatch) {
                year = Number(isoMatch[1]);
                month = Number(isoMatch[2]);
                day = Number(isoMatch[3]);
                if (isoMatch[4] !== undefined) {
                    hasTime = true;
                    hours = Number(isoMatch[4]);
                    minutes = Number(isoMatch[5] || 0);
                    seconds = Number(isoMatch[6] || 0);
                }
            } else {
                const parts = cleaned.split(/[\/\-\s:T]/).filter(Boolean).map(Number);
                if (parts.length >= 3) {
                    if (monthFirst) {
                        [month, day, year] = parts;
                    } else {
                        [day, month, year] = parts;
                    }
                    if (parts.length > 3) {
                        hasTime = true;
                        hours = parts[3] ?? 0;
                        minutes = parts[4] ?? 0;
                        seconds = parts[5] ?? 0;
                    }
                }
            }

            if (isPM || isAM) {
                hasTime = true;
                if (hours === 12) {
                    if (isAM) hours = 0;
                } else if (isPM) {
                    hours += 12;
                }
            }

            return { year, month, day, hours, minutes, seconds, hasTime };
        };

        if (toUTC) {
            // If already a full ISO string with UTC Z or offset, parse directly
            if (/^\d{4}-\d{2}-\d{2}[T\s]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
                const d = new Date(trimmed);
                if (!isNaN(d.getTime())) {
                    return showTime
                        ? d.toISOString().replace(/\.\d+Z$/, "Z")
                        : d.toISOString().substring(0, 10);
                }
            }

            const { year, month, day, hours, minutes, seconds, hasTime } = parsePartsWithAmPm(trimmed, isMonthFirst);

            if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
                console.error("Invalid date input for local → UTC conversion");
                return "";
            }

            // If input is date-only and time was not requested, keep calendar date intact
            if (!showTime && !hasTime) {
                return `${year}-${pad(month)}-${pad(day)}`;
            }

            const date = new Date(year, month - 1, day, hours, minutes, seconds);
            if (isNaN(date.getTime())) {
                console.error("Invalid date input for local → UTC conversion");
                return "";
            }

            return showTime
                ? date.toISOString().replace(/\.\d+Z$/, "Z")
                : date.toISOString().substring(0, 10);

        } else {
            // UTC → local
            const dateOnlyMatch = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
            if (dateOnlyMatch && !showTime) {
                const year = dateOnlyMatch[1];
                const month = pad(Number(dateOnlyMatch[2]));
                const day = pad(Number(dateOnlyMatch[3]));
                return isMonthFirst ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
            }

            let utcDate: Date;

            if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
                // If it has a time component but lacks timezone / Z, treat as UTC
                if (/[T\s]\d{1,2}:\d{2}/.test(trimmed) && !/[Zz]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
                    const normalized = (trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T")) + "Z";
                    utcDate = new Date(normalized);
                } else {
                    utcDate = new Date(trimmed);
                }
            } else {
                const { year, month, day, hours, minutes, seconds } = parsePartsWithAmPm(trimmed, isMonthFirst);
                if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
                    console.error("Invalid date input for UTC → local conversion");
                    return "";
                }
                utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
            }

            if (!utcDate || isNaN(utcDate.getTime())) {
                console.error("Invalid date input for UTC → local conversion");
                return "";
            }

            // JavaScript Date methods automatically convert the UTC instant to local time
            const year = utcDate.getFullYear();
            const month = pad(utcDate.getMonth() + 1);
            const day = pad(utcDate.getDate());

            const dateStr = isMonthFirst ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;

            if (!showTime) return dateStr;

            return `${dateStr} ${formatAMPM(utcDate)}`;
        }
    } catch (error) {
        console.error("Error in convert date :", error);
        return "";
    }
};

export { FnConvertDateToUtcOrUtcToLocalDate };
