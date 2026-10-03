import { trait } from "@mc/content";
import {
  anAttackableEnemy,
  attack,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  defineAbilities,
  hasAttachment,
  heroAction,
  heroInterrupt,
  modifyAttack,
  moveCards,
  query,
  thwartAScheme,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
} from "../../../dsl/index.js";

const TACTIC = trait("TACTIC");

/**
 * Cyclops's own signature events (`cyclops` 33008-33010, docs/phase7-wave6.md §6.1). His leadership and basic events
 * (Teamwork 33017, Game Time 33022, Psychic Rapport 33023) are other modules.
 *
 * - **Full Blast (33008)**: "When you use your 'Optic Blast' ability, exhaust Cyclops -> this attack deals 8 additional
 *   damage and gains overkill": an interrupt on the attack Optic Blast makes (`sourceAbility`, §3.84; not Ricochet
 *   Beam's), `modifyAttack.extraDamage` (§3.29). Not offered while Cyclops is exhausted (its cost can't be paid).
 * - **Ricochet Beam (33009)**: an "(attack)" event, so both instances of damage are attacks (guard applies to each
 *   target; Exploit Weakness adds 1 to each, so 8 on one enemy, FAQ "Ricochet Beam (#9)", RRG 1.8 p. 63). The second
 *   target is read when the second sentence resolves, after the first has been dealt.
 * - **Tactical Brilliance (33010)**: a thwart for 3, then a TACTIC card chosen from your discard pile goes to hand
 *   (mandatory when there is one; the event itself is not a TACTIC and is still in play while it resolves).
 */
export const CYCLOPS_EVENTS = defineAbilities({
  "33008.full-blast-interrupt": heroInterrupt(
    { on: "attack", sourceIs: YOUR_IDENTITY, sourceAbility: "33001a.cyclops-constant" },
    { cost: { exhaustIdentity: true } },
    modifyAttack({ extraDamage: 8, overkill: true }),
  ),

  "33009.ricochet-beam-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("first"),
    attack(3, chosen("first")),
    chooseTarget("second", query("enemy", { ...hasAttachment(query("upgrade")), attackableBy: yourIdentity })),
    attack(3, chosen("second")),
  ),

  "33010.tactical-brilliance-action": heroAction(
    { label: "thwart" },
    ...thwartAScheme(3),
    chooseCards(
      "found",
      zone("discard", you, { filter: query(["ally", "event", "upgrade", "support", "resource"], { trait: TACTIC }) }),
      { min: 1, max: 1 },
    ),
    moveCards(cards(chosen("found")), "hand"),
  ),
});
