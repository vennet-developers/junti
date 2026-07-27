"use client";

import { useId, type ReactNode } from "react";

import { Button } from "@stackmyth/button";
import { FormController, FormField } from "@stackmyth/form";
import { createZodResolver } from "@stackmyth/form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@stackmyth/field";
import { Box } from "@stackmyth/layout";
import { Spinner } from "@stackmyth/spinner";
import { Text } from "@stackmyth/text";

/**
 * Shared wiring between `@stackmyth/form` and this app's server actions.
 *
 * The split of responsibility:
 *
 * - **`FormController` + `createZodResolver` validate in the browser.** The
 *   user gets per-field feedback on blur instead of a server round trip.
 * - **The server action is still the authority.** It re-parses everything with
 *   the same rules; a client that skips or spoofs validation changes nothing.
 *
 * Progressive enhancement is not lost here, because it was never available:
 * `Select`, `DatePicker` and `TimePicker` are popover-based and cannot be
 * operated without JavaScript at all.
 */

export { FormController, FormField, createZodResolver };

/**
 * Renders a Stackmyth `Field` around a control.
 *
 * Two shapes, because HTML only allows one of them:
 *
 * - **`htmlFor` given** — a single labelable control (Input, Textarea). Uses a
 *   real `<label for>`.
 * - **`htmlFor` omitted** — a composite control (RadioGroup, the date+time
 *   pair). A `<label>` cannot name a group of elements: pointing `for` at a
 *   `<div>` is invalid and the browser reports "Incorrect use of
 *   `<label for=FORM_ELEMENT>`". Those get `role="group"` +
 *   `aria-labelledby` instead, which is how a screen reader announces a
 *   fieldset-style caption.
 */
export function ControlledField({
  label,
  description,
  error,
  htmlFor,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const groupLabelId = useId();
  const isGroup = htmlFor === undefined;

  const caption = isGroup ? (
    <Text id={groupLabelId} weight="medium" variant="small">
      {label}
    </Text>
  ) : (
    <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
  );

  return (
    <Field invalid={Boolean(error)}>
      {caption}
      {isGroup ? (
        <Box role="group" aria-labelledby={groupLabelId}>
          {children}
        </Box>
      ) : (
        children
      )}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : description ? (
        <FieldDescription>{description}</FieldDescription>
      ) : null}
    </Field>
  );
}

/**
 * Submit button with a pending state.
 *
 * `pending` is driven by the action transition rather than `useFormStatus`,
 * because the form now submits through `handleSubmit` rather than a native
 * `action`, so there is no form status to read.
 *
 * STACKMYTH-GAP: Button's own `loading` prop injects a hardcoded English
 * "Loading…" for screen readers with no override, so the pending state is
 * composed from a disabled Button plus a labelled Spinner.
 * See STACKMYTH-GAPS.md #4.
 */
export function SubmitButton({
  pending,
  idleLabel,
  pendingLabel,
  variant = "primary",
  size = "lg",
}: {
  pending: boolean;
  idleLabel: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
}) {
  return (
    <Button type="submit" size={size} variant={variant} fullWidth disabled={pending}>
      {pending ? <Spinner size="sm" label={pendingLabel} /> : null}
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}

/** Form-level error returned by the server action (rate limit, closed event…). */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text color="error" role="alert">
      {message}
    </Text>
  );
}
