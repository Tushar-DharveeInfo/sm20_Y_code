
import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { CheckedListBoxControl, TextControl } from '@n20a/libform';
import type { IOptionItem } from '@n20a/libform';
import libformStyles from '@n20a/libform/style.css?inline';
import Styles from './Style.json';

export interface IStyleRecord {
  Style: string;
  StyleAcronym: string;
  Description: string;
  PrintOrder: string;
}

const styleAcronyms = Styles
  .map((record) => record.StyleAcronym)
  .sort((left, right) => right.length - left.length);

export function getStyleOptions(eqid: string): string[] {
  return Styles.flatMap((record) => {
    const base = `${eqid}${record.StyleAcronym}`;
    const recordString = JSON.stringify({style: record.Style, styleAcronym: record.StyleAcronym, description: record.Description});

    return [
      `${base}:H - ${recordString}`,
      `${base}:V - ${recordString}`,
    ];
  });
}

export function getCompactStyleValue(styleOption: string): string {
  const delimiterIndex = styleOption.indexOf(' - ');
  const rawValue = delimiterIndex !== -1 ? styleOption.substring(0, delimiterIndex) : styleOption;

  return rawValue.replace(/:'([HV])'$/, ':$1');
}

export function getSelectedStyles(styleOptions: string[]): string[] {
  return styleOptions.map(getCompactStyleValue);
}

export function deriveEqidFromStyles(initialStyles: string[]): string {
  for (const initialStyle of initialStyles) {
    for (const styleAcronym of styleAcronyms) {
      for (const orientation of ['H', 'V'] as const) {
        const suffix = `${styleAcronym}:${orientation}`;
        if (initialStyle.endsWith(suffix)) {
          return initialStyle.slice(0, -suffix.length);
        }
      }
    }
  }

  return '';
}

export interface IStyles {
  initialStyles: string[];
  onSave: (styles: string[]) => void;
}

const formStyle = { display: 'grid', gap: '1rem', maxWidth: '64rem', padding: '1rem' } as const;
const statusStyle = { color: '#b45309', fontSize: '0.875rem' } as const;
const componentStyles = `
  .eqid-styles-actions {
    display: flex;
    width: 100%;
    justify-content: flex-start;
  }

  .eqid-styles-save {
    width: auto;
    max-width: 100%;
    min-width: 5.5rem;
    min-height: 2.75rem;
    padding: 0.625rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background-color: #ffffff;
    cursor: pointer;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }

  .eqid-styles-save:hover:not(:disabled) {
    border-color: #2563eb;
    background-color: #f8fafc;
  }

  .eqid-styles-save:focus-visible {
    outline: none;
    border-color: #2563eb;
  }

  .eqid-styles-save:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

function toOptions(values: string[]): IOptionItem[] {
  return values.map((value) => ({ value, label: value }));
}

function parseCheckedValues(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function getInitialCheckedValue(styleOptions: string[], initialStyles: string[]): string {
  const selectedValues = new Set(initialStyles);

  return JSON.stringify(
    styleOptions.filter((styleOption) => selectedValues.has(getCompactStyleValue(styleOption))),
  );
}

export function EQIDStyles({ initialStyles, onSave }: IStyles) {
  const eqid = useMemo(() => deriveEqidFromStyles(initialStyles), [initialStyles]);
  const styleOptions = useMemo(() => (eqid ? getStyleOptions(eqid) : []), [eqid]);
  const optionItems = useMemo(() => toOptions(styleOptions), [styleOptions]);
  const [checkedValue, setCheckedValue] = useState<string>(() =>
    getInitialCheckedValue(styleOptions, initialStyles),
  );

  useEffect(() => {
    setCheckedValue(getInitialCheckedValue(styleOptions, initialStyles));
  }, [initialStyles, styleOptions]);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    const selectedOptionValues = new Set(parseCheckedValues(checkedValue));
    const selectedStyles = getSelectedStyles(
      styleOptions.filter((styleOption) => selectedOptionValues.has(styleOption)),
    );

    onSave(selectedStyles);
  };

  return (
    <>
      <style>{libformStyles}</style>
      <style>{componentStyles}</style>
      <form onSubmit={handleSubmit} style={formStyle}>
        <TextControl id="eqid-styles-eqid" name="eqid" label="EQID" value={eqid} />
        <CheckedListBoxControl
          id="eqid-styles-options"
          name="styles"
          label="Styles"
          options={optionItems}
          value={checkedValue}
          onChange={(value) => setCheckedValue(value)}
          disabled={!eqid}
        />
        {!eqid ? (
          <div role="status" style={statusStyle}>
            Unable to derive an EQID from initialStyles.
          </div>
        ) : null}
        <div className="eqid-styles-actions">
          <button type="submit" disabled={!eqid} className="eqid-styles-save">
            Save
          </button>
        </div>
      </form>
    </>
  );
}

export default EQIDStyles;
