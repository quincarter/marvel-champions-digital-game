import { trait } from "@mc/content";
import type { RuleSpec } from "@mc/engine";
import {
  aScheme,
  alterEgoAction,
  action,
  chooseCards,
  chooseOne,
  chosen,
  constant,
  cards,
  damageAnEnemy,
  dealDamage,
  defeatingPlayer,
  defineAbilities,
  eachPlayer,
  each,
  excludedFromAllyLimit,
  flipCard,
  forEachPlayer,
  heal,
  moveCards,
  on,
  option,
  putIntoPlay,
  query,
  removeThreat,
  response,
  rule,
  scenarioDeck,
  selectCards,
  self,
  shuffleDeck,
  spend,
  thatPlayer,
  tuckCards,
  tuckedUnder,
  whenDefeated,
  whenRevealed,
  you,
  zone,
  exhaustThis,
} from "../../dsl/index.js";

const SENTINEL = trait("SENTINEL");
const SENTINEL_MINION = query("minion", { trait: SENTINEL });
/** The scenario deck's printed name, built by the campaign's setup (`campaigns/mut_gen.ts`, docs/phase7-wave6.md §3.24). */
const FUTURE_PAST_DECK = "Future Past";

/** "Shuffle the top card of the Future Past deck into the encounter deck." An empty deck moves nothing. */
const shuffleFuturePastCard = () => moveCards(scenarioDeck(FUTURE_PAST_DECK, { top: 1 }), "encounterDeckShuffle");

/**
 * The Mutant Genesis campaign cards (`mut_gen_campaign`, 171-175, MC32 p. 4): double-sided encounter cards the campaign's
 * own setup reveals (`campaigns/mut_gen.ts`'s `revealCampaignSideScheme`). They are in no scenario's encounter sets, and
 * the campaign alone composes the `mut_gen_campaign` set, so they exist only in campaign mode, with one exception: Master
 * Mold's Setup puts Magneto (172B) into play in a standalone game too (`Scenario.setAsideCardIds`).
 *
 * Each A face's When Defeated shuffles the top card of the Future Past deck into the encounter deck, then flips (RRG 1.8
 * "Flip", p. 20; docs/phase7-wave4.md §3.10). A flip to another card type puts the new face where its type lives, under the
 * first player's control (a side scheme's When Defeated has no controller), and removes a double-sided card that later
 * leaves play from the game (RRG "Double-Sided Card", p. 17), so Metro P.D. and Magneto need no leave-play ability.
 *
 * - **Metro P.D. (171B) / Magneto (172B)**: "The first player controls ..." is `controlledByFirstPlayer`; Magneto
 *   "does not count against your ally limit". Permanent and Victory 1 are data.
 * - **Find the Prisoners (173A)**: each player's searched ally goes facedown under it. The flip to Rescue Captives is a
 *   change of card type, which discards tucked cards, and the card says to keep them: they are set aside across the flip and
 *   tucked again.
 * - **Rescue Captives (173B)**: "Any player may trigger this ability" is `triggerableBy: eachPlayer`; "you" is the
 *   triggering player (docs/phase7-wave6.md §3.11), so they defeated the Sentinel minion, spend the resource and take the ally.
 */
export const MUT_GEN_CAMPAIGN_CARDS = defineAbilities({
  // Frightened Police (171A) — When Defeated: Shuffle the top card of the Future Past deck into the encounter deck. Flip
  // this card and put Metro P.D. into play.
  "32171a.when-defeated": whenDefeated(shuffleFuturePastCard(), flipCard(self)),
  // Metro P.D. (171B) — Permanent (data). The first player controls Metro P.D.
  "32171b.metro-pd-constant": constant(rule({ kind: "controlledByFirstPlayer", target: { self: true } } as RuleSpec)),
  // Action: Exhaust Metro P.D. -> choose to either deal 1 damage to an enemy or remove 1 threat from a scheme.
  "32171b.metro-pd-action": action(
    { cost: exhaustThis },
    chooseOne(
      option("Deal 1 damage to an enemy", damageAnEnemy(1)),
      option("Remove 1 threat from a scheme", aScheme(), removeThreat(1, chosen("scheme"))),
    ),
  ),

  // Enemy of My Enemy (172A) — When Defeated: Shuffle the top card of the Future Past deck into the encounter deck. Flip
  // this card and put Magneto into play under the first player's control.
  "32172a.when-defeated": whenDefeated(shuffleFuturePastCard(), flipCard(self)),
  // Magneto (172B) — Victory 1 (data). The first player controls Magneto. He does not count against your ally limit.
  "32172b.magneto-constant": constant(
    rule({ kind: "controlledByFirstPlayer", target: { self: true } } as RuleSpec),
    excludedFromAllyLimit({ self: true }),
  ),
  // [star] Response: After Magneto attacks and defeats a SENTINEL minion, heal 1 damage from Magneto.
  "32172b.magneto-response": response(on.attacks("self", { defeats: true, target: SENTINEL_MINION }), heal(1, self)),

  // Find the Prisoners (173A) — When Revealed: Each player searches their deck for an ally and places it facedown under here.
  "32173a.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, [
      chooseCards("prisoner", zone("deck", thatPlayer, { filter: query("ally") }), {
        min: 1,
        max: 1,
        chooser: thatPlayer,
      }),
      tuckCards(cards(chosen("prisoner")), self, true),
      shuffleDeck(thatPlayer),
    ]),
  ),
  // When Defeated: Shuffle the top card of the Future Past deck into the encounter deck. Flip this card and reveal Rescue
  // Captives. (Keep facedown cards under Rescue Captives.)
  "32173a.when-defeated": whenDefeated(
    shuffleFuturePastCard(),
    selectCards("held", tuckedUnder(self)),
    moveCards(cards(chosen("held")), "setAside"),
    flipCard(self),
    tuckCards(cards(chosen("held")), self, true),
  ),
  // Rescue Captives (173B) — Response: After you defeat a Sentinel minion, spend 1 resource of any type -> choose a
  // facedown ally under this card and put it into play under your control. (Any player may trigger this ability.)
  "32173b.rescue-captives-response": response(
    on.defeated(SENTINEL_MINION, { byYou: true }),
    { cost: spend(1), triggerableBy: eachPlayer },
    chooseCards("captive", tuckedUnder(self), { min: 1, max: 1 }),
    putIntoPlay(chosen("captive"), you),
  ),

  // Surprise Attack (174A) — When Defeated: Shuffle the top card of the Future Past deck into the encounter deck. The
  // player who defeated this scheme flips this card and puts Reactivate Defenses into their play area.
  // A flip to an obligation leaves it in the villain area under nobody's control (`flipToOtherFace`'s default for a type
  // with no area of its own), so it is then put into the defeating player's play area.
  "32174a.when-defeated": whenDefeated(shuffleFuturePastCard(), flipCard(self), putIntoPlay(self, defeatingPlayer)),
  // Reactivate Defenses (174B) — Alter-Ego Action: Spend [energy][mental][physical] -> deal 5 damage to each enemy in
  // play. Remove this card from the game.
  "32174b.obligation": alterEgoAction(
    { cost: spend({ energy: 1, mental: 1, physical: 1 }) },
    dealDamage(5, each(query("enemy"))),
    moveCards(cards(self), "removedFromGame"),
  ),

  // Magneto's Fortress (175A) — When Defeated: Shuffle the top card of the Future Past deck into the encounter deck. Flip
  // this card. (Magneto's Power, 175B, is data: +1 SCH and +1 ATK, Attach to Magneto, Permanent.)
  "32175a.when-defeated": whenDefeated(shuffleFuturePastCard(), flipCard(self)),
});
