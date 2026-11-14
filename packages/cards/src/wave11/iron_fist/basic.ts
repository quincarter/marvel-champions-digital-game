import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  anAttackableEnemy,
  attackAnEnemy,
  attackedThisPhase,
  attackTarget,
  chooseCards,
  chosen,
  constant,
  cards,
  dealDamage,
  defineAbilities,
  eachPlayer,
  exhaustThis,
  exists,
  generatesPerCard,
  gets,
  heroAction,
  moveCards,
  query,
  rule,
  self,
  spendableForPlayersWhere,
  takesConsequentialDamage,
  YOUR_HERO,
  youHaveTrait,
  zone,
  you,
} from "../../dsl/index.js";
import { LUKE_CAGE_OTHER_ASPECTS_BASIC } from "../luke_cage/other-aspects-basic.js";

const ATTACK = trait("ATTACK");
const MARTIAL_ARTIST = trait("MARTIAL ARTIST");
const DEFENDER = trait("DEFENDER");

/**
 * Wave 11 scripting module `iron_fist/basic` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (6):
 * - 64021 Colleen Wing (ally)
 * - 64022 Luke Cage (ally)
 * - 64023 Punch, Reverse Punch (event)
 * - 64024 Power Man and Iron Fist (event)
 * - 64025 Thunder Dojo (support)
 * - 64033 The Defenders (resource)
 *
 * Reprints, aliased to the original card's script: 64024.
 *
 * **64021.colleen-wing-constant**: a consequential-damage rule on her attack (`takesConsequentialDamage`) whose `if`
 * reads the phase's attack record against the enemy she attacked (`attackedThisPhase(attackTarget())`), in play or
 * defeated by her attack: some attack this phase by a Martial Artist character other than her, its traits as they were
 * when it attacked (a Martial Artist ally since defeated still counts). Reading the trait at attack time rather than
 * now: owner decision 9, docs/phase7-elektra-iron-fist.md §5 (no direct ruling).
 *
 * **64022.luke-cage-constant**: Toughness is data. "If your hero shares a Trait with Luke Cage" reads both sides live
 * (`sharesTraitWith`); an alter-ego identity is not "your hero", so there is no bonus (and no DEF to raise).
 *
 * **64023.punch-reverse-punch-action**: the Tooth and Claw shape (tigra 56008): one attack, whose two sentences are
 * independent instances of 1 damage, each choosing its enemy as it resolves, so both may name one enemy (owner's answer
 * 2026-10-11, question 16 = A, docs/phase7-wave10.md; provisional). Discount is data.
 *
 * **64025.thunder-dojo-action**: "Any player may trigger this ability" is `triggerableBy: eachPlayer`; the player who
 * triggers it is "you", so it is their discard pile and deck that are used ("your"). Up to 2 Attack events, so
 * choosing none is allowed. Prerequisite is data.
 *
 * **64033.the-defenders-constant**: what it generates is read from its owner's hand, "you" its owner whoever it is spent
 * for (`handGenerates`: one [physical] per Defender character the owner controls, identity included, to 4). "Can be
 * spent for another player whose identity has the Defender trait" is read for the player it is spent for, their
 * identity's face showing (`spendableForPlayersWhere`).
 */
export const IRON_FIST_BASIC: AbilityRegistry = defineAbilities({
  "64021.colleen-wing-constant": constant(
    rule(
      takesConsequentialDamage({ self: true }, -1, {
        from: "attack",
        if: attackedThisPhase(attackTarget(), { trait: MARTIAL_ARTIST, except: self }),
      }),
    ),
  ),

  "64033.the-defenders-constant": constant(
    { handGenerates: generatesPerCard("physical", query("character", { trait: DEFENDER, controller: "you" }), 4) },
    spendableForPlayersWhere(youHaveTrait(DEFENDER)),
  ),

  "64022.luke-cage-constant": constant(
    gets("def", 1, YOUR_HERO, { while: exists({ ...YOUR_HERO, sharesTraitWith: self }) }),
  ),

  "64023.punch-reverse-punch-action": heroAction(
    { label: "attack" },
    attackAnEnemy(1, { slot: "first" }),
    anAttackableEnemy("second"),
    dealDamage(1, chosen("second")),
  ),

  "64024.power-man-and-iron-fist-action": LUKE_CAGE_OTHER_ASPECTS_BASIC["62023.power-man-and-iron-fist-action"]!,

  "64025.thunder-dojo-action": alterEgoAction(
    { cost: exhaustThis, triggerableBy: eachPlayer },
    chooseCards("card", zone("discard", you, { filter: query("event", { trait: ATTACK }) }), { min: 0, max: 2 }),
    moveCards(cards(chosen("card")), "deckShuffle"),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
