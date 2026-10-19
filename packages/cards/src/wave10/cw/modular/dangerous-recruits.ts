import type { AbilityRegistry } from "@mc/engine";
import {
  attacksGainKeywords,
  boostCardOf,
  chooseTarget,
  chosen,
  competitiveOnly,
  constant,
  countOf,
  defineAbilities,
  discard,
  enemyActivates,
  enemyLeader,
  exists,
  firstPlayer,
  forcedInterrupt,
  ifThen,
  inCompetitiveMode,
  on,
  placeThreat,
  query,
  self,
  setDefeatDestination,
  surge,
  theMainScheme,
  whenRevealed,
  you,
  boost,
} from "../../../dsl/index.js";
import { STREET_DEFENDERS } from "./defenders.js";

const MINION = query("minion");

/**
 * Modular encounter set `dangerous_recruits` (Civil War, Registration side; docs/phase7-wave10.md sections 3.6, 3.10
 * and 3.23). Hinder 1[per_hero] on Dangerous Recruits is a data keyword. In a cooperative game there is no "your
 * leader" (MC56 p. 6), so each "Otherwise" sentence resolves; the sentence about your leader is written in full as a
 * competitive-only marker.
 *
 * **Venom (56087)**: his attacks gain piercing. When Revealed: "Venom attacks your leader" has no leader to attack
 * cooperatively, so he activates against you (a minion, so no boost card).
 *
 * **Bullseye (56088)**: When Revealed: "The enemy team discards an attachment from your leader" does nothing
 * cooperatively; you discard an upgrade you control (your choice; none, nothing).
 *
 * **Justice Like Lightning (56089)**: the same text as Street Defenders (56187 and 56192), the one shared definition.
 *
 * **Excessive Force (56090)**: When Revealed: 1 threat on the main scheme for each minion in play; with no minion in
 * play it gains surge. Boost: "The enemy leader attacks your leader" has no leader to attack and does nothing.
 *
 * **Dangerous Recruits (56091)**: Forced Interrupt: a defeated minion is given to the enemy leader as a facedown boost
 * card instead of going to the discard pile; it is turned up at the leader's next activation (RRG 1.8 "Boost, Boost
 * Icon", p. 11). A minion's own When Defeated resolves first (RRG 1.8 "When Defeated Abilities", p. 48). A non-villainous
 * minion gets no boost card of its own, but is still given to the leader.
 *
 * Cards (5):
 * - 56087 Venom (minion)
 * - 56088 Bullseye (minion)
 * - 56089 Justice Like Lightning (treachery)
 * - 56090 Excessive Force (treachery)
 * - 56091 Dangerous Recruits (side_scheme)
 */
export const MODULAR_DANGEROUS_RECRUITS: AbilityRegistry = defineAbilities({
  "56087.venom-constant": constant(attacksGainKeywords(["piercing"], { attacker: { self: true } })),
  "56087.when-revealed": whenRevealed(
    ifThen(
      inCompetitiveMode(),
      [competitiveOnly("Venom attacks your leader.")],
      enemyActivates(self, { against: you }),
    ),
  ),

  "56088.when-revealed": whenRevealed(
    ifThen(
      inCompetitiveMode(),
      [competitiveOnly("The enemy team discards an attachment from your leader.")],
      // No "choose": an encounter card targeting one of several eligible cards; the first player selects
      // (RRG 1.8 "First Player", p. 19).
      [
        chooseTarget("upgrade", query("upgrade", { controller: "you" }), { chooser: firstPlayer }),
        discard(chosen("upgrade")),
      ],
    ),
  ),

  "56089.when-revealed": STREET_DEFENDERS,

  "56090.when-revealed": whenRevealed(ifThen(exists(MINION), placeThreat(countOf(MINION), theMainScheme), surge())),
  "56090.boost": boost(
    ifThen(inCompetitiveMode(), [
      competitiveOnly(
        "The enemy leader attacks your leader (after this activation). Do not give it a boost card for that attack.",
      ),
    ]),
  ),

  "56091.dangerous-recruits-forced-interrupt": forcedInterrupt(
    on.defeated(query("minion")),
    setDefeatDestination(boostCardOf(enemyLeader)),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const MODULAR_DANGEROUS_RECRUITS_SKIPPED: Readonly<Record<string, string>> = {};
