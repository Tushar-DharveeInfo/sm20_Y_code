import React, { useEffect, useRef, useState } from 'react';
import { useStatusBarContext } from '../../context/hooks/StatusBarHooks';
import { Kebab24x24 } from '@n20a/libicon';
import './NodeMenu.css';
import { KebabMenuRange } from '../../../constants/Feature';
import { IActionImageForSubMenu } from '../../allinterface/basic/IActionImageList';
import { ITreeNode, ISelectedNodeInfo } from '../../allinterface/tree/ITreeControl';
import { IMenuImage, MenuImage } from '../menuimage/MenuImage';
import { useCommonVariableContext } from '../../context/hooks/CommonVariableHooks';
import { AppQA } from '../../../constants/Feature';
import { useSessionContext } from '../../context/hooks/SessionHooks';
import OverlayIconStrip from '../overlayiconstrip/OverlayIconStrip';
import { FnCopyToClipboard } from '../../allcommon/basic/FnCopyToClipboard';
import { useMainAppContext } from '../../context/hooks/MainAppHooks';
import { FnParseJsonSafely } from '../../../appcontainer/allcommon/FnParseJsonSafely';

interface IFeatureItem {
    Label: string; // label to show in the kebab menu
    _Feature?: string | number; // feature id for unique identifier
    Tooltip?: string; // tooltip to show on kebab menu
    NodeType?: string; // Nodetype if needed in conditions
    [key: string]: string | any; // Allow additional dynamic properties
}

interface INodeMenu {
    showIcon: boolean;
    iconType?: "png" | "svg" | undefined; // icon type
    showLabel?: boolean;
    uniqueName: string; // unique name of component
    container: string; // name of container
    featureData: IFeatureItem[]; // feature api data
    handleSelect: (value: IActionImageForSubMenu) => void;
    label?: string; // label for kebab menu
    selectedNode?: ITreeNode; // selected node data
    iconName?: string; // show right mouse icon
    selectedRow?: Record<string, any>; // selected row of grid data.
    rowIndex?: number; // row index number
    field?: string; // selected field for grid
    featureId?: string; // feature id 
    MenuImage?: IMenuImage; // if you want to show image instead of three dot menu
    showFilterKeywordControl?: boolean; // if you pass true then it shows filter keyword
    disbledOverlay?: boolean; // if you want to disable the menu
    allowAddCopyIconInOverlay?: boolean; // if you want to add copy icon in overlay
    handleMouse?: (item: IMenuImage) => void;
}

const NodeMenu = (nodeMenuProps: INodeMenu) => {
    const [menuData, setMenuData] = useState<IFeatureItem[]>();
    const [selectedItem, setSelectedItem] = useState<IFeatureItem>();
    const [selectedNodeData, setSelectedNodeData] = useState<ISelectedNodeInfo | undefined>(
        nodeMenuProps.selectedNode ? ({ node: nodeMenuProps.selectedNode } as ISelectedNodeInfo) : undefined
    );
    const [showKebabIcon, setShowKebabIcon] = useState<boolean>(true);
    const [isShowMenu, setIsShowMenu] = useState(false);
    const [menuImageProps, setMenuImageProps] = useState<IMenuImage>();
    const [actionMenuData, setActionMenuData] = useState<IFeatureItem[]>([]);
    const [kebabMenuData, setKebabMenuData] = useState<IFeatureItem[]>([]);
    const [isRecordFoundInWaterMark, setIsRecordFoundInWaterMark] = useState<boolean>(false);

    const CommonVariableContext = useCommonVariableContext();
    const statusBarContext = useStatusBarContext();
    const sessionContext = useSessionContext();
    const mainAppContext = useMainAppContext();

    useEffect(() => {
        if (nodeMenuProps.MenuImage) {
            setMenuImageProps(nodeMenuProps.MenuImage);
        } else {
            let kebebImage: IMenuImage = {
                uniqueName: "bi1",
                image: {
                    uniqueName: "Kebabimage",
                    source: <Kebab24x24
                        size={20}
                        fill='none'
                        strokeWidth={1} />,
                    type: "svg",
                    w: "var(--image-size-2)",
                    h: "var(--image-size-2)",
                    tooltip: "click to use commands"
                },
                w: 'var(--image-size-2)',
                h: 'var(--image-size-2)',
                allowAnimations: false
            };
            setMenuImageProps(kebebImage);
        }
    }, [nodeMenuProps.MenuImage, nodeMenuProps.MenuImage?.selected]);

    const handleAnimationImage = (active?: boolean) => {
        if (menuImageProps && menuImageProps.allowAnimations) {
            setMenuImageProps({ ...menuImageProps, active: active });
        }
    };

    const getNodeMenuForProperty = () => {
        // Reserved for property tab
    };

    const handleClick = async (event: React.MouseEvent<HTMLDivElement> | null) => {
        if (event) {
            handleAnimationImage(true);
            setIsShowMenu(true);
        }
        let kebabMenuList: IFeatureItem[] = [];

        if (nodeMenuProps.container === "explorer_tree") {
            let menu: IFeatureItem[] = [];
            if (nodeMenuProps.featureData) {
                if (selectedNodeData && selectedNodeData.node) {
                    menu = await getExplorerMenuData() ?? [];
                }
                if (menu && menu.length > 0) {
                    const unique: string[] = [];
                    const uniqueMenu = menu.filter((element) => {
                        const isDuplicate = unique.includes(element.Label);
                        if (!isDuplicate) {
                            unique.push(element.Label);
                            return true;
                        }
                        return false;
                    });
                    kebabMenuList = uniqueMenu;
                } else {
                    kebabMenuList = [];
                }
            }
        } else if (nodeMenuProps.container === "fqa_property_tab") {
            getNodeMenuForProperty();
            return true;
        } else if (nodeMenuProps.container === "helpTip") {
            const menu: IFeatureItem[] = [];
            nodeMenuProps.featureData.forEach((item, index: number) => {
                if (selectedItem && selectedItem.Label) {
                    menu.push({ Label: item.Label, selected: selectedItem.Label === item.Label, mdString: item.mdString });
                } else {
                    menu.push({ Label: item.Label, selected: index === 0, mdString: item.mdString });
                }
            });
            kebabMenuList = menu;
        } else if (nodeMenuProps.container === "dashboard_chart") {
            kebabMenuList = [{ Label: "Show Data", Tooltip: "Show Chart Data" }];
        }

        setMenuData(kebabMenuList);
        if (event) {
            const submenudiv = document.getElementById('nz-sub-menu-node');
            if (submenudiv) {
                submenudiv.focus();
            }
            if (nodeMenuProps.handleMouse && nodeMenuProps.MenuImage) {
                nodeMenuProps.handleMouse(nodeMenuProps.MenuImage);
            }
        }
    };

    function handleSelectNode(value: any, _actionCode?: string | undefined, payload?: any): void {
        handleAnimationImage(false);
        setIsShowMenu(false);
        const resolvedPayload = payload ?? value?.payload ?? value;
        setSelectedItem(resolvedPayload as IFeatureItem);
        const selectedMenu = {
            payload: resolvedPayload,
            field: nodeMenuProps.field,
            container: nodeMenuProps.container,
            rowIndex: nodeMenuProps.rowIndex,
            selectedRow: nodeMenuProps.selectedRow,
        };
        if (resolvedPayload?.Label === "Copy" && (selectedNodeData?.node || nodeMenuProps.selectedNode)) {
            const activeNode = selectedNodeData?.node ?? nodeMenuProps.selectedNode;
            if (activeNode) {
                FnCopyToClipboard(activeNode.TableLabel ? `${activeNode.TableLabel}` : (activeNode.Name ? activeNode.Name : ""));
            }
            return;
        }
        CommonVariableContext.setSelectedNodeMenu(selectedMenu);
        nodeMenuProps.handleSelect(value);
    }

    const watermarkRequestIdRef = useRef(0);
    const lastWatermarkNodeIdRef = useRef<string | null>(null);

    useEffect(() => {
        const node = selectedNodeData?.node;
        const nodeEntId = String(node?.NodeEntID ?? '');

        if (lastWatermarkNodeIdRef.current === nodeEntId) {
            return;
        }
        lastWatermarkNodeIdRef.current = nodeEntId;

        const requestId = ++watermarkRequestIdRef.current;
        let cancelled = false;

        const fnInit = async () => {
            const data: any[] = [];
            if (cancelled || requestId !== watermarkRequestIdRef.current) {
                return;
            }
            setIsRecordFoundInWaterMark(data.length > 0);
        };

        void fnInit();

        return () => {
            cancelled = true;
        };
    }, [
        selectedNodeData?.node?.NodeEntID,
        selectedNodeData?.node?.NodeEntityname,
        nodeMenuProps.featureId,
    ]);



    const getExplorerMenuData = async (featureId: string | null = null): Promise<IFeatureItem[]> => {
        const activeNode = selectedNodeData?.node ?? nodeMenuProps.selectedNode;
        if (!activeNode) return [];

        const targetFeatureId = String(featureId ?? nodeMenuProps.featureId ?? "");
        const menu: IFeatureItem[] = [];

        const isContactNode = Boolean(
            activeNode.NodeType?.toLowerCase() === "contact" ||
            activeNode.treetype?.toLowerCase() === "contact" ||
            (activeNode.cid && activeNode.cid !== activeNode.bid)
        );

        (nodeMenuProps.featureData ?? []).forEach((item) => {
            const itemMenuId = String(item.MenuID ?? "");
            const featNum = Number(item._Feature ?? item.Feature ?? 0);

            if (
                (!targetFeatureId || itemMenuId === targetFeatureId) &&
                featNum > KebabMenuRange.MIN &&
                featNum < KebabMenuRange.MAX &&
                item.Label !== ""
            ) {
                const itemNodeType = (item.NodeType ?? "").trim().toLowerCase();
                if (!itemNodeType) {
                    if (item.Label?.toLowerCase() === "services" || item.Alias?.toLowerCase() === "service") {
                        if (isContactNode) {
                            menu.push(item);
                        }
                    } else {
                        menu.push(item);
                    }
                } else {
                    const nodeTypes = itemNodeType.split(";").map((t: string) => t.trim().toLowerCase());
                    const currentNodeType = String(activeNode.NodeType ?? "").toLowerCase();

                    if (
                        nodeTypes.includes(currentNodeType) ||
                        (isContactNode && (nodeTypes.includes("contact") || nodeTypes.includes("cid")))
                    ) {
                        menu.push(item);
                    }
                }
            }
        });

        if (menu.length > 0) {
            setShowKebabIcon(true);
        } else {
            setShowKebabIcon(false);
        }
        return menu;
    };

    const getKebabMenuForGridRow = (selectedRow: any) => {
        const menu: IFeatureItem[] = [];
        nodeMenuProps.featureData.forEach((item) => {
            if (item.MenuID === nodeMenuProps.featureId && item._Feature && (item._Feature as number) > KebabMenuRange.MIN && item.Label !== "") {
                if (item.NodeType === "") {
                    menu.push(item);
                } else {
                    if (item.NodeType) {
                        let nodeTypeArray = item.NodeType.split(";").map((el) => el.trim());
                        if (selectedRow?.NodeType) {
                            nodeTypeArray.forEach((element) => {
                                if (element?.toLowerCase() === selectedRow?.NodeType?.toLowerCase()) {
                                    menu.push(item);
                                }
                            });
                        }
                    }
                }
            }
        });
        return menu;
    };

    const getKebabMenuForGridRowRef = useRef(getKebabMenuForGridRow);

    useEffect(() => {
        if (nodeMenuProps.selectedNode) {
            setSelectedNodeData({ node: nodeMenuProps.selectedNode } as ISelectedNodeInfo);
            handleClick(null);
        } else {
            setSelectedNodeData(undefined);
        }
    }, [nodeMenuProps.selectedNode]);

    useEffect(() => {
        if (nodeMenuProps.selectedRow) {
            handleClick(null);
            const menuItems: IFeatureItem[] = getKebabMenuForGridRowRef.current(nodeMenuProps.selectedRow);
            setShowKebabIcon(menuItems?.length > 0);
        } else {
            setShowKebabIcon(false);
        }
    }, [nodeMenuProps?.selectedRow?.NodeType, getKebabMenuForGridRowRef]);

    useEffect(() => {
        if (nodeMenuProps.selectedNode) {
            setSelectedNodeData({ node: nodeMenuProps.selectedNode } as ISelectedNodeInfo);
            handleClick(null);
        } else {
            setSelectedNodeData(undefined);
        }
    }, [nodeMenuProps.selectedNode]);

    useEffect(() => {
        const init = async () => {
            if (nodeMenuProps.container === "explorer_tree") {
                if (nodeMenuProps.featureData) {
                    const activeNode = selectedNodeData?.node ?? nodeMenuProps.selectedNode;
                    if (activeNode) {
                        let data = await getExplorerMenuData();
                        if (data && data.length > 0) {
                            setShowKebabIcon(true);
                        } else {
                            setShowKebabIcon(false);
                        }
                        handleClick(null);
                    }
                }
            } else if (nodeMenuProps.container === "fqa_property_tab") {
                if (selectedNodeData) {
                    setSelectedItem(undefined);
                    getNodeMenuForProperty();
                    handleClick(null);
                } else {
                    setShowKebabIcon(false);
                }
            } else if (nodeMenuProps.container === 'helpTip') {
                if (nodeMenuProps.featureData.length > 0) {
                    setShowKebabIcon(true);
                    handleClick(null);
                }
            } else {
                setShowKebabIcon(true);
                handleClick(null);
            }
        };
        init();
    }, [selectedNodeData, nodeMenuProps.selectedNode, nodeMenuProps.featureData, nodeMenuProps.featureId, isRecordFoundInWaterMark]);

    useEffect(() => {
        if (menuData?.length && !nodeMenuProps.disbledOverlay) {
            let action: IFeatureItem[] = [];
            let kebab: IFeatureItem[] = [];
            let firstSeperatorFound: boolean = false;
            for (let index = 0; index < menuData.length; index++) {
                const element = menuData[index];
                const isSeparator = element.NodeType?.toLowerCase().includes("separator");

                if (!firstSeperatorFound) {
                    action.push(element);
                    if (isSeparator) {
                        firstSeperatorFound = true;
                    }
                } else {
                    kebab.push(element);
                }
            }
            const copyJson = { Label: "Copy", _Feature: "0999", NodeType: "", MenuID: "999", Tooltip: "Copy to clipboard" };
            if (action.length) {
                if (nodeMenuProps.allowAddCopyIconInOverlay) {
                    setActionMenuData([copyJson, ...action]);
                } else {
                    setActionMenuData([...action]);
                }
            } else if (nodeMenuProps.allowAddCopyIconInOverlay) {
                setActionMenuData([copyJson]);
            } else {
                setActionMenuData([]);
            }
            if (kebab.length) {
                setKebabMenuData(kebab);
            } else {
                setKebabMenuData([]);
            }
        } else if (nodeMenuProps.allowAddCopyIconInOverlay && (selectedNodeData?.node || nodeMenuProps.selectedNode) && !nodeMenuProps.disbledOverlay) {
            const copyJson = { Label: "Copy", _Feature: "0999", NodeType: "", MenuID: "999", Tooltip: "Copy to clipboard" };
            setActionMenuData([copyJson]);
            setKebabMenuData([]);
        } else {
            setActionMenuData([]);
            setKebabMenuData([]);
        }
    }, [menuData, nodeMenuProps.allowAddCopyIconInOverlay, nodeMenuProps.disbledOverlay, nodeMenuProps.selectedNode, selectedNodeData]);

    const activeNodeForMenu = selectedNodeData?.node ?? nodeMenuProps.selectedNode;
    const isContactNodeForMenu = Boolean(
        activeNodeForMenu?.NodeType?.toLowerCase() === "contact" ||
        activeNodeForMenu?.treetype?.toLowerCase() === "contact" ||
        activeNodeForMenu?.NodeEntityname?.toLowerCase() === "contact" ||
        (activeNodeForMenu?.cid && activeNodeForMenu?.cid !== activeNodeForMenu?.bid)
    );

    if (nodeMenuProps.container === "explorer_tree" && !isContactNodeForMenu) {
        return null;
    }

    return (
        <div key={nodeMenuProps.uniqueName} className='nz-node-menu'>
            {menuData && menuData.length > 0 && !nodeMenuProps.disbledOverlay && (
                <OverlayIconStrip
                    uniqueName={nodeMenuProps.uniqueName + "overlay-icon-strip"}
                    OverlayActions={actionMenuData}
                    KebabMenuActions={kebabMenuData}
                    OverlayActionProps={{
                        isVertical: false,
                        w: "100%",
                        h: "100%",
                        bgColor: "var(--bg-color-menu)",
                        border: "none",
                        menuSize: "sm",
                        actionImageW: 24,
                        actionImageH: 24,
                        imageW: "18px",
                        spacing: "0px 2px",
                        isIconVertical: true,
                        hideLabel: true,
                    }}
                    handleSelect={handleSelectNode}
                >
                    <div className="nz-node-menu-image">
                        {showKebabIcon && nodeMenuProps.showIcon && menuImageProps && (
                            <MenuImage
                                {...menuImageProps}
                                handleMouse={(event: any, _actionCode: string) => {
                                    if (!isShowMenu) {
                                        handleClick(event);
                                    }
                                }}
                                handleMouseEnter={handleClick}
                            />
                        )}
                    </div>
                </OverlayIconStrip>
            )}
            {nodeMenuProps.disbledOverlay && (
                <div className="nz-node-menu-image">
                    {showKebabIcon && nodeMenuProps.showIcon && menuImageProps && (
                        <MenuImage
                            {...menuImageProps}
                            handleMouse={(event: any, _actionCode: string) => {
                                if (!isShowMenu) {
                                    handleClick(event);
                                }
                            }}
                            handleMouseEnter={handleClick}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export { NodeMenu };
export type { INodeMenu, IFeatureItem };
