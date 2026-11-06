/*
it requires:
Make sure you have installed the Admin SDK using npm install firebase-admin
enhance code to pass authtoken for authenticated requests

run the following command to execute the import script:
> node CreateSampledata.js

Note:
Mirrors the collection/field schema defined in ICollections.ts .
Collections generated and validated as per icollections.ts schema.
*/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Establish the exact target directory path requested
const TARGET_DIR = path.join(__dirname, 'samplecollections');
const EQID_ALLOCATED_PATH = path.join(__dirname, 'eqid', 'EQIDAllocated.json');
const ICOLLECTIONS_PATH = path.join(__dirname, 'ICollections.ts');

// Helper to safely ensure the deep folder structure exists
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// 2. Data Generators for Realistic Mock Values
const getRandomElem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const futureIsoDate = (minDays, maxDays) => new Date(Date.now() + getRandomInt(minDays, maxDays) * 86400000).toISOString();

const statuses = ['Active', 'Blocked'];
const ticketStatuses = ['open', 'released', 'resolved', 'closed'];
const reminderStatuses = ['pending', 'deleted', 'closed'];
const btypes = ['netzoom', 'visiostencils','ssi', 'mcs', 'reseller' ];
const countries = ['USA', 'Canada', 'UK', 'Australia'];
const states = ['Illinois', 'California', 'Texas', 'New York', 'Ontario', 'London'];
const products = ['NetZoom', 'VisioStencils', 'Others'];
const appNames = ['sm20', 'fsdb', 'cloudrun', 'adminportal'];
const apNames = ['featureFlags', 'releaseChannel', 'supportEmail', 'defaultRegion'];
const productSkus = [
  'NE-RW-1',
  'NE-RW-2',
  'NE-RO-1',
  'NE-RO-2',
  'NE-RK-1',
  'NE-RK-2',
  'DCM-1',
  'DCM-2',
  'AMC-1',
  'AMC-2',
  'NVSS-1-1',
  'NVSS-1-2'
];
const roles = ['admin', 'useradmin', 'user', 'se', 'sse', 'mcs', 'other'];
const contactTypes = ['contact', 'shipto', 'billto'];

const EqidComboOptions = {
  AmpUnits: ["Ampere", "Milliampere"],
  ApprovedStatus: ["Approved", "ForcedApproved", "Rejected"],
  Attributes: ["Card", "Module", "Chassis", "RackMountable", "Slot", "Stackable", "Rack", "zModule", "zLogical", "zAccessory", "zRackAccessory", "PDU", "PatchPanel", "Server", "Cooling", "NoAttributes", "BladeServer", "Enclosure", "Switch", "Storage"],
  ConnectorInOut: ["In", "Out", "Both"],
  ConnectorPortType: ["Power", "Data"],
  DataPortType: ["Copper", "Fiber", "Other"],
  DimUnits: ["Centimeter", "Inch", "Millimeter"],
  Gender: ["Male", "Female", "Both"],
  HeatUnits: ["BTU/Hr"],
  PowerUnits: ["VoltAmpere", "Watt", "KiloWatt"],
  RackLoadUnits: ["Pound", "Kilogram"],
  RackType: ["2", "4", "C", "I"],
  RelationType: ["C", "U", "None"],
  Scale: ["10", "16", "32", "64"],
  Source: ["Others", "MCS", "Customer", "INTERNAL"],
  Style: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "B", "C", "D", "I", "J", "L", "R", "T", "Y", "Z"],
  TemperatureUnits: ["Celsius", "Fahrenheit"],
  VoltUnits: ["Volts", "Millivolts", "VDC"],
  WtUnits: ["Kilogram", "Pound"],
  EQType: ["Accessory", "Appliance", "AV and Broadcasting", "Blade Fiber", "Blade Server", "Blade Storage", "BMS SNMP Gateway", "Cable", "Chassis", "Connector", "Cooling", "Display", "Door", "Enclosure", "Frame", "Furniture", "Logical", "Module", "Networking", "Patch Panel", "Power", "Printer", "Rack", "RFID Asset Tag", "RFID Locator Tag", "RFID Reader", "RFID Sensor Tag", "Security", "Server", "Shelf", "Smart PDU", "Storage", "Surface Mount Box", "Switch", "Telco", "Wall Mount Box", "Watermark", "Workstation"],
  Color: [" Black", " Clear", " Computer White", " Glacier White", " Gray", " Light Gray", " Signature Blue", " Silver", " Steel Gray", " White", "Aqua", "Basic Black", "Beige", "Black", "Blue", "Cyan", "Gray", "Green", "Grey", "Light Gray", "Magenta", "Maple", "NULL", "Oak", "Orange", "Pink", "Purple", "Red", "Royal Blue", "Silver", "Tan", "Violet", "White", "Yellow"],
}

const EQTypeVsSections = {
"Accessory": ["BASIC","DIMENSION","WEIGHT","","","","","PROGRESSS","OTHER","OWNER"],
"Appliance": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"AV and Broadcasting": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Blade Fiber": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Blade Server": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Blade Storage": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"BMS SNMP Gateway": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Cable": ["BASIC","DIMENSION","","","","","CABLE","PROGRESSS","OTHER","OWNER"],
"Chassis": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Connector": ["BASIC","","","","","","","PROGRESSS","OTHER","OWNER"],
"Cooling": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Display": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Door": ["BASIC","DIMENSION","WEIGHT","","","","","PROGRESSS","OTHER","OWNER"],
"Enclosure": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Frame": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Furniture": ["BASIC","DIMENSION","WEIGHT","","","","","PROGRESSS","OTHER","OWNER"],
"Logical": ["BASIC","DIMENSION","","","","","","PROGRESSS","OTHER","OWNER"],
"Module": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Networking": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Patch Panel": ["BASIC","DIMENSION","WEIGHT","","","","","PROGRESSS","OTHER","OWNER"],
"Power": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Printer": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Rack": ["BASIC","DIMENSION","WEIGHT","","","RACK","","PROGRESSS","OTHER","OWNER"],
"RFID Asset Tag": ["BASIC","DIMENSION","","","","","","PROGRESSS","OTHER","OWNER"],
"RFID Locator Tag": ["BASIC","DIMENSION","","","","","","PROGRESSS","OTHER","OWNER"],
"RFID Reader": ["BASIC","DIMENSION","","","","","","PROGRESSS","OTHER","OWNER"],
"RFID Sensor Tag": ["BASIC","DIMENSION","","","","","","PROGRESSS","OTHER","OWNER"],
"Security": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Server": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Shelf": ["BASIC","DIMENSION","","","","","","PROGRESSS","OTHER","OWNER"],
"Smart PDU": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Storage": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Surface Mount Box": ["BASIC","DIMENSION","WEIGHT","","","","","PROGRESSS","OTHER","OWNER"],
"Switch": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Telco": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"],
"Wall Mount Box": ["BASIC","DIMENSION","","","","","","PROGRESSS","OTHER","OWNER"],
"Watermark": ["BASIC","","","","","","","PROGRESSS","OTHER","OWNER"],
"Workstation": ["BASIC","DIMENSION","WEIGHT","POWER","THERMAL","","","PROGRESSS","OTHER","OWNER"]
}
export { EQTypeVsSections, EqidComboOptions };

const allocatedEqidEntries = JSON.parse(fs.readFileSync(EQID_ALLOCATED_PATH, 'utf8'))
  .flatMap((entry) => Object.entries(entry))
  .map(([acronym, valueArray]) => ({
    acronym,
    valueArray: Array.isArray(valueArray)
      ? valueArray.filter((value) => typeof value === 'string' && value.trim() !== '')
      : []
  }))
  .filter((entry) => entry.valueArray.length > 0);

if (allocatedEqidEntries.length === 0) {
  throw new Error(`No allocated EQID values found in ${EQID_ALLOCATED_PATH}`);
}
const eqtypeOptions = Object.keys(EQTypeVsSections);
const legacyOutputFiles = ['tenantidmapping.json'];

const getProductNameForSku = (sku) => {
  if (sku.startsWith('NE-')) {
    return 'NetZoom';
  }

  if (sku.startsWith('NVSS-')) {
    return 'VisioStencils';
  }

  return 'Others';
};

const parseInterfaceProperties = (interfaceBody) => interfaceBody
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, '').trim())
  .filter(Boolean)
  .map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)(\?)?\s*:/);

    if (!match) {
      return null;
    }

    return {
      name: match[1],
      optional: Boolean(match[2])
    };
  })
  .filter(Boolean);

const loadCollectionSchema = () => {
  const fileContent = fs.readFileSync(ICOLLECTIONS_PATH, 'utf8');
  const interfaceBodies = new Map();
  const interfaceRegex = /export interface\s+(\w+)\s*\{([\s\S]*?)\n\s*\}/g;
  let interfaceMatch;

  while ((interfaceMatch = interfaceRegex.exec(fileContent)) !== null) {
    interfaceBodies.set(interfaceMatch[1], interfaceMatch[2]);
  }

  const collectionMapBody = interfaceBodies.get('ICollectionDocMap');

  if (!collectionMapBody) {
    throw new Error(`ICollectionDocMap not found in ${ICOLLECTIONS_PATH}`);
  }

  return collectionMapBody
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*;/);

      if (!match) {
        return null;
      }

      const [, collectionName, interfaceName] = match;
      const interfaceBody = interfaceBodies.get(interfaceName);

      if (!interfaceBody) {
        throw new Error(`Interface ${interfaceName} not found for collection ${collectionName}`);
      }

      return [
        collectionName,
        parseInterfaceProperties(interfaceBody)
      ];
    })
    .filter(Boolean);
};

const validateDatasetAgainstSchema = (dataset) => {
  const schemaEntries = loadCollectionSchema();
  const collectionNames = schemaEntries.map(([collectionName]) => collectionName);
  const missingCollections = collectionNames.filter((collectionName) => !(collectionName in dataset));
  const unexpectedCollections = Object.keys(dataset).filter((collectionName) => !collectionNames.includes(collectionName));

  if (missingCollections.length > 0 || unexpectedCollections.length > 0) {
    throw new Error([
      missingCollections.length > 0 ? `Missing collections in dataset: ${missingCollections.join(', ')}` : null,
      unexpectedCollections.length > 0 ? `Unexpected collections in dataset: ${unexpectedCollections.join(', ')}` : null
    ].filter(Boolean).join('\n'));
  }

  schemaEntries.forEach(([collectionName, properties]) => {
    const docs = dataset[collectionName];
    const allowedKeys = new Set(properties.map((property) => property.name));
    const requiredKeys = properties.filter((property) => !property.optional).map((property) => property.name);
    const coveredKeys = new Set();

    docs.forEach((doc, index) => {
      const docKeys = Object.keys(doc);
      const unexpectedKeysInDoc = docKeys.filter((key) => !allowedKeys.has(key));
      const missingRequiredKeys = requiredKeys.filter((key) => !(key in doc));

      if (unexpectedKeysInDoc.length > 0) {
        throw new Error(`${collectionName}[${index}] has unexpected properties: ${unexpectedKeysInDoc.join(', ')}`);
      }

      if (missingRequiredKeys.length > 0) {
        throw new Error(`${collectionName}[${index}] is missing required properties: ${missingRequiredKeys.join(', ')}`);
      }

      docKeys.forEach((key) => coveredKeys.add(key));
    });

    const uncoveredKeys = properties
      .map((property) => property.name)
      .filter((propertyName) => !coveredKeys.has(propertyName));

    if (uncoveredKeys.length > 0) {
      throw new Error(`${collectionName} sample data does not cover properties: ${uncoveredKeys.join(', ')}`);
    }
  });
};

const createEqidDoc = ({ bid, cid, ticketid, sequence }) => {
  const eqtype = getRandomElem(eqtypeOptions);
  const now = new Date();
  const eqidAllocatedEntry = getRandomElem(allocatedEqidEntries);

  return {
    bid,
    cid,
    ticketid,
    eqid: getRandomElem(eqidAllocatedEntry.valueArray),
    Acronym: eqidAllocatedEntry.acronym,
    Manufacturer: `Manufacturer ${getRandomInt(1, 25)}`,
    MfgProdLine: `Product Line ${getRandomInt(1, 12)}`,
    Eqtype: eqtype,
    MfgEqtype: eqtype,
    MfgProdNo: `MPN-${getRandomInt(1000, 9999)}`,
    MfgDesc: `${eqtype} sample device description ${sequence}`,
    DimUnits: getRandomElem(EqidComboOptions.DimUnits),
    Ht: getRandomInt(1, 96),
    Wd: getRandomInt(1, 48),
    Dp: getRandomInt(1, 60),
    isEstimatedDimension: Math.random() > 0.6,
    RUNeeded: getRandomInt(1, 12),
    Scale: Number(getRandomElem(EqidComboOptions.Scale)),
    WtUnits: getRandomElem(EqidComboOptions.WtUnits),
    Wt: getRandomInt(1, 200),
    isEstimatedWt: Math.random() > 0.6,
    VoltUnits: getRandomElem(EqidComboOptions.VoltUnits),
    VoltMin: getRandomInt(100, 220),
    VoltMax: getRandomInt(221, 240),
    AmpUnits: getRandomElem(EqidComboOptions.AmpUnits),
    Amp: getRandomInt(1, 40),
    PowerUnits: getRandomElem(EqidComboOptions.PowerUnits),
    PowerMin: getRandomInt(50, 300),
    PowerMax: getRandomInt(301, 1200),
    PowerAvg: getRandomInt(150, 750),
    isEstimatedPower: Math.random() > 0.6,
    PowerLoadCapacity: getRandomInt(500, 5000),
    isEstimatedPowerLoad: Math.random() > 0.6,
    HeatUnits: getRandomElem(EqidComboOptions.HeatUnits),
    HeatMin: getRandomInt(100, 500),
    HeatMax: getRandomInt(501, 4000),
    HeatAvg: getRandomInt(300, 2000),
    isEstimatedHeat: Math.random() > 0.6,
    RackType: getRandomElem(EqidComboOptions.RackType),
    TotalRU: getRandomInt(1, 52),
    InsideWidth: getRandomInt(12, 30),
    Color: getRandomElem(EqidComboOptions.Color).trim(),
    DimA: getRandomInt(1, 60),
    DimB: getRandomInt(1, 60),
    DimC: getRandomInt(1, 60),
    DimD: getRandomInt(1, 60),
    DimE: getRandomInt(1, 60),
    DimF: getRandomInt(1, 60),
    DimFService: getRandomInt(0, 24),
    DimG: getRandomInt(1, 60),
    DimH: getRandomInt(1, 60),
    DimI: getRandomInt(1, 60),
    DimJ: getRandomInt(1, 60),
    DimR: getRandomInt(1, 60),
    DimRService: getRandomInt(0, 24),
    RackLoadUnits: getRandomElem(EqidComboOptions.RackLoadUnits),
    LoadCapacity: getRandomInt(50, 2500),
    isEstimatedRack: Math.random() > 0.6,
    FirstRU: getRandomInt(1, 10),
    RUSpacing: getRandomInt(1, 3),
    RU: getRandomInt(1, 12),
    CableCapacity: getRandomInt(0, 144),
    ApprovedStatus: getRandomElem(EqidComboOptions.ApprovedStatus),
    ApprovedBy: `approver_${getRandomInt(1, 8)}`,
    ApprovedDate: now,
    DataReady: Math.random() > 0.2,
    DataApprovedBy: `data_owner_${getRandomInt(1, 8)}`,
    DataApprovedDate: now,
    ShapeReady: Math.random() > 0.2,
    ShapeApprovedBy: `shape_owner_${getRandomInt(1, 8)}`,
    ShapeApprovedDate: now,
    isReleased: Math.random() > 0.4,
    ReleasedDate: now,
    Archived: false,
    Source: getRandomElem(EqidComboOptions.Source),
    DeviceAttribute: getRandomElem(EqidComboOptions.Attributes),
    isIntel: Math.random() > 0.5,
    isFacility: Math.random() > 0.5,
    isIT: Math.random() > 0.5,
    PrivateDevice: Math.random() > 0.7,
    LoginOwner: `owner_${getRandomInt(1, 20)}`
  };
};


// 3. Main Orchestration Core
function generateMockData() {
  const dataset = {
    ap: [],
    businesses: [],
    contacts: [],
    notes: [],
    tickets: [],
    ticketnotes: [],
    activities: [],
    orders: [],
    carts: [],
    supporthoursused: [],
    subs: [],
    downloads: [],
    reminder: [],
    prospect: [],
    tenantidmap: [],
    eqid: []
  };

  // Generate Independent Root Collections (20 documents each)
  for (let i = 1; i <= 20; i++) {
    dataset.ap.push({
      app: getRandomElem(appNames),
      apname: `${getRandomElem(apNames)}_${i}`,
      value: `sample_value_${i}`
    });

    dataset.reminder.push({
      bid: `bid_${1000 + i}`,
      cid: `cid_${5000 + i}`,
      btype: getRandomElem(btypes),
      status: getRandomElem(reminderStatuses),
      whattodo: `Review follow-up checklist item #${i} for alignment.`,
      duedate: futureIsoDate(1, 30),
      addedby: 'system_mock_gen',
      filename: i % 3 === 0 ? `checklist_attachment_${i}.pdf` : undefined
    });

    dataset.prospect.push({
      bid: `prospect_bid_${8000 + i}`,
      cid: `cid_prospect_${8000 + i}`,
      status: getRandomElem(['unverified', 'tobedeleted']),
      whattodo: `Verify inbound marketing lead #${i} registration data.`
    });

    dataset.tenantidmap.push({
      tenantid: `tenant_${1000 + i}`,
      displayname: `Tenant Display ${i}`,
      lastupdated: new Date().toISOString()
    });
  }

  // Generate Businesses and their deep hierarchical dependencies
  let eqidSequence = 1;
  for (let b = 1; b <= 20; b++) {
    const bid = `bid_${100 + b}`;

    dataset.businesses.push({
      bid: bid,
      btype: getRandomElem(btypes),
      status: getRandomElem(statuses),
      tag: b % 4 === 0 ? 'key-account' : undefined,
      verified: Math.random() > 0.3,
      salesexec: `Sales Exec ${getRandomInt(1, 5)}`,
      bname: `Enterprise Solution Corp V${b}`,
      country: getRandomElem(countries),
      state: getRandomElem(states),
      daysnoticeperiod: getRandomElem([30, 60, 90]),
      mmfinyear: 2026,
      relatedbids: [`bid_${getRandomInt(200, 250)}`],
      datecreated: new Date().toISOString(),
      dateupdated: new Date().toISOString(),
      name: `Primary Contact Name ${b}`,
      updatedby: 'system_mock_gen',
      createdby: 'system_mock_gen',
      contactsupdated: new Date().toISOString(),
      notesupdated: new Date().toISOString(),
      ticketsupdated: new Date().toISOString(),
      ticketnotesupdated: new Date().toISOString(),
      activitiesupdated: new Date().toISOString(),
      ordersupdated: new Date().toISOString(),
      subsupdated: new Date().toISOString(),
      downloadupdated: new Date().toISOString(),
      amcexpirydate: futureIsoDate(30, 365),
      mcsexpirydate: futureIsoDate(30, 365),
      saasexpirydate: futureIsoDate(30, 365),
      onpremexpirydate: futureIsoDate(30, 365),
      estimatedusers: getRandomInt(10, 500),
      estimatedracks: getRandomInt(1, 40),
      estimateddcsites: getRandomInt(1, 5)
    });

    // Subcollection: contacts (2 to 5 per business document)
    const numContacts = getRandomInt(2, 5);
    for (let c = 1; c <= numContacts; c++) {
      const cid = `cid_${bid}_${c}`;

      dataset.contacts.push({
        bid: bid,
        cid: cid,
        monitorupdated: new Date().toISOString(),
        monitor: Math.random() > 0.5,
        contacttype: getRandomElem(contactTypes),
        role: getRandomElem(roles),
        status: 'Active',
        ctag: c === 1 ? 'primary' : undefined,
        cname: `Representative Name ${b}-${c}`,
        email: `contact_${b}_${c}@mockcorp.com`,
        phone: `+1-555-010-${1000 + c}`,
        address1: `${100 * c} Innovation Way`,
        address2: 'Suite 400',
        city: 'Naperville',
        state: 'Illinois',
        country: 'USA',
        zip: '60540',
        countrycode: 'US',
        timezoneoffset: -5,
        donotcallme: Math.random() > 0.8,
        removemefrommailinglist: Math.random() > 0.9,
        smsoptin: Math.random() > 0.5,
        datecreated: new Date().toISOString(),
        dateupdated: new Date().toISOString()
      });

      // For every single contact document, populate rest of subcollections with at least 5 documents
      for (let itemIdx = 1; itemIdx <= 5; itemIdx++) {
        const idSuffix = `${bid}_${cid}_${itemIdx}`;

        dataset.notes.push({
          bid: bid,
          cid: cid,
          monitorupdated: new Date().toISOString(),
          monitor: false,
          noteby: `Sales Exec ${getRandomInt(1, 5)}`,
          noteid: `note_${idSuffix}`,
          important: itemIdx % 3 === 0,
          message: `Detailed client account sync log entry #${itemIdx}.`,
          filename: `interaction_report_${itemIdx}.pdf`,
          datecreated: new Date().toISOString()
        });

        const ticketid = `ticket_${idSuffix}`;
        const eqidDoc = createEqidDoc({
          bid,
          cid,
          ticketid,
          sequence: eqidSequence++
        });

        dataset.tickets.push({
          bid: bid,
          cid: cid,
          monitorupdated: new Date().toISOString(),
          monitor: true,
          ticketid: ticketid,
          tickettype: getRandomElem(['Billing Query', 'Technical Glitch', 'Feature Request']),
          subscription: `sub_reference_${itemIdx}`,
          mfg: eqidDoc.Manufacturer,
          eqtype: eqidDoc.Eqtype,
          prodno: eqidDoc.MfgProdNo,
          moreinfo: `System reporting connectivity issues during tier #${itemIdx} operations.`,
          status: getRandomElem(['Open', 'In Progress', 'Resolved']),
          daterequested: new Date().toISOString(),
          datereleased: new Date().toISOString(),
          lastupdated: new Date().toISOString()
        });

        dataset.eqid.push(eqidDoc);

        // Nested Subcollection data tied back structurally via ticketid field mapping
        dataset.ticketnotes.push({
          bid: bid,
          cid: cid,
          ticketid: ticketid,
          monitorupdated: new Date().toISOString(),
          monitor: false,
          notes: `Internal escalation update note sequence #${itemIdx} matching logs.`,
          filename: itemIdx % 2 === 0 ? `escalation_attachment_${itemIdx}.pdf` : undefined,
          datecreated: new Date().toISOString()
        });

        dataset.activities.push({
          bid: bid,
          cid: cid,
          monitorupdated: new Date().toISOString(),
          monitor: false,
          activityid: `activity_${idSuffix}`,
          message: `Automated audit interaction event telemetry tracking context #${itemIdx}.`,
          datecreated: new Date().toISOString()
        });

        const orderid = `order_${idSuffix}`;
        dataset.orders.push({
          bid: bid,
          cid: cid,
          monitorupdated: new Date().toISOString(),
          monitor: true,
          invoiceid: `invoice_${idSuffix}`,
          orderid: orderid,
          expirydate: futureIsoDate(30, 365),
          title: `Procurement Contract Tier Line Item #${itemIdx}`,
          filename: `executed_order_manifest_${itemIdx}.pdf`,
          status: getRandomElem(statuses),
          amount: getRandomInt(1500, 25000),
          datecreated: new Date().toISOString()
        });

        // Nested Subcollection: businesses/{bid}/orders/{orderid}/carts
        const numCartItems = getRandomInt(1, 3);
        for (let cartIdx = 1; cartIdx <= numCartItems; cartIdx++) {
          const skuIdx = getRandomInt(0, productSkus.length - 1);
          const productsku = productSkus[skuIdx];
          const productName = getProductNameForSku(productsku);
          dataset.carts.push({
            bid: bid,
            cid: cid,
            orderid: orderid,
            sortorder: cartIdx,
            productsku,
            name: productName,
            description: `${productName} line item for order ${orderid}.`,
            price: getRandomInt(100, 5000),
            discountpercent: getRandomElem([0, 5, 10, 15]),
            taxable: Math.random() > 0.3,
            qty: getRandomInt(1, 10),
            years: getRandomElem([1, 2, 3]),
            hours: getRandomElem([undefined, 10, 20, 40]),
            nodes: getRandomElem([undefined, 1, 2, 4]),
            StartDate: new Date().toISOString()
          });
        }

        // Nested Subcollection: businesses/{bid}/orders/{orderid}/supporthoursused
        if (itemIdx % 2 === 0) {
          dataset.supporthoursused.push({
            bid: bid,
            cid: cid,
            orderid: orderid,
            ticketid: ticketid,
            hoursused: getRandomInt(1, 8),
            purpose: `Support engagement tied to order ${orderid}.`,
            datecreated: new Date().toISOString()
          });
        }

        const subsId = `sub_${idSuffix}`;
        dataset.subs.push({
          bid: bid,
          cid: cid,
          orderid: orderid,
          monitorupdated: new Date().toISOString(),
          monitor: true,
          purchaser: `Entity Representative Ref ${c}`,
          subsid: subsId,
          product: getRandomElem(products),
          productkey: getRandomElem(['netzoom', 'vss', '']),
          status: 'Active',
          statusupdatedby: 'system_mock_gen',
          statusreason: 'Initial activation',
          UserCount: getRandomInt(5, 250),
          RackCount: getRandomInt(1, 40),
          startdate: new Date().toISOString(),
          enddate: new Date(Date.now() + 31536000000).toISOString(), // +1 year from now
          datecreated: new Date().toISOString()
        });

        // Nested Subcollection data tied back structurally via subsid field mapping
        dataset.downloads.push({
          bid: bid,
          cid: cid,
          subsid: subsId,
          monitorupdated: new Date().toISOString(),
          monitor: false,
          eqid: eqidDoc.eqid,
          filename: `secured_digital_package_v${itemIdx}.zip`,
          dateused: new Date().toISOString()
        });
      }
    }
  }

  validateDatasetAgainstSchema(dataset);

  legacyOutputFiles.forEach((fileName) => {
    const filePath = path.join(TARGET_DIR, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  // 4. Output dataset mapping each array cleanly to its independent JSON resource file
  Object.keys(dataset).forEach((collectionName) => {
    const filePath = path.join(TARGET_DIR, `${collectionName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(dataset[collectionName], null, 2), 'utf8');
    console.log(`Saved ${dataset[collectionName].length} records to file: ${filePath}`);
  });
}

generateMockData();
console.log('\n[SUCCESS] Custom dataset generation successfully finished!');
