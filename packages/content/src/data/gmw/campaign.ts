// Hand-authored: there is no MarvelCDB equivalent of a campaign record (docs/campaign-mode-design.md §3, §9.1 row
// 1). Built from the primary rulebook conversion, docs/campaign-modes/markdown/mc16_galaxys_most_wanted.md
// ("MC16"), cross-checked against the ingested GMW_SCENARIOS/GMW_ENCOUNTER_SETS this record names (see
// packages/content/src/data/campaigns.test.ts).

import { campaignId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Campaign } from "../../schema/index.js";

/**
 * The Galaxy's Most Wanted's five scenarios in box order (MC16 p. 4, "Campaign Mode Rules": "the players must win
 * all five scenarios in numerical order, starting with scenario #1 (Brotherhood of Badoon) and ending with
 * scenario #5 (Ronan the Accuser)").
 *
 * `the_market` (The Market, cards #150–177) is this box's only campaign-specific encounter set — `campaignSpecific:
 * true` in `GMW_ENCOUNTER_SETS`. Badoon Headhunter and Campaign Challenge (#178–187) are **not** included here
 * despite MC16 p. 4's loose "campaign-specific encounter cards" phrasing: RRG 1.8 FAQ "Modular Encounter Sets"
 * (p. 61) settles that both are modular sets, not the schema's `campaignSpecific` classification (RRG 1.8 p. 11's
 * printed "Campaign" word in the set name, which neither prints) — docs/phase7-wave3.md §1.7 and §4 Q3. Campaign
 * setup still draws their cards; that is `@mc/cards`' `CampaignDefinition`'s job (composeEncounterSets /
 * per-scenario encounter set lists), not this record's.
 *
 * **`perSeatSetIds` is absent.** MC16 prints no per-seat numbered campaign set (unlike MC10 p. 17's four Expert
 * Campaign Sets) — every campaign-specific card is drawn from the single shared `the_market` set.
 */
export const GMW_CAMPAIGN: Campaign = {
  id: campaignId("gmw"),
  name: "The Galaxy's Most Wanted",
  boxCode: "MC16",
  packCode: setCode("gmw"),
  scenarioIds: [
    scenarioId("brotherhood-of-badoon"),
    scenarioId("infiltrate-the-museum"),
    scenarioId("escape-the-museum"),
    scenarioId("nebula"),
    scenarioId("ronan-the-accuser"),
  ],
  campaignSetIds: [encounterSetId("the_market")],
  logSheetReference: "docs/campaign-modes/log-sheets/mc16_galaxys_most_wanted_campaignlog_website-compressed.pdf",
};
