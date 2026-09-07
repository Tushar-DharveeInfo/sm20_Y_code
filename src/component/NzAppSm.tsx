import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider, DefaultTheme } from 'styled-components';
import { ModuleRegistry as GridModuleRegistry, AllCommunityModule as GridAllCommunityModule } from 'ag-grid-community';
import './NzAppSm.css';
import themes from '../component/shared/theme-provider.json';
import { useSessionContext } from './shared/context/hooks/SessionHooks';
import { useMainAppContext } from './shared/context/hooks/MainAppHooks';
import { AppContextWrapper } from './shared/context/AppContextWrapper';
import { NodeHeight, SubMenuHeight } from './appcontainer/alldefaultprops/DefaultPropsAppContainer';
import { GlobalStyles } from './features/appqa/theme/GlobalStyles';
import { IDeploymentEnv, IDeploymentEnvResponse } from './shared/allinterface/IApiResponse';
import { AppContainer } from './appcontainer/AppContainer';
import { FnSetSessionStorageItem } from './appcontainer/allcommon/FnSetSessionStorageItem';
import deploymentEnvSampleData from '../smsampledata/auth/DeploymentEnvSampleData.json';
import authSampleData from '../smsampledata/auth/AuthorizationSampleData.json';
import sampleUserLicenses from '../smsampledata/features/MySubscriptionsSampleData.json';

const { sampleDeploymentEnvResponse } = deploymentEnvSampleData;
const { sampleSessionId, sampleSessionVariables } = authSampleData as {
    sampleSessionId: string;
    sampleSessionVariables: any[];
};
import type { IFeatureItem, IUserAuthSession, IUserInfoAndSubscription } from './shared/context/allinterface/IMainApp';
import { FnGetAuthDisplayName } from './appcontainer/allcommon/FnGetLoggedInStatusMessage';
import { AuthSession, getFirebaseServices } from '@n20a/libauth';
import { CloudStorageProvider, FirestoreProvider, ICloudStorageDeps } from '@n20a/libfsdb';
import { IAxiosInterceptorDeps } from '@n20a/libaxios';
import { useSmDataContext } from './shared/context/hooks/SmDataHooks';
import { FnGetBidCid } from './appcontainer/allcommon/FnGetBidCid';

GridModuleRegistry.registerModules([GridAllCommunityModule]);
interface INzAppSm {
    uniqueName: string;
    user: AuthSession;
    onSuccess: () => void;
    onError: (error: string) => void;
}

function isDeploymentEnvResponse(response: unknown): response is IDeploymentEnvResponse {
    return (
        typeof response === "object"
        && response !== null
        && "valid" in response
        && "env" in response
        && Array.isArray((response as { env: unknown }).env)
    );
}

const fnFormatFeature = (record: Record<string, any>) => {

    const toFeatureId = (value: string | number | undefined): string =>
        value === undefined || value === null ? "" : String(value);
    const toBool = (value: string | boolean | undefined, defaultValue = false): boolean => {
        if (typeof value === "boolean") return value;
        if (value === "1" || value === "true") return true;
        if (value === "0" || value === "false") return false;
        return defaultValue;
    };
    const featureId = toFeatureId(record._Feature ?? record.Feature);
    const menuId = toFeatureId(record.MenuID ?? featureId);

    return {
        ...record,
        EntityName: record.EntityName ?? "Feature",
        MenuID: menuId,
        _Feature: featureId,
        Label: record.Label ?? "",
        Tooltip: record.Tooltip ?? "",
        SortOrder: record.SortOrder,
        DefaultQA: toBool(record.DefaultQA),
        Secured: toBool(record.Secured),
        NodeType: record.NodeType ?? "",
        FeatureTag: record.FeatureTag ?? "",
        FilterForm: record.FilterForm ?? "",
        SearchPrompt: record.SearchPrompt ?? null,
        IsNZ: toBool(record.IsNZ, true),
        // feature.json often omits EntID; empty EntID makes every menu group match as "selected" and open.
        EntID: record.EntID ? String(record.EntID) : featureId,
        RecID: record.RecID ? String(record.RecID) : featureId,
        LastUpdated: record.LastUpdated ?? "",
    };
}

function NzLoadContextAndVariables({ uniqueName, user, onError, onSuccess }: INzAppSm) {
    console.log('NzApp received user:', user);

    const [selectedTheme, setSelectedTheme] = useState<DefaultTheme>(themes.data.light);
    const [isSessionCreated, setIsSessionCreated] = useState(false);
    const [isDeploymentVarsLoaded, setIsDeploymentVarsLoaded] = useState(false);

    const sessionContext = useSessionContext();
    const mainAppContext = useMainAppContext();
    const smDataContext = useSmDataContext();

    useEffect(() => {
        smDataContext.loadBusinessesOnce();
    }, [smDataContext.loadBusinessesOnce]);

    const reportFatalError = useCallback(
        (message: string, err?: unknown) => {
            console.error("NzApp fatal error:", message, err);
            onError?.(message);
        },
        [onError]
    );

    useEffect(() => {
        const loadDeploymentVars = async () => {
            try {
                const appConfig: IDeploymentEnv[] = Object.entries(window.APP_CONFIG ?? {}).map(
                    ([key, value]) => ({
                        key,
                        value: String(value)
                    })
                );

                // SAMPLE DATA: expapi /deployment/env not called
                const apiResponse = sampleDeploymentEnvResponse;

                if (!isDeploymentEnvResponse(apiResponse)) {
                    throw new Error("Invalid environment response.");
                }

                const { valid, env } = apiResponse;
                if (!valid) {
                    throw new Error("Invalid environment response.");
                }
                if (env.length === 0) {
                    throw new Error("Environment configuration not found.");
                }

                const mergedEnv = [
                    ...env,
                    ...appConfig.filter(
                        appItem => !env.some(apiItem => apiItem.key === appItem.key)
                    )
                ];

                mainAppContext.setDeploymentVars(mergedEnv);
                setIsDeploymentVarsLoaded(true);
            } catch (error) {
                reportFatalError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load environment configuration."
                );
                setIsDeploymentVarsLoaded(false);
                setIsSessionCreated(false);
            }
        };

        void loadDeploymentVars();
    }, []);

    useEffect(() => {
        if (!isDeploymentVarsLoaded) return;

        const isMountedRef = { current: true };

        const initializeData = async () => {
            if (!sampleSessionVariables.length || !sampleSessionId) return;
            if (!isMountedRef.current) return;

            let featureRecords: IFeatureItem[] = [];
            try {
                let response = await fetch('/smFeatures.json');
                if (!response.ok) {
                    response = await fetch('/feature.json');
                }
                if (!response.ok) {
                    throw new Error(`Failed to fetch features json: ${response.status}`);
                }
                const rawFeatures = await response.json();
                if (Array.isArray(rawFeatures)) {
                    featureRecords = rawFeatures.map(fnFormatFeature) as IFeatureItem[];
                } else {
                    throw new Error("features json is not an array");
                }
            } catch (err) {
                console.error("Error loading features json:", err);
                reportFatalError("Failed to load features from smFeatures.json / feature.json");
                return;
            }

            if (!featureRecords.length) {
                reportFatalError("Features table is empty");
                return;
            }

            mainAppContext.setFeatureRecords(featureRecords);
            mainAppContext.setAllFeatureRecords(featureRecords);


            const bidCid = FnGetBidCid(user?.email);
            const bid = bidCid?.bid;
            const cid = bidCid?.cid;

            const authSession: IUserAuthSession = {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                email: user.email ?? null,
                phoneNumber: user.phoneNumber ?? null,
                authType: String(user.authType ?? ""),
                tenantNickname: user.tenantNickname ?? null,
                bid,
                cid,
            };
            mainAppContext.setAuthSession(authSession);

            const displayName = FnGetAuthDisplayName(authSession);
            const userInfoAndSubscription: IUserInfoAndSubscription = {
                userInfo: {
                    displayName: displayName || "User",
                    username: user?.username ?? "",
                    email: user?.email as string,
                    tenantNickname: user?.tenantNickname as string,
                    bid,
                    cid,
                },
                subscription: sampleUserLicenses,
            };
            mainAppContext.setUserInfoAndSubscription(userInfoAndSubscription);

            sessionContext.setSessionList(sampleSessionVariables);
            setIsSessionCreated(true);


            try {
                onSuccess();
            } catch (error) {
                console.error("Error in onSuccess callback:", error);
            }
        };

        void initializeData();

        const root = document.documentElement;
        root.style.setProperty("--node_height", NodeHeight);
        root.style.setProperty("--submenu_height", SubMenuHeight);

        return () => {
            isMountedRef.current = false;
        };
    }, [isDeploymentVarsLoaded]);

    const handleThemeChange = useCallback((theme: unknown) => {
        if (typeof theme !== 'object' || theme === null || !('name' in theme)) {
            console.error('Invalid theme object');
            return;
        }

        const typedTheme = theme as DefaultTheme & { name: string };
        FnSetSessionStorageItem("selected_theme", typedTheme.name);
        setSelectedTheme(typedTheme);
    }, []);

    return (
        <ThemeProvider theme={selectedTheme}>
            <GlobalStyles />
            {isSessionCreated && isDeploymentVarsLoaded && (
                <AppContainer
                    isNewSession={true}
                    uniqueName={uniqueName}
                    handleThemeChange={handleThemeChange}
                />
            )}
        </ThemeProvider>
    );
}

function NzAppSm(props: INzAppSm) {
    const [firebaseToken, setFirebaseToken] = useState<string | null>(null);

    useEffect(() => {
        const { auth } = getFirebaseServices();
        // onAuthStateChanged fires once auth state is restored from persistence
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            const token = user ? await user.getIdToken() : null;
            setFirebaseToken(token);
        });
        return unsubscribe;
    }, []);

    const cfg = (window as Window & { APP_CONFIG?: Record<string, string> }).APP_CONFIG ?? {};

    const firestoreDeps = useMemo<IAxiosInterceptorDeps>(() => ({
        getBaseApiUrl: () => cfg.CLOUDRUN_URL || (import.meta.env.DEV ? 'http://localhost:8080' : ''),
        getSessionId: () => (firebaseToken ? `Bearer ${firebaseToken}` : null),
        sessionHeaderName: 'Authorization',
        defaultTimeoutMs: 30000,
    }), [firebaseToken]);

    const cloudStorageDeps = useMemo<ICloudStorageDeps>(() => ({
        getBaseApiUrl: () => cfg.CLOUDRUN_URL || (import.meta.env.DEV ? 'http://localhost:8080' : ''),
        getValidationCode: () => cfg.VALIDATION_CODE ?? '',
    }), []);

    if (!firebaseToken) {
        console.log('No Firebase token available');
        return null;
    }
    return (
        <FirestoreProvider deps={firestoreDeps}>
            <CloudStorageProvider deps={cloudStorageDeps}>
                <AppContextWrapper>
                    <Router>
                        <NzLoadContextAndVariables {...props} />
                    </Router>
                </AppContextWrapper>
            </CloudStorageProvider>
        </FirestoreProvider>
    );
}

export default NzAppSm
