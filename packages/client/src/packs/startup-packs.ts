/**
 * The installed packs' first load at startup (`main.ts` starts it, not awaited). A shared replay's link waits on it
 * before opening the file (#858): a replay that uses a pack installed on this device would otherwise be refused as
 * missing that pack when the download beats the pack's validation.
 */
let firstLoad: Promise<unknown> = Promise.resolve();

/** `main.ts`: the first `refreshActivePacks()`. */
export function setStartupPacksLoad(load: Promise<unknown>): void {
  firstLoad = load.catch(() => undefined);
}

/** Settles once the installed packs have loaded (or failed to), or after `timeoutMs` at most. */
export function startupPacksLoaded(timeoutMs = 15_000): Promise<void> {
  return Promise.race([
    firstLoad.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
