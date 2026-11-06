/**
 * Utility functions for handling special users and netzoom tenant
 */

import type { TenantUser } from '@n20a/libfsdb';
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks';

export const NETZOOM_TENANT_ID = 'netzoom-uhjpe';

export const PROTECTED_USERS = [
  {
    email: 'mgsy@netzoom.com',
    uid: 'v3bwPzA65Bc1YM6yWsoUcFBI2bl1',
    tenantId: NETZOOM_TENANT_ID,
    description: 'Special purpose netzoom user'
  }
];

export type ToolboxRole =  string;

export function isProtectedUser(user: TenantUser): boolean {
  return PROTECTED_USERS.some(
    p => user.email === p.email || user.uid === p.uid || user.isProtectedUser
  );
}

export function isNetzoomTenantUser(user: TenantUser): boolean {
  return user.tenantId === NETZOOM_TENANT_ID;
}

export function getToolboxRoleDisplay(role: ToolboxRole | string | undefined): string {
  if (!role) return 'no role';
  const n = role.toLowerCase();
  switch (n) {
    case 'admin': return 'admin';
    case 'useradmin': return 'useradmin';
    case 'user': return 'user';
    case 'vss': return 'vss';
    case 'netzoom': return 'netzoom';
    case 'se': return 'se';
    case 'sse': return 'sse';
    case 'mcs': return 'mcs';
    case 'gd': return 'gd';
    case 'other': return 'other';
    default: return typeof role === 'string' ? role.toLowerCase() : 'no role';
  }
}

export function getToolboxRoleBadgeColor(role: ToolboxRole | string | undefined): string {
  if (!role) return 'ci-badge-other';
  const n = role.toLowerCase();
  switch (n) {
    case 'admin': return 'ci-badge-admin';
    case 'useradmin': return 'ci-badge-useradmin';
    case 'user': return 'ci-badge-user';
    case 'vss': return 'ci-badge-vss';
    case 'netzoom': return 'ci-badge-netzoom';
    case 'mcs': return 'ci-badge-mcs';  
    case 'se': return 'ci-badge-se';
    case 'sse': return 'ci-badge-sse';
    case 'gd': return 'ci-badge-gd';
    case 'other': return 'ci-badge-other';
    default: return 'ci-badge-other';
  }
}

export function extractToolboxRole(customClaims: Record<string, unknown> | undefined): ToolboxRole | undefined 
{
  
const mainAppContext = useMainAppContext();  
const smRoles = mainAppContext.authSession.smRoles; 

  if (!customClaims) return undefined;
  const role = customClaims.toolboxRole;
  if (typeof role === 'string' && smRoles.includes(role as ToolboxRole)) {
    return role as ToolboxRole;
  }
  return undefined;
}

export const AvailableApps = ['saas20', 'sm20', 'service20', 'netzoom', 'visiostencils'] as const;
export type PermittedApp = typeof AvailableApps[number];

const LEGACY_TO_CURRENT_APP_MAP: Record<string, PermittedApp> = {
  saas: 'saas20',
  sm: 'sm20',
  service: 'service20',
  netzoom: 'netzoom',
  visiostencils: 'visiostencils'
};

export function extractPermittedApps(user: TenantUser | undefined): PermittedApp[] {
  if (!user) return [];
  const apps = user.customClaims?.permittedapps;
  if (!Array.isArray(apps)) return [];
  const normalized = apps
    .filter((a): a is string => typeof a === 'string')
    .map(a => LEGACY_TO_CURRENT_APP_MAP[a] || a)
    .filter((a): a is PermittedApp => AvailableApps.includes(a as PermittedApp));

  return Array.from(new Set(normalized));
}

export function getProtectedUserInfo(user: TenantUser) {
  return PROTECTED_USERS.find(p => user.email === p.email || user.uid === p.uid);
}
