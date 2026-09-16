
import { FeatureMenuRange } from "../../../constants/Feature";
import { IMenuItem } from "../../allinterface/menu/IMainMenu";
import { IUserAuthSession } from "../../context/allinterface/IMainApp";
import { fnEvaluateNodeType } from "./FnFeatureNodeType";

// below code will return the main menus
const FnGetMainMenus = (list: IMenuItem[], authUser?: IUserAuthSession, context?: unknown) => {
    try {
        if (!Array.isArray(list)) {
            return [];
        }

        return list.filter((value: IMenuItem) => {
            return (
                value._Feature && value._Feature === value.MenuID &&
                (value._Feature as number) < FeatureMenuRange.MAX &&
                fnEvaluateNodeType(value.NodeType, authUser, context)
            );
        });
    } catch (error) {
        console.error("FnGetMainMenus error:", error);
        return [];
    }
}
export { FnGetMainMenus }
