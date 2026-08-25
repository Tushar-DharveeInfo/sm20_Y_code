const FnGetDisplayValue = (user: Record<string, unknown>, keys: string[]): string => {
    for (const key of keys) {
        const value = user[key];
        if (
            value !== undefined
            && value !== null
            && typeof value !== "boolean"
            && String(value).trim()
        ) {
            return String(value).trim();
        }
    }
    return "";
};

const FnGetAddressDisplay = (user: Record<string, unknown>): string => {
    const address = FnGetDisplayValue(user, ["Address"]);
    if (address) {
        return address;
    }
    const parts = [
        FnGetDisplayValue(user, ["Address1"]),
        FnGetDisplayValue(user, ["Address2"]),
        FnGetDisplayValue(user, ["City"]),
        FnGetDisplayValue(user, ["State"]),
        FnGetDisplayValue(user, ["Country"]),
        FnGetDisplayValue(user, ["Zip"]),
    ].filter(Boolean);
    return parts.join(", ");
};

export { FnGetAddressDisplay, FnGetDisplayValue };
