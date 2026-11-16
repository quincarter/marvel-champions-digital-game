/**
 * The player's two custom content settings (issue #734), held here so the pool's shelves (`content/pool.ts`) and the
 * unlock path (`progression/unlocks.ts`) read them without importing the session. `session.ts` sets them at start and
 * on every settings change, as it does the card language (`art/art-source.ts`'s `setArtLanguage`).
 *
 * - **Placement**: where installed packs' heroes and scenarios sit. "bottom" (the default, as before) is one "Custom
 *   packs" shelf after the last wave; "top" is that shelf first; "mixed" puts each pack beside the release wave its
 *   `pack.json` names (`wave`), and a pack that names none on the bottom shelf.
 * - **Unlocked**: on (the default), every pack's content is open. Off, each pack unlocks the way its creator chose
 *   (`pack.json`'s `unlock`: open, champion points, or wins).
 */

export type CustomPlacement = "bottom" | "top" | "mixed";

export const CUSTOM_PLACEMENT_VALUES: readonly CustomPlacement[] = ["bottom", "top", "mixed"];

export interface CustomContentPrefs {
  readonly placement: CustomPlacement;
  readonly unlocked: boolean;
}

export const DEFAULT_CUSTOM_CONTENT_PREFS: CustomContentPrefs = { placement: "bottom", unlocked: true };

let prefs: CustomContentPrefs = DEFAULT_CUSTOM_CONTENT_PREFS;

export function customContentPrefsNow(): CustomContentPrefs {
  return prefs;
}

/** Sets them; true when anything changed. */
export function setCustomContentPrefs(next: CustomContentPrefs): boolean {
  if (next.placement === prefs.placement && next.unlocked === prefs.unlocked) return false;
  prefs = { placement: next.placement, unlocked: next.unlocked };
  return true;
}
