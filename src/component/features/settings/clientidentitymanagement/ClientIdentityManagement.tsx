import { FeaturePlaceholder } from '../../client/featureplaceholder/FeaturePlaceholder';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { SettingsEnums } from '../../../constants/Feature';

interface IClientIdentityManagementProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
}

const ClientIdentityManagement = (props: IClientIdentityManagementProps) => {
    return (
        <FeaturePlaceholder
            uniqueName={props.uniqueName ?? 'feature-clientidentitymanagement'}
            featureId={props.featureId ?? SettingsEnums.ClientIdentityManagement}
            featureName={props.headerText ?? 'Client Identity Management'}
        />
    );
};

export { ClientIdentityManagement };
export default ClientIdentityManagement;
