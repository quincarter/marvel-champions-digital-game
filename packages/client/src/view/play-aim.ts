/**
 * Aiming a play or an ability at the target the player picked (RRG 1.8 "Cost", p. 13: a cost's choices are the
 * player's). `legalActions` lists one variant per way a cost can go: an upgrade's host, the character an attach cost
 * names ("attach Touched to a character other than Rogue", Energy Transfer 38007), a hand card a cost chooses, a card
 * whose printed cost is paid. Each variant's pick lands in a named cost-choice slot (`LegalAction.targets` are the
 * picks); this module re-aims the engine's own example command at one of them, reading the slot from the card's own
 * cost, and words the question. It decides no legality: only targets the engine listed are ever passed in.
 */

import {
  additionalPlayCostOf,
  cardOf,
  locateCard,
  type AbilityCost,
  type Command,
  type CostChoices,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type LegalAction,
} from "@mc/engine";
import { artFor, defaultFaceFor, type ArtSource } from "../art/art-source.js";
import { actionAbilityCost } from "./cost-choice-model.js";
import { cardName } from "./names.js";

/**
 * The cost-choice slot a cost's pick is sent in: an attach host, a chosen hand card, a card whose cost is paid, the
 * character a cost deals its damage to (Rogue 48012, `dealDamage.choose`) or heals (`healCharacter`), the card a cost
 * chooses (4K Digital Camcorder 61009, `chooseTarget`), or the card whose Special a cost resolves
 * (the [SETTING] environment, `resolveAbility.choose`). Picks among cards in play that pay a cost (Teleport Drop's Bamf!,
 * Mutant Mayhem's two returned allies) are not here: they are several cards over one or more slots, asked by
 * `in-play-cost-choice.ts`.
 */
export function costPickSlot(cost: AbilityCost | undefined): string | null {
  return (
    cost?.attach?.to.slot ??
    cost?.chooseCard?.slot ??
    cost?.payPrintedCostOf?.slot ??
    cost?.dealDamage?.choose?.slot ??
    cost?.healCharacter?.slot ??
    cost?.chooseTarget?.slot ??
    cost?.resolveAbility?.choose ??
    null
  );
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
    // "As an additional cost to play this upgrade, search … for a minion and put it into play. Attach to that minion"
    // (Hunted 56007): the listed targets are minions still in the encounter deck or discard pile, so the pick goes in
    // the cost's slot and the card has no host yet.
    const searched = additionalPlayCostOf(state, deps, command.cardInstanceId)?.attachToSlot;
    if (searched) {
      return { ...command, attachToInstanceId: null, costChoices: { ...command.costChoices, [searched]: [target] } };
    }
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
 * What a payment is opened with once the player has picked `target`: an upgrade's host rides as the payment's target, but a
 * pick for a cost that searches the encounter deck (Hunted) is a cost choice and the card has no host to name.
 */
export function paymentAimOf(
  state: GameState,
  deps: EngineDeps,
  action: LegalAction["action"],
  target: InstanceId | null,
): { readonly target: InstanceId | null; readonly costChoices?: CostChoices } {
  if (target === null || action.kind !== "playCard") return { target };
  const searched = additionalPlayCostOf(state, deps, action.instanceId)?.attachToSlot;
  return searched ? { target: null, costChoices: { [searched]: [target] } } : { target };
}

/**
 * The question a hand play with several legal picks asks, worded from what the pick is: where an upgrade goes, who an
 * attach cost lands on, or which card a cost chooses.
 */
export function playAimPrompt(state: GameState, deps: EngineDeps, entry: LegalAction): string {
  const { action, example } = entry;
  if (action.kind !== "playCard" && action.kind !== "useAbility") return "Choose a target";
  const name = cardName(state, action.instanceId);
  const cost = actionAbilityCost(state, deps, example.playerId, action);
  if (action.kind === "playCard" && additionalPlayCostOf(state, deps, action.instanceId)?.attachToSlot)
    return `${name}: choose the minion to search for and attach it to`;
  if (cost?.attach) return `${name}: choose the character it attaches to`;
  if (cost?.chooseCard) return `${name}: choose a card for its cost`;
  if (cost?.payPrintedCostOf) return `${name}: choose the card whose cost you pay`;
  // "Deal 1 damage to another friendly character →": the target of the cost, any player's character.
  if (cost?.dealDamage?.choose) return `${name}: choose who takes the damage`;
  // "Heal 2 damage from an enemy →": the character the cost heals, an enemy or any player's character.
  if (cost?.healCharacter) return `${name}: choose who is healed`;
  if (cost?.resolveAbility?.choose) return `${name}: choose the Setting`;
  if (action.kind !== "playCard") return "Choose a target";
  const card = cardOf(state, action.instanceId);
  return card?.type === "upgrade" ? `Choose what ${name} attaches to` : `Choose a target for ${name}`;
}

/** One minion a search cost could put into play, and where it is now. */
export interface SearchedPickOption {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** "in the encounter deck" or "in the encounter discard": the area as words, so it is read without colour. */
  readonly area: string;
  /** The card id, for Inspect: a card in the encounter deck is facedown on the table, but a search shows it. */
  readonly cardId: string;
  /** The printed front, shown because the search turned the candidates up (Inspect opens the same). Null without a scan. */
  readonly art: ArtSource | null;
  /** "ENCOUNTER DECK" / "ENCOUNTER DISCARD": the area tag drawn on the face, in words. */
  readonly areaTag: string;
  /** "Minion", for the line under the name. */
  readonly typeWord: string;
  /** "copy 2 of 3" when the same card (name and area) is listed more than once, else null. */
  readonly copy: string | null;
  /** "Hellcat - in the encounter deck", numbered when two options would otherwise read the same. */
  readonly label: string;
}

/** The chooser a search cost's pick opens (Hunted): a list of the cards the engine found, each with its area. */
export interface SearchedPickView {
  readonly prompt: string;
  readonly options: readonly SearchedPickOption[];
}

const AREA_TAGS: Readonly<Record<string, string>> = {
  encounterDeck: "ENCOUNTER DECK",
  encounterDiscard: "ENCOUNTER DISCARD",
};

const AREA_WORDS: Readonly<Record<string, string>> = {
  encounterDeck: "in the encounter deck",
  encounterDiscard: "in the encounter discard",
};

/**
 * The candidates of a cost that searches the encounter deck and discard pile (Hunted 56007), when the engine lists
 * more than one: they are not on the board, so they cannot be highlighted there and are listed instead, each with the
 * area it was found in. Null for every other play. Only cards the engine listed (`LegalAction.targets`) appear.
 */
export function searchedPickFor(state: GameState, deps: EngineDeps, entry: LegalAction): SearchedPickView | null {
  const { action } = entry;
  if (action.kind !== "playCard" || !additionalPlayCostOf(state, deps, action.instanceId)?.attachToSlot) return null;
  if (!needsPlayAim(entry)) return null;
  const base = entry.targets.map((instanceId) => {
    const name = cardOf(state, instanceId)?.name ?? "Card";
    const zone = locateCard(state, instanceId);
    const area = (zone && AREA_WORDS[zone.kind]) || "out of play";
    const card = cardOf(state, instanceId);
    return {
      instanceId,
      name,
      area,
      cardId: (card?.id as string | undefined) ?? "",
      art: card ? artFor(card, defaultFaceFor(card)) : null,
      areaTag: (zone && AREA_TAGS[zone.kind]) || "OUT OF PLAY",
      typeWord: card ? card.type.charAt(0).toUpperCase() + card.type.slice(1).replace(/_/g, " ") : "Card",
      text: `${name} - ${area}`,
    };
  });
  const total = new Map<string, number>();
  for (const option of base) total.set(option.text, (total.get(option.text) ?? 0) + 1);
  const seen = new Map<string, number>();
  const options = base.map(({ text, ...option }): SearchedPickOption => {
    const nth = (seen.get(text) ?? 0) + 1;
    seen.set(text, nth);
    const of = total.get(text) ?? 0;
    return { ...option, label: of > 1 ? `${text} (${nth})` : text, copy: of > 1 ? `copy ${nth} of ${of}` : null };
  });
  return { prompt: playAimPrompt(state, deps, entry), options };
}
