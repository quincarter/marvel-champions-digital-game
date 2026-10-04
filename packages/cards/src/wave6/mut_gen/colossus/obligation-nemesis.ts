import {
  atEndOfAttack,
  boost,
  defineAbilities,
  discard,
  each,
  forcedInterrupt,
  ifThen,
  isAttached,
  isStunned,
  modifyAttack,
  not,
  placeThreat,
  query,
  removeStatus,
  revealCard,
  scaled,
  self,
  stun,
  surge,
  takeDamage,
  valueEquals,
  varOf,
  when,
  whenRevealed,
  you,
  yourIdentity,
} from "../../../dsl/index.js";
import { obligation } from "../../../core/obligations.js";

/**
 * Homesick (32025), Colossus's obligation, and his Juggernaut nemesis set: Juggernaut (32026, nemesis minion),
 * Rampaging Juggernaut (32027, side scheme), Unstoppable x2 (32028, attachment) and Slammed (32029, treachery).
 *
 * - **Homesick** is the shared `obligation()` shape (flip, then "Exhaust Piotr Rasputin -> remove from the game" or an
 *   alternative). Alternative: discard each tough status card from his identity (`removeStatus`, `bind` counts them,
 *   docs/phase7-wave6.md §3.6); if none was discarded this card gains surge. The surge is evaluated before the helper's
 *   closing "discard this obligation", the order every obligation with "if you cannot, this card gains surge" uses
 *   (Black Widow's 08025); the surge is still this card's own reveal.
 * - **Juggernaut** and **Unstoppable** grant overkill and piercing to the attack: `modifyAttack` at the boost / forced
 *   interrupt. A boost resolving in a scheme activation harmlessly no-ops (dsl `modifyAttack` docblock).
 * - **Unstoppable**'s host ("highest printed ATK without a copy of Unstoppable") is the attachment's `attachesTo` data;
 *   only "otherwise gains surge" is scripted. Its "+2 ATK" is `statModifiers` data.
 * - **Rampaging Juggernaut** discards every tough card from every friendly character (hero identities and allies) and
 *   places 2 threat per card actually discarded (`bind`, summed over all characters).
 */
export const COLOSSUS_OBLIGATION_NEMESIS = defineAbilities({
  "32025.obligation": obligation("Piotr Rasputin", {
    label: "Discard this card and each tough status card from your identity",
    effects: [
      removeStatus(yourIdentity, "tough", { bind: "discarded" }),
      ifThen(valueEquals(varOf("discarded.amount"), 0), surge()),
    ],
  }),

  // Juggernaut — Stalwart, Toughness (data). [star] Boost: If this activation is an attack, that attack gains
  // overkill and piercing.
  "32026.boost": boost(modifyAttack({ overkill: true, keywords: ["piercing"] })),

  // Rampaging Juggernaut — When Revealed: Discard each tough status card from each friendly character. Place 2 threat
  // here for each tough status card discarded this way.
  "32027.when-revealed": whenRevealed(
    removeStatus(each(query(["identity", "ally"])), "tough", { bind: "tough" }),
    placeThreat(scaled(varOf("tough.amount"), { times: 2 }), self),
  ),

  // Unstoppable — if no enemy can host it (schema-level `attachesTo`), this card gains surge.
  "32028.unstoppable-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // [star] Forced Interrupt: When attached enemy attacks, the attack gains overkill and piercing. At the end of this
  // attack, discard Unstoppable.
  "32028.unstoppable-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("host"),
    modifyAttack({ overkill: true, keywords: ["piercing"] }),
    atEndOfAttack(discard(self)),
  ),

  // Slammed — When Revealed: You are stunned. If you are already stunned, take 2 damage. [star] Boost: Reveal this card.
  "32029.when-revealed": whenRevealed(ifThen(isStunned(yourIdentity), takeDamage(2), stun(yourIdentity))),
  "32029.boost": boost(revealCard(self, you)),
});
