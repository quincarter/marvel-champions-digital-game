// Hand-authored: there is no MarvelCDB equivalent of a campaign record (docs/campaign-mode-design.md §3, §9.1 row
// 1). Built from the primary rulebook conversion, docs/campaign-modes/markdown/mc10_the_rise_of_red_skull.md
// ("MC10"), cross-checked against the ingested TRORS_SCENARIOS/TRORS_ENCOUNTER_SETS this record names (see
// packages/content/src/data/trors/campaign.test.ts).

import { campaignId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Campaign } from "../../schema/index.js";

/**
 * The Rise of Red Skull's five scenarios in box order (MC10 p. 3, "Campaign Mode Rules": "the players must complete
 * each scenario ... in the order listed below"). `hydra_camp` (the four Hydra Campaign upgrades players choose
 * from) and `expcamp` (the four Expert Campaign obligations) are this box's campaign-specific sets — both are
 * `campaignSpecific: true` in `TRORS_ENCOUNTER_SETS`.
 *
 * **`perSeatSetIds` is absent.** MC10 p. 17 prints four *numbered* Expert Campaign Sets, one per seat, so a player
 * always draws from their own copy — but the ingested data has one `expcamp` encounter set with 4 copies of each
 * obligation, not four distinct per-seat `EncounterSet` records. Faithfully modeling MC10 p. 17's per-seat draw
 * (`CampaignChoiceSource.kind: "perSeatSet"`, docs/campaign-mode-design.md §4.5) needs that split done first; until
 * then `@mc/cards`' `trors` campaign definition (docs/campaign-mode-design.md §11 step 7) must read from the one
 * `expcamp` set instead of a per-seat one.
 */
export const TRORS_CAMPAIGN: Campaign = {
  id: campaignId("trors"),
  name: "The Rise of Red Skull",
  boxCode: "MC10",
  packCode: setCode("trors"),
  scenarioIds: [
    scenarioId("crossbones"),
    scenarioId("absorbing-man"),
    scenarioId("taskmaster"),
    scenarioId("zola"),
    scenarioId("red-skull"),
  ],
  campaignSetIds: [encounterSetId("hydra_camp"), encounterSetId("expcamp")],
  logSheetReference: "docs/campaign-modes/log-sheets/mc10_the_rise_of_red_skull_campaign-log.pdf",
};
