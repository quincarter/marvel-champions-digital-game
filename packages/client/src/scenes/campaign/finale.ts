/**
 * C11 — placeholder until this screen is built. Registered so every route in `routes.ts` already resolves.
 */
import Phaser from "phaser";
import { surface } from "../../tokens.js";
import { cssOf } from "../../ui/theme.js";
import { drawTopBar } from "../../ui/campaign-chrome.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { SCENES } from "../keys.js";
import type { CampaignFinaleData } from "./routes.js";

export class CampaignFinaleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.campaignFinale);
  }

  create(_data: CampaignFinaleData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    drawTopBar(this, { backLabel: "◂ Title", onBack: () => goToScreen(this, SCENES.title), title: "Finale" });
    fadeScreenIn(this);
  }
}
