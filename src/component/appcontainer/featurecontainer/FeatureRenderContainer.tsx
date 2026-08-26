import { lazy, Suspense, useEffect, useRef } from 'react'
import { LibraryEnums, SettingsEnums, ClientEnums, HomeEnums } from '../../constants/Feature.ts'
import ErrorBoundary from '../../shared/errorboundary/ErrorBoundary.tsx'
import { Loader } from '../../shared/loader/Loader.tsx'
import { IFeatureContainer } from './FeatureContainer.tsx'

const DashboardChartsContainer = lazy(() => import('../../features/home/dashboardchartscontainer/DashboardChartsContainer.tsx'))
const DeviceLibrary = lazy(() => import('../../features/library/devicelibrary/DeviceLibrary.tsx'))
const DailySchedular = lazy(() => import('../../features/settings/dailyschedular/DailySchedular.tsx'))
const SaasInstance = lazy(() => import('../../features/settings/saasinstance/SaasInstance.tsx'))

// Client Features
const ClientIdentityManagement = lazy(() => import('../../features/client/clientidentitymanagement/ClientIdentityManagement.tsx'))
const NetZoom = lazy(() => import('../../features/client/netzoom/NetZoom.tsx'))
const VisioStencils = lazy(() => import('../../features/client/visiostencils/VisioStencils.tsx'))
const SSIAndOtherServices = lazy(() => import('../../features/client/ssiandotherservices/SSIAndOtherServices.tsx'))
const Reseller = lazy(() => import('../../features/client/reseller/Reseller.tsx'))
const Mcs = lazy(() => import('../../features/client/mcs/Mcs.tsx'))

// Library Features
const RequestsReceived = lazy(() => import('../../features/library/requestsreceived/RequestsReceived.tsx'))
const ApprovedTickets = lazy(() => import('../../features/library/approvedtickets/ApprovedTickets.tsx'))
const McsDevelopment = lazy(() => import('../../features/library/mcsdevelopment/McsDevelopment.tsx'))

interface IFeatureRenderContainer {
    allowFeatureToRender: boolean;
    featureContainerProps: IFeatureContainer;
    handleShowUserMessage: (messageText: string, container?: HTMLDivElement) => void;
}

/* Features that own the whole content area instead of the explorer tree.
   Client menu features intentionally omit this list so they keep the business explorer + filter layout. */
const FeaturesWithOwnLayout: string[] = [
    HomeEnums.Home,
    HomeEnums.HomeDashboard,
    LibraryEnums.DeviceLibrary,
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
        case HomeEnums.Home:
        case HomeEnums.HomeDashboard:
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

        case LibraryEnums.RequestsReceived:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <RequestsReceived
                            uniqueName={'feature-requests-received'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case LibraryEnums.ApprovedTickets:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <ApprovedTickets
                            uniqueName={'feature-approved-tickets'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case LibraryEnums.McsDevelopment:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <McsDevelopment
                            uniqueName={'feature-mcs-development'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case ClientEnums.ClientIdentityManagement:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <ClientIdentityManagement
                            uniqueName={'feature-client-identity-management'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case ClientEnums.NetZoom:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <NetZoom
                            uniqueName={'feature-client-netzoom'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case ClientEnums.VisioStencils:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <VisioStencils
                            uniqueName={'feature-client-visiostencils'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case ClientEnums.SSIAndOtherServices:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <SSIAndOtherServices
                            uniqueName={'feature-client-ssi-and-other-services'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case ClientEnums.Reseller:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <Reseller
                            uniqueName={'feature-client-reseller'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case ClientEnums.Mcs:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <Mcs
                            uniqueName={'feature-client-mcs'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
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

        default:
            return null;
    }
}

export { FeatureRenderContainer, FeaturesWithOwnLayout }
