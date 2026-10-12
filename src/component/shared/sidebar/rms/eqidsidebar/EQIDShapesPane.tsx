import React, { useMemo, useState, useEffect } from 'react';
import stylesData from '../rmscollection/Style.json';
import { IShapeStyle, IEqid } from '../rmscollection/IEqid';
import { useRmsContext } from '../../../context/hooks/RmsHooks';
import { useFirestore } from '@n20a/libfsdb';
import { Delete24x24 } from '@n20a/libicon';

interface IEQIDShapesPaneProps {
  ticket: any;
}

export const EQIDShapesPane: React.FC<IEQIDShapesPaneProps> = ({ ticket }) => {
  const rmsContext = useRmsContext();
  const firestore = useFirestore();

  const ticketId = ticket?.ticketid || ticket?.id || '';
  const stylesList = useMemo(() => stylesData as IShapeStyle[], []);

  // Locate the EQID record for this ticket
  const currentEqidRecord = useMemo(() => {
    const found = (rmsContext?.eqid ?? []).find(
      (e: any) => (e.ticketid && e.ticketid === ticketId) || (e.eqid && (e.eqid === ticket?.eqid || e.eqid === ticketId))
    );
    if (found) {
      return {
        ...found,
        shapeid: Array.isArray((found as any).shapeid) ? (found as any).shapeid : [],
      };
    }
    return {
      bid: ticket?.bid ?? '',
      cid: ticket?.cid ?? '',
      ticketid: ticketId,
      eqid: ticket?.eqid || ticketId,
      Manufacturer: ticket?.mfg || '',
      MfgProdNo: ticket?.prodno || '',
      Eqtype: ticket?.eqtype || '',
      shapeid: [] as string[],
    };
  }, [rmsContext?.eqid, ticketId, ticket]);

  const [shapeIds, setShapeIds] = useState<string[]>(currentEqidRecord.shapeid || []);
  const [selectedStyleCode, setSelectedStyleCode] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  useEffect(() => {
    setShapeIds(currentEqidRecord.shapeid || []);
  }, [currentEqidRecord.shapeid]);

  const effectiveEqid = (currentEqidRecord as any).eqid || currentEqidRecord.ticketid || ticketId;

  // Helper to resolve style profile from a shapeid string
  const resolveStyleForShapeId = (shapeId: string): IShapeStyle | undefined => {
    // Expected formats: "{eqid}_{Style}", "{eqid}_{StyleAcronym}", "{eqid}-{Style}", etc.
    const parts = shapeId.split(/[_-]/);
    const suffix = parts.length > 1 ? parts[parts.length - 1] : shapeId;
    return (
      stylesList.find((s) => s.Style === suffix || s.StyleAcronym === suffix) ||
      stylesList.find((s) => shapeId.endsWith(s.Style) || shapeId.endsWith(s.StyleAcronym))
    );
  };

  // Filter available styles that haven't been added yet
  const availableStyles = useMemo(() => {
    return stylesList.filter((s) => {
      const candidate1 = `${effectiveEqid}_${s.Style}`;
      const candidate2 = `${effectiveEqid}_${s.StyleAcronym}`;
      return !shapeIds.includes(candidate1) && !shapeIds.includes(candidate2);
    });
  }, [stylesList, shapeIds, effectiveEqid]);

  const persistShapeIds = async (updatedShapeIds: string[]) => {
    const docId = effectiveEqid;
    if (!docId) return;

    try {
      const updatedDoc = {
        ...currentEqidRecord,
        eqid: docId,
        shapeid: updatedShapeIds,
        lastupdated: new Date().toISOString(),
      };

      if (firestore) {
        await firestore.setDocument({
          pathSegments: ['eqid', docId],
          data: updatedDoc,
        });
      }

      if (rmsContext?.setEqid) {
        rmsContext.setEqid((prev) => {
          const idx = prev.findIndex((e: any) => e.ticketid === docId || e.eqid === docId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...updatedDoc };
            return next;
          }
          return [...prev, updatedDoc as any];
        });
      }

      setShapeIds(updatedShapeIds);
      setToastMessage('Shapes updated successfully');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Failed to update shapeid in Firestore:', err);
      setToastMessage('Failed to update shapes');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleAddStyle = async () => {
    if (!selectedStyleCode) return;
    const styleObj = stylesList.find((s) => s.Style === selectedStyleCode);
    const newShapeId = `${effectiveEqid}_${styleObj?.StyleAcronym || selectedStyleCode}`;

    if (shapeIds.includes(newShapeId)) return;

    const next = [...shapeIds, newShapeId];
    await persistShapeIds(next);
    setSelectedStyleCode('');
  };

  const handleDeleteShapeId = async (shapeIdToDelete: string) => {
    const next = shapeIds.filter((id) => id !== shapeIdToDelete);
    await persistShapeIds(next);
  };

  if (!effectiveEqid) {
    return (
      <div style={{ padding: '20px', color: '#666', textAlign: 'center' }}>
        Select a ticket to manage EQID shapes.
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '12px', background: '#fff', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>EQID Shapes: {effectiveEqid}</span>
          <div style={{ fontSize: '11px', color: '#6c757d' }}>Configured Shapes: {shapeIds.length}</div>
        </div>
      </div>

      {toastMessage && (
        <div style={{
          padding: '6px 10px',
          borderRadius: '4px',
          background: toastMessage.includes('Failed') ? '#f8d7da' : '#d4edda',
          color: toastMessage.includes('Failed') ? '#721c24' : '#155724',
          fontSize: '12px',
          fontWeight: 600,
        }}>
          {toastMessage}
        </div>
      )}

      {/* Add Style Form */}
      <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '6px', padding: '10px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#495057', display: 'block', marginBottom: '6px' }}>
          Add Style Profile
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={selectedStyleCode}
            onChange={(e) => setSelectedStyleCode(e.target.value)}
            style={{
              flex: 1,
              height: '32px',
              borderRadius: '4px',
              border: '1px solid #ced4da',
              padding: '0 8px',
              fontSize: '12px',
              background: '#fff',
            }}
          >
            <option value="">-- Select from Style.json ({availableStyles.length} available) --</option>
            {availableStyles.map((s) => (
              <option key={s.Style} value={s.Style}>
                [{s.StyleAcronym}] {s.Description}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddStyle}
            disabled={!selectedStyleCode}
            style={{
              height: '32px',
              padding: '0 14px',
              background: selectedStyleCode ? '#007ad9' : '#b0bec5',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedStyleCode ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Add Style
          </button>
        </div>
      </div>

      {/* Shapes Table */}
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e9ecef', borderRadius: '6px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#f1f3f5', borderBottom: '1px solid #dee2e6', textAlign: 'left', color: '#495057' }}>
              <th style={{ padding: '8px' }}>Shape ID</th>
              <th style={{ padding: '8px' }}>Acronym</th>
              <th style={{ padding: '8px' }}>Description</th>
              <th style={{ padding: '8px', textAlign: 'center', width: '60px' }}>Delete</th>
            </tr>
          </thead>
          <tbody>
            {shapeIds.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#888' }}>
                  No styles configured for this EQID. Use the selector above to add shapes.
                </td>
              </tr>
            ) : (
              shapeIds.map((shapeId) => {
                const styleDef = resolveStyleForShapeId(shapeId);
                return (
                  <tr key={shapeId} style={{ borderBottom: '1px solid #f1f3f5' }}>
                    <td style={{ padding: '8px', fontWeight: 600, color: '#007ad9' }}>{shapeId}</td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{styleDef?.StyleAcronym || '-'}</td>
                    <td style={{ padding: '8px', color: '#495057' }}>{styleDef?.Description || 'Custom Style'}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteShapeId(shapeId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#dc3545',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '2px',
                        }}
                        title="Delete Shape"
                      >
                        <Delete24x24 size="16px" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EQIDShapesPane;
