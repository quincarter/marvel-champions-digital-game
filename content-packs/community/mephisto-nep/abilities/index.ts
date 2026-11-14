/**
 * Mephisto scenario pack (mephisto-nep), by Neptune (Typhon00): every ability of the pack, each modeled on the
 * base-game card or DSL builder named in its comment. The pack's printed text is the authority
 * (docs/custom-content-packs.md section 6), then the RRG (v1.8) and FFG rulings for what the text does not override.
 *
 * Shared pieces:
 * - Damnation is the scenario area of that name (`createScenarioArea` in 1A's Setup). Cards go in facedown from the top
 *   of a deck (`moveCards(..., { scenarioArea }, undefined, { facedown: true })`) and keep their owner, so "shuffle it
 *   back into its owner's deck" is `"deckShuffle"`. "Look at N cards in Damnation" is a blind random pick
 *   (`scenarioArea(..., { random })`), the author's open question answered by default.
 * - Hidden Clause is a tagged special on each stage of the main scheme (`tagged("hiddenClause", ...)`), resolved by the
 *   stage's own Forced Response and by the encounter cards that name it (`resolveTagged`).
 * - Every Bargain attachment has no `attachesTo` in its record: its own When Revealed attaches it to your identity (the
 *   "you may" and the penalty), so the reveal's attach step does not decide for the player (RRG "Reveal", p. 38).
 */
import {
  action,
  activatingEnemy,
  activationIs,
  addAccelerationToken,
  addCounters,
  adjustBoostCount,
  after,
  allOf,
  attachCard,
  atEndOfActivation,
  attacksGainKeywords,
  blanksTextBox,
  boost,
  cancelBoostedActivation,
  cancelIt,
  cannotLeavePlay,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countOf,
  countersOn,
  createScenarioArea,
  dealEncounterCard,
  dealIndirectDamage,
  definePackAbilities,
  discard,
  discardDeckUntil,
  discardEncounterUntil,
  discardFromHand,
  discardThis,
  doubleStat,
  draw,
  drawUpTo,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  endGame,
  enemyActivates,
  enemyAttack,
  enemyScheme,
  engage,
  eventPlayer,
  eventSource,
  eventAmount,
  eventTarget,
  exhaustCardsCost,
  exists,
  findCard,
  firstPlayer,
  flipCard,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsIcon,
  gainsKeyword,
  gainsKeywordX,
  gainsTrait,
  gets,
  giveTough,
  handCountOf,
  handSizeOf,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  identityOf,
  ifThen,
  ignores,
  instead,
  interrupt,
  isAlterEgo,
  isHero,
  lookAtAndRearrange,
  modifyAttack,
  modifyBasicPower,
  moveCards,
  named,
  not,
  preventDamage,
  on,
  option,
  placeCountersCost,
  placeThreat,
  product,
  putIntoPlay,
  putIntoPlayFacedown,
  query,
  ready,
  reduceDamage,
  refCount,
  refMatches,
  removeStatus,
  repeatTimes,
  resetHitPoints,
  resolveTagged,
  resolveWhenRevealedOf,
  response,
  resourcesGeneratedAsWild,
  revealCard,
  rule,
  scaled,
  scenarioArea,
  scenarioAreaCount,
  selectCards,
  self,
  setAsideDestination,
  shuffleEncounterDeck,
  spend,
  stateCheck,
  statOf,
  surge,
  tagged,
  theMainScheme,
  theVillain,
  thatPlayer,
  threatOn,
  topOfDeck,
  treatAttachedAllyAsMinion,
  valueAtLeast,
  valueEquals,
  varAtLeast,
  varOf,
  whenDefeated,
  whenRevealed,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  alterEgoInterrupt,
  basicPowerIs,
  controllerOf,
  chooseTargetCost,
  hasStatus,
  perHero,
  setup,
  zone,
} from "@mc/mod-sdk";

// The content package's `trait()` is not part of the SDK; a trait is its upper-cased name (as the Carnage pack does).
type Trait = NonNullable<NonNullable<Parameters<typeof query>[1]>["trait"]>;
const trait = (name: string): Trait => name.toUpperCase() as Trait;
const BARGAIN = trait("Bargain");
const MYSTIC = trait("Mystic");
const ELITE = trait("Elite");

const DAMNATION = "Damnation";
/** The area a Bargain attachment's player pays into: "put N cards from the top of your deck facedown into Damnation". */
const intoDamnation = (n: Parameters<typeof topOfDeck>[0], player: Parameters<typeof topOfDeck>[1] = you) =>
  moveCards(topOfDeck(n, player), { scenarioArea: DAMNATION }, undefined, { facedown: true });
/** "Look at N card(s) in Damnation and shuffle each back into its owner's deck": a blind random pick (author's default). */
const lookAndShuffleBack = (n: Parameters<typeof topOfDeck>[0]) =>
  moveCards(scenarioArea(DAMNATION, undefined, { random: n }), "deckShuffle");

/** A Bargain attachment: on the identity of `player`, which is what "you control" means for an attachment on it. */
const bargainOf = (player: Parameters<typeof identityOf>[0]) =>
  query("attachment", { trait: BARGAIN, host: identityOf(player) });
/** "For each Bargain attachment in play". */
const BARGAINS_IN_PLAY = countOf(query("attachment", { trait: BARGAIN }));

/** "Resolve the 'Hidden Clause' ability on the main scheme" (for "you": the resolving player). */
const HIDDEN_CLAUSE = resolveTagged("hiddenClause", { cards: query("mainScheme") });
const MYSTIC_FACEDOWN = query("minion", { trait: MYSTIC, facedown: true });
const FACEDOWN_MYSTIC_ENGAGED = query("minion", { trait: MYSTIC, facedown: true, engagedWith: "any" });
const AS_MYSTIC = { kind: "minion", traits: [MYSTIC] } as const;
const CALL_OF_THE_DEMONESS = query("sideScheme", { name: "Call of the Demoness" });
const BLACKHEART = query("minion", { name: "Blackheart" });
const LILITH = query("minion", { name: "Lilith" });

/**
 * A Bargain's When Revealed (the 7 sins, Black-Hearted, the Corruptive Offers, Lilin Remaking): "You may attach this
 * card to your identity. If you do not, discard this card and [the villain] activates against you." The attachment has no
 * data host, so the reveal leaves it in front of the revealing player until this attaches it. `activator` is Mephisto by
 * name on the 7 sins and Blackheart-less "the villain" elsewhere; with one villain at a time both are the active villain.
 */
const bargainWhenRevealed = () =>
  whenRevealed(
    chooseOne(
      option("Attach this card to your identity", attachCard(self, yourIdentity)),
      option(
        "Do not attach it: discard it and the villain activates against you",
        moveCards(cards(self), "discard"),
        enemyActivates(theVillain, { against: you }),
      ),
    ),
  );

/**
 * "Response: After your turn begins, discard this card -> [the villain] activates against you. Apply this card's boost
 * icons for this activation as if it were a boost card." (the 7 sins). `enemyActivates.boostCards` is the engine's
 * primitive for it (`engine-only.activation-boost-card`).
 */
const bargainDiscardResponse = () =>
  response(on.yourTurnBegins(), { cost: discardThis }, enemyActivates(theVillain, { against: you, boostCards: self }));

/**
 * The Corruptive Offers' printed "Response: Discard this card -> set-aside X[per_hero] cards from the top of your deck
 * facedown, where X is equal to the number of corrupt counters here." has no triggering condition on the card. Read as
 * the Bargain family's (the insert: "Bargain can be discarded at the start of your turn"): after your turn begins.
 * Author ruling, 2026-11-13 (Neptune): "After your turn begins", no exhaust cost, as built. Set aside goes through `"setAside"`, which Gateway to
 * Corruption's rule turns into Damnation (facedown); outside that scenario they are set aside as printed. The discard is
 * the last effect, not a cost: a discarded card's counters are gone, and X reads them here.
 */
const corruptDiscardResponse = () =>
  response(
    on.yourTurnBegins(),
    moveCards(topOfDeck(product(countersOn(self, "corrupt"), perHero(1))), "setAside"),
    discard(self),
  );

/** The Bargain attachments on the identity of the player who owns the card dealing the damage (Hell Lord). */
const SOURCE_BARGAINS = countOf(query("attachment", { trait: BARGAIN, host: identityOf(controllerOf(eventSource)) }));

/** "Shuffle each Bargain attachment from the encounter discard pile into the encounter deck." */
const shuffleBargainsBack = () =>
  moveCards(encounterCards(["discard"], query("attachment", { trait: BARGAIN })), "encounterDeckShuffle");

/** "If there are 10[per_hero] cards in Damnation, the players lose the game." (`stateCheck` + `endGame`.) */
const damnationLoss = () => stateCheck(valueAtLeast(scenarioAreaCount(DAMNATION), perHero(10)), endGame("loss"));

/**
 * "At the end of your turn, resolve the 'Hidden Clause' ability for each Bargain attachment you control." `turnEnding`
 * is the engine's "your turn ends" (Medical Emergency, `trors` 04164); on an encounter card its `playerIs: "controller"`
 * matches the player whose turn ends, who is "you".
 */
const hiddenClauseEachBargain = () =>
  forcedResponse({ on: "turnEnding", playerIs: "controller" }, repeatTimes(countOf(bargainOf(you)), HIDDEN_CLAUSE));

/**
 * Devil's Pacts: "When Mephisto would activate against you, if you control a Bargain attachment, Mephisto does not
 * activate and heals N[per_hero] damage instead. If no damage was healed this way, place 1 threat on the main scheme for
 * each Bargain attachment in play." A forced interrupt to `enemyActivating` (docs/phase7-wave5.md section 3.2; Shifting
 * Corridors, Shadowland 65037, is the shape), the player activated against being the event's player. "No damage healed"
 * reads `healed.amount` as Rhino's Hard to Keep Down (01104).
 */
// Author ruling, 2026-11-13 (Neptune): it catches EVERY activation against you, as printed (intended), as built.
const devilsPacts = (n: number) =>
  forcedInterrupt(
    on.enemyActivating("self"),
    ifThen(
      exists(bargainOf(eventPlayer)),
      instead(
        heal(perHero(n), self, { bind: "healed" }),
        ifThen(not(varAtLeast("healed.amount")), placeThreat(BARGAINS_IN_PLAY, theMainScheme)),
      ),
    ),
  );

export default definePackAbilities({
  // =========================================================================
  // 01 Mephisto (villain)
  // =========================================================================

  // Devil's Pacts (I, II, III): "When Mephisto would activate against you, if you control a Bargain attachment, Mephisto
  // does not activate and heals N[per_hero] damage instead. If no damage was healed this way, place 1 threat on the
  // main scheme for each Bargain attachment in play." A forced interrupt to `enemyActivating` (docs/phase7-wave5.md
  // §3.2; Shifting Corridors, Shadowland 65037, is the shape) with the replacement conditional on the activated-against
  // player's Bargain. "No damage healed" reads `healed.amount` as Rhino's Hard to Keep Down (01104).
  "x.mephisto-nep.01.devils-pacts-i": devilsPacts(1),
  "x.mephisto-nep.01.devils-pacts-ii": devilsPacts(2),
  "x.mephisto-nep.01.devils-pacts-iii": devilsPacts(3),

  // When Revealed (II): "Find and attach the Hell Lord attachment to Mephisto." The Hell Lord is set aside by the
  // scenario (`setAsideCardIds`), so it is found there. Read in every mode as printed (author's open question).
  // Author ruling, 2026-11-13 (Neptune): Hell Lord arrives in every mode, as the card says (his insert is outdated).
  "x.mephisto-nep.01.when-revealed-ii": whenRevealed(
    selectCards("hellLord", encounterSetAside(query("attachment", { name: "Hell Lord" }))),
    attachCard(chosen("hellLord"), theVillain),
  ),

  // =========================================================================
  // 02a Battle for the Soul (main scheme)
  // =========================================================================

  // 1A Setup: "Create the 'Damnation' game area." The Hell Lord is set aside by the scenario record and the Gateway
  // enters play through its Setup keyword; only the area is left.
  "x.mephisto-nep.02a.setup": setup(createScenarioArea(DAMNATION)),

  // Stage 1B / 2B / 3B Forced Response: "At the end of your turn, resolve the 'Hidden Clause' ability for each Bargain
  // attachment you control." `turnEnding` is the engine's "your turn ends" (Medical Emergency, `trors` 04164); on an
  // encounter card "you" is the player whose turn ends. One resolution per Bargain attachment they control.
  "x.mephisto-nep.02a.forced-response": hiddenClauseEachBargain(),
  "x.mephisto-nep.02a.forced-response-2": hiddenClauseEachBargain(),
  "x.mephisto-nep.02a.forced-response-3": hiddenClauseEachBargain(),
  // Hidden Clause: N[per_hero] cards from the top of the resolving player's deck, facedown, into Damnation.
  "x.mephisto-nep.02a.hidden-clause": tagged("hiddenClause", intoDamnation(perHero(1))),
  "x.mephisto-nep.02a.hidden-clause-2": tagged("hiddenClause", intoDamnation(perHero(2))),
  "x.mephisto-nep.02a.hidden-clause-3": tagged("hiddenClause", intoDamnation(perHero(3))),

  // 2A When Revealed: "Shuffle each Bargain attachment from the encounter discard pile into the encounter deck. In player
  // order, each player must search the encounter deck for a Bargain attachment and reveal it. (Shuffle.)"
  "x.mephisto-nep.02a.when-revealed-2": whenRevealed(
    shuffleBargainsBack(),
    forEachPlayer(
      eachPlayer,
      chooseCards("found", encounterCards(["deck"], query("attachment", { trait: BARGAIN })), {
        min: 1,
        max: 1,
        chooser: thatPlayer,
      }),
      revealCard(chosen("found"), thatPlayer),
    ),
    shuffleEncounterDeck(),
  ),

  // 3A When Revealed: shuffle the Bargains back, then "Flip the Gateway to Corruption environment to reveal the Hell
  // environment."
  "x.mephisto-nep.02a.when-revealed-3": whenRevealed(shuffleBargainsBack(), flipCard(named("Gateway to Corruption"))),

  // 3B: "If there is no threat here, the players win the game." (Risky Business / Protection Racket: `stateCheck` +
  // `endGame`.) "If this stage is completed, the players lose the game" is data (`completionLoses`).
  "x.mephisto-nep.02a.win-condition": stateCheck(valueEquals(threatOn(theMainScheme), 0), endGame("win")),

  // =========================================================================
  // 03 Gateway to Corruption / Hell (environment)
  // =========================================================================

  // Forced Interrupt: "When a card is set aside from a player's deck, put it facedown into Damnation instead."
  // (`setAsideDestination`; a replacement of the set-aside, which moves nothing else.)
  "x.mephisto-nep.03a.forced-interrupt": constant(setAsideDestination(DAMNATION, { facedown: true, from: ["deck"] })),
  "x.mephisto-nep.03b.forced-interrupt": constant(setAsideDestination(DAMNATION, { facedown: true, from: ["deck"] })),
  // "If there are 10[per_hero] cards in Damnation, the players lose the game."
  "x.mephisto-nep.03a.damnation-loss": damnationLoss(),
  "x.mephisto-nep.03b.damnation-loss": damnationLoss(),
  // Hell, [star] Forced Response: "At the end of the round (after the first player token is passed), place 1
  // acceleration token here." The round ends after step 5 passes the token (RRG "Villain Phase", p. 47). RRG "Acceleration
  // Token" (p. 5): a token on an environment adds threat to the main scheme in step 1.
  "x.mephisto-nep.03b.forced-response": forcedResponse(on.roundEnding(), addAccelerationToken(self)),

  // =========================================================================
  // 04 Hell Lord (attachment, attached to Mephisto)
  // =========================================================================

  // "Reduce the amount of damage Mephisto takes from identities by 1 for each Bargain attachment they control." A
  // forced interrupt to the damage about to be dealt (before a tough status card, `wouldBeDealt`), one per source
  // identity: the identity of the player who owns the damaging card, and the Bargains hosted on it.
  "x.mephisto-nep.04.hell-lord-constant": forcedInterrupt(
    {
      on: "dealDamage",
      targetIs: { hostOfSelf: true },
      sourceIs: { categories: ["identity", "event", "resource", "upgrade"] },
    },
    { wouldBeDealt: true },
    ifThen(valueAtLeast(SOURCE_BARGAINS, 1), reduceDamage(SOURCE_BARGAINS)),
  ),
  // Forced Response: "After an identity with a Bargain attachment attacks Mephisto, for each Bargain attachment they
  // control, look at 1 card in Damnation -> shuffle each card looked at this way back into its owner's deck."
  "x.mephisto-nep.04.forced-response": forcedResponse(
    on.attacks(query("identity", { hasAttachment: query("attachment", { trait: BARGAIN }) }), {
      target: { hostOfSelf: true },
    }),
    repeatTimes(countOf(query("attachment", { trait: BARGAIN, host: eventSource })), lookAndShuffleBack(1)),
  ),

  // =========================================================================
  // 05-11 The seven Bargain sins (attachments)
  // =========================================================================

  "x.mephisto-nep.05.when-revealed": bargainWhenRevealed(),
  "x.mephisto-nep.05.endless-greed-constant": constant(gets("handSize", 2, { hostOfSelf: true })),
  "x.mephisto-nep.05.response": bargainDiscardResponse(),

  "x.mephisto-nep.06.when-revealed": bargainWhenRevealed(),
  // Alter-Ego Interrupt: "When you make a basic recovery, restore your identity to its printed hit point value and you
  // may discard any number of status cards from it." (`resetHitPoints`: Death Factor's basic-recovery window,
  // `on.basicRecovery`.) The status cards are a "may" each.
  "x.mephisto-nep.06.alter-ego-interrupt": alterEgoInterrupt(
    on.basicRecovery(YOUR_IDENTITY),
    resetHitPoints(yourIdentity),
    ...(["stunned", "confused", "tough"] as const).map((status) =>
      ifThen(
        hasStatus(yourIdentity, status),
        chooseOne(
          option(`Discard your ${status} status card`, removeStatus(yourIdentity, status)),
          option(`Keep your ${status} status card`),
        ),
      ),
    ),
  ),
  "x.mephisto-nep.06.response": bargainDiscardResponse(),

  "x.mephisto-nep.07.when-revealed": bargainWhenRevealed(),
  // Action: "Exhaust an identity-specific card you control -> ready your identity." (Classification: RRG "Classifications",
  // p. 12.) The card may be any card in play of yours, the identity included.
  "x.mephisto-nep.07.action": action(
    {
      cost: exhaustCardsCost(
        query(["identity", "ally", "upgrade", "support"], { controller: "you", classification: "identitySpecific" }),
      ),
    },
    ready(yourIdentity),
  ),
  "x.mephisto-nep.07.response": bargainDiscardResponse(),

  "x.mephisto-nep.08.when-revealed": bargainWhenRevealed(),
  // "Your identity ignores the patrol keyword and any crisis icons in play. Double the THW value of your identity."
  // Precedent: Evasive Maneuvering (`nebu` 22005) and `multiplyStat` (RRG "Modifiers", p. 29: doubled after additions).
  "x.mephisto-nep.08.prideful-ambitions-constant": constant(
    ignores({ hostOfSelf: true }, ["patrol", "crisis"]),
    doubleStat("thw", { hostOfSelf: true }),
  ),
  "x.mephisto-nep.08.response": bargainDiscardResponse(),

  "x.mephisto-nep.09.when-revealed": bargainWhenRevealed(),
  // "Your identity's attacks gain overkill. Double the ATK value of your identity."
  "x.mephisto-nep.09.shackled-wrath-constant": constant(
    attacksGainKeywords(["overkill"], { attacker: { hostOfSelf: true } }),
    doubleStat("atk", { hostOfSelf: true }),
  ),
  "x.mephisto-nep.09.response": bargainDiscardResponse(),

  "x.mephisto-nep.10.when-revealed": bargainWhenRevealed(),
  // "Your identity cannot take damage less than its DEF from each attack. Double the DEF value of your identity."
  // Author ruling, 2026-11-13 (Neptune): "attacks that would deal less than that DEF deal no damage (all prevented)".
  // This replaces the engine's `minDamageTaken` floor (which raised such damage UP to the DEF, 1.0.x/1.1.0). Read as
  // a forced interrupt to the attack's damage, before a tough status card (`wouldBeDealt`), over the amount about to
  // be dealt: damage of at least the doubled DEF goes through as it is, any smaller (positive) damage is prevented in
  // full. Damage that is not an attack's (a treachery's) is not touched.
  // TODO(engine): the rule is a constant of the card in the printed text; as a trigger it reads the pending amount
  // (before later damage modifiers), where a `RuleSpec` threshold (a `minDamageTaken` variant that prevents instead of
  // raises, read after every modifier like the floor) would read the final amount. Say so to game-rules-architect if
  // the two ever differ in play.
  "x.mephisto-nep.10.slothful-endurance-forced-interrupt": forcedInterrupt(
    on.damage({ hostOfSelf: true }, { fromAttack: true }),
    { wouldBeDealt: true },
    ifThen(
      allOf(valueAtLeast(eventAmount, 1), not(valueAtLeast(eventAmount, statOf(eventTarget, "def")))),
      preventDamage(),
    ),
  ),
  "x.mephisto-nep.10.slothful-endurance-constant": constant(doubleStat("def", { hostOfSelf: true })),
  "x.mephisto-nep.10.response": bargainDiscardResponse(),

  "x.mephisto-nep.11.when-revealed": bargainWhenRevealed(),
  // "Each resource you generate is considered a wild resource instead of its current resource."
  "x.mephisto-nep.11.unquenchable-envy-constant": constant(resourcesGeneratedAsWild(you)),
  "x.mephisto-nep.11.response": bargainDiscardResponse(),

  // =========================================================================
  // 12-15 Side schemes
  // =========================================================================

  // Aid the Condemned. When Defeated: "Each player looks at 1[per_hero] card in Damnation and shuffles it back into
  // their owner's deck." Hinder 2[per_hero] and crisis are data.
  "x.mephisto-nep.12.when-defeated": whenDefeated(forEachPlayer(eachPlayer, lookAndShuffleBack(perHero(1)))),

  // Culling the Damned. "Forced Interrupt: After a Mystic minion is defeated, place one scorned counter here." "After" is
  // a response timing; read as a Forced Response (printed "Forced Interrupt: After", flagged in TRANSCRIPTION.md).
  "x.mephisto-nep.13.forced-interrupt": forcedResponse(
    on.defeated(query("minion", { trait: MYSTIC })),
    addCounters("scorned", 1),
  ),
  // When Defeated: "The player who defeated this side scheme looks at X cards in Damnation, where X is equal to the
  // number of scorned counters here. Shuffle each card looked at this way back into its owner's deck."
  "x.mephisto-nep.13.when-defeated": whenDefeated(lookAndShuffleBack(countersOn(self, "scorned"))),

  // Author ruling, 2026-11-13 (Neptune): the extra card does not retrigger it (`notFromSelf`), as built.
  // Exposing Intentions. "Forced Interrupt: When a card is put into Damnation from a player's deck, put 1 additional card
  // into Damnation from that player's deck." The engine announces `cardPutIntoScenarioArea` once the card has moved, so
  // it is heard as a forced response; `notFromSelf` keeps the additional card from chaining.
  "x.mephisto-nep.14.forced-interrupt": forcedResponse(
    on.cardPutIntoScenarioArea(DAMNATION, { from: "deck", notFromSelf: true }),
    intoDamnation(1, eventPlayer),
  ),
  // When Defeated: "Each player looks at each card in Damnation, then shuffles 1[per_hero] card looked at this way back
  // into their owner's deck. Shuffle the Damnation area." Each pass the player sees the cards and picks one. The area is
  // facedown and picked by identity, so "shuffle the Damnation area" has nothing to reorder.
  "x.mephisto-nep.14.when-defeated": whenDefeated(
    forEachPlayer(
      eachPlayer,
      repeatTimes(
        perHero(1),
        chooseCards("back", scenarioArea(DAMNATION), { min: 1, max: 1, chooser: thatPlayer }),
        moveCards(cards(chosen("back")), "deckShuffle"),
      ),
    ),
  ),

  // Author ruling, 2026-11-13 (Neptune): 6 threat per 6 cards in Damnation, as printed (a 666 pun), as built.
  // Hotel Inferno. When Revealed: "Place 6 threat on the main scheme for every 6 cards in Damnation."
  "x.mephisto-nep.15.when-revealed": whenRevealed(
    placeThreat(scaled(scenarioAreaCount(DAMNATION), { divide: { by: 6, round: "down" }, times: 6 }), theMainScheme),
  ),
  // When Defeated: "looks at up to 6 cards in Damnation. Shuffle each card looked at this way back": always the 6 (a blind
  // pick has nothing to gain from fewer).
  "x.mephisto-nep.15.when-defeated": whenDefeated(lookAndShuffleBack(6)),

  // =========================================================================
  // 16-21 Treacheries
  // =========================================================================

  // Alter the Deal. "Shuffle each Bargain attachment you control into the encounter deck. For each Bargain attachment
  // shuffled this way, resolve the 'Hidden Clause' ability on the main scheme. Then, discard cards from the top of the
  // encounter deck until a Bargain attachment is discarded. Attach that card to your identity. Otherwise, shuffle this
  // card into the encounter deck."
  // Author ruling, 2026-11-13 (Neptune): "Otherwise" is "if you do not control a Bargain attachment": the card then just
  // shuffles itself back into the encounter deck (no search). With a Bargain attachment the whole text resolves, and the
  // search always finds one (the one shuffled in at least), so no other fallback is printed.
  "x.mephisto-nep.16.when-revealed": whenRevealed(
    ifThen(
      exists(bargainOf(you)),
      [
        selectCards("mine", cards(each(bargainOf(you)))),
        moveCards(cards(chosen("mine")), "encounterDeckShuffle", "shuffled"),
        repeatTimes(varOf("shuffled.count"), HIDDEN_CLAUSE),
        discardEncounterUntil(query("attachment", { trait: BARGAIN }), "found"),
        attachCard(chosen("found"), yourIdentity),
      ],
      moveCards(cards(self), "encounterDeckShuffle"),
    ),
  ),

  // Dark Compulsions. "Each player resolves the 'Hidden Clause' ability on the main scheme if they control a Bargain
  // attachment. If no player controls a Bargain attachment, you may look at 1[per_hero] card in Damnation and shuffle it
  // back into its owner's deck."
  "x.mephisto-nep.17.when-revealed": whenRevealed(
    ifThen(
      exists(query("attachment", { trait: BARGAIN })),
      forEachPlayer(
        eachPlayer,
        ifThen(
          exists(bargainOf(thatPlayer)),
          resolveTagged("hiddenClause", { cards: query("mainScheme"), player: thatPlayer }),
        ),
      ),
      chooseOne(
        option("Look at the cards in Damnation and shuffle them back", lookAndShuffleBack(perHero(1))),
        option("Do not look"),
      ),
    ),
  ),
  // [star] Boost: "This card gains boost icons equal to the number of Bargain attachments in play."
  "x.mephisto-nep.17.boost": boost(adjustBoostCount(BARGAINS_IN_PLAY)),

  // Demonic Fury. Peril. "Choose: Search the encounter deck and discard pile for a Bargain attachment. Attach it to your
  // identity. / Mephisto attacks you. Give him an additional boost card for this activation. This attack gains overkill
  // and piercing."
  "x.mephisto-nep.18.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Search for a Bargain attachment and attach it to your identity",
        chooseCards("found", encounterCards(["deck", "discard"], query("attachment", { trait: BARGAIN })), {
          min: 1,
          max: 1,
        }),
        attachCard(chosen("found"), yourIdentity),
        shuffleEncounterDeck(),
      ),
      option(
        "Mephisto attacks you with an additional boost card, overkill and piercing",
        enemyAttack(theVillain, { against: you, extraBoostCards: 1, keywords: ["overkill", "piercing"] }),
      ),
    ),
  ),

  // Infernal Temper. "(Alter-Ego) Mephisto schemes with +X SCH ... (Hero) Mephisto attacks you with +X ATK, where X is
  // equal to the number of Bargain attachments in play."
  "x.mephisto-nep.19.when-revealed-alter-ego": whenRevealed(
    ifThen(isAlterEgo(), enemyScheme(theVillain, { against: you, schBonus: BARGAINS_IN_PLAY })),
  ),
  "x.mephisto-nep.19.when-revealed-hero": whenRevealed(
    ifThen(isHero(), enemyAttack(theVillain, { against: you, atkBonus: BARGAINS_IN_PLAY })),
  ),

  // Meager Request. "You may ready your identity, draw 1 card, and heal 4 damage from your identity. If you do, resolve the
  // 'Hidden Clause' ability on the main scheme. Otherwise, this card gains surge."
  "x.mephisto-nep.20.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Ready your identity, draw 1 card and heal 4 damage; resolve Hidden Clause",
        ready(yourIdentity),
        draw(1),
        heal(4, yourIdentity),
        HIDDEN_CLAUSE,
      ),
      option("Decline: this card gains surge", surge()),
    ),
  ),
  // [star] Boost: "After this activation, discard cards from the top of the encounter deck until a Bargain attachment is
  // discarded. Reveal that card."
  "x.mephisto-nep.20.boost": boost(
    atEndOfActivation(
      discardEncounterUntil(query("attachment", { trait: BARGAIN }), "found"),
      revealCard(chosen("found"), you),
    ),
  ),

  // Rewrite History. Peril. "Choose: Discard your hand, shuffle your discard pile into your deck, draw up to your hand
  // size, and ready your identity. Search the encounter deck and discard pile for a Bargain attachment. Attach it to your
  // identity. / Mephisto schemes against you. Give him 2 additional boost cards for this activation."
  "x.mephisto-nep.21.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Reset your hand and deck, ready your identity and attach a Bargain attachment",
        discardFromHand(handCountOf()),
        moveCards(zone("discard", you), "deckShuffle"),
        drawUpTo(handSizeOf()),
        ready(yourIdentity),
        chooseCards("found", encounterCards(["deck", "discard"], query("attachment", { trait: BARGAIN })), {
          min: 1,
          max: 1,
        }),
        attachCard(chosen("found"), yourIdentity),
        shuffleEncounterDeck(),
      ),
      option(
        "Mephisto schemes against you with 2 additional boost cards",
        enemyScheme(theVillain, { against: you, extraBoostCards: 2 }),
      ),
    ),
  ),

  // =========================================================================
  // 22-25 Blackheart
  // =========================================================================

  // Blackheart (minion). Toughness. Villainous (data). Action: "Discard a Bargain attachment you control -> heal 3 damage
  // from Blackheart. If no damage was healed this way, give him a tough status card." An encounter attachment on your
  // identity is controlled by no player (RRG "Attachment", p. 8), so a cost that discards "a card you control" could never
  // be paid with it: the pick is the cost (`chooseTargetCost`) and the discard its first effect.
  "x.mephisto-nep.22.action": action(
    { cost: chooseTargetCost(bargainOf(you), "sacrifice") },
    discard(chosen("sacrifice")),
    heal(3, self, { bind: "healed" }),
    ifThen(not(varAtLeast("healed.amount")), giveTough(self)),
  ),
  // [star] Boost: "You may discard a Bargain attachment to cancel this activation. If you do, put Blackheart into play
  // engaged with you."
  // A Boost ability has no triggering event, so "cancel this activation" is `cancelBoostedActivation()`: the attack or
  // scheme Blackheart is a boost card for ends once this ability has resolved, with no damage or threat, its other boost
  // cards discarded unturned, and no "after ... attacks / schemes" responses (RRG 1.8 "Cancel", p. 11). Blackheart has
  // left the boost area by then, so he is not discarded with them.
  "x.mephisto-nep.22.boost": boost(
    ifThen(
      exists(bargainOf(you)),
      chooseOne(
        option(
          "Discard a Bargain attachment: cancel this activation and put Blackheart into play engaged with you",
          chooseTarget("sacrifice", bargainOf(you)),
          discard(chosen("sacrifice")),
          cancelBoostedActivation(),
          putIntoPlay(self, you),
        ),
        option("Do not discard"),
      ),
    ),
  ),

  // Prince's Offer (side scheme). Incite 1 (data). When Defeated: "Each player may shuffle 1 Bargain attachment they control
  // into the encounter deck. The player who defeated this scheme finds the Black-Hearted attachment and reveals it."
  "x.mephisto-nep.23.when-defeated": whenDefeated(
    forEachPlayer(
      eachPlayer,
      chooseCards("offered", cards(each(bargainOf(thatPlayer))), { min: 0, max: 1, chooser: thatPlayer }),
      moveCards(cards(chosen("offered")), "encounterDeckShuffle"),
    ),
    findCard(query("attachment", { name: "Black-Hearted" }), "reveal"),
  ),

  // Black-Hearted (attachment).
  "x.mephisto-nep.24.when-revealed": bargainWhenRevealed(),
  // Interrupt: "When the villain phase begins, if this is the only Bargain attachment you control, look at the top 3 cards
  // of the encounter deck. Put them back in any order."
  "x.mephisto-nep.24.interrupt": interrupt(
    on.phaseBeginning("villain"),
    { while: valueEquals(countOf(bargainOf(you)), 1) },
    lookAtAndRearrange(encounterCards(["deck"], undefined, 3)),
  ),
  // Response: "After your turn begins, discard this card -> find Blackheart and reveal him. (If he is already in play, he
  // engages you.) Blackheart activates against you."
  "x.mephisto-nep.24.response": response(
    on.yourTurnBegins(),
    { cost: discardThis },
    findCard(BLACKHEART, "reveal"),
    enemyActivates(each(BLACKHEART), { against: you }),
  ),

  // Sinful Ambitions. Incite 2 (data). When Revealed: "If Blackheart is in play, you may shuffle a Bargain attachment you
  // control into the encounter deck. If you do, give Blackheart a tough status. Otherwise, this card gains surge."
  "x.mephisto-nep.25.when-revealed": whenRevealed(
    ifThen(
      allOf(exists(BLACKHEART), exists(bargainOf(you))),
      chooseOne(
        option(
          "Shuffle a Bargain attachment into the encounter deck and give Blackheart a tough status",
          chooseTarget("sacrifice", bargainOf(you)),
          moveCards(cards(chosen("sacrifice")), "encounterDeckShuffle"),
          giveTough(each(BLACKHEART)),
        ),
        option("Decline: this card gains surge", surge()),
      ),
      surge(),
    ),
  ),

  // =========================================================================
  // 26-30 Corruptive Offers
  // =========================================================================

  // Deathless Persistence. Interrupt: "When a character you control would be defeated, place 1 corrupt counter here ->
  // heal 1 damage from that character instead." (Captain America's Helmet, 03008: `would` + `instead`.)
  "x.mephisto-nep.26.when-revealed": bargainWhenRevealed(),
  "x.mephisto-nep.26.interrupt": interrupt(
    on.defeated(query("character", { controller: "you" })),
    { would: true, cost: placeCountersCost("corrupt") },
    instead(heal(1, eventTarget)),
  ),
  "x.mephisto-nep.26.response": corruptDiscardResponse(),

  // Famished Power. Interrupt: "When you use a basic power, place 1 corrupt counter here -> combine the values of 2 basic
  // powers of your hero for this use." The power in use takes the value of another basic power added to it
  // (`modifyBasicPower`, an additive modifier); with Shackled Wrath the doubling comes after the sum (RRG "Modifiers",
  // p. 29), as the engine orders them.
  // Author ruling, 2026-11-13 (Neptune): the basic power used plus 1 different basic power of your choice, the values
  // added, for that use only: as built (the option for the power in use is not offered).
  "x.mephisto-nep.27.when-revealed": bargainWhenRevealed(),
  "x.mephisto-nep.27.interrupt": heroInterrupt(
    on.basicPowerUsing(YOUR_IDENTITY),
    { cost: placeCountersCost("corrupt") },
    chooseOne(
      option("Add your THW", modifyBasicPower(statOf(yourIdentity, "thw")), { when: not(basicPowerIs("thwart")) }),
      option("Add your ATK", modifyBasicPower(statOf(yourIdentity, "atk")), { when: not(basicPowerIs("attack")) }),
      option("Add your DEF", modifyBasicPower(statOf(yourIdentity, "def")), { when: not(basicPowerIs("defense")) }),
    ),
  ),
  "x.mephisto-nep.27.response": corruptDiscardResponse(),

  // Pestilent Nature. Interrupt: "When a card you control leaves play, place 1 corrupt counter here -> shuffle that card
  // into your deck instead."
  "x.mephisto-nep.28.when-revealed": bargainWhenRevealed(),
  "x.mephisto-nep.28.interrupt": interrupt(
    on.leavesPlay(query(["ally", "upgrade", "support"], { controller: "you" })),
    { cost: placeCountersCost("corrupt") },
    instead(moveCards(cards(eventTarget), "deckShuffle")),
  ),
  "x.mephisto-nep.28.response": corruptDiscardResponse(),

  // Warring Rage. Hero Response: "After you attack and defeat an enemy, place 1 corrupt counter here -> ready your hero,
  // heal 1 damage, and draw 1 card." (Prince of Power, `hercules` 59017, for the attack-and-defeat window.)
  "x.mephisto-nep.29.when-revealed": bargainWhenRevealed(),
  "x.mephisto-nep.29.hero-response": heroResponse(
    after.attacks(YOUR_IDENTITY, { defeats: true }),
    { cost: placeCountersCost("corrupt") },
    ready(yourIdentity),
    heal(1, yourIdentity),
    draw(1),
  ),
  "x.mephisto-nep.29.response": corruptDiscardResponse(),

  // Soul Gambling. When Revealed: "Each player sets aside the top X[per_hero] cards of their deck, where X is equal to the
  // number of corrupt counters on each Bargain attachment they have under their control. Otherwise, this card gains
  // surge." (Set aside is Damnation under Gateway to Corruption.) No counters on any attachment: surge.
  "x.mephisto-nep.30.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      moveCards(
        topOfDeck(product(countersOn(each(bargainOf(thatPlayer)), "corrupt"), perHero(1)), thatPlayer),
        "setAside",
      ),
    ),
    ifThen(not(valueAtLeast(countersOn(each(query("attachment", { trait: BARGAIN })), "corrupt"), 1)), surge()),
  ),
  // [star] Boost: "Place 1 corrupt counter on each Bargain attachment you control. If no counters were placed this way,
  // shuffle this card into the encounter deck."
  "x.mephisto-nep.30.boost": boost(
    addCounters("corrupt", 1, each(bargainOf(you)), { bind: "placed" }),
    ifThen(not(varAtLeast("placed.amount")), moveCards(cards(self), "encounterDeckShuffle")),
  ),

  // =========================================================================
  // 31-40 Damned
  // =========================================================================

  // Demon Amalgam. "[star] Demon Amalgam gets +1 hit point for each damned counter on it."
  "x.mephisto-nep.31.demon-amalgam-constant": constant(gets("hp", countersOn(self, "damned"), { self: true })),
  // When Revealed: "Place X damned counters on Demon Amalgam, where X is equal to the number of Mystic minions in the
  // encounter discard pile."
  "x.mephisto-nep.31.when-revealed": whenRevealed(
    selectCards("discarded", encounterCards(["discard"], query("minion", { trait: MYSTIC }))),
    addCounters("damned", refCount(chosen("discarded")), self),
  ),

  // Demon Lieutenant. "[star] Demon Lieutenant's attacks gain overkill."
  "x.mephisto-nep.32.demon-lieutenant-constant": constant(
    attacksGainKeywords(["overkill"], { attacker: { self: true } }),
  ),
  // [star] Boost: "If this activation is an attack, this attack gains overkill and this card gets +1 boost icon for this
  // activation."
  "x.mephisto-nep.32.boost": boost(
    ifThen(activationIs("attack"), [modifyAttack({ keywords: ["overkill"] }), adjustBoostCount(1)]),
  ),

  // Demon Soldier. When Revealed: "Take 1 indirect damage." [star] Boost: "After this activation, put this minion into play
  // engaged with you."
  "x.mephisto-nep.33.when-revealed": whenRevealed(dealIndirectDamage(you, 1)),
  "x.mephisto-nep.33.boost": boost(atEndOfActivation(putIntoPlay(self, you))),

  // Dweller Demon. When Revealed: "Place X threat on a scheme, where X is equal to the number of other Mystic minions in
  // play." [star] Forced Response: "After Dweller Demon attacks you, if there are no other minions engaged with you,
  // deal yourself 1 facedown encounter card."
  "x.mephisto-nep.34.when-revealed": whenRevealed(
    chooseTarget("scheme", query("scheme")),
    placeThreat(countOf(query("minion", { trait: MYSTIC, excluding: self })), chosen("scheme")),
  ),
  "x.mephisto-nep.34.forced-response": forcedResponse(
    on.enemyAttacks("self", { againstYou: true }),
    ifThen(not(exists(query("minion", { engagedWith: "you", excluding: self }))), dealEncounterCard(you)),
  ),

  // Harmony Demon. [star] Forced Response: "After Harmony Demon activates, heal 1 damage from each other Mystic minion in
  // play." [star] Boost: "If this activation is a scheme, give the activating enemy a tough status card and this card gets
  // +1 boost icon for this activation."
  "x.mephisto-nep.35.forced-response": forcedResponse(
    on.enemyActivates("self"),
    heal(1, each(query("minion", { trait: MYSTIC, excluding: self }))),
  ),
  "x.mephisto-nep.35.boost": boost(ifThen(activationIs("scheme"), [giveTough(activatingEnemy), adjustBoostCount(1)])),

  // Human Demon. When Revealed: "Place 1 threat on the main scheme." [star] Boost: "Put Human Demon into play against you."
  "x.mephisto-nep.36.when-revealed": whenRevealed(placeThreat(1, theMainScheme)),
  "x.mephisto-nep.36.boost": boost(putIntoPlay(self, you)),

  // Demonized (attachment). "Treat attached ally as a Mystic minion with a blank text box. Attached minion's SCH is equal to
  // its printed THW, and it does not take consequential damage. It gains the toughness keyword and 1 acceleration icon."
  // (Fallen Warrior, `mts` 21153: `treatAttachedAllyAsMinion`.)
  "x.mephisto-nep.37.demonized-constant": constant(
    treatAttachedAllyAsMinion([MYSTIC], { schFromThw: "printed" }),
    gainsKeyword({ name: "toughness" }, { hostOfSelf: true }),
    gainsIcon("acceleration", { hostOfSelf: true }),
  ),
  // When Revealed: "Discard cards from the top of your deck until you discard an ally. Put that ally into play engaged with
  // you with Demonized attached to it." With no ally the card is left unattached and discarded by its reveal.
  "x.mephisto-nep.37.when-revealed": whenRevealed(
    discardDeckUntil(query("ally"), "found"),
    putIntoPlay(chosen("found"), you),
    attachCard(self, chosen("found")),
    engage(chosen("found"), you),
  ),

  // Dark Lord's Tactics. "Each Mystic minion gains guard and patrol."
  "x.mephisto-nep.38.dark-lords-tactics-constant": constant(
    gainsKeyword({ name: "guard" }, query("minion", { trait: MYSTIC })),
    gainsKeyword({ name: "patrol" }, query("minion", { trait: MYSTIC })),
  ),

  // Hell's Legions. Assault (data). "Each Mystic minion gains toughness." [star] Boost: "Reveal this card."
  "x.mephisto-nep.39.hells-legions-constant": constant(
    gainsKeyword({ name: "toughness" }, query("minion", { trait: MYSTIC })),
  ),
  "x.mephisto-nep.39.boost": boost(revealCard(self, you)),

  // Condemned Soul Portal (environment). When Revealed: "Discard a non-Elite minion in play. Otherwise, this card gains surge."
  "x.mephisto-nep.40.when-revealed": whenRevealed(
    ifThen(
      exists(query("minion", { withoutTrait: ELITE })),
      [chooseTarget("minion", query("minion", { withoutTrait: ELITE })), discard(chosen("minion"))],
      surge(),
    ),
  ),
  // Forced Response: "After a printed non-Elite Mystic minion is defeated, shuffle that minion into the encounter deck." A
  // facedown player card or an ally treated as a minion is no printed minion: only an encounter card faceup.
  "x.mephisto-nep.40.forced-response": forcedResponse(
    on.defeated(query("minion", { trait: MYSTIC, withoutTrait: ELITE, controller: "encounter", facedown: false })),
    moveCards(cards(eventTarget), "encounterDeckShuffle"),
  ),
  // Hero Action: "If there are no Mystic minions in play, spend 2 resources of any type -> discard this card."
  "x.mephisto-nep.40.hero-action": heroAction(
    { while: not(exists(query("minion", { trait: MYSTIC }))), cost: spend(2) },
    discard(self),
  ),

  // =========================================================================
  // 41-44 Mother of Demons
  // =========================================================================

  // Lilith (minion). Steady, Villainous (data). [star] Forced Response: "After Lilith activates against you, if Call of
  // the Demoness is in play, put the top card of your discard pile facedown engaged with you as a Mystic minion."
  "x.mephisto-nep.41.forced-response": forcedResponse(
    on.enemyActivates("self", { againstYou: true }),
    ifThen(exists(CALL_OF_THE_DEMONESS), putIntoPlayFacedown(you, AS_MYSTIC, 1, { from: "discard" })),
  ),

  // Call of the Demoness (side scheme). "This card cannot leave play while facedown Mystic minion is in play." "Each facedown
  // Mystic minion engaged with a player has a base SCH of 1, a base ATK of 1, and a base hit points of 1." (Ultron's
  // facedown Drones, `ultron` 01xxx, `gets(..., { setBase: true })`.)
  // Author ruling, 2026-11-13 (Neptune): a defeated facedown Mystic minion goes to its owner's discard pile (what the
  // engine does for a facedown player card; tested).
  "x.mephisto-nep.42.call-of-the-demoness-constant": constant(
    cannotLeavePlay({ self: true }, { while: exists(MYSTIC_FACEDOWN) }),
    gets("sch", 1, FACEDOWN_MYSTIC_ENGAGED, { setBase: true }),
    gets("atk", 1, FACEDOWN_MYSTIC_ENGAGED, { setBase: true }),
    gets("hp", 1, FACEDOWN_MYSTIC_ENGAGED, { setBase: true }),
  ),
  // Forced Response: "After the villain phase begins, the first players puts the top card of their discard pile into play
  // facedown engaged with them as a Mystic minion."
  "x.mephisto-nep.42.forced-response": forcedResponse(
    on.phaseBeginning("villain"),
    putIntoPlayFacedown(firstPlayer, AS_MYSTIC, 1, { from: "discard" }),
  ),

  // Lilin Remaking (attachment). "Treat your identity's printed text box as blank (except for Traits). You cannot attack
  // Lilith and she cannot activate against you. You gain the Mystic trait, retaliate 2, and villainous."
  // Author ruling, 2026-11-13 (Neptune): "villainous" on your identity is an intended buff, as built.
  "x.mephisto-nep.43.when-revealed": bargainWhenRevealed(),
  "x.mephisto-nep.43.lilin-remaking-constant": constant(
    blanksTextBox(query("identity", { hostOfSelf: true })),
    gainsTrait(MYSTIC, { hostOfSelf: true }),
    gainsKeywordX("retaliate", 2, { hostOfSelf: true }),
    gainsKeyword({ name: "villainous" }, { hostOfSelf: true }),
    rule({ kind: "cannotAttack", target: LILITH, attacker: { hostOfSelf: true } }),
  ),
  // "... she cannot activate against you": cancelled where Lilith would activate against the identity's player.
  "x.mephisto-nep.43.lilin-remaking-forced-interrupt": forcedInterrupt(
    on.enemyActivating(LILITH),
    ifThen(refMatches(identityOf(eventPlayer), YOUR_IDENTITY), cancelIt()),
  ),
  // Response: "After your turn begins, discard this card -> find Lillith and reveal her. (If she is already in play, she
  // engages you.) Lillith activates against you."
  "x.mephisto-nep.43.response": response(
    on.yourTurnBegins(),
    { cost: discardThis },
    findCard(LILITH, "reveal"),
    enemyActivates(each(LILITH), { against: you }),
  ),

  // Spawn Magic. When Revealed: "If Call of the Demoness is in play, put the top 2 cards of your discard pile into play each
  // facedown and engaged with you as a Mystic minion. Otherwise, find Call of the Demoness and reveal it." [star] Boost:
  // "Resolve this card's 'When Revealed' ability."
  "x.mephisto-nep.44.when-revealed": whenRevealed(
    ifThen(
      exists(CALL_OF_THE_DEMONESS),
      putIntoPlayFacedown(you, AS_MYSTIC, 2, { from: "discard" }),
      findCard(CALL_OF_THE_DEMONESS, "reveal"),
    ),
  ),
  "x.mephisto-nep.44.boost": boost(resolveWhenRevealedOf(self)),
});
