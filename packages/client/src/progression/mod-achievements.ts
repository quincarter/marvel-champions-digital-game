/**
 * Achievements for mods (docs/custom-content-packs.md §11.12). Owner decisions (2026-11-13): mod achievements, built in
 * or defined by a pack, are worth NO points, so mods never move rank or lifetime points.
 *
 * Custom-content games earn nothing in base progression (`isCustomSave`), so base `factsOf` skips them. These facts are
 * read from the same save rows, separately: they see every finished (won or lost) real game, custom or not, and feed only
 * the Mods family. A game's `config.packs` carries the packs it was played with, so everything is read from the saves:
 * nothing stored but which mods were ever installed (`mod-installs.ts`). Pure: no storage, no Phaser.
 */
import { isLessonSave } from "../engine/game-storage.js";
import { parsePackAchievements, type PackAchievement, type PackAchievementWhen } from "@mc/content";
import type { AchievementCampaign, AchievementProgress, AchievementSave } from "./achievements.js";

/** What a game's embedded pack (a `PackRuntime` in `SessionConfig.packs`) says, read loosely: a save is untrusted data. */
export interface EmbeddedPack {
  readonly id: string;
  readonly name: string;
  readonly scenarioIds: ReadonlySet<string>;
  readonly deckIdentities: ReadonlyMap<string, string>;
  readonly achievements: readonly PackAchievement[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The packs a save carries, read loosely. */
export function embeddedPacksOf(save: Pick<AchievementSave, "config">): readonly EmbeddedPack[] {
  const out: EmbeddedPack[] = [];
  for (const pack of save.config.packs ?? []) {
    if (!isRecord(pack) || typeof pack.id !== "string") continue;
    const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(isRecord) : []);
    out.push({
      id: pack.id,
      name: typeof pack.name === "string" ? pack.name : pack.id,
      scenarioIds: new Set(list(pack.scenarios).flatMap((s) => (typeof s.id === "string" ? [s.id] : []))),
      deckIdentities: new Map(
        list(pack.decks).flatMap((d) =>
          typeof d.id === "string" && typeof d.identityCardId === "string" ? [[d.id, d.identityCardId] as const] : [],
        ),
      ),
      // A save is untrusted: only well-formed entries survive, so an unknown future measure is never earned.
      achievements: parsePackAchievements(pack.achievements),
    });
  }
  return out;
}

/** A custom card code: `x.<pack-id>.<number>`. */
const isCustomCode = (code: string): boolean => code.startsWith("x.");

/** The identity each seat plays: a built seat names it, a pack precon seat names its deck, which names it. */
function seatIdentities(save: AchievementSave, packs: readonly EmbeddedPack[]): string[] {
  return save.config.players.flatMap((seat) => {
    if ("identityCardId" in seat && typeof seat.identityCardId === "string") return [seat.identityCardId];
    if ("starterDeckId" in seat && typeof seat.starterDeckId === "string") {
      for (const pack of packs) {
        const id = pack.deckIdentities.get(seat.starterDeckId);
        if (id !== undefined) return [id];
      }
    }
    return [];
  });
}

const isExpertSave = (save: AchievementSave): boolean =>
  !save.config.modes?.skirmish &&
  (save.config.difficulty === "expert" || save.config.difficulty === "extreme" || save.config.modes?.expert === true);

/** One finished game, read for the mod achievements. */
interface ModGame {
  readonly save: AchievementSave;
  readonly won: boolean;
  readonly packs: readonly EmbeddedPack[];
  readonly identities: readonly string[];
  readonly communityHeroes: ReadonlySet<string>;
  /** The scenario belongs to a pack the game carries. */
  readonly communityVillain: boolean;
  readonly houseRules: readonly string[];
  readonly expert: boolean;
}

function modGameOf(save: AchievementSave): ModGame {
  const packs = embeddedPacksOf(save);
  const identities = seatIdentities(save, packs);
  const houseRules = (Array.isArray(save.config.houseRules) ? save.config.houseRules : []).filter(
    (rule): rule is string => typeof rule === "string",
  );
  return {
    save,
    won: save.status === "won",
    packs,
    identities,
    communityHeroes: new Set(identities.filter(isCustomCode)),
    communityVillain: packs.some((pack) => pack.scenarioIds.has(save.config.scenarioId)),
    houseRules,
    expert: isExpertSave(save),
  };
}

/** The pack id of the house rule Lost Traits (`content-packs/community/lost-traits-bf`). */
export const LOST_TRAITS_PACK_ID = "lost-traits-bf";

/** What the history says about mods, counted once for every built-in definition to read. */
export interface ModFacts {
  /** Pack ids ever installed, and the kinds of those packs (`mod-installs.ts`). */
  readonly installed: ReadonlySet<string>;
  readonly installedKinds: ReadonlySet<string>;
  readonly playedCommunityHero: boolean;
  readonly wonCommunityHero: boolean;
  readonly wonCommunityVillain: boolean;
  /** Won a game with a community hero seated against a community scenario. */
  readonly wonCommunityHeroVsVillain: boolean;
  /** Games won with a community hero or against a community scenario. */
  readonly communityWins: number;
  /** Distinct community hero identity ids that won a game. */
  readonly wonCommunityHeroIds: ReadonlySet<string>;
  readonly wonCommunityCampaign: boolean;
  readonly playedHouseRule: boolean;
  readonly wonHouseRule: boolean;
  readonly wonLostTraits: boolean;
  readonly playedTwoCommunityHeroes: boolean;
  readonly expertCommunityWin: boolean;
}

/** The part of the history `modFactsOf` reads. */
export interface ModHistory {
  readonly saves: readonly AchievementSave[];
  readonly campaigns: readonly AchievementCampaign[];
  readonly mods?: { readonly installed: Readonly<Record<string, string>> };
}

/** Finished, real games: a won or lost row that is not a Try-it lesson. Custom content counts here. */
const finishedGames = (saves: readonly AchievementSave[]): ModGame[] =>
  saves.filter((s) => !isLessonSave(s) && (s.status === "won" || s.status === "lost")).map(modGameOf);

export const NO_MOD_FACTS: ModFacts = modFactsOf({ saves: [], campaigns: [] });

export function modFactsOf(history: ModHistory): ModFacts {
  const games = finishedGames(history.saves);
  const wins = games.filter((g) => g.won);
  const communityWin = (g: ModGame): boolean => g.communityHeroes.size > 0 || g.communityVillain;
  const installed = history.mods?.installed ?? {};
  return {
    installed: new Set(Object.keys(installed)),
    installedKinds: new Set(Object.values(installed)),
    playedCommunityHero: games.some((g) => g.communityHeroes.size > 0),
    wonCommunityHero: wins.some((g) => g.communityHeroes.size > 0),
    wonCommunityVillain: wins.some((g) => g.communityVillain),
    wonCommunityHeroVsVillain: wins.some((g) => g.communityHeroes.size > 0 && g.communityVillain),
    communityWins: wins.filter(communityWin).length,
    wonCommunityHeroIds: new Set(wins.flatMap((g) => [...g.communityHeroes])),
    wonCommunityCampaign: history.campaigns.some((c) => c.status === "won" && c.pack !== undefined),
    playedHouseRule: games.some((g) => g.houseRules.length > 0),
    wonHouseRule: wins.some((g) => g.houseRules.length > 0),
    wonLostTraits: wins.some((g) => g.houseRules.includes(LOST_TRAITS_PACK_ID)),
    playedTwoCommunityHeroes: games.some((g) => g.communityHeroes.size >= 2),
    expertCommunityWin: wins.some((g) => g.expert && communityWin(g)),
  };
}

const flag = (on: boolean): AchievementProgress => ({ current: on ? 1 : 0, target: 1 });
const count = (current: number, target: number): AchievementProgress => ({
  current: Math.min(current, target),
  target,
});

/** The pack kinds the store lists: "one of each" needs them all. */
export const MOD_KINDS: readonly string[] = ["hero", "scenario", "modular", "campaign", "art", "house-rule"];

export interface ModAchievementRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Show a progress bar (it counts something). */
  readonly showProgress: boolean;
  readonly measure: (facts: ModFacts) => AchievementProgress;
}

/** Built-in mod achievements, in the Trophy Room's order. All are worth no points. */
export const MOD_ACHIEVEMENT_ROWS: readonly ModAchievementRow[] = [
  {
    id: "mods-install-1",
    name: "Fan Service",
    description: "Install your first mod from the Mod Store.",
    showProgress: false,
    measure: (f) => flag(f.installed.size >= 1),
  },
  {
    id: "mods-install-5",
    name: "Longbox Hoarder",
    description: "Install 5 mods.",
    showProgress: true,
    measure: (f) => count(f.installed.size, 5),
  },
  {
    id: "mods-install-10",
    name: "The Whole Back Issue Bin",
    description: "Install 10 mods.",
    showProgress: true,
    measure: (f) => count(f.installed.size, 10),
  },
  {
    id: "mods-install-every-kind",
    name: "One of Each, Please",
    description: "Install one mod of every kind: hero, scenario, modular set, campaign, art and house rule.",
    showProgress: true,
    measure: (f) => count(MOD_KINDS.filter((k) => f.installedKinds.has(k)).length, MOD_KINDS.length),
  },
  {
    id: "mods-play-hero",
    name: "Guest Star",
    description: "Finish a game with a community hero seated.",
    showProgress: false,
    measure: (f) => flag(f.playedCommunityHero),
  },
  {
    id: "mods-win-hero",
    name: "Fan Favorite",
    description: "Win a game with a community hero.",
    showProgress: false,
    measure: (f) => flag(f.wonCommunityHero),
  },
  {
    id: "mods-win-villain",
    name: "New Kid in the Rogues' Gallery",
    description: "Beat the villain of a community scenario.",
    showProgress: false,
    measure: (f) => flag(f.wonCommunityVillain),
  },
  {
    id: "mods-win-hero-vs-villain",
    name: "Original Cast Only",
    description: "Win with a community hero against a community scenario's villain.",
    showProgress: false,
    measure: (f) => flag(f.wonCommunityHeroVsVillain),
  },
  {
    id: "mods-win-campaign",
    name: "Fan Fiction, Canon",
    description: "Win a community campaign.",
    showProgress: false,
    measure: (f) => flag(f.wonCommunityCampaign),
  },
  {
    id: "mods-two-heroes",
    name: "Crossover Event",
    description: "Finish a game with two community heroes seated.",
    showProgress: false,
    measure: (f) => flag(f.playedTwoCommunityHeroes),
  },
  {
    id: "mods-house-rule",
    name: "House Rules Apply",
    description: "Finish a game with a house rule switched on.",
    showProgress: false,
    measure: (f) => flag(f.playedHouseRule),
  },
  {
    id: "mods-lost-traits-win",
    name: "Lost and Found",
    description: "Win a game with the Lost Traits house rule on.",
    showProgress: false,
    measure: (f) => flag(f.wonLostTraits),
  },
  {
    id: "mods-expert-win",
    name: "Hard Mode, Mod Mode",
    description: "Win on Expert with a community hero, or against a community scenario.",
    showProgress: false,
    measure: (f) => flag(f.expertCommunityWin),
  },
  {
    id: "mods-wins-5",
    name: "Mod Squad",
    description: "Win 5 games with community content: a community hero or a community scenario.",
    showProgress: true,
    measure: (f) => count(f.communityWins, 5),
  },
  {
    id: "mods-heroes-3",
    name: "Expanded Roster",
    description: "Win with 3 different community heroes.",
    showProgress: true,
    measure: (f) => count(f.wonCommunityHeroIds.size, 3),
  },
];

/** The id a pack's achievement has everywhere in the game: scoped by its pack. */
export const packAchievementId = (packId: string, localId: string): string => `pack:${packId}/${localId}`;

/** One pack's achievement, with where it comes from and how far along it is. */
export interface PackAchievementRead {
  readonly id: string;
  readonly packId: string;
  readonly packName: string;
  readonly name: string;
  readonly description: string;
  readonly showProgress: boolean;
  readonly progress: AchievementProgress;
}

/** A pack whose achievements are listed: installed and loaded now, or remembered from a game's embedded copy. */
export interface PackAchievementSource {
  readonly id: string;
  readonly name: string;
  readonly achievements: readonly PackAchievement[];
  /** Installed and loaded now. A pack that is not is listed only for what was earned from it. */
  readonly installed: boolean;
}

/** Whether a finished game counts toward `when`'s filters. */
function matchesFilters(when: PackAchievementWhen, game: ModGame, packId: string): boolean {
  if (when.hero !== undefined && !game.identities.includes(when.hero)) return false;
  if (when.villain !== undefined && game.save.config.scenarioId !== when.villain) return false;
  if (when.expert === true && !game.expert) return false;
  if (when.houseRule !== undefined && !game.houseRules.includes(packId)) return false;
  return true;
}

/** How far a pack achievement is, from the finished games that carry the pack (and the campaigns it ran). */
export function measurePackAchievement(
  achievement: PackAchievement,
  packId: string,
  games: readonly ModGame[],
  campaigns: readonly AchievementCampaign[],
): { readonly progress: AchievementProgress; readonly showProgress: boolean } {
  const when = achievement.when;
  if (when.campaignWon !== undefined) {
    // The run must be of THIS pack's campaign: a campaign id alone could collide across packs.
    const won = campaigns.some(
      (c) => c.status === "won" && isRecord(c.pack) && c.pack.id === packId && c.campaignId === when.campaignWon,
    );
    return { progress: flag(won), showProgress: false };
  }
  const mine = games.filter((g) => g.packs.some((p) => p.id === packId) && matchesFilters(when, g, packId));
  const wins = mine.filter((g) => g.won).length;
  if (when.gamesWon !== undefined) return { progress: count(wins, when.gamesWon), showProgress: when.gamesWon > 1 };
  if (when.gamesPlayed !== undefined)
    return { progress: count(mine.length, when.gamesPlayed), showProgress: when.gamesPlayed > 1 };
  if (when.win === true) return { progress: flag(wins > 0), showProgress: false };
  return { progress: flag(mine.length > 0), showProgress: false };
}

/**
 * The pack achievements to list and measure: every achievement of an installed pack (earned or not), and, for a pack
 * no longer installed, the ones already earned from it, read from the copy its games embedded (`earned persists`).
 */
export function packAchievementsOf(
  history: ModHistory & { readonly packs?: readonly PackAchievementSource[] },
): readonly PackAchievementRead[] {
  const games = finishedGames(history.saves);
  const sources = new Map<string, PackAchievementSource>();
  const embedded = new Map<string, readonly PackAchievement[]>();
  // A game's embedded copy first (the later game wins), so what an uninstalled pack defined is still known...
  for (const game of games) {
    for (const pack of game.packs) {
      if (pack.achievements.length > 0) {
        embedded.set(pack.id, pack.achievements);
        sources.set(pack.id, { id: pack.id, name: pack.name, achievements: pack.achievements, installed: false });
      }
    }
  }
  // ...then the installed pack's own current list replaces it.
  for (const pack of history.packs ?? []) sources.set(pack.id, pack);
  const out: PackAchievementRead[] = [];
  for (const source of sources.values()) {
    // What a game embedded that the installed version no longer lists (renamed or dropped in an update) stays while earned.
    const current = new Set(source.achievements.map((a) => a.id));
    const dropped = source.installed ? (embedded.get(source.id) ?? []).filter((a) => !current.has(a.id)) : [];
    for (const achievement of [...source.achievements, ...dropped]) {
      const { progress, showProgress } = measurePackAchievement(achievement, source.id, games, history.campaigns);
      const earned = progress.current >= progress.target;
      if ((!source.installed || dropped.includes(achievement)) && !earned) continue;
      out.push({
        id: packAchievementId(source.id, achievement.id),
        packId: source.id,
        packName: source.name,
        name: achievement.name,
        description: achievement.description,
        showProgress,
        progress,
      });
    }
  }
  return out;
}
