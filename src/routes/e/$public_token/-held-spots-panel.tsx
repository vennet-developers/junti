import { useState, useTransition } from "react";
import { useRouter } from "@tanstack/react-router";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";

import { releaseSpotFn } from "./-fns";

export interface HeldSpotView {
  id: string;
  name: string;
  claimToken: string;
  claimed: boolean;
}

/**
 * The seats you already answer for: hand out the links, watch them get
 * claimed, release the ones nobody will use.
 *
 * Management only — HOLDING seats moved into the answer form itself, where
 * "voy con dos más" belongs, and the native <select>/<input> the add-section
 * carried died with the move (the unbreakable rule collects again).
 *
 * The links are surfaced HERE and only here — the sponsor's own panel — never
 * on the shared roster, because a claim token is a seat and the roster crosses
 * the wire to everyone with the event link. Copy-to-clipboard rather than a
 * share sheet: the destination is WhatsApp and the sponsor knows which chat.
 */
export function HeldSpotsPanel({
  publicToken,
  spots,
}: {
  publicToken: string;
  spots: HeldSpotView[];
}) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The pressed row's button spins; its siblings only lock.
  const [releasing, setReleasing] = useState<string | null>(null);

  const strings = copy.heldSpots;

  function release(spotId: string) {
    setReleasing(spotId);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("publicToken", publicToken);
      formData.set("spotId", spotId);
      const result = await releaseSpotFn({ data: formData });

      if (result.errors._form) {
        toast.error(result.errors._form);
      } else {
        await router.invalidate();
        toast.success(strings.released);
      }
      setReleasing(null);
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
                          loading={releasing === spot.id}
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

        </Stack>
      </CardContent>
    </Card>
  );
}
