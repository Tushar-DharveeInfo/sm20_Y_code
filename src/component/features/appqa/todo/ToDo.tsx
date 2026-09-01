import { useCallback, useMemo, useState } from "react";
import { Notes } from "@n20a/libavnotes";
import type { INote } from "@n20a/libavnotes";
import "@n20a/libavnotes/style.css";
import { Delete24x24, Info24x24 } from "@n20a/libicon";
import { FnGetCssVariable } from "../../../appcontainer/allcommon/FnGetCssVariable";
import { handleContainerKeyDown } from "../../../shared/allcommon/basic/FnHandleContainerKeyDown";
import { IImage } from "../../../shared/allinterface/basic/IImage";
import type { ITodoDoc } from "../../../shared/allinterface/IDatasets";
import { ActionImage } from "../../../shared/basic/actionimage/ActionImage";
import { Label } from "../../../shared/basic/label/Label";
import { Image } from "../../../shared/basic/image/Image";
import { YesNoFormContainer } from "../../../shared/basic/yesnoformcontainer/YesNoFormContainer";
import todoSampleData from "../../../../smsampledata/datasets/todo.json";
import "../../../shared/sidebar/notes/FqaNotes.css";
import "./ToDo.css";

interface IAppqaToDo {
    uniqueName: string;
    featureId?: string;
}

const sampleTodos: ITodoDoc[] = Array.isArray(todoSampleData)
    ? (todoSampleData as ITodoDoc[])
    : [];

const AppqaToDo = (appqaToDoProps: IAppqaToDo) => {
    const [todos, setTodos] = useState<ITodoDoc[]>(sampleTodos);
    const [selectedItem, setSelectedItem] = useState<ITodoDoc | null>(null);
    const [deleteItem, setDeleteItem] = useState<ITodoDoc | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [notesKey, setNotesKey] = useState(0);

    const sendTodo = useCallback((message: INote) => {
        const content = String(message.notecontent ?? "").trim();
        if (!content) {
            return;
        }
        if (selectedItem) {
            setTodos((items) =>
                items.map((item) =>
                    item === selectedItem ? { ...item, whattodo: content } : item
                )
            );
            setSelectedItem((prev) => (prev ? { ...prev, whattodo: content } : null));
            return;
        }
        const nextTodo: ITodoDoc = {
            bid: "",
            cid: "",
            btype: "",
            status: "Open",
            whattodo: content,
        };
        setTodos((items) => [nextTodo, ...items]);
        setNotesKey((prev) => prev + 1);
    }, [selectedItem]);

    const handleSelectTodo = (item: ITodoDoc) => {
        setSelectedItem((prev) => (prev === item ? null : item));
        setNotesKey((prev) => prev + 1);
    };

    const noteDetails = useMemo<INote>(() => ({
        maxAudioRecordingTime: 0,
        maxVideoRecordingTime: 0,
        noteId: selectedItem ? `${selectedItem.bid}-${selectedItem.cid}` : "todo-note",
        noteTitle: selectedItem?.status ?? "",
        notecontent: selectedItem?.whattodo ?? "",
        notefile: undefined,
        noteaudio: undefined,
        notevideo: undefined,
        noteCreatedAt: new Date(),
        sendNote: sendTodo,
        allowAudio: false,
        allowVideo: false,
    }), [selectedItem, sendTodo]);

    const deleteImage: IImage = {
        uniqueName: "todo-delete-icon",
        source: (
            <Delete24x24
                size={FnGetCssVariable("--image-size-2")}
                fill="none"
                strokeWidth={1}
            />
        ),
        w: "var(--image-size-2)",
        type: "svg",
        tooltip: "Click to Delete",
    };

    const handleDelete = (item: ITodoDoc) => {
        setDeleteItem(item);
        setDeleteOpen(true);
    };

    return (
        <div
            className="nz-node-list-Container nz-appqa-todo"
            tabIndex={1}
            onKeyDown={handleContainerKeyDown}
            key={appqaToDoProps.uniqueName}
        >
            <div className="nz-notes-list-main-div">
                <div className="nz-notes-list-with-msg-box">
                    <div className="nz-sub-header">
                        <Label
                            uniqueName={`${appqaToDoProps.uniqueName}-header`}
                            label={`ToDo${todos.length > 0 ? ` (${todos.length})` : ""}`}
                        />
                    </div>
                    <div className="nz-notes-list-scroll">
                        {todos.map((item, index) => {
                            const todoKey = `${item.bid}-${item.cid}-${index}`;
                            const message = item.whattodo ?? "";
                            const isSelected = selectedItem === item;
                            return (
                                <div
                                    className={`nz-node-list-box${isSelected ? " nz-node-list-box-selected" : ""}`}
                                    key={todoKey}
                                    onClick={() => handleSelectTodo(item)}
                                >
                                    <div className="nz-node-list-delete">
                                        <div
                                            onClick={(event) => event.stopPropagation()}
                                            onKeyDown={(event) => event.stopPropagation()}
                                        >
                                            <ActionImage
                                                image={deleteImage}
                                                w={"var(--node_height)"}
                                                h={"var(--node_height)"}
                                                uniqueName={`${appqaToDoProps.uniqueName}-delete-${index}`}
                                                actionCode={"delete"}
                                                disabled={false}
                                                handleMouse={() => handleDelete(item)}
                                            />
                                        </div>
                                        <div className="nz-note-date">
                                            <Label
                                                uniqueName={`${appqaToDoProps.uniqueName}-status-${index}`}
                                                label={item.status || ""}
                                            />
                                        </div>
                                        <div className="nz-note-user">
                                            <Label
                                                uniqueName={`${appqaToDoProps.uniqueName}-type-${index}`}
                                                label={[item.btype, item.bid, item.cid].filter(Boolean).join(" · ")}
                                            />
                                        </div>
                                    </div>
                                    <div className="nz-info-div">
                                        <div className="nz-info-image">
                                            <Image
                                                uniqueName={`${appqaToDoProps.uniqueName}-info-${index}`}
                                                source={
                                                    <Info24x24
                                                        size={FnGetCssVariable("--image-size-1")}
                                                        fill="none"
                                                        strokeWidth={1}
                                                    />
                                                }
                                                w={"var(--image-size-2)"}
                                                tooltip="Info"
                                            />
                                        </div>
                                        <div className="nz-nodes-text">
                                            <Label
                                                uniqueName={`${appqaToDoProps.uniqueName}-text-${index}`}
                                                label={message}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="nz-notes-container">
                        <Notes
                            key={`${notesKey}-${selectedItem?.bid ?? "new"}-${selectedItem?.cid ?? ""}`}
                            {...noteDetails}
                            allowAudio={false}
                            allowVideo={false}
                            sendTooltip={selectedItem ? "Update To Do" : "Send To Do"}
                            sendNote={sendTodo}
                            handleDelete={() => undefined}
                        />
                    </div>
                </div>
            </div>
            <YesNoFormContainer
                isOpen={deleteOpen}
                uniqueName={`${appqaToDoProps.uniqueName}-delete`}
                message="Are you sure you want to delete this to-do?"
                showOkButton={false}
                handleYesButtonClick={() => {
                    if (deleteItem) {
                        if (selectedItem === deleteItem) {
                            setSelectedItem(null);
                            setNotesKey((prev) => prev + 1);
                        }
                        setTodos((items) => items.filter((item) => item !== deleteItem));
                    }
                    setDeleteOpen(false);
                    setDeleteItem(null);
                }}
                handleNoButtonClick={() => {
                    setDeleteOpen(false);
                    setDeleteItem(null);
                }}
            />
        </div>
    );
};

export { AppqaToDo };
export default AppqaToDo;
