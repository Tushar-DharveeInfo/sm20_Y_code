import { lazy, Suspense } from 'react'
import { LibraryEnums, SettingsEnums, ClientEnums, HomeEnums, ServicesEnums } from '../../constants/Feature.ts'
import ErrorBoundary from '../../shared/errorboundary/ErrorBoundary.tsx'
import { Loader } from '../../shared/loader/Loader.tsx'
import { IMenuItem } from '../../shared/allinterface/menu/IMainMenu.ts'
import { ITreeNode } from '../../shared/allinterface/tree/ITreeControl.ts'

const DashboardChartsContainer = lazy(() => import('../../features/home/dashboardchartscontainer/DashboardChartsContainer.tsx'))
const DeviceLibrary = lazy(() => import('../../features/library/devicelibrary/DeviceLibrary.tsx'))
const DailySchedular = lazy(() => import('../../features/settings/dailyschedular/DailySchedular.tsx'))
const SaasInstance = lazy(() => import('../../features/settings/saasinstance/SaasInstance.tsx'))

const ClientIdentityManagement = lazy(() => import('../../features/client/clientidentitymanagement/ClientIdentityManagement.tsx'))
const NetZoom = lazy(() => import('../../features/client/netzoom/NetZoom.tsx'))
const VisioStencils = lazy(() => import('../../features/client/visiostencils/VisioStencils.tsx'))
const SSIAndOtherServices = lazy(() => import('../../features/client/ssiandotherservices/SSIAndOtherServices.tsx'))
const Reseller = lazy(() => import('../../features/client/reseller/Reseller.tsx'))
const Mcs = lazy(() => import('../../features/client/mcs/Mcs.tsx'))

const RequestsReceived = lazy(() => import('../../features/library/requestsreceived/RequestsReceived.tsx'))
const ApprovedTickets = lazy(() => import('../../features/library/approvedtickets/ApprovedTickets.tsx'))
const McsDevelopment = lazy(() => import('../../features/library/mcsdevelopment/McsDevelopment.tsx'))

const CatalogAndDiscounts = lazy(() => import('../../features/services/cataloganddiscounts/CatalogAndDiscounts.tsx'))
const DownloadExcelTempates = lazy(() => import('../../features/services/downloadexceltempates/DownloadExcelTempates.tsx'))
const Services = lazy(() => import('../../features/services/services/Services.tsx'))

interface IFeatureRenderTarget {
    uniqueName: string;
    featureId: string;
    headerText?: string;
    selectedFeatureData?: IMenuItem;
    allowShowHeader?: boolean;
    updateStatusBarData?: (statusBarObject: string, isReplace?: boolean) => void;
}

interface IFeatureRenderContainer {
    allowFeatureToRender: boolean;
    asRightPane?: boolean;
    featureContainerProps: IFeatureRenderTarget;
    selectedNode?: ITreeNode;
    treeData?: ITreeNode[];
    handleShowUserMessage: (messageText: string, container?: HTMLDivElement) => void;
}

/* Features That Do Not Require the Explorer Tree */
const FeaturesWithOwnLayout: string[] = [
    HomeEnums.Home,
    HomeEnums.HomeDashboard,
    LibraryEnums.DeviceLibrary,
    SettingsEnums.DailySchedular,
    SettingsEnums.Instance,
    SettingsEnums.Import,
    ServicesEnums.CatalogAndDiscounts,
    ServicesEnums.DownloadExcelTempates
];

function FeatureRenderContainer(featureRenderContainerProps: IFeatureRenderContainer) {
    const {
        allowFeatureToRender,
        featureContainerProps,
        handleShowUserMessage,
        selectedNode,
        treeData,
    } = featureRenderContainerProps;

    if (!allowFeatureToRender) {
        return null;
    }



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
                            selectedNode={selectedNode}
                            treeData={treeData}
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
                            selectedNode={selectedNode}
                            treeData={treeData}
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
                            selectedNode={selectedNode}
                            treeData={treeData}
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

        case ServicesEnums.CatalogAndDiscounts:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <CatalogAndDiscounts
                            uniqueName={'feature-services-catalog-and-discounts'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case ServicesEnums.DownloadExcelTempates:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <DownloadExcelTempates
                            uniqueName={'feature-services-download-excel-tempates'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case ServicesEnums.Services:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <Services
                            uniqueName={'feature-services'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                            selectedNode={selectedNode}
                            treeData={treeData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

    }
}

export { FeatureRenderContainer, FeaturesWithOwnLayout }
export type { IFeatureRenderContainer }
