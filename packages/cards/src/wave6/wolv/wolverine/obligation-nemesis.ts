import {
  boost,
  cards,
  confuse,
  constant,
  defineAbilities,
  dealDamage,
  each,
  forcedInterrupt,
  forcedResponse,
  ifThen,
  instead,
  isStunned,
  moveCards,
  on,
  query,
  rule,
  self,
  stun,
  takeDamage,
  when,
  whenRevealed,
  yourIdentity,
} from "../../../dsl/index.js";
import { obligation } from "../../../core/obligations.js";

/** "Stunned. Take 1 damage (4 damage instead if you are already stunned)", the status read before it is applied. */
const tentacleStrike = [ifThen(isStunned(yourIdentity), takeDamage(4), takeDamage(1)), stun(yourIdentity)];

/**
 * Past Demons (35027), Wolverine's obligation, and his Omega Red nemesis set (`wolverine_nemesis`): Omega Red (35028,
 * nemesis minion), The Carbonadium Synthesizer (35029, side scheme), Death Factor x2 (35030, attachment) and Tentacle
 * Strike (35031, treachery). docs/phase7-wave6.md §6.1, §3.40, §4.1 Q20.
 *
 * - **Past Demons** is Core's shared `obligation()` shape: may flip to alter-ego; exhaust Logan to remove it, or
 *   you are stunned and confused and it is discarded.
 * - **Death Factor**: its interrupt replaces only the healing (`on.basicRecovery`, Q20): the alter-ego still exhausts
 *   and has made a basic recovery. Attaches to your identity (`attachesTo` data).
 * - **The Carbonadium Synthesizer**: Omega Red cannot be defeated while it is in play.
 */
export const WOLVERINE_OBLIGATION_NEMESIS = defineAbilities({
  "35027.obligation": obligation("Logan", {
    label: "You are stunned and confused. Discard this obligation",
    effects: [stun(yourIdentity), confuse(yourIdentity)],
  }),

  // Omega Red — Retaliate 1, Steady (data). Forced Interrupt: When Omega Red attacks you, deal 1 damage to each
  // character you control.
  "35028.omega-red-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("self", { againstYou: true }),
    dealDamage(1, each(query(["identity", "ally"], { controller: "you" }))),
  ),

  "35029.the-carbonadium-synthesizer-constant": constant(
    rule({ kind: "cannotBeDefeated", target: query("minion", { name: "Omega Red" }) }),
  ),

  "35030.death-factor-forced-response": forcedResponse({ on: "turnEnding", playerIs: "controller" }, takeDamage(1)),
  // Printed "Alter-Ego Interrupt", but an encounter card has no controller to choose to use it, so it resolves as forced
  // when the host identity makes its basic recovery (an alter-ego-only power, so no form check is needed).
  "35030.death-factor-interrupt": forcedInterrupt(on.basicRecovery("host"), instead(moveCards(cards(self), "discard"))),

  "35031.when-revealed": whenRevealed(...tentacleStrike),
  "35031.boost": boost(...tentacleStrike),
});
