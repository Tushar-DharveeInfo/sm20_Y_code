import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@mui/material";
import { PdfMaker, updateLayoutWithSessionVars } from "@n20a/libreport";
import "./Report.css";
import "@n20a/libreport/style.css";
import { Close24x24, Report24x24, Save24x24 } from "@n20a/libicon";
import { FnGetCssVariable } from "../../../appcontainer/allcommon/FnGetCssVariable";
import { IReportProfileItem } from "../../../shared/context/allinterface/IReport";
import { ActionImage } from "../../../shared/basic/actionimage/ActionImage";
import { Label } from "../../../shared/basic/label/Label";
import { JsonViewer } from "../../../shared/jsonviewer/JsonViewer";
import { YesNoFormContainer } from "../../../shared/basic/yesnoformcontainer/YesNoFormContainer";
import { CardLayout } from "../../../shared/cardlayout/CardLayout";
import { ICardLayoutField } from "../../../shared/cardlayout/CardLayout";
import { FnFormatDateWithAppFormat } from "../../../appcontainer/allcommon/FnFormatDateWithAppFormat";
import { useResourceContext } from "../../../shared/context/hooks/ResourceHooks";
import reportSampleData from "../../../../sampledata/appqa/ReportSampleData.json";
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
    } = useResourceContext();
    const [reportData, setReportData] = useState<IReportProfileItem[]>([]);
    const [selectedReportId, setSelectedReportId] = useState<string>("");
    const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
    const [dialogContent, setDialogContent] = useState<
        Record<string, unknown> | undefined
    >();
    const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
    const [confirmMessage, setConfirmMessage] = useState<string>("");
    const [diagnosticLevel] = useState<number>(1);
    const [isDataProcessed, setIsDataProcessed] = useState(false);
    const [isLoadingReports, setIsLoadingReports] = useState(true);

    const getSessionVars = (): Record<string, unknown> => ({
        ...sampleReportSessionVars,
    });

    const getReportTemplateJson = (
        templateFileName?: string
    ): Record<string, unknown> => {
        const templateKey = normalizeTemplateFileName(templateFileName);
        const templateJson =
            templateKey === "orderform.json"
                ? orderFormJson
                : templateKey === "proformainvoice.json" || templateKey === "invoice.json"
                    ? proformaInvoiceJson
                    : templateKey === "quoteform.json" || templateKey === "quote.json"
                        ? quoteFormJson
                        : reportLayoutJson;

        return templateJson && typeof templateJson === "object"
            ? templateJson as Record<string, unknown>
            : {};
    };

    useEffect(() => {
        return () => {
            setReportData([]);
        };
    }, []);

    useEffect(() => {
        if (!appqaReportProps.featureId) {
            setIsLoadingReports(false);
            setIsDataProcessed(true);
            setReportData([]);
            return;
        }

        setIsLoadingReports(true);

        if (!reportProfileJson) {
            return;
        }

        try {
            const loadedProfiles = unwrapReportProfiles(reportProfileJson);
            const reportProfiles = loadedProfiles.map((item) =>
                mapToReportProfileItem(item as Record<string, unknown>)
            );
            const filteredReport = reportProfiles.filter(isReportEnabled);

            const sortedData = sortReportsAZ(dedupeReports(filteredReport));
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
        selectedReport: IReportProfileItem
    ) => {
        if (!selectedReport || typeof selectedReport !== "object") {
            appqaReportProps.handleShowUserMessage?.(
                "Invalid payload: Must be a JSON "
            );
            return;
        }

        try {
            // SAMPLE DATA: replaces NODE.GetKebabMenuData → FS.GetFileStream → EM.GetEntityRecords.
            // axiosInterceptor({ url: NODE.GetKebabMenuData, ... });
            // axiosInterceptor({ url: FS.GetFileStream, ... });
            // axiosInterceptor({ url: EM.GetEntityRecords, ... });
            // MakeApiCallsForMemoryURL(...);

            const objectData = getSessionVars();
            const layoutJson = getReportTemplateJson(
                typeof selectedReport.TemplateFileName === "string"
                    ? selectedReport.TemplateFileName
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
                setIsDialogOpen(true);
            }
        } catch (error) {
            console.error("Report open error:", error);
            appqaReportProps.handleShowUserMessage?.(
                "Failed to open report layout."
            );
        }
    };

    function handleClickInformation(): void {
        const handleSaveAs = async () => {
            if (!dialogContent || typeof dialogContent !== "object") {
                console.warn("Invalid dialogContent:", dialogContent);
                return;
            }
            if (!window?.showSaveFilePicker) {
                console.error(
                    "File System Access API not supported in this browser"
                );
                setConfirmMessage("Save not supported in this browser.");
                setIsConfirmOpen(true);
                return;
            }
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: "reportTemplate.json",
                types: [
                    {
                        description: "JSON Files",
                        accept: { "application/json": [".json"] },
                    },
                ],
            });
            const writable = await fileHandle.createWritable();
            try {
                const jsonData = JSON.stringify(dialogContent, null, 2);
                await writable.write(jsonData);
            } catch (writeError) {
                console.error("Error writing file:", writeError);
                throw writeError;
            } finally {
                try {
                    await writable.close();
                } catch (closeError) {
                    console.warn("Error closing file stream:", closeError);
                }
            }
            setConfirmMessage("File saved successfully!");
            setIsConfirmOpen(true);
        };
        try {
            if (dialogContent && typeof dialogContent === "object") {
                void handleSaveAs();
            }
        } catch (error) {
            console.error("Error in handleClickInformation:", error);
        }
    }

    const shouldShowLoading = isLoadingReports || !isDataProcessed;
    const shouldShowNoData = !shouldShowLoading && reportData.length === 0;
    console.log('reportData', reportData)
    return (
        <div
            key={appqaReportProps.uniqueName}
            className="nz-appqa-report-container"
        >
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
                            onClick={() => {
                                setSelectedReportId(String(report.EntID ?? ""));
                                handleClickDownloadPdf(undefined, report);
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
            {dialogContent && diagnosticLevel !== 0 ? (
                <Dialog
                    open={isDialogOpen}
                    className="nz-dialog-container"
                    maxWidth={"md"}
                    fullWidth={true}
                    hideBackdrop={true}
                    style={{ zIndex: 9999 }}
                >
                    <div className="nz-dialog-header nz-sub-header">
                        <Label
                            uniqueName={`${appqaReportProps.uniqueName}-dialog-title`}
                            label={"Download Report"}
                            fontWeight="bold"
                        />
                        <div className="nz-d-flex-row nz-align-center">
                            {diagnosticLevel !== 0 && (
                                <ActionImage
                                    uniqueName={`${appqaReportProps.uniqueName}-explorer-tree-info-ai`}
                                    image={{
                                        uniqueName: `${appqaReportProps.uniqueName}-layout-save-ai`,
                                        source: (
                                            <Save24x24
                                                size={FnGetCssVariable("--image-size-1")}
                                                fill="none"
                                                strokeWidth={1}
                                            />
                                        ),
                                        w: "var(--image-size-2)",
                                        tooltip: "Click to Save Report Layout json",
                                        type: "svg",
                                    }}
                                    w={"var(--node_height)"}
                                    disabled={false}
                                    h={"var(--node_height)"}
                                    actionCode={"savefloorlayout"}
                                    handleMouse={handleClickInformation}
                                />
                            )}
                            <ActionImage
                                handleMouse={() => {
                                    setIsDialogOpen(false);
                                    setDialogContent(undefined);
                                }}
                                image={{
                                    uniqueName: `${appqaReportProps.uniqueName}-i-close`,
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
                                    tooltip: "close",
                                }}
                                uniqueName={`${appqaReportProps.uniqueName}-ai-close`}
                                actionCode="cancel"
                                w="var(--node_height)"
                                h="var(--node_height)"
                            />
                        </div>
                    </div>
                    <DialogContent>
                        {diagnosticLevel !== 0 && (
                            <JsonViewer
                                uniqueName={`${appqaReportProps.uniqueName}-dialog-content`}
                                jsonData={dialogContent}
                                showAsDiv={true}
                            />
                        )}
                        <PdfMaker
                            config={updateLayoutWithSessionVars(
                                dialogContent as any,
                                getSessionVars
                            )}
                            autoGenerate={false}
                            onSuccess={() => { }}
                        />
                    </DialogContent>
                </Dialog>
            ) : (
                <>
                    {dialogContent && (
                        <div style={{ display: "none" }}>
                            <PdfMaker
                                config={updateLayoutWithSessionVars(
                                    dialogContent as any,
                                    getSessionVars
                                )}
                                autoGenerate={true}
                                onSuccess={() => { }}
                            />
                        </div>
                    )}
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
