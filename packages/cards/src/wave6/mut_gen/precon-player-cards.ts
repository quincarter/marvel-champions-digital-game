import { trait } from "@mc/content";
import { SCW_PACK_CARDS } from "../../wave2/scw/pack-cards.js";
import { WSP_PACK_CARDS } from "../../wave2/wsp/pack-cards.js";
import { SPECTRUM_PACK_CARDS } from "../../wave4/mts/spectrum-pack-cards.js";
import {
  attack,
  chooseCards,
  chosen,
  declareDefender,
  defineAbilities,
  draw,
  eventSource,
  heroInterrupt,
  modifyAttack,
  on,
  putIntoPlay,
  query,
  you,
  zone,
} from "../../dsl/index.js";

const X_MEN = trait("X-MEN");
const DEFENSE = trait("DEFENSE");

/** "An enemy attacks" with no "you": any enemy's attack against any player, as it is initiated (RRG 1.8 "Interrupt",
 * p. 25). Ruling July 9, 2026 (1): an attack initiated against another player can be answered, and redirecting it
 * does not make it "initiated against" the redirecting hero. */
const AN_ENEMY_ATTACKS = on.enemyAttacks(query("enemy"));

const SHADOW_AND_STEEL = heroInterrupt(
  AN_ENEMY_ATTACKS,
  { label: ["attack", "defense"] },
  modifyAttack({ preventAllDamage: true }),
  attack(4, eventSource),
);

/**
 * The Mutant Genesis aspect and basic cards no hero folder owns (`mut_gen` 32014-32018, 32021, and the second
 * printings 32050-32054 the Shadowcat precon carries; docs/phase7-wave6.md). Colossus's Protection set is 32011-32018
 * and his basics 32019-32024, Shadowcat's Aggression set 32046-32049; the cards below are the ones that are not
 * identity-specific, so they work from any hero's deck.
 *
 * - **Powerful Punch (32014)**: "Hero Interrupt (attack/defense): When an enemy initiates an attack, deal 4 damage to
 *   that enemy." The (defense) label makes the hero the defender of the attack (RRG 1.8 "Defend, Defense", p. 15), the
 *   (attack) label makes the 4 damage an attack (`attack`, so a stunned hero cannot use it, and "after you attack"
 *   responses hear it). FAQ "Powerful Punch (#14)" (RRG 1.8 p. 63): the hero is considered to have attacked as soon as
 *   the damage is dealt and then defends the villain's attack. Not a basic defense: its DEF does not reduce damage.
 *   The ability ref is `-constant` (a parse artifact of the data), the trigger is the interrupt.
 * - **Bait and Switch (32015)**: printed identically at `15030` (Scarlet Witch pack) and `27013`; aliased.
 * - **Perseverance (32016)**: reprints `13033` (Spider-Woman pack) verbatim; aliased.
 * - **Mutant Protectors (32017)**: "Play only if your identity has the X-MEN trait" is `playRestrictions`
 *   (`requiresIdentityTrait`, data). The interrupt puts an X-MEN ally from hand into play (put into play, not played,
 *   so Magik's top-of-deck play cannot do it: FAQ "Magik", RRG 1.8 p. 64), exhausts it and declares it the defender
 *   (`declareDefender` with `exhaust`). FAQ "Mutant Protectors (#17)" (p. 63): the player becomes the target of the
 *   attack and the ally the defender; if the ally leaves play before damage the hero defends (not a basic defense).
 * - **Defensive Energy (32018)**: "When you spend this card to play a Defense event, draw 1 card."
 * - **Shadow and Steel (32021, 32050)**: Team-Up (Colossus and Shadowcat) is data. "Hero Interrupt (attack/defense):
 *   When an enemy attacks, prevent all damage from that attack and deal 4 damage to the attacking enemy."
 *   `modifyAttack({ preventAllDamage })` rides the attack from initiation to its damage step (Mockingbird's shape).
 * - **Ready to Rumble (32051)**: reprints `21022` (Spectrum pack) verbatim; aliased. 32052-32054 (Energy, Genius,
 *   Strength) are plain resources with no ability.
 */
export const MUT_GEN_PRECON_PLAYER_CARDS = defineAbilities({
  "32014.powerful-punch-constant": heroInterrupt(
    AN_ENEMY_ATTACKS,
    { label: ["attack", "defense"] },
    attack(4, eventSource),
  ),

  "32015.bait-and-switch-action": SCW_PACK_CARDS["15030.bait-and-switch-action"]!,

  "32016.perseverance-response": WSP_PACK_CARDS["13033.perseverance-response"]!,

  "32017.mutant-protectors-interrupt": heroInterrupt(
    AN_ENEMY_ATTACKS,
    { label: "defense" },
    chooseCards("ally", zone("hand", you, { filter: query("ally", { trait: X_MEN }) }), { min: 1, max: 1 }),
    putIntoPlay(chosen("ally"), you),
    declareDefender(chosen("ally"), { exhaust: true }),
  ),

  "32018.defensive-energy-interrupt": heroInterrupt(
    on.youSpendThis({ toPlay: query("event", { trait: DEFENSE }) }),
    draw(1),
  ),

  "32021.shadow-and-steel-constant": SHADOW_AND_STEEL,
  "32050.shadow-and-steel-constant": SHADOW_AND_STEEL,

  "32051.ready-to-rumble-response": SPECTRUM_PACK_CARDS["21022.ready-to-rumble-response"]!,
});
