import { ChangedValueMap } from "@n20a/libform";
import { ITreeNode } from "../tree/ITreeControl";
import { IActionImageForSubMenu } from "../basic/IActionImageList";

interface IOneToManyFormContainer {
    uniqueName: string;
    tableDefinition: Record<string, any>;
    selectedNode?: ITreeNode;
    tableData?: Record<string, any>[];
    isAllowCustomHeader?: boolean;
    updatedProfile?: Record<string, any>;
    containerName?: string;
    featureId?: string;
    hideAddForm?: boolean;
    isReadOnly?: boolean;
    hideHeaderSaveButton?: boolean;
    hideSaveButton?: boolean;
    handleNodeMenuOnClick?: (value: IActionImageForSubMenu, selectedRow: any, instanceName: string) => void;
    handleControlValueChange?: (changedValue: ChangedValueMap) => boolean;
    handleSaveOneToManyRecords?: (updatedRecords: Record<string, any>, tableName?: string) => Promise<Record<string, any>[]> | Record<string, any>[] | void;
    handleDeleteOneToManyRecord?: (deletedRecord: Record<string, any>, tableName?: string) => Promise<void> | void;
    deleteConfirmationMessage?: string;
    onDataChange?: (updatedData: Record<string, any>[], tableName?: string) => void;
}

export type { IOneToManyFormContainer };
