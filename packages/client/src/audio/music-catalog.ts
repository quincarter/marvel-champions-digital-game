/**
 * The game's soundtrack, found by convention in the repo's `music/` folder
 * (see `music/README.md`):
 *
 *   music/title/<track>.<ext>                      Title screen and menus
 *   music/gameplay/<track>.<ext>                   Fallback battle track for any game
 *   music/scenarios/<scenarioId>/battle.<ext>      Scenario-specific battle track
 *   music/scenarios/<scenarioId>/villain-wins.<ext>Game Over: villain wins
 *   music/scenarios/<scenarioId>/villain-loses.<ext>Game Over: villain loses (players win)
 *   music/campaigns/<campaignId>/battle.<ext>      Campaign battle fallback
 *   music/campaigns/<campaignId>/interlude.<ext>   Between campaign scenarios
 *   music/packs/<packCode>/battle.<ext>            Pack battle fallback
 *   music/outcomes/defeat.<ext>                    Game Over defeat fallback & concessions
 *   music/outcomes/victory.<ext>                   Game Over victory fallback
 *
 * Suffixes for variants (e.g. `battle-2.mp3`) allow multiple tracks per slot,
 * picking one at random.
 *
 * Formats: mp3, ogg, m4a.
 *
 * Pure functions over a path → URL map so everything is testable without Web Audio.
 */

export const MUSIC_EXTENSIONS = ["mp3", "ogg", "m4a"] as const;

export interface Track {
  /** Stable audio key, derived from the file's path under `music/`. */
  readonly key: string;
  readonly url: string;
}

const SCENARIO_SLOTS = ["villain-wins", "villain-loses", "battle"] as const;
const CAMPAIGN_SLOTS = ["interlude", "battle"] as const;
const PACK_SLOTS = ["battle"] as const;
const OUTCOME_SLOTS = ["defeat", "victory"] as const;

export type ScenarioMusicSlot = (typeof SCENARIO_SLOTS)[number];
export type CampaignMusicSlot = (typeof CAMPAIGN_SLOTS)[number];
export type PackMusicSlot = (typeof PACK_SLOTS)[number];
export type OutcomeMusicSlot = (typeof OUTCOME_SLOTS)[number];

export interface MusicCatalog {
  readonly title: readonly Track[];
  readonly gameplay: readonly Track[];
  readonly scenarios: ReadonlyMap<string, Readonly<Record<ScenarioMusicSlot, readonly Track[]>>>;
  readonly campaigns: ReadonlyMap<string, Readonly<Record<CampaignMusicSlot, readonly Track[]>>>;
  readonly packs: ReadonlyMap<string, Readonly<Record<PackMusicSlot, readonly Track[]>>>;
  readonly outcomes: Readonly<Record<OutcomeMusicSlot, readonly Track[]>>;
  /** Files under `music/` whose path or name fits no slot — reported for detection of typos. */
  readonly unrecognized: readonly string[];
}

/** The slot a file stem names: the slot itself, or the slot plus a `-variant` suffix. */
function slotOf<S extends string>(stem: string, slots: readonly S[]): S | null {
  return slots.find((slot) => stem === slot || stem.startsWith(`${slot}-`)) ?? null;
}

/**
 * Builds the music catalog from a path → URL map.
 * Only the part of each path from `music/` on is read.
 */
export function parseMusicCatalog(files: Readonly<Record<string, string>>): MusicCatalog {
  const title: Track[] = [];
  const gameplay: Track[] = [];
  const scenarios = new Map<string, Record<ScenarioMusicSlot, Track[]>>();
  const campaigns = new Map<string, Record<CampaignMusicSlot, Track[]>>();
  const packs = new Map<string, Record<PackMusicSlot, Track[]>>();
  const outcomes: Record<OutcomeMusicSlot, Track[]> = { defeat: [], victory: [] };
  const unrecognized: string[] = [];

  for (const fullPath of Object.keys(files).sort()) {
    const underMusic = fullPath.slice(fullPath.lastIndexOf("music/") + "music/".length);
    const parts = underMusic.split("/");
    const file = parts[parts.length - 1] ?? "";
    const stem = file.slice(0, file.lastIndexOf("."));
    const track: Track = { key: `music:${underMusic}`, url: files[fullPath]! };

    if (parts[0] === "title" && parts.length === 2) {
      title.push(track);
    } else if (parts[0] === "gameplay" && parts.length === 2) {
      gameplay.push(track);
    } else if (parts[0] === "scenarios" && parts.length === 3) {
      const slot = slotOf(stem, SCENARIO_SLOTS);
      if (!slot) {
        unrecognized.push(underMusic);
        continue;
      }
      const scenarioId = parts[1]!;
      const entry = scenarios.get(scenarioId) ?? { battle: [], "villain-wins": [], "villain-loses": [] };
      entry[slot].push(track);
      scenarios.set(scenarioId, entry);
    } else if (parts[0] === "campaigns" && parts.length === 3) {
      const slot = slotOf(stem, CAMPAIGN_SLOTS);
      if (!slot) {
        unrecognized.push(underMusic);
        continue;
      }
      const campaignId = parts[1]!;
      const entry = campaigns.get(campaignId) ?? { battle: [], interlude: [] };
      entry[slot].push(track);
      campaigns.set(campaignId, entry);
    } else if (parts[0] === "packs" && parts.length === 3) {
      const slot = slotOf(stem, PACK_SLOTS);
      if (!slot) {
        unrecognized.push(underMusic);
        continue;
      }
      const packCode = parts[1]!;
      const entry = packs.get(packCode) ?? { battle: [] };
      entry[slot].push(track);
      packs.set(packCode, entry);
    } else if (parts[0] === "outcomes" && parts.length === 2) {
      const slot = slotOf(stem, OUTCOME_SLOTS);
      if (slot) outcomes[slot].push(track);
      else unrecognized.push(underMusic);
    } else {
      unrecognized.push(underMusic);
    }
  }

  return { title, gameplay, scenarios, campaigns, packs, outcomes, unrecognized };
}

/**
 * One track at random from `pool` — never `avoidKey` (the one played last) unless it's the only choice.
 */
export function pickTrack(pool: readonly Track[], avoidKey: string | null = null, random: () => number = Math.random): Track | null {
  if (pool.length === 0) return null;
  const candidates = pool.length > 1 && avoidKey ? pool.filter((t) => t.key !== avoidKey) : pool;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index] ?? null;
}

/**
 * The battle track for a game in progress.
 *
 * Priority (most specific first, per music/README.md):
 * scenarios/<scenarioId>/battle → campaigns/<campaignId>/battle → packs/<packCode>/battle → gameplay/
 */
export function battleTrackFor(
  catalog: MusicCatalog,
  context: { readonly scenarioId?: string | undefined; readonly campaignId?: string | undefined; readonly packCode?: string | undefined },
  random: () => number = Math.random,
): Track | null {
  if (context.scenarioId) {
    const scenarioTracks = catalog.scenarios.get(context.scenarioId)?.battle ?? [];
    if (scenarioTracks.length > 0) return pickTrack(scenarioTracks, null, random);
  }

  if (context.campaignId) {
    const campaignTracks = catalog.campaigns.get(context.campaignId)?.battle ?? [];
    if (campaignTracks.length > 0) return pickTrack(campaignTracks, null, random);
  }

  if (context.packCode) {
    const packTracks = catalog.packs.get(context.packCode)?.battle ?? [];
    if (packTracks.length > 0) return pickTrack(packTracks, null, random);
  }

  return pickTrack(catalog.gameplay, null, random);
}

/**
 * The track for how a game ended.
 *
 * - Win: scenario's villain-loses → outcomes/victory
 * - Loss or Concession: scenario's villain-wins → outcomes/defeat
 */
export function outcomeTrackFor(
  catalog: MusicCatalog,
  scenarioId: string,
  result: "win" | "loss" | "conceded",
  random: () => number = Math.random,
): Track | null {
  const scenario = catalog.scenarios.get(scenarioId);
  const own = result === "win" ? scenario?.["villain-loses"] : scenario?.["villain-wins"];
  const generic = catalog.outcomes[result === "win" ? "victory" : "defeat"];
  return pickTrack(own && own.length > 0 ? own : generic, null, random);
}

/**
 * A title track at random, avoiding `avoidKey` when multiple tracks exist.
 */
export function titleTrackFor(catalog: MusicCatalog, avoidKey: string | null = null, random: () => number = Math.random): Track | null {
  return pickTrack(catalog.title, avoidKey, random);
}

/**
 * A campaign interlude track, or null when none is defined.
 */
export function interludeTrackFor(catalog: MusicCatalog, campaignId: string, random: () => number = Math.random): Track | null {
  const tracks = catalog.campaigns.get(campaignId)?.interlude ?? [];
  return pickTrack(tracks, null, random);
}

const files = {
  ...(import.meta.glob("../../../../music/title/*.{mp3,ogg,m4a}", { eager: true, query: "?url", import: "default" }) as Record<string, string>),
  ...(import.meta.glob("../../../../music/gameplay/*.{mp3,ogg,m4a}", { eager: true, query: "?url", import: "default" }) as Record<string, string>),
  ...(import.meta.glob("../../../../music/scenarios/*/*.{mp3,ogg,m4a}", { eager: true, query: "?url", import: "default" }) as Record<string, string>),
  ...(import.meta.glob("../../../../music/campaigns/*/*.{mp3,ogg,m4a}", { eager: true, query: "?url", import: "default" }) as Record<string, string>),
  ...(import.meta.glob("../../../../music/packs/*/*.{mp3,ogg,m4a}", { eager: true, query: "?url", import: "default" }) as Record<string, string>),
  ...(import.meta.glob("../../../../music/outcomes/*.{mp3,ogg,m4a}", { eager: true, query: "?url", import: "default" }) as Record<string, string>),
};

/** Everything in `music/`. */
export const MUSIC_CATALOG: MusicCatalog = parseMusicCatalog(files);
