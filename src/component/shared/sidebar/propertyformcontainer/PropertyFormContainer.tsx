
import { FormElementsRenderer, IFormData, IFormElements } from '@n20a/libform'
import { AddressForm, IAddress } from '@n20a/libcountry'
import '@n20a/libform/style.css'
import './PropertyFormContainer.css'
import { IPropertyColumn, IPropertyFormContainer } from '../../allinterface/sidebar/IPropertyFormContainer'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStatusBarContext } from '../../context/hooks/StatusBarHooks'
import { FnNodeGetKebabMenuData } from '../../allcommon/settingsform/FnNodeGetKebabMenuData'
import { FnBuildFormElementsFromDataset } from '../../allcommon/sidebar/FnBuildFormElementsFromDataset'
import { Label } from '../../basic/label/Label'
import { IImage } from '../../allinterface/basic/IImage'
import { Back24x24, Check, Delete24x24, Save24x24 } from '@n20a/libicon'
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable'
import { DirtyFlagImage } from '../../basic/dirtyflagimage/DirtyFlagImage'
import { getDiagnosticLevelData } from '../../context/contextandprovider/CommonVariable'
import { ActionImage } from '../../basic/actionimage/ActionImage'
import { useSelectedNodeContext } from '../../context/hooks/SelectedNodeHooks'
import { ISelectedNodeProperty } from '../../context/allinterface/ISelectedNode'
import { useSessionContext } from '../../context/hooks/SessionHooks'
import { useCommonVariableContext } from '../../context/hooks/CommonVariableHooks'
import { FnParseJsonSafely } from '../../../appcontainer/allcommon/FnParseJsonSafely'
import { FnCheckPermissionToEditName, IFeaturePermission } from '../../allcommon/FnCheckPermissionToEditName'
import { handleFormControlsBubbleKeyDown, handleFormControlsKeyDown } from '../../allcommon/basic/FnHandleContainerKeyDown'
import { samplePropertyEntityTables } from './PropertySampleData'
import { useActivities, useBusinesses, useContacts } from '@n20a/libfsdb'
import { useSmDataContext } from '../../context/hooks/SmDataHooks'
import { useMainAppContext } from '../../context/hooks/MainAppHooks'
import { FnLogActivity } from '../../allcommon/basic/FnLogActivity'
import { YesNoFormContainer } from '../../basic/yesnoformcontainer/YesNoFormContainer'
import { isPrimaryCompanyContact } from './ProfileAddFormContainer'
import type { IBusinessDoc, IContactDoc } from '../../allinterface/IDatasets'

const addressFieldNames = new Set([
    "address1",
    "address2",
    "city",
    "state",
    "country",
    "zip",
    "gps"
]);
type IEntityTable = Record<string, unknown>;
type IPropertyRow = Record<string, unknown>;
type IKebabMenuData = Record<string, IPropertyRow[]>;
type IPgColumnDef = { PName: string; RequiredToAddRecord?: boolean; RequiredToUpdateRecord?: boolean;[key: string]: unknown };

const SESSION_EDIT_PERMISSION_VARS = ["AppQAName", "AppQAMenuName", "AppQAFeatureName", "FeatureName"] as const;
type ISessionEditPermissionVar = (typeof SESSION_EDIT_PERMISSION_VARS)[number];

// Parses the session edit permission key built from SESSION_EDIT_PERMISSION_VARS.
const parseSessionEditPermissionKey = (key: string): Record<ISessionEditPermissionVar, string> => {
    const values: Record<ISessionEditPermissionVar, string> = {
        AppQAName: "",
        AppQAMenuName: "",
        AppQAFeatureName: "",
        FeatureName: "",
    };
    key.split("|").forEach((part) => {
        const colonIndex = part.indexOf(":");
        if (colonIndex === -1) return;
        const variableName = part.slice(0, colonIndex);
        if (SESSION_EDIT_PERMISSION_VARS.includes(variableName as ISessionEditPermissionVar)) {
            values[variableName as ISessionEditPermissionVar] = part.slice(colonIndex + 1);
        }
    });
    return values;
};

// Parses property column definitions from a JSON properties string.
const parsePropertyColumns = (properties: string): IPropertyColumn[] =>
    FnParseJsonSafely<IPropertyColumn[], IPropertyColumn[]>(properties, { fallback: [] });

// Parses pg column definitions including required-field flags from a JSON string.
const parsePgColumnDefs = (properties: string): IPgColumnDef[] =>
    FnParseJsonSafely<IPgColumnDef[], IPgColumnDef[]>(properties, { fallback: [] });

const ALLOWED_CONTACT_FIELDS = new Set([
    "bid",
    "cid",
    "monitorupdated",
    "monitor",
    "verified",
    "contacttype",
    "role",
    "status",
    "ctag",
    "cname",
    "email",
    "phone",
    "address1",
    "address2",
    "city",
    "state",
    "country",
    "zip",
    "countrycode",
    "timezoneoffset",
    "donotcallme",
    "removemefrommailinglist",
    "smsoptin",
    "datecreated",
    "dateupdated"
]);

const ALLOWED_BUSINESS_FIELDS = new Set([
    "bid",
    "btype",
    "status",
    "tag",
    "verified",
    "salesexec",
    "bname",
    "country",
    "state",
    "daysnoticeperiod",
    "mmfinyear",
    "relatedbids",
    "datecreated",
    "dateupdated",
    "name",
    "updatedby",
    "createdby",
    "contactsupdated",
    "notesupdated",
    "ticketsupdated",
    "ticketnotesupdated",
    "activitiesupdated",
    "ordersupdated",
    "subsupdated",
    "downloadupdated",
    "amcexpirydate",
    "mcsexpirydate",
    "saasexpirydate",
    "onpremexpirydate",
    "estimatedusers",
    "estimatedracks",
    "estimateddcsites"
]);

function buildFirestoreContactPayload(
    contactId: string,
    parentBid: string,
    source: Record<string, unknown>
): Record<string, unknown> {
    const raw: Record<string, unknown> = {
        bid: parentBid || String(source.bid ?? ""),
        cid: contactId,
        cname: String(source.cname ?? source.contact ?? source.Name ?? ""),
        contacttype: String(source.contacttype ?? source.ctype ?? "contact"),
        email: String(source.email ?? ""),
        phone: String(source.phone ?? source.phone1 ?? ""),
        address1: String(source.address1 ?? source.address_street ?? ""),
        address2: source.address2 !== undefined && source.address2 !== "" ? String(source.address2) : undefined,
        city: String(source.city ?? source.address_city ?? ""),
        state: String(source.state ?? source.address_state ?? ""),
        country: String(source.country ?? source.address_country ?? ""),
        zip: String(source.zip ?? source.address_zip ?? ""),
        countrycode: source.countrycode !== undefined && source.countrycode !== "" ? String(source.countrycode) : undefined,
        status: String(source.status ?? "Active"),
        verified: Boolean(source.verified ?? source.monitor ?? false),
        monitor: Boolean(source.monitor ?? source.verified ?? false),
        monitorupdated: String(source.monitorupdated ?? new Date().toISOString()),
        dateupdated: new Date().toISOString(),
    };

    const dc = source.datecreated ?? source.dateCreated;
    if (dc !== undefined && String(dc).trim() !== "") {
        raw.datecreated = String(dc);
    }
    if (source.role !== undefined && source.role !== "") raw.role = String(source.role);
    if (source.ctag !== undefined && source.ctag !== "") raw.ctag = String(source.ctag);
    if (source.timezoneoffset !== undefined && source.timezoneoffset !== "") raw.timezoneoffset = Number(source.timezoneoffset) || 0;
    if (source.donotcallme !== undefined) raw.donotcallme = Boolean(source.donotcallme);
    if (source.removemefrommailinglist !== undefined) raw.removemefrommailinglist = Boolean(source.removemefrommailinglist);
    if (source.smsoptin !== undefined) raw.smsoptin = Boolean(source.smsoptin);

    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
        if (ALLOWED_CONTACT_FIELDS.has(k) && v !== undefined) {
            filtered[k] = v;
        }
    }
    return filtered;
}

function buildFirestoreBusinessPayload(
    businessId: string,
    source: Record<string, unknown>
): Record<string, unknown> {
    const raw: Record<string, unknown> = {
        bid: businessId,
        bname: String(source.bname ?? source.name ?? source.Name ?? ""),
        name: String(source.name ?? source.bname ?? source.Name ?? ""),
        btype: String(source.btype ?? ""),
        status: String(source.status ?? "Active"),
        verified: Boolean(source.verified ?? false),
        salesexec: String(source.salesexec ?? source.salesExec ?? ""),
        country: String(source.country ?? ""),
        state: String(source.state ?? ""),
        dateupdated: new Date().toISOString(),
    };

    const dnp = source.daysnoticeperiod ?? source.daysNoticePeriod;
    if (dnp !== undefined && dnp !== "") {
        raw.daysnoticeperiod = Number(dnp) || 0;
    }
    const mfy = source.mmfinyear ?? source.mmFinYear;
    if (mfy !== undefined && mfy !== "") {
        raw.mmfinyear = Number(mfy) || 0;
    }
    const dc = source.datecreated ?? source.dateCreated;
    if (dc !== undefined && String(dc).trim() !== "") {
        raw.datecreated = String(dc);
    }

    if (source.tag !== undefined && source.tag !== "") raw.tag = String(source.tag);
    if (source.relatedbids !== undefined || source.relatedBids !== undefined) {
        const rb = source.relatedbids ?? source.relatedBids;
        if (Array.isArray(rb)) {
            raw.relatedbids = rb.map(String).filter(Boolean);
        } else if (typeof rb === "string" && rb.trim()) {
            raw.relatedbids = rb.split(",").map((s) => s.trim()).filter(Boolean);
        } else {
            raw.relatedbids = [];
        }
    }

    const optionalStringFields = [
        "updatedby",
        "createdby",
        "contactsupdated",
        "notesupdated",
        "ticketsupdated",
        "ticketnotesupdated",
        "activitiesupdated",
        "ordersupdated",
        "subsupdated",
        "downloadupdated",
        "amcexpirydate",
        "mcsexpirydate",
        "saasexpirydate",
        "onpremexpirydate",
    ];
    for (const field of optionalStringFields) {
        const val = source[field] ?? source[field.toLowerCase()];
        if (val !== undefined && val !== "") {
            raw[field] = String(val);
        }
    }

    const optionalNumberFields = [
        "estimatedusers",
        "estimatedracks",
        "estimateddcsites",
    ];
    for (const field of optionalNumberFields) {
        const val = source[field] ?? source[field.toLowerCase()];
        if (val !== undefined && val !== "") {
            raw[field] = Number(val) || 0;
        }
    }

    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
        if (ALLOWED_BUSINESS_FIELDS.has(k) && v !== undefined) {
            filtered[k] = v;
        }
    }
    return filtered;
}

const PropertyFormContainer = (propertyFormContainerProps: IPropertyFormContainer) => {
    const [entityTables, setEntityTables] = useState<IEntityTable[]>([]);
    const [formElements, setFormElements] = useState<IFormElements>();
    const [pgClassRecord, setPgClassRecord] = useState<IEntityTable>();
    const [, setPgRecord] = useState<IEntityTable>();
    const [kebabMenuData, setKebabMenuData] = useState<IKebabMenuData>();
    const [, setOneToManyTableData] = useState<IPropertyRow[]>();
    const [isOneToManyPgTable, setIsOneToManyPgTable] = useState<boolean>(false);
    const [isShowMainHeader, setIsShowMainHeader] = useState<boolean>(false);
    const [isDirty, setIsDirty] = useState<boolean>(false);
    const [updatedProperties, setUpdatedProperties] = useState<Record<string, unknown>>();
    const [updatedAddress, setUpdatedAddress] = useState<IAddress>();
    const [isAddressFormShow, setIsAddressFormShow] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const statusBarContext = useStatusBarContext();
    const commonVariableContext = useCommonVariableContext();
    const selectedNodeContext = useSelectedNodeContext();
    const sessionContext = useSessionContext();
    const smDataContext = useSmDataContext();
    const mainAppContext = useMainAppContext();
    const { NodeEntityname } = propertyFormContainerProps.selectedNode;
    const {
        selectedNode,
        selectedNodeMenu,
        featureId,
        pgTableToShow,
        showPgTableOneToOne,
        allowBackButton,
        handleRefreshUpdatedRecord
    } = propertyFormContainerProps;

    const effectiveBid = useMemo(() => {
        return String(
            selectedNode?.bid ??
            selectedNode?.parentEntID ??
            selectedNode?.NodeEntID ??
            selectedNode?.key ??
            ""
        );
    }, [selectedNode?.bid, selectedNode?.parentEntID, selectedNode?.NodeEntID, selectedNode?.key]);

    const { updateBusiness } = useBusinesses();
    const { updateContact, deleteContact } = useContacts(effectiveBid);
    const { createActivity } = useActivities(effectiveBid);

    const entityType = String(
        selectedNode?.NodeEntityname ||
        selectedNode?.NodeType ||
        selectedNode?.treetype ||
        ""
    ).toLowerCase();

    const isContact =
        entityType === "contact" ||
        (Boolean(selectedNode?.cid) && selectedNode?.cid !== selectedNode?.bid);

    const oldPgClassRow = useMemo(() => {
        return (kebabMenuData?.[String(pgClassRecord?.tableName)]?.[0] ?? {}) as Record<string, unknown>;
    }, [kebabMenuData, pgClassRecord?.tableName]);

    const isContactVerified = useMemo(() => {
        if (!isContact) return false;
        if (updatedProperties?.verified !== undefined) {
            return Boolean(updatedProperties.verified);
        }
        if (updatedProperties?.monitor !== undefined) {
            return Boolean(updatedProperties.monitor);
        }
        if (oldPgClassRow?.verified !== undefined) {
            return Boolean(oldPgClassRow.verified);
        }
        if (oldPgClassRow?.monitor !== undefined) {
            return Boolean(oldPgClassRow.monitor);
        }
        return Boolean(selectedNode?.verified ?? selectedNode?.IsAuthorized ?? false);
    }, [isContact, updatedProperties, oldPgClassRow, selectedNode]);

    const [isDeleteContactConfirmOpen, setIsDeleteContactConfirmOpen] = useState(false);
    const [deleteContactWarningMsg, setDeleteContactWarningMsg] = useState("");
    const [isDeleteWarningOpen, setIsDeleteWarningOpen] = useState(false);

    const handleToggleVerified = () => {
        if (!isContact) return;

        const nextVerified = !isContactVerified;
        const nextStatus = nextVerified ? "Active" : (oldPgClassRow?.status ? String(oldPgClassRow.status) : "Active");

        setUpdatedProperties((prev) => ({
            ...(prev ?? {}),
            verified: nextVerified,
            monitor: nextVerified,
            status: nextStatus,
        }));

        setIsDirty(true);

        setFormElements((prev) => {
            if (!prev?.TableSections) return prev;
            const newSections: Record<string, any[]> = {};
            for (const [secKey, secElements] of Object.entries(prev.TableSections)) {
                newSections[secKey] = secElements.map((el) => {
                    const fieldName = (el.field || "").toLowerCase();
                    if (fieldName === "verified" || fieldName === "monitor") {
                        return { ...el, defaultvalue: nextVerified };
                    }
                    if (fieldName === "status") {
                        return { ...el, defaultvalue: nextStatus };
                    }
                    return el;
                });
            }
            return { ...prev, TableSections: newSections };
        });

        // statusBarContext.setUserActionData(
        //     `Contact marked as ${nextVerified ? "Verified" : "Unverified"}. Click Save button to apply changes.`
        // );
    };

    const handleDeleteContactClick = () => {
        if (!isContact) return;

        const contactId = String(
            selectedNode?.cid ||
            selectedNode?.NodeEntID ||
            selectedNode?.EntID ||
            selectedNode?.key ||
            ""
        );
        const parentBid = String(
            selectedNode?.bid ||
            selectedNode?.parentEntID ||
            effectiveBid ||
            ""
        );

        if (isPrimaryCompanyContact(contactId, parentBid)) {
            setDeleteContactWarningMsg(
                "Primary contact created with company cannot be deleted individually. It can be deleted only when the business record is deleted."
            );
            setIsDeleteWarningOpen(true);
            return;
        }

        setIsDeleteContactConfirmOpen(true);
    };

    const handleConfirmDeleteContact = async () => {
        setIsDeleteContactConfirmOpen(false);
        if (!isContact) return;

        const contactId = String(
            selectedNode?.cid ||
            selectedNode?.NodeEntID ||
            selectedNode?.EntID ||
            selectedNode?.key ||
            ""
        );
        const parentBid = String(
            selectedNode?.bid ||
            selectedNode?.parentEntID ||
            effectiveBid ||
            ""
        );
        const contactName = String(
            selectedNode?.Name ||
            oldPgClassRow?.cname ||
            oldPgClassRow?.contact ||
            contactId
        );

        statusBarContext.setIsLoading(true);
        statusBarContext.setLoadingLabel("Deleting contact...");

        try {
            const nextStatus = "Inactive";
            const nextVerified = false;

            const mergedRecord: Record<string, unknown> = {
                ...oldPgClassRow,
                ...(updatedProperties ?? {}),
                verified: nextVerified,
                monitor: nextVerified,
                status: nextStatus,
                cid: contactId,
                bid: parentBid,
                dateUpdated: new Date().toISOString(),
            };

            const fsdbPayload = buildFirestoreContactPayload(contactId, parentBid, mergedRecord);

            if (contactId) {
                try {
                    await updateContact(contactId, fsdbPayload);
                } catch (upErr) {
                    console.warn("Failed to update status to Inactive before delete:", upErr);
                }
            }

            if (deleteContact && contactId) {
                try {
                    await deleteContact(contactId);
                } catch (delErr) {
                    console.warn("deleteContact hook failed:", delErr);
                }
            }

            if (smDataContext?.updateDataset && smDataContext.datasets?.contacts) {
                const nextContacts = smDataContext.datasets.contacts.map((c) =>
                    c.cid?.toLowerCase() === contactId.toLowerCase()
                        ? ({ ...c, ...mergedRecord, status: nextStatus, verified: nextVerified, monitor: nextVerified } as unknown as IContactDoc)
                        : c
                );
                smDataContext.updateDataset("contacts", nextContacts);
            }

            if (selectedNode) {
                selectedNode.verified = nextVerified;
                selectedNode.IsAuthorized = nextVerified;
                selectedNode.status = nextStatus;
                selectedNode.Description = nextStatus;
                selectedNode.NodeState = nextStatus;
            }

            if (pgClassRecord?.tableName) {
                setKebabMenuData((prev) => ({
                    ...prev,
                    [String(pgClassRecord.tableName)]: [mergedRecord as IPropertyRow],
                }));
            }

            setFormElements((prev) => {
                if (!prev?.TableSections) return prev;
                const newSections: Record<string, any[]> = {};
                for (const [secKey, secElements] of Object.entries(prev.TableSections)) {
                    newSections[secKey] = secElements.map((el) => {
                        const fieldName = (el.field || "").toLowerCase();
                        if (fieldName === "verified" || fieldName === "monitor") {
                            return { ...el, defaultvalue: false };
                        }
                        if (fieldName === "status") {
                            return { ...el, defaultvalue: nextStatus };
                        }
                        return el;
                    });
                }
                return { ...prev, TableSections: newSections };
            });

            const userCid = String(
                mainAppContext.authSession?.cid ||
                mainAppContext.authSession?.username ||
                "User"
            ).trim();
            void FnLogActivity({
                bid: parentBid,
                cid: userCid,
                message: `${userCid} of ${parentBid} updated contact "${contactName}" (${contactId}) status to Inactive (Delete).`,
                createActivity,
                createActivityLog: mainAppContext.createActivityLog,
                updateDataset: smDataContext?.updateDataset,
                currentActivities: smDataContext?.datasets?.activities,
            });

            if (propertyFormContainerProps.featureId) {
                commonVariableContext.setReloadTreeFor({
                    featureId: propertyFormContainerProps.featureId,
                    entId: parentBid || contactId,
                });
            }
            propertyFormContainerProps.handleRefreshUpdatedRecord?.(contactId, contactName, "save");

            statusBarContext.setUserActionData(`Contact "${contactName}" deleted / status updated to Inactive.`);
        } catch (err) {
            console.error("Error deleting contact:", err);
            statusBarContext.setFetchError(["Failed to delete contact"]);
        } finally {
            statusBarContext.setIsLoading(false);
            statusBarContext.setLoadingLabel(undefined);
        }
    };

    const isShowPgTableFirst = !!selectedNodeMenu;
    const requestIdRef = useRef(0);
    const [entityTablesEntityName, setEntityTablesEntityName] = useState<string>();

    // Fetches entity table definitions for the selected node entity.
    useEffect(() => {
        if (!NodeEntityname) {
            setEntityTables([]);
            setEntityTablesEntityName(undefined);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setEntityTables([]);
        setEntityTablesEntityName(undefined);
        setLoading(true);
        requestIdRef.current++;

        // SAMPLE DATA: EM.GetTableVsProperty API commented out.
        // Prefer entityTables passed from SidebarContent (key/value EditText form).
        // axiosInterceptor({ url: EM.GetTableVsProperty, data: { entityName: NodeEntityname }, ... });
        if (!cancelled) {
            const tables =
                propertyFormContainerProps.entityTables?.length
                    ? propertyFormContainerProps.entityTables
                    : (samplePropertyEntityTables as IEntityTable[]);
            setEntityTables(tables);
            setEntityTablesEntityName(NodeEntityname);
            setLoading(false);
        }

        return () => {
            cancelled = true;
            requestIdRef.current++;
        };
    }, [NodeEntityname, propertyFormContainerProps.entityTables]);

    // Toggles the main header based on custom action allowance.
    useEffect(() => {
        if (propertyFormContainerProps.isAllowCustomAction) {
            setIsShowMainHeader(true);
        } else {
            setIsShowMainHeader(false);
        }
    }, [propertyFormContainerProps.isAllowCustomAction]);

    // Derives stable selected-node identifiers used for kebab menu and form loading.
    const selectedNodeKey = useMemo(() => ({
        entId: selectedNode?.NodeEntID?.includes("00000000") ? selectedNode.EntID : selectedNode?.NodeEntID,
        type: selectedNode?.treetype,
        nodeType: selectedNode?.NodeType,
        mountedId: selectedNode?.MountedDeviceID,
        parentEntId: selectedNode?.parentEntID,
        entityName: selectedNode?.NodeEntityname,
        dateApproved: selectedNode?.DateApproved,
    }), [
        selectedNode?.EntID,
        selectedNode?.NodeEntID,
        selectedNode?.treetype,
        selectedNode?.MountedDeviceID,
        selectedNode?.parentEntID,
        selectedNode?.NodeEntityname,
        selectedNode?.DateApproved,
        selectedNode?.NodeType,
    ]);

    const userBasicRole = useMemo(() => {
        return sessionContext.SessionList.find((item) => item.VariableName.toLowerCase() === "loginuserbasicrolename")?.SessionValue
    }, [sessionContext.SessionList])

    // Resolves the pg class table from entity tables based on node type.
    const pgClassTable = useMemo(() => {
        if (!entityTables.length) return undefined;
        if (selectedNodeKey.type?.toLowerCase() === "deviceslot") {
            return entityTables.find(
                t => String(t.tableName ?? "").toLowerCase() === "pg.deviceslot"
            );
        }
        return entityTables.find(t => t.entityPgClass);
    }, [entityTables, selectedNodeKey.type]);

    // Resolves the pg table from menu selection or explicit pgTableToShow prop.
    const pgTable = useMemo(() => {
        if (selectedNodeMenu?.Name) {
            return entityTables.find(
                t => String(t.tableName ?? "").toLowerCase() === selectedNodeMenu.Name.toLowerCase()
            );
        }
        if (pgTableToShow) {
            return entityTables.find(
                t => String(t.tableName ?? "").toLowerCase() === pgTableToShow.toLowerCase()
            );
        }
        return undefined;
    }, [entityTables, selectedNodeMenu?.Name, pgTableToShow]);

    // Determines whether the property form should be read-only for this context.
    const isReadOnly = useMemo(() => {
        return (
            propertyFormContainerProps.isReadOnly || !!selectedNodeKey.dateApproved
        );
    }, [featureId, selectedNodeKey, propertyFormContainerProps.isReadOnly]);

    // Session values used for edit-name permission; keyed so useMemo reacts to value changes.
    const sessionEditPermissionKey = SESSION_EDIT_PERMISSION_VARS
        .map((variableName) => {
            const item = sessionContext.SessionList.find((row) => row.VariableName === variableName);
            return `${variableName}:${item?.SessionValue ?? ""}`;
        })
        .join("|");

    // Check session and whether edit is allowed for name fields starting with _.
    const isEditAllowedForFeature = useMemo(() => {
        const permissionValues = parseSessionEditPermissionKey(sessionEditPermissionKey);
        const hasPermissionData = SESSION_EDIT_PERMISSION_VARS.some(
            (variableName) => permissionValues[variableName].length > 0
        );
        if (!hasPermissionData) return false;

        const session: IFeaturePermission = {
            AppQAName: permissionValues.AppQAName,
            AppQAMenuName: permissionValues.AppQAMenuName,
            AppQAFeatureName: permissionValues.AppQAFeatureName,
        };
        const featureName = permissionValues.FeatureName;
        if (!session.AppQAName && featureName) {
            return FnCheckPermissionToEditName(featureName, true);
        }
        return FnCheckPermissionToEditName(session);
    }, [sessionEditPermissionKey]);

    // Loads kebab menu data and builds form elements for the active pg tables.
    const loadForm = async () => {
        if (!pgClassTable?.properties || !selectedNodeKey.entityName) {
            setLoading(false);
            return;
        }
        const requestId = ++requestIdRef.current;
        setLoading(true);
        try {
            const columns = parsePropertyColumns(String(pgClassTable.properties));
            const pgColumns = pgTable?.properties
                ? parsePropertyColumns(String(pgTable.properties))
                : [];

            const classAddressControls = columns.filter(control =>
                addressFieldNames.has(control.PName?.toLowerCase() ?? "")
            );
            const pgAddressControls = pgColumns.filter(control =>
                addressFieldNames.has(control.PName?.toLowerCase() ?? "")
            );
            const allAddressControls = [...classAddressControls, ...pgAddressControls];

            const entityType = String(
                selectedNodeKey.entityName || selectedNodeKey.type || selectedNodeKey.nodeType || selectedNode?.NodeType || selectedNode?.treetype || ""
            ).toLowerCase();
            const isBusinessOrContact = entityType.includes("business") || entityType.includes("contact");
            const hasAddressControls = allAddressControls.length > 0 || isBusinessOrContact;

            // Remove address controls from normal controls so they render in AddressForm instead of textboxes
            const columnsForForm = columns.filter(control =>
                !addressFieldNames.has(control.PName?.toLowerCase() ?? "")
            );
            const pgControlsForForm = pgColumns.filter(control =>
                !addressFieldNames.has(control.PName?.toLowerCase() ?? "")
            );
            const isOneToMany = pgTable?.isOneToManyRelation ? true : false;
            const nodeEntID = selectedNodeKey.mountedId ?? selectedNodeKey.entId;
            const kebabMenuPayload: Record<string, unknown> = {
                entID: nodeEntID?.includes("##")
                    ? nodeEntID.split("##")[0]
                    : nodeEntID,
                entityName: selectedNodeKey.entityName,
                kebabMenuTableName:
                    String(pgClassTable.tableName) +
                    (pgTable?.tableName ? `;${pgTable.tableName}` : "")
            };

            if (
                selectedNodeKey.type?.toLowerCase() === "deviceview" &&
                !selectedNodeKey.mountedId
            ) {
                kebabMenuPayload.entID = selectedNodeKey.parentEntId;
            } else if (selectedNodeKey.type?.toLowerCase() == "devicepowerport"
                || selectedNodeKey.type?.toLowerCase() == "devicenetworkport") {
                kebabMenuPayload.nodeID = selectedNodeKey.entId;
                kebabMenuPayload.nodeType = selectedNodeKey.type == "DevicePowerPort" ? "PowerPort" : selectedNodeKey.type == "DeviceNetworkPort" ? "NetworkPort" : selectedNodeKey.type;
            } else if (selectedNodeKey.type?.toLowerCase() == "deviceslot") {
                kebabMenuPayload.nodeID = selectedNodeKey.entId;
                kebabMenuPayload.nodeType = "Slot";
            }
            const kebabData = (
                propertyFormContainerProps.kebabMenuData
                    ? propertyFormContainerProps.kebabMenuData
                    : await FnNodeGetKebabMenuData(
                        kebabMenuPayload,
                        statusBarContext
                    )
            ) as IKebabMenuData;
            if (requestId !== requestIdRef.current) return;
            if (pgClassTable.isOneToManyRelation) {
                setIsOneToManyPgTable(true);
                setOneToManyTableData(kebabData[String(pgClassTable.tableName)] ?? []);
                setIsShowMainHeader(false);
                setFormElements(undefined);
                setPgClassRecord(undefined);
                setPgRecord(pgClassTable);
                return;
            } else if (!propertyFormContainerProps.showPgTableOneToOne && isOneToMany && pgTable?.tableName && Object.keys(kebabData)?.length > 1) {
                const onetToManyTable = kebabData[String(pgTable.tableName)];
                setIsOneToManyPgTable(true);
                setOneToManyTableData(onetToManyTable ?? []);
            } else {
                if (typeof kebabData === "object" && Object.values(kebabData)?.length) {
                    const record = Object.values(kebabData as Record<string, ISelectedNodeProperty[]>)?.[0]?.[0];
                    selectedNodeContext.setSelectedNodeProperty(record as ISelectedNodeProperty);
                }
                setIsOneToManyPgTable(false);
                setOneToManyTableData(undefined);
            }

            if (hasAddressControls) {
                const getProfileValue = (fieldName: string): string => {
                    const lowerField = fieldName.toLowerCase();
                    // 1. Search in kebabData tables
                    const tableKeys = Object.keys(kebabData || {});
                    for (const key of tableKeys) {
                        const tableData = kebabData[key];
                        const parsed = Array.isArray(tableData) ? tableData[0] : tableData;
                        if (parsed && typeof parsed === "object") {
                            const row = parsed as Record<string, unknown>;
                            if (row[fieldName] != null && row[fieldName] !== "") return String(row[fieldName]);
                            if (row[lowerField] != null && row[lowerField] !== "") return String(row[lowerField]);
                            const matchedKey = Object.keys(row).find(k => k.toLowerCase().endsWith(`_${lowerField}`));
                            if (matchedKey && row[matchedKey] != null && row[matchedKey] !== "") return String(row[matchedKey]);
                        }
                    }
                    // 2. Search in selectedNode
                    if (selectedNode) {
                        const nodeRec = selectedNode as Record<string, unknown>;
                        if (nodeRec[lowerField] != null && nodeRec[lowerField] !== "") return String(nodeRec[lowerField]);
                        if (nodeRec[fieldName] != null && nodeRec[fieldName] !== "") return String(nodeRec[fieldName]);
                    }
                    return "";
                };

                const gps = getProfileValue("GPS");
                const [latitude = "", longitude = ""] = gps.split(",").map(value => value.trim());

                const addressValue: IAddress = {
                    Address1: getProfileValue("Address1") || getProfileValue("address1") || getProfileValue("address_street"),
                    Address2: getProfileValue("Address2") || getProfileValue("address2"),
                    City: getProfileValue("City") || getProfileValue("city") || getProfileValue("address_city"),
                    State: getProfileValue("State") || getProfileValue("state") || getProfileValue("address_state"),
                    Country: getProfileValue("Country") || getProfileValue("country") || getProfileValue("address_country") || "United States",
                    Zip: getProfileValue("Zip") || getProfileValue("zip") || getProfileValue("address_zip"),
                    CountryCode: getProfileValue("CountryCode") || getProfileValue("countrycode"),
                    Latitude: latitude,
                    Longitude: longitude,
                    TimezoneOffset: getProfileValue("TimezoneOffset")
                };
                setUpdatedAddress(addressValue);
                setIsAddressFormShow(true);
            }
            setPgClassRecord(pgClassTable);
            setPgRecord(pgTable);
            setKebabMenuData(kebabData);
            const form = FnBuildFormElementsFromDataset(
                isShowMainHeader || hasAddressControls ? "" : "Properties",
                {
                    [String(pgClassTable.tableName)]: {
                        label: String(pgClassTable.tableLabel || pgClassTable.tableName),
                        columns: columnsForForm
                    },
                    ...(pgTable?.tableName && (!pgTable.isOneToManyRelation || showPgTableOneToOne)
                        ? {
                            [String(pgTable.tableName)]: {
                                label: String(pgTable.tableLabel || pgTable.tableName),
                                columns: pgControlsForForm
                            }
                        }
                        : {})
                },
                kebabData,
                statusBarContext,
                [],
                undefined,
                getDiagnosticLevelData(),
                isReadOnly,
                isShowPgTableFirst ? String(pgTable?.tableName) : undefined,
                selectedNodeKey.entityName ?? undefined,
                undefined,
                undefined,
                undefined,
                isEditAllowedForFeature,
                userBasicRole ?? undefined
            );
            setFormElements(form);
        } catch (e) {
            console.error("Failed to load form", e);
        } finally {
            if (requestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    };

    // Triggers form load when entity tables and pg class table are available for the current entity.
    useEffect(() => {
        if (entityTablesEntityName !== NodeEntityname) return;

        if (!entityTables.length || !pgClassTable) {
            setLoading(false);
            return;
        }
        setIsDirty(false);
        setUpdatedProperties(undefined);
        setUpdatedAddress(undefined);
        setIsAddressFormShow(false);
        const abortController = new AbortController();

        const runLoadForm = async (): Promise<void> => {
            if (abortController.signal.aborted) return;
            await loadForm();
        };

        void runLoadForm();

        return () => {
            abortController.abort();
            requestIdRef.current++;
        };
    }, [entityTables, entityTablesEntityName, NodeEntityname, selectedNodeKey.entId, pgClassTable, pgTable, featureId, isEditAllowedForFeature,
        propertyFormContainerProps.kebabMenuData]);

    // Builds pg class data from updated property keys for a given table name.
    const buildPgClassDataFromKeys = (
        pgClassColumns: { PName: string }[],
        tableName: string,
        values: Record<string, unknown>
    ): IPropertyRow => {
        const pgClassData: IPropertyRow = {};
        const updatedKeys = Object.keys(values);
        pgClassColumns.forEach((col) => {
            const classKeyPrefix = `${tableName}_${col.PName}_`;
            const classKey = updatedKeys.find(k => k.startsWith(classKeyPrefix));
            if (classKey) {
                const value = values[classKey];
                pgClassData[col.PName] = value !== "" ? value : undefined;
            }
        });
        return pgClassData;
    };

    const areAllRequiredFieldsFilled = (
        values: Record<string, unknown>,
        formElement: IFormElements
    ): boolean => {
        const requiredFields = Object.values(
            formElement?.TableSections ?? {}
        )
            .flat()
            .filter(control => control.required && !control.disabled);

        return requiredFields.every(control => {
            // Exact key match
            let key = Object.prototype.hasOwnProperty.call(
                values,
                control.key
            )
                ? control.key
                : undefined;

            // Dynamic key match
            if (!key) {
                key = Object.keys(values).find(valueKey =>
                    valueKey.startsWith(control.key)
                );
            }

            if (!key) return false;

            const value = values[key];

            // null / undefined
            if (value === null || value === undefined) {
                return false;
            }

            // Empty string
            if (
                typeof value === "string" &&
                value.trim() === ""
            ) {
                return false;
            }

            return true;
        });
    };

    // Tracks dirty state and forwards merged pg class changes to the parent callback.
    const handleValueChange = (values: Record<string, unknown>) => {
        if (propertyFormContainerProps.handlePropertyChange) {
            if (!pgClassRecord?.properties) return;
            try {
                const pgClassColumns = parsePgColumnDefs(String(pgClassRecord.properties));
                const pgClassData = buildPgClassDataFromKeys(
                    pgClassColumns,
                    String(pgClassRecord.tableName),
                    values
                );
                const oldPgClassRow = kebabMenuData?.[String(pgClassRecord.tableName)]?.[0] ?? {};
                pgClassData["LastUpdated"] = undefined;
                const mergedPgClassRow = {
                    ...oldPgClassRow,
                    ...pgClassData
                };
                propertyFormContainerProps.handlePropertyChange(mergedPgClassRow);
            } catch (error) {
                console.error('Failed to map property change:', error);
            }
        }
        setUpdatedProperties(values);
        const isValid = formElements ? areAllRequiredFieldsFilled(
            values,
            formElements
        ) : false;

        setIsDirty(isValid);
    };

    // Saves property changes for both Business and Contact entities via @n20a/libfsdb hooks and local state updates.
    const saveEntityProperties = async (formData?: IFormData) => {
        // Map element keys (e.g. _Contact_contact__5) to actual field names (e.g. contact)
        const keyToFieldMap = new Map<string, string>();
        if (formElements?.TableSections) {
            for (const section of Object.values(formElements.TableSections)) {
                for (const el of section) {
                    if (el.key && el.field) {
                        keyToFieldMap.set(el.key, el.field);
                    }
                }
            }
        }

        let formSectionValues: Record<string, unknown> = {};
        if (formData?.TableSections) {
            for (const sectionKey of Object.keys(formData.TableSections)) {
                const sectionData = formData.TableSections[sectionKey];
                if (sectionData && typeof sectionData === "object") {
                    for (const [k, v] of Object.entries(sectionData)) {
                        const actualField = keyToFieldMap.get(k) || k;
                        formSectionValues[actualField] = v;
                    }
                }
            }
        }

        const rawUpdates: Record<string, unknown> = {
            ...(updatedProperties ?? {}),
            ...formSectionValues,
        };

        const updates: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rawUpdates)) {
            const actualField = keyToFieldMap.get(k) || k;
            if (!actualField.startsWith("_")) {
                updates[actualField] = v;
            }
        }

        if (updatedAddress) {
            if (updatedAddress.Address1 !== undefined) {
                updates["address_street"] = updatedAddress.Address1;
                updates["address1"] = updatedAddress.Address1;
            }
            if (updatedAddress.Address2 !== undefined) {
                updates["address_line2"] = updatedAddress.Address2;
                updates["address2"] = updatedAddress.Address2;
            }
            if (updatedAddress.City !== undefined) {
                updates["address_city"] = updatedAddress.City;
                updates["city"] = updatedAddress.City;
            }
            if (updatedAddress.State !== undefined) {
                updates["address_state"] = updatedAddress.State;
                updates["state"] = updatedAddress.State;
            }
            if (updatedAddress.Zip !== undefined) {
                updates["address_zip"] = updatedAddress.Zip;
                updates["zip"] = updatedAddress.Zip;
            }
            if (updatedAddress.Country !== undefined) {
                updates["address_country"] = updatedAddress.Country;
                updates["country"] = updatedAddress.Country;
            }
        }

        // Normalize boolean values
        for (const [key, val] of Object.entries(updates)) {
            if (val === "true") updates[key] = true;
            else if (val === "false") updates[key] = false;
        }

        const entityType = String(
            selectedNode?.NodeEntityname ||
            selectedNode?.NodeType ||
            selectedNode?.treetype ||
            ""
        ).toLowerCase();

        const isContact =
            entityType === "contact" ||
            (Boolean(selectedNode?.cid) && selectedNode?.cid !== selectedNode?.bid);

        const oldPgClassRow = (kebabMenuData?.[String(pgClassRecord?.tableName)]?.[0] ?? {}) as Record<string, unknown>;

        statusBarContext.setIsLoading(true);
        statusBarContext.setLoadingLabel("Updating property...");

        try {
            if (isContact) {
                const contactId = String(
                    selectedNode?.cid ||
                    selectedNode?.NodeEntID ||
                    selectedNode?.EntID ||
                    selectedNode?.key ||
                    ""
                );
                const parentBid = String(
                    selectedNode?.bid ||
                    selectedNode?.parentEntID ||
                    effectiveBid ||
                    ""
                );

                if (updates.contact && !updates.Name) updates.Name = updates.contact;
                if (updates.Name && !updates.contact) updates.contact = updates.Name;
                if (updates.cname && !updates.contact) updates.contact = updates.cname;
                if (updates.contact && !updates.cname) updates.cname = updates.contact;

                const isVerified = updates.verified !== undefined
                    ? Boolean(updates.verified)
                    : updates.monitor !== undefined
                        ? Boolean(updates.monitor)
                        : (oldPgClassRow?.verified !== undefined ? Boolean(oldPgClassRow.verified) : Boolean(oldPgClassRow?.monitor));

                const mergedRecord: Record<string, unknown> = {
                    ...oldPgClassRow,
                    ...updates,
                    verified: isVerified,
                    monitor: isVerified,
                    cid: contactId,
                    bid: parentBid,
                    dateUpdated: new Date().toISOString(),
                };

                // Build strictly filtered payload containing only allowed Firestore subcollection fields
                const fsdbPayload = buildFirestoreContactPayload(contactId, parentBid, mergedRecord);

                // 1. Call firestore hook from @n20a/libfsdb
                if (contactId) {
                    try {
                        const res = await updateContact(contactId, fsdbPayload);
                        if (res && !res.success) {
                            console.error("updateContact failed:", res.error);
                            statusBarContext.setFetchError([res.error ?? "Failed to update contact"]);
                        }
                    } catch (fsErr) {
                        console.warn("updateContact hook failed (offline/mock mode):", fsErr);
                    }
                }

                // 2. Update smDataContext
                if (smDataContext?.datasets?.contacts) {
                    const nextContacts = smDataContext.datasets.contacts.map((c) =>
                        c.cid?.toLowerCase() === contactId.toLowerCase()
                            ? ({ ...c, ...mergedRecord } as unknown as IContactDoc)
                            : c
                    );
                    smDataContext.updateDataset("contacts", nextContacts);
                }

                const userCid = String(
                    mainAppContext.authSession?.cid ||
                    mainAppContext.authSession?.username ||
                    'User'
                ).trim();
                const logMsg = `${userCid} of ${parentBid} updated contact ${contactId} successfully.`;
                void FnLogActivity({
                    bid: parentBid,
                    cid: userCid,
                    message: logMsg,
                    createActivity,
                    createActivityLog: mainAppContext.createActivityLog,
                    updateDataset: smDataContext?.updateDataset,
                    currentActivities: smDataContext?.datasets?.activities,
                });

                // 3. Update selectedNode in-place
                if (selectedNode) {
                    if (mergedRecord.contact) selectedNode.Name = String(mergedRecord.contact);
                    if (mergedRecord.contact) (selectedNode as Record<string, unknown>).contact = String(mergedRecord.contact);
                    if (mergedRecord.verified !== undefined) {
                        selectedNode.verified = Boolean(mergedRecord.verified);
                        selectedNode.IsAuthorized = Boolean(mergedRecord.verified);
                    }
                    if (mergedRecord.status) selectedNode.status = String(mergedRecord.status);
                }

                // 5. Update local kebabMenuData state
                if (pgClassRecord?.tableName) {
                    setKebabMenuData((prev) => ({
                        ...prev,
                        [String(pgClassRecord.tableName)]: [mergedRecord as IPropertyRow],
                    }));
                }

                setIsDirty(false);
                setUpdatedProperties(undefined);

                const targetName = String(mergedRecord.contact ?? selectedNode?.Name ?? "");
                propertyFormContainerProps.handleRefreshUpdatedRecord?.(contactId, targetName, "save");
                propertyFormContainerProps.handlePropertyChange?.(mergedRecord);
            } else {
                // Business
                const businessId = String(
                    selectedNode?.bid ||
                    selectedNode?.NodeEntID ||
                    selectedNode?.EntID ||
                    selectedNode?.key ||
                    effectiveBid ||
                    ""
                );

                if (updates.bname && !updates.Name) updates.Name = updates.bname;
                if (updates.Name && !updates.bname) updates.bname = updates.Name;
                if (updates.name && !updates.bname) updates.bname = updates.name;
                if (updates.bname && !updates.name) updates.name = updates.bname;

                const mergedRecord: Record<string, unknown> = {
                    ...oldPgClassRow,
                    ...updates,
                    bid: businessId,
                    dateUpdated: new Date().toISOString(),
                };

                // Build strictly filtered payload containing only allowed Firestore root collection fields
                const fsdbPayload = buildFirestoreBusinessPayload(businessId, mergedRecord);

                // 1. Call firestore hook from @n20a/libfsdb
                if (businessId) {
                    try {
                        const res = await updateBusiness(businessId, fsdbPayload);
                        if (res && !res.success) {
                            console.error("updateBusiness failed:", res.error);
                            statusBarContext.setFetchError([res.error ?? "Failed to update business"]);
                        }
                    } catch (fsErr) {
                        console.warn("updateBusiness hook failed (offline/mock mode):", fsErr);
                    }
                }

                // 2. Update smDataContext
                if (smDataContext?.datasets?.businesses) {
                    const nextBusinesses = smDataContext.datasets.businesses.map((b) =>
                        b.bid?.toLowerCase() === businessId.toLowerCase()
                            ? ({ ...b, ...mergedRecord } as unknown as IBusinessDoc)
                            : b
                    );
                    smDataContext.updateDataset("businesses", nextBusinesses);
                }

                const userCid = String(
                    mainAppContext.authSession?.cid ||
                    mainAppContext.authSession?.username ||
                    'User'
                ).trim();
                const logMsg = `${userCid} of ${businessId} updated business ${businessId} successfully.`;
                void FnLogActivity({
                    bid: businessId,
                    cid: userCid,
                    message: logMsg,
                    createActivity,
                    createActivityLog: mainAppContext.createActivityLog,
                    updateDataset: smDataContext?.updateDataset,
                    currentActivities: smDataContext?.datasets?.activities,
                });

                // 3. Update selectedNode in-place
                if (selectedNode) {
                    if (mergedRecord.bname) selectedNode.Name = String(mergedRecord.bname);
                    if (mergedRecord.bname) selectedNode.bname = String(mergedRecord.bname);
                    if (mergedRecord.verified !== undefined) {
                        selectedNode.verified = Boolean(mergedRecord.verified);
                        selectedNode.IsAuthorized = Boolean(mergedRecord.verified);
                    }
                    if (mergedRecord.status) selectedNode.status = String(mergedRecord.status);
                }

                // 5. Update local kebabMenuData state
                if (pgClassRecord?.tableName) {
                    setKebabMenuData((prev) => ({
                        ...prev,
                        [String(pgClassRecord.tableName)]: [mergedRecord as IPropertyRow],
                    }));
                }

                setIsDirty(false);
                setUpdatedProperties(undefined);

                const targetName = String(mergedRecord.bname ?? selectedNode?.Name ?? "");
                propertyFormContainerProps.handleRefreshUpdatedRecord?.(businessId, targetName, "save");
                propertyFormContainerProps.handlePropertyChange?.(mergedRecord);
            }
            await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
            console.error("Failed to save entity properties", error);
            statusBarContext.setFetchError(["Failed to update property"]);
        } finally {
            statusBarContext.setIsLoading(false);
            statusBarContext.setLoadingLabel(undefined);
        }
    };

    // Saves dirty-flag property changes via add/update API with optional pg table follow-up.
    const handleSaveProperties = (
        _event: React.MouseEvent<HTMLDivElement>
    ) => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        void saveEntityProperties();
    };

    // Saves property form data via add/update API with forensic logging and pg table follow-up.
    const handleSavePropertyForm = (formData: IFormData) => {
        void saveEntityProperties(formData);
    };

    // Navigates back via the parent refresh callback when the close button is clicked.
    const handleClickX = () => {
        propertyFormContainerProps.handleRefreshUpdatedRecord?.("", "", 'back');
    };

    // Handles back button click by invoking the parent refresh callback.
    const handleBackClick = (
        _event?: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
        _actionCode?: string,
        _payload?: unknown
    ): void => {
        handleRefreshUpdatedRecord?.("", "", 'back');
    };
    const handleValueChangeAddress = (address: IAddress) => {
        // Check whether address actually changed
        const isAddressChanged = updatedAddress &&
            JSON.stringify(updatedAddress) !== JSON.stringify(address);

        // No address change → don't update save button
        if (!isAddressChanged) return;

        setUpdatedAddress(address);
        if (updatedProperties) {
            const isValid = formElements ? areAllRequiredFieldsFilled(
                updatedProperties,
                formElements
            ) : false;

            setIsDirty(isValid);
        }
        else {
            setIsDirty(true);
        }
    };

    // Auto-saves property changes after 2 seconds of inactivity when the form is dirty.
    useEffect(() => {
        if (isDirty) {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
            autoSaveTimerRef.current = setTimeout(() => {
                void saveEntityProperties();
            }, 2000);
        }
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [isDirty, updatedProperties, updatedAddress]);

    // Injects close handler into form elements for the renderer; onSave is omitted to use top header save button.
    const renderedFormElements = useMemo(() => {
        if (!formElements) return undefined;
        return {
            ...formElements,
            Formisdirty: isDirty,
            onSave: undefined,
            onX: propertyFormContainerProps.allowCloseButton ? handleClickX : undefined
        };
    }, [formElements, isDirty, propertyFormContainerProps.allowCloseButton]);

    const saveImageData: IImage = {
        source: <Save24x24
            size={FnGetCssVariable('--image-size-1')}
            fill='none'
            strokeWidth={1} />,
        w: 'var(--image-size-2)',
        tooltip: "Save changes",
        uniqueName: 'user-profile-isave',
        type: 'svg'
    };
    const backImageData: IImage = {
        source: <Back24x24
            size={FnGetCssVariable('--image-size-1')}
            fill='none'
            strokeWidth={1} />,
        w: 'var(--image-size-2)',
        tooltip: "Click to go back",
        uniqueName: 'user-profile-iback',
        type: 'svg'
    };

    if (loading) {
        return <div className="nz-wh-100 nz-d-flex-hv-left">Loading properties...</div>;
    }

    if (!isOneToManyPgTable && (!formElements || !Object.keys(formElements.TableSections).length)) {
        return <div className="nz-wh-100 nz-d-flex-hv-left">No properties found</div>;
    }

    return (
        <div key={propertyFormContainerProps.uniqueName} className='nz-wh-100 nz-d-flex-column nz-prop-form-container'>
            {isShowMainHeader || isAddressFormShow || isContact ? <div className='nz-sub-header nz-prop-form-container-action'>
                <Label uniqueName={propertyFormContainerProps.uniqueName + 'header'} label={propertyFormContainerProps.headerText ?? "Properties"} />
                <div className='nz-header-action' style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isContact && (
                        <>
                            <button
                                type="button"
                                onClick={handleToggleVerified}
                                title={isContactVerified ? "Contact is verified. Click to mark as unverified" : "Click to mark contact as verified"}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "2px 8px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    border: isContactVerified ? "1px solid #10b981" : "1px solid #9ca3af",
                                    backgroundColor: isContactVerified ? "#ecfdf5" : "#f3f4f6",
                                    color: isContactVerified ? "#047857" : "#374151",
                                    height: "var(--node_height, 26px)",
                                    lineHeight: 1,
                                }}
                            >
                                <Check
                                    size={14}
                                    fill="none"
                                    strokeWidth={isContactVerified ? 2.5 : 1.5}
                                    color={isContactVerified ? "#047857" : "#6b7280"}
                                />
                                {isContactVerified ? "Verified" : "Verify"}
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteContactClick}
                                title="Click to delete contact"
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "2px 8px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    border: "1px solid #ef4444",
                                    backgroundColor: "#fef2f2",
                                    color: "#dc2626",
                                    height: "var(--node_height, 26px)",
                                    lineHeight: 1,
                                }}
                            >
                                <Delete24x24 size={14} fill="none" strokeWidth={1.5} color="#dc2626" />
                                Delete
                            </button>
                        </>
                    )}
                    <div style={{ width: 'var(--node_height)' }}>

                        {allowBackButton ? <ActionImage
                            uniqueName={propertyFormContainerProps.uniqueName + 'back-icon'}
                            image={backImageData} w={'var(--node_height)'} h={'var(--node_height)'}
                            actionCode={'back'} handleMouse={handleBackClick} /> : <></>}
                        {isDirty && <div className={'nz-save-button'}>
                            <DirtyFlagImage uniqueName={propertyFormContainerProps.uniqueName + 'save-icon'}
                                isDirty={isDirty}
                                bgColor={"#FFFF99"}
                                image={saveImageData} w={'var(--node_height)'} h={'var(--node_height)'}
                                handleMouse={handleSaveProperties} />
                        </div>}
                    </div>
                </div>
            </div> : <></>}
            <div className={'nz-prop-form-content' + (isOneToManyPgTable || isAddressFormShow ? " nz-prop-form-with-onetomany-grid" : "")} onKeyDownCapture={handleFormControlsKeyDown}
                onKeyDown={handleFormControlsBubbleKeyDown}>
                {renderedFormElements ? <FormElementsRenderer
                    formElements={renderedFormElements}
                    onValuesChange={handleValueChange}
                    embedded={isAddressFormShow ? true : false}
                /> : <></>}

                {updatedAddress && isAddressFormShow ? <div style={{ margin: "6px 0px" }}>
                    <AddressForm
                        key={"address-form"}
                        initialAddress={updatedAddress}
                        onChange={handleValueChangeAddress}
                        showDerivedFields={false}
                    />
                </div> : <></>}
            </div>
            <YesNoFormContainer
                uniqueName={`${propertyFormContainerProps.uniqueName}-delete-confirm`}
                isOpen={isDeleteContactConfirmOpen}
                dialogTitle="Confirm Delete"
                message={`Are you sure you want to delete contact "${String(selectedNode?.Name || oldPgClassRow?.cname || "this contact")}"?`}
                handleYesButtonClick={handleConfirmDeleteContact}
                handleNoButtonClick={() => setIsDeleteContactConfirmOpen(false)}
            />
            <YesNoFormContainer
                uniqueName={`${propertyFormContainerProps.uniqueName}-delete-warning`}
                isOpen={isDeleteWarningOpen}
                dialogTitle="Cannot Delete Contact"
                message={deleteContactWarningMsg}
                showOkButton={true}
                handleOkButtonClick={() => setIsDeleteWarningOpen(false)}
                handleYesButtonClick={() => setIsDeleteWarningOpen(false)}
                handleNoButtonClick={() => setIsDeleteWarningOpen(false)}
            />
        </div>
    );
};

export { PropertyFormContainer };
