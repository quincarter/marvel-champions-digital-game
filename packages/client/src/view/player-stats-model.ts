/**
 * The Stats screen (`scenes/player-stats.ts`), as plain data: what the player's finished games say about how they play.
 * Folded from the saved games' rows (`GameStorage.list()`), never from a live game, so it reads the same on every visit.
 *
 * **Which games count.** A game that finished as a win or a loss is a result. A concession (`abandoned` with a
 * `conceded` outcome) is counted on its own line and in no record. A guided game (the tutorial, a Try-it lesson) is a
 * teaching game and counts nowhere; a game still being played, an abandoned one and an incompatible save have no result.
 *
 * **Older games.** Wins, losses, heroes, villains and scenarios come from the save's own config, so every finished game
 * counts toward them. Card, side scheme, damage and thwart numbers come from the game's summary (`SeatSummary`), which
 * only games finished since the summary had them carry; the screen says how many older games those lists leave out.
 *
 * Pure: the names come in through `StatsNames`, so the pool is read wherever this runs (the stats worker) and the tests
 * pass a small stand-in.
 */
import type { CorePlayer } from "@mc/cards";
import type { SaveMeta } from "../engine/game-storage.js";
import type { GameSummary, SeatSummary } from "../engine/game-summary.js";
import { villainNameOf } from "./deck-insights.js";

export interface StatsNames {
  readonly cardName: (cardId: string) => string | undefined;
  /** The card's type (`AnyCard["type"]`), or undefined for a card the pool does not have. */
  readonly cardType: (cardId: string) => string | undefined;
  /** The card's printed aspect (`aggression`, `basic`, `hero:…`), or undefined for a card with none. */
  readonly cardAspect: (cardId: string) => string | undefined;
  readonly scenarioName: (scenarioId: string) => string | undefined;
  readonly starterDeck: (
    starterDeckId: string,
  ) => { readonly identityCardId: string; readonly aspects: readonly string[] } | undefined;
  /** The modular sets a scenario uses when a game names none (its recommended ones). */
  readonly scenarioModulars?: (scenarioId: string) => readonly string[];
  /** An encounter set's name. */
  readonly setName?: (setId: string) => string | undefined;
}

export type StatRow =
  | {
      readonly kind: "stat";
      readonly id: string;
      readonly label: string;
      readonly value: string;
      /** A second line under the label, or empty. */
      readonly detail: string;
      /** A headline fact (a favorite, a best): drawn filled. */
      readonly highlight?: true;
      /** The card the row is about, for the hover popover; absent on a row about no one card. */
      readonly cardId?: string;
      /** Why the row's games were lost, for its small stacked bar; absent on a row with no losses to show. */
      readonly losses?: readonly LossPart[];
    }
  | { readonly kind: "note"; readonly id: string; readonly text: string };

/** Why games were lost: the completed scheme, or what dealt the last hero's defeating blow (`GameSummary.defeatedBy`). */
export type LossCause = "scheme" | "villain" | "minions" | "encounter" | "other" | "unknown";

/** One cause's share of a row's losses. */
export interface LossPart {
  readonly cause: LossCause;
  readonly label: string;
  readonly count: number;
}

export interface StatsSection {
  readonly id: string;
  readonly title: string;
  /** What is under the heading, shown at its right ("12 games"). */
  readonly count: string;
  readonly rows: readonly StatRow[];
}

export interface StatsHeader {
  /** "12–5". */
  readonly record: string;
  /** "71% win rate" or "No games yet". */
  readonly rate: string;
  /** "17 games played". */
  readonly played: string;
  /** "Best streak 4 · Current: 2 wins". */
  readonly streak: string;
  /** 0 to 1: wins over results. */
  readonly fraction: number;
}

/**
 * One Overview tile (the dashboard's first tab). `art` names the picture a portrait tile shows: a hero's by identity,
 * a villain's by scenario.
 */
export type OverviewTile =
  | {
      readonly kind: "record";
      readonly id: string;
      readonly record: string;
      readonly rate: string;
      readonly fraction: number;
      readonly detail: string;
    }
  | {
      readonly kind: "split";
      readonly id: string;
      readonly label: string;
      readonly parts: readonly {
        readonly label: string;
        readonly count: number;
        readonly tone: "caution" | "ink" | "muted";
      }[];
      readonly detail: string;
    }
  | {
      readonly kind: "figures";
      readonly id: string;
      readonly label: string;
      readonly lines: readonly { readonly label: string; readonly value: string }[];
    }
  | {
      readonly kind: "portrait";
      readonly id: string;
      readonly label: string;
      readonly name: string;
      readonly detail: string;
      readonly extra: string;
      readonly art: { readonly hero: string } | { readonly scenario: string };
      /** Filled ink: the headline tile of its row. */
      readonly wide: boolean;
    }
  | {
      readonly kind: "small";
      readonly id: string;
      readonly label: string;
      readonly value: string;
      readonly detail: string;
    };

export interface OverviewTiles {
  readonly tiles: readonly OverviewTile[];
  /** The "older games" note, or null. */
  readonly note: string | null;
}

/** The Cards by hero tab for one hero: aspects, then groups of card pictures with their counts. */
export interface HeroCardsView {
  readonly identityCardId: string;
  readonly name: string;
  readonly games: string;
  readonly aspects: readonly { readonly aspect: string; readonly label: string; readonly detail: string }[];
  readonly groups: readonly {
    readonly id: string;
    readonly title: string;
    readonly cards: readonly {
      readonly cardId: string;
      readonly value: string;
      readonly detail: string;
      /** A hero's own card (its aspect is `hero:<id>`): the "Hide hero cards" toggle leaves these out. */
      readonly signature?: true;
    }[];
  }[];
  /** Why there are no card groups yet, or null. */
  readonly note: string | null;
}

export interface PlayerStats {
  readonly header: StatsHeader;
  /**
   * Every section as rows: Overview, Heroes, Villains, Side schemes, Devices (when any game says where it was played),
   * then one cards section per hero. The dashboard shows the Overview as `overview` and the cards as `heroCards`; the
   * rows are the same facts as a list.
   */
  readonly sections: readonly StatsSection[];
  readonly overview: OverviewTiles;
  /** Most played hero first. */
  readonly heroCards: readonly HeroCardsView[];
  /** The Cards tab: every hero's games together (no aspects), or null before any game has card numbers. */
  readonly allCards: HeroCardsView | null;
  /** The Aspects tab's donut: each aspect's share of your games, most played first. */
  readonly aspects: readonly AspectShare[];
  /** The filter these stats were folded with, and what else it could be (from every game, not just the filtered). */
  readonly filter: StatsFilter;
  readonly filterOptions: StatsFilterOptions;
}

/** Narrows every tab to some games (the chips under the tabs): one hero's, one villain's, one difficulty's. */
export interface StatsFilter {
  /** An identity card id: games it sat at. */
  readonly hero?: string | undefined;
  /** A villain's name as the Villains tab gives it. */
  readonly villain?: string | undefined;
  readonly difficulty?: "standard" | "expert" | "extreme" | undefined;
}

/** What the filter chips step through: every hero, villain and difficulty in your games, most played first. */
export interface StatsFilterOptions {
  readonly heroes: readonly { readonly id: string; readonly name: string }[];
  readonly villains: readonly string[];
  readonly difficulties: readonly ("standard" | "expert" | "extreme")[];
}

/** One finished game, reduced to what the stats read. */
interface GameFacts {
  readonly result: "won" | "lost";
  readonly at: number;
  readonly round: number;
  readonly scenarioId: string;
  /** What the villain section groups by: the scenario and any villain choice its setup made. */
  readonly villainKey: string;
  /** The villain's name as the newest game with the same `villainKey` gives it. */
  readonly villain: string;
  readonly expert: boolean;
  readonly difficulty: "standard" | "expert" | "extreme";
  /** The modular encounter sets the game was built with. */
  readonly modulars: readonly string[];
  /** The save's summary, for the numbers only it holds (records, the final blow); null on an older save. */
  readonly summary: GameSummary | null;
  readonly lossReason: "schemeCompleted" | "playersDefeated" | "other" | null;
  /** Why a lost game was lost, finer than `lossReason`; null for a win. */
  readonly lossCause: LossCause | null;
  readonly heroesDefeated: number | null;
  readonly seats: readonly SeatFacts[];
  /** The summary carried per-seat card numbers (a game finished since `SeatSummary` existed). */
  readonly detailed: boolean;
  readonly sideSchemes: GameSummarySideSchemes | null;
  /** Where the game was last played (`SaveMeta.lastPlayedOn`, device sync), or null when the save does not say. */
  readonly platform: string | null;
  /** Time spent playing it (`SaveMeta.playedMs`), or null for a game from before it was kept. */
  readonly playedMs: number | null;
}

type GameSummarySideSchemes = NonNullable<NonNullable<SaveMeta["summary"]>["sideSchemes"]>;

interface SeatFacts {
  readonly identityCardId: string;
  readonly aspects: readonly string[];
  readonly summary: SeatSummary | null;
}

const ASPECT_LABELS: Readonly<Record<string, string>> = {
  aggression: "Aggression",
  justice: "Justice",
  leadership: "Leadership",
  protection: "Protection",
  pool: "'Pool",
};
const ASPECTS = new Set(Object.keys(ASPECT_LABELS));
/** The card types the "rarely played" list reads: ones a player plays from hand. */
const UNPLAYED_TYPES: ReadonlySet<string> = new Set(["ally", "event", "support", "upgrade"]);
/** How many cards a top list shows. */
const TOP = 5;
/** A hero, villain or side scheme needs this many games before it can be "best" or "hardest". */
const MIN_SAMPLE = 3;

const percent = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const record = (wins: number, losses: number): string => `${wins}–${losses}`;
const aspectLabel = (aspect: string): string => ASPECT_LABELS[aspect] ?? aspect;

function seatsOf(meta: SaveMeta, names: StatsNames): SeatFacts[] {
  const detailed = meta.summary?.seats;
  if (detailed) {
    return detailed
      .filter((seat) => !seat.satOut)
      .map((seat) => ({ identityCardId: seat.identityCardId, aspects: seat.aspects, summary: seat }));
  }
  return meta.config.players.flatMap((player: CorePlayer): SeatFacts[] => {
    if ("starterDeckId" in player) {
      const starter = names.starterDeck(player.starterDeckId);
      return starter ? [{ identityCardId: starter.identityCardId, aspects: starter.aspects, summary: null }] : [];
    }
    return [{ identityCardId: player.identityCardId, aspects: player.aspects ?? [], summary: null }];
  });
}

function factsOf(meta: SaveMeta, names: StatsNames): GameFacts | null {
  if (meta.guided) return null;
  if (meta.status !== "won" && meta.status !== "lost") return null;
  const summary = meta.summary ?? null;
  const lossReason = meta.status === "won" ? null : (summary?.lossReason ?? lossReasonOfOutcome(meta));
  return {
    result: meta.status,
    at: meta.updatedAt,
    round: meta.round,
    scenarioId: meta.config.scenarioId,
    villainKey: [meta.config.scenarioId, meta.config.villainSetId ?? "", meta.config.villainCardId ?? ""].join("|"),
    villain: villainNameOf(meta, names),
    expert: meta.config.difficulty !== "standard",
    difficulty: meta.config.difficulty,
    modulars: meta.config.modularSetIds ?? names.scenarioModulars?.(meta.config.scenarioId) ?? [],
    summary,
    lossReason: lossReason === "conceded" ? "other" : lossReason,
    lossCause: lossCauseOfMeta(meta),
    heroesDefeated: summary ? summary.heroesDefeated : null,
    seats: seatsOf(meta, names),
    detailed: summary?.seats !== undefined,
    sideSchemes: summary?.sideSchemes ?? null,
    platform: meta.lastPlayedOn?.platform ?? null,
    playedMs: meta.playedMs ?? null,
  };
}

/** A save from before summaries still has its outcome, which names a loss's reason. */
function lossReasonOfOutcome(meta: SaveMeta): "schemeCompleted" | "playersDefeated" | "other" {
  const reason = meta.outcome?.reason;
  if (reason === "mainSchemeCompleted") return "schemeCompleted";
  if (reason === "allPlayersDefeated") return "playersDefeated";
  return "other";
}

/** Why a save was lost, as Your stats breaks it down; null for anything but a loss. Shared with the global win rates. */
export function lossCauseOfMeta(meta: SaveMeta): LossCause | null {
  if (meta.status !== "lost") return null;
  const summary = meta.summary ?? null;
  return lossCauseOf(summary?.lossReason ?? lossReasonOfOutcome(meta), summary);
}

const DEFEAT_CAUSES: Readonly<Record<NonNullable<GameSummary["defeatedBy"]>, LossCause>> = {
  villainAttack: "villain",
  minionAttack: "minions",
  encounterCard: "encounter",
  other: "other",
};

/** "unknown": every hero fell in a game the backfill could not replay, so nothing says what dealt the last blow. */
export function lossCauseOf(reason: GameSummary["lossReason"], summary: GameSummary | null): LossCause {
  if (reason === "schemeCompleted") return "scheme";
  if (reason !== "playersDefeated") return "other";
  return summary?.defeatedBy ? DEFEAT_CAUSES[summary.defeatedBy] : "unknown";
}

export const LOSS_LABELS: Readonly<Record<LossCause, string>> = {
  scheme: "Scheme",
  villain: "Villain",
  minions: "Minions",
  encounter: "Encounter cards",
  other: "Other",
  unknown: "Unknown",
};

const LOSS_PHRASES: Readonly<Record<LossCause, string>> = {
  scheme: "The main scheme",
  villain: "Villain attacks",
  minions: "Minion attacks",
  encounter: "Encounter cards",
  other: "Something else",
  unknown: "Not recorded",
};

/** The causes of these games' losses in a fixed order, so bars read the same from row to row. */
function lossPartsOf(games: readonly GameFacts[]): LossPart[] {
  const counts = new Map<LossCause, number>();
  for (const game of games) {
    if (game.lossCause) counts.set(game.lossCause, (counts.get(game.lossCause) ?? 0) + 1);
  }
  return (Object.keys(LOSS_LABELS) as LossCause[])
    .filter((cause) => counts.has(cause))
    .map((cause) => ({ cause, label: LOSS_LABELS[cause], count: counts.get(cause)! }));
}

/** The row extra for `stat`: the loss bar, when these games have losses. */
function lossesOf(games: readonly GameFacts[]): { losses?: readonly LossPart[] } {
  const losses = lossPartsOf(games);
  return losses.length > 0 ? { losses } : {};
}

const isConcession = (meta: SaveMeta): boolean =>
  !meta.guided && meta.status === "abandoned" && meta.outcome?.result === "conceded";

interface Tally {
  wins: number;
  losses: number;
}
const tallyOf = (games: readonly GameFacts[]): Tally => ({
  wins: games.filter((g) => g.result === "won").length,
  losses: games.filter((g) => g.result === "lost").length,
});

function groupBy<K>(games: readonly GameFacts[], keysOf: (game: GameFacts) => readonly K[]): Map<K, GameFacts[]> {
  const groups = new Map<K, GameFacts[]>();
  for (const game of games) {
    for (const key of new Set(keysOf(game))) {
      const list = groups.get(key);
      if (list) list.push(game);
      else groups.set(key, [game]);
    }
  }
  return groups;
}

/** Most games first, then most wins, then name: a stable order for every "by X" list. */
function byPlayed<K>(groups: Map<K, GameFacts[]>, nameOf: (key: K) => string): [K, GameFacts[]][] {
  return [...groups.entries()].sort(
    ([ka, a], [kb, b]) =>
      b.length - a.length || tallyOf(b).wins - tallyOf(a).wins || nameOf(ka).localeCompare(nameOf(kb)),
  );
}

function streaksOf(games: readonly GameFacts[]): {
  best: number;
  current: { result: "won" | "lost"; n: number } | null;
} {
  const ordered = [...games].sort((a, b) => a.at - b.at);
  let best = 0;
  let run = 0;
  for (const game of ordered) {
    run = game.result === "won" ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const last = ordered.at(-1);
  if (!last) return { best, current: null };
  let n = 0;
  for (let i = ordered.length - 1; i >= 0 && ordered[i]!.result === last.result; i--) n++;
  return { best, current: { result: last.result, n } };
}

function headerOf(games: readonly GameFacts[]): StatsHeader {
  const { wins, losses } = tallyOf(games);
  const { best, current } = streaksOf(games);
  const currentLabel = current
    ? plural(current.n, current.result === "won" ? "win" : "loss", current.result === "won" ? "wins" : "losses")
    : "none";
  return {
    record: record(wins, losses),
    rate: games.length > 0 ? `${percent(wins, games.length)} win rate` : "No games yet",
    played: `${plural(games.length, "game")} played`,
    streak: `Best streak ${best} · Current: ${currentLabel}`,
    fraction: games.length > 0 ? wins / games.length : 0,
  };
}

const stat = (
  id: string,
  label: string,
  value: string,
  detail = "",
  extra: { highlight?: true; cardId?: string; losses?: readonly LossPart[] } = {},
): StatRow => ({ kind: "stat", id, label, value, detail, ...extra });

function overviewOf(games: readonly GameFacts[], concessions: number, older: number): StatsSection {
  const { wins, losses } = tallyOf(games);
  const rows: StatRow[] = [
    stat(
      "ov:played",
      "Games played",
      String(games.length),
      `${record(wins, losses)} · ${percent(wins, games.length)} won`,
    ),
  ];
  const wonGames = games.filter((g) => g.result === "won");
  const fastest = [...wonGames].sort((a, b) => a.round - b.round || a.at - b.at)[0];
  if (fastest) rows.push(stat("ov:fastest", "Fastest win", `Round ${fastest.round}`, `Against ${fastest.villain}`));
  if (games.length > 0) {
    const avg = games.reduce((sum, g) => sum + g.round, 0) / games.length;
    rows.push(stat("ov:length", "Average game", `${avg.toFixed(1)} rounds`, ""));
  }
  const lost = games.filter((g) => g.result === "lost");
  if (lost.length > 0) {
    const scheme = lost.filter((g) => g.lossReason === "schemeCompleted").length;
    const wiped = lost.filter((g) => g.lossReason === "playersDefeated").length;
    rows.push(
      stat(
        "ov:losses",
        "How you lose",
        `${percent(scheme, lost.length)} scheme`,
        `${plural(scheme, "loss", "losses")} to a completed main scheme, ${wiped} to every hero falling`,
      ),
    );
  }
  const expert = games.filter((g) => g.expert);
  if (expert.length > 0) {
    const t = tallyOf(expert);
    rows.push(
      stat("ov:expert", "Expert and harder", record(t.wins, t.losses), `${percent(t.wins, expert.length)} won`),
    );
  }
  const solo = games.filter((g) => g.seats.length === 1);
  const multi = games.filter((g) => g.seats.length > 1);
  if (solo.length > 0 && multi.length > 0) {
    const s = tallyOf(solo);
    const m = tallyOf(multi);
    rows.push(
      stat(
        "ov:seats",
        "One hero or several",
        `${percent(s.wins, solo.length)} / ${percent(m.wins, multi.length)}`,
        `One hero ${record(s.wins, s.losses)} · Two or more ${record(m.wins, m.losses)}`,
      ),
    );
  }
  const fallen = games.reduce((sum, g) => sum + (g.heroesDefeated ?? 0), 0);
  if (fallen > 0)
    rows.push(stat("ov:fallen", "Heroes fallen", String(fallen), "Identities defeated across every game"));
  const detailed = games.filter((g) => g.detailed);
  if (detailed.length > 0) {
    const seats = detailed.flatMap((g) => g.seats.map((s) => s.summary!));
    const damage = seats.reduce((sum, s) => sum + s.damage, 0);
    const thwart = seats.reduce((sum, s) => sum + s.thwart, 0);
    const plays = seats.reduce((sum, s) => sum + Object.values(s.plays).reduce((a, b) => a + b, 0), 0);
    rows.push(
      stat("ov:damage", "Damage dealt", String(damage), `${(damage / seats.length).toFixed(1)} per hero per game`),
      stat("ov:thwart", "Threat removed", String(thwart), `${(thwart / seats.length).toFixed(1)} per hero per game`),
      stat("ov:plays", "Cards played", String(plays), `${(plays / seats.length).toFixed(1)} per hero per game`),
    );
  }
  const aspects = groupBy(games, (g) => g.seats.flatMap((s) => s.aspects));
  const favorite = byPlayed(aspects, aspectLabel)[0];
  if (favorite) {
    const t = tallyOf(favorite[1]);
    rows.push(
      stat(
        "ov:aspect",
        "Favorite aspect",
        aspectLabel(favorite[0]),
        `${plural(favorite[1].length, "game")} · ${record(t.wins, t.losses)}`,
        { highlight: true },
      ),
    );
  }
  if (concessions > 0) rows.push(stat("ov:conceded", "Conceded", String(concessions), "Not counted as wins or losses"));
  if (older > 0) {
    rows.push({
      kind: "note",
      id: "ov:older",
      text: `${plural(older, "game")} finished before this update ${older === 1 ? "counts" : "count"} toward wins and losses, but not toward card, side scheme, damage or thwart stats.`,
    });
  }
  return { id: "overview", title: "Overview", count: plural(games.length, "game"), rows };
}

function heroesOf(games: readonly GameFacts[], names: StatsNames): StatsSection {
  const heroName = (id: string): string => names.cardName(id) ?? id;
  const groups = byPlayed(
    groupBy(games, (g) => g.seats.map((s) => s.identityCardId)),
    heroName,
  );
  const rows: StatRow[] = [];
  const favorite = groups[0];
  if (favorite) {
    rows.push(
      stat("hero:favorite", "Favorite hero", heroName(favorite[0]), plural(favorite[1].length, "game"), {
        highlight: true,
        cardId: favorite[0],
      }),
    );
  }
  const best = groups
    .filter(([, list]) => list.length >= MIN_SAMPLE)
    .sort(([, a], [, b]) => tallyOf(b).wins / b.length - tallyOf(a).wins / a.length || b.length - a.length)[0];
  if (best && groups.length > 1) {
    const t = tallyOf(best[1]);
    rows.push(
      stat(
        "hero:best",
        "Best win rate",
        heroName(best[0]),
        `${percent(t.wins, best[1].length)} · ${record(t.wins, t.losses)}`,
        { highlight: true, cardId: best[0] },
      ),
    );
  }
  for (const [id, list] of groups) {
    const t = tallyOf(list);
    const detailParts = [plural(list.length, "game"), `${percent(t.wins, list.length)} won`];
    const seats = list.flatMap((g) =>
      g.seats.filter((s) => s.identityCardId === id && s.summary).map((s) => s.summary!),
    );
    if (seats.length > 0) {
      const dmg = seats.reduce((sum, s) => sum + s.damage, 0) / seats.length;
      const thw = seats.reduce((sum, s) => sum + s.thwart, 0) / seats.length;
      detailParts.push(`${dmg.toFixed(1)} damage, ${thw.toFixed(1)} thwart a game`);
      const fell = seats.filter((s) => s.defeated).length;
      if (fell > 0) detailParts.push(`fell in ${plural(fell, "game")}`);
    }
    const fastest = list.filter((g) => g.result === "won").sort((a, b) => a.round - b.round)[0];
    if (fastest) detailParts.push(`fastest win round ${fastest.round}`);
    rows.push(
      stat(`hero:${id}`, heroName(id), record(t.wins, t.losses), detailParts.join(" · "), {
        cardId: id,
        ...lossesOf(list),
      }),
    );
  }
  rows.splice(Math.min(rows.length, best && groups.length > 1 ? 2 : 1), 0, ...pairRowsOf(games, heroName));
  return { id: "heroes", title: "Heroes", count: plural(groups.length, "hero", "heroes"), rows };
}

function villainsOf(games: readonly GameFacts[]): StatsSection {
  const groups = byPlayed(
    groupBy(games, (g) => [g.villain]),
    (v) => v,
  );
  const rows: StatRow[] = [];
  const favorite = groups[0];
  if (favorite)
    rows.push(
      stat("villain:favorite", "Most faced", favorite[0], plural(favorite[1].length, "game"), { highlight: true }),
    );
  const causes = lossPartsOf(games);
  // A game nothing is recorded for says nothing about why you lose: it never headlines while a known cause is there.
  const worstCause = [...causes].sort(
    (a, b) => Number(a.cause === "unknown") - Number(b.cause === "unknown") || b.count - a.count,
  )[0];
  if (worstCause) {
    const total = causes.reduce((sum, part) => sum + part.count, 0);
    rows.push(
      stat(
        "villain:why",
        "Why you lose",
        LOSS_PHRASES[worstCause.cause],
        `${percent(worstCause.count, total)} of ${plural(total, "loss", "losses")}`,
        { losses: causes },
      ),
    );
  }
  const lossesBy = (reason: GameFacts["lossReason"] | "any") =>
    groups
      .map(([name, list]) => ({
        name,
        n: list.filter((g) => g.result === "lost" && (reason === "any" || g.lossReason === reason)).length,
      }))
      .filter((entry) => entry.n > 0)
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))[0];
  const nemesis = lossesBy("any");
  if (nemesis)
    rows.push(
      stat("villain:nemesis", "Beaten by most", nemesis.name, plural(nemesis.n, "loss", "losses"), { highlight: true }),
    );
  const scheme = lossesBy("schemeCompleted");
  if (scheme)
    rows.push(
      stat(
        "villain:scheme",
        "Won by scheme most",
        scheme.name,
        `Completed the main scheme ${plural(scheme.n, "time")}`,
      ),
    );
  const wiped = lossesBy("playersDefeated");
  if (wiped)
    rows.push(
      stat("villain:wiped", "Wiped the table most", wiped.name, `Defeated every hero ${plural(wiped.n, "time")}`),
    );
  const hardest = groups
    .filter(([, list]) => list.length >= MIN_SAMPLE)
    .sort(([, a], [, b]) => tallyOf(a).wins / a.length - tallyOf(b).wins / b.length || b.length - a.length)[0];
  if (hardest && groups.length > 1) {
    const t = tallyOf(hardest[1]);
    rows.push(
      stat(
        "villain:hardest",
        "Toughest villain",
        hardest[0],
        `${percent(t.wins, hardest[1].length)} won · ${record(t.wins, t.losses)}`,
      ),
    );
  }
  rows.push(...nemesisByDifficultyOf(games));
  for (const [name, list] of groups) {
    const t = tallyOf(list);
    const fastest = list.filter((g) => g.result === "won").sort((a, b) => a.round - b.round)[0];
    const parts = [plural(list.length, "game"), `${percent(t.wins, list.length)} won`];
    if (fastest) parts.push(`fastest win round ${fastest.round}`);
    rows.push(stat(`villain:${name}`, name, record(t.wins, t.losses), parts.join(" · "), lossesOf(list)));
  }
  return { id: "villains", title: "Villains", count: plural(groups.length, "villain"), rows };
}

function sideSchemesOf(games: readonly GameFacts[], names: StatsNames): StatsSection {
  const revealed = new Map<string, number>();
  const defeated = new Map<string, number>();
  const tracked = games.filter((g) => g.sideSchemes);
  for (const game of tracked) {
    for (const [id, n] of Object.entries(game.sideSchemes!.seen)) revealed.set(id, (revealed.get(id) ?? 0) + n);
    for (const [id, n] of Object.entries(game.sideSchemes!.defeated)) defeated.set(id, (defeated.get(id) ?? 0) + n);
  }
  const ids = [...new Set([...revealed.keys(), ...defeated.keys()])];
  const nameOf = (id: string): string => names.cardName(id) ?? id;
  const rows: StatRow[] = [];
  if (tracked.length === 0) {
    rows.push({ kind: "note", id: "side:none", text: "Side scheme stats start with the next game you finish." });
    return { id: "side-schemes", title: "Side schemes", count: "–", rows };
  }
  const totalRevealed = [...revealed.values()].reduce((a, b) => a + b, 0);
  const totalDefeated = [...defeated.values()].reduce((a, b) => a + b, 0);
  rows.push(
    stat(
      "side:total",
      "Side schemes in play",
      String(totalRevealed),
      `${(totalRevealed / tracked.length).toFixed(1)} a game · ${totalDefeated} cleared`,
    ),
  );
  const ordered = ids.sort(
    (a, b) => (revealed.get(b) ?? 0) - (revealed.get(a) ?? 0) || nameOf(a).localeCompare(nameOf(b)),
  );
  const common = ordered[0];
  if (common && (revealed.get(common) ?? 0) > 0) {
    rows.push(
      stat("side:common", "Seen most", nameOf(common), `In play ${plural(revealed.get(common)!, "time")}`, {
        highlight: true,
        cardId: common,
      }),
    );
  }
  const hardest = ordered
    .filter((id) => (revealed.get(id) ?? 0) >= 2)
    .sort((a, b) => (defeated.get(a) ?? 0) / revealed.get(a)! - (defeated.get(b) ?? 0) / revealed.get(b)!)[0];
  if (hardest) {
    rows.push(
      stat(
        "side:hardest",
        "Hardest to clear",
        nameOf(hardest),
        `Cleared ${defeated.get(hardest) ?? 0} of ${revealed.get(hardest)} times`,
        { cardId: hardest },
      ),
    );
  }
  for (const id of ordered) {
    const r = revealed.get(id) ?? 0;
    const d = defeated.get(id) ?? 0;
    rows.push(
      stat(`side:${id}`, nameOf(id), `${r} seen`, `Cleared ${d}${r > 0 ? ` (${percent(Math.min(d, r), r)})` : ""}`, {
        cardId: id,
      }),
    );
  }
  return { id: "side-schemes", title: "Side schemes", count: plural(ids.length, "scheme"), rows };
}

/** Card id to [total count, games it counted in], summed over seats. */
function countsOf(seats: readonly SeatSummary[], pick: (seat: SeatSummary) => Readonly<Record<string, number>>) {
  const counts = new Map<string, { total: number; games: number }>();
  for (const seat of seats) {
    for (const [id, n] of Object.entries(pick(seat))) {
      const entry = counts.get(id) ?? { total: 0, games: 0 };
      counts.set(id, { total: entry.total + n, games: entry.games + 1 });
    }
  }
  return counts;
}

function heroCardsOf(identityCardId: string, games: readonly GameFacts[], names: StatsNames): StatsSection {
  const nameOf = (id: string): string => names.cardName(id) ?? id;
  const mine = games.flatMap((g) =>
    g.seats.filter((s) => s.identityCardId === identityCardId).map((s) => ({ game: g, seat: s })),
  );
  const seats = mine.flatMap(({ seat }) => (seat.summary ? [seat.summary] : []));
  const rows: StatRow[] = [];

  const aspectGames = new Map<string, GameFacts[]>();
  for (const { game, seat } of mine) {
    for (const aspect of seat.aspects) aspectGames.set(aspect, [...(aspectGames.get(aspect) ?? []), game]);
  }
  const aspectPlays = new Map<string, number>();
  for (const seat of seats) {
    for (const [id, n] of Object.entries(seat.plays)) {
      const aspect = names.cardAspect(id);
      if (aspect && ASPECTS.has(aspect)) aspectPlays.set(aspect, (aspectPlays.get(aspect) ?? 0) + n);
    }
  }
  const aspects = [...aspectGames.entries()].sort(
    ([a, ga], [b, gb]) =>
      gb.length - ga.length || (aspectPlays.get(b) ?? 0) - (aspectPlays.get(a) ?? 0) || a.localeCompare(b),
  );
  aspects.forEach(([aspect, list], index) => {
    const t = tallyOf(list);
    const played = aspectPlays.get(aspect);
    rows.push(
      stat(
        `${identityCardId}:aspect:${aspect}`,
        index === 0 ? "Favorite aspect" : "Also played",
        aspectLabel(aspect),
        [
          plural(list.length, "game"),
          record(t.wins, t.losses),
          ...(played ? [`${plural(played, "aspect card")} played`] : []),
        ].join(" · "),
        index === 0 ? { highlight: true } : {},
      ),
    );
  });

  if (seats.length === 0) {
    rows.push({
      kind: "note",
      id: `${identityCardId}:none`,
      text: "Card stats start with the next game you finish with this hero.",
    });
    return {
      id: `cards:${identityCardId}`,
      title: `${nameOf(identityCardId)} · cards`,
      count: plural(mine.length, "game"),
      rows,
    };
  }

  const plays = countsOf(seats, (s) => s.plays);
  const activations = countsOf(seats, (s) => s.activations);
  const top = (
    label: string,
    key: string,
    counts: Map<string, { total: number; games: number }>,
    keep: (id: string) => boolean,
    verb: string,
  ): void => {
    const list = [...counts.entries()]
      .filter(([id]) => keep(id))
      .sort(([a, x], [b, y]) => y.total - x.total || y.games - x.games || nameOf(a).localeCompare(nameOf(b)))
      .slice(0, TOP);
    if (list.length === 0) return;
    rows.push({ kind: "note", id: `${identityCardId}:${key}:head`, text: label });
    for (const [id, entry] of list) {
      rows.push(
        stat(
          `${identityCardId}:${key}:${id}`,
          nameOf(id),
          `${entry.total}×`,
          `${verb} in ${entry.games} of ${plural(seats.length, "game")}`,
          { cardId: id },
        ),
      );
    }
  };
  const typed =
    (...types: string[]) =>
    (id: string) =>
      types.includes(names.cardType(id) ?? "");
  top("Most played supports and upgrades", "su", plays, typed("support", "upgrade"), "Played");
  top("Most played allies", "ally", plays, typed("ally"), "Played");
  top("Most played events", "event", plays, typed("event"), "Played");
  top("Most activated cards", "act", activations, () => true, "Used");
  top("Most activated aspect cards", "aact", activations, (id) => ASPECTS.has(names.cardAspect(id) ?? ""), "Used");

  // Cards that sat in the deck: games the card was in, against games it was played in or came into play. Resources are
  // left out (a resource card is meant to be spent, not played), and so are player side schemes, never played.
  const inDeck = new Map<string, number>();
  const usedIn = new Map<string, number>();
  for (const seat of seats) {
    for (const id of seat.deck) inDeck.set(id, (inDeck.get(id) ?? 0) + 1);
    for (const id of new Set([...Object.keys(seat.plays), ...Object.keys(seat.entered ?? {})])) {
      usedIn.set(id, (usedIn.get(id) ?? 0) + 1);
    }
  }
  const unplayed = [...inDeck.entries()]
    .filter(([id]) => UNPLAYED_TYPES.has(names.cardType(id) ?? ""))
    .map(([id, games]) => ({ id, games, playedIn: usedIn.get(id) ?? 0 }))
    .filter((entry) => entry.playedIn / entry.games < 0.5)
    .sort(
      (a, b) =>
        a.playedIn / a.games - b.playedIn / b.games || b.games - a.games || nameOf(a.id).localeCompare(nameOf(b.id)),
    )
    .slice(0, TOP);
  if (unplayed.length > 0) {
    rows.push({ kind: "note", id: `${identityCardId}:unplayed:head`, text: "Rarely played (not counting resources)" });
    for (const entry of unplayed) {
      rows.push(
        stat(
          `${identityCardId}:unplayed:${entry.id}`,
          nameOf(entry.id),
          entry.playedIn === 0 ? "never" : `${entry.playedIn} of ${entry.games}`,
          entry.playedIn === 0
            ? `In your deck for ${plural(entry.games, "game")}, never played`
            : `Played in ${entry.playedIn} of the ${entry.games} games it was in your deck`,
          { cardId: entry.id },
        ),
      );
    }
  }
  return {
    id: `cards:${identityCardId}`,
    title: `${nameOf(identityCardId)} · cards`,
    count: plural(mine.length, "game"),
    rows,
  };
}

const PLATFORM_LABELS: Readonly<Record<string, string>> = {
  web: "Web browser",
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iPhone and iPad",
};

/**
 * Devices: where each game was last played (device sync stamps every save it writes). Null when no game says, which
 * is every game played before the stamp existed.
 */
function devicesOf(games: readonly GameFacts[]): StatsSection | null {
  const stamped = games.filter((g) => g.platform !== null);
  if (stamped.length === 0) return null;
  const labelOf = (platform: string): string => PLATFORM_LABELS[platform] ?? platform;
  const groups = byPlayed(
    groupBy(stamped, (g) => [g.platform!]),
    labelOf,
  );
  const rows: StatRow[] = [];
  const most = groups[0]!;
  rows.push(
    stat("device:most", "Played most on", labelOf(most[0]), plural(most[1].length, "game"), { highlight: true }),
  );
  for (const [platform, list] of groups) {
    const t = tallyOf(list);
    const avg = list.reduce((sum, g) => sum + g.round, 0) / list.length;
    rows.push(
      stat(
        `device:${platform}`,
        labelOf(platform),
        record(t.wins, t.losses),
        `${plural(list.length, "game")} · ${percent(t.wins, list.length)} won · ${avg.toFixed(1)} rounds a game`,
      ),
    );
  }
  if (stamped.length < games.length) {
    rows.push({
      kind: "note",
      id: "device:unstamped",
      text: `${plural(games.length - stamped.length, "game")} from before devices were recorded are not counted here.`,
    });
  }
  rows.push({
    kind: "note",
    id: "device:last",
    text: "A game counts for the device it was last played on.",
  });
  return { id: "devices", title: "Devices", count: plural(groups.length, "device"), rows };
}

const statRowsOf = (section: StatsSection) =>
  section.rows.filter((row): row is Extract<StatRow, { kind: "stat" }> => row.kind === "stat");

/** The Overview tab's tiles, from the same facts the sections give. */
function overviewTilesOf(
  games: readonly GameFacts[],
  header: StatsHeader,
  overview: StatsSection,
  heroes: StatsSection | null,
  villains: StatsSection | null,
  sideSchemes: StatsSection | null,
  villainScenario: (name: string) => string | undefined,
): OverviewTiles {
  const byId = new Map(statRowsOf(overview).map((row) => [row.id, row]));
  const tiles: OverviewTile[] = [];
  const fastest = byId.get("ov:fastest");
  tiles.push({
    kind: "record",
    id: "record",
    record: header.record,
    rate: header.rate,
    fraction: header.fraction,
    detail: [
      header.streak,
      ...(fastest
        ? [`Fastest win round ${fastest.value.replace("Round ", "")} (${fastest.detail.replace("Against ", "")})`]
        : []),
    ].join(" · "),
  });
  const lost = games.filter((g) => g.result === "lost");
  if (lost.length > 0) {
    const scheme = lost.filter((g) => g.lossReason === "schemeCompleted").length;
    const wiped = lost.filter((g) => g.lossReason === "playersDefeated").length;
    const other = lost.length - scheme - wiped;
    const parts = [
      { label: "Scheme", count: scheme, tone: "caution" as const },
      { label: "Wiped", count: wiped, tone: "ink" as const },
      // A scenario's own loss, or an older save that names neither.
      { label: "Other", count: other, tone: "muted" as const },
    ].filter((part) => part.count > 0);
    const top = [...parts].sort((a, b) => b.count - a.count)[0]!;
    const what: Record<string, string> = {
      Scheme: "the main scheme completing",
      Wiped: "every hero falling",
      Other: "another way the scenario ends",
    };
    tiles.push({
      kind: "split",
      id: "lose",
      label: "How you lose",
      parts,
      detail: `${percent(top.count, lost.length)} of losses are ${what[top.label]}.`,
    });
  }
  const lines: { label: string; value: string }[] = [];
  const perGame = (id: string, label: string) => {
    const row = byId.get(id);
    if (row) lines.push({ label, value: row.detail.split(" ")[0]! });
  };
  perGame("ov:damage", "Damage per hero");
  perGame("ov:thwart", "Thwart per hero");
  perGame("ov:plays", "Cards per hero");
  const length = byId.get("ov:length");
  if (length) lines.push({ label: "Length", value: length.value });
  if (lines.length > 0) tiles.push({ kind: "figures", id: "per-game", label: "Each game", lines });

  const heroRows = heroes ? statRowsOf(heroes) : [];
  const favorite = heroRows.find((row) => row.id === "hero:favorite");
  if (favorite?.cardId) {
    const own = heroRows.find((row) => row.id === `hero:${favorite.cardId}`);
    const best = heroRows.find((row) => row.id === "hero:best");
    tiles.push({
      kind: "portrait",
      id: "hero",
      label: "Favorite hero",
      name: favorite.value,
      detail: own ? `${own.detail.split(" · ").slice(0, 2).join(" · ")} · ${own.value}` : favorite.detail,
      extra: best ? `Best win rate: ${best.value}, ${best.detail.split(" · ")[0]}` : "",
      art: { hero: favorite.cardId },
      wide: true,
    });
  }
  const villainRows = villains ? statRowsOf(villains) : [];
  const villainTile = (id: string, label: string): void => {
    const row = villainRows.find((r) => r.id === id);
    const scenario = row ? villainScenario(row.value) : undefined;
    if (!row || !scenario || tiles.some((t) => t.kind === "portrait" && t.name === row.value && t.id !== "hero"))
      return;
    const own = villainRows.find((r) => r.id === `villain:${row.value}`);
    tiles.push({
      kind: "portrait",
      id,
      label,
      name: row.value,
      detail: own ? `${own.detail.split(" · ")[0]} · ${own.value}` : row.detail,
      // The row's own line, unless it only says the game count again (Most faced).
      extra: own && own.detail.startsWith(row.detail) ? "" : row.detail,
      art: { scenario },
      wide: false,
    });
  };
  villainTile("villain:nemesis", "Beaten by most");
  villainTile("villain:wiped", "Wiped the table most");
  villainTile("villain:favorite", "Most faced");

  const small = (row: Extract<StatRow, { kind: "stat" }> | undefined, id: string, label = row?.label ?? ""): void => {
    if (row) tiles.push({ kind: "small", id, label, value: row.value, detail: row.detail });
  };
  small(byId.get("ov:aspect"), "aspect");
  const side = sideSchemes ? statRowsOf(sideSchemes) : [];
  const total = side.find((row) => row.id === "side:total");
  const hardest = side.find((row) => row.id === "side:hardest");
  if (total) {
    tiles.push({
      kind: "small",
      id: "side",
      label: "Side schemes",
      value: `${total.detail.split(" ")[0]} a game`,
      detail: hardest ? `Hardest to clear: ${hardest.value}` : total.detail,
    });
  }
  small(byId.get("ov:expert"), "expert");
  small(byId.get("ov:seats"), "seats");
  small(byId.get("ov:fallen"), "fallen");
  small(byId.get("ov:conceded"), "conceded");
  const note = overview.rows.find((row) => row.kind === "note");
  return { tiles, note: note?.kind === "note" ? note.text : null };
}

/** A hero's cards section, as the Cards by hero tab draws it: aspect rows, then each group's cards. */
function heroCardsViewOf(section: StatsSection, identityCardId: string, name: string): HeroCardsView {
  const aspects: { aspect: string; label: string; detail: string }[] = [];
  const groups: { id: string; title: string; cards: { cardId: string; value: string; detail: string }[] }[] = [];
  let note: string | null = null;
  for (const row of section.rows) {
    if (row.kind === "note") {
      if (row.id.endsWith(":head")) groups.push({ id: row.id.replace(/:head$/, ""), title: row.text, cards: [] });
      else note = row.text;
      continue;
    }
    if (row.id.includes(":aspect:")) {
      aspects.push({ aspect: row.id.split(":aspect:")[1]!, label: row.value, detail: row.detail });
      continue;
    }
    if (row.cardId) groups.at(-1)?.cards.push({ cardId: row.cardId, value: row.value, detail: row.detail });
  }
  return { identityCardId, name, games: section.count, aspects, groups, note };
}

/** How many cards a list on the Cards tab shows. */
const ALL_TOP = 8;

/**
 * The Cards tab (#529): every seat's cards across every hero. Most played, most activated, the best win rate when a
 * card comes out (3 games or more), and the cards that sit in decks. A card "comes out" in a game it was played in or
 * came into play in.
 */
function allCardsOf(games: readonly GameFacts[], names: StatsNames): HeroCardsView | null {
  const nameOf = (id: string): string => names.cardName(id) ?? id;
  const used = games.flatMap((game) =>
    game.seats.flatMap((seat) => (seat.summary ? [{ won: game.result === "won", seat: seat.summary }] : [])),
  );
  if (used.length === 0) return null;
  const plays = new Map<string, number>();
  const activations = new Map<string, number>();
  // Games a card's abilities were used in: an identity's own (never "comes out" of a deck) count too.
  const activatedIn = new Map<string, number>();
  const inDeck = new Map<string, number>();
  const cameOut = new Map<string, number>();
  const wonOut = new Map<string, number>();
  const heroes = new Map<string, Set<string>>();
  const add = (map: Map<string, number>, id: string, n = 1): void => void map.set(id, (map.get(id) ?? 0) + n);
  for (const { won, seat } of used) {
    for (const [id, n] of Object.entries(seat.plays)) add(plays, id, n);
    for (const [id, n] of Object.entries(seat.activations)) {
      add(activations, id, n);
      add(activatedIn, id);
    }
    for (const id of seat.deck) add(inDeck, id);
    for (const id of new Set([...Object.keys(seat.plays), ...Object.keys(seat.entered ?? {})])) {
      add(cameOut, id);
      if (won) add(wonOut, id);
      (heroes.get(id) ?? heroes.set(id, new Set()).get(id)!).add(seat.identityCardId);
    }
  }
  const played = (id: string): boolean => UNPLAYED_TYPES.has(names.cardType(id) ?? "");
  const heroCount = (id: string): string => {
    const n = heroes.get(id)?.size ?? 0;
    return n > 1 ? ` · ${n} heroes` : "";
  };
  const byName = (a: string, b: string): number => nameOf(a).localeCompare(nameOf(b));
  const groups: HeroCardsView["groups"][number][] = [];
  const group = (id: string, title: string, cards: HeroCardsView["groups"][number]["cards"]): void => {
    if (cards.length > 0) groups.push({ id, title, cards });
  };
  group(
    "all:played",
    "Most played",
    [...plays.entries()]
      .filter(([id]) => played(id))
      .sort(([a, x], [b, y]) => y - x || byName(a, b))
      .slice(0, ALL_TOP)
      .map(([id, n]) => ({
        cardId: id,
        value: `${n}×`,
        detail: `In ${plural(cameOut.get(id) ?? 0, "game")}${heroCount(id)}`,
      })),
  );
  group(
    "all:activated",
    "Most activated",
    [...activations.entries()]
      .sort(([a, x], [b, y]) => y - x || byName(a, b))
      .slice(0, ALL_TOP)
      .map(([id, n]) => ({
        cardId: id,
        value: `${n}×`,
        detail: `Used in ${plural(activatedIn.get(id) ?? 0, "game")}`,
      })),
  );
  group(
    "all:wins",
    "Best win rate when it comes out",
    [...cameOut.entries()]
      .filter(([id, n]) => played(id) && n >= MIN_SAMPLE)
      .sort(([a, x], [b, y]) => (wonOut.get(b) ?? 0) / y - (wonOut.get(a) ?? 0) / x || y - x || byName(a, b))
      .slice(0, ALL_TOP)
      .map(([id, n]) => ({
        cardId: id,
        value: percent(wonOut.get(id) ?? 0, n),
        detail: `Won ${wonOut.get(id) ?? 0} of the ${n} games it came out`,
      })),
  );
  // Allies (Bluefiref5ran's list): the hardest hitters, the most defenses, and the "martyr" that falls defending most.
  for (const [id, title, pick, unit] of [
    ["all:ally-damage", "Allies: most damage", (seat: SeatSummary) => seat.allyDamage, "damage"],
    ["all:ally-blocks", "Allies: most defenses", (seat: SeatSummary) => seat.allyBlocks, "defense"],
    ["all:ally-martyr", "Allies: fell defending most", (seat: SeatSummary) => seat.allyDiedBlocking, "time"],
  ] as const) {
    const totals = new Map<string, number>();
    for (const { seat } of used) for (const [card, n] of Object.entries(pick(seat) ?? {})) add(totals, card, n);
    group(
      id,
      title,
      [...totals.entries()]
        .filter(([, n]) => n > 0)
        .sort(([a, x], [b, y]) => y - x || byName(a, b))
        .slice(0, ALL_TOP)
        .map(([card, n]) => ({
          cardId: card,
          value: unit === "damage" ? `${n}` : `${n}×`,
          detail:
            unit === "damage"
              ? `damage in ${plural(cameOut.get(card) ?? 0, "game")}`
              : plural(n, unit === "defense" ? "defense" : "time"),
        })),
    );
  }
  // The cards paid with most that are not resource cards: played as a resource instead of for what they do.
  const paid = new Map<string, number>();
  for (const { seat } of used) for (const [card, n] of Object.entries(seat.paidWith ?? {})) add(paid, card, n);
  group(
    "all:paid",
    "Paid with most (not counting resources)",
    [...paid.entries()]
      .filter(([card]) => played(card))
      .sort(([a, x], [b, y]) => y - x || byName(a, b))
      .slice(0, ALL_TOP)
      .map(([card, n]) => ({ cardId: card, value: `${n}×`, detail: `Played ${plays.get(card) ?? 0}×` })),
  );
  group(
    "all:unplayed",
    "Rarely played (not counting resources)",
    [...inDeck.entries()]
      .filter(([id, n]) => played(id) && n >= 2 && (cameOut.get(id) ?? 0) / n < 0.5)
      .sort(([a, x], [b, y]) => (cameOut.get(a) ?? 0) / x - (cameOut.get(b) ?? 0) / y || y - x || byName(a, b))
      .slice(0, ALL_TOP)
      .map(([id, n]) => ({
        cardId: id,
        value: (cameOut.get(id) ?? 0) === 0 ? "never" : `${cameOut.get(id)} of ${n}`,
        detail: `In a deck for ${plural(n, "game")}`,
      })),
  );
  return {
    identityCardId: "",
    name: "Every hero",
    games: plural(used.length, "game"),
    aspects: [],
    groups,
    note: null,
  };
}

const DIFFICULTY_LABELS: Readonly<Record<GameFacts["difficulty"], string>> = {
  standard: "Standard",
  expert: "Expert",
  extreme: "Extreme",
};

/** Two or more heroes at one table: each pair's record, the best by win rate (2 games or more). */
function pairRowsOf(games: readonly GameFacts[], heroName: (id: string) => string): StatRow[] {
  const pairs = new Map<string, { ids: [string, string]; list: GameFacts[] }>();
  for (const game of games) {
    const ids = [...new Set(game.seats.map((s) => s.identityCardId))].sort();
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}+${ids[j]}`;
        const entry = pairs.get(key) ?? { ids: [ids[i]!, ids[j]!] as [string, string], list: [] };
        entry.list.push(game);
        pairs.set(key, entry);
      }
  }
  const best = [...pairs.values()]
    .filter((entry) => entry.list.length >= 2)
    .sort(
      (a, b) =>
        tallyOf(b.list).wins / b.list.length - tallyOf(a.list).wins / a.list.length ||
        b.list.length - a.list.length ||
        heroName(a.ids[0]).localeCompare(heroName(b.ids[0])),
    )[0];
  if (!best) return [];
  const t = tallyOf(best.list);
  return [
    stat(
      "hero:pair",
      "Best hero pair",
      `${heroName(best.ids[0])} & ${heroName(best.ids[1])}`,
      `${percent(t.wins, best.list.length)} won · ${record(t.wins, t.losses)}`,
      { cardId: best.ids[0] },
    ),
  ];
}

/** The personal nemesis on each difficulty: the villain with the worst win rate there (3 games or more). */
function nemesisByDifficultyOf(games: readonly GameFacts[]): StatRow[] {
  const rows: StatRow[] = [];
  for (const difficulty of ["standard", "expert", "extreme"] as const) {
    const played = byPlayed(
      groupBy(
        games.filter((g) => g.difficulty === difficulty),
        (g) => [g.villain],
      ),
      (v) => v,
    ).filter(([, list]) => list.length >= MIN_SAMPLE);
    if (played.length < 2) continue;
    const [name, list] = played.sort(
      ([, a], [, b]) => tallyOf(a).wins / a.length - tallyOf(b).wins / b.length || b.length - a.length,
    )[0]!;
    const t = tallyOf(list);
    rows.push(
      stat(
        `villain:nemesis:${difficulty}`,
        `Nemesis on ${DIFFICULTY_LABELS[difficulty]}`,
        name,
        `${percent(t.wins, list.length)} won · ${record(t.wins, t.losses)}`,
      ),
    );
  }
  return rows;
}

/** Each aspect's games and win rate; a seat counts toward each aspect it brought. */
export interface AspectShare {
  readonly aspect: string;
  readonly label: string;
  readonly games: number;
  readonly wins: number;
}

function aspectSharesOf(games: readonly GameFacts[]): AspectShare[] {
  const tally = new Map<string, { games: number; wins: number }>();
  for (const game of games)
    for (const aspect of new Set(game.seats.flatMap((seat) => seat.aspects.filter((a) => ASPECTS.has(a))))) {
      const entry = tally.get(aspect) ?? { games: 0, wins: 0 };
      entry.games++;
      if (game.result === "won") entry.wins++;
      tally.set(aspect, entry);
    }
  return [...tally.entries()]
    .map(([aspect, t]) => ({ aspect, label: aspectLabel(aspect), ...t }))
    .sort((a, b) => b.games - a.games || a.label.localeCompare(b.label));
}

function aspectsSectionOf(shares: readonly AspectShare[]): StatsSection {
  const rows: StatRow[] = [];
  const best = shares.filter((s) => s.games >= MIN_SAMPLE).sort((a, b) => b.wins / b.games - a.wins / a.games)[0];
  if (shares[0]) rows.push(stat("aspect:favorite", "Most played", shares[0].label, plural(shares[0].games, "game")));
  if (best && shares.length > 1)
    rows.push(
      stat(
        "aspect:best",
        "Best win rate",
        best.label,
        `${percent(best.wins, best.games)} · ${record(best.wins, best.games - best.wins)}`,
        {
          highlight: true,
        },
      ),
    );
  for (const share of shares)
    rows.push(
      stat(
        `aspect:${share.aspect}`,
        share.label,
        record(share.wins, share.games - share.wins),
        `${plural(share.games, "game")} · ${percent(share.wins, share.games)} won`,
      ),
    );
  return { id: "aspects", title: "Aspects", count: plural(shares.length, "aspect"), rows };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** When you play: games a week since the first, the busiest month, the favorite day (by when each game finished). */
function whenRowsOf(games: readonly GameFacts[]): StatRow[] {
  const dated = games.filter((g) => g.at > 1_000_000_000_000);
  if (dated.length === 0) return [];
  const first = Math.min(...dated.map((g) => g.at));
  const last = Math.max(...dated.map((g) => g.at));
  const weeks = Math.max(1, (last - first) / WEEK_MS);
  const days = new Map<number, number>();
  const months = new Map<string, number>();
  for (const game of dated) {
    const at = new Date(game.at);
    days.set(at.getDay(), (days.get(at.getDay()) ?? 0) + 1);
    const month = `${at.getFullYear()}-${at.getMonth()}`;
    months.set(month, (months.get(month) ?? 0) + 1);
  }
  const [day, dayN] = [...days.entries()].sort(([a, x], [b, y]) => y - x || a - b)[0]!;
  const [month, monthN] = [...months.entries()].sort(([a, x], [b, y]) => y - x || b.localeCompare(a))[0]!;
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  return [
    stat(
      "when:week",
      "Games a week",
      (dated.length / weeks).toFixed(1),
      `Since ${MONTHS[new Date(first).getMonth()]} ${new Date(first).getFullYear()}`,
    ),
    stat("when:month", "Busiest month", `${MONTHS[monthIndex]} ${year}`, plural(monthN, "game")),
    stat("when:day", "Favorite day", DAYS[day]!, plural(dayN, "game")),
  ];
}

/** Records: the fastest and longest games, the closest win, and (from the summary) the best turns and the final blow. */
function recordsOf(games: readonly GameFacts[], names: StatsNames): StatsSection {
  const rows: StatRow[] = [];
  const name = (id: string): string => names.cardName(id) ?? id;
  const wins = games.filter((g) => g.result === "won");
  const fastest = [...wins].sort((a, b) => a.round - b.round || a.at - b.at)[0];
  if (fastest)
    rows.push(stat("rec:fastest", "Fastest win", `Round ${fastest.round}`, fastest.villain, { highlight: true }));
  const longest = [...games].sort((a, b) => b.round - a.round || a.at - b.at)[0];
  if (longest)
    rows.push(
      stat(
        "rec:longest",
        "Longest game",
        plural(longest.round, "round"),
        `${longest.villain} · ${longest.result === "won" ? "won" : "lost"}`,
      ),
    );
  const closest = wins
    .flatMap((g) => (g.summary?.winners ?? []).map((w) => ({ g, w })))
    .filter(({ w }) => w.hitPoints !== null && w.hitPoints > 0)
    .sort((a, b) => a.w.hitPoints! - b.w.hitPoints! || a.g.at - b.g.at)[0];
  if (closest)
    rows.push(
      stat(
        "rec:closest",
        "Closest win",
        plural(closest.w.hitPoints!, "hit point"),
        `${name(closest.w.identityCardId)} against ${closest.g.villain}`,
        {
          cardId: closest.w.identityCardId,
        },
      ),
    );
  const turns = games.flatMap((g) =>
    g.seats.flatMap((s) => (s.summary?.bestTurn ? [{ g, id: s.identityCardId, turn: s.summary.bestTurn }] : [])),
  );
  for (const [key, label] of [
    ["damage", "Most damage in a turn"],
    ["thwart", "Most threat removed in a turn"],
  ] as const) {
    const best = [...turns].sort((a, b) => b.turn[key] - a.turn[key] || a.g.at - b.g.at)[0];
    if (best && best.turn[key] > 0)
      rows.push(
        stat(`rec:turn:${key}`, label, String(best.turn[key]), `${name(best.id)} against ${best.g.villain}`, {
          highlight: true,
          cardId: best.id,
        }),
      );
  }
  const draws = games.flatMap((g) =>
    g.seats.flatMap((s) => (s.summary?.drawn !== undefined ? [{ g, id: s.identityCardId, n: s.summary.drawn }] : [])),
  );
  const mostDrawn = [...draws].sort((a, b) => b.n - a.n || a.g.at - b.g.at)[0];
  if (mostDrawn && mostDrawn.n > 0)
    rows.push(
      stat(
        "rec:drawn",
        "Most cards drawn in a game",
        String(mostDrawn.n),
        `${name(mostDrawn.id)} against ${mostDrawn.g.villain}`,
        {
          cardId: mostDrawn.id,
        },
      ),
    );
  rows.push(...finalBlowRowsOf(games, names));
  rows.push(...whenRowsOf(games));
  const timed = games.filter((g) => g.playedMs !== null);
  if (timed.length > 0) {
    const hours = timed.reduce((sum, g) => sum + g.playedMs!, 0) / 3_600_000;
    const untimed = games.length - timed.length;
    rows.push(
      stat(
        "fun:hours",
        "Hours played",
        hours < 10 ? hours.toFixed(1) : Math.round(hours).toLocaleString("en-US"),
        untimed > 0
          ? `${plural(timed.length, "game")} · ${plural(untimed, "older game")} not counted`
          : plural(timed.length, "game"),
      ),
    );
  }
  const rounds = games.reduce((sum, g) => sum + g.round, 0);
  rows.push(stat("fun:rounds", "Rounds played", rounds.toLocaleString("en-US"), plural(games.length, "game")));
  const seats = games.flatMap((g) => g.seats.flatMap((s) => (s.summary ? [s.summary] : [])));
  if (seats.length > 0) {
    const damage = seats.reduce((sum, s) => sum + s.damage, 0);
    const thwart = seats.reduce((sum, s) => sum + s.thwart, 0);
    rows.push(stat("fun:damage", "Damage dealt", damage.toLocaleString("en-US"), "Every hero, every game"));
    rows.push(stat("fun:thwart", "Threat removed", thwart.toLocaleString("en-US"), "Every hero, every game"));
    const drawn = seats.filter((s) => s.drawn !== undefined);
    if (drawn.length > 0)
      rows.push(
        stat(
          "fun:drawn",
          "Cards drawn",
          drawn.reduce((sum, s) => sum + s.drawn!, 0).toLocaleString("en-US"),
          "Every hero, every game",
        ),
      );
    const pools = seats.flatMap((s) => (s.resources ? [s.resources] : []));
    if (pools.length > 0) {
      const sum = (key: "physical" | "mental" | "energy" | "wild"): number =>
        pools.reduce((n, pool) => n + pool[key], 0);
      const total = sum("physical") + sum("mental") + sum("energy") + sum("wild");
      rows.push(
        stat(
          "fun:resources",
          "Resources made",
          total.toLocaleString("en-US"),
          `Physical ${sum("physical")} · Mental ${sum("mental")} · Energy ${sum("energy")} · Wild ${sum("wild")}`,
        ),
      );
      const discarded = seats.reduce((n, s) => n + (s.discardedToPay ?? 0), 0);
      rows.push(
        stat("fun:discarded", "Cards discarded to pay", discarded.toLocaleString("en-US"), "From hand, every game"),
      );
    }
  }
  return { id: "records", title: "Records", count: plural(rows.length, "record"), rows };
}

/** Modular sets: how often each was in a game, and the one you win least against (3 games or more). */
function encounterOf(games: readonly GameFacts[], names: StatsNames): StatsSection | null {
  const setName = (id: string): string => names.setName?.(id) ?? id;
  const groups = byPlayed(
    groupBy(games, (g) => g.modulars),
    setName,
  );
  const rows: StatRow[] = [
    ...encounterCardRowsOf(
      games,
      names,
      (summary) => summary.hurtBy,
      "enc:hurt",
      "Hit you hardest",
      (n, g) => `${n} damage over ${plural(g, "game")}`,
    ),
    ...encounterCardRowsOf(
      games,
      names,
      (summary) => summary.encounterRevealed,
      "enc:revealed",
      "Revealed most",
      (n, g) => `Shown up ${plural(n, "time")} in ${plural(g, "game")}`,
    ),
  ];
  if (groups.length === 0) return rows.length > 0 ? { id: "encounter", title: "Encounter", count: "", rows } : null;
  const [most, mostList] = groups[0]!;
  rows.push(
    stat("enc:modular", "Most played modular", setName(most), `Shown up in ${plural(mostList.length, "game")}`, {
      highlight: true,
    }),
  );
  const worst = groups
    .filter(([, list]) => list.length >= MIN_SAMPLE)
    .sort(([, a], [, b]) => tallyOf(a).wins / a.length - tallyOf(b).wins / b.length || b.length - a.length)[0];
  if (worst && groups.length > 1) {
    const t = tallyOf(worst[1]);
    rows.push(
      stat(
        "enc:worst",
        "Toughest modular",
        setName(worst[0]),
        `${percent(t.wins, worst[1].length)} won · ${record(t.wins, t.losses)}`,
      ),
    );
  }
  for (const [id, list] of groups) {
    const t = tallyOf(list);
    rows.push(
      stat(
        `enc:set:${id}`,
        setName(id),
        record(t.wins, t.losses),
        `${plural(list.length, "game")} · ${percent(t.wins, list.length)} won`,
        lossesOf(list),
      ),
    );
  }
  return { id: "encounter", title: "Encounter", count: plural(groups.length, "modular set"), rows };
}

/** Card types a final blow is put down to: the hero, an ally, an event, or anything else (a support, an upgrade…). */
function blowKindOf(cardId: string, names: StatsNames): "hero" | "ally" | "event" | "other" {
  const type = names.cardType(cardId);
  if (type === "hero_identity" || type === "alter_ego_identity" || type === "hero" || type === "alter_ego")
    return "hero";
  if (type === "ally" || type === "event") return type;
  return "other";
}

const BLOW_LABELS = { hero: "The hero", ally: "An ally", event: "An event", other: "Another card" } as const;

/** Who finishes the villain: the hero whose card it was, what kind of card, and the card that did it most. */
function finalBlowRowsOf(games: readonly GameFacts[], names: StatsNames): StatRow[] {
  const name = (id: string): string => names.cardName(id) ?? id;
  const wins = games.filter((g) => g.result === "won" && g.summary);
  const rows: StatRow[] = [];
  const by = new Map<string, number>();
  const cards = new Map<string, number>();
  const kinds = new Map<string, number>();
  for (const game of wins) {
    const hero = game.summary!.finalBlowBy;
    if (hero) by.set(hero, (by.get(hero) ?? 0) + 1);
    const card = game.summary!.finalBlowCardId;
    if (card) {
      cards.set(card, (cards.get(card) ?? 0) + 1);
      const kind = blowKindOf(card, names);
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }
  }
  const top = (map: Map<string, number>) =>
    [...map.entries()].sort(([a, x], [b, y]) => y - x || name(a).localeCompare(name(b)))[0];
  const hero = top(by);
  if (hero)
    rows.push(
      stat("blow:hero", "Finishes the villain most", name(hero[0]), plural(hero[1], "final blow"), { cardId: hero[0] }),
    );
  if (kinds.size > 0) {
    const total = [...kinds.values()].reduce((a, b) => a + b, 0);
    const parts = (["hero", "ally", "event", "other"] as const)
      .filter((kind) => kinds.has(kind))
      .map((kind) => `${BLOW_LABELS[kind]} ${percent(kinds.get(kind)!, total)}`);
    const [most] = [...kinds.entries()].sort(([, x], [, y]) => y - x)[0]!;
    rows.push(stat("blow:kind", "Final blow by", BLOW_LABELS[most as keyof typeof BLOW_LABELS], parts.join(" · ")));
  }
  const card = top(cards);
  if (card)
    rows.push(stat("blow:card", "Final blow card", name(card[0]), plural(card[1], "time"), { cardId: card[0] }));
  return rows;
}

/** Top encounter cards in `pick` across games, as rows with the card for the hover popover. */
function encounterCardRowsOf(
  games: readonly GameFacts[],
  names: StatsNames,
  pick: (summary: GameSummary) => Readonly<Record<string, number>> | undefined,
  id: string,
  title: string,
  detail: (n: number, games: number) => string,
): StatRow[] {
  const totals = new Map<string, { n: number; games: number }>();
  for (const game of games) {
    const counts = game.summary ? pick(game.summary) : undefined;
    for (const [cardId, n] of Object.entries(counts ?? {})) {
      const entry = totals.get(cardId) ?? { n: 0, games: 0 };
      entry.n += n;
      entry.games++;
      totals.set(cardId, entry);
    }
  }
  const name = (cardId: string): string => names.cardName(cardId) ?? cardId;
  return [...totals.entries()]
    .sort(([a, x], [b, y]) => y.n - x.n || name(a).localeCompare(name(b)))
    .slice(0, TOP)
    .map(([cardId, t], index) =>
      stat(
        `${id}:${cardId}`,
        index === 0 ? title : name(cardId),
        index === 0 ? name(cardId) : String(t.n),
        detail(t.n, t.games),
        {
          cardId,
          ...(index === 0 ? { highlight: true as const } : {}),
        },
      ),
    );
}

/** Flags each hero's own card in a cards view, for the "Hide hero cards" toggle. */
function markSignature(view: HeroCardsView, names: StatsNames): HeroCardsView {
  return {
    ...view,
    groups: view.groups.map((group) => ({
      ...group,
      cards: group.cards.map((card) =>
        names.cardAspect(card.cardId)?.startsWith("hero:") ? { ...card, signature: true as const } : card,
      ),
    })),
  };
}

export function playerStatsOf(saves: readonly SaveMeta[], names: StatsNames, filter: StatsFilter = {}): PlayerStats {
  const facts = saves.flatMap((meta) => factsOf(meta, names) ?? []);
  // One name per villain key, the newest game's, so an older save (named by its scenario) and a newer one (named by
  // its villains) land in the same row.
  const villainNames = new Map<string, { at: number; name: string }>();
  for (const game of facts) {
    const known = villainNames.get(game.villainKey);
    if (!known || game.at > known.at) villainNames.set(game.villainKey, { at: game.at, name: game.villain });
  }
  const every = facts.map((game) => ({ ...game, villain: villainNames.get(game.villainKey)!.name }));
  const filterOptions: StatsFilterOptions = {
    heroes: byPlayed(
      groupBy(every, (g) => g.seats.map((s) => s.identityCardId)),
      (id) => names.cardName(id) ?? id,
    ).map(([id]) => ({ id, name: names.cardName(id) ?? id })),
    villains: byPlayed(
      groupBy(every, (g) => [g.villain]),
      (v) => v,
    ).map(([name]) => name),
    difficulties: (["standard", "expert", "extreme"] as const).filter((d) => every.some((g) => g.difficulty === d)),
  };
  const games = every.filter(
    (g) =>
      (filter.hero === undefined || g.seats.some((s) => s.identityCardId === filter.hero)) &&
      (filter.villain === undefined || g.villain === filter.villain) &&
      (filter.difficulty === undefined || g.difficulty === filter.difficulty),
  );
  const filtered = filter.hero !== undefined || filter.villain !== undefined || filter.difficulty !== undefined;
  // Concessions have no villain or result to filter by: they count only with no filter on.
  const concessions = filtered ? 0 : saves.filter(isConcession).length;
  const older = games.filter((g) => !g.detailed).length;
  const heroes = byPlayed(
    groupBy(games, (g) => g.seats.map((s) => s.identityCardId)),
    (id) => names.cardName(id) ?? id,
  ).map(([id]) => id);
  const overview = overviewOf(games, concessions, older);
  const header = headerOf(games);
  const sections: StatsSection[] = [overview];
  if (games.length === 0)
    return {
      header,
      sections,
      overview: overviewTilesOf(games, header, overview, null, null, null, () => undefined),
      heroCards: [],
      allCards: null,
      aspects: [],
      filter,
      filterOptions,
    };
  const heroSection = heroesOf(games, names);
  const villainSection = villainsOf(games);
  const sideSection = sideSchemesOf(games, names);
  const devices = devicesOf(games);
  const aspects = aspectSharesOf(games);
  const encounter = encounterOf(games, names);
  sections.push(
    heroSection,
    villainSection,
    sideSection,
    ...(aspects.length > 0 ? [aspectsSectionOf(aspects)] : []),
    recordsOf(games, names),
    ...(encounter ? [encounter] : []),
    ...(devices ? [devices] : []),
  );
  const heroCards: HeroCardsView[] = [];
  for (const id of heroes) {
    const cards = heroCardsOf(id, games, names);
    sections.push(cards);
    heroCards.push(heroCardsViewOf(cards, id, names.cardName(id) ?? id));
  }
  const villainScenario = (name: string): string | undefined =>
    [...games].sort((a, b) => b.at - a.at).find((g) => g.villain === name)?.scenarioId;
  return {
    header,
    sections,
    overview: overviewTilesOf(games, header, overview, heroSection, villainSection, sideSection, villainScenario),
    heroCards: heroCards.map((view) => markSignature(view, names)),
    allCards: (() => {
      const all = allCardsOf(games, names);
      return all ? markSignature(all, names) : null;
    })(),
    aspects,
    filter,
    filterOptions,
  };
}

export function statsRowHeightsOf(phone: boolean): {
  readonly section: number;
  readonly stat: number;
  readonly note: number;
} {
  return phone ? { section: 44, stat: 74, note: 52 } : { section: 46, stat: 58, note: 40 };
}
