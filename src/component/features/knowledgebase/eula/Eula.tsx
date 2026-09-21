import { BuyBrochureDocs } from '../../../shared/alldefaultprops/DefaultPropsPrivatePdf.ts'
import { BrochureContainer } from '../brochurecontainer/BrochureContainer.tsx'
import { IKnowledgeBaseFeature } from '../allinterface/IKnowledgeBaseFeature.ts'

const Eula = (eulaProps: IKnowledgeBaseFeature) => {
    return (
        <BrochureContainer
            uniqueName={`${eulaProps.uniqueName}-eula`}
            brochureFileName={BuyBrochureDocs.Eula}
            brochureTitle={'NetZoom End User License Agreement'}
            headerText={eulaProps.headerText ?? 'EULA'}
            scale={eulaProps.scale} />
    )
}

export { Eula }
export type { IKnowledgeBaseFeature as IEula }
export default Eula
