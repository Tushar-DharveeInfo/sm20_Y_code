import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { EQIDEditForm, getEqtypes } from '@n20a/libform';
import { IEqidDoc, useFirestore, useActivities } from '@n20a/libfsdb';
import { useRmsContext } from '../../../context/hooks/RmsHooks';
import { useSelectedNodeContext } from '../../../context/hooks/SelectedNodeHooks';
import { useMainAppContext } from '../../../context/hooks/MainAppHooks';
import { useSmDataContext } from '../../../context/hooks/SmDataHooks';
import { useStatusBarContext } from '../../../context/hooks/StatusBarHooks';
import { FnLogActivity } from '../../../allcommon/basic/FnLogActivity';
import { Label } from '../../../basic/label/Label';
import { YesNoFormContainer } from '../../../basic/yesnoformcontainer/YesNoFormContainer';
import { useMfgCollections } from './MfgCollectionsService';
import { DirtyFlagImage } from '../../../basic/dirtyflagimage/DirtyFlagImage';
import { IImage } from '../../../allinterface/basic/IImage';
import { Save24x24 } from '@n20a/libicon';
import { FnGetCssVariable } from '../../../../appcontainer/allcommon/FnGetCssVariable';

interface IEQIDPropertiesPaneProps {
  ticket?: any;
  featureId?: string;
}

function getLastValue(value: string): string {
  return (value || '').split('__').pop() || '';
}

/**
 * Extracts the manufacturer acronym from an EQID string.
 * NetZoom EQIDs follow the convention: <Acronym><3-digit sequence> (e.g. 0GCC001 -> 0GCC, 257S001 -> 257S).
 */
function extractAcronymFromEqid(eqid: string, mfgKeys: string[] = []): string {
  if (!eqid) return '';
  const pureEqid = getLastValue(eqid).trim();
  if (!pureEqid) return '';

  const upper = pureEqid.toUpperCase();
  const sortedKeys = [...mfgKeys].sort((a, b) => b.length - a.length);
  const matchedKey = sortedKeys.find((k) => upper.startsWith(k.toUpperCase()));
  if (matchedKey) return matchedKey;

  if (pureEqid.length > 3) {
    const withoutLast3 = pureEqid.slice(0, -3);
    if (withoutLast3) return withoutLast3;
  }

  return pureEqid;
}

export const EQIDPropertiesPane: React.FC<IEQIDPropertiesPaneProps> = ({ ticket, featureId }) => {
  const rmsContext = useRmsContext();
  const selectedNodeContext = useSelectedNodeContext();
  const mainAppContext = useMainAppContext();
  const smDataContext = useSmDataContext();
  const statusBarContext = useStatusBarContext();
  const firestore = useFirestore();

  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    showOkButton: boolean;
  }>({
    isOpen: false,
    title: 'Information',
    message: '',
    showOkButton: true,
  });

  const isSavingRef = useRef<boolean>(false);
  const latestEditFormRecordRef = useRef<Record<string, unknown>>({});
  const initialRecordRef = useRef<IEqidDoc | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const showMessageDialog = useCallback((msg: string, title = 'Information') => {
    setDialog({
      isOpen: true,
      title,
      message: msg,
      showOkButton: true,
    });
  }, []);

  // Priority: prop ticket -> selectedNodeContext.selectedTicketCard -> rmsContext.selectedTicketCard
  const activeTicket = ticket ?? selectedNodeContext?.selectedTicketCard ?? rmsContext?.selectedTicketCard;
  const isNewRecord = Boolean((activeTicket as any)?.isNewRecord);
  const ticketId = isNewRecord
    ? ''
    : String(
      activeTicket?.ticketid ||
      (activeTicket as any)?.TicketId ||
      (activeTicket as any)?.TicketID ||
      (activeTicket as any)?.ticketId ||
      activeTicket?.id ||
      ''
    ).trim();
  const targetEqid = isNewRecord
    ? ''
    : String(
      activeTicket?.EQID ||
      activeTicket?.eqid ||
      (activeTicket as any)?.eqId ||
      (activeTicket as any)?.MfgEQID ||
      (activeTicket as any)?.selectedMfgEQID ||
      ''
    ).trim().toLowerCase();
  const mfg = isNewRecord ? '' : (activeTicket?.mfg || activeTicket?.Manufacturer || '');

  // Cloud collections hook for mfg, eqidallocated, mfgvsprodline, mfgvsmfgeqtype
  const mfgCollections = useMfgCollections(firestore);

  // Target BID and user CID for activity logging
  const targetBid = useMemo(() => {
    return String(
      activeTicket?.bid ||
      mainAppContext?.authSession?.bid ||
      smDataContext?.selection?.bid ||
      ''
    ).trim();
  }, [activeTicket?.bid, mainAppContext?.authSession?.bid, smDataContext?.selection?.bid]);

  const userCid = useMemo(() => {
    return String(
      mainAppContext?.authSession?.cid ||
      mainAppContext?.authSession?.username ||
      'User'
    ).trim();
  }, [mainAppContext?.authSession?.cid, mainAppContext?.authSession?.username]);

  const { createActivity } = useActivities(targetBid || 'none');

  // 1. Load EQID dataset if not yet loaded (guarded to avoid re-trigger loops)
  const hasLoadedEqidRef = useRef<boolean>(false);
  useEffect(() => {
    if (!hasLoadedEqidRef.current && (!rmsContext?.eqid || rmsContext.eqid.length === 0) && rmsContext?.loadEqid) {
      hasLoadedEqidRef.current = true;
      void rmsContext.loadEqid();
    }
  }, [rmsContext?.loadEqid, rmsContext?.eqid?.length]);

  // 2. Locate existing EQID record (conforming to IEqidDoc) or initialize from the ticket
  const initialEQIDRecord = useMemo<IEqidDoc>(() => {
    if (isNewRecord || (!targetEqid && !ticketId)) {
      return {
        Acronym: '',
        EQID: '',
        eqid: '',
        Manufacturer: '',
        mfg: '',
        mfgkey: '',
        MfgProdLine: '',
        ProdLine: '',
        prodline: '',
        Eqtype: '',
        EqType: '',
        eqtype: '',
        MfgEqtype: '',
        MfgProdNo: '',
        prodno: '',
        MfgDesc: '',
        description: '',
      } as unknown as IEqidDoc;
    }

    const existing = (rmsContext?.eqid ?? []).find(
      (e: any) =>
        (targetEqid && (
          String(e.EQID || '').trim().toLowerCase() === targetEqid ||
          String(e.eqid || '').trim().toLowerCase() === targetEqid ||
          String(e.id || '').trim().toLowerCase() === targetEqid
        )) ||
        (ticketId && e.ticketid && String(e.ticketid).trim().toLowerCase() === ticketId.toLowerCase())
    );

    // Resolve EQID
    const rawTicketEqid = String(
      (existing as any)?.EQID ||
      (existing as any)?.eqid ||
      (existing as any)?.id ||
      activeTicket?.EQID ||
      activeTicket?.eqid ||
      (activeTicket as any)?.eqId ||
      (activeTicket as any)?.MfgEQID ||
      (activeTicket as any)?.selectedMfgEQID ||
      ''
    ).trim();
    const resolvedEqid = getLastValue(rawTicketEqid);

    // Resolve Manufacturer
    const rawMfg =
      (existing as any)?.Manufacturer ||
      (existing as any)?.mfg ||
      activeTicket?.Manufacturer ||
      activeTicket?.mfg ||
      mfg ||
      '';
    const resolvedMfg = mfgCollections.mfgMap[rawMfg] || rawMfg;

    // Resolve Acronym / mfgkey
    const resolvedMfgKey =
      mfgCollections.resolveMfgKey(resolvedMfg) ||
      (existing as any)?.mfgkey ||
      (existing as any)?.mfg ||
      activeTicket?.mfgkey ||
      '';

    const resolvedAcronym =
      (existing as any)?.Acronym ||
      (existing as any)?.acronym ||
      activeTicket?.Acronym ||
      resolvedMfgKey ||
      extractAcronymFromEqid(resolvedEqid, mfgCollections.mfgKeys) ||
      (resolvedMfg ? resolvedMfg.substring(0, 4).toUpperCase() : '');

    // Resolve ProdLine (form uses MfgProdLine & ProdLine)
    const resolvedProdLine =
      (existing as any)?.MfgProdLine ||
      (existing as any)?.ProdLine ||
      (existing as any)?.prodline ||
      activeTicket?.MfgProdLine ||
      activeTicket?.ProdLine ||
      activeTicket?.prodline ||
      '';

    // Resolve Eqtype (form uses Eqtype)
    const resolvedEqtype =
      (existing as any)?.Eqtype ||
      (existing as any)?.EqType ||
      (existing as any)?.eqtype ||
      activeTicket?.Eqtype ||
      activeTicket?.EqType ||
      activeTicket?.eqtype ||
      '';

    // Resolve MfgEqtype
    const resolvedMfgEqtype =
      (existing as any)?.MfgEqtype ||
      (existing as any)?.mfgeqtype ||
      activeTicket?.MfgEqtype ||
      activeTicket?.mfgeqtype ||
      '';

    // Resolve ProdNo (form uses MfgProdNo)
    const resolvedProdNo =
      (existing as any)?.MfgProdNo ||
      (existing as any)?.prodno ||
      (existing as any)?.ProdNo ||
      activeTicket?.MfgProdNo ||
      activeTicket?.prodno ||
      activeTicket?.ProdNo ||
      '';

    // Resolve Description (form uses MfgDesc)
    const resolvedDesc =
      (existing as any)?.MfgDesc ||
      (existing as any)?.mfgdesc ||
      (existing as any)?.description ||
      (existing as any)?.Description ||
      activeTicket?.MfgDesc ||
      activeTicket?.description ||
      activeTicket?.Description ||
      '';

    return {
      ...(activeTicket ?? {}),
      ...(existing ?? {}),
      bid: (existing as any)?.bid || activeTicket?.bid || '',
      cid: (existing as any)?.cid || activeTicket?.cid || '',
      ticketid: (existing as any)?.ticketid || ticketId,
      EQID: resolvedEqid,
      eqid: resolvedEqid,
      Acronym: resolvedAcronym,
      acronym: resolvedAcronym,
      Manufacturer: resolvedMfg,
      mfg: resolvedMfgKey || resolvedMfg,
      mfgkey: resolvedMfgKey,
      MfgProdLine: resolvedProdLine,
      ProdLine: resolvedProdLine,
      prodline: resolvedProdLine,
      Eqtype: resolvedEqtype,
      EqType: resolvedEqtype,
      eqtype: resolvedEqtype,
      MfgEqtype: resolvedMfgEqtype,
      mfgeqtype: resolvedMfgEqtype,
      MfgProdNo: resolvedProdNo,
      prodno: resolvedProdNo,
      ProdNo: resolvedProdNo,
      MfgDesc: resolvedDesc,
      mfgdesc: resolvedDesc,
      description: resolvedDesc,
      Description: resolvedDesc,
      shapeid: (existing as any)?.shapeid || activeTicket?.shapeid || [],
    } as unknown as IEqidDoc;
  }, [
    rmsContext?.eqid,
    ticketId,
    targetEqid,
    mfg,
    activeTicket,
    mfgCollections.mfgMap,
    mfgCollections.mfgKeys,
    isNewRecord,
  ]);

  const [currentRecord, setCurrentRecord] = useState<IEqidDoc>(initialEQIDRecord);
  const prevRecordKeyRef = useRef<string>('');

  useEffect(() => {
    if (!initialRecordRef.current) {
      initialRecordRef.current = initialEQIDRecord;
    }
  }, [initialEQIDRecord]);

  const recordSyncKey = useMemo(() => {
    if (isNewRecord) {
      return `new-${String((activeTicket as any)?.key || 'record')}`;
    }
    const resolvedEqid = String(initialEQIDRecord?.EQID || '');
    const mfgVal = String(initialEQIDRecord?.Manufacturer || '');
    const acronymVal = String(initialEQIDRecord?.Acronym || '');
    const prodNoVal = String((initialEQIDRecord as any)?.MfgProdNo || (initialEQIDRecord as any)?.prodno || '');
    const prodLineVal = String((initialEQIDRecord as any)?.MfgProdLine || (initialEQIDRecord as any)?.ProdLine || '');
    return `${ticketId}__${resolvedEqid}__${mfgVal}__${acronymVal}__${prodNoVal}__${prodLineVal}`;
  }, [isNewRecord, (activeTicket as any)?.key, ticketId, initialEQIDRecord]);

  useEffect(() => {
    if (recordSyncKey && prevRecordKeyRef.current !== recordSyncKey) {
      prevRecordKeyRef.current = recordSyncKey;
      setCurrentRecord(initialEQIDRecord);
      initialRecordRef.current = initialEQIDRecord;
      latestEditFormRecordRef.current = {};
      setIsDirty(false);
    }
  }, [recordSyncKey, initialEQIDRecord]);

  // When cloud mfgMap finishes loading, translate any key (e.g. "0CMS") to name (e.g. "Generic CommScope")
  useEffect(() => {
    if (currentRecord?.Manufacturer && mfgCollections.mfgMap[currentRecord.Manufacturer]) {
      const mappedName = mfgCollections.mfgMap[currentRecord.Manufacturer];
      if (mappedName && mappedName !== currentRecord.Manufacturer) {
        setCurrentRecord((prev) => ({
          ...prev,
          Manufacturer: mappedName,
        }));
        if (initialRecordRef.current) {
          initialRecordRef.current = {
            ...initialRecordRef.current,
            Manufacturer: mappedName,
          } as unknown as IEqidDoc;
        }
      }
    }
  }, [mfgCollections.mfgMap, currentRecord?.Manufacturer]);

  // getAcronym(): string[] - return mfgkey only in the dropdown (ex. "0CMS", "0GBE", etc.)
  const getAcronym = useCallback((): string[] => {
    return mfgCollections.mfgKeys;
  }, [mfgCollections.mfgKeys]);

  // 1. getMfg(): string[] - from cloud, populate with manufacturer names (ex. "Generic CommScope")
  const getMfg = useCallback((): string[] => {
    return mfgCollections.getMfg();
  }, [mfgCollections]);

  // 2. getEQIDAllocated(mfgkey: string): string[] - from cloud eqidallocated collection
  const getEQIDAllocated = useCallback((mfgkey: string): string[] => {
    const raw = (mfgkey || currentRecord?.Manufacturer || currentRecord?.Acronym || mfg || '').trim();
    const allocated = Array.from(
      new Set(mfgCollections.getEQIDAllocated(raw).map((item) => getLastValue(item)).filter(Boolean))
    );
    const rawCurrentEqid = String(
      currentRecord?.EQID ||
      (currentRecord as any)?.eqid ||
      targetEqid ||
      ''
    ).trim();
    const currentEqid = getLastValue(rawCurrentEqid);
    if (currentEqid && !allocated.includes(currentEqid)) {
      return [currentEqid, ...allocated];
    }
    return allocated;
  }, [currentRecord?.Manufacturer, currentRecord?.Acronym, currentRecord?.EQID, (currentRecord as any)?.eqid, mfg, targetEqid, mfgCollections]);

  // getEqType(): string[] - valid eqtype options
  const getEqType = useCallback((): string[] => {
    return getEqtypes();
  }, []);

  // 3. getMfgProdLine(mfgkey: string): string[] - from cloud mfgvsprodline collection
  const getMfgProdLine = useCallback((mfgkey: string): string[] => {
    const raw = (mfgkey || currentRecord?.Manufacturer || currentRecord?.Acronym || mfg || '').trim();
    return mfgCollections.getMfgProdLine(raw);
  }, [currentRecord?.Manufacturer, currentRecord?.Acronym, mfg, mfgCollections]);

  // 4. getMfgEqType(eqtype: string): string[] - from cloud mfgvsmfgeqtype collection
  const getMfgEqType = useCallback((eqtype: string): string[] => {
    const key = (eqtype || currentRecord?.Eqtype || currentRecord?.MfgEqtype || '').trim();
    return mfgCollections.getMfgEqType(key);
  }, [currentRecord?.Eqtype, currentRecord?.MfgEqtype, mfgCollections]);

  const handleFormChange = useCallback(() => {
    setIsDirty(true);
  }, []);

  // Updates in-memory record without triggering cloud saving loops
  const handleFormValuesChange = useCallback((updatedEQIDRecord: IEqidDoc) => {
    if (!updatedEQIDRecord) return;
    latestEditFormRecordRef.current = {
      ...latestEditFormRecordRef.current,
      ...(updatedEQIDRecord as unknown as Record<string, unknown>),
    };
    if (initialRecordRef.current) {
      const keysToCheck = [
        'Acronym',
        'EQID',
        'eqid',
        'Manufacturer',
        'mfg',
        'ProdLine',
        'prodline',
        'Eqtype',
        'MfgEqtype',
        'MfgProdNo',
        'MfgDesc',
      ];
      const hasChanged = keysToCheck.some((k) => {
        const valA = String((updatedEQIDRecord as any)[k] ?? '').trim();
        const valB = String((initialRecordRef.current as any)[k] ?? '').trim();
        return valA !== valB;
      });
      if (hasChanged) {
        setIsDirty(true);
      }
    }
  }, []);

  // Explicit Save handler: saves to cloud & eqid table, plus logs activity
  const handleSaveEQID = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      statusBarContext?.setIsLoading?.(true);
      statusBarContext?.setLoadingLabel?.('Saving EQID properties...');

      const mergedRecord = {
        ...(currentRecord as unknown as Record<string, unknown>),
        ...latestEditFormRecordRef.current,
      };

      const rawEqidKey = String(
        mergedRecord.EQID || mergedRecord.eqid || currentRecord?.EQID || ''
      ).trim();
      const eqidKey = getLastValue(rawEqidKey) || rawEqidKey;
      if (!eqidKey) {
        showMessageDialog('Error: Please enter or select an EQID.');
        return;
      }

      const manufacturerValue = (mergedRecord.Manufacturer as string) || currentRecord?.Manufacturer || mfg || '';
      const resolvedKey = mfgCollections.resolveMfgKey(manufacturerValue) || (mergedRecord.Acronym as string) || '';
      const dataToSave = {
        ...mergedRecord,
        EQID: eqidKey,
        eqid: eqidKey,
        ticketid:
          (activeTicket?.NodeType === 'Ticket' ? ticketId : '') ||
          (mergedRecord as any)?.ticketid ||
          ticketId,
        Manufacturer: manufacturerValue,
        Acronym: (mergedRecord.Acronym as string) || resolvedKey,
        mfg: resolvedKey,
        mfgkey: resolvedKey,
        lastupdated: new Date().toISOString(),
      };
      delete (dataToSave as any).isNewRecord;

      // Save to cloud Firestore root collection 'eqid'
      if (firestore) {
        await firestore.upsertDocument({
          pathSegments: ['eqid', eqidKey],
          data: dataToSave,
        });
      }

      // Update local RMS context state
      if (rmsContext?.setEqid) {
        rmsContext.setEqid((prev: any[]) => {
          const list = prev ?? [];
          const idx = list.findIndex(
            (e: any) =>
              (e.eqid && (getLastValue(e.eqid) === eqidKey || e.eqid === eqidKey)) ||
              (e.EQID && (getLastValue(e.EQID) === eqidKey || e.EQID === eqidKey)) ||
              (e.id && e.id === eqidKey) ||
              (ticketId && e.ticketid && e.ticketid === ticketId)
          );
          if (idx >= 0) {
            const next = [...list];
            next[idx] = { ...next[idx], ...dataToSave };
            return next;
          }
          return [...list, dataToSave];
        });
      }

      // Update selected ticket card in selectedNodeContext if currently active
      const savedEqid = String(eqidKey).trim().toLowerCase();
      if (selectedNodeContext?.setSelectedTicketCard && selectedNodeContext?.selectedTicketCard) {
        const currentSelected = selectedNodeContext.selectedTicketCard;
        const curEqid = String(currentSelected.EQID || currentSelected.eqid || '').trim().toLowerCase();
        if (currentSelected.isNewRecord || currentSelected.ticketid === ticketId || currentSelected.id === ticketId || (curEqid && curEqid === savedEqid)) {
          selectedNodeContext.setSelectedTicketCard({
            ...currentSelected,
            ...dataToSave,
            isNewRecord: false,
          });
        }
      }

      if (rmsContext?.setSelectedTicketCard && rmsContext?.selectedTicketCard) {
        const currentRmsSelected = rmsContext.selectedTicketCard;
        const curEqid = String(currentRmsSelected.EQID || currentRmsSelected.eqid || '').trim().toLowerCase();
        if (currentRmsSelected.isNewRecord || currentRmsSelected.ticketid === ticketId || currentRmsSelected.id === ticketId || (curEqid && curEqid === savedEqid)) {
          rmsContext.setSelectedTicketCard({
            ...currentRmsSelected,
            ...dataToSave,
            isNewRecord: false,
          });
        }
      }

      // Write forensic activity log
      const bidPart = targetBid ? ` of ${targetBid}` : '';
      const message = `${userCid}${bidPart} updated EQID record for EQID "${eqidKey}" successfully.`;
      try {
        await FnLogActivity({
          bid: targetBid,
          cid: userCid,
          message,
          createActivity: targetBid ? createActivity : undefined,
          createActivityLog: mainAppContext?.createActivityLog,
          updateDataset: smDataContext?.updateDataset,
          currentActivities: smDataContext?.datasets?.activities,
        });
      } catch (logErr) {
        console.warn('EQIDPropertiesPane: Failed to log activity:', logErr);
      }

      setCurrentRecord(dataToSave as unknown as IEqidDoc);
      initialRecordRef.current = dataToSave as unknown as IEqidDoc;
      latestEditFormRecordRef.current = {};
      setIsDirty(false);
      showMessageDialog(message);
    } catch (err) {
      console.error('Failed to save EQID to cloud:', err);
      showMessageDialog('Failed to save EQID record to cloud.');
    } finally {
      isSavingRef.current = false;
      statusBarContext?.setIsLoading?.(false);
      statusBarContext?.setLoadingLabel?.(undefined);
    }
  }, [
    currentRecord,
    ticketId,
    mfg,
    mfgCollections,
    firestore,
    rmsContext,
    selectedNodeContext,
    targetBid,
    userCid,
    createActivity,
    mainAppContext?.createActivityLog,
    smDataContext?.updateDataset,
    smDataContext?.datasets?.activities,
    statusBarContext,
    showMessageDialog,
    activeTicket?.NodeType,
  ]);

  const saveImageData: IImage = useMemo(
    () => ({
      uniqueName: 'eqid-properties-save-icon',
      source: (
        <Save24x24
          size={FnGetCssVariable('--image-size-1')}
          fill="none"
          strokeWidth={1}
        />
      ),
      w: 'var(--image-size-2)',
      tooltip: 'Save EQID Properties',
    }),
    []
  );

  if (!isNewRecord && !ticketId && !targetEqid) {
    return (
      <div style={{ padding: '20px', color: '#666', textAlign: 'center' }}>
        Select an EQID or ticket to view and edit properties.
      </div>
    );
  }

  const activeMfgName = mfgCollections.getMfgTooltip(currentRecord?.Manufacturer || mfg);

  return (
    <div
      className="nz-eqid-properties-container"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
    >
      <div className="nz-sub-header">
        <Label uniqueName="eqid-properties-header" label="EQID Properties" />
        {isDirty && (
          <div className="nz-save-button">
            <DirtyFlagImage
              uniqueName="eqid-properties-save-icon"
              isDirty={isDirty}
              bgColor="#FFFF99"
              image={saveImageData}
              w="var(--node_height)"
              h="var(--node_height)"
              handleMouse={handleSaveEQID}
            />
          </div>
        )}
      </div>

      {activeMfgName && (
        <div
          title={activeMfgName}
          style={{
            fontSize: '11px',
            color: '#555',
            padding: '4px 8px',
            margin: '4px 8px',
            backgroundColor: '#f5f7fa',
            borderRadius: '4px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            Manufacturer: <strong>{currentRecord?.Manufacturer || mfg}</strong>
            {activeMfgName && activeMfgName !== (currentRecord?.Manufacturer || mfg) ? ` (${activeMfgName})` : ''}
          </span>
          {mfgCollections.loading && <span style={{ color: '#888', fontSize: '10px' }}>Syncing cloud...</span>}
        </div>
      )}

      <div
        className="spa-demo-section"
        onInput={handleFormChange}
        onChange={handleFormChange}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
      >
        <EQIDEditForm
          key={
            isNewRecord
              ? `new_${(activeTicket as any)?.key || 'record'}_${currentRecord?.Acronym || ''}`
              : `${ticketId}_${currentRecord?.EQID || ''}_${currentRecord?.Acronym || ''}_${currentRecord?.Manufacturer || ''}`
          }
          EQIDRecord={currentRecord as unknown as IEqidDoc}
          getAcronym={getAcronym}
          getMfg={getMfg}
          getEQIDAllocated={getEQIDAllocated}
          getMfgProdLine={getMfgProdLine}
          getEqType={getEqType}
          getMfgEqType={getMfgEqType}
          SaveEQID={handleFormValuesChange}
        />
      </div>

      {isDirty && (
        <div style={{ padding: '6px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fff' }}>
          <button
            type="button"
            className="nz-primary-button"
            onClick={handleSaveEQID}
            style={{
              padding: '4px 14px',
              backgroundColor: '#1e40af',
              color: '#ffffff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            Save EQID
          </button>
        </div>
      )}

      <YesNoFormContainer
        uniqueName="eqid-properties-dialog"
        isOpen={dialog.isOpen}
        message={dialog.message}
        dialogTitle={dialog.title}
        showOkButton={dialog.showOkButton}
        handleOkButtonClick={() => {
          setDialog((prev) => ({ ...prev, isOpen: false }));
        }}
      />
    </div>
  );
};

export default EQIDPropertiesPane;
