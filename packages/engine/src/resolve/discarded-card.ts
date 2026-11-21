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
 * Which parts need the card is read from the ability's effects (`needsDiscardedCard`), so a card script or a community
 * pack marks nothing: an effect needs the card when it names the discarded card (`eventTarget`, or the cards of an
 * `EventPattern.together` answer), or a card a choice of the ability picked from among them.
 */
import type { AbilityDefinition, EngineDeps } from "../abilities.js";
import type { InstanceId } from "../ids.js";
import { deckDiscardStillThere, handDiscardStillThere } from "../query.js";
import { TOGETHER_TARGETS_SLOT } from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";

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
    readonly together?: readonly TriggerEvent[];
  },
  event: TriggerEvent,
): boolean {
  const answering = candidate.together ?? [event];
  if (answering.length === 0 || !answering.every((each) => discardedCardGone(state, each))) return false;
  if (answering.some((each) => "instanceId" in each && each.instanceId === candidate.instanceId)) return true;
  return needsDiscardedCard(deps.abilities[candidate.abilityId]);
}

const NEEDS = new WeakMap<AbilityDefinition, boolean>();

/**
 * Whether every part of an ability acts on the discarded card it answers, so it can do nothing once that card has
 * gone. Its parts are its effects after its printed cost (`costEffects`), sentences read inline. Not parts: a choice
 * (it does nothing until an effect uses what it chose), post-"then" text (it resolves only if the text before it did,
 * RRG 1.8 "'Then'", p. 44). A part needs the card when it names it (`eventTarget`, the `together` targets) or the slot
 * of a choice that does, wherever in it. A branch or a "choose one" needs it when each of its branches or options with
 * effects does (`partNeedsCard`). An ability with no part is kept. Remembered per definition.
 *
 * Engine interpretation (authority step 5; no source settles it): an amount read from the card ("for each [mental]
 * resource discarded", The Shadow King 45180a) counts as needing it. Those are forced Mission Responses, resolved
 * before any optional response can move the card, so only a forced response that takes a card first (Abyss 45181a)
 * reaches the case: a card printing [wild] and [mental] is then not counted by The Shadow King, as before #928.
 */
export function needsDiscardedCard(definition: AbilityDefinition | undefined): boolean {
  if (!definition) return false;
  let known = NEEDS.get(definition);
  if (known === undefined) {
    known = everyPartNeedsCard(inline(definition.effects.slice(definition.costEffects ?? 0)));
    NEEDS.set(definition, known);
  }
  return known;
}

function everyPartNeedsCard(effects: readonly EffectSpec[], outer: readonly string[] = []): boolean {
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
  return parts.length > 0 && parts.every((part) => partNeedsCard(part, slots));
}

/**
 * A branch is judged by what it does, not by what its condition reads ("if that card is an event, draw 1 card" needs
 * nothing of the card's place): every branch with effects in it needs the card.
 */
function partNeedsCard(effect: EffectSpec, slots: readonly string[]): boolean {
  // "Choose one": an option that needs nothing of the card can still be chosen (RRG 1.8 "Choose", p. 12).
  if (effect.kind === "chooseOne") {
    const options = effect.options.filter((option) => option.effects.length > 0);
    return options.length > 0 && options.every((option) => everyPartNeedsCard(inline(option.effects), slots));
  }
  if (effect.kind !== "if") return namesCard(effect, slots);
  const branches = [effect.then, effect.otherwise ?? []].filter((branch) => branch.length > 0);
  return branches.length > 0 && branches.every((branch) => everyPartNeedsCard(inline(branch), slots));
}

/** `effects` with every `sentence` replaced by its effects, in place. */
function inline(effects: readonly EffectSpec[]): readonly EffectSpec[] {
  return effects.flatMap((effect): readonly EffectSpec[] =>
    effect.kind === "sentence" ? inline(effect.effects) : [effect],
  );
}

/** Whether `value` names the discarded card: `eventTarget`, the `together` targets, or one of `slots`. */
function namesCard(value: unknown, slots: readonly string[]): boolean {
  if (Array.isArray(value)) return value.some((item) => namesCard(item, slots));
  if (value === null || typeof value !== "object") return false;
  const record = value as Readonly<Record<string, unknown>>;
  if (record.kind === "eventTarget") return true;
  if (record.kind === "slot" && (record.slot === TOGETHER_TARGETS_SLOT || slots.includes(record.slot as string)))
    return true;
  if (typeof record.inSlot === "string" && slots.includes(record.inSlot)) return true;
  return Object.values(record).some((item) => namesCard(item, slots));
}
