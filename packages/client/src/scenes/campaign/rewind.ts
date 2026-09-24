/**
 * C09 — Rewind: the villain's taunt after a lost issue, and the three ways forward (docs/campaign-mode-design.md
 * §6.2). Everything here is read from the fold that already happened (`Aftermath`'s loss branch calls
 * `campaignService().fold` before routing here) — this screen never folds anything itself, only reads
 * `view/campaign-rewind-model.ts`'s summary of what the log kept and what it struck.
 *
 * MC10's expert-only Red Skull defeat can end the whole campaign on a loss (`record.status === "lost"`): that's
 * shown as its own message, with no "REWIND ▸" — there is nothing left to retry.
 */
import Phaser from "phaser";
import { issueNumberOf, issueStoryFor, storyFor, type ComicBeatRef, type ComicPage } from "../../campaign/story.js";
import { CARDS_BY_ID } from "../../content/pool.js";
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import { campaignService } from "../../session.js";
import { accent, dotGrid, ink, signal, surface, typeRole } from "../../tokens.js";
import {
  campaignFrame,
  campaignPagePicture,
  desaturate,
  drawPicture,
  speechBubble,
  villainPicture,
} from "../../ui/campaign-chrome.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { ensurePictureLoaded } from "../../art/pictures.js";
import { setMask } from "../../ui/rex.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { McButton, fitText, label, paintDotGrid } from "../../ui/widgets.js";
import { coverCropFavoringBeats } from "../../view/comic-crop.js";
import { rewindViewOf, type RewindView } from "../../view/campaign-rewind-model.js";
import type { Rect } from "../../view/layout.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignRewindData } from "./routes.js";

/**
 * A page-based box's (GMW) own last-read panel, resolved against its `pages`: the issue's final `comicBeats`
 * entry — "the page flips back to the last panel you read" (`docs/campaign-client-per-box.md` §4's per-box
 * mapping). Null for a box with no `pages` (MC10 keeps its plain villain-picture treatment), or an issue with no
 * `comicBeats` yet. `pageNumber` is the page's 1-based position among the box's own pages, for the "Page N's last
 * panel replays…" REDO line.
 */
interface LastPanelCrop {
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly beats: readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number }[];
  readonly pageNumber: number;
}

/** Everything `#drawWide`/`#drawPhone`/`#drawVillainFrame`/`#drawRight` need about this issue's story, computed
 * once in `#draw` so those methods stay pure layout over already-resolved data. */
interface RewindFrameCtx {
  readonly campaignId: string;
  readonly taunt: string;
  /** The taunt bubble's named speaker — only set for a page-based panel (`ctx.panel`), matching the tile's own
   * "THE COLLECTOR" label; MC10's plain villain-portrait taunt stays unattributed, unchanged. */
  readonly speaker?: string;
  readonly panel: LastPanelCrop | null;
  readonly campaignLost: { readonly headline: string; readonly line: string };
}

function lastPanelCropFor(
  pages: readonly ComicPage[] | undefined,
  comicBeats: readonly ComicBeatRef[] | undefined,
): LastPanelCrop | null {
  if (!pages || !comicBeats || comicBeats.length === 0) return null;
  const ref = comicBeats[comicBeats.length - 1]!;
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

/** The bounding rect's own jagged-bottom outline (a sawtooth), in whatever coordinate space `rect` is given —
 * shared by the paper backing (local, rotated-container space) and the picture's own torn-edge clip mask
 * (absolute scene space), so both edges cut the same tooth pattern. */
function sawtoothPoints(rect: Rect, teeth: number, toothDepth: number): Phaser.Math.Vector2[] {
  const toothW = rect.width / teeth;
  const points: Phaser.Math.Vector2[] = [
    new Phaser.Math.Vector2(rect.x, rect.y),
    new Phaser.Math.Vector2(rect.x + rect.width, rect.y),
    new Phaser.Math.Vector2(rect.x + rect.width, rect.y + rect.height),
  ];
  for (let i = teeth; i >= 0; i--) {
    const x = rect.x + i * toothW;
    const y = rect.y + rect.height - (i % 2 === 0 ? 0 : toothDepth);
    points.push(new Phaser.Math.Vector2(x, y));
  }
  return points;
}

export class CampaignRewindScene extends Phaser.Scene {
  #data!: CampaignRewindData;
  #record: CampaignRecord | null = null;
  #view: RewindView | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.campaignRewind);
  }

  init(data: CampaignRewindData): void {
    this.#data = data;
    this.#record = null;
    this.#view = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.void.hex));
    this.scale.on("resize", this.#draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.#draw, this));
    void this.#load();
    fadeScreenIn(this);
  }

  async #load(): Promise<void> {
    const service = campaignService();
    const record = await service.load(this.#data.runId);
    if (!this.sys.isActive()) return;
    if (!record) {
      goToScreen(this, SCENES.campaignSaga);
      return;
    }
    this.#record = record;
    const definition = service.definitionFor(record);
    const nodeIds = definition.graph.nodes.map((node) => node.id);
    this.#view = rewindViewOf(record, this.#data.nodeId, (id) => issueNumberOf(nodeIds, id), CARDS_BY_ID);
    this.#draw();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    const { width, height, phone } = campaignFrame(this);
    this.add.rectangle(0, 0, width, height, surface.void.hex).setOrigin(0, 0);
    paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", dotGrid.onInk);

    const record = this.#record;
    const view = this.#view;
    if (!record || !view) return;
    const campaignId = record.campaignId as string;
    const story = issueStoryFor(campaignId, this.#data.nodeId);
    const campaignStory = storyFor(campaignId);
    // A page-based box (GMW) tears its Rewind photo from the issue's own last-read page instead of the scenario's
    // plain villain portrait — detected from the story's own data (`pages`/`comicBeats`), never `campaignId`, so a
    // box with no pages (MC10) is untouched and a later page-based box picks this up for free.
    const panel = lastPanelCropFor(campaignStory?.pages, story?.comicBeats);
    const speaker = panel ? story?.villain : undefined;
    const ctx: RewindFrameCtx = {
      campaignId,
      taunt: story?.rewindTaunt ?? "",
      panel,
      campaignLost: campaignStory?.campaignLost ?? {
        headline: "Hydra\nWins.",
        line: "Red Skull conquered the world. This run of the campaign is over.",
      },
      ...(speaker ? { speaker } : {}),
    };

    const order: string[] = [];
    const stops = new Map<string, FocusStop>();
    if (phone) this.#drawPhone(width, height, view, ctx, order, stops);
    else this.#drawWide(width, height, view, ctx, order, stops);

    this.#route = this.#route ?? new FocusRoute(this);
    this.#route.set(order, stops);
  }

  #drawWide(
    width: number,
    height: number,
    view: RewindView,
    ctx: RewindFrameCtx,
    order: string[],
    stops: Map<string, FocusStop>,
  ): void {
    const pad = 40;
    const artWidth = Math.round(width * 0.42);
    const artRect: Rect = { x: pad, y: pad + 6, width: artWidth - pad, height: height - pad * 2 - 12 };
    this.#drawVillainFrame(artRect, ctx);

    const rightX = artWidth + 40;
    const rightWidth = width - rightX - pad;
    this.#drawRight({ x: rightX, y: pad, width: rightWidth, height: height - pad * 2 }, view, ctx, order, stops, false);
  }

  #drawPhone(
    width: number,
    height: number,
    view: RewindView,
    ctx: RewindFrameCtx,
    order: string[],
    stops: Map<string, FocusStop>,
  ): void {
    const pad = 16;
    const artRect: Rect = { x: pad, y: pad, width: width - pad * 2, height: 260 };
    this.#drawVillainFrame(artRect, ctx);
    const rightRect: Rect = {
      x: pad,
      y: artRect.y + artRect.height + 24,
      width: width - pad * 2,
      height: height - artRect.y - artRect.height - 24 - pad,
    };
    this.#drawRight(rightRect, view, ctx, order, stops, true);
  }

  /**
   * The photo torn from the log: a tilted paper frame with a jagged bottom edge (a sawtooth polygon, container-
   * rotated around the frame's own centre so the tilt reads as "torn and dropped", not "rotated text"). The photo
   * itself gets the same jagged bottom, clipped through `ui/rex.ts`'s `setMask` (Phaser 4's own geometry mask is a
   * silent WebGL no-op) so the tear reads on the picture, not just on the paper peeking out from behind it. A
   * page-based box (GMW) shows the issue's own last-read panel here (`ctx.panel`); every other box keeps the plain
   * villain portrait.
   */
  #drawVillainFrame(rect: Rect, ctx: RewindFrameCtx): void {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const teeth = 6;
    const toothDepth = 14;
    const localRect: Rect = { x: -rect.width / 2, y: -rect.height / 2, width: rect.width, height: rect.height };
    const frame = this.add.graphics();
    frame.fillStyle(surface.paper.hex, 1);
    frame.fillPoints(sawtoothPoints(localRect, teeth, toothDepth), true);
    const container = this.add.container(cx, cy, [frame]);
    container.setAngle(-3);

    const innerPad = 8;
    const innerRect: Rect = {
      x: rect.x + innerPad,
      y: rect.y + innerPad,
      width: rect.width - innerPad * 2,
      height: rect.height - innerPad * 2 - toothDepth,
    };
    const image = ctx.panel
      ? this.#drawLastPanelPicture(ctx.campaignId, ctx.panel, innerRect)
      : drawPicture(this, villainPicture(this.#data.nodeId), innerRect, () => this.#draw(), {
          focusY: 0.2,
          grayscale: true,
        });
    if (image) {
      // The photo's own torn bottom edge, cut with the same tooth pattern as the paper behind it — off the
      // display list, so it is destroyed with the image it clips rather than lingering as an orphaned shape.
      const maskShape = this.make.graphics({}, false);
      maskShape.fillStyle(0xffffff, 1);
      maskShape.fillPoints(sawtoothPoints(innerRect, teeth, toothDepth), true);
      setMask(image, maskShape, "world");
      image.once(Phaser.GameObjects.Events.DESTROY, () => maskShape.destroy());
    }

    if (ctx.taunt) {
      const bubbleWidth = Math.min(260, rect.width - 24);
      const bubbleX = Math.min(rect.x + rect.width - 40, rect.x + rect.width - bubbleWidth - 8);
      speechBubble(this, bubbleX, rect.y + rect.height - 60, bubbleWidth, ctx.taunt, {
        tail: "none",
        ...(ctx.speaker ? { speaker: ctx.speaker, shadow: accent.heroRed.hex } : {}),
      });
    }
  }

  /**
   * A page-based box's last-read panel (`LastPanelCrop`), cover-fit into `rect` and desaturated — the same crop
   * math The Run's own page crop uses (`scenes/campaign/run.ts`'s `drawPageCrop`, `beat.ts`'s
   * `drawStagePanelPicture`), here for the issue's own final beat instead of a stage flip's. Null while the page's
   * art hasn't loaded (or has none); `#draw` is `ensurePictureLoaded`'s redraw hook.
   */
  #drawLastPanelPicture(campaignId: string, crop: LastPanelCrop, rect: Rect): Phaser.GameObjects.Image | null {
    if (rect.width <= 0 || rect.height <= 0) return null;
    const picture = campaignPagePicture(campaignId, crop.file);
    if (!picture) return null;
    const key = ensurePictureLoaded(this, picture, () => this.#draw());
    if (!key) return null;
    const fit = coverCropFavoringBeats(crop, rect);
    const image = this.add
      .image(rect.x - fit.cropX * fit.scale, rect.y - fit.cropY * fit.scale, key)
      .setOrigin(0, 0)
      .setScale(fit.scale)
      .setCrop(fit.cropX, fit.cropY, fit.cropWidth, fit.cropHeight);
    desaturate(image);
    return image;
  }

  /**
   * The tag/title/box/buttons block, vertically centred beside the art — the tile's own composition, not
   * top-aligned. `#estimateRightHeight` gives a close-enough height without a real layout pass (the exact figure
   * would need one, since the body text and the kept/gone box both word-wrap, but centring a block that's off by a
   * handful of pixels is visually indistinguishable from centring it exactly), and the real draw simply starts
   * that much lower.
   */
  #drawRight(
    rect: Rect,
    view: RewindView,
    ctx: RewindFrameCtx,
    order: string[],
    stops: Map<string, FocusStop>,
    phone: boolean,
  ): void {
    const offset = Math.max(0, (rect.height - this.#estimateRightHeight(view, ctx, phone)) / 2);
    this.#layoutRight({ ...rect, y: rect.y + offset }, view, ctx, order, stops, phone);
  }

  #estimateRightHeight(view: RewindView, ctx: RewindFrameCtx, phone: boolean): number {
    const tag = 34;
    if (view.campaignLost) {
      const headline = (phone ? 46 : 64) * 1.7;
      return tag + 16 + headline + 16 + 40 + 60 + 52;
    }
    const headline = (phone ? 40 : 60) * 1.65;
    const body = 40;
    // A page-based box (`ctx.panel`) shows an extra REDO row under KEPT ("Page N's last panel replays…") — MC10's
    // plain KEPT/GONE box keeps its exact prior height.
    const box = 34 + (view.gone.length + (ctx.panel ? 1 : 0)) * 34 + 24;
    return tag + 14 + headline + 12 + body + 16 + box + 20 + 56 + 10 + 48;
  }

  #layoutRight(
    rect: Rect,
    view: RewindView,
    ctx: RewindFrameCtx,
    order: string[],
    stops: Map<string, FocusStop>,
    phone: boolean,
  ): void {
    let y = rect.y;
    if (view.campaignLost) {
      const { rect: tagRect } = this.#tag(rect.x, y, "The campaign is lost.");
      y = tagRect.y + tagRect.height + 16;
      const headline = this.add
        .text(rect.x, y, ctx.campaignLost.headline, {
          ...textStyle({ ...typeRole.barTitle, size: phone ? 46 : 64 }, surface.paper.hex),
          fontStyle: "",
        })
        .setOrigin(0, 0)
        .setLineSpacing(-8);
      y = headline.y + headline.height + 16;
      this.add
        .text(rect.x, y, ctx.campaignLost.line, textStyle(typeRole.body, surface.paper.hex, ink.secondary))
        .setWordWrapWidth(rect.width);
      y += 60;
      const ctaRect: Rect = { x: rect.x, y, width: Math.min(320, rect.width), height: 52 };
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Back to the saga ▸",
          type: typeRole.barTitle,
          rect: ctaRect,
          onClick: () => goToScreen(this, SCENES.campaignSaga),
        }),
      );
      order.push("saga");
      stops.set("saga", { rect: ctaRect, activate: () => goToScreen(this, SCENES.campaignSaga) });
      return;
    }

    const { rect: tagRect } = this.#tag(rect.x, y, "No. That's not how it happened.");
    y = tagRect.y + tagRect.height + 14;
    const headline = this.add
      .text(
        rect.x,
        y,
        `Rewind\nIssue #${view.issueNumber}`,
        textStyle({ ...typeRole.barTitle, size: phone ? 40 : 60 }, surface.paper.hex),
      )
      .setOrigin(0, 0)
      .setLineSpacing(-10);
    fitText(headline, rect.width, phone ? 40 : 60);
    y = headline.y + headline.height + 12;
    // A page-based box (`ctx.panel`) reads the intro as "the page flips back" rather than MC10's plain "same
    // villain, same log" line — MC10 keeps its exact prior wording.
    const introText = ctx.panel
      ? "The page flips back to the last panel you read. The log picks up exactly where it left off. Change decks or aspects first if you want."
      : "Same villain, same log as when you opened it. Change decks or aspects first if you want.";
    const body = this.add
      .text(rect.x, y, introText, textStyle(typeRole.body, surface.paper.hex, ink.secondary))
      .setWordWrapWidth(rect.width);
    y = body.y + body.height + 16;

    const boxG = this.add.graphics();
    let boxY = y + 14;
    const keptLabel = label(this, rect.x + 16, boxY, "Kept", typeRole.label, signal.heal.hex, 1);
    this.add
      .text(rect.x + 16 + 52, boxY - 1, view.keptSummary, textStyle(typeRole.body, surface.paper.hex, ink.secondary))
      .setFontSize(13)
      .setWordWrapWidth(rect.width - 16 - 52 - 16);
    boxY += Math.max(keptLabel.height, 16) + 10;
    if (ctx.panel) {
      // The REDO row: "the page flips back" is a real mechanical fact about how this box's guided read resumes,
      // read from `ctx.panel`'s own resolved page rather than hard-coded to one issue.
      const redoLabel = label(this, rect.x + 16, boxY, "Redo", typeRole.label, signal.cost.hex, 1);
      const redoText = this.add
        .text(
          rect.x + 16 + 52,
          boxY - 1,
          `Page ${ctx.panel.pageNumber}'s last panel replays before the game starts again.`,
          textStyle(typeRole.body, surface.paper.hex, ink.secondary),
        )
        .setFontSize(13)
        .setWordWrapWidth(rect.width - 16 - 52 - 16);
      boxY += Math.max(redoLabel.height, redoText.height) + 10;
    }
    for (const gone of view.gone) {
      const goneLabel = label(this, rect.x + 16, boxY, "Gone", typeRole.label, signal.caution.hex, 1);
      const text = this.add
        .text(
          rect.x + 16 + 52,
          boxY - 1,
          `${gone.name} — spent this game, struck from the campaign.`,
          textStyle(typeRole.body, surface.paper.hex, ink.secondary),
        )
        .setFontSize(13)
        .setWordWrapWidth(rect.width - 16 - 52 - 16);
      boxY += Math.max(goneLabel.height, text.height) + 10;
    }
    const boxHeight = boxY - y + 4;
    boxG.lineStyle(2, surface.paper.hex, 0.35).strokeRect(rect.x, y, rect.width, boxHeight);
    y += boxHeight + 20;

    const rewindRect: Rect = { x: rect.x, y, width: rect.width, height: 56 };
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "Rewind ▸",
        type: typeRole.barTitle,
        rect: rewindRect,
        onClick: () => this.#rewind(),
      }),
    );
    order.push("rewind");
    stops.set("rewind", { rect: rewindRect, activate: () => this.#rewind() });
    y += 56 + 10;

    // The tile's Edit decks / Shelve are ink-filled with a paper outline (`kind: "onInk"`), not the paper-filled
    // "secondary" skin — Shelve dimmer still, since it's the least-committed of the three ways forward.
    const halfWidth = (rect.width - 12) / 2;
    const editRect: Rect = { x: rect.x, y, width: halfWidth, height: 48 };
    const shelveRect: Rect = { x: rect.x + halfWidth + 12, y, width: halfWidth, height: 48 };
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "Edit decks",
        type: typeRole.barTitle,
        rect: editRect,
        onClick: () => this.#editDecks(),
      }),
    );
    order.push("edit-decks");
    stops.set("edit-decks", { rect: editRect, activate: () => this.#editDecks() });
    const shelve = new McButton(this, {
      kind: "onInk",
      label: "Shelve",
      type: typeRole.barTitle,
      rect: shelveRect,
      onClick: () => goToScreen(this, SCENES.campaignSaga),
    });
    shelve.container.setAlpha(0.75);
    this.#buttons.push(shelve);
    order.push("shelve");
    stops.set("shelve", { rect: shelveRect, activate: () => goToScreen(this, SCENES.campaignSaga) });
  }

  #tag(
    x: number,
    y: number,
    text: string,
  ): { readonly objects: readonly Phaser.GameObjects.GameObject[]; readonly rect: Rect } {
    const t = this.add
      .text(0, 0, text.toUpperCase(), textStyle({ ...typeRole.barTitle, size: 16 }, surface.ink.hex))
      .setOrigin(0, 0);
    const rect: Rect = { x, y, width: t.width + 16, height: t.height + 8 };
    const g = this.add.graphics();
    g.fillStyle(signal.caution.hex, 1).fillRect(0, 0, rect.width, rect.height);
    const container = this.add.container(rect.x + rect.width / 2, rect.y + rect.height / 2, [g, t]);
    container.setAngle(-2);
    g.setPosition(-rect.width / 2, -rect.height / 2);
    t.setPosition(-rect.width / 2 + 8, -rect.height / 2 + 4);
    return { objects: [g, t], rect };
  }

  #rewind(): void {
    const record = this.#record;
    if (!record) return;
    goToScreen(this, SCENES.campaignBriefing, { runId: record.id });
  }

  #editDecks(): void {
    const record = this.#record;
    const seatNumber = record?.seats[0]?.seatNumber;
    if (!record || seatNumber === undefined) return;
    goToScreen(this, SCENES.campaignDeckEdit, {
      runId: record.id,
      seatNumber,
      returnTo: { key: SCENES.campaignRewind, data: this.#data },
    });
  }
}
