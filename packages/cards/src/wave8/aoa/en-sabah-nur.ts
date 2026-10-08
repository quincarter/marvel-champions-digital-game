import { trait } from "@mc/content";
import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  addCounters,
  atEndOfActivation,
  boost,
  changeVillainForm,
  constant,
  dealEncounterCard,
  dealIndirectDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterUntil,
  eachPlayer,
  each,
  enemyActivates,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  giveTough,
  hasTrait,
  heal,
  ifThen,
  on,
  placeThreat,
  query,
  removeCountersFrom,
  revealCard,
  self,
  setup,
  stun,
  theMainScheme,
  theVillain,
  valueAtLeast,
  whenDefeated,
  whenRevealed,
  you,
  yourIdentity,
  chosen,
  countersOn,
} from "../../dsl/index.js";

const BIOMORPH = trait("BIOMORPH");
const CYBERPATH = trait("CYBERPATH");
const GIANT = trait("GIANT");
const SUPERPOWER = trait("SUPERPOWER");
const POWER = "power";

/**
 * "Change Apocalypse to [X] form" (MC45 p. 19: a flip, "NOT the same as 'defeating' or 'revealing' the villain").
 * Spec section 3.26 wants this with `reveal: false` (engine queue task 29): today `changeVillainForm` also runs the new
 * face's reveal step, which on these nine faces has nothing to resolve (no When Revealed, incite or surge) and shows
 * only as a reveal in the log. Every use below goes through this one helper, so the flag is a one-line change.
 */
const changeToForm = (form: ReturnType<typeof trait>) => changeVillainForm(theVillain, form);
/** "If Apocalypse is in [X] form": the face showing has that trait. */
const inForm = (form: ReturnType<typeof trait>) => hasTrait(theVillain, form);

/** "After Apocalypse changes to this form": the villain card flipped to this face (a stage change is a reveal, not a flip). */
const changesToThisForm: EventPattern = { on: "cardFlipped", selfIs: "target" };

/** The Biomorph faces' "[star] Apocalypse's attacks gain overkill." */
const overkill = () => constant(gainsKeyword({ name: "overkill" }, { self: true }));
const biomorphResponse = (n: number) => forcedResponse(changesToThisForm, dealIndirectDamage(eachPlayer, n));
const cyberpathResponse = (n: number) => forcedResponse(changesToThisForm, placeThreat(n, each(query("scheme"))));
const giantResponse = (n: number) => forcedResponse(changesToThisForm, heal(n, theVillain));

/**
 * "The first player ... discards cards from the top of the encounter deck until a [SUPERPOWER] card is discarded and
 * reveals it." The first player is "you" on the revealed card. A deck with no such card is emptied, reset, and nothing is
 * revealed (the empty bind reveals nothing).
 */
const revealSuperpower = () => [
  discardEncounterUntil({ trait: SUPERPOWER }, "superpower"),
  revealCard(chosen("superpower"), firstPlayer),
];
/**
 * Both main scheme stages' Forced Response: "After resolving step 1 of the villain phase, place 1 power counter here. If
 * there are at least 4 power counters here, the first player removes 4 of them and ..." The threshold is read only here
 * (a treachery that brings the count to 4 waits for the next step one).
 */
const powerCounters = () =>
  forcedResponse(
    on.villainStepResolved(),
    addCounters(POWER, 1, theMainScheme),
    ifThen(valueAtLeast(countersOn(theMainScheme, POWER), 4), [
      removeCountersFrom(theMainScheme, POWER, 4),
      ...revealSuperpower(),
    ]),
  );

/** The three treacheries: "If Apocalypse is in [X] form, he activates against you. Otherwise, change him and place 1 power counter." */
const formTreachery = (form: ReturnType<typeof trait>) =>
  whenRevealed(
    ifThen(inForm(form), enemyActivates(theVillain, { against: you }), [
      changeToForm(form),
      addCounters(POWER, 1, theMainScheme),
    ]),
  );
/** "[star] Boost: After this activation, change Apocalypse to [X] form." */
const formBoost = (form: ReturnType<typeof trait>) => boost(atEndOfActivation(changeToForm(form)));
/** The three side schemes: "he activates against the player who defeated this scheme. Otherwise ... change ... and give him a tough status card." */
const formScheme = (form: ReturnType<typeof trait>) =>
  whenDefeated(
    ifThen(inForm(form), enemyActivates(theVillain, { against: defeatingPlayer }), [
      changeToForm(form),
      giveTough(theVillain),
    ]),
  );

/**
 * The En Sabah Nur scenario (Age of Apocalypse, docs/phase7-wave8.md section 1.17, 1.18, 2.9, 3.26, 3.27, 4.1 Q16): the
 * three-sided Apocalypse (45184a is the whole villain card, three sides on three stages: A Biomorph, B Cyberpath, C
 * Giant), the main scheme En Sabah Nur's Pyramid / The Rise of Apocalypse (45147a, two stages) and the set's seven cards.
 *
 * A face's Forced Response answers its own flip (`cardFlipped` of itself): turning to Biomorph deals N indirect damage
 * to each player, to Cyberpath places N threat on each scheme in play, to Giant heals N. The starting Biomorph face and a
 * stage change (Q16 = A, the new stage keeps the form) are not flips and resolve none. Retaliate 1 and stalwart are
 * data. The treacheries and side schemes only change the form through `changeToForm`.
 *
 * Skipped: nothing is skipped; the one open gap, queue task 29 (spec 3.26, `changeVillainForm.reveal: false`), only shows in
 * the log (see `changeToForm`).
 *
 * Cards (9):
 * - 45147a En Sabah Nur's Pyramid (main_scheme)
 * - 45149 Staggering Strength (attachment)
 * - 45150 Biomorphic Blast (treachery)
 * - 45151 Technological Interface (treachery)
 * - 45152 Giant-Sized Despot (treachery)
 * - 45153 Source of Power (side_scheme)
 * - 45154 Plugged In (side_scheme)
 * - 45155 Giant Growth (side_scheme)
 * - 45184a Apocalypse (villain)
 */
export const EN_SABAH_NUR: AbilityRegistry = defineAbilities({
  // Apocalypse, Biomorph: [star] his attacks gain overkill. After he changes to this form, indirect damage to each player.
  "45184a.apocalypse-constant": overkill(),
  "45184a.apocalypse-forced-response": biomorphResponse(1),
  "45185a.apocalypse-constant": overkill(),
  "45185a.apocalypse-forced-response": biomorphResponse(2),
  "45186a.apocalypse-constant": overkill(),
  "45186a.apocalypse-forced-response": biomorphResponse(3),
  // Cyberpath (Retaliate 1 is data): threat on each scheme in play.
  "45184b.apocalypse-forced-response": cyberpathResponse(1),
  "45185b.apocalypse-forced-response": cyberpathResponse(2),
  "45186b.apocalypse-forced-response": cyberpathResponse(3),
  // Giant (Stalwart is data): heal him.
  "45184c.apocalypse-forced-response": giantResponse(1),
  "45185c.apocalypse-forced-response": giantResponse(2),
  "45186c.apocalypse-forced-response": giantResponse(3),

  // 1A Setup: Apocalypse begins the game in Biomorph form (the villain's starting side, data). Deal each player a
  // facedown encounter card.
  "45147a.setup": setup(dealEncounterCard(eachPlayer)),
  // 1B and 2B Forced Response (see powerCounters). Completing 2B loses the game (the last stage, RRG p. 27).
  "45147b.en-sabah-nurs-pyramid-forced-response": powerCounters(),
  "45148b.the-rise-of-apocalypse-forced-response": powerCounters(),
  // 2A When Revealed: the first player discards until a [SUPERPOWER] card is discarded and reveals it.
  "45148a.when-revealed": whenRevealed(...revealSuperpower()),

  // Staggering Strength — Attach to Apocalypse (data) and change him to Giant form.
  "45149.staggering-strength-constant": whenRevealed(changeToForm(GIANT)),
  // [star] Forced Interrupt: When Apocalypse attacks you, you are stunned. Discard this card after this activation.
  "45149.staggering-strength-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("host", { againstYou: true }),
    stun(yourIdentity),
    atEndOfActivation(discard(self)),
  ),
  // [star] Boost: After this activation, reveal this card.
  "45149.boost": boost(atEndOfActivation(revealCard(self, firstPlayer))),

  "45150.when-revealed": formTreachery(BIOMORPH),
  "45150.boost": formBoost(BIOMORPH),
  "45151.when-revealed": formTreachery(CYBERPATH),
  "45151.boost": formBoost(CYBERPATH),
  "45152.when-revealed": formTreachery(GIANT),
  "45152.boost": formBoost(GIANT),

  "45153.when-defeated": formScheme(BIOMORPH),
  "45154.when-defeated": formScheme(CYBERPATH),
  "45155.when-defeated": formScheme(GIANT),
});

export const EN_SABAH_NUR_SKIPPED: Readonly<Record<string, string>> = {};
