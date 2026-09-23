import { useEffect, useState, type CSSProperties } from 'react';
import { useFileDownload } from '@n20a/libfsdb';
import { SimplePdfViewer } from '@n20a/libflippdf';
import '@n20a/libflippdf/style.css';
import { PdfDownloadOverlay } from './pdfviewer/PdfDownloadOverlay';
import { Label } from '../basic/label/Label';
import './Help.css';

/*
How to use:
<RenderPdfWithoutToc
  uniqueName="about-netzoom"
  headerText="[About] NetZoom"
  bucketName="n20-bucket-01"
  baseFolder="sm"
  fileName="/help/about-netzoom.pdf"
/>
Or by passing a direct pdfUrl or File/Blob object:
<RenderPdfWithoutToc
  uniqueName="custom-pdf"
  headerText="Document Title"
  file={fileObject}
/>
*/

const pdfViewerStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  height: '100%',
};

const pdfStatusStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#555',
  fontSize: '0.9rem',
  padding: '1.25rem',
};

const pdfErrorStyle: CSSProperties = {
  background: '#2d1414',
  color: '#f48771',
  borderRadius: 4,
  padding: '0.75rem',
  fontSize: '0.78rem',
  overflow: 'auto',
};

export interface IRenderPdfWithoutToc { 
  bucketName?: string;
  baseFolder?: string;
  fileName?: string;
  pdfUrl?: string;
  file?: File | Blob;
  documentTitle?: string;
  headerText?: string;
  downloadFileName?: string;
  hideDownloadIcon?: boolean;
  uniqueName?: string;
  tocWidthPercent?: number;
  initialTocItem?: string;
  initialPageNumber?: number;
}

export function RenderPdfWithoutToc({
  bucketName,
  baseFolder,
  fileName,
  pdfUrl: directPdfUrl,
  file,
  documentTitle,
  headerText,
  downloadFileName,
  hideDownloadIcon = false,
  uniqueName = 'pdf-viewer-without-toc',
}: IRenderPdfWithoutToc) {
  const { getDownloadUrl, downloading, error } = useFileDownload();
  const [cloudPdfUrl, setCloudPdfUrl] = useState<string | undefined>();
  const [blobPdfUrl, setBlobPdfUrl] = useState<string | undefined>();

  const storagePath = bucketName && baseFolder && fileName ? `${bucketName}/${baseFolder}${fileName}` : '';

  useEffect(() => {
    if (!file) {
      setBlobPdfUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setBlobPdfUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    let isMounted = true;
    setCloudPdfUrl(undefined);

    if (!storagePath) return;

    async function loadPdfUrl() {
      try {
        const response = await getDownloadUrl(storagePath);
        if (isMounted && response?.downloadUrl) {
          setCloudPdfUrl(response.downloadUrl);
        }
      } catch {
        // error state captured by useFileDownload
      }
    }

    void loadPdfUrl();

    return () => {
      isMounted = false;
    };
  }, [storagePath, getDownloadUrl]);

  const resolvedPdfUrl = directPdfUrl || blobPdfUrl || cloudPdfUrl;
  const isFetchingCloud = Boolean(storagePath && !directPdfUrl && !blobPdfUrl && downloading);

  if (isFetchingCloud) {
    return <div style={pdfStatusStyle}>Loading…</div>;
  }

  if (!resolvedPdfUrl) {
    return (
      <div style={pdfStatusStyle}>
        {error ? (
          <pre style={pdfErrorStyle}>{JSON.stringify(error, null, 2)}</pre>
        ) : (
          'PDF file is not available.'
        )}
      </div>
    );
  }

  const effectiveFileName = fileName?.split(/[\\/]/).pop() ?? (file instanceof File ? file.name : 'document.pdf');
  const effectiveDocumentTitle = documentTitle ?? headerText ?? effectiveFileName.replace(/\.pdf$/i, '');
  const effectiveDownloadName = downloadFileName ?? effectiveFileName;

  const viewerNode = (
    <div style={pdfViewerStyle}>
      <SimplePdfViewer
        pdfUrl={resolvedPdfUrl}
        documentTitle={effectiveDocumentTitle}
        scale={1.0}
      />
    </div>
  );

  if (headerText) {
    return (
      <div className="nz-help-container">
        <div className="nz-help-header">
          {!hideDownloadIcon ? (
            <PdfDownloadOverlay
              uniqueName={`${uniqueName}-download`}
              headerText={headerText}
              pdfUrl={resolvedPdfUrl}
              downloadFileName={effectiveDownloadName}
            />
          ) : (
            <div className="nz-sub-header">
              <Label
                uniqueName={`${uniqueName}-header`}
                label={headerText}
                fontWeight="bold"
              />
            </div>
          )}
        </div>
        <div className="nz-help-body">
          {viewerNode}
        </div>
      </div>
    );
  }

  return viewerNode;
}
