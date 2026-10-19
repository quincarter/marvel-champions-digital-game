// Hand-authored: there is no MarvelCDB equivalent of a campaign record (docs/campaign-mode-design.md §3), the same gap
// the other boxes' own `campaign.ts` fill. Built from the MC60 rulebook conversion,
// docs/campaign-modes/markdown/mc60_fear_no_evil.md ("MC60"), per docs/phase7-wave11-scenarios.md §S1.3, and
// cross-checked against the ingested FNE_SCENARIOS/FNE_ENCOUNTER_SETS this record names (see
// packages/content/src/data/fne.test.ts).

import { campaignId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Campaign } from "../../schema/index.js";

/**
 * Fear No Evil's six scenarios in log order (MC60 p. 28: Art Museum Heist, The Getaway, Protection Racket, The Raft
 * Breakout, Stop the Presses!, then Kingpin). The order is not a play order: "the order of these scenarios is not fixed.
 * Instead, the players choose which scenario to play next after each game" (MC60 p. 8) among the five interchangeable
 * ones, and Kingpin comes once all five are Completed or Failed (p. 9 step 4). The `CampaignGraph` (a choice graph) is
 * `@mc/cards`' business, as is the campaign log.
 *
 * `fne_campaign` holds the campaign-specific cards 60205 to 60210 (five environments, each double-sided Completed and
 * Failed, and the Typhoid Mary / Bloody Mary ally), used only in the campaign (MC60 p. 9 steps 12 and 13).
 *
 * No `prohibited` (the rulebook forbids no card or set), no `perSeatSetIds`, no `roles`.
 */
export const FNE_CAMPAIGN: Campaign = {
  id: campaignId("fne"),
  name: "Fear No Evil",
  boxCode: "MC60",
  packCode: setCode("fne"),
  scenarioIds: [
    scenarioId("art-museum-heist"),
    scenarioId("the-getaway"),
    scenarioId("protection-racket"),
    scenarioId("the-raft-breakout"),
    scenarioId("stop-the-presses"),
    scenarioId("kingpin"),
  ],
  campaignSetIds: [encounterSetId("fne_campaign")],
  logSheetReference: "docs/campaign-modes/log-sheets/mc60_campaign_log.pdf",
};
