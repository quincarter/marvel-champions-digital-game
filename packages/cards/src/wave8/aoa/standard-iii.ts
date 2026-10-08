import type { AbilityRegistry, EventPattern } from "@mc/engine";
import { discardThisObligation } from "../../core/obligations.js";
import {
  addCounters,
  type Amount,
  alterEgoAction,
  atEndOfActivation,
  boost,
  chooseTarget,
  chosen,
  countersOn,
  coveredByEngineRule,
  defineAbilities,
  discard,
  discardFromHandCost,
  each,
  eachPlayer,
  enemyActivates,
  enemyAttack,
  enemyScheme,
  exists,
  firstPlayer,
  flipCard,
  forcedResponse,
  ifThen,
  moveCards,
  named,
  on,
  perHero,
  query,
  removeEachCounterFrom,
  revealCard,
  find,
  selectCards,
  self,
  setAside,
  surge,
  theVillain,
  topOfDeck,
  totalPrintedResources,
  valueAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";

const PURSUIT = "pursuit";
/** Pursued by the Past, on whichever face shows (both print the name). */
const PURSUED = named("Pursued by the Past");
const YOUR_NEMESIS_MINION = query("minion", { nemesisMinionOf: you });
/** "Each nemesis minion in play": any player's, the nemesis minion being the one of an identity's nemesis set. */
const EACH_NEMESIS_MINION = query("minion", { nemesisMinionOf: eachPlayer });
const YOUR_UPGRADES_AND_SUPPORTS = query(["upgrade", "support"], { controller: "you" });

/** "Place 1 pursuit counter on Pursued by the Past." */
const pursuit = (n: Amount = 1) => addCounters(PURSUIT, n, PURSUED);
/** "Then, if it has any counters on it" (the Forced Response above has already resolved, §4.1 Q2). */
const itHasCounters = valueAtLeast(countersOn(PURSUED, PURSUIT), 1);
/** "[star] Boost: After this activation resolves, place 1 pursuit counter on Pursued by the Past." */
const boostPursuit = () => boost(atEndOfActivation(pursuit()));
/** "After you flip to this side" (a card of two faces: only a flip reaches the back). */
const flipsToThisSide: EventPattern = { on: "cardFlipped", selfIs: "target" };

/**
 * Pursued by the Past, side B (45075b), written but not registered. Its Forced Response answers `cardFlipped`, an event
 * that names no player, so "your" nemesis minion, side scheme and set (`you`) are unbound when it resolves and it finds
 * nothing, reveals nothing and shuffles nothing (even Core's Shadow of the Past steps find nothing here). Registered, the
 * flip to this side would do nothing at all. See `STANDARD_III_SKIPPED`.
 */
export const STANDARD_III_UNREGISTERED: AbilityRegistry = defineAbilities({
  // Forced Response: after you flip to this side, find your nemesis minion and reveal it. Search the set-aside area for
  // your nemesis side scheme and reveal it. Shuffle your remaining set-aside nemesis set into the encounter deck. Flip
  // this card over. (Each step names the nemesis set, as Core's Shadow of the Past does.)
  "45075b.pursued-by-the-past-forced-response": forcedResponse(
    flipsToThisSide,
    revealCard(find(YOUR_NEMESIS_MINION), you),
    selectCards("nemesisScheme", setAside(you, query("sideScheme", { nemesisSideSchemeOf: you }))),
    revealCard(chosen("nemesisScheme"), you),
    moveCards(setAside(you, { nemesisSetOf: you }), "encounterDeckShuffle"),
    flipCard(self),
  ),
});

/** Refs left unregistered, with the engine gap that holds each back. */
export const STANDARD_III_SKIPPED: Readonly<Record<string, string>> = {
  "45075b.pursued-by-the-past-forced-response":
    "the cardFlipped event carries no player, so `you` (whose nemesis to find) is unbound when a flip answers it; the engine would have to name the player whose effect flipped the card (docs/phase7-wave8.md §2.5 'You is the player whose card placed the counter')",
};

/**
 * Standard III (Age of Apocalypse, docs/phase7-wave8.md §2.5, §3.6, §4.1 Q2, Q3), an alternative to the Standard set.
 *
 * Pursued by the Past counts pursuit counters. "You" is the player whose card placed the counter (the one revealing
 * the treachery, the one a boost card's activation is against, the one whose turn began for Drawing Near). The
 * Forced Response resolves when the counter is placed, before the treachery's "Then" sentence (Q2 = A), so a reset
 * leaves no counters and the "Then" is false. "The number of players" is the players in the game now (Q3 = A).
 * Placing several counters at once is one placement and one check. The "remove each counter" arrow is read as the
 * first effect: it is always payable, since the Forced Response only runs with at least 3 more counters than players.
 *
 * Pursued by the Past's side B (45075b) is not registered: see `STANDARD_III_UNREGISTERED`. Side A still resets and flips;
 * today the card then stays on side B and nothing else happens.
 *
 * Cards (6):
 * - 45075a Pursued by the Past (environment)
 * - 45076 Dark Designs (treachery)
 * - 45077 Sinister Strike (treachery)
 * - 45078 Evil Alliance (treachery)
 * - 45079 Nowhere is Safe (treachery)
 * - 45080 Drawing Near (obligation)
 */
export const STANDARD_III: AbilityRegistry = defineAbilities({
  // Pursued by the Past, side A — Forced Response: after you place a pursuit counter here, if the number of counters
  // here is at least 3 more than the number of players, remove each counter here → if your nemesis minion is in play,
  // it activates against you. Otherwise, flip this card over.
  "45075a.pursued-by-the-past-forced-response": forcedResponse(
    on.countersPlaced(PURSUIT, "self"),
    ifThen(valueAtLeast(countersOn(self, PURSUIT), perHero(1, 3)), [
      removeEachCounterFrom(self, PURSUIT),
      ifThen(exists(YOUR_NEMESIS_MINION), enemyActivates(each(YOUR_NEMESIS_MINION), { against: you }), flipCard(self)),
    ]),
  ),
  // Dark Designs — When Revealed: place 1 pursuit counter on Pursued by the Past. Then, if it has any counters on it,
  // the villain schemes. [star] Boost: after this activation resolves, place 1 pursuit counter on it.
  "45076.when-revealed": whenRevealed(pursuit(), ifThen(itHasCounters, enemyScheme(theVillain))),
  "45076.boost": boostPursuit(),

  // Sinister Strike — When Revealed (Alter-Ego): place 1 pursuit counter. Then, if it has any counters, this card gains
  // surge. / When Revealed (Hero): place 1 pursuit counter. Then, if it has any counters, the villain attacks you.
  "45077.when-revealed-alter-ego": whenRevealedAlterEgo(pursuit(), ifThen(itHasCounters, surge())),
  "45077.when-revealed-hero": whenRevealedHero(
    pursuit(),
    ifThen(itHasCounters, enemyAttack(theVillain, { against: you })),
  ),

  // Evil Alliance — When Revealed: each nemesis minion in play activates against you. If no minions activated this way,
  // place 3 pursuit counters on Pursued by the Past. [star] Boost: after this activation resolves, place 1 pursuit counter.
  "45078.when-revealed": whenRevealed(
    ifThen(exists(EACH_NEMESIS_MINION), enemyActivates(each(EACH_NEMESIS_MINION), { against: you }), pursuit(3)),
  ),
  "45078.boost": boostPursuit(),

  // Nowhere is Safe — When Revealed: place 1 pursuit counter. Then, if it has any counters on it, discard an upgrade or
  // support you control. A card that cannot be discarded (a Permanent upgrade) is no target, as for Core's Caught Off Guard.
  "45079.when-revealed": whenRevealed(
    pursuit(),
    ifThen(itHasCounters, [
      chooseTarget("card", YOUR_UPGRADES_AND_SUPPORTS, { chooser: firstPlayer }),
      discard(chosen("card")),
    ]),
  ),
  "45079.boost": boostPursuit(),

  // Drawing Near — "Give to …" is not printed: it stays in the play area of the player it was dealt to (engine rule).
  "45080.obligation": coveredByEngineRule(),
  // Forced Response: after your turn begins, discard the top card of your deck. Place 1 pursuit counter on Pursued by the
  // Past for each printed resource icon on that card. (No icons: nothing is placed, so no check.)
  "45080.drawing-near-forced-response": forcedResponse(
    on.yourTurnBegins(),
    moveCards(topOfDeck(1, you), "discard", "milled"),
    ifThen(valueAtLeast(totalPrintedResources(chosen("milled")), 1), pursuit(totalPrintedResources(chosen("milled")))),
  ),
  // Alter-Ego Action: discard an identity-specific card from your hand → discard this card.
  "45080.drawing-near-action": alterEgoAction(
    { cost: discardFromHandCost(1, 1, undefined, { identitySetOf: you }) },
    discardThisObligation,
  ),
});
