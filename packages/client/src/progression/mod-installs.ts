/**
 * The mods this player has ever installed (docs/custom-content-packs.md §11.12), for the "install a mod" achievements.
 * An uninstalled pack leaves nothing in the saves, so each install is noted once and kept ("ever"), like the deck
 * feats (`deck-feats.ts`). Stored as `{ <pack id>: <pack kind> }` in `localStorage` (`mc-mod-installs`); it syncs
 * with the other progress keys. Plain data in, plain data out: it never touches base progression or points.
 */
import { notifySaveDataChanged } from "../sync/save-data-changed.js";

export type ModInstalls = Readonly<Record<string, string>>;

export const NO_MOD_INSTALLS: ModInstalls = {};

const KEY = "mc-mod-installs";
/** A sane ceiling on what a hand-edited or synced record may hold. */
const MAX_ENTRIES = 500;

/** What has been noted so far; empty when storage is unreadable or the record is not the expected shape. */
export function readModInstalls(): ModInstalls {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NO_MOD_INSTALLS;
    const out: Record<string, string> = {};
    for (const [id, kind] of Object.entries(parsed as Record<string, unknown>)) {
      if (Object.keys(out).length >= MAX_ENTRIES) break;
      if (typeof kind === "string") out[id] = kind;
    }
    return out;
  } catch {
    return NO_MOD_INSTALLS;
  }
}

/**
 * Notes the installed packs `{ id, kind }` for good. True when any was new (and the record was written). A pack
 * already noted keeps its first kind.
 */
export function noteModInstalls(installed: readonly { readonly id: string; readonly kind: string }[]): boolean {
  const have = readModInstalls();
  const fresh = installed.filter((pack) => !Object.hasOwn(have, pack.id));
  if (fresh.length === 0) return false;
  try {
    const next: Record<string, string> = { ...have };
    for (const pack of fresh) next[pack.id] = pack.kind;
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
    notifySaveDataChanged("progress");
  } catch {
    // Private mode or a full quota: they are noted again on the next read of the pack store.
  }
  return true;
}
