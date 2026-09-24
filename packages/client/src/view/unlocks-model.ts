/**
 * Settings ▸ Unlocks: the "Unlock everything" switch, then every wave in release order with what opens it and one
 * row per hero in it. Pure, so the wording and each hero's toggle state are tested without a canvas; the scene
 * (`scenes/unlocks.ts`) only draws these rows and saves what a tap changes.
 */
import {
  UNLOCK_HEROES,
  toggleHeroPref,
  type UnlockHero,
  type UnlockPrefs,
  type Unlocks,
} from "../progression/unlocks.js";

export interface UnlockAllRow {
  readonly title: string;
  readonly detail: string;
  readonly on: boolean;
}

/**
 * - `earned`: the hero's wave was opened by play; there is nothing to toggle.
 * - `all`: everything is unlocked, so a single hero's switch has no effect until that's off again.
 * - `on` / `off`: the hero's own switch.
 */
export type HeroUnlockState = "earned" | "all" | "on" | "off";

export type UnlockListRow =
  | {
      readonly kind: "wave";
      readonly id: string;
      readonly title: string;
      readonly status: string;
      readonly open: boolean;
    }
  | {
      readonly kind: "hero";
      readonly id: string;
      readonly identityCardId: string;
      readonly title: string;
      readonly state: HeroUnlockState;
    };

export function unlockAllRowOf(unlocks: Unlocks): UnlockAllRow {
  const detail = unlocks.devUnlockAll
    ? "Open for this session by the ?unlock=all link, whatever this switch says."
    : "Opens every wave, hero, scenario and campaign without playing through them. What you've earned stays earned.";
  return { title: "Unlock everything", detail, on: unlocks.prefs.unlockAll };
}

export function unlockListRowsOf(unlocks: Unlocks, heroes: readonly UnlockHero[] = UNLOCK_HEROES): UnlockListRow[] {
  const rows: UnlockListRow[] = [];
  for (const status of unlocks.waves()) {
    const waveHeroes = heroes.filter((hero) => hero.cycleId === status.wave.cycleId);
    rows.push({
      kind: "wave",
      id: `wave:${status.wave.cycleId}`,
      title: status.wave.name,
      status: status.earned ? "Unlocked" : status.unlocked ? "Unlocked by setting" : (status.lockReason ?? "Locked"),
      open: status.unlocked,
    });
    for (const hero of waveHeroes) {
      rows.push({
        kind: "hero",
        id: `hero:${hero.identityCardId}`,
        identityCardId: hero.identityCardId,
        title: hero.name,
        state: heroStateOf(unlocks, hero.identityCardId),
      });
    }
  }
  return rows;
}

function heroStateOf(unlocks: Unlocks, identityCardId: string): HeroUnlockState {
  if (unlocks.heroEarned(identityCardId)) return "earned";
  if (unlocks.everything) return "all";
  return unlocks.prefs.heroIds.includes(identityCardId) ? "on" : "off";
}

/** Only a hero's own `on`/`off` switch does anything when tapped. */
export const heroToggleable = (state: HeroUnlockState): boolean => state === "on" || state === "off";

export const heroStateLabel = (state: HeroUnlockState): string =>
  state === "earned" ? "EARNED" : state === "all" || state === "on" ? "ON" : "OFF";

/** The prefs a tap on `row` produces, or null when the row has no switch. */
export function prefsAfterTap(prefs: UnlockPrefs, row: UnlockListRow): UnlockPrefs | null {
  if (row.kind !== "hero" || !heroToggleable(row.state)) return null;
  return toggleHeroPref(prefs, row.identityCardId);
}

/** The one line Settings shows under "Unlocks". */
export function unlocksSummaryOf(unlocks: Unlocks): string {
  if (unlocks.everything) return "Everything is unlocked.";
  const waves = unlocks.waves();
  const open = waves.filter((w) => w.unlocked).length;
  const next = waves.find((w) => !w.unlocked);
  const heroes = unlocks.prefs.heroIds.filter((id) => !unlocks.heroEarned(id)).length;
  const parts = [`${open} of ${waves.length} waves open`];
  if (heroes > 0) parts.push(`${heroes} hero${heroes === 1 ? "" : "es"} unlocked by hand`);
  return `${parts.join(" · ")}.${next?.lockReason ? ` Next: ${next.lockReason}.` : ""}`;
}
