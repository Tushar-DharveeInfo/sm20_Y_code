import React, { useMemo } from 'react';
import { AiMcpAiMcpRequestShapeClient } from '@n20a/libmcpclient';
import '@n20a/libmcpclient/style.css';
import { useSelectedNodeContext } from '../../../context/hooks/SelectedNodeHooks';
import { useRmsContext } from '../../../context/hooks/RmsHooks';

interface IEQIDExploreAIPaneProps {
  eqid?: string;
  ticket?: any;
}

export const EQIDExploreAIPane: React.FC<IEQIDExploreAIPaneProps> = (props) => {
  const selectedNodeContext = useSelectedNodeContext();
  let rmsContext: any = null;
  try {
    rmsContext = useRmsContext();
  } catch {
    // Handled if rendered outside RmsProvider
  }

  // Resolve active ticket from selectedTicketCard context with fallbacks
  const selectedTicket = useMemo(() => {
    return (
      (selectedNodeContext as any)?.selectedTicketCard ??
      (selectedNodeContext as any)?.SelectedTicketCard ??
      (rmsContext as any)?.selectedTicketCard ??
      (rmsContext as any)?.SelectedTicketCard ??
      props.ticket ??
      selectedNodeContext?.selectedNode ??
      null
    );
  }, [
    (selectedNodeContext as any)?.selectedTicketCard,
    (selectedNodeContext as any)?.SelectedTicketCard,
    (rmsContext as any)?.selectedTicketCard,
    (rmsContext as any)?.SelectedTicketCard,
    props.ticket,
    selectedNodeContext?.selectedNode,
  ]);

  const currentTicket = (selectedTicket as any)?.ticketRecord ?? selectedTicket;

  const ticketId = useMemo(() => {
    return String(
      currentTicket?.ticketid ||
      currentTicket?.id ||
      currentTicket?.NodeEntID ||
      props.ticket?.ticketid ||
      ''
    ).trim();
  }, [currentTicket, props.ticket?.ticketid]);

  const matchingRmsEqidRecord = useMemo(() => {
    if (!ticketId || !rmsContext?.eqid) return null;
    return (rmsContext.eqid ?? []).find(
      (e: any) => e.ticketid && e.ticketid === ticketId
    );
  }, [ticketId, rmsContext?.eqid]);

  const mfg = useMemo(() => {
    return String(
      currentTicket?.mfg ||
      currentTicket?.Mfg ||
      currentTicket?.MFG ||
      currentTicket?.manufacturer ||
      currentTicket?.Manufacturer ||
      props.ticket?.mfg ||
      props.ticket?.Mfg ||
      props.ticket?.Manufacturer ||
      (matchingRmsEqidRecord as any)?.Manufacturer ||
      (matchingRmsEqidRecord as any)?.mfg ||
      ''
    ).trim();
  }, [currentTicket, props.ticket?.mfg, props.ticket?.Mfg, props.ticket?.Manufacturer, matchingRmsEqidRecord]);

  const prodNo = useMemo(() => {
    return String(
      currentTicket?.prodno ||
      currentTicket?.ProdNo ||
      currentTicket?.prodNo ||
      currentTicket?.MfgProdNo ||
      (matchingRmsEqidRecord as any)?.MfgProdNo ||
      (matchingRmsEqidRecord as any)?.prodno ||
      currentTicket?.model ||
      props.ticket?.prodno ||
      ''
    ).trim();
  }, [currentTicket, props.ticket?.prodno, matchingRmsEqidRecord]);

  const eqType = useMemo(() => {
    return String(
      currentTicket?.eqtype ||
      currentTicket?.EqType ||
      currentTicket?.eqType ||
      currentTicket?.MfgEqtype ||
      (matchingRmsEqidRecord as any)?.MfgEqtype ||
      (matchingRmsEqidRecord as any)?.Eqtype ||
      currentTicket?.equipmenttype ||
      props.ticket?.eqtype ||
      ''
    ).trim();
  }, [currentTicket, props.ticket?.eqtype, matchingRmsEqidRecord]);

  const rawEqid = useMemo(() => {
    return String(
      props.eqid ||
      currentTicket?.eqid ||
      currentTicket?.EQID ||
      currentTicket?.eqId ||
      props.ticket?.eqid ||
      props.ticket?.EQID ||
      ''
    ).trim();
  }, [props.eqid, currentTicket, props.ticket?.eqid, props.ticket?.EQID]);

  const foundEqid = rawEqid || String(matchingRmsEqidRecord?.EQID || matchingRmsEqidRecord?.eqid || '').trim();
  const cleanEqid = (foundEqid.includes('__') ? foundEqid.split('__').pop() : foundEqid) || foundEqid;
  const effectiveEqid = cleanEqid || foundEqid || ticketId;

  const moreInfo = useMemo(() => {
    return String(
      currentTicket?.moreinfo ||
      currentTicket?.MoreInfo ||
      currentTicket?.notes ||
      (cleanEqid ? `EQID: ${cleanEqid}` : effectiveEqid ? `EQID: ${effectiveEqid}` : '')
    ).trim();
  }, [currentTicket, cleanEqid, effectiveEqid]);

  const searchText = useMemo(() => {
    return cleanEqid || effectiveEqid || (mfg && prodNo ? `${mfg} ${prodNo}` : prodNo || mfg || ticketId || '');
  }, [cleanEqid, effectiveEqid, mfg, prodNo, ticketId]);

  if (!selectedTicket && !effectiveEqid && !mfg && !prodNo) {
    return (
      <div style={{ padding: '20px', color: '#666', textAlign: 'center' }}>
        Select a ticket to explore EQID in AI.
      </div>
    );
  }

  return (
    <div key={`explore-ai-pane-${mfg}`} style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="nz-sub-header">
        Explore EQID in AI
      </div>
      <AiMcpAiMcpRequestShapeClient
        key={`ai-mcp-client-${mfg}-${prodNo}-${ticketId}-${effectiveEqid}`}
        searchText={searchText}
        Mfg={mfg}
        ProdNo={prodNo}
        EqType={eqType}
        MoreInfo={moreInfo}
      />
    </div>
  );
};

export default EQIDExploreAIPane;
