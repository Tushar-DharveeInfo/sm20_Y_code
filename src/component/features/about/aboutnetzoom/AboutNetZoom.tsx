import { AboutNetZoomDocs } from '../../../shared/alldefaultprops/DefaultPropsPrivatePdf.ts'
import { BrochureContainer } from '../../knowledgebase/brochurecontainer/BrochureContainer.tsx'
import { IKnowledgeBaseFeature } from '../../knowledgebase/allinterface/IKnowledgeBaseFeature.ts'

const AboutNetZoom = (aboutNetZoomProps: IKnowledgeBaseFeature) => {
    return (
        <BrochureContainer
            uniqueName={`${aboutNetZoomProps.uniqueName}-about-netzoom`}
            brochureFileName={AboutNetZoomDocs.AboutNetZoom}
            brochureTitle={'About NetZoom'}
            headerText={aboutNetZoomProps.headerText ?? 'About NetZoom'}
            scale={aboutNetZoomProps.scale} />
    )
}

export { AboutNetZoom }
export type { IKnowledgeBaseFeature as IAboutNetZoom }
export default AboutNetZoom
