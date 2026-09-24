import { IFeatureItem, IUserAuthSession } from "../../context/allinterface/IMainApp";

/**
 * Extracts normalized permitted application names for the given auth user or context in memory.
 * Checks authUser properties, claims, raw payload, context authSession, and fallback defaults.
 */
export function fnGetPermittedApps(authUser?: unknown): string[] {
    const candidateValues: unknown[] = [];

    const userObj = authUser as Record<string, any> | undefined;

    if (userObj) {
        candidateValues.push(

            userObj.claims?.permittedapps,

        );
    }


    for (const val of candidateValues) {
        if (val === undefined || val === null) continue;

        if (Array.isArray(val)) {
            return val.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
        }

        if (typeof val === "string") {
            const trimmed = val.trim();
            if (!trimmed) continue;
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
                }
            } catch {
                // Not JSON, fall through to delimiter split
            }
            return trimmed
                .split(/[\s,;|]+/)
                .map((item) => item.trim().toLowerCase())
                .filter(Boolean);
        }

        if (typeof val === "object") {
            return Object.keys(val as Record<string, any>)
                .filter((k) => Boolean((val as Record<string, any>)[k]))
                .map((k) => k.trim().toLowerCase());
        }
    }

    // Default applications permitted in development/demo mode if not explicitly specified
    return ["netzoom", "visiostencils"];
}


/**
 * NodeType function for NetZoom features:
 * Gets permittedapps for authuser; if 'netzoom' is NOT in permitted list do not offer these features.
 */
export function fnNetzoom(authUser?: IUserAuthSession): boolean {
    const permittedApps: string[] = authUser?.permittedapps ?? fnGetPermittedApps(authUser);
    return permittedApps.includes("netzoom");
}

/**
 * NodeType function for VisioStencils features:
 * Gets permittedapps for authuser; if 'visiostencils' is NOT in permitted list do not offer these features.
 */
export function fnVss(authUser?: IUserAuthSession): boolean {
    const permittedApps: string[] = authUser?.permittedapps ?? fnGetPermittedApps(authUser);
    return permittedApps.includes("visiostencils") || permittedApps.includes("vss");
}

/**
 * NodeType function for Admin features:
 * If authrole != admin, do not offer these features:
 * - [settings] Client Identity Management
 * - settings/schedular
 * - settings/import
 */
export function fnAdmin(authUser?: IUserAuthSession): boolean {
    const role = authUser?.toolboxRole ?? "";
    const normalized = role.trim().toLowerCase();
    return normalized === "admin" || normalized === "administrator";
}

export function fnMcs(authUser?: IUserAuthSession): boolean {
    const role = authUser?.toolboxRole ?? "";
    const normalized = role.trim().toLowerCase();
    return normalized === "mcs";
}
export function fnGd(authUser?: IUserAuthSession): boolean {
    const role = authUser?.toolboxRole ?? "";
    const normalized = role.trim().toLowerCase();
    return normalized === "gd";
}

export function fnSe(authUser?: IUserAuthSession): boolean {
    const role = authUser?.toolboxRole ?? "";
    const normalized = role.trim().toLowerCase();
    return normalized === "se";
}

export function fnSse(authUser?: IUserAuthSession): boolean {
    const role = authUser?.toolboxRole ?? "";
    const normalized = role.trim().toLowerCase();
    return normalized === "sse";
}
/** Registry of NodeType evaluation functions. */
export const nodeTypeFnRegistry: Record<
    string,
    (authUser?: IUserAuthSession, context?: unknown) => boolean
> = {
    fnNetzoom,
    fnnetzoom: fnNetzoom,
    fnVss,
    fnvss: fnVss,
    fnAdmin,
    fnadmin: fnAdmin,
    fnGd,
    fngd: fnGd,
    fnMcs,
    fnmcs: fnMcs,
    fnSe,
    fnse: fnSe,
    fnSse,
    fnsse: fnSse,
};

/**
 * Evaluates whether a feature with the given NodeType should be offered.
 * Returns true if permitted, false if restricted.
 */
export function fnEvaluateNodeType(
    nodeType?: string | null,
    authUser?: IUserAuthSession,
    context?: unknown
): boolean {
    if (!nodeType || typeof nodeType !== "string" || !nodeType.trim()) {
        return true;
    }

    const normalized = nodeType.trim().toLowerCase();

    if (normalized === "fnnetzoom") {
        return fnNetzoom(authUser);
    }
    if (normalized === "fnvss") {
        return fnVss(authUser);
    }
    if (normalized === "fnadmin") {
        return fnAdmin(authUser);
    }
    if (normalized === "fngd") {
        return fnGd(authUser);
    }
    if (normalized === "fnmcs") {
        return fnMcs(authUser);
    }
    if (normalized === "fnse") {
        return fnSe(authUser);
    }
    if (normalized === "fnsse") {
        return fnSse(authUser);
    }


    const fn = nodeTypeFnRegistry[normalized] ?? nodeTypeFnRegistry[nodeType.trim()];
    if (typeof fn === "function") {
        return fn(authUser, context);
    }

    // If NodeType does not match a filter function, offer by default
    return true;
}

/**
 * Filters an array of IFeatureItem based on each feature's NodeType function.
 */
export function fnFilterPermittedFeatures(
    features: IFeatureItem[],
    authUser?: IUserAuthSession,
    context?: unknown
): IFeatureItem[] {
    if (!Array.isArray(features)) return [];
    return features.filter((item) =>
        fnEvaluateNodeType(item.NodeType, authUser, context)
    );
}
