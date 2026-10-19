import type { AbilityRegistry, TargetQuery } from "@mc/engine";
import {
  activatingEnemy,
  activationIs,
  addCounters,
  after,
  allOf,
  anyOf,
  anyPlayerEliminated,
  atEndOfAttack,
  atEndOfPhase,
  boost,
  chosen,
  constant,
  countersOn,
  dealDamage,
  defeatExcessDamage,
  defeatedWithExcessDamage,
  defineAbilities,
  encounterSetAside,
  endGame,
  eventDealt,
  eventResult,
  eventSource,
  eventTarget,
  firstThisRound,
  forcedInterrupt,
  forcedResponse,
  heal,
  each,
  ifThen,
  inMode,
  on,
  placeThreat,
  putIntoPlay,
  query,
  refMatches,
  removeCountersFrom,
  resolveWhenRevealedOf,
  rule,
  selectCards,
  self,
  setup,
  stateCheck,
  surge,
  swapMainScheme,
  theMainScheme,
  valueEquals,
  whenRevealed,
  you,
  yourMainScheme,
} from "../../../dsl/index.js";

/**
 * "In this play area" for a main scheme (MC60 p. 13 "Separate Main Schemes"; RRG 1.8 "Play Area", p. 33): the cards of
 * the player whose play area holds the scheme, "you" being that player. Their identity, their allies, and the minions
 * engaged with them (engaged minions are in a player's play area). The engine's `inPlayAreaOf` reads only a player's
 * `playArea` list (allies, supports, upgrades), so the identity and the engaged minions are named here.
 */
const HERO_HERE: TargetQuery = query("identity", { controlledBy: you });
const ALLY_HERE: TargetQuery = query("ally", { controlledBy: you });
const MINION_HERE: TargetQuery = query("minion", { engagedWithPlayer: you });
const CHARACTER_HERE: TargetQuery = { anyOf: [HERO_HERE, ALLY_HERE, MINION_HERE] };
/** An ally, or (expert mode) a minion, in this play area. */
const ALLY_OR_MINION_HERE: TargetQuery = { anyOf: [ALLY_HERE, MINION_HERE] };
/** An upgrade its player controls, or an attachment on a card of this play area (the upgrade or attachment enters play there). */
const UPGRADE_HERE: TargetQuery = query("upgrade", { controlledBy: you });
/** An attachment on a character of this play area, or on this play area's main scheme (MC60 p. 13: the scheme is in it). */
const ATTACHMENT_HERE: TargetQuery = {
  anyOf: [
    query("attachment", { host: { kind: "each", query: CHARACTER_HERE } }),
    query("attachment", { host: yourMainScheme }),
  ],
};
const UPGRADE_OR_ATTACHMENT_HERE: TargetQuery = { anyOf: [UPGRADE_HERE, ATTACHMENT_HERE] };

/**
 * The 1B text every Protection Racket main scheme prints: "If any main scheme is completed or any player is
 * eliminated, the players lose the game." The completion half is the engine's own loss on a final stage (each of the five
 * is a one-stage card: `completionNextStage` is null, `resolve/defeat.ts`); the elimination half is this state check.
 */
const eliminationLoses = () => stateCheck(anyPlayerEliminated, endGame("loss"));

/**
 * "(Limit once per phase in standard mode.)" (60134b): the limit is not printed for expert mode, and an ability's `limit`
 * is unconditional (`AbilityLimit` has no mode), so a use is recorded as a counter on the scheme that stands until the
 * phase ends, and the ability's `while` reads it. A DSL gap, closed here with the existing vocabulary; a mode on
 * `AbilityLimit` would replace it.
 */
const BODEGA_USED = "bodega";
const bodegaFree = anyOf(inMode("expert"), valueEquals(countersOn(self, BODEGA_USED), 0));

/**
 * The Protection Racket scenario (docs/phase7-wave11-scenarios.md section S7, task S9; MC60 p. 13).
 *
 * Each player has their own main scheme in their play area (`Scenario.mainSchemeChoice`, chosen or drawn by `createGame`
 * from the 1A Setup text, so every 1A Setup script is empty). On a scheme "you" and "this play area" are its player's
 * (MC60 p. 13, `uncontrolledYouOf`). Every 1B ends with "If any main scheme is completed or any player is eliminated,
 * the players lose the game": the completion is the RRG's final-stage loss, the elimination a state check.
 *
 * **60134b Battle in the Bodega**: Forced Response: after a character in this play area is attacked (`characterAttacked`:
 * the target is the character actually hit), 1 damage to the attacker and 1 threat here; once per phase in standard mode
 * (a counter, see `BODEGA_USED`). A hero attacking an engaged minion triggers it too: the minion is in this play area.
 * **60135b Bull in a China Shop**: Forced Interrupt: when excess damage is dealt to an ally (expert mode: or a minion) in
 * this play area, that much threat here. Excess damage is how far the damage taken passed the character's remaining hit
 * points (RRG 1.8 "Excess Damage", p. 19), which is always a defeat, so it is read as the defeat's excess in the defeat's
 * interrupt window (`defeatExcessDamage`); a tough status card or a prevention leaves none (RRG 1.8 "Overkill", p. 31).
 * **60136b Hung Out to Dry**: Forced Response: after a character (an ally, or a minion engaged with the player) enters
 * play in this play area, 1 damage to it and 1 threat here. The hero never "enters play".
 * **60137b Pawn Shop Showdown**: the first upgrade its player plays each round costs 1 less (the round count, as Steve
 * Rogers' FAQ reads it, RRG 1.8 p. 59); Forced Response: after an attachment or upgrade enters play in this play area,
 * 1 threat here.
 * **60138b A Slice of the Pizza Dough**: Forced Response: after a character in this play area defeats another character or
 * a side scheme (in any play area), heal 1 damage from the defeating character and 1 threat here.
 * **60139 Shop Proprietor**: When Revealed: put into play under the revealing player's control and surge. Forced
 * Interrupt: when it leaves play, 4 threat on the main scheme in its controller's play area.
 * **60140 Man-Bull**: Forced Response: after he attacks, threat on the main scheme equal to that attack's excess damage
 * (the damage taken past the remaining hit points: RRG 1.8 "Overkill", p. 31). Boost: on an attack, the same once the
 * attack has dealt its damage (`atEndOfAttack`: a boost resolves before the damage), on the main scheme of the
 * villain's play area, i.e. each one (MC60 p. 13: a boost card on the villain is in no player's play area; one on an
 * engaged minion is in that player's).
 * **60141 Change of Venue**: Surge (data). When Revealed: swap your main scheme with a random set-aside one and place the
 * previous scheme's threat on the new one (`swapMainScheme`; MC60 p. 26 FAQ: the old scheme's attachments are
 * discarded). Boost: resolve this card's When Revealed ability.
 *
 * Cards (8):
 * - 60134a Protection Racket (main_scheme)
 * - 60135a Protection Racket (main_scheme)
 * - 60136a Protection Racket (main_scheme)
 * - 60137a Protection Racket (main_scheme)
 * - 60138a Protection Racket (main_scheme)
 * - 60139 Shop Proprietor (ally)
 * - 60140 Man-Bull (minion)
 * - 60141 Change of Venue (treachery)
 */
export const FNE_SCENARIOS_PROTECTION_RACKET: AbilityRegistry = defineAbilities({
  // 1A Setup of each: "Each player chooses a single Protection Racket main scheme (at random in expert mode), places it
  // in their play area, and flips it to its 1B side. Set each unused main scheme aside." Done by `createGame`.
  "60134a.setup": setup(),
  "60135a.setup": setup(),
  "60136a.setup": setup(),
  "60137a.setup": setup(),
  "60138a.setup": setup(),

  // Owner Q208 open, built A: it still fires when the attack defeated the attacked minion, which was in this play area
  // when attacked (RRG 1.8 "Response", p. 38; the Omega Zero Tolerance ruling). The engine reads a defeated target's
  // engagement as it was attacked (`characterAttacked.targetEngagedWith`), so `MINION_HERE` still matches it.
  "60134b.battle-in-the-bodega-forced-response": forcedResponse(
    { on: "characterAttacked", targetIs: CHARACTER_HERE },
    { while: bodegaFree },
    dealDamage(1, eventSource),
    placeThreat(1, self),
    ifThen(inMode("standard"), [
      addCounters(BODEGA_USED, 1, self),
      atEndOfPhase(removeCountersFrom(self, BODEGA_USED, 1)),
    ]),
  ),
  "60134b.battle-in-the-bodega-constant": eliminationLoses(),

  "60135b.bull-in-a-china-shop-forced-interrupt": forcedInterrupt(
    on.defeated(ALLY_OR_MINION_HERE),
    ifThen(
      allOf(defeatedWithExcessDamage, anyOf(inMode("expert"), refMatches(eventTarget, query("ally")))),
      placeThreat(defeatExcessDamage, self),
    ),
  ),
  "60135b.bull-in-a-china-shop-constant": eliminationLoses(),

  "60136b.hung-out-to-dry-forced-response": forcedResponse(
    on.entersPlay({ anyOf: [ALLY_HERE, MINION_HERE] }),
    dealDamage(1, eventTarget),
    placeThreat(1, self),
  ),
  "60136b.hung-out-to-dry-constant": eliminationLoses(),

  "60137b.pawn-shop-showdown-constant": constant(
    rule({
      kind: "playCostModifier",
      player: you,
      appliesTo: query("upgrade"),
      delta: -1,
      while: firstThisRound("upgrade", you),
    }),
  ),
  "60137b.pawn-shop-showdown-forced-response": forcedResponse(
    on.entersPlay(UPGRADE_OR_ATTACHMENT_HERE),
    placeThreat(1, self),
  ),
  "60137b.pawn-shop-showdown-constant-2": eliminationLoses(),

  "60138b.a-slice-of-the-pizza-dough-forced-response": forcedResponse(
    on.defeats(CHARACTER_HERE),
    heal(1, eventSource),
    placeThreat(1, self),
  ),
  "60138b.a-slice-of-the-pizza-dough-constant": eliminationLoses(),

  "60139.when-revealed": whenRevealed(putIntoPlay(self, you), surge()),
  "60139.shop-proprietor-forced-interrupt": forcedInterrupt(on.leavesPlay("self"), placeThreat(4, yourMainScheme)),

  "60140.man-bull-forced-response": forcedResponse(
    after.enemyAttacks("self"),
    ifThen(eventDealt("excessDealt"), placeThreat(eventResult("excessDealt"), theMainScheme)),
  ),
  "60140.boost": boost(
    ifThen(
      activationIs("attack"),
      atEndOfAttack(
        ifThen(
          eventDealt("excessDealt"),
          // A boost card on the villain is in no player's play area: every main scheme (MC60 p. 13). One on an engaged
          // minion is in that player's play area: that player's.
          ifThen(
            refMatches(activatingEnemy, query("villain")),
            placeThreat(eventResult("excessDealt"), each(query("mainScheme"))),
            placeThreat(eventResult("excessDealt"), yourMainScheme),
          ),
        ),
      ),
    ),
  ),

  "60141.when-revealed": whenRevealed(
    selectCards("venue", encounterSetAside(query("mainScheme"), { random: 1 })),
    swapMainScheme(yourMainScheme, chosen("venue"), { placePreviousThreat: true }),
  ),
  "60141.boost": boost(resolveWhenRevealedOf(self)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_SCENARIOS_PROTECTION_RACKET_SKIPPED: Readonly<Record<string, string>> = {};
