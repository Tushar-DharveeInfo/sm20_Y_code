import { lazy, Suspense, } from 'react'
import { LibraryEnums, SettingsEnums, ServicesEnums, ClientEnums, HomeEnums, } from '../../constants/Feature.ts'
import ErrorBoundary from '../../shared/errorboundary/ErrorBoundary.tsx'
import { Loader } from '../../shared/loader/Loader.tsx'
import { IMenuItem } from '../../shared/allinterface/menu/IMainMenu.ts'
import { ITreeNode } from '../../shared/allinterface/tree/ITreeControl.ts'

import { getFirebaseServices } from '@n20a/libauth'

import { CatalogAndDiscounts } from '../../features/services/cataloganddiscounts/CatalogAndDiscounts.tsx'
import { DownloadXlsxImportTemplates } from '../../features/services/downloadxlsximporttemplates/DownloadXlsxImportTemplates.tsx'
import ClientIdentityManagement from '../../features/settings/clientidentitymanagement/ClientIdentityManagement.tsx'

const DashboardChartsContainer = lazy(() => import('../../features/home/dashboardchartscontainer/DashboardChartsContainer.tsx'))


// Client Features
// const ClientIdentity = lazy(() => import('../../features/settings/clientidentity/ClientIdentity.tsx'))
const NetZoom = lazy(() => import('../../features/client/netzoom/NetZoom.tsx'))
const VisioStencils = lazy(() => import('../../features/client/visiostencils/VisioStencils.tsx'))
const SSIAndOtherServices = lazy(() => import('../../features/client/ssiandotherservices/SSIAndOtherServices.tsx'))
const Reseller = lazy(() => import('../../features/client/reseller/Reseller.tsx'))
// const Mcs = lazy(() => import('../../features/client/mcs/Mcs.tsx'))

// Library Features
const DeviceLibrary = lazy(() => import('../../features/library/devicelibrary/DeviceLibrary.tsx'))
const RequestsReceived = lazy(() => import('../../features/library/requestsreceived/RequestsReceived.tsx'))
const ApprovedTickets = lazy(() => import('../../features/library/approvedtickets/ApprovedTickets.tsx'))
const McsDevelopment = lazy(() => import('../../features/library/mcsdevelopment/McsDevelopment.tsx'))

const DailySchedular = lazy(() => import('../../features/settings/dailyschedular/DailySchedular.tsx'))
const SaasInstance = lazy(() => import('../../features/settings/saasinstance/SaasInstance.tsx'))
// const ImportCollections = lazy(() => import('../../features/settings/importcollections/ImportCollections.tsx'))
const ImpersonateService = lazy(() => import('../../features/services/impersonateservice/ImpersonateService.tsx'))

interface IFeatureRenderTarget {
    uniqueName: string;
    bid?: string;
    cid?: string;
    selectedtenantshortname?: string;
    featureId: string;
    headerText?: string;
    selectedFeatureData?: IMenuItem;
    allowShowHeader?: boolean;
    updateStatusBarData?: (statusBarObject: string, isReplace?: boolean) => void;
}

interface IFeatureRenderContainer {
    doNotRenderExplorerTree: boolean;
    asRightPane?: boolean;
    featureContainerProps: IFeatureRenderTarget;
    selectedNode?: ITreeNode;
    treeData?: ITreeNode[];
    handleShowUserMessage: (messageText: string, container?: HTMLDivElement) => void;
}

/* Features that own the whole content area instead of the explorer tree.
   Client menu features intentionally omit this list so they keep the business explorer + filter layout. */
const FeaturesWithOwnLayout: string[] = [
    HomeEnums.Home,
    HomeEnums.HomeDashboard,
    LibraryEnums.DeviceLibrary,
    SettingsEnums.DailySchedular,
    SettingsEnums.Import,
    ServicesEnums.CatalogAndDiscounts,
    ServicesEnums.DownloadExcelTempates
];


const getAuthToken = async (): Promise<string> => {
    const { auth } = getFirebaseServices();
    const user = auth.currentUser;

    if (!user) {
        throw new Error('No authenticated user');
    }

    return user.getIdToken();
};


/* Renders feature modules dynamically based on featureId.
   Returns null if no matching feature module exists. */
function FeatureRenderContainer(featureRenderContainerProps: IFeatureRenderContainer) {
    const {
        featureContainerProps,
        handleShowUserMessage,
        selectedNode,
        treeData,
    } = featureRenderContainerProps;

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

        case SettingsEnums.ClientIdentityManagement:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <ClientIdentityManagement
                            uniqueName={'feature-client-identity-management'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
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
                        <McsDevelopment
                            uniqueName={'feature-client-mcs'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
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

        case ServicesEnums.Services:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <ImpersonateService
                            uniqueName={'feature-services'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case ServicesEnums.CatalogAndDiscounts:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <CatalogAndDiscounts />
                    </Suspense>
                </ErrorBoundary>
            );

        case ServicesEnums.DownloadExcelTempates:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <DownloadXlsxImportTemplates
                            uniqueName={'feature-download-netzoom'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            handleShowUserMessage={handleShowUserMessage} />
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
                            headerText={featureContainerProps.headerText}
                            tenantshortname={String(featureContainerProps.selectedFeatureData?.bid ?? '')}
                            userid={String(featureContainerProps.selectedFeatureData?.cid ?? '')} />
                    </Suspense>
                </ErrorBoundary>
            );

        // case SettingsEnums.Import:
        //     return (
        //         <ErrorBoundary>
        //             <Suspense fallback={<Loader />}>
        //                 <ImportCollections />
        //             </Suspense>
        //         </ErrorBoundary>
        //     );

        default:
            return null;
    }
}

export { FeatureRenderContainer, FeaturesWithOwnLayout }
