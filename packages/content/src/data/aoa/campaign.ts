// Hand-authored: there is no MarvelCDB equivalent of a campaign record (docs/campaign-mode-design.md §3, §9.1 row
// 1), the same gap `next_evol`'s and `mut_gen`'s own `campaign.ts` fill. Built from the primary rulebook conversion,
// docs/campaign-modes/markdown/mc45_age_of_apocalypse.md ("MC45"), per docs/phase7-wave8.md §1.23, and
// cross-checked against the ingested AOA_SCENARIOS/AOA_ENCOUNTER_SETS this record names (see
// packages/content/src/data/wave8.test.ts).

import { campaignId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Campaign } from "../../schema/index.js";

/**
 * Age of Apocalypse's five scenarios in the fixed order MC45 p. 4 prints ("the players must win all five scenarios in
 * numerical order, starting with scenario #1 - Unus and ending with scenario #5 - En Sabah Nur"): Unus p. 8, Four
 * Horsemen p. 12, Apocalypse p. 14, Dark Beast p. 16, En Sabah Nur p. 20.
 *
 * Five encounter sets are campaign-specific (MC45 p. 4: "Cards 164-183 are cards that were created specifically for
 * use in the Age of Apocalypse campaign ... cannot be included in any deck unless playing the Age of Apocalypse
 * campaign"), and `aoa_basic_campaign` holds the six BASIC / CAMPAIGN player records (Mission Team 171, the rewards).
 * Whether the four-card `age_of_apocalypse` set is also offered as a plain modular set is open question Q23;
 * this record follows the rulebook and the recommended default A (campaign-specific only).
 *
 * No `prohibited` (the rulebook forbids no card or set; "Professor X cannot enter play during this game" is a rule of
 * one game), no `perSeatSetIds`, no `roles` (docs/phase7-wave8.md §1.23).
 *
 * Not included here: the campaign log's fields (identity, remaining hit points, the missions and overseers strike
 * lists, the per-mission results) and the campaign instructions are `@mc/cards`' `CampaignDefinition`, not this
 * plain-data record. `AOA_CAMPAIGN` is registered in `CAMPAIGNS`.
 */
export const AOA_CAMPAIGN: Campaign = {
  id: campaignId("aoa"),
  name: "Age of Apocalypse",
  boxCode: "MC45",
  packCode: setCode("aoa"),
  scenarioIds: [
    scenarioId("unus"),
    scenarioId("four-horsemen"),
    scenarioId("apocalypse"),
    scenarioId("dark-beast"),
    scenarioId("en-sabah-nur"),
  ],
  campaignSetIds: [
    encounterSetId("age_of_apocalypse"),
    encounterSetId("aoa_mission"),
    encounterSetId("overseer"),
    encounterSetId("aoa_campaign"),
    encounterSetId("aoa_basic_campaign"),
  ],
  logSheetReference: "docs/campaign-modes/log-sheets/mc45_age_of_apocalypse_campaign_log.pdf",
};
