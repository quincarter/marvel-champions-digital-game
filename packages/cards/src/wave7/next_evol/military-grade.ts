import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  blanksTextBox,
  chosen,
  constant,
  defineAbilities,
  discard,
  discardEncounterUntil,
  discardStatusCost,
  eachPlayer,
  eitherCost,
  exhaustCardsCost,
  firstPlayer,
  gainsKeyword,
  heroAction,
  response,
  host,
  maxDamageTaken,
  on,
  query,
  revealCard,
  self,
  spend,
  spendSameType,
  takeDamageCost,
  whenDefeated,
} from "../../dsl/index.js";

/**
 * The Military Grade modular set (40090-40093). Heavy Armament and Titanium Exoskeleton attach to an enemy chosen by
 * their superlative host (data: `attachesTo`); Inhibitor Collar attaches to the revealing player's identity. ATK +2 on
 * Heavy Armament and ATK -1 on Inhibitor Collar are stat boxes, hinder is a keyword (data).
 */
const ATTACHED_ENEMY = query("enemy", { hostOfSelf: true });

export const MILITARY_GRADE: AbilityRegistry = defineAbilities({
  // Heavy Armament — Attached enemy gains retaliate 2.
  "40090.heavy-armament-constant": constant(gainsKeyword({ name: "retaliate", value: 2 }, ATTACHED_ENEMY)),
  // Hero Response: After you attack the attached enemy, spend 2 resources of the same type -> discard this card.
  // A plain `response` with the hero as the attacker: `heroResponse` reads the controller's form, and an attachment on
  // an enemy has no controller (the same reading as Loki's Staff, wave4/mts/loki.ts). "You" is the hero's player.
  "40090.heavy-armament-response": response(
    on.attacks(query("hero"), { target: { hostOfSelf: true } }),
    { cost: spendSameType(2) },
    discard(self),
  ),

  // Titanium Exoskeleton — Attached enemy cannot take more than 2 damage from a single attack.
  "40091.titanium-exoskeleton-constant": constant(maxDamageTaken(ATTACHED_ENEMY, 2)),
  // Hero Action: Choose to either spend 3 resources of any type or remove a confused or stunned status card from
  // attached enemy -> discard this card.
  "40091.titanium-exoskeleton-action": heroAction(
    {
      cost: eitherCost(spend(3), discardStatusCost("confused", host), discardStatusCost("stunned", host)),
    },
    discard(self),
  ),

  // Inhibitor Collar — Treat your identity's printed text box as if it were blank (except for traits).
  "40092.inhibitor-collar-constant": constant(blanksTextBox(query("identity", { hostOfSelf: true }))),
  // Action: Choose to either exhaust a character you control or take 3 damage -> discard this card. Any player can do
  // this (RRG 1.8 erratum, p. 69: rules text, no longer reminder text).
  "40092.inhibitor-collar-action": action(
    {
      cost: eitherCost(exhaustCardsCost(query(["identity", "ally"])), takeDamageCost(3)),
      triggerableBy: eachPlayer,
    },
    discard(self),
  ),

  // The Senator's Support — When Defeated: The first player discards cards from the top of the encounter deck until an
  // attachment is discarded and reveals that card.
  "40093.when-defeated": whenDefeated(
    discardEncounterUntil(query("attachment"), "found"),
    revealCard(chosen("found"), firstPlayer),
  ),
});
