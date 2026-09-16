
import { IMenuItem } from "../../allinterface/menu/IMainMenu";
import { IUserAuthSession } from "../../context/allinterface/IMainApp";
import { fnEvaluateNodeType } from "./FnFeatureNodeType";

// below function will return submenus
const FnGetSubMenus = (list: IMenuItem[], id: number, parentName?: string, authUser?: IUserAuthSession, context?: unknown) => {
    try {
        if (!Array.isArray(list)) {
            return [];
        }

        var filteredlist = list.filter((value: any,) => {
            return value._Feature !== value.MenuID && value.MenuID === id
                && fnEvaluateNodeType(value.NodeType, authUser, context

                );
        });
        if (filteredlist && filteredlist.length > 0) {
            filteredlist.map((item: IMenuItem) => {
                item.parentName = parentName;
                item.parentFeatureId = id;
                return item;
            })
            filteredlist = filteredlist.sort(
                (a: any, b: any) => a.SortOrder - b.SortOrder
            );
            return filteredlist;
        } else {
            return [];
        }
    } catch (error) {
        console.error("FnGetSubMenus error:", error);
        return [];
    }
}

export { FnGetSubMenus }
