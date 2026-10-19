import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  applyRuleUntil,
  aScheme,
  atEndOfPhase,
  cards,
  chooseCards,
  chooseOne,
  chooseOneBy,
  chooseTarget,
  chosen,
  defineAbilities,
  divide,
  eachPlayer,
  exhaust,
  exists,
  forEachPlayer,
  heroAction,
  ifThen,
  inHand,
  moveCards,
  ofClassification,
  option,
  putIntoPlay,
  query,
  ready,
  reduceCostToPlay,
  self,
  shuffleDeck,
  TEAM_UP_CARD,
  teamUpCharacter,
  thatPlayer,
  thwart,
  whenDefeated,
  youHaveTrait,
  zone,
} from "../../dsl/index.js";

const DEFENDER = trait("Defender");
const CIVILIAN = trait("Civilian");
/**
 * Alliance (RRG 1.8 p. 6: "any player may contribute to paying those costs") lets the players pay an alliance card's
 * costs as a group. Whether that reaches a "→" exhaust of another player's character is not settled by a ruling; reading
 * it so, `controller: "any"` is the engine reading standing in for Alliance (authority tier 5), flagged for the owner.
 */
const EXHAUSTABLE_CIVILIAN_ALTER_EGO = query("alterEgo", { controller: "any", trait: CIVILIAN, exhausted: false });
const EXHAUSTABLE_HERO_OR_ALLY = query(["hero", "ally"], { controller: "any", exhausted: false });

/**
 * Wave 11 scripting module `jj/basic` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (5):
 * - 61025 Hellcat (ally)
 * - 61026 Joys of Life (event)
 * - 61027 Unbreakable Bond (event)
 * - 61028 Second Chance (player_side_scheme)
 * - 61029 Defend Our City (player_side_scheme)
 *
 * **61025.hellcat-constant**: "If your identity has the Defender trait, this card gains: 'Action: Put Hellcat into play
 * from your hand. At the end of the phase, discard her.'" The whole text is the gained action, so the one ref is that
 * action, active from the hand (`inHand`) and offered only while the identity has the trait (the case `gainsAbility`
 * says needs no separate granted entry). Put into play pays no cost (RRG 1.8 "Play, Put into Play", p. 32); the
 * end-of-phase discard is skipped if she has already left play.
 *
 * **61026.joys-of-life-action**: Alliance is data. Each option's "→" part comes first and is offered only while it can
 * be paid (an unexhausted Civilian alter-ego, or hero or ally); the other half is then "ready" of a chosen card.
 *
 * **61027.unbreakable-bond-action**: Team-Up and Max 1 per deck are data. "(thwart)": remove 3 threat from a scheme,
 * then heal a total of 3 divided among the Team-Up characters (Jessica Jones and Luke Cage, identity or ally).
 *
 * **61028.when-defeated**: each player in turn order may shuffle all their identity-specific cards (RRG 1.8
 * "Classifications", p. 12, any identity's) from their discard pile into their deck; a player who declines shuffles
 * nothing (RRG 1.8 "Search", p. 39).
 *
 * **61029.when-defeated**: each player in turn order may search their deck and discard pile for one Team-Up card (taking
 * none is allowed, RRG 1.8 "Search", p. 39), add it to their hand and shuffle their deck. Then, once, until the end of
 * the phase every play of a Team-Up card by any player costs 1 less, cards drawn later included (the lasting rule is
 * `reduceCostToPlay`, floored at 0, RRG 1.8 "Cost", p. 13). Prerequisite (Defender) is data (engine HT13).
 */
export const JJ_BASIC: AbilityRegistry = defineAbilities({
  "61025.hellcat-constant": inHand(
    action(
      { while: youHaveTrait(DEFENDER) },
      putIntoPlay(self),
      atEndOfPhase(ifThen(exists({ self: true }), moveCards(cards(self), "discard"))),
    ),
  ),

  "61026.joys-of-life-action": action(
    chooseOne(
      option(
        "Exhaust a Civilian alter-ego: ready a hero or ally",
        { when: exists(EXHAUSTABLE_CIVILIAN_ALTER_EGO) },
        chooseTarget("exhausted", EXHAUSTABLE_CIVILIAN_ALTER_EGO),
        exhaust(chosen("exhausted")),
        chooseTarget("readied", query(["hero", "ally"], { controller: "any" })),
        ready(chosen("readied")),
      ),
      option(
        "Exhaust a hero or ally: ready a Civilian alter-ego",
        { when: exists(EXHAUSTABLE_HERO_OR_ALLY) },
        chooseTarget("exhausted", EXHAUSTABLE_HERO_OR_ALLY),
        exhaust(chosen("exhausted")),
        chooseTarget("readied", query("alterEgo", { controller: "any", trait: CIVILIAN })),
        ready(chosen("readied")),
      ),
    ),
  ),

  "61027.unbreakable-bond-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    thwart(3, chosen("scheme")),
    divide("heal", 3, teamUpCharacter()),
  ),

  "61028.when-defeated": whenDefeated(
    forEachPlayer(
      eachPlayer,
      chooseOneBy(
        thatPlayer,
        option(
          "Shuffle your identity-specific cards from your discard pile into your deck",
          moveCards(zone("discard", thatPlayer, { filter: ofClassification("identitySpecific") }), "deckShuffle"),
        ),
        option("Do not shuffle"),
      ),
    ),
  ),

  "61029.when-defeated": whenDefeated(
    forEachPlayer(
      eachPlayer,
      chooseCards("found", zone(["deck", "discard"], thatPlayer, { filter: TEAM_UP_CARD }), {
        min: 0,
        max: 1,
        chooser: thatPlayer,
      }),
      moveCards(cards(chosen("found")), "hand"),
      shuffleDeck(thatPlayer),
    ),
    applyRuleUntil(reduceCostToPlay(TEAM_UP_CARD, 1), "endOfPhase"),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const JJ_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
