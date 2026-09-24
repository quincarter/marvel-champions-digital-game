/**
 * C04 — the in-game beat: a villain flipping to a new stage, told as a comic splash over the Board (launched by
 * `scenes/board.ts`'s guarded hook, `#tryOpenCampaignBeat`, off `view/campaign-beat-model.ts`'s pure detection).
 *
 * Static — launched once with `CampaignBeatData` and never subscribes to the store, unlike the villain-phase
 * walkthrough this can run alongside: the flip already happened, this only narrates it. Dismisses on a tap
 * anywhere or after a few seconds (`OverlayMotion`, no auto-dismiss under reduced motion — the same contract
 * `scenes/villain-phase.ts`'s own "REDUCED MOTION" section documents).
 */
import Phaser from "phaser";
import { issueStoryFor, storyFor, type ComicBeatRef, type ComicPage } from "../../campaign/story.js";
import {
  campaignFrame,
  campaignPagePicture,
  drawPicture,
  speechBubble,
  villainPicture,
} from "../../ui/campaign-chrome.js";
import { ensurePictureLoaded } from "../../art/pictures.js";
import { coverCropFavoringBeats } from "../../view/comic-crop.js";
import { accent, dotGrid, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { dashedRect, paintDotGrid } from "../../ui/widgets.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { OverlayMotion } from "../../ui/transitions.js";
import { appSession } from "../../session.js";
import type { Rect } from "../../view/layout.js";
import { SCENES } from "../keys.js";
import type { CampaignBeatData } from "./routes.js";

/** How long the splash stays up before dismissing itself, at normal motion. */
const AUTO_CLOSE_DELAY_MS = 4000;

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;
const roman = (n: number): string => ROMAN[n] ?? String(n);

/** A `stagePanels` ref resolved against a page-based box's own pages: the page, its 1-based position among the
 * box's pages (for "PANEL FROM PAGE N"), and the crop `coverCropFavoringBeats` needs. Null for a box with no
 * `pages`, or a ref naming a page/beat that doesn't exist there (never thrown here — the beat still draws, just
 * with the plain villain-picture fallback, since a bad ref is a story-authoring slip, not a reason to break C04). */
interface StagePanelCrop {
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly beats: readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number }[];
  readonly pageNumber: number;
}

function stagePanelCropFor(
  pages: readonly ComicPage[] | undefined,
  ref: ComicBeatRef | undefined,
): StagePanelCrop | null {
  if (!pages || !ref) return null;
  const pageIndex = pages.findIndex((candidate) => candidate.file === ref.page);
  const page = pages[pageIndex];
  const beat = page?.beats[ref.beatIndex];
  if (!page || !beat) return null;
  return {
    file: page.file,
    width: page.width,
    height: page.height,
    rect: beat.panel,
    beats: [beat.panel],
    pageNumber: pageIndex + 1,
  };
}

/** Draws a `StagePanelCrop` cover-fit into `rect`, the same crop math The Run's own page crop uses (`scenes/
 * campaign/run.ts`'s `drawPageCrop`) — here for one panel instead of an issue's whole page slice. Null while the
 * page's art hasn't loaded (or has none); `onReady` is `ensurePictureLoaded`'s redraw hook. */
function drawStagePanelPicture(
  scene: Phaser.Scene,
  campaignId: string,
  crop: StagePanelCrop,
  rect: Rect,
  onReady: () => void,
): Phaser.GameObjects.Image | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const picture = campaignPagePicture(campaignId, crop.file);
  if (!picture) return null;
  const key = ensurePictureLoaded(scene, picture, onReady);
  if (!key) return null;
  const fit = coverCropFavoringBeats(crop, rect);
  return scene.add
    .image(rect.x - fit.cropX * fit.scale, rect.y - fit.cropY * fit.scale, key)
    .setOrigin(0, 0)
    .setScale(fit.scale)
    .setCrop(fit.cropX, fit.cropY, fit.cropWidth, fit.cropHeight);
}

export class CampaignBeatOverlay extends Phaser.Scene {
  #data!: CampaignBeatData;
  #motion = new OverlayMotion();
  #closeTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super(SCENES.campaignBeat);
  }

  create(data: CampaignBeatData): void {
    this.#data = data;
    this.#motion = new OverlayMotion();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#closeTimer?.remove();
      this.#closeTimer = null;
    });
    this.scale.on("resize", this.#draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.#draw, this));
    this.#draw();
    if (!appSession().settings.reducedMotion) {
      this.#closeTimer = this.time.delayedCall(AUTO_CLOSE_DELAY_MS, () => this.#close());
    }
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #draw(): void {
    if (this.#motion.leaving) return;
    destroyChildren(this);
    const { width, height, topBar, phone } = campaignFrame(this);
    const story = issueStoryFor(this.#data.campaignId, this.#data.nodeId);
    const line = story?.stageLines[this.#data.stage] ?? "";
    const note = story?.stageNotes?.[this.#data.stage];
    // A page-based box (GMW) points the flip at one panel of its own issue instead of the scenario's plain
    // villain portrait — detected from the story's own data (`stagePanels`/`pages`), never `campaignId`, so a
    // box with no pages (MC10) is untouched and a later page-based box picks this up for free.
    const pages = storyFor(this.#data.campaignId)?.pages;
    const panelCrop = stagePanelCropFor(pages, story?.stagePanels?.[this.#data.stage]);

    // Paper ground with faint comic panel frames — the same dotted-and-dashed comic-page texture the opener uses,
    // kept purely decorative here since there is nothing tap-through about this screen.
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    paintDotGrid(this, { x: 0, y: topBar, width, height: height - topBar }, "paper", dotGrid.onPaper);
    const panelsFrom = this.children.list.length;
    const frameGutter = 24;
    const frameRects: readonly Rect[] = [
      {
        x: frameGutter,
        y: topBar + frameGutter,
        width: (width - frameGutter * 3) / 2,
        height: height - topBar - frameGutter * 2,
      },
      {
        x: frameGutter * 2 + (width - frameGutter * 3) / 2,
        y: topBar + frameGutter,
        width: (width - frameGutter * 3) / 2,
        height: height - topBar - frameGutter * 2,
      },
    ];
    const frames = this.add.graphics();
    for (const frameRect of frameRects) dashedRect(frames, frameRect, 1, surface.ink.hex);
    frames.setAlpha(0.15);

    // Ink top bar: "ROUND N" chip, "<Villain> <Stage roman>".
    this.add.rectangle(0, 0, width, topBar, surface.ink.hex).setOrigin(0, 0);
    const chip = this.add
      .text(
        0,
        topBar / 2,
        `ROUND ${this.#data.round}`,
        textStyle({ ...typeRole.barTitle, size: 15 }, surface.paper.hex),
      )
      .setOrigin(0, 0.5);
    const chipPad = 22;
    const chipWidth = chip.width + chipPad;
    this.add.rectangle(chipPad / 2, topBar / 2, chipWidth, 26, accent.heroRed.hex).setOrigin(0, 0.5);
    chip.setX(chipPad / 2 + (chipWidth - chip.width) / 2);
    this.children.bringToTop(chip);
    const titleX = chipPad + chipWidth + 14;
    this.add
      .text(
        titleX,
        topBar / 2,
        `${this.#data.villainName.toUpperCase()} ${roman(this.#data.stage)}`,
        textStyle({ ...typeRole.barTitle, size: 20 }, surface.paper.hex),
      )
      .setOrigin(0, 0.5);

    // The villain splash: a bordered picture with a red "STAGE N" tag. Phone runs it full-bleed near the top
    // (the tile's own composition); wide fills most of the panel-frame area the splash sits over — the tile's own
    // splash reads as roughly 900×590 at 1440×980 (0.625 of the width), not a small inset photo.
    const splashRect: Rect = phone
      ? { x: 0, y: topBar, width, height: Math.min(height - topBar, width * 0.72) }
      : (() => {
          const maxHeight = height - topBar - frameGutter * 2;
          let splashWidth = Math.min(width * 0.62, 900);
          let splashHeight = splashWidth * 0.656;
          if (splashHeight > maxHeight) {
            splashHeight = maxHeight;
            splashWidth = splashHeight / 0.656;
          }
          return {
            x: (width - splashWidth) / 2,
            y: topBar + Math.max(frameGutter, (height - topBar - splashHeight) / 2 - 10),
            width: splashWidth,
            height: splashHeight,
          };
        })();
    // Wide draws the splash into its own container, tilted a degree or two (the tile's own "photo dropped onto the
    // page slightly askew" — a static comic flourish, not information, so it's skipped on phone's full-bleed
    // treatment where there's no page around it to tilt against). Every child is drawn at coordinates relative to
    // the splash's own center and reparented in, so the container's rotation pivots around that center rather than
    // the scene's origin.
    const cx = splashRect.x + splashRect.width / 2;
    const cy = splashRect.y + splashRect.height / 2;
    const local: Rect = phone
      ? splashRect
      : { x: -splashRect.width / 2, y: -splashRect.height / 2, width: splashRect.width, height: splashRect.height };
    const splashGroup = phone ? null : this.add.container(cx, cy).setAngle(-1.5);

    const splashBg = this.add.rectangle(local.x, local.y, local.width, local.height, surface.ink.hex).setOrigin(0, 0);
    const splashImage = panelCrop
      ? drawStagePanelPicture(this, this.#data.campaignId, panelCrop, local, () => this.#draw())
      : drawPicture(this, villainPicture(this.#data.scenarioId), local, () => this.#draw(), { focusY: 0.3 });
    const border = this.add.graphics();
    border.lineStyle(4, surface.ink.hex, 1).strokeRect(local.x, local.y, local.width, local.height);

    const tagText = `STAGE ${roman(this.#data.stage)}`;
    const tag = this.add.text(0, 0, tagText, textStyle({ ...typeRole.barTitle, size: 14 }, surface.paper.hex));
    const tagRect: Rect = {
      x: local.x + (phone ? 8 : 0),
      y: local.y + (phone ? 8 : 0),
      width: tag.width + 18,
      height: 24,
    };
    const tagBg = this.add
      .rectangle(tagRect.x, tagRect.y, tagRect.width, tagRect.height, accent.heroRed.hex)
      .setOrigin(0, 0);
    tag.setPosition(tagRect.x + 9, tagRect.y + 5);
    this.children.bringToTop(tag);
    splashGroup?.add([splashBg, ...(splashImage ? [splashImage] : []), border, tagBg, tag]);

    // The speech bubble: tucked into the splash's lower-right corner on wide, larger than the panels' own dialogue
    // (the tile's own bigger type here), a full-width strip just under it on phone.
    const bubbleWidth = phone ? width - 24 : Math.min(440, width - 48);
    const bubbleX = phone ? 12 : splashRect.x + splashRect.width - bubbleWidth * 0.62;
    const bubbleY = phone ? splashRect.y + splashRect.height + 12 : splashRect.y + splashRect.height - 20;
    let bubbleBottom = bubbleY;
    if (line) {
      const { rect: bubbleRect } = speechBubble(this, bubbleX, bubbleY, bubbleWidth, line, {
        tail: "none",
        size: phone ? 15 : 19,
      });
      bubbleBottom = bubbleRect.y + bubbleRect.height;
    }

    // The small ink note: "PANEL FROM PAGE N" for a page-based panel (crediting where it's lifted from, the way
    // The Run's own bookmark line does), otherwise a rule reminder — either way plus "TAP ANYWHERE". Under the
    // splash on wide, under the bubble on phone.
    const noteLead = panelCrop ? `PANEL FROM PAGE ${panelCrop.pageNumber}` : note;
    const noteText = noteLead ? `${noteLead} · TAP ANYWHERE` : "TAP ANYWHERE";
    const noteY = phone ? bubbleBottom + 10 : splashRect.y + splashRect.height + 8;
    const noteX = phone ? 0 : splashRect.x;
    const noteLabel = this.add
      .text(0, 0, noteText.toUpperCase(), textStyle({ ...typeRole.label, size: 12 }, surface.paper.hex))
      .setOrigin(0, 0)
      .setWordWrapWidth(width - 24);
    const noteBg = this.add
      .rectangle(0, 0, phone ? width : noteLabel.width + 16, noteLabel.height + 8, surface.ink.hex)
      .setOrigin(0, 0);
    noteBg.setPosition(noteX, noteY);
    noteLabel.setPosition(noteX + (phone ? 12 : 8), noteY + 4);
    this.children.bringToTop(noteLabel);

    // Tap anywhere dismisses — sent to the very back so it never sits in front of anything drawn above (there is
    // nothing else interactive on this screen to protect it from, but the convention matches every other full-bleed
    // tap-to-dismiss surface in the app).
    const tapZone = this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    tapZone.on("pointerup", () => this.#close());
    this.children.sendToBack(tapZone);

    this.#motion.enter(this, { panels: this.children.list.slice(panelsFrom) });
  }
}
