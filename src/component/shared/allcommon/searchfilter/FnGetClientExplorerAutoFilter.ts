
import type { IDCFilterControlValues } from "../../allinterface/searchfilter/IFilterFormContainer";
import { ClientEnums, TicketsEnums, RmsEnums, ProspectEnums, SettingEnums } from "../../../constants/Feature";

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
        case RmsEnums.McsDevelopment:
        case "feature-mcsdevelopment":
            return { btype: "mcs" };

        // Requests Received: businesses where verified == false
        case TicketsEnums.RequestsReceived:
            return { verified: "false" };

        // Approved Tickets: businesses where verified == true
        case TicketsEnums.ApprovedTickets:
            return { verified: "true" };

        // [Prospect] Review Deleted & [Setting] Delete: businesses that have at least one contact where status == deleted
        case ProspectEnums.ReviewDeleted:
        case "258":
        case SettingEnums.Delete:
        case "920":
        case "review deleted":
        case "delete":
            return {};

        default:
            return {};
    }
};

/* True when this featureId is under the Client menu (explorer + filter). */
const FnIsClientMenuFeature = (featureId?: string): boolean => {
    if (!featureId) return false;
    return (
        featureId === ClientEnums.Client
        || featureId === ClientEnums.NetZoom
        || featureId === ClientEnums.VisioStencils
        || featureId === ClientEnums.SSIAndOtherServices
        || featureId === ClientEnums.Reseller
        || featureId === ClientEnums.Mcs
    );
};

/* True when this featureId is under the Prospect menu. */
const FnIsProspectMenuFeature = (featureId?: string): boolean => {
    if (!featureId) return false;
    return (
        featureId === ProspectEnums.Prospect
        || featureId === ProspectEnums.Followup
        || featureId === ProspectEnums.Recent
        || featureId === ProspectEnums.Past
        || featureId === ProspectEnums.ReviewDeleted
        || featureId === "258"
        || String(featureId).toLowerCase() === "review deleted"
    );
};

/* True when this featureId is under the Client or Prospect menu, or [Setting] Delete (uses cached Prospects). */
const FnIsClientOrProspectFeature = (
    featureId?: string,
    featureRecords?: Array<{ _Feature?: string; Feature?: string; EntID?: string; MenuID?: string; Label?: string }>
): boolean => {
    if (!featureId) return false;
    if (
        featureId === SettingEnums.Delete
        || featureId === "920"
        || String(featureId).toLowerCase() === "delete"
    ) {
        return true;
    }
    if (FnIsClientMenuFeature(featureId) || FnIsProspectMenuFeature(featureId)) {
        return true;
    }
    if (featureRecords?.length) {
        const cleanId = String(featureId).trim();
        const item = featureRecords.find(
            (f) => String(f._Feature ?? f.Feature ?? f.EntID ?? "").trim() === cleanId
        );
        if (item) {
            const menuId = String(item.MenuID ?? "").trim();
            if (menuId === ClientEnums.Client || menuId === ProspectEnums.Prospect) {
                return true;
            }
            const label = String(item.Label ?? "").trim().toLowerCase();
            if (label === "client" || label === "prospect") {
                return true;
            }
        }
    }
    return false;
};

/* True when featureId is [Prospect] Followup, Recent, or Past —
   these are the three features that use the Country + DateUpdated filter controls. */
const FnIsProspectFilterFeature = (featureId?: string): boolean => {
    if (!featureId) return false;
    return (
        featureId === ProspectEnums.Followup
        || featureId === ProspectEnums.Recent
        || featureId === ProspectEnums.Past
        || String(featureId).toLowerCase() === "followup"
        || String(featureId).toLowerCase() === "recent"
        || String(featureId).toLowerCase() === "past"
    );
};

/* True when featureId is [Tickets] Requests Received or Approved Tickets —
   these features hide the filter icon and 3-dot (kebab) menu in the BS tree. */
const FnIsTicketsNoFilterFeature = (featureId?: string): boolean => {
    if (!featureId) return false;
    return (
        featureId === TicketsEnums.RequestsReceived
        || featureId === TicketsEnums.ApprovedTickets
    );
};

export {
    FnGetClientExplorerAutoFilter,
    FnIsClientMenuFeature,
    FnIsProspectMenuFeature,
    FnIsClientOrProspectFeature,
    FnIsProspectFilterFeature,
    FnIsTicketsNoFilterFeature,
};

