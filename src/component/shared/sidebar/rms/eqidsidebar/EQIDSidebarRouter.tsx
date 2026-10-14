import React, { useMemo } from 'react';
import { EQIDPropertiesPane } from './EQIDPropertiesPane';
import { EQIDNotesPane } from './EQIDNotesPane';
import { FqaEqidToDo } from './FqaEqidToDo';
import { EQIDExploreAIPane } from './EQIDExploreAIPane';
import { useSelectedNodeContext } from '../../../context/hooks/SelectedNodeHooks';
import { useSmDataContext } from '../../../context/hooks/SmDataHooks';
import { useRmsContext } from '../../../context/hooks/RmsHooks';
import { ITreeNode } from '../../../allinterface/tree/ITreeControl';
import { IMenuItem } from '../../../allinterface/menu/IMainMenu';
import { EQIDOneToManyContainer } from './EQIDOneToManyContainer';
import { EQIDStylesContainer } from './EQIDStylesContainer';

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

  // Resolve the active ticket:
  // 1. From selectedNodeContext.selectedTicketCard / rmsContext.selectedTicketCard
  // 2. Direct from selectedNode if it has ticket properties
  // 3. From selectedNodeContext.selectedNode
  // 4. From smDataContext tickets dataset matching the active business/contact
  const activeTicket = useMemo(() => {
    const cardFromCtx =
      (selectedNodeContext as any)?.selectedTicketCard ??
      (selectedNodeContext as any)?.SelectedTicketCard ??
      (rmsContext as any)?.selectedTicketCard ??
      (rmsContext as any)?.SelectedTicketCard;

    if (cardFromCtx) {
      return cardFromCtx;
    }

    if (selectedNode && (selectedNode.ticketid || (selectedNode as any).prodno || selectedNode.NodeType === 'Ticket')) {
      return selectedNode;
    }

    const ctxNode = selectedNodeContext?.selectedNode;
    if (ctxNode && (ctxNode.ticketid || (ctxNode as any).prodno || ctxNode.NodeType === 'Ticket')) {
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
  }, [selectedNodeContext?.selectedTicketCard, selectedNode, selectedNodeContext?.selectedNode, smDataContext?.datasets?.tickets, smDataContext?.selection?.bid, smDataContext?.selection?.cid]);

  const eqid = (activeTicket as any)?.eqid || (activeTicket as any)?.EQID || (activeTicket as any)?.eqId || '';

  const cleanLabel = (Label || '').trim().toLowerCase();

  const subMenuKey = (selectedNodeMenu?.Name || selectedNodeMenu?.Label || SubMenuKey.Property).toLowerCase().replace(/[\s()]+/g, '');

  switch (true) {
    case cleanLabel === 'eqid' || cleanLabel.includes('property') || cleanLabel.includes('properties'): {
      if (subMenuKey === SubMenuKey.ShapeStyles || subMenuKey === SubMenuKey.HardwareShapes) {
        return <EQIDStylesContainer uniqueName="fqa-eqid-styles" label={selectedNodeMenu?.Label || 'Shape Styles'} />;
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

      return <EQIDPropertiesPane ticket={activeTicket} />;
    }

    case cleanLabel === 'notes' || cleanLabel.includes('notes'):
      return (
        <EQIDNotesPane
          uniqueName="fqa-eqid-notes"
          eqid={eqid}
          ticket={activeTicket}
          selectedNode={selectedNode}
        />
      );

    // case cleanLabel === 'shapes' || cleanLabel.includes('shapes'):
    //   return <EQIDShapesPane ticket={activeTicket} />;

    case cleanLabel === 'todo' || cleanLabel.includes('todo'):
      return (
        <FqaEqidToDo
          uniqueName="fqa-eqid-todo"
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

    default:
      return <EQIDPropertiesPane ticket={activeTicket} />;
  }
};

export default EQIDSidebarRouter;
