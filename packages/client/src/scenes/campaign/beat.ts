/**
 * C04 — placeholder until the stage-flip overlay is built. Registered so `SCENES.campaignBeat` resolves.
 */
import Phaser from "phaser";
import { SCENES } from "../keys.js";
import type { CampaignBeatData } from "./routes.js";

export class CampaignBeatOverlay extends Phaser.Scene {
  constructor() {
    super(SCENES.campaignBeat);
  }

  create(_data: CampaignBeatData): void {
    this.scene.stop();
  }
}
