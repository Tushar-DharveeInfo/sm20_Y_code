import React, { useEffect, useState } from "react";
import { Close24x24, Download24x24 } from "@n20a/libicon";
import { PdfMaker, PdfOutputMeta } from "@n20a/libreport";
import "@n20a/libreport/style.css";
import "./PdfMakerContainer.css";
import { FnGetCssVariable } from "../../../../appcontainer/allcommon/FnGetCssVariable";
import { ActionImage } from "../../../../shared/basic/actionimage/ActionImage";
import { Label } from "../../../../shared/basic/label/Label";
import { JsonViewer } from "../../../../shared/jsonviewer/JsonViewer";
import { useCommonVariableContext } from "../../../../shared/context/hooks/CommonVariableHooks";
import { IPdfMakerContainer } from "./IPdfMakerContainer";

const PdfMakerContainer = (props: IPdfMakerContainer) => {
    const {
        config,
        headerText = "Generate PDF Document",
        outputfilename = "report.pdf",
        pdfOutput,
        autoGenerate = true,
        uniqueName = "pdf-maker-container",
        className,
        style,
        diagnosticLevel,
        onSuccess,
        onError,
        onClose,
    } = props;

    const commonVariableContext = useCommonVariableContext();
    const resolvedDiagnosticLevel =
        diagnosticLevel !== undefined
            ? diagnosticLevel
            : commonVariableContext?.diagnosticLevel !== undefined
                ? Number(commonVariableContext.diagnosticLevel)
                : 0;

    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [blobUrl, setBlobUrl] = useState<string>("");
    const [pdfError, setPdfError] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!pdfBlob) {
            setBlobUrl("");
            return;
        }
        const url = URL.createObjectURL(pdfBlob);
        setBlobUrl(url);
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [pdfBlob]);

    const handleDownload = () => {
        if (!pdfBlob && !blobUrl) return;

        const url = blobUrl || (pdfBlob ? URL.createObjectURL(pdfBlob) : "");
        if (!url) return;

        const rawFilename = outputfilename || pdfOutput || "report.pdf";
        const filename = rawFilename.toLowerCase().endsWith(".pdf")
            ? rawFilename
            : `${rawFilename}.pdf`;

        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (!blobUrl && url) {
            URL.revokeObjectURL(url);
        }
    };

    const handleSuccess = (blob: Blob, output: PdfOutputMeta) => {
        setPdfBlob(blob);
        setPdfError("");
        setIsLoading(false);
        onSuccess?.(blob, output);
    };

    const handleError = (error: Error) => {
        const message = error instanceof Error ? error.message : String(error);
        setPdfError(message);
        setPdfBlob(null);
        setIsLoading(false);
        onError?.(error);
    };

    const isSplitView = resolvedDiagnosticLevel !== 0;

    return (
        <div
            className={`nz-pdfmaker-container ${className ?? ""}`}
            style={style}
        >
            <div className="nz-sub-header">
                <Label
                    uniqueName={`${uniqueName}-header-title`}
                    label={headerText}
                    fontWeight="bold"
                />
                <div className="nz-pdfmaker-actions">
                    <ActionImage
                        handleMouse={handleDownload}
                        disabled={!pdfBlob && !blobUrl}
                        image={{
                            uniqueName: `${uniqueName}-i-download`,
                            source: (
                                <Download24x24
                                    size={FnGetCssVariable("--image-size-2")}
                                    fill="none"
                                    strokeWidth={1}
                                />
                            ),
                            type: "svg",
                            w: "var(--image-size-2)",
                            h: "var(--image-size-2)",
                            tooltip: "Download PDF",
                        }}
                        uniqueName={`${uniqueName}-ai-download`}
                        actionCode="download"
                        w="var(--node_height)"
                        h="var(--node_height)"
                    />
                    {onClose && (
                        <ActionImage
                            handleMouse={onClose}
                            image={{
                                uniqueName: `${uniqueName}-i-close`,
                                source: (
                                    <Close24x24
                                        size={FnGetCssVariable("--image-size-2")}
                                        fill="none"
                                        strokeWidth={1}
                                    />
                                ),
                                type: "svg",
                                w: "var(--image-size-2)",
                                h: "var(--image-size-2)",
                                tooltip: "Close",
                            }}
                            uniqueName={`${uniqueName}-ai-close`}
                            actionCode="cancel"
                            w="var(--node_height)"
                            h="var(--node_height)"
                        />
                    )}
                </div>
            </div>

            <div
                className={`nz-pdfmaker-body ${isSplitView ? "nz-pdfmaker-split-view" : ""}`}
            >
                {isSplitView && config && (
                    <div className="nz-pdfmaker-json-pane">
                        <JsonViewer
                            uniqueName={`${uniqueName}-dialog-content`}
                            jsonData={config}
                            showAsDiv={true}
                        />
                    </div>
                )}

                <div className="nz-pdfmaker-pdf-pane">
                    {isLoading && !blobUrl && !pdfError && (
                        <div className="nz-pdfmaker-loading">
                            <span>Generating PDF…</span>
                        </div>
                    )}

                    {config && !blobUrl && !pdfError && (
                        <PdfMaker
                            config={config}
                            autoGenerate={autoGenerate}
                            pdfOutput={pdfOutput || outputfilename}
                            onSuccess={handleSuccess}
                            onError={handleError}
                        />
                    )}

                    {blobUrl && (
                        <iframe
                            className="nz-pdfmaker-iframe"
                            src={`${blobUrl}#toolbar=0`}
                            title={outputfilename || pdfOutput || "report.pdf"}
                        />
                    )}

                    {pdfError && (
                        <div className="nz-pdfmaker-error">
                            {pdfError}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export { PdfMakerContainer };
export type { IPdfMakerContainer };
export default PdfMakerContainer;
