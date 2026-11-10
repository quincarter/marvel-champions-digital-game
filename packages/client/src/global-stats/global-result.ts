/**
 * One finished game as the global win rates take it (`GlobalResult`, `@mc/sync-worker/global-protocol`): the villain,
 * difficulty, modular sets, each seat's hero, aspects and deck, whether it was won, and why it was lost. Nothing else:
 * no save id, seed, time, name or device. `id` is a one-way hash of the save id, so a game synced to two devices counts
 * once and the id cannot be tied back to the save.
 *
 * Pure apart from the hash. Custom content: nothing in a save marks a game as using it (a deck is a list of official
 * card ids, `CorePlayer`; there is no custom card pack), so the guard is that every id sent is a plain pool-style key
 * (`GLOBAL_KEY_PATTERN`) and the villain a plain name (`GLOBAL_VILLAIN_PATTERN`): a game with an id outside that returns
 * null rather than being trimmed.
 */
import {
  GLOBAL_KEY_PATTERN,
  GLOBAL_MAX_ASPECTS,
  GLOBAL_MAX_DECK_CARDS,
  GLOBAL_MAX_MODULARS,
  GLOBAL_MAX_SEATS,
  GLOBAL_VILLAIN_PATTERN,
  type GlobalResult,
  type GlobalSeat,
} from "@mc/sync-worker/global-protocol";
import type { SaveMeta } from "../engine/game-storage.js";
import { villainNameOf } from "../view/deck-insights.js";
import { lossCauseOfMeta, type StatsNames } from "../view/player-stats-model.js";

const ID_SALT = "mc-global-v1:";
/** The first summary version that carries `seats` and `defeatedBy` (`SUMMARY_VERSION` 5). */
const MIN_SUMMARY_VERSION = 5;

/** 32 hex characters of SHA-256 over the salted save id. */
export async function globalIdOf(saveId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ID_SALT + saveId));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

const isKey = (value: string): boolean => GLOBAL_KEY_PATTERN.test(value);
const once = (values: readonly string[]): string[] => [...new Set(values)];

export function globalResultOf(meta: SaveMeta, names: StatsNames, id: string): GlobalResult | null {
  if (meta.guided || (meta.status !== "won" && meta.status !== "lost")) return null;
  // A Skirmish game is shorter than the difficulty it would be counted under, so it stays out of the global numbers.
  if (meta.config.modes?.skirmish) return null;
  const summary = meta.summary;
  if (!summary || (summary.version ?? 1) < MIN_SUMMARY_VERSION || !summary.seats) return null;
  const villain = villainNameOf(meta, names);
  if (!GLOBAL_VILLAIN_PATTERN.test(villain)) return null;
  const modulars = once(meta.config.modularSetIds ?? names.scenarioModulars?.(meta.config.scenarioId) ?? []);
  // Over the cap is null, not trimmed: a cut list would count the game against the wrong sets.
  if (!modulars.every(isKey) || modulars.length > GLOBAL_MAX_MODULARS) return null;
  const seated = summary.seats.filter((seat) => !seat.satOut);
  if (seated.length === 0) return null;
  const seats: GlobalSeat[] = [];
  const heroes = new Set<string>();
  for (const seat of seated) {
    const aspects = once(seat.aspects);
    const deck = once(seat.deck);
    // An id outside the pool's plain keys is content this build cannot vouch for: the game is not sent.
    if (heroes.has(seat.identityCardId) || aspects.length > GLOBAL_MAX_ASPECTS) return null;
    heroes.add(seat.identityCardId);
    if (!isKey(seat.identityCardId) || !aspects.every(isKey) || !deck.every(isKey)) return null;
    seats.push({ hero: seat.identityCardId, aspects, deck: deck.slice(0, GLOBAL_MAX_DECK_CARDS) });
  }
  const won = meta.status === "won";
  return {
    v: 1,
    id,
    villain,
    difficulty: meta.config.difficulty,
    modulars,
    seats: seats.slice(0, GLOBAL_MAX_SEATS),
    won,
    cause: won ? null : lossCauseOfMeta(meta),
  };
}
