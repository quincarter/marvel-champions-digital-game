/**
 * All-purpose counters and the type a card gives them (docs/phase7-wave9.md §3.6).
 *
 * RRG 1.8 "All-Purpose Counter" (p. 6): "Card abilities can create and define a number of different counter types …
 * If a counter is called for, an all-purpose counter is used to track its presence in the game." "An ability that
 * refers to an 'all-purpose counter' can refer to any all-purpose counter, regardless of what other types that counter
 * might have." "When an all-purpose counter is moved from one card to another, it loses any previous type it had and
 * gains the type defined on the new card it occupies. If the new card does not define a type, it is considered only an
 * 'all-purpose counter.'" The MC50 rulebook (p. 4) says the same of a counter a card effect places, and so does the
 * ruling of Jan 26, 2026 (2).
 *
 * A card's counters are stored by type (`CardInstance.counters`). Two words stand for the untyped counter in a spec:
 *
 * - `ALL_PURPOSE_COUNTER` where counters **arrive** (`EffectSpec addCounters`): they are stored under the type the
 *   card they land on defines (`definedCounterType`), and under this very key on a card that defines none.
 * - `ANY_COUNTER` where counters are **read or taken** (`removeCounters`, `moveCounters`, `ValueSpec counters`,
 *   `Predicate counterAtLeast`, `TargetQuery.hasCounter`): every counter on the card, whatever its type.
 *
 * Acceleration tokens are a token of their own (RRG 1.8 "Acceleration Token", p. 4), kept under `acceleration` on a
 * card that is not a main scheme, and are never counted, taken or retyped as all-purpose counters.
 */

import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { usesKeyword } from "./keywords.js";
import { cardOf } from "./query.js";
import type { GameState } from "./state.js";

/** The stored type of a counter on a card that defines no type, and the word for "an all-purpose counter" placed. */
export const ALL_PURPOSE_COUNTER = "allPurpose";
/** "A counter of any type" where counters are read or taken. Never a stored key. */
export const ANY_COUNTER = "any";
/** Where a non-scheme card keeps its acceleration tokens (docs/phase7-wave5.md §3.4); not an all-purpose counter. */
const ACCELERATION = "acceleration";

/**
 * The counter type `id` defines, or null when it defines none: its `uses` keyword's (RRG 1.8 "Uses", p. 46: "These are
 * 'type counters.'"), else the type its text defines (`BaseCard.definedCounterTypes`). The keyword is read as the card
 * has it now, so a facedown or blanked card defines none by it.
 *
 * A card whose text defines several types has no single answer; the first listed is used. No card in the pool does
 * yet, and one that does needs the placing player asked (docs/phase7-wave9.md §3.6).
 */
export function definedCounterTypeOrNull(state: GameState, id: InstanceId, deps?: EngineDeps): string | null {
  const uses = usesKeyword(state, id, deps);
  if (uses) return uses.counterType;
  if (state.instances[id]?.facedownAs) return null;
  return cardOf(state, id)?.definedCounterTypes?.[0] ?? null;
}

/** The type an all-purpose counter has on `id`: the one the card defines, else plain `allPurpose`. */
export const definedCounterType = (state: GameState, id: InstanceId, deps?: EngineDeps): string =>
  definedCounterTypeOrNull(state, id, deps) ?? ALL_PURPOSE_COUNTER;

/** The key counters placed as `counterType` are stored under on `id`: an all-purpose counter takes the card's type. */
export const landingCounterType = (state: GameState, id: InstanceId, counterType: string, deps?: EngineDeps): string =>
  counterType === ALL_PURPOSE_COUNTER ? definedCounterType(state, id, deps) : counterType;

/** The all-purpose counters on `id` by stored type, in the card's own order; acceleration tokens are not among them. */
export function allPurposeCountersOn(state: GameState, id: InstanceId): readonly (readonly [string, number])[] {
  return Object.entries(state.instances[id]?.counters ?? {}).filter(
    ([type, amount]) => type !== ACCELERATION && amount > 0,
  );
}

/** How many counters of `counterType` are on `id`; `ANY_COUNTER` counts every all-purpose counter there. */
export function countersOfType(state: GameState, id: InstanceId, counterType: string): number {
  if (counterType !== ANY_COUNTER) return state.instances[id]?.counters[counterType] ?? 0;
  return allPurposeCountersOn(state, id).reduce((sum, [, amount]) => sum + amount, 0);
}

/** One card's share of a "counters of any type" removal or move. */
export interface AnyCounterTake {
  /** How many counters are taken from the card: `amount` capped at what it holds (absent: all of them). */
  readonly take: number;
  /**
   * The card holds more than one type and fewer are taken than it holds, so which ones is a decision: the acting
   * player's (docs/phase7-wave9.md §3.6).
   */
  readonly ambiguous: boolean;
  /** How many of each type go, the card's defined type last. `pick` or the default order decides an ambiguous take. */
  readonly byType: readonly (readonly [string, number])[];
}

/**
 * Which counters a "counter of any type" instruction takes from `id`. Unambiguous when the card holds one type or
 * every counter goes. Otherwise `pick` (type → number, the acting player's answer) decides, when it adds up to `take`
 * and asks for no more of a type than is there; without a usable pick the card's defined type goes first (those are
 * the counters its own abilities count), then the others in the card's own order.
 */
export function anyCounterTake(
  state: GameState,
  id: InstanceId,
  amount: number | undefined,
  pick?: Readonly<Record<string, number>>,
  deps?: EngineDeps,
): AnyCounterTake {
  const held = allPurposeCountersOn(state, id);
  const defined = definedCounterTypeOrNull(state, id, deps);
  // A uses card is discarded as its last counter of the keyword's type goes, so that type is taken last and the
  // card's other counters are counted as removed from a card still in play.
  const definedLast = (taken: readonly (readonly [string, number])[]): readonly (readonly [string, number])[] => [
    ...taken.filter(([type]) => type !== defined),
    ...taken.filter(([type]) => type === defined),
  ];
  const total = held.reduce((sum, [, count]) => sum + count, 0);
  const take = Math.max(0, amount === undefined ? total : Math.min(amount, total));
  const ambiguous = held.length > 1 && take > 0 && take < total;
  if (ambiguous && pick) {
    const picked = held.map(([type, count]) => [type, Math.min(count, Math.max(0, pick[type] ?? 0))] as const);
    const valid =
      picked.reduce((sum, [, count]) => sum + count, 0) === take &&
      Object.entries(pick).every(([type, count]) => count <= (held.find(([t]) => t === type)?.[1] ?? 0));
    if (valid) return { take, ambiguous, byType: definedLast(picked.filter(([, count]) => count > 0)) };
  }
  const ordered = [...held.filter(([type]) => type === defined), ...held.filter(([type]) => type !== defined)];
  let left = take;
  const taken = new Map<string, number>();
  for (const [type, count] of ordered) {
    const going = Math.min(left, count);
    if (going > 0) taken.set(type, going);
    left -= going;
  }
  return {
    take,
    ambiguous,
    byType: definedLast(held.flatMap(([type]) => (taken.has(type) ? [[type, taken.get(type)!] as const] : []))),
  };
}

/** The frame var an ambiguous take's answer is kept under: per frame, effect and card, so no later effect reads it. */
export const anyCounterPickVar = (frameId: string, cursor: number, id: InstanceId, counterType: string): string =>
  `${anyCounterPickPrefix(frameId, cursor, id)}${counterType}`;
export const anyCounterPickPrefix = (frameId: string, cursor: number, id: InstanceId): string =>
  `anyCounterPick.${frameId}.${cursor}.${id}.`;
/** Set to 1 once the player has answered for that card. */
export const anyCounterPickMadeVar = (frameId: string, cursor: number, id: InstanceId): string =>
  `anyCounterPickMade.${frameId}.${cursor}.${id}`;

/** Reads a card's recorded pick back out of a frame's vars; undefined when the player was not asked. */
export function anyCounterPickOf(
  vars: Readonly<Record<string, number>>,
  frameId: string,
  cursor: number,
  id: InstanceId,
): Readonly<Record<string, number>> | undefined {
  if (vars[anyCounterPickMadeVar(frameId, cursor, id)] !== 1) return undefined;
  const prefix = anyCounterPickPrefix(frameId, cursor, id);
  return Object.fromEntries(
    Object.entries(vars)
      .filter(([name]) => name.startsWith(prefix))
      .map(([name, count]) => [name.slice(prefix.length), count]),
  );
}
