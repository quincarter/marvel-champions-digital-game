import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  alterEgoAction,
  attacksDealAdditionalDamage,
  attacksGainKeywords,
  constant,
  defineAbilities,
  draw,
  each,
  engage,
  eventTarget,
  exhaustThis,
  gainsKeywordX,
  gets,
  giveTough,
  hasStatus,
  heroInterrupt,
  heroResponse,
  host,
  ifThen,
  min,
  preventDamage,
  query,
  ready,
  response,
  statusCount,
  when,
  yourIdentity,
} from "../../../dsl/index.js";

const DEFENDER = trait("Defender");
/** "Luke Cage" in his own upgrades: the Luke Cage identity this player controls (either face). */
const LUKE_CAGE = query("identity", { controller: "you", name: "Luke Cage" });

/**
 * Wave 11 scripting module `luke_cage/luke-cage/support-upgrades-allies` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (6):
 * - 62002 Jessica Jones (ally)
 * - 62007 Fogwell's Gym (support)
 * - 62008 Burstein Process (upgrade)
 * - 62009 Cruisin' for a Bruisin' (upgrade)
 * - 62010 Metal Bracer (upgrade)
 * - 62011 Power Man (upgrade)
 *
 * **62002**: +1 THW per tough status card on your identity, to a maximum of +4 (a bonus capped at 4, however many
 * tough cards Luke Cage holds). **62007**: the response answers a tough card discarded from any Defender character
 * (hero, ally or another player's), once per card (H3.2); it readies that character. **62008**: the "2 instead if he has
 * none" is read as the action resolves; Luke Cage can hold any number of tough cards (his identity script).
 * **62009**: the constant parts are the engine's HT10 rules, scoped to the attached minion; the response is
 * "after you play this card" (not "from your hand"), engaging the attached minion. **62010**: "reduce that damage by 1" is scripted as preventing 1 of it. That is an engine reading, shared with
 * 26014 and 58019: no ruling equates the two for damage dealt to a character. The rulings (June 25, 2026 - Ruling 6;
 * July 9, 2026 - Ruling 2, "Metal Bracelet" is this card) cover damage taken as a cost only: reducing or preventing it
 * to 0 keeps the cost paid. **62011**: exhausts, so several tough cards discarded at once (Augmented Jaws) draw one card (H3.2).
 */
export const LUKE_CAGE_LUKE_CAGE_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "62002.jessica-jones-constant": constant(gets("thw", min(statusCount("tough", yourIdentity), 4), { self: true })),

  "62007.fogwells-gym-response": response(
    after.statusDiscarded("tough", query("character", { trait: DEFENDER })),
    { cost: exhaustThis },
    ready(eventTarget),
  ),

  "62008.burstein-process-action": alterEgoAction(
    { cost: exhaustThis },
    ifThen(hasStatus(each(LUKE_CAGE), "tough"), giveTough(each(LUKE_CAGE)), [
      giveTough(each(LUKE_CAGE)),
      giveTough(each(LUKE_CAGE)),
    ]),
  ),

  "62009.cruisin-for-a-bruisin-constant": constant(
    attacksGainKeywords(["overkill"], { target: { hostOfSelf: true } }),
    attacksDealAdditionalDamage(2, { target: { hostOfSelf: true } }),
  ),
  "62009.cruisin-for-a-bruisin-response": response(after.youPlayThis(), engage(host)),

  "62010.metal-bracer-constant": constant(gainsKeywordX("retaliate", 1, LUKE_CAGE)),
  "62010.metal-bracer-interrupt": heroInterrupt(when.damage(LUKE_CAGE), { cost: exhaustThis }, preventDamage(1)),

  "62011.power-man-response": heroResponse(after.statusDiscarded("tough", LUKE_CAGE), { cost: exhaustThis }, draw(1)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const LUKE_CAGE_LUKE_CAGE_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
