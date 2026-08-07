"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { BellIcon } from "@stackmyth/icons";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";
import {
  deletePushSubscriptionFn,
  getPushConfigFn,
  savePushSubscriptionFn,
} from "@/lib/push-fns";

/**
 * Enabling push on THIS device, from inside the notification panel.
 *
 * Lives where the notifications live — someone reading their inbox is the
 * person for whom "also reach me when this is closed" makes sense — and the
 * permission prompt fires only from the button, never on load: a permission
 * asked before it means anything is a permission denied forever.
 *
 * Four states, each honest about the device it is on:
 * - unsupported (no Push API): renders nothing, because an offer that cannot
 *   be accepted is clutter;
 * - iPhone in the browser: a hint instead of a button — iOS only allows push
 *   for INSTALLED web apps, and the honest step one is installing;
 * - permission denied: a muted note, because the browser will not re-ask and
 *   a button that silently does nothing reads as broken;
 * - otherwise: the toggle.
 */

type PushState =
  | "checking"
  | "unsupported"
  | "ios-install-first"
  | "denied"
  | "off"
  | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function PushToggle() {
  const { copy } = useCopy();
  const [state, setState] = useState<PushState>("checking");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;

    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
        const standalone = window.matchMedia("(display-mode: standalone)").matches;
        if (live) setState(isIos && !standalone ? "ios-install-first" : "unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (live) setState("denied");
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (live) setState(subscription ? "on" : "off");
    })().catch(() => {
      if (live) setState("unsupported");
    });

    return () => {
      live = false;
    };
  }, []);

  function enable() {
    startTransition(async () => {
      try {
        const { publicKey } = await getPushConfigFn();
        if (!publicKey) {
          toast.error(copy.notifications.push.failed);
          return;
        }

        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });

        const json = subscription.toJSON();
        const saved = await savePushSubscriptionFn({
          data: {
            endpoint: subscription.endpoint,
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
          },
        });

        if (!saved.ok) {
          await subscription.unsubscribe();
          toast.error(copy.notifications.push.failed);
          return;
        }

        setState("on");
        toast.success(copy.notifications.push.enabled);
      } catch {
        // A closed permission prompt lands here too; the state tells which.
        setState(Notification.permission === "denied" ? "denied" : "off");
        if (Notification.permission !== "denied") {
          toast.error(copy.notifications.push.failed);
        }
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await deletePushSubscriptionFn({ data: { endpoint: subscription.endpoint } });
          await subscription.unsubscribe();
        }
        setState("off");
        toast.success(copy.notifications.push.disabled);
      } catch {
        toast.error(copy.notifications.push.failed);
      }
    });
  }

  if (state === "checking" || state === "unsupported") return null;

  if (state === "ios-install-first") {
    return (
      <Text variant="small" color="muted">
        {copy.notifications.push.iosInstallFirst}
      </Text>
    );
  }

  if (state === "denied") {
    return (
      <Text variant="small" color="muted">
        {copy.notifications.push.denied}
      </Text>
    );
  }

  return (
    <Stack gap="2">
      <Button
        type="button"
        variant={state === "on" ? "ghost" : "secondary"}
        size="sm"
        fullWidth
        disabled={pending}
        onClick={state === "on" ? disable : enable}
      >
        <Flex gap="2" align="center">
          <BellIcon size={16} aria-hidden="true" />
          {state === "on" ? copy.notifications.push.disable : copy.notifications.push.enable}
        </Flex>
      </Button>
      {state === "off" ? (
        <Text variant="small" color="muted">
          {copy.notifications.push.help}
        </Text>
      ) : null}
    </Stack>
  );
}
