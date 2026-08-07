"use client";

import { useState, useSyncExternalStore } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@stackmyth/dialog";
import { DownloadIcon, XIcon } from "@stackmyth/icons";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import {
  deferredInstallPrompt,
  onInstallStateChange,
  promptInstall,
} from "@/lib/install-prompt-client";

/**
 * "Pon Junti en tu pantalla de inicio", said from the page, with a button.
 *
 * Two platforms, two honest offers. Chrome-family browsers hand the page a
 * real install prompt, so the button triggers the NATIVE dialog. iOS has no
 * API at all — Apple's decision, not ours — so there the button opens the
 * two manual steps, which is everything a page is allowed to do.
 *
 * Three silences, because this card must never become the draft banner Ivan
 * deleted for being noise: nothing while already installed (standalone),
 * nothing where no honest offer exists (Firefox, desktop Safari), and
 * nothing ever again once dismissed — the X writes localStorage, per device,
 * with no expiry. Somebody who said no is not asked twice; the offer stays
 * reachable by installing from the browser menu.
 */

const DISMISSED_KEY = "junti-install-dismissed";

type Offer = "none" | "native" | "ios";

/**
 * The whole decision as a store snapshot — no effect, no setState cascade.
 * `useSyncExternalStore` re-reads it when the captured prompt arrives or the
 * app gets installed, and the server snapshot is "none": the offer appears
 * after hydration on the devices it applies to, which is also the only
 * moment the browser facts it reads exist.
 */
function computeOffer(): Offer {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS's pre-standard flag, still the truth on installed Safari PWAs.
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
  if (standalone || localStorage.getItem(DISMISSED_KEY) !== null) return "none";

  if (deferredInstallPrompt() !== null) return "native";

  return /iP(hone|ad|od)/.test(navigator.userAgent) ? "ios" : "none";
}

export function InstallOffer() {
  const { copy } = useCopy();
  const strings = copy.install;

  const offer = useSyncExternalStore(onInstallStateChange, computeOffer, () => "none" as Offer);
  const [gone, setGone] = useState(false);

  if (offer === "none" || gone) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    setGone(true);
  }

  function install() {
    void promptInstall().then((outcome) => {
      // Accepted or dismissed, the native dialog was the answer; the card
      // has nothing left to offer this visit.
      if (outcome !== "unavailable") setGone(true);
    });
  }

  const action =
    offer === "native" ? (
      <Button type="button" size="sm" variant="secondary" onClick={install}>
        {strings.button}
      </Button>
    ) : (
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" size="sm" variant="secondary">
            {strings.howButton}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader bordered>
            <DialogTitle>{strings.iosTitle}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Stack gap="3">
              <Text>{strings.iosStep1}</Text>
              <Text>{strings.iosStep2}</Text>
              <Text variant="small" color="muted">
                {strings.iosNote}
              </Text>
            </Stack>
          </DialogBody>
        </DialogContent>
      </Dialog>
    );

  return (
    <Card surface="outlined">
      <CardContent>
        <Flex gap="3" align="center" justify="between" wrap="wrap">
          <Flex gap="3" align="center" minWidth="0">
            <Box flexShrink={0} color="var(--junti-naranja)">
              <DownloadIcon size={20} aria-hidden="true" />
            </Box>
            <Stack gap="0" minWidth="0">
              <Text variant="small" weight="semibold">
                {strings.title}
              </Text>
              <Text variant="small" color="muted">
                {strings.help}
              </Text>
            </Stack>
          </Flex>

          <Flex gap="2" align="center" flexShrink={0}>
            {action}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              iconOnly
              aria-label={strings.dismiss}
              onClick={dismiss}
            >
              <XIcon size={16} aria-hidden="true" />
            </Button>
          </Flex>
        </Flex>
      </CardContent>
    </Card>
  );
}
