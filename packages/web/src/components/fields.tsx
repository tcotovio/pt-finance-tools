// Small form primitives, shared by the main panel and the advanced one.
// Each one owns its label/hint/error wiring so every field is described
// correctly to assistive technology without the callers repeating it.

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { deleteAcrossSeparator, groupAmount } from "../lib/number-input.js";

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
  /**
   * Group the thousands as the user types.
   *
   * Defaults on for euro fields, and deliberately so: "every amount groups its
   * thousands" is a rule of this form rather than a per-field decision, and
   * hanging it off the marker that already says a field is money means the
   * next one gets it without anyone remembering to ask. Pass it explicitly
   * only to override that.
   */
  grouped?: boolean;
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
  grouped,
}: TextFieldProps) {
  const groups = grouped ?? suffix === "€";
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);

  // The caret has to be put back after React has written the new value, or
  // the browser drops it at the end of the field on every keystroke — which
  // makes typing into the middle of a number impossible.
  useLayoutEffect(() => {
    const caret = caretRef.current;
    caretRef.current = null;
    if (caret !== null) inputRef.current?.setSelectionRange(caret, caret);
  });

  // Grouping the incoming value too, so a default or a restored form arrives
  // formatted rather than waiting for the first keystroke. It is idempotent.
  const shown = groups ? groupAmount(value, 0).value : value;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    if (!groups) {
      onChange(input.value);
      return;
    }

    const next = groupAmount(
      input.value,
      input.selectionStart ?? input.value.length,
    );

    if (next.value === value) {
      // React skips the re-render when the grouped text already matches what
      // is in state, which would leave the field showing the ungrouped text
      // the user just typed. Writing it back here keeps the two together.
      input.value = next.value;
      input.setSelectionRange(next.caret, next.caret);
      return;
    }

    caretRef.current = next.caret;
    onChange(next.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!groups) return;
    if (event.key !== "Backspace" && event.key !== "Delete") return;

    const input = event.currentTarget;
    const { selectionStart, selectionEnd } = input;
    // A real selection is deleted correctly by the browser; only a collapsed
    // caret sitting against a separator needs help.
    if (selectionStart === null || selectionStart !== selectionEnd) return;

    const next = deleteAcrossSeparator(
      input.value,
      selectionStart,
      event.key === "Backspace" ? "backward" : "forward",
    );
    if (!next) return;

    event.preventDefault();
    caretRef.current = next.caret;
    onChange(next.value);
  };

  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <div className={`input-shell${large ? " is-large" : ""}`}>
          <input
            id={id}
            ref={inputRef}
            className="num"
            type="text"
            inputMode={inputMode}
            autoComplete="off"
            value={shown}
            placeholder={placeholder}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
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

export interface ChoiceCard {
  value: string;
  label: string;
  /** What choosing this actually means, in the reader's terms. */
  description: string;
}

interface ChoiceCardsProps {
  name: string;
  legend: ReactNode;
  value: string;
  options: readonly ChoiceCard[];
  onChange: (value: string) => void;
}

/**
 * A radio group rendered as cards, each carrying a description.
 *
 * A {@link SegmentedField} for choices whose labels do not explain themselves.
 * "Posso comprar esta casa?" and "Qual é o meu limite?" fit in a segmented
 * control but only tell you which question is being asked, not which one is
 * yours — that depends on whether you have a price in mind or a pile of
 * savings, which is the thing the description says and the label cannot.
 *
 * Radios rather than buttons, so the group is one tab stop, arrow keys move
 * within it, and the choice is announced as a choice.
 */
export function ChoiceCards({
  name,
  legend,
  value,
  options,
  onChange,
}: ChoiceCardsProps) {
  return (
    <fieldset className="field-fieldset choice-cards">
      <legend className="visually-hidden">{legend}</legend>
      <div className="choice-card-row">
        {options.map((option) => (
          <label
            key={option.value}
            className={`choice-card${option.value === value ? " is-selected" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span className="choice-card-label">{option.label}</span>
            <span className="choice-card-description">
              {option.description}
            </span>
          </label>
        ))}
      </div>
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
