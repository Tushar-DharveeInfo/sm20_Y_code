import { useState, useEffect, useRef } from 'react'
import { IFeatureItem } from '../../../../shared/context/allinterface/IMainApp';
import { IMenuItem } from '../../../../shared/allinterface/menu/IMainMenu';
import { ITreeNode } from '../../../../shared/allinterface/tree/ITreeControl';
import { useSmDataContext } from '../../../../shared/context/hooks/SmDataHooks';
import { Label } from '../../../../shared/basic/label/Label';
import { YesNoForm } from '@n20a/libform'

type ServicesRedirectProps = {
    bid?: string;
    cid?: string;
    tenantid?: string;
}

interface IImpersonateServiceProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    selectedNode?: ITreeNode;
    treeData?: ITreeNode[];
    featureData?: IFeatureItem[];
    selectedFeatureData?: IMenuItem;
}

function ServicesExternalRedirect({ bid, cid, tenantid }: ServicesRedirectProps) {
    const hasOpenedRef = useRef<boolean>(false);

    useEffect(() => {
        if (hasOpenedRef.current) {
            return;
        }
        hasOpenedRef.current = true;

        const bidParam = String(bid ?? '');
        const cidParam = String(cid ?? '');
        const tenantidParam = String(tenantid ?? '');
        const params = new URLSearchParams({ ...(bidParam && { bid: bidParam }), ...(cidParam && { cid: cidParam }), ...(tenantidParam && { tenantid: tenantidParam }) });
        window.open(`https://service20.netzoom.com${params.size ? `?${params}` : ''}`, 'SM-Service', 'noopener,noreferrer');
    }, [bid, cid, tenantid]);

    return null;
}

const ImpersonateService = (props: IImpersonateServiceProps) => 
{
    const [launch, setLaunch] = useState(false)
    const [bid, setBid] = useState('');
    const [cid, setCid] = useState('');
    const [tenantid, setTenantid] = useState('');
    const smDataContext = useSmDataContext();
    const selectedNode = props.selectedNode ?? smDataContext.selectedNode;
    const nodeType = String(selectedNode?.NodeType ?? "").toLowerCase();

    useEffect(() => {
        setBid(String(
            smDataContext.selection.bid
            ?? selectedNode?.bid
            ?? selectedNode?.parentEntID
            ?? ""
        ).trim());
    }, [smDataContext.selection.bid, selectedNode?.bid, selectedNode?.parentEntID]);

    useEffect(() => {
        setCid(String(
            smDataContext.selection.cid
            ?? selectedNode?.cid
            ?? (nodeType === "contact" ? selectedNode?.NodeEntID ?? selectedNode?.key : "")
            ?? ""
        ).trim());
    }, [smDataContext.selection.cid, selectedNode?.cid, selectedNode?.NodeEntID, selectedNode?.key, nodeType]);

    useEffect(() => {
        setTenantid(String(
            smDataContext.selection.selectedtenantshortname
            ?? selectedNode?.tenantid
            ?? ""
        ).trim());
    }, [smDataContext.selection.selectedtenantshortname, selectedNode?.tenantid]);

console.log("Y-ImpersontateService launch, launch state:", launch, "bid:", bid, "cid:", cid, "tenantid:", tenantid, "Selected Node:", selectedNode, "Node Type:", nodeType);

    const handleYes = () => {
        setLaunch(true); console.log("ImpersonateServiceClient handleYes clicked", bid, cid)
    }

    const YesNoFormProps = {
        title: "Want to Impersonate user",
        message: `Ready to launch Service portal and Impersonate as ${cid} of ${bid} ?`,
        buttonLabels: ["Yes"],
        onButtonClick: handleYes
    }

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
            {
                launch ? <ServicesExternalRedirect key={`${bid}-${cid}`} bid={bid} cid={cid} 
                tenantid={smDataContext.selection.selectedtenantshortname ?? selectedNode?.tenantid ?? ""} />
                    :
                    <YesNoForm {...YesNoFormProps} />
            }
        </div>
    );
};

export { ImpersonateService };
export default ImpersonateService;
export type { IImpersonateServiceProps };
