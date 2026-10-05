/**
 * Choosing which cards in play pay a cost that has a real choice in it (RRG 1.8 "Cost", p. 13: a cost's choices are the
 * player's). "Exhaust your hero and any number of X-MEN allies →" (Mutant Peacekeepers, 34018), "Exhaust 1-3 SHIELD
 * cards" (Spider-Man's Morales kit), "Discard an upgrade you control →" with three upgrades out: each is an
 * `InPlayCostPick` (`min`, an optional `max`, a query), and `legalActions`' example command answers it with the
 * first `min` candidates, which is only a proof that some payment works. Before this, the board sent that example,
 * so the player never saw a question and never got to say "these two allies, not that one".
 *
 * Which cards could pay is the engine's own answer (`inPlayCostCandidates`), and so is the range (`InPlayCostPick`):
 * this module restates no rule. It tracks the picks, words the question and a live preview, and builds the
 * `costChoices` the engine's own payment then judges (`tryPayment`, `PaymentContext.costChoices`).
 *
 * One slot is asked at a time, in the cost's own order ("an [Avenger] character and a [Guardian] character" is two
 * slots); a card taken by an earlier slot is not offered to a later one, and a slot with only one possible answer is
 * not asked at all (the engine's own default stands, `forced` below).
 */

import {
  activeAbilityRefs,
  inPlayCostCandidates,
  inPlayPicksOf,
  resolveValue,
  type AbilityDefinition,
  type CostChoices,
  type EngineDeps,
  type GameState,
  type InPlayCostMode,
  type InstanceId,
  type LegalAction,
  type PlayerId,
  type ValueSpec,
} from "@mc/engine";
import { actionAbilityCost } from "./cost-choice-model.js";
import { cardName } from "./names.js";

/** One pick of the cost that is the player's to make. */
export interface InPlayCostSlot {
  readonly slot: string;
  readonly mode: InPlayCostMode;
  readonly min: number;
  /** The most the cost takes: its printed cap, or every candidate when it has none ("any number"). */
  readonly max: number;
  /** True when the cost prints no cap, so the question reads "any number" rather than a count. */
  readonly uncapped: boolean;
  /** The count the cost binds to a variable (`bind`), for a preview that scales with it. */
  readonly bind?: string;
  readonly candidates: readonly InstanceId[];
}

export interface InPlayCostChoiceState {
  readonly action: LegalAction;
  /** The paying seat. */
  readonly playerId: PlayerId;
  /** The card whose cost this is. */
  readonly source: InstanceId;
  readonly slots: readonly InPlayCostSlot[];
  /** The slot being answered. */
  readonly index: number;
  /** Each slot's picks so far, keyed by slot name; a slot not yet reached has none. */
  readonly picks: Readonly<Record<string, readonly InstanceId[]>>;
}

/** The ability whose cost an action pays: a used ability, or an event's action-triggered ability when it is played. */
function abilityOf(state: GameState, deps: EngineDeps, action: LegalAction["action"]): AbilityDefinition | undefined {
  if (action.kind === "useAbility") return deps.abilities[action.abilityId];
  if (action.kind !== "playCard") return undefined;
  for (const ref of activeAbilityRefs(state, action.instanceId)) {
    const definition = deps.abilities[ref.id];
    if (definition?.trigger.kind === "action") return definition;
  }
  return undefined;
}

/**
 * The picker for an action whose cost leaves a choice among cards in play, or null when it does not: no such cost,
 * every pick forced (exactly `min` candidates), or an "each" pick (the cost takes every matching card, nothing to say).
 */
export function beginInPlayCostChoice(
  state: GameState,
  deps: EngineDeps,
  action: LegalAction,
): InPlayCostChoiceState | null {
  const ref = action.action;
  if (ref.kind !== "playCard" && ref.kind !== "useAbility") return null;
  const playerId = action.example.playerId;
  const cost = actionAbilityCost(state, deps, playerId, ref);
  const found = inPlayPicksOf(cost).map(({ mode, pick }) => ({
    mode,
    pick,
    candidates: inPlayCostCandidates(state, deps, ref.instanceId, playerId, mode, pick),
  }));
  const asked = found.filter(({ pick, candidates }) => !pick.each && candidates.length > pick.min);
  if (asked.length === 0) return null;
  // Cards the unasked picks already use (the engine's own default for a forced pick, every card an "each" pick takes)
  // cannot also pay an asked one: one card pays one part of a cost (RRG 1.8 "Cost", p. 13).
  const defaults: CostChoices =
    (action.example.type === "playCard" || action.example.type === "useAbility") && action.example.costChoices
      ? action.example.costChoices
      : {};
  const forced = new Set<InstanceId>();
  for (const entry of found) {
    if (asked.includes(entry)) continue;
    for (const id of entry.pick.each ? entry.candidates : (defaults[entry.pick.slot] ?? [])) forced.add(id);
  }
  const slots = asked.map(({ mode, pick, candidates }): InPlayCostSlot => {
    const offered = candidates.filter((id) => !forced.has(id));
    return {
      slot: pick.slot,
      mode,
      min: pick.min,
      max: Math.min(pick.max ?? offered.length, offered.length),
      uncapped: pick.max === undefined,
      ...(pick.bind ? { bind: pick.bind } : {}),
      candidates: offered,
    };
  });
  return { action, playerId, source: ref.instanceId, slots, index: 0, picks: {} };
}

const currentSlot = (choice: InPlayCostChoiceState): InPlayCostSlot => choice.slots[choice.index]!;

/** The cards the current slot may still take: its candidates, less those an earlier slot already picked. */
export function offeredNow(choice: InPlayCostChoiceState): readonly InstanceId[] {
  const earlier = new Set(choice.slots.slice(0, choice.index).flatMap(({ slot }) => choice.picks[slot] ?? []));
  return currentSlot(choice).candidates.filter((id) => !earlier.has(id));
}

/** Adds or removes one card from the current slot. A card not offered, or one past the cap, changes nothing. */
export function toggleInPlayPick(choice: InPlayCostChoiceState, id: InstanceId): InPlayCostChoiceState {
  const slot = currentSlot(choice);
  if (!offeredNow(choice).includes(id)) return choice;
  const picked = choice.picks[slot.slot] ?? [];
  if (picked.includes(id)) {
    return { ...choice, picks: { ...choice.picks, [slot.slot]: picked.filter((p) => p !== id) } };
  }
  if (picked.length >= slot.max) return choice;
  return { ...choice, picks: { ...choice.picks, [slot.slot]: [...picked, id] } };
}

/** Whether the current slot's picks are a count its cost takes. */
export function slotAnswered(choice: InPlayCostChoiceState): boolean {
  const slot = currentSlot(choice);
  const count = (choice.picks[slot.slot] ?? []).length;
  return count >= slot.min && count <= slot.max;
}

/** True when the current slot is the last one asked, so confirming it sends the play. */
export const isLastSlot = (choice: InPlayCostChoiceState): boolean => choice.index >= choice.slots.length - 1;

/** The next slot, once the current one is answered. The same state when it is not, or when none is left. */
export function advanceInPlayCostChoice(choice: InPlayCostChoiceState): InPlayCostChoiceState {
  if (!slotAnswered(choice) || isLastSlot(choice)) return choice;
  return { ...choice, index: choice.index + 1 };
}

/** The `costChoices` the picks make: only the slots that were asked, the engine's own default standing for the rest. */
export function costChoicesOf(choice: InPlayCostChoiceState): CostChoices {
  return Object.fromEntries(choice.slots.map(({ slot }) => [slot, choice.picks[slot] ?? []]));
}

const VERB: Readonly<Record<InPlayCostMode, string>> = {
  exhaust: "exhaust",
  discard: "discard",
  return: "return to hand",
  damage: "damage",
};

/** What the cost is doing to the cards, as a verb for "Choose cards to …". */
export const verbOf = (mode: InPlayCostMode): string => VERB[mode];

/**
 * "how many" in a few words: "any number", "up to 3", "1-3" or an exact "2". `max` is the real ceiling given the
 * cards on the table, so "any number" with two cards out still reads "any number": the cost's own words.
 */
export function rangeText(slot: InPlayCostSlot): string {
  if (slot.uncapped) return slot.min <= 1 ? "any number" : `${slot.min} or more`;
  if (slot.min === slot.max) return `${slot.min}`;
  return slot.min === 0 ? `up to ${slot.max}` : `${slot.min}-${slot.max}`;
}

/** Whether `node` mentions one of the slots (`chosen(slot)`) or counts (`var`) the picks bind. */
function mentions(node: unknown, slots: ReadonlySet<string>, vars: ReadonlySet<string>): boolean {
  if (Array.isArray(node)) return node.some((item) => mentions(item, slots, vars));
  if (node === null || typeof node !== "object") return false;
  const record = node as Record<string, unknown>;
  if (record.kind === "slot" && typeof record.slot === "string" && slots.has(record.slot)) return true;
  if (record.kind === "var" && typeof record.name === "string" && vars.has(record.name)) return true;
  return Object.values(record).some((value) => mentions(value, slots, vars));
}

/** The unit an effect's amount is in, for the effects that do not name one themselves (`divide` names `what`). */
const UNIT_OF_KIND: Readonly<Record<string, string>> = {
  draw: "cards",
  dealDamage: "damage",
  removeThreat: "threat",
  heal: "healing",
};

/** The first effect amount that scales with the picks ("remove X threat"), with the unit the effect names. */
function scaledAmount(
  node: unknown,
  slots: ReadonlySet<string>,
  vars: ReadonlySet<string>,
): { readonly amount: ValueSpec; readonly unit: string | null } | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = scaledAmount(item, slots, vars);
      if (found) return found;
    }
    return null;
  }
  if (node === null || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  const amount = record.amount;
  if (amount !== null && typeof amount === "object" && mentions(amount, slots, vars)) {
    const unit =
      typeof record.what === "string"
        ? record.what
        : typeof record.kind === "string"
          ? (UNIT_OF_KIND[record.kind] ?? null)
          : null;
    return { amount: amount as ValueSpec, unit };
  }
  for (const value of Object.values(record)) {
    const found = scaledAmount(value, slots, vars);
    if (found) return found;
  }
  return null;
}

/**
 * "X = 5 threat": what the effect would do with the picks made so far, where its amount scales with them (Mutant
 * Peacekeepers' "X is the total THW of those characters", a count bound by `bind`). The number is the engine's own
 * `resolveValue` over the card's own effect, with the picks bound exactly as paying would bind them. Null when no
 * effect scales with the picks, or the number cannot be read yet.
 */
export function previewOf(state: GameState, deps: EngineDeps, choice: InPlayCostChoiceState): string | null {
  const definition = abilityOf(state, deps, choice.action.action);
  if (!definition) return null;
  const slots = new Set(choice.slots.map(({ slot }) => slot));
  const vars = new Set(choice.slots.flatMap(({ bind }) => (bind ? [bind] : [])));
  const found = scaledAmount(definition.effects, slots, vars);
  if (!found) return null;
  const bindings = Object.fromEntries(choice.slots.map(({ slot }) => [slot, choice.picks[slot] ?? []]));
  const counts = Object.fromEntries(
    choice.slots.flatMap(({ slot, bind }) => (bind ? [[bind, (choice.picks[slot] ?? []).length] as const] : [])),
  );
  try {
    const value = resolveValue(
      state,
      found.amount,
      { selfInstanceId: choice.source, controllerId: choice.playerId, event: null, bindings, vars: counts, deps },
      deps,
    );
    return `X = ${value}${found.unit ? ` ${found.unit}` : ""}`;
  } catch {
    return null;
  }
}

/** The picker as the board draws it. */
export interface InPlayCostChoiceView {
  /** The card whose cost this is. */
  readonly subject: string;
  readonly source: InstanceId;
  /** "exhaust", "discard": what the cost does to the picked cards. */
  readonly verb: string;
  readonly slot: InPlayCostSlot;
  /** Which slot of how many, for a cost with several picks; `total` is 1 for the usual single pick. */
  readonly step: { readonly index: number; readonly total: number };
  readonly offered: readonly InstanceId[];
  readonly picked: ReadonlySet<InstanceId>;
  /** "PICKED 2 (any number)". */
  readonly summary: string;
  readonly preview: string | null;
  readonly canConfirm: boolean;
  /** Why Confirm is not yet available, in a few words; null when it is. */
  readonly reason: string | null;
  /** "Confirm" on the last slot, "Next" before it. */
  readonly confirmLabel: string;
}

export function inPlayCostChoiceView(
  state: GameState,
  deps: EngineDeps,
  choice: InPlayCostChoiceState,
): InPlayCostChoiceView {
  const slot = currentSlot(choice);
  const picked = choice.picks[slot.slot] ?? [];
  const canConfirm = slotAnswered(choice);
  const short = slot.min - picked.length;
  return {
    subject: cardName(state, choice.source),
    source: choice.source,
    verb: verbOf(slot.mode),
    slot,
    step: { index: choice.index, total: choice.slots.length },
    offered: offeredNow(choice),
    picked: new Set(picked),
    summary: `PICKED ${picked.length} (${rangeText(slot)})`,
    preview: previewOf(state, deps, choice),
    canConfirm,
    reason: canConfirm ? null : short > 0 ? `Pick ${short} more` : null,
    confirmLabel: isLastSlot(choice) ? "Confirm" : "Next",
  };
}
