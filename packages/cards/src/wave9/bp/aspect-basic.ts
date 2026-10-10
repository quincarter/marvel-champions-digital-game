import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  addToVictoryDisplay,
  after,
  andThen,
  attachCard,
  bindTargets,
  cards,
  chooseCards,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  dealAsEncounterCard,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardThis,
  encounterCards,
  encounterSetAside,
  enemyScheme,
  eventAmount,
  eventSource,
  exists,
  min,
  eventTarget,
  forcedInterrupt,
  ifThen,
  instead,
  interrupt,
  lookAt,
  moveCards,
  on,
  placeOnTopOrBottom,
  placeThreat,
  playerOrElse,
  eventPlayer,
  printedStatOf,
  query,
  remainingHpOf,
  removeThreatFromAScheme,
  resolveSpecialsOf,
  response,
  selectCards,
  self,
  special,
  tuckCards,
  tuckedCount,
  tuckedUnder,
  valueAtLeast,
  threatOn,
  whenDefeated,
  you,
  zone,
} from "../../dsl/index.js";
import { VENOM_KIT } from "../../wave3/vnm/venom-kit.js";

const ELITE = trait("ELITE");
const DORA_MILAJE = trait("DORA MILAJE");

/**
 * Wave 9 scripting module `bp/aspect-basic` (docs/phase7-wave9.md section 8.4), first half (51014 to 51022); the second
 * half (51023 to 51030, 51036 to 51038) is skipped below until its task. `card-groups.ts` maps this module to the ids
 * below; keep the two in step.
 *
 * **51014.manifold-response**: the chosen player (any, the first of the two in the text being the controller's choice)
 * searches their own deck and discard pile for a player side scheme; the search is compulsory when one exists (owner
 * ruling), the card goes to that player's hand and their deck is shuffled.
 *
 * **51015.infiltration-action**: skipped, see `BP_ASPECT_BASIC_SKIPPED`.
 *
 * **51016.when-defeated**: "the defeating player" looks at, chooses and orders. A card is "scenario-specific" when it
 * belongs to the encounter set of the scenario's main scheme (RRG 1.8 "Scenario-Specific Card", p. 39); a card from the
 * victory display is out of the deck, the rest go back on the top and/or bottom in any order.
 *
 * **51017.show-of-empathy-forced-interrupt**: the threat being removed (`eventAmount`) lands as tokens on a non-Elite
 * minion chosen by the player who removed it, else by the scheme's controller. Then, once, if that minion's threat
 * is at least its remaining hit points, the scheme goes to the victory display and 1 set-aside Redemption attaches to
 * the minion. Redemption's own "take control ... Redeemed ally" text is 51036's constant (second half).
 *
 * **51018.the-raft-response**: after a minion leaves play it is tucked under here only if it is in the encounter
 * discard pile when the response resolves (a minion with Victory X is not). Only then are threat removed (the tucked
 * minion's printed SCH) and, at 4 or more tucked minions, 1 random one dealt facedown to a player the controller picks.
 * The tuck is printed before the arrow (a cost), but no tuck cost exists in the engine, so it is the first effect and the rest is guarded on the minion being tucked; the only difference is that the response is offered when the minion is not in the discard pile and then does nothing.
 *
 * **51019.invisibility-gear-interrupt**: the mirror of Ready for a Fight (52019); "would attack you" is replaced by
 * that enemy's scheme. **51020.sonic-rifle-action**: a reprint of Venom's 20015, aliased.
 *
 * **51021.sting-operation-response**: the minion is discarded, not defeated.
 *
 * **51022.aneka-response / 51022.aneka-special**: "another Dora Milaje ally" is any player's, resolved with Aneka's
 * controller as "you". The Special removes 1 threat from a scheme.
 *
 * Cards (20):
 * - 51014 Manifold (ally)
 * - 51015 Infiltration (event)
 * - 51016 Going Undercover (player_side_scheme)
 * - 51017 Show of Empathy (player_side_scheme)
 * - 51018 The Raft (support)
 * - 51019 Invisibility Gear (upgrade)
 * - 51020 Sonic Rifle (upgrade)
 * - 51021 Sting Operation (upgrade)
 * - 51022 Aneka (ally)
 * - 51023 Ayo (ally)
 * - 51024 Okoye (ally)
 * - 51025 Heart of the Panther (event)
 * - 51026 Build Support (player_side_scheme)
 * - 51027 Energy (resource)
 * - 51028 Genius (resource)
 * - 51029 Strength (resource)
 * - 51030 Dora Milaje (support)
 * - 51036 Redemption (upgrade)
 * - 51037 White Wolf (ally)
 * - 51038 Target Spotter (support)

 */
export const BP_ASPECT_BASIC: AbilityRegistry = defineAbilities({
  "51014.manifold-response": response(
    after.entersPlay("self"),
    choosePlayer("player"),
    chooseCards("found", zone(["deck", "discard"], chosenPlayer("player"), { filter: query("sideScheme") }), {
      min: 1,
      max: 1,
      chooser: chosenPlayer("player"),
    }),
    moveCards(cards(chosen("found")), "hand"),
    { kind: "shuffleDeck", player: chosenPlayer("player") },
  ),

  "51016.when-defeated": whenDefeated(
    lookAt(encounterCards(["deck"], undefined, 5), { bind: "looked", viewer: defeatingPlayer }),
    chooseCards("kept", cards(chosen("looked"), query([], { scenarioSpecific: false })), {
      min: 0,
      max: 1,
      chooser: defeatingPlayer,
    }),
    addToVictoryDisplay(cards(chosen("kept"))),
    andThen(placeOnTopOrBottom(cards(chosen("looked"), { excludeSlots: ["kept"] }), defeatingPlayer)),
  ),

  "51017.show-of-empathy-forced-interrupt": forcedInterrupt(
    { on: "removeThreat", selfIs: "target" },
    chooseTarget("minion", query("minion", { withoutTrait: ELITE }), { chooser: playerOrElse(eventPlayer, you) }),
    // With no non-Elite minion in play nothing was chosen: the threat is only removed, and nothing is checked.
    ifThen(exists(query("minion", { inSlot: "minion" })), [
      // The threat actually removed: a thwart for more than the scheme holds removes only what is there.
      placeThreat(min(eventAmount, threatOn(self)), chosen("minion")),
      ifThen(valueAtLeast(threatOn(chosen("minion")), remainingHpOf(chosen("minion"))), [
        selectCards("redemption", encounterSetAside(query("upgrade", { name: "Redemption" }), { random: 1 })),
        addToVictoryDisplay(cards(self)),
        attachCard(chosen("redemption"), chosen("minion")),
      ]),
    ]),
  ),

  "51018.the-raft-response": response(
    after.leavesPlay(query("minion")),
    bindTargets("left", eventTarget),
    tuckCards(encounterCards(["discard"], { inSlot: "left" }), self),
    ifThen(valueAtLeast(tuckedCount(self, { inSlot: "left" }), 1), [
      removeThreatFromAScheme(printedStatOf(chosen("left"), "sch")),
      ifThen(valueAtLeast(tuckedCount(self, query("minion")), 4), [
        selectCards("loose", tuckedUnder(self, { random: 1, filter: query("minion") })),
        choosePlayer("dealt"),
        dealAsEncounterCard(chosen("loose"), chosenPlayer("dealt")),
      ]),
    ]),
  ),

  "51019.invisibility-gear-interrupt": interrupt(
    on.enemyAttacks(query("enemy"), { againstYou: true }),
    { cost: discardThis, would: true },
    instead(enemyScheme(eventSource)),
  ),

  "51020.sonic-rifle-action": VENOM_KIT["20015.sonic-rifle-action"]!,

  "51021.sting-operation-response": response(
    after.enemySchemes(query("minion", { withoutTrait: ELITE })),
    { cost: discardThis },
    discard(eventSource),
  ),

  "51022.aneka-response": response(
    after.basicPowerUsed("self"),
    chooseTarget("ally", query("ally", { trait: DORA_MILAJE, not: { self: true } })),
    resolveSpecialsOf(chosen("ally"), you),
  ),
  "51022.aneka-special": special(...removeThreatFromAScheme(1)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
const SECOND_HALF = "second half of the module, not started";
export const BP_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "51015.infiltration-action":
    "waits on engine task 26 (docs/phase7-wave9.md section 3.43 (a)): no AbilityCost discards a chosen number (1 to 5) of cards from the top of the encounter deck and binds them for the effects (AbilityCost.discardFromEncounterDeck, packages/engine/src/abilities.ts, is not built; encounterLookDiscard has a fixed count and a look)",
  "51023.ayo-response": SECOND_HALF,
  "51023.ayo-special": SECOND_HALF,
  "51024.okoye-response": SECOND_HALF,
  "51024.okoye-special": SECOND_HALF,
  "51025.heart-of-the-panther-action": SECOND_HALF,
  "51026.when-defeated": SECOND_HALF,
  "51030.dora-milaje-action": SECOND_HALF,
  "51030.dora-milaje-constant": SECOND_HALF,
  "51036.redemption-constant": SECOND_HALF,
  "51037.white-wolf-forced-response": SECOND_HALF,
  "51038.target-spotter-interrupt": SECOND_HALF,
};
