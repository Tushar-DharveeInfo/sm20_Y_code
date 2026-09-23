import React from 'react';
import { TicketCardsPane } from '../ticketcardspane/TicketCardsPane';
import { IFeatureItem } from '../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../shared/allinterface/menu/IMainMenu';
import { ITreeNode } from '../../../shared/allinterface/tree/ITreeControl';
import { ILibraryTicketMode } from '../tickets/ticketexplorercontainer/TicketExplorerContainer';
import { useSelectedNodeContext } from '../../../shared/context/hooks/SelectedNodeHooks';
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
        libraryMode = 'received',
        selectedNode,
        treeData = [],
    } = props;

    const selectedNodeContext = useSelectedNodeContext();
    const activeNode =
        selectedNode ??
        selectedNodeContext?.selectedNode ??
        selectedNodeContext?.selectedNodeExplorer?.node ??
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
