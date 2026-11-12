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
import { AppContainer } from './appcontainer/AppContainer';
import { FnSetSessionStorageItem } from './appcontainer/allcommon/FnSetSessionStorageItem';
import { AuthSession, getFirebaseServices } from '@n20a/libauth';
import { FirebaseStorageProvider, FirestoreProvider, IFirebaseStorageDeps } from '@n20a/libfsdb';
import { IAxiosInterceptorDeps } from '@n20a/libaxios';
import { useSmDataContext } from './shared/context/hooks/SmDataHooks';
import { fnFilterPermittedFeatures } from './shared/allcommon/menu/FnFeatureNodeType';
import { createAuthSession, loadFeatureRecords, loadRuntimeConfig, parseApStringArray, toDeploymentEnv } from './shared/allcommon/NzAppBootstrap';

GridModuleRegistry.registerModules([GridAllCommunityModule]);
interface INzAppSm {
    uniqueName: string;
    user: AuthSession;
    onSuccess: () => void;
    onError: (error: string) => void;
}

// here we will load all other variables including making maincontext and session context ready
function NzLoadContextAndVariables({ uniqueName, user, onError, onSuccess }: INzAppSm) {
    // console.log('NzApp received user:', user);

    const [selectedTheme, setSelectedTheme] = useState<DefaultTheme>(themes.data.light);
    const [isSessionCreated, setIsSessionCreated] = useState(false);
    const [isDeploymentVarsLoaded, setIsDeploymentVarsLoaded] = useState(false);
    const [tabLabel] = useState(() => new URLSearchParams(window.location.search).get("tablabel"));

    const sessionContext = useSessionContext();
    const mainAppContext = useMainAppContext();  //here we store main app related context like auth user, apm theme, deployment vars, etc.
    const smDataContext = useSmDataContext();       //here we store sm data like businesses, menus, etc.

    // Set document.title from tablabel param so BroadcastChannel tab-counting works.
    useEffect(() => {
        if (tabLabel?.startsWith('SM-')) {
            document.title = tabLabel;
        }
    }, [tabLabel]);

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
                const configObj = await loadRuntimeConfig();
                const appConfig = toDeploymentEnv(configObj);

                if (appConfig.length === 0) {
                    throw new Error("Environment configuration not found in config.js.");
                }

                mainAppContext.setDeploymentVars(appConfig);
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
        const root = document.documentElement;
        root.style.setProperty("--node_height", NodeHeight);
        root.style.setProperty("--submenu_height", SubMenuHeight);
    }, []);

    useEffect(() => {
        if (!isDeploymentVarsLoaded) return;

        const initializeData = async () => {
            if (!mainAppContext.deploymentVars.length) {
                reportFatalError("Deployment variables are not loaded.");
                return;
            }
            if (!mainAppContext.ap?.length) {
                return;
            }

            try {
                const featureRecords = await loadFeatureRecords();
                if (!featureRecords.length) {
                    reportFatalError("Features table is empty");
                    return;
                }

                const availableAppsRaw = mainAppContext.getApValue("AvailableApps");
                const availableApps = parseApStringArray(availableAppsRaw);  //it converts raw string to array of string

                if (!availableApps.length) {
                    reportFatalError("AvailableApps parameter is missing or invalid in AP configuration.");
                    return;
                }


                const smRolesRaw = mainAppContext.getApValue("SmRoles");
                const smRoles = parseApStringArray(smRolesRaw);  //it converts raw string to array of string

                if (!smRoles.length) {
                    reportFatalError("smRoles parameter is missing or invalid in AP configuration.");
                    return;
                }


                console.log('user authSession', user)
                const authSession = createAuthSession({
                    user,
                    deploymentVars: mainAppContext.deploymentVars,
                    availableApps,
                    smRoles: smRoles
                });

                mainAppContext.setAuthSession(authSession);

                console.log("YADAV [NzAppSm] - Auth session initialized:", authSession);

                const initialFilteredFeatures = fnFilterPermittedFeatures(featureRecords, authSession, {
                    authSession,
                });
                mainAppContext.setFeatureRecords(initialFilteredFeatures);
                sessionContext.setSessionList([]);
                setIsSessionCreated(true);

                try {
                    onSuccess();
                } catch (error) {
                    console.error("Error in onSuccess callback:", error);
                }
            }
            catch (err) {
                console.error("Error initializing app bootstrap data:", err);
                reportFatalError("Failed to load features from smFeatures.json.");
                return;
            }
        };

        void initializeData();
    }, [isDeploymentVarsLoaded, mainAppContext.deploymentVars, mainAppContext.ap]);

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
    const { onError } = props;

    useEffect(() => {
        const { auth } = getFirebaseServices();
        // onAuthStateChanged fires once auth state is restored from persistence
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (!user) {
                setFirebaseToken(null);
                return;
            }
            try {
                const token = await user.getIdToken();
                setFirebaseToken(token);
            } catch (error) {
                // Without this catch a rejection here (e.g. auth/tenant-id-mismatch)
                // would leave firebaseToken stuck at null forever with no feedback.
                console.error('Failed to obtain Firebase ID token:', error);
                setFirebaseToken(null);
                onError?.(error instanceof Error ? error.message : 'Failed to obtain Firebase ID token.');
            }
        });
        return unsubscribe;
    }, [onError]);

    //for .env and public/config.js configuration values
    const cfg = (window as Window & { APP_CONFIG?: Record<string, string> }).APP_CONFIG ?? {};

    const firestoreDeps = useMemo<IAxiosInterceptorDeps>(() => ({
        getBaseApiUrl: () => cfg.CLOUDRUN_URL || (import.meta.env.DEV ? 'http://localhost:8080' : ''),
        getSessionId: () => (firebaseToken ? `Bearer ${firebaseToken}` : null),
        sessionHeaderName: 'Authorization',
        defaultTimeoutMs: 30000,
    }), [firebaseToken]);

    const firebaseStorageDeps = useMemo<IFirebaseStorageDeps>(() => ({
        getBaseApiUrl: () => cfg.CLOUDRUN_URL || (import.meta.env.DEV ? 'http://localhost:8080' : ''),
        getValidationCode: () => cfg.VALIDATION_CODE ?? '',
        getFirebaseApp: () => getFirebaseServices().app,
    }), []);

    if (!firebaseToken) {
        // Briefly null while the Firebase ID token resolves asynchronously after sign-in; not an error.
        return null;
    }
    return (
        <FirestoreProvider deps={firestoreDeps}>
            <FirebaseStorageProvider deps={firebaseStorageDeps}>
                <AppContextWrapper>
                    <Router>
                        <NzLoadContextAndVariables {...props} />
                    </Router>
                </AppContextWrapper>
            </FirebaseStorageProvider>
        </FirestoreProvider>
    );
}

export default NzAppSm
