import {
  activationIs,
  atEndOfActivation,
  attachCard,
  boost,
  choosePlayer,
  chosenPlayer,
  constant,
  dealEncounterCard,
  defineAbilities,
  discard,
  engage,
  engagedPlayerOf,
  enemyAttack,
  enemyScheme,
  eventDealt,
  exists,
  firstPlayer,
  FRIENDLY_CHARACTER,
  forcedInterrupt,
  forcedResponse,
  identityOf,
  ifThen,
  isHero,
  modifyAttack,
  named,
  on,
  placeThreat,
  putIntoPlay,
  query,
  remainingHpOf,
  rule,
  self,
  superlativePlayer,
  surge,
  theMainScheme,
  thatPlayer,
  whenRevealed,
  you,
  yourIdentity,
} from "../../dsl/index.js";

/**
 * The Kree Fanatic modular encounter set (`ron`, 90001–90005; docs/phase7-wave3.md §2.3): a minion (Ronan the
 * Accuser), a side scheme, an attachment, and two treacheries. All five cards' `attachesTo`/keyword data
 * (Toughness on 90001, the side scheme's plain "Forced Response", "Attach to your identity" on 90003) are already
 * data-driven; every ability ref below is the card's own triggered text.
 *
 * **The minion shares a title with `gmw`'s own villain, Ronan the Accuser (16103–16105).** RRG 1.8's "Unique"
 * rule (p. 46, "only one card with a given title may be in play … at a time") keeps them apart at the table; no
 * scripting is needed for that — nothing here or in `gmw/ronan.ts` puts both decks in the same scenario.
 *
 * **Genuine primitive gap (`KNOWN_SKIPPED`): `90005.when-revealed`** — "Discard the top 5 cards of the encounter
 * deck. Each time a card belonging to the Kree Fanatic set is discarded this way, deal that card to yourself as a
 * facedown encounter card." `discardEncounterCards`'s own `forEachDiscarded` plus `refMatches(chosen(...), {
 * encounterSetOf: self })` composes the "belonging to the Kree Fanatic set" half fine (docs/phase7-wave3.md §2.3's
 * own proposed reading), but "deal that card to yourself as a facedown encounter card" needs a `CardDestination`
 * that moves a specific, already-identified card into a player's own dealt-encounter zone facedown — every
 * existing route there (`EffectSpec dealEncounterCard`) instead *draws a new card from the top of the deck*
 * (`packages/engine/src/spec.ts`), and `CardDestination`'s own union (`"hand" | "discard" | "deckTop" |
 * "deckBottom" | "deckShuffle" | "removedFromGame" | "encounterDeckShuffle" | "separateDiscard" |
 * "separateDeckTop" | "separateDeckShuffle" | "encounterSetAside" | { scenarioArea }`) has no "dealt to a player,
 * facedown" option for `moveCards` to redirect an arbitrary card to. §2.3's own note flagged this exact clause as
 * "believed expressible … but not yet proven"; it isn't. `90005.boost` ("If this activation is an attack, that
 * attack gains overkill") needs nothing new and is scripted below.
 */
export const KREE_FANATIC = defineAbilities({
  // Ronan the Accuser (90001, minion) — Toughness (data). Ronan the Accuser cannot be stunned.
  "90001.ronan-the-accuser-constant": constant(
    rule({ kind: "cannotHaveStatus", target: { self: true }, statuses: ["stunned"] }),
  ),
  // Forced Interrupt: When the villain phase begins, Ronan the Accuser engages the hero with the fewest remaining
  // hit points (docs/phase7-wave3.md §3.35's own "the same shape covers the Kree Fanatic's Ronan" note).
  "90001.ronan-the-accuser-forced-interrupt": forcedInterrupt(
    on.phaseBeginning("villain"),
    choosePlayer("fewest", firstPlayer, {
      among: superlativePlayer("lowest", remainingHpOf(identityOf(thatPlayer))),
    }),
    engage(self, chosenPlayer("fewest")),
  ),
  // [star] Boost: Put Ronan the Accuser into play engaged with you.
  "90001.boost": boost(putIntoPlay(self, you)),

  // Judge, Jury, Executioner (90002, side scheme) — Forced Response: After a friendly character is defeated by an
  // enemy attack, place 2 threat on the main scheme. "Friendly" is `FRIENDLY_CHARACTER` (identity or ally) — not
  // `controller: "you"`, which resolves against this card's own controller and this is an unowned side scheme
  // (no controller to be "you"), so it would never match anyone.
  //
  // "By an enemy attack" is `on.defeated(…, { byAttackFrom: query("enemy") })`, now enforced for real. An
  // identity's own defeat previously carried no `fromAttack`/`sourceInstanceId` at all — unlike the ally/minion
  // path, which always did — so this filter would have silently and permanently excluded every identity defeat,
  // even ones genuinely caused by an enemy attack (the very case this Forced Response exists for). Fixed
  // generically: `checkDefeats`'s identity-elimination path (`packages/engine/src/resolve/defeat.ts`) now threads
  // the same `DefeatHint` (`fromAttack`/`sourceInstanceId`/`defeatedByPlayerId`) the ally/minion and villain paths
  // already carried, tested in `packages/engine/src/identity-defeat-from-attack.test.ts`.
  "90002.judge-jury-executioner-forced-response": forcedResponse(
    on.defeated(FRIENDLY_CHARACTER, { byAttackFrom: query("enemy") }),
    placeThreat(2, theMainScheme),
  ),
  // [star] Boost: Put Judge, Jury, Executioner into play.
  "90002.boost": boost(putIntoPlay(self, you)),

  // The Accused (90003, attachment) — Attach to your identity (data). Forced Interrupt: When an enemy initiates
  // an attack against the attached identity, that enemy gets +1 ATK for the attack.
  "90003.the-accused-forced-interrupt": forcedInterrupt(
    { on: "enemyAttack", targetIs: { hostOfSelf: true } },
    modifyAttack({ atkBonus: 1 }),
  ),
  // Forced Response: After Ronan the Accuser is defeated, discard this card.
  "90003.the-accused-forced-response": forcedResponse(on.defeated({ name: "Ronan the Accuser" }), discard(self)),
  // [star] Boost: Attach to your identity.
  "90003.boost": boost(attachCard(self, yourIdentity)),

  // Bring the Hammer Down (90004, treachery) — When Revealed: Ronan the Accuser activates against the player he
  // is engaged with (RRG 1.8 "Activation" — a minion attacks an engaged player in hero form, schemes against one
  // in alter-ego form). If Ronan the Accuser is not in play, this card gains surge.
  "90004.when-revealed": whenRevealed(
    ifThen(
      exists(query("minion", { name: "Ronan the Accuser" })),
      ifThen(
        isHero(engagedPlayerOf(named("Ronan the Accuser"))),
        enemyAttack(named("Ronan the Accuser"), { against: engagedPlayerOf(named("Ronan the Accuser")) }),
        enemyScheme(named("Ronan the Accuser"), { against: engagedPlayerOf(named("Ronan the Accuser")) }),
      ),
      surge(),
    ),
  ),
  // [star] Boost: If this activation defeats a character, deal the first player 1 facedown encounter card.
  "90004.boost": boost(atEndOfActivation(ifThen(eventDealt("defeated"), dealEncounterCard(firstPlayer)))),

  // You Dare Oppose Me? (90005, treachery) — When Revealed: SKIPPED (module docblock, genuine primitive gap:
  // no `CardDestination` deals a specific already-known card to a player facedown).
  // [star] Boost: If this activation is an attack, that attack gains overkill.
  "90005.boost": boost(ifThen(activationIs("attack"), modifyAttack({ overkill: true }))),
});
