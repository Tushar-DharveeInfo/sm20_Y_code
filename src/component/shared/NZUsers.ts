/**
 * Fetches all users for this app's tenant (TENANT_NICKNAME) from the
 * CloudRun `getnzUsers` endpoint.
 */
import { getFirebaseToken, getRuntimeConfig } from '@n20a/libauth';
import type { TenantUser } from '@n20a/libfsdb'

interface GetNZUsersResult {
    success: boolean;
    users?: TenantUser[];
    error?: string;
}

/**
 * Reads the tenantId from TENANT_NICKNAME (via getRuntimeConfig) and calls
 * CloudRun's `getnzUsers` function (POST /api/users/getnzusers) to return all
 * users for that tenant.
 */
const getNZUsers = async (): Promise<TenantUser[]> => {
    const { TENANT_NICKNAME: tenantId, CLOUDRUN_URL: cloudRunUrl } = getRuntimeConfig();

    if (!tenantId) {
        throw new Error('TENANT_NICKNAME is not configured');
    }
    if (!cloudRunUrl) {
        throw new Error('CLOUDRUN_URL is not configured');
    }

    const token = await getFirebaseToken();
    if (!token) {
        throw new Error('User must be authenticated to fetch NZ users');
    }

    const response = await fetch(`${cloudRunUrl}/api/users/getnzusers`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ data: { tenantId } })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`getnzUsers request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const payload = await response.json() as { result: GetNZUsersResult };

    if (!payload.result?.success) {
        throw new Error(payload.result?.error || 'Failed to fetch NZ users');
    }

    return payload.result.users ?? [];
};

export { getNZUsers };
export type { TenantUser };
