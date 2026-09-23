/**
 * Opting into a play-cost reduction while paying for a card (docs/phase7-wave3.md §3.20; Star-Lord's "What could
 * go wrong?", `stld` 17001a: "Interrupt: When you play a card from your hand, deal yourself 1 facedown encounter
 * card → reduce the cost to play that card by 3. (Limit once per round.)"). The engine only prices this reduction
 * when it is named on the command itself (`playCard.costReductionAbilities`) — never guessed for the player the
 * way an ordinary payment source is (`legal.ts`'s own doc comment: "Choosing to use it when it is not needed is
 * the client's to offer"). Without this the ability is unusable outside the one case where it is the *only* way to
 * afford the card at all (`legalActions`' own `example` already finds that case unassisted).
 *
 * This module finds which reductions the player could offer to use on a card in hand, and builds + validates the
 * reduced command once they ask for one. The offer is a client-side scan over public engine queries, not a
 * restatement of the rule: whether a reduction is *truly* usable (its own cost payable, its limit not reached, its
 * card filter matched) is still the engine's own call, made for real when the reduced command is tried
 * (`applyCommand`, exactly as every other command this app sends is judged).
 */
import type { AbilityId } from "@mc/content";
import {
  activeAbilityRefs,
  applyCommand,
  cardOf,
  cardsInPlay,
  controllerOf,
  matchesQuery,
  type Command,
  type CostSelection,
  type EffectContext,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type Payment,
  type PaymentAttempt,
  type PaymentSource,
  type PlayerId,
} from "@mc/engine";
import { faceUpName } from "./names.js";

/** One `playCostReduction` ability the player could name on this play. */
export interface CostReductionOption {
  readonly instanceId: InstanceId;
  readonly abilityId: AbilityId;
  /** How much it takes off the price. */
  readonly amount: number;
  /** The reducing card's own name, for "Use [name]'s ability". */
  readonly label: string;
}

/**
 * Every `playCostReduction` ability the player controls that could apply to playing `cardInstanceId` from hand.
 * Empty for anything other than a card actually in that player's hand (`fromHand` is the overwhelmingly common
 * shape and the only one printed in cycle 2; a reduction with no `fromHand` restriction is still offered for a
 * card elsewhere, since nothing in the pool needs that narrowed).
 */
export function costReductionOptionsFor(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  deps: EngineDeps,
): readonly CostReductionOption[] {
  if (!cardOf(state, cardInstanceId)) return [];
  const options: CostReductionOption[] = [];
  for (const instanceId of cardsInPlay(state)) {
    if (controllerOf(state, instanceId) !== playerId) continue;
    for (const ref of activeAbilityRefs(state, instanceId, deps)) {
      const reduction = deps.abilities[ref.id]?.playCostReduction;
      if (!reduction) continue;
      if (reduction.cards) {
        const context: EffectContext = {
          selfInstanceId: instanceId,
          controllerId: playerId,
          event: null,
          bindings: {},
          deps,
        };
        if (!matchesQuery(state, cardInstanceId, reduction.cards, context)) continue;
      }
      options.push({
        instanceId,
        abilityId: ref.id,
        amount: reduction.amount,
        label: faceUpName(state, instanceId) ?? "this ability",
      });
    }
  }
  return options;
}

/** How much a set of chosen reductions takes off the price, in total. */
export function costReductionTotal(reductions: readonly { readonly abilityId: AbilityId }[], deps: EngineDeps): number {
  return reductions.reduce(
    (total, { abilityId }) => total + (deps.abilities[abilityId]?.playCostReduction?.amount ?? 0),
    0,
  );
}

/**
 * Reconstructs a `Payment[]` from picked option ids using `PaymentSource.optionId`'s own documented shape
 * (`"hand:<id>"` for a hand card, `"ability:<id>:<abilityId>"` for a resource ability) — the same format
 * `paymentsFromOptionIds` parses engine-side, read here rather than re-derived, since the id already carries
 * everything a `Payment` needs once matched back to its source.
 */
function paymentsFromPicked(picked: readonly string[], sources: readonly PaymentSource[]): readonly Payment[] {
  const byOption = new Map(sources.map((source) => [source.optionId, source] as const));
  const payments: Payment[] = [];
  for (const optionId of picked) {
    const source = byOption.get(optionId);
    if (!source) continue;
    if (source.kind === "handCard") {
      payments.push({ fromHand: source.instanceId });
      continue;
    }
    const abilityId = optionId.split(":")[2];
    if (abilityId) payments.push({ ability: { instanceId: source.instanceId, abilityId: abilityId as AbilityId } });
  }
  return payments;
}

/**
 * Builds a `playCard` command that names the chosen reductions and asks the engine to judge it — the reduced-price
 * analog of `tryPayment` (which knows nothing about a reduction, since none is named on the base command it
 * builds). `subjectTarget`/`controllerId`/`costSelection` are the same picks `PaymentState` already carries;
 * `costChoices` is left to the engine's own default, matching every other command this app sends without an
 * explicit override.
 */
export function tryReducedPlay(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  picked: readonly string[],
  sources: readonly PaymentSource[],
  reductions: readonly { readonly instanceId: InstanceId; readonly abilityId: AbilityId }[],
  deps: EngineDeps,
  target: InstanceId | null,
  controllerId: PlayerId | null,
  costSelection: CostSelection | undefined,
): PaymentAttempt {
  const command: Command = {
    type: "playCard",
    playerId,
    cardInstanceId,
    payment: paymentsFromPicked(picked, sources),
    attachToInstanceId: target,
    ...(controllerId ? { controllerId } : {}),
    ...(costSelection ? { costSelection } : {}),
    costReductionAbilities: reductions,
  };
  const result = applyCommand(state, command, deps);
  return result.ok ? { ok: true, command } : { ok: false, reason: result.error.code, message: result.error.message };
}
