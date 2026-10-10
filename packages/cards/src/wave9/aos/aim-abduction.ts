import type { AbilityRegistry } from "@mc/engine";
import {
  addAccelerationToken,
  andThen,
  bindTargets,
  cards,
  chooseTarget,
  chosen,
  defineAbilities,
  discardDeckUntil,
  each,
  encounterCards,
  eventTarget,
  exists,
  forEachCard,
  forcedInterrupt,
  ifThen,
  inPlay,
  named,
  not,
  on,
  ownerOf,
  placeThreat,
  printedCostOf,
  putIntoPlay,
  query,
  remainingHpOf,
  replaceLeaveDestination,
  selectCards,
  self,
  shuffleEncounterDeck,
  superlative,
  tuckCards,
  tuckedUnderRef,
  whenDefeated,
  whenRevealed,
  you,
} from "../../dsl/index.js";

const SCHEME_NAME = "Abduct Superhumans";
const SCHEME = named(SCHEME_NAME);

/** "If Abduct Superhumans is not in play, find it and put it into play." (the encounter deck is shuffled after a search) */
const findSchemeIfAbsent = () =>
  ifThen(not(inPlay(SCHEME_NAME)), [
    selectCards("scheme", encounterCards(["deck", "discard"], query("sideScheme", { name: SCHEME_NAME }))),
    putIntoPlay(chosen("scheme")),
    shuffleEncounterDeck(),
  ]);

/**
 * Modular encounter set `a.i.m._abduction` (Agents of S.H.I.E.L.D.; docs/phase7-wave9.md section 3.20). Surge on the side
 * scheme, its starting threat (2 per player) and the boost icons are data.
 *
 * **Reading of the order in 50080 and 50082.** Both print "If Abduct Superhumans is not in play, find it and put it into
 * play" (50080 last, 50082 first). Nothing can be tucked under, or given threat on, a scheme that is not there, so
 * 50080 finds the scheme before it tucks (otherwise the card would do nothing exactly when the set first appears).
 * Putting a scheme into play is not revealing it: no surge.
 *
 * **A.I.M. Abductor (50080)**: When Revealed: the revealing player's ally with the most remaining hit points (they pick
 * among a tie) is tucked under Abduct Superhumans. The tuck makes the ally leave play, so Abduct Superhumans's own Forced
 * Interrupt places the threat and the acceleration token; this script places neither. Without an ally the player
 * controls, 2 threat go on Abduct Superhumans.
 *
 * **Abduct Superhumans (50081)**: Forced Interrupt to any ally leaving play (defeat, discard, return to hand or deck):
 * the ally ends tucked here instead, and threat equal to its printed cost goes here. "Then, place 1 acceleration token"
 * follows only a tuck that happened: the threat is joined with "and", so an ally that cannot be tucked (Victory,
 * Permanent, cannot leave play) still adds its threat but no token. When Defeated: each ally tucked here enters play
 * ready and undamaged under its owner's control.
 *
 * **Nabbed! (50082)**: When Revealed: the revealing player discards from the top of their deck until an ally is
 * discarded, which is tucked from the discard pile (it never was in play, so the Forced Interrupt does not answer); this
 * script places threat equal to its printed cost and 1 acceleration token. With no ally in the deck, nothing is tucked
 * and no threat is placed; the token still is (nothing printed ties it to the ally).
 *
 * Cards (3):
 * - 50080 A.I.M. Abductor (minion)
 * - 50081 Abduct Superhumans (side_scheme)
 * - 50082 Nabbed! (treachery)
 */
export const AIM_ABDUCTION: AbilityRegistry = defineAbilities({
  "50080.when-revealed": whenRevealed(
    findSchemeIfAbsent(),
    ifThen(
      exists(query("ally", { controller: "you" })),
      [
        bindTargets(
          "mostHp",
          superlative("highest", each(query("ally", { controller: "you" })), remainingHpOf(chosen("candidate"))),
        ),
        chooseTarget("victim", { inSlot: "mostHp" }),
        tuckCards(cards(chosen("victim")), SCHEME),
      ],
      placeThreat(2, SCHEME),
    ),
  ),

  "50081.abduct-superhumans-forced-interrupt": forcedInterrupt(
    on.leavesPlay(query("ally")),
    replaceLeaveDestination({ tuckedUnder: self }),
    placeThreat(printedCostOf(eventTarget), self),
    andThen(addAccelerationToken(self)),
  ),
  "50081.when-defeated": whenDefeated(
    forEachCard("tucked", tuckedUnderRef(self), putIntoPlay(chosen("tucked"), ownerOf(chosen("tucked")))),
  ),

  "50082.when-revealed": whenRevealed(
    findSchemeIfAbsent(),
    discardDeckUntil(query("ally"), "ally", you),
    tuckCards(cards(chosen("ally")), SCHEME),
    placeThreat(printedCostOf(chosen("ally")), SCHEME),
    addAccelerationToken(SCHEME),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const AIM_ABDUCTION_SKIPPED: Readonly<Record<string, string>> = {};
