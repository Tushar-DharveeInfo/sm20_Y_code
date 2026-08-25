import { lazy, Suspense, useEffect, useRef } from 'react'
import { FeatureEnums, ServicesEnums, LibraryEnums, SettingsEnums } from '../../constants/Feature.ts'
import ErrorBoundary from '../../shared/errorboundary/ErrorBoundary.tsx'
import { Loader } from '../../shared/loader/Loader.tsx'
import { ImportTemplates } from '../../features/resources/importtemplates/ImportTemplates.tsx'
import { IFeatureContainer } from './FeatureContainer.tsx'
import { CatalogAndDiscounts } from '../../features/resources/cataloganddiscounts/CatalogAndDiscounts.tsx'

const DashboardChartsContainer = lazy(() => import('../../features/home/dashboardchartscontainer/DashboardChartsContainer.tsx'))
const DeviceLibrary = lazy(() => import('../../features/library/devicelibrary/DeviceLibrary.tsx'))
const DailySchedular = lazy(() => import('../../features/settings/dailyschedular/DailySchedular.tsx'))
const SaasInstance = lazy(() => import('../../features/settings/saasinstance/SaasInstance.tsx'))

interface IFeatureRenderContainer {
    allowFeatureToRender: boolean;
    featureContainerProps: IFeatureContainer;
    handleShowUserMessage: (messageText: string, container?: HTMLDivElement) => void;
}
type ServicesRedirectProps = {
    bid?: string | number;
    cid?: string | number;
}

function ServicesExternalRedirect({ bid, cid }: ServicesRedirectProps) {
    const hasOpenedRef = useRef<boolean>(false);

    useEffect(() => {
        if (hasOpenedRef.current) {
            return;
        }
        hasOpenedRef.current = true;

        const bidParam = String(bid ?? '');
        const cidParam = String(cid ?? '');
        const params = new URLSearchParams({ ...(bidParam && { bid: bidParam }), ...(cidParam && { cid: cidParam }) });
        window.open(`https://service20.netzoom.com${params.size ? `?${params}` : ''}`, 'SM-Service', 'noopener,noreferrer');
    }, [bid, cid]);

    return null;
}

/* Features that own the whole content area instead of the explorer tree.
   Client menu features intentionally omit this list so they keep the business explorer + filter layout. */
const FeaturesWithOwnLayout: string[] = [
    FeatureEnums.Home,
    FeatureEnums.HomeDashboard,
    LibraryEnums.DeviceLibrary,
    ServicesEnums.Services,
    ServicesEnums.CatalogAndDiscounts,
    ServicesEnums.ImportTemplates,
    SettingsEnums.DailySchedular,
    SettingsEnums.Instance,
    SettingsEnums.Import,
];

/* Renders feature modules dynamically based on featureId.
   Returns null if no matching feature module exists. */
function FeatureRenderContainer(featureRenderContainerProps: IFeatureRenderContainer) {
    const {
        allowFeatureToRender,
        featureContainerProps,
        handleShowUserMessage
    } = featureRenderContainerProps;

    if (!allowFeatureToRender) {
        return null;
    }
    console.warn('FeatureRenderContainer: Rendering featureId:', featureContainerProps.featureId);

    switch (featureContainerProps.featureId) {
        case FeatureEnums.Home:
        case FeatureEnums.HomeDashboard:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <DashboardChartsContainer
                            uniqueName={'feature-home-dashboard'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText ?? 'Home'}
                            handleShowUserMessage={handleShowUserMessage} />
                    </Suspense>
                </ErrorBoundary>
            );

        case LibraryEnums.DeviceLibrary:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <DeviceLibrary
                            uniqueName={'feature-device-library'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText} />
                    </Suspense>
                </ErrorBoundary>
            );

        case ServicesEnums.Services:
            return (
                <ServicesExternalRedirect
                    bid={featureContainerProps.selectedFeatureData?.bid}
                    cid={featureContainerProps.selectedFeatureData?.cid}
                />
            );

        case ServicesEnums.CatalogAndDiscounts:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <CatalogAndDiscounts />
                    </Suspense>
                </ErrorBoundary>
            );

        case ServicesEnums.ImportTemplates:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <ImportTemplates />
                    </Suspense>
                </ErrorBoundary>
            );

        case SettingsEnums.DailySchedular:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <DailySchedular
                            uniqueName={'feature-settings-daily-schedular'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText} />
                    </Suspense>
                </ErrorBoundary>
            );

        case SettingsEnums.Instance:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <SaasInstance
                            uniqueName={'feature-settings-saas-instance'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText} />
                    </Suspense>
                </ErrorBoundary>
            );

        // case SettingsEnums.Import:
        //     return (
        //         <ErrorBoundary>
        //             <Suspense fallback={<Loader />}>
        //                 <ImportBusinesses />
        //             </Suspense>
        //         </ErrorBoundary>
        //     );


        default:
            return null;
    }
}

export { FeatureRenderContainer, FeaturesWithOwnLayout }
