import { useMemo } from 'react';
import { Label } from '../../../shared/basic/label/Label';
import { useSmDataContext } from '../../../shared/context/hooks/SmDataHooks';
import { sampleBusinesses } from '../../../shared/allcommon/FnBusinessesSampleData';
import '../../../shared/settingsform/settingslibform/SettingsLibForm.css';
import { SettingsEnums } from '../../../constants/Feature';
import { ImpersonateUser } from './ImpersonateUser';

interface ISaasInstance {
    uniqueName: string;
    featureId?: string;
    headerText?: string;
}

const SaasInstance: React.FC<ISaasInstance> = (props) => {
    const { uniqueName, headerText, featureId = SettingsEnums.Instance } = props;
    const smDataContext = useSmDataContext();
    const bid = smDataContext.selection.bid;
    const cid = smDataContext.selection.cid;

    const selectedLabel = useMemo(() => {
        if (!bid) {
            return undefined;
        }
        return sampleBusinesses.find((business) => business.bid === bid)?.bname ?? bid;
    }, [bid]);

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
                {bid ? (
                    <ImpersonateUser
                        key={bid}
                        data={{
                            tenantshortname: String(bid),
                            userid: String(cid ?? ''),
                        }}
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
