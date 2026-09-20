import {
  boost,
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
  self,
  spendResources,
  thatPlayer,
  whenRevealed,
  yourIdentity,
} from "../../dsl/index.js";

/**
 * Need for Speed (14024), Quicksilver's obligation, and his nemesis set: Extortion of Seismic Proportion (14025,
 * a side scheme with no ability of its own — Incite is data), Avalanche (14026), Vibration Resistance (14027),
 * Earthquake (14028).
 *
 * **Skipped (missing engine primitive):**
 * - `14024.obligation` — "Give to the Pietro Maximoff player. You may flip to alter-ego form. Choose: • Exhaust
 *   Pietro Maximoff → remove Need for Speed from the game. • Exhaust your identity. **You cannot ready your
 *   identity until your next turn ends.** Discard this obligation." Otherwise the Core obligation shape
 *   (`core/obligations.ts`'s `obligation` helper already handles "give to X, may flip, exhaust-to-remove-or-
 *   alternative"), but the bolded restriction has no primitive — a sibling gap to Care for Cassie's own
 *   "cannot change form" restriction (12025, `ant/obligation-nemesis.ts`), except this one is "cannot **ready**",
 *   a different standing rule (`RuleSpec cannotChangeForm` wouldn't cover it even if it existed).
 *   `LastingEffectBody` has no `cannotReady`-kind sibling to `statModifier`/`traitGrant`/`costReduction`/
 *   `blankTextBox` for other standing changes with a clock on them, and "until your next turn ends" isn't one of
 *   `LastingUntil`'s four values either. Closest existing primitive: `LastingEffectBody`'s own shape, needing a
 *   `cannotReady`-kind sibling (and, like Care for Cassie, a "until your next turn ends" duration).
 */
export const QUICKSILVER_OBLIGATION_NEMESIS = defineAbilities({
  // Need for Speed (14024.obligation) is SKIPPED — module docblock.

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
