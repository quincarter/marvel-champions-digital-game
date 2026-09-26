// Hand-authored: there is no MarvelCDB equivalent of a campaign record (docs/campaign-mode-design.md §3, §9.1 row
// 1), the same gap `mts`'s/`gmw`'s/`trors`' own `campaign.ts` fill. Built from the primary rulebook conversion,
// docs/campaign-modes/markdown/mc27_sinister_motives.md ("MC27"), cross-checked against the ingested
// SM_SCENARIOS/SM_ENCOUNTER_SETS this record names (see packages/content/src/data/campaigns.test.ts).

import { campaignId, cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Campaign } from "../../schema/index.js";

/**
 * Sinister Motives' five scenarios in box order (MC27 p. 2: "Sandman", "Venom", "Mysterio", "The Sinister Six",
 * "Venom Goblin"; each scenario's own "Campaign Instructions" page — pp. 9, 11, 13, 15, 17 — chains to the next).
 * `docs/phase7-wave5.md` §2.2/§2.3's own tables list the same five, in the same order.
 *
 * Four encounter sets in this box are campaign-specific (`campaignSpecific: true` in `SM_ENCOUNTER_SETS`, the same
 * shape `MTS_CAMPAIGN`/`GMW_CAMPAIGN`/`TRORS_CAMPAIGN` each use for their own box): Bad Publicity (Public Outcry,
 * Smear Campaign, cards 174-175), Community Service (176-180), Snitches Get Stitches (181) and S.H.I.E.L.D. Tech
 * (182-189, the campaign-specific player-card set, MC27 p. 4 "Campaign - S.H.I.E.L.D. Tech"). MC27 p. 4 prohibits
 * Venom (Eddie Brock) (190) and Symbiote Suit (191) from player decks, and the Osborn Tech modular
 * (147-152 — `osborn_tech`) from use, "unless a campaign rule states otherwise" (the reputation track's own
 * node-13/17/21 Setup instructions shuffle specific recorded Osborn Tech cards back in — `docs/phase7-wave5.md`
 * §2.3's reputation table, node rewards/penalties).
 *
 * Not included here (and not in `CAMPAIGNS`, `../index.ts`'s own comment on that aggregate): the box's campaign
 * *instructions* — reputation track scoring, per-scenario setup/victory text, the Sinister Six's set-aside
 * villains, Venom Goblin's glider counter chain — are `@mc/cards`' `CampaignDefinition` DSL
 * (`ability-scripting-engineer`'s work), not this package's `Campaign` record, which is only the plain-data
 * box/scenario/set membership half (`docs/campaign-mode-design.md` §3, §9.1 row 1).
 */
export const SM_CAMPAIGN: Campaign = {
  id: campaignId("sm"),
  name: "Sinister Motives",
  boxCode: "MC27",
  packCode: setCode("sm"),
  scenarioIds: [
    scenarioId("sandman"),
    scenarioId("venom"),
    scenarioId("mysterio"),
    scenarioId("sinister-six"),
    scenarioId("venom-goblin"),
  ],
  campaignSetIds: [
    encounterSetId("bad_publicity"),
    encounterSetId("community_service"),
    encounterSetId("snitches_get_stitches"),
    encounterSetId("shield_tech"),
  ],
  prohibited: {
    cardIds: [cardId("27190"), cardId("27191")],
    encounterSetIds: [encounterSetId("osborn_tech")],
  },
  logSheetReference: "docs/campaign-modes/markdown/mc27_sinister_motives.md",
};
