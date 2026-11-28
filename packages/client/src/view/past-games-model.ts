/**
 * Past games (issue #706): the catalog of finished games saved on this device, each one to look over, watch as a
 * replay, share as a link or export (`scenes/past-games.ts` draws it). Plain data and geometry here.
 *
 * A past game is a save whose game is over: won, lost, or left unfinished (retired from the in-progress list, which
 * marks it `abandoned`). Saves this build cannot replay are left out: one a newer build wrote, one of a retired schema
 * (`incompatible`), and an aspect or mechanic lesson (a scripted demonstration, not a game the player played). A game
 * retired before its first move has nothing to watch and is left out too.
 *
 * Each row says how the game went before it is watched: the villain and the heroes, won or lost and why (the villain
 * defeated, the scheme completed, every hero defeated), how many rounds, and which heroes fell and which stood. Who
 * fell is the game summary's (`engine/game-summary.ts`), written when a game ends; a game with no summary (one left
 * unfinished, or one from before summaries) says only what its save knows.
 */
import {
  isCompetitiveSave,
  isCurrentSchema,
  isLessonSave,
  writtenByNewerApp,
  type SaveMeta,
} from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { CLIENT_VERSION } from "../version.js";
import { aspectName, aspectStampOf, type AspectStamp } from "./aspect-stamp.js";
import { queryScoreOf } from "./deck-search.js";
import { gameLabelOf } from "./continue-label.js";
import type { GamesListNames } from "./games-list-model.js";
import type { Rect } from "./layout.js";

/** `conceded`: the players gave the game up, which the save stores as `abandoned` (`EngineSessionCore.statusOf`). */
/** `tie`: a competitive game (issue #883) this device's team neither won nor lost (`view/team-outcome.ts`). */
export type PastGameResult = "won" | "lost" | "tie" | "conceded" | "unfinished";

/** Why the game ended, as the row and the details word it. */
export type PastGameReason =
  | "villainDefeated"
  | "schemeCompleted"
  | "heroesDefeated"
  | "conceded"
  /** A card's own text lost the game (Odin leaving play). */
  | "cardLoss"
  /** The encounter deck ran out where a scenario loses on it (`GameOutcome` `encounterDeckExhausted`). */
  | "encounterDeckExhausted"
  | "unfinished"
  /** A competitive game (MC56 p. 17): its per-team result, worded by the competitive game-over screen. */
  | "competitive"
  /** Won or lost, but the save does not say how. */
  | "unknown";

/** The filter tabs along the top: every game, or only the wins or the losses. */
export const PAST_GAME_FILTERS = ["all", "won", "lost"] as const;
export type PastGameFilter = (typeof PAST_GAME_FILTERS)[number];

export interface PastGameNames extends GamesListNames {
  /** A precon's hero, as its identity card id. */
  readonly starterIdentity: (starterDeckId: string) => string | undefined;
  /** A precon's aspects (raw ids), for a seat the save has no summary of; absent: none known. */
  readonly starterAspects?: (starterDeckId: string) => readonly string[] | undefined;
  /** The card that pictures a scenario (its villain, `scenarioCardIdOf`), or undefined when the pool has no such scenario. */
  readonly scenarioCardId: (scenarioId: string) => string | undefined;
  /** A card's display name, for the cards a seat played most; absent: the card id stands in. */
  readonly cardName?: (cardId: string) => string | undefined;
  /**
   * The names for a game that carries its own packs (`SessionConfig.packs`: a custom hero, scenario or set, embedded at
   * save time): the base names plus those packs' cards and scenarios, whether or not the packs are installed now, so a
   * finished game's cover and label name its custom hero and villain after the pack is gone (#758).
   */
  readonly forPacks?: (packs: readonly unknown[]) => PastGameNames;
}

export interface PastGameSeat {
  readonly identityCardId: string;
  readonly name: string;
  /** True when the hero was defeated during the game, false when they stood to the end; null when not recorded. */
  readonly fell: boolean | null;
  /** Damage dealt and threat removed over the game; null when not recorded. */
  readonly damage: number | null;
  readonly thwart: number | null;
  /** The seat's aspects as words ("Justice"), empty when the save does not say or the deck has none. */
  readonly aspects: readonly string[];
  /** The same aspects as raw ids ("pool"), in the same order, for the chips' colors (`aspectChipsOf`). */
  readonly aspectIds: readonly string[];
  /** The deck the seat played: a precon's name or the saved deck's name then; null when the save does not say. */
  readonly deckName: string | null;
  /** The cards the seat played most (at most three), most first; empty without card numbers (an older game, or none played). */
  readonly topCards: readonly { readonly cardId: string; readonly name: string; readonly count: number }[];
}

export interface PastGameRow {
  readonly id: string;
  /** "Rhino · Spider-Man": what the game was. */
  readonly title: string;
  readonly scenarioId: string;
  /** The campaign box's name for a campaign game; null for a standalone one. */
  readonly campaign: string | null;
  readonly result: PastGameResult;
  readonly reason: PastGameReason;
  readonly round: number;
  /** When the game ended (its last write). */
  readonly endedAt: number;
  /** Time spent playing, when the save counted it. */
  readonly playedMs: number | null;
  /** The villain's card (or the scenario's main scheme), for the hover; null when the pool doesn't know it. */
  readonly villainCardId: string | null;
  /** The scenario's name, the villain's picture's stand-in text when its art is not available (an uninstalled pack); null when unknown. */
  readonly villainName: string | null;
  /** Each seat, in seat order (a seat that sat the scenario out is left out). */
  readonly seats: readonly PastGameSeat[];
  readonly save: SaveMeta;
}

export function resultOf(save: Pick<SaveMeta, "status" | "outcome">): PastGameResult | null {
  switch (save.status) {
    case "won":
      return "won";
    case "lost":
      return "lost";
    case "tie":
      return "tie";
    case "abandoned": {
      // A competitive team's forfeit seen from both sides (hot seat, `seatResultOf`) is a concession too (issue #883).
      const outcome = save.outcome as { readonly result?: string; readonly reason?: string } | null;
      const conceded =
        outcome?.result === "conceded" || (outcome?.result === "teams" && outcome.reason === "teamConceded");
      return conceded ? "conceded" : "unfinished";
    }
    default:
      return null;
  }
}

function reasonOf(save: SaveMeta, result: PastGameResult): PastGameReason {
  if (result === "unfinished") return "unfinished";
  if (result === "conceded") return "conceded";
  const outcome = save.outcome as { readonly result: string; readonly reason?: string } | null;
  if (outcome?.result === "teams") return "competitive";
  if (outcome?.result === "win") return "villainDefeated";
  if (outcome?.reason === "mainSchemeCompleted") return "schemeCompleted";
  if (outcome?.reason === "allPlayersDefeated") return "heroesDefeated";
  if (outcome?.reason === "cardAbility") return "cardLoss";
  if (outcome?.reason === "encounterDeckExhausted") return "encounterDeckExhausted";
  if (outcome) return "unknown";
  switch (save.summary?.lossReason) {
    case "schemeCompleted":
      return "schemeCompleted";
    case "playersDefeated":
      return "heroesDefeated";
    case "conceded":
      return "conceded";
    case null:
      return result === "won" ? "villainDefeated" : "unknown";
    default:
      return "unknown";
  }
}

/** Whether a save belongs in the catalog: a game over that this build can replay (see the module comment). */
export function isPastGame(save: SaveMeta, appVersion: string = CLIENT_VERSION): boolean {
  return (
    resultOf(save) !== null &&
    save.commandCount > 0 &&
    // A retired older schema can't be replayed either (`game-storage.ts`); storage has already upgraded schema 3.
    isCurrentSchema(save) &&
    !isLessonSave(save) &&
    !writtenByNewerApp(save, appVersion)
  );
}

/** `names` widened with the game's own packs, when it carries any and the names know how. */
function namesOf(save: SaveMeta, names: PastGameNames): PastGameNames {
  const packs = save.config.packs;
  return packs && packs.length > 0 && names.forPacks ? names.forPacks(packs) : names;
}

const TOP_CARDS = 3;

/** An aspect's display word from the app's one name table (`aspectName`): "'Pool", never "Pool". */
const aspectWordOf = (aspect: string): string => aspectName(aspect);

const plainWord = (word: string): string => word.toLowerCase().replace(/^'/, "");

/**
 * A seat's aspect words that its deck's name does not already say ("Spider-Man (Justice)" says Justice), compared
 * without case or the 'Pool apostrophe, against the same display words the row shows.
 */
export function aspectsNotInName(deckName: string | null, aspects: readonly string[]): string[] {
  const name = deckName === null ? "" : plainWord(deckName);
  return aspects.filter((aspect) => !name.includes(plainWord(aspect)));
}

/** The deck a seat played (#756): the summary's record of it, else the game's own config seat. */
function deckNameOf(
  seat: { readonly starterDeckId?: string; readonly deckName?: string } | null,
  player: SessionConfig["players"][number] | undefined,
  names: PastGameNames,
): string | null {
  const starter = seat?.starterDeckId ?? (player && "starterDeckId" in player ? player.starterDeckId : undefined);
  if (starter) return names.starterDeckName(starter) ?? null;
  return seat?.deckName ?? (player && !("starterDeckId" in player) ? (player.deckName ?? null) : null);
}

function topCardsOf(plays: Readonly<Record<string, number>>, names: PastGameNames): PastGameSeat["topCards"] {
  return Object.entries(plays)
    .map(([cardId, count]) => ({ cardId, name: names.cardName?.(cardId) ?? cardId, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, TOP_CARDS);
}

function seatsOf(save: SaveMeta, names: PastGameNames): readonly PastGameSeat[] {
  const named = (identityCardId: string): string => names.identityName(identityCardId) ?? identityCardId;
  // A game left or given up before its end: a hero still up then did not stand to the end of anything.
  const result = resultOf(save);
  const unfinished = result === "unfinished" || result === "conceded";
  const summarized = save.summary?.seats;
  if (summarized && summarized.length > 0) {
    return summarized.flatMap((seat, index): PastGameSeat[] =>
      seat.satOut === true
        ? []
        : [
            {
              identityCardId: seat.identityCardId,
              name: named(seat.identityCardId),
              fell: seat.defeated ? true : unfinished ? null : false,
              damage: seat.damage,
              thwart: seat.thwart,
              aspects: (seat.aspects ?? []).map((aspect) => aspectWordOf(aspect)),
              aspectIds: [...(seat.aspects ?? [])],
              deckName: deckNameOf(seat, save.config.players[index], names),
              topCards: topCardsOf(seat.plays ?? {}, names),
            },
          ],
    );
  }
  // Every hero falls when every hero is defeated, even without a summary to say so.
  const wiped = reasonOf(save, resultOf(save) ?? "unfinished") === "heroesDefeated";
  return save.config.players.flatMap((player: SessionConfig["players"][number]) => {
    const identity =
      "identityCardId" in player ? (player.identityCardId as string) : names.starterIdentity(player.starterDeckId);
    if (!identity) return [];
    const ownAspects: readonly string[] =
      "identityCardId" in player ? (player.aspects ?? []) : (names.starterAspects?.(player.starterDeckId) ?? []);
    return [
      {
        identityCardId: identity,
        name: named(identity),
        fell: wiped ? true : null,
        damage: null,
        thwart: null,
        aspects: ownAspects.map((aspect) => aspectWordOf(aspect)),
        aspectIds: [...ownAspects],
        deckName: deckNameOf(null, player, names),
        topCards: [],
      },
    ];
  });
}

/** The catalog's rows for `filter`, most recently ended first. */
export function pastGameRowsOf(
  saves: readonly SaveMeta[],
  allNames: PastGameNames,
  filter: PastGameFilter = "all",
  appVersion: string = CLIENT_VERSION,
  query = "",
): readonly PastGameRow[] {
  return saves
    .filter((save) => isPastGame(save, appVersion))
    .filter((save) => inTab(save, filter))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((save) => {
      const result = resultOf(save)!;
      const names = namesOf(save, allNames);
      return {
        id: save.id,
        title: gameLabelOf(save.config, names),
        scenarioId: save.config.scenarioId,
        campaign: save.campaignId === null ? null : (names.campaignName(save.campaignId) ?? save.campaignId),
        result,
        reason: reasonOf(save, result),
        round: save.round,
        endedAt: save.updatedAt,
        playedMs: save.playedMs ?? null,
        villainCardId: names.scenarioCardId(save.config.scenarioId) ?? null,
        villainName: names.scenarioName(save.config.scenarioId) ?? null,
        seats: seatsOf(save, names),
        save,
      };
    })
    .filter((row) => pastGameMatches(row, query));
}

/**
 * Whether a row matches the search box: every word of `query` finds a hero's name, the villain or scenario, the title,
 * a deck's name, the campaign or an aspect, through the app's one fuzzy matcher (`queryScoreOf`: accents and case
 * ignored, a typo or a letter left out forgiven, partial words). An empty query matches every row. The names are the
 * ones the row shows, so they follow the language the screen is in.
 */
export function pastGameMatches(row: PastGameRow, query: string): boolean {
  if (query.trim() === "") return true;
  return (
    queryScoreOf(query, {
      primary: [
        row.title,
        row.villainName,
        ...row.seats.map((seat) => seat.name),
        ...row.seats.map((seat) => seat.deckName),
        row.campaign,
      ],
      secondary: row.seats.flatMap((seat) => seat.aspects),
    }) !== null
  );
}

/** How many past games each filter holds, for the tabs' counts. */
export function pastGameCounts(
  saves: readonly SaveMeta[],
  appVersion: string = CLIENT_VERSION,
  search?: { readonly query: string; readonly names: PastGameNames },
): Readonly<Record<PastGameFilter, number>> {
  // With a search typed, each tab counts what the search leaves it, so the tabs and the list agree.
  if (search && search.query.trim() !== "") {
    const rows = pastGameRowsOf(saves, search.names, "all", appVersion, search.query);
    const won = rows.filter((row) => row.result === "won").length;
    const lost = rows.filter((row) => row.result === "lost").length;
    return { all: rows.length, won, lost };
  }
  const past = saves.filter((save) => isPastGame(save, appVersion));
  return {
    all: past.length,
    won: past.filter((save) => inTab(save, "won")).length,
    lost: past.filter((save) => inTab(save, "lost")).length,
  };
}

/**
 * Whether a save belongs under a filter tab. A competitive game counts as played only (the owner, 2026-11-20; issue
 * #883): it is listed under All, never under Won or Lost, whatever its team's result.
 */
function inTab(save: SaveMeta, filter: PastGameFilter): boolean {
  if (filter === "all") return true;
  return !isCompetitiveSave(save) && resultOf(save) === filter;
}

/** Whole minutes played, at least one: "42". Null when the save didn't count the time. */
export function playedMinutesOf(playedMs: number | null): number | null {
  return playedMs === null ? null : Math.max(1, Math.round(playedMs / 60_000));
}

/**
 * Who fell and who stood, for the row's last line: the fallen first, then those who stood. Heroes the save cannot
 * speak for are not listed; an empty answer means there is nothing to say.
 */
export function seatFatesOf(seats: readonly PastGameSeat[]): {
  readonly fell: readonly string[];
  readonly stood: readonly string[];
  /** Every hero fell. */
  readonly wiped: boolean;
} {
  const fell = seats.filter((seat) => seat.fell === true).map((seat) => seat.name);
  const stood = seats.filter((seat) => seat.fell === false).map((seat) => seat.name);
  return { fell, stood, wiped: seats.length > 0 && fell.length === seats.length };
}

/** The four per-game actions in the details: Watch, then Share, Export and Log. */
export const PAST_GAME_ACTIONS = ["watch", "share", "export", "log"] as const;
export type PastGameAction = (typeof PAST_GAME_ACTIONS)[number];

const CORE_ASPECTS = ["aggression", "justice", "protection", "leadership", "pool", "basic"] as const;
type CoreAspectId = (typeof CORE_ASPECTS)[number];
const isCoreAspect = (aspect: string): aspect is CoreAspectId => (CORE_ASPECTS as readonly string[]).includes(aspect);

/** A short code for each aspect, for a chip too narrow to spell it. */
const ASPECT_CODE: Readonly<Record<CoreAspectId, string>> = {
  aggression: "AGG",
  justice: "JUS",
  protection: "PRO",
  leadership: "LDR",
  pool: "'PL",
  basic: "BAS",
};

export interface AspectChip {
  readonly rect: Rect;
  readonly stamp: AspectStamp;
  /** What the chip says: the aspect's name, its three-letter code, or its first letter, by the room it has. Never color alone. */
  readonly text: string;
  readonly fontSize: number;
}

/** The chip strip's height, and the width a letter of its upper-case type takes at `CHIP_FONT`. */
export const CHIP_HEIGHT = 14;
const CHIP_FONT = 9;
const CHIP_LETTER = CHIP_FONT * 0.78;
const CHIP_PAD = 3;

/**
 * The aspect chips along the bottom of a hero's picture `pic`: one per aspect the seat's deck used, side by side across
 * the picture's width (two aspects get two halves, Adam Warlock's four get four quarters), each in the aspect's frame
 * color and saying its name, else a three-letter code, else its first letter, whichever fits. Aspects the app has no
 * frame color for (a custom hero set's own) and repeats are left out; a seat with none gets no chips.
 */
export function aspectChipsOf(pic: Rect, aspectIds: readonly string[]): readonly AspectChip[] {
  const ids = [...new Set(aspectIds.filter(isCoreAspect))];
  if (ids.length === 0) return [];
  const width = pic.width / ids.length;
  const y = pic.y + pic.height - CHIP_HEIGHT;
  return ids.map((id, i) => {
    const stamp = aspectStampOf(id);
    const room = width - CHIP_PAD * 2;
    const full = stamp.label.toUpperCase();
    const code = ASPECT_CODE[id];
    const text =
      full.length * CHIP_LETTER <= room
        ? full
        : code.length * CHIP_LETTER <= room
          ? code
          : stamp.label.replace(/^'/, "").charAt(0).toUpperCase();
    return { rect: { x: pic.x + i * width, y, width, height: CHIP_HEIGHT }, stamp, text, fontSize: CHIP_FONT };
  });
}

/** One aspect's chip on a hero's picture, as words: the name, the code and the first letter (the element picks by the room it has). */
export interface AspectBadgeText {
  readonly id: CoreAspectId;
  readonly full: string;
  readonly code: string;
  readonly letter: string;
}

/**
 * The aspect chips of a hero's picture, as the words each can say: one per aspect the seat's deck used (the ones the app
 * has a frame color for, each once), in the deck's order. A seat with none gets none. `mc-past-game-aspects` writes the one
 * that fits its width; the order and the aspects are `aspectChipsOf`'s.
 */
export function aspectBadgesOf(aspectIds: readonly string[]): readonly AspectBadgeText[] {
  return [...new Set(aspectIds.filter(isCoreAspect))].map((id) => {
    const stamp = aspectStampOf(id);
    return {
      id,
      full: stamp.label.toUpperCase(),
      code: ASPECT_CODE[id],
      letter: stamp.label.replace(/^'/, "").charAt(0).toUpperCase(),
    };
  });
}

/**
 * Whether the details sit in a side panel beside the list (desktop and tablet, either way up) or open as a popup over
 * it (a phone).
 */
export const pastGamesSidePanel = (width: number): boolean => width >= 700;

/**
 * Where a game's exported log stops short: the moves this build could replay (`ReplayInfo.length`) when a command
 * failed or the replay ends before the log does, else null for a log that runs to the end.
 */
export function partialLogStop(
  info: { readonly length: number; readonly total: number; readonly failure: unknown } | null,
): number | null {
  return info && (info.failure !== null || info.length < info.total) ? info.length : null;
}
