import React, { useEffect, useState } from "react";
import { updateLayoutWithSessionVars } from "@n20a/libreport";
import "./Report.css";
import "@n20a/libreport/style.css";
import { Report24x24 } from "@n20a/libicon";
import { FnGetCssVariable } from "../../../appcontainer/allcommon/FnGetCssVariable";
import { IReportProfileItem } from "../../../shared/context/allinterface/IReport";
import { Label } from "../../../shared/basic/label/Label";
import { YesNoFormContainer } from "../../../shared/basic/yesnoformcontainer/YesNoFormContainer";
import { CardLayout } from "../../../shared/cardlayout/CardLayout";
import { ICardLayoutField } from "../../../shared/cardlayout/CardLayout";
import { FnFormatDateWithAppFormat } from "../../../appcontainer/allcommon/FnFormatDateWithAppFormat";
import { useResourceContext } from "../../../shared/context/hooks/ResourceHooks";
import { useCommonVariableContext } from "../../../shared/context/hooks/CommonVariableHooks";
import PdfMakerContainer from "./pdfmakercontainer/PdfMakerContainer";
import reportSampleData from "../../../../smsampledata/appqa/ReportSampleData.json";
const { sampleReportSessionVars } = reportSampleData;

const REPORT_PROFILE_KEY = "_ReportProfile";
interface IAppqaReport {
    uniqueName: string;
    featureId: string;
    handleShowUserMessage?: (messageText: string) => void;
}

const getStringValue = (
    data: Record<string, unknown>,
    keys: string[]
): string => {
    for (const key of keys) {
        const value = data[key];
        if (value !== undefined && value !== null && String(value).length > 0) {
            return String(value);
        }
    }
    return "";
};

const unwrapReportProfiles = (data: unknown): IReportProfileItem[] => {
    if (Array.isArray(data)) {
        return data as IReportProfileItem[];
    }

    if (!data || typeof data !== "object") {
        return [];
    }

    const root = data as Record<string, unknown>;
    if (Array.isArray(root._ReportProfile)) {
        return root._ReportProfile as IReportProfileItem[];
    }
    if (Array.isArray(root.ReportProfile)) {
        return root.ReportProfile as IReportProfileItem[];
    }

    const entityData = root.EntityData;
    if (Array.isArray(entityData) && entityData[0] && typeof entityData[0] === "object") {
        const dataset = (entityData[0] as Record<string, unknown>).Dataset;
        if (dataset && typeof dataset === "object") {
            const datasetRoot = dataset as Record<string, unknown>;
            const profiles = datasetRoot._ReportProfile ?? datasetRoot.ReportProfile;
            if (Array.isArray(profiles)) {
                return profiles as IReportProfileItem[];
            }
        }
    }

    return [];
};

const normalizeTemplateFileName = (templateFileName?: string): string =>
    templateFileName?.trim().toLowerCase() ?? "";

const mapToReportProfileItem = (
    data: Record<string, unknown>
): IReportProfileItem => {
    try {
        if (!data || typeof data !== "object") {
            return {
                _ReportProfile: "",
                Description: "",
                EntityNames: "",
            } as IReportProfileItem;
        }
        const reportProfile = getStringValue(data, [
            "_ReportProfile",
            "ReportProfile",
            "Name",
        ]);
        return {
            ...data,
            _ReportProfile: reportProfile,
            ReportProfile: reportProfile,
            Description: getStringValue(data, ["Description", "ReportDescription"]),
            EntityNames: getStringValue(data, ["EntityNames", "EntityNameList"]),
            TemplateFileName: getStringValue(data, [
                "TemplateFileName",
                "TemplateFile",
                "FileName",
            ]),
            GroupName: getStringValue(data, ["GroupName", "ReportGroup", "Group"]),
            EntID: getStringValue(data, ["EntID", "RecID", "_ReportProfile", "ReportProfile", "Name"]),
            ...Object.fromEntries(
                Object.entries(data).filter(
                    ([key]) =>
                        ![
                            "_ReportProfile",
                            "ReportProfile",
                            "Name",
                            "Description",
                            "ReportDescription",
                            "EntityNames",
                            "EntityNameList",
                            "TemplateFileName",
                            "TemplateFile",
                            "FileName",
                            "GroupName",
                            "ReportGroup",
                            "Group",
                            "EntID",
                            "RecID",
                        ].includes(key)
                )
            ),
        };
    } catch (error) {
        console.error("Error in mapToReportProfileItem:", error);
        return {
            _ReportProfile: "",
            Description: "",
            EntityNames: "",
        } as IReportProfileItem;
    }
};

const buildReportCardFields = (
    report: IReportProfileItem
): ICardLayoutField[] => {
    const fields: ICardLayoutField[] = [
        {
            Name: "Report",
            Value: `${report._ReportProfile || "—"}`,
            Header: 1,
            Group: "header",
        },
    ];
    if (report.LastUpdated) {
        fields.push({
            Name: "Last Updated",
            Value: FnFormatDateWithAppFormat(String(report.LastUpdated), true),
            Header: 3,
            Row: "inline",
            Group: "header",
        });
    }
    if (report.Description) {
        fields.push({ Name: "Description", Value: String(report.Description) });
    }
    if (report.TemplateFileName) {
        fields.push({
            Name: "Template",
            Value: String(report.TemplateFileName),
        });
    }
    return fields;
};

const isReportEnabled = (report: IReportProfileItem): boolean => {
    const enableValue = report.Enable ?? report.Enabled;
    const normalizedEnableValue = String(enableValue).trim().toLowerCase();
    return (
        enableValue === true
        || enableValue === 1
        || normalizedEnableValue === "1"
        || normalizedEnableValue === "true"
    );
};

const sortReportsAZ = (reports: IReportProfileItem[]): IReportProfileItem[] =>
    [...reports].sort((a, b) =>
        String(a._ReportProfile ?? "").localeCompare(
            String(b._ReportProfile ?? ""),
            undefined,
            { sensitivity: "base" }
        )
    );

const dedupeReports = (reports: IReportProfileItem[]): IReportProfileItem[] =>
    reports.filter(
        (item, index, self) =>
            index
            === self.findIndex(
                (t) => String(t[REPORT_PROFILE_KEY] ?? "") === String(item[REPORT_PROFILE_KEY] ?? "")
            )
    );

const normalizeLayoutNode = (
    node: Record<string, unknown>
): Record<string, unknown> => {
    const safeNode = { ...node };
    if ((safeNode.NodeType as string)?.toLowerCase() === "layout") {
        if (Array.isArray(safeNode.header)) {
            safeNode.header = Object.assign({}, ...safeNode.header);
        }
        if (Array.isArray(safeNode.footer)) {
            safeNode.footer = Object.assign({}, ...safeNode.footer);
        }
        if (Array.isArray(safeNode.page)) {
            safeNode.page = Object.assign({}, ...safeNode.page);
        }
    }
    return safeNode;
};

const AppqaReport = (appqaReportProps: IAppqaReport) => {
    const {
        reportProfileJson,
        reportLayoutJson,
        orderFormJson,
        proformaInvoiceJson,
        quoteFormJson,
        getReportProfile,
        getReportLayout,
        getOrderForm,
        getProformaInvoice,
        getQuoteForm,
    } = useResourceContext();
    const commonVariableContext = useCommonVariableContext();
    const [reportData, setReportData] = useState<IReportProfileItem[]>([]);
    const [selectedReport, setSelectedReport] = useState<IReportProfileItem | null>(null);
    const [selectedReportId, setSelectedReportId] = useState<string>("");
    const [dialogContent, setDialogContent] = useState<
        Record<string, unknown> | undefined
    >();
    const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
    const [confirmMessage, setConfirmMessage] = useState<string>("");
    const [diagnosticLevel] = useState<number>(1);
    const [isDataProcessed, setIsDataProcessed] = useState(false);
    const [isLoadingReports, setIsLoadingReports] = useState(true);

    const resolvedDiagnosticLevel =
        diagnosticLevel !== undefined
            ? diagnosticLevel
            : commonVariableContext?.diagnosticLevel !== undefined
                ? Number(commonVariableContext.diagnosticLevel)
                : 0;

    const handleClosePdfMaker = () => {
        setDialogContent(undefined);
        setSelectedReport(null);
        setSelectedReportId("");
    };

    const getSessionVars = (): Record<string, unknown> => ({
        ...sampleReportSessionVars,
    });

    const getReportTemplateJson = async (
        templateFileName?: string
    ): Promise<Record<string, unknown>> => {
        const templateKey = normalizeTemplateFileName(templateFileName);
        let templateJson =
            templateKey === "orderform.json"
                ? orderFormJson
                : templateKey === "proformainvoice.json" || templateKey === "invoice.json"
                    ? proformaInvoiceJson
                    : templateKey === "quoteform.json" || templateKey === "quote.json"
                        ? quoteFormJson
                        : reportLayoutJson;

        if (!templateJson || typeof templateJson !== "object" || Object.keys(templateJson).length === 0) {
            try {
                if (templateKey === "orderform.json") {
                    templateJson = await getOrderForm();
                } else if (templateKey === "proformainvoice.json" || templateKey === "invoice.json") {
                    templateJson = await getProformaInvoice();
                } else if (templateKey === "quoteform.json" || templateKey === "quote.json") {
                    templateJson = await getQuoteForm();
                } else {
                    templateJson = await getReportLayout();
                }
            } catch (err) {
                console.warn("Failed to load template JSON via ResourceContext:", err);
            }
        }

        return templateJson && typeof templateJson === "object"
            ? (templateJson as Record<string, unknown>)
            : {};
    };

    useEffect(() => {
        return () => {
            setReportData([]);
        };
    }, []);

    useEffect(() => {
        if (!reportProfileJson) {
            void getReportProfile();
        }
        if (!reportLayoutJson) {
            void getReportLayout();
        }
    }, [reportProfileJson, reportLayoutJson, getReportProfile, getReportLayout]);

    useEffect(() => {
        if (!appqaReportProps.featureId) {
            setIsLoadingReports(false);
            setIsDataProcessed(true);
            setReportData([]);
            return;
        }

        if (!reportProfileJson) {
            setIsLoadingReports(true);
            return;
        }

        const loadReports = () => {
            setIsLoadingReports(true);

            try {
                const loadedProfiles = unwrapReportProfiles(reportProfileJson);
                const reportProfiles = loadedProfiles.map((item) =>
                    mapToReportProfileItem(item as Record<string, unknown>)
                );
                const filteredReport = reportProfiles.filter(isReportEnabled);
                const finalReports = filteredReport.length > 0 ? filteredReport : reportProfiles;

                const sortedData = sortReportsAZ(dedupeReports(finalReports));
                setReportData(sortedData);
                setIsDataProcessed(true);
            } catch (error) {
                console.error("Error loading report profiles:", error);
                setReportData([]);
                setIsDataProcessed(true);
                appqaReportProps.handleShowUserMessage?.(
                    "Failed to load report profiles."
                );
            } finally {
                setIsLoadingReports(false);
            }
        };

        loadReports();
    }, [appqaReportProps.featureId, appqaReportProps.handleShowUserMessage, reportProfileJson]);

    function evaluateFormulaSafe(
        formula: string,
        context: Record<string, unknown>
    ): string {
        try {
            const fn = new Function(...Object.keys(context), `return (${formula});`);
            const result = fn(...Object.values(context));
            return String(result);
        } catch (err) {
            console.warn("Formula error:", formula, err);
            return "#ERR";
        }
    }

    async function traverseAndEvaluateLabelsSafe(
        node: unknown,
        _apiProfiles?: unknown[],
        context: Record<string, unknown> = {}
    ): Promise<unknown> {
        try {
            if (typeof node !== "object" || node === null) return node;
            const safeNode: Record<string, unknown> = {
                ...(node as Record<string, unknown>),
            };
            try {
                if (
                    typeof safeNode.label === "string"
                    && safeNode.label.trim().startsWith("=")
                ) {
                    const formula = safeNode.label.trim().substring(1);
                    safeNode.label = evaluateFormulaSafe(formula, context);
                }
            } catch (labelError) {
                console.warn("Error evaluating label:", labelError);
            }
            for (const key in safeNode) {
                try {
                    const value = safeNode[key];
                    if (key === "EntID") {
                        safeNode.id = safeNode.EntID;
                        delete safeNode.EntID;
                    }
                    if (key === "Name") {
                        safeNode.name = safeNode.Name;
                        delete safeNode.Name;
                    }
                    if (key === "w" || key === "h" || key === "px" || key === "py") {
                        const num = Number(value);
                        safeNode[key] = Number.isNaN(num) ? 0 : num;
                    } else if (
                        Array.isArray(value)
                        && value.every((v) => typeof v === "object" && v !== null)
                    ) {
                        safeNode[key] = await Promise.all(
                            value.map((v) =>
                                traverseAndEvaluateLabelsSafe(v, _apiProfiles, context)
                            )
                        );
                    }
                } catch (keyError) {
                    console.warn(`Error processing key: ${key}`, keyError);
                }
            }
            return safeNode;
        } catch (error) {
            console.error("Error in traverseAndEvaluateLabelsSafe:", error);
            return node;
        }
    }

    const handleClickDownloadPdf = async (
        _event:
            | React.MouseEvent<HTMLDivElement>
            | React.KeyboardEvent<HTMLDivElement>
            | undefined,
        reportToOpen: IReportProfileItem
    ) => {
        if (!reportToOpen || typeof reportToOpen !== "object") {
            appqaReportProps.handleShowUserMessage?.(
                "Invalid payload: Must be a JSON "
            );
            return;
        }

        try {
            setSelectedReport(reportToOpen);
            setSelectedReportId(String(reportToOpen.EntID ?? ""));

            const objectData = getSessionVars();
            const layoutJson = await getReportTemplateJson(
                typeof reportToOpen.TemplateFileName === "string"
                    ? reportToOpen.TemplateFileName
                    : undefined
            );
            const updatedJson = await traverseAndEvaluateLabelsSafe(
                structuredClone(layoutJson),
                undefined,
                objectData
            );

            if (typeof updatedJson === "object" && updatedJson !== null) {
                const safeNode = normalizeLayoutNode(
                    updatedJson as Record<string, unknown>
                );
                setDialogContent(safeNode);
            }
        } catch (error) {
            console.error("Report open error:", error);
            appqaReportProps.handleShowUserMessage?.(
                "Failed to open report layout."
            );
        }
    };

    const shouldShowLoading = isLoadingReports || !isDataProcessed;
    const shouldShowNoData = !shouldShowLoading && reportData.length === 0;

    return (
        <div
            key={appqaReportProps.uniqueName}
            className="nz-appqa-report-container"
        >
            {dialogContent ? (
                <PdfMakerContainer
                    uniqueName={`${appqaReportProps.uniqueName}-pdf-maker`}
                    headerText={selectedReport?._ReportProfile || selectedReport?.Name || "Download Report"}
                    outputfilename={`${selectedReport?._ReportProfile || selectedReport?.Name || "report"}.pdf`}
                    pdfOutput={selectedReport?._ReportProfile || selectedReport?.Name || "report.pdf"}
                    config={updateLayoutWithSessionVars(
                        dialogContent as any,
                        getSessionVars
                    )}
                    autoGenerate={true}
                    diagnosticLevel={resolvedDiagnosticLevel}
                    onClose={handleClosePdfMaker}
                />
            ) : (
                <>
                    <div className="nz-sub-header">
                        <Label
                            uniqueName={`${appqaReportProps.uniqueName}-task-header`}
                            label={`Available Reports${reportData.length ? ` (${reportData.length})` : ""}`}
                        />
                    </div>
                    <div className="nz-appqa-report-content">
                        {shouldShowLoading ? (
                            <div className="nz-wh-100 nz-d-flex-hv-left">Loading...</div>
                        ) : shouldShowNoData ? (
                            <div className="nz-wh-100 nz-d-flex-hv-left">No Data Found</div>
                        ) : (
                            reportData.map((report, index) => (
                                <CardLayout
                                    key={String(report.EntID ?? index)}
                                    uniqueName={`${appqaReportProps.uniqueName}-report-${index}`}
                                    className={`nz-report-card nz-clickable-report ${report.IsTemplate ? "nz-template-report" : ""} ${report.IsDeprecated ? "nz-deprecated-report" : ""
                                        }`}
                                    data={report}
                                    fields={buildReportCardFields(report)}
                                    isSelected={selectedReportId === report.EntID}
                                    hideRightMouseMenu={true}
                                    onClick={(event) => {
                                        handleClickDownloadPdf(event, report);
                                    }}
                                    ContentImage={{
                                        uniqueName: `${appqaReportProps.uniqueName}-reporti-${index}`,
                                        source: (
                                            <Report24x24
                                                size={FnGetCssVariable("--image-size-2")}
                                                fill="none"
                                                strokeWidth={1}
                                            />
                                        ),
                                        w: "var(--image-size-2)",
                                        tooltip: report._ReportProfile,
                                        type: "svg",
                                    }}
                                />
                            ))
                        )}
                    </div>
                </>
            )}
            <YesNoFormContainer
                isOpen={isConfirmOpen}
                uniqueName={appqaReportProps.uniqueName + "confirmbox"}
                message={confirmMessage}
                showOkButton={true}
                handleOkButtonClick={() => {
                    setIsConfirmOpen(false);
                }}
            />
        </div>
    );
};

export default AppqaReport;
