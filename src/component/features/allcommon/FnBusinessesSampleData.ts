/*
 * SAMPLE DATA: businesses from businesses.json for explorer tree mapping.
 * Replace this import with API response data when available.
 */
import businessesSample from "../../../smsampledata/tree/businesses.json";
import type { IBusiness, IBusinessesResponse } from "../../shared/allinterface/tree/IBusiness";

const rawBusinesses: IBusiness[] =
    (businessesSample as IBusinessesResponse).businesses ?? [];

const sampleBusinesses: IBusiness[] = [...rawBusinesses].sort((a, b) =>
    (a.bname ?? "").localeCompare(b.bname ?? "")
);

export { sampleBusinesses };
