import React, { useMemo } from 'react';
import EQIDStyles from '../rmscollection/EQIDStyles';
import { Label } from '../../../basic/label/Label';
import { useRmsContext } from '../../../context/hooks/RmsHooks';
import { useStatusBarContext } from '../../../context/hooks/StatusBarHooks';
import { useFirestore } from '@n20a/libfsdb';
import { extractShapeStylesForEqid } from '../../../../features/rms/eqidbymfg/EqidByMfgTree';
import { ITreeNode } from '../../../../allinterface/tree/ITreeControl';

export interface IEQIDStylesContainerProps {
    uniqueName: string;
    label?: string;
    eqid?: string;
    ticket?: any;
    selectedNode?: ITreeNode;
    featureId?: string;
}

export const EQIDStylesContainer: React.FC<IEQIDStylesContainerProps> = ({
    uniqueName,
    label = 'Shape Styles',
    eqid: propEqid,
    ticket,
    selectedNode,
}) => {
    const rmsContext = useRmsContext();
    const statusBarContext = useStatusBarContext();
    const firestore = useFirestore();

    const effectiveEqid = useMemo(() => {
        return String(
            propEqid ||
            ticket?.EQID ||
            ticket?.eqid ||
            ticket?.eqId ||
            ticket?.ticketid ||
            (selectedNode as any)?.EQID ||
            (selectedNode as any)?.eqid ||
            (selectedNode as any)?.parentEqid ||
            (selectedNode as any)?.shapeStyleData?.eqid ||
            ''
        ).trim();
    }, [propEqid, ticket, selectedNode]);

    const initialStyles = useMemo(() => {
        if (!effectiveEqid) return [];
        const record = (rmsContext?.eqid ?? []).find(
            (e: any) => String(e.EQID || e.eqid || e.id || '').trim().toLowerCase() === effectiveEqid.toLowerCase()
        ) ?? ticket ?? selectedNode;
        const styles = extractShapeStylesForEqid(record, effectiveEqid);
        const styleIds = styles.map((s) => s.id).filter(Boolean);
        if (styleIds.length > 0) {
            return styleIds;
        }
        return [`${effectiveEqid}F:H`];
    }, [effectiveEqid, rmsContext?.eqid, ticket, selectedNode]);

    const handleSave = async (savedStyles: string[]) => {
        if (!effectiveEqid) return;
        statusBarContext?.setIsLoading?.(true);
        statusBarContext?.setLoadingLabel?.('Saving shape styles...');
        try {
            if (firestore) {
                await firestore.upsertDocument({
                    pathSegments: ['eqid', effectiveEqid],
                    data: {
                        ShapeStyles: savedStyles,
                        shapeStyles: savedStyles,
                        lastupdated: new Date().toISOString(),
                    },
                });
            }
            if (rmsContext?.setEqid) {
                rmsContext.setEqid((prev: any[]) => {
                    return (prev ?? []).map((e: any) => {
                        const eEqid = String(e.EQID || e.eqid || e.id || '').trim().toLowerCase();
                        if (eEqid === effectiveEqid.toLowerCase()) {
                            return {
                                ...e,
                                ShapeStyles: savedStyles,
                                shapeStyles: savedStyles,
                                lastupdated: new Date().toISOString(),
                            };
                        }
                        return e;
                    });
                });
            }
            if (rmsContext?.loadEqid) {
                await rmsContext.loadEqid();
            }
        } catch (error) {
            console.error('Failed to save shape styles:', error);
        } finally {
            statusBarContext?.setIsLoading?.(false);
            statusBarContext?.setLoadingLabel?.(undefined);
        }
    };

    return (
        <div key={`${uniqueName}-${effectiveEqid}`} className='nz-eqid-styles-container' style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className='nz-sub-header'>
                <Label uniqueName={`${uniqueName}-header`} label={label} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <EQIDStyles
                    key={`styles-${effectiveEqid}`}
                    initialStyles={initialStyles}
                    onSave={handleSave}
                />
            </div>
        </div>
    );
};
