/**
 * C07 — placeholder until this screen is built. Registered so every route in `routes.ts` already resolves.
 */
import Phaser from "phaser";
import { surface } from "../../tokens.js";
import { cssOf } from "../../ui/theme.js";
import { drawTopBar } from "../../ui/campaign-chrome.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { SCENES } from "../keys.js";
import type { CampaignRunData } from "./routes.js";

export class CampaignRunScene extends Phaser.Scene {
  constructor() {
    super(SCENES.campaignRun);
  }

  create(_data: CampaignRunData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    drawTopBar(this, { backLabel: "◂ Title", onBack: () => goToScreen(this, SCENES.title), title: "The run" });
    fadeScreenIn(this);
  }
}
