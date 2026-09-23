import React, { useMemo, useState } from 'react';
import { TicketCard } from './TicketCard';
import { Label } from '../../../shared/basic/label/Label';
import { EditTextXControl } from '@n20a/libform';
import type { ITicketDoc, IContactDoc } from '../../../shared/allinterface/IDatasets';
import './TicketCardList.css';

interface ITicketCardListProps {
    uniqueName: string;
    tickets: ITicketDoc[];
    contacts: IContactDoc[];
    purchasedSkus: string[];
    selectedTicketId: string | null;
    onSelectTicket: (ticket: ITicketDoc) => void;
    onSkuClick?: (sku: string, ticket: ITicketDoc) => void;
}

/** Sort tickets newest → oldest by daterequested (Z-A). */
function sortTicketsNewestFirst(tickets: ITicketDoc[]): ITicketDoc[] {
    return [...tickets].sort((a, b) => {
        const ta = a.daterequested ? new Date(a.daterequested).getTime() : 0;
        const tb = b.daterequested ? new Date(b.daterequested).getTime() : 0;
        return tb - ta; // descending (newest first)
    });
}

const TicketCardList: React.FC<ITicketCardListProps> = ({
    uniqueName,
    tickets,
    contacts,
    purchasedSkus,
    selectedTicketId,
    onSelectTicket,
    onSkuClick,
}) => {
    const [filterText, setFilterText] = useState('');

    // Map for O(1) contact lookup by bid+cid
    const contactMap = useMemo(() => {
        const map = new Map<string, IContactDoc>();
        contacts.forEach((c) => {
            map.set(`${c.bid}__${c.cid}`, c);
        });
        return map;
    }, [contacts]);

    const sorted = useMemo(() => sortTicketsNewestFirst(tickets), [tickets]);

    const filtered = useMemo(() => {
        if (!filterText.trim()) return sorted;
        const query = filterText.trim().toLowerCase();
        return sorted.filter(
            (t) =>
                (t.ticketid ?? '').toLowerCase().includes(query) ||
                (t.status ?? '').toLowerCase().includes(query) ||
                (t.prodno ?? '').toLowerCase().includes(query) ||
                (t.cid ?? '').toLowerCase().includes(query) ||
                (t.bid ?? '').toLowerCase().includes(query)
        );
    }, [sorted, filterText]);

    return (
        <div className="nz-ticket-card-list-root">
            <div className="nz-sub-header">
                <Label
                    uniqueName={`${uniqueName}-header`}
                    label={`Tickets (${filtered.length})`}
                />
            </div>

            <div className="nz-sidebar-contact-list-search">
                <EditTextXControl
                    name={`${uniqueName}-filter`}
                    label=""
                    placeholder="Filter tickets..."
                    value={filterText}
                    onChange={(val) => setFilterText(String(val ?? ''))}
                />
            </div>

            <div className="nz-sidebar-contact-list-content">
                {filtered.length === 0 ? (
                    <div className="nz-sidebar-contact-list-empty">
                        {tickets.length === 0
                            ? 'No tickets to display.'
                            : 'No tickets matching filter'}
                    </div>
                ) : (
                    filtered.map((ticket, index) => {
                        const contact = contactMap.get(
                            `${ticket.bid}__${ticket.cid}`
                        );
                        return (
                            <TicketCard
                                key={ticket.ticketid || `${uniqueName}-card-${index}`}
                                uniqueName={`${uniqueName}-ticket-card-${ticket.ticketid || index}`}
                                ticket={ticket}
                                contact={contact}
                                purchasedSkus={purchasedSkus}
                                isSelected={ticket.ticketid === selectedTicketId}
                                onSelect={onSelectTicket}
                                onSkuClick={onSkuClick}
                            />
                        );
                    })
                )}
            </div>
        </div>
    );
};

export { TicketCardList };
export type { ITicketCardListProps };
