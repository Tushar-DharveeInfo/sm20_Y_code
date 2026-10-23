
import { Fragment, memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Collapse, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material'
import { isEqual } from 'lodash'
import './ExpandableList.css'
import { Up24x24 } from '@n20a/libicon'
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable'
import { FnGetIconForExpandableMenu } from '../../allcommon/menu/FnGetIconForExpandableMenu'
import { handleExpandableMenuKeyDown } from '../../allcommon/basic/FnHandleContainerKeyDown'

import { IMenuItem } from '../../allinterface/menu/IMainMenu'
import { Image } from '../../basic/image/Image'
import { FilterKeywordControl } from '../../searchfilter/filterkeywordcontrol/FilterKeywordControl'

// These receive scalar props or cached icon elements, so focus changes can reuse them.
const MenuImage = memo(Image);
const MenuItemText = memo(ListItemText);
const mainItemTextStyle = { opacity: 1 };

interface IExpandableList {
    uniqueName: string; // uniqueName for the control and required
    menuData: IMenuItem[]; // menu data of list 
    handleMouseEvent: (event: React.MouseEvent<HTMLDivElement, MouseEvent> | undefined, actionCode: string, selectedMenu: any) => void; // handle mouse event for selected menu
    handleMouseLeave: () => void;
    selectedFeature?: IMenuItem; // selected feature item
    allowDND?: boolean; // Allow Drag and drop
    hideIcon?: boolean;
    isMenuWithAbsolute?: boolean;
    handleDrag?: (event: React.DragEvent<HTMLDivElement>, actionCode?: any, payload?: any) => void;
    handleStartDrag?: (event: React.DragEvent<HTMLDivElement>, actionCode?: any, payload?: any) => void;
    handleEndDrag?: (event: React.DragEvent<HTMLDivElement>, actionCode?: any, payload?: any) => void;
    hideSearchControl?: boolean;
}

/* Local search UI state; handleFilterMouse and searchValueChange are wired on FilterKeywordControl at render. */
type ExpandableListSearchState = {
    uniqueName: string;
    isShowFilterControl: boolean;
    lensDirty: boolean;
    filterDirty: boolean;
    searchInputValue: string;
};

/* Drag handlers pass list props as actionCode and the dragged menu row as payload. */
type ExpandableListDragAction = string | IExpandableList;

const searchProps: ExpandableListSearchState = {
    uniqueName: "filtericon",
    isShowFilterControl: true, //show filter control.
    lensDirty: false,
    filterDirty: false,
    searchInputValue: "",
};

/* DefaultQA from feature.json is "1" / true — prefer that submenu on load / open. */
const isDefaultQaMenuItem = (item: IMenuItem): boolean =>
    item.DefaultQA === true || item.DefaultQA === 1 || item.DefaultQA === "1";

const findDefaultQaSubMenu = (
    menu: IMenuItem[]
): { parent: IMenuItem; child: IMenuItem; parentIndex: number; childIndex: number } | null => {
    for (let parentIndex = 0; parentIndex < menu.length; parentIndex++) {
        const parent = menu[parentIndex];
        const childIndex = parent.subMenu?.findIndex(isDefaultQaMenuItem) ?? -1;
        if (childIndex >= 0 && parent.subMenu) {
            return {
                parent,
                child: parent.subMenu[childIndex],
                parentIndex,
                childIndex,
            };
        }
    }
    return null;
};

const ExpandableList = (props: IExpandableList) => {
    const [mainMenu, setMainMenu] = useState<IMenuItem[] | null>(null);
    const [searchControlProps, setSearchControlProps] = useState<ExpandableListSearchState>(searchProps);
    const [originalMenuMenu, setOriginalMenuMenu] = useState<IMenuItem[] | null>(null);
    const [searchValue, setSearchValue] = useState<string>("");
    const [selectedEntId, setSelectedEntId] = useState<string | undefined>();
    const [activeMainIndex, setActiveMainIndex] = useState<number | null>(null);
    const [selectedMenuIndex, setSelectedMenuIndex] = useState<number>(props.uniqueName === "Menu" ? -1 : 0);
    const [activeSubIndex, setActiveSubIndex] = useState<number | null>(null);
    const mainRefs = useRef<(HTMLDivElement | null)[]>([]);
    const subRefs = useRef<{ [key: number]: (HTMLDivElement | null)[] }>({});
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasAutoSelectedDefaultQaRef = useRef(false);

    const lastFeatureIdRef = useRef<string | null>(null);

    const isSubActive = useCallback((sub: IMenuItem): boolean => {
        const subFeatureId = sub._Feature != null ? String(sub._Feature) : "";
        const subEntId = sub.EntID ? String(sub.EntID) : "";

        if (props.uniqueName === "Menu") {
            const selFeatureId = props.selectedFeature?._Feature != null ? String(props.selectedFeature._Feature) : "";
            const selEntId = props.selectedFeature?.EntID ? String(props.selectedFeature.EntID) : "";

            if (selFeatureId && subFeatureId && selFeatureId === subFeatureId) return true;
            if (selEntId && subEntId && selEntId === subEntId) return true;
            if (selectedEntId && subEntId && String(selectedEntId) === subEntId) return true;
            if (lastFeatureIdRef.current && (
                (subFeatureId && subFeatureId === lastFeatureIdRef.current) ||
                (subEntId && subEntId === lastFeatureIdRef.current)
            )) return true;
            return !!sub.isSelected;
        }

        return !!(sub.isSelected || (selectedEntId && subEntId && String(selectedEntId) === subEntId));
    }, [props.uniqueName, props.selectedFeature, selectedEntId]);

    const isGroupActive = useCallback((element: IMenuItem): boolean => {
        return !!element.subMenu?.some(isSubActive);
    }, [isSubActive]);

    useEffect(() => {
        if (props.menuData && props.menuData.length > 0) {
            if (!isEqual(props.menuData, originalMenuMenu)) {
                const menu: IMenuItem[] = [...props.menuData];
                const canAutoSelect =
                    props.uniqueName === "Menu" &&
                    !props.selectedFeature &&
                    originalMenuMenu === null &&
                    !hasAutoSelectedDefaultQaRef.current;

                if (canAutoSelect) {
                    const defaultQa = findDefaultQaSubMenu(menu);
                    // Prefer DefaultQA === 1 / true submenu; else one group with one child.
                    if (defaultQa) {
                        defaultQa.parent.isOpen = true;
                        defaultQa.child.isSelected = true;
                        setSelectedEntId(defaultQa.child.EntID as string | undefined);
                        setActiveMainIndex(defaultQa.parentIndex);
                        setActiveSubIndex(defaultQa.childIndex);
                        setSelectedMenuIndex(-1);
                        hasAutoSelectedDefaultQaRef.current = true;
                        props.handleMouseEvent(undefined, "expandleList", defaultQa.child);
                    } else if (menu.length === 1 && menu[0].subMenu?.length === 1) {
                        menu[0].isOpen = true;
                        menu[0].subMenu[0].isSelected = true;
                        setSelectedEntId(menu[0].subMenu[0].EntID as string | undefined);
                        props.handleMouseEvent(undefined, "expandleList", menu[0].subMenu[0]);
                        setSelectedMenuIndex(-1);
                        menu[0].isSelected = false;
                        hasAutoSelectedDefaultQaRef.current = true;
                    }
                }

                const currentFeatureId = props.selectedFeature
                    ? String(props.selectedFeature._Feature ?? props.selectedFeature.EntID ?? "")
                    : null;
                const isNewFeatureSelected = currentFeatureId !== null && currentFeatureId !== lastFeatureIdRef.current;
                if (currentFeatureId !== null) {
                    lastFeatureIdRef.current = currentFeatureId;
                }

                if (isNewFeatureSelected && props.selectedFeature) {
                    const selFeatureId = props.selectedFeature._Feature != null ? String(props.selectedFeature._Feature) : "";
                    const selEntId = props.selectedFeature.EntID ? String(props.selectedFeature.EntID) : "";
                    menu.forEach((element: IMenuItem) => {
                        const hasSelectedSub = element.subMenu?.some((sub) => {
                            const subEntId = sub.EntID ? String(sub.EntID) : "";
                            const subFeatureId = sub._Feature != null ? String(sub._Feature) : "";
                            return (selEntId && subEntId && selEntId === subEntId) ||
                                (selFeatureId && subFeatureId && selFeatureId === subFeatureId);
                        });
                        if (hasSelectedSub) {
                            element.isOpen = true;
                        } else if (element.subMenu?.length) {
                            element.isOpen = false;
                        }
                    });
                } else if (mainMenu && mainMenu.length > 0) {
                    menu.forEach((element: IMenuItem) => {
                        const existing = mainMenu.find((m) =>
                            (m.EntID && element.EntID && String(m.EntID) === String(element.EntID)) ||
                            (m._Feature != null && element._Feature != null && String(m._Feature) === String(element._Feature)) ||
                            (m.Label && element.Label && m.Label === element.Label)
                        );
                        if (existing && existing.isOpen !== undefined) {
                            element.isOpen = existing.isOpen;
                        }
                        if (isGroupActive(element)) {
                            element.isOpen = true;
                        }
                    });
                }

                setOriginalMenuMenu([...menu]);

                // This condition depends on searchValue
                if (!searchValue) {
                    setMainMenu([...menu]);
                }
            }
        }
    }, [props.menuData, searchValue]); // searchValue: avoid overwriting filtered mainMenu while user is searching
    useEffect(() => {
        return () => {
            setMainMenu(null);
            setOriginalMenuMenu(null);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        }
    }, [])
    const handleSubListItemClick = useCallback((event: React.MouseEvent<HTMLDivElement, MouseEvent>,
        index: number,
        item: IMenuItem) => {
        if (!mainMenu) {
            return;
        }
        try {

            setSelectedEntId(item.EntID as string | undefined);
            const currentFeatureId = String(item._Feature ?? item.EntID ?? "");
            lastFeatureIdRef.current = currentFeatureId;
            mainMenu.map((ele: IMenuItem) => {
                ele.isSelected = false;
                let hasTargetSub = false;
                ele.subMenu?.forEach((sub: IMenuItem) => {
                    const isTargetSub =
                        (sub.EntID && item.EntID && String(sub.EntID) === String(item.EntID)) ||
                        (sub._Feature != null && item._Feature != null && String(sub._Feature) === String(item._Feature));
                    if (isTargetSub) {
                        sub.isSelected = true;
                        hasTargetSub = true;
                    }
                    else {
                        sub.isSelected = false;
                    }
                });
                if (hasTargetSub) {
                    ele.isSelected = true;
                    ele.isOpen = true;
                } else if (ele.subMenu?.length) {
                    ele.isOpen = false;
                }
                return ele;
            });
            setMainMenu([...mainMenu]);

            // Keep selection/collapse urgent while React renders the selected feature.
            // The callback still runs immediately; only its React updates get lower priority.
            startTransition(() => {
                props.handleMouseEvent(event, "expandleList", item);
            });
            setSelectedMenuIndex(-1)

            for (let mainIndex = 0; mainIndex < mainMenu.length; mainIndex++) {
                const subIndex = mainMenu[mainIndex].subMenu?.findIndex((sub) =>
                    (sub.EntID && item.EntID && String(sub.EntID) === String(item.EntID)) ||
                    (sub._Feature != null && item._Feature != null && String(sub._Feature) === String(item._Feature))
                ) ?? -1;
                if (subIndex >= 0) {
                    setActiveMainIndex(mainIndex);
                    setActiveSubIndex(subIndex);
                    break;
                }
            }
        }
        catch (e) {
            console.error("Error in handleSubListItemClick:", e);
        }

    }, [mainMenu, props]);
    const handleListItemClick = useCallback((
        event: React.MouseEvent<HTMLDivElement, MouseEvent>,
        index: number,
        item: IMenuItem) => {
        if (!mainMenu) {
            return;
        }
        try {
            const subMenuLength = item.subMenu?.length ?? 0;
            const isOpeningGroup = !item.isOpen;

            // Auto-select only when this group has exactly one child.
            if (isOpeningGroup && subMenuLength === 1 && item.subMenu) {
                handleSubListItemClick(event, index, item.subMenu[0]);
                return;
            }

            const hasSubMenu = subMenuLength > 0;

            mainMenu.forEach((ele: IMenuItem) => {
                const isClickedItem =
                    (ele.EntID && item.EntID && String(ele.EntID) === String(item.EntID)) ||
                    (ele._Feature != null && item._Feature != null && String(ele._Feature) === String(item._Feature));
                const elementHasSubMenu = !!ele.subMenu?.length;

                if (isClickedItem) {
                    ele.isSelected = true;
                    if (elementHasSubMenu) {
                        if (isGroupActive(ele)) {
                            // Active submenu's parent menu cannot be closed by the user
                            ele.isOpen = true;
                        } else {
                            ele.isOpen = ele.isOpen === undefined ? true : !ele.isOpen;
                        }
                    }
                } else {
                    if (!isGroupActive(ele)) {
                        ele.isSelected = false;
                    }
                }

                if (ele.subMenu?.length && !hasSubMenu) {
                    ele.subMenu.forEach((sub: IMenuItem) => {
                        if (!isClickedItem) {
                            sub.isSelected = false;
                        }
                    });
                }
            });

            setMainMenu([...mainMenu]);

            if (hasSubMenu) {
                // Parent click only expands/collapses; do not run submenu selection sync.
                setActiveMainIndex(index);
                setActiveSubIndex(null);
                setSelectedMenuIndex(index);
                props.handleMouseEvent(event, "expandleList", item);
                return;
            }

            setSelectedEntId(item.EntID as string | undefined);
            setActiveMainIndex(index);
            setActiveSubIndex(null);
            setSelectedMenuIndex(index);
            props.handleMouseEvent(event, "expandleList", item);
        } catch (error) {
            console.error("Error in handleListItemClick:", error);
        }
    }, [mainMenu, isGroupActive, handleSubListItemClick, props]);
    const searchValueChange = (value: string) => {

        if (originalMenuMenu && originalMenuMenu.length > 0 && !value) {
            const hasAnyGroupSelectedSub = originalMenuMenu.some((m: IMenuItem) =>
                m.subMenu?.some((s: IMenuItem) => s.EntID === selectedEntId)
            );
            const restored = originalMenuMenu.map((ele: IMenuItem) => {
                const subMenu = ele.subMenu?.map((sub: IMenuItem) => ({
                    ...sub,
                    isSelected: sub.EntID === selectedEntId,
                })) || [];

                const isAnySubSelected = subMenu.some((s: IMenuItem) => s.isSelected);
                const isSelected = ele.EntID === selectedEntId || isAnySubSelected;
                const existing = mainMenu?.find((m) =>
                    (m.EntID && ele.EntID && String(m.EntID) === String(ele.EntID)) ||
                    (m._Feature != null && ele._Feature != null && String(m._Feature) === String(ele._Feature)) ||
                    (m.Label && ele.Label && m.Label === ele.Label)
                );
                const isOpen = hasAnyGroupSelectedSub ? isAnySubSelected : (existing?.isOpen ?? false);

                return {
                    ...ele,
                    isSelected: isSelected,
                    isOpen: isOpen,
                    subMenu: subMenu,
                };
            });

            setMainMenu([...restored]);
        }

        setSearchValue(value);
        setSearchControlProps({
            ...searchControlProps,
            searchInputValue: value,
            filterDirty: value ? true : false,
        });
    };

    /* Runs when the filter icon is clicked; applies searchValue to mainMenu (IFilterKeywordControl contract). */
    const handleKeywordSearchResult = (): void => {

        let filterData: IMenuItem[] = [];
        if (originalMenuMenu && originalMenuMenu.length > 0 && searchValue) {
            const normalizedSearchValue = searchValue.toLowerCase();
            if (props.uniqueName === "Menu") {
                const filteredData = originalMenuMenu.map((element: IMenuItem) => {
                    return {
                        ...element,
                        subMenu: (element.subMenu ?? []).filter(
                            (subElement: IMenuItem) =>
                                subElement.Label?.toLowerCase().includes(normalizedSearchValue) ===
                                true ||
                                subElement.Tooltip?.toLowerCase().includes(
                                    normalizedSearchValue
                                ) === true
                        ),
                    };
                });
                filterData = filteredData.filter((element: IMenuItem) => {
                    return (
                        element.Label?.toLowerCase().includes(normalizedSearchValue) ===
                        true ||
                        element.Tooltip?.toLowerCase().includes(normalizedSearchValue) ===
                        true ||
                        // Keep parent rows when any child matched the filter above.
                        (element.subMenu?.length ?? 0) > 0
                    );
                });
                setMainMenu([...filterData]);

            } else {
                const filteredData = originalMenuMenu.map((element: IMenuItem) => {
                    return {
                        ...element,
                    };
                });
                filterData = filteredData.filter((element: IMenuItem) => {
                    return (
                        element.Label?.toLowerCase().includes(normalizedSearchValue) === true
                    );
                });
                setMainMenu([...filterData]);
            }
        } else if (
            originalMenuMenu && originalMenuMenu?.length > 0 &&
            (searchValue === "" || searchValue === null || searchValue === undefined)
        ) {
            filterData = originalMenuMenu;
            setMainMenu([...filterData]);
        }
    };
    const handleDrag = useCallback((event: React.DragEvent<HTMLDivElement>, actionCode?: ExpandableListDragAction, payload?: IMenuItem) => {
        props.handleDrag && props.handleDrag(event, actionCode, payload);
    }, [props]);


    const handleEndDrag = useCallback((event: React.DragEvent<HTMLDivElement>, actionCode?: ExpandableListDragAction, payload?: IMenuItem) => {
        const clientX: number = event.clientX;
        const clientY: number = event.clientY;
        const DropDiv: HTMLElement | null = document.elementFromPoint(clientX, clientY) as HTMLElement;

        if (!DropDiv) return;

        const attrib = DropDiv.getAttribute("allow-drop");
        if (attrib) {
            props.handleEndDrag && props.handleEndDrag(event, actionCode, payload);
        }
    }, [props]);

    const handleDragStart = useCallback((event: React.DragEvent<HTMLDivElement>, actionCode?: ExpandableListDragAction, payload?: IMenuItem) => {
        props.handleStartDrag && props.handleStartDrag(event, actionCode, payload)
    }, [props]);

    const openMainMenuGroup = (index: number) => {
        if (!mainMenu) {
            return;
        }
        const item = mainMenu[index];
        if (!item?.subMenu?.length) {
            return;
        }

        mainMenu.forEach((ele, menuIndex) => {
            if (menuIndex === index) {
                ele.isOpen = true;
                ele.isSelected = true;
            } else {
                ele.isSelected = false;
            }
        });
        setMainMenu([...mainMenu]);
    };

    const closeMainMenuGroup = (index: number) => {
        if (!mainMenu) {
            return;
        }
        const item = mainMenu[index];
        if (item && isGroupActive(item)) {
            return;
        }
        if (item?.subMenu?.length && item.isOpen) {
            item.isOpen = false;
            setMainMenu([...mainMenu]);
        }
    };

    /* Find main/sub row indices for the item that is actually selected in menu data. */
    const resolveSelectionIndices = useCallback((): { mainIndex: number; subIndex: number | null } => {
        if (!mainMenu || mainMenu.length === 0) {
            return { mainIndex: 0, subIndex: null };
        }

        for (let mainIndex = 0; mainIndex < mainMenu.length; mainIndex++) {
            const subMenu = mainMenu[mainIndex].subMenu;
            if (!subMenu?.length) {
                continue;
            }
            for (let subIndex = 0; subIndex < subMenu.length; subIndex++) {
                const sub = subMenu[subIndex];
                if (isSubActive(sub)) {
                    return { mainIndex, subIndex };
                }
            }
        }

        for (let mainIndex = 0; mainIndex < mainMenu.length; mainIndex++) {
            const element = mainMenu[mainIndex];
            if (element.isSelected || (selectedEntId && element.EntID === selectedEntId)) {
                return { mainIndex, subIndex: null };
            }
        }

        if (selectedMenuIndex >= 0) {
            return { mainIndex: selectedMenuIndex, subIndex: null };
        }

        return { mainIndex: 0, subIndex: null };
    }, [mainMenu, isSubActive, selectedEntId, selectedMenuIndex]);

    const syncKeyboardToSelection = useCallback(() => {
        if (!mainMenu?.length) {
            return;
        }
        const { mainIndex, subIndex } = resolveSelectionIndices();
        setActiveMainIndex(mainIndex);
        setActiveSubIndex(subIndex);
    }, [mainMenu, resolveSelectionIndices]);

    // Align keyboard focus when user selects a different menu item (click or app state).
    useEffect(() => {
        syncKeyboardToSelection();
    }, [selectedEntId, props.selectedFeature?._Feature]);

    const handleMenuContainerFocus = (event: React.FocusEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget && mainMenu?.length) {
            syncKeyboardToSelection();
        }
    };

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!mainMenu || mainMenu.length === 0) {
            return;
        }

        const asMouseEvent = (keyboardEvent: React.KeyboardEvent<HTMLDivElement>) =>
            keyboardEvent as unknown as React.MouseEvent<HTMLDivElement, MouseEvent>;

        let navMainIndex = activeMainIndex;
        let navSubIndex = activeSubIndex;

        // First key press: start from the selected row, not index 0.
        if (navMainIndex === null) {
            const selection = resolveSelectionIndices();
            navMainIndex = selection.mainIndex;
            navSubIndex = selection.subIndex;
            setActiveMainIndex(navMainIndex);
            setActiveSubIndex(navSubIndex);
        }

        handleExpandableMenuKeyDown(event, {
            ignoreInsideSelector: '.nz-menu-search',
            mainItemCount: mainMenu.length,
            activeMainIndex: navMainIndex,
            activeSubIndex: navSubIndex,
            resolveMainIndex: () => navMainIndex as number,
            getSubItemCount: (mainIndex) => mainMenu[mainIndex]?.subMenu?.length ?? 0,
            hasSubMenu: (mainIndex) => (mainMenu[mainIndex]?.subMenu?.length ?? 0) > 0,
            isSubMenuOpen: (mainIndex) => !!mainMenu[mainIndex]?.isOpen,
            onInitMainIndex: () => {
                const selection = resolveSelectionIndices();
                navMainIndex = selection.mainIndex;
                navSubIndex = selection.subIndex;
                setActiveMainIndex(navMainIndex);
                setActiveSubIndex(navSubIndex);
            },
            onMainIndexChange: (index) => {
                setActiveMainIndex(index);
                setActiveSubIndex(null);
            },
            onSubIndexChange: (index) => {
                setActiveSubIndex(index);
            },
            onOpenSubMenu: (mainIndex) => {
                if (!mainMenu[mainIndex]?.isOpen) {
                    openMainMenuGroup(mainIndex);
                }
            },
            onCloseSubMenu: closeMainMenuGroup,
            onSelectMain: (keyboardEvent, mainIndex) => {
                const current = mainMenu[mainIndex];
                if (current) {
                    handleListItemClick(asMouseEvent(keyboardEvent as React.KeyboardEvent<HTMLDivElement>), mainIndex, current);
                }
            },
            onSelectSub: (keyboardEvent, mainIndex, subIndex) => {
                const currentSub = mainMenu[mainIndex]?.subMenu?.[subIndex];
                if (currentSub) {
                    handleSubListItemClick(asMouseEvent(keyboardEvent as React.KeyboardEvent<HTMLDivElement>), subIndex, currentSub);
                }
            },
        });
    }, [activeMainIndex, activeSubIndex, mainMenu, resolveSelectionIndices]);

    const iconCacheRef = useRef<Map<string, React.ReactNode>>(new Map());

    const handleIconForMenu = useCallback((
        label: string,
    ) => {
        if (iconCacheRef.current.has(label)) {
            return iconCacheRef.current.get(label)!;
        }
        // Remove anything inside (...) and trim spaces
        const name = label.replace(/\s*\([^)]*\)/g, "").trim();
        const sanitizedName = name.replace(/[^0-9A-Za-z_-]/g, "");

        // If name already ends with a number, don't append 24x24
        const iconName = /\d$/.test(sanitizedName)
            ? sanitizedName
            : `${sanitizedName}`;

        const Icon = FnGetIconForExpandableMenu(iconName);

        const iconEl = (
            <Icon
                size={FnGetCssVariable('--image-size-2')}
                fill="none"
                strokeWidth={1}
            />
        );
        iconCacheRef.current.set(label, iconEl);
        return iconEl;
    }, []);
    useEffect(() => {
        const id = setTimeout(() => {
            if (activeMainIndex == null) {
                return;
            }

            const focusSubItem = () => {
                subRefs.current[activeMainIndex]?.[activeSubIndex as number]?.focus({ preventScroll: true });
            };

            if (activeSubIndex == null) {
                mainRefs.current[activeMainIndex]?.focus({ preventScroll: true });
                return;
            }

            const mainItem = mainMenu?.[activeMainIndex];
            if (mainItem?.subMenu?.length && !mainItem.isOpen) {
                mainRefs.current[activeMainIndex]?.focus({ preventScroll: true });
                return;
            }

            focusSubItem();
        }, 0);
        return () => clearTimeout(id);
    }, [activeMainIndex, activeSubIndex, mainMenu]);

    // Search input state does not change rows until the filter is applied.
    const menuList = useMemo(() => (
                <List className='nz-nav-ul-main'>
                    {
                        mainMenu && mainMenu.map((element: IMenuItem, index: number) => {
                            return (
                                <Fragment key={index}>
                                    <li key={index}
                                        className='nz-nav-link' id={element.isOpen ? `nz-nav-open` : "nz-nav-close"}>
                                        {/* Menu Item */}
                                        <ListItemButton
                                            ref={(el) => {
                                                mainRefs.current[index] = el;
                                            }}
                                            tabIndex={-1}
                                            key={element.EntID + "_" + index.toString()}
                                            selected={activeSubIndex === null && activeMainIndex === index}
                                            className={`nz-nav-li-button nz-nav-li-menu  ${selectedMenuIndex === index ? ' nz-nav-li-button-selected' : ''}`}
                                            title={element.Tooltip}
                                            onClick={(event) => {
                                                handleListItemClick(event, index, element)

                                            }}>

                                            {!props.hideIcon && <ListItemIcon className='nz-nav-li-icon'>
                                                <div className="nz-feature-icon">
                                                    <MenuImage uniqueName='menu-image' source={
                                                        handleIconForMenu(element.Alias ? element.Alias : (element.Name || element.name || element.Label || ''))}
                                                        type='svg' w='var(--image-size-2)' />

                                                </div>

                                            </ListItemIcon>}
                                            <MenuItemText className={`nz-nav-menu-text ${props.hideIcon ? 'nz-only-show-label' : ""}`} primary={element.Label} style={mainItemTextStyle} />
                                            {element.subMenu && element.subMenu.length > 0 && (<>
                                                <div
                                                    className={`nz-nav-i-arrow ${element.isOpen ? '' : 'closed'}`}
                                                >
                                                    <MenuImage uniqueName='up-down' source={<Up24x24 size={FnGetCssVariable('--image-size-2')}
                                                        fill='none'
                                                        strokeWidth={1} />}
                                                        type='svg' w='var(--image-size-1)' />
                                                </div>

                                            </>)}
                                        </ListItemButton>
                                    </li>
                                    <Collapse key={"Clps_" + index.toString()} in={Boolean(element.isOpen)} timeout={200} mountOnEnter>
                                        {/*submenu Items*/}
                                        <List component="div" key={"Cli_" + index.toString()} disablePadding>
                                            {element.subMenu && element.subMenu.map((subEle: IMenuItem, subIndex: number) => {

                                                return (
                                                    <li key={subIndex}
                                                        className='nz-nav-link'>
                                                        <div className='nz-image-list-data'
                                                            style={{ width: "100%", height: '100%' }}
                                                            key={props.uniqueName + index}
                                                            draggable={props.allowDND}
                                                            onDrag={(e: React.DragEvent<HTMLDivElement>) => handleDrag(e, props, subEle)}
                                                            onDragEnd={(e: React.DragEvent<HTMLDivElement>) => handleEndDrag(e, props, subEle)}
                                                            onDragStart={handleDragStart}
                                                        >
                                                            <ListItemButton
                                                                ref={(el) => {
                                                                    if (!subRefs.current[index]) subRefs.current[index] = [];
                                                                    subRefs.current[index][subIndex] = el;
                                                                }}
                                                                tabIndex={-1}
                                                                key={subEle.EntID + "_" + subIndex.toString()} sx={{ pl: 4 }}
                                                                selected={(props.uniqueName === "Menu" ? props.selectedFeature && props.selectedFeature?._Feature && props.selectedFeature._Feature.toString() === subEle._Feature?.toString() ? true : false : subEle.isSelected) || activeMainIndex === index && activeSubIndex === subIndex}
                                                                title={subEle.Tooltip}
                                                                className='nz-nav-li-button nz-nav-sub-menu'
                                                                onClick={(event) => handleSubListItemClick(event, subIndex, subEle)}>
                                                                {!props.hideIcon && <ListItemIcon className='nz-nav-li-icon'>
                                                                    <MenuImage uniqueName='menu-image' source={handleIconForMenu(subEle.Alias ? subEle.Alias : (subEle.Name || subEle.name || subEle.Label || ''))}
                                                                        type='svg' w='var(--image-size-2)' />
                                                                </ListItemIcon>}
                                                                <MenuItemText primary={subEle.Label} className='nz-nav-sub-menu-text' />
                                                            </ListItemButton>
                                                        </div>
                                                        {subEle.NodeType && subEle.NodeType?.toLowerCase().includes('separator') &&
                                                            <hr className='nz-image-list-separator' />
                                                        }
                                                    </li>)

                                            })}
                                        </List>
                                    </Collapse>
                                    {element.separator && <hr className='nz-image-list-separator' />}
                                </Fragment>)
                        })
                    }
                </List>
    ), [mainMenu, props, activeMainIndex, activeSubIndex, selectedMenuIndex,
        handleListItemClick, handleSubListItemClick, handleDrag, handleEndDrag,
        handleDragStart, handleIconForMenu]);

    return (
        <div
            className={`nz-nav-bar nz-nav-open ${props.uniqueName === "Menu" || props.isMenuWithAbsolute ? "nz-expandable-list-absolute" : ""}`}
            tabIndex={1}
            onFocus={handleMenuContainerFocus}
            onKeyDown={handleKeyDown}
        >
            {!props.hideSearchControl && searchControlProps && (
                <div className="nz-menu-search">
                    <FilterKeywordControl
                        {...searchControlProps}
                        handleFilterMouse={handleKeywordSearchResult}
                        searchValueChange={searchValueChange}
                        filterIconTooltip='Filter'
                    />
                </div>
            )}
            <Box
                className="nz-expandable-list"
                role="presentation"
                key={props.uniqueName}
                onMouseLeave={(event: React.MouseEvent<HTMLDivElement>) => {
                    if (props.handleMouseLeave) {
                        const relatedTarget = event.relatedTarget as HTMLElement;
                        // Prevent closing if focus is inside the search filter control
                        if (relatedTarget && relatedTarget?.closest &&
                            (relatedTarget.closest(".nz-menu-search") || relatedTarget.closest(".MuiInputBase-input"))

                        ) {
                            return;
                        } else {
                            event.preventDefault();
                            props.handleMouseLeave()
                        }
                    }

                }}
            >
                {menuList}
            </Box>
        </div>
    )
}
export { ExpandableList };
export type { IExpandableList };

