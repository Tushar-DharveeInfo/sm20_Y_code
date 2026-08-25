
import { useCallback, useEffect, useMemo, useState } from 'react'

import './SearchControlWithFilter.css'

import { IControl } from '../../allinterface/settingsform/ISettingsLibForm'
import { ICascadeFilterContext, ISearchControlWithFilter } from './ISearchControlWithFilter'
import { ISearchControl } from '../../allinterface/searchfilter/ISearchControl'

import { handleFormControlsKeyDown } from '../../allcommon/basic/FnHandleContainerKeyDown'
import { SettingsContainer } from '../../settingsform/settingscontainer/SettingsContainer'
import { SearchControl } from '../searchcontrol/SearchControl'
import { formatFilterLogDate } from '../../allcommon/basic/FnFilterLogDates'

const DEFAULT_CASCADE_CONTROL_NAMES = new Set([
    'sitename',
    'tenantname',
    'username',
    'companyname',
    'users',
]);

// Parses profile JSON defensively when persisted filter data is malformed.
const parseProfileRecord = (profileText: string): Record<string, unknown> => {
    try {
        const parsedProfile: unknown = JSON.parse(profileText);
        if (Array.isArray(parsedProfile) && parsedProfile[0] && typeof parsedProfile[0] === 'object') {
            return parsedProfile[0] as Record<string, unknown>;
        }
        return (parsedProfile && typeof parsedProfile === 'object' && !Array.isArray(parsedProfile))
            ? parsedProfile as Record<string, unknown>
            : {};
    } catch (error) {
        console.error("Failed to parse search filter profile JSON", error);
        return {};
    }
};

// Merged date controls use dateRange; profile persistence uses flat StartDate / EndDate.
const normalizeProfileDatesForForm = (profile: Record<string, unknown>): Record<string, unknown> => {
    const normalized: Record<string, unknown> = { ...profile };

    const applyDateRange = (rangeValue: unknown) => {
        if (!rangeValue || typeof rangeValue !== 'object' || Array.isArray(rangeValue)) {
            return;
        }
        const range = rangeValue as Record<string, unknown>;
        if (range.startDate != null && normalized.StartDate == null) {
            normalized.StartDate = range.startDate;
        }
        if (range.endDate != null && normalized.EndDate == null) {
            normalized.EndDate = range.endDate;
        }
    };

    applyDateRange(normalized.dateRange);
    Object.keys(normalized).forEach((key) => {
        if (key.toLowerCase().includes('daterange')) {
            applyDateRange(normalized[key]);
            delete normalized[key];
        }
    });
    delete normalized.dateRange;

    if (normalized.StartDate != null && normalized.StartDate !== '') {
        normalized.StartDate = formatFilterLogDate(normalized.StartDate);
    }
    if (normalized.EndDate != null && normalized.EndDate !== '') {
        normalized.EndDate = formatFilterLogDate(normalized.EndDate);
    }

    return normalized;
};

function SearchControlWithFilter(props: ISearchControlWithFilter) {
    const [searchControlProps, setSearchControlProps] = useState<ISearchControl>(props.searchProps);
    const [lensValue, serLensValue] = useState<string>('')
    const [formValues, setFormValues] = useState<Record<string, unknown>>({});
    const [showForm, setShowForm] = useState<boolean>(false)
    const [control, stControl] = useState<IControl[]>(props.controls)

    const cascadeControlNames = useMemo(() => {
        if (props.cascadeControlNames?.length) {
            return new Set(props.cascadeControlNames.map((name) => name.toLowerCase()));
        }
        return DEFAULT_CASCADE_CONTROL_NAMES;
    }, [props.cascadeControlNames]);

    const hasCascade = Boolean(props.allowSiteUserCascade || props.renderCascadeFilter);

    const renderedControls = useMemo(
        () =>
            hasCascade
                ? control.filter(
                    (item) => !cascadeControlNames.has(item.Name?.toLowerCase() ?? '')
                )
                : control,
        [cascadeControlNames, control, hasCascade]
    );

    // Merges cascade field values into filter form state and marks filter dirty.
    const handleCascadeValuesChange = useCallback((
        values: object,
        options?: { isDefault?: boolean }
    ) => {
        setFormValues((previousValues) => ({
            ...previousValues,
            ...values,
        }));

        if (!options?.isDefault) {
            setSearchControlProps((previousProps) => ({
                ...previousProps,
                filterDirty: true,
            }));
        }
    }, []);

    // Updates lens text and dirty state as the user types in search.
    const searchValueChange = (value: string) => {
        serLensValue(value)
        setSearchControlProps((previousProps) => ({
            ...previousProps,
            lensDirty: Boolean(value),
        }));
    }

    // Syncs local controls when parent control definitions change.
    useEffect(() => {
        stControl(props.controls);
    }, [props.controls]);

    // Hydrates form controls and values from saved profile JSON.
    useEffect(() => {
        if (!props.fromProfileString?.length) {
            return;
        }
        try {
            const profile = normalizeProfileDatesForForm(parseProfileRecord(props.fromProfileString));
            if (props.controls.length) {
                const updateControl = props.controls.map((controlItem) => {
                    const element = { ...controlItem };
                    const key = element._AP;
                    if (key && Object.prototype.hasOwnProperty.call(profile, key)) {
                        const profileValue = profile[key];
                        element.Value = profileValue == null ? null : String(profileValue);
                        element.DefaultAPValue = profileValue == null ? '' : String(profileValue);
                    }
                    return element;
                });
                stControl([...updateControl]);
            }
            setFormValues((previousValues) => ({
                ...previousValues,
                ...profile,
            }));
        } catch (error) {
            console.error("Failed to apply search filter profile", error);
        }
    }, [props.fromProfileString, props.controls]);

    // Toggles filter panel and submits or resets filter depending on dirty state.
    const handleFilterMouse = () => {
        setShowForm(!showForm)
        setSearchControlProps((previousProps) => ({
            ...previousProps,
            hideSearchControl: !previousProps.hideSearchControl,
            hideRightMouseMenu: !previousProps.hideSearchControl,
            filterDirty: false,
        }))
        if (searchControlProps.filterDirty) {
            props.handleFilterFormData?.(formValues)
        } else {
            props.handleFilterFormClick?.()
        }
    }

    // Submits lens keywords with current filter values and AND/OR condition.
    const handleLensMouse = (selectedCondition?: string) => {
        const data: Record<string, unknown> = {
            ...formValues,
            Keywords: lensValue,
            AndOR: selectedCondition ?? 'AND',
        };
        if (props.handleLensFormData) {
            props.handleLensFormData(data);
        } else {
            props.handleFilterFormData?.(data);
        }
    }

    // Tracks non-cascade SettingsContainer value changes in local filter state.
    const handleValueChange = (value: unknown, name: string | undefined, isDefault?: boolean) => {
        if (!name || isDefault) {
            return;
        }
        setFormValues((previousValues) => {
            if (previousValues[name] === value) {
                return previousValues;
            }
            return {
                ...previousValues,
                [name]: value,
            };
        });
        if (!isDefault) {
            setSearchControlProps((previousProps) => ({
                ...previousProps,
                filterDirty: true,
            }));
        }
    }

    const profileSiteName = typeof formValues.SiteName === 'string'
        ? formValues.SiteName
        : '';

    const cascadeContext = useMemo((): ICascadeFilterContext => ({
        uniqueName: props.uniqueName,
        loginType: props.loginType,
        profileSiteName,
        onValuesChange: handleCascadeValuesChange,
    }), [
        handleCascadeValuesChange,
        profileSiteName,
        props.loginType,
        props.uniqueName,
    ]);

    const cascadeContent = useMemo(
        () => (props.renderCascadeFilter ? props.renderCascadeFilter(cascadeContext) : null),
        [cascadeContext, props.renderCascadeFilter]
    );

    const showFilterBody = showForm && (hasCascade || renderedControls.length > 0);

    return (
        <div className='nz-form-groupControl-with-filter'>
            {searchControlProps && <SearchControl
                {...searchControlProps}
                filterIconTooltip={props.filterIconTooltip}
                searchInputValue={lensValue}
                handleLensMouse={handleLensMouse}
                handleFilterMouse={handleFilterMouse}
                searchValueChange={searchValueChange}
            />}
            {showFilterBody ? (
                <div className='nz-search-filter-form-body' onKeyDownCapture={handleFormControlsKeyDown}>
                    {hasCascade ? cascadeContent : null}
                    {renderedControls.length > 0 ? (
                        <SettingsContainer
                            allowShowHeader={false}
                            isDisableForm={false}
                            isAutoSave={true}
                            profileString={JSON.stringify([normalizeProfileDatesForForm(formValues)])}
                            handleValueChange={handleValueChange}
                            uniqueName={`${props.uniqueName}-form`}
                            formControls={renderedControls}
                            allowActionList={false}
                        />
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}

export { SearchControlWithFilter }
