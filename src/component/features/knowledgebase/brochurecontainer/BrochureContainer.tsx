import { useEffect, useState } from 'react'
import './BrochureContainer.css'
import { PdfDocumentViewer } from '../../../shared/pdfviewer/PdfDocumentViewer.tsx'
import { PdfDownloadOverlay } from '../../../shared/pdfviewer/PdfDownloadOverlay.tsx'
import { FnGetPrivatePdfUrl } from '../../allcommon/FnGetPrivatePdfUrl.ts'
import { Loader } from '../../../shared/loader/Loader.tsx'

/* Brochure shell shared by Knowledge Base and About features. */
interface IBrochureContainer {
    uniqueName: string; // uniqueName for the control and required
    brochureFileName: string; // cloud/document filename
    brochureTitle: string; // title shown by the pdf viewer
    headerText?: string; // header text coming from the selected menu item
    scale?: number;
}

/* Shared brochure view (local public folder). */
const BrochureContainer = (brochureContainerProps: IBrochureContainer) => {
    const [pdfUrl, setPdfUrl] = useState<string>('')
    const [loadError, setLoadError] = useState<string>('')
    const [isLoading, setIsLoading] = useState<boolean>(true)

    useEffect(() => {
        let isActive = true

        const loadPublicUrl = () => {
            setIsLoading(true)
            setLoadError('')
            setPdfUrl('')

            try {
                const url = FnGetPrivatePdfUrl(brochureContainerProps.brochureFileName)
                if (isActive) {
                    setPdfUrl(url)
                }
            } catch (error) {
                if (isActive) {
                    setLoadError(
                        error instanceof Error
                            ? error.message
                            : `Failed to load ${brochureContainerProps.brochureFileName}`
                    )
                }
            } finally {
                if (isActive) {
                    setIsLoading(false)
                }
            }
        }

        loadPublicUrl()

        return () => {
            isActive = false
        }
    }, [brochureContainerProps.brochureFileName])

    if (isLoading) {
        return <Loader />
    }

    if (loadError || !pdfUrl) {
        return (
            <div key={brochureContainerProps.uniqueName} className='nz-brochure-container'>
                <div className='nz-brochure-container-content' style={{ color: 'var(--error-color, #b00020)', padding: 12 }}>
                    {loadError || 'PDF url unavailable.'}
                </div>
            </div>
        )
    }

    return (
        <div key={brochureContainerProps.uniqueName} className='nz-brochure-container'>
            <PdfDownloadOverlay
                uniqueName={`${brochureContainerProps.uniqueName}-download`}
                headerText={brochureContainerProps.headerText ?? brochureContainerProps.brochureTitle}
                pdfUrl={pdfUrl}
                downloadFileName={brochureContainerProps.brochureFileName} />
            <div className='nz-brochure-container-content'>
                <PdfDocumentViewer
                    uniqueName={`${brochureContainerProps.uniqueName}-brochure`}
                    fileName={brochureContainerProps.brochureFileName}
                    pdfUrl={pdfUrl}
                    documentTitle={brochureContainerProps.brochureTitle}
                    scale={brochureContainerProps.scale} />
            </div>
        </div>
    )
}

export { BrochureContainer }
export type { IBrochureContainer }
export default BrochureContainer
