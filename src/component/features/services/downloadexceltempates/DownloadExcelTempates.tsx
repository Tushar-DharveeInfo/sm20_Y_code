import { FeaturePlaceholder } from '../../client/featureplaceholder/FeaturePlaceholder';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ServicesEnums } from '../../../constants/Feature';

interface IDownloadExcelTempatesProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
}

const DownloadExcelTempates = (props: IDownloadExcelTempatesProps) => {
    return (
        <FeaturePlaceholder
            uniqueName={props.uniqueName ?? 'feature-downloadexceltempates'}
            featureId={props.featureId ?? ServicesEnums.DownloadExcelTempates}
            featureName={props.headerText ?? 'Download Excel tempates'}
            message="Y will provide information"
        />
    );
};

export { DownloadExcelTempates };
export default DownloadExcelTempates;
