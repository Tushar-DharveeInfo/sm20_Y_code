import { useMemo } from 'react';
import { Label } from '../../../shared/basic/label/Label';
import { useSmDataContext } from '../../../shared/context/hooks/SmDataHooks';
import '../../../shared/settingsform/settingslibform/SettingsLibForm.css';
import { SettingsEnums } from '../../../constants/Feature';
import { ConfirmSaasInstance } from './ConfirmSaasInstance';

interface ISaasInstance {
    uniqueName: string;
    tenantshortname: string;
    userid: string;
    featureId?: string;
    headerText?: string;
}

const SaasInstance: React.FC<ISaasInstance> = (props) => {
    const { uniqueName, headerText, featureId = SettingsEnums.Instance } = props;
    const smDataContext = useSmDataContext();
    const tenantshortname = smDataContext.selection.bid;
    const userid = smDataContext.selection.cid;

    const selectedLabel = useMemo(() => {
        if (!tenantshortname) {
            return undefined;
        }
        const businesses = smDataContext.datasets?.businesses ?? [];
        return businesses.find((business) => business.bid === tenantshortname)?.bname ?? tenantshortname;
    }, [tenantshortname, smDataContext.datasets?.businesses]);

    return (
        <div key={`${uniqueName}-${featureId}`} className="nz-form-controls-container nz-d-flex-column nz-wh-100">
            <div
                className="nz-form-header nz-sub-header nz-d-flex-row nz-align-center nz-justify-between"
                style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', width: '100%' }}
            >
                <Label
                    uniqueName={`${uniqueName}-header-label`}
                    label={selectedLabel ? `SAAS Instance: ${selectedLabel}` : (headerText || "SAAS Instance")}
                    fontWeight="bold"
                />
            </div>
            <div className="nz-wh-100 nz-d-flex-hv-center" style={{ flex: 1, padding: '2rem' }}>
                {tenantshortname ? (
                    <ConfirmSaasInstance
                        key={tenantshortname}
                        tenantshortname={String(tenantshortname)}
                        userid={String(userid ?? '')}
                    />
                ) : (
                    <Label
                        uniqueName={`${uniqueName}-select-company`}
                        label="Select a SAAS instance to impersonate"
                    />
                )}
            </div>
        </div>
    );
};

export { SaasInstance };
export default SaasInstance;
