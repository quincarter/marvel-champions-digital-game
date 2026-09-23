import {
  after,
  cards,
  chosen,
  constant,
  defineAbilities,
  discard,
  discardDeckUntil,
  enemyAttack,
  forcedResponse,
  gets,
  hasStatus,
  heroResponse,
  ifThen,
  made,
  moveCards,
  named,
  not,
  query,
  self,
  stun,
  surge,
  theVillain,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";
import { cardName } from "../names.js";

const YOTAT = named(cardName("19027"));

/**
 * Memories of Another Life (19025), Drax's obligation, and his nemesis set: Cull the Weak (19026), Yotat the
 * Destroyer (19027, no ability of its own — Guard/Retaliate 1 are data), Challenge Accepted (19028), "I Will
 * Destroy You!" ×2 (19029). Gamora the ally (19020, a `basic`-aspect filler bundled in this pack, playable by any
 * guardian-trait identity — "Same title, different cards", docs/phase7-wave3.md §2.1) is scripted here too, since
 * she has no other natural home in this pack's folder layout.
 */
export const DRAX_OBLIGATION_NEMESIS = defineAbilities({
  // Gamora (ally) — Play only if your identity has the guardian trait (data, `playRestrictions`). Hero Response:
  // After Gamora attacks or thwarts, discard cards from the top of your deck until you discard an event, then add
  // that card to your hand.
  "19020.gamora-response": heroResponse(
    after.attacksOrThwarts("self"),
    discardDeckUntil(query("event"), "found"),
    moveCards(cards(chosen("found")), "hand"),
  ),

  // Memories of Another Life — Give to the Drax player. You may flip to alter-ego form. Choose:
  // • Exhaust your alter-ego → remove Memories of Another Life from the game.
  // • You are stunned. If you are already stunned, this card gains surge. Discard this obligation.
  // "If you are already stunned" is read before this stuns you (the same "before the effect" convention Wilt's
  // own growth-counter check uses, `gmw/groot-obligation-nemesis.ts` 16025).
  "19025.obligation": obligation("Drax", {
    label: "You are stunned. If you are already stunned, this card gains surge",
    effects: [ifThen(hasStatus(yourIdentity, "stunned"), surge()), stun(yourIdentity)],
  }),

  // Cull the Weak — Each enemy gets +2 ATK.
  "19026.cull-the-weak-constant": constant(gets("atk", 2, query("enemy"))),

  // Challenge Accepted — Surge (data). Attach to the enemy with the highest ATK (data, `attachesTo`). Forced
  // Response: After Drax deals 4 or more damage to attached enemy with a single attack, discard this card. Built
  // as a raw `EventPattern` (`on.damage` has no `eventAtLeast`/named-source hook of its own): "Drax" is named
  // explicitly (`query("identity", { name: "Drax" })`) rather than "you"/`controller`, since this attachment has
  // no controller of its own (it lives on the enemy, RRG 1.8 "Ownership and Control", p. 31) and the printed text
  // names the hero, not "the player".
  "19028.challenge-accepted-forced-response": forcedResponse(
    {
      on: "dealDamage",
      targetIs: { hostOfSelf: true },
      sourceIs: query("identity", { name: "Drax" }),
      fromAttack: true,
      eventAtLeast: { amount: 4 },
    },
    discard(self),
  ),

  // "I Will Destroy You!" — When Revealed (Alter-Ego): This card gains surge.
  "19029.when-revealed-alter-ego": whenRevealedAlterEgo(surge()),
  // "I Will Destroy You!" — When Revealed (Hero): Yotat the Destroyer attacks you with +1 ATK. If no attack was
  // made this way, the villain attacks you. Same "attack, or the villain instead" shape as Beetle Mania
  // (`wave2/wsp/obligation-nemesis.ts` 13030).
  "19029.when-revealed-hero": whenRevealedHero(
    enemyAttack(YOTAT, { against: you, atkBonus: 1, bind: "yotat" }),
    ifThen(not(made("yotat")), enemyAttack(theVillain, { against: you })),
  ),
});
