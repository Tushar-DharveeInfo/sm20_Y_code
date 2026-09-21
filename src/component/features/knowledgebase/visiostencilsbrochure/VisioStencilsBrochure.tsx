import { BuyBrochureDocs } from '../../../shared/alldefaultprops/DefaultPropsPrivatePdf.ts'
import { BrochureContainer } from '../brochurecontainer/BrochureContainer.tsx'
import { IKnowledgeBaseFeature } from '../allinterface/IKnowledgeBaseFeature.ts'

const VisioStencilsBrochure = (visioStencilsBrochureProps: IKnowledgeBaseFeature) => {
    return (
        <BrochureContainer
            uniqueName={`${visioStencilsBrochureProps.uniqueName}-visio-stencils-brochure`}
            brochureFileName={BuyBrochureDocs.VisioStencils}
            brochureTitle={'Visio Stencils Brochure'}
            headerText={visioStencilsBrochureProps.headerText ?? 'Visio Stencils Brochure'}
            scale={visioStencilsBrochureProps.scale} />
    )
}

export { VisioStencilsBrochure }
export type { IKnowledgeBaseFeature as IVisioStencilsBrochure }
export default VisioStencilsBrochure
