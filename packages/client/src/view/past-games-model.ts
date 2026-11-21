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
import { hit } from "../tokens.js";
import { isCurrentSchema, isLessonSave, writtenByNewerApp, type SaveMeta } from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { CLIENT_VERSION } from "../version.js";
import { aspectName, aspectStampOf, type AspectStamp } from "./aspect-stamp.js";
import { queryScoreOf } from "./deck-search.js";
import { gameLabelOf } from "./continue-label.js";
import type { GamesListNames } from "./games-list-model.js";
import type { Rect } from "./layout.js";

/** `conceded`: the players gave the game up, which the save stores as `abandoned` (`EngineSessionCore.statusOf`). */
export type PastGameResult = "won" | "lost" | "conceded" | "unfinished";

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
    case "abandoned":
      return (save.outcome as { readonly result?: string } | null)?.result === "conceded" ? "conceded" : "unfinished";
    default:
      return null;
  }
}

function reasonOf(save: SaveMeta, result: PastGameResult): PastGameReason {
  if (result === "unfinished") return "unfinished";
  if (result === "conceded") return "conceded";
  const outcome = save.outcome as { readonly result: string; readonly reason?: string } | null;
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
    .filter((save) => filter === "all" || resultOf(save) === filter)
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
    won: past.filter((save) => save.status === "won").length,
    lost: past.filter((save) => save.status === "lost").length,
  };
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

/** A card picture's width to height. */
const CARD_RATIO = 63 / 88;
const ROW_PAD = 10;
const PICTURE_GAP = 6;
/** At most this many heroes are pictured on a row (a game seats four). */
const MAX_PICTURED_HEROES = 4;
/** From this row width the pictures sit beside the text; narrower (a phone), they make a strip above it. */
export const ROW_SIDE_BY_SIDE_FROM = 520;
/** The phone row's picture strip, and the wide row's pictures. */
const STRIP_HEIGHT = 64;
const SIDE_HEIGHT = 84;
/** Room for the result, title (up to two lines), detail and fates lines. */
const TEXT_HEIGHT = 96;

/** A row's height at `width`. */
export function pastGameRowHeight(width: number): number {
  return width >= ROW_SIDE_BY_SIDE_FROM
    ? ROW_PAD + Math.max(SIDE_HEIGHT, TEXT_HEIGHT) + ROW_PAD
    : ROW_PAD + STRIP_HEIGHT + 8 + TEXT_HEIGHT + ROW_PAD;
}

export interface PastGameRowParts {
  /** The villain's picture, then each hero's. */
  readonly pictures: readonly Rect[];
  /** The result, title, detail and fates lines. */
  readonly text: Rect;
}

/** Where a row's parts sit inside `row`, for a game of `heroes` seats. */
export function pastGameRowParts(row: Rect, heroes: number): PastGameRowParts {
  const sideBySide = row.width >= ROW_SIDE_BY_SIDE_FROM;
  const height = sideBySide ? SIDE_HEIGHT : STRIP_HEIGHT;
  const pictureWidth = Math.round(height * CARD_RATIO);
  const top = row.y + ROW_PAD;
  const count = 1 + Math.min(MAX_PICTURED_HEROES, heroes);
  const pictures = Array.from({ length: count }, (_, i) => ({
    // A gap wider than the rest sets the villain apart from the heroes.
    x: row.x + ROW_PAD + i * (pictureWidth + PICTURE_GAP) + (i > 0 ? PICTURE_GAP * 2 : 0),
    y: top,
    width: pictureWidth,
    height,
  }));
  if (!sideBySide) {
    const textY = top + STRIP_HEIGHT + 8;
    return { pictures, text: { x: row.x + ROW_PAD, y: textY, width: row.width - ROW_PAD * 2, height: TEXT_HEIGHT } };
  }
  const textX = pictures.at(-1)!.x + pictureWidth + PICTURE_GAP + 8;
  return { pictures, text: { x: textX, y: top, width: row.x + row.width - ROW_PAD - textX, height: TEXT_HEIGHT } };
}

/**
 * Whether the details sit in a side panel beside the list (desktop and tablet, either way up) or open as a popup over
 * it (a phone).
 */
export const pastGamesSidePanel = (width: number): boolean => width >= 700;

/** The side panel's width, and the list's widest beside it. */
const PANEL_MAX_WIDTH = 440;
const PANEL_MIN_WIDTH = 320;
const LIST_MAX_WIDTH = 760;

export interface PastGamesLayout {
  readonly list: Rect;
  /** The details: a side panel, or (on a phone) the popup's card. */
  readonly details: Rect;
  readonly side: boolean;
}

/** The list and the details inside `area` (the room under the tabs), on a screen `screen` wide and high. */
export function pastGamesLayout(
  area: Rect,
  screen: { readonly width: number; readonly height: number },
): PastGamesLayout {
  if (!pastGamesSidePanel(screen.width)) {
    const margin = 12;
    const width = Math.min(screen.width - margin * 2, 460);
    const height = Math.min(screen.height - margin * 2, 640);
    return {
      list: area,
      details: { x: (screen.width - width) / 2, y: (screen.height - height) / 2, width, height },
      side: false,
    };
  }
  const gap = 16;
  const panelWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, Math.round(area.width * 0.42)));
  const listWidth = Math.min(LIST_MAX_WIDTH, area.width - panelWidth - gap);
  const left = area.x + (area.width - listWidth - gap - panelWidth) / 2;
  return {
    list: { x: left, y: area.y, width: listWidth, height: area.height },
    details: { x: left + listWidth + gap, y: area.y, width: panelWidth, height: area.height },
    side: true,
  };
}

export interface PastGameDetailParts {
  /** The close button: the popup only. */
  readonly close: Rect | null;
  /** The villain's picture, then each hero's, larger than the row's. */
  readonly pictures: readonly Rect[];
  /** Where the words start and how wide they run; they end above the actions. */
  readonly text: Rect;
  readonly actions: Readonly<Record<PastGameAction, Rect>>;
}

/** The details' parts inside `panel` for a game of `heroes` seats; `popup` adds a close button at the top right. */
export function pastGameDetailParts(panel: Rect, heroes: number, popup: boolean): PastGameDetailParts {
  const pad = 14;
  const inner = panel.width - pad * 2;
  const close: Rect | null = popup
    ? { x: panel.x + panel.width - pad - hit.target, y: panel.y + pad, width: hit.target, height: hit.target }
    : null;
  // The villain larger, the heroes in a row beside it, all fitting the panel's width.
  const count = Math.min(MAX_PICTURED_HEROES, heroes);
  const gap = 8;
  const top = panel.y + pad + (popup ? hit.target + 6 : 0);
  // Rounded down, so the heroes after the villain (and their 6px gaps) never run past the panel.
  const villainHeight = Math.min(150, Math.floor((inner - gap - 6 * count) / (1 + count * 0.62) / CARD_RATIO) - 2);
  const heroHeight = Math.round(villainHeight * 0.62);
  const villain: Rect = {
    x: panel.x + pad,
    y: top,
    width: Math.round(villainHeight * CARD_RATIO),
    height: villainHeight,
  };
  const heroWidth = Math.round(heroHeight * CARD_RATIO);
  const heroes_ = Array.from({ length: count }, (_, i) => ({
    x: villain.x + villain.width + gap + i * (heroWidth + 6),
    y: top + villainHeight - heroHeight,
    width: heroWidth,
    height: heroHeight,
  }));
  const buttonsBottom = panel.y + panel.height - pad;
  const small = (inner - gap * 2) / 3;
  const row2: Rect = { x: panel.x + pad, y: buttonsBottom - hit.target, width: small, height: hit.target };
  const actions: Record<PastGameAction, Rect> = {
    watch: { x: panel.x + pad, y: row2.y - gap - hit.primary, width: inner, height: hit.primary },
    share: row2,
    export: { ...row2, x: row2.x + small + gap },
    log: { ...row2, x: row2.x + (small + gap) * 2 },
  };
  const textY = top + villainHeight + 12;
  return {
    close,
    pictures: [villain, ...heroes_],
    text: { x: panel.x + pad, y: textY, width: inner, height: Math.max(0, actions.watch.y - 10 - textY) },
    actions,
  };
}

/**
 * Where a game's exported log stops short: the moves this build could replay (`ReplayInfo.length`) when a command
 * failed or the replay ends before the log does, else null for a log that runs to the end.
 */
export function partialLogStop(
  info: { readonly length: number; readonly total: number; readonly failure: unknown } | null,
): number | null {
  return info && (info.failure !== null || info.length < info.total) ? info.length : null;
}
