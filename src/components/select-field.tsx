"use client";

import { useId, useState } from "react";

import { useFormContext } from "@stackmyth/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@stackmyth/select";

/**
 * `Select` wired into the surrounding `FormController`.
 *
 * `Select` cannot submit natively — `SelectTrigger` is a `<button>` and
 * `SelectContent` portals out of the form, and there is no `name` prop
 * (STACKMYTH-GAPS.md #5). That used to require a mirrored
 * `<input type="hidden">`.
 *
 * It no longer does. Since the form submits through `FormController`'s
 * `handleSubmit`, the value only has to reach the form store, which
 * `store.setValue` does directly. No hidden field, no native FormData.
 */

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  /** Field name in the form store. */
  name: string;
  options: readonly SelectOption[];
  defaultValue: string;
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

  const form = useFormContext();

  // Make the field known to the store so it is validated and included in the
  // submitted values even when the user never touches it.
  form?.store.register(name);

  function handleChange(next: string) {
    setValue(next);
    form?.store.setValue(name, next);
    onValueChange?.(next);
  }

  return (
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
  );
}
