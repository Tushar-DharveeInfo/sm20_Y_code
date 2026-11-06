const Styles = [
  { "Style": "1", "StyleAcronym": "F", "Description": "2D Front View", "PrintOrder": "1" },
  { "Style": "2", "StyleAcronym": "R", "Description": "2D Rear View", "PrintOrder": "2" },
  { "Style": "3", "StyleAcronym": "3FR", "Description": "3D Front View at 45°", "PrintOrder": "8" },
  { "Style": "4", "StyleAcronym": "3FT", "Description": "3D Top View at Front Side", "PrintOrder": "12" },
  { "Style": "5", "StyleAcronym": "3FL", "Description": "3D Front View at 120°", "PrintOrder": "14" },
  { "Style": "6", "StyleAcronym": "3FB", "Description": "3D - Front at 270 degree or bottom", "PrintOrder": "16" },
  { "Style": "7", "StyleAcronym": "3RR", "Description": "3D Rear View at 45°", "PrintOrder": "9" },
  { "Style": "8", "StyleAcronym": "3RT", "Description": "3D Top View at Rear Side", "PrintOrder": "13" },
  { "Style": "9", "StyleAcronym": "3RL", "Description": "3D Rear View at 120°", "PrintOrder": "15" },
  { "Style": "B", "StyleAcronym": "MRS", "Description": "2D Rear Module", "PrintOrder": "11" },
  { "Style": "C", "StyleAcronym": "MFS", "Description": "2D Front Module", "PrintOrder": "10" },
  { "Style": "D", "StyleAcronym": "CR", "Description": "2D Blank chassis - Rear", "PrintOrder": "7" },
  { "Style": "I", "StyleAcronym": "CF", "Description": "2D Front Blank Chassis", "PrintOrder": "6" },
  { "Style": "J", "StyleAcronym": "CF3", "Description": "3D Front Blank Chassis", "PrintOrder": "22" },
  { "Style": "L", "StyleAcronym": "LS", "Description": "2D Left Side View", "PrintOrder": "4" },
  { "Style": "R", "StyleAcronym": "RS", "Description": "2D Right Side View", "PrintOrder": "5" },
  { "Style": "T", "StyleAcronym": "T", "Description": "2D Top View", "PrintOrder": "3" },
  { "Style": "Y", "StyleAcronym": "FS3", "Description": "3D Front Slots", "PrintOrder": "23" },
  { "Style": "Z", "StyleAcronym": "RS3", "Description": "3D Rear Slots", "PrintOrder": "24" }
];

function getStyleOptions(eqid:string ) {
  return Styles.flatMap(record => {
    const base = `${eqid}${record.StyleAcronym}`;
    const recordString = JSON.stringify(record);
    
    return [
      `${base}:'H' - ${recordString}`,
      `${base}:'V' - ${recordString}`
    ];
  });
}

// Example usage:
console.log(getStyleOptions("DELL002"));


function getSelectedStyles(stringArray:string[]) {
  return stringArray.map(str => {
    const delimiterIndex = str.indexOf(' - ');
    // If the delimiter is found, return everything to the left of it; otherwise, return the whole string
    return delimiterIndex !== -1 ? str.substring(0, delimiterIndex) : str;
  });
}

// Example usage:
const input = [
  `DELL002F:'H' - {"Style":"1","StyleAcronym":"F","Description":"2D Front View","PrintOrder":"1"}`,
  `DELL002F:'V' - {"Style":"1","StyleAcronym":"F","Description":"2D Front View","PrintOrder":"1"}`,
  `DELL002R:'H' - {"Style":"2","StyleAcronym":"R","Description":"2D Rear View","PrintOrder":"2"}`,
  `DELL002R:'V' - {"Style":"2","StyleAcronym":"R","Description":"2D Rear View","PrintOrder":"2"}`,
  `DELL0023FR:'H' - {"Style":"3","StyleAcronym":"3FR","Description":"3D Front View at 45°","PrintOrder":"8"}`,
  `DELL0023FR:'V' - {"Style":"3","StyleAcronym":"3FR","Description":"3D Front View at 45°","PrintOrder":"8"}`,
  `DELL0023FT:'H' - {"Style":"4","StyleAcronym":"3FT","Description":"3D Top View at Front Side","PrintOrder":"12"}`,
  `DELL0023FT:'V' - {"Style":"4","StyleAcronym":"3FT","Description":"3D Top View at Front Side","PrintOrder":"12"}`,
  `DELL0023FL:'H' - {"Style":"5","StyleAcronym":"3FL","Description":"3D Front View at 120°","PrintOrder":"14"}`,
  `DELL0023FL:'V' - {"Style":"5","StyleAcronym":"3FL","Description":"3D Front View at 120°","PrintOrder":"14"}`,
  `DELL0023FB:'H' - {"Style":"6","StyleAcronym":"3FB","Description":"3D - Front at 270 degree or bottom","PrintOrder":"16"}`,
  `DELL0023FB:'V' - {"Style":"6","StyleAcronym":"3FB","Description":"3D - Front at 270 degree or bottom","PrintOrder":"16"}`,
  `DELL0023RR:'H' - {"Style":"7","StyleAcronym":"3RR","Description":"3D Rear View at 45°","PrintOrder":"9"}`
];

console.log(getSelectedStyles(getStyleOptions("DELL002")));
