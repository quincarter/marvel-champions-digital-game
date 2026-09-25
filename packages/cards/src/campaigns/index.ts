/**
 * The campaign registry (docs/campaign-mode-design.md §9.1): how a client finds a box's `CampaignDefinition` by its
 * `@mc/content` `Campaign.id`. Adding box N+1 is exactly one entry here, per the design's own file-list — no
 * change to `@mc/engine` or `@mc/client`.
 */

import type { CampaignId } from "@mc/content";
import type { CampaignDefinition } from "@mc/engine";
import { GMW_CAMPAIGN_DEFINITION } from "./gmw.js";
import { MTS_CAMPAIGN_DEFINITION } from "./mts.js";
import { TRORS_CAMPAIGN_DEFINITION } from "./trors.js";

export { GMW_CAMPAIGN_DEFINITION } from "./gmw.js";
export { MTS_CAMPAIGN_DEFINITION } from "./mts.js";
export { TRORS_CAMPAIGN_DEFINITION } from "./trors.js";

/** Every campaign this build ships a `CampaignDefinition` for, keyed by `CampaignId`. */
export const CAMPAIGNS: Readonly<Record<string, CampaignDefinition>> = {
  trors: TRORS_CAMPAIGN_DEFINITION,
  gmw: GMW_CAMPAIGN_DEFINITION,
  mts: MTS_CAMPAIGN_DEFINITION,
};

/** A campaign's definition by id, or `undefined` if this build has not shipped one yet (design §9.1's file list). */
export const campaignDefinitionOf = (id: CampaignId | string): CampaignDefinition | undefined =>
  CAMPAIGNS[id as string];
