
import { LibraryEnums } from '../../../constants/Feature'
import { DeviceModel } from './devicemodel/DeviceModel'
import { ITreeNode } from '../../../shared/allinterface/tree/ITreeControl'
import './DeviceLibrary.css'
import { Label } from '../../../shared/basic/label/Label'

interface IDeviceLibrary {
    uniqueName?: string
    featureId?: string
    headerText?: string
}

const EMPTY_SELECTED_NODE: ITreeNode = {
    key: 'device-library-root',
    NodeEntityname: null,
    NodeEntID: null,
    stepNo: 0,
    parentEntID: null,
    NodeState: null,
    Description: null,
    title: 'Device Library',
    children: [],
    treetype: 'Feature',
    Name: 'Device Library',
    Type: 'Feature',
    icon: null,
    HasChildren: 0,
}

/*Library / Device Library — Device Model browser (same UX as service20). */
const DeviceLibrary = (props: IDeviceLibrary = {}) => {
    const uniqueName = props.uniqueName ?? 'device-library'
    const featureId = props.featureId ?? LibraryEnums.DeviceLibrary

    return (
        <div className="nz-device-library nz-wh-100 nz-d-flex-column" id={uniqueName}>
            <div
                className="nz-sub-header"
            >
                <Label
                    uniqueName={`${uniqueName}-header-label`}
                    label={props.headerText || "Device Library"}
                    fontWeight="bold"
                />
            </div>
            <DeviceModel
                uniqueName={`${uniqueName}-device-model`}
                featureId={featureId}
                selectedNode={EMPTY_SELECTED_NODE}
                treeData={null}
                ShowOnlyLibraryRadioB={true}
                addToDownloadCart={(mfg, prodno, EQID) => {
                    console.log(`Device Library cart: mfg=${mfg}, prodno=${prodno}, EQID=${EQID}`)
                }}
                saveSearchCriteria={(searchText, AndOr, mfg, eqtype, pno) => {
                    console.log(`Device Library search: ${searchText}, ${AndOr}, ${mfg}, ${eqtype}, ${pno}`)
                }}
            />
        </div>
    )
}

export { DeviceLibrary }
export default DeviceLibrary
