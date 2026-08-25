# Simple session Launch

# How to use this component
- User need to integrate this component in App qa launch
# Developer: NK 

# Packages used for the component 
 

interface IAppqaLaunch {
    uniqueName: string;//unique identifier for the control
}


# Simple Reminder component

# How to use this component 
- User need to use this compoent create Grid for App Qa reminders.

# Developer: TU

# Packages used for the component 
 
 npm i ag-grid-react
 npm i ag-grid-community
 npm i @mui/material
 npm i @emotion/react
 npm i @emotion/styled
 npm i lodash
 npm i @types/lodash

interface IAppqaReminder {
    uniqueName: string;//unique identifier for the control

}

# Simple session close

# How to use this component
- User need to integrate this component in App qa close

# Developer: TU

# Packages used for the component 

npm i @mui/material @emotion/react @emotion/styled 

# component:appqaclose
# types and interfaces

interface IAppqaClose {
    uniqueName: string;//unique identifier for the control
}


interface IActionImage {
    uniqueName: string;//Unique identifier and required
    image: IImage;
    w: number | string; //Width
    actionCode: string;//it will be used to identify the action source
    handleMouse: (event: React.MouseEvent<HTMLDivElement>, actionCode?: string, payload?: any) => void;
    h?: number | string;//if not provided it will take h=w
    label?: ILabel;
    labelAlign?: "bottom" | "top";//if not provided it will take bottom
    labeltooltip?: string;
    border?: "none" | string; //If set border will show default none
    selected?: boolean;// it will be used to set selected 
    disabled?: boolean;// it will be used to set the action image disabled
    payload?: any // api data to be sent
}
 interface IActionImageStrip {
    uniqueName:string;//Unique name for the control and required
    actionImages: IActionImage[];
    isVertical: boolean;//Whether strip will show wertically or not
    w: number | string;//Width of strip
    h: number | string;//Height of strip 
    bgColor?: string;//Background color of the strip 
    border?: string;//border to show it required
    spacing?: string;//if provided it will apply padding between contianer and action images 
    handleMouse?: (event: any, actionCode?: string) => void;
}

 interface IImage {
    uniqueName: string;//uniqueName for the control and required
    source: Exclude<string, "">;//source can be in url/svg/encrypted form and should not empty
    w: number | string; // Width
    h?: number | string;// If Height will not be given it will set h=w 
    tooltip?: string;//Tooltip will be shown on image if provided
    type?: "svg" | "png";//Type of image, Default svg
    altSource?: string;// It will used to show the alternative image or text if source image not found 
}
interface ILabel {
    uniqueName: string; //uniqueName for the control and required
    label: Exclude<string, "">;//string length can be 1 to (2,147,483,647)
    tooltip?: string;
    fontSize?: string;// font size can be given "14px", "1em" ,"80%".
    fontStyle?: "normal" | "italic";// if not provided it will take default from css
    fontWeight?: "normal" | string;// if not provided it will take default from css
    color?: string;
}