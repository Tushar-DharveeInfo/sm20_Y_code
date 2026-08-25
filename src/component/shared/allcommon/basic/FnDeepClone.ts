
// This function creates a deep clone of tree data
function FnDeepClone<T>(obj: T, seen = new WeakMap<object, unknown>()): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Handle React elements: return them as-is
    if ((obj as any).$$typeof && (obj as any).$$typeof.toString() === 'Symbol(react.element)') {
        return obj;
    }

    // Detect circular references
    if (seen.has(obj)) {
        return seen.get(obj) as T;
    }

    let clonedObj: unknown;

    if (Array.isArray(obj)) {
        clonedObj = [];
        seen.set(obj, clonedObj); // Track reference before recursion
        (clonedObj as unknown[]).push(...obj.map(item => FnDeepClone(item, seen)));
    } else if (obj instanceof HTMLElement) {
        clonedObj = obj.cloneNode(true); // Clone HTML elements
    } else if (obj.constructor && obj.constructor.name === 'Object') {
        clonedObj = {} as Record<string, unknown>;
        seen.set(obj, clonedObj); // Track reference before recursion
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                (clonedObj as Record<string, unknown>)[key] = FnDeepClone(obj[key as keyof typeof obj], seen);
            }
        }
    } else {
        // If it's an unrecognized type, return it as-is
        return obj;
    }

    return clonedObj as T;
}

export { FnDeepClone };
