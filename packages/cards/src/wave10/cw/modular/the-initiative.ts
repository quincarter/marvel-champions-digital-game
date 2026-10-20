import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  attachCard,
  boost,
  chosen,
  competitiveOnly,
  confuse,
  constant,
  dealIndirectDamage,
  defineAbilities,
  discardEncounterUntil,
  each,
  encounterCards,
  gainsTrait,
  gets,
  hasStatus,
  ifThen,
  inCompetitiveMode,
  moveCards,
  not,
  placeThreat,
  query,
  resolveWhenRevealedOf,
  revealCard,
  self,
  stun,
  surge,
  theMainScheme,
  varAtLeast,
  whenDefeated,
  whenRevealed,
  yourIdentity,
  you,
} from "../../../dsl/index.js";

const AVENGER = trait("AVENGER");
/** The minion a Drafted is attached to ("attached minion"). */
const HOST_MINION = query("minion", { hostOfSelf: true });

/**
 * Modular encounter set `the_initiative` (Civil War, Registration side; docs/phase7-wave10.md section 3.23). Guard,
 * Quickstrike, Hinder 1[per_hero] and the crisis icon are data keywords and data fields.
 *
 * **Doc Samson (56078)** and **Hellcat (56079)**: the status the text gives is read before the card's own status is
 * given, so "if you were already confused / stunned" looks at the player's identity as it was (the same shape as Bomb
 * Scare and False Alarm). Doc Samson: confused, and 2 threat on the main scheme if already confused. Hellcat: stunned,
 * and 2 indirect damage (divided by the player among the characters they control) if already stunned. Each Boost
 * gives the status alone.
 *
 * **Drafted (56080)**: the attached minion gets +2 hit points and the Avenger trait. When Revealed, in a cooperative
 * game: cards are discarded from the encounter deck until a minion is discarded, that minion is revealed, then Drafted
 * is attached to it. The competitive sentence is the true branch of `inCompetitiveMode()` and is never resolved here
 * (docs/phase7-wave10.md section 3.4); it has no attach data of its own, so the card attaches through this When
 * Revealed (RRG 1.8 "Reveal", p. 38, step 2). A minion that does not enter play (the unique rule discards it) takes no
 * Drafted, which is then discarded (RRG 1.8 "Attach To", p. 8).
 *
 * **Mighty Avengers (56081)**: the "When Revealed" ability of each minion in play is resolved, a minion's incite and
 * surge included (FFG ruling, September 22, 2026; owner decision 2026-10-20, revising docs/phase7-wave4.md §4 Q23,
 * section 3.56); with none resolved the card gains surge.
 *
 * **The Fifty State Initiative (56082)**: When Defeated: each Avenger minion in the encounter discard pile is shuffled
 * into the encounter deck.
 *
 * Cards (5):
 * - 56078 Doc Samson (minion)
 * - 56079 Hellcat (minion)
 * - 56080 Drafted (attachment)
 * - 56081 Mighty Avengers (treachery)
 * - 56082 The Fifty State Initiative (side_scheme)
 */
export const MODULAR_THE_INITIATIVE: AbilityRegistry = defineAbilities({
  "56078.when-revealed": whenRevealed(
    ifThen(hasStatus(yourIdentity, "confused"), placeThreat(2, theMainScheme)),
    confuse(yourIdentity),
  ),
  "56078.boost": boost(confuse(yourIdentity)),

  "56079.when-revealed": whenRevealed(
    ifThen(hasStatus(yourIdentity, "stunned"), dealIndirectDamage(you, 2)),
    stun(yourIdentity),
  ),
  "56079.boost": boost(stun(yourIdentity)),

  "56080.drafted-constant": constant(gets("hp", 2, HOST_MINION), gainsTrait(AVENGER, HOST_MINION)),
  "56080.when-revealed": whenRevealed(
    ifThen(
      inCompetitiveMode(),
      competitiveOnly(
        "In competitive mode, the enemy team attaches Drafted to a minion engaged with them and that minion engages you.",
      ),
      [discardEncounterUntil(query("minion"), "found"), revealCard(chosen("found")), attachCard(self, chosen("found"))],
    ),
  ),

  "56081.when-revealed": whenRevealed(
    resolveWhenRevealedOf(each(query("minion")), { bind: "resolved" }),
    ifThen(not(varAtLeast("resolved.count")), surge()),
  ),

  "56082.when-defeated": whenDefeated(
    moveCards(encounterCards(["discard"], query("minion", { trait: AVENGER })), "encounterDeckShuffle"),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const MODULAR_THE_INITIATIVE_SKIPPED: Readonly<Record<string, string>> = {};
