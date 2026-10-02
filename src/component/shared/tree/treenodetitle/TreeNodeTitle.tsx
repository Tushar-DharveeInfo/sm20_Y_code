
import { Fragment, MouseEvent } from 'react'
import { Cart24x24, Check } from '@n20a/libicon';
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable';
import { FnGetLeafStatusIconConfig } from '../../allcommon/tree/FnGetLeafStatusIconConfig';
import { ITreeNode, ISelectedNodeInfo } from '../../allinterface/tree/ITreeControl';
import { IFeatureTree } from '../../allinterface/tree/ITreeForHierarchicalDataContainer';
import { Image } from '../../basic/image/Image';
import { NodeMenu } from '../../menu/nodemenu/NodeMenu';
import { getfeaturesData } from '../../context/contextandprovider/MainApp';
import { IFeatureItem } from '../../allinterface/menu/INodeMenu';
import { SettingEnums } from '../../../constants/Feature';

const TreeNodeTitle = (
    treeNode: ITreeNode,
    treeDataProps: IFeatureTree,
    featureId?: string,
    showKebabIcon?: boolean,
    showCopyIcon?: boolean,
    selectedNodeExplorer?: ISelectedNodeInfo,
    handleKebabMenuSelect?: (selectedItem: any) => void,
    featureData?: IFeatureItem[]
) => {
    const clonedNode = { ...treeNode, title: "", icon: null, children: [] };
    const nodeTooltip = `${treeNode.Description ?? ""}${treeNode.WOID ? ` (${treeNode.WOID})` : ""}`
    let titleContent = `${treeNode.Name ?? ""}`.trim();
    if (!titleContent) {
        if (treeNode.NodeType === 'Mfg' || treeNode.treetype === 'Mfg') {
            titleContent = 'Support Ticket';
        } else if (treeNode.ticketRecord) {
            const ticket = treeNode.ticketRecord as Record<string, unknown>;
            titleContent = String(ticket.prodno || ticket.ticketid || ticket.tickettype || 'Support Ticket').trim();
        }
    }

    const nodeStatus = String(treeNode.status ?? treeNode.NodeState ?? '').trim().toLowerCase();
    const isBlocked = nodeStatus === 'blocked';
    const isDeleted = nodeStatus === 'deleted' || nodeStatus === 'tobedeleted';

    const nodeNameStyle: React.CSSProperties = {
        ...(isBlocked ? { color: 'red' } : {}),
        ...(isDeleted ? { textDecoration: 'line-through' } : {}),
    };

    const nodeStatusClass = `${isBlocked ? 'nz-tree-node-blocked' : ''} ${isDeleted ? 'nz-tree-node-deleted' : ''}`.trim();

    const renderNodeName = () => {
        return (
            <span
                key={`node-title-content-${treeNode.key}`}
                className={nodeStatusClass || undefined}
                style={nodeNameStyle}
            >
                {treeNode.TableLabel || titleContent}
            </span>
        );
    };


    const handleDownloadClick = (event: MouseEvent<HTMLSpanElement>) => {
        event.preventDefault();
        event.stopPropagation();
        treeDataProps?.onAddToDownloadCart?.(treeNode);
    };

    const renderVerifiedIcon = () => {
        if (!treeNode.IsAuthorized && !treeNode.verified) {
            return null
        }
        return (
            <span className="nz-tree-node-auth-icon" style={{ marginLeft: 6 }}>
                <Image
                    source={
                        <Check
                            size={FnGetCssVariable('--image-size-1')}
                            fill="none"
                            strokeWidth={1}
                        />
                    }
                    uniqueName={`${treeNode.key}-icheck`}
                    w={'var(--image-size-2)'}
                    tooltip="Verified"
                    type="svg"
                />
            </span>
        )
    }

    const renderIcon = () => {
        const showDownloadIcon =
            treeNode.treetype?.toLowerCase() === "product" &&
            !!treeDataProps?.onAddToDownloadCart;
        const statusIconConfig = treeDataProps?.showLeafStatusIcon
            ? FnGetLeafStatusIconConfig(treeNode)
            : null;
        const StatusIcon = statusIconConfig?.Icon;

        const isContactNode = Boolean(
            treeNode.NodeType?.toLowerCase() === "contact" ||
            treeNode.treetype?.toLowerCase() === "contact" ||
            treeNode.NodeEntityname?.toLowerCase() === "contact" ||
            (treeNode.cid && treeNode.cid !== treeNode.bid)
        );

        const isRootNode =
            treeNode.key === "root-businesses" ||
            treeNode.NodeType?.toLowerCase() === "root";

        const isSettingDeleteFeature =
            featureId === SettingEnums.Delete ||
            featureId === "920" ||
            String(featureId).toLowerCase() === "delete";

        const allowKebab =
            showKebabIcon &&
            handleKebabMenuSelect &&
            !isRootNode &&
            (isContactNode || isSettingDeleteFeature);

        return (
            <span className="nz-tree-node-icons-wrapper" key={`node-icons-${treeNode.key}`}>

                {allowKebab && (
                    <span key={`node-icons-kebabmenu-${treeNode.key}`} className="nz-tree-node-nz-icon-div nz-node-kebab-copy-icon">
                        <NodeMenu
                            showIcon={true}
                            uniqueName={`kebab-${treeNode.key}`}
                            handleSelect={(item: any) => handleKebabMenuSelect(item, treeNode)}
                            featureId={featureId}
                            selectedNode={treeNode}
                            container="explorer_tree"
                            featureData={featureData || getfeaturesData() || []}
                            allowAddCopyIconInOverlay={true}
                        />
                    </span>
                )}

                {StatusIcon && statusIconConfig && (
                    <span
                        key={`node-icons-status-${treeNode.key}`}
                        className="nz-tree-node-nz-icon-div nz-tree-node-status-icon"
                    >
                        <Image
                            source={<StatusIcon
                                fill='none'
                                strokeWidth={1}
                                size={FnGetCssVariable('--image-size-1')} />}
                            uniqueName={`${treeNode.key}-icon-status`}
                            w={16}
                            tooltip={statusIconConfig.tooltip}
                            type='svg'
                        />
                    </span>
                )}

                {showDownloadIcon && (
                    <span
                        key={`node-icons-download-${treeNode.key}`}
                        className="nz-tree-node-nz-icon-div nz-node-download-cart-icon"
                        onClick={handleDownloadClick}
                        onMouseDown={(event) => event.stopPropagation()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                treeDataProps.onAddToDownloadCart?.(treeNode);
                            }
                        }}
                    >
                        <Image
                            source={<Cart24x24
                                fill='none'
                                strokeWidth={1}
                                size={FnGetCssVariable('--image-size-1')} />}
                            uniqueName={`${treeNode.key}-icon-download-cart`}
                            w={16}
                            tooltip={"Add to Download cart"}
                            type='svg'
                        />
                    </span>
                )}

                {renderVerifiedIcon()}
            </span>
        );
    };

    return (
        <span
            key={`node-title-${treeNode.key}`}
            rel="tooltip"
            title={nodeTooltip}
            data-html="true"
            className={'nz-tree-node-title'}
            id={treeNode.EntID || treeNode.key}
            node-info={JSON.stringify(clonedNode)}
        >
            <span className="nz-tree-node-content">
                <span
                    key={`node-title-name-${treeNode.key}`}
                    className={`${treeNode.EntID || ''} ${nodeStatusClass}`.trim()}
                    style={nodeNameStyle}
                    node-info={JSON.stringify(clonedNode)}
                >
                    {renderNodeName()}
                </span>
                <Fragment key={`node-title-icon-${treeNode.key}`}>
                    {renderIcon()}
                </Fragment>
            </span>
        </span>
    );
}
export { TreeNodeTitle }
