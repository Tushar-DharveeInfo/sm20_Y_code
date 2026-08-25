
import type { IDCFilterControlValues } from "../../allinterface/searchfilter/IFilterFormContainer";
import { ClientEnums } from "../../../constants/Feature";

/**
 * Default explorer filter for Client menu features.
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
            return { tag: "NetZoom", btype: "Client" };
        case ClientEnums.VisioStencils:
            return { tag: "VisioStencils", btype: "Client" };
        case ClientEnums.SSIAndOtherServices:
            return { tag: "SSI", btype: "Client" };
        case ClientEnums.Reseller:
            return { btype: "Reseller" };
        case ClientEnums.ClientIdentityManagement:
        default:
            return {};
    }
};

/*True when this featureId is under the Client menu (explorer + filter). */
const FnIsClientMenuFeature = (featureId?: string): boolean => {
    if (!featureId) return false;
    return (
        featureId === ClientEnums.Client
        || featureId === ClientEnums.ClientIdentityManagement
        || featureId === ClientEnums.NetZoom
        || featureId === ClientEnums.VisioStencils
        || featureId === ClientEnums.SSIAndOtherServices
        || featureId === ClientEnums.Reseller
    );
};

export { FnGetClientExplorerAutoFilter, FnIsClientMenuFeature };
