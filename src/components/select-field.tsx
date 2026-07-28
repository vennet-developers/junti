"use client";

import { useEffect, useId, useState } from "react";

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

  /**
   * Follow `defaultValue` when it actually changes.
   *
   * Normally it never does. It earns its place for a value only knowable after
   * hydration: the create form resolves the organizer's real timezone once the
   * browser is available, and without this the control would go on displaying
   * the server-rendered one while the STORE held a third thing — the form would
   * submit Bogotá while the screen said Madrid.
   *
   * `set-state-in-effect` is disabled deliberately. The rule is right that
   * derived state usually belongs in render, but this also has to push the
   * value into `@stackmyth/form`'s external store, and mutating that during
   * render is worse than the setState the rule objects to.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(defaultValue);
    form?.store.setValue(name, defaultValue);
    // `form` is a fresh object each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue, name]);

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
