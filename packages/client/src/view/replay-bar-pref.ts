/**
 * Where a phone's replay bar sits, bottom or top of the screen (issue #693): a few bytes in `localStorage`
 * (`mc-replay-bar-top`), read when a replay opens, so the choice holds from one replay to the next. Where
 * `localStorage` is missing or throws (Vitest, a locked-down webview) the bottom holds for the session.
 */
const KEY = "mc-replay-bar-top";

type Store = Pick<Storage, "getItem" | "setItem">;

export function readBarOnTop(storage: Store | undefined = globalThis.localStorage): boolean {
  try {
    return storage?.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeBarOnTop(onTop: boolean, storage: Store | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(KEY, onTop ? "1" : "0");
  } catch {
    // Private mode or a full quota: the choice still holds for this replay.
  }
}
