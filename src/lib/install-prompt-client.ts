/**
 * The one listener for `beforeinstallprompt`, registered at module scope of
 * a file the ROOT imports — deliberately not inside the component that shows
 * the offer.
 *
 * The event fires ONCE, shortly after load, and only Chrome-family browsers
 * fire it at all. A listener registered when a route chunk happens to mount
 * loses the race on any client-side navigation; this module rides in the
 * root's own bundle, so it is listening before the browser has anything to
 * say. The captured event is held here and handed to whoever renders the
 * button later.
 *
 * `appinstalled` is tracked from the same spot for the same reason: it fires
 * once, wherever the user happens to be, and it is the number that says
 * whether the whole PWA investment converts.
 */

/** The Chrome-family event; not in lib.dom because it never left vendor space. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Chrome's own mini-infobar yields to the page's offer.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    for (const listener of listeners) listener();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    for (const listener of listeners) listener();
    void import("@/lib/track-client").then(({ trackClient }) =>
      trackClient("app_installed", {}),
    );
  });
}

/** The captured event, or null where the browser never offered one. */
export function deferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

/** Re-render hook: fires when the prompt arrives or the app gets installed. */
export function onInstallStateChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Shows the native dialog. Consumes the event — it is single-use by spec. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const prompt = deferred;
  if (!prompt) return "unavailable";
  deferred = null;

  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice.outcome;
}
