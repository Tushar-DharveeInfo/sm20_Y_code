import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog } from '@mui/material';
import { Close24x24, Save24x24 } from '@n20a/libicon';
import { SettingsLibForm, IControl } from '../../settingsform/settingslibform/SettingsLibForm';
import { Label } from '../../basic/label/Label';
import { ActionImage } from '../../basic/actionimage/ActionImage';
import { FnGetCssVariable } from '../../allcommon/FnGetCssVariable';
import './PopupFilterForm.css';

export interface IPopupFilterFormProps {
    /** Unique identifier for component instance */
    uniqueName: string;
    /** Controls whether the dialog popup is open */
    isOpen: boolean;
    /** Header title text displayed in popup dialog header */
    headerText?: string;
    /** Dynamic form control definitions for SettingsLibForm */
    controls?: IControl[];
    /** Alias for controls prop */
    formControls?: IControl[];
    /** Profile JSON string to initialize form field values */
    profileString?: string;
    /** Whether filter form has unapplied changes initially */
    isFilterChange?: boolean;
    /** Whether form controls are read-only / disabled */
    isDisableForm?: boolean;
    /** Dialog maximum width (xs, sm, md, lg, xl). Defaults to 'sm' */
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
    /** Whether backdrop overlay is hidden. Defaults to true */
    hideBackdrop?: boolean;
    /** Container element DOM ref for portal rendering */
    container?: Element | (() => Element | null) | null;
    /** Callback triggered when user submits / applies filter form */
    onApplyFilter?: (filterDataJson: string, parsedData: Record<string, unknown>) => void;
    /** Callback triggered when any form field value changes */
    onFilterChange?: (values: Record<string, unknown>) => void;
    /** Callback triggered when user closes popup dialog */
    onClose?: () => void;
}

const parseProfileJsonSafely = (jsonText?: string): Record<string, unknown> => {
    if (!jsonText) return {};
    try {
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
            return (parsed[0] as Record<string, unknown>) ?? {};
        }
        if (parsed && typeof parsed === 'object') {
            return (parsed as Record<string, unknown>) ?? {};
        }
    } catch {
        // Fallback for raw string or malformed payload
    }
    return {};
};

const PopupFilterForm: React.FC<IPopupFilterFormProps> = ({
    uniqueName,
    isOpen,
    headerText = 'Filter',
    controls,
    formControls,
    profileString = '',
    isFilterChange = false,
    isDisableForm = false,
    maxWidth = 'sm',
    hideBackdrop = true,
    container,
    onApplyFilter,
    onFilterChange,
    onClose,
}) => {
    const activeControls = useMemo(
        () => controls ?? formControls ?? [],
        [controls, formControls]
    );

    const [isDirty, setIsDirty] = useState<boolean>(isFilterChange);
    const [formValuesState, setFormValuesState] = useState<Record<string, unknown>>(() =>
        parseProfileJsonSafely(profileString)
    );

    useEffect(() => {
        if (isOpen) {
            setIsDirty(isFilterChange);
            if (profileString) {
                setFormValuesState(parseProfileJsonSafely(profileString));
            }
        }
    }, [isOpen, profileString, isFilterChange]);

    const handleSaveClick = useCallback(() => {
        const filterDataJson = JSON.stringify([formValuesState]);
        setIsDirty(false);
        if (onApplyFilter) {
            onApplyFilter(filterDataJson, formValuesState);
        }
    }, [formValuesState, onApplyFilter]);

    const handleSaveFormInternal = useCallback(
        (profileDataJson: string) => {
            const parsed = parseProfileJsonSafely(profileDataJson);
            const merged = { ...formValuesState, ...parsed };
            for (const [k, v] of Object.entries(parsed)) {
                const kLower = k.toLowerCase();
                if (kLower.includes('datecreated')) {
                    merged['datecreated'] = v;
                }
                if (kLower.includes('message')) {
                    merged['message'] = v;
                }
            }
            setIsDirty(false);
            if (onApplyFilter) {
                onApplyFilter(profileDataJson, merged);
            }
        },
        [formValuesState, onApplyFilter]
    );

    const handleValueChangeInternal = useCallback(
        (value: unknown, name?: string, isDefault?: boolean) => {
            if (!isDefault) {
                setIsDirty(true);
            }
            if (name) {
                setFormValuesState((prev) => {
                    const next = { ...prev, [name]: value };
                    const nameLower = name.toLowerCase();
                    if (nameLower.includes('datecreated')) {
                        next['datecreated'] = value;
                    }
                    if (nameLower.includes('message')) {
                        next['message'] = value;
                    }
                    if (onFilterChange) {
                        onFilterChange(next);
                    }
                    return next;
                });
            }
        },
        [onFilterChange]
    );

    const handleValueChangeExternalInternal = useCallback(
        (values: Record<string, unknown>) => {
            if (!values || typeof values !== 'object') return;
            setIsDirty(true);
            setFormValuesState((prev) => {
                const next = { ...prev, ...values };
                for (const [k, v] of Object.entries(values)) {
                    const kLower = k.toLowerCase();
                    if (kLower.includes('datecreated')) {
                        next['datecreated'] = v;
                    }
                    if (kLower.includes('message')) {
                        next['message'] = v;
                    }
                }
                if (onFilterChange) {
                    onFilterChange(next);
                }
                return next;
            });
        },
        [onFilterChange]
    );


    if (!isOpen) {
        return null;
    }

    return (
        <Dialog
            open={isOpen}
            onClose={() => onClose?.()}
            className={`nz-popup-filter-dialog ${uniqueName}-dialog`}
            maxWidth={maxWidth}
            fullWidth={true}
            hideBackdrop={hideBackdrop}
            container={container}
        >
            <div className="nz-popup-filter-container" key={uniqueName}>
                {/* Dialog Header */}
                <div className="nz-popup-filter-header">
                    <div className="nz-popup-filter-header-title">
                        <Label
                            uniqueName={`${uniqueName}-header-title`}
                            label={headerText}
                            fontWeight="600"
                        />
                    </div>
                    <div className="nz-popup-filter-header-actions">
                        <div
                            className={`nz-form-header-action-save ${isDirty ? 'nz-save-yellow-background' : ''}`}
                            style={{ display: isDirty ? 'flex' : 'none' }}
                        >
                            <ActionImage
                                uniqueName={`${uniqueName}-save-ai`}
                                image={{
                                    uniqueName: `${uniqueName}-save-image`,
                                    source: (
                                        <Save24x24
                                            size={FnGetCssVariable('--image-size-2')}
                                            fill="none"
                                            strokeWidth={1}
                                        />
                                    ),
                                    w: 'var(--image-size-2)',
                                    tooltip: 'Save / Apply Filter',
                                    type: 'svg',
                                }}
                                w="var(--node_height)"
                                h="var(--node_height)"
                                actionCode="save"
                                disabled={!isDirty}
                                handleMouse={handleSaveClick}
                            />
                        </div>
                        <ActionImage
                            uniqueName={`${uniqueName}-close-ai`}
                            image={{
                                uniqueName: `${uniqueName}-close-image`,
                                source: (
                                    <Close24x24
                                        size={FnGetCssVariable('--image-size-2')}
                                        fill="none"
                                        strokeWidth={1}
                                    />
                                ),
                                w: 'var(--image-size-2)',
                                tooltip: 'Close',
                                type: 'svg',
                            }}
                            w="var(--node_height)"
                            h="var(--node_height)"
                            actionCode="close"
                            handleMouse={() => onClose?.()}
                        />
                    </div>
                </div>

                {/* Dialog Body using SettingsLibForm */}
                <div className="nz-popup-filter-body">
                    <SettingsLibForm
                        uniqueName={`${uniqueName}-form`}
                        controls={activeControls}
                        profileString={profileString}
                        allowShowHeader={false}
                        headerText=""
                        allowShowSectionHeader={false}
                        isDisableForm={isDisableForm}
                        isAutoSave={true}
                        handleSaveForm={handleSaveFormInternal}
                        handleValueChange={handleValueChangeInternal}
                        handleValueChangeExternal={handleValueChangeExternalInternal}
                    />
                </div>
            </div>
        </Dialog>
    );
};

export { PopupFilterForm };
export type { IPopupFilterFormProps };
export default PopupFilterForm;
