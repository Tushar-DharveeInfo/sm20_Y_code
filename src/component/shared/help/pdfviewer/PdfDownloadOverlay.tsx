import React from 'react';
import { OverlayTab } from '../../basic/overlaytab/OverlayTab.tsx';
import { FnDownloadPdf } from '../../allcommon/FnDownloadPdf.ts';
import { IActionLabel } from '../../allinterface/basic/IActionLabel.ts';

interface IPdfDownloadOverlay {
    uniqueName: string;
    headerText: string;
    pdfUrl: string;
    downloadFileName: string;
    onZoomIn?: (event?: React.MouseEvent<HTMLDivElement>) => void;
    onZoomOut?: (event?: React.MouseEvent<HTMLDivElement>) => void;
    onZoom?: (type: 'in' | 'out', event?: React.MouseEvent<HTMLDivElement>) => void;
    handleZoom?: (action: 'zoomin' | 'zoomout' | '+' | '-', event?: React.MouseEvent<HTMLDivElement>) => void;
    hideZoomIcons?: boolean;
    hideDownloadIcon?: boolean;
}

const ZoomInIcon = () => (
    <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const ZoomOutIcon = () => (
    <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const PdfDownloadOverlay = (pdfDownloadOverlayProps: IPdfDownloadOverlay) => {
    const tabs: IActionLabel[] = [];

    if (!pdfDownloadOverlayProps.hideZoomIcons) {
        tabs.push({
            uniqueName: `${pdfDownloadOverlayProps.uniqueName}-zoomin-tab`,
            label: {
                uniqueName: `${pdfDownloadOverlayProps.uniqueName}-zoomin-label`,
                label: '+',
                tooltip: 'Zoom In',
            },
            imageTooltip: 'Zoom In',
            iconSource: <ZoomInIcon />,
            w: '18px',
            actionCode: 'zoomin',
            handleMouse: (e) => {
                pdfDownloadOverlayProps.onZoomIn?.(e);
                pdfDownloadOverlayProps.onZoom?.('in', e);
                pdfDownloadOverlayProps.handleZoom?.('zoomin', e);
            },
        });

        tabs.push({
            uniqueName: `${pdfDownloadOverlayProps.uniqueName}-zoomout-tab`,
            label: {
                uniqueName: `${pdfDownloadOverlayProps.uniqueName}-zoomout-label`,
                label: '-',
                tooltip: 'Zoom Out',
            },
            imageTooltip: 'Zoom Out',
            iconSource: <ZoomOutIcon />,
            w: '18px',
            actionCode: 'zoomout',
            handleMouse: (e) => {
                pdfDownloadOverlayProps.onZoomOut?.(e);
                pdfDownloadOverlayProps.onZoom?.('out', e);
                pdfDownloadOverlayProps.handleZoom?.('zoomout', e);
            },
        });
    }

    if (!pdfDownloadOverlayProps.hideDownloadIcon) {
        tabs.push({
            uniqueName: `${pdfDownloadOverlayProps.uniqueName}-download-tab`,
            label: {
                uniqueName: `${pdfDownloadOverlayProps.uniqueName}-download-label`,
                label: 'Download',
                tooltip: 'Download',
            },
            imageTooltip: 'Download',
            w: '18px',
            actionCode: 'download',
            handleMouse: () => {
                void FnDownloadPdf(
                    pdfDownloadOverlayProps.pdfUrl,
                    pdfDownloadOverlayProps.downloadFileName
                );
            },
        });
    }

    return (
        <OverlayTab
            uniqueName={pdfDownloadOverlayProps.uniqueName}
            headerText={pdfDownloadOverlayProps.headerText}
            tabs={tabs}
            selectedTabName=''
            tabAlignment='horizontal'
            ShowOnlyIcon={true}
            hideDrager={true}
            disableSelectionKey={['download', 'zoomin', 'zoomout', '+', '-']}
        />
    );
};

export { PdfDownloadOverlay, type IPdfDownloadOverlay };
export default PdfDownloadOverlay;
