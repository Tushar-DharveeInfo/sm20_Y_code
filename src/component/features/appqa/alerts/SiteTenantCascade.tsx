import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CascadingComboForm, ICombo } from '@n20a/libform';
import { useSessionContext } from '../../../shared/context/hooks/SessionHooks';
import { FnGetSessionVariableFromStorage } from '../../../shared/allcommon/basic/FnGetSessionVariableFromStorage';
import { IRefData } from '../../../shared/allinterface/basic/IRefData';
import {
    ICascadeComboOption,
    ICascadingComboInitialValues,
    ISiteRefOption,
    ITenantRecord,
    ITenantSiteData,
} from '../../../shared/allinterface/sidebar/ISiteTenantUserCascade';
import { ISession } from '../../../shared/context/allinterface/ISession';
import { IAppqaAlertSiteTenantCascade } from './IAlerts';
import forensicLogData from '../../../../smsampledata/sidebar/SiteTenantCascadeSampleData.json';
const {
    sampleForensicLogSites,
    sampleForensicLogTenantUsers,
} = forensicLogData;

const SITE_COMBO_ID = 'Site Name';
const TENANT_COMBO_ID = 'Tenant';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

const parseApiJsonPayload = (response: unknown): unknown => {
    if (!isRecord(response)) {
        return response;
    }

    if (typeof response.jsonStringOutput === 'string' && response.jsonStringOutput.trim()) {
        try {
            return JSON.parse(response.jsonStringOutput);
        } catch (error) {
            console.error('error in parse json string :', error);
            return response;
        }
    }

    if (typeof response.jsonString === 'string' && response.jsonString.trim()) {
        try {
            return JSON.parse(response.jsonString);
        } catch (error) {
            console.error('error in parse json string :', error);
            return response;
        }
    }

    return response;
};

const parseRefSitesResponse = (response: unknown): IRefData[] => {
    const payload = parseApiJsonPayload(response);
    return Array.isArray(payload) ? payload as IRefData[] : [];
};

const toTenantRecord = (value: unknown): ITenantRecord | null => {
    if (!isRecord(value)) {
        return null;
    }

    const tenantName = String(value.TenantName ?? '').trim();
    const tenantId = String(value.TenantID ?? '').trim();
    if (!tenantName) {
        return null;
    }

    return {
        TenantID: tenantId,
        TenantName: tenantName,
        Users: [],
    };
};

const parseTenantDataResponse = (response: unknown): ITenantRecord[] => {
    const parsePayload = (payload: unknown): ITenantRecord[] => {
        if (!isRecord(payload)) {
            return [];
        }

        const tenantsSource = payload.Tenants ?? payload.tenants;
        if (!Array.isArray(tenantsSource)) {
            return [];
        }

        return tenantsSource
            .map(toTenantRecord)
            .filter((tenant): tenant is ITenantRecord => tenant !== null);
    };

    const directTenants = parsePayload(response);
    if (directTenants.length) {
        return directTenants;
    }

    return parsePayload(parseApiJsonPayload(response));
};

const findSiteOption = (
    mappedSites: ISiteRefOption[],
    siteName: string
): ISiteRefOption | undefined => {
    const normalizedSiteName = siteName.trim().toLowerCase();
    if (!normalizedSiteName) {
        return undefined;
    }

    return mappedSites.find(
        (site) =>
            site.value.toLowerCase() === normalizedSiteName ||
            site.label.toLowerCase() === normalizedSiteName
    );
};

const toSiteRefOptions = (sites: IRefData[]): ISiteRefOption[] =>
    sites
        .map((site) => ({
            label: String(site.Label ?? site.Value ?? site.Name ?? '').trim(),
            value: String(site.Value ?? site.Name ?? '').trim(),
            entId: String(site.EntID ?? site.RefValue ?? '').trim(),
        }))
        .filter((site) => site.label && site.value);

const resolveDefaultSiteFromSession = (
    mappedSites: ISiteRefOption[],
    sessionList: ISession[]
): ISiteRefOption | null => {
    const defaultSite = FnGetSessionVariableFromStorage('Location', 'SiteName', sessionList);
    const sessionSiteName = defaultSite?.[0]?.SessionValue?.trim() ?? '';

    if (sessionSiteName) {
        const matchedByName = findSiteOption(mappedSites, sessionSiteName);
        if (matchedByName) {
            return matchedByName;
        }
    }

    const defaultSiteId = FnGetSessionVariableFromStorage('Location', 'SiteID', sessionList);
    const sessionSiteId = defaultSiteId?.[0]?.SessionValue?.trim() ?? '';
    if (sessionSiteId) {
        const matchedById = mappedSites.find((site) => site.entId === sessionSiteId);
        if (matchedById) {
            return matchedById;
        }
    }

    return null;
};

const getSessionDefaultSiteName = (sessionList: ISession[]): string => {
    const defaultSite = FnGetSessionVariableFromStorage('Location', 'SiteName', sessionList);
    return defaultSite?.[0]?.SessionValue?.trim() ?? '';
};

const toTenantComboOptions = (tenants: ITenantRecord[]): ICascadeComboOption[] =>
    tenants.map((tenant) => ({ Option: tenant.TenantName }));

const resolveTenantName = (
    tenants: ITenantRecord[],
    preferredTenantName?: string
): string => {
    if (preferredTenantName !== undefined) {
        const normalizedPreferred = preferredTenantName.trim();
        if (!normalizedPreferred) {
            return '';
        }

        const matchedTenant = tenants.find(
            (tenant) =>
                tenant.TenantName === normalizedPreferred ||
                tenant.TenantName.toLowerCase() === normalizedPreferred.toLowerCase()
        );
        return matchedTenant?.TenantName ?? tenants[0]?.TenantName ?? '';
    }

    return tenants[0]?.TenantName ?? '';
};

const toCascadeOutputValues = (siteName: string, tenantName: string) => ({
    SiteName: siteName,
    TenantName: tenantName,
});

function SiteTenantCascade(props: IAppqaAlertSiteTenantCascade) {
    const [siteOptions, setSiteOptions] = useState<ISiteRefOption[]>([]);
    const [cascadeInitialValues, setCascadeInitialValues] = useState<ICascadingComboInitialValues>();
    const [cascadeFormKey, setCascadeFormKey] = useState<string>('cascade-init');
    const sessionContext = useSessionContext();
    const isSiteLocked = props.loginType?.toLowerCase() === 'node';

    const sitesLoadedRef = useRef(false);
    const sessionDefaultAppliedRef = useRef(false);
    const tenantRequestSiteIdRef = useRef<string>('');
    const siteOptionsRef = useRef<ISiteRefOption[]>([]);
    const tenantRecordsRef = useRef<ITenantRecord[]>([]);
    const tenantOptionsRef = useRef<ICascadeComboOption[]>([]);
    const selectedSiteIdRef = useRef<string>('');
    const selectedTenantNameRef = useRef<string>('');

    const notifyValuesChange = useCallback((
        siteName: string,
        tenantName: string,
        isDefault = false
    ) => {
        props.onValuesChange(toCascadeOutputValues(siteName, tenantName), { isDefault });
    }, [props.onValuesChange]);

    const applyTenantSelection = useCallback((
        siteName: string,
        tenantName: string,
        isDefault = false
    ) => {
        selectedTenantNameRef.current = tenantName;

        const nextTenantOptions = toTenantComboOptions(tenantRecordsRef.current);
        tenantOptionsRef.current = nextTenantOptions;

        setCascadeInitialValues({
            [SITE_COMBO_ID]: siteName || null,
            [TENANT_COMBO_ID]: tenantName || null,
        });
        setCascadeFormKey(`${selectedSiteIdRef.current}-${tenantName}-${nextTenantOptions.length}`);

        notifyValuesChange(siteName, tenantName, isDefault);
    }, [notifyValuesChange]);

    const loadTenantDataForSite = useCallback((
        siteId: string,
        preferredTenantName?: string,
        forceReload = false
    ): Promise<ITenantSiteData> => {
        if (!siteId) {
            tenantRecordsRef.current = [];
            tenantOptionsRef.current = [];
            tenantRequestSiteIdRef.current = '';
            return Promise.resolve({
                tenants: [],
                defaultTenantName: '',
                defaultUserName: '',
            });
        }

        if (!forceReload && tenantRequestSiteIdRef.current === siteId && tenantRecordsRef.current.length) {
            const tenantName = resolveTenantName(tenantRecordsRef.current, preferredTenantName);
            return Promise.resolve({
                tenants: tenantRecordsRef.current,
                defaultTenantName: tenantName,
                defaultUserName: '',
            });
        }

        tenantRequestSiteIdRef.current = siteId;

        return new Promise((resolve) => {
            // SAMPLE DATA: AUTH.GetTenantUserForSite API commented out.
            // axiosInterceptor({ url: AUTH.GetTenantUserForSite, data: { sessionId, siteID }, ... });
            try {
                const tenants = parseTenantDataResponse(sampleForensicLogTenantUsers);
                tenantRecordsRef.current = tenants;
                const defaultTenantName = resolveTenantName(tenants, preferredTenantName);
                tenantOptionsRef.current = toTenantComboOptions(tenants);

                resolve({
                    tenants,
                    defaultTenantName,
                    defaultUserName: '',
                });
            } catch (error) {
                console.error('SiteTenantCascade: failed to parse tenant data', error);
                tenantRecordsRef.current = [];
                tenantOptionsRef.current = [];
                resolve({
                    tenants: [],
                    defaultTenantName: '',
                    defaultUserName: '',
                });
            }
        });
    }, []);

    const applySiteSelection = useCallback(async (
        siteName: string,
        siteId: string,
        preferredTenantName?: string,
        isDefault = false,
        forceReload = false
    ) => {
        if (!siteId) {
            return;
        }

        const siteChanged = selectedSiteIdRef.current !== siteId;
        selectedSiteIdRef.current = siteId;

        const tenantData = await loadTenantDataForSite(
            siteId,
            preferredTenantName,
            forceReload || siteChanged
        );

        applyTenantSelection(
            siteName,
            tenantData.defaultTenantName,
            isDefault
        );
    }, [applyTenantSelection, loadTenantDataForSite]);

    const handleSiteChange = useCallback(async (siteName: string | null) => {
        if (isSiteLocked) {
            return;
        }

        const normalizedSiteName = siteName?.trim() ?? '';
        const matchedSite = findSiteOption(siteOptionsRef.current, normalizedSiteName);

        if (!matchedSite?.entId) {
            tenantRequestSiteIdRef.current = '';
            tenantRecordsRef.current = [];
            tenantOptionsRef.current = [];
            selectedSiteIdRef.current = '';
            selectedTenantNameRef.current = '';

            setCascadeInitialValues({
                [SITE_COMBO_ID]: normalizedSiteName || null,
                [TENANT_COMBO_ID]: null,
            });
            setCascadeFormKey(`site-${normalizedSiteName}-empty`);
            notifyValuesChange(normalizedSiteName, '');
            return;
        }

        tenantOptionsRef.current = [];
        setCascadeFormKey(`site-${matchedSite.entId}-loading`);

        await applySiteSelection(matchedSite.value, matchedSite.entId, undefined, false, true);
    }, [applySiteSelection, isSiteLocked, notifyValuesChange]);

    const handleTenantChange = useCallback((tenantName: string | null) => {
        const normalizedTenantName = tenantName?.trim() ?? '';
        const matchedSite = siteOptionsRef.current.find(
            (site) => site.entId === selectedSiteIdRef.current
        );
        const siteName = matchedSite?.value ?? '';

        if (!normalizedTenantName) {
            applyTenantSelection(siteName, '');
            return;
        }

        applyTenantSelection(
            siteName,
            normalizedTenantName
        );
    }, [applyTenantSelection]);

    const siteTenantComboConfig = useMemo((): ICombo[] | undefined => {
        if (!siteOptions.length) {
            return undefined;
        }

        return [
            {
                id: SITE_COMBO_ID,
                label: SITE_COMBO_ID,
                disable: isSiteLocked,
                populateOptions: () =>
                    siteOptions.map((site) => ({ Option: site.value })),
                onChange: (value) => {
                    void handleSiteChange(value);
                },
            },
            {
                id: TENANT_COMBO_ID,
                label: TENANT_COMBO_ID,
                populateOptions: () => tenantOptionsRef.current,
                onChange: (value) => {
                    handleTenantChange(value);
                },
            },
        ];
    }, [handleSiteChange, handleTenantChange, isSiteLocked, siteOptions]);

    const cascadeFormInitialValues = useMemo((): ICascadingComboInitialValues => {
        if (cascadeInitialValues) {
            return cascadeInitialValues;
        }

        if (isSiteLocked) {
            const siteName = props.profileSiteName?.trim() ?? '';
            return {
                [SITE_COMBO_ID]: siteName || null,
                [TENANT_COMBO_ID]: null,
            };
        }

        return {
            [SITE_COMBO_ID]: null,
            [TENANT_COMBO_ID]: null,
        };
    }, [cascadeInitialValues, isSiteLocked, props.profileSiteName]);

    const showCascade = Boolean(
        siteTenantComboConfig &&
        (!isSiteLocked || cascadeFormInitialValues[SITE_COMBO_ID])
    );

    useEffect(() => {
        siteOptionsRef.current = siteOptions;
    }, [siteOptions]);

    useEffect(() => {
        if (sitesLoadedRef.current) {
            return;
        }

        const loadSiteOptions = async () => {
            try {
                // SAMPLE DATA: MISC.GetRefList (refsites) API commented out.
                // axiosInterceptor({ url: MISC.GetRefList, data: { groupNameCollection: 'refsites' }, ... });
                const sites = parseRefSitesResponse(sampleForensicLogSites);
                const mappedSites = toSiteRefOptions(sites);
                siteOptionsRef.current = mappedSites;
                setSiteOptions(mappedSites);
                sitesLoadedRef.current = true;
            } catch (error) {
                console.error('SiteTenantCascade: failed to load site options', error);
            }
        };

        void loadSiteOptions();
    }, []);

    useEffect(() => {
        if (
            !sitesLoadedRef.current ||
            !siteOptions.length ||
            sessionDefaultAppliedRef.current
        ) {
            return;
        }

        const storedSiteName = props.initialSiteName?.trim();
        const hasStoredTenant = props.initialTenantName !== undefined && props.initialTenantName !== null;

        if (storedSiteName) {
            const matchedSite = findSiteOption(siteOptions, storedSiteName);
            if (!matchedSite?.entId) {
                return;
            }

            sessionDefaultAppliedRef.current = true;
            void applySiteSelection(
                matchedSite.value,
                matchedSite.entId,
                hasStoredTenant ? String(props.initialTenantName ?? '').trim() : undefined,
                false,
                true
            );
            return;
        }

        const sessionSiteName = getSessionDefaultSiteName(sessionContext.SessionList);
        if (!sessionSiteName) {
            return;
        }

        const matchedSite = resolveDefaultSiteFromSession(
            siteOptions,
            sessionContext.SessionList
        );
        if (!matchedSite?.entId) {
            return;
        }

        sessionDefaultAppliedRef.current = true;

        const defaultTenantList = FnGetSessionVariableFromStorage(
            'Filter',
            'TenantName',
            sessionContext.SessionList
        );
        const sessionTenant = defaultTenantList?.[0]?.SessionValue?.trim() ?? '';
        const preferredTenantName = sessionTenant;

        void applySiteSelection(
            matchedSite.value,
            matchedSite.entId,
            preferredTenantName,
            true,
            true
        );
    }, [
        applySiteSelection,
        props.initialSiteName,
        props.initialTenantName,
        sessionContext.SessionList,
        siteOptions,
    ]);

    if (!showCascade || !siteTenantComboConfig) {
        return null;
    }

    return (
        <div className='nz-appqa-alert-filter-cascade'>
            <CascadingComboForm
                key={cascadeFormKey}
                initialValues={cascadeFormInitialValues}
                cascadingComboArray={siteTenantComboConfig}
                buttons={[]}
                autoSubmit={true}
            />
        </div>
    );
}

export { SiteTenantCascade };
