import type { AbilityRegistry } from "@mc/engine";
import { trait } from "@mc/content";
import { obligation } from "../../../core/obligations.js";
import {
  after,
  chooseCards,
  cards,
  chosen,
  bindTargets,
  constant,
  defeatingPlayer,
  defineAbilities,
  dealIndirectDamage,
  discard,
  each,
  encounterCards,
  enemyActivates,
  exhaustCardsCost,
  forcedResponse,
  gets,
  heroAction,
  on,
  placeThreat,
  printedCostOf,
  query,
  revealCard,
  selectCards,
  self,
  shuffleEncounterDeck,
  superlative,
  theMainScheme,
  whenDefeated,
  zone,
  you,
} from "../../../dsl/index.js";

const HYDRA = trait("HYDRA");
const HYDRA_MINION = query("minion", { trait: HYDRA });
const CROSSBONES = query("minion", { name: "Crossbones" });

/**
 * Wave 9 scripting module `winter/winter-soldier/obligation-nemesis` (docs/phase7-wave9.md section 8.4, 3.49, 3.52).
 *
 * Cards (5):
 * - 54027 Red Room Programming (obligation)
 * - 54028 Crossbones (minion)
 * - 54029 Hydra Hit Squad (side_scheme)
 * - 54030 High-Tech Armament (attachment)
 * - 54031 Hydra Mercenary (minion)
 *
 * **Red Room Programming (54027)**: "Give to the Bucky Barnes player" is data and engine rule. The Core obligation
 * shape (`core/obligations.ts`): the optional flip to alter-ego form, then either exhaust Bucky Barnes to remove the
 * card from the game, or the discard-and-indirect-damage option, which ends "Discard this obligation". The highest
 * printed cost card in the hand is bound by a superlative over the hand (the spec's `chooseCardCost` has no
 * superlative, and this is an effect, not a cost): ties are the player's pick, X and resources count 0 (RRG "Cost"),
 * and the indirect damage reads the discarded card's printed cost. An empty hand discards nothing and takes nothing,
 * and the obligation is still discarded.
 *
 * **Crossbones (54028)**: Quickstrike is data. Forced Response: after an ally is defeated by an attack from Crossbones,
 * 2 threat on the main scheme (`on.defeated(..., { byAttackFrom })`, the Regroup 19032 shape).
 *
 * **Hydra Hit Squad (54029)**: each Hydra minion (Crossbones and the Mercenaries included) gets +1 ATK and +2 hit
 * points. When Defeated: the defeating player finds a Hydra minion in the encounter deck or discard pile and reveals
 * it (it engages them), then the deck is shuffled.
 *
 * **High-Tech Armament (54030)**: "Attach to Crossbones. Otherwise, attach to the villain" and +1 ATK are data. The
 * attached enemy activates against the player the card was revealed to after it enters play attached (a card revealed
 * onto its printed host enters play, it is not attached by an ability). Hero Action: exhaust a character you control to
 * discard it. With Fixer 53038 in play it would be attached to Fixer instead (section 3.49, engine task 35, not built).
 *
 * **Hydra Mercenary (54031)**: Guard is data; no ability ids.
 */
export const WINTER_SOLDIER_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "54027.obligation": obligation("Bucky Barnes", {
    label: "Discard the highest printed cost card from your hand and take indirect damage equal to its cost",
    effects: [
      selectCards("hand", zone("hand", you)),
      bindTargets("highest", superlative("highest", chosen("hand"), printedCostOf(chosen("candidate")))),
      chooseCards("pick", cards(chosen("highest")), { min: 1, max: 1 }),
      discard(chosen("pick")),
      dealIndirectDamage(you, printedCostOf(chosen("pick"))),
    ],
  }),

  "54028.crossbones-forced-response": forcedResponse(
    on.defeated(query("ally"), { byAttackFrom: CROSSBONES }),
    placeThreat(2, theMainScheme),
  ),

  "54029.hydra-hit-squad-constant": constant(gets("atk", 1, HYDRA_MINION), gets("hp", 2, HYDRA_MINION)),
  "54029.when-defeated": whenDefeated(
    chooseCards("found", encounterCards(["deck", "discard"], HYDRA_MINION), {
      min: 1,
      max: 1,
      chooser: defeatingPlayer,
    }),
    revealCard(chosen("found"), defeatingPlayer),
    shuffleEncounterDeck(),
  ),

  "54030.high-tech-armament-forced-response": forcedResponse(
    after.entersPlay("self"),
    enemyActivates(each(query("enemy", { hostOfSelf: true })), { against: you }),
  ),
  "54030.high-tech-armament-action": heroAction({ cost: exhaustCardsCost(query("character")) }, discard(self)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const WINTER_SOLDIER_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
