/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks';

import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  UsersIcon,
  ShieldCheckIcon,
  XMarkIcon,
  CheckIcon,
  KeyIcon,
  ClipboardDocumentListIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CogIcon,
  ArrowDownTrayIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';

import type {
  Tenant,
  TenantUser,
  UpdateTenantRequest,
  UpdateUserRequest
} from '@n20a/libfsdb';

import IdentityProviderManager from './IdentityProviderManager';
import { CloudRunClientService } from '@n20a/libfsdb' //'./services/cloudrun-client-service';
import {
  isProtectedUser,
  getToolboxRoleDisplay,
  getToolboxRoleBadgeColor,
  extractToolboxRole,
  extractPermittedApps,
  getProtectedUserInfo
} from './netzoom-utils';
import './ClientIdentity.css';

interface IClientIdentityProps {
  /** Whether the current user has admin-level access */
  isAdmin: boolean;
  /** The toolbox role of the current user (controls what UI is shown) */
  toolboxRole: string;
  /** Returns a valid Bearer token for CloudRun API calls */
  getAuthToken: () => Promise<string>;
  /** The ID of the current user's business */
  selectedtenantshortname?: string;

  /** Optional override for the CloudRun API base URL */
  cloudRunUrl?: string;
}

interface LogEntry {
  timestamp: string;
  event: string;
  details: string;
}

const exportToCSV = (data: LogEntry[], filename: string) => {
  if (!data.length) { alert('No data to export'); return; }
  const csv = ['Date/Time,Event,Details', ...data.map(r => [`"${new Date(r.timestamp).toLocaleString()}"`, `"${r.event}"`, `"${r.details}"`].join(','))].join('\n');
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
};

const exportToExcel = (data: LogEntry[], filename: string) => {
  if (!data.length) { alert('No data to export'); return; }
  const tsv = ['Date/Time\tEvent\tDetails', ...data.map(r => [new Date(r.timestamp).toLocaleString(), r.event, r.details].join('\t'))].join('\n');
  triggerDownload(new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' }), `${filename}.xlsx`);
};

const triggerDownload = (blob: Blob, filename: string) => {
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const ClientIdentity = ({ isAdmin, toolboxRole, getAuthToken, selectedtenantshortname, cloudRunUrl }: IClientIdentityProps) => {

const mainAppContext = useMainAppContext(); 
const SmRolesArray = mainAppContext.authSession.smRoles; 
const AvailableAppsArray = mainAppContext.authSession.availableApps; 

  const isCurrentUserAdmin = isAdmin || toolboxRole === 'admin' || toolboxRole === 'netzoom';

  // Service instance (stable across renders via ref)
  const serviceRef = useRef<CloudRunClientService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = new CloudRunClientService(getAuthToken, cloudRunUrl);
  }
  const service = serviceRef.current;

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'providers' | 'logs'>('users');
  const [isLoading, setIsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [alertState, setAlertState] = useState<{ type: string; message: string } | null>(null);

  const [tenantSortField, setTenantSortField] = useState<'displayName' | 'tenantId' | 'createdAt' | 'userCount'>('displayName');
  const [tenantSortDir, setTenantSortDir] = useState<'asc' | 'desc'>('asc');
  const [userSortField, setUserSortField] = useState<'email' | 'displayName' | 'toolboxRole' | 'createdAt'>('email');
  const [userSortDir, setUserSortDir] = useState<'asc' | 'desc'>('asc');
  const [leftWidthPct, setLeftWidthPct] = useState(40);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const [showTenantModal, setShowTenantModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCustomClaimsModal, setShowCustomClaimsModal] = useState(false);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [showVerificationLinkModal, setShowVerificationLinkModal] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'tenant' | 'user'; id: string; name: string } | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [customClaimsUser, setCustomClaimsUser] = useState<TenantUser | null>(null);

  const [emailVerificationStatus, setEmailVerificationStatus] = useState<{
    tenantId: string; tenantDisplayName: string; projectId: string; emailInheritanceEnabled: boolean; message: string;
  } | null>(null);
  const [isVerifyingEmailInheritance, setIsVerifyingEmailInheritance] = useState(false);

  const [isSendingVerificationEmail, setIsSendingVerificationEmail] = useState(false);
  const [isVerifyingEmailManually, setIsVerifyingEmailManually] = useState(false);
  const [verificationLinkData, setVerificationLinkData] = useState<{ email: string; link: string; instructions: string[] } | null>(null);

  const [allTenantUserCounts, setAllTenantUserCounts] = useState<Record<string, number>>({});
  const [isLoadingUserCounts, setIsLoadingUserCounts] = useState(false);
  const lastFetchedTenantsRef = useRef<string>('');

  const [tenantForm, setTenantForm] = useState({ displayName: '', allowPasswordSignup: true, enableEmailLinkSignin: false, enableAnonymousUser: false });
  const [userForm, setUserForm] = useState({ email: '', password: '', displayName: '', emailVerified: false, disabled: false, toolboxRole: 'other' as string });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [editableCustomClaims, setEditableCustomClaims] = useState<Record<string, any>>({});
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);
  const [activityLogs, setActivityLogs] = useState<Record<string, LogEntry[]>>({});

  const showAlert = useCallback((type: string, message: string) => {
    setAlertState({ type, message });
  }, []);

  const addLogEntry = useCallback((tenantId: string, event: string, details: string) => {
    setActivityLogs(prev => ({
      ...prev,
      [tenantId]: [{ timestamp: new Date().toISOString(), event, details }, ...(prev[tenantId] || [])].slice(0, 100)
    }));
  }, []);

  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;
    const dragging = { active: true };
    document.body.style.cursor = 'col-resize';
    (document.body.style as any).userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!dragging.active) return;
      const rect = container.getBoundingClientRect();
      const rawPct = ((ev.clientX - rect.left) / rect.width) * 100;
      const minPct = (200 / rect.width) * 100;
      setLeftWidthPct(Math.max(minPct, Math.min(100 - minPct, rawPct)));
    };
    const onUp = () => {
      dragging.active = false;
      document.body.style.cursor = '';
      (document.body.style as any).userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [])

  const sortedTenants = useMemo(() => [...tenants].sort((a, b) => {
    if (tenantSortField === 'userCount') {
      const an = allTenantUserCounts[a.tenantId] ?? -1;
      const bn = allTenantUserCounts[b.tenantId] ?? -1;
      return tenantSortDir === 'asc' ? an - bn : bn - an;
    }
    const av = tenantSortField === 'createdAt' ? (a.createdAt || '') : (a[tenantSortField] || '');
    const bv = tenantSortField === 'createdAt' ? (b.createdAt || '') : (b[tenantSortField] || '');
    return tenantSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  }), [tenants, tenantSortField, tenantSortDir, allTenantUserCounts]);

  const sortedUsers = useMemo(() => [...users].sort((a, b) => {
    let av = '', bv = '';
    if (userSortField === 'createdAt') { av = a.metadata?.creationTime || ''; bv = b.metadata?.creationTime || ''; }
    else if (userSortField === 'toolboxRole') { av = extractToolboxRole(a.customClaims) || (a.customClaims?.toolboxRole as string) || ''; bv = extractToolboxRole(b.customClaims) || (b.customClaims?.toolboxRole as string) || ''; }
    else { av = a[userSortField] || ''; bv = b[userSortField] || ''; }
    return userSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  }), [users, userSortField, userSortDir]);

  const loadTenants = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await service.listTenants();
      if (res.success) setTenants(res.data?.items || []);
      else showAlert('error', res.error?.message || 'Failed to load tenants');
    } catch (err: any) { showAlert('error', err?.message || 'Failed to load tenants'); }
    finally { setIsLoading(false); }
  }, [service, showAlert]);

useEffect(() => {
  if (selectedtenantshortname) {
    // Perform any action needed when selectedtenantshortname changes
    // iterate through the tenants to find the one matching the selectedtenantshortname
    const matchingTenant = tenants.find(t => t.tenantId === selectedtenantshortname);
    if (matchingTenant) {
      setSelectedTenant(matchingTenant);
    }
  }
}, [tenants, selectedtenantshortname]);


  const loadUsers = useCallback(async () => {
    if (!selectedTenant) { setUsers([]); return; }
    try {
      setIsUsersLoading(true);
      document.body.style.cursor = 'wait';
      const res = await service.listUsers(selectedTenant.tenantId);
      if (res.success) {
        setUsers(res.data?.items || []);
        addLogEntry(selectedTenant.tenantId, 'Users Loaded', `Loaded ${res.data?.items?.length || 0} users for ${selectedTenant.displayName}`);
      } else showAlert('error', res.error?.message || 'Failed to load users');
    } catch (err: any) { showAlert('error', err?.message || 'Failed to load users'); }
    finally { setIsUsersLoading(false); document.body.style.cursor = 'default'; }
  }, [selectedTenant, service, showAlert, addLogEntry]);

  const fetchAllTenantUserCounts = useCallback(async () => {
    if (!tenants.length) return;
    setIsLoadingUserCounts(true);
    const counts: Record<string, number> = {};
    await Promise.all(tenants.map(async t => {
      try {
        const res = await service.listUsers(t.tenantId);
        if (res.success && res.data) counts[t.tenantId] = res.data.items.length;
      } catch { /* ignore per-tenant errors */ }
    }));
    setAllTenantUserCounts(counts);
    setIsLoadingUserCounts(false);
  }, [tenants, service]);

  useEffect(() => { loadTenants(); }, [loadTenants]);
  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => {
    if (selectedTenant) setAllTenantUserCounts(prev => ({ ...prev, [selectedTenant.tenantId]: users.length }));
  }, [selectedTenant, users]);
  useEffect(() => {
    const key = tenants.map(t => t.tenantId).sort().join(',');
    if (tenants.length > 0 && key !== lastFetchedTenantsRef.current && !isLoadingUserCounts) {
      lastFetchedTenantsRef.current = key;
      fetchAllTenantUserCounts();
    }
  }, [tenants, isLoadingUserCounts, fetchAllTenantUserCounts]);

  // ---- Tenant CRUD ----
  const handleCreateTenant = useCallback(async () => {
    if (!tenantForm.displayName || tenantForm.displayName.trim().length < 4 || tenantForm.displayName.trim().length > 20) { showAlert('error', 'Display name must be 4-20 characters'); return; }
    if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(tenantForm.displayName)) { showAlert('error', 'Must start with a letter; only letters, numbers and hyphens allowed (no periods)'); return; }
    try {
      setIsOperationLoading(true);
      const res = await service.createTenant(tenantForm);
      if (res.success) {
        showAlert('success', 'Tenant created successfully.');
        addLogEntry(res.data?.tenantId || 'unknown', 'Tenant Created', `Tenant '${tenantForm.displayName}' was created`);
        setShowTenantModal(false);
        setTenantForm({ displayName: '', allowPasswordSignup: true, enableEmailLinkSignin: false, enableAnonymousUser: false });
        await loadTenants();
      } else showAlert('error', res.error?.message || 'Failed to create tenant');
    } catch (err: any) { showAlert('error', err?.message || 'Failed to create tenant'); }
    finally { setIsOperationLoading(false); }
  }, [tenantForm, service, showAlert, loadTenants, addLogEntry]);

  const handleUpdateTenant = useCallback(async () => {
    if (!editingTenant) return;
    if (tenantForm.displayName && (tenantForm.displayName.trim().length < 4 || tenantForm.displayName.trim().length > 20)) { showAlert('error', 'Display name must be 4-20 characters'); return; }
    if (tenantForm.displayName && !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(tenantForm.displayName)) { showAlert('error', 'Must start with a letter; only letters, numbers and hyphens allowed (no periods)'); return; }
    try {
      setIsOperationLoading(true);
      const req: UpdateTenantRequest = { ...tenantForm, tenantId: editingTenant.tenantId };
      const res = await service.updateTenant(req);
      if (res.success) {
        showAlert('success', 'Tenant updated successfully');
        addLogEntry(editingTenant.tenantId, 'Tenant Updated', `Tenant '${tenantForm.displayName}' settings updated`);
        setShowTenantModal(false); setEditingTenant(null);
        setTenantForm({ displayName: '', allowPasswordSignup: true, enableEmailLinkSignin: false, enableAnonymousUser: false });
        await loadTenants();
      } else showAlert('error', res.error?.message || 'Failed to update tenant');
    } catch (err: any) { showAlert('error', err?.message || 'Failed to update tenant'); }
    finally { setIsOperationLoading(false); }
  }, [editingTenant, tenantForm, service, showAlert, loadTenants, addLogEntry]);

  const handleDeleteTenant = useCallback(async (tenantId: string) => {
    const name = deleteTarget?.name || tenantId;
    try {
      setIsOperationLoading(true);
      const res = await service.deleteTenant(tenantId);
      if (res.success) {
        showAlert('success', 'Tenant deleted successfully');
        addLogEntry(tenantId, 'Tenant Deleted', `Tenant '${name}' was deleted`);
        if (selectedTenant?.tenantId === tenantId) { setSelectedTenant(null); setUsers([]); }
        await loadTenants();
        setShowDeleteModal(false); setDeleteTarget(null);
      } else showAlert('error', res.error?.message || 'Failed to delete tenant');
    } catch (err: any) { showAlert('error', err?.message || 'Failed to delete tenant'); }
    finally { setIsOperationLoading(false); }
  }, [selectedTenant, deleteTarget, service, showAlert, loadTenants, addLogEntry]);

  // ---- User CRUD ----
  const handleCreateUser = useCallback(async () => {
    if (!selectedTenant) return;
    if (userForm.displayName && !/^[a-zA-Z0-9-]+$/.test(userForm.displayName)) {
      showAlert('error', userForm.displayName.includes('@')
        ? 'Display Name looks like an email — put the email in the Email field instead, and use only letters, numbers and hyphens for Display Name'
        : 'Display Name can only contain letters, numbers and hyphens (no spaces, periods, or symbols)');
      return;
    }
    if (!userForm.email.toLowerCase().includes(selectedTenant.displayName.toLowerCase())) { showAlert('error', `Email must contain tenant name "${selectedTenant.displayName}"`); return; }
    if (!userForm.password || userForm.password.length < 6) { showAlert('error', 'Password must be at least 6 characters'); return; }
    try {
      setIsOperationLoading(true);
      const res = await service.createUser(selectedTenant.tenantId, userForm);
      if (res.success) {
        const verificationLink = (res as any).data?.verificationLink;
        if (verificationLink) {
          const ok = window.confirm(`User created!\n\nEmail: ${userForm.email}\n\nCopy verification link?`);
          if (ok) {
            try { await navigator.clipboard.writeText(verificationLink); showAlert('success', 'User created and verification link copied!'); }
            catch { prompt('Copy this verification link:', verificationLink); showAlert('success', 'User created!'); }
          } else showAlert('success', 'User created. Verify email later.');
        } else showAlert('success', 'User created successfully.');
        addLogEntry(selectedTenant.tenantId, 'User Created', `User ${userForm.email} was created`);
        setShowUserModal(false);
        setUserForm({ email: '', password: '', displayName: '', emailVerified: false, disabled: false, toolboxRole: 'other' });
        setPasswordVisible(false);
        await loadUsers();
      } else showAlert('error', res.error?.message || 'Failed to create user');
    } catch (err: any) { showAlert('error', err?.message || 'Failed to create user'); }
    finally { setIsOperationLoading(false); }
  }, [selectedTenant, userForm, service, showAlert, loadUsers, addLogEntry]);

  const handleUpdateUser = useCallback(async () => {
    if (!selectedTenant || !editingUser) return;
    if (userForm.displayName && !/^[a-zA-Z0-9-]+$/.test(userForm.displayName)) {
      showAlert('error', userForm.displayName.includes('@')
        ? 'Display Name looks like an email — put the email in the Email field instead, and use only letters, numbers and hyphens for Display Name'
        : 'Display Name can only contain letters, numbers and hyphens (no spaces, periods, or symbols)');
      return;
    }
    if (userForm.email !== editingUser.email && !userForm.email.toLowerCase().includes(selectedTenant.displayName.toLowerCase())) { showAlert('error', `Email must contain tenant name "${selectedTenant.displayName}"`); return; }
    try {
      setIsOperationLoading(true);
      const req: UpdateUserRequest = { ...userForm, uid: editingUser.uid };
      const res = await service.updateUser(selectedTenant.tenantId, req);
      if (res.success) {
        showAlert('success', userForm.emailVerified ? 'Email marked as verified' : 'User updated successfully');
        addLogEntry(selectedTenant.tenantId, 'User Updated', `User ${editingUser.email} was updated`);
        setTimeout(() => {
          setShowUserModal(false); setEditingUser(null);
          setUserForm({ email: '', password: '', displayName: '', emailVerified: false, disabled: false, toolboxRole: 'other' });
          setPasswordVisible(false);
        }, 1200);
        await loadUsers();
      } else showAlert('error', res.error?.message || 'Failed to update user');
    } catch (err: any) { showAlert('error', err?.message || 'Failed to update user'); }
    finally { setIsOperationLoading(false); }
  }, [selectedTenant, editingUser, userForm, service, showAlert, loadUsers, addLogEntry]);

  const handleDeleteUser = useCallback(async (uid: string) => {
    if (!selectedTenant) return;
    const name = deleteTarget?.name || uid;
    try {
      setIsOperationLoading(true);
      const res = await service.deleteUser(selectedTenant.tenantId, uid);
      if (res.success) {
        showAlert('success', 'User deleted successfully');
        addLogEntry(selectedTenant.tenantId, 'User Deleted', `User ${name} was deleted`);
        await loadUsers();
        setShowDeleteModal(false); setDeleteTarget(null);
      } else showAlert('error', res.error?.message || 'Failed to delete user');
    } catch (err: any) { showAlert('error', err?.message || 'Failed to delete user'); }
    finally { setIsOperationLoading(false); }
  }, [selectedTenant, deleteTarget, service, showAlert, loadUsers, addLogEntry]);

  // ---- Custom claims ----
  const handleEditCustomClaims = async (user: TenantUser) => {
    setCustomClaimsUser(user); setIsLoadingClaims(true); setShowCustomClaimsModal(true);
    try 
    {
      const tenantId = selectedTenant?.tenantId || 'main';
      const res = await service.getCustomClaims(tenantId, user.uid);
      if (res.success && res.data) 
      {
        const claims = res.data.customClaims;
        const filtered: Record<string, any> = {};
        const systemFields = ['tenant', 'assignedAt', 'assignedBy', 'lastModified', 'modifiedInContext'];
        for (const [k, v] of Object.entries(claims)) {
          if (!systemFields.includes(k)) filtered[k] = v;
        }
        setEditableCustomClaims({ toolboxRole: 'other', permittedapps: [], ...filtered });
        showAlert('success', `Claims loaded for ${user.email}`);
      } 
      else 
      {
        setEditableCustomClaims({ toolboxRole: 'other', permittedapps: [] });
        showAlert('warning', `Claims loaded with defaults for ${user.email}`);
      }
    } 
    catch 
    {
      setEditableCustomClaims({ toolboxRole: 'other', permittedapps: [] });
      showAlert('warning', `Claims loaded with defaults for ${user.email} (API error)`);
    } finally { setIsLoadingClaims(false); }
  };

  const handleSaveCustomClaims = async () => {
    if (!customClaimsUser || !selectedTenant) return;

/*
how to add/delete more roles and permitted apps in the custom claims
This change should be done in this file as well as in cloud run under user.controller.
*/

    setIsOperationLoading(true);
    try {
      const toolboxRole = (editableCustomClaims.toolboxRole || 'other').toLowerCase();
      const permittedapps: string[] = Array.isArray(editableCustomClaims.permittedapps) ? editableCustomClaims.permittedapps : [];
      const res = await service.setToolboxRole(selectedTenant.tenantId, customClaimsUser.uid, toolboxRole, permittedapps);
      if (res.success) {
        showAlert('success', `Claims updated for ${customClaimsUser.email}`);
        setShowCustomClaimsModal(false); setCustomClaimsUser(null);
        await loadUsers();
      } else showAlert('error', res.error?.message || 'Failed to update claims');
    } catch (err: any) { showAlert('error', `Failed to save claims: ${err.message}`); }
    finally { setIsOperationLoading(false); }
  };

  // ---- Email verification ----
  const handleVerifyEmailInheritance = useCallback(async (tenantId: string) => {
    try {
      setIsVerifyingEmailInheritance(true);
      const res = await service.verifyEmailInheritance(tenantId);
      if (res.success) {
        setEmailVerificationStatus({ tenantId, tenantDisplayName: res.tenantDisplayName || tenantId, projectId: res.projectId || 'project', emailInheritanceEnabled: res.emailInheritanceEnabled || false, message: res.message || 'Verification completed' });
        setShowEmailVerificationModal(true);
      } else showAlert('error', res.error?.message || 'Failed to verify');
    } catch (err: any) { showAlert('error', err?.message || 'Failed to verify'); }
    finally { setIsVerifyingEmailInheritance(false); }
  }, [service, showAlert]);

  const handleSendVerificationEmail = useCallback(async (user: TenantUser) => {
    if (!selectedTenant || !user.email) return;
    try {
      setIsSendingVerificationEmail(true);
      const res = await service.sendVerificationEmail(selectedTenant.tenantId, user.email);
      if (res.success) {
        if (res.verificationLink) {
          setVerificationLinkData({ email: user.email, link: res.verificationLink, instructions: res.instructions || [] });
          setShowVerificationLinkModal(true);
        }
        showAlert('success', res.message || 'Verification email generated');
        addLogEntry(selectedTenant.tenantId, 'Verification Email', `Custom verification email generated for ${user.email}`);
      } else showAlert('error', res.error?.message || 'Failed to send verification email');
    } catch (err: any) { showAlert('error', err?.message || 'Failed to send'); }
    finally { setIsSendingVerificationEmail(false); }
  }, [selectedTenant, service, showAlert, addLogEntry]);

  const handleVerifyEmailManually = useCallback(async (user: TenantUser) => {
    if (!selectedTenant || !user.email) return;
    try {
      setIsVerifyingEmailManually(true);
      const res = await service.verifyEmailManually(selectedTenant.tenantId, user.email);
      if (res.success) {
        showAlert('success', res.message || 'Email verified manually');
        addLogEntry(selectedTenant.tenantId, 'Email Verified', `Email manually verified for ${user.email}`);
        await loadUsers();
      } else showAlert('error', res.error?.message || 'Failed to verify email');
    } catch (err: any) { showAlert('error', err?.message || 'Failed to verify'); }
    finally { setIsVerifyingEmailManually(false); }
  }, [selectedTenant, service, showAlert, loadUsers, addLogEntry]);

  // ---- Export functions ----
  const exportUsersToCSV = useCallback(() => {
    if (!users.length) return;
    const rows = users.map(u => ({ timestamp: u.metadata?.creationTime || '', event: u.email || '', details: `${u.displayName || ''} | ${u.customClaims?.toolboxRole || 'other'} | ${u.disabled ? 'Disabled' : 'Active'}` }));
    const csv = ['Email,Display Name,Role,Permitted Apps,Status,Date Created', ...users.map(u => [`"${u.email || ''}"`, `"${u.displayName || ''}"`, `"${u.customClaims?.toolboxRole || 'other'}"`, `"${extractPermittedApps(u).join('; ')}"`, `"${u.disabled ? 'Disabled' : 'Active'}"`, `"${u.metadata?.creationTime ? new Date(u.metadata.creationTime).toLocaleDateString() : ''}"`].join(','))].join('\n');
    console.log(rows); // suppress warning
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${selectedTenant?.displayName || 'tenant'}_users.csv`);
  }, [users, selectedTenant]);

  const exportUsersToExcel = useCallback(() => {
    if (!users.length) return;
    const tsv = ['Email\tDisplay Name\tRole\tPermitted Apps\tStatus\tDate Created', ...users.map(u => [u.email || '', u.displayName || '', String(u.customClaims?.toolboxRole || 'other'), extractPermittedApps(u).join('; '), u.disabled ? 'Disabled' : 'Active', u.metadata?.creationTime ? new Date(u.metadata.creationTime).toLocaleDateString() : ''].join('\t'))].join('\n');
    triggerDownload(new Blob([tsv], { type: 'application/vnd.ms-excel' }), `${selectedTenant?.displayName || 'tenant'}_users.xls`);
  }, [users, selectedTenant]);

  const exportTenantsToCSV = useCallback(() => {
    if (!tenants.length) return;
    const csv = ['Tenant Name,Tenant ID,User Count,Password Signup,Email Link,Anonymous', ...tenants.map(t => [`"${t.displayName || ''}"`, `"${t.tenantId || ''}"`, `"${allTenantUserCounts[t.tenantId] || 0}"`, `"${t.allowPasswordSignup ? 'On' : 'Off'}"`, `"${t.enableEmailLinkSignin ? 'On' : 'Off'}"`, `"${t.enableAnonymousUser ? 'On' : 'Off'}"`].join(','))].join('\n');
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'tenants.csv');
  }, [tenants, allTenantUserCounts]);

  const exportTenantsToExcel = useCallback(() => {
    if (!tenants.length) return;
    const tsv = ['Tenant Name\tTenant ID\tUser Count\tPassword Signup\tEmail Link\tAnonymous', ...tenants.map(t => [t.displayName || '', t.tenantId || '', String(allTenantUserCounts[t.tenantId] || 0), t.allowPasswordSignup ? 'On' : 'Off', t.enableEmailLinkSignin ? 'On' : 'Off', t.enableAnonymousUser ? 'On' : 'Off'].join('\t'))].join('\n');
    triggerDownload(new Blob([tsv], { type: 'application/vnd.ms-excel' }), 'tenants.xls');
  }, [tenants, allTenantUserCounts]);

  if (isLoading) {
    return (
      <div className="ci-empty-state">
        <div className="ci-loading-message">
          <div className="ci-spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  const alertClass = alertState?.type === 'success' ? 'ci-alert-success' : alertState?.type === 'error' ? 'ci-alert-error' : alertState?.type === 'warning' ? 'ci-alert-warning' : 'ci-alert-info';

  return (
    <ErrorBoundary FallbackComponent={({ error }) => (
      <div className="ci-alert ci-alert-error">
        <div className="ci-alert-inner">
          <span className="ci-alert-message">Error: {error.message}</span>
        </div>
      </div>
    )}>
      <div className="ci-container">
        {alertState && (
          <div className={`ci-alert ${alertClass}`}>
            <div className="ci-alert-inner">
              <p className="ci-alert-message">{alertState.message}</p>
              <button type="button" className="ci-alert-close" onClick={() => setAlertState(null)}>
                <XMarkIcon className="ci-icon-sm" />
              </button>
            </div>
          </div>
        )}

        <div ref={splitContainerRef} className="ci-split-container">

          {/* ===== LEFT PANE: TENANTS ===== */}
          <div className="ci-split-pane" style={{ width: `${leftWidthPct}%` }}>
            <div className="ci-pane-header">
              <div className="ci-pane-header-row">
                <div className="ci-flex-items">
                  <h2 className="ci-card-title">
                    <ShieldCheckIcon className="ci-card-title-icon" />
                    Tenants ({tenants.length})
                  </h2>
                  <button type="button" onClick={() => { setEditingTenant(null); setTenantForm({ displayName: '', allowPasswordSignup: true, enableEmailLinkSignin: false, enableAnonymousUser: false }); setShowTenantModal(true); }} className="ci-btn-outline" disabled={isOperationLoading} title="Add Tenant">
                    <PlusIcon className="ci-icon-xs" />
                  </button>
                </div>
                <div className="ci-flex-gap">
                  <button type="button" onClick={exportTenantsToCSV} className="ci-btn-outline" disabled={!tenants.length} title="Download CSV"><ArrowDownTrayIcon className="ci-icon-xs" /></button>
                  <button type="button" onClick={exportTenantsToExcel} className="ci-btn-outline ci-btn-outline-green" disabled={!tenants.length} title="Download Excel"><ArrowDownTrayIcon className="ci-icon-xs" /></button>
                  <button type="button" onClick={async () => { setAllTenantUserCounts({}); await fetchAllTenantUserCounts(); }} disabled={isLoadingUserCounts} className="ci-btn-outline" title="Refresh user counts">
                    {isLoadingUserCounts ? <span className="ci-spinner-sm"></span> : <svg className="ci-icon-xs" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                  </button>
                </div>
              </div>
              <div className="ci-pane-sort-row">
                <select className="ci-sort-combo" value={tenantSortField} onChange={e => { setTenantSortField(e.target.value as typeof tenantSortField); setTenantSortDir('asc'); }}>
                  <option value="displayName">Sort: Name</option>
                  <option value="tenantId">Sort: Tenant ID</option>
                  <option value="createdAt">Sort: Created Date</option>
                  <option value="userCount">Sort: User Count</option>
                </select>
                <button type="button" className="ci-sort-dir-btn" onClick={() => setTenantSortDir(d => d === 'asc' ? 'desc' : 'asc')} title={tenantSortDir === 'asc' ? 'Switch to Descending' : 'Switch to Ascending'}>
                  {tenantSortDir === 'asc' ? <ChevronUpIcon className="ci-icon-xs" /> : <ChevronDownIcon className="ci-icon-xs" />}
                </button>
              </div>
            </div>
            <div className="ci-pane-body">
              {tenants.length === 0
                ? <div className="ci-empty-state">No tenants found</div>
                : <div className="ci-pane-cards">{sortedTenants.map(tenant => {
                  const uc = allTenantUserCounts[tenant.tenantId];
                  const countDisplay = uc !== undefined ? uc : (selectedTenant?.tenantId === tenant.tenantId ? users.length : isLoadingUserCounts ? '…' : '?');
                  return (
                    <div key={tenant.tenantId}
                      className={`ci-tenant-card${selectedTenant?.tenantId === tenant.tenantId ? ' ci-tenant-card-selected' : ''}${isCurrentUserAdmin ? ' ci-tenant-card-clickable' : ''}`}
                      onClick={isCurrentUserAdmin ? () => setSelectedTenant(tenant) : undefined}
                    >
                      <div className="ci-card-top-row">
                        <div className="ci-card-info-row">
                          <span className="ci-card-main-title">{tenant.displayName} ({countDisplay})</span>
                          {isCurrentUserAdmin && (
                            <span className="ci-card-meta-inline">
                              <span className="ci-card-meta-key">id:</span>
                              <span className="ci-card-mono">{tenant.tenantId}</span>
                            </span>
                          )}
                          <span className="ci-card-meta-inline">
                            <span className="ci-card-meta-key">Since:</span>
                            <span className="ci-card-meta-val">{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '—'}</span>
                          </span>
                        </div>
                        <div className="ci-row-actions" onClick={e => e.stopPropagation()}>
                          <button type="button" onClick={() => { setEditingTenant(tenant); setTenantForm({ displayName: tenant.displayName, allowPasswordSignup: tenant.allowPasswordSignup ?? true, enableEmailLinkSignin: tenant.enableEmailLinkSignin ?? false, enableAnonymousUser: tenant.enableAnonymousUser ?? false }); setShowTenantModal(true); }} className="ci-btn-icon-blue" title="Edit" disabled={isOperationLoading}>
                            <PencilIcon className="ci-icon-xs" />
                          </button>
                          <button type="button" onClick={() => { setDeleteTarget({ type: 'tenant', id: tenant.tenantId, name: tenant.displayName }); setShowDeleteModal(true); }} className="ci-btn-icon-red" title="Delete" disabled={isOperationLoading}>
                            <TrashIcon className="ci-icon-xs" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}</div>
              }
            </div>
          </div>

          {/* ===== SPLITTER ===== */}
          <div className="ci-splitter" onMouseDown={handleSplitterMouseDown} />

          {/* ===== RIGHT PANE: USERS / PROVIDERS / LOGS ===== */}
          <div className="ci-split-pane ci-split-pane-flex">
            <div className="ci-pane-header">
              <div className="ci-pane-header-row">
                <div className="ci-flex-items">
                  <h2 className="ci-card-title">
                    {selectedTenant ? (
                      activeTab === 'users' ? <><UsersIcon className="ci-card-title-icon" />Users ({users.length})</>
                        : activeTab === 'providers' ? <><KeyIcon className="ci-card-title-icon" />Providers</>
                          : <><ClipboardDocumentListIcon className="ci-card-title-icon" />Log</>
                    ) : <><UsersIcon className="ci-card-title-icon" />Users</>}
                  </h2>
                  {selectedTenant && activeTab === 'users' && (
                    <button type="button" onClick={() => { setEditingUser(null); setUserForm({ email: '', password: '', displayName: '', emailVerified: false, disabled: false, toolboxRole: 'other' }); setPasswordVisible(false); setShowUserModal(true); }} className="ci-btn-outline" disabled={isOperationLoading} title="Add User">
                      <PlusIcon className="ci-icon-xs" />
                    </button>
                  )}
                </div>
                <div className="ci-flex-gap">
                  {selectedTenant && activeTab === 'users' && (
                    <>
                      <button type="button" onClick={exportUsersToCSV} className="ci-btn-outline" disabled={!users.length} title="Download CSV"><ArrowDownTrayIcon className="ci-icon-xs" /></button>
                      <button type="button" onClick={exportUsersToExcel} className="ci-btn-outline ci-btn-outline-green" disabled={!users.length} title="Download Excel"><ArrowDownTrayIcon className="ci-icon-xs" /></button>
                    </>
                  )}
                  {selectedTenant && activeTab === 'logs' && (
                    <>
                      <button type="button" onClick={() => { const d = activityLogs[selectedTenant.tenantId] || []; exportToCSV(d, `${selectedTenant.displayName.replace(/\s+/g, '_')}_logs_${new Date().toISOString().slice(0, 10)}`); }} className="ci-btn-outline" title="Download log CSV"><ArrowDownTrayIcon className="ci-icon-xs" /></button>
                      <button type="button" onClick={() => { const d = activityLogs[selectedTenant.tenantId] || []; exportToExcel(d, `${selectedTenant.displayName.replace(/\s+/g, '_')}_logs_${new Date().toISOString().slice(0, 10)}`); }} className="ci-btn-outline ci-btn-outline-green" title="Download log Excel"><ArrowDownTrayIcon className="ci-icon-xs" /></button>
                    </>
                  )}
                </div>
              </div>
              {selectedTenant && (
                <div className="ci-pane-sort-row">
                  <div className="ci-tabs">
                    <button type="button" onClick={() => setActiveTab('users')} className={activeTab === 'users' ? 'ci-tab-active-left' : 'ci-tab-left'}>Users</button>
                    <button type="button" onClick={() => setActiveTab('providers')} className={activeTab === 'providers' ? 'ci-tab-active-mid' : 'ci-tab-mid'}>Providers</button>
                    <button type="button" onClick={() => setActiveTab('logs')} className={activeTab === 'logs' ? 'ci-tab-active-right' : 'ci-tab-right'}>Log</button>
                  </div>
                  {activeTab === 'users' && (
                    <div className="ci-flex-items">
                      <select className="ci-sort-combo" value={userSortField} onChange={e => { setUserSortField(e.target.value as typeof userSortField); setUserSortDir('asc'); }}>
                        <option value="email">Sort: Email</option>
                        <option value="displayName">Sort: Display Name</option>
                        <option value="toolboxRole">Sort: Role</option>
                        <option value="createdAt">Sort: Created Date</option>
                      </select>
                      <button type="button" className="ci-sort-dir-btn" onClick={() => setUserSortDir(d => d === 'asc' ? 'desc' : 'asc')} title={userSortDir === 'asc' ? 'Switch to Descending' : 'Switch to Ascending'}>
                        {userSortDir === 'asc' ? <ChevronUpIcon className="ci-icon-xs" /> : <ChevronDownIcon className="ci-icon-xs" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="ci-pane-body">
              {!selectedTenant ? (
                <div className="ci-empty-state">Select a tenant to view users and providers</div>
              ) : activeTab === 'providers' ? (
                <div className="ci-fill-col">
                  <IdentityProviderManager tenantId={selectedTenant.tenantId} tenantName={selectedTenant.displayName} onAlert={showAlert} />
                </div>
              ) : activeTab === 'logs' ? (
                <div className="ci-fill-col">
                  <div className="ci-table-header-wrapper ci-shrink-0">
                    <table className="ci-table-auto">
                      <thead>
                        <tr>
                          <th className="ci-th" style={{ width: '160px' }}>Date/Time</th>
                          <th className="ci-th">Event</th>
                          <th className="ci-th">Details</th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <div className="ci-table-scroll">
                    <table className="ci-table-auto">
                      <tbody className="ci-tbody">
                        {(activityLogs[selectedTenant.tenantId] || []).length === 0
                          ? <tr><td colSpan={3} className="ci-td-log-empty">No activity logged yet.</td></tr>
                          : (activityLogs[selectedTenant.tenantId] || []).map((log, i) => (
                            <tr key={i} className="ci-tr-hover">
                              <td className="ci-td-log-date">{new Date(log.timestamp).toLocaleString()}</td>
                              <td className="ci-td-log-event">{log.event}</td>
                              <td className="ci-td-log-details">{log.details}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isUsersLoading && users.length === 0 ? (
                <div className="ci-empty-state"><div className="ci-loading-message"><div className="ci-spinner"></div><span>Loading users...</span></div></div>
              ) : users.length === 0 ? (
                <div className="ci-empty-state">No users found</div>
              ) : (
                <div className="ci-pane-cards ci-relative">
                  {isUsersLoading && <div className="ci-loading-overlay"><div className="ci-loading-message"><div className="ci-spinner"></div><span>Loading users...</span></div></div>}
                  {sortedUsers.map(user => {
                    const isProtected = isProtectedUser(user);
                    const extractedRole = extractToolboxRole(user.customClaims) || (user.customClaims?.toolboxRole as string) || null;
                    const badgeClass = getToolboxRoleBadgeColor(extractedRole || undefined);
                    const permittedApps = extractPermittedApps(user);
                    const protectedInfo = getProtectedUserInfo(user);
                    return (
                      <div key={user.uid} className={`ci-user-card${isProtected ? ' ci-user-card-protected' : ''}`}>
                        <div className="ci-card-top-row">
                          <div className="ci-card-info-row">
                            <span className="ci-card-main-title">{user.displayName || user.email || '—'} ({extractedRole ? getToolboxRoleDisplay(extractedRole) : 'No Role'})</span>
                            <span className="ci-card-meta-inline">
                              <span className="ci-card-meta-key">Email:</span>
                              <span className="ci-card-meta-val ci-card-email">{user.email || '—'}</span>
                            </span>
                            {user.phoneNumber && (
                              <span className="ci-card-meta-inline">
                                <span className="ci-card-meta-key">Phone:</span>
                                <span className="ci-card-meta-val">{user.phoneNumber}</span>
                              </span>
                            )}
                            <span className="ci-card-meta-inline">
                              <span className="ci-card-meta-key">Since:</span>
                              <span className="ci-card-meta-val">{user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : '—'}</span>
                            </span>
                            {permittedApps.length > 0 && (
                              <span className="ci-card-meta-inline">
                                <span className="ci-card-meta-key">Apps:</span>
                                {permittedApps.map(app => <span key={app} className="ci-badge ci-badge-app">{app}</span>)}
                              </span>
                            )}
                            {isProtected ? (
                              <div className="ci-status-protected-row">
                                <span className="ci-badge ci-badge-protected">Protected</span>
                                <ShieldCheckIcon className="ci-icon-protected" title={protectedInfo?.description} />
                              </div>
                            ) : user.disabled ? (
                              <span className="ci-badge ci-badge-disabled-status" title="Disabled">Disabled</span>
                            ) : user.emailVerified ? (
                              <CheckIcon className="ci-icon-verified" title="Verified" />
                            ) : (
                              <span className="ci-badge ci-badge-pending" title="Email verification pending">Pending</span>
                            )}
                          </div>
                          <div className="ci-row-actions">
                            {isProtected ? (
                              <>
                                <span className="ci-btn-icon-disabled" title="Protected"><PencilIcon className="ci-icon-xs" /></span>
                                <button type="button" onClick={() => handleEditCustomClaims(user)} className="ci-btn-icon-purple" title="Edit Custom Claims" disabled={isOperationLoading}><CogIcon className="ci-icon-xs" /></button>
                                <span className="ci-btn-icon-disabled" title="Protected"><TrashIcon className="ci-icon-xs" /></span>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => { setEditingUser(user); const r = extractToolboxRole(user.customClaims); setUserForm({ email: user.email || '', password: '', displayName: user.displayName || '', emailVerified: user.emailVerified ?? false, disabled: user.disabled ?? false, toolboxRole: r || 'other' }); setPasswordVisible(false); setShowUserModal(true); }} className="ci-btn-icon-blue" title="Edit" disabled={isOperationLoading}><PencilIcon className="ci-icon-xs" /></button>
                                <button type="button" onClick={() => handleEditCustomClaims(user)} className="ci-btn-icon-purple" title="Edit Custom Claims" disabled={isOperationLoading}><CogIcon className="ci-icon-xs" /></button>
                                <button type="button" onClick={() => { setDeleteTarget({ type: 'user', id: user.uid, name: user.email || user.displayName || 'this user' }); setShowDeleteModal(true); }} className="ci-btn-icon-red" title="Delete" disabled={isOperationLoading}><TrashIcon className="ci-icon-xs" /></button>
                              </>
                            )}
                          </div>
                        </div>
                        {!user.emailVerified && !user.disabled && !isProtected && (
                          <div className="ci-card-verify-row">
                            <button type="button" onClick={() => handleSendVerificationEmail(user)} disabled={isSendingVerificationEmail} className="ci-btn-send-email" title="Send verification email">
                              {isSendingVerificationEmail ? <span className="ci-spinner-inline-blue"></span> : <EnvelopeIcon className="ci-icon-xs" />}
                              Send
                            </button>
                            <button type="button" onClick={() => handleVerifyEmailManually(user)} disabled={isVerifyingEmailManually} className="ci-btn-verify-manual" title="Manually verify email">
                              {isVerifyingEmailManually ? <span className="ci-spinner-inline-green"></span> : <CheckIcon className="ci-icon-xs" />}
                              Verify
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== TENANT MODAL ===== */}
        {showTenantModal && (
          <div className="ci-modal-overlay">
            <div className="ci-modal-md">
              <div className="ci-modal-body">
                <div className="ci-modal-header">
                  <h3 className="ci-modal-title">{editingTenant ? `Edit Tenant: ${editingTenant.displayName}` : 'Create New Tenant'}</h3>
                  {editingTenant && (
                    <button type="button" onClick={() => handleVerifyEmailInheritance(editingTenant.tenantId)} disabled={isVerifyingEmailInheritance} className="ci-btn-icon-verify" title="Verify email inheritance">
                      {isVerifyingEmailInheritance ? <span className="ci-spinner-sm"></span> : <ShieldCheckIcon className="ci-icon-sm" />}
                    </button>
                  )}
                </div>
                <div className="ci-form-fields">
                  <div>
                    <label className="ci-form-label">Display Name *</label>
                    <input type="text" value={tenantForm.displayName} onChange={e => setTenantForm({ ...tenantForm, displayName: e.target.value })} className="ci-form-input-lg" placeholder="Company Domain Name" minLength={4} maxLength={20} required />
                    <p className="ci-form-hint">4-20 characters, must start with a letter. Only letters, numbers and hyphens allowed (no periods).</p>
                  </div>
                  <div className="ci-form-section">
                    <label className="ci-checkbox-row">
                      <input type="checkbox" className="ci-checkbox" checked={tenantForm.allowPasswordSignup} onChange={e => setTenantForm({ ...tenantForm, allowPasswordSignup: e.target.checked })} />
                      <span className="ci-checkbox-label-lg">Allow Password Signup</span>
                    </label>
                    <label className="ci-checkbox-row">
                      <input type="checkbox" className="ci-checkbox" checked={tenantForm.enableEmailLinkSignin} onChange={e => setTenantForm({ ...tenantForm, enableEmailLinkSignin: e.target.checked })} />
                      <span className="ci-checkbox-label-lg">Enable Email Link Sign-in</span>
                    </label>
                    <label className="ci-checkbox-row">
                      <input type="checkbox" className="ci-checkbox" checked={tenantForm.enableAnonymousUser} onChange={e => setTenantForm({ ...tenantForm, enableAnonymousUser: e.target.checked })} />
                      <span className="ci-checkbox-label-lg">Enable Anonymous Users</span>
                    </label>
                  </div>
                </div>
                <div className="ci-modal-footer">
                  <button type="button" onClick={() => { setShowTenantModal(false); setEditingTenant(null); setTenantForm({ displayName: '', allowPasswordSignup: true, enableEmailLinkSignin: false, enableAnonymousUser: false }); }} className="ci-btn-cancel" disabled={isOperationLoading}>Cancel</button>
                  <button type="button" onClick={editingTenant ? handleUpdateTenant : handleCreateTenant} className="ci-btn-primary" disabled={isOperationLoading || !tenantForm.displayName.trim()}>
                    {isOperationLoading ? 'Saving...' : editingTenant ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== USER MODAL ===== */}
        {showUserModal && (
          <div className="ci-modal-overlay">
            <div className="ci-modal-md ci-modal-add-user">
              <div className="ci-modal-body">
                {editingUser && selectedTenant && <p className="ci-text-gray" style={{ marginBottom: 4 }}>Tenant: <strong>{selectedTenant.displayName}</strong></p>}
                <h3 className="ci-modal-title" style={{ marginBottom: 12 }}>{editingUser ? `Edit User: ${editingUser.email}` : `Create User for ${selectedTenant?.displayName}`}</h3>
                <div className="ci-form-fields">
                  <div>
                    <label className="ci-form-label">Email *{editingUser && <span className="ci-form-hint" style={{ display: 'inline', marginLeft: 4 }}>(Read-only)</span>}</label>
                    <input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className={editingUser ? 'ci-form-input-readonly' : 'ci-form-input'} placeholder="user@example.com" disabled={!!editingUser} readOnly={!!editingUser} />
                    {editingUser && <p className="ci-form-hint">Email cannot be changed for existing users</p>}
                  </div>
                  {!editingUser && (
                    <div>
                      <label className="ci-form-label">Password *</label>
                      <div className="ci-password-wrapper">
                        <input type={passwordVisible ? 'text' : 'password'} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="ci-form-input-password" placeholder="Enter password" minLength={6} required />
                        <button type="button" className="ci-show-hide-btn" onClick={() => setPasswordVisible(v => !v)} aria-label={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? 'Hide' : 'Show'}</button>
                      </div>
                      <p className="ci-form-hint">Minimum 6 characters required</p>
                    </div>
                  )}
                  <div>
                    <label className="ci-form-label">Display Name</label>
                    <input type="text" value={userForm.displayName} onChange={e => setUserForm({ ...userForm, displayName: e.target.value })} className="ci-form-input" placeholder="John Doe" />
                  </div>
                  {editingUser && (
                    <div>
                      <label className="ci-form-label">Role</label>
                      <div className="ci-form-readonly-field">{userForm.toolboxRole}</div>
                      <p className="ci-form-hint">To change role, use "Edit Custom Claims"</p>
                    </div>
                  )}
                  <div className="ci-form-section">
                    <label className="ci-checkbox-row">
                      <input type="checkbox" className="ci-checkbox" checked={userForm.emailVerified} onChange={e => setUserForm({ ...userForm, emailVerified: e.target.checked })} />
                      <span className="ci-checkbox-label">Email Verified</span>
                    </label>
                    {editingUser && <p className="ci-form-hint-amber" style={{ marginLeft: 22 }}>Admin can manually verify by checking this box.</p>}
                    <label className="ci-checkbox-row">
                      <input type="checkbox" className="ci-checkbox" checked={userForm.disabled} onChange={e => setUserForm({ ...userForm, disabled: e.target.checked })} />
                      <span className="ci-checkbox-label">Disable User Account</span>
                    </label>
                  </div>
                </div>
                <div className="ci-modal-footer">
                  <button type="button" onClick={() => { setShowUserModal(false); setEditingUser(null); setUserForm({ email: '', password: '', displayName: '', emailVerified: false, disabled: false, toolboxRole: 'other' }); setPasswordVisible(false); }} className="ci-btn-cancel-sm" disabled={isOperationLoading}>Cancel</button>
                  <button type="button" onClick={() => editingUser ? handleUpdateUser() : handleCreateUser()} className="ci-btn-primary-sm" disabled={isOperationLoading || !userForm.email.trim() || (!editingUser && !userForm.password.trim())}>
                    {isOperationLoading ? 'Saving...' : editingUser ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== DELETE MODAL ===== */}
        {showDeleteModal && deleteTarget && (
          <div className="ci-modal-overlay">
            <div className="ci-modal-md">
              <div className="ci-modal-body">
                <div className="ci-delete-icon-row">
                  <div className="ci-delete-icon-circle"><TrashIcon className="ci-delete-icon" /></div>
                  <span className="ci-delete-title">Delete {deleteTarget.type === 'tenant' ? 'Tenant' : 'User'}</span>
                </div>
                <p className="ci-text-sm ci-mb-3">Are you sure you want to delete <strong>{deleteTarget.name}</strong>{deleteTarget.type === 'user' && selectedTenant ? <> for <strong>{selectedTenant.displayName}</strong></> : ''}?</p>
                {deleteTarget.type === 'tenant' && <p className="ci-delete-warning">⚠ This will also delete all users in this tenant. This action cannot be undone.</p>}
                {deleteTarget.type === 'user' && <p className="ci-text-sm ci-mb-4" style={{ color: '#6b7280' }}>This action cannot be undone.</p>}
                <div className="ci-modal-footer">
                  <button type="button" onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} className="ci-btn-cancel" disabled={isOperationLoading}>Cancel</button>
                  <button type="button" onClick={() => deleteTarget.type === 'tenant' ? handleDeleteTenant(deleteTarget.id) : handleDeleteUser(deleteTarget.id)} className="ci-btn-danger" disabled={isOperationLoading}>
                    {isOperationLoading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== CUSTOM CLAIMS MODAL ===== */}
        {showCustomClaimsModal && customClaimsUser && (
          <div className="ci-modal-overlay">
            <div className="ci-modal-lg">
              <div className="ci-modal-header-row">
                <h3 className="ci-modal-title">Edit Custom Claims: {customClaimsUser.email}</h3>
                <p className="ci-modal-subtitle">Tenant: {selectedTenant?.displayName} | UID: {customClaimsUser.uid}</p>
              </div>
              <div className="ci-modal-scroll-body">
                {isLoadingClaims
                  ? <div className="ci-flex-center" style={{ padding: '28px' }}><div className="ci-spinner-lg"></div><span style={{ marginLeft: 8, color: '#4b5563' }}>Loading claims...</span></div>
                  : (
                    <div>
                      <h4 className="ci-claims-section-title">Role</h4>
                      <p className="ci-claims-desc">Set the role for this user:</p>
                      <div className="ci-claims-item">
                        <div className="ci-claims-form-row">
                          <input type="text" value="toolboxRole" readOnly className="ci-claims-key-input" title="Toolbox Role (read-only)" />
                          <select value={(editableCustomClaims.toolboxRole || 'other').toLowerCase()} onChange={e => setEditableCustomClaims(prev => ({ ...prev, toolboxRole: e.target.value }))} className="ci-claims-value-select">
                            {SmRolesArray.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      </div>
                      <h4 className="ci-claims-section-title" style={{ marginTop: 14 }}>Available Apps</h4>
                      <p className="ci-claims-desc">Select which apps this user can access (Available Apps):</p>
                      <div className="ci-claims-item">
                        <div className="ci-claims-checkbox-group">
                          {AvailableAppsArray.map(app => {
                            const selected: string[] = Array.isArray(editableCustomClaims.permittedapps) ? editableCustomClaims.permittedapps : [];
                            const checked = selected.includes(app);
                            return (
                              <label key={app} className="ci-checkbox-row">
                                <input
                                  type="checkbox"
                                  className="ci-checkbox"
                                  checked={checked}
                                  onChange={e => setEditableCustomClaims(prev => {
                                    const prevApps: string[] = Array.isArray(prev.permittedapps) ? prev.permittedapps : [];
                                    const nextApps = e.target.checked ? [...prevApps, app] : prevApps.filter(a => a !== app);
                                    return { ...prev, permittedapps: nextApps };
                                  })}
                                />
                                <span className="ci-checkbox-label">{app}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
              <div className="ci-modal-footer-bar">
                <button type="button" onClick={() => { setShowCustomClaimsModal(false); setCustomClaimsUser(null); setEditableCustomClaims({}); }} className="ci-btn-cancel" disabled={isOperationLoading}>Cancel</button>
                <button type="button" onClick={handleSaveCustomClaims} className="ci-btn-primary" disabled={isOperationLoading || !Object.keys(editableCustomClaims).length}>
                  {isOperationLoading ? 'Saving...' : 'Save Custom Claims'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== EMAIL VERIFICATION STATUS MODAL ===== */}
        {showEmailVerificationModal && emailVerificationStatus && (
          <div className="ci-modal-overlay">
            <div className="ci-modal-md">
              <div className="ci-modal-body">
                <div className="ci-evs-icon-row">
                  <div className={emailVerificationStatus.emailInheritanceEnabled ? 'ci-evs-icon-circle-green' : 'ci-evs-icon-circle-yellow'}>
                    <ShieldCheckIcon className={emailVerificationStatus.emailInheritanceEnabled ? 'ci-evs-icon-green' : 'ci-evs-icon-yellow'} />
                  </div>
                  <span className="ci-evs-title">Email Verification Status</span>
                </div>
                <div className="ci-evs-status-row">
                  <div className="ci-evs-status-icon"><ShieldCheckIcon className="ci-icon-xs" /></div>
                  <div>
                    <div className="ci-evs-status-label">Tenant: {emailVerificationStatus.tenantDisplayName}</div>
                    <div className="ci-evs-status-value">{emailVerificationStatus.message}</div>
                  </div>
                </div>
                <div className="ci-modal-footer">
                  <button type="button" onClick={() => setShowEmailVerificationModal(false)} className="ci-btn-cancel">Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== VERIFICATION LINK MODAL ===== */}
        {showVerificationLinkModal && verificationLinkData && (
          <div className="ci-modal-overlay">
            <div className="ci-modal-md">
              <div className="ci-modal-body">
                <h3 className="ci-modal-title" style={{ marginBottom: 12 }}>Verification Link</h3>
                <p className="ci-vl-email">Email: <strong>{verificationLinkData.email}</strong></p>
                <div className="ci-vl-link-box">
                  <p className="ci-vl-link-text">{verificationLinkData.link}</p>
                  <button type="button" className="ci-vl-copy-btn" onClick={async () => { try { await navigator.clipboard.writeText(verificationLinkData.link); showAlert('success', 'Link copied to clipboard'); } catch { showAlert('error', 'Failed to copy link'); } }}>
                    Copy Link
                  </button>
                </div>
                {verificationLinkData.instructions.length > 0 && (
                  <ul className="ci-vl-instructions">
                    {verificationLinkData.instructions.map((instr, i) => <li key={i}>{instr}</li>)}
                  </ul>
                )}
                <div className="ci-modal-footer">
                  <button type="button" onClick={() => setShowVerificationLinkModal(false)} className="ci-btn-cancel">Close</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default ClientIdentity;
export { ClientIdentity, type IClientIdentityProps };
