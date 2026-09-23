import { useMemo } from 'react'
import { Label } from '../../../../shared/basic/label/Label'
import { IControl } from '../../../../shared/allinterface/settingsform/ISettingsLibForm'
import { SettingsLibForm } from '../../../../shared/settingsform/settingslibform/SettingsLibForm'
import type { ITicketDoc } from '../../../../shared/allinterface/IDatasets'
import { FnFormatTicketDate } from '../../../../shared/allcommon/tree/FnFormatTicketDate'
import { useSmDataContext } from '../../../../shared/context/hooks/SmDataHooks'

interface ITicketDetailPane {
    uniqueName: string
    ticket: ITicketDoc | null
}

type ITicketDetailField = {
    formName: string
    label: string
    displayControl: string
    sortOrder: number
    formatAsDate?: boolean
    getValue: (
        ticket: ITicketDoc,
        lookups: { businessName: string; contactName: string; email: string }
    ) => unknown
}

/**
 * Form field names must avoid SettingsLibForm heuristics:
 * - names starting/ending with "date" → forced YYYY-MM-DD
 * - names containing "lastupdated" → app datetime with time
 */
const TICKET_FIELD_DEFS: ITicketDetailField[] = [
    { formName: 'Ticket', label: 'Ticket', displayControl: 'TextControl', sortOrder: 1, getValue: (ticket) => ticket.ticketid },
    { formName: 'Status', label: 'Status', displayControl: 'TextControl', sortOrder: 2, getValue: (ticket) => ticket.status },
    { formName: 'TicketType', label: 'Ticket Type', displayControl: 'TextControl', sortOrder: 3, getValue: (ticket) => ticket.tickettype },
    { formName: 'Business', label: 'Business', displayControl: 'TextControl', sortOrder: 4, getValue: (_ticket, lookups) => lookups.businessName },
    { formName: 'contact', label: 'Contact', displayControl: 'TextControl', sortOrder: 5, getValue: (_ticket, lookups) => lookups.contactName },
    { formName: 'Email', label: 'Email', displayControl: 'TextControl', sortOrder: 6, getValue: (_ticket, lookups) => lookups.email },
    { formName: 'subscription', label: 'Subscription', displayControl: 'TextControl', sortOrder: 7, getValue: (ticket) => ticket.subscription },
    { formName: 'Mfg', label: 'Mfg', displayControl: 'TextControl', sortOrder: 8, getValue: (ticket) => ticket.mfg },
    { formName: 'EqType', label: 'Eq Type', displayControl: 'TextControl', sortOrder: 9, getValue: (ticket) => ticket.eqtype },
    { formName: 'ProdNo', label: 'Prod No', displayControl: 'TextControl', sortOrder: 10, getValue: (ticket) => ticket.prodno },
    { formName: 'MoreInfo', label: 'More Info', displayControl: 'TextareaControl', sortOrder: 11, getValue: (ticket) => ticket.moreinfo },
    { formName: 'RequestedOn', label: 'Date Requested', displayControl: 'TextControl', sortOrder: 12, formatAsDate: true, getValue: (ticket) => ticket.daterequested },
    { formName: 'ReleasedOn', label: 'Date Released', displayControl: 'TextControl', sortOrder: 13, formatAsDate: true, getValue: (ticket) => ticket.datereleased },
    { formName: 'UpdatedOn', label: 'Last Updated', displayControl: 'TextControl', sortOrder: 14, formatAsDate: true, getValue: (ticket) => ticket.lastupdated },
]

function toProfileValue(field: ITicketDetailField, value: unknown): string {
    if (field.formatAsDate) {
        return FnFormatTicketDate(value as Date | string)
    }
    return value == null ? '' : String(value)
}

function buildTicketControls(): IControl[] {
    return TICKET_FIELD_DEFS.map((field) => ({
        CanChange: 0,
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
        disabled: true,
        IsReadOnly: true,
    }))
}

const ticketFormControls = buildTicketControls()

const TicketDetailPane = (ticketDetailPaneProps: ITicketDetailPane) => {
    const { ticket, uniqueName } = ticketDetailPaneProps
    const smDataContext = useSmDataContext()

    const lookups = useMemo(() => {
        if (!ticket) {
            return { businessName: '', contactName: '', email: '' }
        }
        const business = smDataContext.datasets.businesses.find((row) => row.bid === ticket.bid)
        const contact = smDataContext.datasets.contacts.find(
            (row) => row.bid === ticket.bid && row.cid === ticket.cid
        )
        return {
            businessName: business?.bname ?? ticket.bid,
            contactName: contact?.cname ?? ticket.cid,
            email: contact?.email ?? '',
        }
    }, [ticket, smDataContext.datasets.businesses, smDataContext.datasets.contacts])

    const profileString = useMemo(() => {
        if (!ticket) return ''
        const profile: Record<string, string> = {}
        TICKET_FIELD_DEFS.forEach((field) => {
            profile[field.formName] = toProfileValue(field, field.getValue(ticket, lookups))
        })
        return JSON.stringify([profile])
    }, [ticket, lookups])

    if (!ticket) {
        return (
            <div className="nz-wh-100 nz-d-flex-hv-left" style={{ padding: 'var(--spacing-2)' }}>
                <Label
                    uniqueName={`${uniqueName}-empty`}
                    label="Select a product number to view the ticket."
                />
            </div>
        )
    }

    return (
        <div className="nz-wh-100" style={{ overflow: 'auto' }}>
            <SettingsLibForm
                key={`${uniqueName}-${ticket.ticketid}-${ticket.prodno}`}
                uniqueName={`${uniqueName}-form`}
                controls={ticketFormControls}
                profileString={profileString}
                allowShowHeader={true}
                allowShowSectionHeader={true}
                headerText={`${ticket.ticketid} — ${ticket.prodno}`}
                isDisableForm={true}
                isAutoSave={false}
                id={ticket.prodno}
            />
        </div>
    )
}

export { TicketDetailPane }
export type { ITicketDetailPane }
