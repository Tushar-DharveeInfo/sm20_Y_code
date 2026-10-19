import React, { useMemo } from 'react';
import { Label } from '../../../shared/basic/label/Label';
import { IControl } from '../../../shared/allinterface/settingsform/ISettingsLibForm';
import { SettingsLibForm } from '../../../shared/settingsform/settingslibform/SettingsLibForm';
import type { ITicketDoc } from '@n20a/libfsdb';
import { FnFormatTicketDate } from '../../../shared/allcommon/tree/FnFormatTicketDate';
import { useSmDataContext } from '../../../shared/context/hooks/SmDataHooks';
import { updateTicketInStore } from './TicketsDataStore';

interface ITicketDetailPane {
    uniqueName: string;
    ticket: ITicketDoc | null;
    emptyMessage?: string;
    onSaveTicket?: (ticketId: string, updatedFields: Partial<ITicketDoc>) => Promise<void> | void;
}

type ITicketDetailField = {
    ticketKey?: keyof ITicketDoc;
    formName: string;
    label: string;
    displayControl: string;
    sortOrder: number;
    formatAsDate?: boolean;
    editable?: boolean;
    getValue?: (
        ticket: ITicketDoc,
        lookups: { businessName: string; contactName: string; email: string }
    ) => unknown;
};

const TICKET_FIELD_DEFS: ITicketDetailField[] = [
    { ticketKey: 'ticketid', formName: 'Ticket', label: 'Ticket', displayControl: 'TextControl', sortOrder: 1, getValue: (t) => t.ticketid },
    { ticketKey: 'status', formName: 'Status', label: 'Status', displayControl: 'TextControl', sortOrder: 2, getValue: (t) => t.status },
    { ticketKey: 'tickettype', formName: 'TicketType', label: 'Ticket Type', displayControl: 'TextControl', sortOrder: 3, getValue: (t) => t.tickettype },
    { ticketKey: 'bid', formName: 'Business', label: 'Business', displayControl: 'TextControl', sortOrder: 4, getValue: (t, lookups) => lookups.businessName || t.bid },
    { ticketKey: 'cid', formName: 'Contact', label: 'Contact', displayControl: 'TextControl', sortOrder: 5, getValue: (t, lookups) => lookups.contactName || t.cid },
    { formName: 'Email', label: 'Email', displayControl: 'TextControl', sortOrder: 6, getValue: (_t, lookups) => lookups.email },
    { ticketKey: 'subscription', formName: 'Subscription', label: 'Subscription', displayControl: 'TextControl', sortOrder: 7, getValue: (t) => t.subscription },
    { ticketKey: 'mfg', formName: 'Mfg', label: 'Mfg', displayControl: 'EditTextControl', sortOrder: 8, editable: true, getValue: (t) => t.mfg },
    { ticketKey: 'eqtype', formName: 'EqType', label: 'Eq Type', displayControl: 'EditTextControl', sortOrder: 9, editable: true, getValue: (t) => t.eqtype },
    { ticketKey: 'prodno', formName: 'ProdNo', label: 'Prod No', displayControl: 'EditTextControl', sortOrder: 10, editable: true, getValue: (t) => t.prodno },
    { ticketKey: 'moreinfo', formName: 'MoreInfo', label: 'More Info', displayControl: 'TextareaControl', sortOrder: 11, editable: true, getValue: (t) => t.moreinfo },
    { ticketKey: 'daterequested', formName: 'RequestedOn', label: 'Date Requested', displayControl: 'TextControl', sortOrder: 12, formatAsDate: true, getValue: (t) => t.daterequested },
    { ticketKey: 'datereleased', formName: 'ReleasedOn', label: 'Date Released', displayControl: 'TextControl', sortOrder: 13, formatAsDate: true, getValue: (t) => t.datereleased },
    { ticketKey: 'lastupdated', formName: 'LastUpdated', label: 'Last Updated', displayControl: 'TextControl', sortOrder: 14, formatAsDate: true, getValue: (t) => t.lastupdated },
];

function toProfileValue(field: ITicketDetailField, value: unknown): string {
    if (field.formatAsDate) {
        return FnFormatTicketDate(value as Date | string);
    }
    return value == null ? '' : String(value);
}

function buildTicketControls(): IControl[] {
    return TICKET_FIELD_DEFS.map((field) => {
        const isEditable = Boolean(field.editable);
        return {
            CanChange: isEditable ? 1 : 0,
            IsRequired: 0,
            GroupName: 'TicketDetails',
            GroupNameDesc: '',
            SubGroupEntID: '',
            SubGroupName: 'FormControl',
            SubGroupNameDesc: '',
            _AP: field.formName,
            PropertyLabel: field.label,
            NameDesc: field.label,
            DefaultAPValue: '',
            Value: '',
            ValueDesc: '',
            SortOrder: field.sortOrder,
            MaxInstances: 0,
            InputMask: '',
            RegEx: '',
            DisplayGroupControl: 'Ticket Details',
            DisplayControl: field.displayControl,
            ChangeEvent: '',
            Secured: false,
            IsNZ: false,
            EntID: field.formName,
            RecID: field.formName,
            LastUpdated: '',
            EntityName: 'Ticket',
            Name: field.formName,
            disabled: !isEditable,
            IsReadOnly: !isEditable,
        };
    });
}

const TicketDetailPane: React.FC<ITicketDetailPane> = ({ ticket, uniqueName, emptyMessage, onSaveTicket }) => {
    const smDataContext = useSmDataContext();
    const controls = useMemo(() => buildTicketControls(), []);

    const lookups = useMemo(() => {
        if (!ticket) {
            return { businessName: '', contactName: '', email: '' };
        }
        const business = (smDataContext.datasets?.businesses || []).find((row) => row.bid === ticket.bid);
        const contact = (smDataContext.datasets?.contacts || []).find(
            (row) => row.bid === ticket.bid && row.cid === ticket.cid
        );
        return {
            businessName: business?.bname ?? ticket.bid,
            contactName: contact?.cname ?? ticket.cid,
            email: contact?.email ?? '',
        };
    }, [ticket, smDataContext.datasets?.businesses, smDataContext.datasets?.contacts]);

    const profileString = useMemo(() => {
        if (!ticket) return '';
        const profile: Record<string, string> = {};
        TICKET_FIELD_DEFS.forEach((field) => {
            const rawVal = field.getValue ? field.getValue(ticket, lookups) : (field.ticketKey ? ticket[field.ticketKey] : '');
            profile[field.formName] = toProfileValue(field, rawVal);
        });
        return JSON.stringify([profile]);
    }, [ticket, lookups]);

    const handleSaveForm = async (profileDataJson: string, formId?: string) => {
        let parsed: Record<string, unknown> = {};
        try {
            const raw = JSON.parse(profileDataJson);
            parsed = Array.isArray(raw) && raw.length > 0 ? raw[0] : raw;
        } catch (e) {
            console.error('Failed to parse profile data', e);
        }

        const source =
            parsed.TableSections && typeof parsed.TableSections === 'object'
                ? ((Object.values(parsed.TableSections)[0] as Record<string, unknown>) ?? parsed)
                : parsed;

        const ticketId =
            ticket?.ticketid ||
            (source.Ticket as string) ||
            (source.ticketid as string) ||
            (parsed.Ticket as string) ||
            (parsed.ticketid as string) ||
            formId;
        if (!ticketId) return;

        const updates: Partial<ITicketDoc> = {};
        if (source.Mfg !== undefined) updates.mfg = String(source.Mfg ?? '').trim();
        else if (source.mfg !== undefined) updates.mfg = String(source.mfg ?? '').trim();

        if (source.EqType !== undefined) updates.eqtype = String(source.EqType ?? '').trim();
        else if (source.eqtype !== undefined) updates.eqtype = String(source.eqtype ?? '').trim();

        if (source.ProdNo !== undefined) updates.prodno = String(source.ProdNo ?? '').trim();
        else if (source.prodno !== undefined) updates.prodno = String(source.prodno ?? '').trim();

        if (source.MoreInfo !== undefined) updates.moreinfo = String(source.MoreInfo ?? '').trim();
        else if (source.moreinfo !== undefined) updates.moreinfo = String(source.moreinfo ?? '').trim();

        // Status is read-only and must always remain the exact same when updating ticket details
        if (ticket?.status) {
            updates.status = ticket.status;
        }

        if (source.Subscription !== undefined) updates.subscription = String(source.Subscription ?? '').trim();
        else if (source.subscription !== undefined) updates.subscription = String(source.subscription ?? '').trim();

        if (onSaveTicket) {
            await onSaveTicket(ticketId, updates);
        } else {
            const nowIso = new Date().toISOString();
            const payload = {
                ...updates,
                lastupdated: nowIso,
            };
            updateTicketInStore(ticketId, payload);
            if (smDataContext.datasets?.tickets) {
                const updatedList = smDataContext.datasets.tickets.map((t) =>
                    t.ticketid === ticketId ? { ...t, ...payload } : t
                );
                smDataContext.updateDataset?.('tickets', updatedList);
            }
        }
    };

    if (!ticket) {
        return (
            <div className="nz-wh-100 nz-d-flex-hv-left" style={{ padding: 'var(--spacing-2)' }}>
                <Label
                    uniqueName={`${uniqueName}-empty`}
                    label={emptyMessage || 'Select a ticket to view details.'}
                />
            </div>
        );
    }

    const formId = ticket.ticketid || ticket.prodno || 'ticket';
    const ticketId = ticket.ticketid || 'Ticket';
    const prodNo = ticket.prodno && ticket.prodno.trim() ? ticket.prodno.trim() : '';

    const headerTitle = prodNo
        ? `${ticketId} — ${prodNo}`
        : ticketId;

    return (
        <div className="nz-wh-100" style={{ overflow: 'auto' }}>
            <SettingsLibForm
                key={`${uniqueName}-${ticket.ticketid || 'ticket'}-${ticket.lastupdated || ticket.prodno || 'initial'}`}
                uniqueName={`${uniqueName}-form`}
                controls={controls}
                profileString={profileString}
                allowShowHeader={true}
                allowShowSectionHeader={true}
                headerText={headerTitle}
                isDisableForm={false}
                isAutoSave={false}
                id={formId}
                handleSaveForm={handleSaveForm}
            />
        </div>
    );
};

export { TicketDetailPane };
export type { ITicketDetailPane };
export default TicketDetailPane;
