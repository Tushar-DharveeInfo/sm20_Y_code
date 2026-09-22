/**
 * Resolves variables in HTML using the provided variable array. Variables inside HTML are formatted like [##SUBSCRIPTIONLIST##], [##BUSINESSNAME##], [##CONTACTNAME##], etc.
 *
 * @param html  HTML string using placeholders like [##VARIABLE##]
 * @param variables Array of variable records (BS information, contact information, subscription details, etc.)
 * @returns  HTML string with all variables resolved
 */
function FnResolvedHtmlVariable(html: string, variables: Record<string, unknown>[]): string {
    if (!html) return "";
    if (!Array.isArray(variables) || variables.length === 0) return html;

    // Build lookup dictionary mapping lowercase keys to their string values from the array of objects
    const varMap = new Map<string, string>();

    const setVar = (key: string, val: unknown) => {
        if (!key) return;
        const cleanKey = key
            .replace(/^\[##\s*/, "")
            .replace(/\s*##\]$/, "")
            .trim()
            .toLowerCase();

        let formatted = "";
        if (val === null || val === undefined) {
            formatted = "";
        } else if (typeof val === "string") {
            formatted = val;
        } else if (typeof val === "number" || typeof val === "boolean") {
            formatted = String(val);
        } else if (Array.isArray(val)) {
            formatted = val
                .map((v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "")))
                .join(", ");
        } else if (typeof val === "object") {
            formatted = JSON.stringify(val);
        } else {
            formatted = String(val);
        }

        varMap.set(cleanKey, formatted);
    };

    for (const obj of variables) {
        if (!obj || typeof obj !== "object") continue;

        // If object has explicit { key/name/variable, value }
        const explicitKey = (obj.key ?? obj.name ?? obj.variable ?? obj.token) as string | undefined;
        if (explicitKey && "value" in obj) {
            setVar(explicitKey, obj.value);
        }

        // Map every property key in lowercase
        for (const [k, v] of Object.entries(obj)) {
            setVar(k, v);
        }
    }

    // Match any [##KEY##] in HTML and replace by matching lowercase key
    return html.replace(/\[##\s*([^#]+?)\s*##\]/g, (match, p1: string) => {
        const key = p1.trim().toLowerCase();
        if (varMap.has(key)) {
            return varMap.get(key)!;
        }
        return "";
    });
}

export { FnResolvedHtmlVariable };
export default FnResolvedHtmlVariable;
