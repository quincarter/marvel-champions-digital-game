import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  constant,
  defineAbilities,
  encounterCards,
  engage,
  engagedPlayerOf,
  exists,
  gainsIcon,
  ifThen,
  inPlay,
  named,
  placeThreat,
  putIntoPlay,
  query,
  rule,
  selectCards,
  self,
  shuffleEncounterDeck,
  theMainScheme,
  valueEquals,
  varOf,
  whenRevealed,
  chosen,
  you,
} from "../../dsl/index.js";

const SCIENTIST = "A.I.M. Scientist";

/**
 * Modular encounter set `aim-science` (Agents of S.H.I.E.L.D.; docs/phase7-wave9.md sections 3.1, 3.33 and 3.35).
 * Surge, Vulnerable (the engine's keyword rule, section 3.1), Patrol, Hinder 2 per hero, the acceleration icon on the
 * Scientist and on Mad Science, and the boost icons are data.
 *
 * **A.I.M. Scientist (50083)**: cannot be attacked (by any attacker) while the engaged player is engaged with another
 * minion.
 *
 * **A.I.M. Soldier (50084)**: When Revealed: find the Scientist and put it into play engaged with you; one already in
 * play engages you instead (RRG 1.8 "Engage", p. 18), and then it did not enter play, so the threat goes on the main
 * scheme just as when it is nowhere to be found. The encounter deck is shuffled after the search.
 *
 * **Mad Science (50085)**: each A.I.M. minion gains 1 acceleration icon.
 *
 * Cards (3):
 * - 50083 A.I.M. Scientist (minion)
 * - 50084 A.I.M. Soldier (minion)
 * - 50085 Mad Science (side_scheme)
 */
export const AIM_SCIENCE: AbilityRegistry = defineAbilities({
  "50083.aim-scientist-constant": constant(
    rule({
      kind: "cannotAttack",
      target: { self: true },
      while: exists(query("minion", { engagedWithPlayer: engagedPlayerOf(self), self: false })),
    }),
  ),

  "50084.when-revealed": whenRevealed(
    ifThen(
      inPlay(SCIENTIST),
      [engage(named(SCIENTIST), you), placeThreat(1, theMainScheme)],
      [
        selectCards("scientist", encounterCards(["deck", "discard"], query("minion", { name: SCIENTIST }))),
        putIntoPlay(chosen("scientist"), you, { bind: "entered" }),
        shuffleEncounterDeck(),
        ifThen(valueEquals(varOf("entered.count"), 0), placeThreat(1, theMainScheme)),
      ],
    ),
  ),

  "50085.mad-science-constant": constant(gainsIcon("acceleration", query("minion", { trait: trait("A.I.M.") }))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const AIM_SCIENCE_SKIPPED: Readonly<Record<string, string>> = {};
