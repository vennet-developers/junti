"use client";

import { useId, useState } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@stackmyth/select";

// STACKMYTH-GAP: @stackmyth/select cannot participate in native form
// submission. SelectTrigger renders <button type="button"> and SelectContent
// portals to document.body, so the chosen value never reaches FormData and no
// `name` prop exists to opt in. RadioGroup in the same stack does render real
// inputs and submits correctly, so this is an inconsistency rather than a
// design stance. This wrapper mirrors the value into a sibling hidden input.
// See STACKMYTH-GAPS.md #5.

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  /** Form field name. This is what the hidden input carries. */
  name: string;
  options: readonly SelectOption[];
  defaultValue: string;
  /** Wired to FieldLabel's htmlFor by the caller. */
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Notified on change so a parent can show or hide dependent fields. */
  onValueChange?: (value: string) => void;
}

export function SelectField({
  name,
  options,
  defaultValue,
  id,
  placeholder,
  disabled,
  onValueChange,
}: SelectFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [value, setValue] = useState(defaultValue);

  function handleChange(next: string) {
    setValue(next);
    onValueChange?.(next);
  }

  return (
    <>
      <Select value={value} onValueChange={handleChange} disabled={disabled} id={controlId}>
        <SelectTrigger fullWidth size="lg">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value} />
    </>
  );
}
