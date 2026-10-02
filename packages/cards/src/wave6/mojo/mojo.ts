import { trait } from "@mc/content";
import type { EffectSpec, ValueSpec } from "@mc/engine";
import { discardThisObligation } from "../../core/obligations.js";
import {
  FRIENDLY_CHARACTER,
  andThen,
  attachCard,
  bindTargets,
  boost,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  coveredByEngineRule,
  damagedAtLeast,
  dealEncounterCard,
  defineAbilities,
  discard,
  discardEncounterCards,
  discardFromHandCost,
  each,
  eitherCost,
  encounterCards,
  endGame,
  enemyScheme,
  eventAmount,
  eventResult,
  eventTarget,
  exhaustCardsCost,
  firstPlayer,
  flipCard,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  heal,
  heroAction,
  identityOf,
  ifElse,
  ifThen,
  inEncounterSet,
  instead,
  isAlterEgo,
  isHero,
  made,
  moveThreat,
  not,
  on,
  option,
  placeDamage,
  placeThreat,
  putIntoPlay,
  query,
  refMatches,
  removeThreat,
  revealCard,
  revealFromSetAsideModularSet,
  selectCards,
  self,
  setAsideModularSetCount,
  setup,
  shuffleEncounterDeck,
  spend,
  spendDifferentResources,
  superlative,
  surge,
  takeDamage,
  theMainScheme,
  theVillain,
  threatOn,
  valueEquals,
  varAtLeast,
  when,
  whenRevealed,
  yourIdentity,
  you,
  action,
  eventPlayer,
} from "../../dsl/index.js";

const SHOW = trait("SHOW");
const SHOW_ENVIRONMENT = query("environment", { trait: SHOW });
/** "Each character you control": your identity and your allies. */
const CHARACTERS_YOU_CONTROL = query(["identity", "ally"], { controller: "you" });
/** Any card that is in the Mojo encounter set, wherever it is (a discarded card is no longer in play). */
const MOJO_SET = query([], inEncounterSet("mojo"));

/**
 * "Forced Response (Hero): After your turn ends, discard the top N cards of the encounter deck. Place 1 threat on your
 * hero for each card discarded this way that does not belong to the Mojo encounter set." "You" is the player whose turn
 * ended (`eventPlayer`; pending default, docs/phase7-wave6.md, the card's owner note), and "(Hero)" is that player being
 * in hero form. One card at a time (`forEachDiscarded`), so the threat follows each discard.
 */
const mojoTurnEnd = (n: number) =>
  forcedResponse(
    { on: "turnEnding" },
    ifThen(
      isHero(eventPlayer),
      discardEncounterCards(n, {
        forEachDiscarded: {
          slot: "d",
          effects: [
            ifThen(not(refMatches(chosen("d"), MOJO_SET, { anywhere: true })), placeThreat(1, identityOf(eventPlayer))),
          ],
        },
      }),
    ),
  );

/** "Take N damage" whose damage actually taken is read back as `<bind>.amount` (a `taken` hit, Q21). */
const takeDamageBound = (n: ValueSpec, bind: string): EffectSpec => ({
  ...(takeDamage(n) as Extract<EffectSpec, { kind: "dealDamage" }>),
  bind,
});

/** "[star] Boost: Place 1 threat on each character you control." ("You" is the player the activation is against.) */
const threatOnEachCharacter = (n: number) => placeThreat(n, each(CHARACTERS_YOU_CONTROL));

/**
 * MojoMania (`mojo`), the Mojo scenario's own encounter set (39022-39034, MojoMania insert pp. 16-18,
 * docs/phase7-wave6.md §7.2): Mojo I-III, the main scheme MojoMania, Wheel of Genres (SPINNING / STOPPED), Major Domo,
 * Stinger Tail, Supporting Actor, Paparazzi, Undercover Mojo, Curtain Call, Director's Directions and Top Billing.
 *
 * Threat sits on characters here (§3.59, Q34): Mojo's discards and Supporting Actor's activations put it on heroes,
 * allies and a minion, and MojoMania 1B moves it to the main scheme whenever that character flips or leaves play.
 */
export const MOJO_SCENARIO_ABILITIES = defineAbilities({
  // Mojo I (39022), II (39023), III (39024) — see `mojoTurnEnd`.
  "39022.mojo-forced-response": mojoTurnEnd(3),
  // When Revealed: Place 2 threat on each friendly character (every player's identity and allies).
  "39023.when-revealed": whenRevealed(placeThreat(2, each(FRIENDLY_CHARACTER))),
  "39023.mojo-forced-response": mojoTurnEnd(4),
  "39024.when-revealed": whenRevealed(placeThreat(3, each(FRIENDLY_CHARACTER))),
  "39024.mojo-forced-response": mojoTurnEnd(5),

  // MojoMania 1A — Setup: (the modular sets are set aside by the scenario's `setAsideModularSetCount`, built by
  // `../setup.ts`) put the Wheel of Genres environment into play, SPINNING side faceup.
  "39025a.setup": setup(
    selectCards("wheel", encounterCards(["deck"], { name: "Wheel of Genres" })),
    putIntoPlay(chosen("wheel"), firstPlayer),
    shuffleEncounterDeck(),
  ),
  // 1B — When Revealed: Choose 1 set-aside encounter set at random, reveal its SHOW environment and shuffle its
  // remaining cards into the encounter deck.
  "39025b.when-revealed": whenRevealed(revealFromSetAsideModularSet(SHOW_ENVIRONMENT)),
  // 1B — Forced Interrupt: When a character flips or leaves play, move all threat from that character to this scheme.
  "39025b.mojomania-forced-interrupt": forcedInterrupt(on.characterFlipsOrLeavesPlay(), moveThreat(eventTarget, self)),

  // Wheel of Genres, SPINNING (39026a) — Forced Response: After the encounter deck resets, if there are no set-aside
  // modular encounter sets remaining, the players lose the game. Otherwise, flip this card.
  "39026a.wheel-of-genres-forced-response": forcedResponse(
    on.encounterDeckResets(),
    ifThen(valueEquals(setAsideModularSetCount, 0), endGame("loss"), flipCard(self)),
  ),
  // Wheel of Genres, STOPPED (39026b) — Forced Interrupt: At the start of step three of the villain phase, randomly
  // choose 1 set-aside modular set and reveal its SHOW environment. Shuffle the rest of that modular set and place it
  // on top of the encounter deck. Deal the first player 2 facedown encounter cards and flip this card. Neither flip is
  // a reveal (rulings Jan 26 / Apr 30 / Jun 25, 2026), and the SHOW revealed here does not surge (insert p. 18).
  "39026b.wheel-of-genres-forced-interrupt": forcedInterrupt(
    on.villainStepStarting(),
    revealFromSetAsideModularSet(SHOW_ENVIRONMENT, { placement: "shuffledOnTop" }),
    dealEncounterCard(firstPlayer),
    dealEncounterCard(firstPlayer),
    flipCard(self),
  ),

  // Major Domo (39027) — Attach to Mojo (data; +1 ATK, +1 SCH). [star] Forced Response: After Mojo attacks, discard
  // cards from the encounter deck equal to the amount of damage dealt by that attack.
  "39027.major-domo-forced-response": forcedResponse(
    on.enemyAttacks("host"),
    discardEncounterCards(eventResult("damage")),
  ),
  // Hero Action: Spend [energy][mental][physical] resources → discard this card.
  "39027.major-domo-action": heroAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self)),

  // Stinger Tail (39028) — Attach to Mojo (data; +1 ATK). Mojo gains retaliate 2.
  "39028.stinger-tail-constant": constant(gainsKeyword({ name: "retaliate", value: 2 }, { hostOfSelf: true })),
  // Forced Interrupt: When any amount of damage would be dealt to Mojo, place it here instead. Then, if there is at
  // least 5 damage here, discard Stinger Tail (the way Armored Rhino Suit does, `core/scenarios/rhino.ts`).
  "39028.stinger-tail-forced-interrupt": forcedInterrupt(
    when.damage("host"),
    instead(placeDamage(eventAmount, self), andThen(ifThen(damagedAtLeast(self, 5), discard(self)))),
  ),
  // [star] Boost: Attach this card to Mojo.
  "39028.boost": boost(attachCard(self, theVillain)),

  // Supporting Actor (39029) — [star] Forced Response: After Supporting Actor activates against you, place 2 threat here.
  "39029.supporting-actor-forced-response": forcedResponse(
    on.enemyActivates("self", { againstYou: true }),
    placeThreat(2, self),
  ),
  // Boost: Place 1 threat on each character you control.
  "39029.boost": boost(threatOnEachCharacter(1)),

  // Paparazzi (39030) — Hinder 10 (data, engine-applied to any card type). The obligation's own rules are the engine's.
  "39030.obligation": coveredByEngineRule(),
  // Action: Choose to either exhaust a character you control or discard 1 card from your hand → remove 2 threat from
  // here (3 threat instead if you are in alter-ego form).
  "39030.paparazzi-action": action(
    {
      cost: eitherCost(exhaustCardsCost(CHARACTERS_YOU_CONTROL), discardFromHandCost(1, 1)),
    },
    removeThreat(ifElse(isAlterEgo(), 3, 2), self),
  ),
  // Forced Interrupt: When your turn ends, move all threat from here to the main scheme and discard this card.
  "39030.paparazzi-forced-interrupt": forcedInterrupt(
    { on: "turnEnding", playerIs: "controller" },
    moveThreat(self, theMainScheme),
    discardThisObligation,
  ),

  // Undercover Mojo (39031) — Hinder 2[per_hero] (data). Forced Interrupt: When Mojo would take any amount of damage,
  // remove an equal amount of threat from here instead (§4 Q47: the whole damage is replaced).
  "39031.undercover-mojo-forced-interrupt": forcedInterrupt(
    when.damage(query("villain")),
    instead(removeThreat(eventAmount, self)),
  ),

  // Curtain Call (39032) — When Revealed: Move all threat from the character with the most threat on it to the main
  // scheme. If no threat was moved this way, place 1 threat on each character you control. A tie is the revealing
  // player's pick; only a character with threat on it can be "the character with the most".
  "39032.when-revealed": whenRevealed(
    bindTargets(
      "most",
      superlative("highest", each(query("character", { hasThreat: true })), threatOn(chosen("candidate"))),
    ),
    chooseTarget("from", { inSlot: "most" }),
    moveThreat(chosen("from"), theMainScheme, { bind: "moved" }),
    ifThen(not(made("moved")), threatOnEachCharacter(1)),
  ),
  // [star] Boost: Reveal this card.
  "39032.boost": boost(revealCard(self, you)),

  // Director's Directions (39033) — When Revealed: Choose one: spend 2 different resources; Mojo schemes; take 1 damage
  // for each threat on your identity (if you take less than 2 damage this way, this card gains surge).
  "39033.when-revealed": whenRevealed(
    chooseOne(
      // Pending default (Q51 = B): this option should be offered only to a player who can pay it. There is no "can
      // pay" predicate yet, so it is always offered.
      option("Spend 2 different resources", spendDifferentResources(2, "spent")),
      option("Mojo schemes", enemyScheme(theVillain)),
      option(
        "Take 1 damage for each threat on your identity",
        takeDamageBound(threatOn(yourIdentity), "dealt"),
        ifThen(not(varAtLeast("dealt.amount", 2)), surge()),
      ),
    ),
  ),

  // Top Billing (39034) — When Revealed: Heal 1 damage from each character you control. Place 2 threat on each
  // character you control.
  "39034.when-revealed": whenRevealed(heal(1, each(CHARACTERS_YOU_CONTROL)), threatOnEachCharacter(2)),
  // [star] Boost: Place 1 threat on each character you control.
  "39034.boost": boost(threatOnEachCharacter(1)),
});
