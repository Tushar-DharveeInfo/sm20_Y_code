import React from 'react';
import { DcExplorerContainer } from '../../../shared/dcexplorercontainer/DcExplorerContainer';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ClientEnums } from '../../../constants/Feature';

interface IMcsProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
    onNodeSelect?: (selectedKeys: any[], info: any) => void;
}

const Mcs: React.FC<IMcsProps> = (props) => {
    const {
        uniqueName = 'feature-mcs',
        featureId = ClientEnums.Mcs,
        onNodeSelect
    } = props;

    return (
        <div className="nz-feature-mcs nz-wh-100">
            <DcExplorerContainer
                uniqueName={`${uniqueName}-explorer`}
                featureId={featureId}
                handleNodeSelect={onNodeSelect}
            />
        </div>
    );
};

export { Mcs };
export default Mcs;
