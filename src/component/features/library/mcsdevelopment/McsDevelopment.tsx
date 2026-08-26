import React from 'react';
import LibraryTicketsContainer from '../librarytickets/LibraryTicketsContainer';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ITreeNode } from '../../../shared/allinterface/tree/ITreeControl';
import { ILibraryTicketMode } from '../../../shared/ticketexplorercontainer/TicketExplorerContainer';
import { useSelectedNodeContext } from '../../../shared/context/hooks/SelectedNodeHooks';
import { LibraryEnums } from '../../../constants/Feature';

interface IMcsDevelopmentProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    libraryMode?: ILibraryTicketMode;
    selectedNode?: ITreeNode;
    treeData?: ITreeNode[];
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
}

const McsDevelopment: React.FC<IMcsDevelopmentProps> = (props) => {
    const {
        uniqueName = 'feature-mcsdevelopment',
        featureId = LibraryEnums.McsDevelopment,
        headerText = 'MCS Development',
        libraryMode = 'mcs',
        selectedNode,
        treeData = [],
        featureData,
        selectedFeatureData
    } = props;

    const selectedNodeContext = useSelectedNodeContext();
    const activeNode =
        selectedNode ??
        selectedNodeContext?.selectedNode ??
        selectedNodeContext?.selectedNodeExplorer?.node ??
        ({ NodeType: 'Root', key: 'root' } as ITreeNode);

    return (
        <div className="nz-feature-mcsdevelopment nz-wh-100">
            <LibraryTicketsContainer
                uniqueName={`${uniqueName}-tickets`}
                featureId={featureId}
                featureData={featureData}
                selectedFeatureData={selectedFeatureData}
                headerText={headerText}
                libraryMode={libraryMode}
                selectedNode={activeNode}
                treeData={treeData}
            />
        </div>
    );
};

export { McsDevelopment };
export default McsDevelopment;
