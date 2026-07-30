"use client";

import { useId, useState } from "react";

import { DatePicker } from "@stackmyth/date-picker";
import { FieldError } from "@stackmyth/field";
import { useFieldErrors, useFormContext } from "@stackmyth/form";
import { Flex, Stack } from "@stackmyth/layout";
import { TimePicker } from "@stackmyth/time-picker";

import { useCopy } from "./copy-provider";

/**
 * When the event starts, as Stackmyth date and time pickers.
 *
 * Replaces `<Input type="datetime-local">`, which rendered the browser's own
 * control — the one element in the app that ignored the design system.
 *
 * Both halves are the library's own field components. The date used to be
 * hand-composed from `Popover` + `Calendar`, because `DatePicker` formatted its
 * trigger with the given `locale` but hardcoded the `Calendar` inside to
 * `"en-US"` — a Spanish app got an English calendar with no way to fix it
 * (STACKMYTH-GAPS.md #12). That is fixed at source: the locale reaches the
 * calendar, so the composition is gone.
 *
 * Using it also settles the appearance. The hand-rolled trigger was a
 * `Button variant="outline"`, and an outline button is transparent by
 * definition — so the one control on the form that should have looked like a
 * field showed the page through it. A field component paints a field surface,
 * with no override needed anywhere.
 *
 * The value reaches the form store as two wall-clock strings, `YYYY-MM-DD` and
 * `HH:mm`, which the server joins and interprets in the event's own timezone.
 *
 * Both halves are wall-clock and stay that way here. The picker never converts
 * to an instant, so it needs the reader's LANGUAGE — to name the months — but
 * not the event's timezone: "the 14th at 8 p.m." is the same two strings
 * whichever zone eventually gives them meaning.
 */

function toDateInputValue(date: Date): string {
  // Local getters, never toISOString(). The calendar builds local midnight, so
  // converting to UTC would submit the *previous* calendar day for anyone east
  // of Bogota — the event would silently move. What we want is the day the
  // user tapped. See STACKMYTH-GAPS.md #11.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  // Local time so the calendar highlights the right cell.
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** How the chosen day reads on the trigger: "vie, 31 ago 2026". */
const LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
};

/** Midnight today, local — the earliest selectable day when creating an event. */
function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export interface DateTimeFieldProps {
  /** Field name for the date part. Stored as `YYYY-MM-DD`. */
  dateName: string;
  /** Field name for the time part. Stored as `HH:mm`. */
  timeName: string;
  /** `YYYY-MM-DD`, when editing an existing event. */
  defaultDate?: string;
  /** `HH:mm`, when editing an existing event. */
  defaultTime?: string;
  /** Wired to the surrounding FieldLabel's htmlFor. */
  id?: string;
  /** Allow past dates. The edit form needs this; creating does not. */
  allowPast?: boolean;
}

export function DateTimeField({
  dateName,
  timeName,
  defaultDate,
  defaultTime,
  id,
  allowPast = false,
}: DateTimeFieldProps) {
  const generatedId = useId();
  const dateId = id ?? generatedId;

  const { copy } = useCopy();
  const intlLocale = copy.intlLocale;

  const [date, setDate] = useState<Date | null>(() => fromDateInputValue(defaultDate));
  const [time, setTime] = useState<string | null>(defaultTime ?? null);

  const form = useFormContext();

  // Both parts are separate fields in the store, each with its own message.
  form?.store.register(dateName);
  form?.store.register(timeName);

  const dateErrors = useFieldErrors(dateName);
  const timeErrors = useFieldErrors(timeName);

  function handleSelect(next: Date | null) {
    setDate(next);
    // Still two wall-clock strings in the store. The server joins them and
    // reads them in the event's own zone — see toDateInputValue.
    form?.store.setValue(dateName, next ? toDateInputValue(next) : "");
  }

  function handleTime(next: string | null) {
    setTime(next);
    form?.store.setValue(timeName, next ?? "");
  }

  return (
    <Stack gap="2">
      <Flex gap="2" wrap="wrap" align="center">
        <DatePicker
          id={dateId}
          size="lg"
          value={date}
          onValueChange={handleSelect}
          locale={intlLocale}
          /* Same shape the hand-rolled trigger formatted itself. */
          formatOptions={LABEL_FORMAT}
          placeholder={copy.createEvent.fields.startsAtDatePlaceholder}
          aria-label={copy.createEvent.fields.startsAtDateLabel}
          /* Monday, in both languages this ships in: Spanish-speaking
             countries and the UK start the week there. */
          weekStartsOn={1}
          fromDate={allowPast ? undefined : startOfToday()}
          showOutsideDays
          clearable={false}
        />

        <TimePicker
          value={time}
          onValueChange={handleTime}
          size="lg"
          hourCycle="12h"
          minuteStep={5}
          clearable={false}
          placeholder={copy.createEvent.fields.startsAtTimePlaceholder}
          aria-label={copy.createEvent.fields.startsAtTimeLabel}
        />
      </Flex>

      {dateErrors[0] ? <FieldError>{dateErrors[0]}</FieldError> : null}
      {timeErrors[0] ? <FieldError>{timeErrors[0]}</FieldError> : null}
    </Stack>
  );
}
