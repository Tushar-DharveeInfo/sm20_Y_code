import React from 'react';
import { DcExplorerContainer } from '../../../shared/dcexplorercontainer/DcExplorerContainer';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ClientEnums } from '../../../constants/Feature';

interface IVisioStencilsProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
    onNodeSelect?: (selectedKeys: any[], info: any) => void;
}

const VisioStencils: React.FC<IVisioStencilsProps> = (props) => {
    const {
        uniqueName = 'feature-visiostencils',
        featureId = ClientEnums.VisioStencils,
        onNodeSelect
    } = props;

    return (
        <div className="nz-feature-visiostencils nz-wh-100">
            <DcExplorerContainer
                uniqueName={`${uniqueName}-explorer`}
                featureId={featureId}
                handleNodeSelect={onNodeSelect}
            />
        </div>
    );
};

export { VisioStencils };
export default VisioStencils;
