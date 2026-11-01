/**
 * Where "start a new run of this campaign" goes (issue #609): the Roster, except for a campaign with a Balanced
 * version (Galaxy's Most Wanted), which asks Play as normal or Rebalance first. A Resume never comes through here.
 */
import type Phaser from "phaser";
import { goToScreen } from "../../ui/transitions.js";
import { hasBalancedPrompt } from "../../view/campaign-balanced-model.js";
import { SCENES } from "../keys.js";

export function goToCampaignStart(scene: Phaser.Scene, campaignId: string, expertCampaign = false): void {
  const data = { campaignId, ...(expertCampaign ? { expertCampaign: true } : {}) };
  goToScreen(scene, hasBalancedPrompt(campaignId) ? SCENES.campaignBalanced : SCENES.campaignRoster, data);
}
