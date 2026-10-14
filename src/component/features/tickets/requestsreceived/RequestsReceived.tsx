import React from 'react';
import { TicketCardsPane } from '../ticketcardspane/TicketCardsPane';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ITreeNode } from '../../../shared/allinterface/tree/ITreeControl';
import { ILibraryTicketMode } from '../tickets/ticketexplorercontainer/TicketExplorerContainer';
import { useSelectedNodeContext } from '../../../shared/context/hooks/SelectedNodeHooks';
import { useSmDataContext } from '../../../shared/context/hooks/SmDataHooks';
import { TicketsEnums } from '../../../constants/Feature';

interface IRequestsReceivedProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    libraryMode?: ILibraryTicketMode;
    selectedNode?: ITreeNode;
    treeData?: ITreeNode[];
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
}

const RequestsReceived: React.FC<IRequestsReceivedProps> = (props) => {
    const {
        uniqueName = 'feature-requestsreceived',
        featureId = TicketsEnums.RequestsReceived,
        headerText = 'Requests Received',
        libraryMode = 'Open',
        selectedNode,
        treeData = [],
    } = props;

    const smDataContext = useSmDataContext();
    const selectedNodeContext = useSelectedNodeContext();
    const activeNode =
        selectedNode ??
        smDataContext?.selectedNode ??
        selectedNodeContext?.selectedNode ??
        selectedNodeContext?.selectedNodeExplorer ??
        (selectedNodeContext?.selectedNodeExplorer as any)?.node ??
        ({ NodeType: 'Root', key: 'root' } as ITreeNode);

    return (
        <div className="nz-feature-requestsreceived nz-wh-100">
            <TicketCardsPane
                uniqueName={`${uniqueName}-ticket-cards`}
                featureId={featureId}
                headerText={headerText}
                libraryMode={libraryMode}
                selectedNode={activeNode}
                treeData={treeData}
            />
        </div>
    );
};

export { RequestsReceived };
export default RequestsReceived;
