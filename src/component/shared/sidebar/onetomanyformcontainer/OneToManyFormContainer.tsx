import { useEffect, useMemo, useRef, useState } from "react";
import { FormElementsRenderer, IFormData, IFormElements } from "@n20a/libform";
import './OneToManyFormContainer.css';
import '@n20a/libform/style.css';
import { IOneToManyFormContainer } from "../../allinterface/sidebar/IOneToManyFormContainer";
import { FnBuildFormElementsFromDataset } from "../../allcommon/sidebar/FnBuildFormElementsFromDataset";
import { IPropertyColumn } from "../../allinterface/sidebar/IPropertyFormContainer";
import { useStatusBarContext } from "../../context/hooks/StatusBarHooks";
import { useMainAppContext } from "../../context/hooks/MainAppHooks";
import { getDiagnosticLevelData } from "../../context/contextandprovider/CommonVariable";
import { IBasicGridColDef } from "../../allinterface/tablegrid/IBasicGrid";
import { hideGridData } from "../../alldefaultprops/tablegrid/DefaultPropsBasicGrid";
import { BasicGrid } from "../../tablegrid/BasicGrid";
import { ColSpanParams, ICellRendererParams, ValueGetterParams } from "ag-grid-community";
import { Label } from "../../basic/label/Label";
import { IImage } from "../../allinterface/basic/IImage";
import { Save24x24 } from "@n20a/libicon";
import { FnGetCssVariable } from "../../../appcontainer/allcommon/FnGetCssVariable";
import { DirtyFlagImage } from "../../basic/dirtyflagimage/DirtyFlagImage";
import { YesNoFormContainer } from "../../basic/yesnoformcontainer/YesNoFormContainer";
import { FnConvertDateToUtcOrUtcToLocalDate } from "../../allcommon/FnConvertDateToUtcOrUtcToLocalDate";
import { FnParseJsonSafely } from "../../../appcontainer/allcommon/FnParseJsonSafely";

type IOneToManyGridRow = Record<string, unknown>;

// Resolves a column value from row data with support for case differences and naming variations.
const resolveCellValue = (
    data: Record<string, unknown> | undefined,
    pName?: string,
    label?: string
): unknown => {
    if (!data || typeof data !== "object") return "";

    // 1. Direct exact match by PName
    if (pName && data[pName] !== undefined && data[pName] !== null) {
        return data[pName];
    }

    // 2. Direct exact match by PropertyLabel
    if (label && data[label] !== undefined && data[label] !== null) {
        return data[label];
    }

    // 3. Case-insensitive and punctuation-stripped lookup
    const cleanPName = pName ? pName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
    const cleanLabel = label ? label.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";

    const entries = Object.entries(data);
    for (const [key, val] of entries) {
        if (val === undefined || val === null) continue;
        const cleanKey = key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        if ((cleanPName && cleanKey === cleanPName) || (cleanLabel && cleanKey === cleanLabel)) {
            return val;
        }
    }

    // 4. Suffix match for prefixed database view keys (e.g. Table_FromPath or prefix_FromPath)
    for (const [key, val] of entries) {
        if (val === undefined || val === null) continue;
        const lowerKey = key.toLowerCase();
        if (
            (cleanPName && (lowerKey.endsWith(`_${cleanPName}`) || lowerKey.endsWith(`.${cleanPName}`))) ||
            (cleanLabel && (lowerKey.endsWith(`_${cleanLabel}`) || lowerKey.endsWith(`.${cleanLabel}`)))
        ) {
            return val;
        }
    }

    return "";
};

const OneToManyFormContainer = (oneToManyFormContainerProps: IOneToManyFormContainer) => {
    const [formElements, setFormElements] = useState<IFormElements>();
    const [oneToManyGridData, setOneToManyGridData] = useState<IOneToManyGridRow[]>();
    const [loading, setLoading] = useState(true);
    const [oneToManyGridColumns, setOneToManyGridColumns] = useState<IBasicGridColDef[]>();
    const [selectedRecord, setSelectedRecord] = useState<IOneToManyGridRow>();
    const [updatedProperties, setUpdatedProperties] = useState<Record<string, unknown>>();
    const [isDirty, setIsDirty] = useState<boolean>();
    const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
    const [confirmMessage, setConfirmMessage] = useState<string>("");
    const [recordToDelete, setRecordToDelete] = useState<IOneToManyGridRow>();
    const [formVersion, setFormVersion] = useState(0);
    const statusBarContext = useStatusBarContext();
    const mainAppContext = useMainAppContext();
    const columnBuildKeyRef = useRef<string | undefined>(undefined);
    const { tableName, tableLabel, properties } = oneToManyFormContainerProps.tableDefinition;
    const { NodeEntityname, NodeEntID } = oneToManyFormContainerProps.selectedNode ?? {};
    const { updatedProfile } = oneToManyFormContainerProps;

    // Clears form and grid state when the container unmounts.
    useEffect(() => {
        return () => {
            setOneToManyGridData(undefined);
            setOneToManyGridColumns(undefined);
            setFormElements(undefined);
            columnBuildKeyRef.current = undefined;
            setLoading(true);
        };
    }, []);

    // Builds form elements and grid columns from table definition and selected record.
    useEffect(() => {
        if (tableName) {
            setLoading(true);
            try {
                const diagnosticLevel = getDiagnosticLevelData();
                const columns = Array.isArray(properties) ? properties : FnParseJsonSafely<IPropertyColumn[], IPropertyColumn[]>(properties, { fallback: [] });
                const defaultColValue: IOneToManyGridRow = {
                    EntityName: NodeEntityname,
                    ...(updatedProfile ?? {})
                };
                const myFormElements = FnBuildFormElementsFromDataset(
                    tableLabel ? tableLabel : "Properties",
                    {
                        [tableName]: {
                            label: `${selectedRecord ? 'Edit' : 'Add'} ${tableLabel}`,
                            columns: columns
                        }
                    },
                    {
                        [tableName]: selectedRecord ? [selectedRecord] : updatedProfile ? [updatedProfile] : [defaultColValue]
                    },
                    statusBarContext,
                    mainAppContext.refTableRecords,
                    undefined,
                    diagnosticLevel,
                    false,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    oneToManyFormContainerProps.handleControlValueChange
                );
                setFormElements(myFormElements);
                const columnBuildKey = `${tableName}_${properties}_${diagnosticLevel}`;
                if (columnBuildKeyRef.current !== columnBuildKey) {
                    const gridColumns: IBasicGridColDef[] = [];
                    for (let index = 0; index < columns.length; index++) {
                        const element = columns[index];
                        if (diagnosticLevel === "0" && hideGridData.includes(element.PName)) continue;
                        if (element.DisplayControl) {
                            const isFirstColumn = gridColumns.length === 0;
                            const def: IBasicGridColDef = {
                                field: element.PName,
                                headerName: (element.PropertyLabel && element.PropertyLabel.trim()) ? element.PropertyLabel : element.PName,
                                suppressSizeToFit: true,
                                editable: false,
                                minWidth: 120,
                                colSpan: (params: ColSpanParams) => {
                                    if (params.data?.isNoData) {
                                        return isFirstColumn ? 20 : 1;
                                    }
                                    return 1;
                                },
                                valueGetter: (params: ValueGetterParams) => {
                                    if (params.data?.isNoData) {
                                        return isFirstColumn ? "No data found" : "";
                                    }
                                    return resolveCellValue(params.data as Record<string, unknown>, element.PName, element.PropertyLabel);
                                },
                                cellRenderer: (params: ICellRendererParams) => {
                                    if (params.data?.isNoData) {
                                        if (isFirstColumn) {
                                            return (
                                                <span style={{ color: "var(--textsecondary)", fontStyle: "italic", paddingLeft: "4px" }}>
                                                    No data found
                                                </span>
                                            );
                                        }
                                        return null;
                                    }
                                    return <span>{params.value != null ? String(params.value) : ""}</span>;
                                }
                            };
                            if (columns?.length - 1 === index) {
                                def.flex = 1;
                                def.resizable = false;
                            }
                            gridColumns.push(def);
                        }
                    }
                    setOneToManyGridColumns(gridColumns);
                    columnBuildKeyRef.current = columnBuildKey;
                }
            } catch (error) {
                console.error('Failed to build one-to-many form elements:', error);
            } finally {
                setLoading(false);
            }
        }
    }, [tableLabel, tableName, properties, NodeEntityname, selectedRecord, updatedProfile]);

    // Syncs grid data from props, sorted by LastUpdated descending with formatted dates.
    useEffect(() => {
        const rawTableData = oneToManyFormContainerProps.tableData;
        let dataList: IOneToManyGridRow[] = [];
        if (Array.isArray(rawTableData)) {
            dataList = rawTableData;
        } else if (rawTableData && typeof rawTableData === "object") {
            dataList = Object.values(rawTableData).filter(
                (item): item is IOneToManyGridRow => item != null && typeof item === "object"
            );
        }

        if (dataList.length > 0) {
            const columns = Array.isArray(properties) ? properties : FnParseJsonSafely<IPropertyColumn[], IPropertyColumn[]>(properties, { fallback: [] });
            const sortedData = [...dataList].sort(
                (a, b) => {
                    const aTime = a.LastUpdated ? new Date(String(a.LastUpdated)).getTime() : 0;
                    const bTime = b.LastUpdated ? new Date(String(b.LastUpdated)).getTime() : 0;
                    return bTime - aTime;
                }
            ).map(item => {
                const normalizedItem: IOneToManyGridRow = { ...item };
                if (columns && columns.length > 0) {
                    columns.forEach(col => {
                        if (col.PName && (normalizedItem[col.PName] === undefined || normalizedItem[col.PName] === null)) {
                            const resolved = resolveCellValue(item, col.PName, col.PropertyLabel);
                            if (resolved !== "") {
                                normalizedItem[col.PName] = resolved;
                            }
                        }
                    });
                }
                if (normalizedItem.LastUpdated) {
                    normalizedItem.LastUpdated = FnConvertDateToUtcOrUtcToLocalDate(normalizedItem.LastUpdated as string, false, true);
                }
                return normalizedItem;
            });
            setOneToManyGridData(sortedData);
        } else {
            setOneToManyGridData([]);
        }
    }, [oneToManyFormContainerProps.tableData, properties]);

    // Merges a saved or updated row into the grid by RecID.
    const applySavedRecordToGrid = (newRecord?: IOneToManyGridRow) => {
        if (!newRecord) return;
        const recordWithId = {
            ...newRecord,
            RecID: newRecord.RecID ?? `local_${Date.now()}`
        };
        setOneToManyGridData(prev => {
            const data = prev ? [...prev] : [];
            const index = data.findIndex(row => (row.RecID && recordWithId.RecID) ? row.RecID === recordWithId.RecID : false);
            let updated: IOneToManyGridRow[];
            if (index !== -1) {
                data[index] = recordWithId;
                updated = [...data];
            } else {
                updated = [...data, recordWithId];
            }
            oneToManyFormContainerProps.onDataChange?.(updated, tableName);
            return updated;
        });
    };

    // Resets form selection and dirty state after a successful save.
    const resetAfterSave = () => {
        setSelectedRecord(undefined);
        setUpdatedProperties(undefined);
        setIsDirty(false);
        setFormVersion(v => v + 1);
    };

    // Persists merged row via custom callback from props or local state update.
    const saveMergedRow = async (mergedRow: IOneToManyGridRow): Promise<void> => {
        statusBarContext?.setIsLoading?.(true);
        statusBarContext?.setLoadingLabel?.("Loading...");
        try {
            if (NodeEntID && !mergedRow["EntID"]) {
                mergedRow["EntID"] = NodeEntID;
            }
            if (oneToManyFormContainerProps.handleSaveOneToManyRecords) {
                const result = oneToManyFormContainerProps.handleSaveOneToManyRecords(mergedRow, tableName);
                if (result instanceof Promise) {
                    const resolved = await result;
                    if (Array.isArray(resolved)) {
                        resolved.forEach(applySavedRecordToGrid);
                    } else if (resolved) {
                        applySavedRecordToGrid(resolved);
                    } else {
                        applySavedRecordToGrid(mergedRow);
                    }
                } else if (result) {
                    if (Array.isArray(result)) {
                        result.forEach(applySavedRecordToGrid);
                    } else {
                        applySavedRecordToGrid(result);
                    }
                } else {
                    applySavedRecordToGrid(mergedRow);
                }
                resetAfterSave();
                return;
            }

            applySavedRecordToGrid(mergedRow);
            resetAfterSave();
        } finally {
            statusBarContext?.setIsLoading?.(false);
            statusBarContext?.setLoadingLabel?.(undefined);
        }
    };

    // Builds pgData map from updated property keys for the active table.
    const buildPgDataFromUpdatedProperties = (
        parsedPgTable: { PName: string }[],
        updatedKeys: string[]
    ): IOneToManyGridRow => {
        const pgData: IOneToManyGridRow = {};
        parsedPgTable.forEach((col) => {
            if (!tableName) return;
            const pgKeyPrefix = `${tableName}_${col.PName}_`;
            const pgKey = updatedKeys.find(k => k.startsWith(pgKeyPrefix));
            if (pgKey) {
                const value = updatedProperties?.[pgKey];
                pgData[col.PName] = value === "" ? undefined : value;
            }
        });
        return pgData;
    };

    // Builds pgData map from form section values for the active table.
    const buildPgDataFromFormSection = (
        parsedPgTable: { PName: string }[],
        pgTableUpdatedData: Record<string, unknown>
    ): IOneToManyGridRow => {
        const pgData: IOneToManyGridRow = {};
        parsedPgTable.forEach((col) => {
            if (!tableName || !col.PName) return;
            const value = pgTableUpdatedData[col.PName];
            pgData[col.PName] = value === "" ? undefined : value;
        });
        return pgData;
    };

    // Loads the selected grid row into the add/edit form.
    const handleEditRecord = (value?: ICellRendererParams<IOneToManyGridRow>) => {
        if (value?.data && !value.data.isNoData) {
            setSelectedRecord(value.data);
        }
    };

    // Opens delete confirmation dialog for the selected row.
    const handleDeleteRecord = (value?: ICellRendererParams<IOneToManyGridRow>) => {
        if (value?.data && !value.data.isNoData) {
            const message = oneToManyFormContainerProps.deleteConfirmationMessage ??
                `Are you sure you want to delete this ${tableLabel ?? "record"}?`;
            setConfirmMessage(message);
            setIsConfirmOpen(true);
            setRecordToDelete(value.data);
        }
    };

    // Tracks dirty state when inline form property values change.
    const handleValueChange = (values: Record<string, unknown>): void => {
        setIsDirty(true);
        setUpdatedProperties(values);
    };

    // Saves properties from the dirty-flag save button using updated property keys.
    const handleSaveProperties = async (_event: React.MouseEvent<HTMLDivElement>) => {
        if (!updatedProperties || !properties) return;
        try {
            const parsedPgTable = Array.isArray(properties) ? properties : FnParseJsonSafely<{ PName: string }[], { PName: string }[]>(properties, { fallback: [] });
            const updatedKeys = Object.keys(updatedProperties);
            const pgData = buildPgDataFromUpdatedProperties(parsedPgTable, updatedKeys);
            const oldRow = selectedRecord ?? updatedProfile ?? {};
            const mergedRow = { ...oldRow, ...pgData };
            await saveMergedRow(mergedRow);
        } catch (error) {
            console.error("Failed to save properties", error);
        }
    };

    // Confirms and deletes the selected record via custom callback or local state update.
    const handleConfirmYesClick = async (): Promise<void> => {
        if (recordToDelete) {
            statusBarContext?.setIsLoading?.(true);
            statusBarContext?.setLoadingLabel?.("Loading...");
            try {
                if (oneToManyFormContainerProps.handleDeleteOneToManyRecord) {
                    const result = oneToManyFormContainerProps.handleDeleteOneToManyRecord(recordToDelete, tableName);
                    if (result instanceof Promise) {
                        await result;
                    }
                }
                setOneToManyGridData(prev => {
                    const updated = prev?.filter(row => {
                        if (recordToDelete.RecID && row.RecID) {
                            return row.RecID !== recordToDelete.RecID;
                        }
                        return row !== recordToDelete;
                    }) ?? [];
                    oneToManyFormContainerProps.onDataChange?.(updated, tableName);
                    return updated;
                });
                setSelectedRecord(undefined);
                setUpdatedProperties(undefined);
                setIsDirty(false);
                setIsConfirmOpen(false);
                setConfirmMessage('');
                setRecordToDelete(undefined);
            } finally {
                statusBarContext?.setIsLoading?.(false);
                statusBarContext?.setLoadingLabel?.(undefined);
            }
        }
    };

    // Saves properties from the form renderer onSave callback.
    const handleSavePropertyForm = async (formData: IFormData) => {
        if (!formData?.TableSections || !Object.keys(formData?.TableSections)?.length || !properties) return;
        try {
            const parsedPgTable = Array.isArray(properties) ? properties : FnParseJsonSafely<{ PName: string }[], { PName: string }[]>(properties, { fallback: [] });
            const pgTableUpdatedData = formData.TableSections[`${selectedRecord ? 'Edit' : 'Add'} ${tableLabel}`];
            if (!pgTableUpdatedData) return;
            const pgData = buildPgDataFromFormSection(parsedPgTable, pgTableUpdatedData);
            const oldRow = selectedRecord ?? updatedProfile ?? {};
            const mergedRow = { ...oldRow, ...pgData };
            await saveMergedRow(mergedRow);
        } catch (error) {
            console.error("Failed to save properties", error);
        }
    };

    // Clears the selected record and returns the form to add mode.
    const handleXClick = (): void => {
        setSelectedRecord(undefined);
    };

    // Dismisses the delete confirmation dialog without deleting.
    const handleConfirmNoClick = (): void => {
        setIsConfirmOpen(false);
        setConfirmMessage('');
        setRecordToDelete(undefined);
    };

    // Injects save and close handlers into form elements for the renderer.
    const renderedFormElements = useMemo(() => {
        if (!formElements) return undefined;
        return {
            ...formElements,
            onSave: handleSavePropertyForm,
            onX: selectedRecord ? handleXClick : undefined
        };
    }, [formElements, selectedRecord]);

    const saveImageData: IImage = {
        source: <Save24x24
            size={FnGetCssVariable('--image-size-1')}
            fill='none'
            strokeWidth={1} />,
        w: 'var(--image-size-2)',
        tooltip: "Save " + tableLabel,
        uniqueName: 'user-profile-isave',
        type: 'svg'
    };

    const isNoData = !oneToManyGridData || oneToManyGridData.length === 0;

    const gridRowData = useMemo(() => {
        if (isNoData) {
            return [{ RecID: "__no_data__", isNoData: true }];
        }
        return oneToManyGridData;
    }, [isNoData, oneToManyGridData]);

    const gridHeight = useMemo(() => {
        if (isNoData) return 70;
        const rowCount = oneToManyGridData?.length ?? 0;
        return Math.min(28 + rowCount * 26, 320);
    }, [isNoData, oneToManyGridData?.length]);

    if (loading) {
        return <div className="nz-wh-100 nz-d-flex-hv-left">Loading properties...</div>;
    }

    return (
        <div key={oneToManyFormContainerProps.uniqueName} className="nz-one-to-many-form-container">
            <div className="nz-one-to-many-add-edit-container">
                {oneToManyFormContainerProps.isAllowCustomHeader ? <div className="nz-sub-header">
                    <Label uniqueName={oneToManyFormContainerProps.uniqueName + "header"}
                        label={tableLabel} />
                    {isDirty && !oneToManyFormContainerProps.hideHeaderSaveButton && !oneToManyFormContainerProps.hideSaveButton && (
                        <div className={'nz-save-button'}>
                            <DirtyFlagImage uniqueName={oneToManyFormContainerProps.uniqueName + 'save-icon'}
                                isDirty={isDirty}
                                bgColor={"#FFFF99"}
                                image={saveImageData} w={'var(--node_height)'} h={'var(--node_height)'}
                                handleMouse={handleSaveProperties} />
                        </div>
                    )}
                </div> : <></>}
                {renderedFormElements && !oneToManyFormContainerProps.hideAddForm ? <FormElementsRenderer key={`${selectedRecord?.RecID ?? 'add'}-${formVersion}-${String(updatedProfile?.ShapeID ?? '')}`}
                    formElements={renderedFormElements}
                    onValuesChange={handleValueChange} /> : <></>}
            </div>
            <div
                className="nz-one-to-many-grid-wrapper"
                style={{ height: `${gridHeight}px`, minHeight: `${gridHeight}px` }}
            >
                {oneToManyGridColumns?.length ? <BasicGrid
                    uniqueName={oneToManyFormContainerProps.uniqueName + "one-to-many-grid"}
                    instanceName={oneToManyFormContainerProps.containerName ?? "PropertyPane"}
                    showGrid={true}
                    rowData={gridRowData}
                    containerName={oneToManyFormContainerProps.containerName ?? "PropertyPane"}
                    columnDefs={oneToManyGridColumns}
                    allowEditButton={oneToManyFormContainerProps.isReadOnly || isNoData ? false : true}
                    allowColumnResize={true}
                    hideCopyRowIcon={true}
                    hideRowKebabMenu={oneToManyFormContainerProps.isReadOnly || isNoData ? true : false}
                    featureId={oneToManyFormContainerProps.featureId}
                    allowDeleteButton={oneToManyFormContainerProps.isReadOnly || isNoData ? false : true}
                    handleMouseForEdit={handleEditRecord}
                    featureData={mainAppContext.featureRecords}
                    handleNodeMenuOnClick={oneToManyFormContainerProps.handleNodeMenuOnClick}
                    handleMouseForDelete={handleDeleteRecord}
                    rowClassRules={{
                        'nz-no-data-row': (params) => params.data?.isNoData === true
                    }}
                /> : oneToManyFormContainerProps.isReadOnly ? <div className="nz-wh-100 nz-d-flex-hv-left">{`No data found for ${tableLabel ?? "selected node menu"}`} </div> : <></>}
            </div>
            <YesNoFormContainer
                isOpen={isConfirmOpen}
                uniqueName={oneToManyFormContainerProps.uniqueName + "confirmbox"}
                message={confirmMessage}
                showOkButton={false}
                handleYesButtonClick={handleConfirmYesClick}
                handleNoButtonClick={handleConfirmNoClick} />
        </div>
    );
};

export { OneToManyFormContainer };
