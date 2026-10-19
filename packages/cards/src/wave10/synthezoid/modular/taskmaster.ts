import type { AbilityRegistry } from "@mc/engine";
import {
  attacksGainKeywords,
  boost,
  competitiveOnly,
  constant,
  defineAbilities,
  discard,
  enemyActivates,
  enemyLeader,
  exists,
  forcedInterrupt,
  giveBoostCard,
  giveTough,
  heroAction,
  ifThen,
  inCompetitiveMode,
  modifyAttack,
  on,
  preventDamage,
  query,
  self,
  spend,
  whenDefeated,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const TASKMASTER = "Taskmaster";
/** The character a Sword or a Shield is attached to ("attached character"): Taskmaster, or the enemy leader. */
const HOST = query("character", { hostOfSelf: true });
/** "Give the enemy leader a tough status card and a facedown boost card." */
const TOUGH_AND_BOOST = [giveTough(enemyLeader), giveBoostCard(enemyLeader)];

/**
 * Modular set `taskmaster_modular` (Registration side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section
 * 8.3). Retaliate 1, Toughness and Villainous (Taskmaster; RRG 1.8 p. 47), both attachments' "Attach to Taskmaster.
 * Otherwise, attach to the enemy leader." (M9), their stat modifiers (+1 ATK, +1 SCH) and Hinder 1[per_hero] are data.
 *
 * **Taskmaster (57022)**: When Revealed: he activates against you (he engages the revealing player first, as any
 * revealed minion does), attacking a player in hero form and scheming against one in alter-ego form (RRG 1.8
 * "Activation", p. 6).
 *
 * **Taskmaster's Sword (57023)**: the attached character's attacks gain piercing. Hero Action: spend a [mental] and a
 * [physical] resource to discard this card.
 *
 * **Taskmaster's Shield (57024)**: Forced Interrupt: when the attached character would take any amount of damage,
 * reduce that amount by 1: an interrupt (`preventDamage(1)`, as Warning 09021), not a constant, so a tough status card
 * is used first (RRG 1.8 Appendix III timing priority). Hero Action: spend a [mental] and a [physical] resource to discard this card.
 *
 * **Mimicked Move (57025)**: "If Taskmaster is in play, he attacks your leader. Otherwise, give the enemy leader a
 * tough status card and a facedown boost card." In a cooperative game there is no "your leader" to attack (MC57 p. 4),
 * so the first sentence cannot resolve and "Otherwise" does even with Taskmaster in play (RRG 1.8 "Otherwise", p. 31;
 * docs/phase7-synthezoid.md M13); "enemy leader" is the villain (ruling July 9, 2026 R3). The attack on your leader
 * is competitive only, written in full as a marker. Boost: the activating enemy gets an additional boost card.
 *
 * **Taskmaster's Academy (57026)**: When Defeated: the enemy leader is given a tough status card and a facedown boost
 * card.
 *
 * Cards (5):
 * - 57022 Taskmaster (minion)
 * - 57023 Taskmaster's Sword (attachment)
 * - 57024 Taskmaster's Shield (attachment)
 * - 57025 Mimicked Move (treachery)
 * - 57026 Taskmaster's Academy (side_scheme)
 */
export const SYNTHEZOID_MODULAR_TASKMASTER: AbilityRegistry = defineAbilities({
  "57022.when-revealed": whenRevealed(enemyActivates(self, { against: you })),

  "57023.taskmasters-sword-constant": constant(attacksGainKeywords(["piercing"], { attacker: HOST })),
  "57023.taskmasters-sword-action": heroAction({ cost: spend({ mental: 1, physical: 1 }) }, discard(self)),

  "57024.taskmasters-shield-forced-interrupt": forcedInterrupt(on.damage("host"), preventDamage(1)),
  "57024.taskmasters-shield-action": heroAction({ cost: spend({ mental: 1, physical: 1 }) }, discard(self)),

  "57025.when-revealed": whenRevealed(
    ifThen(
      inCompetitiveMode(),
      ifThen(
        exists(query("minion", { name: TASKMASTER })),
        [competitiveOnly("Taskmaster attacks your leader.")],
        TOUGH_AND_BOOST,
      ),
      TOUGH_AND_BOOST,
    ),
  ),
  "57025.boost": boost(modifyAttack({ extraBoostCards: 1 })),

  "57026.when-defeated": whenDefeated(...TOUGH_AND_BOOST),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_TASKMASTER_SKIPPED: Readonly<Record<string, string>> = {};
