import { layoutConfig, PdfOutputMeta } from "@n20a/libreport";
import React from "react";

interface IPdfMakerContainer {
    config: layoutConfig;
    headerText?: string;
    outputfilename?: string;
    pdfOutput?: string;
    autoGenerate?: boolean;
    uniqueName?: string;
    className?: string;
    style?: React.CSSProperties;
    diagnosticLevel?: number;
    onSuccess?: (blob: Blob, output: PdfOutputMeta) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;
}

export type { IPdfMakerContainer };
