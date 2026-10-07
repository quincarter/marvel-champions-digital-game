import type { AbilityRegistry } from "@mc/engine";
import {
  adjustBoostCount,
  boost,
  chooseOne,
  constant,
  dealEncounterCard,
  defineAbilities,
  eachPlayer,
  eventDealt,
  forcedResponse,
  ifThen,
  named,
  on,
  option,
  placeThreat,
  removeThreat,
  schemeThreatOn,
  self,
  threatOn,
  valueAtLeast,
  whenDefeated,
  whenRevealed,
} from "../../dsl/index.js";

const ANCIENT_RITUAL = named("Ancient Ritual");

/**
 * "Choose: Either place 3 threat on Ancient Ritual, or this card gains [boost][boost][boost]." (Ozymandias, Tyrant
 * Worship.) Both options are always available: Ancient Ritual is permanent, so it is in play whenever the set is.
 * The player the activation is against chooses.
 */
const RITUAL_OR_ICONS = chooseOne(
  option("Place 3 threat on Ancient Ritual", placeThreat(3, ANCIENT_RITUAL)),
  option("This card gains [boost][boost][boost]", adjustBoostCount(3)),
);

/**
 * Modular encounter set `clan_akkaba` (Age of Apocalypse, docs/phase7-wave8.md §2.10, §3.29, §8.4): Ozymandias, Scarab,
 * three Clan Akkaba Zealots, Tyrant Worship and the permanent, setup side scheme Ancient Ritual (5 threat flat).
 * Toughness, Villainous, Quickstrike, Guard, Permanent and Setup are data keywords. Ancient Ritual checks once per
 * placement, however much threat was placed; its removal is not a placement, so it does not check again. Ozymandias's
 * scheme threat goes on Ancient Ritual (`schemeThreatOn`, as Dark Phoenix's on Consume the World).
 *
 * Cards (5):
 * - 45159 Ozymandias (minion)
 * - 45160 Scarab (minion)
 * - 45161 Clan Akkaba Zealot (minion)
 * - 45162 Tyrant Worship (treachery)
 * - 45163 Ancient Ritual (side_scheme)
 */
export const CLAN_AKKABA: AbilityRegistry = defineAbilities({
  // Ozymandias — [star] When Ozymandias schemes, place the threat on Ancient Ritual.
  "45159.ozymandias-constant": constant(schemeThreatOn({ self: true }, ANCIENT_RITUAL)),
  // [star] Boost: Choose: Either place 3 threat on Ancient Ritual, or this card gains [boost][boost][boost].
  "45159.boost": boost(RITUAL_OR_ICONS),

  // Scarab — [star] Forced Response: After Scarab attacks, place 1 threat on Ancient Ritual (3 instead if the attack
  // defeated an ally; an attack that defeats an identity records no defeat result, the player is eliminated instead).
  "45160.scarab-forced-response": forcedResponse(
    on.enemyAttacks("self"),
    ifThen(eventDealt("defeated"), placeThreat(3, ANCIENT_RITUAL), placeThreat(1, ANCIENT_RITUAL)),
  ),

  // Clan Akkaba Zealot — When Defeated: Place 2 threat on Ancient Ritual. [star] Boost: Place 1 threat on it.
  "45161.when-defeated": whenDefeated(placeThreat(2, ANCIENT_RITUAL)),
  "45161.boost": boost(placeThreat(1, ANCIENT_RITUAL)),

  // Tyrant Worship — When Revealed: Place 5 threat on Ancient Ritual. [star] Boost: as Ozymandias's.
  "45162.when-revealed": whenRevealed(placeThreat(5, ANCIENT_RITUAL)),
  "45162.boost": boost(RITUAL_OR_ICONS),

  // Ancient Ritual — Forced Response: After threat is placed here, if there is at least 10 threat here, remove 5
  // threat from this scheme and deal each player a facedown encounter card.
  "45163.ancient-ritual-forced-response": forcedResponse(
    on.threatPlaced("self"),
    ifThen(valueAtLeast(threatOn(self), 10), [removeThreat(5, self), dealEncounterCard(eachPlayer)]),
  ),
});
