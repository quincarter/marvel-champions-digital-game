import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  atEndOfActivation,
  atMost,
  boost,
  cards,
  chosen,
  constant,
  defeatingPlayer,
  defendingCharacter,
  defineAbilities,
  discardEncounterCards,
  encounterCards,
  exists,
  gets,
  ifThen,
  moveCards,
  query,
  refMatches,
  resolveWhenRevealedOf,
  revealCard,
  rule,
  selectCards,
  self,
  whenDefeated,
  whenRevealed,
} from "../../dsl/index.js";

const NINJA_MINION = query("minion", { trait: trait("NINJA") });
const TEAMWORK_MINION = query("minion", { withKeyword: "teamwork" });

/**
 * "The defeating player discards the top 2 cards of the encounter deck and reveals the first minion with the teamwork
 * keyword discarded this way." (Bo Staff Ninja 65030, Katana Ninja 65032.) Both cards are discarded first (`bind`), then
 * the first of them in discard order that is a minion with teamwork is revealed by the defeating player. A reveal of a
 * Teamwork (Ninja) minion from here checks for another Ninja only after this ability has resolved and the defeated
 * minion is discarded, so the defeated minion never counts (insert FAQ p. 18, M9): the engine runs the new minion's
 * Teamwork after the stack above it, which is this When Defeated. Pinned in `ninja-swarm.test.ts`.
 */
const defeatedNinja = () =>
  whenDefeated(
    discardEncounterCards(2, { bind: "discarded" }),
    selectCards("firstTeamwork", atMost(1, cards(chosen("discarded"), TEAMWORK_MINION))),
    revealCard(chosen("firstTeamwork"), defeatingPlayer),
  );

/**
 * Shadowland, the Ninja Swarm set (MC65; docs/phase7-shadowland.md section 6). Teamwork (Ninja), Guard, Toughness and
 * Surge are data.
 *
 * **65028 Black Mountain**: "While Black Mountain is engaged with you, each other Ninja minion engaged with you cannot
 *   be attacked." A `cannotAttack` rule over the other Ninja minions engaged with the player Black Mountain is engaged
 *   with ("you" of an engaged minion's constant is its engaged player); it binds every player's attack, as the printed
 *   "cannot be attacked" has no player in it. Boost: if an ally is defending against this attack, reveal this minion
 *   (after the activation, like any "reveal this card" boost).
 * **65030 Bo Staff Ninja**, **65032 Katana Ninja**: `defeatedNinja`.
 * **65035 Dancing Shadows**: each Ninja minion gets +1 hit point; threat cannot be removed from it while a Ninja minion
 *   is in play. Boost: reveal this card.
 * **65036 Countless Numbers**: When Revealed shuffles each Ninja minion in the encounter discard pile into the
 *   encounter deck (the deck is shuffled when it names at least one). Boost: resolve the When Revealed ability.
 *
 * Cards (5):
 * - 65028 Black Mountain (minion)
 * - 65030 Bo Staff Ninja (minion)
 * - 65032 Katana Ninja (minion)
 * - 65035 Dancing Shadows (side_scheme)
 * - 65036 Countless Numbers (treachery)
 */
export const SHADOWLAND_NINJA_SWARM: AbilityRegistry = defineAbilities({
  "65028.black-mountain-constant": constant(
    rule({
      kind: "cannotAttack",
      target: query("minion", { trait: trait("NINJA"), self: false, engagedWith: "you" }),
    }),
  ),
  "65028.boost": boost(ifThen(refMatches(defendingCharacter, query("ally")), atEndOfActivation(revealCard(self)))),

  "65030.when-defeated": defeatedNinja(),
  "65032.when-defeated": defeatedNinja(),

  "65035.dancing-shadows-constant": constant(gets("hp", 1, NINJA_MINION)),
  "65035.dancing-shadows-constant-2": constant(
    rule({ kind: "threatCannotBeRemoved", target: { self: true }, while: exists(NINJA_MINION) }),
  ),
  "65035.boost": boost(atEndOfActivation(revealCard(self))),

  "65036.when-revealed": whenRevealed(moveCards(encounterCards(["discard"], NINJA_MINION), "encounterDeckShuffle")),
  // Provisional exception: the boost resolves only the non-surge When Revealed. FFG ruling, September 22, 2026: surge
  // is a When Revealed ability, so "Resolve this card's 'When Revealed' ability" would include it, but FFG plans to
  // errata "Change of Venue and similar encounter cards" to "Boost: Resolve this card's non-surge 'When Revealed'
  // ability". Built to that announced wording ahead of the erratum (owner decision 2026-10-20, spec §S7 E37).
  "65036.boost": boost(resolveWhenRevealedOf(self, { excludeKeywords: ["surge"] })),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_NINJA_SWARM_SKIPPED: Readonly<Record<string, string>> = {};
