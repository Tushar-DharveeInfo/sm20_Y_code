import { lazy, Suspense } from 'react'
import { LibraryEnums, SettingsEnums, ServicesEnums, ClientEnums, HomeEnums, ProspectEnums, KnowledgeBaseEnums, AboutEnums } from '../../constants/Feature.ts'
import ErrorBoundary from '../../shared/errorboundary/ErrorBoundary.tsx'
import { Loader } from '../../shared/loader/Loader.tsx'
import { Label } from '../../shared/basic/label/Label.tsx'
import { IMenuItem } from '../../shared/allinterface/menu/IMainMenu.ts'
import { ITreeNode } from '../../shared/allinterface/tree/ITreeControl.ts'

import { getFirebaseServices } from '@n20a/libauth'

import { CatalogAndDiscounts } from '../../features/services/cataloganddiscounts/CatalogAndDiscounts.tsx'
import { DownloadXlsxImportTemplates } from '../../features/services/downloadxlsximporttemplates/DownloadXlsxImportTemplates.tsx'
import ClientIdentityManagement from '../../features/settings/clientidentitymanagement/ClientIdentityManagement.tsx'

const DashboardChartsContainer = lazy(() => import('../../features/home/dashboardchartscontainer/DashboardChartsContainer.tsx'))
const MyProfile = lazy(() => import('../../features/profile/myprofile/MyProfile.tsx'))
const MyActivities = lazy(() => import('../../features/profile/myactivities/MyActivities.tsx'))
const FqaNotes = lazy(() => import('../../shared/sidebar/notes/FqaNotes.tsx'))

// Library Features
const DeviceLibrary = lazy(() => import('../../features/library/devicelibrary/DeviceLibrary.tsx'))
const RequestsReceived = lazy(() => import('../../features/library/requestsreceived/RequestsReceived.tsx'))
const ApprovedTickets = lazy(() => import('../../features/library/approvedtickets/ApprovedTickets.tsx'))
const McsDevelopment = lazy(() => import('../../features/library/mcsdevelopment/McsDevelopment.tsx'))

const DailySchedular = lazy(() => import('../../features/settings/dailyschedular/DailySchedular.tsx'))
const SaasInstance = lazy(() => import('../../features/settings/saasinstance/SaasInstance.tsx'))
// const ImportCollections = lazy(() => import('../../features/settings/importcollections/ImportCollections.tsx'))
const ImpersonateService = lazy(() => import('../../features/services/impersonateservice/ImpersonateService.tsx'))

// Knowledge Base & About Features
const Faq = lazy(() => import('../../features/knowledgebase/faq/Faq.tsx'))
const Eula = lazy(() => import('../../features/knowledgebase/eula/Eula.tsx'))
const NetZoomBrochure = lazy(() => import('../../features/knowledgebase/netzoombrochure/NetZoomBrochure.tsx'))
const VisioStencilsBrochure = lazy(() => import('../../features/knowledgebase/visiostencilsbrochure/VisioStencilsBrochure.tsx'))
const AboutNetZoom = lazy(() => import('../../features/about/aboutnetzoom/AboutNetZoom.tsx'))

import { OrderList } from '../../shared/sidebar/orderlist/OrderList.tsx'

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
    HomeEnums.MyProfile,
    HomeEnums.MyActivities,
    LibraryEnums.DeviceLibrary,
    SettingsEnums.DailySchedular,
    SettingsEnums.Import,
    ServicesEnums.CatalogAndDiscounts,
    ServicesEnums.DownloadExcelTempates,
    KnowledgeBaseEnums.FAQ,
    KnowledgeBaseEnums.EULA,
    KnowledgeBaseEnums.NetZoomBrochure,
    KnowledgeBaseEnums.VisioStencilsBrochure,
    AboutEnums.AboutNetZoom,
];


const getAuthToken = async (): Promise<string> => {
    const { auth } = getFirebaseServices();
    const user = auth.currentUser;

    if (!user) {
        throw new Error('No authenticated user');
    }

    return user.getIdToken();
};

/**
 * Determines whether a selected tree node represents a valid business item,
 * excluding the Root node (e.g. "Businesses (0)") and unselected state.
 */
const isBusinessNode = (node?: ITreeNode): boolean => {
    if (!node) return false;
    const nodeType = String(node.NodeType ?? node.treetype ?? node.Type ?? '').toLowerCase();
    const key = String(node.key ?? node.NodeEntID ?? '').toLowerCase();
    if (nodeType === 'root' || key.startsWith('root') || key === 'root-businesses' || !node.bid) {
        return false;
    }
    return true;
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

        case HomeEnums.MyProfile:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <MyProfile
                            uniqueName={'feature-my-profile'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText ?? 'My Profile'}
                            handleShowUserMessage={handleShowUserMessage}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case HomeEnums.MyActivities:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <MyActivities
                            uniqueName={'feature-my-activities'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText ?? 'My Activities'}
                            handleShowUserMessage={handleShowUserMessage}
                        />
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


        case ClientEnums.Client:
        case ClientEnums.NetZoom:
        case ClientEnums.VisioStencils:
        case ClientEnums.SSIAndOtherServices:
        case ClientEnums.Reseller:
        case ProspectEnums.Prospect:
        case ProspectEnums.Followup:
        case ProspectEnums.Recent:
        case ProspectEnums.Past:
        case ProspectEnums.Delete:
        case ProspectEnums.Verify:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        {isBusinessNode(selectedNode) ? (
                            <FqaNotes
                                key={`feature-notes-${featureContainerProps.featureId}-${selectedNode?.key ?? selectedNode?.NodeEntID ?? ''}`}
                                uniqueName={`feature-notes-${featureContainerProps.featureId}`}
                                hideSearchControl={false}
                                hideSubHeader={true}
                                selectedNode={selectedNode!}
                            />
                        ) : (
                            <div className="nz-no-data-found nz-wh-100 nz-d-flex-hv-center" style={{ padding: '20px', textAlign: 'center' }}>
                                <Label uniqueName="no-business-selected" label="Select a Business to view notes" />
                            </div>
                        )}
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
                            selectedNode={selectedNode}
                            treeData={treeData}
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

        case KnowledgeBaseEnums.FAQ:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <Faq
                            uniqueName={'feature-knowledgebase-faq'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText ?? 'FAQ'}
                            handleShowUserMessage={handleShowUserMessage} />
                    </Suspense>
                </ErrorBoundary>
            );

        case KnowledgeBaseEnums.EULA:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <Eula
                            uniqueName={'feature-knowledgebase-eula'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText ?? 'EULA'}
                            handleShowUserMessage={handleShowUserMessage} />
                    </Suspense>
                </ErrorBoundary>
            );

        case KnowledgeBaseEnums.NetZoomBrochure:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <NetZoomBrochure
                            uniqueName={'feature-knowledgebase-netzoom-brochure'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText ?? 'NetZoom Brochure'}
                            handleShowUserMessage={handleShowUserMessage} />
                    </Suspense>
                </ErrorBoundary>
            );

        case KnowledgeBaseEnums.VisioStencilsBrochure:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <VisioStencilsBrochure
                            uniqueName={'feature-knowledgebase-visio-stencils-brochure'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText ?? 'Visio Stencils Brochure'}
                            handleShowUserMessage={handleShowUserMessage} />
                    </Suspense>
                </ErrorBoundary>
            );

        case AboutEnums.AboutNetZoom:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <AboutNetZoom
                            uniqueName={'feature-about-about-netzoom'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText ?? 'About NetZoom'}
                            handleShowUserMessage={handleShowUserMessage} />
                    </Suspense>
                </ErrorBoundary>
            );

        default: {
            const parentName = featureContainerProps.selectedFeatureData?.parentName?.toLowerCase();
            const featureName = featureContainerProps.selectedFeatureData?.featureName?.toLowerCase();
            const label = featureContainerProps.selectedFeatureData?.Label?.toLowerCase();
            const isClientExceptMcs = (parentName === 'client' || parentName === 'clients') && featureContainerProps.featureId !== ClientEnums.Mcs;
            const isProspect = parentName === 'prospect' || parentName === 'prospects';

            if (featureName === 'orders' || featureName === 'order' || label === 'orders' || label === 'order') {
                return (
                    <ErrorBoundary>
                        <Suspense fallback={<Loader />}>
                            <OrderList
                                uniqueName={`feature-orders-${featureContainerProps.featureId}`}
                                headerText="Orders"
                                selectedNode={selectedNode}
                                featureId={featureContainerProps.featureId}
                            />
                        </Suspense>
                    </ErrorBoundary>
                );
            }

            if (isClientExceptMcs || isProspect) {
                return (
                    <ErrorBoundary>
                        <Suspense fallback={<Loader />}>
                            {isBusinessNode(selectedNode) ? (
                                <FqaNotes
                                    key={`feature-notes-${featureContainerProps.featureId}-${selectedNode?.key ?? selectedNode?.NodeEntID ?? ''}`}
                                    uniqueName={`feature-notes-${featureContainerProps.featureId}`}
                                    hideSearchControl={false}
                                    hideSubHeader={true}
                                    selectedNode={selectedNode!}
                                />
                            ) : (
                                <div className="nz-no-data-found nz-wh-100 nz-d-flex-hv-center" style={{ padding: '20px', textAlign: 'center' }}>
                                    <Label uniqueName="no-business-selected" label="Select a Business to view notes" />
                                </div>
                            )}
                        </Suspense>
                    </ErrorBoundary>
                );
            }
            return null;
        }
    }
}

export { FeatureRenderContainer, FeaturesWithOwnLayout }
