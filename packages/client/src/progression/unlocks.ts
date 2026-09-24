/**
 * Progression: what a player has opened by playing, and what they opened by choice.
 *
 * **The unlock path.** Content is gated by release wave (`Cycle.id`), in release order. The Core Set is open from
 * the first launch; every later wave opens once the player has done what the wave before it asks of them:
 *
 * - **Wave 1** (Green Goblin, The Wrecking Crew and their heroes) — beat Rhino, the Core Set's first villain.
 * - **The Rise of Red Skull** — beat a Wave 1 villain. Wave 1 ships no campaign box, so its villains stand in.
 * - **The Galaxy's Most Wanted** — complete The Rise of Red Skull campaign.
 *
 * A later wave follows the last rule: complete the previous wave's campaign. Adding a wave to the app's pool means
 * adding its row to `UNLOCK_WAVES` (`unlocks.test.ts` fails until every pool wave has one).
 *
 * **Progress is derived, never stored twice.** A win is a `won` save in `mc-saves` (any difficulty, standalone or
 * a campaign issue) and a completed campaign is a `won` record in `mc-campaigns` — the same rows the results
 * history and the Saga shelf already read. There is no separate achievements store that could disagree with them.
 * Earned is earned: a wave whose gate was met stays open even if the win came while everything was unlocked.
 *
 * **Opting out.** `UnlockPrefs.unlockAll` opens everything; `UnlockPrefs.heroIds` opens single heroes (by
 * identity card id) for a player who wants a hero without the campaign ahead of them. A dev/QA session can open
 * everything for one page load with `?unlock=all` (`progression.ts`), which is never saved.
 *
 * Pure: no storage, no Phaser. `progression.ts` owns the cache and the saved preferences.
 */
import type { Scenario } from "@mc/content";
import { CARDS_BY_ID, POOL_HERO_SHELF_PACKS, POOL_STARTER_DECKS } from "../content/pool.js";

export type UnlockGate =
  | { readonly kind: "scenarioWin"; readonly scenarioIds: readonly string[]; readonly hint: string }
  | { readonly kind: "campaignWin"; readonly campaignId: string; readonly hint: string };

export interface UnlockWave {
  /** `Cycle.id`: what a scenario's pack and a hero's identity card carry. */
  readonly cycleId: string;
  readonly name: string;
  /** Null for the wave that is always open (the Core Set). */
  readonly gate: UnlockGate | null;
}

/** The unlock path, in release order. See the module comment for why each gate is what it is. */
export const UNLOCK_WAVES: readonly UnlockWave[] = [
  { cycleId: "core", name: "Core Set", gate: null },
  {
    cycleId: "wave1",
    name: "Wave 1",
    gate: { kind: "scenarioWin", scenarioIds: ["rhino"], hint: "Beat Rhino" },
  },
  {
    cycleId: "cycle1",
    name: "The Rise of Red Skull",
    gate: {
      kind: "scenarioWin",
      scenarioIds: ["risky-business", "mutagen-formula", "breakout"],
      hint: "Beat Green Goblin or the Wrecking Crew",
    },
  },
  {
    cycleId: "cycle3",
    name: "The Galaxy's Most Wanted",
    gate: { kind: "campaignWin", campaignId: "trors", hint: "Complete The Rise of Red Skull campaign" },
  },
];

/** Which campaign box belongs to which wave, for the Saga shelf. */
const CAMPAIGN_CYCLES: Readonly<Record<string, string>> = { trors: "cycle1", gmw: "cycle3" };

/** What the player has done, read from storage by `progressOf`. */
export interface UnlockProgress {
  readonly wonScenarioIds: readonly string[];
  readonly wonCampaignIds: readonly string[];
}

export const NO_PROGRESS: UnlockProgress = { wonScenarioIds: [], wonCampaignIds: [] };

/** What the player chose in Settings ▸ Unlocks. */
export interface UnlockPrefs {
  readonly unlockAll: boolean;
  /** Identity card ids opened one at a time. */
  readonly heroIds: readonly string[];
}

export const DEFAULT_UNLOCK_PREFS: UnlockPrefs = { unlockAll: false, heroIds: [] };

/**
 * Progress from the two storage listings. Only a `won` row counts: a loss, a concession or an abandoned run is
 * not a clear.
 */
export function progressOf(
  saves: readonly { readonly status: string; readonly config: { readonly scenarioId: string } }[],
  campaigns: readonly { readonly status: string; readonly campaignId: string }[],
): UnlockProgress {
  return {
    wonScenarioIds: [...new Set(saves.filter((s) => s.status === "won").map((s) => s.config.scenarioId))].sort(),
    wonCampaignIds: [...new Set(campaigns.filter((c) => c.status === "won").map((c) => c.campaignId))].sort(),
  };
}

export function sameProgress(a: UnlockProgress, b: UnlockProgress): boolean {
  return (
    a.wonScenarioIds.join("|") === b.wonScenarioIds.join("|") &&
    a.wonCampaignIds.join("|") === b.wonCampaignIds.join("|")
  );
}

const PACK_CYCLES: ReadonlyMap<string, string> = new Map(POOL_HERO_SHELF_PACKS.map((p) => [p.code, p.cycleId]));

/** The wave a scenario belongs to, by its pack. */
export const scenarioCycleOf = (scenario: Pick<Scenario, "packCode">): string | undefined =>
  PACK_CYCLES.get(scenario.packCode as string);

/** The wave a hero belongs to, by its identity card. */
export const heroCycleOf = (identityCardId: string): string | undefined =>
  CARDS_BY_ID.get(identityCardId)?.cycleId as string | undefined;

export interface UnlockHero {
  readonly identityCardId: string;
  readonly name: string;
  readonly cycleId: string;
}

/** Every hero in the pool, once each (Captain Marvel has two precons), in pool order. */
export const UNLOCK_HEROES: readonly UnlockHero[] = (() => {
  const seen = new Set<string>();
  const heroes: UnlockHero[] = [];
  for (const deck of POOL_STARTER_DECKS) {
    const id = deck.identityCardId as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const card = CARDS_BY_ID.get(id);
    heroes.push({ identityCardId: id, name: card?.name ?? id, cycleId: (card?.cycleId as string) ?? "" });
  }
  return heroes;
})();

export interface WaveStatus {
  readonly wave: UnlockWave;
  /** The gate is met (or there is none) — opened by play, not by a setting. */
  readonly earned: boolean;
  readonly unlocked: boolean;
  /** "Beat Rhino to unlock Wave 1" while locked; null once open. */
  readonly lockReason: string | null;
}

export interface UnlocksInput {
  readonly progress: UnlockProgress;
  readonly prefs: UnlockPrefs;
  /** `?unlock=all`: everything open for this page load, never saved. */
  readonly devUnlockAll?: boolean;
}

/** One answer to "may the player pick this?", for every screen that asks. */
export class Unlocks {
  readonly progress: UnlockProgress;
  readonly prefs: UnlockPrefs;
  readonly devUnlockAll: boolean;
  readonly #waves: ReadonlyMap<string, WaveStatus>;

  constructor(input: UnlocksInput) {
    this.progress = input.progress;
    this.prefs = input.prefs;
    this.devUnlockAll = input.devUnlockAll ?? false;
    const won = new Set(input.progress.wonScenarioIds);
    const completed = new Set(input.progress.wonCampaignIds);
    this.#waves = new Map(
      UNLOCK_WAVES.map((wave): [string, WaveStatus] => {
        const gate = wave.gate;
        const earned =
          gate === null ||
          (gate.kind === "scenarioWin" ? gate.scenarioIds.some((id) => won.has(id)) : completed.has(gate.campaignId));
        const unlocked = earned || this.everything;
        return [
          wave.cycleId,
          { wave, earned, unlocked, lockReason: unlocked || !gate ? null : `${gate.hint} to unlock ${wave.name}` },
        ];
      }),
    );
  }

  /** Everything is open, by the setting or the dev param. */
  get everything(): boolean {
    return this.prefs.unlockAll || this.devUnlockAll;
  }

  waves(): readonly WaveStatus[] {
    return [...this.#waves.values()];
  }

  /**
   * Null when the wave is open. A cycle missing from `UNLOCK_WAVES` is treated as open rather than silently hiding
   * content; `unlocks.test.ts` keeps every pool wave listed.
   */
  waveLock(cycleId: string | undefined): string | null {
    if (cycleId === undefined) return null;
    return this.#waves.get(cycleId)?.lockReason ?? null;
  }

  scenarioLock(scenario: Pick<Scenario, "packCode">): string | null {
    return this.waveLock(scenarioCycleOf(scenario));
  }

  /** Null when the hero may sit at a table: its wave is open, or it was opened on its own. */
  heroLock(identityCardId: string): string | null {
    if (this.prefs.heroIds.includes(identityCardId)) return null;
    return this.waveLock(heroCycleOf(identityCardId));
  }

  /** The hero's wave was opened by play (so a per-hero toggle has nothing to add). */
  heroEarned(identityCardId: string): boolean {
    const cycleId = heroCycleOf(identityCardId);
    return cycleId === undefined || (this.#waves.get(cycleId)?.earned ?? true);
  }

  /** Null when the campaign box's wave is open. The Saga's own volume order still applies on top of this. */
  campaignLock(campaignId: string): string | null {
    return this.waveLock(CAMPAIGN_CYCLES[campaignId]);
  }
}

/** `prefs` with one hero's own toggle flipped. */
export function toggleHeroPref(prefs: UnlockPrefs, identityCardId: string): UnlockPrefs {
  const heroIds = prefs.heroIds.includes(identityCardId)
    ? prefs.heroIds.filter((id) => id !== identityCardId)
    : [...prefs.heroIds, identityCardId];
  return { ...prefs, heroIds };
}

/** Reads a stored preferences value defensively: anything malformed falls back to the defaults. */
export function parseUnlockPrefs(raw: string | null): UnlockPrefs {
  if (!raw) return DEFAULT_UNLOCK_PREFS;
  try {
    const value = JSON.parse(raw) as { unlockAll?: unknown; heroIds?: unknown };
    return {
      unlockAll: value.unlockAll === true,
      heroIds: Array.isArray(value.heroIds) ? value.heroIds.filter((id): id is string => typeof id === "string") : [],
    };
  } catch {
    return DEFAULT_UNLOCK_PREFS;
  }
}

/** `?unlock=all` in a page's query string. */
export function devUnlockAllFrom(search: string): boolean {
  return new URLSearchParams(search).get("unlock") === "all";
}
