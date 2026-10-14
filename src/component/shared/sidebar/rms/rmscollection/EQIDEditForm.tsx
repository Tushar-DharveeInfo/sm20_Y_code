import { useEffect, useMemo, useRef, useState } from 'react';
import { IEQIDEditFormProfile } from './IEqid';
import type { IEqidDoc } from '@n20a/libfsdb';
import {
  EditTextControl,
  TextControl,
  ComboBoxControl,
  CheckedListBoxControl,
  SpinControl,
  TrueFalseControl,
  DateControl,
} from '@n20a/libform';
import type { IOptionItem } from '@n20a/libform';
import '@n20a/libform/style.css';
import styles from './EQIDEditForm.module.css';

import { EQTypeVsSections } from './EQTypeVsSections';
import EQTypeSectionVsFields from './EQTypeSectionVsFields.json';
import EqidComboOptions from './EqidComboOptions';

// IEqidDoc / IEQIDEditFormProfile are declared globally in IEqidDoc.ts (no imports/exports in that file).

const INPUTMASK_KEY = 'inputmask {start;end;step}';

interface IEqidFieldDef {
  section: string;
  Field: string;
  Formcontrol: string;
  [INPUTMASK_KEY]: string;
}

const fieldDefs = EQTypeSectionVsFields as IEqidFieldDef[];
const eqTypeSections = EQTypeVsSections as Record<string, string[]>;

export function getEqtypes(): string[] {
  return Object.keys(EQTypeVsSections);
}


// Parses "{start;end;step}" (step optional) into numeric bounds for SpinControl.
function parseInputMask(mask: string): { start?: number; end?: number; step?: number } {
  if (!mask) return {};
  const parts = mask
    .replace(/[{}]/g, '')
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map(Number);
  return { start: parts[0], end: parts[1], step: parts[2] };
}

function toOptions(values: string[]): IOptionItem[] {
  return values.map((v) => ({ value: v, label: v }));
}

// Finds the EqidComboOptions key that best matches fieldName: the longest key whose name
// includes the fieldName (case-insensitive). DeviceAttribute is special-cased to "Attributes".
function getComboOptions(fieldName: string): string[] {
  if (fieldName === 'DeviceAttribute') {
    return EqidComboOptions.Attributes ?? [];
  }
  const lowerField = fieldName.toLowerCase();
  let bestKey: string | undefined;
  for (const key of Object.keys(EqidComboOptions)) {
    if (key.toLowerCase().includes(lowerField)) {
      if (!bestKey || key.length > bestKey.length) {
        bestKey = key;
      }
    }
  }
  return bestKey ? (EqidComboOptions as Record<string, string[]>)[bestKey] : [];
}

function dateToInputValue(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
/*
   getMfg?: ()=>string[];
   getEQIDAllocated?: (mfgkey: string)=>string[];
   getEqType?: ()=>string[];
   getMfgProdLine?: (mfgkey: string)=>string[];
   getMfgEqType?: (eqtype: string)=>string[];
   SaveEQID?:(updatedEQIDRecord: IEqidDoc)=>void;
*/

export function EQIDEditForm({ EQIDRecord, getAcronym, getMfg, getEQIDAllocated, getEqType, getMfgProdLine, getMfgEqType, SaveEQID }: IEQIDEditFormProfile) {
  const [renderSections, setRenderSections] = useState<string[]>(['All']);
  const [localRecord, setLocalRecord] = useState<IEqidDoc>({ ...EQIDRecord });
  const prevEQIDRecordRef = useRef<IEqidDoc>(EQIDRecord);

  useEffect(() => {
    setRenderSections(eqTypeSections[EQIDRecord.Eqtype] ?? ['All']);
  }, [EQIDRecord.Eqtype]);

  useEffect(() => {
    const prevEQIDRecord = prevEQIDRecordRef.current;
    if (prevEQIDRecord === EQIDRecord) return;

    // Merge in only the fields whose incoming value actually changed, so in-progress
    // edits to other fields in localRecord are never wiped out.
    const prevRec = prevEQIDRecord as unknown as Record<string, unknown>;
    const nextRec = EQIDRecord as unknown as Record<string, unknown>;
    const changedFields: Record<string, unknown> = {};
    for (const key of Object.keys(nextRec)) {
      if (nextRec[key] !== prevRec[key]) {
        changedFields[key] = nextRec[key];
      }
    }

    prevEQIDRecordRef.current = EQIDRecord;
    if (Object.keys(changedFields).length > 0) {
      setLocalRecord((prev) => ({ ...prev, ...changedFields }) as IEqidDoc);
    }
  }, [EQIDRecord]);

  const sectionsInOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const def of fieldDefs) {
      if (!seen.has(def.section)) {
        seen.add(def.section);
        order.push(def.section);
      }
    }
    return order;
  }, []);

  const sectionsToRender = renderSections.includes('All')
    ? sectionsInOrder
    : sectionsInOrder.filter((s) => renderSections.includes(s));

  const updateField = (field: string, value: unknown) => {
    setLocalRecord((prev) => ({ ...prev, [field]: value }) as IEqidDoc);
  };

  const handleSave = () => {
    SaveEQID?.(localRecord);
  };

  const renderField = (def: IEqidFieldDef) => {
    const field = def.Field;
    const value = (localRecord as unknown as Record<string, unknown>)[field];
    const controlType = def.Formcontrol.toLowerCase();

    switch (controlType) {
      case 'edittext':
        return (
          <EditTextControl
            key={field}
            id={field}
            name={field}
            label={field}
            value={value != null ? String(value) : ''}
            onChange={(v) => updateField(field, v)}
          />
        );

      case 'text':
        return (
          <TextControl
            key={field}
            id={field}
            name={field}
            label={field}
            value={value != null ? String(value) : ''}
          />
        );

      case 'combo': {
        const acronym = (localRecord as unknown as Record<string, unknown>).Acronym;
        const acronymKey = acronym != null ? String(acronym) : '';
        const manufacturer = (localRecord as unknown as Record<string, unknown>).Manufacturer;
        const mfgKey = manufacturer != null ? String(manufacturer) : '';
        const eqtype = (localRecord as unknown as Record<string, unknown>).Eqtype;
        const eqtypeKey = eqtype != null ? String(eqtype) : '';

        let options: IOptionItem[];
        switch (field) {
          case 'Acronym':
            options = toOptions(getAcronym?.() ?? []);
            break;

          case 'Manufacturer':
            options = toOptions(getMfg?.() ?? []);
            break;
          case 'EQID':
            options = toOptions(getEQIDAllocated?.(mfgKey) ?? []);
            break;
          case 'MfgProdLine':
            options = toOptions(getMfgProdLine?.(mfgKey) ?? []);
            break;
          case 'Eqtype':
            options = toOptions(getEqType?.() ?? []);
            break;
          case 'MfgEqtype':
            options = toOptions(getMfgEqType?.(eqtypeKey) ?? []);
            break;
          default:
            options = toOptions(getComboOptions(field));
            break;
        }

        return (
          <ComboBoxControl
            key={field}
            id={field}
            name={field}
            label={field}
            options={options}
            value={value != null ? (value as string) : ''}
            onChange={(v) => updateField(field, v)}
          />
        );
      }

      case 'checkedcombo': {
        const options = toOptions(getComboOptions(field));
        return (
          <CheckedListBoxControl
            key={field}
            id={field}
            name={field}
            label={field}
            options={options}
            value={value != null ? String(value) : ''}
            onChange={(v) => updateField(field, v)}
          />
        );
      }

      case 'checkbox':
        return (
          <TrueFalseControl
            key={field}
            id={field}
            name={field}
            label={field}
            value={Boolean(value)}
            onChange={(v) => updateField(field, v)}
          />
        );

      case 'spin': {
        const { start, end, step } = parseInputMask(def[INPUTMASK_KEY]);
        return (
          <SpinControl
            key={field}
            id={field}
            name={field}
            label={field}
            start={start ?? 0}
            end={end ?? 100}
            step={step}
            value={value != null ? Number(value) : (start ?? 0)}
            onChange={(v) => updateField(field, v)}
          />
        );
      }

      case 'autodate':
        return (
          <DateControl
            key={field}
            id={field}
            name={field}
            label={field}
            value={dateToInputValue(value)}
            onChange={(v) => updateField(field, v ? new Date(v) : undefined)}
          />
        );

      default:
        return (
          <EditTextControl
            key={field}
            id={field}
            name={field}
            label={field}
            value={value != null ? String(value) : ''}
            onChange={(v) => updateField(field, v)}
          />
        );
    }
  };

  return (
    <div className={styles.root}>
      {sectionsToRender.map((section) => (
        <fieldset key={section} className={styles.section}>
          <legend className={styles.legend}>{section}</legend>
          <div className={styles.fields}>
            {fieldDefs.filter((def) => def.section === section).map(renderField)}
          </div>
        </fieldset>
      ))}
      <div className={styles.actions}>
        <button type="button" className={styles.saveButton} onClick={handleSave}>Save</button>
      </div>
    </div>
  );
}

export default EQIDEditForm;
