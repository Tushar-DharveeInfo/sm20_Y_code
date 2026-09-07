import { useCallback, useEffect, useMemo, useState } from "react";
import { Notes } from "@n20a/libavnotes";
import type { INote } from "@n20a/libavnotes";
import "@n20a/libavnotes/style.css";
import { Delete24x24, Info24x24 } from "@n20a/libicon";
import { FnGetCssVariable } from "../../../appcontainer/allcommon/FnGetCssVariable";
import { handleContainerKeyDown } from "../../../shared/allcommon/basic/FnHandleContainerKeyDown";
import { IImage } from "../../../shared/allinterface/basic/IImage";
import { ActionImage } from "../../../shared/basic/actionimage/ActionImage";
import { Label } from "../../../shared/basic/label/Label";
import { Image } from "../../../shared/basic/image/Image";
import { YesNoFormContainer } from "../../../shared/basic/yesnoformcontainer/YesNoFormContainer";
import { useMainAppContext } from "../../../shared/context/hooks/MainAppHooks";
import "../../../shared/sidebar/notes/FqaNotes.css";
import "./ToDo.css";
import { useTodos } from "@n20a/libfsdb";
import type { ITodoDoc } from "@n20a/libfsdb";

interface IToDo {
    uniqueName: string;
    featureId?: string;
}

interface ITodoItem extends ITodoDoc {
    id?: string;
}

function mapToTodoItem(record: Record<string, unknown>, index: number): ITodoItem {
    const docId = String(record.id || record.todoid || record.docId || `todo_${index}`);
    return {
        id: docId,
        bid: String(record.bid ?? ""),
        cid: String(record.cid ?? ""),
        btype: String(record.btype ?? ""),
        status: String(record.status ?? "Open"),
        whattodo: String(record.whattodo ?? record.title ?? record.message ?? ""),
        duedate: String(record.duedate ?? ""),
        addedby: String(record.addedby ?? ""),
        filename: record.filename ? String(record.filename) : undefined,
    };
}

const ToDo = (todoProps: IToDo) => {
    const mainAppContext = useMainAppContext();
    const userInfo = mainAppContext.userInfoAndSubscription?.userInfo;
    const { loading, error, getTodos, todos, createTodo, updateTodo, deleteTodo } = useTodos();

    const [todoItems, setTodoItems] = useState<ITodoItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<ITodoItem | null>(null);
    const [deleteItem, setDeleteItem] = useState<ITodoItem | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [notesKey, setNotesKey] = useState(0);

    useEffect(() => {
        void getTodos();
    }, [getTodos]);

    useEffect(() => {
        if (Array.isArray(todos)) {
            const mapped = todos.map(mapToTodoItem);
            setTodoItems(mapped);
        } else if (todos === null) {
            setTodoItems([]);
        }
    }, [todos]);

    const sendTodo = useCallback(async (message: INote) => {
        const content = String(message.notecontent ?? "").trim();
        if (!content) {
            return;
        }

        const userBid = String(userInfo?.bid ?? "").trim();
        const userCid = String(userInfo?.cid ?? "").trim();
        const userShortName = String(userInfo?.username ?? userInfo?.email ?? "User").trim();

        if (selectedItem) {
            const todoId = selectedItem.id;
            const updatedDoc: Record<string, unknown> = {
                bid: selectedItem.bid || userBid,
                cid: selectedItem.cid || userCid,
                btype: selectedItem.btype || "Standard",
                status: selectedItem.status || "Open",
                whattodo: content,
                duedate: selectedItem.duedate || "",
                addedby: selectedItem.addedby || userShortName,
            };
            if (selectedItem.filename) {
                updatedDoc.filename = selectedItem.filename;
            }

            try {
                if (todoId) {
                    await updateTodo(todoId, updatedDoc);
                }
                await getTodos();
            } catch (err) {
                console.error("Error updating todo:", err);
            }

            setSelectedItem(null);
            setNotesKey((prev) => prev + 1);
            return;
        }

        const newTodoDoc: Record<string, unknown> = {
            bid: userBid,
            cid: userCid,
            btype: "Standard",
            status: "Open",
            whattodo: content,
            duedate: "",
            addedby: userShortName,
        };

        try {
            await createTodo(newTodoDoc);
            await getTodos();
        } catch (err) {
            console.error("Error creating todo:", err);
        }

        setNotesKey((prev) => prev + 1);
    }, [selectedItem, userInfo, createTodo, updateTodo, getTodos]);

    const handleSelectTodo = (item: ITodoItem) => {
        setSelectedItem((prev) => (prev === item ? null : item));
        setNotesKey((prev) => prev + 1);
    };

    const noteDetails = useMemo<INote>(() => ({
        maxAudioRecordingTime: 0,
        maxVideoRecordingTime: 0,
        noteId: selectedItem?.id ? selectedItem.id : "todo-note",
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

    const handleDelete = (item: ITodoItem) => {
        setDeleteItem(item);
        setDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (deleteItem) {
            if (selectedItem === deleteItem) {
                setSelectedItem(null);
                setNotesKey((prev) => prev + 1);
            }

            const todoId = deleteItem.id;
            try {
                if (todoId) {
                    await deleteTodo(todoId);
                }
                await getTodos();
            } catch (err) {
                console.error("Error deleting todo:", err);
            }
        }
        setDeleteOpen(false);
        setDeleteItem(null);
    };

    return (
        <div
            className="nz-node-list-Container nz-appqa-todo"
            tabIndex={1}
            onKeyDown={handleContainerKeyDown}
            key={todoProps.uniqueName}
        >
            <div className="nz-notes-list-main-div">
                <div className="nz-notes-list-with-msg-box">
                    <div className="nz-sub-header">
                        <Label
                            uniqueName={`${todoProps.uniqueName}-header`}
                            label={`ToDo${todoItems.length > 0 ? ` (${todoItems.length})` : ""}`}
                        />
                    </div>
                    <div className="nz-notes-list-scroll">
                        {loading && (
                            <div className="nz-notes-loading" style={{ padding: "10px", textAlign: "center" }}>
                                <Label uniqueName="todo-loading" label="Loading todos..." />
                            </div>
                        )}
                        {error && (
                            <div className="nz-notes-error" style={{ padding: "10px", color: "var(--danger, #ff4d4f)" }}>
                                <Label uniqueName="todo-error" label={typeof error === "string" ? error : "Failed to load todos"} />
                            </div>
                        )}
                        {!loading && !error && todoItems.length === 0 && (
                            <div className="nz-notes-empty" style={{ padding: "10px", textAlign: "center", opacity: 0.7 }}>
                                <Label uniqueName="todo-empty" label="No to-do items found" />
                            </div>
                        )}
                        {todoItems.map((item, index) => {
                            const todoKey = item.id ? item.id : `${item.bid}-${item.cid}-${index}`;
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
                                                uniqueName={`${todoProps.uniqueName}-delete-${index}`}
                                                actionCode={"delete"}
                                                disabled={false}
                                                handleMouse={() => handleDelete(item)}
                                            />
                                        </div>
                                        <div className="nz-note-date">
                                            <Label
                                                uniqueName={`${todoProps.uniqueName}-status-${index}`}
                                                label={item.status || ""}
                                            />
                                        </div>
                                        <div className="nz-note-user">
                                            <Label
                                                uniqueName={`${todoProps.uniqueName}-type-${index}`}
                                                label={[item.btype, item.bid, item.cid].filter(Boolean).join(" · ")}
                                            />
                                        </div>
                                    </div>
                                    <div className="nz-info-div">
                                        <div className="nz-info-image">
                                            <Image
                                                uniqueName={`${todoProps.uniqueName}-info-${index}`}
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
                                                uniqueName={`${todoProps.uniqueName}-text-${index}`}
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
                            key={`${notesKey}-${selectedItem?.id ?? "new"}`}
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
                uniqueName={`${todoProps.uniqueName}-delete`}
                message="Are you sure you want to delete this to-do?"
                showOkButton={false}
                handleYesButtonClick={handleConfirmDelete}
                handleNoButtonClick={() => {
                    setDeleteOpen(false);
                    setDeleteItem(null);
                }}
            />
        </div>
    );
};

export { ToDo, ToDo as AppqaToDo };
export default ToDo;
