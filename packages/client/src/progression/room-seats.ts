/**
 * Which save rows count for the achievements, and for whom (#909, docs/multiplayer-achievements-plan.md ground rules).
 *
 * A row played alone (no `roomPlay`) is one person at every seat, so every seat is mine and single-player results are
 * unchanged. A room row narrows to the seats this device held. A room game with Cheats on, an adjusted game (#791),
 * and a room row where this device held no seat (a host who only hosted) earn nothing here. Pure: no storage, no Phaser.
 *
 * Also the plug-in point for the multiplayer achievement modules (`achievements-together.ts`,
 * `achievements-epic-competitive.ts`, `achievements-feats.ts`): their definitions are `MultiplayerDef`s, built with
 * `multiplayerDef`, measured against `MultiplayerFacts`. Only types are imported from `achievements.ts`, so those
 * modules can load before it does.
 */
import type { PlayerId } from "@mc/engine";
import type { RoomPlayRecord } from "../engine/room-play.js";
import { mySeatsOf } from "../engine/room-play.js";
import { isAdjustedSave, isCompetitiveSave } from "../engine/game-storage.js";
import type { GameSummary } from "../engine/game-summary.js";
import type { AchievementDef, AchievementProgress, AchievementSave } from "./achievements.js";

export { mySeatsOf };

/** The loose shape of a row the filters read: any save row an achievement can see. */
export interface SeatRow {
  readonly roomPlay?: RoomPlayRecord | undefined;
  readonly adjusted?: unknown;
  readonly config: { readonly players: readonly unknown[]; readonly room?: unknown };
}

/** The part of `roomPlay` the merge reads and writes. */
interface MergeableRoomPlay {
  readonly role: string;
  readonly gameKey: string;
  readonly mySeats: readonly string[];
  readonly friends?: readonly string[];
}

/**
 * One row per room game (#909). A synced account can hold a game as the host's row on one device and as a seated
 * guest's row on another: the same game (`roomPlay.gameKey`), so it counts once. The host's row is the base (else the
 * newest by `updatedAt`, ties to the first), and its `mySeats` (and `friends`) become the union of both rows', so a
 * seat held on either device is credited. Rows without `roomPlay` pass through; order follows each game's first row.
 */
export function mergeRoomGames<
  T extends { readonly roomPlay?: MergeableRoomPlay | undefined; readonly updatedAt?: number },
>(rows: readonly T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.roomPlay?.gameKey;
    if (key !== undefined) groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const out: T[] = [];
  const done = new Set<string>();
  for (const row of rows) {
    const key = row.roomPlay?.gameKey;
    if (key === undefined) {
      out.push(row);
      continue;
    }
    if (done.has(key)) continue;
    done.add(key);
    const group = groups.get(key)!;
    if (group.length === 1) {
      out.push(row);
      continue;
    }
    let base = group[0]!;
    for (const candidate of group.slice(1)) {
      const hostBeats = candidate.roomPlay!.role === "host" && base.roomPlay!.role !== "host";
      const sameRole = candidate.roomPlay!.role === base.roomPlay!.role;
      if (hostBeats || (sameRole && (candidate.updatedAt ?? 0) > (base.updatedAt ?? 0))) base = candidate;
    }
    const mySeats = [...new Set(group.flatMap((r) => r.roomPlay!.mySeats))];
    const friends = [...new Set(group.flatMap((r) => r.roomPlay!.friends ?? []))];
    out.push({
      ...base,
      roomPlay: { ...base.roomPlay!, mySeats, ...(base.roomPlay!.friends === undefined ? {} : { friends }) },
    } as T);
  }
  return out;
}

/** A game played in a room, as host or guest. */
export const isRoomRow = (row: Pick<SeatRow, "roomPlay">): boolean => row.roomPlay !== undefined;

/** A guest's finished copy of a room game. */
export const isGuestRow = (row: Pick<SeatRow, "roomPlay">): boolean => row.roomPlay?.role === "guest";

/** A Civil War Competitive game: played only for everything but the competitive achievements. */
export const isCompetitiveRow = (row: { readonly config?: object; readonly outcome?: unknown }): boolean =>
  isCompetitiveSave(row);

/** True for a room row where this device held at least one seat; every row played alone has them all. */
export const holdsASeat = (row: SeatRow): boolean => mySeatsOf(row).length > 0;

/**
 * Whether a row earns anything: not adjusted, not a Cheats room, and, for a room game, a seat of this device in it. A
 * game played alone always counts (its seats are all this device's, even a record that lists none).
 */
export function countsForAchievements(row: SeatRow): boolean {
  if (isAdjustedSave(row)) return false;
  if (row.roomPlay?.cheats === true) return false;
  return isRoomRow(row) ? holdsASeat(row) : true;
}

/** The 0-based seat indexes of a row this device holds (seat `pN` is `config.players[N - 1]`). */
export function mySeatIndexesOf(row: SeatRow): readonly number[] {
  const mine = new Set<string>(mySeatsOf(row));
  return row.config.players.flatMap((_, index) => (mine.has(`p${index + 1}`) ? [index] : []));
}

/** A finished (won or lost) game that counts, with what the multiplayer achievements read from it. */
export interface GameRow {
  readonly save: AchievementSave;
  readonly won: boolean;
  /**
   * The game's summary; null on a save from before one existed. Its `together`, `feats`, `boosts` and `endState`
   * counters are each absent on a version 6 or older summary.
   */
  readonly summary: GameSummary | null;
  /** Absent on a game played alone. */
  readonly roomPlay: RoomPlayRecord | undefined;
  readonly config: AchievementSave["config"];
  /** The engine player ids this device holds (every seat in a game played alone). */
  readonly mySeats: readonly PlayerId[];
  /** The same seats as 0-based indexes into `config.players` and `summary.seats`. */
  readonly mySeatIndexes: readonly number[];
}

/** What a multiplayer achievement is measured against. */
export interface MultiplayerFacts {
  /**
   * Finished, non-competitive, non-lesson, non-custom games that count (`countsForAchievements`): room rows (host and
   * guest) and games played alone alike; filter on `roomPlay` for the room ones.
   */
  readonly rows: readonly GameRow[];
  /** The same for Civil War Competitive games, which no other fact sees. */
  readonly competitiveRows: readonly GameRow[];
  /**
   * Finished room games this device hosted, whether or not it held a seat (Game Night Host). Cheats and adjusted games
   * are left out.
   */
  readonly hostedRows: readonly GameRow[];
  /** Live games watched to the end (`AchievementHistory.watched`); 0 when the history carries none. */
  readonly watched: number;
}

export const NO_MULTIPLAYER_FACTS: MultiplayerFacts = { rows: [], competitiveRows: [], hostedRows: [], watched: 0 };

/** The game rows of a history, as `MultiplayerFacts`. `skip` drops lessons and custom-content games. */
export function multiplayerFactsOf(
  saves: readonly AchievementSave[],
  skip: (save: AchievementSave) => boolean,
  watched: number,
): MultiplayerFacts {
  const rows: GameRow[] = [];
  const competitiveRows: GameRow[] = [];
  const hostedRows: GameRow[] = [];
  for (const save of mergeRoomGames(saves)) {
    if ((save.status !== "won" && save.status !== "lost") || skip(save)) continue;
    if (isAdjustedSave(save) || save.roomPlay?.cheats === true) continue;
    const row: GameRow = {
      save,
      won: save.status === "won",
      summary: save.summary ?? null,
      roomPlay: save.roomPlay,
      config: save.config,
      mySeats: mySeatsOf(save),
      mySeatIndexes: mySeatIndexesOf(save),
    };
    if (save.roomPlay?.role === "host") hostedRows.push(row);
    if (!countsForAchievements(save)) continue;
    (isCompetitiveRow(save) ? competitiveRows : rows).push(row);
  }
  return { rows, competitiveRows, hostedRows, watched };
}

/** An achievement a multiplayer module defines: an `AchievementDef` whose `measure` reads `MultiplayerFacts`. */
export type MultiplayerDef = Omit<AchievementDef, "measure" | "tracked" | "showProgress" | "points"> &
  Partial<Pick<AchievementDef, "tracked" | "showProgress" | "points">> & {
    readonly measure: (facts: MultiplayerFacts) => AchievementProgress | null;
  };

/** Identity helper that type-checks a definition (`tracked`, `showProgress` and `points` default as in `def`). */
export const multiplayerDef = (fields: MultiplayerDef): MultiplayerDef => fields;

/** `{ current, target }` with current capped at target, as `achievements.ts` does. */
export const progressCount = (current: number, target: number): AchievementProgress => ({
  current: Math.min(current, target),
  target,
});
