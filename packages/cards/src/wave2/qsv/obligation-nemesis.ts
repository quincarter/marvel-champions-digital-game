import {
  boost,
  cannotReadyUntil,
  chooseOne,
  chooseOneBy,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardFromHand,
  eachPlayer,
  exhaust,
  exhaustYourHero,
  forcedInterrupt,
  forEachPlayer,
  heroAction,
  identityOf,
  on,
  option,
  preventDamage,
  query,
  self,
  spendResources,
  thatPlayer,
  whenRevealed,
  yourIdentity,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";

/**
 * Need for Speed (14024), Quicksilver's obligation, and his nemesis set: Extortion of Seismic Proportion (14025,
 * a side scheme with no ability of its own — Incite is data), Avalanche (14026), Vibration Resistance (14027),
 * Earthquake (14028).
 *
 * **`14024.obligation` is now scripted** (docs/phase7-wave2.md §22/§23): "Give to the Pietro Maximoff player. You
 * may flip to alter-ego form. Choose: • Exhaust Pietro Maximoff → remove Need for Speed from the game. • Exhaust
 * your identity. **You cannot ready your identity until your next turn ends.** Discard this obligation." is the
 * Core obligation shape (`core/obligations.ts`'s `obligation` helper) plus `EffectSpec applyRuleUntil`
 * (`dsl/effects.ts`'s `cannotReadyUntil`) for the bolded restriction — the sibling of Care for Cassie's own "cannot
 * change form" restriction (12025, `ant/obligation-nemesis.ts`), a different standing rule (`RuleSpec cannotReady`)
 * on the same lasting-effect shape.
 */
export const QUICKSILVER_OBLIGATION_NEMESIS = defineAbilities({
  // Need for Speed — Give to the Pietro Maximoff player. You may flip to alter-ego form. Choose:
  // • Exhaust Pietro Maximoff → remove Need for Speed from the game.
  // • Exhaust your identity. You cannot ready your identity until your next turn ends.
  "14024.obligation": obligation("Pietro Maximoff", {
    label: "Exhaust your identity. You cannot ready your identity until your next turn ends",
    effects: [exhaust(yourIdentity), cannotReadyUntil(query("identity", { controller: "you" }), "endOfNextTurn")],
  }),

  // Avalanche (14026, minion) — Incite 2 (data). When Revealed: each player must choose to either take 2 indirect
  // damage or exhaust their identity. (Quicksilver's nemesis minion, data `nemesisMinion: true`.)
  "14026.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      chooseOneBy(
        thatPlayer,
        option("Take 2 indirect damage", dealIndirectDamage(thatPlayer, 2)),
        option("Exhaust your identity", exhaust(identityOf(thatPlayer))),
      ),
    ),
  ),

  // Vibration Resistance (14027, attachment) — Attach to Avalanche, if able. Otherwise, attach to the villain
  // (data, `AttachmentHost.ifAble`). Reduce the damage attached enemy takes from each attack by 1 (module
  // docblock: a Forced Interrupt + `preventDamage`, mechanically identical to a flat reduction). Hero Action:
  // Exhaust your hero → discard this card.
  "14027.vibration-resistance-constant": forcedInterrupt(on.damage("host", { fromAttack: true }), preventDamage(1)),
  "14027.vibration-resistance-action": heroAction({ cost: exhaustYourHero }, discard(self)),

  // Earthquake (14028, treachery) — Incite 1 (data). When Revealed: discard 2 cards from your hand and exhaust
  // your identity. [star] Boost: choose to either spend [physical][physical] resources or exhaust your identity.
  "14028.when-revealed": whenRevealed(discardFromHand(2), exhaust(yourIdentity)),
  "14028.boost": boost(
    chooseOne(
      option("Spend [physical][physical] resources", spendResources({ physical: 2 }, "spent")),
      option("Exhaust your identity", exhaust(yourIdentity)),
    ),
  ),
});
