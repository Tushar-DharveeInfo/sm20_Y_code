/*
 * SAMPLE DATA: contacts from contacts.json for explorer tree mapping.
 * Replace this import with API response data when available.
 */
import contactsSample from "../../../sampledata/tree/contacts.json";
import type { IContact, IContactsResponse } from "../../shared/allinterface/tree/IContact";

const sampleContacts: IContact[] =
    (contactsSample as IContactsResponse).contacts ?? [];

export { sampleContacts };
