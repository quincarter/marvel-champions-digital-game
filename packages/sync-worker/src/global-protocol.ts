/**
 * The global win rate routes (`/global/...`): what a client sends after a finished game and what it reads back. Imported
 * by the client as `@mc/sync-worker/global-protocol`, so both sides share these shapes. Uploads are opt-in and anonymous:
 * no sync space, no device, no names, only what the game was. `id` is a one-way hash of the game's save id, so the same
 * game synced to two devices counts once.
 */

/** Why a game was lost, as Your stats breaks it down. */
export const LOSS_CAUSES = ["scheme", "villain", "minions", "encounter", "other", "unknown"] as const;
export type GlobalLossCause = (typeof LOSS_CAUSES)[number];

export const GLOBAL_DIFFICULTIES = ["standard", "expert", "extreme"] as const;
export type GlobalDifficulty = (typeof GLOBAL_DIFFICULTIES)[number];

/** A seat of a finished game: its hero, its aspects and the cards in its deck, once each. */
export interface GlobalSeat {
  readonly hero: string;
  readonly aspects: readonly string[];
  readonly deck: readonly string[];
}

/** `POST /global/result`. */
export interface GlobalResult {
  readonly v: 1;
  /** 32 lowercase hex characters. */
  readonly id: string;
  /** The villain's name as Your stats gives it. */
  readonly villain: string;
  readonly difficulty: GlobalDifficulty;
  readonly modulars: readonly string[];
  readonly seats: readonly GlobalSeat[];
  readonly won: boolean;
  /** Null for a win. */
  readonly cause: GlobalLossCause | null;
}

export const GLOBAL_ID_PATTERN = /^[0-9a-f]{32}$/;
/** A card or encounter set id. */
export const GLOBAL_KEY_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
/** A villain's name. */
export const GLOBAL_VILLAIN_PATTERN = /^[\p{L}\p{N} '’&.,:()!-]{1,80}$/u;
export const GLOBAL_MAX_MODULARS = 6;
export const GLOBAL_MAX_SEATS = 4;
export const GLOBAL_MAX_DECK_CARDS = 80;
export const GLOBAL_MAX_BODY_BYTES = 16 * 1024;
/** A row with fewer games than this is never served: too few to mean anything, and closer to one person's games. */
export const GLOBAL_MIN_GAMES = 20;

/** One villain's, modular set's or hero's numbers, at `GLOBAL_MIN_GAMES` or more. */
export interface GlobalRow {
  readonly key: string;
  readonly games: number;
  readonly wins: number;
  /** Losses by cause; a cause with none is absent. */
  readonly causes: Partial<Record<GlobalLossCause, number>>;
}

/** `GET /global/stats`. */
export interface GlobalStats {
  readonly updatedAt: number;
  readonly games: number;
  readonly villains: readonly GlobalRow[];
  readonly modulars: readonly GlobalRow[];
  readonly heroes: readonly GlobalRow[];
}

/**
 * `GET /global/cards?villain=<name>`: the decks brought against a villain, a seat being one deck, and the cards in them
 * (absent cards are 0). Only at `GLOBAL_MIN_GAMES` decks or more; a card in fewer than 3 decks is left out.
 */
export interface GlobalVillainCards {
  readonly villain: string;
  readonly wins: number;
  readonly losses: number;
  readonly inWins: Readonly<Record<string, number>>;
  readonly inLosses: Readonly<Record<string, number>>;
}

export type GlobalErrorReason =
  | "disabled"
  | "origin"
  | "bad-request"
  | "too-large"
  | "rate-limited"
  | "full"
  | "not-found"
  | "server";

export interface GlobalError {
  readonly reason: GlobalErrorReason;
  readonly error: string;
}

/** Most aspects a seat may name (a hero has one, with room for a second aspect card). */
export const GLOBAL_MAX_ASPECTS = 4;

/** `__proto__` fits the pattern but is never a real id; it would be a prototype write as an object key. */
const isKey = (value: unknown): value is string =>
  typeof value === "string" && GLOBAL_KEY_PATTERN.test(value) && value !== "__proto__";

const isKeyList = (value: unknown, max: number): value is string[] =>
  Array.isArray(value) && value.length <= max && value.every(isKey);

/**
 * Checks an uploaded body against every pattern and cap above and returns it cut down to the fields of
 * `GlobalResult` (nothing else the caller sent is kept), or null when anything is wrong: a wrong `v`, an unknown
 * difficulty or cause, a win with a cause or a loss without one, a repeated hero or modular set, more seats, modulars
 * or deck cards than the caps. A card listed twice in a deck is listed once.
 */
export function parseGlobalResult(input: unknown): GlobalResult | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.id !== "string" || !GLOBAL_ID_PATTERN.test(o.id)) return null;
  if (typeof o.villain !== "string" || !GLOBAL_VILLAIN_PATTERN.test(o.villain)) return null;
  if (typeof o.difficulty !== "string" || !(GLOBAL_DIFFICULTIES as readonly string[]).includes(o.difficulty)) {
    return null;
  }
  if (!isKeyList(o.modulars, GLOBAL_MAX_MODULARS) || new Set(o.modulars).size !== o.modulars.length) return null;
  if (typeof o.won !== "boolean") return null;
  if (o.won) {
    if (o.cause !== null) return null;
  } else if (typeof o.cause !== "string" || !(LOSS_CAUSES as readonly string[]).includes(o.cause)) {
    return null;
  }
  if (!Array.isArray(o.seats) || o.seats.length < 1 || o.seats.length > GLOBAL_MAX_SEATS) return null;
  const seats: GlobalSeat[] = [];
  const heroes = new Set<string>();
  for (const raw of o.seats as unknown[]) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const s = raw as Record<string, unknown>;
    if (!isKey(s.hero) || heroes.has(s.hero)) return null;
    if (!isKeyList(s.aspects, GLOBAL_MAX_ASPECTS) || !isKeyList(s.deck, GLOBAL_MAX_DECK_CARDS)) return null;
    heroes.add(s.hero);
    seats.push({ hero: s.hero, aspects: [...new Set(s.aspects)], deck: [...new Set(s.deck)] });
  }
  return {
    v: 1,
    id: o.id,
    villain: o.villain,
    difficulty: o.difficulty as GlobalDifficulty,
    modulars: o.modulars,
    seats,
    won: o.won,
    cause: o.won ? null : (o.cause as GlobalLossCause),
  };
}
