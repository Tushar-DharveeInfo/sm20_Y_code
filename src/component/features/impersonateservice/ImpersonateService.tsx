import { ImpersonateUser } from './ImpersonateUser';
import { IFeatureItem } from '../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../shared/allinterface/menu/IMainMenu';
import { ITreeNode } from '../../shared/allinterface/tree/ITreeControl';
import { useSmDataContext } from '../../shared/context/hooks/SmDataHooks';
import { Label } from '../../shared/basic/label/Label';

interface IImpersonateServiceProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    selectedNode?: ITreeNode;
    treeData?: ITreeNode[];
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
}

const ImpersonateService = (props: IImpersonateServiceProps) => {
    const smDataContext = useSmDataContext();
    const selectedNode = props.selectedNode ?? smDataContext.selectedNode;
    const nodeType = String(selectedNode?.NodeType ?? "").toLowerCase();
    const bid = String(
        smDataContext.selection.bid
        ?? selectedNode?.bid
        ?? selectedNode?.parentEntID
        ?? ""
    ).trim();
    const cid = String(
        smDataContext.selection.cid
        ?? selectedNode?.cid
        ?? (nodeType === "contact" ? selectedNode?.NodeEntID ?? selectedNode?.key : "")
        ?? ""
    ).trim();
    const isContactSelected = nodeType === "contact" || Boolean(cid);

    if (!isContactSelected || !cid) {
        return (
            <div className="nz-wh-100 nz-d-flex-hv-center" style={{ padding: "var(--spacing-2)" }}>
                <Label
                    uniqueName={`${props.uniqueName ?? "feature-services"}-select-contact`}
                    label="Select a contact node to impersonate"
                />
            </div>
        );
    }

    return (
        <div className="nz-wh-100 nz-d-flex-hv-center">
            <ImpersonateUser
                key={`${bid}-${cid}`}
                data={{
                    tenantshortname: bid,
                    userid: cid,
                }}
            />
        </div>
    );
};

export { ImpersonateService };
export default ImpersonateService;
export type { IImpersonateServiceProps };
