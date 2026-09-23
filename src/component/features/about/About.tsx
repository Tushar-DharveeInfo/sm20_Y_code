
import ErrorBoundary from '../../shared/errorboundary/ErrorBoundary.tsx'
import { RenderPdfWithoutToc } from '../../shared/help/RenderPdfWithoutToc.tsx';

const About = () => {
  return (
    <div className="nz-wh-100 nz-d-flex-column">
      <ErrorBoundary>
        <RenderPdfWithoutToc
          uniqueName="about-netzoom"
          headerText="[About] About NetZoom"
          bucketName="n20-bucket-01"
          baseFolder="sm"
          fileName="/help/about-netzoom.pdf"
          downloadFileName="about-netzoom.pdf"
        />
      </ErrorBoundary>
    </div>
  );
};

export { About };
export default About;
