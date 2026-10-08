import { trait } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";
import {
  after,
  applyRuleUntil,
  atEndOfAttack,
  attackInProgress,
  attackedBy,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  countOf,
  dealDamage,
  defineAbilities,
  eachPlayer,
  eventDealt,
  forEachPlayer,
  gets,
  hasAttachment,
  heal,
  heroAction,
  heroInterrupt,
  ifThen,
  type losesIcon,
  moveCards,
  cards,
  modifyCardEffectsUntil,
  modifyStat,
  on,
  query,
  ready,
  removeThreat,
  response,
  shuffleDeck,
  thatPlayer,
  when,
  whenDefeated,
  YOUR_HERO,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";

const X_MEN = trait("X-MEN");
const ATTACK_EVENT = query("event", { trait: trait("ATTACK") });

/** "an enemy with an upgrade attached": any player's upgrade (docs/phase7-wave8.md section 3.67). */
const ENEMY_WITH_UPGRADE = query("enemy", hasAttachment(query("upgrade")));

/** The existing script of a card this one reprints, found by its ability id (docs/phase7-wave8.md section 3.81). */
function reprintOf(id: string): AbilityDefinition {
  const definition = WAVE7_ABILITIES[id];
  if (!definition) throw new Error(`reprint source ${id} is not scripted`);
  return definition;
}

/** The four icons Shadowcat's lasting effect removes, in the printed order. */
const SHADOWCAT_ICONS: readonly Parameters<typeof losesIcon>[0][] = ["acceleration", "amplify", "crisis", "hazard"];

/**
 * Iceman pack aspect and basic player cards, docs/phase7-wave8.md section 7.2, 3.67, 3.68, 3.70.
 *
 * Cards (12):
 * - 46012 Shark-Girl (ally)
 * - 46013 Glob (ally)
 * - 46014 Suppressing Fire (upgrade)
 * - 46015 Surprise Move (event)
 * - 46016 Take That! (event)
 * - 46017 Looking for Trouble (event)
 * - 46018 Keep Up the Pressure (player_side_scheme)
 * - 46019 Shadowcat (ally)
 * - 46020 Beak (ally)
 * - 46021 Team-Building Exercise (support)
 * - 46022 Recuperation (event)
 * - 46023 The Power in All of Us (resource)
 *
 * **Reprints, one script under two ids**: Looking for Trouble 46017 is `gmw` 16043's, Team-Building Exercise 46021 is
 * `ant` 12024's, Recuperation 46022 is `scw` 15031's and The Power in All of Us 46023 is 13024's.
 *
 * **Keep Up the Pressure (46018)**: When Defeated, each player may take an ATTACK event from their deck or discard pile
 * (the deck is shuffled either way), then until the end of the phase each ATTACK event deals 1 additional damage
 * (`modifyCardEffectsUntil`): every instance of damage an event with the ATTACK trait deals while it lasts, whoever
 * plays it (owner ruling Q53; RRG 1.8 "Attack (Player Ability Type)", p. 10, and "Event", p. 19), never an instance
 * that is itself additional damage and never damage its own player takes.
 *
 * **Shark-Girl (46012)**: a constant on herself, live only while an attack of hers against an enemy is in progress, whose
 * amount counts the upgrades attached to the enemy that attack is against (`attackedBy()`, read off the attack on the
 * stack). An upgrade attached during the attack before its damage is dealt counts.
 *
 * **Glob (46013)**: the target is part of the Response, so with no enemy that has an upgrade attached he answers
 * nothing. "Play only if your identity has the X-Men trait" is card data (`playRestrictions`).
 *
 * **Suppressing Fire (46014)**: "you" is the hero, so an ally's attack that defeats the minion does not count (as
 * Change of Fortune, `ncrawler` 48014). It is an Interrupt to the defeat, so the heal resolves while the minion and the
 * upgrade are still in play.
 *
 * **Surprise Move (46015)**: the target is checked when the card is played, so an upgrade attached by an earlier
 * Interrupt to the same attack (Iceman's "Freeze!") counts: the interrupt window offers Surprise Move once "Freeze!"
 * has resolved (the engine's `heardAtOpen`). "If this attack defeats that enemy" is read when the attack ends.
 *
 * **Take That! (46016)** is an "(attack)" ability that only deals damage: the engine makes it one attack by the
 * identity (Q48 = A), so its damage is attack damage, guard limits the choice (Q49) and retaliate and "after you
 * attack" answer it.
 *
 * **Shadowcat (46019)**: the chosen side scheme loses each of the four icons until the end of the round, as a lasting
 * rule (docs/phase7-wave6.md section 3.38).
 */
export const ICEMAN_ASPECT_BASIC: AbilityRegistry = defineAbilities({
  "46012.shark-girl-constant": constant(
    gets(
      "atk",
      countOf(query("upgrade", { host: attackedBy() })),
      { self: true },
      { while: attackInProgress({ attacker: { self: true }, target: query("enemy") }) },
    ),
  ),

  "46013.glob-response": response(
    on.entersPlay("self"),
    chooseTarget("enemy", ENEMY_WITH_UPGRADE),
    dealDamage(2, chosen("enemy")),
  ),

  "46014.suppressing-fire-interrupt": heroInterrupt(
    { ...when.defeated(query("minion", { hostOfSelf: true }), { byYou: true }), sourceIs: YOUR_HERO },
    heal(2, yourIdentity),
  ),

  "46015.surprise-move-interrupt": heroInterrupt(
    on.attacks(YOUR_HERO, { basic: true, target: ENEMY_WITH_UPGRADE }),
    modifyStat("atk", 2, yourIdentity, "endOfAttack"),
    atEndOfAttack(ifThen(eventDealt("defeated"), ready(yourIdentity))),
  ),

  "46016.take-that-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy", ENEMY_WITH_UPGRADE),
    dealDamage(7, chosen("enemy")),
  ),

  "46017.looking-for-trouble-action": reprintOf("16043.looking-for-trouble-action"),

  "46018.when-defeated": whenDefeated(
    forEachPlayer(
      eachPlayer,
      chooseCards("found", zone(["deck", "discard"], thatPlayer, { filter: ATTACK_EVENT }), {
        min: 0,
        max: 1,
        chooser: thatPlayer,
      }),
      moveCards(cards(chosen("found")), "hand"),
      shuffleDeck(thatPlayer),
    ),
    modifyCardEffectsUntil(ATTACK_EVENT, { damage: 1 }, "endOfPhase"),
  ),

  "46019.shadowcat-response": response(
    after.youPlayThis(),
    chooseTarget("scheme", query("sideScheme")),
    ...SHADOWCAT_ICONS.map((icon) =>
      applyRuleUntil({ kind: "gainsIcon", icon, target: { inSlot: "scheme" }, loses: true }, "endOfRound"),
    ),
  ),

  "46020.beak-response": response(
    after.youPlayThis(),
    chooseTarget("scheme", query("scheme")),
    removeThreat(countOf(query("ally", { trait: X_MEN, controller: "you" })), chosen("scheme")),
  ),

  "46021.team-building-exercise-action": reprintOf("12024.team-building-exercise-action"),
  "46022.recuperation-action": reprintOf("15031.recuperation-action"),
  "46023.the-power-in-all-of-us-constant": reprintOf("13024.the-power-in-all-of-us-constant"),
});

/** Drafts of skipped refs, exported for the proofs in the test file. None is left: every ref is registered. */
export const ICEMAN_ASPECT_BASIC_DRAFTS: AbilityRegistry = {};

/** Refs left unregistered, each with its reason. None is left. */
export const ICEMAN_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
