import { describe, expect, it } from "vitest";
import {
  reloadOnServiceWorkerUpdate,
  type ServiceWorkerLike,
  type ServiceWorkerRegistrationLike,
} from "./sw-update.js";

/** A stand-in for ServiceWorker, so no browser is needed. */
function fakeWorker(): ServiceWorkerLike & {
  transitionTo: (state: string) => void;
  listenerCount: () => number;
} {
  const listeners = new Set<() => void>();
  const worker = {
    state: "installing",
    addEventListener: (_t: "statechange", l: () => void) => void listeners.add(l),
    removeEventListener: (_t: "statechange", l: () => void) =>
      void listeners.delete(l),
    transitionTo: (state: string) => {
      worker.state = state;
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.size,
  };
  return worker;
}

/** A stand-in for ServiceWorkerRegistration. */
function fakeRegistration(installing: ServiceWorkerLike | null) {
  const listeners = new Set<() => void>();
  return {
    installing,
    addEventListener: (_t: "updatefound", l: () => void) => void listeners.add(l),
    removeEventListener: (_t: "updatefound", l: () => void) =>
      void listeners.delete(l),
    fireUpdateFound: () => listeners.forEach((l) => l()),
    listenerCount: () => listeners.size,
  } satisfies ServiceWorkerRegistrationLike & Record<string, unknown>;
}

describe("reloadOnServiceWorkerUpdate", () => {
  it("reloads once the new worker activates", () => {
    const worker = fakeWorker();
    const registration = fakeRegistration(worker);
    let reloads = 0;
    reloadOnServiceWorkerUpdate(registration, true, () => reloads++);

    registration.fireUpdateFound();
    worker.transitionTo("installed");
    expect(reloads).toBe(0); // waiting is not enough

    worker.transitionTo("activated");
    expect(reloads).toBe(1);
  });

  it("does not reload merely because a worker was found", () => {
    const worker = fakeWorker();
    const registration = fakeRegistration(worker);
    let reloads = 0;
    reloadOnServiceWorkerUpdate(registration, true, () => reloads++);

    registration.fireUpdateFound();
    expect(reloads).toBe(0);
  });

  it("does nothing on a first install", () => {
    // No controller when the page loaded means nothing was serving it yet:
    // the worker activating is the install, not an update, and reloading
    // would refresh the app the very first time anyone opened it.
    const worker = fakeWorker();
    const registration = fakeRegistration(worker);
    let reloads = 0;
    reloadOnServiceWorkerUpdate(registration, false, () => reloads++);

    registration.fireUpdateFound();
    worker.transitionTo("activated");
    expect(reloads).toBe(0);
    expect(registration.listenerCount()).toBe(0);
  });

  it("reloads at most once, whatever the worker does", () => {
    // The failure mode that would make this fix worse than the problem.
    const worker = fakeWorker();
    const registration = fakeRegistration(worker);
    let reloads = 0;
    reloadOnServiceWorkerUpdate(registration, true, () => reloads++);

    registration.fireUpdateFound();
    worker.transitionTo("activated");
    worker.transitionTo("activated");
    worker.transitionTo("activated");
    expect(reloads).toBe(1);
  });

  it("copes with updatefound arriving without an installing worker", () => {
    const registration = fakeRegistration(null);
    let reloads = 0;
    expect(() => {
      reloadOnServiceWorkerUpdate(registration, true, () => reloads++);
      registration.fireUpdateFound();
    }).not.toThrow();
    expect(reloads).toBe(0);
  });

  it("does nothing when there is no registration", () => {
    expect(() =>
      reloadOnServiceWorkerUpdate(undefined, true, () => {}),
    ).not.toThrow();
  });

  it("can be torn down, listeners and all", () => {
    const worker = fakeWorker();
    const registration = fakeRegistration(worker);
    let reloads = 0;
    const stop = reloadOnServiceWorkerUpdate(registration, true, () => reloads++);

    registration.fireUpdateFound();
    stop();
    worker.transitionTo("activated");

    expect(reloads).toBe(0);
    expect(registration.listenerCount()).toBe(0);
    expect(worker.listenerCount()).toBe(0);
  });

  it("returns a no-op teardown when it never subscribed", () => {
    expect(() =>
      reloadOnServiceWorkerUpdate(fakeRegistration(null), false, () => {})(),
    ).not.toThrow();
  });
});
