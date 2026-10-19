import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  attachCard,
  boost,
  cards,
  chooseCards,
  chosen,
  confuse,
  constant,
  countAmong,
  countOf,
  defineAbilities,
  each,
  eitherCost,
  encounterCards,
  eventTarget,
  exhaustYourHero,
  forcedResponse,
  gainsKeyword,
  gets,
  giveTough,
  heroAction,
  host,
  ifThen,
  made,
  not,
  on,
  perHero,
  product,
  query,
  selectCards,
  setup,
  shuffleEncounterDeck,
  spend,
  spendResources,
  stun,
  sum,
  surge,
  theVillain,
  valueAtLeast,
  whenRevealed,
  yourIdentity,
  firstPlayer,
  self,
} from "../../../dsl/index.js";

const ART = trait("ART");
const ART_ATTACHMENT = query("attachment", { trait: ART });
/** Art attachments on the villain. */
const ART_ON_VILLAIN = query("attachment", { trait: ART, host: theVillain });
/**
 * Art attachments on an identity. An Art attachment is only ever on the villain or on a hero's identity (it attaches to
 * the villain, and its Hero Action moves it to a hero), so "not on the villain" is "on an identity". An engine reading (no
 * host-category query exists), not a printed rule.
 */
const ART_ON_AN_IDENTITY = query("attachment", { trait: ART, not: { host: theVillain } });
const ANY_ENEMY = query("enemy");
/** The character an Art attachment is attached to ("that character"). */
const CHARACTER = query("character", { hostOfSelf: true });

/**
 * "After this card attaches to a character": the card has just landed on a host. Revealed (or put into play) onto its
 * own printed host is `entersPlay`; moved there by an ability (setup, Art Thief, Tug of War, the main scheme, its own
 * Hero Action) is `cardAttached`; the two never both hear one landing (`on.cardAttached`).
 */
const afterAttaching = on.either(on.entersPlay("self"), on.cardAttached({ self: true }));

/** "Hero Action: Spend a [type] resource or exhaust your hero -> attach this card to your hero." */
const takeIt = (resource: "mental" | "wild" | "physical" | "energy") =>
  heroAction({ cost: eitherCost(spend({ [resource]: 1 }), exhaustYourHero) }, attachCard(self, yourIdentity));

/** "Move an Art attachment from an identity to the villain" (the first player picks which, when several: RRG 1.8 "First Player" p. 19, as `core/scenarios/klaw.ts`). */
const stealFromIdentity = [
  chooseCards("art", cards(each(ART_ON_AN_IDENTITY)), { min: 1, max: 1, chooser: firstPlayer }),
  attachCard(chosen("art"), theVillain),
];

/**
 * The Art Museum Heist scenario (docs/phase7-wave11-scenarios.md section S7; MC60 p. 17).
 *
 * **60121a/b Art Museum Heist**: Setup finds the set's 4 Art attachments in the encounter deck, attaches 1 at random
 * (the game's seeded RNG) to the villain and shuffles the rest back in. The stage's acceleration is X, "1 more than the
 * number of Art attachments on the villain", per hero (`printedX`, as `aos` 50067b: X per hero, base set). Forced
 * Response: after an enemy makes an undefended attack against an identity, the Art attachment on that identity is
 * attached to the villain (one only, "after each undefended attack", MC60 p. 17; the attacked identity is the
 * `eventTarget`; the first player chooses among several, RRG 1.8 "First Player" p. 19). Completing the stage loses the game (data, `completionLoses`).
 * **60122-60125 Art attachments** (Surge and the +1 SCH are data): the status card each gives "when it first attaches"
 * is a Forced Response to every attach, as the card prints it: a move to another character gives it again, to the new
 * host. Hero Action: pay the printed resource or exhaust your hero to attach it to your hero (an encounter card's
 * action any player takes). Impossible Object confuses, Replica Shield gives a tough status card, Stunning Landscape
 * stuns; Inspiring Pottery makes its host stalwart.
 * **60126 Art Thief**: When Revealed: search the encounter deck and discard pile for an Art attachment (the first player
 * picks among them, RRG 1.8 "First Player" p. 19) and attach it to the villain; if there is none, move one from an identity. The deck is
 * shuffled after the search (RRG 1.8 "Search", p. 39). Boost: move one from an identity to the villain.
 * **60127 Tug of War**: When Revealed: the revealing player may spend 3 physical resources (the spend is theirs: "you") to
 * move an Art attachment (the first player picks which, p. 19) from the villain to their identity. The spend is only
 * offered while an Art attachment is on the villain to move (RRG 1.8 "Move", p. 30: an engine reading). Otherwise (they did not, or could not) move one from an identity to the villain,
 * and this card gains surge.
 *
 * Cards (7):
 * - 60121a Art Museum Heist (main_scheme)
 * - 60122 Impossible Object (attachment)
 * - 60123 Inspiring Pottery (attachment)
 * - 60124 Replica Shield (attachment)
 * - 60125 Stunning Landscape (attachment)
 * - 60126 Art Thief (minion)
 * - 60127 Tug of War (treachery)
 */
export const FNE_SCENARIOS_ART_MUSEUM_HEIST: AbilityRegistry = defineAbilities({
  "60121a.setup": setup(
    selectCards("art", encounterCards(["deck"], ART_ATTACHMENT, { random: 1 })),
    attachCard(chosen("art"), theVillain),
    shuffleEncounterDeck(),
  ),
  "60121b.art-museum-heist-constant": constant(
    gets("acceleration", product(sum(1, countOf(ART_ON_VILLAIN)), perHero(1)), { self: true }, { setBase: true }),
  ),
  "60121b.art-museum-heist-forced-response": forcedResponse(
    { ...on.enemyAttacks(ANY_ENEMY, { undefended: true }), targetIs: query("identity") },
    chooseCards("art", cards(each(query("attachment", { trait: ART, host: eventTarget }))), {
      min: 1,
      max: 1,
      chooser: firstPlayer,
    }),
    attachCard(chosen("art"), theVillain),
  ),

  "60122.impossible-object-forced-response": forcedResponse(afterAttaching, confuse(host)),
  "60122.impossible-object-action": takeIt("mental"),

  "60123.inspiring-pottery-constant": constant(gainsKeyword({ name: "stalwart" }, CHARACTER)),
  "60123.inspiring-pottery-action": takeIt("wild"),

  "60124.replica-shield-forced-response": forcedResponse(afterAttaching, giveTough(host)),
  "60124.replica-shield-action": takeIt("physical"),

  "60125.stunning-landscape-forced-response": forcedResponse(afterAttaching, stun(host)),
  "60125.stunning-landscape-action": takeIt("energy"),

  "60126.when-revealed": whenRevealed(
    chooseCards("art", encounterCards(["deck", "discard"], ART_ATTACHMENT), {
      min: 1,
      max: 1,
      chooser: firstPlayer,
    }),
    ifThen(valueAtLeast(countAmong(chosen("art"), ART_ATTACHMENT), 1), attachCard(chosen("art"), theVillain), [
      ...stealFromIdentity,
    ]),
    shuffleEncounterDeck(),
  ),
  "60126.boost": boost(...stealFromIdentity),

  "60127.when-revealed": whenRevealed(
    ifThen(valueAtLeast(countOf(ART_ON_VILLAIN), 1), spendResources({ physical: 3 }, "paid")),
    ifThen(
      made("paid"),
      [
        chooseCards("art", cards(each(ART_ON_VILLAIN)), { min: 1, max: 1, chooser: firstPlayer }),
        attachCard(chosen("art"), yourIdentity),
      ],
      [...stealFromIdentity],
    ),
    ifThen(not(made("paid")), surge()),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_SCENARIOS_ART_MUSEUM_HEIST_SKIPPED: Readonly<Record<string, string>> = {};
