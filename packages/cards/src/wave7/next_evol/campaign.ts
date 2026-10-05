import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/** The campaign cards: the six player side schemes and their environment faces 40190a/b-40195a/b, Pouches 40196 and Safehouse 40197 (14 faces), then the Next Evolution Campaign encounter set 40198-40203 (the campaign's own scenario cards). Not scripted yet: an empty registry for the scripting agent of this group to fill. */
export const NEXT_EVOL_CAMPAIGN_CARDS: AbilityRegistry = defineAbilities({});
