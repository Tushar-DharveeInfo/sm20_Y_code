
import { IMainApp } from "../../shared/context/allinterface/IMainApp";
import { IStatusBar } from "../../shared/context/allinterface/IStatusBar";

/* SAMPLE DATA: stats update APIs are disabled — refresh local AP records only. */
const FnUpdateStatisticsAndRefresh = async (
    statusBarContext: IStatusBar,
    mainAppContext: IMainApp
) => {
    await mainAppContext.fetchApRecords(statusBarContext);
};

export { FnUpdateStatisticsAndRefresh }
