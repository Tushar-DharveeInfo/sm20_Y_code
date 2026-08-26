import React from 'react';
import { DcExplorerContainer } from '../../../shared/dcexplorercontainer/DcExplorerContainer';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ClientEnums } from '../../../constants/Feature';

interface IResellerProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
    onNodeSelect?: (selectedKeys: any[], info: any) => void;
}

const Reseller: React.FC<IResellerProps> = (props) => {
    const {
        uniqueName = 'feature-reseller',
        featureId = ClientEnums.Reseller,
        onNodeSelect
    } = props;

    return (
        <div className="nz-feature-reseller nz-wh-100">
            <DcExplorerContainer
                uniqueName={`${uniqueName}-explorer`}
                featureId={featureId}
                handleNodeSelect={onNodeSelect}
            />
        </div>
    );
};

export { Reseller };
export default Reseller;
