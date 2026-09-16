import { createContext, useEffect, useMemo, useState, useCallback } from "react";
import { IFeatureForHelp, IFeatureItem, IMainApp, IUserAuthSession } from "../allinterface/IMainApp";
import { IAppContextWrapper } from "../allinterface/IAppContextWrapper";
import { IStatusBar } from "../allinterface/IStatusBar";
import { useActivities } from "@n20a/libfsdb";
import { ITreeNode } from "../../allinterface/tree/ITreeControl";
import { fnFilterPermittedFeatures } from "../../allcommon/menu/FnFeatureNodeType";


let featuresData: IFeatureItem[] | null = null;
let deploymentVarData: Record<string, any>[] | null = null;

const getfeaturesData = (): IFeatureItem[] | null => featuresData;
const getDeploymentVars = (): Record<string, any>[] | null => deploymentVarData;

const MainAppContext = createContext<IMainApp | undefined>(undefined);

function MainAppProvider({ children }: IAppContextWrapper) {
    const [rawFeatureRecords, setRawFeatureRecords] = useState<IFeatureItem[]>([]);
    const [alertRecords, setAlertRecords] = useState<Record<string, any>[]>([]);
    const [isInternetAvailable, setIsInternetAvailable] = useState<boolean>(true);
    const [deploymentVars, setDeploymentVars] = useState<Record<string, any>[]>([]);
    const [selectedFeatureForHelp, setSelectedFeatureForHelpState] = useState<IFeatureForHelp>()
    const [authSession, setAuthSession] = useState<IUserAuthSession>()
    const [businessSelectedNode, setBusinessSelectedNode] = useState<ITreeNode>()

    const setFeatureRecords = useCallback((value: React.SetStateAction<IFeatureItem[]>) => {
        setRawFeatureRecords(value);
    }, []);

    const setSelectedFeatureForHelp = useCallback((value: React.SetStateAction<IFeatureForHelp | undefined>) => {
        setSelectedFeatureForHelpState((prev) => {
            const next = typeof value === "function" ? value(prev) : value;
            if (prev?.featureID === next?.featureID && prev?.featureName === next?.featureName) {
                return prev;
            }
            return next;
        });
    }, []);

    const featureRecords = useMemo(() => {
        if (!rawFeatureRecords.length) return [];

        let filtered = rawFeatureRecords;

        if (!isInternetAvailable) {
            filtered = filtered.filter(item => !item.Internet);
        }

        // Filter features based on NodeType functions (fnAdmin, fnNetzoom, fnVss)
        filtered = fnFilterPermittedFeatures(filtered, authSession, {
            authSession,
        });

        return filtered;
    }, [rawFeatureRecords, isInternetAvailable, authSession]);

    useEffect(() => {
        try {
            featuresData = featureRecords;
        } catch (error) {
            console.error("Error updating features data:", error);
        }
    }, [featureRecords]);

    useEffect(() => {
        try {
            deploymentVarData = deploymentVars;
        } catch (error) {
            console.error("Error updating deployment vars:", error);
        }
    }, [deploymentVars]);

    const fetchApRecords = useCallback(async (_statusBarContext?: IStatusBar) => {
        // SAMPLE DATA: AP records API not called.
    }, []);



    // Derive bid from authSession for useActivities (bid maps to authSession.bid).
    const bid = String(authSession?.bid ?? "").trim();
    const { createActivity } = useActivities(bid);

    /**
     * Writes an activity-log document for the currently signed-in user.
     * All identity fields (bid, cid, displayName, username, email) are read
     * automatically from `authSession` stored in this context — the caller
     * only needs to supply the human-readable `message` string.
     *
     * Usage:
     *   // Login log
     *   await createActivityLog("User logged in");
     *   // Signout log
     *   await createActivityLog("User logged out");
     */
    const createActivityLog = useCallback(async (message: string): Promise<void> => {
        const cid = String(authSession?.cid ?? "").trim();
        if (!bid || !cid || !authSession) {
            // Not enough identity info to write a log — silently skip.
            return;
        }

        const now = new Date().toISOString();

        try {
            const result = await createActivity({
                bid,
                cid,
                activityid: `activity_${cid}_${Date.now()}`,
                message,
                monitorupdated: now,
                monitor: false,
                datecreated: now,
            });
            if (!result) {
                console.error("createActivityLog: createActivity returned null for message:", message);
                return;
            }

            if (!result.success) {
                console.error("createActivityLog failed:", result.error);
            }
        } catch (error) {
            console.error("createActivityLog error:", error);
        }
    }, [authSession, bid, createActivity]);

    const providers = useMemo(
        (): IMainApp => ({
            featureRecords,
            setFeatureRecords,
            alertRecords,
            setAlertRecords,
            isInternetAvailable,
            setIsInternetAvailable,
            authSession,
            setAuthSession,
            deploymentVars,
            setDeploymentVars,
            selectedFeatureForHelp,
            setSelectedFeatureForHelp,
            businessSelectedNode,
            setBusinessSelectedNode,
            createActivityLog,
        }),
        [
            featureRecords,
            setFeatureRecords,
            alertRecords,
            isInternetAvailable,
            deploymentVars,
            selectedFeatureForHelp,
            setSelectedFeatureForHelp,
            authSession,
            businessSelectedNode,
            fetchApRecords,
            createActivityLog,
        ]
    );

    return (
        <MainAppContext.Provider value={providers}>
            {children}
        </MainAppContext.Provider>
    );
}

export { MainAppContext, MainAppProvider, getfeaturesData, getDeploymentVars };
