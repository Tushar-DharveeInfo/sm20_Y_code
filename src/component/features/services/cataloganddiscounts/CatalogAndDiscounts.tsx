import { FeaturePlaceholder } from '../../client/featureplaceholder/FeaturePlaceholder';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ServicesEnums } from '../../../constants/Feature';

interface ICatalogAndDiscountsProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
}

const CatalogAndDiscounts = (props: ICatalogAndDiscountsProps) => {
    return (
        <FeaturePlaceholder
            uniqueName={props.uniqueName ?? 'feature-cataloganddiscounts'}
            featureId={props.featureId ?? ServicesEnums.CatalogAndDiscounts}
            featureName={props.headerText ?? 'Catalog and Discounts'}
            message="Y will provide information"
        />
    );
};

export { CatalogAndDiscounts };
export default CatalogAndDiscounts;
