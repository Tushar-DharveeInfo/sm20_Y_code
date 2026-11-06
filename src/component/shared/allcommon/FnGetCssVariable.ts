
const cssVarCache = new Map<string, string>();

if (typeof window !== "undefined" && typeof MutationObserver !== "undefined" && typeof document !== "undefined" && document.documentElement) {
    const observer = new MutationObserver(() => {
        cssVarCache.clear();
    });
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["style", "class", "data-theme"],
    });
}

const FnClearCssVariableCache = (): void => {
    cssVarCache.clear();
};

const FnGetCssVariable = (
    name: string,
    fallbackValue: string = "unset"
): string => {
    try {
        if (!name || typeof name !== "string" || !name.length) {
            return fallbackValue;
        }

        const variableName = name.startsWith("--")
            ? name
            : `--${name}`;

        if (cssVarCache.has(variableName)) {
            return cssVarCache.get(variableName)!;
        }

        const rootElement = typeof document !== "undefined" ? document.documentElement : null;

        if (!rootElement) {
            return fallbackValue;
        }

        const value = getComputedStyle(rootElement)
            ?.getPropertyValue(variableName)
            ?.trim();

        const result = value || fallbackValue;
        if (value) {
            cssVarCache.set(variableName, result);
        }
        return result;
    } catch (error) {
        console.error("FnGetCssVariable error:", error);
        return fallbackValue;
    }
};

export { FnGetCssVariable, FnClearCssVariableCache };