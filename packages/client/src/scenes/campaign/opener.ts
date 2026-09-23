/**
 * C03 — the issue opener: a header (issue number, the issue's Bangers title, "SKIP ▸▸"), three tap-through comic
 * panels (stacked on phone), and a bottom CTA that reveals the next panel or, once every panel is up, leaves for
 * the Briefing. All copy is `campaign/story.ts`'s (`issueStoryFor`); this scene only sequences the reveal
 * (`view/campaign-opener-model.ts`) and draws what it returns.
 *
 * Two entries (`routes.ts`'s `CampaignOpenerData`):
 *  - The run's own next issue (`data.nodeId` absent): `record.position.nextNodeId`. Skip/finish go to Briefing.
 *  - A reread of a finished issue (`data.nodeId` + `data.returnTo`, Run's "Reread issue #2"): the same panels, then
 *    back to `returnTo` instead of Briefing — nothing here needs to know it's a reread beyond that one branch.
 */
import Phaser from "phaser";
import { issueNumberOf, issueStoryFor, type IssueStory } from "../../campaign/story.js";
import {
  artNote,
  campaignFrame,
  captionBox,
  drawPicture,
  heroPicture,
  speechBubble,
  villainPicture,
} from "../../ui/campaign-chrome.js";
import { accent, dotGrid, ink, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { McButton, dashedRect, fitText, label, paintDotGrid } from "../../ui/widgets.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import type { Rect } from "../../view/layout.js";
import { openerViewOf, type OpenerPanelView } from "../../view/campaign-opener-model.js";
import { campaignService } from "../../session.js";
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignOpenerData } from "./routes.js";

export class CampaignOpenerScene extends Phaser.Scene {
  #data!: CampaignOpenerData;
  #record: CampaignRecord | null = null;
  #story: IssueStory | null = null;
  #issueNumber = 1;
  #issueTotal = 1;
  #revealed = 1;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.campaignOpener);
  }

  init(data: CampaignOpenerData): void {
    this.#data = data;
    this.#record = null;
    this.#story = null;
    this.#revealed = 1;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
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
    const nodeId = this.#data.nodeId ?? record.position.nextNodeId;
    if (!nodeId) {
      goToScreen(this, SCENES.campaignDossier, { runId: record.id });
      return;
    }
    this.#record = record;
    this.#story = issueStoryFor(record.campaignId, nodeId);
    const definition = service.definitionFor(record);
    const nodeIds = definition.graph.nodes.map((node) => node.id);
    this.#issueNumber = issueNumberOf(nodeIds, nodeId);
    this.#issueTotal = nodeIds.length;
    this.#draw();
  }

  #nodeId(): string | null {
    return this.#data.nodeId ?? this.#record?.position.nextNodeId ?? null;
  }

  /** Skip, the last panel's CTA, or the auto-advance — always the same place: onward to Briefing or back to a reread's `returnTo`. */
  #leave(): void {
    this.scale.off("resize", this.#draw, this);
    const returnTo = this.#data.returnTo;
    if (returnTo) goToScreen(this, returnTo.key, returnTo.data);
    else goToScreen(this, SCENES.campaignBriefing, { runId: this.#data.runId });
  }

  #reveal(): void {
    const total = this.#story?.opener.length ?? 1;
    if (this.#revealed >= total) {
      this.#leave();
      return;
    }
    this.#revealed += 1;
    this.#draw();
  }

  #draw(): void {
    const record = this.#record;
    const story = this.#story;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    if (!record || !story) return;

    const { width, height, phone } = campaignFrame(this);
    const rosterIds = record.seats.map((seat) => seat.identityCardId);
    const view = openerViewOf(story, this.#issueNumber, this.#issueTotal, rosterIds, this.#revealed);

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);

    // Header: paper ground (not the ink top bar every other campaign screen uses — the opener reads as a comic
    // page, not a control panel), issue label, the huge Bangers title, "SKIP ▸▸" boxed at the right.
    const headerPad = phone ? 16 : 24;
    const stops = new Map<string, FocusStop>();
    const skipRect: Rect = { x: width - headerPad - (phone ? 78 : 96), y: 14, width: phone ? 78 : 96, height: 30 };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "SKIP ▸▸",
        type: typeRole.label,
        rect: skipRect,
        onClick: () => this.#leave(),
      }),
    );
    stops.set("skip", { rect: skipRect, activate: () => this.#leave() });

    label(this, headerPad, 14, view.issueLabel, typeRole.label, surface.ink.hex, ink.label);
    const title = this.add
      .text(
        headerPad,
        26,
        view.title.toUpperCase(),
        textStyle({ ...typeRole.barTitle, size: phone ? 26 : 36 }, surface.ink.hex),
      )
      .setOrigin(0, 0);
    fitText(title, skipRect.x - headerPad - 12, phone ? 26 : 36);
    const headerBottom = Math.max(26 + title.height, 60) + 12;

    const actionBarHeight = phone ? 68 : 88;
    const panelsTop = headerBottom;
    const panelsBottom = height - actionBarHeight;
    const panelsRect: Rect = { x: 0, y: panelsTop, width, height: Math.max(0, panelsBottom - panelsTop) };

    if (phone) this.#drawPanelsStacked(panelsRect, view.panels, headerPad, stops);
    else this.#drawPanelsRow(panelsRect, view.panels, headerPad, stops);

    // Bottom ink action bar with the reveal/leave CTA.
    this.add.rectangle(0, height - actionBarHeight, width, actionBarHeight, surface.ink.hex).setOrigin(0, 0);
    const ctaPad = phone ? 12 : 16;
    const ctaRect: Rect = {
      x: phone ? ctaPad : width - ctaPad - 425,
      y: height - actionBarHeight + (actionBarHeight - 62) / 2,
      width: phone ? width - ctaPad * 2 : Math.min(425, width - ctaPad * 2),
      height: 62,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: view.allRevealed ? "primary" : "onInk",
        label: view.ctaLabel,
        type: typeRole.barTitle,
        rect: ctaRect,
        onClick: () => this.#reveal(),
      }),
    );
    stops.set("cta", { rect: ctaRect, activate: () => this.#reveal() });

    // Tap-anywhere-on-the-page also reveals the next panel — the design's own "TAP ▸" affordance is on the panel
    // itself, not only the bottom bar. Placed under the buttons in the display list so it never steals their clicks.
    const tapZone = this.add
      .zone(0, 0, width, height - actionBarHeight)
      .setOrigin(0, 0)
      .setInteractive();
    tapZone.on("pointerup", () => this.#reveal());
    this.children.sendToBack(tapZone);

    this.#route = this.#route ?? new FocusRoute(this, { onCancel: () => this.#leave() });
    this.#route.set(["skip", "cta"], stops);
  }

  #drawPanelsRow(rect: Rect, panels: readonly OpenerPanelView[], gap: number, stops: Map<string, FocusStop>): void {
    // The design's own proportions: panel 1 narrow, panel 2 wide, panel 3 medium.
    const weights = [1, 1.5, 1.15];
    const total = weights.reduce((sum, w) => sum + w, 0);
    const innerGap = gap * 0.6;
    const usable = rect.width - gap * 2 - innerGap * (panels.length - 1);
    let x = rect.x + gap;
    panels.forEach((panel, index) => {
      const w = (usable * (weights[index] ?? 1)) / total;
      this.#drawPanel(panel, { x, y: rect.y, width: w, height: rect.height }, stops);
      x += w + innerGap;
    });
  }

  #drawPanelsStacked(rect: Rect, panels: readonly OpenerPanelView[], gap: number, stops: Map<string, FocusStop>): void {
    const innerGap = 12;
    const panelHeight = Math.max(120, (rect.height - gap - innerGap * (panels.length - 1)) / panels.length);
    let y = rect.y;
    panels.forEach((panel) => {
      this.#drawPanel(panel, { x: gap, y, width: rect.width - gap * 2, height: panelHeight }, stops);
      y += panelHeight + innerGap;
    });
  }

  #drawPanel(panel: OpenerPanelView, rect: Rect, stops: Map<string, FocusStop>): void {
    const g = this.add.graphics();
    if (!panel.revealed) {
      g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
      paintDotGrid(this, rect, "paper", dotGrid.onPaper);
      dashedRect(g, rect, 2);
      const hintText = panel.isNext ? "TAP ▸" : "…";
      const hint = this.add
        .text(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          hintText,
          textStyle(typeRole.label, surface.ink.hex, panel.isNext ? ink.secondary : ink.meta),
        )
        .setOrigin(0.5)
        .setFontSize(16);
      if (panel.isNext) {
        const zone = this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive();
        zone.on("pointerup", () => this.#reveal());
        stops.set(`panel:${panel.index}`, { rect, activate: () => this.#reveal() });
        void hint;
      }
      return;
    }

    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(3, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);

    let y = rect.y + 10;
    if (panel.caption) {
      const { rect: capRect } = captionBox(this, rect.x + 10, y, rect.width - 20, panel.caption);
      y = capRect.y + capRect.height + 10;
    }

    const artBottom = Math.max(y, rect.y + rect.height * (panel.lines.length > 0 ? 0.55 : 0.75));
    const artRect: Rect = { x: rect.x + 10, y, width: rect.width - 20, height: Math.max(0, artBottom - y) };
    if (panel.art && artRect.height > 20) this.#drawArt(panel, artRect);

    let lineY = artBottom + 10;
    for (const line of panel.lines) {
      if (lineY > rect.y + rect.height - 24) break;
      const speaker = line.speaker.kind === "hero" || line.speaker.kind === "npc" ? line.speaker.name : undefined;
      const { rect: bubbleRect } = speechBubble(this, rect.x + 10, lineY, rect.width - 20, line.text, {
        ...(speaker ? { speaker } : {}),
        tail: "none",
        size: 12,
      });
      lineY = bubbleRect.y + bubbleRect.height + 8;
    }

    if (panel.sfx) {
      this.add
        .text(
          rect.x + rect.width - 12,
          rect.y + 12,
          panel.sfx,
          textStyle({ ...typeRole.barTitle, size: 22 }, accent.heroRed.hex),
        )
        .setOrigin(1, 0)
        .setAngle(-6);
    }
  }

  #drawArt(panel: OpenerPanelView, rect: Rect): void {
    const art = panel.art;
    if (!art) return;
    if (art.kind === "note") {
      artNote(this, rect, art.text);
      return;
    }
    const record = this.#record;
    if (!record) return;
    if (art.kind === "villain") {
      const nodeId = this.#nodeId();
      const scenarioId = nodeId ?? "";
      const picture = villainPicture(scenarioId);
      const image = drawPicture(this, picture, rect, () => this.#draw(), { focusY: 0.3 });
      if (!image) artNote(this, rect, `Panel art: ${this.#story?.villain ?? "villain"}`);
    } else {
      const picture = heroPicture(art.identityId);
      const image = drawPicture(this, picture, rect, () => this.#draw(), { focusY: 0.15 });
      if (!image) artNote(this, rect, "Panel art: hero");
    }
  }
}
