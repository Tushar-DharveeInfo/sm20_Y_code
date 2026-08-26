
import { useEffect, useMemo } from 'react';
import { ReportSchedulerForm } from '@n20a/libform';
import '@n20a/libform/style.css';
import sampleDailySchedularEnv from '../../../../sampledata/features/dailySchedular.json';
import { Label } from '../../../shared/basic/label/Label';
interface IDailySchedular {
    uniqueName: string;
    featureId?: string;
    headerText?: string;
}
// Converts env response into schedulerConfigProps for ReportSchedulerForm.
const buildSchedulerConfigProps = (response: unknown): Record<string, string> | null => {
    if (!response || typeof response !== 'object') {
        return null;
    }
    const payload = response as Record<string, unknown>;
    if (Array.isArray(payload.data)) {
        return Object.fromEntries(
            payload.data.map((item: { key?: string; value?: unknown }) => [
                item.key ?? '',
                item.value == null ? '' : String(item.value),
            ])
        );
    }
    const data = payload.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        return Object.fromEntries(
            Object.entries(data as Record<string, unknown>).map(([key, value]) => [
                key,
                value == null ? '' : String(value),
            ])
        );
    }
    return null;
};

const DailySchedular = (dailySchedularProps: IDailySchedular) => {
    const { uniqueName, headerText } = dailySchedularProps;
    const apiRootUrl = '/expapi';

    // SAMPLE DATA: replaces expapi ServerEnv (REPORTSCHEDULER_*) while APIs are disabled.
    const schedulerConfigProps = useMemo(() => {
        const configProps = buildSchedulerConfigProps(sampleDailySchedularEnv);
        return configProps && Object.keys(configProps).length > 0 ? configProps : null;
    }, []);

    // ReportSchedulerForm manages its own save flow; hide the settings header save action.
    useEffect(() => {
        const saveButton: HTMLDivElement | null = document.querySelector(
            '.nz-form-action-header .nz-form-header-action-save'
        );
        if (saveButton) {
            saveButton.style.display = 'none';
        }
    }, []);

    if (!schedulerConfigProps) {
        return (
            <div className="nz-wh-100 nz-d-flex-hv-left">
                Report scheduler configuration not found
            </div>
        );
    }

    return (
        <div
            key={uniqueName}
            className="nz-w-100 nz-h-100 nz-d-flex-column nz-settings-right-container-form"
        >
            <div
                className="nz-sub-header"
            >
                <Label
                    uniqueName={`${uniqueName}-header-label`}
                    label={headerText || "Daily Scheduler"}
                    fontWeight="bold"
                />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <ReportSchedulerForm schedulerConfigProps={schedulerConfigProps} apiRootUrl={apiRootUrl} />
            </div>
        </div>
    );
};

export { DailySchedular };
export default DailySchedular;
