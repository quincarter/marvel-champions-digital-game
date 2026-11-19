/**
 * The installed packs' first load at startup (`main.ts` starts it, not awaited). A shared replay's link waits on it
 * before opening the file (#858): a replay that uses a pack installed on this device would otherwise be refused as
 * missing that pack when the download beats the pack's validation. No timeout: the registry is only complete once the
 * load has settled, and a slow device still gets there (the loading screen stays up with Cancel meanwhile).
 */
let firstLoad: Promise<unknown> = Promise.resolve();
let settled = true;

/** `main.ts`: the first `refreshActivePacks()`. */
export function setStartupPacksLoad(load: Promise<unknown>): void {
  settled = false;
  firstLoad = load
    .catch(() => undefined)
    .finally(() => {
      settled = true;
    });
}

/** True while the first load is still running. */
export function startupPacksPending(): boolean {
  return !settled;
}

/** Settles once the installed packs have loaded, or failed to. */
export function startupPacksLoaded(): Promise<void> {
  return firstLoad.then(() => undefined);
}
