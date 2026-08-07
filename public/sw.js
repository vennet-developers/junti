/*
  Junti's service worker: push delivery, and DELIBERATELY nothing else.

  There is no fetch handler here, and its absence is a decision — a worker
  that never intercepts requests cannot serve yesterday's page, which is the
  entire stale-cache bug family declined at the door. Every navigation still
  goes to the network exactly as before this file existed. If offline support
  is ever wanted, it arrives as its own decision with its own invalidation
  story, not as a side effect of wanting push.

  The payload shape is `pushPayload`'s in src/domain/notifications.ts:
  { title, body, url } — the event as title, the inbox's own sentence as
  body, the drawer's own deep link as destination. One source, two channels.
*/

self.addEventListener("install", () => {
  // A new worker takes over without waiting for every tab to close; with no
  // fetch handler there is no cache handoff for skipWaiting to corrupt.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return; // Not ours; showing "[object Object]" at somebody helps no one.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Junti", {
      body: payload.body ?? "",
      icon: "/brand/junti-favicon-192.png",
      badge: "/brand/junti-maskable-192.png",
      data: { url: payload.url ?? "/my-events" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/my-events";

  event.waitUntil(
    (async () => {
      // An open Junti tab is focused and pointed at the destination rather
      // than spawning a second copy of the app beside it.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
