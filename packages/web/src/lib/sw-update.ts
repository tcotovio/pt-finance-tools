// Making a service-worker update visible in the same visit.
//
// The app precaches its own shell, which is what makes it work offline — and
// what makes a returning visitor load the PREVIOUS build while the new one
// downloads in the background. For most apps that lag is unremarkable. Here it
// is the sharpest edge in production: when the January tables land, or a
// mid-year despacho changes a parameter, a returning user would compute with
// last year's numbers while the source list cites the despacho they are not
// actually running.
//
// WHICH SIGNAL, AND WHY NOT THE OBVIOUS ONE.
//
// The intuitive hook is `controllerchange` on the container, and it does not
// work here — verified against a real build, not reasoned about. The generated
// worker calls `skipWaiting()` and `clientsClaim()`, so an update installs and
// activates on its own, but `clients.claim()` only dispatches
// `controllerchange` for clients that were NOT already controlled by that
// registration. A returning visitor is already controlled, so the swap is
// silent: the precache quietly fills with the new assets while the tab goes on
// running the old ones.
//
// The signal that does fire is the registration's own lifecycle —
// `updatefound`, then the new worker reaching `activated`. That is what this
// watches.
//
// Kept as pure functions over minimal interfaces so they can be tested without
// a DOM or a real service worker, like the rest of `lib/`.

/** The slice of `ServiceWorker` this needs. */
export interface ServiceWorkerLike {
  state: string;
  addEventListener(type: "statechange", listener: () => void): void;
  removeEventListener(type: "statechange", listener: () => void): void;
}

/** The slice of `ServiceWorkerRegistration` this needs. */
export interface ServiceWorkerRegistrationLike {
  /** The worker being installed, available when `updatefound` fires. */
  installing: ServiceWorkerLike | null;
  addEventListener(type: "updatefound", listener: () => void): void;
  removeEventListener(type: "updatefound", listener: () => void): void;
}

/**
 * Reload once a newly installed worker finishes activating.
 *
 * Two guards keep it from misfiring, and both matter:
 *
 *   * `hadController` must be true. A page with no controller is a first
 *     install — the worker activating there is the normal path, not an
 *     update, and reloading would refresh the app the first time anyone ever
 *     opened it;
 *   * the reload fires at most once per page, so repeated activations cannot
 *     put the tab into a refresh loop.
 *
 * Returns a teardown function; harmless to ignore outside tests.
 */
export function reloadOnServiceWorkerUpdate(
  registration: ServiceWorkerRegistrationLike | undefined,
  hadController: boolean,
  reload: () => void,
): () => void {
  if (!registration || !hadController) return () => {};

  let reloaded = false;
  let watched: ServiceWorkerLike | null = null;
  let onStateChange: (() => void) | null = null;

  const onUpdateFound = () => {
    const installing = registration.installing;
    if (!installing) return;

    watched = installing;
    onStateChange = () => {
      // "installed" only means the new worker is waiting; skipWaiting takes it
      // to "activated", which is the point at which the precache serves the
      // new build and a reload is guaranteed to pick it up.
      if (installing.state !== "activated" || reloaded) return;
      reloaded = true;
      reload();
    };
    installing.addEventListener("statechange", onStateChange);
  };

  registration.addEventListener("updatefound", onUpdateFound);

  return () => {
    registration.removeEventListener("updatefound", onUpdateFound);
    if (watched && onStateChange) {
      watched.removeEventListener("statechange", onStateChange);
    }
  };
}

/** Wire it to the real browser, when there is one. */
export function installServiceWorkerReload(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  const container = navigator.serviceWorker;
  // Captured before awaiting: whether this page was already being served by a
  // worker is what distinguishes an update from a first install.
  const hadController = !!container.controller;

  void container.ready.then((registration) => {
    reloadOnServiceWorkerUpdate(
      registration as unknown as ServiceWorkerRegistrationLike,
      hadController,
      () => window.location.reload(),
    );
  });
}
