import { useState, useMemo, useEffect } from "react";
import { User24x24, Check } from "@n20a/libicon";
import { EditTextXControl } from "@n20a/libform";
import { FnGetCssVariable } from "../../../appcontainer/allcommon/FnGetCssVariable";
import { handleNestedZoneContainerKeyDown } from "../../allcommon/basic/FnHandleContainerKeyDown";
import { Label } from "../../basic/label/Label";
import { CardLayout } from "../../cardlayout/CardLayout";
import { ICardLayoutField } from "../../cardlayout/CardLayout";
import { IContact } from "../../allinterface/tree/IContact";
import { sampleContacts } from "../../../features/allcommon/FnContactsSampleData";
import "./ContactList.css";
import { ITreeNode } from "../../allinterface/tree/ITreeControl";
interface IContactList {
    uniqueName: string;
    headerText?: string;
    selectedNode?: ITreeNode;
    featureId?: string;
    handleShowUserMessage?: (messageText: string) => void;
}
const buildContactCardFields = (contact: IContact): ICardLayoutField[] => {
    const fields: ICardLayoutField[] = [
        {
            Name: "Contact",
            Value: contact.contact || "—",
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

    if (contact.phone1) {
        fields.push({
            Name: "Phone",
            Value: contact.phone1,
            Group: "phones",
        });
    }

    if (contact.phone2) {
        fields.push({
            Name: "Alt Phone",
            Value: contact.phone2,
            Group: "phones",
        });
    }

    if (contact.ctype) {
        fields.push({
            Name: "Type",
            Value: contact.ctype,
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
        contact.address_street,
        contact.address_city,
        contact.address_state,
        contact.address_zip,
        contact.address_country,
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
    const [selectedContactId, setSelectedContactId] = useState<string>("");
    const [filterKeyword, setFilterKeyword] = useState<string>("");

    const selectedNode = props.selectedNode;

    // Resolve business ID and find all associated contacts
    const businessContacts = useMemo<IContact[]>(() => {
        if (!selectedNode) {
            return [];
        }

        let businessId = "";
        const nodeType = selectedNode.NodeType?.toLowerCase() ?? "";
        const nodeEntity = selectedNode.NodeEntityname?.toLowerCase() ?? "";
        const treeType = selectedNode.treetype?.toLowerCase() ?? "";

        if (
            nodeType === "business" ||
            nodeEntity === "business" ||
            treeType === "business" ||
            selectedNode.bname
        ) {
            businessId = String(selectedNode.NodeEntID || selectedNode.bid || selectedNode.key || "");
        } else if (
            nodeType === "contact" ||
            nodeEntity === "contact" ||
            treeType === "contact" ||
            selectedNode.cid
        ) {
            businessId = String(selectedNode.bid || selectedNode.parentEntID || "");
        } else {
            businessId = String(selectedNode.NodeEntID || selectedNode.bid || selectedNode.key || "");
        }

        if (!businessId) {
            return [];
        }

        return sampleContacts.filter(
            (contact) => contact.bid?.toLowerCase() === businessId.toLowerCase()
        );
    }, [
        selectedNode?.key,
        selectedNode?.NodeEntID,
        selectedNode?.bid,
        selectedNode?.cid,
        selectedNode?.parentEntID,
        selectedNode?.NodeType,
        selectedNode?.NodeEntityname,
        selectedNode?.treetype,
        selectedNode?.bname,
    ]);

    // Automatically highlight selected contact if the node selected is a contact
    useEffect(() => {
        if (!selectedNode) return;
        const nodeType = selectedNode.NodeType?.toLowerCase() ?? "";
        const nodeEntity = selectedNode.NodeEntityname?.toLowerCase() ?? "";
        const treeType = selectedNode.treetype?.toLowerCase() ?? "";

        if (
            nodeType === "contact" ||
            nodeEntity === "contact" ||
            treeType === "contact" ||
            selectedNode.cid
        ) {
            const contactId = String(selectedNode.cid || selectedNode.NodeEntID || selectedNode.key || "");
            setSelectedContactId(contactId);
        } else if (businessContacts.length > 0) {
            // Default select the first contact in the business if none selected
            setSelectedContactId((prev) => {
                const exists = businessContacts.some((c) => c.cid === prev);
                return exists ? prev : businessContacts[0].cid;
            });
        }
    }, [selectedNode, businessContacts]);

    // Filter contacts based on user search input
    const filteredContacts = useMemo(() => {
        const query = filterKeyword.trim().toLowerCase();
        if (!query) {
            return businessContacts;
        }

        return businessContacts.filter((item) => {
            const name = item.contact?.toLowerCase() ?? "";
            const email = item.email?.toLowerCase() ?? "";
            const phone1 = item.phone1?.toLowerCase() ?? "";
            const phone2 = item.phone2?.toLowerCase() ?? "";
            const ctype = item.ctype?.toLowerCase() ?? "";
            const status = item.status?.toLowerCase() ?? "";
            const address = [
                item.address_street,
                item.address_city,
                item.address_state,
                item.address_zip,
                item.address_country,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return (
                name.includes(query) ||
                email.includes(query) ||
                phone1.includes(query) ||
                phone2.includes(query) ||
                ctype.includes(query) ||
                status.includes(query) ||
                address.includes(query)
            );
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
                        {selectedNode
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
                                tooltip: contact.contact || "Contact",
                            }}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export { ContactList };
