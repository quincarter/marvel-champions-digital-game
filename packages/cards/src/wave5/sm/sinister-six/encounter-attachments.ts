import {
  boost,
  constant,
  coveredByEngineRule,
  countOf,
  defineAbilities,
  each,
  gets,
  modifyAttack,
  query,
  rule,
  self,
} from "../../../dsl/index.js";

/**
 * The Sinister Six's four encounter attachments (`sm` 27103–27106, MC27 p. 15) and its own side scheme (27107). Each
 * attachment's "Attach to the villain with the [highest/lowest/most] [measure]. If you cannot, resolve the 'Ambush!'
 * ability on the main scheme, then attach this card to the active villain." is `AttachmentCard.attachesTo` (a
 * `superlative` host, docs/phase7-wave2.md §6.7's own reading of this exact card — attachment-host.ts's own
 * `activationOrder` doc cites Heightened Morale/Team Leader by name) plus the printed `statModifiers` box where the
 * bonus is a fixed number; none of that is scripted here.
 *
 * **Known gap, not built here:** the "If you cannot, resolve the 'Ambush!' ability … then attach to the active
 * villain" fallback is not modeled by any host kind or ability hook — `resolveAttachmentTarget`
 * (`packages/engine/src/resolve/reveal.ts`) discards an attachment outright when its `attachesTo` yields no
 * candidate (RRG 1.8 "Attach To", p. 8's default), with no trigger event an ability could interrupt. Reproducing
 * the printed fallback needs a new engine primitive (an attach-host kind that can run effects, or a "would be
 * discarded for lack of a host" event) — flagged for `game-rules-architect`, not hacked around here. The scenario's
 * own main-scheme Setup means these attachments are drawn from an already-populated encounter deck (§1.5), and
 * "no villain in play" is transient (only between a villain's defeat and the next villain activation, `main-
 * scheme.ts`'s own `AMBUSH_INTERRUPT`), so this gap is real but narrow.
 */
export const SINISTER_SIX_ENCOUNTER_ATTACHMENTS = defineAbilities({
  // Heightened Morale (27103) — attach clause is data (see module docblock).
  "27103.heightened-morale-constant": coveredByEngineRule(),
  // Heightened Morale (27103) — "+X ATK. X is equal to the number of villains in play." The stat box prints "X",
  // not a fixed number, so `AttachmentCard.statModifiers` (fixed numbers only) cannot carry it; this is the whole
  // bonus, read live off however many villains are in play right now.
  "27103.heightened-morale-constant-2": constant(gets("atk", countOf(query("villain")), { hostOfSelf: true })),

  // Taunting Presence (27104) — attach clause is data (see module docblock).
  "27104.taunting-presence-constant": coveredByEngineRule(),
  // Taunting Presence (27104) — "Threat cannot be removed from Light at the End." (curation/sm.ts's own
  // `27104` correction restores this sentence, missing from MarvelCDB's raw text but present on the card's scan).
  "27104.taunting-presence-constant-2": constant(
    rule({ kind: "threatCannotBeRemoved", target: query("sideScheme", { name: "Light at the End" }) }),
  ),

  // Team Leader (27105) — attach clause is data. The printed crisis scheme icon (docs/phase7-wave5.md §1.3) is
  // `BaseCard.schemeIcons`, data on the card itself, not an ability; no other text.
  "27105.team-leader-constant": coveredByEngineRule(),

  // Take One for the Team (27106) — attach clause is data.
  "27106.take-one-for-the-team-constant": coveredByEngineRule(),
  // Take One for the Team (27106) — "You cannot attack villains who do not have an attached copy of Take One for
  // the Team.": every villain except those an attached copy of this card (matched by name, since another copy
  // could be attached to a different villain) makes legal.
  "27106.take-one-for-the-team-constant-2": constant(
    rule({
      kind: "cannotAttack",
      target: query("villain", {
        excluding: each(query("villain", { hasAttachment: query(["attachment"], { name: "Take One for the Team" }) })),
      }),
    }),
  ),

  // Brute Force Barricade (27107) — "Threat cannot be removed from other side schemes."
  "27107.brute-force-barricade-constant": constant(
    rule({ kind: "threatCannotBeRemoved", target: query("sideScheme", { excluding: self }) }),
  ),
  // Brute Force Barricade (27107) — "[star] Boost: Give the villain 1 additional boost card for this activation."
  // Identical text to Goblin Gimmicks' Intimidation (`gob` 02035): `modifyAttack({ extraBoostCards: 1 })`, not
  // `giveBoostCard`, applies "for this activation" (attack or scheme alike — a boost card resolving during a scheme
  // activation harmlessly no-ops the attack-only fields `modifyAttack` also carries).
  "27107.boost": boost(modifyAttack({ extraBoostCards: 1 })),
});
