import { BuyBrochureDocs } from '../../../shared/alldefaultprops/DefaultPropsPrivatePdf.ts'
import { BrochureContainer } from '../brochurecontainer/BrochureContainer.tsx'
import { IKnowledgeBaseFeature } from '../allinterface/IKnowledgeBaseFeature.ts'

const NetZoomBrochure = (netZoomBrochureProps: IKnowledgeBaseFeature) => {
    return (
        <BrochureContainer
            uniqueName={`${netZoomBrochureProps.uniqueName}-netzoom-brochure`}
            brochureFileName={BuyBrochureDocs.NetZoom}
            brochureTitle={'NetZoom Enterprise Brochure'}
            headerText={netZoomBrochureProps.headerText ?? 'NetZoom Brochure'}
            scale={netZoomBrochureProps.scale} />
    )
}

export { NetZoomBrochure }
export type { IKnowledgeBaseFeature as INetZoomBrochure }
export default NetZoomBrochure
