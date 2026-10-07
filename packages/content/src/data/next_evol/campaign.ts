// Hand-authored: there is no MarvelCDB equivalent of a campaign record (docs/campaign-mode-design.md §3, §9.1 row
// 1), the same gap `mut_gen`'s own `campaign.ts` fills. Built from the primary rulebook conversion,
// docs/campaign-modes/markdown/mc40_next_evolution.md ("MC40"), cross-checked against the ingested
// NEXT_EVOL_SCENARIOS/NEXT_EVOL_ENCOUNTER_SETS this record names (see packages/content/src/data/wave7.test.ts).

import { campaignId, cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Campaign } from "../../schema/index.js";

/**
 * NeXt Evolution's five scenarios in box order (MC40: Morlock Siege p. 9, On the Run p. 11, Juggernaut p. 14, Mister
 * Sinister p. 16, Stryfe p. 18; each scenario's Campaign Instructions chains to the next).
 *
 * One encounter set is campaign-specific: `next_evol_campaign`, the campaign cards 190-203 (MC40 p. 6: "created
 * specifically for use in the NeXt Evolution campaign ... cannot be included in any deck unless playing the
 * campaign"). The basic/campaign cards among them are the box's own campaign-specific cards by set icon. There are no
 * roles and no per-seat sets, so neither field is set.
 *
 * `prohibited` (MC40 p. 6, "Prohibited Card"; also p. 5): the Hope Summers (204) basic ally cannot be in a player deck
 * while playing the campaign. No encounter set is prohibited. The Hope Summers encounter set (130-131) is a normal
 * extra modular set, not prohibited.
 *
 * Not included here (`../index.ts`'s comment on `CAMPAIGNS`): the campaign instructions (player side scheme choice
 * and rewards, the log) are `@mc/cards`' `CampaignDefinition` DSL, not this plain-data record.
 */
export const NEXT_EVOL_CAMPAIGN: Campaign = {
  id: campaignId("next_evol"),
  name: "NeXt Evolution",
  boxCode: "MC40",
  packCode: setCode("next_evol"),
  scenarioIds: [
    scenarioId("morlock-siege"),
    scenarioId("on-the-run"),
    scenarioId("juggernaut"),
    scenarioId("mister-sinister"),
    scenarioId("stryfe"),
  ],
  campaignSetIds: [encounterSetId("next_evol_campaign")],
  prohibited: { cardIds: [cardId("40204")] },
  logSheetReference: "docs/campaign-modes/log-sheets/mc40_next_evolution_campaign_log-compressed.pdf",
};
