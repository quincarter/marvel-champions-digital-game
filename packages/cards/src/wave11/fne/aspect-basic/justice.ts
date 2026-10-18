import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  after,
  allOf,
  attackInProgress,
  chooseTarget,
  chosen,
  confuse,
  constant,
  costIf,
  defineAbilities,
  eventSource,
  eventTarget,
  exactlyDefeated,
  exhaustThis,
  exists,
  findCard,
  gets,
  heroAction,
  interrupt,
  losesIcon,
  on,
  query,
  refMatches,
  removeAnAccelerationToken,
  response,
  rule,
  spend,
  stun,
  takesConsequentialDamage,
  thwartAScheme,
  when,
  whenDefeated,
  you,
} from "../../../dsl/index.js";
import { WAVE10_ABILITIES } from "../../../wave10/index.js";

const CLOAK = query("ally", { name: "Cloak" });

/**
 * Wave 11 scripting module `fne/aspect-basic/justice` (docs/phase7-wave11.md §8.4).
 *
 * Cards (10):
 * - 60019 Blindspot (ally)
 * - 60020 Cloak (ally)
 * - 60021 Dagger (ally)
 * - 60022 Ghost Rider (ally)
 * - 60023 Know Your Enemy (event)
 * - 60024 De-escalation (player_side_scheme)
 * - 60025 Chance Encounter (upgrade)
 * - 60026 Legal Trouble (upgrade)
 * - 60027 Move in Shadow (upgrade)
 * - 60028 Stealth Training (upgrade)
 *
 * Reprints, aliased to the original script: 60025.chance-encounter-interrupt. The test checks the printed text matches.
 *
 * **60019.blindspot-response**: "After Blindspot thwarts" (an ally's own thwart), confuse an enemy that has an upgrade
 * attached.
 *
 * **60020.cloak-action**: unlabeled Action, so any form; the exhaust and the two [energy] are the cost, then Dagger is
 * found and put into play under the player's control. `findCard` searches the player's own deck, discard pile and hand
 * only; RRG 1.8 "Find" (p. 19) searches every area, an engine call to settle later (flagged, not worked around).
 *
 * **60021.dagger-constant / -2**: Cloak's acceleration icon is lost while Dagger is in play. Dagger's -1 consequential
 * damage applies only while Cloak is in play; consequential damage only follows a basic power, so "after she uses a
 * basic power" is the scope itself (RRG 1.8 "Consequential Damage", p. 13).
 *
 * **60022.ghost-rider-interrupt**: the cost depends on the declared target: 2 [energy] if it is the villain, else 1
 * (read
 * as `attackInProgress`, since a conditional cost is determined without the triggering event);
 * then the enemy is confused.
 *
 * **60023.know-your-enemy-action**: "Hero Action (thwart)" with two removal instructions, each a thwart of 1 from a
 * scheme chosen anew (MC60 p. 25: Know Your Enemy helps defeat side schemes exactly, so each removal is measured on
 * its own).
 *
 *
 * **60024.when-defeated**: "Remove an acceleration token from play." The card's instruction overrides RRG 1.8
 * "Acceleration Token" (p. 5, tokens on the main scheme cannot be removed) under the Golden Rules (p. 4) and "Cannot"
 * (p. 11), so the player chooses any token in play, main scheme stages included; with none, nothing happens.
 *
 * **60026.legal-trouble-constant**: attached minion gets -2 SCH (attach and max-per-host are card data).
 *
 * **60027.move-in-shadow-response**: "Response (thwart): After you play a card (including this one)": `youPlayedCard`
 * for any card; the removal is a thwart by the player's identity (RRG 1.8 "Labeled Ability", p. 26).
 *
 * **60028.stealth-training-response**: "After you thwart and exactly defeat a side scheme": the defeating removal came
 * from the responding player's identity or an extension of it (a thwart by an ally is not "you thwart", RRG 1.8 "You,
 * Your", p. 49; "Event", p. 18), and `exactlyDefeated` (spec 3.7, MC60 p. 4).
 */
export const FNE_ASPECT_BASIC_JUSTICE: AbilityRegistry = defineAbilities({
  "60019.blindspot-response": response(
    after.thwarts("self"),
    chooseTarget("enemy", query("enemy", { hasAttachment: query("upgrade") })),
    confuse(chosen("enemy")),
  ),

  "60020.cloak-action": action(
    { cost: [exhaustThis, spend({ energy: 2 })] },
    findCard({ name: "Dagger" }, "play", { owner: you }),
  ),

  "60021.dagger-constant": constant(losesIcon("acceleration", CLOAK)),
  "60021.dagger-constant-2": constant(rule(takesConsequentialDamage({ self: true }, -1, { if: exists(CLOAK) }))),

  "60022.ghost-rider-interrupt": interrupt(
    when.attacks("self"),
    {
      cost: costIf(
        attackInProgress({ attacker: { self: true }, target: query("villain") }),
        spend({ energy: 2 }),
        spend({ energy: 1 }),
      ),
    },
    confuse(eventTarget),
  ),

  "60023.know-your-enemy-action": heroAction(
    { label: "thwart" },
    thwartAScheme(1, "first"),
    thwartAScheme(1, "second"),
  ),

  "60024.when-defeated": whenDefeated(removeAnAccelerationToken()),

  "60025.chance-encounter-interrupt": WAVE10_ABILITIES["26034.chance-encounter-interrupt"]!,

  "60026.legal-trouble-constant": constant(gets("sch", -2, query("minion", { hostOfSelf: true }))),

  "60027.move-in-shadow-response": response(after.youPlayedCard(query([], {})), { label: "thwart" }, thwartAScheme(1)),

  "60028.stealth-training-response": response(
    on.schemeDefeated(query("sideScheme")),
    {
      while: allOf(exactlyDefeated, refMatches(eventSource, query([], { extensionOf: you }))),
      cost: exhaustThis,
    },
    chooseTarget("enemy", query("enemy")),
    stun(chosen("enemy")),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_ASPECT_BASIC_JUSTICE_SKIPPED: Readonly<Record<string, string>> = {};
