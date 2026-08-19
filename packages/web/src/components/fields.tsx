// Small form primitives, shared by the main panel and the advanced one.
// Each one owns its label/hint/error wiring so every field is described
// correctly to assistive technology without the callers repeating it.

import type { ReactNode } from "react";

interface FieldShellProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children(describedBy)}
      {error ? (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  placeholder?: string;
  hint?: ReactNode;
  error?: string;
  large?: boolean;
  inputMode?: "decimal" | "numeric";
}

export function TextField({
  id,
  label,
  value,
  onChange,
  suffix,
  placeholder,
  hint,
  error,
  large,
  inputMode = "decimal",
}: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <div className={`input-shell${large ? " is-large" : ""}`}>
          <input
            id={id}
            className="num"
            type="text"
            inputMode={inputMode}
            autoComplete="off"
            value={value}
            placeholder={placeholder}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
          {suffix ? (
            <span className="input-suffix" aria-hidden="true">
              {suffix}
            </span>
          ) : null}
        </div>
      )}
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  id: string;
  label: ReactNode;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string;
}

export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  hint,
  error,
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <div className="input-shell is-select">
          <select
            id={id}
            value={value}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value)}
          >
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </FieldShell>
  );
}

interface SegmentedFieldProps {
  name: string;
  legend: ReactNode;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  hint?: ReactNode;
}

/** A radio group rendered as a segmented control — for 2–3 short choices. */
export function SegmentedField({
  name,
  legend,
  value,
  options,
  onChange,
  hint,
}: SegmentedFieldProps) {
  return (
    <fieldset className="field field-fieldset">
      <legend className="field-label">{legend}</legend>
      <div className="segmented">
        {options.map((option) => (
          <label
            key={option.value}
            className={`segment${option.value === value ? " is-selected" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {hint ? <p className="field-hint">{hint}</p> : null}
    </fieldset>
  );
}

interface ToggleFieldProps {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
}

export function ToggleField({
  id,
  label,
  checked,
  onChange,
  hint,
}: ToggleFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="field toggle-field">
      <label className="toggle" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="toggle-track" aria-hidden="true" />
        <span className="toggle-label">{label}</span>
      </label>
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
