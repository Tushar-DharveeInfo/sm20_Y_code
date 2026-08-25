import { useEffect, useState } from "react";
import { handleContainerKeyDown } from "../../../shared/allcommon/basic/FnHandleContainerKeyDown";
import { Label } from "../../../shared/basic/label/Label";
import { ForensicLog } from "../../../shared/forensiclog/ForensicLog";
interface IAppqaLog {
    uniqueName: string;
    featureId: string;
    headerText?: string;
    handleShowUserMessage?: (messageText: string) => void;
}

/*AppQA Log — forensic log with static sample data (same as sidebar Log). */
const AppqaLog = (appqaLogProps: IAppqaLog) => {
    const defaultHeader = appqaLogProps.headerText ?? "Log";
    const [headerText, setHeaderText] = useState(defaultHeader);

    useEffect(() => {
        setHeaderText(defaultHeader);
    }, [defaultHeader]);

    const handleUpdateHeaderTitle = (title: string): void => {
        setHeaderText(title.length ? title : defaultHeader);
    };

    return (
        <div
            className="nz-wh-100 nz-d-flex-column nz-overflow-hidden"
            tabIndex={1}
            onKeyDown={handleContainerKeyDown}
            key={appqaLogProps.uniqueName}
        >
            <div className="nz-sub-header">
                <Label
                    uniqueName={`${appqaLogProps.uniqueName}-header`}
                    label={headerText}
                />
            </div>
            <div style={{ flexGrow: 1, overflow: "hidden" }}>
                <ForensicLog
                    featureId={appqaLogProps.featureId}
                    isSetting={true}
                    loginType="user"
                    uniqueName={`${appqaLogProps.uniqueName}-forensic-log`}
                    handleUpdateHeaderTitle={handleUpdateHeaderTitle}
                    handleShowUserMessage={appqaLogProps.handleShowUserMessage}
                />
            </div>
        </div>
    );
};

export default AppqaLog;
