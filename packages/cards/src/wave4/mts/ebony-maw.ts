import { trait } from "@mc/content";
import {
  addCounters,
  after,
  attacksGainKeywords,
  boost,
  chooseCards,
  chooseOneBy,
  chosen,
  constant,
  countOf,
  defeatingPlayer,
  discard,
  discardAtRandom,
  discardEncounterUntil,
  each,
  eachPlayer,
  encounterCards,
  enemyAttack,
  enemyScheme,
  eventTarget,
  exhaust,
  exists,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  giveStatus,
  giveTough,
  heroAction,
  host,
  ifThen,
  inPlayAreaOf,
  isHero,
  on,
  option,
  placeThreat,
  preventAllDamageTo,
  putIntoPlay,
  query,
  removeCountersFrom,
  rule,
  self,
  shuffleEncounterDeck,
  spend,
  stun,
  surge,
  takeDamage,
  thatPlayer,
  theMainScheme,
  theVillain,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  dealDamage,
  defineAbilities,
  moveCards,
  not,
  you,
} from "../../dsl/index.js";
import type { EffectArg } from "../../dsl/index.js";
import type { PlayerRef, RuleSpec } from "@mc/engine";

/**
 * Ebony Maw (`mts` scenario, docs/phase7-wave4.md §2.2, §3.15, §3.16): the villain Ebony Maw I–III (21071–21073),
 * the main scheme Attack on Knowhere → The Power Stone (21074/21075), his own encounter set's Spell environments
 * (Fireball/Manipulation/Pacification/Rubblestorm, 21076–21079), treacheries and attachments (21080–21083),
 * Reactor Overload (21084), and the two recommended modular sets, Black Order (21085–21088) and Armies of Titan
 * (21089–21091).
 *
 * **The general rule "when a player reveals a Spell environment, they place that card in front of them in their
 * play area" (MC21 p. 6) is a rulebook instruction, not printed on any single card.** It is seeded at setup as a
 * scenario rule (`EBONY_MAW_SCENARIO_RULES`, `GameSetupConfig.scenarioRuleSpecs`, docs/phase7-wave4.md §3.40), so
 * every Spell revealed or put into play by an effect ("puts that card into play in their play area") goes to that
 * player's area through the engine's `entersRevealersPlayArea`.
 *
 * The rest of the set does not depend on that routing: the Forced Interrupt only reads whichever Spell
 * cards *are already* in a play area (`inPlayAreaOf`), and each Spell's own "enters play with N counters" / "last
 * counter removed" pair fires regardless of which area the card sits in.
 */

const SPELL = trait("SPELL");
const BLACK_ORDER = trait("BLACK ORDER");
const SPELLS_IN_YOUR_PLAY_AREA = query([], { trait: SPELL, ...inPlayAreaOf() });

/** MC21 p. 6: "When a player reveals a Spell environment, they place that card in front of them in their play area." */
export const EBONY_MAW_SCENARIO_RULES: readonly RuleSpec[] = [
  { kind: "entersRevealersPlayArea", cards: { trait: SPELL } },
];

/** "… discards cards from the top of the encounter deck until they discard a Spell card and puts that card into play
 * in their play area" for `player` (the scenario rule places it). */
const spellIntoPlayFor = (player: PlayerRef): EffectArg[] => [
  discardEncounterUntil(query([], { trait: SPELL }), "spell"),
  putIntoPlay(chosen("spell"), player),
];
/** "Each player discards cards from the top of the encounter deck until they discard a Spell card and puts that card
 * into play in their play area." */
const eachPlayerSpell = (): EffectArg => forEachPlayer(eachPlayer, ...spellIntoPlayFor(thatPlayer));
/** "Shuffle the encounter discard pile into the encounter deck." */
const shuffleDiscardIn = (): EffectArg => moveCards(encounterCards(["discard"]), "encounterDeckShuffle");

/** "[star] Forced Interrupt: When Ebony Maw activates against you, remove an invocation counter from each Spell
 * card in your play area." — identical text on all three stages (docs/phase7-wave4.md §3.15/§3.16 worked example:
 * "activates against you" read as "attacks you", matching the wave 4 DSL primitives test for this exact card). */
const ebonyMawForcedInterrupt = () =>
  forcedInterrupt(
    on.villainAttacks({ againstYou: true }),
    removeCountersFrom(each(SPELLS_IN_YOUR_PLAY_AREA), "invocation", 1),
  );

/** A Spell environment's "Enters play with N invocation counters on it." (Surge is data-driven.) */
const entersWithInvocationCounters = (n: number) => forcedResponse(on.entersPlay("self"), addCounters("invocation", n));
/** "Forced Response: After the last invocation counter is removed from <name>, discard it → <effect>." */
const lastCounterDiscards = (...then: readonly EffectArg[]) =>
  forcedResponse(on.lastCounterRemoved("invocation"), discard(self), ...then);

export const EBONY_MAW = defineAbilities({
  // Ebony Maw (I/II/III, 21071–21073) — Forced Interrupt as above. II/III — When Revealed: Each player discards cards
  // from the top of the encounter deck until they discard a Spell card and puts that card into play in their play area.
  "21071.ebony-maw-forced-interrupt": ebonyMawForcedInterrupt(),
  "21072.ebony-maw-forced-interrupt": ebonyMawForcedInterrupt(),
  "21073.ebony-maw-forced-interrupt": ebonyMawForcedInterrupt(),
  "21072.when-revealed": whenRevealed(eachPlayerSpell()),
  "21073.when-revealed": whenRevealed(eachPlayerSpell()),

  // Attack on Knowhere (21074b) — When Revealed: Each player … puts that [Spell] card into play in their play area.
  // Shuffle the encounter discard pile into the encounter deck.
  "21074b.when-revealed": whenRevealed(eachPlayerSpell(), shuffleDiscardIn()),
  // The Power Stone (21075a) — When Revealed: Shuffle the encounter discard pile into the encounter deck. Each player …
  // puts that [Spell] card into play in their play area.
  "21075a.when-revealed": whenRevealed(shuffleDiscardIn(), eachPlayerSpell()),

  // Fireball (21076, environment) — Surge (data). Enters play with 4 invocation counters. Forced Response: After
  // the last invocation counter is removed, discard it → deal 4 damage to your identity.
  "21076.fireball-constant": entersWithInvocationCounters(4),
  "21076.fireball-forced-response": lastCounterDiscards(dealDamage(4, yourIdentity)),

  // Manipulation (21077, environment) — Surge (data). Enters play with 2 invocation counters. Forced Response:
  // After the last counter is removed, discard it → discard 1 card at random from your hand; you are confused.
  "21077.manipulation-constant": entersWithInvocationCounters(2),
  "21077.manipulation-forced-response": lastCounterDiscards(discardAtRandom(1), giveStatus(yourIdentity, "confused")),

  // Pacification (21078, environment) — Surge (data). Enters play with 3 invocation counters. Forced Response:
  // After the last counter is removed, discard it → exhaust each upgrade you control; you are stunned.
  "21078.pacification-constant": entersWithInvocationCounters(3),
  "21078.pacification-forced-response": lastCounterDiscards(
    exhaust(each(query("upgrade", { controller: "you" }))),
    stun(yourIdentity),
  ),

  // Rubblestorm (21079, environment) — Surge (data). Enters play with 3 invocation counters. Forced Response:
  // After the last counter is removed, discard it → deal 2 damage to each character you control.
  "21079.rubblestorm-constant": entersWithInvocationCounters(3),
  "21079.rubblestorm-forced-response": lastCounterDiscards(
    dealDamage(2, each(query("character", { controller: "you" }))),
  ),

  // Agent of Thanos (21080, treachery) — When Revealed (Alter-Ego): place 1 threat on the main scheme for each
  // Spell environment in your play area; if none, this card gains surge instead. When Revealed (Hero): the same as
  // damage to your hero.
  "21080.when-revealed-alter-ego": whenRevealedAlterEgo(
    ifThen(exists(SPELLS_IN_YOUR_PLAY_AREA), placeThreat(countOf(SPELLS_IN_YOUR_PLAY_AREA), theMainScheme), surge()),
  ),
  "21080.when-revealed-hero": whenRevealedHero(
    ifThen(exists(SPELLS_IN_YOUR_PLAY_AREA), dealDamage(countOf(SPELLS_IN_YOUR_PLAY_AREA), yourIdentity), surge()),
  ),

  // Channeling Trance (21081, treachery) — When Revealed: Remove 1 invocation counter from each Spell environment in
  // your play area. If you have no Spell environments in your play area, discard cards from the top of the encounter
  // deck until a Spell environment is discarded. Put that card into play in your play area. "If you have no" is read
  // after the removal (a Spell whose last counter went is discarded by its own forced response, which follows).
  "21081.when-revealed": whenRevealed(
    removeCountersFrom(each(SPELLS_IN_YOUR_PLAY_AREA), "invocation", 1),
    ifThen(not(exists(SPELLS_IN_YOUR_PLAY_AREA)), spellIntoPlayFor(you)),
  ),

  // Abjuration (21082, attachment; "Attach to Ebony Maw" is data-driven) — Prevent all damage to Ebony Maw. Forced
  // Response: after it prevents 2+ damage from a single attack, discard it (docs/phase7-wave4.md §3.20).
  "21082.abjuration-constant": constant(preventAllDamageTo({ hostOfSelf: true })),
  "21082.abjuration-forced-response": forcedResponse(
    on.thisPreventsDamage({ fromAttack: true, atLeast: 2 }),
    discard(self),
  ),

  // Restrained (21083, attachment; "Attach to a friendly character with the highest ATK" is data-driven) — and
  // exhaust it (one-shot on entering play attached). Attached character cannot ready. Hero Action: spend
  // [energy][physical] resources → discard this card.
  "21083.restrained-constant": forcedResponse(on.entersPlay("self"), exhaust(host)),
  "21083.restrained-constant-2": constant(rule({ kind: "cannotReady", target: { hostOfSelf: true } })),
  "21083.restrained-action": heroAction({ cost: spend({ energy: 1, physical: 1 }) }, discard(self)),

  // Reactor Overload (21084, side scheme) — When Revealed: each player must choose to either take 2 damage or
  // place 2 threat here.
  "21084.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      chooseOneBy(
        thatPlayer,
        option("Take 2 damage", takeDamage(2, thatPlayer)),
        option("Place 2 threat here", placeThreat(2, self)),
      ),
    ),
  ),

  // Black Dwarf (21085, minion; Elite is data) — Black Dwarf's attacks gain overkill.
  "21085.black-dwarf-constant": constant(attacksGainKeywords(["overkill"], { attacker: { self: true } })),

  // Supergiant (21086, minion; Quickstrike is data) — Forced Response: after Supergiant attacks and damages a
  // character, that character is stunned.
  "21086.supergiant-forced-response": forcedResponse(after.enemyAttacks("self", { damages: true }), stun(eventTarget)),

  // The Black Order (21087, side scheme) — While a Black Order minion is in play, threat cannot be removed from
  // this side scheme.
  "21087.the-black-order-constant": constant(
    rule({
      kind: "threatCannotBeRemoved",
      target: { self: true },
      while: exists(query("minion", { trait: BLACK_ORDER })),
    }),
  ),

  // Blood to Spare (21088, treachery) — When Revealed: each minion engaged with a player activates against that
  // player; each player who is not engaged with a minion searches the encounter deck and discard pile for a Black
  // Order minion and puts it into play engaged with them. Shuffle the encounter deck.
  "21088.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, [
      ifThen(
        exists(query("minion", { engagedWithPlayer: thatPlayer })),
        ifThen(
          isHero(thatPlayer),
          enemyAttack(each(query("minion", { engagedWithPlayer: thatPlayer })), { against: thatPlayer }),
          enemyScheme(each(query("minion", { engagedWithPlayer: thatPlayer })), { against: thatPlayer }),
        ),
        [
          chooseCards("found", encounterCards(["deck", "discard"], query("minion", { trait: BLACK_ORDER })), {
            min: 1,
            max: 1,
            chooser: thatPlayer,
          }),
          putIntoPlay(chosen("found"), thatPlayer),
        ],
      ),
    ]),
    shuffleEncounterDeck(),
  ),

  // Black Order Infantry (21089, minion; Guard is data) — When Defeated: give the villain a tough status card.
  // [star] Boost: give the villain a tough status card.
  "21089.when-defeated": whenDefeated(giveTough(theVillain)),
  "21089.boost": boost(giveTough(theVillain)),

  // Outrider (21090, minion) — When Revealed: discard 1 card at random from your hand. [star] Boost: the same.
  "21090.when-revealed": whenRevealed(discardAtRandom(1)),
  "21090.boost": boost(discardAtRandom(1)),

  // Landing Craft (21091, side scheme; acceleration icon is data) — When Defeated: discard cards from the top of
  // the encounter deck until a minion is discarded. Put that minion into play engaged with the player who defeated
  // this scheme.
  "21091.when-defeated": whenDefeated(
    discardEncounterUntil(query("minion"), "found"),
    putIntoPlay(chosen("found"), defeatingPlayer),
  ),
});
