/**
 * Progression: what a player has opened by playing, what they opened by hand, and the champion points that make
 * playing for it worth more than switching it on.
 *
 * **The unlock path.** Content is gated by release wave (`Cycle.id`), in release order. The Core Set is always
 * fully open — every villain, every hero, no switch. Every later wave opens once the player has done what the wave
 * before it asks:
 *
 * - **Wave 1** (Green Goblin, The Wrecking Crew and their heroes) and **The Rise of Red Skull**: beat Rhino, the
 *   Core Set's first villain. One win is all it takes to leave the Core Set; Wave 1 ships no campaign box to finish.
 * - **The Galaxy's Most Wanted**: complete The Rise of Red Skull campaign.
 * - **The Mad Titan's Shadow**: complete The Galaxy's Most Wanted campaign.
 *
 * **Heroes come one villain at a time.** An open wave seats its box's own cast straight away (Hawkeye and
 * Spider-Woman; Groot and Rocket; Spectrum and Adam Warlock). Every other hero of the wave is a villain's reward
 * (`HeroReward`): beat that villain anywhere (in the campaign or standalone, any difficulty) and the hero joins the
 * roster. Wave 1's heroes are rewards for the Core and Wave 1 villains, in release order.
 *
 * Adding a wave to the app's pool means adding its row here: `unlocks.test.ts` fails until every pool wave and
 * every pool hero has a place on the path.
 *
 * **Progress is derived, never stored twice.** A win is a `won` save in `mc-saves` and a completed campaign is a
 * `won` record in `mc-campaigns`, the same rows the results history and the Saga shelf already read. Earned is
 * earned: a reward whose villain was beaten stays open whatever else is switched on or off.
 *
 * **Your own decks are always yours.** The locks are on the preconstructed decks only: a deck the player imported from
 * MarvelCDB or built in the deck builder seats whatever hero it's for (`Unlocks.deckLock`). Locked heroes can still
 * be built, so it's the precon, not the character, that play unlocks.
 *
 * **Opening things by hand.** One hero, one scenario or one campaign (which seats its cast too) costs champion
 * points (`POINTS`) the player has earned: charged once per thing, never refunded, and never more than the player
 * has, so the total can't go below zero. What was charged is kept in `UnlockPrefs.charges`.
 *
 * **Unlock everything is free.** It's the way out of points altogether, for a player who doesn't want the
 * progression: everything opens, nothing is charged, and points read as off while it's on. A dev/QA session can do
 * the same for one page load with `?unlock=all` (`progression.ts`), which is never saved.
 *
 * Pure: no storage, no Phaser. `progression.ts` owns the cache and the saved preferences.
 */
import type { Scenario } from "@mc/content";
import { CARDS_BY_ID, POOL_HERO_SHELF_PACKS, POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import { SAGA_VOLUMES } from "../campaign/story.js";

/** What a win is worth, and what opening something by hand costs. */
export const POINTS = {
  /** The first win against a scenario, at any difficulty. */
  firstWin: 100,
  /** The first Expert (or Extreme) win against a scenario, on top of `firstWin`. */
  firstExpertWin: 50,
  campaign: 500,
  /** An Expert Campaign win, on top of `campaign`. */
  expertCampaign: 250,
  unlockHero: 150,
  unlockCampaign: 300,
  /** One scenario, on its own: the same as the first win it stands in for. */
  unlockScenario: 100,
} as const;

export type UnlockGate =
  | { readonly kind: "scenarioWin"; readonly scenarioIds: readonly string[]; readonly hint: string }
  | { readonly kind: "campaignWin"; readonly campaignId: string; readonly hint: string };

/** Beat `scenarioId` and `identityCardId` joins the roster. */
export interface HeroReward {
  readonly scenarioId: string;
  readonly identityCardId: string;
}

export interface UnlockWave {
  /** `Cycle.id`: what a scenario's pack and a hero's identity card carry. */
  readonly cycleId: string;
  readonly name: string;
  /** Null for the wave that is always open (the Core Set). */
  readonly gate: UnlockGate | null;
  /** The wave's campaign box, if it has one. */
  readonly campaignId?: string;
  /** Heroes seated as soon as the wave opens: every Core hero, or a campaign box's own cast. */
  readonly starterHeroIds: "all" | readonly string[];
  readonly heroRewards: readonly HeroReward[];
}

/** The unlock path, in release order. See the module comment for why each gate and reward is what it is. */
export const UNLOCK_WAVES: readonly UnlockWave[] = [
  { cycleId: "core", name: "Core Set", gate: null, starterHeroIds: "all", heroRewards: [] },
  {
    cycleId: "wave1",
    name: "Wave 1",
    gate: { kind: "scenarioWin", scenarioIds: ["rhino"], hint: "Beat Rhino" },
    starterHeroIds: [],
    heroRewards: [
      { scenarioId: "rhino", identityCardId: "03001a" }, // Captain America
      { scenarioId: "klaw", identityCardId: "05001a" }, // Ms. Marvel
      { scenarioId: "ultron", identityCardId: "06001a" }, // Thor
      { scenarioId: "risky-business", identityCardId: "08001a" }, // Black Widow
      { scenarioId: "mutagen-formula", identityCardId: "09001a" }, // Doctor Strange
      { scenarioId: "breakout", identityCardId: "10001a" }, // Hulk
    ],
  },
  {
    cycleId: "cycle1",
    name: "The Rise of Red Skull",
    gate: { kind: "scenarioWin", scenarioIds: ["rhino"], hint: "Beat Rhino" },
    campaignId: "trors",
    starterHeroIds: ["04001a", "04031a"], // Hawkeye, Spider-Woman: MC10's own cast
    heroRewards: [
      { scenarioId: "crossbones", identityCardId: "12001a" }, // Ant-Man
      { scenarioId: "absorbing-man", identityCardId: "13001a" }, // Wasp
      { scenarioId: "taskmaster", identityCardId: "14001a" }, // Quicksilver
      { scenarioId: "zola", identityCardId: "15001a" }, // Scarlet Witch
    ],
  },
  {
    cycleId: "cycle3",
    name: "The Galaxy's Most Wanted",
    gate: { kind: "campaignWin", campaignId: "trors", hint: "Complete The Rise of Red Skull campaign" },
    campaignId: "gmw",
    starterHeroIds: ["16001a", "16029a"], // Groot, Rocket Raccoon: MC16's own cast
    heroRewards: [
      { scenarioId: "brotherhood-of-badoon", identityCardId: "17001a" }, // Star-Lord
      { scenarioId: "infiltrate-the-museum", identityCardId: "18001a" }, // Gamora
      { scenarioId: "escape-the-museum", identityCardId: "19001a" }, // Drax
      { scenarioId: "nebula", identityCardId: "20001a" }, // Venom
    ],
  },
  {
    cycleId: "cycle4",
    name: "The Mad Titan's Shadow",
    gate: { kind: "campaignWin", campaignId: "gmw", hint: "Complete The Galaxy's Most Wanted campaign" },
    campaignId: "mts",
    starterHeroIds: ["21001a", "21031a"], // Spectrum, Adam Warlock: MC21's own cast
    heroRewards: [
      { scenarioId: "ebony-maw", identityCardId: "22001a" }, // Nebula
      { scenarioId: "tower-defense", identityCardId: "23001a" }, // War Machine
      { scenarioId: "thanos", identityCardId: "26001a" }, // Vision
      { scenarioId: "hela", identityCardId: "25001a" }, // Valkyrie
    ],
  },
];

/** What the player has done, read from storage by `progressOf`. */
export interface UnlockProgress {
  readonly wonScenarioIds: readonly string[];
  /** Scenarios won at least once on Expert or Extreme. */
  readonly wonExpertScenarioIds: readonly string[];
  readonly wonCampaignIds: readonly string[];
  readonly wonExpertCampaignIds: readonly string[];
}

export const NO_PROGRESS: UnlockProgress = {
  wonScenarioIds: [],
  wonExpertScenarioIds: [],
  wonCampaignIds: [],
  wonExpertCampaignIds: [],
};

/** Points charged once for opening one thing by hand. `id` is an `UnlockTarget` key. */
export interface UnlockCharge {
  readonly id: string;
  readonly points: number;
}

/** What the player chose in Settings ▸ Unlocks. */
export interface UnlockPrefs {
  readonly unlockAll: boolean;
  /** Identity card ids opened one at a time. */
  readonly heroIds: readonly string[];
  /** Campaign box ids (`Campaign.id`) opened one at a time. */
  readonly campaignIds: readonly string[];
  /** Scenario ids opened one at a time. */
  readonly scenarioIds: readonly string[];
  /** Everything ever charged. Never shrinks: switching something off refunds nothing. */
  readonly charges: readonly UnlockCharge[];
}

/**
 * Bumped when stored charges stop meaning what they meant. 2: "Unlock everything" became free, so the charges an
 * earlier build recorded for it (and the negative totals they caused) are dropped on load.
 */
export const UNLOCK_PREFS_VERSION = 2;

export const DEFAULT_UNLOCK_PREFS: UnlockPrefs = {
  unlockAll: false,
  heroIds: [],
  campaignIds: [],
  scenarioIds: [],
  charges: [],
};

/** Something the player can open by hand. */
export type UnlockTarget =
  | { readonly kind: "hero"; readonly identityCardId: string }
  | { readonly kind: "campaign"; readonly campaignId: string }
  | { readonly kind: "scenario"; readonly scenarioId: string }
  | { readonly kind: "everything" };

const heroKey = (identityCardId: string): string => `hero:${identityCardId}`;
const campaignKey = (campaignId: string): string => `campaign:${campaignId}`;
const scenarioKey = (scenarioId: string): string => `scenario:${scenarioId}`;

const isExpert = (difficulty: string | undefined): boolean => difficulty === "expert" || difficulty === "extreme";
const unique = (ids: readonly string[]): string[] => [...new Set(ids)].sort();

/**
 * Progress from the two storage listings. Only a `won` row counts: a loss, a concession or an abandoned run is
 * not a clear.
 */
export function progressOf(
  saves: readonly {
    readonly status: string;
    readonly config: { readonly scenarioId: string; readonly difficulty?: string };
  }[],
  campaigns: readonly {
    readonly status: string;
    readonly campaignId: string;
    readonly modes?: { readonly campaign?: { readonly expertCampaign?: boolean } };
  }[],
): UnlockProgress {
  const wonSaves = saves.filter((s) => s.status === "won");
  const wonCampaigns = campaigns.filter((c) => c.status === "won");
  return {
    wonScenarioIds: unique(wonSaves.map((s) => s.config.scenarioId)),
    wonExpertScenarioIds: unique(wonSaves.filter((s) => isExpert(s.config.difficulty)).map((s) => s.config.scenarioId)),
    wonCampaignIds: unique(wonCampaigns.map((c) => c.campaignId)),
    wonExpertCampaignIds: unique(
      wonCampaigns.filter((c) => c.modes?.campaign?.expertCampaign === true).map((c) => c.campaignId),
    ),
  };
}

export function sameProgress(a: UnlockProgress, b: UnlockProgress): boolean {
  const key = (p: UnlockProgress): string =>
    [p.wonScenarioIds, p.wonExpertScenarioIds, p.wonCampaignIds, p.wonExpertCampaignIds]
      .map((l) => l.join(","))
      .join("|");
  return key(a) === key(b);
}

/** `progress` with one more win, for showing what a win just earned before storage has caught up. */
export function withWin(progress: UnlockProgress, scenarioId: string, difficulty: string): UnlockProgress {
  return {
    ...progress,
    wonScenarioIds: unique([...progress.wonScenarioIds, scenarioId]),
    wonExpertScenarioIds: isExpert(difficulty)
      ? unique([...progress.wonExpertScenarioIds, scenarioId])
      : progress.wonExpertScenarioIds,
  };
}

const PACK_CYCLES: ReadonlyMap<string, string> = new Map(POOL_HERO_SHELF_PACKS.map((p) => [p.code, p.cycleId]));

/** The wave a scenario belongs to, by its pack. */
export const scenarioCycleOf = (scenario: Pick<Scenario, "packCode">): string | undefined =>
  PACK_CYCLES.get(scenario.packCode as string);

/** The wave a hero belongs to, by its identity card. */
export const heroCycleOf = (identityCardId: string): string | undefined =>
  CARDS_BY_ID.get(identityCardId)?.cycleId as string | undefined;

/** "Rhino", or "Norman Osborn (Risky Business)" when the scenario isn't named for its villain. */
export function villainLabelOf(scenarioId: string): string {
  const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === scenarioId);
  if (!scenario) return scenarioId;
  const villain = CARDS_BY_ID.get(scenario.villainCardId as string)?.name ?? scenario.name;
  return villain === scenario.name ? villain : `${villain} (${scenario.name})`;
}

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

const heroNameOf = (identityCardId: string): string =>
  UNLOCK_HEROES.find((h) => h.identityCardId === identityCardId)?.name ?? identityCardId;

export interface UnlockCampaign {
  readonly campaignId: string;
  readonly volume: number;
  readonly name: string;
  readonly cycleId: string;
}

/** Every campaign box on the unlock path, in Saga order. */
export const UNLOCK_CAMPAIGNS: readonly UnlockCampaign[] = UNLOCK_WAVES.flatMap((wave) => {
  const volume = SAGA_VOLUMES.find((v) => v.campaignId === wave.campaignId);
  return volume
    ? [{ campaignId: volume.campaignId, volume: volume.number, name: volume.name, cycleId: wave.cycleId }]
    : [];
});

const campaignNameOf = (campaignId: string): string =>
  SAGA_VOLUMES.find((v) => v.campaignId === campaignId)?.name ?? campaignId;

/** A scenario's display name for a lock or a confirm: its villain, with the scenario when they differ. */
export const scenarioNameOf = (scenarioId: string): string => villainLabelOf(scenarioId);

export interface WaveStatus {
  readonly wave: UnlockWave;
  /** The gate is met (or there is none): opened by play, not by a setting. */
  readonly earned: boolean;
  readonly unlocked: boolean;
  /** "Beat Rhino to unlock Wave 1" while locked; null once open. */
  readonly lockReason: string | null;
}

export interface PointsTally {
  readonly earned: number;
  readonly spent: number;
  readonly total: number;
}

export interface UnlocksInput {
  readonly progress: UnlockProgress;
  readonly prefs: UnlockPrefs;
  /** `?unlock=all`: everything open for this page load, never saved and never charged. */
  readonly devUnlockAll?: boolean;
}

/** One answer to "may the player pick this?", for every screen that asks. */
export class Unlocks {
  readonly progress: UnlockProgress;
  readonly prefs: UnlockPrefs;
  readonly devUnlockAll: boolean;
  readonly #waves: ReadonlyMap<string, WaveStatus>;
  readonly #won: ReadonlySet<string>;

  constructor(input: UnlocksInput) {
    this.progress = input.progress;
    this.prefs = input.prefs;
    this.devUnlockAll = input.devUnlockAll ?? false;
    const won = new Set(input.progress.wonScenarioIds);
    this.#won = won;
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

  /** Null when the scenario may be played: its wave is open, or it was opened on its own. */
  scenarioLock(scenario: Pick<Scenario, "id" | "packCode">): string | null {
    if (this.prefs.scenarioIds.includes(scenario.id as string)) return null;
    return this.waveLock(scenarioCycleOf(scenario));
  }

  /** The scenario's wave was opened by play. */
  scenarioEarned(scenarioId: string): boolean {
    const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === scenarioId);
    const cycleId = scenario ? scenarioCycleOf(scenario) : undefined;
    return cycleId === undefined || (this.#waves.get(cycleId)?.earned ?? true);
  }

  /** Opened by play: the hero's wave cast it from the start, or its villain has been beaten. */
  heroEarned(identityCardId: string): boolean {
    const wave = this.#waveOfHero(identityCardId);
    if (!wave) return true;
    const reward = wave.heroRewards.find((r) => r.identityCardId === identityCardId);
    if (reward) return this.#won.has(reward.scenarioId);
    return this.#waves.get(wave.cycleId)?.earned ?? true;
  }

  /** How a hero is opened by play: "Beat Ultron", "Beat Rhino", or null for an always-open Core hero. */
  heroHint(identityCardId: string): string | null {
    const wave = this.#waveOfHero(identityCardId);
    if (!wave || wave.gate === null) return null;
    const reward = wave.heroRewards.find((r) => r.identityCardId === identityCardId);
    return reward ? `Beat ${villainLabelOf(reward.scenarioId)}` : wave.gate.hint;
  }

  /** Opened by hand: one hero's switch, its campaign's switch, or everything. */
  heroManual(identityCardId: string): boolean {
    if (this.everything || this.prefs.heroIds.includes(identityCardId)) return true;
    const wave = this.#waveOfHero(identityCardId);
    const cast = wave && wave.starterHeroIds !== "all" ? wave.starterHeroIds : [];
    return (
      wave?.campaignId !== undefined &&
      this.prefs.campaignIds.includes(wave.campaignId) &&
      cast.includes(identityCardId)
    );
  }

  /** Null when the hero may sit at a table; otherwise what opens it. */
  heroLock(identityCardId: string): string | null {
    if (this.heroEarned(identityCardId) || this.heroManual(identityCardId)) return null;
    const waveLock = this.waveLock(heroCycleOf(identityCardId));
    if (waveLock) return waveLock;
    return `${this.heroHint(identityCardId) ?? "Play on"} to unlock ${heroNameOf(identityCardId)}`;
  }

  /** `heroLock` for a deck: only a preconstructed deck is ever locked; an imported or built deck always seats. */
  deckLock(deck: { readonly identityCardId: string; readonly source: { readonly kind: string } }): string | null {
    return deck.source.kind === "precon" ? this.heroLock(deck.identityCardId) : null;
  }

  /** The campaign's wave was opened by play. */
  campaignEarned(campaignId: string): boolean {
    const wave = UNLOCK_WAVES.find((w) => w.campaignId === campaignId);
    return wave === undefined || (this.#waves.get(wave.cycleId)?.earned ?? true);
  }

  /** Opened by hand, which also skips the Saga's win-the-volume-before order. */
  campaignManual(campaignId: string): boolean {
    return this.everything || this.prefs.campaignIds.includes(campaignId);
  }

  /** Null when the campaign box's wave is open. The Saga's own volume order still applies unless opened by hand. */
  campaignLock(campaignId: string): string | null {
    if (this.campaignManual(campaignId)) return null;
    const wave = UNLOCK_WAVES.find((w) => w.campaignId === campaignId);
    return wave ? this.waveLock(wave.cycleId) : null;
  }

  /** Whether the player has the points `target` costs. Spending never takes the total below zero. */
  canAfford(target: UnlockTarget): boolean {
    const cost = this.chargesFor(target).reduce((sum, charge) => sum + charge.points, 0);
    return cost === 0 || cost <= this.points().total;
  }

  /** Champion points: earned by wins, less what opening things by hand has cost. */
  points(): PointsTally {
    const p = this.progress;
    const earned =
      p.wonScenarioIds.length * POINTS.firstWin +
      p.wonExpertScenarioIds.length * POINTS.firstExpertWin +
      p.wonCampaignIds.length * POINTS.campaign +
      p.wonExpertCampaignIds.length * POINTS.expertCampaign;
    const spent = this.prefs.charges.reduce((sum, charge) => sum + charge.points, 0);
    return { earned, spent, total: earned - spent };
  }

  /** Where the earned points came from, one line per source, for the Unlocks header. */
  pointsSources(): readonly { readonly label: string; readonly points: number }[] {
    const p = this.progress;
    return [
      ...p.wonScenarioIds.map((id) => ({ label: `First win: ${villainLabelOf(id)}`, points: POINTS.firstWin })),
      ...p.wonExpertScenarioIds.map((id) => ({
        label: `First Expert win: ${villainLabelOf(id)}`,
        points: POINTS.firstExpertWin,
      })),
      ...p.wonCampaignIds.map((id) => ({ label: `Campaign: ${campaignNameOf(id)}`, points: POINTS.campaign })),
      ...p.wonExpertCampaignIds.map((id) => ({
        label: `Expert Campaign: ${campaignNameOf(id)}`,
        points: POINTS.expertCampaign,
      })),
    ];
  }

  /**
   * The charges opening `target` by hand would add: nothing already earned by play, already open by hand, or
   * already paid for once. "Everything" charges each locked hero and campaign separately, so a later single switch
   * of something it covered is free.
   */
  chargesFor(target: UnlockTarget): readonly UnlockCharge[] {
    const paid = new Set(this.prefs.charges.map((c) => c.id));
    const hero = (id: string): UnlockCharge[] =>
      this.heroEarned(id) || paid.has(heroKey(id)) ? [] : [{ id: heroKey(id), points: POINTS.unlockHero }];
    const campaign = (id: string): UnlockCharge[] =>
      this.campaignEarned(id) || paid.has(campaignKey(id))
        ? []
        : [{ id: campaignKey(id), points: POINTS.unlockCampaign }];
    const scenario = (id: string): UnlockCharge[] =>
      this.scenarioEarned(id) || paid.has(scenarioKey(id))
        ? []
        : [{ id: scenarioKey(id), points: POINTS.unlockScenario }];
    switch (target.kind) {
      case "hero":
        return hero(target.identityCardId);
      case "campaign":
        return campaign(target.campaignId);
      case "scenario":
        return scenario(target.scenarioId);
      case "everything":
        // Free: Unlock everything is the way out of points altogether, not a purchase.
        return [];
    }
  }

  #waveOfHero(identityCardId: string): UnlockWave | undefined {
    const cycleId = heroCycleOf(identityCardId);
    return UNLOCK_WAVES.find((w) => w.cycleId === cycleId);
  }
}

/** `prefs` with `target` switched on and what it costs added to its charges; unchanged if it can't be afforded. */
export function unlockByHand(unlocks: Unlocks, target: UnlockTarget): UnlockPrefs {
  const prefs = unlocks.prefs;
  // Points are spent, never borrowed: something the player can't afford stays locked.
  if (!unlocks.canAfford(target)) return prefs;
  const charges = [...prefs.charges, ...unlocks.chargesFor(target)];
  switch (target.kind) {
    case "hero":
      return { ...prefs, charges, heroIds: unique([...prefs.heroIds, target.identityCardId]) };
    case "campaign":
      return { ...prefs, charges, campaignIds: unique([...prefs.campaignIds, target.campaignId]) };
    case "scenario":
      return { ...prefs, charges, scenarioIds: unique([...prefs.scenarioIds, target.scenarioId]) };
    case "everything":
      return { ...prefs, charges, unlockAll: true };
  }
}

/** `prefs` with `target` switched off. Nothing is refunded. */
export function relock(prefs: UnlockPrefs, target: UnlockTarget): UnlockPrefs {
  switch (target.kind) {
    case "hero":
      return { ...prefs, heroIds: prefs.heroIds.filter((id) => id !== target.identityCardId) };
    case "campaign":
      return { ...prefs, campaignIds: prefs.campaignIds.filter((id) => id !== target.campaignId) };
    case "scenario":
      return { ...prefs, scenarioIds: prefs.scenarioIds.filter((id) => id !== target.scenarioId) };
    case "everything":
      return { ...prefs, unlockAll: false };
  }
}

/** What a step of progress opened, for the Game over screen's "Unlocked" line. */
export interface UnlockNews {
  readonly points: number;
  /** Wave names, then hero names, then campaign names — only what play opened, not what a switch already had. */
  readonly unlocked: readonly string[];
}

export function newsBetween(before: Unlocks, after: Unlocks): UnlockNews {
  const waves = after
    .waves()
    .filter((w) => w.earned && !before.waves().find((b) => b.wave.cycleId === w.wave.cycleId)?.earned)
    .map((w) => w.wave.name);
  const heroes = UNLOCK_HEROES.filter(
    (h) => after.heroEarned(h.identityCardId) && !before.heroEarned(h.identityCardId),
  ).map((h) => h.name);
  return { points: after.points().earned - before.points().earned, unlocked: [...waves, ...heroes] };
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];

/** Reads a stored preferences value defensively: anything malformed falls back to the defaults. */
export function parseUnlockPrefs(raw: string | null): UnlockPrefs {
  if (!raw) return DEFAULT_UNLOCK_PREFS;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const charges = Array.isArray(value.charges)
      ? value.charges.filter(
          (c): c is UnlockCharge =>
            typeof c === "object" &&
            c !== null &&
            typeof (c as UnlockCharge).id === "string" &&
            typeof (c as UnlockCharge).points === "number",
        )
      : [];
    return {
      unlockAll: value.unlockAll === true,
      heroIds: strings(value.heroIds),
      campaignIds: strings(value.campaignIds),
      scenarioIds: strings(value.scenarioIds),
      charges: value.version === UNLOCK_PREFS_VERSION ? charges.map((c) => ({ id: c.id, points: c.points })) : [],
    };
  } catch {
    return DEFAULT_UNLOCK_PREFS;
  }
}

/** `?unlock=all` in a page's query string. */
export function devUnlockAllFrom(search: string): boolean {
  return new URLSearchParams(search).get("unlock") === "all";
}
