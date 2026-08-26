import React from 'react';
import { DcExplorerContainer } from '../../../shared/dcexplorercontainer/DcExplorerContainer';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ClientEnums } from '../../../constants/Feature';

interface ISSIAndOtherServicesProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
    onNodeSelect?: (selectedKeys: any[], info: any) => void;
}

const SSIAndOtherServices: React.FC<ISSIAndOtherServicesProps> = (props) => {
    const {
        uniqueName = 'feature-ssiandotherservices',
        featureId = ClientEnums.SSIAndOtherServices,
        onNodeSelect
    } = props;

    return (
        <div className="nz-feature-ssiandotherservices nz-wh-100">
            <DcExplorerContainer
                uniqueName={`${uniqueName}-explorer`}
                featureId={featureId}
                handleNodeSelect={onNodeSelect}
            />
        </div>
    );
};

export { SSIAndOtherServices };
export default SSIAndOtherServices;
