/**
 * "Why can't I use this?" for an in-play ability the engine refused (docs/phase7-wave10-client.md 5.3: New Labors of
 * Hercules "a Labor card is in play", "the Labor deck is empty"). The engine's refusal for a `useAbility` whose `while`
 * is not met is one sentence for every such ability ("that ability cannot be triggered: its condition is not met"), so on
 * its own it cannot say which part failed. This module asks the engine which: each clause of the ability's own `while`
 * is a count the engine's `resolveValue` reads (a query's matches, a separate deck's size), and the first clause whose
 * count is not what it needs is worded from its own data. Anything it cannot word keeps the engine's sentence.
 *
 * What is the client's: the glue (a count of 0 is "none", an "at least k" compares to k) and the wording of the shapes
 * the printed conditions use. What is the engine's: every number. A condition shape not listed here is never guessed at.
 * (Owed to the engine: exporting `evaluate`, or a per-clause refusal message, would let this glue go.)
 */
import {
  activeAbilityRefs,
  resolveValue,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type Predicate,
  type PlayerId,
  type ValueSpec,
} from "@mc/engine";
import type { AbilityId } from "@mc/content";

/** The engine's refusal sentence for any ability whose condition is unmet: what a reason falls back to. */
export const CONDITION_UNMET = "its condition is not met";

type Query = { readonly trait?: string; readonly name?: string };

const titleCase = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/** "a Labor card" for a trait query, "Appeal to Athena" for a named one, null for a query it cannot word. */
function queryNoun(query: Query): string | null {
  if (query.name) return query.name;
  if (query.trait) return `${titleCase(query.trait)} card`;
  return null;
}

/** The clauses of a `while`: an `and` is its parts, anything else is one clause. */
function clausesOf(predicate: Predicate): readonly Predicate[] {
  return predicate.kind === "and" ? predicate.of.flatMap(clausesOf) : [predicate];
}

/** The reason one clause fails, or null when it holds or cannot be worded. */
function failedClause(
  state: GameState,
  clause: Predicate,
  context: { selfInstanceId: InstanceId; controllerId: PlayerId; deps: EngineDeps },
): string | null {
  const read = (value: ValueSpec): number =>
    resolveValue(state, value, { ...context, event: null, bindings: {} }, context.deps);
  if (clause.kind === "not" && clause.of.kind === "exists") {
    const noun = queryNoun(clause.of.query as Query);
    if (!noun) return null;
    const present = read({ kind: "count", query: clause.of.query });
    return present > 0 ? `${/^[AEIOU]/.test(noun) ? "an" : "a"} ${noun} is in play` : null;
  }
  if (clause.kind === "exists") {
    const noun = queryNoun(clause.query as Query);
    if (!noun) return null;
    return read({ kind: "count", query: clause.query }) > 0 ? null : `no ${noun} is in play`;
  }
  if (clause.kind === "compare" && clause.op === "atLeast" && clause.right.kind === "const") {
    const have = read(clause.left);
    const need = clause.right.value;
    if (have >= need) return null;
    const left = clause.left;
    if (left.kind === "deckCount" && left.separateDeck) {
      return have === 0 ? `the ${left.separateDeck} deck is empty` : `only ${have} in the ${left.separateDeck} deck`;
    }
  }
  return null;
}

/**
 * Why `abilityId` on `instanceId` was refused, in a few words: the failing clause of its `while` when it can be worded,
 * else `fallback` (the engine's own sentence, or `CONDITION_UNMET`).
 */
export function abilityRefusalReason(
  state: GameState,
  instanceId: InstanceId,
  controllerId: PlayerId,
  abilityId: AbilityId,
  deps: EngineDeps,
  fallback: string = CONDITION_UNMET,
): string {
  const trigger = deps.abilities[abilityId]?.trigger as { readonly while?: Predicate } | undefined;
  if (!trigger?.while) return fallback;
  for (const clause of clausesOf(trigger.while)) {
    const reason = failedClause(state, clause, { selfInstanceId: instanceId, controllerId, deps });
    if (reason) return reason;
  }
  return fallback;
}

/** The ability's printed name ("New Labors of Hercules"), or "This ability" when the card does not print one. */
export function abilityNameOf(state: GameState, instanceId: InstanceId, abilityId: AbilityId): string {
  return activeAbilityRefs(state, instanceId).find((ref) => ref.id === abilityId)?.label ?? "This ability";
}

/**
 * One refused ability, as the card's strip words it. A card's strip is a narrow column, so the line is "Can't use: a Labor
 * card is in play"; a card with several refused abilities names each ("New Labors of Hercules: a Labor card is in play").
 */
export function refusedAbilityLine(
  state: GameState,
  instanceId: InstanceId,
  controllerId: PlayerId,
  abilityId: AbilityId,
  deps: EngineDeps,
  named = false,
): string {
  const reason = abilityRefusalReason(state, instanceId, controllerId, abilityId, deps);
  return named ? `${abilityNameOf(state, instanceId, abilityId)}: ${reason}` : `Can't use: ${reason}`;
}
