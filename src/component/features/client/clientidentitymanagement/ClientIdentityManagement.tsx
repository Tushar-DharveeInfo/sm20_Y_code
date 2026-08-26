import React from 'react';
import { DcExplorerContainer } from '../../../shared/dcexplorercontainer/DcExplorerContainer';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ClientEnums } from '../../../constants/Feature';

interface IClientIdentityManagementProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
    onNodeSelect?: (selectedKeys: any[], info: any) => void;
}

const ClientIdentityManagement: React.FC<IClientIdentityManagementProps> = (props) => {
    const {
        uniqueName = 'feature-clientidentitymanagement',
        featureId = ClientEnums.ClientIdentityManagement,
        onNodeSelect
    } = props;

    return (
        <div className="nz-feature-clientidentitymanagement nz-wh-100">
            <DcExplorerContainer
                uniqueName={`${uniqueName}-explorer`}
                featureId={featureId}
                handleNodeSelect={onNodeSelect}
            />
        </div>
    );
};

export { ClientIdentityManagement };
export default ClientIdentityManagement;
