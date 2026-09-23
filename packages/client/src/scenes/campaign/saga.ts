/**
 * C00b — The Saga: the campaign shelf. One featured volume (art, status, its own CTA) plus a grid — desktop/tablet
 * — or a scrolling list — phone — of every other box in release order (`SAGA_VOLUMES`).
 *
 * All data — status, unlock, pips, roster names — comes from `view/campaign-saga-model.ts`; this scene only lays
 * it out and wires taps. Tapping any volume (grid tile, phone row) re-features it; nothing here computes legality
 * or unlock itself.
 */
import Phaser from "phaser";
import { CARDS_BY_ID } from "../../content/pool.js";
import { accent, ink, signal, surface, typeRole } from "../../tokens.js";
import {
  bangers,
  campaignFrame,
  drawActionBar,
  drawTopBar,
  drawPicture,
  issuePips,
  villainPicture,
} from "../../ui/campaign-chrome.js";
import { campaignActionButton, campaignTile } from "../../ui/campaign-buttons-a.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { McVirtualList } from "../../ui/virtual-list.js";
import { dashedRect } from "../../ui/widgets.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { campaignService } from "../../session.js";
import {
  campaignSagaRows,
  defaultFeaturedVolume,
  openVolumeCount,
  type SagaVolumeRow,
} from "../../view/campaign-saga-model.js";
import { SAGA_NOTE } from "../../campaign/story.js";
import type { Rect } from "../../view/layout.js";
import { ListScroll } from "../../view/list-scroll.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignSagaData } from "./routes.js";

const identityNameOf = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;

export class CampaignSagaScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  #rows: readonly SagaVolumeRow[] = [];
  #featured = 1;
  #confirmAbandon = false;
  #listScroll = new ListScroll();

  constructor() {
    super(SCENES.campaignSaga);
  }

  create(_data: CampaignSagaData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#rebuild, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.#rebuild, this));
    this.#route = new FocusRoute(this, { onCancel: () => goToScreen(this, SCENES.title) });
    this.#rows = [];
    this.#confirmAbandon = false;
    this.#listScroll.reset();
    void this.#load();
    fadeScreenIn(this);
  }

  async #load(): Promise<void> {
    const summaries = await campaignService().storage.list();
    if (!this.sys.isActive()) return;
    this.#rows = campaignSagaRows(summaries, { identityNameOf });
    this.#featured = defaultFeaturedVolume(this.#rows);
    this.#rebuild();
  }

  #rebuild(): void {
    destroyChildren(this);
    this.#stops = new Map();
    if (this.#rows.length === 0) return;

    const frame = campaignFrame(this);
    const top = drawTopBar(this, {
      backLabel: frame.phone ? "◂" : "◂ Title",
      onBack: () => goToScreen(this, SCENES.title),
      title: "The saga",
      right: `${openVolumeCount(this.#rows)} OF 9 OPEN`,
    });
    if (top.backRect) this.#stops.set("back", { rect: top.backRect, activate: () => goToScreen(this, SCENES.title) });

    const row = this.#rows.find((r) => r.volume.number === this.#featured) ?? this.#rows[0]!;
    const others = this.#rows.filter((r) => r.volume.number !== row.volume.number);
    const firstSealedNumber = this.#rows.find((r) => r.status === "sealed")?.volume.number ?? null;

    if (frame.phone) this.#drawPhone(frame, top.height, row, others, firstSealedNumber);
    else this.#drawWide(frame, top.height, row, others, firstSealedNumber);

    const order = ["back", ...[...this.#stops.keys()].filter((k) => k !== "back")];
    this.#route?.set(order, this.#stops);
  }

  #feature(number: number): void {
    if (this.#featured === number) return;
    this.#featured = number;
    this.#confirmAbandon = false;
    this.#rebuild();
  }

  // ---- Wide (desktop/tablet): featured card left, grid right --------------------------------------------------

  #drawWide(
    frame: ReturnType<typeof campaignFrame>,
    topHeight: number,
    row: SagaVolumeRow,
    others: readonly SagaVolumeRow[],
    firstSealedNumber: number | null,
  ): void {
    const gutter = frame.gutter;
    const cardWidth = Math.min(524, frame.width * 0.37);
    const cardRect: Rect = {
      x: gutter,
      y: topHeight + gutter,
      width: cardWidth,
      height: frame.height - topHeight - gutter * 2,
    };
    this.#drawFeaturedCard(cardRect, row, false);

    const gridX = cardRect.x + cardRect.width + gutter;
    const gridWidth = frame.width - gridX - gutter;
    let y = topHeight + gutter;
    this.add
      .text(gridX, y, "NEXT IN THE SAGA", textStyle({ ...typeRole.barTitle, size: 15 }, surface.ink.hex))
      .setLetterSpacing(1);
    this.add.rectangle(gridX + 190, y + 9, gridWidth - 190, 2, surface.ink.hex).setOrigin(0, 0.5);
    y += 26;

    const cols = 4;
    const gap = 16;
    const tileWidth = (gridWidth - gap * (cols - 1)) / cols;
    const rows = Math.ceil(others.length / cols);
    const tileHeight = Math.min(210, (frame.height - y - gutter - gap * (rows - 1)) / rows);
    others.forEach((tileRow, index) => {
      const col = index % cols;
      const line = Math.floor(index / cols);
      const rect: Rect = {
        x: gridX + col * (tileWidth + gap),
        y: y + line * (tileHeight + gap),
        width: tileWidth,
        height: tileHeight,
      };
      const highlighted = tileRow.status === "sealed" && tileRow.volume.number === firstSealedNumber;
      const chip =
        tileRow.status === "sealed" ? (highlighted ? (tileRow.lockReason ?? "SEALED") : "SEALED") : tileRow.status;
      const { objects, zone } = campaignTile(this, {
        rect,
        eyebrow: tileRow.volume.boxCode,
        title: `Vol. ${tileRow.volume.number}`,
        subtitle: tileRow.volume.name,
        chip,
        highlighted,
        onClick: () => this.#feature(tileRow.volume.number),
      });
      void objects;
      this.#stops.set(`vol-${tileRow.volume.number}`, {
        rect,
        activate: () => this.#feature(tileRow.volume.number),
      });
      void zone;
    });

    const footnoteY = y + rows * tileHeight + (rows - 1) * gap + 14;
    this.add.text(gridX, footnoteY, SAGA_NOTE, {
      ...textStyle(typeRole.label, surface.ink.hex, ink.meta),
      wordWrap: { width: gridWidth, useAdvancedWrap: true },
    });
  }

  // ---- Phone: featured card, then a scrolling list, then a bottom CTA -------------------------------------------

  #drawPhone(
    frame: ReturnType<typeof campaignFrame>,
    topHeight: number,
    row: SagaVolumeRow,
    others: readonly SagaVolumeRow[],
    firstSealedNumber: number | null,
  ): void {
    const gutter = frame.gutter;
    const cardHeight = Math.min(340, frame.height * 0.42);
    const cardRect: Rect = { x: gutter, y: topHeight + gutter, width: frame.width - gutter * 2, height: cardHeight };
    this.#drawFeaturedCard(cardRect, row, true);

    let y = cardRect.y + cardRect.height + 18;
    this.add
      .text(gutter, y, "NEXT IN THE SAGA", textStyle({ ...typeRole.barTitle, size: 13 }, surface.ink.hex))
      .setLetterSpacing(1);
    this.add.rectangle(gutter + 150, y + 8, frame.width - gutter * 2 - 150, 2, surface.ink.hex).setOrigin(0, 0.5);
    y += 24;

    const actionBar = drawActionBar(this);
    const listRect: Rect = { x: gutter, y, width: frame.width - gutter * 2, height: actionBar.y - y - 10 };
    const rowHeight = 58;
    new McVirtualList(this, {
      rect: listRect,
      rowHeight,
      count: others.length,
      scroll: this.#listScroll,
      background: false,
      renderRow: (index, rect) => this.#drawPhoneVolumeRow(others[index]!, rect, firstSealedNumber),
      onRowActivate: (index) => this.#feature(others[index]!.volume.number),
    });

    const ctaRect = {
      x: actionBar.x + 12,
      y: actionBar.y + 9,
      width: actionBar.width - 24,
      height: actionBar.height - 18,
    };
    const cta = this.#ctaFor(row);
    const button = campaignActionButton(this, {
      kind: "primary",
      rect: ctaRect,
      title: cta.label,
      enabled: cta.enabled,
      ...(cta.reason !== undefined ? { reason: cta.reason } : {}),
      onClick: cta.onClick,
      titleSize: 18,
    });
    void button;
    this.#stops.set("cta", { rect: ctaRect, activate: cta.onClick });
  }

  #drawPhoneVolumeRow(row: SagaVolumeRow, rect: Rect, firstSealedNumber: number | null) {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const highlighted = row.status === "sealed" && row.volume.number === firstSealedNumber;
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height - 6);
    if (highlighted) {
      const border = this.add.graphics();
      dashedRect(border, { x: rect.x, y: rect.y, width: rect.width, height: rect.height - 6 }, 2, accent.heroRed.hex);
      objects.push(border);
    } else {
      g.lineStyle(1.5, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height - 6);
    }
    objects.push(g);

    const blockW = 46;
    const numberBg = this.add.graphics();
    numberBg.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, blockW, rect.height - 6);
    objects.push(numberBg);
    const number = this.add
      .text(rect.x + blockW / 2, rect.y + (rect.height - 6) / 2, `VOL.\n${row.volume.number}`, {
        ...textStyle(bangers(13, 1), surface.paper.hex),
        align: "center",
      })
      .setOrigin(0.5, 0.5);
    objects.push(number);

    const name = this.add.text(rect.x + blockW + 12, rect.y + 8, row.volume.name.toUpperCase(), {
      ...textStyle(bangers(15, 1), surface.ink.hex),
      wordWrap: { width: rect.width - blockW - 24, useAdvancedWrap: true },
    });
    objects.push(name);
    const meta =
      row.status === "sealed" ? (row.lockReason ?? "Sealed") : row.status === "done" ? "Won" : row.status.toUpperCase();
    const metaText = this.add.text(
      rect.x + blockW + 12,
      rect.y + rect.height - 26,
      `${row.volume.boxCode} · ${meta}`,
      textStyle(typeRole.label, surface.ink.hex, ink.meta),
    );
    objects.push(metaText);
    return { objects };
  }

  // ---- The featured card: art (or a glyph), status line, name, pips, roster line, CTA ---------------------------

  #drawFeaturedCard(rect: Rect, row: SagaVolumeRow, phone: boolean): void {
    const border = this.add.graphics();
    border.lineStyle(3, accent.heroRed.hex, 1).strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);
    const footerHeight = Math.min(rect.height * 0.42, phone ? 148 : 250);
    const artRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height - footerHeight };
    const footerRect: Rect = { x: rect.x, y: rect.y + artRect.height, width: rect.width, height: footerHeight };

    this.#drawFeaturedArt(artRect, row);

    // "VOL. N" tab
    const tab = this.add
      .text(0, 0, `VOL. ${row.volume.number}`, textStyle(bangers(18, 1), surface.ink.hex))
      .setPosition(rect.x + 22, rect.y + 22);
    const tabBg = this.add.graphics();
    tabBg.fillStyle(signal.caution.hex, 1).fillRect(rect.x + 12, rect.y + 12, tab.width + 20, tab.height + 12);
    tab.setPosition(rect.x + 22, rect.y + 18);
    this.children.bringToTop(tab);

    const footerBg = this.add.graphics();
    footerBg.fillStyle(surface.ink.hex, 1).fillRect(footerRect.x, footerRect.y, footerRect.width, footerRect.height);

    let y = footerRect.y + 14;
    const statusText =
      row.status === "live"
        ? `IN PROGRESS · ${row.volume.boxCode}`
        : row.status === "done"
          ? `COMPLETE · ${row.volume.boxCode}`
          : row.status === "fresh"
            ? row.volume.boxCode
            : row.volume.boxCode;
    this.add
      .text(footerRect.x + 16, y, statusText.toUpperCase(), textStyle(typeRole.label, surface.paper.hex, ink.meta))
      .setLetterSpacing(1);
    if (row.status === "live" && row.issueNumber !== null) {
      this.add
        .text(
          footerRect.x + footerRect.width - 16,
          y,
          `ISSUE ${row.issueNumber} OF ${row.totalIssues}`,
          textStyle(typeRole.label, surface.paper.hex, ink.meta),
        )
        .setOrigin(1, 0)
        .setLetterSpacing(1);
    }
    y += 18;

    const name = this.add.text(footerRect.x + 16, y, row.volume.name.toUpperCase(), {
      ...textStyle(bangers(phone ? 20 : 26, 0.88), surface.paper.hex),
      wordWrap: { width: footerRect.width - 32, useAdvancedWrap: true },
    });
    y += name.height + 10;

    if (row.status !== "sealed" || row.hasDefinition) {
      const pipsRect: Rect = { x: footerRect.x + 16, y, width: footerRect.width - 32, height: 8 };
      issuePips(this, pipsRect, row.pips, true);
      y += 18;
    }

    const rosterLine = row.rosterNames.length > 0 ? row.rosterNames.join(" · ") : "";
    this.add.text(footerRect.x + 16, y, rosterLine, textStyle(typeRole.emphasis, surface.paper.hex, ink.secondary));
    const standardMark = row.wonStandard ? "✓" : "○";
    const expertMark = row.wonExpert ? "✓" : "○";
    this.add
      .text(
        footerRect.x + footerRect.width - 16,
        y,
        `Standard ${standardMark} · Expert ${expertMark}`,
        textStyle(typeRole.emphasis, surface.paper.hex, ink.secondary),
      )
      .setOrigin(1, 0);
    y += 22;

    // Phone draws this screen's one CTA in the bottom action bar instead (`#drawPhone`) — the card itself stops
    // at the roster/Standard-Expert line there, matching the design's phone composition.
    if (phone) return;

    const ctaHeight = 52;
    const ctaRect: Rect = { x: footerRect.x + 16, y, width: footerRect.width - 32, height: ctaHeight };
    const cta = this.#ctaFor(row);
    campaignActionButton(this, {
      kind: "primary",
      rect: ctaRect,
      title: cta.label,
      enabled: cta.enabled,
      ...(cta.reason !== undefined ? { reason: cta.reason } : {}),
      onClick: cta.onClick,
      titleSize: 18,
    });
    this.#stops.set("cta", { rect: ctaRect, activate: cta.onClick });
    y += ctaHeight + 8;

    const alt = this.#altActionsFor(row);
    if (alt.length > 0 && y + 30 <= footerRect.y + footerRect.height) {
      const altWidth = (footerRect.width - 32 - 8 * (alt.length - 1)) / alt.length;
      alt.forEach((action, index) => {
        const altRect: Rect = { x: footerRect.x + 16 + index * (altWidth + 8), y, width: altWidth, height: 26 };
        campaignActionButton(this, {
          kind: "onInk",
          rect: altRect,
          title: action.label,
          enabled: action.enabled,
          onClick: action.onClick,
          titleSize: 11,
        });
        this.#stops.set(`alt-${index}`, { rect: altRect, activate: action.onClick });
      });
    }
  }

  #drawFeaturedArt(rect: Rect, row: SagaVolumeRow): void {
    const story = row.volume.campaignId === "trors" ? row.volume.campaignId : null;
    void story;
    const scenarioId = row.volume.campaignId; // MC10's own final scenario is looked up below for trors specifically.
    const picture =
      row.volume.campaignId === "trors" ? villainPicture("red-skull") : (villainPicture(scenarioId) ?? null);
    if (picture) {
      const image = drawPicture(this, picture, rect, () => this.#rebuild(), { focusY: 0.15 });
      void image;
      return;
    }
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    const glyph = row.status === "sealed" && !row.hasDefinition ? "?" : `${row.volume.number}`;
    this.add
      .text(rect.x + rect.width / 2, rect.y + rect.height / 2, glyph, {
        ...textStyle(bangers(Math.min(rect.width, rect.height) * 0.5), surface.paper.hex, 0.18),
      })
      .setOrigin(0.5, 0.5);
  }

  // ---- CTA/alt-action resolution — pure decisions over one row, wired to navigation here ------------------------

  #ctaFor(row: SagaVolumeRow): { label: string; enabled: boolean; reason?: string; onClick: () => void } {
    switch (row.status) {
      case "live":
        return {
          label: "Continue ▸",
          enabled: row.canResume,
          ...(row.incompatibleReason ? { reason: row.incompatibleReason } : {}),
          onClick: () =>
            goToScreen(this, SCENES.campaignCover, { campaignId: row.volume.campaignId, runId: row.runId }),
        };
      case "done":
        return {
          label: "Reread the run",
          enabled: row.hasDefinition,
          onClick: () => goToScreen(this, SCENES.campaignRun, { runId: row.runId }),
        };
      case "fresh":
        return {
          label: `Start vol. ${row.volume.number} ▸`,
          enabled: true,
          onClick: () => goToScreen(this, SCENES.campaignCover, { campaignId: row.volume.campaignId }),
        };
      case "sealed":
      default:
        return { label: "Locked", enabled: false, reason: row.lockReason ?? "Sealed", onClick: () => {} };
    }
  }

  #altActionsFor(row: SagaVolumeRow): { label: string; enabled: boolean; onClick: () => void }[] {
    if (row.status === "live") {
      return [
        {
          label: "Dossier",
          enabled: row.hasDefinition,
          onClick: () => goToScreen(this, SCENES.campaignDossier, { runId: row.runId }),
        },
        {
          label: this.#confirmAbandon ? "Tap again to confirm" : "Start over",
          enabled: true,
          onClick: () => this.#startOver(row),
        },
      ];
    }
    if (row.status === "done") {
      const actions: { label: string; enabled: boolean; onClick: () => void }[] = [
        {
          label: "New run",
          enabled: true,
          onClick: () => goToScreen(this, SCENES.campaignRoster, { campaignId: row.volume.campaignId }),
        },
      ];
      if (row.wonStandard) {
        actions.push({
          label: "Expert run ▸",
          enabled: true,
          onClick: () =>
            goToScreen(this, SCENES.campaignRoster, { campaignId: row.volume.campaignId, expertCampaign: true }),
        });
      }
      return actions;
    }
    return [];
  }

  #startOver(row: SagaVolumeRow): void {
    if (!this.#confirmAbandon) {
      this.#confirmAbandon = true;
      this.#rebuild();
      return;
    }
    this.#confirmAbandon = false;
    const runId = row.runId;
    if (!runId) return;
    void campaignService()
      .abandon(runId)
      .then(() => {
        if (this.sys.isActive()) goToScreen(this, SCENES.campaignRoster, { campaignId: row.volume.campaignId });
      });
  }
}
