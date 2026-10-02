import {
  action,
  alterEgoAction,
  anyOfCards,
  boost,
  cards,
  changeAdditionalForm,
  chosen,
  confuse,
  constant,
  defeatingPlayer,
  defineAbilities,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  engage,
  exhaustYourHero,
  moveCards,
  putIntoPlay,
  query,
  rule,
  selectCards,
  setAside,
  self,
  shuffleEncounterDeck,
  spend,
  whenDefeated,
  whenRevealed,
  yourIdentity,
  you,
  youAre,
  oneCopyOf,
} from "../../../dsl/index.js";

/**
 * Permanently Phased (32055), Shadowcat's obligation, and her Hellfire Club nemesis set: White Queen (32056, nemesis
 * minion), The Hellfire Club (32057, side scheme), Hellfire Pawn x2 (32058, minion) and Telepathic Restraint (32059,
 * attachment).
 *
 * - **Permanently Phased** stays in play (the Loss of Control, `21026`, shape): the "cannot" sentence is its constant,
 *   the Alter-Ego Action removes it from the game. Its "you" is the player whose play area holds it (RRG 1.8
 *   "Obligation", p. 30), and "you cannot attack, defend" resolves to that player's identity (RRG 1.8 "You, Your",
 *   p. 49: a "you" that can be the identity must be), so the player's allies still attack and defend
 *   (docs/phase7-wave6.md §3.77, as Fear of Kang's `11049`). "Change mass form" is the player's.
 *   Its unheaded "Flip your mass form upgrade to Phased" is the When Revealed ref (already Phased, nothing changes).
 *   **Open rules question:** the obligation enters play before its When Revealed resolves (RRG 1.8 "Reveal", p. 38,
 *   steps 2-3), so its own "cannot change mass form" is in force and blocks that flip today (an `it.fails` pins it).
 * - **White Queen** and **Telepathic Restraint** keep their status card on the player's identity (`youAre`,
 *   docs/phase7-wave6.md §3.9). FAQ "White Queen (#56)" (RRG 1.8 p. 63): a thwart spends the confused card and she gives
 *   another at once; when she leaves play the cards she gave stay.
 * - **The Hellfire Club**'s defeater searches three zones (encounter deck, discard pile, set-aside area) for one copy
 *   of the Hellfire Pawn and puts it into play engaged with them (`putIntoPlay` engages a minion with its controller).
 *   The nemesis set sits in Shadowcat's own set-aside area, so every player's is searched (`setAside(eachPlayer)`).
 */
export const SHADOWCAT_OBLIGATION_NEMESIS = defineAbilities({
  // Permanently Phased — Flip your mass form upgrade to Phased. You cannot attack, defend or change mass form.
  // Alter-Ego Action: exhaust Kitty Pryde -> remove this card from the game.
  "32055.permanently-phased-when-revealed": whenRevealed(changeAdditionalForm("mass", { toName: "Phased" })),
  "32055.permanently-phased-constant": constant(
    rule({ kind: "cannotAttack", target: query("enemy"), attacker: query("identity", { controlledBy: you }) }),
    rule({ kind: "cannotDefend", target: query("identity", { controlledBy: you }) }),
    rule({ kind: "cannotChangeForm", player: you, formType: "mass" }),
  ),
  "32055.permanently-phased-action": alterEgoAction(
    { cost: exhaustYourHero },
    moveCards(cards(self), "removedFromGame"),
  ),

  // White Queen — Villainous (data). While she is engaged with you, you are confused. [star] Boost: You are confused.
  "32056.white-queen-constant": constant(youAre("confused")),
  "32056.boost": boost(confuse(yourIdentity)),

  // The Hellfire Club — When Defeated: the player who defeated it searches the encounter deck, discard pile and
  // set-aside area for a copy of the Hellfire Pawn and puts it into play engaged with them. (Shuffle.)
  "32057.when-defeated": whenDefeated(
    selectCards(
      "pawn",
      oneCopyOf(
        anyOfCards(
          encounterCards(["deck", "discard"], query("minion", { name: "Hellfire Pawn" })),
          encounterSetAside(query("minion", { name: "Hellfire Pawn" })),
          setAside(eachPlayer, query("minion", { name: "Hellfire Pawn" })),
        ),
      ),
    ),
    putIntoPlay(chosen("pawn"), defeatingPlayer),
    shuffleEncounterDeck(),
  ),

  // Hellfire Pawn — Guard. Patrol. Surge. (data) [star] Boost: Put Hellfire Pawn into play engaged with you.
  "32058.boost": boost(putIntoPlay(self, you), engage(self, you)),

  // Telepathic Restraint — Attach to your identity (data). While attached to your identity, you are stunned. Action:
  // spend [mental][mental] -> discard this card.
  "32059.telepathic-restraint-constant": constant(youAre("stunned")),
  "32059.telepathic-restraint-action": action({ cost: spend({ mental: 2 }) }, moveCards(cards(self), "discard")),
});
