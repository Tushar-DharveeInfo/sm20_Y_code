import { useCallback, useEffect, useMemo, useState } from "react";
import { PdfMaker, updateLayoutWithSessionVars } from "@n20a/libreport";
import "@n20a/libreport/style.css";
import { JsonViewer } from "../jsonviewer/JsonViewer";
import { useSessionContext } from "../context/hooks/SessionHooks";
import { FnBuildReportLayoutConfig } from "../../features/allcommon/FnBuildReportLayoutConfig";
import { IGenerateReport } from "./IGenerateReport";
/*
 * Generate Report workflow:
 * 1. Accept reportTemplate (e.g. OrderForm.json) and required p1–p4 inputs from the caller.
 * 2. Build layout JSON via FnBuildReportLayoutConfig — inject address text, document type, and keyed datatable rows.
 * 3. Merge session variables into the layout with updateLayoutWithSessionVars for dynamic placeholders.
 * 4. Preview the resulting JSON in JsonViewer and pass the final config to PdfMaker for PDF generation.
 */
const GenerateReport = (props: IGenerateReport) => {
    const { uniqueName = "generate-report", reportTemplate, addressFields, docType, dataset1, dataset2 } = props;

    const [reportJson, setReportJson] = useState<Record<string, unknown> | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const sessionContext = useSessionContext();

    const getSessionVars = useCallback((): Record<string, unknown> => {
        const sessionVars: Record<string, unknown> = {};
        sessionContext?.SessionList?.forEach((item) => {
            if (item.VariableName && item.SessionValue !== undefined) {
                sessionVars[item.VariableName] = item.SessionValue;
            }
        });

        // OrderForm.jscript expects OrderID / selectednode — supply from report inputs.
        const orderId =
            ("Invoice" in docType.doctype && docType.doctype.Invoice)
            || ("PO" in docType.doctype && docType.doctype.PO)
            || ("Quote" in docType.doctype && docType.doctype.Quote)
            || "";
        sessionVars.OrderID = orderId;
        if (!sessionVars.selectednode) {
            sessionVars.selectednode = { DateFormat: "mm/dd/yyyy" };
        }

        return sessionVars;
    }, [docType, sessionContext?.SessionList]);

    const buildReportLayout = useCallback(
        () => FnBuildReportLayoutConfig(
            reportTemplate,
            addressFields,
            docType,
            dataset1,
            dataset2
        ),
        [addressFields, dataset1, dataset2, docType, reportTemplate]
    );

    useEffect(() => {
        setIsLoading(true);
        setErrorMessage("");
        try {
            const updated = buildReportLayout();
            setReportJson(updated);
        } catch (error) {
            console.error("GenerateReport: failed to build report", error);
            setReportJson(null);
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to build report"
            );
        } finally {
            setIsLoading(false);
        }
    }, [buildReportLayout]);

    const pdfConfig = useMemo(() => {
        if (!reportJson) return null;
        try {
            return updateLayoutWithSessionVars(reportJson as any, getSessionVars);
        } catch (error) {
            console.error("GenerateReport: updateLayoutWithSessionVars failed", error);
            return reportJson;
        }
    }, [getSessionVars, reportJson]);

    return (
        <div className="nz-wh-100 nz-d-flex-column">
            <div className="nz-sub-header">Generate Report</div>

            {isLoading && <div>Building report…</div>}
            {errorMessage && (
                <div style={{ color: "var(--error-color, #b00020)" }}>{errorMessage}</div>
            )}

            {reportJson && (
                <>
                    <JsonViewer
                        uniqueName={`${uniqueName}-json`}
                        jsonData={reportJson}
                        showAsDiv={true}
                    />
                    {pdfConfig && (
                        <PdfMaker
                            config={pdfConfig as any}
                            autoGenerate={false}
                            onSuccess={() => { }}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export { GenerateReport, FnBuildReportLayoutConfig };
export type { IGenerateReport };
