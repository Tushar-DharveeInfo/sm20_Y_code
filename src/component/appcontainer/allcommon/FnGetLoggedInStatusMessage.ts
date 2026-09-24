import type {
    IUserAuthSession,
} from "../../shared/context/allinterface/IMainApp";

type TSubscriberProduct = "NetZoom" | "Visio Stencils" | string;

/* Resolves display name from the signed-in IUserAuthSession. */
const FnGetAuthDisplayName = (authSession?: IUserAuthSession | null): string => {
    if (!authSession) {
        return "";
    }
    return (authSession.ImpersonatedUser || authSession.ImpersonatedEmail || "").trim();
};

/* Resolves subscriber product name from IUserAuthSession. */
const FnGetSubscriberProduct = (
    authSession?: IUserAuthSession | null
): TSubscriberProduct | undefined => {
    const product = authSession?.ProductName;
    return product ? product.trim() : undefined;
};

/*
 * Builds the status-bar login identity line from IUserAuthSession.
 * Example: "You are logged in as Jane Doe NetZoom. bid=bid_103. cid=cid_bid_103_1"
 */
const FnGetLoggedInStatusMessage = (
    authSession?: IUserAuthSession | null,
): string => {
    const displayName = FnGetAuthDisplayName(authSession);
    const subscriberProduct = FnGetSubscriberProduct(authSession);
    const bid = String(authSession?.bid ?? "").trim();
    const cid = String(authSession?.cid ?? "").trim();
    const currentUser = authSession?.username
    const isImpersonating = Boolean(authSession?.email &&
        authSession?.ImpersonatedEmail.toLowerCase() !== authSession?.email.toLowerCase()
    );



    let identity = "You are logged in as a guest";
    if (displayName) {
        identity = `You are logged in as ${displayName} ${isImpersonating ? ` and Impersonating: ${currentUser}` : ''}`;
    } else if (displayName && subscriberProduct) {
        identity = `You are logged in as ${displayName} ${subscriberProduct}`;
    } else if (!authSession) {
        identity = "You are logged in as a guest user";
    }

    const scopeParts: string[] = [];
    if (bid) scopeParts.push(`bid=${bid}`);
    if (cid) scopeParts.push(`cid=${cid}`);
    if (!scopeParts.length) {
        return identity;
    }
    return `${identity}. ${scopeParts.join(". ")}`;
};

export { FnGetLoggedInStatusMessage, FnGetAuthDisplayName, FnGetSubscriberProduct };
export type { TSubscriberProduct };
