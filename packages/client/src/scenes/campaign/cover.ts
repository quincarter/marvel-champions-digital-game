/**
 * C01 — Campaign cover: the box's own cover page. Full-bleed villain art, the box's pitch, the roster and issue
 * progress, and the one CTA that reads the next issue (or signs the roster, for a fresh volume).
 *
 * All status/unlock/pips/labels come from `view/campaign-cover-model.ts`; this scene lays it out and wires taps.
 */
import Phaser from "phaser";
import { CAMPAIGN_RECORDS } from "../../campaign/campaign-service.js";
import { campaignDefinitionOf } from "@mc/cards";
import { CARDS_BY_ID } from "../../content/pool.js";
import { ink, surface, typeRole } from "../../tokens.js";
import { bangers, campaignFrame, drawPicture, issuePips, villainPicture } from "../../ui/campaign-chrome.js";
import { campaignActionButton } from "../../ui/campaign-buttons-a.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { McButton } from "../../ui/widgets.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { campaignService } from "../../session.js";
import { coverModelOf, type CoverModel } from "../../view/campaign-cover-model.js";
import { wonStandardOf } from "../../view/campaign-saga-model.js";
import type { Rect } from "../../view/layout.js";
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignCoverData } from "./routes.js";

const identityNameOf = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;

export class CampaignCoverScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  #model: CoverModel | null = null;
  #campaignId = "";
  #runId: string | null = null;

  constructor() {
    super(SCENES.campaignCover);
  }

  create(data: CampaignCoverData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
    this.scale.on("resize", this.#rebuild, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.#rebuild, this));
    this.#route = new FocusRoute(this, { onCancel: () => goToScreen(this, SCENES.campaignSaga) });
    this.#campaignId = data.campaignId;
    this.#runId = data.runId ?? null;
    this.#model = null;
    void this.#load();
    fadeScreenIn(this);
  }

  async #load(): Promise<void> {
    const [record, summaries] = await Promise.all([
      this.#runId ? campaignService().load(this.#runId) : Promise.resolve<CampaignRecord | null>(null),
      campaignService().storage.list(),
    ]);
    if (!this.sys.isActive()) return;
    const content = CAMPAIGN_RECORDS[this.#campaignId];
    const definition = campaignDefinitionOf(this.#campaignId);
    this.#model = coverModelOf({
      campaignId: this.#campaignId,
      boxCode: content?.boxCode ?? "",
      name: content?.name ?? this.#campaignId,
      record,
      definition,
      expertUnlocked: wonStandardOf(this.#campaignId, summaries),
      identityNameOf,
    });
    this.#rebuild();
  }

  #rebuild(): void {
    destroyChildren(this);
    this.#stops = new Map();
    const model = this.#model;
    if (!model) return;

    const frame = campaignFrame(this);
    if (frame.phone) this.#drawPhone(frame, model);
    else this.#drawWide(frame, model);

    const order = ["back", "cta", "dossier", "issues", "expert"].filter((key) => this.#stops.has(key));
    this.#route?.set(order, this.#stops);
  }

  #back(): void {
    goToScreen(this, SCENES.campaignSaga);
  }

  #drawBack(x: number, y: number): void {
    const rect: Rect = { x, y, width: 84, height: 38 };
    const button = new McButton(this, {
      kind: "onInk",
      label: "◂ Saga",
      type: typeRole.backLabel,
      rect,
      onClick: () => this.#back(),
    });
    void button;
    this.#stops.set("back", { rect, activate: () => this.#back() });
  }

  #drawTag(x: number, bottomY: number): void {
    const label = this.add
      .text(0, 0, "A story in five issues", textStyle({ ...typeRole.emphasis, size: 12 }, surface.ink.hex))
      .setLetterSpacing(0.5);
    const rect: Rect = { x, y: bottomY - 26, width: label.width + 20, height: 26 };
    const bg = this.add.graphics();
    bg.fillStyle(0xf2b01e, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    label.setPosition(rect.x + 10, rect.y + 6);
    this.children.bringToTop(label);
    this.add.container(0, 0, [bg, label]).setRotation(-0.035);
  }

  // ---- Wide (desktop/tablet): art left, ink panel right ---------------------------------------------------------

  #drawWide(frame: ReturnType<typeof campaignFrame>, model: CoverModel): void {
    const artWidth = Math.round(frame.width * 0.53);
    const artRect: Rect = { x: 0, y: 0, width: artWidth, height: frame.height };
    this.#drawArt(artRect, model);
    this.#drawBack(16, 16);
    this.#drawTag(24, frame.height - 24);

    const panelRect: Rect = { x: artWidth, y: 0, width: frame.width - artWidth, height: frame.height };
    this.add.rectangle(panelRect.x, panelRect.y, panelRect.width, panelRect.height, surface.ink.hex).setOrigin(0, 0);

    const pad = 36;
    let y = pad;
    const chipLabel = this.add
      .text(0, 0, `${model.boxCode} · Campaign box`.toUpperCase(), textStyle(typeRole.label, surface.paper.hex, 1))
      .setLetterSpacing(1);
    const chipRect: Rect = { x: panelRect.x + pad, y, width: chipLabel.width + 20, height: 26 };
    const chipBg = this.add.graphics();
    chipBg
      .lineStyle(1.5, surface.paper.hex, 1)
      .strokeRect(chipRect.x + 0.5, chipRect.y + 0.5, chipRect.width - 1, chipRect.height - 1);
    chipLabel.setPosition(chipRect.x + 10, chipRect.y + 6);
    y += 54;

    const title = this.add.text(panelRect.x + pad, y, model.name.toUpperCase(), {
      ...textStyle(bangers(48, 0.86), surface.paper.hex),
      wordWrap: { width: panelRect.width - pad * 2, useAdvancedWrap: true },
    });
    y += title.height + 18;

    this.add.text(panelRect.x + pad, y, model.blurb, {
      ...textStyle(typeRole.body, surface.paper.hex, ink.secondary),
      fontSize: "13px",
      wordWrap: { width: panelRect.width - pad * 2, useAdvancedWrap: true },
    });

    this.#drawBottomBlock(panelRect, pad, model);
  }

  // ---- Phone: art top half with title over it, panel below --------------------------------------------------

  #drawPhone(frame: ReturnType<typeof campaignFrame>, model: CoverModel): void {
    const artHeight = Math.round(frame.height * 0.42);
    const artRect: Rect = { x: 0, y: 0, width: frame.width, height: artHeight };
    this.#drawArt(artRect, model);
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.ink.hex, 0.55).fillRect(artRect.x, artRect.y + artRect.height - 120, artRect.width, 120);
    void scrim;
    this.#drawBack(16, 16);

    const chip = this.add
      .text(0, 0, `${model.boxCode} · Campaign box`.toUpperCase(), textStyle(typeRole.label, surface.paper.hex, 1))
      .setLetterSpacing(1);
    const chipRect: Rect = { x: frame.width - 16 - chip.width - 20, y: 16, width: chip.width + 20, height: 26 };
    const chipBg = this.add.graphics();
    chipBg
      .lineStyle(1.5, surface.paper.hex, 1)
      .strokeRect(chipRect.x + 0.5, chipRect.y + 0.5, chipRect.width - 1, chipRect.height - 1);
    chip.setPosition(chipRect.x + 10, chipRect.y + 6);

    this.#drawTag(16, artHeight - 46);
    const title = this.add.text(16, artHeight - 16, model.name.toUpperCase(), {
      ...textStyle(bangers(26, 0.86), surface.paper.hex),
      wordWrap: { width: frame.width - 32, useAdvancedWrap: true },
    });
    title.setY(artHeight - 16 - title.height);

    const panelRect: Rect = { x: 0, y: artHeight, width: frame.width, height: frame.height - artHeight };
    this.add.rectangle(panelRect.x, panelRect.y, panelRect.width, panelRect.height, surface.ink.hex).setOrigin(0, 0);

    const pad = 16;
    const blurb = this.add.text(pad, panelRect.y + 14, model.blurb, {
      ...textStyle(typeRole.body, surface.paper.hex, ink.secondary),
      fontSize: "12px",
      wordWrap: { width: frame.width - pad * 2, useAdvancedWrap: true },
    });
    void blurb;

    this.#drawBottomBlock(panelRect, pad, model);
  }

  #drawArt(rect: Rect, model: CoverModel): void {
    const picture = villainPicture(model.villainScenarioId);
    if (picture) {
      drawPicture(this, picture, rect, () => this.#rebuild(), { focusY: 0.1 });
      return;
    }
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  // ---- The bottom block: roster/issue, pips, CTA, Dossier/Issues, Expert Campaign — anchored to the panel's own bottom.

  #drawBottomBlock(panelRect: Rect, pad: number, model: CoverModel): void {
    const width = panelRect.width - pad * 2;
    const x = panelRect.x + pad;
    let y = panelRect.y + panelRect.height - pad;

    // Laid out bottom-up so it always sits flush with the panel's bottom edge regardless of blurb length above it.
    y -= 52;
    const expertRect: Rect = { x, y, width, height: 52 };
    campaignActionButton(this, {
      kind: "secondary",
      rect: expertRect,
      title: "Expert campaign",
      subtitle: model.expertUnlocked ? "Ready to sign" : "Finish standard to unlock",
      chevron: model.expertUnlocked,
      enabled: model.expertUnlocked,
      onClick: () => goToScreen(this, SCENES.campaignRoster, { campaignId: model.campaignId, expertCampaign: true }),
      titleSize: 15,
    });
    this.#stops.set("expert", {
      rect: expertRect,
      activate: () => goToScreen(this, SCENES.campaignRoster, { campaignId: model.campaignId, expertCampaign: true }),
    });
    y -= 10;

    if (model.hasRun) {
      y -= 64;
      const halfWidth = (width - 12) / 2;
      const dossierRect: Rect = { x, y, width: halfWidth, height: 64 };
      const issuesRect: Rect = { x: x + halfWidth + 12, y, width: halfWidth, height: 64 };
      campaignActionButton(this, {
        kind: "secondary",
        rect: dossierRect,
        title: "Dossier ▸",
        subtitle: "Campaign log · heroes & world",
        enabled: model.canOpenDossier,
        onClick: () => goToScreen(this, SCENES.campaignDossier, { runId: this.#runId }),
        titleSize: 15,
      });
      this.#stops.set("dossier", {
        rect: dossierRect,
        activate: () => goToScreen(this, SCENES.campaignDossier, { runId: this.#runId }),
      });
      campaignActionButton(this, {
        kind: "secondary",
        rect: issuesRect,
        title: "Issues ▸",
        subtitle: "All 5 issues · reread",
        enabled: model.canOpenRun,
        onClick: () => goToScreen(this, SCENES.campaignRun, { runId: this.#runId }),
        titleSize: 15,
      });
      this.#stops.set("issues", {
        rect: issuesRect,
        activate: () => goToScreen(this, SCENES.campaignRun, { runId: this.#runId }),
      });
      y -= 10;
    }

    y -= 62;
    const ctaRect: Rect = { x, y, width, height: 62 };
    const cta = this.#ctaFor(model);
    campaignActionButton(this, {
      kind: "primary",
      rect: ctaRect,
      title: cta.title,
      ...(cta.subtitle !== undefined ? { subtitle: cta.subtitle } : {}),
      chevron: cta.enabled,
      enabled: cta.enabled,
      onClick: cta.onClick,
      titleSize: 18,
    });
    this.#stops.set("cta", { rect: ctaRect, activate: cta.onClick });
    y -= 14;

    if (model.hasRun && model.pips.length > 0) {
      y -= 8;
      const pipsRect: Rect = { x, y, width, height: 8 };
      issuePips(this, pipsRect, model.pips, true);
      y -= 8;

      const rosterLine = model.rosterNames.join(" · ");
      this.add.text(x, y - 16, rosterLine, textStyle(typeRole.emphasis, surface.paper.hex, ink.secondary));
      if (model.issueNumber !== null) {
        this.add
          .text(
            x + width,
            y - 16,
            `Issue ${model.issueNumber} of ${model.totalIssues}`.toUpperCase(),
            textStyle(typeRole.label, surface.paper.hex, ink.meta),
          )
          .setOrigin(1, 0)
          .setLetterSpacing(1);
      }
    }
  }

  #ctaFor(model: CoverModel): { title: string; subtitle?: string; enabled: boolean; onClick: () => void } {
    if (!model.hasRun) {
      return {
        title: "Sign the roster",
        enabled: true,
        onClick: () => goToScreen(this, SCENES.campaignRoster, { campaignId: model.campaignId }),
      };
    }
    if (model.canReadIssue && model.issueNumber !== null) {
      const subtitle =
        model.nextIssueVillain && model.nextIssueTitle
          ? `${model.nextIssueVillain} · "${model.nextIssueTitle}"`
          : undefined;
      return {
        title: `Read issue #${model.issueNumber}`,
        ...(subtitle !== undefined ? { subtitle } : {}),
        enabled: true,
        onClick: () => goToScreen(this, SCENES.campaignOpener, { runId: this.#runId }),
      };
    }
    if (model.finished === "won") {
      return {
        title: "Read the finale",
        enabled: true,
        onClick: () => goToScreen(this, SCENES.campaignFinale, { runId: this.#runId }),
      };
    }
    return { title: "Campaign over", enabled: false, onClick: () => {} };
  }
}
