"use client";

import { useRef, useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Box, Flex, Grid, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Textarea } from "@stackmyth/textarea";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";
import { ControlledField, FormError } from "@/components/form-shell";
import {
  SHARE_MESSAGE_MAX_LENGTH,
  renderShareMessage,
  type SharePlaceholder,
} from "@/lib/share-message";

import { saveShareMessage, type MessagesState } from "./actions";

/**
 * The invitation an organizer sends, with the sample it will produce.
 *
 * **The preview is the point.** A template language is a small programming
 * language, and the way to keep it from feeling like one is to answer the only
 * question it raises — "what will they actually get?" — continuously, from the
 * same renderer the server uses. If the two ever disagree the preview is the
 * one that lies, so there is exactly one `renderShareMessage`.
 *
 * The placeholders are inserted by buttons rather than typed. `{link}` is
 * required and the other two are not, but all three are offered the same way:
 * a person who has just been told about `{title}` should not have to remember
 * whether it was `{titulo}` an hour later.
 */
export function MessageForm({
  /** What the account has stored, or null when it uses the app's message. */
  stored,
  /** The app's own message, in this reader's language. */
  fallback,
  /** A real event of theirs, so the preview is not lorem ipsum. */
  sample,
}: {
  stored: string | null;
  fallback: string;
  sample: Record<SharePlaceholder, string>;
}) {
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<MessagesState>({ errors: {} });
  const [message, setMessage] = useState(stored ?? fallback);
  const [isDefault, setIsDefault] = useState(stored === null);
  const field = useRef<HTMLTextAreaElement>(null);

  const placeholders: { token: SharePlaceholder; label: string }[] = [
    { token: "title", label: copy.messages.placeholderTitle },
    { token: "when", label: copy.messages.placeholderWhen },
    { token: "link", label: copy.messages.placeholderLink },
  ];

  /**
   * Drops a placeholder where the cursor is, not at the end.
   *
   * Falls back to appending when the field has never been focused — on a phone
   * that is the common case, since the buttons are reachable without ever
   * putting a caret in the text.
   */
  function insert(token: SharePlaceholder) {
    const element = field.current;
    const snippet = `{${token}}`;

    if (!element) {
      setMessage((current) => current + snippet);
      return;
    }

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    const next = `${element.value.slice(0, start)}${snippet}${element.value.slice(end)}`;

    setMessage(next);
    setIsDefault(false);

    // The caret goes after what was just inserted, so a second insert does not
    // land back inside the first.
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("message", message);

    startTransition(async () => {
      const result = await saveShareMessage({ errors: {} }, formData);
      setState(result);
      if (result.ok) {
        setIsDefault(false);
        toast.success(copy.messages.saved);
      }
    });
  }

  function restoreDefault() {
    const formData = new FormData();
    formData.set("reset", "1");

    startTransition(async () => {
      const result = await saveShareMessage({ errors: {} }, formData);
      setState(result);
      if (result.ok) {
        setMessage(fallback);
        setIsDefault(true);
        toast.success(copy.messages.saved);
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="5">
        <FormError message={state.errors._form} />

        {/*
          Editor left, preview right, from `lg`.

          The preview is the point of this screen — it is the only way to see
          what a real title and a real date do to the length of the message
          before it goes to anybody. Stacked, editing means scrolling away from
          the thing you are editing against, so every change is checked by
          memory. Side by side it is checked by looking.

          DOM order is unchanged, so a phone still gets field, placeholders,
          preview, save — in that order and with that spacing.
        */}
        <Grid columns={{ base: "1", lg: "1fr 1fr" }} gap="5" align="start">
          <Stack gap="5">
            <ControlledField
              label={copy.messages.invitationLabel}
              description={copy.messages.invitationHelp}
              error={state.errors.message}
              htmlFor="share-message"
            >
              <Textarea
                ref={field}
                id="share-message"
                name="message"
                fullWidth
                rows={4}
                maxLength={SHARE_MESSAGE_MAX_LENGTH}
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setIsDefault(false);
                }}
                status={state.errors.message ? "error" : "default"}
              />
            </ControlledField>

            <Stack gap="2">
              <Text variant="small" color="muted">
                {copy.messages.insertLabel}
              </Text>
              <Flex gap="2" wrap="wrap">
                {placeholders.map((placeholder) => (
                  <Button
                    key={placeholder.token}
                    type="button"
                    size="sm"
                    variant="outline"
                    shape="pill"
                    disabled={pending}
                    onClick={() => insert(placeholder.token)}
                  >
                    {placeholder.label}
                  </Button>
                ))}
              </Flex>
            </Stack>
          </Stack>

          {/*
            The sample uses one of their own events rather than invented text, so
            the length of a real title and a real date are visible before the
            message is sent to anybody.
          */}
          <Stack gap="2">
            <Text variant="small" color="muted">
              {copy.messages.previewLabel}
            </Text>
            <Card surface="outlined">
              <CardContent>
                <Text>{renderShareMessage(message, sample)}</Text>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Flex gap="3" wrap="wrap" align="center">
          <Button type="submit" size="lg" loading={pending} loadingLabel={copy.common.loading}>
            {copy.common.save}
          </Button>

          {/* Only offered when there is something to undo. */}
          {isDefault ? (
            <Box minWidth="0">
              <Text variant="small" color="muted">
                {copy.messages.usingDefault}
              </Text>
            </Box>
          ) : (
            <Button
              type="button"
              size="lg"
              variant="ghost"
              disabled={pending}
              onClick={restoreDefault}
            >
              {copy.messages.restore}
            </Button>
          )}
        </Flex>
      </Stack>
    </form>
  );
}
