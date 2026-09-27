import {
  attachCard,
  boost,
  cannotAttach,
  constant,
  countOf,
  defineAbilities,
  each,
  gets,
  modifyAttack,
  query,
  resolveSpecialsOf,
  rule,
  self,
  theMainScheme,
  theVillain,
} from "../../../dsl/index.js";

/**
 * The Sinister Six's four encounter attachments (`sm` 27103–27106, MC27 p. 15) and its own side scheme (27107). Each
 * attachment's "Attach to the villain with the [highest/lowest/most] [measure]. If you cannot, resolve the 'Ambush!'
 * ability on the main scheme, then attach this card to the active villain." is `AttachmentCard.attachesTo` (a
 * `superlative` host, docs/phase7-wave2.md §6.7's own reading of this exact card — attachment-host.ts's own
 * `activationOrder` doc cites Heightened Morale/Team Leader by name) plus the printed `statModifiers` box where the
 * bonus is a fixed number; none of that is scripted here.
 *
 * The "If you cannot, resolve the 'Ambush!' ability on the main scheme, then attach this card to the active villain."
 * half is each card's first ability ref (`AMBUSH_FALLBACK`), a `cannotAttach` ability: the engine resolves it instead
 * of RRG 1.8 "Attach To"'s (p. 8) discard when the `attachesTo` host finds no villain. The main scheme's own Setup
 * puts villains into play before any of these is drawn (§1.5), so "no villain in play" is transient: only between a
 * villain's defeat and the next villain activation (`main-scheme.ts`'s own `AMBUSH_INTERRUPT`).
 */
const AMBUSH_FALLBACK = () =>
  cannotAttach(
    // Both main scheme B sides print the same Special; only the stage in play is live.
    resolveSpecialsOf(theMainScheme, undefined, { abilities: ["27100b.ambush", "27101b.ambush"] }),
    // "The active villain" is "the villain": whoever Ambush! just gave the counter. With none (no villain was set
    // aside), the card stays unattached and the engine discards it.
    attachCard(self, theVillain),
  );

export const SINISTER_SIX_ENCOUNTER_ATTACHMENTS = defineAbilities({
  // Heightened Morale (27103) — attach host is data; this is its "If you cannot" fallback (module docblock).
  "27103.heightened-morale-constant": AMBUSH_FALLBACK(),
  // Heightened Morale (27103) — "+X ATK. X is equal to the number of villains in play." The stat box prints "X",
  // not a fixed number, so `AttachmentCard.statModifiers` (fixed numbers only) cannot carry it; this is the whole
  // bonus, read live off however many villains are in play right now.
  "27103.heightened-morale-constant-2": constant(gets("atk", countOf(query("villain")), { hostOfSelf: true })),

  // Taunting Presence (27104) — attach host is data; this is its "If you cannot" fallback.
  "27104.taunting-presence-constant": AMBUSH_FALLBACK(),
  // Taunting Presence (27104) — "Threat cannot be removed from Light at the End." (curation/sm.ts's own
  // `27104` correction restores this sentence, missing from MarvelCDB's raw text but present on the card's scan).
  "27104.taunting-presence-constant-2": constant(
    rule({ kind: "threatCannotBeRemoved", target: query("sideScheme", { name: "Light at the End" }) }),
  ),

  // Team Leader (27105) — attach host is data; this is its "If you cannot" fallback. The printed crisis scheme icon
  // (docs/phase7-wave5.md §1.3) is `BaseCard.schemeIcons`, data on the card itself, not an ability; no other text.
  "27105.team-leader-constant": AMBUSH_FALLBACK(),

  // Take One for the Team (27106) — attach host is data; this is its "If you cannot" fallback.
  "27106.take-one-for-the-team-constant": AMBUSH_FALLBACK(),
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
