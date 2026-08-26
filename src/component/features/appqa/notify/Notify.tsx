import { useEffect, useState } from "react";
import { handleContainerKeyDown } from "../../../shared/allcommon/basic/FnHandleContainerKeyDown";
import { Splitter, SplitterPanel } from "primereact/splitter";
import { INote, Notes } from "@n20a/libavnotes";
import "@n20a/libavnotes/style.css";
import { Check, User24x24 } from "@n20a/libicon";
import "./Notify.css";
import { IListItem } from "../../../shared/allinterface/basic/ICheckedListPanel";
import { YesNoFormContainer } from "../../../shared/basic/yesnoformcontainer/YesNoFormContainer";
import { Label } from "../../../shared/basic/label/Label";
import { FnConvertBase64Blob } from "../../../shared/allcommon/sidebar/FnConvertBase64Blob";
import { FnGenerateUID } from "../../../shared/allcommon/settingsform/FnGenerateUID";
import { ComboBoxControl, IOptionItem } from "@n20a/libform";
import { FnGetCssVariable } from "../../../appcontainer/allcommon/FnGetCssVariable";
import { CardLayout } from "../../../shared/cardlayout/CardLayout";
import { ICardLayoutField } from "../../../shared/cardlayout/CardLayout";
import { Image } from "../../../shared/basic/image/Image";
import { FnIsTruthyFlag } from "../../../shared/allcommon/FnIsTruthyFlag";
import { FnGetAddressDisplay, FnGetDisplayValue } from "../allcommon/FnGetAddressDisplay";
import notifySampleData from "../../../../smsampledata/appqa/NotifySampleData.json";

const {
    sampleNotifyAlertProfiles,
    sampleNotifyRecordingLimits,
    sampleNotifySeverityOptions,
    sampleNotifyUsersRaw,
} = notifySampleData as {
    sampleNotifyAlertProfiles: any[];
    sampleNotifyRecordingLimits: { maxAudioRecordingTimeSec: number; maxVideoRecordingTimeSec: number };
    sampleNotifySeverityOptions: IOptionItem[];
    sampleNotifyUsersRaw: IListItem[];
};
interface IAppqaNotify {
    uniqueName: string;
    headerText: string;
    handleShowUserMessage?: (messageText: string) => void;
}
const parseJsonValue = (value: unknown): unknown => {
    if (typeof value !== "string") {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const isUserListRecord = (value: unknown): value is IListItem => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const record = value as Record<string, unknown>;
    return Boolean(
        record.EntID
        || record._User
        || record.LoginUser
        || record.ContactName
        || record.Email
    );
};

const findUsersArray = (value: unknown): IListItem[] => {
    try {
        const parsedValue = parseJsonValue(value);

        if (Array.isArray(parsedValue)) {
            if (parsedValue.some((item) => item && typeof item === "object" && "UserName" in item)) {
                return (parsedValue as IListItem[])
                    .filter((user) => user.Enabled === true)
                    .sort((a, b) =>
                        (String(a.UserName ?? "").trim()).localeCompare(
                            String(b.UserName ?? "").trim(),
                            undefined,
                            { sensitivity: "base" }
                        )
                    );
            }

            for (const item of parsedValue) {
                const childArray = findUsersArray(item);
                if (childArray.length) {
                    return childArray;
                }
            }
        }

        if (parsedValue && typeof parsedValue === "object") {
            const objectValue = parsedValue as Record<string, unknown>;

            for (const key of Object.keys(objectValue)) {
                const childArray = findUsersArray(objectValue[key]);
                if (childArray.length) {
                    return childArray;
                }
            }
        }
    } catch (error) {
        console.error("Error while finding users array:", error);
    }

    return [];
};

const makeUserName = (userName: string, role?: string) => {
    if (role?.length) {
        return `${userName} (${role})`;
    }
    return userName;
};

/*Builds CardLayout name/value rows from a user list item. */
const buildUserCardFields = (
    item: IListItem,
    userName: string,
    basicRole: string,
    description: string,
    contactName: string,
    email: string,
    emailOptin: string,
    phone: string,
    address: string,
    _IsAuthorized: string,
    phoneType: string
): ICardLayoutField[] => {
    const fields: ICardLayoutField[] = [
        {
            Name: "Username",
            Value: makeUserName(userName, basicRole) || "—",
            Header: 1,
        },
    ];
    if (item.Enabled) {
        fields.push({
            Name: "",
            Value: "",
            Header: 2,
            ValueContent: (
                <Image
                    uniqueName={"Enabled"}
                    source={<Check />}
                    tooltip="Enabled"
                    w={"var(--image-size-1)"}
                />
            ),
        });
    }
    if (description) {
        fields.push({ Name: "Description", Value: description });
    }
    if (email) {
        fields.push({
            Name: "Email",
            Value: email,
            Group: "email-row",
            Row: "inline",
        });
        fields.push({
            Name: "OptIn",
            Value: FnIsTruthyFlag(emailOptin) ? "✓" : "X",
            Group: "email-row",
            Row: "inline",
        });
    }
    if (contactName || phone) {
        if (contactName) {
            fields.push({
                Name: "Contact",
                Value: contactName,
                Group: "contact-row",
                Row: "inline",
            });
        }
        if (phone) {
            fields.push({
                Name: "Phone",
                Value: `${phone} (${phoneType})`,
                Group: "contact-row",
                Row: "inline",
            });
        }
    }
    if (address) {
        fields.push({ Name: "Address", Value: address, Row: "inline" });
    }

    return fields;
};

const mapUsersFromSample = (userData: IListItem[]): IListItem[] =>
    userData.map((element) => ({
        ...element,
        label: String(
            element.Shortname
            ?? element.LoginUser
            ?? element.label
            ?? ""
        ),
        id: String(element.EntID ?? element.id ?? ""),
        checked: false,
        selected: false,
    }));

const AppqaNotify = (appqaMessageProps: IAppqaNotify) => {
    const [userList, setUserList] = useState<IListItem[]>([]);
    const [checkedUserList, setCheckedUserList] = useState<IListItem[]>();
    const [severity, setSeverity] = useState<string>("Critical");
    const [alertProfiles, setAlertProfiles] = useState<any[]>();
    const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
    const [confirmMessage, setConfirmMessage] = useState<string>();
    const [noteDetails, setNoteDetails] = useState<INote>();
    const [optionData, setOptionData] = useState<IOptionItem[]>();
    const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
    const [refreshToken, setRefreshToken] = useState(0);
    const [maxRecordingTime, setMaxRecordingTime] = useState<{
        maxAudioRecordingTime: number;
        maxVideoRecordingTime: number;
    }>();

    const syncCheckedUsers = (users: IListItem[]) => {
        setCheckedUserList(users.filter((item) => item.checked));
    };

    const handleUserCheckedChange = (checked: boolean, userId: string) => {
        setUserList((current) => {
            const updated = current.map((user) =>
                user.id === userId ? { ...user, checked } : user
            );
            syncCheckedUsers(updated);
            return updated;
        });
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

    useEffect(() => {
        // SAMPLE DATA: AUTH.GetUsers API commented out.
        // axiosInterceptor({ url: AUTH.GetUsers, ... }, statusBarContext);
        setIsLoadingUsers(true);
        try {
            const userData = findUsersArray(sampleNotifyUsersRaw);
            if (userData.length > 0) {
                const users = mapUsersFromSample(userData);
                setUserList(users);
                setCheckedUserList([]);
            } else {
                setUserList([]);
                setCheckedUserList([]);
                appqaMessageProps.handleShowUserMessage?.("User list not found.");
            }
        } catch {
            setUserList([]);
            setCheckedUserList([]);
            appqaMessageProps.handleShowUserMessage?.("Failed to load users.");
        } finally {
            setIsLoadingUsers(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only static load
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

        if (!checkedUserList?.length) {
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
            checkedUserList.forEach((user, index) => {
                const extraHTML = `<input type="hidden" name="user${index + 1}" value="${user.label}" />`;
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
        if (!checkedUserList?.length) {
            setNoteDetails(message);
            appqaMessageProps.handleShowUserMessage?.(
                "Please! Select users to send message"
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
        const users = userList.map((element) => ({
            ...element,
            label: String(element._User ?? element.label ?? ""),
            id: String(element.EntID ?? element.id ?? ""),
            checked: false,
            selected: false,
        }));
        setUserList(users);
        setCheckedUserList([]);
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
                    size={75}
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
                    size={25}
                    minSize={20}
                    className={`nz-d-flex-column nz-justify-center nz-appqa-notify-right-pane nz-pane-2`}
                >
                    <div className="nz-message-user-card-list">
                        <div className="nz-sub-header">
                            <Label
                                uniqueName={`${appqaMessageProps.uniqueName}-user-header`}
                                label="Select users to receive message"
                                fontWeight="bold"
                            />
                        </div>
                        <div className="nz-message-user-card-scroll">
                            {isLoadingUsers ? (
                                <div className="nz-message-user-card-status">
                                    Loading…
                                </div>
                            ) : userList.length ? (
                                userList.map((item, index) => {
                                    const userRecord = item as Record<
                                        string,
                                        unknown
                                    >;
                                    const userName = FnGetDisplayValue(
                                        userRecord,
                                        ["UserName", "label"]
                                    );
                                    const IsAuthorized = item?.IsAuthorized
                                        ? "true"
                                        : "false";
                                    const basicRole = FnGetDisplayValue(
                                        userRecord,
                                        ["Role", "RoleName"]
                                    );
                                    const description = FnGetDisplayValue(
                                        userRecord,
                                        ["Desc250", "Description"]
                                    );
                                    const contactName = FnGetDisplayValue(
                                        userRecord,
                                        ["FullName", "ContactName"]
                                    );
                                    const email = FnGetDisplayValue(
                                        userRecord,
                                        ["Email"]
                                    );
                                    const emailOptin = FnGetDisplayValue(
                                        userRecord,
                                        ["EmailOptin"]
                                    );
                                    const phone = FnGetDisplayValue(
                                        userRecord,
                                        ["Phone", "Mobile"]
                                    );
                                    const address =
                                        FnGetAddressDisplay(userRecord);
                                    const phonetype = FnGetDisplayValue(
                                        userRecord,
                                        ["PhoneType"]
                                    );
                                    const cardFields = buildUserCardFields(
                                        item,
                                        userName,
                                        basicRole,
                                        description,
                                        contactName,
                                        email,
                                        emailOptin,
                                        phone,
                                        address,
                                        IsAuthorized,
                                        phonetype
                                    );
                                    return (
                                        <CardLayout
                                            key={`${appqaMessageProps.uniqueName}-user-${item.id}`}
                                            uniqueName={`${appqaMessageProps.uniqueName}-user-card-${index}`}
                                            className="nz-message-user-card-main"
                                            data={item}
                                            fields={cardFields}
                                            showCheckboxInHeader
                                            checkboxName={`${appqaMessageProps.uniqueName}-user-check-${item.id}`}
                                            checkboxValue={!!item.checked}
                                            onCheckboxChange={(checked) =>
                                                handleUserCheckedChange(
                                                    checked,
                                                    item.id
                                                )
                                            }
                                            hideRightMouseMenu
                                            ContentImage={{
                                                uniqueName: `${appqaMessageProps.uniqueName}-user-image-${index}`,
                                                source: (
                                                    <User24x24
                                                        size={FnGetCssVariable(
                                                            "--image-size-2"
                                                        )}
                                                        fill="none"
                                                        strokeWidth={1}
                                                    />
                                                ),
                                                w: "var(--image-size-2)",
                                                tooltip: "User",
                                                type: "svg",
                                            }}
                                        />
                                    );
                                })
                            ) : (
                                <div className="nz-message-user-card-status">
                                    No Data Found
                                </div>
                            )}
                        </div>
                    </div>
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
