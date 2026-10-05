/**
 * Aiming a play or an ability at the target the player picked (RRG 1.8 "Cost", p. 13: a cost's choices are the
 * player's). `legalActions` lists one variant per way a cost can go: an upgrade's host, the character an attach cost
 * names ("attach Touched to a character other than Rogue", Energy Transfer 38007), a hand card a cost chooses, a card
 * whose printed cost is paid. Each variant's pick lands in a named cost-choice slot (`LegalAction.targets` are the
 * picks); this module re-aims the engine's own example command at one of them, reading the slot from the card's own
 * cost, and words the question. It decides no legality: only targets the engine listed are ever passed in.
 */

import {
  cardOf,
  type AbilityCost,
  type Command,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type LegalAction,
} from "@mc/engine";
import { actionAbilityCost } from "./cost-choice-model.js";
import { cardName } from "./names.js";

/** The cost-choice slot a cost's pick is sent in: an attach host, a chosen hand card, or a card whose cost is paid. */
export function costPickSlot(cost: AbilityCost | undefined): string | null {
  return cost?.attach?.to.slot ?? cost?.chooseCard?.slot ?? cost?.payPrintedCostOf?.slot ?? null;
}

/**
 * Whether a hand play owes the player a pick before anything is sent: the engine listed several legal hosts or cost
 * picks (`LegalAction.targets`), and `example` is only the first of them. The one question every way of playing a card
 * (a tap or click, Inspect's "Play it", the keyboard) asks through `BoardController#playCard`, never answered by
 * whichever variant `example` happens to be. Zero or one listed pick is not a decision.
 */
export const needsPlayAim = (entry: LegalAction): boolean => entry.targets.length > 1;

/**
 * `command` aimed at `target`: an upgrade's host goes in `attachToInstanceId`, any other pick in the slot the card's
 * cost declares. Payment and every other pick the engine found stay exactly as it produced them.
 */
export function aimedAt(state: GameState, deps: EngineDeps, command: Command, target: InstanceId): Command {
  if (command.type === "playCard") {
    const slot = costPickSlot(
      actionAbilityCost(state, deps, command.playerId, { kind: "playCard", instanceId: command.cardInstanceId }),
    );
    if (slot) return { ...command, costChoices: { ...command.costChoices, [slot]: [target] } };
    return { ...command, attachToInstanceId: target };
  }
  if (command.type === "useAbility") {
    const slot = costPickSlot(
      actionAbilityCost(state, deps, command.playerId, {
        kind: "useAbility",
        instanceId: command.cardInstanceId,
        abilityId: command.abilityId,
      }),
    );
    return slot ? { ...command, costChoices: { ...command.costChoices, [slot]: [target] } } : command;
  }
  return command;
}

/**
 * The question a hand play with several legal picks asks, worded from what the pick is: where an upgrade goes, who an
 * attach cost lands on, or which card a cost chooses.
 */
export function playAimPrompt(state: GameState, deps: EngineDeps, entry: LegalAction): string {
  const { action, example } = entry;
  if (action.kind !== "playCard" || example.type !== "playCard") return "Choose a target";
  const name = cardName(state, action.instanceId);
  const cost = actionAbilityCost(state, deps, example.playerId, action);
  if (cost?.attach) return `${name}: choose the character it attaches to`;
  if (cost?.chooseCard) return `${name}: choose a card for its cost`;
  if (cost?.payPrintedCostOf) return `${name}: choose the card whose cost you pay`;
  const card = cardOf(state, action.instanceId);
  return card?.type === "upgrade" ? `Choose what ${name} attaches to` : `Choose a target for ${name}`;
}
