import React, { useMemo, useState } from 'react';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { SettingsInstanceList } from '../../../shared/settingsform/settingsinstancelist/SettingsInstanceList';
import { IActionLabelItem } from '../../../shared/allinterface/basic/IActionLabelItem';
import { sampleBusinesses } from '../../allcommon/FnBusinessesSampleData';
import { Label } from '../../../shared/basic/label/Label';
import '../../../shared/settingsform/settingslibform/SettingsLibForm.css';
import { SettingsEnums } from '../../../constants/Feature';

interface ISaasInstance {
    uniqueName: string;
    featureId?: string;
    headerText?: string;
}

const SaasInstance: React.FC<ISaasInstance> = (props) => {
    const { uniqueName, headerText, featureId = SettingsEnums.Instance } = props;

    // Build action items from sample businesses showing company names only (no CIDs)
    const companyActionItems: IActionLabelItem[] = useMemo(() => {
        return sampleBusinesses
            .map((b) => ({
                label: b.bname,
                actionCode: b.bid,
                tooltip: b.bname,
                profileString: JSON.stringify([{ Enabled: b.verified ?? true, Public: true, AddEdit: false }]),
                subGroupName: "SAASInstance",
                isInUse: true,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, []);

    const [selectedItem, setSelectedItem] = useState<IActionLabelItem | null>(
        companyActionItems.length > 0 ? companyActionItems[0] : null
    );

    const handleSelectListItem = (
        _event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
        actionCode?: string
    ) => {
        if (!actionCode) return;
        const item = companyActionItems.find((ci) => ci.actionCode === actionCode);
        if (item) {
            setSelectedItem(item);
        }
    };

    const handleActionButtonClick = (
        _event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
        actionCode?: string
    ) => {
        if (actionCode === "add") {
            setSelectedItem(null);
        }
    };

    return (
        <div key={uniqueName} className="nz-form-list-container nz-wh-100 nz-d-flex-column" tabIndex={1}>
            <div
                className="nz-sub-header nz-d-flex-row nz-align-center nz-justify-between nz-w-100"
            >
                <Label
                    uniqueName={`${uniqueName}-main-header-label`}
                    label={headerText || "SAAS Instance"}
                    fontWeight="bold"
                />
            </div>
            <div className="nz-w-100" style={{ flex: 1, minHeight: 0 }}>
                <Splitter tabIndex={-1} className="nz-w-100 nz-h-100">
                    <SplitterPanel tabIndex={-1} size={25} minSize={10} className="nz-d-flex-column nz-align-center nz-justify-center nz-pane-1">
                        <div className="nz-form-instance-container nz-w-100 nz-h-100">
                            <SettingsInstanceList
                                uniqueName={`${uniqueName}-alist`}
                                actionLabelItems={companyActionItems}
                                isAddMode={selectedItem === null}
                                selectedItem={selectedItem || undefined}
                                allowFilter={true}
                                handleSelectListItem={handleSelectListItem}
                                handleActionButtonClick={handleActionButtonClick}
                                allowAdd={false}
                                allowDelete={false}
                                showEditButton={false}
                                allowTestApi={false}
                                allowPreflight={false}
                                disableAdd={false}
                                disableEdit={!selectedItem}
                                disableDelete={!selectedItem}
                                disableTestApi={true}
                            />
                        </div>
                    </SplitterPanel>
                    <SplitterPanel tabIndex={-1} size={75} minSize={10} className="nz-d-flex-column nz-align-center">
                        <div className="nz-form-controls-container nz-d-flex-column nz-wh-100">
                            <div className="nz-form-header nz-sub-header nz-d-flex-row nz-align-center nz-justify-between" style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', width: '100%' }}>
                                <Label
                                    uniqueName={`${uniqueName}-header-label`}
                                    label={selectedItem ? `SAAS Instance: ${selectedItem.label}` : (headerText || "SAAS Instance")}
                                    fontWeight="bold"
                                />
                            </div>
                            <div className="nz-wh-100 nz-d-flex-hv-center" style={{ flex: 1, padding: '2rem' }}>
                                <div
                                    className="nz-to-be-implemented-card nz-d-flex-column nz-align-center nz-justify-center"

                                >
                                    <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                        {selectedItem?.label ?? "Company"}
                                    </span>
                                    <span style={{ fontSize: '1rem', fontStyle: 'italic' }}>
                                        To be implemented
                                    </span>
                                </div>
                            </div>
                        </div>
                    </SplitterPanel>
                </Splitter>
            </div>
        </div>
    );
};

export { SaasInstance };
export default SaasInstance;
