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
  cardsInPlay,
  hasKeyword,
  matchesQuery,
  resolveValue,
  type EffectSpec,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type Predicate,
  type PlayerId,
  type TargetQuery,
  type ValueSpec,
} from "@mc/engine";
import type { AbilityId } from "@mc/content";
import { cardName } from "./names.js";

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

/** The noun for a query of one category the target wording knows ("ally"); any other query is not worded. */
const TARGET_NOUN: Readonly<Record<string, string>> = { ally: "ally", minion: "minion", support: "support" };

type TargetContext = { selfInstanceId: InstanceId; controllerId: PlayerId; deps: EngineDeps };

/**
 * Why a choice of target has nothing to choose, from the query's own data: "you control no ally", or, for a character
 * a status card cannot be placed on (`canTakeStatus`), "Jessica Jones is stalwart and cannot be confused" (RRG 1.8
 * "Stalwart", p. 40) or "Jessica Jones is already confused". Null while the query has a match, or for a shape not listed.
 */
function noTargetClause(state: GameState, query: TargetQuery, context: TargetContext): string | null {
  const engineContext = { ...context, event: null, bindings: {} };
  const matches = (q: TargetQuery) => cardsInPlay(state).filter((id) => matchesQuery(state, id, q, engineContext));
  if (matches(query).length > 0) return null;
  const { canTakeStatus: status, ...rest } = query;
  if (status === "confused" || status === "stunned") {
    // Only a single candidate is named: with several, the first one's reason need not be every one's.
    const candidates = matches(rest);
    if (candidates.length !== 1) return null;
    const blocked = candidates[0]!;
    const name = cardName(state, blocked);
    return hasKeyword(state, blocked, "stalwart", context.deps)
      ? `${name} is stalwart and cannot be ${status}`
      : `${name} is already ${status}`;
  }
  const categories = query.categories ?? [];
  const noun = categories.length === 1 ? TARGET_NOUN[categories[0]!] : undefined;
  const fields = Object.values(query).filter((value) => value !== undefined).length;
  if (noun && query.controller === "you" && fields === 2) return `you control no ${noun}`;
  return null;
}

/**
 * The query of the opening target choice among these effects, as the engine judges one (`isRequiredChoice` in its
 * target validity: not optional, not "up to", at least one), or null when the effects open with anything else.
 */
function firstTargetQuery(effects: readonly EffectSpec[]): TargetQuery | null {
  const first = effects[0];
  if (first?.kind !== "chooseTarget" || first.optional || first.upTo) return null;
  if (typeof first.count === "number" && first.count < 1) return null;
  return first.query;
}

/**
 * Why `abilityId` on `instanceId` has no valid target, in a few words, or null when it cannot be worded. A "Choose:"
 * ability names each option's missing target ("you control no ally, and Jessica Jones is stalwart and cannot be
 * confused": Work-Life Balance with Inspiring Pottery on her, #412); any other names its first choice of target. The
 * engine decided the refusal; this only reads which target was missing, and words nothing unless every part is worded.
 */
export function targetRefusalReason(
  state: GameState,
  instanceId: InstanceId,
  controllerId: PlayerId,
  abilityId: AbilityId,
  deps: EngineDeps,
): string | null {
  const definition = deps.abilities[abilityId];
  if (!definition) return null;
  const context = { selfInstanceId: instanceId, controllerId, deps };
  const effects = definition.effects.slice(definition.costEffects ?? 0);
  const choice = effects.find((effect) => effect.kind === "chooseOne");
  const queries =
    choice?.kind === "chooseOne"
      ? choice.options.map((option) => firstTargetQuery(option.effects))
      : [firstTargetQuery(effects)];
  const clauses = queries.map((query) => (query ? noTargetClause(state, query, context) : null));
  if (clauses.length === 0 || clauses.some((clause) => clause === null)) return null;
  return clauses.join(", and ");
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
