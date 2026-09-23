import React from 'react';
import { CardLayout, ICardLayoutField } from '../../../shared/cardlayout/CardLayout';
import { FnFormatTicketDate } from '../../../shared/allcommon/tree/FnFormatTicketDate';
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable';
import { LibraryColor128x128, NetZoom24x24, Visio } from '@n20a/libicon';
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
        return 'blue';
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
}) => {
    const handleSkuClick = (
        event: React.MouseEvent<HTMLButtonElement>,
        sku: string
    ) => {
        event.stopPropagation();
        console.log(`[SKU Clicked] SKU: "${sku}", ticket: "${ticket.ticketid}"`);
        onSkuClick?.(sku, ticket);
    };

    const statusColor = getStatusColor(ticket.status);

    const fields: ICardLayoutField[] = [
        {
            Name: 'Ticket',
            Value: ticket.ticketid || '—',
            Header: 1,
        },
        {
            Name: '',
            Value: ticket.status || '—',
            Header: 2,
            ValueContent: (
                <span
                    style={{
                        color: statusColor,
                        fontWeight: 600,
                        fontSize: '12px',
                    }}
                >
                    {ticket.status || '—'}
                </span>
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

    if (ticket.daterequested) {
        fields.push({
            Name: 'Date',
            Value: FnFormatTicketDate(ticket.daterequested),
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
            className="nz-contact-card"
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
