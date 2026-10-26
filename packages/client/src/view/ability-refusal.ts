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
  type AbilityDefinition,
  activeAbilityRefs,
  cardsInPlay,
  controllerOf,
  hasKeyword,
  matchesQuery,
  resolveValue,
  type EffectSpec,
  type EngineDeps,
  type GameState,
  inPlayCostCandidates,
  inPlayPicksOf,
  type InPlayCostMode,
  type InstanceId,
  type OptionUnavailableReason,
  type Predicate,
  type PlayerId,
  type TargetQuery,
  type UnavailableOptions,
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
 * "Stalwart", p. 40) or, when it holds one, "Jessica Jones is already confused". Null while the query has a match, for any
 * other blocker, or for a shape not listed.
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
    if (hasKeyword(state, blocked, "stalwart", context.deps)) return `${name} is stalwart and cannot be ${status}`;
    // Said only when the card holds one: another rule ("cannot be stunned", `cannotHaveStatus`) is not worded here.
    if ((state.instances[blocked]?.statuses[status] ?? 0) > 0) return `${name} is already ${status}`;
    return null;
  }
  return noMatchClause(query);
}

/** A trait as cards print it in a sentence: "Avenger", "X-Men", and an acronym ("S.H.I.E.L.D.") as it is. */
const traitWord = (trait: string): string =>
  trait.includes(".") ? trait : trait.replace(/[A-Za-z]+/g, (word) => titleCase(word));

/** A query's worded kind: "Avenger ally", whether it leaves out the ability's own card, and whose cards it reads. */
interface QueryNoun {
  readonly noun: string;
  /** "Another Dora Milaje ally" (`not: { self: true }`). */
  readonly other: boolean;
  /** Any player's cards (no `controller`), not only the payer's. */
  readonly anyone: boolean;
}

/**
 * The kind of card a query asks for, when it is one known noun with at most one trait and at most "another"
 * (`not: { self: true }`), of the payer's cards (`controller: "you"`, or none for a cost's pick: `payer`, as a cost is
 * paid with the payer's own cards) or anyone's (no `controller`); null for any other shape, which is not worded.
 */
function queryNounOf(query: TargetQuery, payer = false): QueryNoun | null {
  const categories = query.categories ?? [];
  const noun = categories.length === 1 ? TARGET_NOUN[categories[0]!] : undefined;
  const not = query.not as { readonly self?: boolean } | undefined;
  const other = not !== undefined && not.self === true && Object.keys(not).length === 1;
  const known = Object.entries(query).every(
    ([key, value]) =>
      value === undefined ||
      key === "categories" ||
      key === "controller" ||
      key === "trait" ||
      (key === "not" && other),
  );
  if (!noun || !known || (query.controller !== undefined && query.controller !== "you")) return null;
  const anyone = query.controller === undefined && !payer;
  return { noun: query.trait ? `${traitWord(query.trait)} ${noun}` : noun, other, anyone };
}

/**
 * "You control no ally", "you control no other Avenger ally", "there is no other Dora Milaje ally in play": what is
 * missing, from a query's shape alone (`queryNounOf`); null otherwise.
 */
function noMatchClause(
  query: TargetQuery,
  /** A cost's pick: its cards are the payer's (`queryNounOf`), "ready" ones (`readiness`), "other" than the card. */
  pick: { readonly other: boolean; readonly readiness: string } | null = null,
): string | null {
  const kind = queryNounOf(query, pick !== null);
  if (!kind) return null;
  const noun = `${kind.other || pick?.other ? "other " : ""}${pick?.readiness ?? ""}${kind.noun}`;
  return kind.anyone ? `there is no ${noun} in play` : `you control no ${noun}`;
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

type ChooseOneOption = Extract<EffectSpec, { kind: "chooseOne" }>["options"][number];

/** The "choose one" option at `index` with this `label`, anywhere in the ability's plain-data tree. */
function optionAt(node: unknown, index: number, label: string): ChooseOneOption | null {
  if (typeof node !== "object" || node === null) return null;
  const effect = node as Partial<Extract<EffectSpec, { kind: "chooseOne" }>>;
  if (effect.kind === "chooseOne" && effect.options?.[index]?.label === label) return effect.options[index]!;
  for (const child of Object.values(node)) {
    const found = optionAt(child, index, label);
    if (found) return found;
  }
  return null;
}

/**
 * An option's own unmet condition, in words, for the shapes printed conditions use; null for any other. "Remove 2 threat
 * from a scheme" while no scheme holds threat (Nick Fury `core` 01084) is "no scheme has threat on it".
 */
function conditionClause(condition: Predicate | undefined): string | null {
  // "At least 1 card attached here" (Plot Convenience `deadpool` 44050: "Add 1 card attached here to your hand").
  if (
    condition?.kind === "compare" &&
    condition.op === "atLeast" &&
    condition.right.kind === "const" &&
    condition.right.value === 1 &&
    condition.left.kind === "count"
  ) {
    const counted = condition.left.query as TargetQuery & { readonly host?: { readonly kind?: string } };
    if (counted.host?.kind === "self" && Object.keys(counted).every((key) => key === "host" || key === "facedown"))
      return "no card is attached here";
  }
  if (condition?.kind !== "exists") return null;
  const query = condition.query as TargetQuery;
  const categories = query.categories ?? [];
  if (
    categories.length === 1 &&
    categories[0] === "scheme" &&
    query.hasThreat === true &&
    Object.keys(query).length === 2
  )
    return "no scheme has threat on it";
  return null;
}

/** What each engine reason means, when nothing more specific can be said. */
const OPTION_REASON_WORDS: Readonly<Record<OptionUnavailableReason, string>> = {
  condition: "its condition is not met",
  cannotChoose: "a card in play says you cannot choose it",
  cannotPay: "you cannot pay its cost",
  noTarget: "it has no valid target",
};

/**
 * One line per option of a "choose one" that was not offered, and why (#412): "Confuse your identity → discard this card:
 * Jessica Jones is stalwart and cannot be confused". The engine names the rule that barred each option; for a missing
 * target this names which target, as `targetRefusalReason` does, and otherwise falls back to the rule in words.
 */
export function unavailableOptionReasons(
  state: GameState,
  unavailable: UnavailableOptions,
  deps: EngineDeps,
): { readonly index: number; readonly label: string; readonly why: string }[] {
  const definition = unavailable.abilityId ? deps.abilities[unavailable.abilityId] : undefined;
  return unavailable.options.map(({ index, label, reason, missing }) => {
    let why: string | null = null;
    // A condition is worded from its own shape; a missing target from what the engine recorded when it barred the
    // option. Neither is re-judged against the state now, which a resumed game's log may read long after (#414 review).
    if (reason === "condition") {
      why = conditionClause(definition ? optionAt(definition.effects, index, label)?.condition : undefined);
    }
    if (reason === "noTarget" && missing?.blocked) {
      const { instanceId, status, cause } = missing.blocked;
      const name = cardName(state, instanceId);
      why = cause === "stalwart" ? `${name} is stalwart and cannot be ${status}` : `${name} is already ${status}`;
    } else if (reason === "noTarget" && missing) {
      why = missing.target.canTakeStatus === undefined ? noMatchClause(missing.target) : null;
    }
    return { index, label, why: why ?? OPTION_REASON_WORDS[reason] };
  });
}

/** `unavailableOptionReasons` as one "label: why" line each, for the log. */
export const unavailableOptionLines = (state: GameState, unavailable: UnavailableOptions, deps: EngineDeps): string[] =>
  unavailableOptionReasons(state, unavailable, deps).map(({ label, why }) => `${label}: ${why}`);

/** How each kind of in-play cost pick words the card it needs ("no other ready Avenger ally"). */
const PICK_WORD: Partial<Record<InPlayCostMode, string>> = {
  exhaust: "ready ",
  ready: "exhausted ",
  return: "",
  discard: "",
};

/**
 * The cost's picks of cards in play this wording knows: "exhaust another Avenger ally you control →" (Iron Lad `cw`
 * 56052, #431), and likewise a ready, return or discard of the payer's cards of one noun with at most a trait
 * (`yourNounOf`). The picks never take the ability's own card (`AbilityCost.exhaustCards`), hence "other".
 */
function wordedPicks(cost: AbilityDefinition["cost"], state: GameState, instanceId: InstanceId, deps: EngineDeps) {
  const controllerId = controllerOf(state, instanceId);
  const context = { selfInstanceId: instanceId, controllerId, deps, event: null, bindings: {} };
  return inPlayPicksOf(cost).flatMap(({ mode, pick }) => {
    const readiness = PICK_WORD[mode];
    if (readiness === undefined || pick.min < 1) return [];
    // "Other" when the card itself is of that kind but cannot pay for its own ability (Iron Lad, an Avenger ally).
    const other = cardsInPlay(state).includes(instanceId) && matchesQuery(state, instanceId, pick.query, context);
    const clause = noMatchClause(pick.query, { other, readiness });
    return clause ? [{ mode, pick, clause }] : [];
  });
}

/** "You control no other ready Avenger ally" for a cost of one worded pick (`wordedPicks`); null for any other cost. */
function exhaustCostClause(
  cost: AbilityDefinition["cost"],
  state: GameState,
  instanceId: InstanceId,
  deps: EngineDeps,
): string | null {
  const picks = wordedPicks(cost, state, instanceId, deps);
  return picks.length === 1 && inPlayPicksOf(cost).length === 1 ? picks[0]!.clause : null;
}

/**
 * Inspect's "Right now" for a card in play whose own optional interrupt or response needs a card of a kind that is not
 * on the table: one to pay with ("exhaust another Avenger ally you control →", Iron Lad `cw` 56052, #431: "Interrupt
 * can't be used right now: you control no other ready Avenger ally"; any trait, and a ready, return or discard cost
 * too, `wordedPicks`) or one to choose ("choose an Avenger ally": "you control no Avenger ally"). Read from the
 * ability's shape and the cards in play before anything triggers it, for whoever controls the card; the cards that
 * could pay are the engine's own (`inPlayCostCandidates`).
 */
export function idleTriggerNotes(state: GameState, instanceId: InstanceId, deps: EngineDeps): string[] {
  const controllerId = controllerOf(state, instanceId);
  if (controllerId === null || !cardsInPlay(state).includes(instanceId)) return [];
  const context = { selfInstanceId: instanceId, controllerId, deps, event: null, bindings: {} };
  return activeAbilityRefs(state, instanceId, deps).flatMap((ref) => {
    const definition = deps.abilities[ref.id];
    const trigger = definition?.trigger;
    if (!trigger || (trigger.kind !== "interrupt" && trigger.kind !== "response") || trigger.forced) return [];
    const inPlay = cardsInPlay(state);
    // Counted by the engine's own list of cards that could pay (`inPlayCostCandidates`): yours, matching, able to.
    const short = wordedPicks(definition.cost, state, instanceId, deps).filter(
      ({ mode, pick }) => inPlayCostCandidates(state, deps, instanceId, controllerId, mode, pick).length < pick.min,
    );
    // "Choose an Avenger ally": its opening target choice, when none of the payer's cards fits it.
    const target = firstTargetQuery(definition.effects.slice(definition.costEffects ?? 0));
    const missing = target ? noMatchClause(target) : null;
    const targetless =
      target && missing && !inPlay.some((id) => matchesQuery(state, id, target, context)) ? [missing] : [];
    const clauses = [...short.map(({ clause }) => clause), ...targetless];
    return clauses.length > 0 ? [`${titleCase(trigger.kind)} can't be used right now: ${clauses.join(", and ")}`] : [];
  });
}

/** What each `abilityNotOffered` reason means, when nothing more specific can be said. */
const UNOFFERED_WORDS: Readonly<Record<"noTarget" | "cannotPay", string>> = {
  noTarget: "it has no valid target",
  cannotPay: "you cannot pay its cost",
};

/**
 * Why an optional interrupt or response that answered what just happened was not offered (`abilityNotOffered`, #431),
 * in a few words: which target is missing (`targetRefusalReason`) or which part of the cost cannot be paid, else the
 * engine's reason in words. The engine decided; this only words it, from the ability's own data.
 */
export function unofferedReason(
  state: GameState,
  instanceId: InstanceId,
  controllerId: PlayerId,
  abilityId: AbilityId,
  reason: "noTarget" | "cannotPay",
  deps: EngineDeps,
): string {
  const specific =
    reason === "noTarget"
      ? targetRefusalReason(state, instanceId, controllerId, abilityId, deps)
      : exhaustCostClause(deps.abilities[abilityId]?.cost, state, instanceId, deps);
  return specific ?? UNOFFERED_WORDS[reason];
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
