/**
 * Records that merge instead of one side winning. `mc-unlocks` is the player's unlock picks and the points they spent,
 * and two devices that each opened things must not lose either set. The shape is `UnlockPrefs` (`progression/unlocks.ts`)
 * plus `version`; this module reads it as plain JSON so sync doesn't import the content pool.
 */

type Json = Record<string, unknown>;

/** The version `parseUnlockPrefs` trusts charges from (`UNLOCK_PREFS_VERSION`); other versions' charges are dropped. */
const CHARGES_VERSION = 2;

const parse = (raw: unknown): Json | null => {
  if (typeof raw !== "string") return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : null;
  } catch {
    return null;
  }
};

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

const union = (a: unknown, b: unknown): string[] => [...new Set([...strings(a), ...strings(b)])].sort();

function chargesOf(prefs: Json): { id: string; points: number }[] {
  if (prefs.version !== CHARGES_VERSION || !Array.isArray(prefs.charges)) return [];
  return prefs.charges.filter(
    (c): c is { id: string; points: number } =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as { id?: unknown }).id === "string" &&
      typeof (c as { points?: unknown }).points === "number",
  );
}

/**
 * Merges two stored `mc-unlocks` values (JSON text) so that neither player's picks or spending is lost:
 *  - `heroIds`, `campaignIds`, `scenarioIds`: the union (sorted), since each id is something a player opened.
 *  - `charges`: the union by id, taking the larger `points` for an id on both sides. Charges never shrink and spent
 *    points are earned-minus-charged, so keeping every charge never gives back points the player already used. Only
 *    charges stored at the current version count, as when the app loads them.
 *  - `unlockAll`, `officialPrintAndPlay`: on if either side has them on (the more open choice; both are free to turn off).
 *  - `version`: the current charges version, whichever sides had it; any other field comes from the first value, then
 *    the second.
 * Text that isn't a JSON object loses to text that is; two bad values give the first.
 */
export function mergeUnlocks(a: unknown, b: unknown): string {
  const left = parse(a);
  const right = parse(b);
  if (!left && !right) return typeof a === "string" ? a : "{}";
  if (!right) return a as string;
  if (!left) return b as string;
  const charges = new Map<string, number>();
  for (const charge of [...chargesOf(left), ...chargesOf(right)]) {
    charges.set(charge.id, Math.max(charges.get(charge.id) ?? 0, charge.points));
  }
  const merged: Json = {
    ...right,
    ...left,
    version: CHARGES_VERSION,
    unlockAll: left.unlockAll === true || right.unlockAll === true,
    heroIds: union(left.heroIds, right.heroIds),
    campaignIds: union(left.campaignIds, right.campaignIds),
    scenarioIds: union(left.scenarioIds, right.scenarioIds),
    charges: [...charges].sort(([x], [y]) => (x < y ? -1 : 1)).map(([id, points]) => ({ id, points })),
  };
  if (left.officialPrintAndPlay === true || right.officialPrintAndPlay === true) merged.officialPrintAndPlay = true;
  return JSON.stringify(merged);
}

/** Merge functions by logical key, for `SyncEngineDeps.mergers`. */
export const DEFAULT_MERGERS: Readonly<Record<string, (local: unknown, remote: unknown) => string>> = {
  "ls:mc-unlocks": mergeUnlocks,
};
