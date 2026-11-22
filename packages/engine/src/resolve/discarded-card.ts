/**
 * A response to a card's discard once another response has moved that card (issue #928): a discard from a deck
 * (`cardDiscardedFromDeck`, docs/phase7-wave7.md §3.55) or from a hand (`cardDiscardedFromHand`, issue #922).
 *
 * The discard happened, so every response to it is still offered (RRG 1.8 "Response", p. 38; "Triggering Condition",
 * p. 45: the condition was met by the occurrence). Only interrupts lose a trigger that did not happen ("Interrupt",
 * p. 25). A response is dropped in two cases only:
 *
 * - **its own card left the zone it works from**: the discarded card answering its own discard (Jackpot!, White Fox,
 *   `activeIn: "discard"`), taken out of the pile first. RRG 1.8 FAQ "Honey Badger" (p. 64);
 * - **every part of it needs that card**, and the card is gone: "attach that card facedown here" (The Painted Lady),
 *   "tuck that card under here" (Don't Make Me Angry!), "deal that card as an encounter card" (Serpent Solutions).
 *   RRG 1.8 "Ability" (p. 4: it "can only be initiated if it has at least one valid target"), "Choose" (p. 12) and the FAQ
 *   "Redwing" (p. 65).
 *
 * A response that does something else ("draw 1 card", "deal 1 damage to an enemy") keeps it, as ruling June 2, 2026 -
 * Ruling 4 (Energy Channel) reads a response whose triggering card is gone.
 *
 * The cards of a `together` answer are read the same way: the frame binds only those still where their discard left
 * them (`stillDiscardedTargets`, `resolve/frames.ts`), so a kept response does not follow a moved card either. A
 * mission attempt's card a response took "does not count" for it (April 30, 2026 - Ruling 4, answer 1), so Mikhail
 * Rasputin (45183a) no longer counts a card Abyss took.
 *
 * Which parts need the card is read from the ability's effects (`needsDiscardedCard`), so a card script or a community
 * pack marks nothing: an effect needs the card when it names the discarded card (`eventTarget`, or the cards of an
 * `EventPattern.together` answer), or a card a choice of the ability picked from among them.
 */
import type { AbilityDefinition, EngineDeps } from "../abilities.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { deckDiscardStillThere, handDiscardStillThere } from "../query.js";
import { abilityLacksValidTarget } from "./target-validity.js";
import { DISCARD_MOVED_SLOT, evaluate, TOGETHER_TARGETS_SLOT, type EffectContext } from "../select.js";
import type { EffectSpec, Predicate } from "../spec.js";
import type { GameState } from "../state.js";
import { eventSubjects, type TriggerEvent } from "../trigger-events.js";

/** A discard whose card a response has since taken out of where the discard left it; false for any other event. */
export function discardedCardGone(state: GameState, event: TriggerEvent): boolean {
  if (event.kind === "cardDiscardedFromDeck") return !deckDiscardStillThere(state, event);
  if (event.kind === "cardDiscardedFromHand") return !handDiscardStillThere(state, event);
  return false;
}

/**
 * Whether this response to a discard can no longer be initiated because the discarded card has gone: it answers only
 * discards whose cards are gone (`together`: every discard of the occurrence it answers once), and either it is the
 * discarded card's own ability or every part of it needs that card (`needsDiscardedCard`).
 */
export function lostWithDiscardedCard(
  state: GameState,
  deps: EngineDeps,
  candidate: {
    readonly instanceId: InstanceId;
    readonly abilityId: string;
    readonly controllerId?: PlayerId | null;
    readonly forced?: boolean;
    readonly together?: readonly TriggerEvent[];
  },
  event: TriggerEvent,
): boolean {
  // "That card" (`eventTarget`, the first condition's card) and the `together` targets are judged apart: one may have
  // gone while the other has not (#928 review).
  const representativeGone = discardedCardGone(state, event);
  const groupGone = candidate.together
    ? candidate.together.length > 0 && candidate.together.every((each) => discardedCardGone(state, each))
    : representativeGone;
  if (!representativeGone && !groupGone) return false;
  const answering = candidate.together ?? [event];
  const ownGone = answering.some(
    (each) => "instanceId" in each && each.instanceId === candidate.instanceId && discardedCardGone(state, each),
  );
  if (ownGone) return true;
  const gone = [...(representativeGone ? [EVENT_TARGET] : []), ...(groupGone ? [TOGETHER_TARGETS_SLOT] : [])];
  const definition = deps.abilities[candidate.abilityId];
  // A branch whose condition reads the card is judged by the branch the condition now picks (`partNeedsCard`).
  const context: EffectContext = {
    selfInstanceId: candidate.instanceId,
    controllerId: candidate.controllerId ?? null,
    event,
    bindings: {
      ...(representativeGone ? { [DISCARD_MOVED_SLOT]: [] } : {}),
      ...(candidate.together ? { [TOGETHER_TARGETS_SLOT]: stillDiscardedTargets(state, candidate.together) } : {}),
    },
    deps,
  };
  // A cost is paid before the effects resolve and can change what a condition reads (exhausting the card): with one,
  // no condition is read now (#928, Codex review).
  // Initiating, the ability has bound nothing yet: a condition on its own bindings cannot be told.
  const judge: Judge = (condition) => (readsOwnBindings(condition) ? undefined : evaluate(state, condition, context));
  const needs =
    definition?.cost || (definition?.costEffects ?? 0) > 0
      ? needsDiscardedCard(definition, undefined, gone)
      : needsDiscardedCard(definition, judge, gone);
  // Forced ones too: RRG 1.8 "Forced" (p. 20), a forced ability with no valid target does not initiate; the card another
  // response moved is no longer a valid "that card" (Ability p. 4, Target p. 42; She-Hulk Superhuman Strength ruling,
  // May 25, 2023; Pacification, June 17, 2025: the first forced ability used the targets, the second cannot initiate).
  if (needs) return true;
  // What it does without the card still needs a valid target: an optional response picked in the same window as the
  // one that moved the card is judged again before it is initiated (RRG 1.8 "Ability", p. 4; "Choose", p. 12), "that
  // card" naming nothing (`abilityTargetFault`). A forced one resolves as much as it can.
  if (candidate.forced === true || !definition) return false;
  const cost = definition.costEffects ?? 0;
  const rest = {
    ...definition,
    effects: [...definition.effects.slice(0, cost), ...withoutCard(definition.effects.slice(cost), gone)],
  };
  return abilityLacksValidTarget(state, deps, rest, candidate.instanceId, candidate.controllerId ?? null, event);
}

/**
 * An ability's effects without the parts that act on the discarded card, which can do nothing once it has gone: such
 * a part, and such an option of a "choose one" (`partNeedsCard`). What is left is judged for a valid target as any
 * ability is (`abilityLacksValidTarget`): "choose one: attach that card here, or remove 1 threat from the main scheme"
 * with no threat on it has nothing left to do.
 */
function withoutCard(effects: readonly EffectSpec[], gone: readonly string[]): readonly EffectSpec[] {
  const slots: string[] = [...gone];
  return inline(effects).flatMap((effect): readonly EffectSpec[] => {
    if (effect.kind === "chooseTarget" || effect.kind === "chooseCards") {
      if (namesCard(effect, slots)) slots.push(effect.slot);
      return [effect];
    }
    if (effect.kind === "then" || effect.kind === "setVar") return [effect];
    if (effect.kind === "chooseOne") {
      const options = effect.options.filter((option) => !everyPartNeedsCard(inline(option.effects), slots));
      // The options `executeChooseOne` does not offer once the card has gone (`optionNeedsDiscardedCard`).
      return options.length > 0 ? [{ ...effect, options }] : [];
    }
    return partNeedsCard(effect, slots) ? [] : [effect];
  });
}

const NEEDS = new WeakMap<AbilityDefinition, boolean>();

/**
 * Whether every part of an ability acts on the discarded card it answers, so it can do nothing once that card has
 * gone. Its parts are its effects after its printed cost (`costEffects`), sentences read inline. Not parts: a choice
 * (it does nothing until an effect uses what it chose), post-"then" text (it resolves only if the text before it did,
 * RRG 1.8 "'Then'", p. 44). A part needs the card when it names it (`eventTarget`, the `together` targets) or the slot
 * of a choice that does, wherever in it. A branch or a "choose one" needs it when each of its branches or options with
 * effects does (`partNeedsCard`). An ability with no part is kept. Without `judge`, read from the effects alone and
 * remembered per definition; `lostWithDiscardedCard` passes one, to read a condition on the card as the game stands.
 *
 * An amount read from the card does not make a part need it (`AMOUNT_KINDS`): the part resolves with the amount
 * left. So The Shadow King (45180a) and Sugar Man (45182a) still resolve after Abyss (45181a) took a card, counting
 * nothing for it: a mission attempt's card a response took "does not count" (April 30, 2026 - Ruling 4, answer 1).
 */
export function needsDiscardedCard(
  definition: AbilityDefinition | undefined,
  judge?: Judge,
  gone?: readonly string[],
): boolean {
  if (!definition) return false;
  const parts = () => inline(definition.effects.slice(definition.costEffects ?? 0));
  // Read with the game as it stands: not remembered.
  if (judge || gone) return everyPartNeedsCard(parts(), gone ?? goneByDefault(), judge);
  let known = NEEDS.get(definition);
  if (known === undefined) {
    known = everyPartNeedsCard(parts());
    NEEDS.set(definition, known);
  }
  return known;
}

/**
 * Reads a branch's condition on the game as it stands, once the card has gone. Without one (`needsDiscardedCard`'s
 * remembered reading) a condition on the card could pick either branch.
 */
export type Judge = (condition: Predicate) => boolean | undefined;

/**
 * The slots read as holding only the discarded cards when nothing says otherwise: the `together` targets. At
 * resolution (`optionNeedsDiscardedCard`) the slots that actually hold nothing are passed instead, so a `together`
 * answer with cards still in the pile keeps its options on them (#928 review).
 */
// A function, not a constant: read at call time, after an import cycle through `select.ts` has settled.
const goneByDefault = (): readonly string[] => [EVENT_TARGET, TOGETHER_TARGETS_SLOT];

/** In a list of slots that hold nothing: "that card" itself (`eventTarget`) names nothing either. */
export const EVENT_TARGET = "event.target";

function everyPartNeedsCard(
  effects: readonly EffectSpec[],
  outer: readonly string[] = goneByDefault(),
  judge?: Judge,
): boolean {
  const slots: string[] = [...outer];
  const parts: EffectSpec[] = [];
  for (const effect of effects) {
    if (effect.kind === "chooseTarget" || effect.kind === "chooseCards") {
      if (namesCard(effect, slots)) slots.push(effect.slot);
      continue;
    }
    // Post-"then" text, and a var set for later effects (`setVar`): no part of its own, it changes no game element.
    if (effect.kind === "then" || effect.kind === "setVar") continue;
    parts.push(effect);
  }
  // Only the first part's condition is read now: an earlier part changes the game before a later one is reached.
  return parts.length > 0 && parts.every((part, index) => partNeedsCard(part, slots, index === 0 ? judge : undefined));
}

/**
 * A branch needs the card when every branch that could run needs it, and a "choose one" when every option that could
 * be chosen does. With `judge` (`lostWithDiscardedCard`) a condition is read on the game as it stands, "that card"
 * naming nothing: "if that card is an event, draw 1 card" then runs nothing and is dropped rather than offered to do
 * nothing, "if that card is not an event, draw 1 card" draws and is kept, and an option whose condition reads false
 * cannot be chosen. Without it, or for a condition on what the ability itself binds or how it was paid for, either
 * branch could run.
 */
function partNeedsCard(effect: EffectSpec, slots: readonly string[], judge?: Judge): boolean {
  // "Choose one": an option that needs nothing of the card can still be chosen (RRG 1.8 "Choose", p. 12).
  if (effect.kind === "chooseOne") {
    // An option whose condition now reads false cannot be chosen (`executeChooseOne`).
    const options = effect.options.filter(
      (option) => option.effects.length > 0 && (!option.condition || told(option.condition, judge) !== false),
    );
    // None left: nothing can be chosen, so nothing can come of it.
    return options.every((option) => everyPartNeedsCard(inline(option.effects), slots, judge));
  }
  if (effect.kind !== "if") return namesCard(effect, slots);
  const otherwise = effect.otherwise ?? [];
  const holds = told(effect.condition, judge);
  const reachable = holds === undefined ? [effect.then, otherwise] : [holds ? effect.then : otherwise];
  if (reachable.every((branch) => branch.length === 0)) return true;
  const branches = reachable.filter((branch) => branch.length > 0);
  return branches.every((branch) => everyPartNeedsCard(inline(branch), slots, judge));
}

/**
 * A condition read on the game as it stands (`judge`), "that card" naming nothing; undefined when it cannot be told
 * yet: no `judge` (the remembered reading), or it reads what the ability binds or how it was paid for.
 */
function told(condition: Predicate, judge: Judge | undefined): boolean | undefined {
  return judge?.(condition);
}

/**
 * Whether a condition reads a binding the ability has not made yet: a var, a slot or a payment `context` does not hold.
 * At an option (`executeChooseOne`) the ability's earlier choices are known and read; one made inside the option is not.
 */
export function readsUnbound(value: unknown, context: EffectContext): boolean {
  if (Array.isArray(value)) return value.some((item) => readsUnbound(item, context));
  if (value === null || typeof value !== "object") return false;
  const record = value as Readonly<Record<string, unknown>>;
  const vars = context.vars ?? {};
  if ((record.kind === "var" || record.kind === "varAtLeast") && !(String(record.name) in vars)) return true;
  if (record.kind === "slot" && context.bindings[String(record.slot)] === undefined) return true;
  if (typeof record.inSlot === "string" && context.bindings[record.inSlot] === undefined) return true;
  return Object.values(record).some((item) => readsUnbound(item, context));
}

/** Whether `value` reads a value or card the ability binds as it resolves (a var, a payment, a choice's slot). */
function readsOwnBindings(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(readsOwnBindings);
  if (value === null || typeof value !== "object") return false;
  const record = value as Readonly<Record<string, unknown>>;
  if (record.kind === "var" || record.kind === "varAtLeast") return true;
  if (typeof record.kind === "string" && record.kind.startsWith("paid")) return true;
  if (record.kind === "slot" && record.slot !== TOGETHER_TARGETS_SLOT && record.slot !== DISCARD_MOVED_SLOT)
    return true;
  if (typeof record.inSlot === "string") return true;
  return Object.values(record).some(readsOwnBindings);
}

/** `effects` with every `sentence` replaced by its effects, in place. */
function inline(effects: readonly EffectSpec[]): readonly EffectSpec[] {
  return effects.flatMap((effect): readonly EffectSpec[] =>
    effect.kind === "sentence" ? inline(effect.effects) : [effect],
  );
}

/**
 * The `ValueSpec` kinds: an amount. One read from the discarded card ("for each [mental] resource discarded", "1 plus
 * that card's cost") reads nothing once the card has gone, and the effect still resolves with what is left, so it is
 * not what makes an effect need the card (#928, Codex review). The effect's own subjects are.
 */
const AMOUNT_KINDS: ReadonlySet<string> = new Set([
  "accelerationTokens",
  "accusationWrongGuesses",
  "activationOrder",
  "boostIcons",
  "campaignLog",
  "chosenMainSchemeValue",
  "conditional",
  "const",
  "count",
  "countInRef",
  "counters",
  "damage",
  "dealtEncounterCount",
  "deckCount",
  "defeatExcessDamage",
  "defeatExcessThreat",
  "distinctAspects",
  "distinctCardTypes",
  "distinctTraits",
  "eventAmount",
  "eventResult",
  "groupPlayerCount",
  "handCount",
  "handSize",
  "hiddenPileCount",
  "highestStat",
  "hitPoints",
  "iconsInPlay",
  "largestHandTypeGroup",
  "mainSchemeStageNumber",
  "max",
  "min",
  "paidTypeCount",
  "perPlayer",
  "printedCost",
  "printedHp",
  "product",
  "refCount",
  "remainingHp",
  "resourceTypes",
  "revealedPileCardCount",
  "scaled",
  "scenarioAreaCount",
  "setAsideModularSetCount",
  "starIcons",
  "stat",
  "statusCount",
  "sum",
  "taggedAbilities",
  "threat",
  "totalPrintedCost",
  "totalPrintedResources",
  "traitNumber",
  "tuckedUnder",
  "var",
  "victoryCondition",
  "victoryDisplayCount",
  "villainStageNumber",
  "zoneCount",
]);

/**
 * Whether `value` names the discarded card as what it acts on: `eventTarget`, the `together` targets, or one of
 * `slots`. Amounts nested in it are not read (`AMOUNT_KINDS`); the value itself may be a condition (`if`).
 */
function namesCard(value: unknown, slots: readonly string[], nested = false): boolean {
  if (Array.isArray(value)) return value.some((item) => namesCard(item, slots, true));
  if (value === null || typeof value !== "object") return false;
  const record = value as Readonly<Record<string, unknown>>;
  if (nested && typeof record.kind === "string" && AMOUNT_KINDS.has(record.kind)) return false;
  // A union of card selectors still names a card when any other alternative does (`selectCards` `anyOf`).
  if (record.kind === "anyOf" && Array.isArray(record.of))
    return record.of.every((item) => namesCard(item, slots, true));
  if (record.kind === "eventTarget") return slots.includes(EVENT_TARGET);
  if (record.kind === "slot" && slots.includes(record.slot as string)) return true;
  if (typeof record.inSlot === "string" && slots.includes(record.inSlot)) return true;
  // "Each other enemy" (`TargetQuery.excluding`): an empty exclusion excludes nothing, so it is no operand.
  return Object.entries(record).some(([key, item]) => key !== "excluding" && namesCard(item, slots, true));
}

/** The targets of the discards a `together` answer answers, without those whose cards have since gone (#928). */
export function stillDiscardedTargets(state: GameState, events: readonly TriggerEvent[]): readonly InstanceId[] {
  return [...new Set(events.flatMap((each) => (discardedCardGone(state, each) ? [] : eventSubjects(each).targets)))];
}

/**
 * Whether every part of a "choose one" option acts on the discarded card (`everyPartNeedsCard`): once another response
 * has moved it before this ability was initiated, `executeChooseOne` does not offer the option (#928). `slots`: the
 * slots that hold nothing now (a choice made among "that card" before the option, the `together` targets once all have
 * gone). `judge`: reads a condition at the start of the option on the game as it stands.
 */
export function optionNeedsDiscardedCard(
  option: { readonly effects: readonly EffectSpec[] },
  slots: readonly string[],
  judge?: Judge,
): boolean {
  return everyPartNeedsCard(inline(option.effects), slots, judge);
}
