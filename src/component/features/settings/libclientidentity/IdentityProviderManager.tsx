import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import type { IdentityProvider, SamlConfig, OidcConfig, OperationResult } from './types/tenant';
import { tenantService } from '@n20a/libfsdb';   //'./services/tenant-service';
import './IdentityProviderManager.css';

interface IdentityProviderManagerProps {
  tenantId: string;
  tenantName: string;
  onAlert: (type: string, message: string) => void;
}

interface ProviderConfig {
  providerId: string;
  displayName?: string;
  enabled: boolean;
}

interface SamlProviderConfig extends ProviderConfig, SamlConfig {}
interface OidcProviderConfig extends ProviderConfig, OidcConfig {}

interface ProviderFormProps {
  provider?: IdentityProvider;
  onSubmit: (data: SamlProviderConfig | OidcProviderConfig) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

function SamlProviderForm({ provider, onSubmit, onCancel, isLoading }: ProviderFormProps) {
  const [formData, setFormData] = useState({
    providerId: provider?.providerId || '',
    displayName: provider?.displayName || '',
    enabled: provider?.enabled ?? true,
    idpEntityId: '',
    ssoUrl: '',
    x509Certificates: '',
    rpEntityId: '',
    callbackUrl: '',
    enableRequestSigning: false,
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const config: SamlConfig = {
      idpEntityId: formData.idpEntityId,
      ssoUrl: formData.ssoUrl,
      x509Certificates: formData.x509Certificates.split('\n').filter(c => c.trim()),
      rpEntityId: formData.rpEntityId,
      callbackUrl: formData.callbackUrl,
      enableRequestSigning: formData.enableRequestSigning,
    };
    await onSubmit({ providerId: formData.providerId, displayName: formData.displayName, enabled: formData.enabled, ...config });
  }, [formData, onSubmit]);

  const handleChange = useCallback((field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <form onSubmit={handleSubmit} className="ipm-form-fields">
      <div>
        <label htmlFor="saml-providerId" className="ipm-form-label">Provider ID</label>
        <input type="text" id="saml-providerId" required placeholder="saml.mycompany" className="ipm-input" value={formData.providerId} onChange={e => handleChange('providerId', e.target.value)} disabled={isLoading || !!provider} />
      </div>
      <div>
        <label htmlFor="saml-displayName" className="ipm-form-label">Display Name</label>
        <input type="text" id="saml-displayName" placeholder="My Company SAML" className="ipm-input" value={formData.displayName} onChange={e => handleChange('displayName', e.target.value)} disabled={isLoading} />
      </div>
      <div>
        <label htmlFor="saml-idpEntityId" className="ipm-form-label">IDP Entity ID</label>
        <input type="text" id="saml-idpEntityId" required className="ipm-input" value={formData.idpEntityId} onChange={e => handleChange('idpEntityId', e.target.value)} disabled={isLoading} />
      </div>
      <div>
        <label htmlFor="saml-ssoUrl" className="ipm-form-label">SSO URL</label>
        <input type="url" id="saml-ssoUrl" required className="ipm-input" value={formData.ssoUrl} onChange={e => handleChange('ssoUrl', e.target.value)} disabled={isLoading} />
      </div>
      <div>
        <label htmlFor="saml-certs" className="ipm-form-label">X.509 Certificates (one per line)</label>
        <textarea id="saml-certs" required rows={4} className="ipm-textarea" value={formData.x509Certificates} onChange={e => handleChange('x509Certificates', e.target.value)} disabled={isLoading} placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" />
      </div>
      <div>
        <label htmlFor="saml-rpEntityId" className="ipm-form-label">RP Entity ID</label>
        <input type="text" id="saml-rpEntityId" required className="ipm-input" value={formData.rpEntityId} onChange={e => handleChange('rpEntityId', e.target.value)} disabled={isLoading} />
      </div>
      <div>
        <label htmlFor="saml-callbackUrl" className="ipm-form-label">Callback URL</label>
        <input type="url" id="saml-callbackUrl" required className="ipm-input" value={formData.callbackUrl} onChange={e => handleChange('callbackUrl', e.target.value)} disabled={isLoading} />
      </div>
      <div className="ipm-checkbox-group">
        <label className="ipm-checkbox-row">
          <input type="checkbox" className="ipm-checkbox" checked={formData.enabled} onChange={e => handleChange('enabled', e.target.checked)} disabled={isLoading} />
          <span className="ipm-checkbox-label">Enabled</span>
        </label>
        <label className="ipm-checkbox-row">
          <input type="checkbox" className="ipm-checkbox" checked={formData.enableRequestSigning} onChange={e => handleChange('enableRequestSigning', e.target.checked)} disabled={isLoading} />
          <span className="ipm-checkbox-label">Enable request signing</span>
        </label>
      </div>
      <div className="ipm-form-footer">
        <button type="button" onClick={onCancel} className="ipm-btn-cancel" disabled={isLoading}>Cancel</button>
        <button type="submit" className="ipm-btn-primary" disabled={isLoading}>{isLoading ? 'Saving...' : provider ? 'Update' : 'Create'}</button>
      </div>
    </form>
  );
}

function OidcProviderForm({ provider, onSubmit, onCancel, isLoading }: ProviderFormProps) {
  const [formData, setFormData] = useState({
    providerId: provider?.providerId || '',
    displayName: provider?.displayName || '',
    enabled: provider?.enabled ?? true,
    issuer: '',
    clientId: '',
    clientSecret: '',
    responseTypeCode: true,
    responseTypeIdToken: false,
  });
  const [secretVisible, setSecretVisible] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const config: OidcConfig = { issuer: formData.issuer, clientId: formData.clientId, clientSecret: formData.clientSecret, responseType: { code: formData.responseTypeCode, idToken: formData.responseTypeIdToken } };
    await onSubmit({ providerId: formData.providerId, displayName: formData.displayName, enabled: formData.enabled, ...config });
  }, [formData, onSubmit]);

  const handleChange = useCallback((field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <form onSubmit={handleSubmit} className="ipm-form-fields">
      <div>
        <label htmlFor="oidc-providerId" className="ipm-form-label">Provider ID</label>
        <input type="text" id="oidc-providerId" required placeholder="oidc.mycompany" className="ipm-input" value={formData.providerId} onChange={e => handleChange('providerId', e.target.value)} disabled={isLoading || !!provider} />
      </div>
      <div>
        <label htmlFor="oidc-displayName" className="ipm-form-label">Display Name</label>
        <input type="text" id="oidc-displayName" placeholder="My Company OIDC" className="ipm-input" value={formData.displayName} onChange={e => handleChange('displayName', e.target.value)} disabled={isLoading} />
      </div>
      <div>
        <label htmlFor="oidc-issuer" className="ipm-form-label">Issuer</label>
        <input type="url" id="oidc-issuer" required className="ipm-input" value={formData.issuer} onChange={e => handleChange('issuer', e.target.value)} disabled={isLoading} />
      </div>
      <div>
        <label htmlFor="oidc-clientId" className="ipm-form-label">Client ID</label>
        <input type="text" id="oidc-clientId" required className="ipm-input" value={formData.clientId} onChange={e => handleChange('clientId', e.target.value)} disabled={isLoading} />
      </div>
      <div>
        <label htmlFor="oidc-clientSecret" className="ipm-form-label">Client Secret</label>
        <div className="ipm-password-wrapper">
          <input type={secretVisible ? 'text' : 'password'} id="oidc-clientSecret" className="ipm-input ipm-input-password" value={formData.clientSecret} onChange={e => handleChange('clientSecret', e.target.value)} disabled={isLoading} />
          <button type="button" className="ipm-show-hide-btn" onClick={() => setSecretVisible(v => !v)} aria-label={secretVisible ? 'Hide secret' : 'Show secret'}>{secretVisible ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      <div className="ipm-checkbox-group">
        <label className="ipm-checkbox-row">
          <input type="checkbox" className="ipm-checkbox" checked={formData.enabled} onChange={e => handleChange('enabled', e.target.checked)} disabled={isLoading} />
          <span className="ipm-checkbox-label">Enabled</span>
        </label>
        <fieldset className="ipm-fieldset">
          <legend className="ipm-legend">Response Type</legend>
          <label className="ipm-checkbox-row">
            <input type="checkbox" className="ipm-checkbox" checked={formData.responseTypeCode} onChange={e => handleChange('responseTypeCode', e.target.checked)} disabled={isLoading} />
            <span className="ipm-checkbox-label">Code</span>
          </label>
          <label className="ipm-checkbox-row">
            <input type="checkbox" className="ipm-checkbox" checked={formData.responseTypeIdToken} onChange={e => handleChange('responseTypeIdToken', e.target.checked)} disabled={isLoading} />
            <span className="ipm-checkbox-label">ID Token</span>
          </label>
        </fieldset>
      </div>
      <div className="ipm-form-footer">
        <button type="button" onClick={onCancel} className="ipm-btn-cancel" disabled={isLoading}>Cancel</button>
        <button type="submit" className="ipm-btn-primary" disabled={isLoading}>{isLoading ? 'Saving...' : provider ? 'Update' : 'Create'}</button>
      </div>
    </form>
  );
}

export default function IdentityProviderManager({ tenantId, tenantName, onAlert }: IdentityProviderManagerProps) {
  const [providers, setProviders] = useState<IdentityProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [providerType, setProviderType] = useState<'saml' | 'oidc'>('saml');
  const [editingProvider, setEditingProvider] = useState<IdentityProvider | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setProviders([
        { providerId: 'password', displayName: 'Email/Password', enabled: true },
        { providerId: 'google.com', displayName: 'Google', enabled: true },
        { providerId: 'microsoft.com', displayName: 'Microsoft', enabled: false },
        { providerId: 'saml.example', displayName: 'Example SAML Provider', enabled: true },
        { providerId: 'oidc.corporate', displayName: 'Corporate OIDC', enabled: true },
      ]);
      setIsLoading(false);
    }, 1000);
  }, [tenantId]);

  const handleCreateProvider = useCallback(async (data: SamlProviderConfig | OidcProviderConfig) => {
    try {
      setIsOperationLoading(true);
      let result: OperationResult;
      if (providerType === 'saml') {
        result = await tenantService.createSamlProvider(tenantId, data.providerId, data);
      } else {
        result = await tenantService.createOidcProvider(tenantId, data.providerId, data);
      }
      if (result.success) {
        onAlert('success', `${providerType.toUpperCase()} provider created successfully`);
        setShowProviderModal(false);
      } else {
        onAlert('error', result.error?.message || 'Failed to create provider');
      }
    } catch (error) {
      onAlert('error', `Error creating provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsOperationLoading(false);
    }
  }, [tenantId, providerType, onAlert]);

  const handleDeleteProvider = useCallback(async (providerId: string) => {
    if (!confirm('Are you sure you want to delete this identity provider? This action cannot be undone.')) return;
    try {
      setIsOperationLoading(true);
      const result = await tenantService.deleteProvider(tenantId, providerId);
      if (result.success) {
        onAlert('success', 'Identity provider deleted successfully');
        setProviders(prev => prev.filter(p => p.providerId !== providerId));
      } else {
        onAlert('error', result.error?.message || 'Failed to delete provider');
      }
    } catch (error) {
      onAlert('error', `Error deleting provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsOperationLoading(false);
    }
  }, [tenantId, onAlert]);

  if (isLoading) {
    return (
      <div className="ipm-loading-center">
        <div className="ci-spinner"></div>
      </div>
    );
  }

  const activeCount = providers.filter(p => p.enabled).length;
  const disabledCount = providers.filter(p => !p.enabled).length;
  const samlCount = providers.filter(p => p.providerId.startsWith('saml.')).length;
  const oidcCount = providers.filter(p => p.providerId.startsWith('oidc.')).length;
  const oauthCount = providers.filter(p => ['google.com', 'microsoft.com', 'facebook.com'].includes(p.providerId)).length;

  return (
    <div className="ipm-container">
      <div className="ipm-header">
        <div className="ipm-header-left">
          <h3 className="ipm-title">
            <KeyIcon className="ipm-title-icon" />
            Identity Providers
          </h3>
          <p className="ipm-subtitle">Configure authentication providers for {tenantName}</p>
          <div className="ipm-summary-chips">
            {activeCount > 0 && (
              <span className="ipm-chip ipm-chip-green">
                <CheckIcon className="ipm-chip-icon" />{activeCount} Active
              </span>
            )}
            {disabledCount > 0 && (
              <span className="ipm-chip ipm-chip-gray">
                <XMarkIcon className="ipm-chip-icon" />{disabledCount} Disabled
              </span>
            )}
            {samlCount > 0 && <span className="ipm-chip ipm-chip-blue">{samlCount} SAML</span>}
            {oidcCount > 0 && <span className="ipm-chip ipm-chip-green">{oidcCount} OIDC</span>}
            {oauthCount > 0 && <span className="ipm-chip ipm-chip-orange">{oauthCount} OAuth</span>}
          </div>
        </div>
        <div className="ipm-header-actions">
          <button type="button" onClick={() => { setProviderType('saml'); setEditingProvider(null); setShowProviderModal(true); }} className="ipm-btn-add-saml" disabled={isOperationLoading}>
            <PlusIcon className="ipm-btn-add-icon" />SAML
          </button>
          <button type="button" onClick={() => { setProviderType('oidc'); setEditingProvider(null); setShowProviderModal(true); }} className="ipm-btn-add-oidc" disabled={isOperationLoading}>
            <PlusIcon className="ipm-btn-add-icon" />OIDC
          </button>
        </div>
      </div>

      <div className="ipm-table-scroll">
        <table className="ipm-table">
          <thead>
            <tr>
              <th className="ipm-th">Provider</th>
              <th className="ipm-th ipm-th-center">Type</th>
              <th className="ipm-th ipm-th-center">Status</th>
              <th className="ipm-th ipm-th-center">Actions</th>
            </tr>
          </thead>
          <tbody className="ipm-tbody">
            {providers.map(provider => {
              const isSaml = provider.providerId.startsWith('saml.');
              const isOidc = provider.providerId.startsWith('oidc.');
              const type = isSaml ? 'SAML' : isOidc ? 'OIDC' : 'OAuth';
              const typeClass = isSaml ? 'ipm-type-saml' : isOidc ? 'ipm-type-oidc' : 'ipm-type-oauth';
              return (
                <tr key={provider.providerId} className="ipm-tr">
                  <td className="ipm-td">
                    <div className="ipm-provider-name">{provider.displayName || provider.providerId}</div>
                    <div className="ipm-provider-id">{provider.providerId}</div>
                  </td>
                  <td className="ipm-td ipm-td-center">
                    <span className={`ipm-type-badge ${typeClass}`}>{type}</span>
                  </td>
                  <td className="ipm-td ipm-td-center">
                    {provider.enabled
                      ? <CheckIcon className="ipm-icon-active" />
                      : <span className="ipm-badge-disabled">Disabled</span>
                    }
                  </td>
                  <td className="ipm-td ipm-td-center">
                    <div className="ipm-row-actions">
                      <button type="button" onClick={() => { setEditingProvider(provider); setProviderType(isSaml ? 'saml' : 'oidc'); setShowProviderModal(true); }} className="ipm-icon-btn ipm-icon-btn-blue" title="Edit" disabled={isOperationLoading}>
                        <PencilIcon className="ipm-icon" />
                      </button>
                      <button type="button" onClick={() => handleDeleteProvider(provider.providerId)} className="ipm-icon-btn ipm-icon-btn-red" title="Delete" disabled={isOperationLoading}>
                        <TrashIcon className="ipm-icon" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {providers.length === 0 && (
              <tr>
                <td colSpan={4} className="ipm-empty-row">No identity providers configured</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showProviderModal && (
        <div className="ipm-modal-overlay">
          <div className="ipm-modal-box">
            <div className="ipm-modal-header">
              <h3 className="ipm-modal-title">
                {editingProvider ? `Edit ${providerType.toUpperCase()} Provider` : `Add ${providerType.toUpperCase()} Provider`}
              </h3>
              <button type="button" onClick={() => setShowProviderModal(false)} className="ipm-modal-close">
                <XMarkIcon className="ipm-icon" />
              </button>
            </div>
            <div className="ipm-modal-body">
              {providerType === 'saml'
                ? <SamlProviderForm provider={editingProvider || undefined} onSubmit={handleCreateProvider} onCancel={() => setShowProviderModal(false)} isLoading={isOperationLoading} />
                : <OidcProviderForm provider={editingProvider || undefined} onSubmit={handleCreateProvider} onCancel={() => setShowProviderModal(false)} isLoading={isOperationLoading} />
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
