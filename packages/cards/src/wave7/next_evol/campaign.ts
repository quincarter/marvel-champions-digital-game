import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  action,
  activatingEnemy,
  addCounters,
  alterEgoAction,
  attachCard,
  bindTargets,
  boost,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  costModifier,
  coveredByEngineRule,
  defineAbilities,
  discard,
  discardFromHand,
  draw,
  each,
  eachPlayer,
  encounterSetAside,
  engage,
  excludedFromPlayerSideSchemeLimit,
  firstPlayer,
  flipCard,
  forcedResponse,
  forEachPlayer,
  gainsKeyword,
  gets,
  grantOwnedCards,
  handCountOf,
  heal,
  host,
  ifThen,
  modifyAttack,
  moveCards,
  on,
  option,
  oncePerRoundPerPlayer,
  printedCostAtLeast,
  printedCostOf,
  putIntoPlay,
  query,
  refMatches,
  removeCounter,
  selectCards,
  self,
  shuffleDeck,
  superlative,
  takeDamage,
  thatPlayer,
  treatAttachedAllyAsMinion,
  valueAtLeast,
  whenDefeated,
  whenRevealed,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

const PSIONIC = trait("PSIONIC");
const POSSESSED = trait("POSSESSED");

/** "This scheme does not count against the player side scheme limit." (40190a-40195a) */
const outOfTheSideSchemeLimit = () => constant(excludedFromPlayerSideSchemeLimit({ self: true }));
/** "Enters play with 1 [counter] counter on it." The flip into an environment is an entry into play (wave 4 §3.10). */
const entersWithCounter = (counterType: string) => forcedResponse(on.entersPlay("self"), addCounters(counterType, 1));
/** "When Defeated: Flip this card and put [the environment] into play." */
const flipsToEnvironment = () => whenDefeated(flipCard(self));

/**
 * "Each player may/must search their deck and discard pile for [a card] and put it into play": the search is the
 * player's own choice among the legal cards, then the deck is shuffled (RRG 1.8 "Search", p. 39).
 */
const searchAndPutAlly = (): EffectSpec =>
  forEachPlayer(
    eachPlayer,
    chooseCards("found", zone(["deck", "discard"], thatPlayer, { filter: query("ally", { maxPrintedCost: 3 }) }), {
      min: 0,
      max: 1,
      chooser: thatPlayer,
    }),
    putIntoPlay(chosen("found"), thatPlayer),
    shuffleDeck(thatPlayer),
  );

/**
 * An upgrade put into play is attached to a character of its controller's choice (RRG 1.8 "Upgrade", p. 45), the way
 * Superpower Training attaches the one it finds (`precon-domino-deck.ts`): `putIntoPlay` leaves an upgrade unattached.
 */
const searchAndAttachUpgrade = (): EffectSpec =>
  forEachPlayer(
    eachPlayer,
    chooseCards("found", zone(["deck", "discard"], thatPlayer, { filter: query("upgrade", { maxPrintedCost: 2 }) }), {
      min: 1,
      max: 1,
      chooser: thatPlayer,
    }),
    ifThen(refMatches(chosen("found"), query("upgrade"), { anywhere: true }), [
      chooseTarget("newHost", query(["identity", "ally"], { controlledBy: thatPlayer }), { chooser: thatPlayer }),
      attachCard(chosen("found"), chosen("newHost")),
    ]),
    shuffleDeck(thatPlayer),
  );

/** "Choose to either discard 1 resource card from your hand or take 2 damage." A choice is offered only if it can be carried out (§4.2 Q8). */
const overburdened = () =>
  chooseOne(
    option(
      "Discard 1 resource card from your hand",
      { when: valueAtLeast(handCountOf(you, query("resource")), 1) },
      discardFromHand(1, you, { filter: query("resource") }),
    ),
    option("Take 2 damage", takeDamage(2)),
  );

/** "The support you control with the highest cost": a tie is the controller's choice (RRG 1.8 "Choose", p. 12). */
const returnHighestSupport = (): EffectSpec[] => [
  bindTargets(
    "highest",
    superlative("highest", each(query("support", { controller: "you" })), printedCostOf(chosen("candidate"))),
  ),
  chooseTarget("pick", { inSlot: "highest" }),
  moveCards(cards(chosen("pick")), "hand"),
];

/** Malice's host: "the non-[PSIONIC] ally with the highest cost" among every player's allies; the first player breaks a tie (RRG p. 19). */
const MALICE_HOSTS = bindTargets(
  "highest",
  superlative("highest", each(query("ally", { withoutTrait: PSIONIC })), printedCostOf(chosen("candidate"))),
);

/**
 * Malice (40199): the printed paragraph is two abilities, a When Defeated (attach to the ally, which engages its
 * controller; ref `40199.when-defeated`) and a constant on the attached card ("Treat attached ally as a POSSESSED
 * minion ..."; ref `40199.malice-constant`, split out by the curation's `extraConstantFrom`). The engine reads
 * `treatHostAsMinion` only from a constant ability, so both are registered below.
 */
export const MALICE_WHEN_DEFEATED = whenDefeated(
  MALICE_HOSTS,
  chooseTarget("host", { inSlot: "highest" }, { chooser: firstPlayer }),
  attachCard(self, chosen("host")),
  engage(host, controllerOf(host)),
);
export const MALICE_CONSTANT = constant(
  treatAttachedAllyAsMinion([POSSESSED], { keepPrintedTraits: true, schFromThw: "current" }),
);

/**
 * The campaign cards (40190-40203), docs/phase7-wave7.md §3.43, §3.45-§3.48; MC40 pp. 6-7. Their own text only: the
 * campaign flow (which are put into play, shuffled in or set aside) is `campaigns/next_evol.ts`.
 *
 * - **The six player side schemes (40190a-40195a)**: no cost, 4 per player threat (data). The limit exemption is a
 *   constant on the scheme itself (owner ruling 2026-10-04: by its own text), and nobody controls it. Its When
 *   Defeated flips it; the environment then enters play (`flipToOtherFace`: "Enters play with" fires, the a face is
 *   gone). A permanent scheme is never defeated at 0 threat (none of these is permanent).
 * - **Environments (40190b-40195b)**: the `assembly`, `safehouse`, `pouch` and `prep` counters are an enters-play
 *   response. The Actions are any player's (December 17, 2025 - Ruling 1, answer 1); "each player" is every player in
 *   player order, whoever used it.
 * - **Team Assembled (40190b)**: each player may search for an ally of printed cost 3 or less (a dash or X cost reads
 *   as 0). The ally limit applies as for any ally put into play.
 * - **Mission Prepped (40193b)**: each player must find an upgrade of printed cost 2 or less, if the deck and discard
 *   pile hold one, and attaches it to their identity or an ally.
 * - **Geared Up (40192b) / Safehouse Established (40191b)**: the Pouches / Safehouse copies are campaign cards held in
 *   the campaign's set-aside pool (`encounterSetAside`), given to the player (ownership, `assignOwnerTo`) like Norn
 *   Stone (`wave4/mts/mts-campaign-cards.ts`). Pouches (40196) has no text.
 * - **Practiced Maneuvers (40194b), Prepared Defenses (40195b)**: constants. The +1 DEF and retaliate 1 are the hero
 *   form's only (an alter-ego is not a hero).
 * - **Safehouse (40197)**: any player may trigger the Alter-Ego Action; "your identity" and "draw" are the triggering
 *   player's (`triggerableBy`); the limit is once per round per player. The second ref is that same sentence.
 * - **Lady Mastermind (40198), Scrambler (40200), Vanisher (40201), Overburdened (40203)**: Surge is data. The revealing
 *   player is "you". A superlative reads the printed cost (a dash or X cost is 0, so no event in hand deals 0).
 * - **Under Pressure (40202)**: the boost gives the villain an additional boost card for this activation.
 * - **Malice (40199)**: see `MALICE_WHEN_DEFEATED`; its second ref is `MALICE_CONSTANT`.
 */
export const NEXT_EVOL_CAMPAIGN_CARDS: AbilityRegistry = defineAbilities({
  "40199.when-defeated": MALICE_WHEN_DEFEATED,
  "40199.malice-constant": MALICE_CONSTANT,

  "40190a.assemble-the-team-constant": outOfTheSideSchemeLimit(),
  "40190a.when-defeated": flipsToEnvironment(),
  "40190b.team-assembled-constant": entersWithCounter("assembly"),
  "40190b.team-assembled-action": action({ cost: removeCounter("assembly") }, searchAndPutAlly()),

  "40191a.establish-safehouse-constant": outOfTheSideSchemeLimit(),
  "40191a.when-defeated": flipsToEnvironment(),
  "40191b.safehouse-established-constant": entersWithCounter("safehouse"),
  "40191b.safehouse-established-action": action(
    { cost: removeCounter("safehouse") },
    selectCards("safehouse", encounterSetAside({ name: "Safehouse" }, { random: 1 })),
    grantOwnedCards(cards(chosen("safehouse")), "hand", firstPlayer),
    putIntoPlay(chosen("safehouse"), firstPlayer),
  ),

  "40192a.gear-up-constant": outOfTheSideSchemeLimit(),
  "40192a.when-defeated": flipsToEnvironment(),
  "40192b.geared-up-constant": entersWithCounter("pouch"),
  "40192b.geared-up-action": action(
    { cost: removeCounter("pouch") },
    forEachPlayer(
      eachPlayer,
      grantOwnedCards(encounterSetAside({ name: "Pouches" }, { random: 1 }), "deckShuffle", thatPlayer),
    ),
  ),

  "40193a.mission-prep-constant": outOfTheSideSchemeLimit(),
  "40193a.when-defeated": flipsToEnvironment(),
  "40193b.mission-prepped-constant": entersWithCounter("prep"),
  "40193b.mission-prepped-action": action({ cost: removeCounter("prep") }, searchAndAttachUpgrade()),

  "40194a.practice-maneuvers-constant": outOfTheSideSchemeLimit(),
  "40194a.when-defeated": flipsToEnvironment(),
  "40194b.practiced-maneuvers-constant": constant(
    costModifier({ delta: -1, appliesTo: query("event", printedCostAtLeast(3)) }),
  ),

  "40195a.prepare-defenses-constant": outOfTheSideSchemeLimit(),
  "40195a.when-defeated": flipsToEnvironment(),
  "40195b.prepared-defenses-constant": constant(
    gets("def", 1, query("hero")),
    gainsKeyword({ name: "retaliate", value: 1 }, query("hero")),
  ),

  "40197.safehouse-action": alterEgoAction(
    { triggerableBy: eachPlayer, limit: oncePerRoundPerPlayer },
    chooseOne(option("Heal 2 damage from your identity", heal(2, yourIdentity)), option("Draw 1 card", draw(1))),
  ),
  // "Any player may trigger this ability. (Limit once per round per player.)" is on the action above.
  "40197.safehouse-constant": coveredByEngineRule(),

  "40198.when-revealed": whenRevealed(
    selectCards("events", zone("hand", you, { filter: query("event") })),
    takeDamage(
      printedCostOf(superlative("highest", chosen("events"), printedCostOf(chosen("candidate")), { ties: "first" })),
    ),
  ),
  "40198.boost": boost(discardFromHand(1, you, { filter: query("event") })),

  "40200.when-revealed": whenRevealed(
    chooseTarget("upgrade", query("upgrade", { controller: "you" })),
    discard(chosen("upgrade")),
  ),

  "40201.when-revealed": whenRevealed(...returnHighestSupport()),
  "40201.boost": boost(...returnHighestSupport()),

  // "Give the villain 1 additional boost card for this activation": only a villain's activation has one to give.
  "40202.boost": boost(ifThen(refMatches(activatingEnemy, query("villain")), modifyAttack({ extraBoostCards: 1 }))),

  "40203.when-revealed": whenRevealed(overburdened()),
  "40203.boost": boost(overburdened()),
});
