import { FeaturePlaceholder } from '../featureplaceholder/FeaturePlaceholder';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ClientEnums } from '../../../constants/Feature';

interface IMcsProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
}

const Mcs = (props: IMcsProps) => {
    return (
        <FeaturePlaceholder
            uniqueName={props.uniqueName ?? 'feature-mcs'}
            featureId={props.featureId ?? ClientEnums.Mcs}
            featureName={props.headerText ?? 'MCS'}
        />
    );
};

export { Mcs };
export default Mcs;
