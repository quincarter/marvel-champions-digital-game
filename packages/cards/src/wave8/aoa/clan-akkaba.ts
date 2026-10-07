import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `clan_akkaba`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 45159 Ozymandias (minion)
 * - 45160 Scarab (minion)
 * - 45161 Clan Akkaba Zealot (minion)
 * - 45162 Tyrant Worship (treachery)
 * - 45163 Ancient Ritual (side_scheme)
 */
export const CLAN_AKKABA: AbilityRegistry = defineAbilities({});
