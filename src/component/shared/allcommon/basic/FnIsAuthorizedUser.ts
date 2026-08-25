/* Returns true when a user record from AUTH.GetUsers is enabled. */
export const isEnabledUser = (user: Record<string, unknown>): boolean => {
    const value = user.Enabled ?? user.Enabled;

    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1';
    }
    return false;
};

export const filterEnabledUsers = <T extends Record<string, unknown>>(users: T[]): T[] =>
    users.filter(isEnabledUser);

