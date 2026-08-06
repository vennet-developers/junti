"use client";

import { useState } from "react";

import { useFormContext } from "@stackmyth/form";
import { Flex, Stack } from "@stackmyth/layout";
import { RadioGroup, RadioGroupItem } from "@stackmyth/radio-group";
import { Text } from "@stackmyth/text";

/**
 * `RadioGroup` wired into the surrounding `FormController`.
 *
 * Unlike `Select`, `RadioGroup` does render real `<input type="radio" name>`
 * elements and would submit natively — but the form no longer submits natively,
 * so the value has to reach the form store like every other field.
 */

export interface RadioOption {
  value: string;
  label: string;
}

export interface RadioFieldProps {
  name: string;
  options: readonly RadioOption[];
  defaultValue: string;
  orientation?: "vertical" | "horizontal";
  /** Fires alongside the store write, for callers that react to the choice. */
  onValueChange?: (value: string) => void;
}

export function RadioField({
  name,
  options,
  defaultValue,
  orientation = "vertical",
  onValueChange,
}: RadioFieldProps) {
  const [value, setValue] = useState(defaultValue);
  const form = useFormContext();

  form?.store.register(name);

  function handleChange(next: string) {
    setValue(next);
    form?.store.setValue(name, next);
    onValueChange?.(next);
  }

  const items = options.map((option) => (
    <Flex key={option.value} as="label" gap={orientation === "vertical" ? "3" : "2"} align="center">
      <RadioGroupItem value={option.value} />
      <Text as="span">{option.label}</Text>
    </Flex>
  ));

  return (
    <RadioGroup name={name} value={value} onValueChange={handleChange} orientation={orientation}>
      {orientation === "vertical" ? (
        <Stack gap="3">{items}</Stack>
      ) : (
        <Flex gap="4" wrap="wrap">
          {items}
        </Flex>
      )}
    </RadioGroup>
  );
}
