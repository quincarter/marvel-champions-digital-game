// Hand-authored: there is no MarvelCDB equivalent of a campaign record (docs/campaign-mode-design.md section 3), the same
// gap the other boxes' own `campaign.ts` fill. Built from the MC65 rulebook conversion,
// docs/campaign-modes/markdown/mc65_shadowland.md ("MC65"), per docs/phase7-shadowland.md section 4.1 and 6 (task D4).

import { campaignId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Campaign } from "../../schema/index.js";

/**
 * Shadowland's campaign: three scenarios played in this fixed order, all won to complete it (MC65 p. 4; a loss may be
 * reset with no penalty, p. 5). The scenario records themselves (`shadows-in-the-night`, `shadow-labyrinth`,
 * `heart-of-shadow`) are authored in `curation/shadowland-scenarios.ts` and join `SHADOWLAND_SCENARIOS` once their main
 * scheme faces are transcribed.
 *
 * `prohibited.encounterSetIds` holds Black Flower: "Cards from the Black Flower modular set are required by some
 * Campaign Instructions, so it cannot be included as a modular set in any scenario while playing the campaign" (MC65
 * p. 5). It stays selectable in a standalone scenario.
 *
 * No `campaignSetIds`: the pack has no campaign-only encounter set (Creeping Corruption is a Black Flower card the
 * instructions put into play). No `perSeatSetIds`, no `roles`. The campaign log is on the insert's back cover (p. 20); the
 * repo has no separate log sheet.
 */
export const SHADOWLAND_CAMPAIGN: Campaign = {
  id: campaignId("shadowland"),
  name: "Shadowland",
  boxCode: "MC65",
  packCode: setCode("shadowland"),
  scenarioIds: [scenarioId("shadows-in-the-night"), scenarioId("shadow-labyrinth"), scenarioId("heart-of-shadow")],
  campaignSetIds: [],
  prohibited: { encounterSetIds: [encounterSetId("black_flower")] },
  logSheetReference: "docs/campaign-modes/markdown/mc65_shadowland.md",
};
