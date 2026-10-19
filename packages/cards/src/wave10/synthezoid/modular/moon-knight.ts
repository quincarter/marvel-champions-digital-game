import type { AbilityRegistry } from "@mc/engine";
import {
  atEndOfAttack,
  boost,
  chosen,
  dealDamage,
  defineAbilities,
  discard,
  discardEncounterUntil,
  encounterCards,
  exhaust,
  forcedInterrupt,
  modifyAttack,
  on,
  oncePerPhase,
  query,
  resolveWhenRevealedOf,
  selectCards,
  self,
  whenDefeated,
  whenRevealed,
  yourIdentity,
} from "../../../dsl/index.js";

/**
 * Modular set `moon_knight_modular` (Resistance side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Retaliate 2 and Toughness (Moon Knight) and Hinder 1[per_hero] (Khonshu's Avatar) are data keywords.
 *
 * **Moon Knight (57065)**: When Revealed: resolve the "When Revealed" ability of the topmost treachery in the encounter
 * discard pile. Current text adds "(Limit once per phase.)" (RRG 1.8 errata; the printed card lacks it): the limit is
 * the ability's own `limit`, counted per card instance, so it also holds when another card resolves this ability
 * (`resolveSpecials`), where a limited-out step does not count as resolved (RRG 1.8 "Resolve", p. 37). Not a
 * reveal of that treachery: only its printed When Revealed abilities resolve, so its surge and incite do not (and it
 * announces nothing). With no treachery in the discard pile nothing happens. "You" in the borrowed ability is the
 * player revealing Moon Knight.
 *
 * **Crescent Dart (57066)**: the attach sentence (Moon Knight, otherwise the enemy leader) and +2 ATK are data. Forced
 * Interrupt when the attached enemy attacks: that attack gains piercing and ranged, and the card is discarded at the
 * end of that attack (the Ahab's Energy Spear shape, `45099`).
 *
 * **Fist of Khonshu (57067)**: When Revealed: exhaust your identity and deal 2 damage to it (two instructions joined by
 * "and", RRG 1.8 p. 7: an identity that is already exhausted still takes the damage). Boost: exhaust your identity.
 *
 * **Khonshu's Avatar (57068)**: When Defeated: discard from the top of the encounter deck until a treachery is
 * discarded (it stops if the deck runs out, RRG 1.8 p. 17), then resolve that card's When Revealed.
 * "You" in it is the first player: the text names no player (RRG 1.8 p. 19), not the defeating player.
 *
 * Cards (4):
 * - 57065 Moon Knight (minion)
 * - 57066 Crescent Dart (attachment)
 * - 57067 Fist of Khonshu (treachery)
 * - 57068 Khonshu's Avatar (side_scheme)
 */
export const SYNTHEZOID_MODULAR_MOON_KNIGHT: AbilityRegistry = defineAbilities({
  "57065.when-revealed": {
    ...whenRevealed(
      selectCards("topmost", encounterCards(["discard"], query("treachery"), { topmostOnly: true })),
      resolveWhenRevealedOf(chosen("topmost")),
    ),
    limit: oncePerPhase,
  },

  "57066.crescent-dart-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("host"),
    modifyAttack({ keywords: ["piercing", "ranged"] }),
    atEndOfAttack(discard(self)),
  ),

  "57067.when-revealed": whenRevealed(exhaust(yourIdentity), dealDamage(2, yourIdentity)),
  "57067.boost": boost(exhaust(yourIdentity)),

  "57068.when-defeated": whenDefeated(
    discardEncounterUntil(query("treachery"), "found"),
    resolveWhenRevealedOf(chosen("found")),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_MOON_KNIGHT_SKIPPED: Readonly<Record<string, string>> = {};
