import { lazy, Suspense, } from 'react'
import { TicketsEnums, RmsEnums, ClientEnums, HomeEnums, ProspectEnums, FAQEnums, AboutEnums, SettingEnums } from '../../constants/Feature.ts'
import ErrorBoundary from '../../shared/errorboundary/ErrorBoundary.tsx'
import { Loader } from '../../shared/loader/Loader.tsx'
import { Label } from '../../shared/basic/label/Label.tsx'
import { IMenuItem } from '../../shared/allinterface/menu/IMainMenu.ts'
import { ITreeNode } from '../../shared/allinterface/tree/ITreeControl.ts'

import { useMainAppContext } from '../../shared/context/hooks/MainAppHooks.ts'

import { getFirebaseServices } from '@n20a/libauth'

import { CatalogAndDiscounts } from '../../features/faq/cataloganddiscounts/CatalogAndDiscounts.tsx'
import { DownloadXlsxImportTemplates } from '../../features/faq/downloadxlsximporttemplates/DownloadXlsxImportTemplates.tsx'
import '@n20a/libclientidentity/index.css'

const DashboardChartsContainer = lazy(() => import('../../features/home/home/dashboardchartscontainer/DashboardChartsContainer.tsx'))
const FqaNotes = lazy(() => import('../../shared/sidebar/notes/FqaNotes.tsx'))

const MyProfile = lazy(() => import('../../features/home/myprofile/MyProfile.tsx'))
const MyActivities = lazy(() => import('../../features/home/myactivities/MyActivities.tsx'))

// Library Features
const DeviceLibrary = lazy(() => import('../../features/tickets/devicelibrary/DeviceLibrary.tsx'))
const RequestsReceived = lazy(() => import('../../features/tickets/requestsreceived/RequestsReceived.tsx'))
const ApprovedTickets = lazy(() => import('../../features/tickets/approvedtickets/ApprovedTickets.tsx'))
const McsDevelopment = lazy(() => import('../../features/rms/McsDevelopment.tsx'))
const RmsEqid = lazy(() => import('../../features/rms/RmsEqid.tsx'))
const Manufacturer = lazy(() => import('../../features/rms/manufacturer/Manufacturer.tsx'))
const MfgEqType = lazy(() => import('../../features/rms/mfgeqtype/MfgEqType.tsx'))
const EqidByMfg = lazy(() => import('../../features/rms/eqidbymfg/EqidByMfg.tsx'))

const ImpersonateService = lazy(() => import('../../features/faq/impersonateservice/ImpersonateService.tsx'))

// FAQ & About Features
const Faq = lazy(() => import('../../features/faq/Faq.tsx'))
const DownloadKbdocs = lazy(() => import('../../features/faq/kbdocs/DownloadKbdocs.tsx'))
const AboutNetZoom = lazy(() => import('../../features/about/About.tsx'))

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
    TicketsEnums.DeviceLibrary,
    FAQEnums.FAQEnums,
    FAQEnums.FAQ,
    FAQEnums.KBDOCS,
    FAQEnums.CatalogAndDiscounts,
    FAQEnums.DownloadExcelTemplates,
    AboutEnums.About,
    AboutEnums.AboutNetZoom,
    RmsEnums.Manufacturer,
    RmsEnums.MfgEqType,
    RmsEnums.EQIDByMfg,
    RmsEnums.ReviewRMSLibrary,
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

/**
 * Determines whether a selected tree node represents a Contact item.
 */
const isContactNode = (node?: ITreeNode): boolean => {
    if (!node) return false;
    const nodeType = String(node.NodeType ?? node.treetype ?? node.NodeEntityname ?? node.Type ?? '').toLowerCase();
    if (nodeType === 'contact') return true;
    if (node.cid && node.bid && String(node.cid).toLowerCase() !== String(node.bid).toLowerCase()) {
        return true;
    }
    return false;
};

/**
 * Determines whether a contact tree node is verified.
 */
const isContactVerified = (node?: ITreeNode): boolean => {
    if (!node) return false;
    const anyNode = node as any;
    if (node.verified === true || anyNode.verified === 'true') return true;
    if (node.IsAuthorized === true) return true;
    if (anyNode.monitor === true || anyNode.monitor === 'true') return true;
    return false;
};

/* Renders feature modules dynamically based on featureId.
   Returns null if no matching feature module exists. */
function FeatureRenderContainer(featureRenderContainerProps: IFeatureRenderContainer) {
    const mainContext = useMainAppContext();
    const {
        featureContainerProps,
        handleShowUserMessage,
        selectedNode,
        treeData,
        asRightPane,
    } = featureRenderContainerProps;

    if (asRightPane && FeaturesWithOwnLayout.includes(featureContainerProps.featureId)) {
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
        case SettingEnums.Delete:
        case "920":
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
                            <div className="nz-no-data-found nz-wh-100 nz-d-flex-hv-left" >
                                <Label uniqueName="no-business-selected" label="Select a Business to view notes" />
                            </div>
                        )}
                    </Suspense>
                </ErrorBoundary>
            );

        case SettingEnums.SAASInstance:
        case "912": {
            const isContact = isContactNode(selectedNode);
            const isVerified = isContactVerified(selectedNode);

            if (isContact && !isVerified) {
                return (
                    <div
                        className="nz-no-data-found nz-wh-100 nz-d-flex-hv-left"
                        style={{ padding: '20px', textAlign: 'center', height: '100%', width: '100%' }}
                    >
                        <Label
                            uniqueName="unverified-contact-saas-instance-error"
                            label="A verified contact is required to create a SAAS instance"
                            fontWeight="500"
                        />
                    </div>
                );
            }

            return null;
        }

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


        case TicketsEnums.DeviceLibrary:
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

        case TicketsEnums.RequestsReceived:
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

        case TicketsEnums.ApprovedTickets:
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

        case RmsEnums.Manufacturer:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <Manufacturer
                            uniqueName={'feature-rms-manufacturer'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText ?? 'Manufacturers'}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case RmsEnums.EQIDByTicket:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <RmsEqid
                            uniqueName={'feature-rms-eqid'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText ?? 'EQID Development'}
                            featureData={undefined}
                            selectedFeatureData={featureContainerProps.selectedFeatureData}
                            selectedNode={selectedNode}
                            treeData={treeData}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case RmsEnums.MfgEqType:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <MfgEqType
                            uniqueName={'feature-rms-mfgeqtype'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText ?? 'MfgEqType'}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case RmsEnums.EQIDByMfg:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <EqidByMfg
                            uniqueName={'feature-rms-eqid-by-mfg'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText ?? '[RMS] EQID by Mfg'}
                        />
                    </Suspense>
                </ErrorBoundary>
            );

        case RmsEnums.ReviewRMSLibrary:
        case "424":
            return (
                <div
                    className="nz-wh-100 nz-d-flex-hv-center"
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Label
                        uniqueName="feature-review-rms-library-info"
                        label="Y will provide details"
                        fontSize="16px"
                        fontWeight="bold"
                    />
                </div>
            );

        // case FAQEnums.Services:
        //     return (
        //         <ErrorBoundary>
        //             <Suspense fallback={<Loader />}>
        //                 <ImpersonateService
        //                     uniqueName={'feature-services'}
        //                     featureId={featureContainerProps.featureId}
        //                     headerText={featureContainerProps.headerText}
        //                     selectedFeatureData={featureContainerProps.selectedFeatureData}
        //                 />
        //             </Suspense>
        //         </ErrorBoundary>
        //     );

        case FAQEnums.CatalogAndDiscounts:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <CatalogAndDiscounts />
                    </Suspense>
                </ErrorBoundary>
            );

        case FAQEnums.DownloadExcelTemplates:
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

        case FAQEnums.FAQEnums:
        case FAQEnums.FAQ:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <Faq />
                    </Suspense>
                </ErrorBoundary>
            );

        case FAQEnums.KBDOCS:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <DownloadKbdocs
                            uniqueName={'feature-download-kbdocs'}
                            featureId={featureContainerProps.featureId}
                            headerText={featureContainerProps.headerText}
                            handleShowUserMessage={handleShowUserMessage} />
                    </Suspense>
                </ErrorBoundary>
            );

        case AboutEnums.About:
        case AboutEnums.AboutNetZoom:
            return (
                <ErrorBoundary>
                    <Suspense fallback={<Loader />}>
                        <AboutNetZoom />
                    </Suspense>
                </ErrorBoundary>
            );

        default:
            {
                const parentName = featureContainerProps.selectedFeatureData?.parentName?.toLowerCase();
                const featureName = featureContainerProps.selectedFeatureData?.featureName?.toLowerCase();
                const label = featureContainerProps.selectedFeatureData?.Label?.toLowerCase();
                const isClientExceptMcs = (parentName === 'client' || parentName === 'clients') && featureContainerProps.featureId !== ClientEnums.Mcs;
                const isProspect = parentName === 'prospect' || parentName === 'prospects';

                if (label === 'review rms library' || featureName === 'review rms library') {
                    return (
                        <div
                            className="nz-wh-100 nz-d-flex-hv-center"
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Label
                                uniqueName="feature-review-rms-library-info"
                                label="Y will provide details"
                                fontSize="16px"
                                fontWeight="bold"
                            />
                        </div>
                    );
                }

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
                                    <div className="nz-no-data-found nz-wh-100 nz-d-flex-hv-left">
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
