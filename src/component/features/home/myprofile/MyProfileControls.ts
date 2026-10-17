import { DisplayControlEnums } from "../../../shared/alldefaultprops/basic/DefaultPropsFormContainer";
import { IControl } from "../../../shared/allinterface/settingsform/ISettingsLibForm";

const createProfileControl = (
    name: string,
    label: string,
    sortOrder: number,
    displayGroupControl: string,
    displayControl: string,
    disabled: boolean = false,
    defaultValue: string = ""
): IControl => ({
    CanChange: disabled ? 0 : 1,
    IsRequired: 0,
    GroupName: "Profile",
    GroupNameDesc: displayGroupControl,
    SubGroupEntID: "",
    SubGroupName: "FormControl",
    SubGroupNameDesc: "",
    _AP: name,
    PropertyLabel: label,
    NameDesc: label,
    DefaultAPValue: defaultValue,
    Value: defaultValue,
    ValueDesc: "",
    SortOrder: sortOrder,
    MaxInstances: 0,
    InputMask: "",
    RegEx: "",
    DisplayGroupControl: displayGroupControl,
    DisplayControl: displayControl,
    ChangeEvent: "",
    Secured: false,
    IsNZ: true,
    EntID: "",
    RecID: "",
    LastUpdated: "",
    EntityName: "_User",
    Name: name,
    disabled: disabled,
});

const myProfileUserControls: IControl[] = [
    createProfileControl("Company", "Company", 1, "User", DisplayControlEnums.EditTextControl, true),
    createProfileControl("Login", "Login", 2, "User", DisplayControlEnums.EditTextControl, true),
    createProfileControl("Name", "Name", 3, "User", DisplayControlEnums.EditTextControl, false),
    createProfileControl("Email", "Email", 4, "User", DisplayControlEnums.EditTextControl, true),
    createProfileControl("Phone", "Phone", 5, "User", DisplayControlEnums.EditTextControl, false),
    createProfileControl("Title", "Title", 6, "User", DisplayControlEnums.EditTextControl, false),
    createProfileControl("Department", "Department", 7, "User", DisplayControlEnums.EditTextControl, false),
    createProfileControl("Website", "Website", 8, "User", DisplayControlEnums.EditTextControl, false),
    createProfileControl("Tagline", "Optional Line (Tagline) for Signature", 9, "User", DisplayControlEnums.EditTextControl, false),
];

const myProfileAddressControls: IControl[] = [
    createProfileControl("Address1", "Address 1", 10, "Address", DisplayControlEnums.EditTextControl, false),
    createProfileControl("Address2", "Address 2", 11, "Address", DisplayControlEnums.EditTextControl, false),
    createProfileControl("City", "City", 12, "Address", DisplayControlEnums.EditTextControl, false),
    createProfileControl("State", "State", 13, "Address", DisplayControlEnums.EditTextControl, false),
    createProfileControl("Country", "Country", 14, "Address", DisplayControlEnums.EditTextControl, false),
    createProfileControl("Zip", "Zip", 15, "Address", DisplayControlEnums.EditTextControl, false),
    createProfileControl("CountryCode", "Country Code", 16, "Address", DisplayControlEnums.EditTextControl, false),
    createProfileControl("TimezoneOffset", "Timezone Offset", 17, "Address", DisplayControlEnums.EditTextControl, false),
    createProfileControl("Donotcallme", "Do Not Call Me", 18, "Address", DisplayControlEnums.TrueFalseControl, false, "0"),
    createProfileControl("Removemefrommailinglist", "Remove Me From Mailing List", 19, "Address", DisplayControlEnums.TrueFalseControl, false, "0"),
    createProfileControl("Smsoptin", "SMS Opt-in", 20, "Address", DisplayControlEnums.TrueFalseControl, false, "0"),
];

const myProfileControls: IControl[] = [
    ...myProfileUserControls,
    ...myProfileAddressControls,
];

export { myProfileControls, myProfileUserControls, myProfileAddressControls };
