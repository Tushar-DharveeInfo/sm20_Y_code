import React from 'react';
import { CardLayout, ICardLayoutField } from '../../../shared/cardlayout/CardLayout';
import { FnFormatTicketDate } from '../../../shared/allcommon/tree/FnFormatTicketDate';
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable';
import { LibraryColor128x128, NetZoom24x24, Visio } from '@n20a/libicon';
import { useBusinessTickets } from '@n20a/libfsdb';
import type { ITicketDoc, IContactDoc } from '../../../shared/allinterface/IDatasets';
import './TicketCard.css';

interface ITicketCardProps {
    uniqueName: string;
    ticket: ITicketDoc;
    contact: IContactDoc | undefined;
    purchasedSkus: string[];
    isSelected: boolean;
    onSelect: (ticket: ITicketDoc) => void;
    onSkuClick?: (sku: string, ticket: ITicketDoc) => void;
    onStatusChange?: (ticket: ITicketDoc, newStatus: string) => void;
}

/**
 * Returns an icon element for known SKUs, or null if no icon exists.
 * If null is returned, the SKU text is displayed instead.
 */
function getSkuIcon(sku: string): React.ReactNode | null {
    const key = (sku || '').trim().toLowerCase();
    if (key === 'netzoom' || key === 'nz' || key.includes('netzoom')) {
        return <NetZoom24x24 size="16px" />;
    }
    if (key === 'visiostencils' || key === 'visio' || key === 'vss' || key.includes('visio')) {
        return <Visio size="16px" />;
    }
    return null;
}

function getStatusColor(status?: string): string {
    const s = (status ?? '').trim().toLowerCase();
    if (s === 'resolved' || s === 'accepted' || s === 'released') {
        return 'green';
    }
    if (s === 'in progress' || s === 'pending' || s === 'need info') {
        return 'orange';
    }
    if (s === 'open') {
        return '#007ad9';
    }
    if (s === 'received') {
        return '#0288d1';
    }
    if (s === 'close' || s === 'closed') {
        return '#6c757d';
    }
    if (s === 'not accepted' || s === 'discarded') {
        return '#d9534f';
    }
    return 'inherit';
}

const TicketCard: React.FC<ITicketCardProps> = ({
    uniqueName,
    ticket,
    contact,
    purchasedSkus,
    isSelected,
    onSelect,
    onSkuClick,
    onStatusChange,
}) => {
    const { updateTicket } = useBusinessTickets(ticket.bid || '');
    const [localStatus, setLocalStatus] = React.useState<string>(ticket.status ?? '');

    React.useEffect(() => {
        setLocalStatus(ticket.status ?? '');
    }, [ticket.status]);

    const handleSkuClick = (
        event: React.MouseEvent<HTMLButtonElement>,
        sku: string
    ) => {
        event.stopPropagation();
        console.log(`[SKU Clicked] SKU: "${sku}", ticket: "${ticket.ticketid}"`);
        onSkuClick?.(sku, ticket);
    };

    const handleStatusUpdate = async (newStatus: string) => {
        setLocalStatus(newStatus);
        ticket.status = newStatus;
        const nowIso = new Date().toISOString();
        ticket.lastupdated = nowIso;

        if (newStatus.toLowerCase() === 'close') {
            console.log('Sending email on ticket close for ticket:', ticket.ticketid, ticket);
        }

        const ticketId = ticket.ticketid || ((ticket as unknown as Record<string, unknown>).id as string) || '';
        if (ticket.bid && ticketId) {
            try {
                await updateTicket(ticketId, {
                    status: newStatus,
                    lastupdated: nowIso,
                });
            } catch (err) {
                console.error('Failed to update ticket status via hook:', err);
            }
        }

        onStatusChange?.(ticket, newStatus);
    };

    const rawStatus = (localStatus ?? '').trim();
    let displayedStatus = rawStatus;
    if (!rawStatus || rawStatus.toLowerCase() === 'received') {
        displayedStatus = 'Received';
    } else if (rawStatus.toLowerCase() === 'open') {
        displayedStatus = 'Open';
    } else if (rawStatus.toLowerCase() === 'close' || rawStatus.toLowerCase() === 'closed') {
        displayedStatus = 'Close';
    } else if (rawStatus.toLowerCase() === 'not accepted') {
        displayedStatus = 'Not Accepted';
    }

    let actionButton: 'Accept' | 'Close' | 'Reopen' | null = null;
    const lowerStatus = displayedStatus.toLowerCase();
    if (lowerStatus === 'received' || lowerStatus === 'not accepted') {
        actionButton = 'Accept';
    } else if (lowerStatus === 'open' || lowerStatus === 'in progress') {
        actionButton = 'Close';
    } else if (lowerStatus === 'close') {
        actionButton = 'Reopen';
    }

    const isClose = lowerStatus === 'close';
    const isNotAccepted = lowerStatus === 'not accepted';
    const showDiscardButton = !isClose && !isNotAccepted;

    const statusColor = getStatusColor(displayedStatus);

    const fields: ICardLayoutField[] = [
        {
            Name: 'Ticket',
            Value: ticket.ticketid || '—',
            Header: 1,
        },
        {
            Name: '',
            Value: displayedStatus || '—',
            Header: 2,
            ValueContent: (
                <div className="nz-ticket-header-actions">
                    {showDiscardButton && (
                        <button
                            type="button"
                            className="nz-ticket-action-btn nz-ticket-action-btn-discard"
                            title="Discard ticket"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleStatusUpdate('Not Accepted');
                            }}
                        >
                            Discard
                        </button>
                    )}
                    {actionButton && (
                        <button
                            type="button"
                            className={`nz-ticket-action-btn nz-ticket-action-btn-${actionButton.toLowerCase()}`}
                            title={`${actionButton} ticket`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (actionButton === 'Accept' || actionButton === 'Reopen') {
                                    handleStatusUpdate('Open');
                                } else if (actionButton === 'Close') {
                                    handleStatusUpdate('Close');
                                }
                            }}
                        >
                            {actionButton}
                        </button>
                    )}
                    {/* <span
                        className="nz-ticket-status-label"
                        style={{
                            color: statusColor,
                            fontWeight: 600,
                            fontSize: '12px',
                        }}
                    >
                        {displayedStatus}
                    </span> */}
                </div>
            ),
        },
    ];

    if (purchasedSkus.length > 0) {
        fields.push({
            Name: '',
            Value: '',
            ValueContent: (
                <div className="nz-ticket-card-skus">
                    {purchasedSkus.map((sku) => {
                        const icon = getSkuIcon(sku);
                        return (
                            <button
                                key={sku}
                                type="button"
                                className={`nz-ticket-sku-chip ${icon ? 'nz-ticket-sku-chip-icon' : ''}`}
                                title={sku}
                                onClick={(e) => handleSkuClick(e, sku)}
                            >
                                {icon ? (
                                    <span className="nz-ticket-sku-icon-wrapper" aria-label={sku}>
                                        {icon}
                                    </span>
                                ) : (
                                    sku
                                )}
                            </button>
                        );
                    })}
                </div>
            ),
        });
    }

    const rawTicket = ticket as unknown as Record<string, unknown>;
    const dateReceived = ticket.daterequested || (rawTicket.datecreated as string) || (rawTicket.createdAt as string) || '';
    const dateUpdated = ticket.lastupdated || (rawTicket.dateupdated as string) || (rawTicket.updatedAt as string) || (rawTicket.monitorupdated as string) || dateReceived;

    const formattedReceived = FnFormatTicketDate(dateReceived);
    const formattedUpdated = FnFormatTicketDate(dateUpdated);

    if (formattedReceived) {
        fields.push({
            Name: 'Received',
            Value: formattedReceived,
            Group: 'ticket-dates-row',
            Row: 'inline',
        });
    }

    if (formattedUpdated) {
        fields.push({
            Name: 'Updated',
            Value: formattedUpdated,
            Group: 'ticket-dates-row',
            Row: 'inline',
        });
    }

    fields.push({
        Name: 'bid',
        Value: ticket.bid || '—',
        Group: 'bid-cid-row',
        Row: 'inline',
    });

    fields.push({
        Name: 'cid',
        Value: ticket.cid || '—',
        Group: 'bid-cid-row',
        Row: 'inline',
    });

    if (contact?.email) {
        fields.push({
            Name: 'Email',
            Value: contact.email,
            Row: 'space-between',
        });
    }

    if (contact?.phone) {
        fields.push({
            Name: 'Phone',
            Value: contact.phone,
        });
    }

    return (
        <CardLayout
            uniqueName={uniqueName}
            className="nz-contact-card nz-ticket-card"
            data={ticket}
            fields={fields}
            isSelected={isSelected}
            hideRightMouseMenu={true}
            onClick={() => onSelect(ticket)}
            ContentImage={{
                uniqueName: `${uniqueName}-avatar`,
                source: (
                    <LibraryColor128x128
                        size={FnGetCssVariable('--image-size-2')}
                    />
                ),
                w: 'var(--image-size-2)',
                h: 'var(--image-size-2)',
                type: 'svg',
                tooltip: ticket.ticketid || 'Ticket',
            }}
        />
    );
};

export { TicketCard };
export type { ITicketCardProps };
