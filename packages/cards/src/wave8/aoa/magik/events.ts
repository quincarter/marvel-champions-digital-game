import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  chooseCards,
  chosen,
  confuse,
  damageAnEnemy,
  defineAbilities,
  dealDamage,
  eventSource,
  heroAction,
  heroInterrupt,
  ifThen,
  moveCards,
  modifyAttack,
  ofIdentitySetTitled,
  on,
  query,
  ready,
  stun,
  theVillain,
  thwartAScheme,
  topOfDeck,
  topOfYourDeckHas,
  yourIdentity,
  you,
  zone,
  cards,
  draw,
} from "../../../dsl/index.js";

/**
 * Magik signature events (docs/phase7-wave8.md section 7.1, 3.50, 3.60). Every ref is registered; nothing is skipped.
 *
 * **Scrying (45036)** is an Action (any player may use it; it is not a Hero Action): choose one of the top 3 cards to
 * draw, then one of the 2 still on top to discard; the last stays on top. With fewer cards the same order runs and the
 * later steps have fewer or no cards. The chooser's prompt is the look.
 *
 * **Stepping Disc (45037)** readies the hero, then puts a Magik card (the identity-specific set, `ofIdentitySetTitled`)
 * not named Stepping Disc from the discard pile on top of the deck. Scrying and a spell can come back; a second Stepping
 * Disc cannot.
 *
 * **Exorcism (45038)** and **Soul Strike (45039)** read "the top card of your deck" after the main effect resolved
 * (`topOfYourDeckHas`, section 3.50): [mental] or [wild] confuses the villain; [physical] or [wild] stuns the enemy that
 * took the damage. Soul Strike is an (attack)-labeled event that only deals damage: the natural `damageAnEnemy`, which
 * the engine resolves as one attack by the identity (Q48 = A), the choice limited to enemies she may attack (Q49).
 *
 * **Magic Barrier (45040)** is a defense-labeled interrupt to any enemy attack: `modifyAttack({ preventDamage: 3 })`
 * (Brazen Defense's shape), then 3 damage (not an attack) to the attacker if the top card has [energy] or [wild].
 *
 * Cards (5):
 * - 45036 Scrying (event)
 * - 45037 Stepping Disc (event)
 * - 45038 Exorcism (event)
 * - 45039 Soul Strike (event)
 * - 45040 Magic Barrier (event)
 */
export const MAGIK_EVENTS: AbilityRegistry = defineAbilities({
  "45036.scrying-action": action(
    chooseCards("drawn", topOfDeck(3), { min: 1, max: 1 }),
    // RRG 1.8 "Draw, Drawing Cards" (p. 17): a draw takes the top card of the deck and adds it to the hand. The chosen
    // card is put on top and drawn, so the draw happens (cardDrawn is emitted) rather than a move to hand.
    moveCards(cards(chosen("drawn")), "deckTop"),
    draw(1),
    chooseCards("discarded", topOfDeck(2), { min: 1, max: 1 }),
    moveCards(cards(chosen("discarded")), "discard"),
  ),

  "45037.stepping-disc-action": heroAction(
    ready(yourIdentity),
    chooseCards(
      "spell",
      zone("discard", you, { filter: query([], { ...ofIdentitySetTitled("Magik"), not: { name: "Stepping Disc" } }) }),
      { min: 1, max: 1 },
    ),
    moveCards(cards(chosen("spell")), "deckTop"),
  ),

  "45038.exorcism-action": heroAction(
    { label: "thwart" },
    ...thwartAScheme(4),
    ifThen(topOfYourDeckHas("mental"), confuse(theVillain)),
  ),

  "45039.soul-strike-action": heroAction(
    { label: "attack" },
    ...damageAnEnemy(4),
    ifThen(topOfYourDeckHas("physical"), stun(chosen("enemy"))),
  ),

  "45040.magic-barrier-interrupt": heroInterrupt(
    on.enemyAttacks(query("enemy")),
    { label: "defense" },
    modifyAttack({ preventDamage: 3 }),
    ifThen(topOfYourDeckHas("energy"), dealDamage(3, eventSource)),
  ),
});
