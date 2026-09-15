import { useEffect, useState } from "react";
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
import { ComboBoxControl, IOptionItem } from "@n20a/libform";
import { TreeExplorerContainer } from "../../../shared/treeexplorercontainer/TreeExplorerContainer";
import type { TNodeCheckState } from "../../../shared/treeexplorercontainer/ITreeExplorerContainer";
import type { ITreeNode } from "../../../shared/allinterface/tree/ITreeControl";
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

const AppqaNotify = (appqaMessageProps: IAppqaNotify) => {
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
        // SAMPLE DATA: ALERT.CreateAlertMessage / ALERT.AddToAlertQueue commented out.
        // axiosInterceptor({ url: ALERT.CreateAlertMessage, ... });
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
            msgDiv.textContent = messageText;

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

            // SAMPLE DATA: FS.UploadFileStream API commented out.
            // axiosInterceptor({ url: FS.UploadFileStream, ... }, statusBarContext);
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
                    <div className="nz-w-100 nz-h-100 nz-messagebox-container">
                        {noteDetails && (
                            <Notes
                                {...noteDetails}
                                key={refreshToken}
                                allowAudio={false}
                                allowVideo={false}
                                sendTooltip={"Send notification"}
                                handleDelete={handleDeleteNotes}
                                sendNote={handleSendMessage}
                            />
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
