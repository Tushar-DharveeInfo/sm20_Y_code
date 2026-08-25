import '../../allcss/home/DashboardChartsContainer.css';
import { IDashboardChartsContainer } from '../../allinterface/home/IDashboardChartsContainer';
import { Label } from '../../../shared/basic/label/Label';
import { DashboardChart } from './DashbordChart';

const DashboardChartsContainer = (props: IDashboardChartsContainer) => {
    return (
        <div key={props.uniqueName} className="nz-dashboard-chart-container">
            {props.headerText !== '' && (
                <div className="nz-sub-header  nz-d-flex-row nz-w-100 nz-h-40-px">
                    <Label
                        uniqueName={`${props.uniqueName}-header`}
                        label={props.headerText}
                        fontWeight="bold"
                    />
                </div>
            )}
            <DashboardChart
                hideHeader={true}
                isDashboard={props.selectedNode ? false : true}
                title="Dashboardchart"
                uniqueName={props.uniqueName}
                selectedNode={props.selectedNode}
                featureId={props.featureId}
                purpose={props.purpose}
                outputFormat={'jsx'}
                handleShowUserMessage={props.handleShowUserMessage}
            />
        </div>
    );
};

export { DashboardChartsContainer };
export default DashboardChartsContainer;
