import { knowledgeBaseDocs } from '../../../shared/alldefaultprops/DefaultPropsPrivatePdf.ts'
import { BrochureContainer } from '../brochurecontainer/BrochureContainer.tsx'
import { IKnowledgeBaseFeature } from '../allinterface/IKnowledgeBaseFeature.ts'

const Faq = (faqProps: IKnowledgeBaseFeature) => {
    return (
        <BrochureContainer
            uniqueName={`${faqProps.uniqueName}-faq`}
            brochureFileName={knowledgeBaseDocs.knowledgeBase}
            brochureTitle={'Frequently Asked Questions'}
            headerText={faqProps.headerText ?? 'FAQ'}
            scale={faqProps.scale} />
    )
}

export { Faq }
export type { IKnowledgeBaseFeature as IFaq }
export default Faq
