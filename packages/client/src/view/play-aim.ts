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
import { cardName, seatFormName } from "./names.js";

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
  if (cost?.payPrintedCostOf) {
    const allies = entry.targets.length > 0 && entry.targets.every((id) => cardOf(state, id)?.type === "ally");
    return `${name}: choose the ${allies ? "ally" : "card"} whose cost you pay`;
  }
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
  /**
   * "in the encounter deck", "in the encounter discard" or "in Carol Danvers' discard pile": the area as words, so it
   * is read without colour.
   */
  readonly area: string;
  /** The card id, for Inspect: a card in the encounter deck is facedown on the table, but a search shows it. */
  readonly cardId: string;
  /** The printed front, shown because the search turned the candidates up (Inspect opens the same). Null without a scan. */
  readonly art: ArtSource | null;
  /** "ENCOUNTER DECK" / "ENCOUNTER DISCARD" / "CAROL DANVERS' DISCARD": the area tag drawn on the face, in words. */
  readonly areaTag: string;
  /** "Minion" or "Ally", for the line under the name. */
  readonly typeWord: string;
  /** "copy 2 of 3" when the same card (name and area) is listed more than once, else null. */
  readonly copy: string | null;
  /** "Hellcat - in the encounter deck", numbered when two options would otherwise read the same. */
  readonly label: string;
  /** False for a card shown but not choosable right now (an ally Make the Call cannot pay for): drawn dimmed. */
  readonly available: boolean;
  /** Why an unavailable card cannot be chosen, in a few words ("Can't afford"); null when it can. */
  readonly unavailable: string | null;
}

/**
 * The chooser a pick of cards off the board opens: a search cost's minion (Hunted), or the card in a discard pile whose
 * printed cost is paid (Make the Call). A list of the cards the engine found, each with its area.
 */
export interface SearchedPickView {
  readonly prompt: string;
  readonly options: readonly SearchedPickOption[];
  /**
   * True when a tap only selects and a Confirm button goes on (Make the Call: the player sees the ally they picked
   * before the pay step opens); false when a tap chooses at once (Hunted).
   */
  readonly confirm: boolean;
  /** The option selected so far, when `confirm`; filled in by the board controller, null until a tap. */
  readonly chosen?: InstanceId | null;
}

const AREA_TAGS: Readonly<Record<string, string>> = {
  encounterDeck: "ENCOUNTER DECK",
  encounterDiscard: "ENCOUNTER DISCARD",
};

const AREA_WORDS: Readonly<Record<string, string>> = {
  encounterDeck: "in the encounter deck",
  encounterDiscard: "in the encounter discard",
};

/** "Carol Danvers'": a seat's current face, as the owner of a pile. */
const possessive = (name: string): string => (name.endsWith("s") ? `${name}'` : `${name}'s`);

/** Where a listed card is, as words and as the tag on its face. */
function areaOf(state: GameState, instanceId: InstanceId): { readonly area: string; readonly areaTag: string } {
  const zone = locateCard(state, instanceId);
  if (zone?.kind === "discard") {
    const owner = possessive(seatFormName(state, zone.playerId));
    return { area: `in ${owner} discard pile`, areaTag: `${owner.toUpperCase()} DISCARD` };
  }
  return {
    area: (zone && AREA_WORDS[zone.kind]) || "out of play",
    areaTag: (zone && AREA_TAGS[zone.kind]) || "OUT OF PLAY",
  };
}

/**
 * The candidates of a pick that is not on the board, listed instead of highlighted, each with the area it is in; null
 * for every other play. Only cards the engine listed (`LegalAction.targets`) can be chosen.
 *
 * - A cost that searches the encounter deck and discard pile (Hunted 56007), when the engine lists more than one.
 * - The card in a discard pile whose printed cost a play's cost pays ("Pay the printed cost of an ally in any player's
 *   discard pile", Make the Call 01071): every card of that type in the discard piles it reaches is shown, the ones the
 *   engine listed lit and the rest dimmed with why. The player selects one and confirms before the pay step opens,
 *   even when only one can be chosen, so they see which ally it is and whose pile it comes from (#419).
 */
export function searchedPickFor(state: GameState, deps: EngineDeps, entry: LegalAction): SearchedPickView | null {
  const { action } = entry;
  if (action.kind !== "playCard") return null;
  let shown: readonly InstanceId[] = entry.targets;
  const confirm = !additionalPlayCostOf(state, deps, action.instanceId)?.attachToSlot;
  if (!confirm) {
    if (!needsPlayAim(entry)) return null;
  } else {
    const pay = actionAbilityCost(state, deps, entry.example.playerId, action)?.payPrintedCostOf;
    if (pay?.from.zone !== "discard" || entry.targets.length === 0) return null;
    const type = cardOf(state, entry.targets[0]!)?.type;
    const piles = state.players.filter((seat) => pay.from.player !== "you" || seat.playerId === entry.example.playerId);
    shown = piles.flatMap((seat) => seat.discard.filter((id) => cardOf(state, id)?.type === type));
  }
  const base = shown.map((instanceId) => {
    const available = entry.targets.includes(instanceId);
    const blocked = entry.blockedTargets.find((target) => target.instanceId === instanceId);
    const name = cardOf(state, instanceId)?.name ?? "Card";
    const { area, areaTag } = areaOf(state, instanceId);
    const card = cardOf(state, instanceId);
    return {
      instanceId,
      name,
      area,
      cardId: (card?.id as string | undefined) ?? "",
      art: card ? artFor(card, defaultFaceFor(card)) : null,
      areaTag,
      typeWord: card ? card.type.charAt(0).toUpperCase() + card.type.slice(1).replace(/_/g, " ") : "Card",
      text: `${name} - ${area}`,
      available,
      unavailable: available ? null : blocked?.reason === "insufficient_resources" ? "Can't afford" : "Can't choose",
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
  return { prompt: playAimPrompt(state, deps, entry), options, confirm };
}
