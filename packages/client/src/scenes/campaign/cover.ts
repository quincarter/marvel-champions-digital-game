/**
 * C01 — placeholder until this screen is built. Registered so every route in `routes.ts` already resolves.
 */
import Phaser from "phaser";
import { surface } from "../../tokens.js";
import { cssOf } from "../../ui/theme.js";
import { drawTopBar } from "../../ui/campaign-chrome.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { SCENES } from "../keys.js";
import type { CampaignCoverData } from "./routes.js";

export class CampaignCoverScene extends Phaser.Scene {
  constructor() {
    super(SCENES.campaignCover);
  }

  create(_data: CampaignCoverData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    drawTopBar(this, { backLabel: "◂ Title", onBack: () => goToScreen(this, SCENES.title), title: "Campaign" });
    fadeScreenIn(this);
  }
}
