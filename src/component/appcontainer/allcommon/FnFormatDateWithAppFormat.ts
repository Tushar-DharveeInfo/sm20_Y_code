type TDateInput =
  | string
  | number
  | Date
  | { toDate?: () => Date; toMillis?: () => number; seconds?: number; _seconds?: number; nanoseconds?: number; _nanoseconds?: number }
  | null
  | undefined;

const parseDateInput = (dateInput: TDateInput): Date | null => {
  if (dateInput == null || dateInput === "") return null;

  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  if (typeof dateInput === "number") {
    const fromNumber = new Date(dateInput);
    return isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  if (typeof dateInput === "string") {
    const text = dateInput.trim();
    if (!text) return null;

    // Epoch timestamps sometimes arrive as strings.
    if (/^\d{10,13}$/.test(text)) {
      const epoch = Number(text.length === 10 ? `${text}000` : text);
      const fromEpoch = new Date(epoch);
      if (!isNaN(fromEpoch.getTime())) return fromEpoch;
    }

    const fromString = new Date(text);
    return isNaN(fromString.getTime()) ? null : fromString;
  }

  if (typeof dateInput === "object") {
    if (typeof dateInput.toDate === "function") {
      const fromToDate = dateInput.toDate();
      if (fromToDate instanceof Date && !isNaN(fromToDate.getTime())) {
        return fromToDate;
      }
    }

    if (typeof dateInput.toMillis === "function") {
      const fromMillis = new Date(dateInput.toMillis());
      if (!isNaN(fromMillis.getTime())) return fromMillis;
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
      if (!isNaN(fromSeconds.getTime())) return fromSeconds;
    }
  }

  return null;
};

const FnFormatDateWithAppFormat = (
  dateInput: TDateInput,
  showTime: boolean = true,
): string => {
  try {
    //  Basic validation

    if (dateInput == null || dateInput === "") {
      console.warn("FnFormatDate: Empty date input");
      return "";
    }

    //  Convert to Date safely
    const date = parseDateInput(dateInput);

    if (!date) {
      console.warn("FnFormatDate: Invalid date input", dateInput);
      return "";
    }

    const format = "MM/dd/yyyy"

    const pad = (n: number) => n.toString().padStart(2, "0");

    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();

    let formattedDate = "";

    //  Format handling
    if (format === "MM/dd/yyyy") {
      formattedDate = `${month}/${day}/${year}`;
    } else if (format === "dd/MM/yyyy") {
      formattedDate = `${day}/${month}/${year}`;
    } else {
      console.warn("FnFormatDate: Unsupported format →", format);
      formattedDate = `${day}/${month}/${year}`; // fallback
    }

    //  If only date required
    if (!showTime) return formattedDate;

    //  Time formatting
    let hours = date.getHours();
    const minutes = pad(date.getMinutes());
    const ampm = hours >= 12 ? "PM" : "AM";

    hours = hours % 12 || 12;

    return `${formattedDate} ${pad(hours)}:${minutes} ${ampm}`;

  } catch (error) {
    //  Catch unexpected runtime errors
    console.error("FnFormatDate: Unexpected error →", error);
    return "";
  }
};

export { FnFormatDateWithAppFormat };
