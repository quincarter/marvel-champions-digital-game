import {
  action,
  alterEgoAction,
  anyOfCards,
  boost,
  cards,
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
 *   the Alter-Ego Action removes it from the game. "You" is the player (RRG 1.8 "Obligation", p. 30), so the attack
 *   and defend bans cover the player's allies as well as the identity, as Fear of Kang's does (`11049`).
 *   **Not scripted: "Flip your mass form upgrade to Phased."** It is a When Revealed effect, but the card data carries
 *   only a `-constant` and an `-action` ref and no When Revealed ref, so nothing runs it (a content gap: the data needs
 *   a `32055.permanently-phased-when-revealed` ref; the effect is `changeAdditionalForm("mass", { toName: "Phased" })`).
 * - **White Queen** and **Telepathic Restraint** keep their status card on the player's identity (`youAre`,
 *   docs/phase7-wave6.md §3.9). FAQ "White Queen (#56)" (RRG 1.8 p. 63): a thwart spends the confused card and she gives
 *   another at once; when she leaves play the cards she gave stay.
 * - **The Hellfire Club**'s defeater searches three zones (encounter deck, discard pile, set-aside area) for one copy
 *   of the Hellfire Pawn and puts it into play engaged with them (`putIntoPlay` engages a minion with its controller).
 *   The nemesis set sits in Shadowcat's own set-aside area, so every player's is searched (`setAside(eachPlayer)`).
 */
export const SHADOWCAT_OBLIGATION_NEMESIS = defineAbilities({
  // Permanently Phased — You cannot attack, defend or change mass form (the flip to Phased: docblock). Alter-Ego
  // Action: exhaust Kitty Pryde -> remove this card from the game.
  "32055.permanently-phased-constant": constant(
    rule({ kind: "cannotAttack", target: query("enemy"), player: you }),
    rule({ kind: "cannotDefend", target: query(["identity", "ally"], { controlledBy: you }) }),
    rule({ kind: "cannotChangeForm", player: you, formType: "mass" }),
  ),
  "32055.permanently-phased-action": alterEgoAction({ cost: exhaustYourHero }, moveCards(cards(self), "removedFromGame")),

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
