import {
  attacksGainKeywords,
  constant,
  defineAbilities,
  excludedFromAllyLimit,
  putIntoPlay,
  self,
  surge,
  uncancellable,
  whenRevealed,
  you,
} from "../../dsl/index.js";

/**
 * MojoMania (`mojo`), the one-card Longshot set (39071, an ally with an encounter card back; docs/phase7-wave6.md
 * §7.5). Shuffled into the encounter deck on request as the scenario's extra modular set (Q43). Revealed, he is put
 * into play under the revealing player's control (§3.71) and gains surge. The surge is unconditional (unlike Wild
 * Wild Mojo's), and the cancel-proof "this effect" is the whole When Revealed. As a boost card he has no boost icons
 * (data; insert p. 2). When he leaves play he goes to the encounter discard pile (an encounter card back).
 */
export const LONGSHOT_ABILITIES = defineAbilities({
  // [star] Longshot's attacks gain piercing.
  "39071.longshot-constant": constant(attacksGainKeywords(["piercing"], { attacker: { self: true } })),
  // Longshot does not count against your ally limit.
  "39071.longshot-constant-2": constant(excludedFromAllyLimit({ self: true })),
  // When Revealed: Put Longshot into play under your control. This card gains surge. This effect cannot be canceled.
  "39071.when-revealed": uncancellable(whenRevealed(putIntoPlay(self, you), surge())),
});
