import { createContext, useEffect, useMemo, useState, useCallback } from "react";
import { IFeatureItem, IMainApp, IUserAuthSession, IAp } from "../allinterface/IMainApp";
import { IAppContextWrapper } from "../allinterface/IAppContextWrapper";
import { IStatusBar } from "../allinterface/IStatusBar";
import { useFileDownload } from "@n20a/libfsdb";
import { fnFilterPermittedFeatures } from "../../allcommon/menu/FnFeatureNodeType";
import { LoadJson } from "../../allcommon/LoadJson";
import type { IDeploymentEnv } from "../../allinterface/IApiResponse";


let featuresData: IFeatureItem[] | null = null;
let deploymentVarData: IDeploymentEnv[] | null = null;

const getfeaturesData = (): IFeatureItem[] | null => featuresData;
const getDeploymentVars = (): IDeploymentEnv[] | null => deploymentVarData;

const MainAppContext = createContext<IMainApp | undefined>(undefined);

function MainAppProvider({ children }: IAppContextWrapper) {
    const [rawFeatureRecords, setRawFeatureRecords] = useState<IFeatureItem[]>([]);
    const [deploymentVars, setDeploymentVars] = useState<IDeploymentEnv[]>([]);
    const [authSession, setAuthSession] = useState<IUserAuthSession>()
    const [ap, setAp] = useState<IAp[]>();
    const folderName = authSession?.baseFolder ?? "";
    const { downloadSingleFile } = useFileDownload();

    useEffect(() => {
        let cancelled = false;

        const loadApJson = async () => {
            const filePath = `n20-bucket-01/sm/ap/apsm.json`
            const apJson = await LoadJson(filePath, downloadSingleFile);

            ;
            if (!apJson || cancelled) return;

            // The JSON uses lowercase keys (apname, value); normalize to IAp shape (apName, apValue).
            const normalized = (apJson as Record<string, string>[]).map((item: any) => ({
                apName: item.apName ?? item.apname ?? '',
                apValue: item.apValue ?? item.value ?? '',
            }));

            if (!cancelled) {
                setAp(normalized as IAp[]);
            }
        };

        void loadApJson().catch((error) => {
            if (!cancelled) {
                console.error("Error loading APSM JSON:", error);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [folderName, downloadSingleFile]);

    const setFeatureRecords = useCallback((value: React.SetStateAction<IFeatureItem[]>) => {
        setRawFeatureRecords(value);
    }, []);


    const featureRecords = useMemo(() => {
        if (!rawFeatureRecords.length) return [];

        let filtered = rawFeatureRecords;


        // Filter features based on NodeType functions (fnAdmin, fnNetzoom, fnVss)
        filtered = fnFilterPermittedFeatures(filtered, authSession, {
            authSession,
        });

        return filtered;
    }, [rawFeatureRecords, authSession]);

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


    const getApValue = (apName: string): string | undefined => {
        return ap?.find((item) => item.apName === apName)?.apValue;
    };


    const providers = useMemo(
        (): IMainApp => ({
            featureRecords,
            setFeatureRecords,
            authSession,
            setAuthSession,
            deploymentVars,
            setDeploymentVars,
            ap,
            setAp,
            getApValue,

        }),
        [
            featureRecords,
            setFeatureRecords,
            ap,
            deploymentVars,
            authSession,
            fetchApRecords,
        ]
    );

    return (
        <MainAppContext.Provider value={providers}>
            {children}
        </MainAppContext.Provider>
    );
}

export { MainAppContext, MainAppProvider, getfeaturesData, getDeploymentVars };
