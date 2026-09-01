import { FeaturePlaceholder } from '../featureplaceholder/FeaturePlaceholder';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ClientEnums } from '../../../constants/Feature';

interface ISSIAndOtherServicesProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
}

const SSIAndOtherServices = (props: ISSIAndOtherServicesProps) => {
    return (
        <FeaturePlaceholder
            uniqueName={props.uniqueName ?? 'feature-ssiandotherservices'}
            featureId={props.featureId ?? ClientEnums.SSIAndOtherServices}
            featureName={props.headerText ?? 'SSI and Other Services'}
        />
    );
};

export { SSIAndOtherServices };
export default SSIAndOtherServices;
