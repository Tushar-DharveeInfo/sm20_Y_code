/*
 * SAMPLE DATA: businesses from datasets/businesses.json for explorer tree mapping.
 * Replace this import with API response data when available.
 */
import businessesSample from "../../../smsampledata/datasets/businesses.json";
import type { IBusinessDoc } from "../allinterface/IDatasets";

const sampleBusinesses: IBusinessDoc[] = [...(businessesSample as IBusinessDoc[])].sort((a, b) =>
    (a.bname ?? "").localeCompare(b.bname ?? "")
);

export { sampleBusinesses };
