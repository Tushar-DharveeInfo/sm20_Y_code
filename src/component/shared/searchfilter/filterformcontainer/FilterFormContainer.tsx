import React, { useCallback, useEffect, useRef } from 'react'
import { Close24x24, Filter24x24 } from '@n20a/libicon'

import '@n20a/libform/index.css'
import './FilterFormContainer.css'

// Business explorer filter UI (libform): snapshot on open, apply as key/value json.

import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable'
import { IDirtyFlagImage } from '../../allinterface/basic/IDirtyFlagImage'
import { IControl } from '../../allinterface/settingsform/ISettingsLibForm'
import { IFilterFormContainer } from '../../allinterface/searchfilter/IFilterFormContainer'
import { FnBuildBusinessExplorerFilterControls } from '../../allcommon/searchfilter/FnBuildBusinessExplorerFilterControls'
import { getAppliedFilterJson, normalizeFilterFieldName } from '../../allcommon/searchfilter/FnFilterBusinessContactRecords'
import { FnGetSourceDataset } from '../../allcommon/FnLoadSampleDatasets'
import { useSmDataContext } from '../../context/hooks/SmDataHooks'
import type { IDCFilterControlValues } from '../../allinterface/searchfilter/IFilterFormContainer'

import { DirtyFlagImage } from '../../basic/dirtyflagimage/DirtyFlagImage'
import { Label } from '../../basic/label/Label'
import { SettingsLibForm } from '../../settingsform/settingslibform/SettingsLibForm'
import { handleContainerKeyDown, handleFormControlsBubbleKeyDown, handleFormControlsKeyDown } from '../../allcommon/basic/FnHandleContainerKeyDown'
import { ActionImage } from '../../basic/actionimage/ActionImage'

// True when the changed libform field is the Verified / Contact verified checkbox.
function isVerifiedField(name: string | undefined): boolean {
    const field = String(name ?? "").toLowerCase();
    return (
        field === "verified"
        || field === "cverified"
        || field.endsWith("_verified")
        || field.endsWith("_cverified")
        || field.includes("_verified_")
        || field.includes("_cverified_")
    );
}

// Store checkbox values as "true"/"false" (libform may emit 1/0).
function toFilterValueString(value: unknown, name?: string): string {
    if (isVerifiedField(name)) {
        if (value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true") {
            return "true";
        }
        return "false";
    }
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return "";
    return String(value);
}

const FilterFormContainer = (filterFormContainerProps: IFilterFormContainer) => {
    const smDataContext = useSmDataContext();
    const filterFormContainerRef = useRef<HTMLDivElement>(null);
    const handleFilterFormChangeRef = useRef(filterFormContainerProps.handleFilterFormChange);
    const setFilterJsonRef = useRef(smDataContext.setFilterJson);
    const draftFilterRef = useRef<IDCFilterControlValues>({});

    // Snapshot controls and applied values once on open so combo edits do not rebuild the form.
    const snapshotRef = useRef<{
        values: Record<string, string | undefined>;
        profileString: string;
        controls: IControl[];
    } | null>(null);

    if (snapshotRef.current === null) {
        const propsValues =
            filterFormContainerProps.controlValues &&
            typeof filterFormContainerProps.controlValues === "object"
                ? { ...(filterFormContainerProps.controlValues as Record<string, string | undefined>) }
                : {};
        const values = { ...smDataContext.filterJson, ...propsValues };
        const businesses = smDataContext.datasets.businesses.length
            ? smDataContext.datasets.businesses
            : FnGetSourceDataset("businesses");
        const contacts = smDataContext.datasets.contacts.length
            ? smDataContext.datasets.contacts
            : FnGetSourceDataset("contacts");
        const sourceControls =
            filterFormContainerProps.controls && filterFormContainerProps.controls.length > 0
                ? filterFormContainerProps.controls
                : FnBuildBusinessExplorerFilterControls(businesses, contacts, values);
        snapshotRef.current = {
            values,
            profileString: JSON.stringify([values]),
            controls: sourceControls.map((control) => {
                const saved = values[control.Name];
                if (saved === undefined || saved === null || saved === "") {
                    return control;
                }
                return {
                    ...control,
                    Value: saved,
                    DefaultAPValue: saved,
                };
            }),
        };
        draftFilterRef.current = { ...values };
    }

    const { controls, profileString } = snapshotRef.current;

    useEffect(() => {
        handleFilterFormChangeRef.current = filterFormContainerProps.handleFilterFormChange;
        setFilterJsonRef.current = smDataContext.setFilterJson;
    }, [filterFormContainerProps.handleFilterFormChange, smDataContext.setFilterJson]);

    useEffect(() => {
        setFilterJsonRef.current(getAppliedFilterJson(draftFilterRef.current));
    }, []);

    // Observes filter form width and toggles row layout for responsive controls.
    useEffect(() => {
        const container = document.querySelector('.nz-filter-form-container');
        if (!container || controls.length === 0) {
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
                    }
                }, 100);
            });

            observerRefs.resizeObserver.observe(container);
            applyLayout(container.clientWidth, formControls);
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

    const storeFilterKeyValue = (name: string, value: string) => {
        const field = normalizeFilterFieldName(name) ?? name;
        draftFilterRef.current = { ...draftFilterRef.current, [field]: value };
        setFilterJsonRef.current(getAppliedFilterJson(draftFilterRef.current));
        handleFilterFormChangeRef.current?.(value, field);
    };

    const handleValueChange = useCallback((value: unknown, name: string | undefined, isDefault?: boolean): void => {
        if (!name || isDefault) return;

        if (name === "dateRange" && value && typeof value === "object") {
            const range = value as { startDate?: unknown; endDate?: unknown };
            storeFilterKeyValue("StartDate", range.startDate != null ? String(range.startDate) : "");
            storeFilterKeyValue("EndDate", range.endDate != null ? String(range.endDate) : "");
            return;
        }

        storeFilterKeyValue(name, toFilterValueString(value, name));
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
            <div ref={filterFormContainerRef} className="nz-filter-form-content"
                onKeyDownCapture={handleFormControlsKeyDown}
                onKeyDown={handleFormControlsBubbleKeyDown}>
                {controls.length > 0 && (
                    <SettingsLibForm
                        uniqueName={`${filterFormContainerProps.uniqueName}-settings-form`}
                        controls={controls}
                        profileString={profileString}
                        isAutoSave={true}
                        allowShowHeader={false}
                        allowShowSectionHeader={true}
                        isAddressFormRequired={false}
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
