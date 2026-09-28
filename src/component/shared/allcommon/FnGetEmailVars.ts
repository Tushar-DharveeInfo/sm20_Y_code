import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { IUserAuthSession } from '../context/allinterface/IMainApp';
import type { ITreeNode } from '../allinterface/tree/ITreeControl';
import PlainEmailSignature, { type IPlainEmailSignatureProps } from '../../features/client/PlainEmailSignature';

export interface IEmailVarsContext {
    authSession?: IUserAuthSession | null;
    contacts?: Record<string, unknown>[];
    contact?: Record<string, unknown>;
    business?: Record<string, unknown>;
    selectedNode?: ITreeNode;
    signatureProps?: Partial<IPlainEmailSignatureProps>;
    extraData?: Record<string, unknown>;
}

export type EmailVarsFn = (context?: IEmailVarsContext) => string | Promise<string>;

/* -------------------------------------------------------------------------- */
/* Helper: Escape string for RegExp                                           */
/* -------------------------------------------------------------------------- */
function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* -------------------------------------------------------------------------- */
/* DataSource Functions: Return a JSON string of variables                    */
/* -------------------------------------------------------------------------- */

/**
 * Produces email variables for a Contact (e.g. from selected recipient).
 */
export function FnGetContactEmailVars(context?: IEmailVarsContext): string {
    const contact = context?.contact || context?.contacts?.[0] || {};
    const auth = context?.authSession;

    const contactName = String(
        contact.contact || contact.cname || contact.name || contact.ContactName || ''
    ).trim();
    const contactEmail = String(
        contact.email || contact.ContactEmail || ''
    ).trim();
    const contactPhone = String(
        contact.phone || contact.ContactPhone || contact.mobile || ''
    ).trim();
    const company = String(
        contact.bname || contact.company || contact.CompanyName || auth?.tenantNickname || ''
    ).trim();
    const jobTitle = String(
        contact.jobtitle || contact.title || contact.Role || ''
    ).trim();

    const data: Record<string, string> = {
        ContactName: contactName,
        ContactFirstName: contactName.split(' ')[0] || contactName,
        ContactLastName: contactName.split(' ').slice(1).join(' ') || '',
        ContactEmail: contactEmail,
        ContactPhone: contactPhone,
        Company: company,
        CompanyName: company,
        JobTitle: jobTitle,
        Title: jobTitle,
        UserName: auth?.displayName || auth?.username || '',
        UserEmail: auth?.email || '',
        Date: new Date().toLocaleDateString(),
        CurrentDate: new Date().toLocaleDateString(),
        CurrentTime: new Date().toLocaleTimeString(),
        CurrentYear: String(new Date().getFullYear()),
    };

    // Include any additional raw contact attributes if present
    for (const [k, v] of Object.entries(contact)) {
        if (v != null && typeof v !== 'object' && !data[k]) {
            data[k] = String(v);
        }
    }

    return JSON.stringify(data);
}

/**
 * Produces email variables for the current authenticated User/Sender.
 */
export function FnGetUserEmailVars(context?: IEmailVarsContext): string {
    const auth = context?.authSession;

    const data: Record<string, string> = {
        UserName: auth?.displayName || auth?.username || 'User',
        UserEmail: auth?.email || '',
        UserPhone: auth?.phoneNumber || '',
        UserRole: auth?.role || auth?.toolboxRole || '',
        Company: auth?.tenantNickname || 'NetZoom, Inc.',
        CompanyName: auth?.tenantNickname || 'NetZoom, Inc.',
        Date: new Date().toLocaleDateString(),
        CurrentDate: new Date().toLocaleDateString(),
        CurrentTime: new Date().toLocaleTimeString(),
        CurrentYear: String(new Date().getFullYear()),
    };

    return JSON.stringify(data);
}

/**
 * Produces email variables for a Client / Customer.
 */
export function FnGetClientEmailVars(context?: IEmailVarsContext): string {
    const contact = context?.contact || context?.contacts?.[0] || {};
    const auth = context?.authSession;

    const clientName = String(
        contact.contact || contact.cname || contact.name || auth?.displayName || 'Valued Client'
    ).trim();
    const clientCompany = String(
        contact.bname || contact.company || auth?.tenantNickname || 'Client Company'
    ).trim();

    const data: Record<string, string> = {
        ClientName: clientName,
        ClientCompany: clientCompany,
        CompanyName: clientCompany,
        ClientEmail: String(contact.email || auth?.email || ''),
        ClientPhone: String(contact.phone || contact.mobile || ''),
        AccountManager: auth?.displayName || auth?.username || '',
        Date: new Date().toLocaleDateString(),
        CurrentDate: new Date().toLocaleDateString(),
        CurrentYear: String(new Date().getFullYear()),
    };

    return JSON.stringify(data);
}

/**
 * Produces email variables for Company / Organization.
 */
export function FnGetCompanyEmailVars(context?: IEmailVarsContext): string {
    const auth = context?.authSession;

    const companyName = auth?.tenantNickname || 'NetZoom, Inc.';
    const data: Record<string, string> = {
        CompanyName: companyName,
        Company: companyName,
        Website: 'www.NetZoom.com',
        SupportEmail: 'support@NetZoom.com',
        Phone: '+1 630 281 6464',
        Date: new Date().toLocaleDateString(),
        CurrentDate: new Date().toLocaleDateString(),
        CurrentYear: String(new Date().getFullYear()),
    };

    return JSON.stringify(data);
}

/**
 * Produces email variables for Order notifications.
 */
export function FnGetOrderEmailVars(context?: IEmailVarsContext): string {
    const extra = context?.extraData || {};
    const contact = context?.contact || {};

    const data: Record<string, string> = {
        OrderId: String(extra.orderId || extra.orderid || 'ORD-1001'),
        OrderDate: String(extra.orderDate || new Date().toLocaleDateString()),
        CustomerName: String(contact.contact || contact.cname || extra.customerName || 'Customer'),
        OrderTotal: String(extra.orderTotal || '$0.00'),
        OrderStatus: String(extra.orderStatus || 'Pending'),
        Date: new Date().toLocaleDateString(),
        CurrentDate: new Date().toLocaleDateString(),
        CurrentYear: String(new Date().getFullYear()),
    };

    return JSON.stringify(data);
}

/**
 * Produces email variables for Support Ticket notifications.
 */
export function FnGetTicketEmailVars(context?: IEmailVarsContext): string {
    const extra = context?.extraData || {};
    const contact = context?.contact || {};

    const data: Record<string, string> = {
        TicketId: String(extra.ticketId || extra.ticketid || 'TCK-1001'),
        TicketSubject: String(extra.ticketSubject || extra.subject || 'Support Request'),
        TicketStatus: String(extra.ticketStatus || extra.status || 'Open'),
        TicketPriority: String(extra.ticketPriority || extra.priority || 'Normal'),
        ContactName: String(contact.contact || contact.cname || extra.contactName || 'Customer'),
        AssignedTo: String(extra.assignedTo || context?.authSession?.displayName || 'Support Team'),
        Date: new Date().toLocaleDateString(),
        CurrentDate: new Date().toLocaleDateString(),
        CurrentYear: String(new Date().getFullYear()),
    };

    return JSON.stringify(data);
}

/**
 * General fallback variables generator.
 */
export function FnGetGeneralEmailVars(context?: IEmailVarsContext): string {
    const auth = context?.authSession;
    const contact = context?.contact || context?.contacts?.[0] || {};

    const data: Record<string, string> = {
        Name: String(contact.contact || contact.cname || auth?.displayName || 'User'),
        ContactName: String(contact.contact || contact.cname || auth?.displayName || 'User'),
        Email: String(contact.email || auth?.email || ''),
        Company: String(contact.bname || auth?.tenantNickname || 'NetZoom, Inc.'),
        CompanyName: String(contact.bname || auth?.tenantNickname || 'NetZoom, Inc.'),
        Date: new Date().toLocaleDateString(),
        CurrentDate: new Date().toLocaleDateString(),
        CurrentTime: new Date().toLocaleTimeString(),
        CurrentYear: String(new Date().getFullYear()),
    };

    return JSON.stringify(data);
}

/* -------------------------------------------------------------------------- */
/* Registry Map: Maps dataSource function names to their implementations       */
/* -------------------------------------------------------------------------- */
export const EMAIL_VAR_DATA_SOURCES: Record<string, EmailVarsFn> = {
    FnGetContactEmailVars,
    FnGetUserEmailVars,
    FnGetClientEmailVars,
    FnGetCompanyEmailVars,
    FnGetOrderEmailVars,
    FnGetTicketEmailVars,
    FnGetGeneralEmailVars,
    // Variations without Fn prefix
    GetContactEmailVars: FnGetContactEmailVars,
    GetUserEmailVars: FnGetUserEmailVars,
    GetClientEmailVars: FnGetClientEmailVars,
    GetCompanyEmailVars: FnGetCompanyEmailVars,
    GetOrderEmailVars: FnGetOrderEmailVars,
    GetTicketEmailVars: FnGetTicketEmailVars,
    GetGeneralEmailVars: FnGetGeneralEmailVars,
    // Shorthand keys
    contact: FnGetContactEmailVars,
    user: FnGetUserEmailVars,
    client: FnGetClientEmailVars,
    company: FnGetCompanyEmailVars,
    order: FnGetOrderEmailVars,
    ticket: FnGetTicketEmailVars,
    general: FnGetGeneralEmailVars,
};

/* -------------------------------------------------------------------------- */
/* Function Executor                                                          */
/* -------------------------------------------------------------------------- */
export async function FnExecuteEmailVarsDataSource(
    dataSourceName: string,
    context?: IEmailVarsContext
): Promise<string> {
    if (!dataSourceName || !dataSourceName.trim()) {
        return '';
    }

    const trimmed = dataSourceName.trim();

    // 1. Direct match in registry
    if (EMAIL_VAR_DATA_SOURCES[trimmed]) {
        return await EMAIL_VAR_DATA_SOURCES[trimmed](context);
    }

    // 2. Case-insensitive search in registry
    const lowerTrimmed = trimmed.toLowerCase();
    for (const [key, fn] of Object.entries(EMAIL_VAR_DATA_SOURCES)) {
        if (key.toLowerCase() === lowerTrimmed) {
            return await fn(context);
        }
    }

    // 3. Match without "fn" prefix if any
    const withoutFn = lowerTrimmed.startsWith('fn') ? lowerTrimmed.slice(2) : lowerTrimmed;
    for (const [key, fn] of Object.entries(EMAIL_VAR_DATA_SOURCES)) {
        const kLower = key.toLowerCase();
        const kWithoutFn = kLower.startsWith('fn') ? kLower.slice(2) : kLower;
        if (kWithoutFn === withoutFn) {
            return await fn(context);
        }
    }

    // 4. If the dataSource string itself is valid JSON, return it directly
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return trimmed;
    }

    // 5. Default fallback to general email variables
    return FnGetGeneralEmailVars(context);
}

/* -------------------------------------------------------------------------- */
/* Resolve #Signature# via PlainEmailSignature                                */
/* -------------------------------------------------------------------------- */
export function FnGetPlainEmailSignatureHtml(
    context?: IEmailVarsContext,
    customProps?: Partial<IPlainEmailSignatureProps>
): string {
    const auth = context?.authSession;
    const name = customProps?.name || auth?.displayName || auth?.username || 'Mgs Yadav';
    const title = customProps?.title || auth?.role || auth?.toolboxRole || 'Product Designer';
    const company = customProps?.company || auth?.tenantNickname || 'NetZoom, Inc.';
    const email = customProps?.email || auth?.email || 'mgsy@NetZoom.com';
    const phone = customProps?.phone || auth?.phoneNumber || '+1 630 281 6464';
    const website = customProps?.website || 'www.NetZoom.com';
    const disclaimer = customProps?.disclaimer || `© ${new Date().getFullYear()} NetZoom, Inc. All rights reserved.`;

    const props: IPlainEmailSignatureProps = {
        name,
        title: title || undefined,
        company: company || undefined,
        email: email || undefined,
        phone: phone || undefined,
        website: website || undefined,
        disclaimer: disclaimer || undefined,
        ...context?.signatureProps,
        ...customProps,
    };

    try {
        return renderToStaticMarkup(React.createElement(PlainEmailSignature, props));
    } catch (err) {
        console.error('FnGetEmailVars: renderToStaticMarkup failed', err);
        const roleLine = [props.title, props.department].filter(Boolean).join(', ');
        return (
            `<div style="margin-left: 10px;">` +
            (props.name ? `<p style="margin:0;margin-top:4px;font-family:Georgia, serif;font-size:10px;line-height:1.1;">${props.name}</p>` : '') +
            (roleLine ? `<p style="margin:0;font-size:10px;">${roleLine}</p>` : '') +
            (props.company ? `<p style="margin:0;margin-top:4px;font-family:Georgia, serif;font-size:10px;line-height:1.1;">${props.company}</p>` : '') +
            (props.phone ? `<p style="margin:0;font-size:10px;font-weight:300;">Phone: ${props.phone}</p>` : '') +
            (props.email ? `<p style="margin:0;font-size:10px;font-weight:300;">Email: ${props.email}</p>` : '') +
            (props.website ? `<p style="margin:0;font-size:10px;font-weight:300;">${props.website}</p>` : '') +
            (props.specialNote ? `<p style="margin:0;font-size:10px;font-weight:300;"><br />Note: ${props.specialNote}</p>` : '') +
            `</div>` +
            (props.disclaimer ? `<div style="margin-left: 10px;"><p style="margin:0;padding-top:6px;font-size:10px;line-height:1;color:#6b7280;">${props.disclaimer}</p></div>` : '')
        );
    }
}

/* -------------------------------------------------------------------------- */
/* Main Resolver: Resolves variables and #Signature# in email template        */
/* -------------------------------------------------------------------------- */
export async function FnResolveEmailTemplate(
    templateContent: string,
    dataSource?: string,
    context?: IEmailVarsContext
): Promise<string> {
    if (!templateContent) return '';
    let result = templateContent;
    debugger
    // Rule: if datasource is missing then do not try to resolve variables
    if (dataSource && dataSource.trim() !== '') {
        try {
            // First call fn and get datajson string
            const dataJson = await FnExecuteEmailVarsDataSource(dataSource, context);
            debugger
            if (dataJson && dataJson.trim()) {
                let parsed: Record<string, unknown> = {};
                try {
                    parsed = JSON.parse(dataJson);
                } catch (e) {
                    console.warn('FnResolveEmailTemplate: failed to parse datajson from fn', e);
                }

                // Create key, value array for what you get in result from fn
                const keyValueArray: [string, unknown][] = Object.entries(parsed);

                // Now resolve variables using key, value array
                for (const [key, val] of keyValueArray) {
                    const valueStr = val == null ? '' : String(val);
                    // Match #Key# (case-insensitive)
                    const hashRegex = new RegExp(`#${escapeRegExp(key)}#`, 'gi');
                    result = result.replace(hashRegex, valueStr);

                    // Match {{Key}} (case-insensitive)
                    const mustacheRegex = new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, 'gi');
                    result = result.replace(mustacheRegex, valueStr);
                }
            }
        } catch (err) {
            console.error('FnResolveEmailTemplate: error resolving dataSource variables', err);
        }
    }

    // Finally resolve #Signature#
    // When resolving #Signature#, simply call PlainEmailSignature and replace #Signature#, with result string
    const signatureRegex = /#signature#,?/gi;
    if (signatureRegex.test(result)) {
        const signatureHtml = FnGetPlainEmailSignatureHtml(context);
        result = result.replace(signatureRegex, signatureHtml);
    }

    return result;
}
