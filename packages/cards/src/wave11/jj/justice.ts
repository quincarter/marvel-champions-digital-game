import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  addCounters,
  after,
  alterEgoAction,
  alterEgoResponse,
  anEnemy,
  applyRuleUntil,
  basicPowerBy,
  canUseBasicPower,
  cards,
  chooseCards,
  chooseOne,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  changeFormCost,
  confuse,
  constant,
  countersOn,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discard,
  discardThis,
  eachPlayer,
  eventResult,
  forEachPlayer,
  gets,
  handCountOf,
  heroAction,
  ifThen,
  moveCards,
  on,
  option,
  PLAYER_SIDE_SCHEME,
  query,
  removeCounter,
  removeThreatFromAScheme,
  response,
  self,
  setVar,
  shuffleDeck,
  skipNextVillainPhase,
  thatPlayer,
  theVillain,
  thwart,
  topOfDeck,
  varAtLeast,
  varOf,
  whenDefeated,
  you,
  zone,
} from "../../dsl/index.js";
import { WAVE10_ABILITIES } from "../../wave10/index.js";

const CHARACTER_YOU_CONTROL = query("character", { controller: "you" });
const GRAPNEL_TERMS = {
  character: "identity",
  withoutExhausting: true,
  ignores: ["patrol", "crisis"],
} as const;

/**
 * Wave 11 scripting module `jj/justice` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (11):
 * - 61015 Captain Marvel (ally)
 * - 61016 Spider-Woman (ally)
 * - 61017 Squirrel Girl (ally)
 * - 61018 Lay Down the Law (event)
 * - 61019 Strategy Session (event)
 * - 61020 Run Them to Ground (player_side_scheme)
 * - 61021 Lay the Trap (player_side_scheme)
 * - 61022 Determination (resource)
 * - 61023 Grapnel Launcher (upgrade)
 * - 61024 Entrapment (upgrade)
 * - 61036 Innate Perception (upgrade)
 *
 * Reprints, aliased to the original script (the wave 10 `hercules/basic` precedent): 61018 (12031), 61021 (41016),
 * 61022 (21052). The test checks the printed text matches.
 *
 * **61015**: the four discards are counted by printed energy icons (`milled.energy`); "more than one" is two icons.
 * **61016**: one response. The counter is placed first (to a maximum of 8), then the "you may discard" reads the
 * counters before the card leaves play. **61017**: "from your hand" is also answered by a Calling in Favors play
 * (Q102 = A); the hand is counted after Squirrel Girl has left it. **61019**: the chosen player does the searching and
 * the finding (and the deck is shuffled); the Hero Action is a thwart of a side scheme some player controls.
 * **61020** (Q101 = A): the villain phase is skipped, each player is dealt one facedown encounter card (revealed in the
 * next villain phase played) and the villain cannot take damage until that phase begins. **61023**: Restricted is the
 * keyword; the thwart is made without exhausting and ignores patrol and crisis for that use (HT9). **61024**: "change
 * to hero form and discard this card" is all cost (RRG 1.8 "Cost", pp. 13-14), paid before the damage; the damage is the threat that activation placed
 * (the scheme event's `threatPlaced` result, the amount after boost and reductions). "(attack)" is the ability's label.
 * **61036**: Starting is the keyword (HT12).
 */
export const JJ_JUSTICE: AbilityRegistry = defineAbilities({
  "61015.captain-marvel-response": response(
    after.entersPlay("self"),
    moveCards(topOfDeck(4), "discard", "milled"),
    ifThen(varAtLeast("milled.energy", 1), removeThreatFromAScheme(2)),
    ifThen(varAtLeast("milled.energy", 2), [anEnemy("confused"), confuse(chosen("confused"))]),
  ),

  "61016.spider-woman-response": response(
    after.thwarts(CHARACTER_YOU_CONTROL),
    addCounters("limb", 1, self, { upTo: 8 }),
    chooseOne(
      option(
        "Discard Spider-Woman to deal 1 damage to an enemy for each limb counter here",
        anEnemy("hit"),
        setVar("limbs", countersOn(self, "limb")),
        discard(self),
        dealDamage(varOf("limbs"), chosen("hit")),
      ),
      option("Keep Spider-Woman"),
    ),
  ),

  "61017.squirrel-girl-response": response(
    after.youPlayThisFromHand(),
    addCounters("squirrel", handCountOf(you), self, { upTo: 4 }),
  ),
  "61017.squirrel-girl-action": action({ cost: removeCounter("squirrel", 1) }, removeThreatFromAScheme(1)),

  "61018.lay-down-the-law-response": WAVE10_ABILITIES["12031.lay-down-the-law-response"]!,

  "61019.strategy-session-action": alterEgoAction(
    choosePlayer("searcher", you),
    chooseCards("found", zone("deck", chosenPlayer("searcher"), { filter: query("sideScheme") }), {
      min: 1,
      max: 1,
      chooser: chosenPlayer("searcher"),
    }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(chosenPlayer("searcher")),
  ),
  "61019.strategy-session-hero-action": heroAction(
    { label: "thwart" },
    chooseTarget("scheme", PLAYER_SIDE_SCHEME),
    thwart(3, chosen("scheme")),
  ),

  "61020.when-defeated": whenDefeated(
    skipNextVillainPhase(),
    forEachPlayer(eachPlayer, dealEncounterCard(thatPlayer)),
    applyRuleUntil({ kind: "cannotTakeDamage", target: query("villain") }, "nextVillainPhaseBegins"),
  ),

  "61021.when-defeated": WAVE10_ABILITIES["41016.when-defeated"]!,
  "61022.determination-response": WAVE10_ABILITIES["21052.determination-response"]!,

  "61023.grapnel-launcher-action": heroAction(
    { cost: discardThis, while: canUseBasicPower(["thwart"], you, GRAPNEL_TERMS) },
    basicPowerBy(you, ["thwart"], { bonus: { thw: 1 }, terms: GRAPNEL_TERMS }),
  ),

  "61024.entrapment-response": alterEgoResponse(
    on.enemySchemes(query("villain")),
    { label: "attack", cost: { ...changeFormCost("hero"), ...discardThis } },
    dealDamage(eventResult("threatPlaced"), theVillain),
  ),

  "61036.innate-perception-constant": constant(gets("thw", 1, query("hero", { controller: "you" }))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const JJ_JUSTICE_SKIPPED: Readonly<Record<string, string>> = {};
