"use client";

import { useId, useState } from "react";

import { Button } from "@stackmyth/button";
import { Calendar } from "@stackmyth/calendar";
import { FieldError } from "@stackmyth/field";
import { useFieldErrors, useFormContext } from "@stackmyth/form";
import { CalendarIcon } from "@stackmyth/icons";
import { Flex, Stack } from "@stackmyth/layout";
import { Popover, PopoverContent, PopoverTrigger } from "@stackmyth/popover";
import { TimePicker } from "@stackmyth/time-picker";

import { copy } from "@/config/copy";
import { EVENT_TIME_ZONE } from "@/lib/format";

/**
 * When the event starts, as Stackmyth date and time pickers.
 *
 * Replaces `<Input type="datetime-local">`, which rendered the browser's own
 * control — the one element in the app that ignored the design system.
 *
 * The date half is composed from `Popover` + `Calendar` rather than using
 * `DatePicker`, because `DatePicker`'s `locale` prop only formats its trigger
 * label and never reaches the `Calendar` inside, which is hardcoded to
 * `"en-US"`. A Spanish app would show an English calendar with no way to fix
 * it. See STACKMYTH-GAPS.md #12.
 *
 * The value reaches the form store as two wall-clock strings, `YYYY-MM-DD` and
 * `HH:mm`, which the server joins and interprets in America/Bogota.
 */

const LOCALE = "es-CO";

const LABEL_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

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

  const [date, setDate] = useState<Date | null>(() => fromDateInputValue(defaultDate));
  const [time, setTime] = useState<string | null>(defaultTime ?? null);
  const [open, setOpen] = useState(false);

  const form = useFormContext();

  // Both parts are separate fields in the store, each with its own message.
  form?.store.register(dateName);
  form?.store.register(timeName);

  const dateErrors = useFieldErrors(dateName);
  const timeErrors = useFieldErrors(timeName);

  function handleSelect(value: Date | { from: Date | undefined; to?: Date } | Date[] | undefined) {
    // mode="single" always yields a Date or undefined.
    const next = value instanceof Date ? value : null;
    setDate(next);
    form?.store.setValue(dateName, next ? toDateInputValue(next) : "");
    setOpen(false);
  }

  function handleTime(next: string | null) {
    setTime(next);
    form?.store.setValue(timeName, next ?? "");
  }

  return (
    <Stack gap="2">
      <Flex gap="2" wrap="wrap" align="center">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger>
            <Button
              type="button"
              id={dateId}
              variant="outline"
              size="lg"
              justify="start"
              aria-label={copy.createEvent.fields.startsAtDateLabel}
            >
              <CalendarIcon size={16} />
              {date ? LABEL_FORMAT.format(date) : copy.createEvent.fields.startsAtDatePlaceholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={6}>
            <Calendar
              mode="single"
              selected={date ?? undefined}
              onSelect={handleSelect}
              locale={LOCALE}
              // Colombia starts the week on Monday.
              weekStartsOn={1}
              timezone={EVENT_TIME_ZONE}
              fromDate={allowPast ? undefined : startOfToday()}
              showOutsideDays
            />
          </PopoverContent>
        </Popover>

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
