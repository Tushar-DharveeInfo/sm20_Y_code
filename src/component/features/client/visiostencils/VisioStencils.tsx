import { FeaturePlaceholder } from '../featureplaceholder/FeaturePlaceholder';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ClientEnums } from '../../../constants/Feature';

interface IVisioStencilsProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
}

const VisioStencils = (props: IVisioStencilsProps) => {
    return (
        <FeaturePlaceholder
            uniqueName={props.uniqueName ?? 'feature-visiostencils'}
            featureId={props.featureId ?? ClientEnums.VisioStencils}
            featureName={props.headerText ?? 'VisioStencils'}
        />
    );
};

export { VisioStencils };
export default VisioStencils;
