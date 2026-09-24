/**
 * C07 — The Run: every issue of the campaign, in printed order.
 *
 * Wide (desktop/tablet, Campaign - Desktop #08): five columns — finished issues narrow with greyscale art and a
 * result line, the current issue wide in full colour with its story teaser in a speech bubble, sealed issues
 * parchment question marks. Phone (#08 phone composition): the same three states stacked as rows, the current
 * issue as a large card.
 *
 * A page-based box (`CampaignStory.pages` set, GMW today — `gmw-comic-reader.dc/*-the-run.png`) instead shows each
 * issue as its own comic page (`RunIssueRow.pageCrop`, `view/campaign-run-model.ts`): finished full colour with a
 * green "READ ▸" chip that opens the comic reader as a reread, current the same crop highlighted with a
 * page-and-panel bookmark line instead of the speech-bubble teaser, sealed heavily pixelated so no panel reads
 * through — detected from the model's own data, never `campaignId`, so a later page-based box picks this up for
 * free. A box with no `pages` (MC10) keeps the plain villain-picture columns above untouched.
 *
 * All data comes from `campaignRunModel` (`view/campaign-run-model.ts`), itself over the real `CampaignRecord`
 * loaded through `campaignService()` — nothing here computes campaign state.
 */
import Phaser from "phaser";
import { CARDS_BY_ID } from "../../content/pool.js";
import { storyFor } from "../../campaign/story.js";
import { ensurePictureLoaded } from "../../art/pictures.js";
import { coverCropFavoringBeats } from "../../view/comic-crop.js";
import { campaignService } from "../../session.js";
import { accent, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import {
  bangers,
  campaignFrame,
  campaignPagePicture,
  drawActionBar,
  drawPicture,
  drawTopBar,
  pixelateHeavy,
  speechBubble,
  stamp,
  villainPicture,
} from "../../ui/campaign-chrome.js";
import { fitText, McButton } from "../../ui/widgets.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import {
  campaignRunModel,
  type CampaignRunModel,
  type RunIssueRow,
  type RunPageCrop,
} from "../../view/campaign-run-model.js";
import type { Rect } from "../../view/layout.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignRunData } from "./routes.js";

const cardName = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;

/**
 * A page-based issue's own comic-page crop (`RunPageCrop`), cover-fit into `rect`: full colour normally, heavily
 * pixelated (`pixelateHeavy`) while sealed so no panel line or figure reads through — "each issue still opens on a
 * reveal" stays true even once its own page is drawn behind the blur. Returns null while the page's art hasn't
 * loaded (or has none); `onReady` is `ensurePictureLoaded`'s redraw hook, the same contract `drawPicture` uses.
 */
function drawPageCrop(
  scene: Phaser.Scene,
  campaignId: string,
  crop: RunPageCrop,
  rect: Rect,
  onReady: () => void,
  options: { readonly pixelated?: boolean } = {},
): Phaser.GameObjects.Image | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const picture = campaignPagePicture(campaignId, crop.file);
  if (!picture) return null;
  const key = ensurePictureLoaded(scene, picture, onReady);
  if (!key) return null;
  // `coverCropFavoringBeats` treats `crop.rect` (this issue's own slice of the page, page-pixel space) as if it
  // were the whole source image, so a page split across two issues (GMW's `02-museum`) still cover-fits to just
  // its own half rather than the shared page's full frame — and nudges the crop window toward `crop.beats` rather
  // than that slice's bare center, so a real blank/blacked-out gap between two panels doesn't dominate the frame.
  const fit = coverCropFavoringBeats(crop, rect);
  const image = scene.add
    .image(rect.x - fit.cropX * fit.scale, rect.y - fit.cropY * fit.scale, key)
    .setOrigin(0, 0)
    .setScale(fit.scale)
    .setCrop(fit.cropX, fit.cropY, fit.cropWidth, fit.cropHeight);
  if (options.pixelated) pixelateHeavy(image);
  return image;
}

export class CampaignRunScene extends Phaser.Scene {
  #data: CampaignRunData | null = null;
  #model: CampaignRunModel | null = null;
  #campaignId = "";
  #route: FocusRoute | null = null;
  #buttons: McButton[] = [];
  #status = "";

  constructor() {
    super(SCENES.campaignRun);
  }

  create(data: CampaignRunData): void {
    this.#data = data;
    this.#model = null;
    this.#status = "";
    this.#route = new FocusRoute(this, { onCancel: () => this.#back() });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    void this.#load(data);
    this.#draw();
    fadeScreenIn(this);
  }

  async #load(data: CampaignRunData): Promise<void> {
    const service = campaignService();
    const record = await service.load(data.runId);
    if (!record || !this.sys.isActive()) {
      this.#status = record ? "" : "this run could not be found";
      this.#draw();
      return;
    }
    const definition = service.definitionFor(record);
    this.#campaignId = record.campaignId as string;
    this.#model = campaignRunModel(record, definition, storyFor(this.#campaignId), cardName);
    this.#draw();
  }

  #back(): void {
    if (!this.#data) return;
    // The cover of *this* run: without `runId` it is a fresh volume's cover ("Sign the roster"). A run that never
    // loaded has no box to show a cover for, so it goes back to the shelf.
    const campaignId = this.#campaignId;
    if (!campaignId) goToScreen(this, SCENES.campaignSaga);
    else goToScreen(this, SCENES.campaignCover, { campaignId, runId: this.#data.runId });
  }

  #draw(): void {
    destroyChildren(this);
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    const frame = campaignFrame(this);
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));

    const model = this.#model;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];

    const top = drawTopBar(this, {
      backLabel: "◂ Cover",
      onBack: () => this.#back(),
      title: model?.campaignName ?? "The run",
      right: model ? `Issue ${model.issueNumber} of ${model.totalIssues}` : "",
    });
    if (top.back && top.backRect) {
      stops.set("back", { rect: top.backRect, activate: () => this.#back() });
      order.push("back");
    }

    if (!model) {
      this.add
        .text(frame.width / 2, frame.height / 2, this.#status || "Loading…", textStyle(typeRole.body, surface.ink.hex))
        .setOrigin(0.5);
      this.#route?.set(order, stops);
      return;
    }

    const bar = drawActionBar(this);
    const bodyTop = top.height;
    const bodyBottom = bar.y;

    if (frame.phone) this.#drawPhone(model, frame, bodyTop, bodyBottom, stops, order);
    else this.#drawWide(model, frame, bodyTop, bodyBottom, stops, order);

    // Bottom bar: a note, and the Briefing CTA (or a finished/lost run's own message).
    const pad = frame.gutter;
    if (model.finished || model.lost) {
      const message = model.won
        ? "This run is won. See it out in the Finale."
        : model.lost
          ? "This run is over. The campaign log stays for the record."
          : "";
      this.add
        .text(pad, bar.y + bar.height / 2, message, textStyle(typeRole.body, surface.paper.hex, 0.85))
        .setOrigin(0, 0.5)
        .setWordWrapWidth(bar.width - pad * 2 - (model.won ? 220 : 0));
      if (model.won) {
        const ctaRect: Rect = {
          x: bar.x + bar.width - pad - 200,
          y: bar.y + (bar.height - 62) / 2,
          width: 200,
          height: 62,
        };
        this.#button(
          "primary",
          "FINALE ▸",
          ctaRect,
          () => goToScreen(this, SCENES.campaignFinale, { runId: this.#data!.runId }),
          stops,
          order,
          "finale",
        );
      }
    } else {
      // A page-based box's current issue reads its own comic page first — the note and CTA say so, matching
      // `gmw-comic-reader.dc`'s "Tap a finished one to reread it in the reader" / "READ ISSUE #N ▸" — but the CTA
      // still lands on Briefing exactly like the plain "BRIEFING ▸" it replaces (the run's normal next stop, C03's
      // own opener, is reached from there): only the label and note change here, matching the design tile.
      const currentIssue = model.issues.find((issue) => issue.status === "current");
      const note = currentIssue?.pageCrop
        ? "Each issue is shown as its own comic page. Tap a finished one to reread it in the reader. Sealed pages stay blurred, so each issue still opens on a reveal."
        : "Future villains stay sealed so each issue opens on a reveal. Tap a finished issue to reread it.";
      const ctaLabel = currentIssue?.pageCrop ? `READ ISSUE #${currentIssue.number} ▸` : "BRIEFING ▸";
      const ctaWidth = frame.phone ? bar.width - pad * 2 : 200;
      const noteWidth = frame.phone ? bar.width - pad * 2 : bar.width - pad * 2 - ctaWidth - 24;
      const noteText = this.add
        .text(pad, bar.y, note, textStyle(typeRole.body, surface.paper.hex, 0.85))
        .setFontSize(frame.phone ? 10 : 12)
        .setWordWrapWidth(noteWidth);
      noteText.setOrigin(0, frame.phone ? 0 : 0.5).setY(frame.phone ? bar.y + 8 : bar.y + bar.height / 2);
      const ctaRect: Rect = frame.phone
        ? { x: pad, y: bar.y + bar.height - 44 - 8, width: ctaWidth, height: 44 }
        : { x: bar.x + bar.width - pad - ctaWidth, y: bar.y + (bar.height - 62) / 2, width: ctaWidth, height: 62 };
      this.#button(
        "primary",
        ctaLabel,
        ctaRect,
        () => goToScreen(this, SCENES.campaignBriefing, { runId: this.#data!.runId }),
        stops,
        order,
        "briefing",
      );
    }

    this.#route?.set(order, stops);
  }

  #drawWide(
    model: CampaignRunModel,
    frame: ReturnType<typeof campaignFrame>,
    top: number,
    bottom: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const pad = frame.gutter;
    const gap = 10;
    const columnWidth = (frame.width - pad * 2 - gap * 4) / 5;
    const columnHeight = bottom - top - pad * 2;
    // Left to right, current issue wider — the columns are laid out with a running x rather than an even grid.
    let x = pad;
    for (const issue of model.issues) {
      const isCurrent = issue.status === "current";
      const width = isCurrent ? columnWidth * 1.6 : columnWidth * 0.85;
      const rect: Rect = { x, y: top + pad, width, height: columnHeight };
      this.#column(issue, rect, isCurrent, stops, order);
      x += width + gap;
    }
  }

  /** Draws one issue column and, for a finished issue, registers its focus/pointer stop. */
  #column(issue: RunIssueRow, rect: Rect, current: boolean, stops: Map<string, FocusStop>, order: string[]): void {
    const g = this.add.graphics();
    const finished = issue.status === "finished";
    const sealed = issue.status === "sealed";
    // Set below for a finished page-based issue's READ ▸ chip zone, and brought back above the whole-column zone
    // once that's added — that zone is added *after* this one, so without this it would win the "topmost only
    // gets the click" tie-break (Phaser's own `topOnly` default) despite `bringToTop` having run first.
    let readZone: Phaser.GameObjects.Zone | null = null;
    if (current) {
      g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
      g.lineStyle(4, accent.heroRed.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    } else if (sealed) {
      g.fillStyle(0xd9d2bd, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
      g.lineStyle(2, surface.ink.hex, 0.3).strokeRect(rect.x, rect.y, rect.width, rect.height);
    } else {
      g.fillStyle(0x1c1a17, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    }

    // A page-based issue (`issue.pageCrop`) draws its own comic-page crop the whole height of the art box, even
    // sealed — pixelated instead of the "?" glyph, so it's still that issue's own page under the blur.
    const artHeight = issue.pageCrop
      ? rect.height - (current ? 70 : 34) // Current's footer carries a third line (`pageProgressLine`) below the title.
      : sealed
        ? rect.height * 0.55
        : rect.height - (current ? 130 : 70);
    const artRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: Math.max(60, artHeight) };
    if (issue.pageCrop) {
      const image = drawPageCrop(this, this.#campaignId, issue.pageCrop, artRect, () => this.#draw(), {
        pixelated: sealed,
      });
      if (sealed) {
        this.add
          .text(
            artRect.x + artRect.width / 2,
            artRect.y + artRect.height / 2,
            "SEALED",
            textStyle(bangers(20), surface.paper.hex, 0.9),
          )
          .setOrigin(0.5);
      }
      if (finished) {
        // Measured off-screen first (`stamp`'s own width depends on the label it just drew) so the chip lands
        // flush against the art's right edge rather than at a guessed offset.
        const probe = stamp(this, -10000, -10000, "READ ▸", { size: 13 });
        for (const object of probe.objects) object.destroy();
        const { rect: chipRect } = stamp(
          this,
          artRect.x + artRect.width - 10 - probe.rect.width,
          artRect.y + 10,
          "READ ▸",
          {
            size: 13,
          },
        );
        // Its own hotspot straight into the reader, on top of the whole-column zone below (which still opens the
        // Issue detail page, C07b — that page has its own "Reread" button too, so this chip is a shortcut to it).
        const key = `read:${issue.nodeId}`;
        const activate = (): void => this.#reread(issue.nodeId);
        readZone = this.add
          .zone(chipRect.x, chipRect.y, chipRect.width, chipRect.height)
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true });
        readZone.on("pointerup", activate);
        stops.set(key, { rect: chipRect, activate });
        order.push(key);
      }
      void image;
    } else if (sealed) {
      this.add
        .text(
          artRect.x + artRect.width / 2,
          artRect.y + artRect.height / 2,
          "?",
          textStyle(bangers(48), surface.ink.hex, 0.4),
        )
        .setOrigin(0.5);
    } else {
      const picture = villainPicture(issue.nodeId);
      drawPicture(this, picture, artRect, () => this.#draw(), { grayscale: finished, focusY: 0.12 });
    }

    if (current && issue.teaser) {
      const bubbleWidth = Math.min(rect.width - 20, 320);
      speechBubble(this, rect.x + 10, artRect.y + artRect.height - 90, bubbleWidth, issue.teaser, { size: 13 });
    }

    // Footer. A finished issue's footer is paper with ink text (design tile 8's "#1 · CROSSBONES" strip) — a back
    // issue read in daylight, not still under the ink ground the current/sealed footers use.
    if (finished) {
      g.fillStyle(surface.paper.hex, 1).fillRect(
        rect.x,
        artRect.y + artRect.height,
        rect.width,
        rect.height - artRect.height,
      );
    }
    const footerY = artRect.y + artRect.height + 8;
    // Current's footer sits on the ink ground (paper text); finished's is now paper itself, and sealed's is
    // parchment — both read with ink text.
    const footerColor = current ? surface.paper.hex : surface.ink.hex;
    const kicker = sealed
      ? `#${issue.number} · SEALED`
      : current
        ? `#${issue.number} · ${(issue.villain ?? "").toUpperCase()} · UP NEXT`
        : `#${issue.number} · ${(issue.villain ?? "").toUpperCase()}`;
    const kickerLabel = this.add
      .text(rect.x + 10, footerY, kicker, textStyle(typeRole.label, footerColor, current ? 0.9 : sealed ? 0.6 : 0.75))
      .setFontSize(11)
      .setWordWrapWidth(rect.width - 20);
    // Sealed's title is always "Sealed" — the kicker already says it, so no second line repeats it.
    const titleLabel = sealed
      ? kickerLabel
      : this.add
          .text(
            rect.x + 10,
            kickerLabel.y + kickerLabel.height + 2,
            issue.title,
            textStyle(bangers(current ? 22 : 16), footerColor),
          )
          .setWordWrapWidth(rect.width - 20);
    if (!sealed) fitText(titleLabel, rect.width - 20, current ? 22 : 16);
    if (current && issue.blurb) {
      this.add
        .text(
          rect.x + 10,
          titleLabel.y + titleLabel.height + 6,
          issue.blurb,
          textStyle(typeRole.body, surface.paper.hex, 0.85),
        )
        .setWordWrapWidth(rect.width - 20);
    }
    if (current && issue.pageProgressLine) {
      this.add
        .text(
          rect.x + 10,
          titleLabel.y + titleLabel.height + 4,
          issue.pageProgressLine,
          textStyle(typeRole.body, surface.paper.hex, 0.85),
        )
        .setFontSize(12)
        .setWordWrapWidth(rect.width - 20);
    }
    if (finished && issue.resultLine) {
      this.add
        .text(
          rect.x + 10,
          titleLabel.y + titleLabel.height + 4,
          issue.resultLine,
          textStyle(typeRole.body, footerColor, 0.7),
        )
        .setFontSize(11)
        .setWordWrapWidth(rect.width - 20);
    }

    if (finished) {
      const key = `issue:${issue.nodeId}`;
      const activate = (): void => this.#openIssue(issue.nodeId);
      const zone = this.add
        .zone(rect.x, rect.y, rect.width, rect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerup", activate);
      stops.set(key, { rect, activate });
      order.push(key);
      if (readZone) this.children.bringToTop(readZone);
    }
  }

  #drawPhone(
    model: CampaignRunModel,
    frame: ReturnType<typeof campaignFrame>,
    top: number,
    bottom: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const pad = frame.gutter;
    let y = top + 12;
    for (const issue of model.issues) {
      const current = issue.status === "current";
      // A page-based issue's own comic-page crop reads wide (its own page aspect), so its row is a full-width
      // strip rather than the plain square-thumbnail-beside-text row below — sized to match `gmw-comic-reader.dc`'s
      // phone composition (current tallest, finished mid, sealed short).
      const rowHeight = issue.pageCrop ? (current ? 240 : issue.status === "finished" ? 150 : 86) : current ? 220 : 74;
      const rect: Rect = { x: pad, y, width: frame.width - pad * 2, height: rowHeight };
      if (issue.pageCrop) this.#rowComic(issue, issue.pageCrop, rect, current, stops, order);
      else this.#row(issue, rect, current, stops, order);
      y += rowHeight + 12;
      if (y > bottom - 20) break;
    }
  }

  /** Phone row for a page-based issue: the wide comic-page crop above the same kicker/title/result footer. */
  #rowComic(
    issue: RunIssueRow,
    crop: RunPageCrop,
    rect: Rect,
    current: boolean,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const g = this.add.graphics();
    const finished = issue.status === "finished";
    const sealed = issue.status === "sealed";
    // See `#column`'s own `readZone` comment: brought above the whole-row zone once that's added below.
    let readZone: Phaser.GameObjects.Zone | null = null;
    if (current) {
      g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
      g.lineStyle(3, accent.heroRed.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    } else if (sealed) {
      g.fillStyle(0xd9d2bd, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    } else {
      g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
      g.lineStyle(2, surface.ink.hex, 0.25).strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    const pad = 10;
    const artHeight = rect.height - (current ? 70 : sealed ? 34 : 44);
    const artRect: Rect = {
      x: rect.x + pad,
      y: rect.y + pad,
      width: rect.width - pad * 2,
      height: Math.max(50, artHeight),
    };
    drawPageCrop(this, this.#campaignId, crop, artRect, () => this.#draw(), { pixelated: sealed });
    if (sealed) {
      this.add
        .text(
          artRect.x + artRect.width / 2,
          artRect.y + artRect.height / 2,
          "SEALED",
          textStyle(bangers(16), surface.paper.hex, 0.9),
        )
        .setOrigin(0.5);
    }
    if (finished) {
      const probe = stamp(this, -10000, -10000, "READ ▸", { size: 11 });
      for (const object of probe.objects) object.destroy();
      const { rect: chipRect } = stamp(
        this,
        artRect.x + artRect.width - 8 - probe.rect.width,
        artRect.y + 8,
        "READ ▸",
        {
          size: 11,
        },
      );
      const key = `read:${issue.nodeId}`;
      const activate = (): void => this.#reread(issue.nodeId);
      readZone = this.add
        .zone(chipRect.x, chipRect.y, chipRect.width, chipRect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      readZone.on("pointerup", activate);
      stops.set(key, { rect: chipRect, activate });
      order.push(key);
    }

    const footerColor = current ? surface.paper.hex : surface.ink.hex;
    const kicker = sealed
      ? `#${issue.number} · SEALED`
      : current
        ? `#${issue.number} · ${(issue.villain ?? "").toUpperCase()} · UP NEXT`
        : `#${issue.number} · ${(issue.villain ?? "").toUpperCase()}`;
    let textY = artRect.y + artRect.height + 6;
    const kickerLabel = this.add
      .text(rect.x + pad, textY, kicker, textStyle(typeRole.label, footerColor, current ? 0.9 : sealed ? 0.6 : 0.75))
      .setFontSize(10);
    textY = kickerLabel.y + kickerLabel.height + 2;
    const titleLabel = sealed
      ? kickerLabel
      : this.add
          .text(rect.x + pad, textY, issue.title, textStyle(bangers(current ? 18 : 14), footerColor))
          .setWordWrapWidth(rect.width - pad * 2);
    if (!sealed) fitText(titleLabel, rect.width - pad * 2, current ? 18 : 14);
    if (current && issue.pageProgressLine) {
      this.add
        .text(
          rect.x + pad,
          titleLabel.y + titleLabel.height + 4,
          issue.pageProgressLine,
          textStyle(typeRole.body, surface.paper.hex, 0.85),
        )
        .setFontSize(11)
        .setWordWrapWidth(rect.width - pad * 2);
    }
    if (finished && issue.resultLine) {
      this.add
        .text(
          rect.x + pad,
          titleLabel.y + titleLabel.height + 2,
          issue.resultLine,
          textStyle(typeRole.body, footerColor, 0.8),
        )
        .setFontSize(10);
    }
    if (finished) {
      const key = `issue:${issue.nodeId}`;
      const activate = (): void => this.#openIssue(issue.nodeId);
      const zone = this.add
        .zone(rect.x, rect.y, rect.width, rect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerup", activate);
      stops.set(key, { rect, activate });
      order.push(key);
      if (readZone) this.children.bringToTop(readZone);
    }
  }

  #row(issue: RunIssueRow, rect: Rect, current: boolean, stops: Map<string, FocusStop>, order: string[]): void {
    const g = this.add.graphics();
    const finished = issue.status === "finished";
    const sealed = issue.status === "sealed";
    if (current) {
      g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
      g.lineStyle(3, accent.heroRed.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    } else if (sealed) {
      g.fillStyle(0xd9d2bd, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    } else {
      // A finished issue reads as a back issue in daylight (design tile 8): paper, not the ink ground.
      g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
      g.lineStyle(2, surface.ink.hex, 0.25).strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    const thumbSize = current ? rect.width - 20 : 56;
    const thumbRect: Rect = current
      ? { x: rect.x + 10, y: rect.y + 10, width: thumbSize, height: 110 }
      : { x: rect.x + 8, y: rect.y + (rect.height - thumbSize) / 2, width: thumbSize, height: thumbSize };
    if (sealed) {
      this.add
        .text(
          thumbRect.x + thumbRect.width / 2,
          thumbRect.y + thumbRect.height / 2,
          "?",
          textStyle(bangers(22), surface.ink.hex, 0.4),
        )
        .setOrigin(0.5);
    } else {
      drawPicture(this, villainPicture(issue.nodeId), thumbRect, () => this.#draw(), {
        grayscale: finished,
        focusY: 0.12,
      });
    }
    const textX = current ? rect.x + 10 : thumbRect.x + thumbRect.width + 10;
    const textWidth = current ? rect.width - 20 : rect.width - (textX - rect.x) - 10;
    const footerColor = current ? surface.paper.hex : surface.ink.hex;
    const kicker = sealed ? `#${issue.number} · SEALED` : `#${issue.number} · ${(issue.villain ?? "").toUpperCase()}`;
    let textY = current ? thumbRect.y + thumbRect.height + 6 : rect.y + 8;
    const kickerLabel = this.add
      .text(textX, textY, kicker, textStyle(typeRole.label, footerColor, sealed && !current ? 0.6 : 0.75))
      .setFontSize(10);
    textY = kickerLabel.y + kickerLabel.height + 2;
    // Sealed's title is always "Sealed" — the kicker already says it, so no second line repeats it.
    const titleLabel = sealed
      ? kickerLabel
      : this.add
          .text(textX, textY, issue.title, textStyle(bangers(current ? 18 : 14), footerColor))
          .setWordWrapWidth(textWidth);
    if (!sealed) fitText(titleLabel, textWidth, current ? 18 : 14);
    if (current && issue.blurb) {
      this.add
        .text(
          textX,
          titleLabel.y + titleLabel.height + 4,
          issue.blurb,
          textStyle(typeRole.body, surface.paper.hex, 0.85),
        )
        .setFontSize(11)
        .setWordWrapWidth(textWidth);
    }
    if (finished && issue.resultLine) {
      this.add
        .text(textX, titleLabel.y + titleLabel.height + 2, issue.resultLine, textStyle(typeRole.body, footerColor, 0.8))
        .setFontSize(10);
    }
    if (finished) {
      const key = `issue:${issue.nodeId}`;
      const activate = (): void => this.#openIssue(issue.nodeId);
      const zone = this.add
        .zone(rect.x, rect.y, rect.width, rect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerup", activate);
      stops.set(key, { rect, activate });
      order.push(key);
    }
  }

  #openIssue(nodeId: string): void {
    if (!this.#data) return;
    goToScreen(this, SCENES.campaignIssue, { runId: this.#data.runId, nodeId });
  }

  /** The READ ▸ chip on a page-based finished issue: straight into the comic reader, back to The Run once done. */
  #reread(nodeId: string): void {
    if (!this.#data) return;
    goToScreen(this, SCENES.campaignOpener, {
      runId: this.#data.runId,
      nodeId,
      returnTo: { key: SCENES.campaignRun, data: { runId: this.#data.runId } },
    });
  }

  #button(
    kind: "primary" | "secondary" | "quiet",
    text: string,
    rect: Rect,
    onClick: () => void,
    stops: Map<string, FocusStop>,
    order: string[],
    key: string,
  ): void {
    stops.set(key, { rect, activate: onClick });
    order.push(key);
    this.#buttons.push(new McButton(this, { kind, label: text, type: typeRole.barTitle, rect, onClick }));
  }
}
