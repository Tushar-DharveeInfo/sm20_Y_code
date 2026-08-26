import React from 'react';
import DashboardChartsContainer from '../dashboardchartscontainer/DashboardChartsContainer';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { HomeEnums } from '../../../constants/Feature';

interface IHomeProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
    handleShowUserMessage?: (messageText: string, container?: HTMLDivElement) => void;
}

const Home: React.FC<IHomeProps> = (props) => {
    const {
        uniqueName = 'feature-home',
        featureId = HomeEnums.HomeDashboard,
        headerText = 'Home',
        handleShowUserMessage
    } = props;

    return (
        <div className="nz-feature-home nz-wh-100">
            <DashboardChartsContainer
                uniqueName={`${uniqueName}-dashboard`}
                featureId={featureId}
                headerText={headerText}
                handleShowUserMessage={handleShowUserMessage}
            />
        </div>
    );
};

export { Home };
export default Home;
