
import type { IDCFilterControlValues } from "../../allinterface/searchfilter/IFilterFormContainer";
import { ClientEnums, LibraryEnums, SettingsEnums } from "../../../constants/Feature";

/**
 * Default explorer filter for Client menu features and MCS Development.
 * Client Identity Management has no auto-filter (full dataset).
 */
const FnGetClientExplorerAutoFilter = (
    featureId?: string
): IDCFilterControlValues => {
    if (!featureId) {
        return {};
    }

    switch (featureId) {
        case ClientEnums.NetZoom:
            return { btype: "consultant" };
        case ClientEnums.VisioStencils:
            return { btype: "enduser" };
        case ClientEnums.SSIAndOtherServices:
            return { btype: "Client" };
        case ClientEnums.Reseller:
            return { btype: "reseller" };
        case ClientEnums.Mcs:
        case LibraryEnums.McsDevelopment:
        case "feature-mcsdevelopment":
            return { btype: "mcs" };
        case SettingsEnums.ClientIdentityManagement:
        default:
            return {};
    }
};

/*True when this featureId is under the Client menu (explorer + filter). */
const FnIsClientMenuFeature = (featureId?: string): boolean => {
    if (!featureId) return false;
    return (
        featureId === ClientEnums.Client
        || featureId === ClientEnums.NetZoom
        || featureId === ClientEnums.VisioStencils
        || featureId === ClientEnums.SSIAndOtherServices
        || featureId === ClientEnums.Reseller
    );
};

export { FnGetClientExplorerAutoFilter, FnIsClientMenuFeature };
