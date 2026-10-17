import type { AuthSession } from "@n20a/libauth";
import type { IContactDoc } from "@n20a/libfsdb";

type TMyProfileAuthUser = Pick<AuthSession, "tenantNickname" | "username" | "displayName" | "email"> & {
    phoneNumber?: string | null;
};

const getPhoneNumber = (authUser: TMyProfileAuthUser): string => {
    if (authUser.phoneNumber) {
        return authUser.phoneNumber;
    }

    const rawUser = authUser as AuthSession & { phoneNumber?: string | null };
    return rawUser.phoneNumber ?? "";
};

const toBoolean = (value: unknown): boolean => {
    if (typeof value === "boolean") {
        return value;
    }
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "true" || raw === "1";
};

const FnBuildMyProfileString = (
    authUser: TMyProfileAuthUser,
    contact: IContactDoc & { title?: string; department?: string; website?: string; tagline?: string }
): string => {
    const profile = {
        Company: authUser.tenantNickname ?? "",
        Login: authUser.username ?? "",
        Name: (contact as any)?.cname || authUser.displayName || "",
        Email: authUser.email ?? "",
        Phone: (contact as any)?.phone || getPhoneNumber(authUser),
        Title: contact.title ?? "",
        Department: contact.department ?? "",
        Website: contact.website ?? "",
        Tagline: contact.tagline ?? "",
        Address1: contact.address1 ?? "",
        Address2: contact.address2 ?? "",
        City: contact.city ?? "",
        State: contact.state ?? "",
        Country: contact.country ?? "",
        Zip: contact.zip ?? "",
        CountryCode: contact.countrycode ?? "",
        TimezoneOffset: contact.timezoneoffset ?? "",
        Donotcallme: toBoolean(contact?.donotcallme),
        Removemefrommailinglist: toBoolean(contact?.removemefrommailinglist),
        Smsoptin: toBoolean(contact?.smsoptin),
    };

    return JSON.stringify([profile]);
};

export { FnBuildMyProfileString };
export type { TMyProfileAuthUser };
