import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  anAttackableEnemy,
  attachCard,
  attack,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  countOf,
  defineAbilities,
  discardEncounterUntil,
  attackAnEnemy,
  damageAnEnemy,
  dealDamage,
  discardThis,
  exhaustCardsCost,
  exhaustThis,
  exists,
  eventSource,
  gainsKeyword,
  gainsTrait,
  gets,
  giveStatus,
  heal,
  ifThen,
  heroAction,
  heroResponse,
  interrupt,
  modifyAttack,
  moveCards,
  on,
  printedCostOf,
  putIntoPlay,
  query,
  ready,
  reduceNextCardCost,
  removeCounter,
  response,
  self,
  shuffleDeck,
  teamUpCharacters,
  varAtLeast,
  yourIdentity,
  you,
  zone,
} from "../../dsl/index.js";
import { NOVA_EVENTS } from "../../wave5/nova/events.js";
import { PREPARATION_CARD, onAbilityResolvedOf } from "../../wave1/bkw/local.js";
import { AOS_ASPECT_BASIC } from "../aos/aspect-basic.js";

const SHIELD = trait("S.H.I.E.L.D.");
const WEAPON = trait("WEAPON");
const ATTACK = trait("ATTACK");
const PREPARATION = trait("PREPARATION");
const SIDEARM = "S.H.I.E.L.D. Sidearm";

/**
 * Wave 9 scripting module `winter/aspect-basic` (docs/phase7-wave9.md section 8.4, 3.51, 3.52): 54012 to 54026, 54032
 * and 54033. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * **54012.captain-america-response**: "a S.H.I.E.L.D. character" is any character with the trait, any player's, an
 * identity in either form included; it need not be exhausted.
 *
 * **54013.deathlok-response**: the search covers the deck and the discard pile and is compulsory when a copy of
 * S.H.I.E.L.D. Sidearm is there (owner ruling: a search with no "may"). The copy is attached to Deathlok straight from
 * where it was found, which is how it enters play (RRG "Enters Play", p. 18), so it arrives with its 3 ammo counters; a
 * Sidearm already on the identity changes nothing (tested). The deck is shuffled (also when nothing was found).
 *
 * **54014.firepower-action**: "up to 3" in a cost is 1 to 3 (RRG "Cost", p. 13). ONE attack with up to three damage
 * assignments (owner, docs/phase7-wave9.md section 4.1 row 21 = B): the first assignment is the `attack` effect, the
 * second and third (when 2 or 3 Weapons were exhausted, `n`) are `dealDamage` to an enemy chosen for each, which the
 * engine counts as that attack's damage (attack-ability.ts). So it is one attack for "after you attack" and "attacks
 * and defeats" (offered once), "this attack gains ranged" covers every assignment and every target (no retaliate), the
 * same enemy may be chosen again, and a modifier to the event applies to each assignment (RRG "'For Each'", p. 20).
 * Guard: each assignment's choice is made when it resolves and offers only enemies you may attack then (RRG "'For
 * Each'" p. 20: a guard minion defeated by one instance makes the villain a valid target for the next); there is no
 * overkill.
 *
 * **54015.one-by-one-action**: a reprint of One by One 28014 (same text), aliased.
 *
 * **54016.spoiling-for-a-fight-action**: everything before the arrow is a cost, but the game gives no way to decline
 * the discard (Defender of the Nine Realms 06003 is scripted the same way): the cards are discarded, the minion put into
 * play engaged with you, and the hero readied.
 *
 * **54017.aggressive-stance-response**: "after you engage a minion" is `minionEngaged` for the controller; the search is
 * compulsory when an Attack event is in the deck. "Max 1 per player" is data.
 *
 * **54018.bambino-constant / 54018.bambino-interrupt**: restricted only while attached to an identity. The interrupt is
 * to a basic attack by the attached character (not a hero interrupt: it may be attached to an ally); Uses is data.
 *
 * **54019.man-on-the-wall-action**: the reduction counts the minions engaged with you as the action resolves. "Play only
 * if your identity has the Soldier trait" is data.
 *
 * **54020.shield-sidearm-interrupt**: "exhaust and remove 1 ammo counter" are both costs (everything before the arrow);
 * "makes a basic attack" is `on.attacks` of the host, so it works on an ally or an identity. Uses and "Limit 1 per
 * character" (`maxPerHost`) are data. The 1 damage goes to any enemy, chosen on resolution.
 *
 * **54021.nick-fury-sr-forced-response**: a reprint of 50054 (same name, cost, stats, traits and text), aliased.
 *
 * **54022.super-soldiers-action / 54023.winter-widow-soldier-spy-action**: Team-Up is data and checked on play by the
 * engine (both named characters friendly and in play). "Each" of the two named characters is `teamUpCharacters()`, read
 * from the card's own keyword. Winter, Widow, Soldier, Spy puts a Preparation upgrade from the discard pile into play
 * first (compulsory when one exists, no "may"), as playing it would attach it, then deals 4.
 *
 * **54032.white-widow-response**: "after you resolve the ability of a Preparation card you control" is
 * `abilityResolved` (errata'd "trigger" to "resolve", RRG 1.8 p. 66, as Widowmaker 08001a). The heal is the printed cost
 * of the resolved card's source, from White Widow only.
 *
 * **54033.shield-deputy-constant**: scripted to the current text (RRG 1.8 p. 70 added "Max 1 per character", carried
 * by `playRestrictions.maxPerHost` in the data): the attached character gets +1 hit point and gains S.H.I.E.L.D.
 *
 * Cards (17):
 * - 54012 Captain America (ally)
 * - 54013 Deathlok (ally)
 * - 54014 Firepower (event)
 * - 54015 One by One (event)
 * - 54016 Spoiling for a Fight (event)
 * - 54017 Aggressive Stance (upgrade)
 * - 54018 Bambino (upgrade)
 * - 54019 Man on the Wall (upgrade)
 * - 54020 S.H.I.E.L.D. Sidearm (upgrade)
 * - 54021 Nick Fury, Sr. (ally)
 * - 54022 Super-Soldiers (event)
 * - 54023 Winter, Widow, Soldier, Spy (event)
 * - 54024 Energy (resource)
 * - 54025 Genius (resource)
 * - 54026 Strength (resource)
 * - 54032 White Widow (ally)
 * - 54033 S.H.I.E.L.D. Deputy (upgrade)
 */
export const WINTER_ASPECT_BASIC: AbilityRegistry = defineAbilities({
  "54012.captain-america-response": response(
    after.entersPlay("self"),
    chooseTarget("character", query("character", { trait: SHIELD })),
    ready(chosen("character")),
  ),

  "54013.deathlok-response": response(
    after.entersPlay("self"),
    chooseCards("found", zone(["deck", "discard"], you, { filter: query("upgrade", { name: SIDEARM }) }), {
      min: 1,
      max: 1,
    }),
    attachCard(chosen("found"), self),
    shuffleDeck(),
  ),

  "54014.firepower-action": heroAction(
    { label: "attack", cost: exhaustCardsCost(query("upgrade", { trait: WEAPON }), { min: 1, max: 3, bind: "n" }) },
    anAttackableEnemy("enemy"),
    attack(3, chosen("enemy"), { keywords: ["ranged"] }),
    ifThen(varAtLeast("n", 2), [anAttackableEnemy("enemy2"), dealDamage(3, chosen("enemy2"))]),
    ifThen(varAtLeast("n", 3), [anAttackableEnemy("enemy3"), dealDamage(3, chosen("enemy3"))]),
  ),

  "54015.one-by-one-action": NOVA_EVENTS["28014.one-by-one-action"]!,

  "54016.spoiling-for-a-fight-action": heroAction(
    discardEncounterUntil(query("minion"), "minion"),
    putIntoPlay(chosen("minion")),
    ready(yourIdentity),
  ),

  "54017.aggressive-stance-response": heroResponse(
    { on: "minionEngaged", playerIs: "controller" },
    { cost: discardThis },
    chooseCards("found", zone("deck", you, { filter: query("event", { trait: ATTACK }) }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  "54018.bambino-constant": constant(
    gainsKeyword(
      { name: "restricted" },
      { self: true },
      {
        while: exists(query("identity", { hasAttachment: { self: true } })),
      },
    ),
  ),
  "54018.bambino-interrupt": interrupt(
    on.attacks({ hostOfSelf: true }, { basic: true }),
    { cost: removeCounter("ammo", 1, {}) },
    modifyAttack({ extraDamage: 3, overkill: true }),
  ),

  "54019.man-on-the-wall-action": heroAction(
    { cost: exhaustThis },
    reduceNextCardCost(you, countOf(query("minion", { engagedWith: "you" })), "phase"),
  ),

  "54020.shield-sidearm-interrupt": interrupt(
    on.attacks({ hostOfSelf: true }, { basic: true }),
    { cost: [exhaustThis, removeCounter("ammo", 1, {})] },
    damageAnEnemy(1),
  ),

  "54021.nick-fury-sr-forced-response": AOS_ASPECT_BASIC["50054.nick-fury-sr-forced-response"]!,

  "54022.super-soldiers-action": heroAction(
    { label: "attack" },
    attackAnEnemy(6),
    giveStatus(teamUpCharacters(), "tough"),
  ),

  "54023.winter-widow-soldier-spy-action": heroAction(
    { label: "attack" },
    chooseCards("found", zone("discard", you, { filter: query("upgrade", { trait: PREPARATION }) }), {
      min: 1,
      max: 1,
    }),
    putIntoPlay(chosen("found")),
    attackAnEnemy(4),
  ),

  "54032.white-widow-response": response(onAbilityResolvedOf(PREPARATION_CARD), heal(printedCostOf(eventSource), self)),

  "54033.shield-deputy-constant": constant(
    gets("hp", 1, query("character", { hostOfSelf: true })),
    gainsTrait(SHIELD, query("character", { hostOfSelf: true })),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const WINTER_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
