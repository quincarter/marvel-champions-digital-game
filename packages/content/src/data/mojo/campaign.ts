// Hand-authored: there is no MarvelCDB equivalent of a campaign record (docs/campaign-mode-design.md §3, §9.1 row
// 1), the same gap `mut_gen`'s/`sm`'s/`mts`'s own `campaign.ts` fill. Built from the MojoMania insert ("insert p. N",
// Hall of Heroes' scan, https://hallofheroeslcg.com/wp-content/uploads/2022/11/mojomania-insert.pdf; the campaign log is
// the back cover, which the scan does not include) and docs/phase7-wave6.md §3.72, cross-checked against the ingested
// MOJO_SCENARIOS this record names (see packages/content/src/data/wave6.test.ts).

import { campaignId, scenarioId, setCode } from "../../schema/index.js";
import type { Campaign } from "../../schema/index.js";

/**
 * MojoMania's three scenarios in the insert's fixed order (insert p. 4: "To complete the campaign, the players must win
 * all three scenarios in order": MaGog, Spiral, Mojo; each scenario's Campaign Instructions are pp. 9, 13-14 and 17).
 *
 * **No campaign-specific sets and no roles.** The six genre sets are ordinary modular sets "that can be used in any
 * scenario" (insert p. 2) and Longshot is a one-card modular set (`extraModular`); the campaign adds no cards of its
 * own. What it adds is rules: checked-off modular sets, the recorded support or upgrade, Longshot carried over, the
 * expert heal (`@mc/cards`' `campaigns/mojo.ts`).
 *
 * `boxCode` is "MC39": the insert prints no product code (its cover shows only the expansion symbol), so this is the
 * MarvelCDB pack number every card id carries (39xxx), the same number the other packs' codes follow (Mutant Genesis
 * is cards 32xxx and MC32, Storm 36xxx and MC36). Not read off the printed product.
 */
export const MOJO_CAMPAIGN: Campaign = {
  id: campaignId("mojo"),
  name: "MojoMania",
  boxCode: "MC39",
  packCode: setCode("mojo"),
  scenarioIds: [scenarioId("magog"), scenarioId("spiral"), scenarioId("mojo")],
  campaignSetIds: [],
  logSheetReference: "https://hallofheroeslcg.com/wp-content/uploads/2022/11/mojomania-insert.pdf",
};
