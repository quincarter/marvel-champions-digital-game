import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  after,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  discardThis,
  damageOn,
  eventTarget,
  exhaustThis,
  gets,
  giveTough,
  hasStatus,
  heal,
  hitPointsOf,
  heroResponse,
  instead,
  interrupt,
  modifyAttack,
  modifyStatOf,
  product,
  query,
  remainingHpCompare,
  removeCounter,
  self,
  statOf,
  sum,
  when,
  YOUR_HERO,
} from "../../dsl/index.js";
import { WAVE10_ABILITIES } from "../../wave10/index.js";

const DEFENDER = trait("DEFENDER");
/** A character you control that has exactly 1 hit point remaining (Righteous Purpose). */
const ON_ONE_HP = query("character", { controller: "you", ...remainingHpCompare("eq", 1) });

/**
 * Wave 11 scripting module `luke_cage/leadership` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (8):
 * - 62012 Iron Fist (ally)
 * - 62013 Misty Knight (ally)
 * - 62014 Valkyrie (ally)
 * - 62015 Take a Stand (event)
 * - 62016 Innovation (resource)
 * - 62017 The Power of Leadership (resource)
 * - 62018 Defensive Formation (support)
 * - 62019 Righteous Purpose (support)
 *
 * Reprints, aliased to the original script (the wave 10 `hercules/basic` precedent): 62016 (21058), 62017 (01072). The
 * test checks the printed text matches.
 *
 * **62012 Iron Fist**: "prevent damage from that attack equal to Iron Fist's ATK" is `modifyAttack({ preventDamage })`
 * read when he is declared the defender (his current ATK), spent on the damage the attack would have him take.
 *
 * **62014 Valkyrie**: the heal replaces the defeat (RRG "Replacement Effect", p. 37; ruling August 3, 2026 (2) says it
 * resolves before simultaneous ally defeats). Heals the damage beyond (hit points - 1) (`hitPointsOf`, the current maximum, unclamped), so the ally is left
 * with 1 hit point remaining.
 *
 * **62015 Take a Stand**: "until the end of the player phase" is `endOfPlayerPhase`. Owner question Q104 = B (the owner,
 * 2026-10-18), RRG 1.8 "Lasting Effects" (p. 26): such an effect "can only be initiated during that time period", so
 * used after a villain-phase defense it gives nothing; used in a player phase it lasts to that phase's end. A live
 * query, so allies that arrive later in that phase get the bonus too.
 */
export const LUKE_CAGE_LEADERSHIP: AbilityRegistry = defineAbilities({
  "62016.innovation-response": WAVE10_ABILITIES["21058.innovation-response"]!,
  "62017.the-power-of-leadership-constant": WAVE10_ABILITIES["01072.the-power-of-leadership-constant"]!,

  "62012.iron-fist-interrupt": interrupt(
    when.defends({ self: true }),
    modifyAttack({ preventDamage: statOf(self, "atk") }),
  ),

  "62013.misty-knight-constant": constant(
    gets("atk", 2, { self: true }, { while: hasStatus(self, "tough") }),
    gets("thw", 2, { self: true }, { while: hasStatus(self, "tough") }),
  ),

  "62014.valkyrie-interrupt": interrupt(
    when.defeated(query("ally", { not: { self: true } })),
    { would: true, cost: discardThis },
    instead(heal(sum(damageOn(eventTarget), product(-1, hitPointsOf(eventTarget)), 1), eventTarget)),
  ),

  "62015.take-a-stand-response": heroResponse(
    after.defends(YOUR_HERO),
    modifyStatOf("thw", 1, query("ally", { controller: "you" }), "endOfPlayerPhase"),
    modifyStatOf("atk", 1, query("ally", { controller: "you" }), "endOfPlayerPhase"),
  ),

  "62018.defensive-formation-action": action(
    { cost: [exhaustThis, removeCounter("block")] },
    chooseTarget("ally", query("ally", { trait: DEFENDER })),
    giveTough(chosen("ally")),
  ),

  "62019.righteous-purpose-constant": constant(gets("thw", 2, ON_ONE_HP), gets("atk", 2, ON_ONE_HP)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const LUKE_CAGE_LEADERSHIP_SKIPPED: Readonly<Record<string, string>> = {};
