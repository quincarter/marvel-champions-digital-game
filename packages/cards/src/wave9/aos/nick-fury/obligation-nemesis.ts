import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  anyNumberOfToughStatusCards,
  anyOfCards,
  atMost,
  selectCards,
  changeAdditionalForm,
  chooseCards,
  chooseOne,
  choiceFoundNothing,
  chosen,
  coveredByEngineRule,
  constant,
  controllerOf,
  defineAbilities,
  discard,
  encounterCards,
  eachPlayer,
  encounterSetAside,
  each,
  engagedPlayerOf,
  forcedResponse,
  giveTough,
  identityOf,
  ifThen,
  inPlay,
  named,
  not,
  option,
  putIntoPlay,
  query,
  boost,
  removeThreat,
  self,
  dealDamage,
  setAside,
  shuffleEncounterDeck,
  surge,
  takeDamage,
  threatOn,
  valueAtLeast,
  whenRevealed,
} from "../../../dsl/index.js";
import { trait } from "@mc/content";
import { YOUR_SUIT_FORM } from "./identity.js";

/** "Nick Fury" the identity, whoever controls it (Acquire Infinity Formula is an encounter card). */
const NICK_FURY = query("identity", { name: "Nick Fury" });
const FURY_PLAYER = controllerOf(each(NICK_FURY));
const LEVIATHAN_MINION = query("minion", { trait: trait("LEVIATHAN") });
const orionQuery = query("minion", { name: "Orion" });

/**
 * Wave 9 scripting module `aos/nick-fury/obligation-nemesis` (docs/phase7-wave9.md section 8.4, 3.7, 3.8, 3.33).
 *
 * Cards (5):
 * - 50059 Discovered (obligation)
 * - 50060 Orion (minion)
 * - 50061 Acquire Infinity Formula (side_scheme)
 * - 50062 Leviathan Soldier (minion)
 * - 50063 Cold Storage (treachery)
 *
 * **Discovered (50059)**: "Give to the Nick Fury player" is data and engine rule (`discovered-constant` is that line,
 * covered by the engine). When Revealed: change to Assault (threat stays, section 3.7), then no threat on the suit form
 * is surge; otherwise the holder chooses 1 damage per threat on the suit form, or removes each threat. "In either
 * case, discard this card": it is discarded whether it surged or the choice was made.
 *
 * **Orion (50060)**: Toughness is data. He can hold any number of tough status cards; Forced Response: after he takes
 * any amount of damage (damage placed, so a tough card that absorbs it is not "taking"), give him a tough status card.
 *
 * **Acquire Infinity Formula (50061)**: Forced Response: after Nick Fury takes damage, give Orion a tough status card
 * (nothing if he is not in play), then if Orion is not in play find him (encounter deck and discard pile, and the Nick
 * Fury player's set-aside area where the nemesis set waits) and put him into play engaged with the Nick Fury player.
 * Entering with Toughness he holds one tough status card.
 *
 * **Leviathan Soldier (50062)**: Toughness is data. [star] Forced Response: after he schemes, he deals 1 damage to the
 * engaged player's identity.
 *
 * **Cold Storage (50063)**: When Revealed: search the encounter deck and discard pile for a Leviathan minion and put it
 * into play engaged with you, then shuffle; with none to find, take 2 damage. [star] Boost: take 1 damage.
 */
export const NICK_FURY_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "50059.discovered-constant": coveredByEngineRule(),
  "50059.when-revealed": whenRevealed(
    changeAdditionalForm("suit", { toName: "Assault" }),
    ifThen(
      valueAtLeast(threatOn(YOUR_SUIT_FORM), 1),
      chooseOne(
        option("Take 1 damage for each threat on your suit form upgrade", takeDamage(threatOn(YOUR_SUIT_FORM))),
        option(
          "Remove each threat from your suit form upgrade",
          removeThreat(threatOn(YOUR_SUIT_FORM), YOUR_SUIT_FORM),
        ),
      ),
      surge(),
    ),
    // "In either case, discard this card": with or without threat on the suit, as every obligation leaves play.
    discard(self),
  ),

  "50060.orion-constant": constant(anyNumberOfToughStatusCards({ self: true })),
  "50060.orion-forced-response": forcedResponse(after.damage("self", { taken: true }), giveTough(self)),

  "50061.acquire-infinity-formula-forced-response": forcedResponse(
    after.damage(NICK_FURY, { taken: true }),
    giveTough(named("Orion")),
    ifThen(not(inPlay("Orion")), [
      selectCards(
        "orion",
        atMost(
          1,
          anyOfCards(
            encounterCards(["deck", "discard"], orionQuery),
            setAside(eachPlayer, orionQuery),
            encounterSetAside(orionQuery),
          ),
        ),
      ),
      shuffleEncounterDeck(),
      putIntoPlay(chosen("orion"), FURY_PLAYER),
    ]),
  ),

  "50062.leviathan-soldier-forced-response": forcedResponse(
    after.enemySchemes("self"),
    dealDamage(1, identityOf(engagedPlayerOf(self))),
  ),

  "50063.when-revealed": whenRevealed(
    chooseCards("leviathan", encounterCards(["deck", "discard"], LEVIATHAN_MINION), { min: 1, max: 1 }),
    shuffleEncounterDeck(),
    putIntoPlay(chosen("leviathan")),
    ifThen(choiceFoundNothing(), takeDamage(2)),
  ),
  "50063.boost": boost(takeDamage(1)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const NICK_FURY_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
