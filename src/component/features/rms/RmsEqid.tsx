import React from 'react';
import { TicketCardsPane } from '../tickets/ticketcardspane/TicketCardsPane';
import { IFeatureItem } from '../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../shared/allinterface/menu/IMainMenu';
import { ITreeNode } from '../../shared/allinterface/tree/ITreeControl';
import { ILibraryTicketMode } from '../appqa/allcommon/FnBuildTicketTree';
import { useSelectedNodeContext } from '../../shared/context/hooks/SelectedNodeHooks';
import { useSmDataContext } from '../../shared/context/hooks/SmDataHooks';
import { RmsEnums } from '../../constants/Feature';

interface IRmsEqidProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    libraryMode?: ILibraryTicketMode;
    selectedNode?: ITreeNode;
    treeData?: ITreeNode[];
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
}

const RmsEqid: React.FC<IRmsEqidProps> = (props) => {
    const {
        uniqueName = 'feature-rms-eqid',
        featureId = RmsEnums.EQID,
        headerText = 'EQID Development',
        libraryMode = 'InProgress',
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
        <div className="nz-feature-rms-eqid nz-wh-100">
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

export { RmsEqid };
export default RmsEqid;
