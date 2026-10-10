import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  alterEgoAction,
  alterEgoInterrupt,
  cancelIt,
  confuse,
  attack,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  costModifier,
  countOf,
  dealDamage,
  defineAbilities,
  discardThis,
  encounterCards,
  enemyAttack,
  eventAmount,
  eventSource,
  eachPlayer,
  exhaustThis,
  hasStatus,
  heal,
  heroAction,
  heroResponse,
  ifThen,
  instead,
  interrupt,
  moveCards,
  on,
  option,
  preventDamage,
  query,
  removeStatus,
  removeUpToCounters,
  reorderCards,
  response,
  scaled,
  selectCards,
  self,
  spend,
  spendX,
  statOf,
  stun,
  theVillain,
  valueEquals,
  varOf,
  when,
  yourIdentity,
  YOUR_IDENTITY,
  changeForm,
  you,
} from "../../dsl/index.js";
import { GHOST_SPIDER_EVENTS_B } from "../../wave5/sm/ghost-spider/events-b.js";
import { SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS } from "../../wave5/sm/spider-man-morales/precon-player-cards.js";
import { ROGUE_EVENTS } from "../../wave6/rogue/rogue/events.js";

const WEB_WARRIOR = trait("WEB-WARRIOR");
const TECH = trait("TECH");

/** "Web-Warrior cards you control": any card type, the identity in the face that prints the trait included. */
const YOUR_WEB_WARRIOR_CARDS = query("character", { trait: WEB_WARRIOR, controller: "you" });

/**
 * Wave 9 scripting module `silk/aspect-basic` (docs/phase7-wave9.md section 8.4, 3.51, 3.52), first half (52013 to 52021).
 * `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * **52013.scarlet-spider-interrupt**: "another Web-Warrior character" is any character with the trait but Scarlet
 * Spider (a hero in hero form included, any player's); the damage is redirected as it is (`sourceFromEvent`, the
 * Sabretooth / Mister Sinister shape): the enemy still dealt it, and Scarlet Spider's own toughness applies to it.
 *
 * **52014.spider-byte-constant**: a cost reduction read from the hand (`activeIn: "hand"`) by the Tech cards you control.
 *
 * **52015.not-today-interrupt**: the same card as Rogue's 38016 (a reprint under a new code), aliased.
 *
 * **52016.stop-hitting-yourself-response**: "(attack)": the damage is an attack by the hero (guard applies: it is not
 * offered against a villain while a guard minion is engaged, RRG "Guard" p. 21; the enemy's retaliate answers) equal to the hero's DEF as it is when the response is played (ruling December 17, 2025 -
 * Ruling 2: 4 with Not Today!).
 *
 * **52017.dr-sinclair-action**: "Any player may trigger this ability" is `triggerableBy: eachPlayer`; the triggering
 * player pays the resource and is "you" (the Alter-Ego Action is hers, so it needs her alter-ego form).
 *
 * **52018.energy-shield-interrupt**: X is chosen by the payer (`spendX`, at least 1); "Max 1 per character" is data.
 *
 * **52019.ready-for-a-fight-interrupt**: the mirror of Invisibility Gear: "would scheme" (`would`) is replaced by the
 * enemy attacking you, after the form change. Requirement and "Max 1 per player" are data.
 *
 * **52020.stun-gun-action**: 1 or 2 counters is a cost of 1 to 2 ("up to" in a cost cannot be 0, RRG 1.8 "Cost", p. 14).
 * Removing the last counter discards the card (RRG "Uses").
 *
 * **52021.madame-web-response**: the count is read as the response starts, her own trait included.
 *
 * **52022.spider-man-response**: a reprint of Spider-Man 27049 (same name, subtitle, stats, Requirement and text), aliased.
 * **52023.across-the-spider-verse-action**: a reprint of 27018 (same text), aliased.
 *
 * **52024.investigative-journalism-interrupt**: the mirror of Ready for a Fight: "would scheme" (`would`) is canceled
 * (`cancelIt`, the whole activation) and that enemy is confused. Team-Up and "Max 1 per deck" are data.
 *
 * **52032.spider-man-2099-response**: any basic power he uses (`basicPowerUsed`, an ally's attack or thwart); the
 * Web-Warrior ally returned may be any player's (and himself), going to its owner's hand (`moveCards` to the hand).
 *
 * **52033.spider-woman-response**: "(including this one)": the pattern is any Web-Warrior ally entering play, which her
 * own entering matches; the enemy is the controller's choice.
 *
 * **52034.quick-quip-action**: scripted in wave 5 (`SILK_QUICK_QUIP`, wave5/silk/quick-quip.ts) ahead of this pack and
 * already in the wave 8 registry, where an id defined twice is an error: skipped here, tested here.
 *
 * Cards (18):
 * - 52013 Scarlet Spider (ally)
 * - 52014 Spider-Byte (ally)
 * - 52015 Not Today! (event)
 * - 52016 "Stop Hitting Yourself" (event)
 * - 52017 Dr. Sinclair (support)
 * - 52018 Energy Shield (upgrade)
 * - 52019 Ready for a Fight (upgrade)
 * - 52020 Stun Gun (upgrade)
 * - 52021 Madame Web (ally)
 * - 52022 Spider-Man (ally)
 * - 52023 Across the Spider-Verse (event)
 * - 52024 Investigative Journalism (event)
 * - 52025 Energy (resource)
 * - 52026 Genius (resource)
 * - 52027 Strength (resource)
 * - 52032 Spider-Man 2099 (ally)
 * - 52033 Spider-Woman (ally)
 * - 52034 Quick Quip (event)
 */
export const SILK_ASPECT_BASIC: AbilityRegistry = defineAbilities({
  "52013.scarlet-spider-interrupt": interrupt(
    when.damage(query("character", { trait: WEB_WARRIOR, not: { self: true } })),
    instead(dealDamage(eventAmount, self, { sourceFromEvent: true })),
  ),

  "52014.spider-byte-constant": constant(
    costModifier({
      delta: scaled(countOf({ trait: TECH, controller: "you" }), { times: -1 }),
      appliesTo: query("ally", { self: true }),
      activeIn: "hand",
    }),
  ),

  "52015.not-today-interrupt": ROGUE_EVENTS["38016.not-today-interrupt"]!,

  "52016.stop-hitting-yourself-response": heroResponse(
    after.defends(YOUR_IDENTITY, { takingNoDamage: true }),
    { label: "attack" },
    attack(statOf(yourIdentity, "def"), eventSource),
  ),

  "52017.dr-sinclair-action": alterEgoAction(
    { cost: [exhaustThis, spend({ mental: 1 })], triggerableBy: eachPlayer },
    heal(statOf(yourIdentity, "rec"), yourIdentity),
    chooseOne(
      option(
        "Discard the stunned status",
        { when: hasStatus(yourIdentity, "stunned") },
        removeStatus(yourIdentity, "stunned"),
      ),
      option(
        "Discard the confused status",
        { when: hasStatus(yourIdentity, "confused") },
        removeStatus(yourIdentity, "confused"),
      ),
      option(
        "Discard the tough status",
        { when: hasStatus(yourIdentity, "tough") },
        removeStatus(yourIdentity, "tough"),
      ),
      option("Do not discard a status card"),
    ),
  ),

  "52018.energy-shield-interrupt": interrupt(
    when.damage("host"),
    { cost: spendX("energy", "x") },
    preventDamage(varOf("x")),
  ),

  "52019.ready-for-a-fight-interrupt": interrupt(
    on.enemySchemes(query("enemy")),
    { cost: discardThis, would: true },
    changeForm(you, "hero"),
    instead(enemyAttack(eventSource, { against: you })),
  ),

  "52020.stun-gun-action": heroAction(
    { cost: [exhaustThis, removeUpToCounters("charge", 2, { bind: "removed" })] },
    ifThen(valueEquals(varOf("removed"), 1), [chooseTarget("minion", query("minion")), stun(chosen("minion"))]),
    ifThen(valueEquals(varOf("removed"), 2), stun(theVillain)),
  ),

  "52021.madame-web-response": response(
    after.entersPlay("self"),
    selectCards("looked", encounterCards(["deck"], undefined, countOf(YOUR_WEB_WARRIOR_CARDS))),
    chooseCards("discarded", cards(chosen("looked")), { min: 0, max: 1 }),
    moveCards(cards(chosen("discarded")), "discard"),
    reorderCards(cards(chosen("looked"), { excludeSlots: ["discarded"] })),
  ),

  "52022.spider-man-response": SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS["27049.spider-man-response"]!,

  "52023.across-the-spider-verse-action": GHOST_SPIDER_EVENTS_B["27018.across-the-spider-verse-action"]!,

  "52024.investigative-journalism-interrupt": alterEgoInterrupt(
    on.enemySchemes(query("enemy")),
    { would: true },
    confuse(eventSource),
    cancelIt(),
  ),

  "52032.spider-man-2099-response": response(
    after.basicPowerUsed("self"),
    chooseTarget("ally", query("ally", { trait: WEB_WARRIOR })),
    moveCards(cards(chosen("ally")), "hand"),
  ),

  "52033.spider-woman-response": response(
    after.entersPlay(query("ally", { trait: WEB_WARRIOR })),
    chooseTarget("enemy", query("enemy")),
    dealDamage(1, chosen("enemy")),
  ),
});

/** Refs of this module's cards deliberately left out of the registry, each with its written reason. */
export const SILK_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "52034.quick-quip-action":
    "already registered by wave 5 (SILK_QUICK_QUIP, wave5/silk/quick-quip.ts); a second definition would be an id defined twice",
};
