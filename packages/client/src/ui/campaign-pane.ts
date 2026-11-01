/**
 * The coloured side pane of a campaign page (issues #609, #613): a ground in the chosen fade color
 * (`Settings.campaignFadeColor`), the campaign's box art faded over it unless `Settings.fadedCampaignArt` is off, and a
 * dark veil that keeps the pale on-colour text readable (`view/campaign-fade-color.ts` proves the contrast).
 *
 * The pane is flush to the right edge on a tablet or desktop and stacks at the bottom of a phone's scrolling body.
 * Text drawn on it is `PANE_TEXT_COLOR`; a screen whose column is built from ink-on-paper pieces sets them on a paper
 * panel (`drawPanePaper`) instead, so nothing there changes colour.
 */
import type Phaser from "phaser";
import { CAMPAIGN_RECORDS } from "../campaign/campaign-service.js";
import { appSession } from "../session.js";
import { surface } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { PANE_ART_ALPHA, PANE_VEIL_ALPHA, PANE_VEIL_COLOR, campaignFadeFillOf } from "../view/campaign-fade-color.js";
import { campaignCoverPicture, drawPicture, villainPicture } from "./campaign-chrome.js";

/** Slots `made` (in order) at `index` of the scene's display list, under what was drawn after that point. */
function slotAt(scene: Phaser.Scene, made: readonly Phaser.GameObjects.GameObject[], index: number | undefined): void {
  if (index === undefined) return;
  made.forEach((object, offset) => scene.children.moveTo(object, index + offset));
}

/**
 * Draws the pane's ground into `rect`: the color, the faded art (cover-fitted, never stretched) and the veil with its
 * frame. `moveTo` slots it under objects already drawn from that display-list index (a stacked pane is measured after
 * its text). `onArtReady` redraws the screen once the picture has loaded: pass one stable callback (not a fresh closure per draw), so the picture loader can fold repeat waiters into one, and let it check the scene is still running. Returns how many objects it drew.
 */
export function drawCampaignPaneGround(
  scene: Phaser.Scene,
  campaignId: string,
  rect: Rect,
  onArtReady: () => void,
  moveTo?: number,
): number {
  if (rect.width <= 0 || rect.height <= 0) return 0;
  const settings = appSession().settings;
  const made: Phaser.GameObjects.GameObject[] = [];
  const ground = scene.add.graphics();
  ground.fillStyle(campaignFadeFillOf(settings.campaignFadeColor), 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  made.push(ground);
  if (settings.fadedCampaignArt) {
    const finale = CAMPAIGN_RECORDS[campaignId]?.scenarioIds.at(-1) as string | undefined;
    const picture = campaignCoverPicture(campaignId) ?? (finale ? villainPicture(finale) : null);
    const image = drawPicture(scene, picture, rect, onArtReady, {
      focusY: 0.2,
      alpha: PANE_ART_ALPHA,
    });
    if (image) made.push(image);
  }
  const veil = scene.add.graphics();
  veil.fillStyle(PANE_VEIL_COLOR, PANE_VEIL_ALPHA).fillRect(rect.x, rect.y, rect.width, rect.height);
  veil.lineStyle(3, PANE_VEIL_COLOR, 1).strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);
  made.push(veil);
  slotAt(scene, made, moveTo);
  return made.length;
}

/**
 * A paper panel on the pane for a column of ink-on-paper content (the Briefing's decks and schemes), so its text keeps
 * its colors on any fade color. Slotted under what was drawn from `moveTo`.
 */
export function drawPanePaper(scene: Phaser.Scene, rect: Rect, moveTo?: number): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const paper = scene.add.graphics();
  paper.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  paper.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
  slotAt(scene, [paper], moveTo);
}
