
import ErrorBoundary from '../../shared/errorboundary/ErrorBoundary.tsx'
import { RenderPdfWithoutToc } from '../../shared/help/RenderPdfWithoutToc.tsx';

interface IAboutProps {
  onZoomIn?: (scale?: number) => void;
  onZoomOut?: (scale?: number) => void;
  handleZoom?: (action: 'zoomin' | 'zoomout', scale?: number) => void;
  scale?: number;
  hideZoomIcons?: boolean;
}

const About = (props: IAboutProps = {}) => {
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
          scale={props.scale}
          onZoomIn={props.onZoomIn}
          onZoomOut={props.onZoomOut}
          handleZoom={props.handleZoom}
          hideZoomIcons={props.hideZoomIcons}
        />
      </ErrorBoundary>
    </div>
  );
};

export { About, type IAboutProps };
export default About;
