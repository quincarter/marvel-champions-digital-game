import {
  addAccelerationToken,
  alterEgoAction,
  boost,
  chosen,
  constant,
  dealAsEncounterCard,
  defineAbilities,
  discard,
  discardEncounterCards,
  encounterSetOf,
  enemyAttack,
  enemyScheme,
  eachPlayer,
  exhaustYourHero,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  heroAction,
  ifThen,
  moveCards,
  not,
  on,
  cards,
  placeThreat,
  refMatches,
  resolveSpecialsOf,
  revealCard,
  self,
  shuffleInSetAsideModularSet,
  special,
  spend,
  atEndOfActivation,
  theMainScheme,
  theVillain,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  setup,
} from "../../dsl/index.js";
import type { EffectArg } from "../../dsl/index.js";

/**
 * The Hood scenario pack (`hood`, docs/phase7-wave4.md §2.3): the villain The Hood (I/II/III, 24001–24003), the main
 * scheme Making Connections → Promised Prosperity → Crime State (24004–24006), and The Hood's own encounter set
 * (24007–24013). The pack's nine modular sets, Standard II and Expert II are scripted in later files/passes
 * (`../coverage.test.ts`'s own `KNOWN_SKIPPED.hood`).
 *
 * **"Foul Play - Special:" (the villain's own ability, one version per stage) is the pack's central building
 * block.** Nineteen other refs in this pack (and more in the modular sets) read "resolve The Hood's 'Foul Play'
 * ability" rather than repeating its text, so it is scripted once per stage as a `special()` ability on the villain
 * card and invoked everywhere else with `resolveSpecialsOf(theVillain)` (RRG 1.8 "Special", the `resolveSpecials`
 * effect already used for Nebula's Technique attachments, docs/phase7-wave3.md's own "Special" pattern). A `special`
 * ability resolved this way inherits its caller's controller when the resolved card (the villain, uncontrolled) has
 * none of its own (`resolve/effects-frame.ts`'s `executeResolveSpecials`), so "yourself" inside Foul Play reads as
 * whichever player the calling ability's "you" already was — the engaged/revealing/defeating player, or (via
 * `forEachPlayer`) each player in turn.
 *
 * **Foul Play's own "deal that (already-discarded) card to yourself as a facedown encounter card"** is
 * `dealAsEncounterCard` (`ron` 90005's "You Dare Oppose Me?", docs/phase7-wave3.md §3.47) applied to the specific
 * instance a `discardEncounterCards`-bound slot names — not `dealEncounterCard`, which always draws a fresh top
 * card. "The first card discarded this way that does not belong to The Hood encounter set" (stage II) is expressed
 * by discarding one card at a time (functionally identical to discarding both at once, since neither draw can see
 * the other) and short-circuiting with a nested `ifThen`, rather than any new "first matching" primitive.
 *
 * **Known gap (not modeled — see `../coverage.test.ts`'s `KNOWN_SKIPPED.hood`):** Promised Prosperity's (24005b)
 * "For each player who was not dealt at least 1 facedown encounter card this way, place 2 threat here" needs a way
 * to measure, per player, how many facedown encounter cards a *nested* resolution (`resolveSpecials`) dealt them —
 * there is no `bind` on `resolveSpecials`/`dealAsEncounterCard` reporting a count the way `discardEncounterCards`
 * reports `<bind>.count`, and no primitive to snapshot a `dealtEncounterCount(player)` before an effect runs and
 * compare it after. The ability's first sentence ("each player must resolve Foul Play in player order") is fully
 * scripted; only the "place 2 threat" half is skipped, as `24005b.when-revealed-threat-if-not-dealt` is not
 * registered (the base `24005b.when-revealed` ref *is* registered and covers the first sentence — see the ref
 * table in the module's own test file for exactly which text each ref covers).
 */

/** "The player must resolve The Hood's 'Foul Play' ability" for the ambient "you" (whoever the calling ability's
 * controller already is: the engaged/revealing/defeating player). */
const foulPlay = (): EffectArg => resolveSpecialsOf(theVillain);
/** "Each player must resolve The Hood's 'Foul Play' ability in player order." */
const foulPlayForEachPlayer = (): EffectArg => forEachPlayer(eachPlayer, foulPlay());

/** "If that card does not belong to The Hood encounter set, deal it to yourself as a facedown encounter card" for a
 * card already bound to `slot` by an earlier `discardEncounterCards`. */
const dealIfNotHood = (slot: string): EffectArg =>
  ifThen(
    not(refMatches(chosen(slot), encounterSetOf(theVillain), { anywhere: true })),
    dealAsEncounterCard(chosen(slot), you),
  );

/** The Hood (I), 24001: "Discard the top card of the encounter deck. If that card does not belong to The Hood
 * encounter set, deal it to yourself as a facedown encounter card." */
const foulPlayOneCard = (): AbilityEffects => [discardEncounterCards(1, { bind: "d" }), dealIfNotHood("d")];
/** The Hood (II), 24002: "Discard the top 2 cards of the encounter deck. Deal the first card discarded this way
 * that does not belong to The Hood encounter set to yourself as a facedown encounter card." Discarding one at a
 * time and short-circuiting on the first match reads identically to discarding both up front — neither draw can
 * see the other — and gives "the first … that does not belong" its exact meaning. */
const foulPlayFirstOfTwo = (): AbilityEffects => [
  discardEncounterCards(1, { bind: "d1" }),
  discardEncounterCards(1, { bind: "d2" }),
  ifThen(
    not(refMatches(chosen("d1"), encounterSetOf(theVillain), { anywhere: true })),
    dealAsEncounterCard(chosen("d1"), you),
    dealIfNotHood("d2"),
  ),
];
/** The Hood (III), 24003: "Discard the top 2 cards of the encounter deck. Deal each card discarded this way that
 * does not belong to The Hood encounter set to yourself as a facedown encounter card." */
const foulPlayEachOfTwo = (): AbilityEffects => [
  discardEncounterCards(2, { forEachDiscarded: { slot: "d", effects: [dealIfNotHood("d")] } }),
];

type AbilityEffects = readonly EffectArg[];

export const HOOD = defineAbilities({
  // The Hood (I), 24001 (villain, stage 1) — Foul Play - Special (one discard).
  "24001.the-hood-constant": special(...foulPlayOneCard()),

  // The Hood (II), 24002 (villain, stage 2) — When Revealed: choose 1 set-aside modular set at random, shuffle it
  // into the encounter deck. Foul Play - Special (discard 2, deal the first non-Hood card).
  "24002.when-revealed": whenRevealed(shuffleInSetAsideModularSet()),
  "24002.the-hood-constant": special(...foulPlayFirstOfTwo()),

  // The Hood (III), 24003 (villain, stage 3) — same When Revealed. Foul Play - Special (discard 2, deal each
  // non-Hood card).
  "24003.when-revealed": whenRevealed(shuffleInSetAsideModularSet()),
  "24003.the-hood-constant": special(...foulPlayEachOfTwo()),

  // Making Connections (24004a, main scheme stage 1 front) — Setup: choose 1 set-aside modular set at random and
  // shuffle it into the encounter deck ("choose 7 modular encounter sets and set them aside" is the scenario
  // builder's own setup, docs/phase7-wave4.md §3.18: `HOOD_ABILITIES`'s own scenario builder passes
  // `setAsideModularSets` for the seven chosen sets before this Setup ability ever runs).
  "24004a.setup": setup(shuffleInSetAsideModularSet()),
  // Making Connections (24004b, main scheme stage 1 back) — When Revealed: each player resolves Foul Play in
  // player order.
  "24004b.when-revealed": whenRevealed(foulPlayForEachPlayer()),

  // Promised Prosperity (24005a, main scheme stage 2 front) — When Revealed: choose 1 set-aside modular set at
  // random, shuffle it into the encounter deck. Place 1 acceleration token on the main scheme.
  "24005a.when-revealed": whenRevealed(shuffleInSetAsideModularSet(), addAccelerationToken()),
  // Promised Prosperity (24005b, main scheme stage 2 back) — When Revealed: each player resolves Foul Play in
  // player order. (The "place 2 threat for each player not dealt a card this way" half is the module docblock's
  // known gap — not modeled.)
  "24005b.when-revealed": whenRevealed(foulPlayForEachPlayer()),

  // Crime State (24006a, main scheme stage 3 front) — When Revealed: choose 1 set-aside modular set at random,
  // shuffle it into the encounter deck. Place 1 acceleration token on the main scheme. Each player resolves Foul
  // Play in player order.
  "24006a.when-revealed": whenRevealed(shuffleInSetAsideModularSet(), addAccelerationToken(), foulPlayForEachPlayer()),
  // Crime State (24006b, main scheme stage 3 back; `completionLoses` is data) — [star] Forced Response: after
  // resolving step one of the villain phase, each player resolves Foul Play in player order.
  "24006b.crime-state-forced-response": forcedResponse(on.villainStepResolved(), foulPlayForEachPlayer()),

  // Established Dominance (24007, attachment; "Attach to your identity" is data) — Forced Response: after The Hood
  // activates against you, resolve Foul Play. Alter-Ego Action: exhaust your identity (cost) — place 2 threat on
  // the main scheme, discard this card (leading effects, not part of the cost shape).
  "24007.established-dominance-forced-response": forcedResponse(on.villainAttacks({ againstYou: true }), foulPlay()),
  "24007.established-dominance-action": alterEgoAction(
    { cost: exhaustYourHero },
    placeThreat(2, theMainScheme),
    discard(self),
  ),

  // The Hood's Mantle (24008, attachment; "Attach to The Hood", ARMOR is data) — The Hood gains retaliate 1 and
  // steady. Hero Action: spend [energy][mental][physical] resources → discard this card.
  "24008.the-hoods-mantle-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, { hostOfSelf: true }),
    gainsKeyword({ name: "steady" }, { hostOfSelf: true }),
  ),
  "24008.the-hoods-mantle-action": heroAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self)),

  // The Hood's Pistol (24009, attachment; "Attach to The Hood", WEAPON/statModifiers/starIcon are data) — Hero
  // Action: spend [mental][physical] resources → discard this card. [star] Boost: reveal this card.
  "24009.the-hoods-pistol-action": heroAction({ cost: spend({ mental: 1, physical: 1 }) }, discard(self)),
  "24009.boost": boost(revealCard(self)),

  // Madame Masque (24010, minion; Guard is data) — When Revealed: resolve Foul Play. When Defeated: the defeating
  // player resolves Foul Play (a minion's own "When Defeated" is already scoped to the player it was engaged
  // with, which is the player who defeated it).
  "24010.when-revealed": whenRevealed(foulPlay()),
  "24010.when-defeated": whenDefeated(foulPlay()),

  // Unbridled Ambition (24011, side scheme; Hinder is data) — Forced Interrupt: when the villain phase begins,
  // each player resolves Foul Play in player order.
  "24011.unbridled-ambition-forced-interrupt": forcedInterrupt(on.phaseBeginning("villain"), foulPlayForEachPlayer()),

  // Field Recruitment (24012, treachery; starIcon is data) — When Revealed: choose 1 set-aside modular set at
  // random, shuffle it into the encounter deck; resolve Foul Play; remove this card from the game. [star] Boost:
  // after this activation ends, resolve Foul Play.
  "24012.when-revealed": whenRevealed(
    shuffleInSetAsideModularSet(),
    foulPlay(),
    moveCards(cards(self), "removedFromGame"),
  ),
  "24012.boost": boost(atEndOfActivation(foulPlay())),

  // Upper Hand (24013, treachery) — When Revealed (Alter-Ego): The Hood schemes; resolve Foul Play. When Revealed
  // (Hero): The Hood attacks you; resolve Foul Play.
  "24013.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(theVillain), foulPlay()),
  "24013.when-revealed-hero": whenRevealedHero(enemyAttack(theVillain), foulPlay()),
});
