import { trait } from "@mc/content";
import type { AbilityRegistry, EventPattern, TargetQuery } from "@mc/engine";
import {
  alterEgoAction,
  cancelRevealedCard,
  chooseNumber,
  chooseOne,
  chooseTarget,
  chosen,
  defineAbilities,
  discardThis,
  enemyScheme,
  eventAmount,
  eventSource,
  exhaustThis,
  forcedInterrupt,
  gainTraitUntil,
  generatesAmount,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  instead,
  interrupt,
  isHero,
  min,
  modifyAttack,
  moveThreat,
  on,
  option,
  placeThreat,
  preventDamage,
  preventThreat,
  query,
  ready,
  removeThreatCost,
  removeThreatUpToCost,
  resource,
  self,
  threatOn,
  valueAtMost,
  varOf,
  yourIdentity,
  YOUR_IDENTITY,
} from "../../../dsl/index.js";
import { YOUR_SUIT_FORM } from "./identity.js";

/** "A Preparation card you control" (the trait, not a label): any player card type that can carry it. */
const PREPARATION_CARD: TargetQuery = {
  categories: ["ally", "event", "support", "upgrade"],
  trait: trait("PREPARATION"),
};

/** "After you resolve the ability of a Preparation card you control" (errata'd "trigger" to "resolve", RRG 1.8 p. 66). */
const YOU_RESOLVE_PREPARATION: EventPattern = {
  on: "abilityResolved",
  playerIs: "controller",
  sourceIs: PREPARATION_CARD,
};

/** "When you reveal a treachery": the revealing player is you (no `on.*` wrapper carries `playerIs`). */
const YOU_REVEAL_TREACHERY: EventPattern = {
  on: "encounterCardRevealing",
  playerIs: "controller",
  targetIs: { categories: ["treachery"] },
};

/**
 * Wave 9 scripting module `aos/nick-fury/support-upgrades-allies` (docs/phase7-wave9.md section 8.4, 3.7, 3.8, 3.9).
 * `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * **50035a.assault-interrupt** (the suit form's front face): "Interrupt: When you attack, remove up to 3 threat from
 * here -> this attack deals 1 additional damage for each threat removed this way." The cost is a chosen amount from 1
 * to the smaller of 3 and the threat here (RRG 1.8 "Cost", p. 14: "up to" in a cost needs at least one), so it is not
 * offered with 0 threat. The amount paid is `varOf("cost.removeThreat")`; `modifyAttack.extraDamage` adds it to the
 * attack in progress (basic, "(attack)" ability or event). Break Cover (50034a), a forced interrupt to the same
 * attack, resolves first (RRG 1.8 "Forced", p. 20), so an attack that breaks cover from Stealth can spend its banked
 * threat.
 *
 * **50035b.stealth-forced-interrupt** (the back face): "Forced Interrupt (Hero): When an enemy would attack you, it
 * schemes instead. Place 1 threat from that activation here instead of on the main scheme if there is 5 or less threat
 * on this card." Only when the enemy would attack Nick Fury himself (an ally he controls, or another player, is not
 * "you": ruling December 17, 2025 (3); an attack he is declared the defender of has already initiated). The
 * replacement is `enemyScheme` with `divert` (section 3.9), `would` so it resolves before other interrupts to the
 * attack; the activation is an ordinary scheme, so a confused or stunned enemy and "after [enemy] schemes" work as
 * for any scheme (MC50 p. 22; RRG 1.8 "'Would'", p. 48).
 *
 * **50036.maria-hill-interrupt**: "[star] Interrupt: When Maria Hill thwarts, place the removed threat on your suit
 * form upgrade." The thwart still removes its threat; the same amount is placed on the suit. Read in the interrupt
 * window, `eventAmount` is the thwart's amount before it resolves, capped at the threat on the scheme (the same
 * reading as Overwatch 30019: "the removed threat" is only what is there to remove). A thwart a crisis icon stops
 * removes nothing but this still places (see the module's hand-off note).
 *
 * **50040.furys-flying-car-action**: "Hero Action: Exhaust Fury's Flying Car and remove 1 threat from your suit form
 * upgrade -> ready Nick Fury. He gains the Aerial trait until the end of the round." Not usable with 0 threat on the
 * suit (or with the suit not in play).
 *
 * **50041.safe-house-221-action**: "Alter-Ego Action: Exhaust Safe House #221 -> choose: heal 2 damage from Nick Fury,
 * or place 1 threat on your suit form upgrade."
 *
 * **50042.em-shield-interrupt**: "Interrupt (defense): When you would take any amount of damage from an attack,
 * discard EM Shield -> prevent all of that damage." Booster Boots' pattern (`damage` of your identity from an
 * attack); only your identity, not an ally.
 *
 * **50043.eyepatch-camera-interrupt**: "Hero Interrupt: When any amount of threat would be placed on the main scheme,
 * discard Eyepatch Camera -> place up to 3 of that threat on your suit form upgrade instead." The player chooses how
 * many (0 to the smaller of 3 and the threat that would be placed; "up to" in an effect may be 0); that much is
 * prevented on the scheme and placed on the suit, the rest still goes on the scheme.
 *
 * **50044.furys-watch-resource**: "Resource: Exhaust Fury's Watch and remove up to 2 threat from your suit form
 * upgrade -> generate a [mental] resource for each threat you removed this way." No form word, so it pays in either
 * form. The amount is 1 to the smaller of 2 and the threat on the suit (RRG 1.8 "Cost", p. 14), named in the payment
 * (`ResourceAbilityUse.costSelection.removeThreat`; unnamed, the most), so the payment is priced with what it will
 * generate; with 0 threat on the suit it is not a payment source. Overpaying is legal as for any generator (p. 13).
 *
 * **50045.intelligence-analysis-interrupt**: "Interrupt: When you reveal a treachery, discard Intelligence Analysis and
 * remove 1 threat from your suit form upgrade -> cancel the effects of that treachery and discard it."
 *
 * **50046.secret-agent-response**: "Hero Response: After you resolve the ability of a Preparation card you control,
 * move 1 threat from a scheme to your suit form upgrade." A scheme that holds threat is chosen; the threat moves
 * under the scheme's own rules (a crisis icon stops it).
 *
 * Cards (9):
 * - 50035a Assault (upgrade) / 50035b Stealth
 * - 50036 Maria Hill (ally)
 * - 50040 Fury's Flying Car (support)
 * - 50041 Safe House #221 (support)
 * - 50042 EM Shield (upgrade)
 * - 50043 Eyepatch Camera (upgrade)
 * - 50044 Fury's Watch (upgrade)
 * - 50045 Intelligence Analysis (upgrade)
 * - 50046 Secret Agent (upgrade)
 */
export const NICK_FURY_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "50035a.assault-interrupt": interrupt(
    on.attacks(YOUR_IDENTITY),
    { cost: removeThreatUpToCost(self, 3) },
    modifyAttack({ extraDamage: varOf("cost.removeThreat") }),
  ),

  "50035b.stealth-forced-interrupt": forcedInterrupt(
    { on: "enemyAttack", targetIs: { categories: ["identity"], controller: "you" } },
    { would: true, while: isHero() },
    instead(enemyScheme(eventSource, { divert: { to: self, if: valueAtMost(threatOn(self), 5) } })),
  ),

  "50036.maria-hill-interrupt": interrupt(
    on.thwarts("self"),
    placeThreat(min(eventAmount, threatOn({ kind: "eventTarget" })), YOUR_SUIT_FORM),
  ),

  "50040.furys-flying-car-action": heroAction(
    { cost: [exhaustThis, removeThreatCost(YOUR_SUIT_FORM, 1)] },
    ready(yourIdentity),
    gainTraitUntil(trait("AERIAL"), yourIdentity, "endOfRound"),
  ),

  "50041.safe-house-221-action": alterEgoAction(
    { cost: exhaustThis },
    chooseOne(
      option("Heal 2 damage from Nick Fury", heal(2, yourIdentity)),
      option("Place 1 threat on your suit form upgrade", placeThreat(1, YOUR_SUIT_FORM)),
    ),
  ),

  "50042.em-shield-interrupt": interrupt(
    on.damage(YOUR_IDENTITY, { fromAttack: true }),
    { label: "defense", cost: discardThis },
    preventDamage(),
  ),

  "50043.eyepatch-camera-interrupt": heroInterrupt(
    on.threatPlaced(query("mainScheme")),
    { cost: discardThis },
    chooseNumber("moved", min(eventAmount, 3)),
    preventThreat(varOf("moved.amount")),
    placeThreat(varOf("moved.amount"), YOUR_SUIT_FORM),
  ),

  "50044.furys-watch-resource": resource(generatesAmount("mental", varOf("cost.removeThreat")), {
    cost: [exhaustThis, removeThreatUpToCost(YOUR_SUIT_FORM, 2)],
  }),

  "50045.intelligence-analysis-interrupt": interrupt(
    YOU_REVEAL_TREACHERY,
    { cost: [discardThis, removeThreatCost(YOUR_SUIT_FORM, 1)] },
    cancelRevealedCard(),
  ),

  "50046.secret-agent-response": heroResponse(
    YOU_RESOLVE_PREPARATION,
    chooseTarget("scheme", query("scheme", { hasThreat: true })),
    moveThreat(chosen("scheme"), YOUR_SUIT_FORM, { amount: 1 }),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const NICK_FURY_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
