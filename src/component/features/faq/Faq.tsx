
import ErrorBoundary from '../../shared/errorboundary/ErrorBoundary.tsx'
import { RenderPdf } from '../../shared/help/RenderPdf.tsx';

const Faq = () => {
  return (
    <div className="nz-wh-100 nz-d-flex-column">
      <ErrorBoundary>
        <RenderPdf
          bucketName="n20-bucket-01"
          baseFolder="sm"
          fileName="/help/help-faq-sm.pdf"
        />
      </ErrorBoundary>
    </div>
  );
};

export { Faq };
export default Faq;
