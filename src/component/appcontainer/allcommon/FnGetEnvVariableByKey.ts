
import { getDeploymentVars } from "../../shared/context/contextandprovider/MainApp";

const FnGetEnvVariableByKey = (key: string): string | null => {
    if (!key?.trim()) {
        return null;
    }
    const origin = window.location.origin;
    const isProd = import.meta.env.PROD;
    const api =
        (window as Window & {
            APP_CONFIG?: { VITE_API_AT?: string };
        }).APP_CONFIG?.VITE_API_AT ?? "n20api";
    const defaultApiUrl = isProd
        ? `${origin}/${api}`
        : `/${api}`;
    const envVars = getDeploymentVars() as Record<string, any>[] | undefined;
    const value =
        envVars?.find(item =>
            item.key?.toLowerCase().endsWith(key.trim().toLowerCase())
        )?.value ?? null;

    if (key.toLowerCase() === "n20_api_url") {
        return value ?? defaultApiUrl;
    }
    return value;
}

export { FnGetEnvVariableByKey }