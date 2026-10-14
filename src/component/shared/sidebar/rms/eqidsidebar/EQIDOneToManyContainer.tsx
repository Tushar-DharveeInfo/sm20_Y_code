import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OneToManyFormContainer } from "../../onetomanyformcontainer/OneToManyFormContainer";
import {
  getEQIDMenuConfig,
  type IEQIDMenuTableConfig,
  type IPortOrSlotRow,
} from "./EQIDPortsSlotsStaticData";
import { useRmsContext } from "../../../context/hooks/RmsHooks";
import { useSelectedNodeContext } from "../../../context/hooks/SelectedNodeHooks";
import { useMainAppContext } from "../../../context/hooks/MainAppHooks";
import { useSmDataContext } from "../../../context/hooks/SmDataHooks";
import { useStatusBarContext } from "../../../context/hooks/StatusBarHooks";
import { useFirestore, useActivities } from "@n20a/libfsdb";
import { FnLogActivity } from "../../../allcommon/basic/FnLogActivity";
import type { ITreeNode } from "../../../allinterface/tree/ITreeControl";

export interface IEQIDOneToManyContainerProps {
  ticket?: any;
  menuKey: string;
  selectedNode?: ITreeNode;
  featureId?: string;
  isReadOnly?: boolean;
}

function getLastValue(value: string): string {
  return (value || "").split("__").pop() || "";
}

/**
 * Sanitizes and normalizes row values to conform with INetworkPort, IPowerPort, ISlot, and IInOutPort.
 */
function sanitizeRow(row: Record<string, unknown>, tableName: string): IPortOrSlotRow {
  const shapeId = String(row.ShapeID || "").trim() || `${tableName.toUpperCase()}_${Date.now()}`;
  const rowId = (row.RecID as string) || shapeId;

  const sanitized: Record<string, unknown> = {
    ...row,
    RecID: rowId,
    ShapeID: shapeId,
    Name: String(row.Name || "").trim(),
  };

  if ("PortIndex" in row || tableName.toLowerCase().includes("port")) {
    const pIdx = Number(row.PortIndex);
    sanitized.PortIndex = isNaN(pIdx) ? 0 : pIdx;
  }

  if ("SlotIndex" in row || tableName.toLowerCase().includes("slot")) {
    const sIdx = Number(row.SlotIndex);
    sanitized.SlotIndex = isNaN(sIdx) ? 0 : sIdx;
  }

  if ("IsPortFiber" in row) {
    sanitized.IsPortFiber = row.IsPortFiber === true || row.IsPortFiber === "true";
  }

  if ("Gender" in row && row.Gender !== undefined) {
    sanitized.Gender = String(row.Gender);
  }

  if ("PortType" in row && row.PortType !== undefined) {
    sanitized.PortType = String(row.PortType);
  }

  if ("SlotMountType" in row && row.SlotMountType !== undefined) {
    sanitized.SlotMountType = String(row.SlotMountType);
  }

  if ("SlotUse" in row && row.SlotUse !== undefined) {
    sanitized.SlotUse = row.SlotUse ? String(row.SlotUse) : null;
  }

  return sanitized as IPortOrSlotRow;
}

export const EQIDOneToManyContainer: React.FC<IEQIDOneToManyContainerProps> = ({
  ticket,
  menuKey,
  selectedNode,
  featureId,
  isReadOnly = false,
}) => {
  const rmsContext = useRmsContext();
  const selectedNodeContext = useSelectedNodeContext();
  const mainAppContext = useMainAppContext();
  const smDataContext = useSmDataContext();
  const statusBarContext = useStatusBarContext();
  const firestore = useFirestore();

  // Resolve the active ticket from props or context
  const activeTicket =
    ticket ??
    (selectedNodeContext as any)?.selectedTicketCard ??
    (selectedNodeContext as any)?.SelectedTicketCard ??
    (rmsContext as any)?.selectedTicketCard ??
    (rmsContext as any)?.SelectedTicketCard;

  const ticketId = activeTicket?.ticketid || activeTicket?.id || "";
  const rawTicketEqid = String(
    activeTicket?.EQID || activeTicket?.eqid || ticketId || ""
  ).trim();
  const ticketEqid = getLastValue(rawTicketEqid) || rawTicketEqid;

  // Resolve target bid and user cid for activity logging
  const targetBid = useMemo(() => {
    return String(
      activeTicket?.bid ||
      selectedNode?.bid ||
      (selectedNode?.NodeType === "Business"
        ? selectedNode?.NodeEntID ?? selectedNode?.key
        : selectedNode?.parentEntID) ||
      mainAppContext?.authSession?.bid ||
      smDataContext?.selection?.bid ||
      ""
    ).trim();
  }, [
    activeTicket?.bid,
    selectedNode,
    mainAppContext?.authSession?.bid,
    smDataContext?.selection?.bid,
  ]);

  const userCid = useMemo(() => {
    return String(
      mainAppContext?.authSession?.cid ||
      mainAppContext?.authSession?.username ||
      activeTicket?.cid ||
      selectedNode?.cid ||
      smDataContext?.selection?.cid ||
      "User"
    ).trim();
  }, [
    mainAppContext?.authSession?.cid,
    mainAppContext?.authSession?.username,
    activeTicket?.cid,
    selectedNode?.cid,
    smDataContext?.selection?.cid,
  ]);

  const { createActivity } = useActivities(targetBid || "none");

  // 1. Ensure EQID dataset is loaded in RMS context if empty
  const hasLoadedEqidRef = useRef<boolean>(false);
  useEffect(() => {
    if (
      !hasLoadedEqidRef.current &&
      (!rmsContext?.eqid || rmsContext.eqid.length === 0) &&
      rmsContext?.loadEqid
    ) {
      hasLoadedEqidRef.current = true;
      void rmsContext.loadEqid();
    }
  }, [rmsContext?.loadEqid, rmsContext?.eqid?.length]);

  // Menu configuration based on active sub-menu key
  const menuConfig: IEQIDMenuTableConfig = useMemo(() => {
    return getEQIDMenuConfig(menuKey);
  }, [menuKey]);

  // 2. Direct document fetch fallback for instant retrieval from eqid collection
  const [directDoc, setDirectDoc] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    const docKey = ticketEqid || rawTicketEqid || ticketId;
    if (!docKey || !firestore) return;

    const fetchDirect = async () => {
      try {
        const res = await firestore.getDocument({ pathSegments: ["eqid", docKey] });
        if (isMounted && res?.data) {
          setDirectDoc(res.data);
          if (rmsContext?.setEqid) {
            rmsContext.setEqid((prev: any[]) => {
              const list = prev ?? [];
              const exists = list.some(
                (e: any) =>
                  (e.ticketid && ticketId && e.ticketid === ticketId) ||
                  (e.eqid && (getLastValue(e.eqid) === docKey || e.eqid === docKey)) ||
                  (e.EQID && (getLastValue(e.EQID) === docKey || e.EQID === docKey))
              );
              if (!exists) {
                return [...list, res.data];
              }
              return list;
            });
          }
        }
      } catch (err) {
        console.warn(`Direct fetch eqid doc ${docKey} failed:`, err);
      }
    };

    void fetchDirect();
    return () => {
      isMounted = false;
    };
  }, [ticketEqid, rawTicketEqid, ticketId, firestore, rmsContext]);

  // Locate the EQID record for this ticket from RMS context or directDoc
  const currentEqidRecord = useMemo(() => {
    const list = rmsContext?.eqid ?? [];
    const found = list.find((e: any) => {
      const eEqid = String(e.eqid || e.EQID || e.id || "").trim();
      const eEqidLast = getLastValue(eEqid);
      return (
        (e.ticketid && ticketId && e.ticketid === ticketId) ||
        (ticketEqid && (eEqid === ticketEqid || eEqidLast === ticketEqid)) ||
        (rawTicketEqid && (eEqid === rawTicketEqid || eEqidLast === rawTicketEqid))
      );
    });

    if (found) {
      return found;
    }

    if (directDoc) {
      return directDoc;
    }

    return {
      bid: activeTicket?.bid ?? "",
      cid: activeTicket?.cid ?? "",
      ticketid: ticketId,
      eqid: ticketEqid || rawTicketEqid || ticketId,
      EQID: ticketEqid || rawTicketEqid || ticketId,
    };
  }, [rmsContext?.eqid, ticketId, ticketEqid, rawTicketEqid, activeTicket, directDoc]);

  const effectiveEqid = useMemo(() => {
    const raw = String(
      (currentEqidRecord as any)?.EQID ||
      (currentEqidRecord as any)?.eqid ||
      ticketEqid ||
      rawTicketEqid ||
      ticketId ||
      ""
    ).trim();
    return getLastValue(raw) || raw || "default";
  }, [currentEqidRecord, ticketEqid, rawTicketEqid, ticketId]);

  // Activity logger for Add, Edit, and Delete operations across Port/Slot menus
  const logOperation = useCallback(
    async (
      action: "added" | "updated" | "deleted",
      record: Record<string, unknown>
    ) => {
      try {
        const recordName = String(record.Name || "").trim();
        const recordId = String(record.RecID || record.ShapeID || "").trim();
        const recordIdentifier =
          recordName && recordId && recordName !== recordId
            ? `"${recordName}" (${recordId})`
            : `"${recordName || recordId || "record"}"`;

        const bidPart = targetBid ? ` of ${targetBid}` : "";
        const message = `${userCid}${bidPart} ${action} ${menuConfig.tableLabel} record ${recordIdentifier} for EQID ${effectiveEqid} successfully.`;

        await FnLogActivity({
          bid: targetBid,
          cid: userCid,
          message,
          createActivity: targetBid ? createActivity : undefined,
          createActivityLog: mainAppContext?.createActivityLog,
          updateDataset: smDataContext?.updateDataset,
          currentActivities: smDataContext?.datasets?.activities,
        });
      } catch (err) {
        console.warn(`EQIDOneToManyContainer: Failed to log ${action} activity:`, err);
      }
    },
    [
      targetBid,
      userCid,
      menuConfig.tableLabel,
      effectiveEqid,
      createActivity,
      mainAppContext?.createActivityLog,
      smDataContext?.updateDataset,
      smDataContext?.datasets?.activities,
    ]
  );

  // 3. Real data: initialize from currentEqidRecord[fieldKey], default to empty list [] (no static dummy fallback)
  const initialRecords = useMemo((): IPortOrSlotRow[] => {
    const existing = (currentEqidRecord as any)?.[menuConfig.fieldKey];
    if (Array.isArray(existing) && existing.length > 0) {
      return existing.map((item: any, idx: number) => ({
        ...item,
        RecID: String(item.RecID || item.ShapeID || `${menuConfig.tableName.toLowerCase()}_${idx + 1}`),
        ShapeID: String(item.ShapeID || item.RecID || `${menuConfig.tableName.toUpperCase()}_${idx + 1}`),
      }));
    }
    return [];
  }, [currentEqidRecord, menuConfig.fieldKey, menuConfig.tableName]);

  const [tableData, setTableData] = useState<IPortOrSlotRow[]>(initialRecords);
  const tableDataRef = useRef<IPortOrSlotRow[]>(initialRecords);

  useEffect(() => {
    setTableData(initialRecords);
    tableDataRef.current = initialRecords;
  }, [initialRecords]);

  // 4. Persist the updated port/slot list to Firestore eqid collection and RMS context
  const persistRecords = useCallback(
    async (updatedList: IPortOrSlotRow[]) => {
      const docId = effectiveEqid;
      if (!docId || docId === "default") {
        console.warn("EQIDOneToManyContainer: Cannot persist without a valid EQID docId.");
        return;
      }

      const cleanList = updatedList.map((row) => {
        const cleanItem: Record<string, unknown> = { ...row };
        if (!cleanItem.RecID && cleanItem.ShapeID) {
          cleanItem.RecID = cleanItem.ShapeID;
        }
        return cleanItem;
      });

      const payload: Record<string, unknown> = {
        ...(currentEqidRecord || {}),
        EQID: docId,
        eqid: docId,
        ticketid: ticketId || currentEqidRecord?.ticketid || "",
        bid: activeTicket?.bid || currentEqidRecord?.bid || "",
        cid: activeTicket?.cid || currentEqidRecord?.cid || "",
        [menuConfig.fieldKey]: cleanList,
        lastupdated: new Date().toISOString(),
      };

      try {
        if (firestore) {
          await firestore.upsertDocument({
            pathSegments: ["eqid", docId],
            data: payload,
            merge: true,
          });
        }
      } catch (err) {
        console.error(`Failed to persist ${menuConfig.tableName} to eqid collection:`, err);
      }

      setDirectDoc((prev: any) => ({ ...(prev || {}), ...payload }));

      if (rmsContext?.setEqid) {
        rmsContext.setEqid((prev: any[]) => {
          const list = prev ?? [];
          const idx = list.findIndex((e: any) => {
            const eEqid = String(e.eqid || e.EQID || e.id || "").trim();
            const eEqidLast = getLastValue(eEqid);
            return (
              (e.ticketid && ticketId && e.ticketid === ticketId) ||
              (docId && (eEqid === docId || eEqidLast === docId))
            );
          });
          if (idx >= 0) {
            const next = [...list];
            next[idx] = { ...next[idx], ...payload };
            return next;
          }
          return [...list, payload];
        });
      }
    },
    [effectiveEqid, currentEqidRecord, ticketId, activeTicket, menuConfig, firestore, rmsContext]
  );

  // 5. Add / Update handler invoked by OneToManyFormContainer
  const handleSaveRecords = useCallback(
    async (recordToSave: Record<string, unknown>): Promise<Record<string, unknown>> => {
      statusBarContext?.setIsLoading?.(true);
      statusBarContext?.setLoadingLabel?.("Loading...");
      try {
        const sanitized = sanitizeRow(recordToSave, menuConfig.tableName);
        const rowId = sanitized.RecID as string;
        const shapeId = sanitized.ShapeID as string;

        const currentList = tableDataRef.current ?? [];
        const nextList = [...currentList];
        const matchIndex = nextList.findIndex(
          (r) =>
            (r.RecID && r.RecID === rowId) ||
            (r.ShapeID && shapeId && r.ShapeID === shapeId)
        );

        const isUpdate = matchIndex >= 0;

        if (isUpdate) {
          nextList[matchIndex] = sanitized;
        } else {
          nextList.push(sanitized);
        }

        tableDataRef.current = nextList;
        setTableData(nextList);
        await persistRecords(nextList);

        // Log Add or Edit operation
        void logOperation(isUpdate ? "updated" : "added", sanitized);

        return sanitized;
      } finally {
        statusBarContext?.setIsLoading?.(false);
        statusBarContext?.setLoadingLabel?.(undefined);
      }
    },
    [menuConfig.tableName, persistRecords, logOperation, statusBarContext]
  );

  // 6. Delete handler invoked by OneToManyFormContainer
  const handleDeleteRecord = useCallback(
    async (recordToDelete: Record<string, unknown>) => {
      statusBarContext?.setIsLoading?.(true);
      statusBarContext?.setLoadingLabel?.("Loading...");
      try {
        const deleteRecId = recordToDelete.RecID as string | undefined;
        const deleteShapeId = recordToDelete.ShapeID as string | undefined;

        const currentList = tableDataRef.current ?? [];
        const nextList = currentList.filter((r) => {
          if (deleteRecId && r.RecID && r.RecID === deleteRecId) return false;
          if (deleteShapeId && r.ShapeID && r.ShapeID === deleteShapeId) return false;
          return r !== recordToDelete;
        });

        tableDataRef.current = nextList;
        setTableData(nextList);
        await persistRecords(nextList);

        // Log Delete operation
        void logOperation("deleted", recordToDelete);
      } finally {
        statusBarContext?.setIsLoading?.(false);
        statusBarContext?.setLoadingLabel?.(undefined);
      }
    },
    [persistRecords, logOperation, statusBarContext]
  );

  // Synchronize internal state when grid updates without duplicate Firestore writes
  const handleDataChange = useCallback(
    (updated: Record<string, unknown>[]) => {
      const sanitizedList = updated as IPortOrSlotRow[];
      tableDataRef.current = sanitizedList;
      setTableData(sanitizedList);
    },
    []
  );

  const tableDefinition = useMemo(
    () => ({
      tableName: menuConfig.tableName,
      tableLabel: menuConfig.tableLabel,
      properties: menuConfig.properties,
    }),
    [menuConfig]
  );

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <OneToManyFormContainer
        key={`${menuConfig.tableName}-${effectiveEqid}`}
        uniqueName={`eqid-${menuConfig.tableName.toLowerCase()}-${effectiveEqid}`}
        containerName="EQIDSidebar"
        tableDefinition={tableDefinition}
        tableData={tableData}
        selectedNode={selectedNode}
        isAllowCustomHeader={false}
        hideHeaderSaveButton={true}
        hideSaveButton={true}
        featureId={featureId}
        isReadOnly={isReadOnly}
        handleSaveOneToManyRecords={handleSaveRecords}
        handleDeleteOneToManyRecord={handleDeleteRecord}
        onDataChange={handleDataChange}
      />
    </div>
  );
};

export default EQIDOneToManyContainer;
