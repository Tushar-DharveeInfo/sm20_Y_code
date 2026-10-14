import type { IPropertyColumn } from "../../../allinterface/sidebar/IPropertyFormContainer";

export type IPortOrSlotRow = Record<string, unknown> & { RecID?: string };


export const powerPortsColumns: IPropertyColumn[] = [
  {
    PName: "ShapeID",
    PropertyLabel: "Shape ID",
    DisplayControl: "EditTextControl",
    SortOrder: 1,
  },
  {
    PName: "Name",
    PropertyLabel: "Port Name",
    DisplayControl: "EditTextControl",
    RequiredToAddRecord: true,
    RequiredToUpdateRecord: true,
    NullNotAllowed: true,
    SortOrder: 2,
  },
  {
    PName: "PortIndex",
    PropertyLabel: "Port Index",
    DisplayControl: "SpinControl",
    InputMask: "{0|999|1}",
    SortOrder: 3,
  },
  {
    PName: "Gender",
    PropertyLabel: "Gender",
    DisplayControl: "ComboBoxControl",
    SortOrder: 4,
    options: [
      { label: "Male (M)", value: "M" },
      { label: "Female (F)", value: "F" },
      { label: "Both (B)", value: "B" },
    ],
  },
];

export const networkPortsColumns: IPropertyColumn[] = [
  {
    PName: "ShapeID",
    PropertyLabel: "Shape ID",
    DisplayControl: "EditTextControl",
    SortOrder: 1,
  },
  {
    PName: "Name",
    PropertyLabel: "Port Name",
    DisplayControl: "EditTextControl",
    RequiredToAddRecord: true,
    RequiredToUpdateRecord: true,
    NullNotAllowed: true,
    SortOrder: 2,
  },
  {
    PName: "PortIndex",
    PropertyLabel: "Port Index",
    DisplayControl: "SpinControl",
    InputMask: "{0|999|1}",
    SortOrder: 3,
  },
  {
    PName: "Gender",
    PropertyLabel: "Gender",
    DisplayControl: "ComboBoxControl",
    SortOrder: 4,
    options: [
      { label: "Male (M)", value: "M" },
      { label: "Female (F)", value: "F" },
      { label: "Both (B)", value: "B" },
    ],
  },
  {
    PName: "PortType",
    PropertyLabel: "Port Type",
    DisplayControl: "ComboBoxControl",
    SortOrder: 5,
    options: [
      { label: "Copper", value: "Copper" },
      { label: "Fiber", value: "Fiber" },
      { label: "Other", value: "Other" },
    ],
  },
  {
    PName: "IsPortFiber",
    PropertyLabel: "Is Fiber",
    DisplayControl: "TrueFalseControl",
    SortOrder: 6,
  },
];

export const slotsColumns: IPropertyColumn[] = [
  {
    PName: "ShapeID",
    PropertyLabel: "Shape ID",
    DisplayControl: "EditTextControl",
    SortOrder: 1,
  },
  {
    PName: "Name",
    PropertyLabel: "Slot Name",
    DisplayControl: "EditTextControl",
    RequiredToAddRecord: true,
    RequiredToUpdateRecord: true,
    NullNotAllowed: true,
    SortOrder: 2,
  },
  {
    PName: "SlotIndex",
    PropertyLabel: "Slot Index",
    DisplayControl: "SpinControl",
    InputMask: "{0|999|1}",
    SortOrder: 3,
  },
  {
    PName: "SlotUse",
    PropertyLabel: "Slot Use",
    DisplayControl: "EditTextControl",
    SortOrder: 4,
  },
  {
    PName: "SlotMountType",
    PropertyLabel: "Mount Type",
    DisplayControl: "ComboBoxControl",
    SortOrder: 5,
    options: [
      { label: "PCIe x16", value: "PCIe x16" },
      { label: "PCIe x8", value: "PCIe x8" },
      { label: "PCIe x4", value: "PCIe x4" },
      { label: "PCIe x1", value: "PCIe x1" },
      { label: "Proprietary", value: "Proprietary" },
    ],
  },
];

export const inOutPortsColumns: IPropertyColumn[] = [
  {
    PName: "ShapeID",
    PropertyLabel: "Shape ID",
    DisplayControl: "EditTextControl",
    SortOrder: 1,
  },
  {
    PName: "Name",
    PropertyLabel: "Port Name",
    DisplayControl: "EditTextControl",
    RequiredToAddRecord: true,
    RequiredToUpdateRecord: true,
    NullNotAllowed: true,
    SortOrder: 2,
  },
  {
    PName: "PortIndex",
    PropertyLabel: "Port Index",
    DisplayControl: "SpinControl",
    InputMask: "{0|999|1}",
    SortOrder: 3,
  },
  {
    PName: "Gender",
    PropertyLabel: "Direction / Gender",
    DisplayControl: "ComboBoxControl",
    SortOrder: 4,
    options: [
      { label: "In", value: "In" },
      { label: "Out", value: "Out" },
      { label: "Both (B)", value: "B" },
    ],
  },
];

export interface IEQIDMenuTableConfig {
  tableName: string;
  tableLabel: string;
  fieldKey: "PowerPorts" | "NetworkPorts" | "Slots" | "InOutPlugs";
  properties: IPropertyColumn[];
  headerTitle: string;
}


export function getEQIDMenuConfig(menuKey: string): IEQIDMenuTableConfig {
  const normalizedKey = (menuKey || "").toLowerCase().replace(/[\s()_-]+/g, "");

  switch (true) {
    case normalizedKey.includes("power") || normalizedKey === "powerports":
      return {
        tableName: "PowerPorts",
        tableLabel: "Power Ports",
        fieldKey: "PowerPorts",
        properties: powerPortsColumns,
        headerTitle: "Hardware Power Ports (Optional)",
      };

    case normalizedKey.includes("network") || normalizedKey === "networkports":
      return {
        tableName: "NetworkPorts",
        tableLabel: "Network Ports",
        fieldKey: "NetworkPorts",
        properties: networkPortsColumns,
        headerTitle: "Hardware Network Ports (Optional)",
      };

    case normalizedKey.includes("slot"):
      return {
        tableName: "Slots",
        tableLabel: "Slots",
        fieldKey: "Slots",
        properties: slotsColumns,
        headerTitle: "Hardware Slots",
      };

    case normalizedKey.includes("inout") || normalizedKey.includes("plug"):
    default:
      return {
        tableName: "InOutPlugs",
        tableLabel: "In/Out Ports",
        fieldKey: "InOutPlugs",
        properties: inOutPortsColumns,
        headerTitle: "Hardware In/Out Ports",
      };
  }
}
