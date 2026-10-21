import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@mui/material";
import { INote, Notes } from "@n20a/libavnotes";
import "@n20a/libavnotes/style.css";
import { ComboBoxControl, IOptionItem } from "@n20a/libform";
import { Close24x24, Send24x24, User24x24 } from "@n20a/libicon";
import { useFileDownload } from "@n20a/libfsdb";
import { Highlight, themes } from "prism-react-renderer";
import parse from "html-react-parser";
// @ts-ignore
import prettier from "prettier/standalone";
// @ts-ignore
import parserHtml from "prettier/parser-html";

import { useMainAppContext } from "../../context/hooks/MainAppHooks";
import { useStatusBarContext } from "../../context/hooks/StatusBarHooks";
import { useSmDataContext } from "../../context/hooks/SmDataHooks";
import { FnResolvedHtmlVariable } from "../../../features/appqa/allcommon/FnResolvedHtmlVariable";
import { FnGenerateUID } from "../../allcommon/settingsform/FnGenerateUID";
import { FnResolveEmailTemplate } from "../../allcommon/FnGetEmailVars";
import { YesNoFormContainer } from "../../basic/yesnoformcontainer/YesNoFormContainer";
import { Label } from "../../basic/label/Label";
import type { IBusinessDoc, IContactDoc } from "@n20a/libfsdb";
import "./SendEmailToContact.css";

const DEFAULT_SEVERITY_OPTIONS: IOptionItem[] = [
    { label: "Critical", value: "Critical" },
    { label: "Warning", value: "Warning" },
    { label: "Normal", value: "Normal" },
    { label: "Info", value: "Info" },
];

const DEFAULT_ALERT_PROFILES: any[] = [
    {
        GroupName: "Message",
        _AlertProfile: "SendMessage",
        UserName: "Admin",
        EscalationLevel: 1,
        AttemptCount: 1,
        AlertSeverity: "Critical",
        Duration: "0",
        HTML: '<div id="messageContent"></div><form id="userList"></form>',
        Keywords: "",
        DateCreated: "2026-01-01T00:00:00",
        LastUpdatedBy: "Admin",
        Secured: false,
        IsNZ: true,
        EntID: "ALERT-PROFILE-SEND-MESSAGE",
        RecID: "ALERT-PROFILE-SEND-MESSAGE-REC",
        LastUpdated: "2026-01-01T00:00:00",
        EntityName: "AlertProfile",
    },
];

const DEFAULT_RECORDING_LIMITS = {
    maxAudioRecordingTimeSec: 60,
    maxVideoRecordingTimeSec: 120,
};

export interface ISendEmailToContactProps {
    uniqueName?: string;
    headerText?: string;
    contact?: IContactDoc;
    contacts?: IContactDoc[];
    isOpen?: boolean;
    onClose?: () => void;
    handleShowUserMessage?: (messageText: string) => void;
}

interface IEmailTemplateItem {
    title: string;
    markdown: string;
    comboLabel: string;
    dataSource: string;
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
            const clean = item.replace(/\.html$/i, "");
            return {
                title: clean,
                markdown: "",
                comboLabel: clean,
                fileName: item.endsWith(".html") ? item : `${item}.html`,
                raw: { name: item },
            };
        }
        const r = (item ?? {}) as Record<string, unknown>;
        const title = String(
            r.Title ?? r.title ??
            r.Topic ?? r.topic ??
            r.EmailTemplateName ?? r.emailtemplatename ??
            r.TemplateName ?? r.templateName ??
            r.Name ?? r.name ??
            r.GroupName ?? r.groupName ??
            r._EmailTemplateProfile ?? r.EmailTemplate ?? ""
        ).trim();
        const markdown = String(
            r.Markdown ?? r.markdown ??
            r.Description ?? r.description ??
            r.Desc ?? r.desc ??
            r.Tooltip ?? r.tooltip ?? ""
        ).trim();

        const comboLabel = title && markdown ? `${title} – ${markdown}` : title || markdown;

        const dataSource = String(
            r.DataSource ?? r.dataSource ??
            r.Datasource ?? r.datasource ?? ""
        ).trim();

        let fileName = String(
            r.Filename ?? r.filename ??
            r.FileName ?? r.fileName ??
            r.TemplateFileName ?? r.templateFileName ??
            r.HtmlFile ?? r.htmlFile ??
            r.File ?? r.file ?? ""
        ).trim();
        if (!fileName && title) {
            fileName = title.toLowerCase().endsWith(".html") ? title : `${title}.html`;
        } else if (fileName && !fileName.toLowerCase().endsWith(".html")) {
            fileName = `${fileName}.html`;
        }
        return {
            title,
            markdown,
            comboLabel,
            dataSource,
            fileName,
            raw: r,
        };
    }).filter((t) => Boolean(t.comboLabel));

    const seen = new Set<string>();
    return items.filter((item) => {
        const key = item.comboLabel.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

const SendEmailToContact = (props: ISendEmailToContactProps) => {
    const mainAppContext = useMainAppContext();
    const statusBarContext = useStatusBarContext();
    const smDataContext = useSmDataContext();
    const authSession = mainAppContext?.authSession;
    const bucketName = authSession?.bucketName ?? "n20-bucket-01";

    const [severity, setSeverity] = useState<string>("Critical");
    const [alertProfiles, setAlertProfiles] = useState<any[]>();
    const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
    const [confirmMessage, setConfirmMessage] = useState<string>();
    const [noteDetails, setNoteDetails] = useState<INote>();
    const [optionData, setOptionData] = useState<IOptionItem[]>();
    const [refreshToken, setRefreshToken] = useState(0);

    const [emailTemplates, setEmailTemplates] = useState<IEmailTemplateItem[]>([]);
    const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");
    const [htmlContent, setHtmlContent] = useState<string>("");
    const [formattedHtml, setFormattedHtml] = useState<string>("");
    const [loadingHtml, setLoadingHtml] = useState<boolean>(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

    const targetContacts = useMemo<IContactDoc[]>(() => {
        if (props.contact) return [props.contact];
        if (props.contacts && props.contacts.length > 0) return props.contacts;
        return [];
    }, [props.contact, props.contacts]);

    const primaryContact = targetContacts[0];

    // Prettier formatting for HTML templates
    useEffect(() => {
        if (!htmlContent) {
            setFormattedHtml("");
            return;
        }
        prettier
            .format(htmlContent, {
                parser: "html",
                plugins: [parserHtml],
                printWidth: 60,
                tabWidth: 2,
            })
            .then((cleanHtml: string) => setFormattedHtml(cleanHtml.trim()))
            .catch((err: unknown) => {
                console.warn("Prettier formatting error, fallback to raw html:", err);
                setFormattedHtml(htmlContent);
            });
    }, [htmlContent]);

    const openModal = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIsPreviewOpen(true);
    };
    const closeModal = (e?: React.MouseEvent | React.SyntheticEvent) => {
        e?.stopPropagation();
        setIsPreviewOpen(false);
    };

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

    useEffect(() => {
        const maxAudioRecordingTime = DEFAULT_RECORDING_LIMITS.maxAudioRecordingTimeSec * 1000;
        const maxVideoRecordingTime = DEFAULT_RECORDING_LIMITS.maxVideoRecordingTimeSec * 1000;

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

    // Load alert profiles from cloud storage or fallback to default
    useEffect(() => {
        let isMounted = true;
        const fetchAlertProfiles = async () => {
            try {
                const parsed = await FnGetJsonFromStorage("sm/alertprofile/alertprofile.json");
                if (!isMounted) return;

                const profiles = Array.isArray(parsed)
                    ? parsed
                    : Array.isArray((parsed as Record<string, unknown>)?.alertProfiles)
                        ? (parsed as Record<string, unknown>).alertProfiles
                        : Array.isArray((parsed as Record<string, unknown>)?.sampleNotifyAlertProfiles)
                            ? (parsed as Record<string, unknown>).sampleNotifyAlertProfiles
                            : undefined;

                if (profiles && Array.isArray(profiles) && profiles.length > 0) {
                    setAlertProfiles(profiles);
                    return;
                }
            } catch {
                // Ignore storage failure, use default SendMessage alert profile
            }

            if (isMounted) {
                setAlertProfiles(DEFAULT_ALERT_PROFILES);
            }
        };

        void fetchAlertProfiles();

        return () => {
            isMounted = false;
        };
    }, [FnGetJsonFromStorage]);

    // Load severity options from cloud storage or fallback to default
    useEffect(() => {
        let isMounted = true;
        const fetchSeverityOptions = async () => {
            try {
                const parsed = await FnGetJsonFromStorage("sm/ref/refAlertSeverity.json");
                if (!isMounted) return;

                const options = Array.isArray(parsed)
                    ? parsed
                    : Array.isArray((parsed as Record<string, unknown>)?.options)
                        ? (parsed as Record<string, unknown>).options
                        : Array.isArray((parsed as Record<string, unknown>)?.sampleNotifySeverityOptions)
                            ? (parsed as Record<string, unknown>).sampleNotifySeverityOptions
                            : undefined;

                if (options && Array.isArray(options) && options.length > 0) {
                    setOptionData(options);
                    return;
                }
            } catch {
                // Ignore storage failure, use default severity options
            }

            if (isMounted) {
                setOptionData(DEFAULT_SEVERITY_OPTIONS);
            }
        };

        void fetchSeverityOptions();

        return () => {
            isMounted = false;
        };
    }, [FnGetJsonFromStorage]);

    // Load email templates
    useEffect(() => {
        let isMounted = true;
        const fetchProfiles = async () => {
            try {
                const parsed = await FnGetJsonFromStorage("sm/emailtemplates/emailtemplatesprofile.json");
                if (!isMounted) return;

                const templates = unwrapEmailTemplates(parsed);
                if (templates.length > 0) {
                    setEmailTemplates(templates);
                    return;
                }
            } catch (err) {
                console.error("SendEmailToContact: Failed to load emailtemplatesprofile.json", err);
            }

            if (isMounted) {
                setEmailTemplates([]);
            }
        };

        void fetchProfiles();
        return () => {
            isMounted = false;
        };
    }, [FnGetJsonFromStorage]);

    const templateOptions = useMemo<IOptionItem[]>(() => {
        return emailTemplates.map((t) => ({
            label: t.comboLabel,
            value: t.comboLabel,
            tooltip: t.markdown ? `${t.title} – ${t.markdown}` : t.title,
        }));
    }, [emailTemplates]);

    const handleTemplateChange = async (templateComboValue: string) => {
        setSelectedTemplateName(templateComboValue);
        if (!templateComboValue) {
            setHtmlContent("");
            setFormattedHtml("");
            return;
        }

        const parsedTitle = templateComboValue.includes("–")
            ? templateComboValue.split("–")[0].trim()
            : templateComboValue.includes("-")
                ? templateComboValue.split("-")[0].trim()
                : templateComboValue.trim();

        const template = emailTemplates.find(
            (t) => t.comboLabel === templateComboValue || t.title.toLowerCase() === parsedTitle.toLowerCase()
        );
        const fileName = template?.fileName || (parsedTitle.toLowerCase().endsWith(".html") ? parsedTitle : `${parsedTitle}.html`);
        const templatePath = `sm/emailtemplates/${fileName}`;

        setLoadingHtml(true);
        statusBarContext?.setIsLoading?.(true);
        statusBarContext?.setLoadingLabel?.("Loading email template...");
        try {
            const content = await FnGetHtmlFromStorage(templatePath);
            if (content != null) {
                // If datasource is missing then do not try to resolve variables;
                // Otherwise fn will produce value for vars used in email template.
                // Finally resolve #Signature# using PlainEmailSignature.
                const resolvedContent = await FnResolveEmailTemplate(
                    content,
                    template?.dataSource,
                    {
                        authSession,
                        contacts: targetContacts,
                        contact: targetContacts?.[0],
                    }
                );
                setHtmlContent(resolvedContent);
            } else {
                setHtmlContent("<p>Template content not found</p>");
            }
        } catch (err) {
            console.error("SendEmailToContact: Failed to load template file", err);
            setHtmlContent("<p>Failed to load template file</p>");
        } finally {
            setLoadingHtml(false);
            statusBarContext?.setIsLoading?.(false);
            statusBarContext?.setLoadingLabel?.("");
        }
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
        void _AlertProfile;
        void severity;

        if (targetContacts.length === 0) {
            props.handleShowUserMessage?.("No recipient contact selected.");
            return;
        }

        try {
            const alertProfile = alertProfiles?.find(
                (item) => item._AlertProfile === "SendMessage"
            );
            const html = alertProfile?.HTML ?? '<div id="messageContent"></div>';
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            let form = doc.querySelector("#userList");
            if (!form) {
                form = doc.createElement("form");
                form.id = "userList";
                doc.body.appendChild(form);
            }
            targetContacts.forEach((contact, index) => {
                const contactName = String(contact.cname ?? contact.email ?? `Contact ${index + 1}`);
                const extraHTML = `<input type="hidden" name="user${index + 1}" value="${contactName}" />`;
                form!.insertAdjacentHTML("beforeend", extraHTML);
            });

            let msgDiv = doc.querySelector("#messageContent");
            if (!msgDiv) {
                msgDiv = doc.createElement("div");
                msgDiv.id = "messageContent";
                doc.body.appendChild(msgDiv);
            }

            if (selectedTemplateName) {
                msgDiv.innerHTML = messageText;
            } else {
                msgDiv.textContent = messageText;
            }

            const recipientNames = targetContacts.map((c) => c.cname || c.email).filter(Boolean).join(", ");
            setIsConfirmOpen(true);
            setConfirmMessage(`Email sent successfully to ${recipientNames || "contact"}.`);
        } catch (error) {
            console.error("Error sending email to contact:", error);
            props.handleShowUserMessage?.("Something went wrong while sending email.");
        }
    };

    const handleSendMessage = async (message: INote) => {
        if (targetContacts.length === 0) {
            setNoteDetails(message);
            props.handleShowUserMessage?.("Please select a contact to send email.");
            setRefreshToken((prev) => prev + 1);
            return;
        }

        const alertProfile = alertProfiles?.find(
            (item) => item._AlertProfile === "SendMessage"
        );
        if (!alertProfile?.HTML || !alertProfile?.EntID) {
            props.handleShowUserMessage?.("Alert profile record not found to send email.");
            return;
        }

        let fileType: string = "Message";
        if (message.notefile) {
            fileType = "image";
        } else if (message.noteaudio) {
            fileType = "Audio";
        }

        if (!message.notefile && !message.notevideo && !message.noteaudio) {
            await handleApiForMessageSending(
                alertProfile.EntID,
                message.notecontent,
                alertProfile._AlertProfile
            );
        } else {
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

    const handleSendHtmlMessage = async () => {
        if (targetContacts.length === 0) {
            props.handleShowUserMessage?.("Please select a contact to send email.");
            return;
        }
        if (!htmlContent.trim()) {
            props.handleShowUserMessage?.("Please enter message content before sending.");
            return;
        }

        const alertProfile = alertProfiles?.find(
            (item) => item._AlertProfile === "SendMessage"
        );
        if (!alertProfile?.HTML || !alertProfile?.EntID) {
            props.handleShowUserMessage?.("Alert profile record not found to send email.");
            return;
        }

        const allBusinesses: IBusinessDoc[] = smDataContext?.datasets?.businesses ?? [];

        const primaryBid = primaryContact?.bid || "";
        const matchedBusiness = allBusinesses.find(
            (b) => b.bid === primaryBid || (b as any).EntID === primaryBid
        );

        const variablesArray: Array<Record<string, unknown>> = [
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
            },
            {
                key: "CONTACT_INFO",
                cid: primaryContact?.cid ?? "",
                contactid: primaryContact?.cid ?? "",
                cname: targetContacts.map((c) => c.cname).filter(Boolean).join(", "),
                name: targetContacts.map((c) => c.cname).filter(Boolean).join(", "),
                contactname: targetContacts.map((c) => c.cname).filter(Boolean).join(", "),
                fullname: targetContacts.map((c) => c.cname).filter(Boolean).join(", "),
                email: targetContacts.map((c) => c.email).filter(Boolean).join(", "),
                contactemail: targetContacts.map((c) => c.email).filter(Boolean).join(", "),
                phone: primaryContact?.phone ?? "",
                phonenumber: primaryContact?.phone ?? "",
                address1: primaryContact?.address1 ?? "",
                city: primaryContact?.city ?? "",
                state: primaryContact?.state ?? "",
                country: primaryContact?.country ?? "",
                zip: primaryContact?.zip ?? "",
                status: primaryContact?.status ?? "",
            },
            {
                key: "GENERAL_INFO",
                date: new Date().toLocaleDateString(),
                currentdate: new Date().toLocaleDateString(),
                today: new Date().toLocaleDateString(),
                year: String(new Date().getFullYear()),
                severity,
            },
        ];

        const resolvedHtml = FnResolvedHtmlVariable(htmlContent, variablesArray);
        setHtmlContent(resolvedHtml);

        await handleApiForMessageSending(
            alertProfile.EntID,
            resolvedHtml,
            alertProfile._AlertProfile
        );
    };

    const handleOkButtonClick = () => {
        setIsConfirmOpen(false);
        const maxAudioRecordingTime = DEFAULT_RECORDING_LIMITS.maxAudioRecordingTimeSec * 1000;
        const maxVideoRecordingTime = DEFAULT_RECORDING_LIMITS.maxVideoRecordingTimeSec * 1000;
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
        setHtmlContent("");
        setFormattedHtml("");
        setSelectedTemplateName("");
        props.onClose?.();
    };

    const content = (
        <div
            className="nz-send-email-contact-container"
            key={props.uniqueName || "send-email-contact"}
        >
            {/* Header */}
            <div className="nz-sub-header nz-send-email-header">
                <div className="nz-send-email-header-title">
                    <Label
                        uniqueName={`${props.uniqueName || "send-email"}-header-lbl`}
                        label={props.headerText ?? (primaryContact ? `Send Email: ${primaryContact.cname || primaryContact.email}` : "Send Email")}
                    />
                </div>
                <div className="nz-send-email-header-actions">
                    <button
                        type="button"
                        onClick={openModal}
                        disabled={!htmlContent.trim()}
                        className="nz-send-email-preview-btn"
                        style={{
                            background: htmlContent.trim() ? "#0070f3" : "#a0aec0",
                            color: "white",
                        }}
                    >
                        Preview
                    </button>
                    {props.isOpen && props.onClose && (
                        <button
                            type="button"
                            className="nz-send-email-close-btn"
                            title="Close"
                            onClick={props.onClose}
                        >
                            <Close24x24 size="16px" fill="none" strokeWidth={1} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div className="nz-send-email-content">
                {/* Contact Recipient Info */}
                {primaryContact && (
                    <div className="nz-send-email-recipient-badge">
                        <User24x24 size="16px" fill="none" strokeWidth={1} />
                        <span>
                            To: <strong>{primaryContact.cname || "Contact"}</strong>
                            {primaryContact.email ? ` (${primaryContact.email})` : " (No email address specified)"}
                        </span>
                    </div>
                )}


                {/* Combobox Controls */}
                <div className="nz-send-email-combobox-row">
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
                                setSeverity(value?.toString() ?? "Critical");
                            }}
                        />
                    </div>
                </div>

                {/* Message Box / HTML Preview Area */}
                <div className="nz-send-email-messagebox">
                    {!selectedTemplateName ? (
                        noteDetails && (
                            <Notes
                                {...noteDetails}
                                key={refreshToken}
                                allowAudio={false}
                                allowVideo={false}
                                sendTooltip={"Send email"}
                                handleDelete={() => { }}
                                sendNote={handleSendMessage}
                                placeholderMessage="Enter an email message here..."
                            />
                        )
                    ) : (
                        <div className="nz-html-editor-container nz-w-100 nz-h-100" style={{ display: "flex", flexDirection: "column" }}>
                            {loadingHtml ? (
                                <div className="nz-html-editor-loading">Loading template...</div>
                            ) : (
                                <>
                                    <div className="nz-html-editor-body" style={{ flex: 1, overflow: "auto" }}>
                                        {formattedHtml ? (
                                            <Highlight theme={themes.vsDark} code={formattedHtml} language="html">
                                                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                                                    <pre
                                                        className={className}
                                                        style={{
                                                            ...style,
                                                            padding: "16px",
                                                            borderRadius: "8px",
                                                            overflowX: "auto",
                                                            fontSize: "13px",
                                                            lineHeight: "1.5",
                                                            margin: 0,
                                                            minHeight: "100%",
                                                            boxSizing: "border-box",
                                                        }}
                                                    >
                                                        {tokens.map((line, i) => (
                                                            <div key={i} {...getLineProps({ line })}>
                                                                <span style={{ display: "inline-block", width: "25px", opacity: 0.4, userSelect: "none" }}>
                                                                    {i + 1}
                                                                </span>
                                                                {line.map((token, key) => (
                                                                    <span key={key} {...getTokenProps({ token })} />
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </pre>
                                                )}
                                            </Highlight>
                                        ) : (
                                            <p style={{ padding: "10px", color: "var(--textsecondary, #777)" }}>
                                                Formatting code...
                                            </p>
                                        )}
                                    </div>
                                    <div className="nz-html-editor-action-strip">
                                        <button
                                            type="button"
                                            className="libavnotes-button libavnotes-button-success libavnotes-send-button nz-html-send-btn"
                                            title="Send email"
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
            </div>

            {/* Confirmation Alert */}
            <YesNoFormContainer
                isOpen={isConfirmOpen}
                uniqueName={`${props.uniqueName || "send-email"}-confirm-ok`}
                message={confirmMessage ?? ""}
                showOkButton={true}
                handleOkButtonClick={handleOkButtonClick}
                handleYesButtonClick={() => { }}
                handleNoButtonClick={() => { }}
            />

            {/* HTML Preview Modal */}
            <Dialog
                open={isPreviewOpen}
                onClose={(e: any) => {
                    if (e?.stopPropagation) {
                        e.stopPropagation();
                    }
                    closeModal(e);
                }}
                maxWidth="md"
                fullWidth
                sx={{
                    zIndex: 1400,
                    "& .MuiDialog-paper": {
                        borderRadius: "8px",
                        padding: "24px",
                        backgroundColor: "var(--bgfeaturepane1, #ffffff)",
                        color: "var(--textprimary, #333)",
                        boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
                        maxWidth: "650px",
                        width: "90%",
                    },
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "15px" }}>
                    <h4 style={{ margin: 0 }}>Live HTML Preview</h4>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            closeModal(e);
                        }}
                        style={{
                            background: "none",
                            border: "none",
                            fontSize: "16px",
                            cursor: "pointer",
                            color: "var(--textprimary, #333)",
                            padding: "4px 8px",
                        }}
                    >
                        ✕
                    </button>
                </div>
                <div style={{ padding: "10px", background: "#fafafa", borderRadius: "6px", border: "1px solid #eaeaea", maxHeight: "70vh", overflow: "auto" }}>
                    {formattedHtml ? parse(formattedHtml) : htmlContent ? parse(htmlContent) : null}
                </div>
            </Dialog>
        </div>
    );

    if (props.isOpen !== undefined) {
        return (
            <Dialog
                open={props.isOpen}
                onClose={(_event, _reason) => {
                    if (isPreviewOpen) {
                        return;
                    }
                    props.onClose?.();
                }}
                maxWidth="md"
                fullWidth
                className="nz-send-email-dialog"
            >
                {content}
            </Dialog>
        );
    }

    return content;
};

export { SendEmailToContact };
export default SendEmailToContact;
