import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  addCounters,
  after,
  anAttackableEnemy,
  anyOf,
  attack,
  attackAnEnemy,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  defineAbilities,
  enemyScheme,
  exists,
  exhaustThis,
  gainsTrait,
  gets,
  giveTough,
  hasTrait,
  heroAction,
  ifElse,
  moveCards,
  namedByTeamUpOf,
  not,
  on,
  playOnlyIf,
  printedHpOf,
  query,
  remainingHpOf,
  response,
  self,
  shuffleDeck,
  TEAM_UP_CARD,
  theVillain,
  valueAtLeast,
  valueAtMost,
  YOUR_IDENTITY,
  yourIdentity,
  you,
  zone,
} from "../../dsl/index.js";
import { JJ_BASIC } from "../jj/basic.js";

const GIANT = trait("GIANT");
const MARTIAL_ARTIST = trait("MARTIAL ARTIST");
/** "A Martial Artist card" a player controls: an identity, ally, support or upgrade (an encounter card is no player's). */
const MARTIAL_ARTIST_CARD = query(["identity", "ally", "support", "upgrade"], {
  controller: "any",
  trait: MARTIAL_ARTIST,
});
/** "After you recover": the basic recovery has resolved (`basicPowerUsed` narrowed to the recover power). */
const YOU_RECOVER = { ...on.basicPowerUsed(YOUR_IDENTITY), eventIs: { power: "recover" } } as const;
const SEARCHED = ["deck", "discard"] as const;

/**
 * Wave 11 scripting module `luke_cage/other-aspects-basic` (docs/phase7-wave11-hero-packs.md H8.4, H3.20).
 *
 * Cards (12):
 * - 62020 Hulk (ally)
 * - 62021 She-Hulk (ally)
 * - 62022 Dynamic Duo (event)
 * - 62023 Power Man and Iron Fist (event)
 * - 62024 Unbreakable Bond (event)
 * - 62025 Energy (resource)
 * - 62026 Genius (resource)
 * - 62027 Strength (resource)
 * - 62034 Size Advantage (event)
 * - 62035 Observe (event)
 * - 62036 Toughen Up (upgrade)
 * - 62037 Black Belt (upgrade)
 *
 * Prints no ability, nothing to script: 62025 Energy, 62026 Genius, 62027 Strength.
 *
 * **62020**: +1 ATK per rage counter on Hulk; the response places one after the villain attacks you (the villain
 * only, not a minion). His THW is a dash (data), so he cannot thwart. **62021**: Toughness is data; the response gives
 * your identity (not Luke Cage by name) a tough status card, a tough card of the identity's own limit (one, unless the
 * identity holds any number).
 *
 * **62022**: Team-Up card, then an ally its keyword names (title or subtitle, RRG 1.8 "Team-Up", p. 43), both from the
 * deck and discard pile; each pick is compulsory when a match exists (RRG 1.8 "Search", p. 39 has no "may"; wave 10 49A) and the deck is shuffled.
 * **62023**: Team-Up is data. "(attack)": 2 damage to an enemy, then a tough status card on any character (a character
 * is a hero, ally, villain or minion, RRG 1.8 "Character", p. 11). **62024** is 61027's script (a reprint).
 *
 * **62034**: the chosen enemy is read before the amount: 6 if you have the Giant trait or more remaining hit points than
 * it, else 3. **62035**: the villain schemes, then your hero gets a tough card. **62036**: after a basic recovery, if your
 * remaining hit points are at least your printed ("base", RRG 1.8 p. 10) hit points, exhaust to give your identity a
 * tough status card; the condition is checked before the cost is paid.
 *
 * **62037**: "Play only if any player controls a Martial Artist card" is the play restriction (checked at play, never
 * after); the attached character gets +1 hit point and the Martial Artist trait. Attach and Max 1 per character are data.
 */
export const LUKE_CAGE_OTHER_ASPECTS_BASIC: AbilityRegistry = defineAbilities({
  "62020.hulk-constant": constant(gets("atk", countersOn(self, "rage"), { self: true })),
  "62020.hulk-response": response(after.villainAttacks({ againstYou: true }), addCounters("rage", 1, self)),

  "62021.she-hulk-response": response(after.entersPlay("self"), giveTough(yourIdentity)),

  "62022.dynamic-duo-action": action(
    chooseCards("teamUp", zone([...SEARCHED], you, { filter: TEAM_UP_CARD }), { min: 1, max: 1 }),
    chooseCards("ally", zone([...SEARCHED], you, { filter: query("ally", namedByTeamUpOf(chosen("teamUp"))) }), {
      min: 1,
      max: 1,
    }),
    moveCards(cards(chosen("teamUp")), "hand"),
    moveCards(cards(chosen("ally")), "hand"),
    shuffleDeck(),
  ),

  "62023.power-man-and-iron-fist-action": heroAction(
    { label: "attack" },
    attackAnEnemy(2),
    chooseTarget("tough", query("character")),
    giveTough(chosen("tough")),
  ),

  "62024.unbreakable-bond-action": JJ_BASIC["61027.unbreakable-bond-action"]!,

  "62034.size-advantage-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(
      ifElse(
        anyOf(
          hasTrait(yourIdentity, GIANT),
          not(valueAtMost(remainingHpOf(yourIdentity), remainingHpOf(chosen("enemy")))),
        ),
        6,
        3,
      ),
      chosen("enemy"),
    ),
  ),

  "62035.observe-action": heroAction(enemyScheme(theVillain), giveTough(yourIdentity)),

  "62036.toughen-up-response": response(
    YOU_RECOVER,
    { while: valueAtLeast(remainingHpOf(yourIdentity), printedHpOf(yourIdentity)), cost: exhaustThis },
    giveTough(yourIdentity),
  ),

  "62037.black-belt-constant": constant(playOnlyIf(exists(MARTIAL_ARTIST_CARD))),
  "62037.black-belt-constant-2": constant(
    gets("hp", 1, { hostOfSelf: true }),
    gainsTrait(MARTIAL_ARTIST, { hostOfSelf: true }),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const LUKE_CAGE_OTHER_ASPECTS_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
