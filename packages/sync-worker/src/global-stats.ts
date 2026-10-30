/**
 * The global win rate store, one Durable Object named "global" (`GlobalStats`), over a plain storage interface for
 * tests. Nothing about the caller is kept: no IP, no per-game timestamp; a game is only counted into totals.
 *
 * Rows:
 *   `meta`            totals and bookkeeping: games, distinct aggregate keys, today's count, the next alarm.
 *   `g:<yyyymm>:<id>` "this game was counted": the dedupe row, in a month bucket the alarm drops once it is two months old.
 *   `v:<villain>`, `m:<modular>`, `h:<hero>`   `{games, wins, causes}`.
 *   `c:<villain>`     `{wins, losses, inWins, inLosses}`: the deck cards brought against a villain, counted per seat.
 *   `s:summary`       the served `GET /global/stats` body, rebuilt at most once an hour on read.
 *
 * Rows written per game, all in one `put` call so a game counts whole or not at all: 1 dedupe row, 1 villain, 1 per
 * modular set (at most 6), 1 per distinct hero (at most 4), 1 card row, 1 meta. A solo game with one modular set is 6
 * rows, the worst game is 14; a retry (a seen id) writes none. The alarm is set once a month (one more row). Rows read
 * per game: the two dedupe lookups, meta, the card row and the villain, modular and hero rows, in one `get`.
 */

import type { KeyValueStorage } from "./env.js";
import {
  GLOBAL_MIN_GAMES,
  type GlobalLossCause,
  type GlobalResult,
  type GlobalRow,
  type GlobalStats,
  type GlobalVillainCards,
} from "./global-protocol.js";

/** Results the whole store takes per UTC day. */
export const GLOBAL_RESULTS_PER_DAY = 3000;
/** Distinct v/m/h/c rows; past it a game that needs a new one answers `full`. */
export const GLOBAL_MAX_KEYS = 3000;
/** A `c:` row's size as JSON; past it, cards seen in one deck only are evicted to make room. */
export const GLOBAL_MAX_CARD_ROW_BYTES = 100 * 1024;
/** A card in fewer decks than this is left out of `GET /global/cards`. */
export const GLOBAL_MIN_CARD_DECKS = 3;
export const GLOBAL_SUMMARY_TTL_MS = 60 * 60 * 1000;
const DEDUPE_BATCH = 100;
/** Time between alarm steps (a dedupe batch or a sweep batch). */
export const GLOBAL_ALARM_PACE_MS = 10 * 60 * 1000;
/** The monthly sweep drops a v/m/h row with fewer games than this. */
export const GLOBAL_MIN_KEEP_GAMES = 3;
/** Rows a sweep step lists; a villain deletes two rows, so a step deletes at most 120 (the 128-key limit). */
const SWEEP_BATCH = 60;
const SWEEP_PREFIXES = ["v:", "m:", "h:"];
const DAY_MS = 24 * 60 * 60 * 1000;

interface Meta {
  games: number;
  keys: number;
  /** UTC day number (ms / DAY_MS) of `dayCount`. */
  day: number;
  dayCount: number;
  /** When the alarm is set for; 0 or absent when none is. */
  alarmAt?: number;
  /** The month (yyyymm) the key sweep last finished, and where an unfinished one stands. */
  sweptMonth?: string;
  sweep?: { p: number; after: string };
}

interface AggregateRow {
  games: number;
  wins: number;
  causes: Partial<Record<GlobalLossCause, number>>;
}

interface CardRow {
  wins: number;
  losses: number;
  inWins: Record<string, number>;
  inLosses: Record<string, number>;
}

export type RecordOutcome =
  | { ok: true; counted: boolean }
  | { ok: false; reason: "full" | "rate-limited"; retryAfterMs: number };

const monthOf = (t: number): string => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const previousMonthOf = (t: number): string => {
  const d = new Date(t);
  return monthOf(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
};
/** One hour past the first moment of the next month. */
const nextMonthAlarm = (t: number): number => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 1);
};

function bump(row: AggregateRow, won: boolean, cause: GlobalLossCause | null): void {
  row.games += 1;
  if (won) row.wins += 1;
  else if (cause) row.causes[cause] = (row.causes[cause] ?? 0) + 1;
}

const emptyAggregate = (): AggregateRow => ({ games: 0, wins: 0, causes: {} });

export class GlobalStatsLogic {
  constructor(private readonly storage: KeyValueStorage) {}

  /** Counts one validated game, once per `id`. */
  async record(result: GlobalResult, now: number): Promise<RecordOutcome> {
    const month = monthOf(now);
    const dedupeKey = `g:${month}:${result.id}`;
    const previousKey = `g:${previousMonthOf(now)}:${result.id}`;

    const heroes = [...new Set(result.seats.map((s) => s.hero))];
    const aggregateKeys = [
      `v:${result.villain}`,
      ...result.modulars.map((m) => `m:${m}`),
      ...heroes.map((h) => `h:${h}`),
    ];
    const cardKey = `c:${result.villain}`;

    const found = await this.storage.get<unknown>([dedupeKey, previousKey, "meta", cardKey, ...aggregateKeys]);
    if (found.has(dedupeKey) || found.has(previousKey)) return { ok: true, counted: false };

    const meta: Meta = (found.get("meta") as Meta | undefined) ?? { games: 0, keys: 0, day: 0, dayCount: 0 };
    const today = Math.floor(now / DAY_MS);
    if (meta.day !== today) {
      meta.day = today;
      meta.dayCount = 0;
    }
    if (meta.dayCount >= GLOBAL_RESULTS_PER_DAY) {
      return { ok: false, reason: "rate-limited", retryAfterMs: (today + 1) * DAY_MS - now };
    }

    // The card row counts as one key too, so a new villain name costs two.
    const newKeys = aggregateKeys.filter((k) => !found.has(k)).length + (found.has(cardKey) ? 0 : 1);
    if (meta.keys + newKeys > GLOBAL_MAX_KEYS) return { ok: false, reason: "full", retryAfterMs: 0 };

    const writes: Record<string, unknown> = {};
    for (const key of aggregateKeys) {
      const row = (found.get(key) as AggregateRow | undefined) ?? emptyAggregate();
      bump(row, result.won, result.cause);
      writes[key] = row;
    }

    const cards = (found.get(cardKey) as CardRow | undefined) ?? { wins: 0, losses: 0, inWins: {}, inLosses: {} };
    const bucket = result.won ? cards.inWins : cards.inLosses;
    let size = JSON.stringify(cards).length;
    const brought = new Set<string>();
    for (const seat of result.seats) {
      if (result.won) cards.wins += 1;
      else cards.losses += 1;
      for (const card of seat.deck) {
        // Own properties only: "constructor" and the like are card names, not inherited members.
        if (!Object.hasOwn(bucket, card)) {
          // A new card name adds its key, quotes, colon, comma and a count (8 bytes, counted generously).
          size += card.length + 8;
          bucket[card] = 0;
        }
        bucket[card]! += 1;
        brought.add(card);
      }
    }
    // Past the byte cap, forged or rare ids make room by leaving: cards seen once go first (other decks' before this
    // game's), so a row cannot freeze at the cap and refuse real new cards. Cards with 2 or more decks stay, so the
    // row never grows past what it held plus nothing.
    if (size > GLOBAL_MAX_CARD_ROW_BYTES) {
      for (const own of [false, true]) {
        for (const map of [cards.inWins, cards.inLosses]) {
          for (const [card, count] of Object.entries(map)) {
            if (size <= GLOBAL_MAX_CARD_ROW_BYTES) break;
            if (count !== 1 || brought.has(card) !== own) continue;
            delete map[card];
            size -= card.length + 8;
          }
        }
      }
    }
    writes[cardKey] = cards;

    meta.games += 1;
    meta.keys += newKeys;
    meta.dayCount += 1;
    writes[dedupeKey] = 1;
    if (!meta.alarmAt || meta.alarmAt <= now) {
      meta.alarmAt = nextMonthAlarm(now);
      await this.storage.setAlarm(meta.alarmAt);
    }
    writes.meta = meta;
    await this.storage.put(writes);
    return { ok: true, counted: true };
  }

  /** `GET /global/stats`: the stored summary, rebuilt when it is over an hour old. */
  async stats(now: number): Promise<GlobalStats> {
    const stored = await this.storage.get<GlobalStats>("s:summary");
    if (stored && stored.updatedAt <= now && now - stored.updatedAt < GLOBAL_SUMMARY_TTL_MS) return stored;
    const meta = await this.storage.get<Meta>("meta");
    const rows = async (prefix: string): Promise<GlobalRow[]> => {
      const listed = await this.storage.list<AggregateRow>({ prefix });
      return [...listed]
        .filter(([, row]) => row.games >= GLOBAL_MIN_GAMES)
        .map(([key, row]) => ({
          key: key.slice(prefix.length),
          games: row.games,
          wins: row.wins,
          causes: { ...row.causes },
        }))
        .sort((a, b) => b.games - a.games || (a.key < b.key ? -1 : 1));
    };
    const summary: GlobalStats = {
      updatedAt: now,
      games: meta?.games ?? 0,
      villains: await rows("v:"),
      modulars: await rows("m:"),
      heroes: await rows("h:"),
    };
    await this.storage.put("s:summary", summary);
    return summary;
  }

  /** `GET /global/cards`: null when the villain is unknown or has fewer than GLOBAL_MIN_GAMES decks. */
  async cards(villain: string): Promise<GlobalVillainCards | null> {
    const row = await this.storage.get<CardRow>(`c:${villain}`);
    if (!row || row.wins + row.losses < GLOBAL_MIN_GAMES) return null;
    const inWins: Record<string, number> = {};
    const inLosses: Record<string, number> = {};
    for (const card of new Set([...Object.keys(row.inWins), ...Object.keys(row.inLosses)])) {
      const w = row.inWins[card] ?? 0;
      const l = row.inLosses[card] ?? 0;
      if (w + l < GLOBAL_MIN_CARD_DECKS) continue;
      if (w > 0) inWins[card] = w;
      if (l > 0) inLosses[card] = l;
    }
    return { villain, wins: row.wins, losses: row.losses, inWins, inLosses };
  }

  /**
   * The alarm. Each run does one small paced step, either a batch of dedupe rows older than the previous month, or (once
   * those are gone, once a month) a batch of the key sweep that drops v/m/h rows under GLOBAL_MIN_KEEP_GAMES games, with
   * a villain's `c:` row, so garbage ids cannot hold the key cap forever. A step is at most 120 deletes (sweep) or 100
   * (dedupe) plus the meta row and the alarm; steps are GLOBAL_ALARM_PACE_MS apart, so maintenance writes at most
   * 144 x 122 = 17,600 rows a day, and only while a backlog lasts (a month's sweep of a full store is about 50 steps).
   */
  async expire(now: number): Promise<void> {
    const meta = await this.storage.get<Meta>("meta");
    if (!meta) return;
    const keep = previousMonthOf(now);
    const listed = await this.storage.list<unknown>({ prefix: "g:", limit: DEDUPE_BATCH });
    const old = [...listed.keys()].filter((key) => key.slice(2, 8) < keep);
    let next: number;
    if (old.length > 0) {
      await this.storage.delete(old);
      next = now + GLOBAL_ALARM_PACE_MS;
    } else if (!(await this.sweepStep(meta, monthOf(now)))) {
      next = now + GLOBAL_ALARM_PACE_MS;
    } else {
      next = listed.size > 0 ? nextMonthAlarm(now) : 0;
    }
    meta.alarmAt = next;
    await this.storage.put("meta", meta);
    if (next) await this.storage.setAlarm(next);
  }

  /** One batch of the monthly key sweep; true when the month's sweep is finished. Mutates `meta`. */
  private async sweepStep(meta: Meta, month: string): Promise<boolean> {
    if (meta.sweptMonth === month) return true;
    const sweep = meta.sweep ?? { p: 0, after: "" };
    const prefix = SWEEP_PREFIXES[sweep.p]!;
    const listed = await this.storage.list<AggregateRow>({ prefix, start: sweep.after || prefix, limit: SWEEP_BATCH });
    const doomed: string[] = [];
    let last = sweep.after;
    for (const [key, row] of listed) {
      last = key;
      if (key === sweep.after) continue;
      if (row.games >= GLOBAL_MIN_KEEP_GAMES) continue;
      doomed.push(key);
      // A villain's card row goes with it.
      if (prefix === "v:") doomed.push(`c:${key.slice(2)}`);
    }
    if (doomed.length > 0) {
      const existing = await this.storage.get<unknown>(doomed);
      const gone = doomed.filter((key) => existing.has(key));
      if (gone.length > 0) await this.storage.delete(gone);
      meta.keys = Math.max(0, meta.keys - gone.length);
    }
    if (listed.size < SWEEP_BATCH) {
      // This prefix is done.
      if (sweep.p + 1 < SWEEP_PREFIXES.length) {
        meta.sweep = { p: sweep.p + 1, after: "" };
        return false;
      }
      delete meta.sweep;
      meta.sweptMonth = month;
      return true;
    }
    meta.sweep = { p: sweep.p, after: last };
    return false;
  }
}
