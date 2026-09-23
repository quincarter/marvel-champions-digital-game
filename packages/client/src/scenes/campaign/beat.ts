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
import { issueStoryFor } from "../../campaign/story.js";
import { campaignFrame, drawPicture, speechBubble, villainPicture } from "../../ui/campaign-chrome.js";
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
    // (the tile's own composition); wide lays it out roughly centered over the panel frames.
    const splashRect: Rect = phone
      ? { x: 0, y: topBar, width, height: Math.min(height - topBar, width * 0.72) }
      : (() => {
          const splashWidth = Math.min(width * 0.42, 540);
          const splashHeight = splashWidth * 0.72;
          return {
            x: (width - splashWidth) / 2,
            y: topBar + Math.max(frameGutter, (height - topBar - splashHeight) / 2 - 20),
            width: splashWidth,
            height: splashHeight,
          };
        })();
    this.add
      .rectangle(splashRect.x, splashRect.y, splashRect.width, splashRect.height, surface.ink.hex)
      .setOrigin(0, 0);
    const picture = villainPicture(this.#data.scenarioId);
    drawPicture(this, picture, splashRect, () => this.#draw(), { focusY: 0.3 });
    const border = this.add.graphics();
    border.lineStyle(4, surface.ink.hex, 1).strokeRect(splashRect.x, splashRect.y, splashRect.width, splashRect.height);

    const tagText = `STAGE ${roman(this.#data.stage)}`;
    const tag = this.add.text(0, 0, tagText, textStyle({ ...typeRole.barTitle, size: 14 }, surface.paper.hex));
    const tagRect: Rect = {
      x: splashRect.x + (phone ? 8 : 0),
      y: splashRect.y + (phone ? 8 : 0),
      width: tag.width + 18,
      height: 24,
    };
    this.add.rectangle(tagRect.x, tagRect.y, tagRect.width, tagRect.height, accent.heroRed.hex).setOrigin(0, 0);
    tag.setPosition(tagRect.x + 9, tagRect.y + 5);
    this.children.bringToTop(tag);

    // The speech bubble: tucked into the splash's lower-right corner on wide, a full-width strip just under it on
    // phone (the tile's own composition — its tail points up into the image either way).
    const bubbleWidth = phone ? width - 24 : Math.min(340, width - 48);
    const bubbleX = phone ? 12 : splashRect.x + splashRect.width - bubbleWidth * 0.6;
    const bubbleY = phone ? splashRect.y + splashRect.height + 12 : splashRect.y + splashRect.height - 20;
    let bubbleBottom = bubbleY;
    if (line) {
      const { rect: bubbleRect } = speechBubble(this, bubbleX, bubbleY, bubbleWidth, line, { tail: "none", size: 15 });
      bubbleBottom = bubbleRect.y + bubbleRect.height;
    }

    // The small ink note: a rule reminder plus "TAP ANYWHERE" — under the splash on wide, under the bubble on phone.
    const noteText = note ? `${note} · TAP ANYWHERE` : "TAP ANYWHERE";
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
