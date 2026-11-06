
import { useMainAppContext } from '../../shared/context/hooks/MainAppHooks.ts';
import ErrorBoundary from '../../shared/errorboundary/ErrorBoundary.tsx'
import { RenderPdf } from '../../shared/help/RenderPdf.tsx';

const Faq = () => {

  const mainAppContext = useMainAppContext();
  const authSession = mainAppContext?.authSession;
  const bucketName = authSession?.bucketName ?? "n20-bucket-01";
  
  return (
    <div className="nz-wh-100 nz-d-flex-column">
      <ErrorBoundary>
        <RenderPdf
          bucketName={bucketName}
          baseFolder="sm"
          fileName="/help/help-faq-sm.pdf"
        />
      </ErrorBoundary>
    </div>
  );
};

export { Faq };
export default Faq;
