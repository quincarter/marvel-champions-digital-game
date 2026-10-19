import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec, EventPattern } from "@mc/engine";
import {
  addCounters,
  addVillain,
  after,
  anyOf,
  attachCard,
  boost,
  cannotBeCanceled,
  changeForm,
  choiceFoundNothing,
  chooseCards,
  chooseGroup,
  chooseOneBy,
  chooseTarget,
  chosen,
  chosenGroup,
  constant,
  controllerOf,
  counterLimit,
  countOf,
  coveredByEngineRule,
  damageSharedVillain,
  dealAsEncounterCard,
  dealDamage,
  dealEncounterCard,
  dealIndirectDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterCards,
  each,
  eachGroupInPod,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  endGame,
  enemyActivates,
  enemyAttack,
  enemyScheme,
  eventPlayer,
  eventSource,
  eventTarget,
  exhaust,
  exists,
  faceNamed,
  find,
  firstPlayer,
  flipCard,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  FRIENDLY_CHARACTER,
  gainsKeyword,
  gainsKeywordX,
  gets,
  giveTough,
  groupPlayerCount,
  heroAction,
  heroResponse,
  identityOf,
  ifThen,
  inGroup,
  inMode,
  instead,
  interrupt,
  modifyAttack,
  modifyStat,
  modifyThwart,
  moveCards,
  on,
  oneCopyOf,
  option,
  partOf,
  perHero,
  placeThreat,
  placeThreatOnSharedScheme,
  preventDamage,
  putIntoPlay,
  query,
  reachableFromPod,
  refCount,
  refMatches,
  removeCounter,
  removeCountersFrom,
  removeEachCounterFrom,
  removeThreat,
  resource,
  revealCard,
  rule,
  selectCards,
  self,
  setRemainingHitPoints,
  setup,
  shuffleEncounterDeck,
  spendResources,
  spendSameType,
  stun,
  swapVillainByTrait,
  takeDamage,
  thatPlayer,
  theMainScheme,
  theVillain,
  threatOn,
  valueAtLeast,
  varOf,
  whenDefeated,
  whenRevealed,
  you,
  zone,
} from "../../dsl/index.js";

const AVATAR_OF_LOKI = trait("AVATAR OF LOKI");
const SYNERGY = trait("SYNERGY");

/** "The Avatar of Loki villain": the one in play. A Fading Figment has no such trait, so it is never named. */
const AVATAR_VILLAIN = query("villain", { trait: AVATAR_OF_LOKI });
const INTENSE_FOCUS = query("attachment", { name: "Intense Focus" });
const DARK_SCEPTER = query("attachment", { name: "Dark Scepter" });
const SYNERGY_ENVIRONMENT = query("environment", { trait: SYNERGY });

/**
 * The Shatter the Illusion rules card (scenario `referenceCards`; docs/phase7-wave9.md sections 3.60, 3.66, 3.67; MC55
 * pp. 19 and 23): the When Revealed of all four Fading Figments, written once. The steps are in order and each resolves
 * fully before the next (p. 19); the card's second sentence follows all three.
 *
 * 1. Remove each shatter counter from the Fading Figment, then deal damage to Loki, God of Lies equal to the number
 *    removed. Loki is reached only by the shared event (`damageSharedVillain`): the hit points are the pod's record, and
 *    a flip or a defeat that damage brings about waits for this whole ability to finish (MC55 p. 20).
 * 2. Swap the Fading Figment in play with a random set-aside Avatar of Loki, front side up, then set that Avatar's dial
 *    to its printed value (owner decision Q8 = A: with Intense or Total Focus attached the dial reads the printed value
 *    plus the attachment's bonus, because the bonus is in effect on the Avatar it is attached to). The swap is not a
 *    leave, an entry or a reveal; attachments, status cards and counters stay (ruling February 28, 2026, Ruling 3).
 * 3. Deal each player 1 facedown encounter card.
 *
 * Then the Figment's own second sentence: "Choose a group in your pod, then place synergy counters on their
 * [environment] equal to the number of players in their group." The block runs in the chosen group's area (with one
 * group, here); the environment holds at most 1 per player (`counterLimit`), so the rest is not placed.
 */
const shatterTheIllusion = (environment: string): EffectSpec[] => [
  removeEachCounterFrom(self, "shatter", { bind: "shattered" }),
  damageSharedVillain(varOf("shattered.amount")),
  swapVillainByTrait(AVATAR_OF_LOKI, { dial: "printed" }),
  dealEncounterCard(eachPlayer),
  chooseGroup(),
  inGroup(chosenGroup(), addCounters("synergy", groupPlayerCount(), each(query("environment", { name: environment })))),
];

/** "Forced Interrupt: When this villain would be defeated, place 5 [per player] shatter counters here and flip this card instead." */
const avatarWouldBeDefeated = () =>
  forcedInterrupt(
    on.defeated("self"),
    { would: true },
    instead(addCounters("shatter", perHero(5), self), flipCard(self, { reveal: true })),
  );

/**
 * "After you resolve a treachery" on an encounter card (the Miscreant, the Knave): "you" is the player who revealed it.
 * `on.youResolveTreachery` narrows to the ability's controller, which an encounter card does not have, so the event is
 * matched for any player and "you" is the event's player.
 */
const treacheryResolved: EventPattern = { on: "encounterCardResolved", targetIs: { categories: ["treachery"] } };

/** "A character you control": your identity and your allies. */
const CHARACTER_YOU_CONTROL = query("character", { controller: "you" });

/** "Choose a group in your pod, then place 1 synergy counter on their [environment]" after "Place 3 shatter counters". */
const shatterThenSynergy = (environment: string): EffectSpec[] => [
  addCounters("shatter", 3, theVillain),
  chooseGroup(),
  inGroup(chosenGroup(), addCounters("synergy", 1, each(query("environment", { name: environment })))),
];

/**
 * The Mangog and Door Between Worlds: "Each group in your pod places 3 shatter counters on their Avatar of Loki villain
 * and 1 synergy counter on one of their Synergy environments." The environment is the group's first player's choice
 * (every one is offered, full or not: the card does not say "that can hold one").
 */
const eachGroupShattersAndAddsSynergy = (): EffectSpec =>
  eachGroupInPod(
    addCounters("shatter", 3, theVillain),
    chooseTarget("theirs", SYNERGY_ENVIRONMENT),
    addCounters("synergy", 1, chosen("theirs")),
  );

/** Aura of Stasis: discard the top `n` cards of the encounter deck; a treachery among them exhausts your identity. */
const auraDiscard = (n: number): EffectSpec[] => [
  discardEncounterCards(n, { bind: "discarded" }),
  ifThen(refMatches(chosen("discarded"), query("treachery"), { anywhere: true }), exhaust(identityOf(you))),
];

/** "Max 1 [per player] synergy counters here." */
const synergyLimit = () => constant(counterLimit("synergy", perHero(1)));

/**
 * Wave 9 scripting module `tt/god-of-lies` (docs/phase7-wave9.md section 8.4 items 68 and 69; MC55 pp. 10 and 18 to 23). Single
 * Group Mode only: one table, the engine its own pod coordinator (`wave9Scenario("god-of-lies")` passes the pod). The
 * first half (item 68) is the scenario's frame; the second half (item 69) is the encounter cards 55035 to 55051, at the
 * end of the registry. Nothing is skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * **Frame**: Loki, God of Lies and Worlds Collide sit in the closed `neutral` area, `createGame` makes it and the shared
 * record (Worlds Collide A's Setup), and no script here changes a neutral card directly. The only things that reach the
 * record are `damageSharedVillain` (the Shatter helper) and `placeThreatOnSharedScheme` (Mischief and Mayhem 1B); the
 * neutral cards' own lines are 55027b's When Revealed and its win. The flip at 10 per player, "cards cannot affect",
 * and Worlds Collide's loss are the engine's (`coveredByEngineRule`; the card data has no ability reference for the
 * loss sentence, and the engine concludes the pod with the same outcome). Mischief and Mayhem 1A's Setup puts a random
 * Avatar of Loki into play, the four Synergy environments, and (expert) Intense Focus on the Avatar.
 *
 * **Shatter the Illusion** (`shatterTheIllusion`) is the When Revealed of the four Fading Figments, written once. The
 * Avatars' Forced Interrupt replaces their defeat with 5 shatter counters per player and a flip.
 *
 * **Owner decisions**: Q8 = A (the new Avatar's dial is its printed value plus Intense or Total Focus's bonus), Q9 = A
 * (a completion in a player phase is lost at that phase's end unless Loki falls first; engine), Q10 = B (Loki's flip
 * attaches Intense Focus without revealing it, so its own When Revealed never resolves in play).
 *
 * Cards (29):
 * - 55027a Loki, God of Lies (villain)
 * - 55028a Worlds Collide (main_scheme)
 * - 55029a Loki the Rascal (villain)
 * - 55030a Loki the Miscreant (villain)
 * - 55031a Loki the Knave (villain)
 * - 55032a Loki the Wretch (villain)
 * - 55033a Mischief and Mayhem (main_scheme)
 * - 55034a Intense Focus (attachment)
 * - 55035 Wrapped in Chains (attachment)
 * - 55036 Dark Scepter (attachment)
 * - 55037 Draugr Buddy (minion)
 * - 55038 Grendell (minion)
 * - 55039 Malekith (minion)
 * - 55040 Minotaur (minion)
 * - 55041 The Mangog (minion)
 * - 55042 Fenris Wolf (minion)
 * - 55043 Hraesvelgr (minion)
 * - 55044 Laufey (minion)
 * - 55045 Aura of Stasis (side_scheme)
 * - 55046 Door Between Worlds (side_scheme)
 * - 55047 Lofty Goals (side_scheme)
 * - 55048 New Jotunheim (side_scheme)
 * - 55049 Dark Arts (treachery)
 * - 55050 Dirty Trick (treachery)
 * - 55051 Stories and Lies (treachery)
 * - 55052 Domineering Force (environment)
 * - 55053 Feigned Retreat (environment)
 * - 55054 Mounting Resistance (environment)
 * - 55055 Unified Front (environment)
 */
export const GOD_OF_LIES: AbilityRegistry = defineAbilities({
  // Loki, God of Lies, in the neutral area. 55027a's flip at 10 [per player] remaining and the "only damaged by the
  // Shatter" rule are the shared record's (pod.ts `applySharedEvent`, MC55 p. 20), not an ability of the card.
  "55027a.loki-god-of-lies-constant": coveredByEngineRule(),
  // 55027b: "When Revealed: Each group in standard mode attaches their set-aside Intense Focus to the Avatar of Loki
  // villain in their game area. Each group in expert mode flips their Intense Focus attachment to its Total Focus
  // side." Run when the shared record flips him (MC55 p. 20), for this group (the mode is per group). Standard: the
  // attachment is attached, not revealed, so its own When Revealed does not resolve (owner decision Q10 = B). Expert: a
  // flip that reveals the Total Focus side, as ruling June 25, 2026 - Ruling 5 presupposes (docs/phase7-wave9.md 3.63).
  "55027b.when-revealed": whenRevealed(
    ifThen(inMode("expert"), flipCard(each(INTENSE_FOCUS), { reveal: true }), [
      selectCards("focus", encounterSetAside(INTENSE_FOCUS)),
      attachCard(chosen("focus"), theVillain),
    ]),
  ),
  // "If Loki, God of Lies is defeated, all players in all groups win the game."
  "55027b.loki-god-of-lies-constant": forcedResponse(on.sharedVillainDefeated(), endGame("win")),

  // Worlds Collide (A): Setup "Create a separate game area for each player group": `createGame` makes the closed
  // `neutral` area and the shared record from the pod config (docs/phase7-wave9.md 3.59, 3.64), before any script.
  "55028a.setup": coveredByEngineRule(),
  // Worlds Collide (B): the two [per player] / [per group] icons are the shared record's counts (3.64, 3.65); "Cards
  // cannot affect this scheme or Loki, God of Lies, unless they refer to those cards by title" is the closed area (3.59).
  // "If this stage is completed, the players lose the game" has no ability reference in the card data: the engine
  // concludes the pod itself (a loss against the shared scheme, at once in the villain phase and at the end of the
  // player phase in a player phase, Q9 = A), with the same outcome a `forcedResponse(on.sharedSchemeCompleted(),
  // endGame("loss"))` would record.
  "55028b.worlds-collide-constant": coveredByEngineRule(),
  "55028b.worlds-collide-constant-2": coveredByEngineRule(),
  "55028b.worlds-collide-constant-3": coveredByEngineRule(),

  // The four Avatars of Loki. Each one's last printed line is the replaced defeat.
  // Loki the Rascal: "[star] Forced Response: After you resolve a boost card during Loki the Rascal's activation, if
  // that card is a treachery, either deal it to yourself as a facedown encounter card or spend 1 resource of any type."
  "55029a.loki-the-rascal-forced-response": forcedResponse(
    on.boostCardResolved("self"),
    ifThen(
      refMatches(eventTarget, query("treachery"), { anywhere: true }),
      chooseOneBy(
        eventPlayer,
        option("Deal it to yourself as a facedown encounter card", dealAsEncounterCard(eventTarget, eventPlayer)),
        option("Spend 1 resource of any type", spendResources({ generic: 1 }, "spent", eventPlayer)),
      ),
    ),
  ),
  "55029a.loki-the-rascal-forced-interrupt": avatarWouldBeDefeated(),
  "55029b.when-revealed": whenRevealed(...shatterTheIllusion("Unified Front")),

  // Loki the Miscreant: "Forced Response: After you resolve a treachery, place 1 threat on the main scheme and 1
  // threat on a side scheme." The first player chooses the side scheme (RRG 1.8 "First Player", p. 19).
  "55030a.loki-the-miscreant-forced-response": forcedResponse(
    treacheryResolved,
    placeThreat(1, theMainScheme),
    // No "choose": an encounter card targeting one of several eligible cards; the first player selects
    // (RRG 1.8 "First Player", p. 19).
    chooseTarget("scheme", query("sideScheme"), { chooser: firstPlayer }),
    placeThreat(1, chosen("scheme")),
  ),
  "55030a.loki-the-miscreant-forced-interrupt": avatarWouldBeDefeated(),
  "55030b.when-revealed": whenRevealed(...shatterTheIllusion("Mounting Resistance")),

  // Loki the Knave: "Forced Response: After you resolve a treachery, deal 1 damage to your identity and 1 damage to an
  // ally you control."
  "55031a.loki-the-knave-forced-response": forcedResponse(
    treacheryResolved,
    dealDamage(1, identityOf(eventPlayer)),
    chooseTarget("ally", query("ally", { controlledBy: eventPlayer }), { chooser: firstPlayer }),
    dealDamage(1, chosen("ally")),
  ),
  "55031a.loki-the-knave-forced-interrupt": avatarWouldBeDefeated(),
  "55031b.when-revealed": whenRevealed(...shatterTheIllusion("Domineering Force")),

  // Loki the Wretch: "[star] Forced Interrupt: When Loki the Wretch activates against you, discard the top card of the
  // encounter deck. If a treachery was discarded this way, Loki the Wretch gets +1 SCH and +1 ATK for this activation."
  "55032a.loki-the-wretch-forced-interrupt": forcedInterrupt(
    on.enemyActivates("self", { againstYou: true }),
    discardEncounterCards(1, { bind: "discarded" }),
    ifThen(refMatches(chosen("discarded"), query("treachery"), { anywhere: true }), [
      modifyStat("sch", 1, self, "endOfAttack"),
      modifyStat("atk", 1, self, "endOfAttack"),
    ]),
  ),
  "55032a.loki-the-wretch-forced-interrupt-2": avatarWouldBeDefeated(),
  "55032b.when-revealed": whenRevealed(...shatterTheIllusion("Feigned Retreat")),

  // Mischief and Mayhem 1A. Setup (after Worlds Collide's): 1. Put a random Avatar of Loki villain into play; each other
  // Avatar of Loki and the Shatter the Illusion card are set aside (the scenario starts the Avatars set aside, and the
  // rules card is not a card of the game). 2. Put each Synergy environment into play. 3. Standard mode: Intense Focus
  // stays set aside; expert mode: attach it to the Avatar in play.
  "55033a.setup": setup(
    selectCards("avatar", encounterSetAside(query("villain"), { random: 1 })),
    addVillain(chosen("avatar")),
    selectCards("synergy", encounterSetAside(SYNERGY_ENVIRONMENT)),
    putIntoPlay(chosen("synergy")),
    ifThen(inMode("expert"), [
      selectCards("focus", encounterSetAside(INTENSE_FOCUS)),
      attachCard(chosen("focus"), theVillain),
    ]),
  ),
  // The three numbered steps of the Setup, parsed as constants by the data pipeline (a data artifact, reported).
  "55033a.mischief-and-mayhem-constant": partOf("55033a.setup"),
  "55033a.mischief-and-mayhem-constant-2": partOf("55033a.setup"),
  "55033a.mischief-and-mayhem-constant-3": partOf("55033a.setup"),
  // 1B: "Forced Interrupt: When this scheme would be completed, remove all threat from here and place 1 threat on
  // Worlds Collide instead." The stage stays at 0 threat and is not advanced (docs/phase7-wave9.md 3.62).
  "55033b.mischief-and-mayhem-forced-interrupt": forcedInterrupt(
    on.mainSchemeCompleting("self"),
    instead(removeThreat(threatOn(self), self), placeThreatOnSharedScheme(1, "schemeCompleted")),
  ),
  // "Forced Interrupt: When an identity would be defeated, change that identity's form to alter-ego, set its hit point
  // dial to 1, and place 1 threat on Worlds Collide instead." The identity is not defeated: no player is eliminated.
  "55033b.mischief-and-mayhem-forced-interrupt-2": forcedInterrupt(
    on.defeated(query("identity")),
    { would: true },
    instead(
      changeForm(controllerOf(eventTarget), "alterEgo"),
      setRemainingHitPoints(1, eventTarget),
      placeThreatOnSharedScheme(1, "identityDefeated"),
    ),
  ),

  // Intense Focus: "Permanent. The Avatar of Loki villain gets +2 [per player] hit points and gains steady." The
  // permanent keyword and its +1 ATK / +1 SCH are data. "When Revealed: In standard mode, discard the top 2 [per player]
  // cards of the encounter deck and the top 5 cards of each player deck." Loki's flip attaches it without revealing it
  // (Q10 = B), so in play it never resolves; scripted as printed.
  "55034a.intense-focus-constant": constant(
    gets("hp", perHero(2), AVATAR_VILLAIN),
    gainsKeyword({ name: "steady" }, AVATAR_VILLAIN),
  ),
  "55034a.when-revealed": whenRevealed(
    ifThen(inMode("standard"), [
      discardEncounterCards(perHero(2)),
      forEachPlayer(eachPlayer, moveCards(zone("deck", thatPlayer, { top: 5 }), "discard")),
    ]),
  ),
  // Total Focus: +3 [per player] hit points and steady. "Find Dark Scepter and reveal it": in play first (revealed where
  // it is, so it did not enter play), else the encounter discard pile, else the deck (shuffled after, even when nothing
  // is found: RRG "Search"). "If Dark Scepter did not enter play this way, give the Avatar of Loki villain a tough status
  // card": in play already, or found nowhere (docs/phase7-wave9.md 3.63).
  "55034b.total-focus-constant": constant(
    gets("hp", perHero(3), AVATAR_VILLAIN),
    gainsKeyword({ name: "steady" }, AVATAR_VILLAIN),
  ),
  "55034b.when-revealed": whenRevealed(
    discardEncounterCards(perHero(2)),
    forEachPlayer(eachPlayer, moveCards(zone("deck", thatPlayer, { top: 5 }), "discard")),
    ifThen(
      exists(DARK_SCEPTER),
      [revealCard(find(DARK_SCEPTER), you), giveTough(theVillain)],
      [
        selectCards("scepter", oneCopyOf(encounterCards(["discard", "deck"], { name: "Dark Scepter" }))),
        ifThen(valueAtLeast(refCount(chosen("scepter")), 1), revealCard(chosen("scepter"), you), giveTough(theVillain)),
        shuffleEncounterDeck(),
      ],
    ),
  ),

  // The Synergy environments: "Permanent. Max 1 [per player] synergy counters here." plus what each prints. An interrupt
  // on a card nobody controls is offered to the player the event is about; each costs one synergy counter.
  "55052.domineering-force-constant": synergyLimit(),
  "55052.domineering-force-interrupt": interrupt(
    on.attacks(FRIENDLY_CHARACTER),
    { cost: removeCounter("synergy") },
    modifyAttack({ extraDamage: 4 }),
  ),
  "55053.feigned-retreat-constant": synergyLimit(),
  "55053.feigned-retreat-interrupt": interrupt(
    on.damage(query("identity")),
    { cost: removeCounter("synergy"), triggerableBy: controllerOf(eventTarget) },
    preventDamage(4),
  ),
  "55054.mounting-resistance-constant": synergyLimit(),
  "55054.mounting-resistance-interrupt": interrupt(
    on.thwarts(FRIENDLY_CHARACTER),
    { cost: removeCounter("synergy") },
    modifyThwart({ extraThreat: 4 }),
  ),
  "55055.unified-front-constant": synergyLimit(),
  "55055.unified-front-resource": resource({ wild: 2 }, { cost: removeCounter("synergy"), forAnyPlayer: true }),

  // ---- The encounter cards (docs/phase7-wave9.md section 8.4 item 69) ----

  // Wrapped in Chains: attaches to your identity (data). The identity cannot ready; it is exhausted on reveal. "Spend 2
  // resources of the same type" is a cost; discarding the card and the shatter counter are the effect.
  "55035.wrapped-in-chains-constant": constant(rule({ kind: "cannotReady", target: { hostOfSelf: true } })),
  "55035.when-revealed": whenRevealed(exhaust(identityOf(you))),
  "55035.wrapped-in-chains-action": heroAction(
    { cost: spendSameType(2) },
    discard(self),
    addCounters("shatter", 1, theVillain),
  ),

  // Dark Scepter (attached to the Avatar through the data attach rule; +1 ATK is data). Treacheries cannot be canceled.
  // Its Hero Response is offered to the player who resolved the treachery (an encounter card has no controller).
  "55036.dark-scepter-constant": constant(gainsKeyword({ name: "stalwart" }, AVATAR_VILLAIN)),
  "55036.dark-scepter-constant-2": constant(cannotBeCanceled(query("treachery"))),
  "55036.dark-scepter-response": heroResponse(
    treacheryResolved,
    { cost: spendSameType(2), triggerableBy: eventPlayer },
    discard(self),
  ),

  // Draugr Buddy (Guard is data): dealt, not discarded, when the card discarded is a treachery (Dreadpool's precedent).
  "55037.when-defeated": whenDefeated(
    discardEncounterCards(1, { bind: "discarded" }),
    ifThen(
      refMatches(chosen("discarded"), query("treachery"), { anywhere: true }),
      dealAsEncounterCard(self, defeatingPlayer),
    ),
  ),

  // Grendell (Guard is data): +1 ATK for each treachery among the 3 discarded, for this attack.
  "55038.grendell-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self"),
    discardEncounterCards(3, {
      forEachDiscarded: {
        slot: "card",
        effects: [
          ifThen(
            refMatches(chosen("card"), query("treachery"), { anywhere: true }),
            modifyStat("atk", 1, self, "endOfAttack"),
          ),
        ],
      },
    }),
  ),
  "55038.when-defeated": whenDefeated(addCounters("shatter", 3, theVillain)),

  // Malekith (Retaliate is data).
  "55039.malekith-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    discardEncounterCards(1, { bind: "discarded" }),
    ifThen(
      refMatches(chosen("discarded"), query("treachery"), { anywhere: true }),
      dealAsEncounterCard(chosen("discarded"), you),
    ),
  ),
  "55039.when-defeated": whenDefeated(addCounters("shatter", 2, theVillain)),

  // Minotaur (Toughness is data).
  "55040.when-revealed": whenRevealed(
    selectCards("treacheries", encounterCards(["discard"], query("treachery"))),
    ifThen(valueAtLeast(refCount(chosen("treacheries")), 5), enemyActivates(self, { against: you })),
  ),
  "55040.when-defeated": whenDefeated(addCounters("shatter", 2, theVillain)),

  // The Mangog (Victory is data; 10 hit points per group is data): attackable from the whole pod, which at one group is
  // the table. "Each group in your pod places ... on their Avatar" and "one of their Synergy environments".
  "55041.the-mangog-constant": constant(reachableFromPod("attack")),
  "55041.when-defeated": whenDefeated(eachGroupShattersAndAddsSynergy()),

  // Fenris Wolf (Guard and Patrol are data), Hraesvelgr, Laufey, New Jotunheim: 3 shatter counters, then a group in the
  // pod gets 1 synergy counter on the named environment.
  "55042.when-defeated": whenDefeated(...shatterThenSynergy("Mounting Resistance")),
  "55043.when-revealed": whenRevealed(
    discardEncounterCards(3, { bind: "discarded" }),
    ifThen(refMatches(chosen("discarded"), query("treachery"), { anywhere: true }), dealIndirectDamage(you, 2)),
  ),
  "55043.when-defeated": whenDefeated(...shatterThenSynergy("Domineering Force")),
  "55044.laufey-forced-response": forcedResponse(
    on.attacks(FRIENDLY_CHARACTER, { target: { self: true } }),
    discardEncounterCards(1, { bind: "discarded" }),
    ifThen(refMatches(chosen("discarded"), query("treachery"), { anywhere: true }), stun(eventSource)),
  ),
  "55044.when-defeated": whenDefeated(...shatterThenSynergy("Unified Front")),

  // Aura of Stasis: 2 cards (3 in expert mode); a treachery among them exhausts your identity.
  "55045.when-revealed": whenRevealed(ifThen(inMode("expert"), auraDiscard(3), auraDiscard(2))),

  // Door Between Worlds (Victory and 7 threat per group are data).
  "55046.door-between-worlds-constant": constant(reachableFromPod("thwart")),
  "55046.when-defeated": whenDefeated(eachGroupShattersAndAddsSynergy()),

  // Lofty Goals.
  "55047.when-defeated": whenDefeated(addCounters("shatter", 2, theVillain)),
  "55047.boost": boost(dealIndirectDamage(you, countOf(CHARACTER_YOU_CONTROL))),

  // New Jotunheim.
  "55048.when-defeated": whenDefeated(...shatterThenSynergy("Feigned Retreat")),

  // Dark Arts: "Otherwise" is the search finding no minion in the discard pile.
  "55049.dark-arts-constant": constant(gainsKeywordX("incite", 1, { self: true }, { while: inMode("expert") })),
  "55049.when-revealed": whenRevealed(
    chooseCards("found", encounterCards(["discard"], query("minion")), { min: 1, max: 1 }),
    ifThen(choiceFoundNothing(), placeThreat(3, theMainScheme), revealCard(chosen("found"), you)),
  ),
  "55049.boost": boost(placeThreat(countOf(CHARACTER_YOU_CONTROL), theMainScheme)),

  // Dirty Trick.
  "55050.when-revealed": whenRevealed(
    removeCountersFrom(theVillain, "shatter", 1),
    ifThen(inMode("expert"), takeDamage(3), takeDamage(2)),
  ),
  "55050.boost": boost(dealIndirectDamage(you, countOf(CHARACTER_YOU_CONTROL))),

  // Stories and Lies: the swap keeps the dial (Shatter's swap sets it), then the Avatar now in play acts by its name.
  "55051.when-revealed": whenRevealed(
    swapVillainByTrait(AVATAR_OF_LOKI),
    ifThen(
      anyOf(faceNamed(theVillain, "Loki the Knave"), faceNamed(theVillain, "Loki the Miscreant")),
      ifThen(
        inMode("expert"),
        enemyScheme(theVillain, { against: you, schBonus: 1 }),
        enemyScheme(theVillain, { against: you }),
      ),
    ),
    ifThen(
      anyOf(faceNamed(theVillain, "Loki the Rascal"), faceNamed(theVillain, "Loki the Wretch")),
      ifThen(
        inMode("expert"),
        enemyAttack(theVillain, { against: you, atkBonus: 1 }),
        enemyAttack(theVillain, { against: you }),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const GOD_OF_LIES_SKIPPED: Readonly<Record<string, string>> = {};
