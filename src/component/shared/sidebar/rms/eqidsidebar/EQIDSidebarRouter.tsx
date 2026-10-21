import React, { useMemo } from 'react';
import { EQIDPropertiesPane } from './EQIDPropertiesPane';
import { EQIDNotesPane } from './EQIDNotesPane';
import { EQIDReminder } from './EQIDReminder';
import { EQIDExploreAIPane } from './EQIDExploreAIPane';
import { useSelectedNodeContext } from '../../../context/hooks/SelectedNodeHooks';
import { useSmDataContext } from '../../../context/hooks/SmDataHooks';
import { useRmsContext } from '../../../context/hooks/RmsHooks';
import { ITreeNode } from '../../../allinterface/tree/ITreeControl';
import { IMenuItem } from '../../../allinterface/menu/IMainMenu';
import { EQIDOneToManyContainer } from './EQIDOneToManyContainer';
import { EQIDStylesContainer } from './EQIDStylesContainer';
import { RmsEnums } from '../../../../constants/Feature';

export enum SubMenuKey {
  Property = 'property',
  ShapeStyles = 'shapestyles',
  HardwareShapes = 'hardwareshapes',
  PowerPorts = 'powerports',
  NetworkPorts = 'networkports',
  Slot = 'slot',
  Slots = 'slots',
  InOutPort = 'inoutport',
  InOutPorts = 'inoutports',
  Url = 'url',
  Urls = 'urls',
  EqidRelation = 'eqidrelation',
  EqidRelations = 'eqidrelations',
}

export type EQIDSubMenuKey = SubMenuKey;
export const EQIDSubMenuKey = SubMenuKey;

interface IEQIDSidebarRouterProps {
  Label: string;
  selectedNode?: ITreeNode;
  featureId?: string;
  selectedNodeMenu?: IMenuItem;
}

export const EQIDSidebarRouter: React.FC<IEQIDSidebarRouterProps> = ({ Label, selectedNode, selectedNodeMenu, featureId }) => {
  const selectedNodeContext = useSelectedNodeContext();
  const smDataContext = useSmDataContext();
  let rmsContext: any = null;
  try {
    rmsContext = useRmsContext();
  } catch {
    // Handled if rendered outside RmsProvider
  }

  const isMfgMode = featureId === RmsEnums.EQIDByMfg || featureId === '404';

  // Resolve the active ticket:
  // For EQID by Mfg: resolve directly from selectedNode / selectedNodeContext for this EQID
  // For EQID by Ticket: preserve EXACT existing logic
  const activeTicket = useMemo(() => {
    if (isMfgMode) {
      if ((selectedNode as any)?.isNewRecord) {
        return {
          ...(selectedNode as any),
          NodeType: 'EQID',
          treetype: 'EQID',
          nodeType: 'EQID',
          ticketid: '',
          id: '',
          eqid: '',
          EQID: '',
          Acronym: '',
          Manufacturer: '',
          mfg: '',
          ProdLine: '',
          prodline: '',
          EqType: '',
          eqtype: '',
          isNewRecord: true,
        };
      }

      const rawType = String(
        (selectedNode as any)?.nodeType ??
        (selectedNode as any)?.NodeType ??
        (selectedNode as any)?.treetype ??
        ''
      ).toLowerCase();

      const targetEqid = String(
        (selectedNode as any)?.EQID ||
        (selectedNode as any)?.eqid ||
        (selectedNode as any)?.eqidRecord?.EQID ||
        (selectedNode as any)?.eqidRecord?.eqid ||
        (rawType === 'eqid' ? selectedNode?.Name : '') ||
        ''
      ).trim();

      if (targetEqid) {
        const cleanTarget = targetEqid.toLowerCase();
        const existingRecord = (rmsContext?.eqid ?? []).find(
          (e: any) =>
            String(e.EQID || e.eqid || e.id || '').trim().toLowerCase() === cleanTarget
        );
        const source = existingRecord ?? (selectedNode as any)?.eqidRecord ?? selectedNode;
        const ticketIdFromEqid = String(source?.ticketid || '').trim();
        const matchingTicket = ticketIdFromEqid
          ? (smDataContext?.datasets?.tickets ?? []).find(
              (t: any) => t.ticketid === ticketIdFromEqid || t.id === ticketIdFromEqid
            )
          : null;
        const bid = String(source?.bid || matchingTicket?.bid || smDataContext?.selection?.bid || '').trim();
        const cid = String(source?.cid || matchingTicket?.cid || smDataContext?.selection?.cid || '').trim();

        const shapeId = String(
          (selectedNode as any)?.ShapeID ||
          (selectedNode as any)?.shapeId ||
          (selectedNode as any)?.shapeStyleData?.styleId ||
          (selectedNode as any)?.styleId ||
          (selectedNodeContext?.selectedNode as any)?.ShapeID ||
          (selectedNodeContext?.selectedNode as any)?.shapeId ||
          (selectedNodeContext?.selectedNode as any)?.shapeStyleData?.styleId ||
          (selectedNodeContext?.selectedTicketCard as any)?.ShapeID ||
          (selectedNodeContext?.selectedTicketCard as any)?.shapeId ||
          ''
        ).trim();

        return {
          ...(source ?? {}),
          NodeType: 'EQID',
          treetype: 'EQID',
          nodeType: 'EQID',
          ticketid: source?.ticketid || targetEqid,
          id: targetEqid,
          eqid: targetEqid,
          EQID: targetEqid,
          bid,
          cid,
          prodno: source?.prodno || source?.ProdNo || '',
          mfg: source?.Manufacturer || source?.mfg || '',
          Manufacturer: source?.Manufacturer || source?.mfg || '',
          prodline: source?.ProdLine || source?.prodline || '',
          ProdLine: source?.ProdLine || source?.prodline || '',
          eqtype: source?.EqType || source?.eqtype || '',
          EqType: source?.EqType || source?.eqtype || '',
          ShapeID: shapeId,
          shapeId: shapeId,
          shapeStyleData: (selectedNode as any)?.shapeStyleData || (selectedNodeContext?.selectedNode as any)?.shapeStyleData,
        };
      }
      return selectedNode ?? null;
    }

    const cardFromCtx =
      (selectedNodeContext as any)?.selectedTicketCard ??
      (selectedNodeContext as any)?.SelectedTicketCard ??
      (rmsContext as any)?.selectedTicketCard ??
      (rmsContext as any)?.SelectedTicketCard;

    if (cardFromCtx) {
      return cardFromCtx;
    }

    if (
      selectedNode &&
      (selectedNode.ticketid ||
        (selectedNode as any).prodno ||
        selectedNode.NodeType === 'Ticket' ||
        selectedNode.NodeType === 'EQID' ||
        (selectedNode as any).eqid ||
        (selectedNode as any).EQID)
    ) {
      return selectedNode;
    }

    const ctxNode = selectedNodeContext?.selectedNode;
    if (
      ctxNode &&
      (ctxNode.ticketid ||
        (ctxNode as any).prodno ||
        ctxNode.NodeType === 'Ticket' ||
        ctxNode.NodeType === 'EQID' ||
        (ctxNode as any).eqid ||
        (ctxNode as any).EQID)
    ) {
      return ctxNode;
    }

    // Fallback: Find ticket matching selected node business/contact
    const targetBid = String(smDataContext.selection?.bid ?? selectedNode?.bid ?? selectedNode?.parentEntID ?? '').trim();
    const targetCid = String(smDataContext.selection?.cid ?? selectedNode?.cid ?? (selectedNode?.NodeType === 'Contact' ? selectedNode?.NodeEntID : '') ?? '').trim();

    const allTickets = smDataContext?.datasets?.tickets ?? [];
    if (targetBid && allTickets.length > 0) {
      if (targetCid) {
        const exactMatch = allTickets.find((t) => t.bid === targetBid && t.cid === targetCid);
        if (exactMatch) return exactMatch;
      }
      const bidMatch = allTickets.find((t) => t.bid === targetBid);
      if (bidMatch) return bidMatch;
      return null;
    }

    // Default to first ticket only if at root / no selection
    if (!targetBid && !targetCid && allTickets.length > 0) {
      return allTickets[0] ?? null;
    }

    return null;
  }, [
    isMfgMode,
    selectedNode,
    selectedNodeContext?.selectedTicketCard,
    selectedNodeContext?.selectedNode,
    rmsContext?.eqid,
    smDataContext?.datasets?.tickets,
    smDataContext?.selection?.bid,
    smDataContext?.selection?.cid,
  ]);

  const eqid =
    (activeTicket as any)?.eqid ||
    (activeTicket as any)?.EQID ||
    (activeTicket as any)?.eqId ||
    (selectedNode as any)?.eqid ||
    (selectedNode as any)?.EQID ||
    (selectedNode as any)?.parentEqid ||
    (selectedNode as any)?.shapeStyleData?.eqid ||
    '';

  const cleanLabel = (Label || '').trim().toLowerCase();

  const subMenuKey = (selectedNodeMenu?.Name || selectedNodeMenu?.Label || SubMenuKey.Property).toLowerCase().replace(/[\s()]+/g, '');

  switch (true) {
    case cleanLabel === 'eqid' || cleanLabel.includes('property') || cleanLabel.includes('properties') || cleanLabel === 'add eqid' || cleanLabel.includes('add eqid'): {
      if (subMenuKey === SubMenuKey.ShapeStyles || subMenuKey === SubMenuKey.HardwareShapes) {
        return (
          <EQIDStylesContainer
            uniqueName="fqa-eqid-styles"
            label={selectedNodeMenu?.Label || 'Shape Styles'}
            eqid={eqid}
            ticket={activeTicket}
            selectedNode={selectedNode}
            featureId={featureId}
          />
        );
      }
      if (subMenuKey === SubMenuKey.PowerPorts) {
        return (
          <EQIDOneToManyContainer
            ticket={activeTicket}
            menuKey={SubMenuKey.PowerPorts}
            selectedNode={selectedNode}
            featureId={featureId}
          />
        );
      }
      if (subMenuKey === SubMenuKey.NetworkPorts) {
        return (
          <EQIDOneToManyContainer
            ticket={activeTicket}
            menuKey={SubMenuKey.NetworkPorts}
            selectedNode={selectedNode}
            featureId={featureId}
          />
        );
      }
      if (subMenuKey === SubMenuKey.Slot || subMenuKey === SubMenuKey.Slots) {
        return (
          <EQIDOneToManyContainer
            ticket={activeTicket}
            menuKey={SubMenuKey.Slot}
            selectedNode={selectedNode}
            featureId={featureId}
          />
        );
      }
      if (subMenuKey === SubMenuKey.InOutPort || subMenuKey === SubMenuKey.InOutPorts || subMenuKey.includes('inout')) {
        return (
          <EQIDOneToManyContainer
            ticket={activeTicket}
            menuKey={SubMenuKey.InOutPort}
            selectedNode={selectedNode}
            featureId={featureId}
          />
        );
      }
      if (subMenuKey === SubMenuKey.Url || subMenuKey === SubMenuKey.Urls || subMenuKey.includes('url')) {
        return (
          <EQIDOneToManyContainer
            ticket={activeTicket}
            menuKey={SubMenuKey.Url}
            selectedNode={selectedNode}
            featureId={featureId}
          />
        );
      }
      if (
        subMenuKey === SubMenuKey.EqidRelation ||
        subMenuKey === SubMenuKey.EqidRelations ||
        subMenuKey.includes('eqidrelation') ||
        subMenuKey.includes('relation')
      ) {
        return (
          <EQIDOneToManyContainer
            ticket={activeTicket}
            menuKey={SubMenuKey.EqidRelation}
            selectedNode={selectedNode}
            featureId={featureId}
          />
        );
      }

      return <EQIDPropertiesPane ticket={activeTicket} />;
    }

    case cleanLabel === 'notes' || cleanLabel.includes('notes'):
      return (
        <EQIDNotesPane
          uniqueName="fqa-eqid-notes"
          featureId={featureId}
          eqid={eqid}
          ticket={activeTicket}
          selectedNode={selectedNode}
        />
      );

    // case cleanLabel === 'shapes' || cleanLabel.includes('shapes'):
    //   return <EQIDShapesPane ticket={activeTicket} />;

    case cleanLabel === 'reminder' || cleanLabel.includes('reminder') || cleanLabel === 'todo' || cleanLabel.includes('todo'):
      return (
        <EQIDReminder
          uniqueName="fqa-eqid-reminder"
          featureId={featureId}
          eqid={eqid}
          ticket={activeTicket}
          selectedNode={selectedNode}
        />
      );

    case cleanLabel === 'ai' || cleanLabel.includes('ai'):
      return (
        <EQIDExploreAIPane
          key={`eqid-ai-${(activeTicket as any)?.mfg || (activeTicket as any)?.Manufacturer || ''}-${eqid}`}
          eqid={eqid}
          ticket={activeTicket}
        />
      );

    case cleanLabel.includes('power'):
      return (
        <EQIDOneToManyContainer
          ticket={activeTicket}
          menuKey={SubMenuKey.PowerPorts}
          selectedNode={selectedNode}
          featureId={featureId}
        />
      );

    case cleanLabel.includes('network'):
      return (
        <EQIDOneToManyContainer
          ticket={activeTicket}
          menuKey={SubMenuKey.NetworkPorts}
          selectedNode={selectedNode}
          featureId={featureId}
        />
      );

    case cleanLabel.includes('slot'):
      return (
        <EQIDOneToManyContainer
          ticket={activeTicket}
          menuKey={SubMenuKey.Slot}
          selectedNode={selectedNode}
          featureId={featureId}
        />
      );

    case cleanLabel.includes('inout') || cleanLabel.includes('plug'):
      return (
        <EQIDOneToManyContainer
          ticket={activeTicket}
          menuKey={SubMenuKey.InOutPort}
          selectedNode={selectedNode}
          featureId={featureId}
        />
      );

    case cleanLabel.includes('url'):
      return (
        <EQIDOneToManyContainer
          ticket={activeTicket}
          menuKey={SubMenuKey.Url}
          selectedNode={selectedNode}
          featureId={featureId}
        />
      );

    case cleanLabel.includes('relation'):
      return (
        <EQIDOneToManyContainer
          ticket={activeTicket}
          menuKey={SubMenuKey.EqidRelation}
          selectedNode={selectedNode}
          featureId={featureId}
        />
      );

    default:
      return <EQIDPropertiesPane ticket={activeTicket} />;
  }
};

export default EQIDSidebarRouter;
