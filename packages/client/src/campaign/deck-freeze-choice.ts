/**
 * MC27 p. 6's optional deck-customization freeze: "(Optional) Once a player starts an expert campaign, they
 * cannot add, remove, or change the aspect and/or basic cards in their deck …" — unlike MC16's mandatory freeze
 * (`campaign-deck-edit-model.ts`'s `DECK_FREEZE_POLICY`), this is a group's own house-rule-shaped choice, made once
 * per seat, not a fact the printed campaign log has anywhere to record (MC27's log sheet, `docs/campaign-modes/
 * log-sheets/mc27_sinister_motives_campaignlog.pdf`, has no box for it).
 *
 * **Lives in `CampaignRecord.deckFreezeOptIns` now** (`campaign-service.ts`'s `isDeckFreezeOptedIn`/
 * `optIntoDeckFreeze`), so it travels with the run's own storage/sync like every other seat choice, rather than
 * being stranded on the device it was made on. This module is the one-time bridge for a save made before that
 * move: `legacyDeckFreezeOptIn` reads the old per-run/per-seat `localStorage` key a pre-migration build wrote,
 * and `clearLegacyDeckFreezeOptIn` removes it once `campaign-service.ts`'s `migrateLegacyDeckFreezeOptIn` has
 * folded it into the record — so a second load never re-reads (and re-migrates) the same stale key.
 *
 * `localStorage` where it exists, keyed by run + seat; a module-level `Map` is the fallback everywhere
 * `localStorage` is unavailable or throws (Safari private mode, some webviews, this module's own Vitest run,
 * which has no DOM).
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

/** Whether a pre-migration build recorded this seat's opt-in to `localStorage`, for `migrateLegacyDeckFreezeOptIn` to fold in once. */
export function legacyDeckFreezeOptIn(runId: string, seatNumber: number): boolean {
  const key = keyFor(runId, seatNumber);
  const store = storage();
  return (store ? store.getItem(key) : fallback.get(key)) === "1";
}

/** Removes the legacy key once its choice has been folded into the record, so it is never re-migrated. */
export function clearLegacyDeckFreezeOptIn(runId: string, seatNumber: number): void {
  const key = keyFor(runId, seatNumber);
  const store = storage();
  if (store) store.removeItem(key);
  else fallback.delete(key);
}

/** Test-only: writes the legacy key directly, to exercise the migration path without depending on a build that predates the move. */
export function writeLegacyDeckFreezeOptInForTest(runId: string, seatNumber: number): void {
  const key = keyFor(runId, seatNumber);
  const store = storage();
  if (store) store.setItem(key, "1");
  else fallback.set(key, "1");
}
