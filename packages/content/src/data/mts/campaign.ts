// Hand-authored: there is no MarvelCDB equivalent of a campaign record (docs/campaign-mode-design.md §3, §9.1 row
// 1), the same gap `gmw`'s and `trors`' own `campaign.ts` fill. Built from the primary rulebook conversion,
// docs/campaign-modes/markdown/mc21_the_mad_titans_shadow.md ("MC21"), cross-checked against the ingested
// MTS_SCENARIOS/MTS_ENCOUNTER_SETS this record names (see packages/content/src/data/campaigns.test.ts).

import { campaignId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Campaign } from "../../schema/index.js";

/**
 * The Mad Titan's Shadow's five scenarios in box order (MC21 p. 2: "Ebony Maw", "Tower Defense", "Thanos", "Hela",
 * "Loki"; the campaign instructions on each scenario's own page — pp. 7, 13, 17, 21, 25 — chain them in this same
 * order, "if the players won, proceed to..."). `docs/phase7-wave4.md` §2.2's own table lists the same five, in
 * the same order, as this box's "Campaign (MC21 pp. 4, 7, 13, 17, 21, 25)" section.
 *
 * `mts_campaign` (The Mad Titan's Shadow Campaign, cards 180-193) is this box's only campaign-specific encounter
 * set — `campaignSpecific: true` in `MTS_ENCOUNTER_SETS`, matching how `GMW_CAMPAIGN`/`TRORS_CAMPAIGN` each name
 * their own box's single campaign-specific set. Not included here (and not in `CAMPAIGNS`, `../index.ts`'s own
 * comment on that aggregate): the box's campaign *instructions* — what setup/victory each scenario adds, which
 * card flips into which other, System Shock's hand-ability and "cannot choose to discard" text — are
 * `@mc/cards`' `CampaignDefinition` DSL (`ability-scripting-engineer`'s work, docs/phase7-wave4.md §2.2's own
 * "Campaign (data only — scripting comes later)" framing), not this package's `Campaign` record, which is only
 * the plain-data box/scenario/set membership half (`docs/campaign-mode-design.md` §3, §9.1 row 1).
 */
export const MTS_CAMPAIGN: Campaign = {
  id: campaignId("mts"),
  name: "The Mad Titan's Shadow",
  boxCode: "MC21",
  packCode: setCode("mts"),
  scenarioIds: [
    scenarioId("ebony-maw"),
    scenarioId("tower-defense"),
    scenarioId("thanos"),
    scenarioId("hela"),
    scenarioId("loki"),
  ],
  campaignSetIds: [encounterSetId("mts_campaign")],
  logSheetReference: "docs/campaign-modes/log-sheets/mc21_the_mad_titans_shadow_rulebook-compressed-campaign_log.pdf",
};
