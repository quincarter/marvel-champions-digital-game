/**
 * MC27 p. 6's optional deck-customization freeze: "(Optional) Once a player starts an expert campaign, they
 * cannot add, remove, or change the aspect and/or basic cards in their deck …" — unlike MC16's mandatory freeze
 * (`campaign-deck-edit-model.ts`'s `DECK_FREEZE_POLICY`), this is a group's own house-rule-shaped choice, made once
 * per seat, not a fact the printed campaign log has anywhere to record (MC27's log sheet, `docs/campaign-modes/
 * log-sheets/mc27_sinister_motives_campaignlog.pdf`, has no box for it). It is not campaign *state* in the sense
 * `@mc/engine`'s `CampaignLog` models — no scenario setup or victory instruction ever reads it, it only gates which
 * screen `scenes/campaign/deck-edit.ts` shows — so it is stored client-side, next to the run rather than inside it,
 * the same way `#listScroll`-style UI state never enters a `CampaignLog`.
 *
 * `localStorage` where it exists, keyed by run + seat: a choice is per player, not per campaign, since MC27 p. 6
 * phrases it as "a player" opting in, and different seats may choose differently. A module-level `Map` is the
 * fallback everywhere `localStorage` is unavailable or throws (Safari private mode, some webviews, this module's
 * own Vitest run, which has no DOM) — session-lived only there, which is an acceptable floor for an optional,
 * re-offerable choice with no rules consequence of its own.
 */

const KEY_PREFIX = "mc-deck-freeze-optin:";
const fallback = new Map<string, string>();

function keyFor(runId: string, seatNumber: number): string {
  return `${KEY_PREFIX}${runId}:${seatNumber}`;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    // A sandboxed embed can throw merely reading `localStorage` (Safari private mode, some webviews).
    return null;
  }
}

/** Whether this seat has already opted into MC27 p. 6's freeze for this run. */
export function isDeckFreezeOptedIn(runId: string, seatNumber: number): boolean {
  const key = keyFor(runId, seatNumber);
  const store = storage();
  return (store ? store.getItem(key) : fallback.get(key)) === "1";
}

/** Records the seat's one-way choice to freeze (MC27 p. 6 never describes an "un-freeze"). */
export function optIntoDeckFreeze(runId: string, seatNumber: number): void {
  const key = keyFor(runId, seatNumber);
  const store = storage();
  if (store) store.setItem(key, "1");
  else fallback.set(key, "1");
}
