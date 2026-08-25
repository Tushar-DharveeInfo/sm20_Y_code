import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Close24x24, Filter24x24 } from '@n20a/libicon'

import '@n20a/libform/index.css'
import './FilterFormContainer.css'

import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable'
import { IDirtyFlagImage } from '../../allinterface/basic/IDirtyFlagImage'
import { IControl } from '../../allinterface/settingsform/ISettingsLibForm'
import { IFilterFormContainer } from '../../allinterface/searchfilter/IFilterFormContainer'

import { DirtyFlagImage } from '../../basic/dirtyflagimage/DirtyFlagImage'
import { Label } from '../../basic/label/Label'
import { SettingsLibForm } from '../../settingsform/settingslibform/SettingsLibForm'
import { handleContainerKeyDown, handleFormControlsBubbleKeyDown, handleFormControlsKeyDown } from '../../allcommon/basic/FnHandleContainerKeyDown'
import { ActionImage } from '../../basic/actionimage/ActionImage'

function toFilterValueString(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return "";
    return String(value);
}

const FilterFormContainer = (filterFormContainerProps: IFilterFormContainer) => {
    const [controls, setControls] = useState<IControl[]>([]);
    const [isShowFilterForm, setIsShowFilterForm] = useState<boolean>(false);
    const filterFormContainerRef = useRef<HTMLDivElement>(null);
    const handleFilterFormChangeRef = useRef(filterFormContainerProps.handleFilterFormChange);
    // Snapshot applied filter values once on open so the form restores prior selections.
    const appliedFilterValues =
        filterFormContainerProps.controlValues &&
            typeof filterFormContainerProps.controlValues === "object"
            ? (filterFormContainerProps.controlValues as Record<string, string | undefined>)
            : {};
    const initialProfileStringRef = useRef(JSON.stringify([appliedFilterValues]));

    useEffect(() => {
        handleFilterFormChangeRef.current = filterFormContainerProps.handleFilterFormChange;
    }, [filterFormContainerProps.handleFilterFormChange]);

    useEffect(() => {
        const values = appliedFilterValues;
        setControls(
            (filterFormContainerProps.controls.length > 0
                ? filterFormContainerProps.controls
                : []
            ).map((control) => {
                const saved = values[control.Name];
                if (saved === undefined || saved === null || saved === "") {
                    return control;
                }
                return {
                    ...control,
                    Value: saved,
                    DefaultAPValue: saved,
                };
            })
        );
        // Only seed controls when the filter panel mounts / controls identity changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterFormContainerProps.controls]);

    // Observes filter form width and toggles row layout for responsive controls.
    useEffect(() => {
        const container = document.querySelector('.nz-filter-form-container');
        if (!container || controls.length === 0) {
            setIsShowFilterForm(true);
            return;
        }

        const observerRefs = {
            resizeObserver: null as ResizeObserver | null,
            mutationObserver: null as MutationObserver | null,
            resizeTimeout: undefined as ReturnType<typeof setTimeout> | undefined,
        };

        const applyLayout = (width: number, formControls: NodeListOf<Element>) => {
            if (width < 400) {
                formControls.forEach(div => div.classList.remove('row-layout'));
                container.classList.remove('nz-div-row-layout');
            } else {
                formControls.forEach(div => div.classList.add('row-layout'));
                container.classList.add('nz-div-row-layout');
            }
        };

        const startResizeObserver = (formControls: NodeListOf<Element>) => {
            if (!formControls.length) return;

            observerRefs.resizeObserver = new ResizeObserver(entries => {
                if (observerRefs.resizeTimeout) {
                    clearTimeout(observerRefs.resizeTimeout);
                }
                observerRefs.resizeTimeout = setTimeout(() => {
                    for (const entry of entries) {
                        applyLayout(entry.contentRect.width, formControls);
                        setIsShowFilterForm(true);
                    }
                }, 100);
            });

            observerRefs.resizeObserver.observe(container);
            applyLayout(container.clientWidth, formControls);
            setIsShowFilterForm(true);
        };

        observerRefs.mutationObserver = new MutationObserver(() => {
            const formControls = container.querySelectorAll('.nz-form-control-labeled');
            if (formControls.length > 0) {
                observerRefs.mutationObserver?.disconnect();
                startResizeObserver(formControls);
            }
        });

        observerRefs.mutationObserver.observe(container, { childList: true, subtree: true });

        return () => {
            if (observerRefs.resizeTimeout) {
                clearTimeout(observerRefs.resizeTimeout);
            }
            observerRefs.resizeObserver?.disconnect();
            observerRefs.mutationObserver?.disconnect();
        };
    }, [controls]);

    function handleActionImageClick(event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>, actionCode?: string): void {
        filterFormContainerProps.handleActionImageClick?.(event, actionCode);
    }

    const handleValueChange = useCallback((value: unknown, name: string | undefined, isDefault?: boolean): void => {
        if (!name || isDefault || !handleFilterFormChangeRef.current) return;

        if (name === "dateRange" && value && typeof value === "object") {
            const range = value as { startDate?: unknown; endDate?: unknown };
            handleFilterFormChangeRef.current(
                range.startDate != null ? String(range.startDate) : "",
                "StartDate"
            );
            handleFilterFormChangeRef.current(
                range.endDate != null ? String(range.endDate) : "",
                "EndDate"
            );
            return;
        }

        handleFilterFormChangeRef.current(toFilterValueString(value), name);
    }, []);

    const filterIcon: IDirtyFlagImage = {
        image: {
            w: 'var(--image-size-2)',
            h: 'var(--image-size-2)',
            uniqueName: "filtericon",
            source: <Filter24x24
                size={FnGetCssVariable('--image-size-2')}
                fill='none'
                strokeWidth={1} />,
            type: "svg",
            tooltip: "Apply filter"
        },
        uniqueName: 'test-image',
        w: 'var(--node_height)',
        h: 'var(--node_height)',
        bgColor: "#FFFF99",
        allowBorder: false,
    }

    return (
        <div key={filterFormContainerProps.uniqueName} className='nz-filter-form-container' tabIndex={1} onKeyDown={handleContainerKeyDown}>
            {filterFormContainerProps.allowHeader && <div className='nz-sub-header'>
                <Label uniqueName={`${filterFormContainerProps.uniqueName}-fheader`} label={filterFormContainerProps.headerText || ""}
                />
                <div className='nz-d-flex-row' style={{ gap: 'var(--spacing-1)' }}>
                    <ActionImage uniqueName={`${filterFormContainerProps.uniqueName}-explorer-tree-info-ai`}
                        image={{
                            uniqueName: `${filterFormContainerProps.uniqueName}-explorer-tree-info-image`,
                            source: <Close24x24 size={FnGetCssVariable('--image-size-2')}
                                fill="none"
                                strokeWidth={1} />,
                            w: 'var(--image-size-2)',
                            tooltip: "Cancel",
                            type: "svg"
                        }} w={'var(--node_height)'} h={'var(--node_height)'} actionCode={'information'}
                        handleMouse={(event) => {
                            filterFormContainerProps.handleActionImageClick?.(event, 'close')
                        }} />
                    <div className='nz-filter-icon'>
                        <DirtyFlagImage
                            {...filterIcon}
                            handleMouse={(event) => handleActionImageClick(event, 'apply')}
                            isDirty={!!filterFormContainerProps.isFilterChange}
                        />
                    </div>
                </div>
            </div>}
            <div ref={filterFormContainerRef} className={`nz-filter-form-content${!isShowFilterForm ? " nz-hide-filter-form" : ""}`}
                onKeyDownCapture={handleFormControlsKeyDown}
                onKeyDown={handleFormControlsBubbleKeyDown}>
                {controls.length > 0 && (
                    <SettingsLibForm
                        uniqueName={`${filterFormContainerProps.uniqueName}-settings-form`}
                        controls={controls}
                        profileString={initialProfileStringRef.current}
                        isAutoSave={true}
                        allowShowHeader={false}
                        allowShowSectionHeader={true}
                        handleActionImageClick={handleActionImageClick}
                        handleValueChange={handleValueChange}
                        isDisableForm={false}
                    />
                )}
            </div>
        </div>
    )
}

export { FilterFormContainer }
