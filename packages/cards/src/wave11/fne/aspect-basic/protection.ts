import type { AbilityRegistry } from "@mc/engine";
import {
  attackAnEnemy,
  constant,
  costModifier,
  countOf,
  defineAbilities,
  exhaustThis,
  exists,
  gainsKeyword,
  gets,
  heroAction,
  heroInterrupt,
  not,
  on,
  query,
  ready,
  rule,
  statOf,
  thwartAScheme,
  YOUR_HERO,
  yourIdentity,
} from "../../../dsl/index.js";
import { WAVE10_ABILITIES } from "../../../wave10/index.js";

/** The allies "you control" (RRG 1.8 "You, Your", p. 49). */
const YOUR_ALLIES = query("ally", { controller: "you" });
const NO_ALLIES = not(exists(YOUR_ALLIES));
/** "When an enemy initiates an attack": any enemy's attack as it is initiated (Powerful Punch's shape). */
const AN_ENEMY_ATTACKS = on.enemyAttacks(query("enemy"));
/** "Increase the cost to play this card by 1 for each ally you control", read from the hand. */
const COST_PER_ALLY = costModifier({ delta: countOf(YOUR_ALLIES), appliesTo: { self: true }, activeIn: "hand" });
const YOUR_DEF = statOf(yourIdentity, "def");

/**
 * Wave 11 scripting module `fne/aspect-basic/protection` (docs/phase7-wave11.md §8.4).
 *
 * Cards (8):
 * - 60038 Innate Reflexes (upgrade)
 * - 60048 Army of One (event)
 * - 60049 Get Their Attention (event)
 * - 60050 In Harm's Way (event)
 * - 60051 Powerful Punch (event)
 * - 60052 The Best Offense... (upgrade)
 * - 60053 Ronin (upgrade)
 * - 60054 Stand Alone (upgrade)
 *
 * Reprints, aliased to the original script: 60051.powerful-punch-constant. The test checks the printed text matches.
 *
 * **60038.innate-reflexes-constant**: +1 DEF to your hero; Starting is data (engine setup step, spec 3.6).
 *
 * **60048 / 60050 -constant**: the star cost increase, read from the hand (`activeIn: "hand"`), counts the allies you
 * control. **60048.army-of-one-action**: "Hero Action: Ready your hero."
 *
 * **60049.get-their-attention-constant**: "Hero Interrupt (defense/thwart): When an enemy initiates an attack" (any
 * enemy's attack, not only one against you); the removal is a thwart by the labeled ability (RRG 1.8 "Labeled
 * Ability", p. 26).
 *
 * **60050.in-harms-way-constant-2**: "Hero Action (attack/thwart)": the damage is the attack and the removal the
 * thwart, each of X = your DEF.
 *
 * **60052**: +1 DEF, and DEF in place of THW and ATK (`statInPlaceOf`; ruling June 25, 2026, Ruling 3). Temporary is
 * data.
 *
 * **60053.ronin-constant**: +1 DEF and retaliate 1 only while you control no allies.
 *
 * **60054.stand-alone-interrupt**: "When an enemy attacks you (before any defender is declared)" is the attack as it is
 * initiated against you; the no-allies condition is checked when the interrupt is offered. The parenthetical is
 * reminder text with no effect (RRG 1.8 "Reminder Text", p. 36), so it stays usable after your own labeled defense.
 * Max 1 per player is data.
 */
export const FNE_ASPECT_BASIC_PROTECTION: AbilityRegistry = defineAbilities({
  "60038.innate-reflexes-constant": constant(gets("def", 1, YOUR_HERO)),

  "60048.army-of-one-constant": constant(COST_PER_ALLY),
  "60048.army-of-one-action": heroAction(ready(yourIdentity)),

  "60049.get-their-attention-constant": heroInterrupt(
    AN_ENEMY_ATTACKS,
    { label: ["defense", "thwart"] },
    thwartAScheme(3),
  ),

  "60050.in-harms-way-constant": constant(COST_PER_ALLY),
  "60050.in-harms-way-constant-2": heroAction(
    { label: ["attack", "thwart"] },
    attackAnEnemy(YOUR_DEF),
    thwartAScheme(YOUR_DEF),
  ),

  "60051.powerful-punch-constant": WAVE10_ABILITIES["32014.powerful-punch-constant"]!,

  "60052.the-best-offense-constant": constant(gets("def", 1, YOUR_HERO)),
  "60052.the-best-offense-constant-2": constant(
    rule({ kind: "statInPlaceOf", target: YOUR_HERO, stats: ["thw", "atk"], use: "def" }),
  ),

  "60053.ronin-constant": constant(
    gets("def", 1, YOUR_HERO, { while: NO_ALLIES }),
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_HERO, { while: NO_ALLIES }),
  ),

  "60054.stand-alone-interrupt": heroInterrupt(
    on.enemyAttacks(query("enemy"), { againstYou: true }),
    { while: NO_ALLIES, cost: exhaustThis },
    ready(yourIdentity),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_ASPECT_BASIC_PROTECTION_SKIPPED: Readonly<Record<string, string>> = {};
