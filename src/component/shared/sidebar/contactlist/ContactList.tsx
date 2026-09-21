import { useState, useMemo, useEffect } from "react";
import { User24x24 } from "@n20a/libicon";
import { EditTextXControl } from "@n20a/libform";
import { FnGetCssVariable } from "../../../appcontainer/allcommon/FnGetCssVariable";
import { handleNestedZoneContainerKeyDown } from "../../allcommon/basic/FnHandleContainerKeyDown";
import { Label } from "../../basic/label/Label";
import { CardLayout } from "../../cardlayout/CardLayout";
import { ICardLayoutField } from "../../cardlayout/CardLayout";
import type { IContactDoc } from "../../allinterface/IDatasets";
import { useSmDataContext } from "../../context/hooks/SmDataHooks";
import { useCommonVariableContext } from "../../context/hooks/CommonVariableHooks";
import { YesNoFormContainer } from "../../basic/yesnoformcontainer/YesNoFormContainer";
import "./ContactList.css";
import { ITreeNode } from "../../allinterface/tree/ITreeControl";
import { useContacts } from "@n20a/libfsdb";
import { FnMapToContactDocs } from "../../allcommon/dataset/FnMapToContactDoc";
import { isPrimaryCompanyContact } from "../propertyformcontainer/ProfileAddFormContainer";
import { FqaNotes } from "../notes/FqaNotes";

interface IContactList {
    uniqueName: string;
    headerText?: string;
    selectedNode?: ITreeNode;
    featureId?: string;
    handleShowUserMessage?: (messageText: string) => void;
}

function isBusinessExplorerNode(node?: ITreeNode): boolean {
    const nodeType = node?.NodeType?.toLowerCase() ?? "";
    return nodeType === "business" || nodeType === "contact";
}

function resolveBidCid(selection: { bid?: string; cid?: string }, node?: ITreeNode): { bid: string; cid: string } {
    const bidFromSelection = String(selection.bid ?? "").trim();
    const cidFromSelection = String(selection.cid ?? "").trim();
    if (bidFromSelection) {
        return { bid: bidFromSelection, cid: cidFromSelection };
    }

    if (!isBusinessExplorerNode(node)) {
        return { bid: "", cid: "" };
    }

    if (String(node?.NodeType ?? "").toLowerCase() === "contact") {
        return {
            bid: String(node?.bid ?? node?.parentEntID ?? "").trim(),
            cid: String(node?.cid ?? node?.NodeEntID ?? node?.key ?? "").trim(),
        };
    }

    return {
        bid: String(node?.bid ?? node?.NodeEntID ?? node?.key ?? "").trim(),
        cid: "",
    };
}

const buildContactCardFields = (contact: IContactDoc): ICardLayoutField[] => {
    const fields: ICardLayoutField[] = [
        {
            Name: "Contact",
            Value: contact.cname || "—",
            Header: 1,
        },
    ];
    if (contact.email) {
        fields.push({
            Name: "Email",
            Value: contact.email,
            Row: "space-between",
        });
    }

    if (contact.phone) {
        fields.push({
            Name: "Phone",
            Value: contact.phone,
            Group: "phones",
        });
    }

    if (contact.contacttype) {
        fields.push({
            Name: "Type",
            Value: contact.contacttype,
            Group: "type-status",
        });
    }

    if (contact.role) {
        fields.push({
            Name: "Role",
            Value: contact.role,
            Group: "type-status",
        });
    }

    if (contact.status) {
        fields.push({
            Name: "Status",
            Value: contact.status,
            Group: "type-status",
        });
    }

    const addressParts = [
        contact.address1,
        contact.address2,
        contact.city,
        contact.state,
        contact.zip,
        contact.country,
    ].filter(Boolean);

    if (addressParts.length > 0) {
        fields.push({
            Name: "Address",
            Value: addressParts.join(", "),
        });
    }

    return fields;
};

const ContactList = (props: IContactList) => {
    const smDataContext = useSmDataContext();
    const commonVariableContext = useCommonVariableContext();
    const [selectedContactId, setSelectedContactId] = useState<string>("");
    const [filterKeyword, setFilterKeyword] = useState<string>("");

    const [contactToDelete, setContactToDelete] = useState<IContactDoc | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
    const [confirmMessage, setConfirmMessage] = useState<string>("");

    const { bid, cid } = resolveBidCid(
        smDataContext.selection,
        smDataContext.selectedNode ?? (isBusinessExplorerNode(props.selectedNode) ? props.selectedNode : undefined)
    );

    const { loading, error, getContacts, contacts, deleteContact } = useContacts(bid);

    useEffect(() => {
        if (bid) {
            void getContacts();
        }
    }, [bid, getContacts]);

    const handleDeleteContact = (contact: IContactDoc) => {
        if (isPrimaryCompanyContact(contact.cid, contact.bid)) {
            const msg = "Primary contact created with company cannot be deleted individually. It can be deleted only when the business record is deleted.";
            if (props.handleShowUserMessage) {
                props.handleShowUserMessage(msg);
            } else {
                alert(msg);
            }
            return;
        }

        const name = contact.cname || contact.cid;
        setContactToDelete(contact);
        setConfirmMessage(`Are you sure you want to delete contact "${name}"?`);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!contactToDelete) return;
        const targetContact = contactToDelete;
        setIsConfirmOpen(false);
        setContactToDelete(null);

        try {
            if (deleteContact) {
                await deleteContact(targetContact.cid);
            }
            if (smDataContext?.updateDataset && smDataContext.datasets?.contacts) {
                const remaining = smDataContext.datasets.contacts.filter((c) => c.cid !== targetContact.cid);
                smDataContext.updateDataset("contacts", remaining);
            }
            if (bid) {
                void getContacts();
            }
            if (props.featureId) {
                commonVariableContext.setReloadTreeFor({
                    featureId: props.featureId,
                    entId: targetContact.bid || bid,
                });
            }
        } catch (err) {
            console.error("Failed to delete contact:", err);
        }
    };

    const businessContacts = useMemo<IContactDoc[]>(() => {
        if (!bid) {
            return [];
        }
        const fsContacts = Array.isArray(contacts) ? FnMapToContactDocs(contacts, bid) : [];
        const localContacts = (smDataContext?.datasets?.contacts ?? []).filter(
            (c) => String(c.bid ?? "").trim().toLowerCase() === bid.toLowerCase()
        );

        const map = new Map<string, IContactDoc>();
        for (const c of localContacts) {
            if (c.cid) map.set(c.cid.toLowerCase(), c);
        }
        for (const c of fsContacts) {
            if (c.cid) map.set(c.cid.toLowerCase(), c);
        }
        return Array.from(map.values());
    }, [bid, contacts, smDataContext?.datasets?.contacts]);

    useEffect(() => {
        if (cid) {
            setSelectedContactId(cid);
            return;
        }
        if (businessContacts.length > 0) {
            setSelectedContactId((prev) => {
                const exists = businessContacts.some((contact) => contact.cid === prev);
                return exists ? prev : businessContacts[0].cid;
            });
        }
    }, [cid, businessContacts]);

    const filteredContacts = useMemo(() => {
        const query = filterKeyword.trim().toLowerCase();
        if (!query) {
            return businessContacts;
        }

        return businessContacts.filter((item) => {
            const haystack = [
                item.cname,
                item.email,
                item.phone,
                item.contacttype,
                item.role,
                item.status,
                item.address1,
                item.address2,
                item.city,
                item.state,
                item.zip,
                item.country,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(query);
        });
    }, [businessContacts, filterKeyword]);

    const selectedContact = useMemo(() => {
        return businessContacts.find((c) => c.cid === selectedContactId) || (businessContacts.length > 0 ? businessContacts[0] : null);
    }, [businessContacts, selectedContactId]);

    const selectedContactNode = useMemo<ITreeNode | undefined>(() => {
        if (!selectedContact) {
            return undefined;
        }
        return {
            key: selectedContact.cid,
            bid: selectedContact.bid || bid,
            cid: selectedContact.cid,
            NodeType: "contact",
            treetype: "contact",
            NodeEntityname: selectedContact.cname || selectedContact.cid,
            Name: selectedContact.cname || selectedContact.cid,
        };
    }, [selectedContact, bid]);

    return (
        <div
            className="nz-sidebar-contact-list-container"
            tabIndex={1}
            onKeyDown={handleNestedZoneContainerKeyDown}
            key={props.uniqueName}
        >
            {/* Left Pane: Contacts List */}
            <div className="nz-sidebar-contact-left-pane">
                <div className="nz-sub-header">
                    <Label
                        uniqueName={`${props.uniqueName}-task-header`}
                        label={`${props.headerText ?? "Contacts"}${businessContacts.length > 0 ? ` (${filteredContacts.length})` : ""}`}
                    />
                </div>

                {businessContacts.length > 0 && (
                    <div className="nz-sidebar-contact-list-search">
                        <EditTextXControl
                            name={`${props.uniqueName}-filter`}
                            label=""
                            placeholder="Filter contacts..."
                            value={filterKeyword}
                            onChange={(val) => setFilterKeyword(String(val ?? ""))}
                        />
                    </div>
                )}

                <div className="nz-sidebar-contact-list-content">
                    {loading ? (
                        <div className="nz-sidebar-contact-list-empty">
                            Loading contacts...
                        </div>
                    ) : error ? (
                        <div className="nz-sidebar-contact-list-empty">
                            {error}
                        </div>
                    ) : businessContacts.length === 0 ? (
                        <div className="nz-sidebar-contact-list-empty">
                            {bid
                                ? "No contacts found for selected business"
                                : "Select a business node to view contacts"}
                        </div>
                    ) : filteredContacts.length === 0 ? (
                        <div className="nz-sidebar-contact-list-empty">
                            No contacts matching filter
                        </div>
                    ) : (
                        filteredContacts.map((contact, index) => (
                            <CardLayout
                                key={contact.cid || `${props.uniqueName}-card-${index}`}
                                uniqueName={`${props.uniqueName}-contact-card-${contact.cid}`}
                                className="nz-contact-card"
                                data={contact}
                                fields={buildContactCardFields(contact)}
                                isSelected={selectedContactId === contact.cid}
                                hideRightMouseMenu={true}
                                allowDeleteButton={true}
                                isDeleteDisabled={isPrimaryCompanyContact(contact.cid, contact.bid)}
                                handleMouseForDelete={() => handleDeleteContact(contact)}
                                onClick={() => setSelectedContactId(contact.cid)}
                                ContentImage={{
                                    uniqueName: `${props.uniqueName}-contact-avatar-${contact.cid}`,
                                    source: (
                                        <User24x24
                                            size={FnGetCssVariable("--image-size-2")}
                                            fill="none"
                                            strokeWidth={1}
                                        />
                                    ),
                                    w: "var(--image-size-2)",
                                    h: "var(--image-size-2)",
                                    type: "svg",
                                    tooltip: contact.cname || "Contact",
                                }}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Right Pane: Notes for Selected Contact */}
            <div className="nz-sidebar-contact-right-pane">
                {selectedContactNode ? (
                    <FqaNotes
                        uniqueName={`notes-contact-${selectedContactId}`}
                        hideSearchControl={false}
                        selectedNode={selectedContactNode}
                    />
                ) : (
                    <div className="nz-sidebar-contact-list-empty">
                        Select a contact card to view notes
                    </div>
                )}
            </div>

            <YesNoFormContainer
                uniqueName={`${props.uniqueName}-delete-confirm`}
                isOpen={isConfirmOpen}
                dialogTitle="Confirm Delete"
                message={confirmMessage}
                handleYesButtonClick={handleConfirmDelete}
                handleNoButtonClick={() => {
                    setIsConfirmOpen(false);
                    setContactToDelete(null);
                }}
            />
        </div>
    );
};

export { ContactList };

