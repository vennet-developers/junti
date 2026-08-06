import { useState, useTransition } from "react";
import { useRouter } from "@tanstack/react-router";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";

import { holdSpotsFn, releaseSpotFn } from "./-fns";

export interface HeldSpotView {
  id: string;
  name: string;
  claimToken: string;
  claimed: boolean;
}

/**
 * "Trae gente": hold seats, hand out the links, watch them get claimed.
 *
 * The links are surfaced HERE and only here — the sponsor's own panel — never
 * on the shared roster, because a claim token is a seat and the roster crosses
 * the wire to everyone with the event link. Copy-to-clipboard rather than a
 * share sheet: the destination is WhatsApp and the sponsor knows which chat.
 */
export function HeldSpotsPanel({
  publicToken,
  spots,
  maxHeldSpots,
}: {
  publicToken: string;
  spots: HeldSpotView[];
  maxHeldSpots: number;
}) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [count, setCount] = useState(1);
  const [names, setNames] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);

  const strings = copy.heldSpots;
  const unclaimed = spots.filter((spot) => !spot.claimed);
  const remaining = Math.max(0, maxHeldSpots - unclaimed.length);

  function setCountClamped(next: number) {
    const clamped = Math.min(Math.max(1, next), remaining || 1);
    setCount(clamped);
    setNames((current) =>
      Array.from({ length: clamped }, (_, index) => current[index] ?? ""),
    );
  }

  function hold() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("publicToken", publicToken);
      formData.set("count", String(count));
      names.forEach((name, index) => formData.set(`name-${index}`, name));

      const result = await holdSpotsFn({ data: formData });
      if (result.errors._form) {
        setError(result.errors._form);
      } else {
        setError(null);
        setCountClamped(1);
        setNames([""]);
        await router.invalidate();
      }
    });
  }

  function release(spotId: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("publicToken", publicToken);
      formData.set("spotId", spotId);
      await releaseSpotFn({ data: formData });
      await router.invalidate();
    });
  }

  async function copyLink(claimToken: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/c/${claimToken}`);
    toast.success(strings.copied);
  }

  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="4">
          <Stack gap="1">
            <Text weight="semibold">{strings.heading}</Text>
            <Text variant="small" color="muted">
              {strings.help}
            </Text>
          </Stack>

          {spots.length > 0 ? (
            <Stack gap="2">
              {spots.map((spot) => (
                <Flex key={spot.id} gap="3" align="center" justify="between" wrap="wrap">
                  <Text variant="small" weight="medium">
                    {spot.name}
                  </Text>
                  <Flex gap="2" align="center">
                    {spot.claimed ? (
                      <Text variant="small" color="muted">
                        {copy.claim.yours}
                      </Text>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => void copyLink(spot.claimToken)}
                        >
                          {strings.copyLink}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => release(spot.id)}
                        >
                          {strings.release}
                        </Button>
                      </>
                    )}
                  </Flex>
                </Flex>
              ))}
              <Text variant="small" color="muted">
                {strings.shareHint}
              </Text>
            </Stack>
          ) : null}

          {remaining > 0 ? (
            <Stack gap="3">
              <Flex gap="3" align="center" wrap="wrap">
                <label htmlFor="hold-count">
                  <Text as="span" variant="small" weight="medium">
                    {strings.countLabel}
                  </Text>
                </label>
                <select
                  id="hold-count"
                  className="sm-input sm-input--md"
                  value={count}
                  onChange={(e) => setCountClamped(Number(e.target.value))}
                >
                  {Array.from({ length: remaining }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </Flex>

              {names.map((name, index) => (
                <input
                  key={index}
                  className="sm-input sm-input--md"
                  value={name}
                  maxLength={40}
                  placeholder={strings.namePlaceholder}
                  aria-label={strings.nameLabel(index + 1)}
                  onChange={(e) =>
                    setNames((current) =>
                      current.map((n, i) => (i === index ? e.target.value : n)),
                    )
                  }
                />
              ))}

              {error ? (
                <Text variant="small" color="error">
                  {error}
                </Text>
              ) : null}

              <Button type="button" size="md" onClick={hold} disabled={pending}>
                {pending ? strings.submitting : strings.submit}
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
