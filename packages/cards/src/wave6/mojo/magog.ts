import { trait } from "@mc/content";
import type { EventPattern } from "@mc/engine";
import {
  addCounters,
  after,
  allOf,
  boost,
  chooseNumber,
  chosen,
  coveredByEngineRule,
  confuse,
  constant,
  countersOn,
  dealEncounterCard,
  discard,
  defineAbilities,
  draw,
  eachPlayer,
  encounterCards,
  endGame,
  enemyAttack,
  firstPlayer,
  flipCard,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  giveTough,
  hasTrait,
  ifThen,
  instead,
  made,
  named,
  not,
  on,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  refMatches,
  removeThreat,
  resetHitPoints,
  revealCard,
  scaled,
  selectCards,
  self,
  setVar,
  setup,
  shuffleEncounterDeck,
  stateCheck,
  stun,
  sum,
  takeDamage,
  theMainScheme,
  theVillain,
  threatOn,
  valueAtLeast,
  varAtLeast,
  varOf,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  you,
  ifElse,
  exists,
} from "../../dsl/index.js";

const CHAMPION = named("The Champion");
const CHALLENGERS = named("The Challengers");
const SURPRISE_CONTENDER = query("minion", { name: "Surprise Contender" });
const CHEERING_CROWD = trait("CHEERING CROWD");

const ratingsOn = (of: typeof CHAMPION) => countersOn(of, "ratings");
/** "If there are more ratings counters on The Challengers than on The Champion" (Break a Leg, Stage Fright). */
const challengersAhead = valueAtLeast(ratingsOn(CHALLENGERS), sum(ratingsOn(CHAMPION), 1));

/** Both crowds' "If there are at least 5[per_hero] ratings counters here, flip this environment" (counters stay, RRG 1.8 "Flip", p. 20). */
const flipsAtFive = () => stateCheck(valueAtLeast(countersOn(self, "ratings"), perHero(5)), flipCard(self));

/** "After The X flips to this side" (a card of two faces: only a flip reaches the back). */
const flipsToThisSide: EventPattern = { on: "cardFlipped", selfIs: "target" };

/** MaGog's "[star] Forced Response: After MaGog attacks and damages a character, place N ratings counters on The Champion." */
const magogForcedResponse = (n: number) =>
  forcedResponse(after.enemyAttacks("self", { damages: true }), addCounters("ratings", n, CHAMPION));

/** MaGog's "Forced Interrupt: When MaGog would be defeated, reset his hit points … instead. Place N[per_hero] ratings counters on The Challengers and deal each player 1 facedown encounter card." */
const magogForcedInterrupt = (n: number) =>
  forcedInterrupt(
    on.defeated("self"),
    resetHitPoints(self),
    addCounters("ratings", perHero(n), CHALLENGERS),
    dealEncounterCard(eachPlayer),
  );

/** Jolt of Adrenaline and Surge of Aggression: "Forced Response: After MaGog's hit points are reset, place 1[per_hero] ratings counters on The Challengers and discard this card." */
const afterHitPointsReset = () =>
  forcedResponse(
    on.hitPointsReset({ categories: ["villain"] }),
    addCounters("ratings", perHero(1), CHALLENGERS),
    discard(self),
  );

/**
 * MojoMania (`mojo`), the MaGog scenario's own encounter set (`magog` 39001-39011, MojoMania insert pp. 7-8,
 * docs/phase7-wave6.md §7.2, §7.3): MaGog (39001a standard, 39001b expert), Melee in the Mojo-seum (39002), the crowds
 * The Champion (39003) and The Challengers (39004), Jolt of Adrenaline, Surge of Aggression, Surprise Contender, Pump
 * Up the Crowd, Break a Leg, Defend the Title and Stage Fright.
 *
 * Ratings counters are the only score: The Challengers' B side is the one way to win (`Scenario.victory:
 * "cardAbility"`), The Champion's the way to lose. MaGog's defeat is always replaced, so defeating him never ends the game.
 *
 * **Break a Leg**: "any number of ratings counters" is capped at the damage it reduces (Q52, the recommended default,
 * pending the owner's confirmation; docs/phase7-wave6-handoff.md): `chooseNumber("placed", <damage>)`.
 */
export const MAGOG_ABILITIES = defineAbilities({
  // MaGog (39001a/b) — see `magogForcedResponse` / `magogForcedInterrupt`.
  "39001a.magog-forced-response": magogForcedResponse(1),
  "39001a.magog-forced-interrupt": magogForcedInterrupt(3),
  "39001b.magog-forced-response": magogForcedResponse(2),
  "39001b.magog-forced-interrupt": magogForcedInterrupt(2),

  // Melee in the Mojo-seum 1A — Setup: Put The Champion environment card and The Challengers environment card into
  // play, each with its BOOING CROWD side faceup (the front face of each).
  "39002a.setup": setup(
    selectCards("champion", encounterCards(["deck"], { name: "The Champion" })),
    putIntoPlay(chosen("champion"), firstPlayer),
    selectCards("challengers", encounterCards(["deck"], { name: "The Challengers" })),
    putIntoPlay(chosen("challengers"), firstPlayer),
    shuffleEncounterDeck(),
  ),
  // 1B — The players cannot win the game unless they wow the crowd as The Challengers: `Scenario.victory:
  // "cardAbility"`, and The Challengers' B side ends the game.
  "39002b.melee-in-the-mojo-seum-constant": coveredByEngineRule(),
  // 1B — Forced Interrupt: When this scheme would be completed, place 2[per_hero] ratings counters on The Champion and
  // remove all threat from here instead.
  "39002b.melee-in-the-mojo-seum-forced-interrupt": forcedInterrupt(
    on.mainSchemeCompleting("self"),
    instead(addCounters("ratings", perHero(2), CHAMPION), removeThreat(threatOn(self), self)),
  ),

  // The Champion (39003a) — If there are at least 5[per_hero] ratings counters here, flip this environment.
  "39003a.the-champion-constant": flipsAtFive(),
  // 39003b — Underdogs — Forced Response: After The Champion flips to this side, each player draws 1 card.
  "39003b.underdogs": forcedResponse(flipsToThisSide, draw(1, eachPlayer)),
  // 39003b — If there are at least 10[per_hero] ratings counters here, MaGog wins again and the players lose the game.
  "39003b.the-champion-constant": stateCheck(valueAtLeast(countersOn(self, "ratings"), perHero(10)), endGame("loss")),

  // The Challengers (39004a) — If there are at least 5[per_hero] ratings counters here, flip this environment.
  "39004a.the-challengers-constant": flipsAtFive(),
  // 39004b — Tag Team — Forced Response: After The Challengers flips to this side, search the encounter deck and
  // discard pile for Surprise Contender and put it into play engaged with the first player. If it is already in play,
  // give it a tough status card.
  "39004b.tag-team": forcedResponse(
    flipsToThisSide,
    ifThen(exists(SURPRISE_CONTENDER), giveTough(named("Surprise Contender")), [
      selectCards("contender", encounterCards(["deck", "discard"], { name: "Surprise Contender" })),
      putIntoPlay(chosen("contender"), firstPlayer),
      shuffleEncounterDeck(),
    ]),
  ),
  // 39004b — If there are at least 10[per_hero] ratings counters here, you wow the crowd and the players win the game.
  "39004b.the-challengers-constant": stateCheck(valueAtLeast(countersOn(self, "ratings"), perHero(10)), endGame("win")),

  // Jolt of Adrenaline (39005) — Attach to MaGog (data). MaGog gains retaliate 1 and stalwart.
  "39005.jolt-of-adrenaline-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, { hostOfSelf: true }),
    gainsKeyword({ name: "stalwart" }, { hostOfSelf: true }),
  ),
  "39005.jolt-of-adrenaline-forced-response": afterHitPointsReset(),
  // [star] Boost: Reveal this card.
  "39005.boost": boost(revealCard(self, you)),

  // Surge of Aggression (39006) — Attach to MaGog (data); +1 ATK and +1 SCH are `statModifiers` in the data.
  "39006.surge-of-aggression-forced-response": afterHitPointsReset(),
  "39006.boost": boost(revealCard(self, you)),

  // Surprise Contender (39007) — Villainous (data). [star] Forced Response: After Surprise Contender attacks and
  // damages a character, place 1 ratings counter on The Champion.
  "39007.surprise-contender-forced-response": magogForcedResponse(1),
  // When Defeated: Place 2[per_hero] ratings counters on The Challengers.
  "39007.when-defeated": whenDefeated(addCounters("ratings", perHero(2), CHALLENGERS)),

  // Pump Up the Crowd (39008) — When Revealed: If The Champion is on its Cheering Crowd side, place an additional
  // 1[per_hero] threat here.
  "39008.when-revealed": whenRevealed(ifThen(hasTrait(CHAMPION, CHEERING_CROWD), placeThreat(perHero(1), self))),
  // When Defeated: Place 1[per_hero] ratings counters on The Challengers.
  "39008.when-defeated": whenDefeated(addCounters("ratings", perHero(1), CHALLENGERS)),

  // Break a Leg (39009) — When Revealed: You are stunned. Take 2 damage (4 if there are more ratings counters on The
  // Challengers than on The Champion). You may place any number of ratings counters on The Champion to reduce this
  // damage by 1 for each counter placed this way.
  "39009.when-revealed": whenRevealed(
    stun(yourIdentity),
    setVar("damage", ifElse(challengersAhead, 4, 2)),
    chooseNumber("placed", varOf("damage")),
    addCounters("ratings", varOf("placed.amount"), CHAMPION),
    takeDamage(sum(varOf("damage"), scaled(varOf("placed.amount"), { times: -1 }))),
  ),

  // Defend the Title (39010) — When Revealed (Alter-Ego): Place 2 ratings counters on The Champion.
  "39010.when-revealed-alter-ego": whenRevealedAlterEgo(addCounters("ratings", 2, CHAMPION)),
  // When Revealed (Hero): MaGog attacks you. If a hero defends against this attack and takes no damage, place 2
  // ratings counters on The Challengers.
  "39010.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, bind: "attack" }),
    ifThen(
      allOf(
        made("attack"),
        not(varAtLeast("attack.undefended")),
        not(varAtLeast("attack.damage")),
        refMatches({ kind: "slot", slot: "attack.target" }, query("hero"), { anywhere: true }),
      ),
      addCounters("ratings", 2, CHALLENGERS),
    ),
  ),

  // Stage Fright (39011) — When Revealed: You are confused. Place 2 threat on the main scheme (4 threat instead if
  // there are more ratings counters on The Challengers than on The Champion).
  "39011.when-revealed": whenRevealed(
    confuse(yourIdentity),
    placeThreat(ifElse(challengersAhead, 4, 2), theMainScheme),
  ),
  // [star] Boost: You are confused.
  "39011.boost": boost(confuse(yourIdentity)),
});
