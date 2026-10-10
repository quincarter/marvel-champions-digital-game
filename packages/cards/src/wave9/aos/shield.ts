import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  cards,
  chooseCards,
  chosen,
  constant,
  costModifier,
  countOf,
  defineAbilities,
  discard,
  each,
  encounterCards,
  engagedPlayerOf,
  exhaustCardsCost,
  exists,
  ifThen,
  placeThreat,
  query,
  revealCard,
  self,
  shuffleEncounterDeck,
  theMainScheme,
  whenDefeated,
  whenRevealed,
} from "../../dsl/index.js";

const SHIELD_TRAIT = trait("S.H.I.E.L.D.");
/** "1 S.H.I.E.L.D. ally or support they control", for the player the Trooper was engaged with. */
const TROOPER_VICTIMS = query(["ally", "support"], { trait: SHIELD_TRAIT, controlledBy: engagedPlayerOf(self) });
const SHIELD_MINION = query("minion", { trait: SHIELD_TRAIT });

/**
 * Wave 9 scripting module `aos/shield` (docs/phase7-wave9.md section 8.4, 3.1, 3.35): the S.H.I.E.L.D. encounter set.
 * Patrol, Vulnerable (the engine's keyword rule), the boost icons, Disavowed's hazard icon and Arrest Warrant's
 * acceleration icon are data.
 *
 * **S.H.I.E.L.D. Trooper (50178)**: When Defeated: the engaged player discards 1 S.H.I.E.L.D. ally or support they
 * control (their choice); if they control none, 2 threat go on the main scheme. A Vulnerable discard is not a defeat, so
 * this does not resolve then.
 *
 * **Arrest Warrant (50179)**: an obligation that stays in play under the player it was dealt to. Alter-Ego Action:
 * exhaust your identity or 1 S.H.I.E.L.D. ally, support or upgrade you control (two alternatives of one cost pick),
 * then search the encounter deck and discard pile for a S.H.I.E.L.D. minion, shuffle, and the acting player reveals it
 * (it engages them). "Discard this card" follows however the search ended (no minion to find included).
 *
 * **Disavowed (50180)**: each S.H.I.E.L.D. card costs 1 more to play, whoever plays it, while the scheme is in play.
 * When Revealed: 1 threat here for each S.H.I.E.L.D. card in play, on top of its printed starting threat. The scheme
 * does not count itself: it prints no trait line (the "S.H.I.E.L.D." in its footer is the encounter set name).
 *
 * Cards (3):
 * - 50178 S.H.I.E.L.D. Trooper (minion)
 * - 50179 Arrest Warrant (obligation)
 * - 50180 Disavowed (side_scheme)
 */
export const SHIELD: AbilityRegistry = defineAbilities({
  "50178.when-defeated": whenDefeated(
    ifThen(
      exists(TROOPER_VICTIMS),
      [
        chooseCards("victim", cards(each(TROOPER_VICTIMS)), {
          min: 1,
          max: 1,
          chooser: engagedPlayerOf(self),
        }),
        discard(chosen("victim")),
      ],
      placeThreat(2, theMainScheme),
    ),
  ),

  "50179.obligation": alterEgoAction(
    {
      cost: [
        exhaustCardsCost(
          query(["identity", "ally", "support", "upgrade"], {
            anyOf: [{ categories: ["identity"] }, { trait: SHIELD_TRAIT }],
          }),
        ),
      ],
    },
    chooseCards("minion", encounterCards(["deck", "discard"], SHIELD_MINION), { min: 1, max: 1 }),
    shuffleEncounterDeck(),
    revealCard(chosen("minion")),
    discard(self),
  ),

  "50180.disavowed-constant": constant(costModifier({ delta: 1, appliesTo: query([], { trait: SHIELD_TRAIT }) })),
  "50180.when-revealed": whenRevealed(placeThreat(countOf(query([], { trait: SHIELD_TRAIT })), self)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHIELD_SKIPPED: Readonly<Record<string, string>> = {};
