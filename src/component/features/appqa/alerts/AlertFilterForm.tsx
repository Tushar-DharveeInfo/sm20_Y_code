import { useEffect, useMemo, useRef, useState } from 'react';
import { useSessionContext } from '../../../shared/context/hooks/SessionHooks';
import { SettingsContainer } from '../../../shared/settingsform/settingscontainer/SettingsContainer';
import { IAppqaAlertCascadeValues, IAppqaAlertFilterForm, IAppqaAlertFilterValues } from './IAlerts';
import {
    areAppqaAlertFilterValuesEqual,
    buildAppqaAlertFilterComboControls,
    getSessionUserNameForAssignedTo,
    mergeAssignToUserOptions,
    parseAssignToUserNames,
    resolveAppqaAlertDateFilterValues,
    resolveAssignedToFromSession,
    toAssignedToDisplayValue,
    toAssignedToFilterValue,
} from '../allcommon/FnAppqaAlertFilterUtils';
import notifySampleData from '../../../../smsampledata/appqa/NotifySampleData.json';
const { sampleNotifyUsersRaw } = notifySampleData;

import { SiteTenantCascade } from './SiteTenantCascade';

function AppqaAlertFilterForm(props: IAppqaAlertFilterForm) {
    const [assignToUserNames, setAssignToUserNames] = useState<string[]>([]);
    const sessionContext = useSessionContext();
    const usersLoadedRef = useRef(false);
    const draftValuesRef = useRef<IAppqaAlertFilterValues>(props.initialFilterValues);
    draftValuesRef.current = props.initialFilterValues;

    const [formControls, setFormControls] = useState(() =>
        buildAppqaAlertFilterComboControls([], props.initialFilterValues)
    );

    const profileString = useMemo(
        () => JSON.stringify([{
            ...props.initialFilterValues,
            AssignedTo: toAssignedToDisplayValue(props.initialFilterValues.AssignedTo ?? ''),
        }]),
        [props.initialFilterValues]
    );

    useEffect(() => {
        if (!assignToUserNames.length) {
            return;
        }

        const resolvedAssignedTo = resolveAssignedToFromSession(
            assignToUserNames,
            getSessionUserNameForAssignedTo(sessionContext.SessionList)
        );
        const assignedToValue = props.hasUserAppliedFilter
            ? draftValuesRef.current.AssignedTo
            : resolvedAssignedTo;

        if (!props.hasUserAppliedFilter) {
            const nextValues = {
                ...draftValuesRef.current,
                AssignedTo: resolvedAssignedTo,
            };

            if (!areAppqaAlertFilterValuesEqual(nextValues, draftValuesRef.current)) {
                draftValuesRef.current = nextValues;
                props.onFilterChange(nextValues, { isDefault: true });
            }
        }

        setFormControls((previous) =>
            mergeAssignToUserOptions(previous, assignToUserNames, assignedToValue)
        );
    }, [assignToUserNames, props.hasUserAppliedFilter, sessionContext.SessionList]);

    useEffect(() => {
        if (usersLoadedRef.current) {
            return;
        }
        usersLoadedRef.current = true;
        // SAMPLE DATA: AUTH.GetUsers API commented out.
        // axiosInterceptor({ url: AUTH.GetUsers, data: { includeCurrentUser: true }, ... });
        setAssignToUserNames(
            parseAssignToUserNames({ usersJson: sampleNotifyUsersRaw })
        );
    }, []);

    const publishDraft = (
        nextValues: IAppqaAlertFilterValues,
        options?: { isDefault?: boolean }
    ) => {
        draftValuesRef.current = nextValues;
        props.onFilterChange(nextValues, options);
    };

    const handleCascadeChange = (
        values: IAppqaAlertCascadeValues,
        options?: { isDefault?: boolean }
    ) => {
        props.onCascadeValuesChange?.(values, options);
        publishDraft(
            {
                ...draftValuesRef.current,
                ...values,
            },
            options
        );
    };

    const handleComboValueChange = (
        value: unknown,
        name: string | undefined,
        isDefault?: boolean
    ): void => {
        if (!name) {
            return;
        }

        let nextValues: IAppqaAlertFilterValues;

        if (name === 'dateRange' || name === 'StartDate' || name === 'EndDate') {
            nextValues = {
                ...draftValuesRef.current,
                ...resolveAppqaAlertDateFilterValues(value, name, draftValuesRef.current),
            };
        } else {
            const rawValue = value == null ? '' : String(value);
            const fieldName = name === 'AlertSeverity' ? 'Severity' : name;
            const nextValue = fieldName === 'AssignedTo'
                ? toAssignedToFilterValue(rawValue)
                : rawValue;

            nextValues = {
                ...draftValuesRef.current,
                [fieldName]: nextValue,
            };
        }

        if (areAppqaAlertFilterValuesEqual(nextValues, draftValuesRef.current)) {
            return;
        }

        props.onCascadeValuesChange?.(
            name === 'dateRange' || name === 'StartDate' || name === 'EndDate'
                ? { StartDate: nextValues.StartDate, EndDate: nextValues.EndDate }
                : { [name]: nextValues[name as keyof typeof nextValues] },
            { isDefault }
        );
        publishDraft(nextValues, { isDefault });
    };

    return (
        <div className='nz-appqa-alert-filter-form'>
            <SiteTenantCascade
                uniqueName={props.uniqueName}
                loginType={props.loginType}
                profileSiteName={props.profileSiteName}
                initialSiteName={
                    props.hasUserAppliedFilter ? props.initialFilterValues.SiteName : undefined
                }
                initialTenantName={
                    props.hasUserAppliedFilter ? props.initialFilterValues.TenantName : undefined
                }
                onValuesChange={handleCascadeChange}
            />

            <div className='nz-appqa-alert-filter-combos'>
                <SettingsContainer
                    uniqueName={`${props.uniqueName ?? 'appqa-alert'}-filter-combos`}
                    formControls={formControls}
                    allowActionList={false}
                    allowShowHeader={false}
                    isAutoSave={true}
                    isDisableForm={false}
                    profileString={profileString}
                    handleValueChange={handleComboValueChange}
                    handleSaveAction={() => undefined}
                />
            </div>
        </div>
    );
}
export { AppqaAlertFilterForm };
