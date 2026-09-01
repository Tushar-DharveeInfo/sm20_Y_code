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
import "./ContactList.css";
import { ITreeNode } from "../../allinterface/tree/ITreeControl";

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
    const [selectedContactId, setSelectedContactId] = useState<string>("");
    const [filterKeyword, setFilterKeyword] = useState<string>("");

    const { bid, cid } = resolveBidCid(
        smDataContext.selection,
        smDataContext.selectedNode ?? (isBusinessExplorerNode(props.selectedNode) ? props.selectedNode : undefined)
    );

    const businessContacts = useMemo<IContactDoc[]>(() => {
        if (!bid) {
            return [];
        }
        return smDataContext.getContactsForTree(bid, smDataContext.selection.filterJson);
    }, [bid, smDataContext]);

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

    return (
        <div
            className="nz-sidebar-contact-list-container"
            tabIndex={1}
            onKeyDown={handleNestedZoneContainerKeyDown}
            key={props.uniqueName}
        >
            <div className="nz-sub-header">
                <Label
                    uniqueName={`${props.uniqueName}-task-header`}
                    label={`${props.headerText ?? "Contacts"}${businessContacts.length > 0 ? ` (${filteredContacts.length})` : ""
                        }`}
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
                {businessContacts.length === 0 ? (
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
    );
};

export { ContactList };
