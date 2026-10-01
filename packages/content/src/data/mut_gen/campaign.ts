// Hand-authored: there is no MarvelCDB equivalent of a campaign record (docs/campaign-mode-design.md §3, §9.1 row
// 1), the same gap `sm`'s/`mts`'s/`gmw`'s/`trors`' own `campaign.ts` fill. Built from the primary rulebook conversion,
// docs/campaign-modes/markdown/mc32_mutant_genesis.md ("MC32"), cross-checked against the ingested
// MUT_GEN_SCENARIOS/MUT_GEN_ENCOUNTER_SETS this record names (see packages/content/src/data/wave6.test.ts).

import { campaignId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Campaign } from "../../schema/index.js";

/**
 * Mutant Genesis' five scenarios in box order (MC32 p. 4's fixed order: Sabretooth, Project Wideawake, Master Mold,
 * Mansion Attack, Magneto; each scenario's "Campaign Instructions" page, pp. 10, 13, 16, 19, chains to the next).
 *
 * Five encounter sets are campaign-specific (`campaignSpecific: true` in `MUT_GEN_ENCOUNTER_SETS`): the campaign cards
 * 171-175 (`mut_gen_campaign`: Frightened Police, Enemy of My Enemy, Find the Prisoners, Surprise Attack, Magneto's
 * Fortress and their other faces) and the four role upgrade sets (MC32 p. 5: Brawler 176-180, Commander 181-185,
 * Defender 186-190, Peacekeeper 191-195, five upgrades each). Future Past is deliberately not campaign-specific (MC32
 * p. 5: "When not playing a Mutant Genesis campaign, this set can be used like any other encounter set").
 *
 * `roles` pairs each role with its aspects (MC32 p. 5: "Brawler (Aggression + Protection), Commander (Aggression +
 * Leadership), Defender (Justice + Protection), Peacekeeper (Justice + Leadership)"). Roles are chosen, not numbered by
 * seat, so there are no `perSeatSetIds`, and MC32 prints no prohibited cards or sets, so no `prohibited`
 * (docs/phase7-wave6.md §1.1, §1.7).
 *
 * Not included here (and not in `CAMPAIGNS` yet, `../index.ts`'s own comment on that aggregate): the box's campaign
 * *instructions* (role choice and role-building, the Future Past deck across scenarios, Jubilee, expert-mode healing)
 * are `@mc/cards`' `CampaignDefinition` DSL, not this package's `Campaign` record, which is only the plain-data
 * box/scenario/set membership half (`docs/campaign-mode-design.md` §3, §9.1 row 1).
 */
export const MUT_GEN_CAMPAIGN: Campaign = {
  id: campaignId("mut_gen"),
  name: "Mutant Genesis",
  boxCode: "MC32",
  packCode: setCode("mut_gen"),
  scenarioIds: [
    scenarioId("sabretooth"),
    scenarioId("project-wideawake"),
    scenarioId("master-mold"),
    scenarioId("mansion-attack"),
    scenarioId("magneto"),
  ],
  campaignSetIds: [
    encounterSetId("mut_gen_campaign"),
    encounterSetId("brawler"),
    encounterSetId("commander"),
    encounterSetId("defender"),
    encounterSetId("peacekeeper"),
  ],
  roles: [
    {
      id: "brawler",
      name: "Brawler",
      encounterSetId: encounterSetId("brawler"),
      aspects: ["aggression", "protection"],
    },
    {
      id: "commander",
      name: "Commander",
      encounterSetId: encounterSetId("commander"),
      aspects: ["aggression", "leadership"],
    },
    {
      id: "defender",
      name: "Defender",
      encounterSetId: encounterSetId("defender"),
      aspects: ["justice", "protection"],
    },
    {
      id: "peacekeeper",
      name: "Peacekeeper",
      encounterSetId: encounterSetId("peacekeeper"),
      aspects: ["justice", "leadership"],
    },
  ],
  logSheetReference: "docs/campaign-modes/log-sheets/mc32_mutant_genesis_campaign_log.pdf",
};
