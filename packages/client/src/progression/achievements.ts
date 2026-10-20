/**
 * Achievements: a long, attainable list derived from the save history, and the rank that lifetime points earn
 * (docs/achievements.md).
 *
 * **Nothing is stored.** Like champion points (`unlocks.ts`), every achievement is read from the `mc-saves` and
 * `mc-campaigns` rows the results history and the Saga shelf already read. Only `won`/`lost` rows of real games count
 * (a Try-it lesson, `isLessonSave`, never does).
 *
 * **Points (owner, 2026-10-20: A).** Achievement points add to the champion points total that unlocks spend. The funny
 * "for trying" achievements give none; each names a reward pack instead. Rank reads LIFETIME points earned, never the
 * balance after spending, and rank 9 needs every achievement, scenario and campaign first.
 *
 * **Not tracked yet.** An achievement needing data the rows don't hold (a loss's reason, heroes defeated, a hero's
 * hit points at the win, allies played) is defined with `tracked: false`: it never reports progress and is skipped
 * from `achievementStatuses`' earned counts until the save row gains that summary (docs/achievements.md "Data the
 * client must record").
 *
 * Pure: no storage, no Phaser.
 */
import { CAMPAIGN_RECORDS } from "../campaign/campaign-service.js";
import { POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import { isLessonSave } from "../engine/game-storage.js";
import { identityOfSeat } from "./extras.js";
import {
  DEFAULT_UNLOCK_PREFS,
  POINTS,
  UNLOCK_CAMPAIGNS,
  UNLOCK_HEROES,
  UNLOCK_WAVES,
  Unlocks,
  progressOf,
  scenarioCycleOf,
  villainLabelOf,
} from "./unlocks.js";

export type AchievementFamily = "wins" | "villains" | "campaigns" | "heroes" | "expert" | "feats" | "funny" | "teamups";

/** The Trophy Room's grouping order. */
export const ACHIEVEMENT_FAMILIES: readonly { readonly id: AchievementFamily; readonly label: string }[] = [
  { id: "wins", label: "Battles won" },
  { id: "villains", label: "Villains" },
  { id: "campaigns", label: "Boxes and campaigns" },
  { id: "heroes", label: "Heroes" },
  { id: "expert", label: "Expert and Heroic" },
  { id: "feats", label: "Feats" },
  { id: "teamups", label: "Team-up stories" },
  { id: "funny", label: "The funny ones" },
];

/** The save rows an achievement reads: the same fields `progressOf` and `extrasProgressOf` read. */
export interface AchievementSave {
  readonly status: string;
  readonly guided?: { readonly kind: string };
  readonly round?: number;
  readonly config: {
    readonly scenarioId: string;
    readonly difficulty?: string;
    readonly modes?: { readonly expert?: boolean; readonly heroic?: number };
    readonly players: readonly object[];
  };
}

export interface AchievementCampaign {
  readonly status: string;
  readonly campaignId: string;
  readonly modes?: { readonly campaign?: { readonly expertCampaign?: boolean } };
}

/** The whole history an achievement can be read from. */
export interface AchievementHistory {
  readonly saves: readonly AchievementSave[];
  readonly campaigns: readonly AchievementCampaign[];
}

export const NO_HISTORY: AchievementHistory = { saves: [], campaigns: [] };

/** What the history says, counted once for every definition to read. */
interface Facts {
  readonly wins: number;
  readonly losses: number;
  readonly wonScenarios: ReadonlySet<string>;
  readonly expertWonScenarios: ReadonlySet<string>;
  readonly wonHeroes: ReadonlySet<string>;
  readonly wonAspects: ReadonlySet<string>;
  readonly wonCampaigns: ReadonlySet<string>;
  readonly expertWonCampaigns: ReadonlySet<string>;
  readonly heroicWins: number;
  readonly fastWins: number;
  readonly fourPlayerWins: number;
  /** Scenarios won solo (one seat). */
  readonly soloWonScenarios: ReadonlySet<string>;
  readonly round1Losses: number;
  /** Each won game's seated heroes, for pair achievements. */
  readonly wonTables: readonly ReadonlySet<string>[];
}

/** `{ current, target }`, or null when the history can't answer yet. */
export interface AchievementProgress {
  readonly current: number;
  readonly target: number;
}

export interface AchievementDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly family: AchievementFamily;
  /** Champion points. 0 for the funny ones, which name `rewardPackId` instead. */
  readonly points: number;
  /** A silly content pack this unlocks in place of points. */
  readonly rewardPackId?: string;
  /** False while the save rows don't hold what this needs; `needs` says what. */
  readonly tracked: boolean;
  readonly needs?: string;
  /** Show a progress bar in the Trophy Room (it counts something). */
  readonly showProgress: boolean;
  readonly measure: (facts: Facts) => AchievementProgress | null;
}

const isExpert = (save: AchievementSave): boolean =>
  save.config.difficulty === "expert" || save.config.difficulty === "extreme" || save.config.modes?.expert === true;

const seatAspects = (seat: object): readonly string[] => {
  if ("aspects" in seat && Array.isArray(seat.aspects)) return seat.aspects as string[];
  if ("starterDeckId" in seat) {
    return POOL_STARTER_DECKS.find((d) => (d.id as string) === seat.starterDeckId)?.aspects ?? [];
  }
  return [];
};

/** The last scenario of each campaign: the finale a solo win is a feat against. */
const FINALES: ReadonlyMap<string, string> = new Map(
  UNLOCK_CAMPAIGNS.flatMap((c) => {
    const finale = CAMPAIGN_RECORDS[c.campaignId]?.scenarioIds.at(-1);
    return finale ? [[c.campaignId, finale as string] as const] : [];
  }),
);

export function factsOf(history: AchievementHistory): Facts {
  const real = history.saves.filter((s) => !isLessonSave(s));
  const wonSaves = real.filter((s) => s.status === "won");
  const lostSaves = real.filter((s) => s.status === "lost");
  const heroesOf = (s: AchievementSave): string[] =>
    s.config.players.map(identityOfSeat).filter((id): id is string => id !== null);
  const campaigns = history.campaigns.filter((c) => c.status === "won");
  return {
    wins: wonSaves.length,
    losses: lostSaves.length,
    wonScenarios: new Set(wonSaves.map((s) => s.config.scenarioId)),
    expertWonScenarios: new Set(wonSaves.filter(isExpert).map((s) => s.config.scenarioId)),
    wonHeroes: new Set(wonSaves.flatMap(heroesOf)),
    wonAspects: new Set(wonSaves.flatMap((s) => s.config.players.flatMap(seatAspects))),
    wonCampaigns: new Set(campaigns.map((c) => c.campaignId)),
    expertWonCampaigns: new Set(
      campaigns.filter((c) => c.modes?.campaign?.expertCampaign === true).map((c) => c.campaignId),
    ),
    heroicWins: wonSaves.filter((s) => (s.config.modes?.heroic ?? 0) > 0).length,
    fastWins: wonSaves.filter((s) => s.round !== undefined && s.round <= 2).length,
    fourPlayerWins: wonSaves.filter((s) => s.config.players.length === 4).length,
    soloWonScenarios: new Set(wonSaves.filter((s) => s.config.players.length === 1).map((s) => s.config.scenarioId)),
    round1Losses: lostSaves.filter((s) => s.round === 1).length,
    wonTables: wonSaves.map((s) => new Set(heroesOf(s))),
  };
}

const count = (current: number, target: number): AchievementProgress => ({
  current: Math.min(current, target),
  target,
});
const allOf = (ids: readonly string[], have: ReadonlySet<string>): AchievementProgress =>
  count(ids.filter((id) => have.has(id)).length, ids.length);

function def(
  fields: Omit<AchievementDef, "tracked" | "showProgress" | "points"> &
    Partial<Pick<AchievementDef, "tracked" | "showProgress" | "points">>,
): AchievementDef {
  return { tracked: true, showProgress: false, points: 0, ...fields };
}

/** An achievement whose data the save rows don't hold yet. */
const pending = (
  fields: Omit<AchievementDef, "tracked" | "measure" | "needs" | "showProgress">,
  needs: string,
): AchievementDef => ({ ...fields, tracked: false, needs, showProgress: false, measure: () => null });

const scenarioIds: readonly string[] = POOL_SCENARIOS.map((s) => s.id as string);
const campaignIds: readonly string[] = UNLOCK_CAMPAIGNS.map((c) => c.campaignId);
const heroIds: readonly string[] = UNLOCK_HEROES.map((h) => h.identityCardId);
const heroIdNamed = (name: string): string | undefined => UNLOCK_HEROES.find((h) => h.name === name)?.identityCardId;

const WIN_TIERS: readonly (readonly [number, number, string, string])[] = [
  [1, 25, "First Blood", "Win your first battle."],
  [5, 50, "Getting the Hang of It", "Win 5 battles."],
  [10, 75, "Double Digits", "Win 10 battles."],
  [25, 100, "Regular Hero", "Win 25 battles."],
  [50, 150, "Fifty Ways to Win", "Win 50 battles."],
  [100, 250, "Centurion of Justice", "Win 100 battles."],
  [250, 500, "Is There Anyone Left to Punch?", "Win 250 battles."],
];

const aspectsList = ["aggression", "justice", "leadership", "protection"] as const;
const aspectNames: Record<(typeof aspectsList)[number], string> = {
  aggression: "Fists First",
  justice: "Order in the Court",
  leadership: "Natural Born Leader",
  protection: "Shield Up",
};

const wavesWithScenarios = UNLOCK_WAVES.map((wave) => ({
  wave,
  scenarios: POOL_SCENARIOS.filter((s) => scenarioCycleOf(s) === wave.cycleId).map((s) => s.id as string),
  heroes: UNLOCK_HEROES.filter((h) => h.cycleId === wave.cycleId).map((h) => h.identityCardId),
})).filter((w) => w.scenarios.length > 0 || w.heroes.length > 0);

const thor = heroIdNamed("Thor");
const sheHulk = heroIdNamed("She-Hulk");

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // Battles won
  ...WIN_TIERS.map(([target, points, name, description]) =>
    def({
      id: `wins-${target}`,
      name,
      description,
      family: "wins",
      points,
      showProgress: target > 1,
      measure: (f) => count(f.wins, target),
    }),
  ),

  // Villains
  ...POOL_SCENARIOS.map((s) => {
    const id = s.id as string;
    const villain = villainLabelOf(id);
    return def({
      id: `beat-${id}`,
      name: `Down Goes ${villain}`,
      description: `Beat ${villain}.`,
      family: "villains",
      points: 25,
      measure: (f) => count(f.wonScenarios.has(id) ? 1 : 0, 1),
    });
  }),
  // The Drone achievement: PR #294's earned item ("Drone art") points its unlock at this id.
  def({
    id: "ultron-drone",
    name: "Drone On",
    description: "Win a game against Ultron.",
    family: "villains",
    points: 25,
    measure: (f) => count(f.wonScenarios.has("ultron") ? 1 : 0, 1),
  }),
  ...wavesWithScenarios
    .filter((w) => w.scenarios.length > 1)
    .map(({ wave, scenarios }) =>
      def({
        id: `box-villains-${wave.cycleId}`,
        name: `Box Cleared: ${wave.name}`,
        description: `Beat every villain in ${wave.name}.`,
        family: "villains",
        points: 100,
        showProgress: true,
        measure: (f) => allOf(scenarios, f.wonScenarios),
      }),
    ),
  def({
    id: "every-villain",
    name: "Rogues' Gallery, Closed",
    description: "Beat every villain in the game.",
    family: "villains",
    points: 500,
    showProgress: true,
    measure: (f) => allOf(scenarioIds, f.wonScenarios),
  }),

  // Boxes and campaigns
  ...UNLOCK_CAMPAIGNS.flatMap((c) => [
    def({
      id: `campaign-${c.campaignId}`,
      name: `The Whole Saga: ${c.name}`,
      description: `Complete the ${c.name} campaign.`,
      family: "campaigns",
      points: 100,
      measure: (f) => count(f.wonCampaigns.has(c.campaignId) ? 1 : 0, 1),
    }),
    def({
      id: `campaign-expert-${c.campaignId}`,
      name: `No Mercy: ${c.name}`,
      description: `Complete the ${c.name} campaign as an Expert Campaign.`,
      family: "campaigns",
      points: 150,
      measure: (f) => count(f.expertWonCampaigns.has(c.campaignId) ? 1 : 0, 1),
    }),
  ]),
  def({
    id: "every-campaign",
    name: "Binge-Watched the Multiverse",
    description: "Complete every campaign.",
    family: "campaigns",
    points: 500,
    showProgress: true,
    measure: (f) => allOf(campaignIds, f.wonCampaigns),
  }),

  // Heroes
  ...UNLOCK_HEROES.map((h) =>
    def({
      id: `hero-${h.identityCardId}`,
      name: `Suited Up: ${h.name}`,
      description: `Win a game with ${h.name}.`,
      family: "heroes",
      points: 25,
      measure: (f) => count(f.wonHeroes.has(h.identityCardId) ? 1 : 0, 1),
    }),
  ),
  ...wavesWithScenarios
    .filter((w) => w.heroes.length > 1)
    .map(({ wave, heroes }) =>
      def({
        id: `box-heroes-${wave.cycleId}`,
        name: `Full Roster: ${wave.name}`,
        description: `Win with every hero of ${wave.name}.`,
        family: "heroes",
        points: 100,
        showProgress: true,
        measure: (f) => allOf(heroes, f.wonHeroes),
      }),
    ),
  ...(
    [
      [10, 100, "Ten Capes", "Win with 10 different heroes."],
      [25, 250, "A Closet Full of Capes", "Win with 25 different heroes."],
    ] as const
  ).map(([target, points, name, description]) =>
    def({
      id: `heroes-${target}`,
      name,
      description,
      family: "heroes",
      points,
      showProgress: true,
      measure: (f) => count(heroIds.filter((id) => f.wonHeroes.has(id)).length, target),
    }),
  ),
  def({
    id: "heroes-all",
    name: "Gotta Suit Them All",
    description: "Win with every hero in the game.",
    family: "heroes",
    points: 500,
    showProgress: true,
    measure: (f) => allOf(heroIds, f.wonHeroes),
  }),
  ...aspectsList.map((aspect) =>
    def({
      id: `aspect-${aspect}`,
      name: aspectNames[aspect],
      description: `Win a game with a ${aspect[0]!.toUpperCase()}${aspect.slice(1)} deck.`,
      family: "heroes",
      points: 50,
      measure: (f) => count(f.wonAspects.has(aspect) ? 1 : 0, 1),
    }),
  ),

  // Expert and Heroic
  def({
    id: "first-expert",
    name: "Hard Mode, Unlocked",
    description: "Win a game on Expert.",
    family: "expert",
    points: 100,
    measure: (f) => count(f.expertWonScenarios.size > 0 ? 1 : 0, 1),
  }),
  ...wavesWithScenarios
    .filter((w) => w.scenarios.length > 1)
    .map(({ wave, scenarios }) =>
      def({
        id: `box-expert-${wave.cycleId}`,
        name: `Expert Witness: ${wave.name}`,
        description: `Win on Expert against every villain of ${wave.name}.`,
        family: "expert",
        points: 150,
        showProgress: true,
        measure: (f) => allOf(scenarios, f.expertWonScenarios),
      }),
    ),
  def({
    id: "first-heroic",
    name: "Turn It Up to Eleven",
    description: "Win a Heroic game.",
    family: "expert",
    points: 150,
    measure: (f) => count(f.heroicWins > 0 ? 1 : 0, 1),
  }),

  // Feats
  def({
    id: "feat-fast-win",
    name: "Gone in Sixty Seconds",
    description: "Win in round 1 or 2.",
    family: "feats",
    points: 150,
    measure: (f) => count(f.fastWins > 0 ? 1 : 0, 1),
  }),
  def({
    id: "feat-four-players",
    name: "Too Many Cooks",
    description: "Win a four-player game.",
    family: "feats",
    points: 100,
    measure: (f) => count(f.fourPlayerWins > 0 ? 1 : 0, 1),
  }),
  ...UNLOCK_CAMPAIGNS.flatMap((c) => {
    const finale = FINALES.get(c.campaignId);
    return finale
      ? [
          def({
            id: `feat-solo-finale-${c.campaignId}`,
            name: `Lone Wolf: ${c.name}`,
            description: `Win solo against the finale of ${c.name} (${villainLabelOf(finale)}).`,
            family: "feats" as const,
            points: 150,
            measure: (f: Facts) => count(f.soloWonScenarios.has(finale) ? 1 : 0, 1),
          }),
        ]
      : [];
  }),
  pending(
    {
      id: "feat-one-hit-point",
      name: "Cutting It Close",
      description: "Win with a hero at exactly 1 hit point.",
      family: "feats",
      points: 150,
    },
    "a hero's hit points at the win",
  ),
  pending(
    {
      id: "feat-no-allies",
      name: "I Work Alone",
      description: "Win without playing a single ally.",
      family: "feats",
      points: 150,
    },
    "allies played during the game",
  ),

  // Team-up stories
  def({
    id: "worthy-of-a-second-date",
    name: "Worthy of a Second Date?",
    description: "Win a game with Thor and She-Hulk seated together.",
    family: "teamups",
    points: 150,
    measure: (f) =>
      count(thor && sheHulk && f.wonTables.some((table) => table.has(thor) && table.has(sheHulk)) ? 1 : 0, 1),
  }),

  // The funny ones: losses count, no points, a silly pack instead
  ...(
    [
      [10, "glutton-for-punishment", "Glutton for Punishment", "Lose 10 games."],
      [50, "professional-punching-bag", "Professional Punching Bag", "Lose 50 games."],
      [100, "thanos-sends-his-regards", "Thanos Sends His Regards", "Lose 100 games."],
    ] as const
  ).map(([target, pack, name, description]) =>
    def({
      id: `losses-${target}`,
      name,
      description,
      family: "funny",
      rewardPackId: `pack-${pack}`,
      showProgress: true,
      measure: (f) => count(f.losses, target),
    }),
  ),
  def({
    id: "round-one-loss",
    name: "Speedrun (Wrong Direction)",
    description: "Lose on round 1.",
    family: "funny",
    rewardPackId: "pack-speedrun-wrong-direction",
    measure: (f) => count(f.round1Losses > 0 ? 1 : 0, 1),
  }),
  pending(
    {
      id: "defeated-25",
      name: "Respawn Pending",
      description: "Have your heroes defeated 25 times.",
      family: "funny",
      points: 0,
      rewardPackId: "pack-respawn-pending",
    },
    "heroes defeated per game",
  ),
  pending(
    {
      id: "defeated-100",
      name: "Respawn Pending II: The Respawning",
      description: "Have your heroes defeated 100 times.",
      family: "funny",
      points: 0,
      rewardPackId: "pack-respawn-pending-2",
    },
    "heroes defeated per game",
  ),
  pending(
    {
      id: "scheme-losses-10",
      name: "Read the Room",
      description: "Lose to the main scheme completing 10 times.",
      family: "funny",
      points: 0,
      rewardPackId: "pack-read-the-room",
    },
    "a game's loss reason",
  ),
  pending(
    {
      id: "hulk-one-hit-point",
      name: "Gamma-Ray Overdose",
      description: "Win with Hulk at 1 hit point.",
      family: "funny",
      points: 0,
      rewardPackId: "pack-gamma-ray-overdose",
    },
    "a hero's hit points at the win",
  ),
];

export interface AchievementStatus {
  readonly def: AchievementDef;
  readonly earned: boolean;
  /** Null while untracked, or when the achievement counts nothing worth a bar. */
  readonly progress: AchievementProgress | null;
}

/** Every achievement against the history, in definition order. */
export function achievementStatuses(history: AchievementHistory): readonly AchievementStatus[] {
  const facts = factsOf(history);
  return ACHIEVEMENTS.map((d) => {
    const measured = d.tracked ? d.measure(facts) : null;
    return {
      def: d,
      earned: measured !== null && measured.current >= measured.target,
      progress: measured !== null && d.showProgress ? measured : null,
    };
  });
}

/**
 * Whether one achievement is earned: the hook an earned item's `ExtrasUnlock` reads (PR #294's `ultronDroneArt`
 * points at `"ultron-drone"`). An unknown id is never earned.
 */
export function isAchievementEarned(id: string, history: AchievementHistory): boolean {
  const d = ACHIEVEMENTS.find((a) => a.id === id);
  if (!d || !d.tracked) return false;
  const measured = d.measure(factsOf(history));
  return measured !== null && measured.current >= measured.target;
}

/** Ids of the achievements the save rows can't answer yet. */
export const UNTRACKED_ACHIEVEMENT_IDS: readonly string[] = ACHIEVEMENTS.filter((a) => !a.tracked).map((a) => a.id);

/** Points the earned achievements add to the champion points total. */
export function achievementPointsOf(history: AchievementHistory): number {
  return achievementStatuses(history).reduce((sum, s) => sum + (s.earned ? s.def.points : 0), 0);
}

/** First wins, first Expert wins and campaigns: the existing champion points (`Unlocks.points().earned`). */
export function basePointsOf(history: AchievementHistory): number {
  const progress = progressOf(history.saves, history.campaigns);
  return new Unlocks({ progress, prefs: DEFAULT_UNLOCK_PREFS }).points().earned;
}

/** Lifetime points earned: champion points from firsts plus achievement points. Spending never lowers it. */
export function lifetimePointsOf(history: AchievementHistory): number {
  return basePointsOf(history) + achievementPointsOf(history);
}

/** Every point there is to earn: every first win and Expert win, every campaign, every achievement. */
export const MAX_LIFETIME_POINTS: number =
  POOL_SCENARIOS.length * (POINTS.firstWin + POINTS.firstExpertWin) +
  UNLOCK_CAMPAIGNS.length * (POINTS.campaign + POINTS.expertCampaign) +
  ACHIEVEMENTS.reduce((sum, a) => sum + a.points, 0);

export interface Rank {
  readonly rank: number;
  readonly title: string;
  /** Lifetime points needed to hold this rank. */
  readonly threshold: number;
}

/**
 * Titles are placeholders (docs/achievements.md). Thresholds are fractions of `MAX_LIFETIME_POINTS` so the last rank
 * needs everything; rank 2 is one first win, so a new player ranks up in the first session.
 */
const RANK_TITLES = [
  "Sidekick in Training",
  "Neighborhood Watch",
  "Costumed Vigilante",
  "Street-Level Legend",
  "Avengers Reserve",
  "Team Leader",
  "Living Legend",
  "Cosmic Powerhouse",
  "Ultimate Champion",
] as const;
const RANK_FRACTIONS = [0, 0, 0.03, 0.08, 0.18, 0.33, 0.52, 0.76, 1] as const;
const roundTo50 = (n: number): number => Math.round(n / 50) * 50;

export const RANKS: readonly Rank[] = RANK_TITLES.map((title, i) => ({
  rank: i + 1,
  title,
  threshold:
    i === 0
      ? 0
      : i === 1
        ? POINTS.firstWin
        : i === 8
          ? MAX_LIFETIME_POINTS
          : roundTo50(MAX_LIFETIME_POINTS * RANK_FRACTIONS[i]!),
}));

/** The highest rank `lifetimePoints` reaches. */
export function rankOf(lifetimePoints: number): Rank {
  let held = RANKS[0]!;
  for (const r of RANKS) if (lifetimePoints >= r.threshold) held = r;
  return held;
}

export interface RankProgress {
  readonly rank: Rank;
  /** Null at the top rank. */
  readonly next: Rank | null;
  /** Points past this rank's threshold, and the width of the step to the next. */
  readonly into: number;
  readonly span: number;
  /** 0 to 1 toward the next rank; 1 at the top. */
  readonly fraction: number;
}

export function rankProgressOf(lifetimePoints: number): RankProgress {
  const rank = rankOf(lifetimePoints);
  const next = RANKS[rank.rank] ?? null;
  if (!next) return { rank, next: null, into: 0, span: 0, fraction: 1 };
  const into = lifetimePoints - rank.threshold;
  const span = next.threshold - rank.threshold;
  return { rank, next, into, span, fraction: span > 0 ? Math.min(1, into / span) : 1 };
}
