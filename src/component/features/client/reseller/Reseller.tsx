import { FeaturePlaceholder } from '../featureplaceholder/FeaturePlaceholder';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ClientEnums } from '../../../constants/Feature';

interface IResellerProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
}

const Reseller = (props: IResellerProps) => {
    return (
        <FeaturePlaceholder
            uniqueName={props.uniqueName ?? 'feature-reseller'}
            featureId={props.featureId ?? ClientEnums.Reseller}
            featureName={props.headerText ?? 'Reseller'}
        />
    );
};

export { Reseller };
export default Reseller;
