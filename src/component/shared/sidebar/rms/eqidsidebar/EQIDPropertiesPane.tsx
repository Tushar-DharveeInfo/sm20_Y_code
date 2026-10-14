import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { EQIDEditForm, getEqtypes } from '@n20a/libform';
import { IEqidDoc } from '@n20a/libfsdb';
import { useRmsContext } from '../../../context/hooks/RmsHooks';
import { useSelectedNodeContext } from '../../../context/hooks/SelectedNodeHooks';
import { useFirestore } from '@n20a/libfsdb';
import { useMfgCollections } from './MfgCollectionsService';

interface IEQIDPropertiesPaneProps {
  ticket?: any;
}

function getLastValue(value: string): string {
  return (value || '').split('__').pop() || '';
}

export const EQIDPropertiesPane: React.FC<IEQIDPropertiesPaneProps> = ({ ticket }) => {
  const rmsContext = useRmsContext();
  const selectedNodeContext = useSelectedNodeContext();
  const firestore = useFirestore();
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Priority: prop ticket -> selectedNodeContext.selectedTicketCard -> rmsContext.selectedTicketCard
  const activeTicket = ticket ?? selectedNodeContext?.selectedTicketCard ?? rmsContext?.selectedTicketCard;
  const ticketId = activeTicket?.ticketid || activeTicket?.id || '';
  const mfg = activeTicket?.mfg || activeTicket?.Manufacturer || '';

  // Cloud collections hook for mfg, eqidallocated, mfgvsprodline, mfgvsmfgeqtype
  const mfgCollections = useMfgCollections(firestore);

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
    const existing = (rmsContext?.eqid ?? []).find(
      (e: any) =>
        e.ticketid && e.ticketid === ticketId
    );
    const rawTicketEqid = String(
      (existing as any)?.EQID || (existing as any)?.eqid || activeTicket?.EQID || activeTicket?.eqid || ticketId
    ).trim();
    const ticketEqid = getLastValue(rawTicketEqid);

    const rawExistingMfg = (existing as any)?.Manufacturer || (existing as any)?.mfg || activeTicket?.Manufacturer || mfg || '';
    const mfgDisplayName = mfgCollections.mfgMap[rawExistingMfg] || mfgCollections.mfgMap[String(rawExistingMfg).toUpperCase()] || rawExistingMfg;

    if (existing) {
      const existingEqid = getLastValue(String((existing as any).EQID || (existing as any).eqid || ticketEqid).trim());
      return {
        ...existing,
        // Manufacturer: mfgDisplayName,
        // EQID: existingEqid,
        // eqid: existingEqid,
        // shapeid: (existing as any).shapeid ?? [],
      } as unknown as IEqidDoc;
    }

    const resolvedMfgKey = mfgCollections.resolveMfgKey(mfg);
    const defaultAcronym = resolvedMfgKey || (mfg ? mfg.substring(0, 4).toUpperCase() : '');
    return {
      ...(activeTicket ?? {}),
      bid: activeTicket?.bid ?? '',
      cid: activeTicket?.cid ?? '',
      ticketid: ticketId,
      EQID: ticketEqid,
      eqid: ticketEqid,
      Acronym: activeTicket?.Acronym ?? defaultAcronym,
      // Manufacturer: mfgDisplayName,
      // MfgProdLine: activeTicket?.MfgProdLine ?? activeTicket?.prodline ?? '',
      // Eqtype: activeTicket?.Eqtype ?? activeTicket?.eqtype ?? 'Server',
      // MfgEqtype: activeTicket?.MfgEqtype ?? activeTicket?.mfgeqtype ?? '',
      // MfgProdNo: activeTicket?.MfgProdNo ?? activeTicket?.prodno ?? '',
      // MfgDesc: activeTicket?.MfgDesc ?? activeTicket?.moreinfo ?? '',
      shapeid: activeTicket?.shapeid ?? [],
    } as unknown as IEqidDoc;
  }, [
    rmsContext?.eqid,
    ticketId,
    mfg,
    activeTicket?.eqid,
    activeTicket?.EQID,
    activeTicket?.prodno,
    activeTicket?.prodline,
    activeTicket?.eqtype,
    activeTicket?.mfgeqtype,
    mfgCollections.mfgMap,
  ]);

  const [currentRecord, setCurrentRecord] = useState<IEqidDoc>(initialEQIDRecord);
  const prevRecordTicketIdRef = useRef<string>('');

  useEffect(() => {
    if (ticketId && prevRecordTicketIdRef.current !== ticketId) {
      prevRecordTicketIdRef.current = ticketId;
      setCurrentRecord(initialEQIDRecord);
    }
  }, [ticketId, initialEQIDRecord]);

  // When cloud mfgMap finishes loading, translate any key (e.g. "0CMS") to name (e.g. "Generic CommScope")
  useEffect(() => {
    if (currentRecord?.Manufacturer && mfgCollections.mfgMap[currentRecord.Manufacturer]) {
      const mappedName = mfgCollections.mfgMap[currentRecord.Manufacturer];
      if (mappedName && mappedName !== currentRecord.Manufacturer) {
        setCurrentRecord((prev) => ({
          ...prev,
          Manufacturer: mappedName,
        }));
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
  // Includes current ticket's EQID so the combo displays it and allows selection based on the ticket
  const getEQIDAllocated = useCallback((mfgkey: string): string[] => {
    const raw = (mfgkey || currentRecord?.Manufacturer || currentRecord?.Acronym || mfg || '').trim();
    const allocated = Array.from(
      new Set(mfgCollections.getEQIDAllocated(raw).map((item) => getLastValue(item)).filter(Boolean))
    );
    const rawCurrentEqid = String(currentRecord?.EQID || (currentRecord as any)?.eqid || ticketId).trim();
    const currentEqid = getLastValue(rawCurrentEqid);
    if (currentEqid && !allocated.includes(currentEqid)) {
      return [currentEqid, ...allocated];
    }
    return allocated;
  }, [currentRecord?.Manufacturer, currentRecord?.Acronym, currentRecord?.EQID, (currentRecord as any)?.eqid, mfg, ticketId, mfgCollections]);

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

  // 5. SaveEQID(updatedEQIDRecord: IEqidDoc): void - save to cloud
  const handleSaveEQID = async (updatedEQIDRecord: IEqidDoc) => {
    console.log('SaveEQID called with:', updatedEQIDRecord);
    try {
      const rawEqidKey = String(
        updatedEQIDRecord.EQID || (updatedEQIDRecord as any).eqid || updatedEQIDRecord.ticketid || ticketId
      ).trim();
      const eqidKey = getLastValue(rawEqidKey) || rawEqidKey;
      if (!eqidKey) {
        setSaveMessage('Error: Missing EQID or ticket ID.');
        return;
      }

      const resolvedKey = mfgCollections.resolveMfgKey(updatedEQIDRecord.Manufacturer);
      const dataToSave = {
        ...(updatedEQIDRecord as unknown as Record<string, unknown>),
        EQID: eqidKey,
        eqid: eqidKey,
        ticketid: ticketId,
        Manufacturer: updatedEQIDRecord.Manufacturer,
        mfg: resolvedKey,
        mfgkey: resolvedKey,
        lastupdated: new Date().toISOString(),
      };

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
              (e.ticketid && e.ticketid === ticketId) ||
              (e.eqid && (getLastValue(e.eqid) === eqidKey || e.eqid === ticketId)) ||
              (e.EQID && (getLastValue(e.EQID) === eqidKey || e.EQID === ticketId))
          );
          if (idx >= 0) {
            const next = [...list];
            next[idx] = { ...next[idx], ...dataToSave };
            return next;
          }
          return [...list, dataToSave];
        });
      }

      setCurrentRecord({ ...updatedEQIDRecord, EQID: eqidKey, eqid: eqidKey } as unknown as IEqidDoc);
      setSaveMessage('EQID record saved to cloud successfully.');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save EQID to cloud:', err);
      setSaveMessage('Failed to save EQID record to cloud.');
    }
  };

  if (!ticketId) {
    return (
      <div style={{ padding: '20px', color: '#666', textAlign: 'center' }}>
        Select a ticket to view and edit EQID properties.
      </div>
    );
  }

  const activeMfgName = mfgCollections.getMfgTooltip(currentRecord?.Manufacturer || mfg);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div className='nz-sub-header'>
        EQID Properties
      </div>
      {activeMfgName && (
        <div
          title={activeMfgName}
          style={{
            fontSize: '11px',
            color: '#555',
            padding: '4px 8px',
            marginBottom: '6px',
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

      <div className="spa-demo-section" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <EQIDEditForm
          EQIDRecord={currentRecord as unknown as IEqidDoc}
          getAcronym={getAcronym}
          getMfg={getMfg}
          getEQIDAllocated={getEQIDAllocated}
          getMfgProdLine={getMfgProdLine}
          getEqType={getEqType}
          getMfgEqType={getMfgEqType}
          SaveEQID={(updatedEQIDRecord) => {
            void handleSaveEQID(updatedEQIDRecord as unknown as IEqidDoc);
          }}
        />
      </div>
    </div>
  );
};

export default EQIDPropertiesPane;
