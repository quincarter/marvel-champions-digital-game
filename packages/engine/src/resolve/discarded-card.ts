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
 *   RRG 1.8 "Ability" (p. 4: an ability needs the potential to change the game state), "Choose" (p. 12) and the FAQ
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
import { evaluate, TOGETHER_TARGETS_SLOT, type EffectContext } from "../select.js";
import type { EffectSpec, Predicate } from "../spec.js";
import type { GameState } from "../state.js";
import { eventSubjects, type TriggerEvent } from "../trigger-events.js";

/** A discard whose card a response has since taken out of where the discard left it; false for any other event. */
// `select.ts` `discardMovedOn` reads the same, without importing this module: keep the two in step.
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
    readonly together?: readonly TriggerEvent[];
  },
  event: TriggerEvent,
): boolean {
  const answering = candidate.together ?? [event];
  if (answering.length === 0 || !answering.every((each) => discardedCardGone(state, each))) return false;
  if (answering.some((each) => "instanceId" in each && each.instanceId === candidate.instanceId)) return true;
  const definition = deps.abilities[candidate.abilityId];
  // A branch whose condition reads the card is judged by the branch the condition now picks (`partNeedsCard`).
  const context: EffectContext = {
    selfInstanceId: candidate.instanceId,
    controllerId: candidate.controllerId ?? null,
    event,
    bindings: candidate.together ? { [TOGETHER_TARGETS_SLOT]: stillDiscardedTargets(state, candidate.together) } : {},
    deps,
  };
  return needsDiscardedCard(definition, (condition) => evaluate(state, condition, context));
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
export function needsDiscardedCard(definition: AbilityDefinition | undefined, judge?: Judge): boolean {
  if (!definition) return false;
  const parts = () => inline(definition.effects.slice(definition.costEffects ?? 0));
  // Read with the game as it stands: not remembered.
  if (judge) return everyPartNeedsCard(parts(), [], judge);
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
type Judge = (condition: Predicate) => boolean;

function everyPartNeedsCard(effects: readonly EffectSpec[], outer: readonly string[] = [], judge?: Judge): boolean {
  const slots: string[] = [...outer];
  const parts: EffectSpec[] = [];
  for (const effect of effects) {
    if (effect.kind === "chooseTarget" || effect.kind === "chooseCards") {
      if (namesCard(effect, slots)) slots.push(effect.slot);
      continue;
    }
    if (effect.kind === "then") continue;
    parts.push(effect);
  }
  return parts.length > 0 && parts.every((part) => partNeedsCard(part, slots, judge));
}

/**
 * A branch needs the card when every branch that could run needs it. A condition that does not read the card could
 * pick either branch. One that reads it is read once the card has gone (`judge`): "that card" then names nothing
 * (`select.ts` `eventTarget`), so "if that card is an event, draw 1 card" runs nothing and is dropped rather than
 * offered to do nothing, and "if that card is not an event, draw 1 card" draws and is kept. A condition that reads
 * what the ability itself binds or how it was paid for cannot be told yet, and could pick either branch.
 */
function partNeedsCard(effect: EffectSpec, slots: readonly string[], judge?: Judge): boolean {
  // "Choose one": an option that needs nothing of the card can still be chosen (RRG 1.8 "Choose", p. 12).
  if (effect.kind === "chooseOne") {
    const options = effect.options.filter((option) => option.effects.length > 0);
    return options.length > 0 && options.every((option) => everyPartNeedsCard(inline(option.effects), slots, judge));
  }
  if (effect.kind !== "if") return namesCard(effect, slots);
  const otherwise = effect.otherwise ?? [];
  const told = judge && conditionReadsCard(effect.condition, slots) && !readsOwnBindings(effect.condition);
  const reachable = told ? [judge(effect.condition) ? effect.then : otherwise] : [effect.then, otherwise];
  if (reachable.every((branch) => branch.length === 0)) return true;
  const branches = reachable.filter((branch) => branch.length > 0);
  return branches.every((branch) => everyPartNeedsCard(inline(branch), slots, judge));
}

/** Whether `value` reads a value or card the ability binds as it resolves (a var, a payment, a choice's slot). */
function readsOwnBindings(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(readsOwnBindings);
  if (value === null || typeof value !== "object") return false;
  const record = value as Readonly<Record<string, unknown>>;
  if (record.kind === "var" || record.kind === "varAtLeast") return true;
  if (typeof record.kind === "string" && record.kind.startsWith("paid")) return true;
  if (record.kind === "slot" && record.slot !== TOGETHER_TARGETS_SLOT) return true;
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
function namesCard(value: unknown, slots: readonly string[], nested = false, amounts = false): boolean {
  if (Array.isArray(value)) return value.some((item) => namesCard(item, slots, true, amounts));
  if (value === null || typeof value !== "object") return false;
  const record = value as Readonly<Record<string, unknown>>;
  if (nested && !amounts && typeof record.kind === "string" && AMOUNT_KINDS.has(record.kind)) return false;
  if (record.kind === "eventTarget") return true;
  if (record.kind === "slot" && (record.slot === TOGETHER_TARGETS_SLOT || slots.includes(record.slot as string)))
    return true;
  if (typeof record.inSlot === "string" && slots.includes(record.inSlot)) return true;
  return Object.values(record).some((item) => namesCard(item, slots, true, amounts));
}

/** Whether a condition reads the discarded card at all, amounts included ("if that card's cost is 2 or less"). */
const conditionReadsCard = (condition: unknown, slots: readonly string[]): boolean =>
  namesCard(condition, slots, false, true);

/** The targets of the discards a `together` answer answers, without those whose cards have since gone (#928). */
export function stillDiscardedTargets(state: GameState, events: readonly TriggerEvent[]): readonly InstanceId[] {
  return [...new Set(events.flatMap((each) => (discardedCardGone(state, each) ? [] : eventSubjects(each).targets)))];
}
