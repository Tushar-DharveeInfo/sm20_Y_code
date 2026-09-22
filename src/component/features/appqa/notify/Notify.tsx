import { useCallback, useEffect, useMemo, useState } from "react";
import type { Key } from "rc-tree/lib/interface";
import type { CheckInfo } from "rc-tree/lib/Tree";
import { handleContainerKeyDown } from "../../../shared/allcommon/basic/FnHandleContainerKeyDown";
import { Splitter, SplitterPanel } from "primereact/splitter";
import { INote, Notes } from "@n20a/libavnotes";
import "@n20a/libavnotes/style.css";
import "./Notify.css";
import { YesNoFormContainer } from "../../../shared/basic/yesnoformcontainer/YesNoFormContainer";
import { Label } from "../../../shared/basic/label/Label";
import { FnConvertBase64Blob } from "../../../shared/allcommon/sidebar/FnConvertBase64Blob";
import { FnGenerateUID } from "../../../shared/allcommon/settingsform/FnGenerateUID";
import { ComboBoxControl, HTMLEditControl, IOptionItem } from "@n20a/libform";
import { TreeExplorerContainer } from "../../../shared/treeexplorercontainer/TreeExplorerContainer";
import type { TNodeCheckState } from "../../../shared/treeexplorercontainer/ITreeExplorerContainer";
import type { ITreeNode } from "../../../shared/allinterface/tree/ITreeControl";
import { useMainAppContext } from "../../../shared/context/hooks/MainAppHooks";
import { useStatusBarContext } from "../../../shared/context/hooks/StatusBarHooks";
import { useSmDataContext } from "../../../shared/context/hooks/SmDataHooks";
import { FnGetSourceDataset } from "../../../shared/allcommon/FnLoadSampleDatasets";
import type { IBusinessDoc } from "../../../shared/allinterface/IDatasets";
import { FnResolvedHtmlVariable } from "../allcommon/FnResolvedHtmlVariable";
import { useFileDownload } from "@n20a/libfsdb";
import { Send24x24 } from "@n20a/libicon";
import notifySampleData from "../../../../smsampledata/appqa/NotifySampleData.json";

const {
    sampleNotifyAlertProfiles,
    sampleNotifyRecordingLimits,
    sampleNotifySeverityOptions,
} = notifySampleData as {
    sampleNotifyAlertProfiles: any[];
    sampleNotifyRecordingLimits: { maxAudioRecordingTimeSec: number; maxVideoRecordingTimeSec: number };
    sampleNotifySeverityOptions: IOptionItem[];
};

interface IAppqaNotify {
    uniqueName: string;
    headerText: string;
    handleShowUserMessage?: (messageText: string) => void;
}

interface IEmailTemplateItem {
    name: string;
    desc: string;
    fileName: string;
    raw: Record<string, unknown>;
}

function unwrapEmailTemplates(data: unknown): IEmailTemplateItem[] {
    if (!data) return [];

    let list: unknown[] = [];
    if (Array.isArray(data)) {
        list = data;
    } else if (typeof data === "object" && data !== null) {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj.EmailTemplates)) list = obj.EmailTemplates;
        else if (Array.isArray(obj.EmailTemplateProfile)) list = obj.EmailTemplateProfile;
        else if (Array.isArray(obj._EmailTemplateProfile)) list = obj._EmailTemplateProfile;
        else if (Array.isArray(obj.emailtemplates)) list = obj.emailtemplates;
        else if (Array.isArray(obj.Templates)) list = obj.Templates;
        else if (Array.isArray(obj.templates)) list = obj.templates;
        else if (Array.isArray(obj.items)) list = obj.items;
        else if (Array.isArray(obj.EntityData) && obj.EntityData[0]?.Dataset) {
            const ds = obj.EntityData[0].Dataset as Record<string, unknown>;
            const found = ds.EmailTemplates || ds.EmailTemplateProfile || ds._EmailTemplateProfile || ds.Templates;
            if (Array.isArray(found)) list = found;
        }
    }

    const items: IEmailTemplateItem[] = list.map((item) => {
        if (typeof item === "string") {
            return {
                name: item,
                desc: item,
                fileName: item.endsWith(".html") ? item : `${item}.html`,
                raw: { name: item },
            };
        }
        const r = (item ?? {}) as Record<string, unknown>;
        const name = String(
            r.Topic ?? r.topic ??
            r.GroupName ?? r.groupName ??
            r.EmailTemplateName ?? r.emailtemplatename ??
            r.TemplateName ?? r.templateName ??
            r.Name ?? r.name ??
            r.Title ?? r.title ??
            r._EmailTemplateProfile ?? r.EmailTemplate ?? ""
        ).trim();
        const desc = String(
            r.Description ?? r.description ??
            r.Desc ?? r.desc ??
            r.Tooltip ?? r.tooltip ??
            r.Markdown ?? r.markdown ??
            r.GroupName ?? r.groupName ??
            name
        ).trim();
        let fileName = String(
            r.Filename ?? r.filename ??
            r.FileName ?? r.fileName ??
            r.TemplateFileName ?? r.templateFileName ??
            r.HtmlFile ?? r.htmlFile ??
            r.File ?? r.file ?? ""
        ).trim();
        if (!fileName && name) {
            fileName = name.toLowerCase().endsWith(".html") ? name : `${name}.html`;
        } else if (fileName && !fileName.toLowerCase().endsWith(".html")) {
            fileName = `${fileName}.html`;
        }
        return {
            name,
            desc,
            fileName,
            raw: r,
        };
    }).filter((t) => Boolean(t.name));

    // Deduplicate by name to ensure unique ComboBox options
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = item.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

const AppqaNotify = (appqaMessageProps: IAppqaNotify) => {
    const mainAppContext = useMainAppContext();
    const statusBarContext = useStatusBarContext();
    const smDataContext = useSmDataContext();
    const authSession = mainAppContext?.authSession;
    const bucketName = authSession?.bucketName ?? "n20-bucket-01";

    const [checkedContactKeys, setCheckedContactKeys] = useState<Key[]>([]);
    const [checkedContacts, setCheckedContacts] = useState<ITreeNode[]>([]);
    const [severity, setSeverity] = useState<string>("Critical");
    const [alertProfiles, setAlertProfiles] = useState<any[]>();
    const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
    const [confirmMessage, setConfirmMessage] = useState<string>();
    const [noteDetails, setNoteDetails] = useState<INote>();
    const [optionData, setOptionData] = useState<IOptionItem[]>();
    const [refreshToken, setRefreshToken] = useState(0);
    const [maxRecordingTime, setMaxRecordingTime] = useState<{
        maxAudioRecordingTime: number;
        maxVideoRecordingTime: number;
    }>();

    // Email templates state
    const [emailTemplates, setEmailTemplates] = useState<IEmailTemplateItem[]>([]);
    const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");
    const [htmlContent, setHtmlContent] = useState<string>("");
    const [loadingHtml, setLoadingHtml] = useState<boolean>(false);

    const { downloadSingleFile } = useFileDownload();

    const FnGetJsonFromStorage = useCallback(async (filePath: string) => {
        const path = filePath.startsWith(bucketName) ? filePath : `${bucketName}/${filePath.replace(/^\/+/, "")}`;
        const result = await downloadSingleFile(path);
        if (!result?.success || !result.blobUrl) {
            throw new Error(result?.message || result?.error || `Failed to fetch ${filePath}`);
        }

        try {
            const response = await fetch(result.blobUrl);
            if (!response.ok) {
                throw new Error(`Failed to load ${filePath} (${response.status})`);
            }

            return await response.json();
        } finally {
            if (result.blobUrl) {
                URL.revokeObjectURL(result.blobUrl);
            }
        }
    }, [downloadSingleFile, bucketName]);

    const FnGetHtmlFromStorage = useCallback(async (filePath: string) => {
        const path = filePath.startsWith(bucketName) ? filePath : `${bucketName}/${filePath.replace(/^\/+/, "")}`;
        const result = await downloadSingleFile(path);
        if (!result?.success || !result.blobUrl) {
            throw new Error(result?.message || result?.error || `Failed to fetch ${filePath}`);
        }

        try {
            const response = await fetch(result.blobUrl);
            if (!response.ok) {
                throw new Error(`Failed to load ${filePath} (${response.status})`);
            }

            return await response.text();
        } finally {
            if (result.blobUrl) {
                URL.revokeObjectURL(result.blobUrl);
            }
        }
    }, [downloadSingleFile, bucketName]);

    const handleContactNodeCheck = (
        checked: TNodeCheckState,
        info: CheckInfo<ITreeNode>
    ) => {
        const keys = Array.isArray(checked) ? checked : (checked?.checked ?? []);
        setCheckedContactKeys(keys);

        if (info?.checkedNodes) {
            const contacts = info.checkedNodes.filter(
                (n) => String(n.NodeType ?? '').toLowerCase() === 'contact'
            );
            setCheckedContacts(contacts);
        } else if (info?.node) {
            setCheckedContacts((prev) => {
                const isChecked = info.checked;
                const nodeKey = String(info.node.key);
                if (isChecked) {
                    if (!prev.some((n) => String(n.key) === nodeKey)) {
                        return [...prev, info.node];
                    }
                    return prev;
                } else {
                    return prev.filter((n) => String(n.key) !== nodeKey);
                }
            });
        }
    };

    useEffect(() => {
        // SAMPLE DATA: replaces FnGetApplicationParameter (AP Configure recording limits).
        const maxAudioRecordingTime =
            sampleNotifyRecordingLimits.maxAudioRecordingTimeSec * 1000;
        const maxVideoRecordingTime =
            sampleNotifyRecordingLimits.maxVideoRecordingTimeSec * 1000;

        setMaxRecordingTime({
            maxAudioRecordingTime,
            maxVideoRecordingTime,
        });
        setNoteDetails({
            maxAudioRecordingTime,
            maxVideoRecordingTime,
            noteId: "1",
            noteTitle: "",
            notecontent: "",
            notefile: undefined,
            noteaudio: undefined,
            notevideo: undefined,
            noteCreatedAt: new Date(),
        });
    }, []);

    useEffect(() => {
        // SAMPLE DATA: replaces mainAppContext.alertProfileRecords.
        setAlertProfiles(sampleNotifyAlertProfiles);
    }, []);

    useEffect(() => {
        // SAMPLE DATA: replaces FnGetRefListForLibControl('refAlertSeverity', ...).
        setOptionData(sampleNotifySeverityOptions);
    }, []);

    // Load email templates profile using useFileDownload hook
    useEffect(() => {
        let isMounted = true;
        const fetchProfiles = async () => {
            try {
                const parsed = await FnGetJsonFromStorage("sm/emailtemplates/emailtemplatesprofile.json");
                if (!isMounted) return;

                const templates = unwrapEmailTemplates(parsed);
                if (templates.length > 0) {
                    console.log("Notify: loaded email templates:", templates);
                    setEmailTemplates(templates);
                    return;
                }
            } catch (err) {
                console.error("Notify: Failed to load emailtemplatesprofile.json", err);
            }

            if (isMounted) {
                // No fallback - keep email templates list empty if not retrieved from API
                setEmailTemplates([]);
            }
        };

        void fetchProfiles();

        return () => {
            isMounted = false;
        };
    }, [FnGetJsonFromStorage]);

    // Populate template options with desc as tooltip
    const templateOptions = useMemo<IOptionItem[]>(() => {
        return emailTemplates.map((t) => ({
            label: t.name,
            value: t.name,
            tooltip: t.desc || t.name,
        }));
    }, [emailTemplates]);

    // Handle template selection in combo
    const handleTemplateChange = async (templateName: string) => {
        setSelectedTemplateName(templateName);
        if (!templateName) {
            setHtmlContent("");
            return;
        }

        const template = emailTemplates.find((t) => t.name === templateName);
        const fileName = template?.fileName || `${templateName}.html`;
        const templatePath = `sm/emailtemplates/${fileName}`;

        setLoadingHtml(true);
        statusBarContext?.setIsLoading?.(true);
        statusBarContext?.setLoadingLabel?.("Loading email template...");
        try {
            const content = await FnGetHtmlFromStorage(templatePath);

            if (content != null) {
                // If getting response then use it
                setHtmlContent(content);
            } else {
                // API not working in HTML if no response
                setHtmlContent("<p>API not working</p>");
            }
        } catch (err) {
            console.error("Notify: Failed to load template file", err);
            // API not working in HTML
            setHtmlContent("<p>API not working</p>");
        } finally {
            setLoadingHtml(false);
            statusBarContext?.setIsLoading?.(false);
            statusBarContext?.setLoadingLabel?.("");
        }
    };

    const handleValueChange = (newValue: string, _name: string) => {
        setSeverity(newValue);
    };

    const handleApiForMessageSending = async (
        EntID: string,
        messageText: string,
        _AlertProfile: unknown,
        fileUID?: string,
        fileType?: string
    ) => {
        void EntID;
        void fileUID;
        void fileType;

        if (!checkedContactKeys?.length && !checkedContacts?.length) {
            appqaMessageProps.handleShowUserMessage?.(
                "Something went wrong in create message from template."
            );
            return;
        }

        try {
            const alertProfile = alertProfiles?.find(
                (item) => item._AlertProfile === "SendMessage"
            );
            const html = alertProfile?.HTML ?? "<div id=\"messageContent\"></div>";
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            let form = doc.querySelector("#userList");
            if (!form) {
                form = doc.createElement("form");
                form.id = "userList";
                doc.body.appendChild(form);
            }
            checkedContacts.forEach((contact, index) => {
                const contactName = String(contact.cname ?? contact.Name ?? `Contact ${index + 1}`);
                const extraHTML = `<input type="hidden" name="user${index + 1}" value="${contactName}" />`;
                form!.insertAdjacentHTML("beforeend", extraHTML);
            });

            let msgDiv = doc.querySelector("#messageContent");
            if (!msgDiv) {
                msgDiv = doc.createElement("div");
                msgDiv.id = "messageContent";
                doc.body.appendChild(msgDiv);
            }

            // Save whatever is edited into the same field where msg is saved
            if (selectedTemplateName) {
                msgDiv.innerHTML = messageText;
            } else {
                msgDiv.textContent = messageText;
            }

            // Static success path (no AddToAlertQueue API).
            void _AlertProfile;
            void severity;
            setIsConfirmOpen(true);
            setConfirmMessage("Message sent successfully.");
        } catch (error) {
            console.error("Error in create alert message :", error);
            appqaMessageProps.handleShowUserMessage?.(
                "Something went wrong in create message from template."
            );
        }
    };

    const handleSendMessage = async (message: INote) => {
        if (!checkedContactKeys?.length && !checkedContacts?.length) {
            setNoteDetails(message);
            appqaMessageProps.handleShowUserMessage?.(
                "Please! Select contacts to send message"
            );
            setRefreshToken((prev) => prev + 1);
            return;
        }
        const alertProfile = alertProfiles?.find(
            (item) => item._AlertProfile === "SendMessage"
        );
        if (!alertProfile || !alertProfile.HTML || !alertProfile.EntID) {
            appqaMessageProps.handleShowUserMessage?.(
                "Alert profile record not found to send message"
            );
            return;
        }
        function getFirst10Chars(text: string): string {
            if (!text) return "";
            return text.substring(0, 10);
        }
        let base64String;
        let fileName;
        let fileType: string = "Message";
        let fileObject;
        if (message.notevideo) {
            base64String = await FnConvertBase64Blob(
                message.notevideo,
                "toBase64",
                message.notevideo.type
            );
            fileName = getFirst10Chars(message.notecontent);
            fileType = "Video";
            fileObject = message.notevideo;
        } else if (message.notefile) {
            base64String = await FnConvertBase64Blob(
                message.notefile,
                "toBase64",
                message.notefile.type
            );
            fileName =
                message.notefile &&
                    (message.notefile as Record<string, any>).name
                    ? String((message.notefile as Record<string, any>).name)
                    : getFirst10Chars(message.notecontent);

            fileType = "image";
            fileObject = message.notefile;
        } else if (message.noteaudio) {
            base64String = await FnConvertBase64Blob(
                message.noteaudio,
                "toBase64",
                message.noteaudio.type
            );
            fileName = getFirst10Chars(message.notecontent);

            fileType = "Audio";
            fileObject = message.noteaudio;
        }

        if (!message.notefile && !message.notevideo && !message.noteaudio) {
            await handleApiForMessageSending(
                alertProfile.EntID,
                message.notecontent,
                alertProfile._AlertProfile
            );
        } else {
            function getExtensionFromMime(
                mimeType: string,
                name: string
            ): string {
                if (!mimeType) return "";

                if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
                    const parts = mimeType.split("/");
                    return parts[1]?.toLowerCase() ?? "";
                }

                if (name) {
                    const lastDot = name.lastIndexOf(".");
                    if (lastDot !== -1) {
                        return name.substring(lastDot + 1).toLowerCase();
                    }
                }

                return "";
            }
            function getFileCategoryFromFile(file: Blob): string {
                if (!file?.type) return "unknown";

                const mime = file.type?.toLowerCase();

                if (mime.startsWith("image/")) return "image";
                if (mime === "application/pdf") return "pdf";
                if (mime === "text/plain") return "Text";

                if (mime.includes("spreadsheet") || mime.includes("excel"))
                    return "other";
                if (mime.includes("word")) return "other";
                if (mime.includes("powerpoint")) return "other";

                if (mime.startsWith("audio/")) return "audio";
                if (mime.startsWith("video/")) return "video";

                return "unknown";
            }
            const entid = FnGenerateUID();

            void getFileCategoryFromFile;
            void getExtensionFromMime;
            void base64String;
            void fileName;
            void entid;
            void fileObject;

            const sampleFileUID = `SAMPLE-FILE-${FnGenerateUID()}`;
            await handleApiForMessageSending(
                alertProfile.EntID,
                message.notecontent,
                alertProfile._AlertProfile,
                sampleFileUID,
                fileType
            );
        }
    };

    // Send HTML template message
    const handleSendHtmlMessage = async () => {
        if (!checkedContactKeys?.length && !checkedContacts?.length) {
            appqaMessageProps.handleShowUserMessage?.(
                "Please! Select contacts to send message"
            );
            return;
        }
        if (!htmlContent.trim()) {
            appqaMessageProps.handleShowUserMessage?.(
                "Please enter message content before sending."
            );
            return;
        }
        const alertProfile = alertProfiles?.find(
            (item) => item._AlertProfile === "SendMessage"
        );
        if (!alertProfile || !alertProfile.HTML || !alertProfile.EntID) {
            appqaMessageProps.handleShowUserMessage?.(
                "Alert profile record not found to send message"
            );
            return;
        }

        // Retrieve BS and Subscription datasets
        const allBusinesses: IBusinessDoc[] = smDataContext?.datasets?.businesses?.length
            ? smDataContext.datasets.businesses
            : FnGetSourceDataset("businesses");


        const primaryContact = checkedContacts[0] || {};
        const primaryBid = primaryContact.bid || (primaryContact as any).parentEntID || "";
        const matchedBusiness = allBusinesses.find(
            (b) => b.bid === primaryBid || (b as any).EntID === primaryBid
        );



        // Prepare variables array (including BS information, contact information, subscription details, etc.)
        const variablesArray: Array<Record<string, unknown>> = [
            // Business (BS) Information
            {
                key: "BS_INFO",
                bid: matchedBusiness?.bid ?? primaryBid,
                businessid: matchedBusiness?.bid ?? primaryBid,
                bname: matchedBusiness?.bname ?? "",
                businessname: matchedBusiness?.bname ?? "",
                company: matchedBusiness?.bname ?? "",
                companyname: matchedBusiness?.bname ?? "",
                btype: matchedBusiness?.btype ?? "",
                businesstype: matchedBusiness?.btype ?? "",
                status: matchedBusiness?.status ?? "",
                businessstatus: matchedBusiness?.status ?? "",
                salesexec: matchedBusiness?.salesexec ?? "",
                country: matchedBusiness?.country ?? "",
                state: matchedBusiness?.state ?? "",
                amcexpirydate: matchedBusiness?.amcexpirydate ? new Date(matchedBusiness.amcexpirydate).toLocaleDateString() : "",
                saasexpirydate: matchedBusiness?.saasexpirydate ? new Date(matchedBusiness.saasexpirydate).toLocaleDateString() : "",
            },
            // Contact Information
            {
                key: "CONTACT_INFO",
                cid: primaryContact.cid ?? "",
                contactid: primaryContact.cid ?? "",
                cname: checkedContacts.map((c) => c.cname ?? c.Name).filter(Boolean).join(", "),
                name: checkedContacts.map((c) => c.cname ?? c.Name).filter(Boolean).join(", "),
                contactname: checkedContacts.map((c) => c.cname ?? c.Name).filter(Boolean).join(", "),
                fullname: checkedContacts.map((c) => c.cname ?? c.Name).filter(Boolean).join(", "),
                email: checkedContacts.map((c) => c.email).filter(Boolean).join(", "),
                contactemail: checkedContacts.map((c) => c.email).filter(Boolean).join(", "),
                phone: primaryContact.phone ?? "",
                phonenumber: primaryContact.phone ?? "",
                address1: (primaryContact as any).address1 ?? "",
                city: (primaryContact as any).city ?? "",
                state: (primaryContact as any).state ?? "",
                country: (primaryContact as any).country ?? "",
                zip: (primaryContact as any).zip ?? "",
                status: primaryContact.status ?? "",
            },

            // General / System variables
            {
                key: "GENERAL_INFO",
                date: new Date().toLocaleDateString(),
                currentdate: new Date().toLocaleDateString(),
                today: new Date().toLocaleDateString(),
                year: String(new Date().getFullYear()),
                severity,
            },
        ];

        // Resolve variables from HTML using the provided variable array
        const resolvedHtml = FnResolvedHtmlVariable(htmlContent, variablesArray);

        // Update editor content with the resolved HTML
        setHtmlContent(resolvedHtml);

        // Send prepared notification data to Y Code
        await handleApiForMessageSending(
            alertProfile.EntID,
            resolvedHtml,
            alertProfile._AlertProfile
        );
    };

    const handleOkButtonClick = () => {
        setIsConfirmOpen(false);
        setCheckedContactKeys([]);
        setCheckedContacts([]);
        setNoteDetails({
            maxAudioRecordingTime:
                maxRecordingTime?.maxAudioRecordingTime ?? 1000,
            maxVideoRecordingTime:
                maxRecordingTime?.maxVideoRecordingTime ?? 1000,
            noteId: "1",
            noteTitle: "",
            notecontent: "",
            notefile: undefined,
            noteaudio: undefined,
            notevideo: undefined,
            noteCreatedAt: new Date(),
        });
        setHtmlContent("");
        setSelectedTemplateName("");
    };

    function handleDeleteNotes(
        objectType: "audio" | "video" | "file",
        objectData?: Blob | File | undefined
    ): void {
        if (import.meta.env.DEV)
            console.log("handleDeleteNotes", objectType, objectData);
    }

    return (
        <div
            className="nz-w-100 nz-h-100 nz-appqa-notify-container"
            tabIndex={1}
            onKeyDown={handleContainerKeyDown}
            key={appqaMessageProps.uniqueName}
        >
            <div className="nz-sub-header">
                <Label
                    uniqueName={`${appqaMessageProps.uniqueName}-task-header`}
                    label={appqaMessageProps.headerText ?? "Notify"}
                />
            </div>
            <Splitter tabIndex={-1} className="nz-w-100 nz-h-100">
                <SplitterPanel
                    tabIndex={-1}
                    size={70}
                    minSize={10}
                    className="nz-d-flex-column nz-align-center nz-appqa-notify-left-pane nz-pane-1"
                >
                    {/* Email template combobox above severity */}
                    <div className="nz-w-100 nz-emailtemplate-combobox-container">
                        <ComboBoxControl
                            options={templateOptions}
                            label={"Email Template"}
                            value={selectedTemplateName}
                            onChange={(value) => {
                                void handleTemplateChange(value?.toString() ?? "");
                            }}
                        />
                    </div>
                    <div className="nz-w-100 nz-severity-combobox-container">
                        <ComboBoxControl
                            options={optionData ?? []}
                            label={"Severity"}
                            value={severity}
                            required={true}
                            onChange={(value) => {
                                handleValueChange(
                                    value?.toString() ?? "",
                                    "severity"
                                );
                            }}
                        />
                    </div>
                    {/* Enhanced message control area */}
                    <div className="nz-w-100 nz-h-100 nz-messagebox-container">
                        {!selectedTemplateName ? (
                            noteDetails && (
                                <Notes
                                    {...noteDetails}
                                    key={refreshToken}
                                    allowAudio={false}
                                    allowVideo={false}
                                    sendTooltip={"Send notification"}
                                    handleDelete={handleDeleteNotes}
                                    sendNote={handleSendMessage}
                                />
                            )
                        ) : (
                            <div className="nz-html-editor-container nz-w-100 nz-h-100">
                                {loadingHtml ? (
                                    <div className="nz-html-editor-loading">Loading template...</div>
                                ) : (
                                    <>
                                        <div className="nz-html-editor-body">
                                            <HTMLEditControl
                                                id={`${appqaMessageProps.uniqueName}-html-editor`}
                                                name="emailTemplateHtml"
                                                value={htmlContent}
                                                minHeight={60}
                                                onChange={(val) => {
                                                    setHtmlContent(val ?? "");
                                                }}
                                            />
                                        </div>
                                        <div className="nz-html-editor-action-strip">
                                            <button
                                                type="button"
                                                className="libavnotes-button libavnotes-button-success libavnotes-send-button nz-html-send-btn"
                                                title="Send notification"
                                                onClick={handleSendHtmlMessage}
                                                disabled={!htmlContent.trim()}
                                                style={{
                                                    backgroundColor: "transparent",
                                                    border: "none",
                                                    cursor: htmlContent.trim() ? "pointer" : "default",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                    color: htmlContent.trim() ? "#007ACC" : "#d4d4d8",
                                                    padding: "4px 8px",
                                                }}
                                            >
                                                <Send24x24 size={16} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </SplitterPanel>
                <SplitterPanel
                    tabIndex={-1}
                    size={30}
                    minSize={20}
                    className="nz-d-flex-column nz-appqa-notify-right-pane nz-pane-2"
                >
                    <TreeExplorerContainer
                        uniqueName={`${appqaMessageProps.uniqueName}-bs-tree`}
                        featureId={appqaMessageProps.uniqueName || "notify"}
                        wrapWithRootLabel="Businesses"
                        allowCheckbox={true}
                        defaultCheckedKeys={checkedContactKeys}
                        handleNodeCheck={handleContactNodeCheck}
                    />
                </SplitterPanel>
            </Splitter>
            <YesNoFormContainer
                isOpen={isConfirmOpen}
                uniqueName={`${appqaMessageProps.uniqueName}-confirm-ok`}
                message={confirmMessage ?? ""}
                showOkButton={true}
                handleOkButtonClick={handleOkButtonClick}
                handleYesButtonClick={function (): void { }}
                handleNoButtonClick={function (): void { }}
            />
        </div>
    );
};

export default AppqaNotify;
