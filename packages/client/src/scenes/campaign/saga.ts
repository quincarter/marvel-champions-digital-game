/**
 * C00b — The Saga: the campaign shelf. One featured volume (art, status, its own CTA) plus a 3×3 "ALL VOLUMES"
 * grid — desktop/tablet — or a scrolling list — phone — of all nine boxes in release order (`SAGA_VOLUMES`).
 *
 * Matches the current design canvas (`Marvel Champions game screens/Campaign - *.dc.html`'s `saga()`): the grid
 * includes the featured volume itself (its own tile, ringed red), not just what's "next"; status drives every
 * chip's colour (done green, live red, fresh yellow, sealed an outline); a sealed tile dims under a dark scrim.
 *
 * All data — status, unlock, pips, roster names — comes from `view/campaign-saga-model.ts`; this scene only lays
 * it out and wires taps. Tapping any volume (grid tile, phone row) re-features it; nothing here computes legality
 * or unlock itself.
 */
import Phaser from "phaser";
import { CAMPAIGN_RECORDS } from "../../campaign/campaign-service.js";
import { CARDS_BY_ID } from "../../content/pool.js";
import { ink, signal, surface, typeRole } from "../../tokens.js";
import {
  bangers,
  campaignFrame,
  drawActionBar,
  drawPicture,
  drawTopBar,
  issuePips,
  campaignCoverPicture,
  villainPicture,
} from "../../ui/campaign-chrome.js";
import { campaignActionButton, campaignTile, type CampaignTileStatus } from "../../ui/campaign-buttons-a.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { McVirtualList } from "../../ui/virtual-list.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { campaignService } from "../../session.js";
import {
  campaignSagaRows,
  defaultFeaturedVolume,
  doneVolumeCount,
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

/** A volume's art: the box's own cover (`art/campaigns/<id>/cover.*`) when it has one, as the Cover screen uses, else its final villain. */
const volumeArtOf = (campaignId: string) =>
  campaignCoverPicture(campaignId) ?? villainPicture(finalScenarioIdOf(campaignId));

/** A box's own final scenario (its `Campaign.scenarioIds`' last entry) — the villain art `villainPicture` keys on. */
const finalScenarioIdOf = (campaignId: string): string =>
  (CAMPAIGN_RECORDS[campaignId]?.scenarioIds.at(-1) as string | undefined) ?? campaignId;

export class CampaignSagaScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  #rows: readonly SagaVolumeRow[] = [];
  #featured = 1;
  #confirmAbandon = false;
  #listScroll = new ListScroll();
  #phoneList: McVirtualList | null = null;

  constructor() {
    super(SCENES.campaignSaga);
  }

  create(_data: CampaignSagaData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#rebuild, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.#rebuild, this));
    this.#route = new FocusRoute(this, {
      onCancel: () => goToScreen(this, SCENES.title),
      onPage: (direction) => this.#phoneList?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#phoneList?.scrollToStart() : this.#phoneList?.scrollToEnd()),
    });
    this.#rows = [];
    this.#confirmAbandon = false;
    this.#listScroll.reset();
    this.#phoneList = null;
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
    this.#phoneList?.destroy();
    this.#phoneList = null;
    destroyChildren(this);
    this.#stops = new Map();
    if (this.#rows.length === 0) return;

    const frame = campaignFrame(this);
    const top = drawTopBar(this, {
      backLabel: frame.phone ? "◂" : "◂ Title",
      onBack: () => goToScreen(this, SCENES.title),
      title: "The saga",
      right: `${doneVolumeCount(this.#rows)} OF 9 COMPLETE · ${openVolumeCount(this.#rows)} OPEN`,
    });
    if (top.backRect) this.#stops.set("back", { rect: top.backRect, activate: () => goToScreen(this, SCENES.title) });

    const row = this.#rows.find((r) => r.volume.number === this.#featured) ?? this.#rows[0]!;

    if (frame.phone) this.#drawPhone(frame, top.height, row);
    else this.#drawWide(frame, top.height, row);

    const order = ["back", ...[...this.#stops.keys()].filter((k) => k !== "back")];
    this.#route?.set(order, this.#stops);
  }

  #feature(number: number): void {
    if (this.#featured === number) return;
    this.#featured = number;
    this.#confirmAbandon = false;
    this.#rebuild();
  }

  // ---- Wide (desktop/tablet): featured card left, 3×3 "ALL VOLUMES" grid right ----------------------------------

  #drawWide(frame: ReturnType<typeof campaignFrame>, topHeight: number, row: SagaVolumeRow): void {
    const gutter = frame.gutter;
    const cardWidth = Math.round(((frame.width - gutter * 3) * 1) / 2.6);
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
      .text(gridX, y, "ALL VOLUMES", textStyle({ ...typeRole.barTitle, size: 18 }, surface.ink.hex))
      .setLetterSpacing(0.6);
    this.add.rectangle(gridX + 150, y + 11, gridWidth - 150, 3, surface.ink.hex).setOrigin(0, 0.5);
    y += 32;

    const cols = 3;
    const rows = 3;
    const gap = 14;
    const tileWidth = (gridWidth - gap * (cols - 1)) / cols;
    const footnoteHeight = 34;
    const tileHeight = (frame.height - y - gutter - gap * (rows - 1) - footnoteHeight) / rows;
    this.#rows.forEach((tileRow, index) => {
      const col = index % cols;
      const line = Math.floor(index / cols);
      const rect: Rect = {
        x: gridX + col * (tileWidth + gap),
        y: y + line * (tileHeight + gap),
        width: tileWidth,
        height: tileHeight,
      };
      this.#drawGridTile(tileRow, rect);
    });

    const footnoteY = y + rows * tileHeight + (rows - 1) * gap + 12;
    this.add.text(gridX, footnoteY, SAGA_NOTE, {
      ...textStyle(typeRole.label, surface.ink.hex, ink.meta),
      wordWrap: { width: gridWidth, useAdvancedWrap: true },
    });
  }

  #drawGridTile(tileRow: SagaVolumeRow, rect: Rect): void {
    const art = volumeArtOf(tileRow.volume.campaignId);
    const { objects, zone } = campaignTile(this, {
      rect,
      eyebrow: tileRow.volume.boxCode,
      title: `Vol. ${tileRow.volume.number}`,
      subtitle: tileRow.volume.name,
      chip: this.#gridChip(tileRow),
      status: tileRow.status,
      art,
      onArtReady: () => this.#rebuild(),
      selected: tileRow.volume.number === this.#featured,
      onClick: () => this.#feature(tileRow.volume.number),
    });
    void objects;
    void zone;
    this.#stops.set(`vol-${tileRow.volume.number}`, { rect, activate: () => this.#feature(tileRow.volume.number) });
  }

  /** The grid tile's own status chip — the honest "not in this build yet" only when it's what's actually true. */
  #gridChip(row: SagaVolumeRow): string {
    switch (row.status) {
      case "done":
        return "✓ Complete";
      case "live":
        return row.issueNumber !== null ? `Issue ${row.issueNumber} of ${row.totalIssues}` : "In progress";
      case "fresh":
        return "Open";
      case "sealed":
      default:
        return row.lockReason ?? "Sealed";
    }
  }

  // ---- Phone: featured card, then a scrolling "ALL VOLUMES" list, then a bottom CTA -----------------------------

  #drawPhone(frame: ReturnType<typeof campaignFrame>, topHeight: number, row: SagaVolumeRow): void {
    const gutter = frame.gutter;
    const cardHeight = Math.min(400, frame.height * 0.46);
    const cardRect: Rect = { x: gutter, y: topHeight + gutter, width: frame.width - gutter * 2, height: cardHeight };
    this.#drawFeaturedCard(cardRect, row, true);

    let y = cardRect.y + cardRect.height + 18;
    this.add
      .text(gutter, y, "ALL VOLUMES", textStyle({ ...typeRole.barTitle, size: 14 }, surface.ink.hex))
      .setLetterSpacing(0.6);
    this.add.rectangle(gutter + 110, y + 9, frame.width - gutter * 2 - 110, 3, surface.ink.hex).setOrigin(0, 0.5);
    y += 24;

    const actionBar = drawActionBar(this);
    const listRect: Rect = { x: gutter, y, width: frame.width - gutter * 2, height: actionBar.y - y - 10 };
    const rowHeight = 58;
    this.#phoneList = new McVirtualList(this, {
      rect: listRect,
      rowHeight,
      count: this.#rows.length,
      scroll: this.#listScroll,
      background: false,
      renderRow: (index, rect) => this.#drawPhoneVolumeRow(this.#rows[index]!, rect),
      onRowActivate: (index) => this.#feature(this.#rows[index]!.volume.number),
    });

    const ctaRect: Rect = {
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

  #drawPhoneVolumeRow(row: SagaVolumeRow, rect: Rect): { objects: readonly Phaser.GameObjects.GameObject[] } {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const rowRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height - 6 };
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rowRect.x, rowRect.y, rowRect.width, rowRect.height);
    g.lineStyle(3, surface.ink.hex, 1).strokeRect(
      rowRect.x + 1.5,
      rowRect.y + 1.5,
      rowRect.width - 3,
      rowRect.height - 3,
    );
    objects.push(g);

    const blockW = 58;
    const numberBg = this.add.graphics();
    numberBg.fillStyle(surface.ink.hex, 1).fillRect(rowRect.x, rowRect.y, blockW, rowRect.height);
    objects.push(numberBg);
    const number = this.add
      .text(rowRect.x + blockW / 2, rowRect.y + rowRect.height / 2, `VOL.\n${row.volume.number}`, {
        ...textStyle(bangers(15, 1), surface.paper.hex),
        align: "center",
      })
      .setOrigin(0.5, 0.5);
    objects.push(number);

    const name = this.add.text(rowRect.x + blockW + 10, rowRect.y + 6, row.volume.name.toUpperCase(), {
      ...textStyle(bangers(16, 1), surface.ink.hex),
      wordWrap: { width: rowRect.width - blockW - 24, useAdvancedWrap: true },
    });
    objects.push(name);
    const meta = this.add.text(rowRect.x + blockW + 10, rowRect.y + rowRect.height - 18, row.volume.boxCode, {
      ...textStyle(typeRole.label, surface.ink.hex, ink.meta),
      fontSize: "9px",
    });
    objects.push(meta);

    const chip = this.#gridChip(row);
    const chipColors: Readonly<Record<CampaignTileStatus, { fill: number | null; text: number }>> = {
      done: { fill: signal.heal.hex, text: surface.paper.hex },
      live: { fill: 0xc8102e, text: surface.paper.hex },
      fresh: { fill: signal.caution.hex, text: surface.ink.hex },
      sealed: { fill: null, text: surface.ink.hex },
    };
    const colors = chipColors[row.status];
    const chipLabel = this.add
      .text(0, 0, chip.toUpperCase(), textStyle(typeRole.label, colors.text, 1))
      .setLetterSpacing(0.6)
      .setFontSize(9);
    const chipRect: Rect = {
      x: rowRect.x + rowRect.width - 10 - chipLabel.width - 12,
      y: rowRect.y + rowRect.height / 2 - 10,
      width: chipLabel.width + 12,
      height: 20,
    };
    const chipBg = this.add.graphics();
    if (colors.fill !== null)
      chipBg.fillStyle(colors.fill, 1).fillRect(chipRect.x, chipRect.y, chipRect.width, chipRect.height);
    else
      chipBg
        .lineStyle(1.5, surface.ink.hex, 0.45)
        .strokeRect(chipRect.x + 0.75, chipRect.y + 0.75, chipRect.width - 1.5, chipRect.height - 1.5);
    chipLabel.setPosition(chipRect.x + 6, chipRect.y + chipRect.height / 2).setOrigin(0, 0.5);
    objects.push(chipBg, chipLabel);

    if (row.status === "sealed") {
      const dim = this.add
        .rectangle(rowRect.x, rowRect.y, rowRect.width, rowRect.height, surface.paper.hex, 0.45)
        .setOrigin(0, 0);
      objects.push(dim);
    }
    if (row.volume.number === this.#featured) {
      const ring = this.add.graphics();
      ring.lineStyle(3, 0xc8102e, 1).strokeRect(rowRect.x, rowRect.y, rowRect.width, rowRect.height);
      objects.push(ring);
    }
    return { objects };
  }

  // ---- The featured card: art (or a glyph), status line, name, pips, sub, CTA, alt row --------------------------

  #drawFeaturedCard(rect: Rect, row: SagaVolumeRow, phone: boolean): void {
    const border = this.add.graphics();
    border.lineStyle(6, 0xc8102e, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    border.lineStyle(3, surface.ink.hex, 1).strokeRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6);
    const copy = this.#featuredCopy(row);
    const footerHeight = Math.min(rect.height * 0.5, phone ? 210 : 270);
    const artRect: Rect = {
      x: rect.x + 3,
      y: rect.y + 3,
      width: rect.width - 6,
      height: rect.height - 6 - footerHeight,
    };
    const footerRect: Rect = {
      x: rect.x + 3,
      y: artRect.y + artRect.height,
      width: rect.width - 6,
      height: footerHeight,
    };

    this.#drawFeaturedArt(artRect, row);

    // "VOL. N" tab
    const tab = this.add.text(0, 0, `VOL. ${row.volume.number}`, textStyle(bangers(18, 1), surface.ink.hex));
    const tabBg = this.add.graphics();
    tabBg.fillStyle(signal.caution.hex, 1).fillRect(artRect.x, artRect.y, tab.width + 20, tab.height + 12);
    tab.setPosition(artRect.x + 10, artRect.y + 6);
    this.children.bringToTop(tab);
    if (row.status === "done") {
      const stamp = this.add
        .text(0, 0, "COMPLETE", textStyle(bangers(phone ? 18 : 26, 1), signal.heal.hex))
        .setRotation(0.14);
      const stampBg = this.add.graphics();
      stampBg
        .fillStyle(surface.card.hex, 0.94)
        .fillRoundedRect(-stamp.width / 2 - 10, -stamp.height / 2 - 4, stamp.width + 20, stamp.height + 8, 4);
      stampBg
        .lineStyle(4, signal.heal.hex, 1)
        .strokeRoundedRect(-stamp.width / 2 - 10, -stamp.height / 2 - 4, stamp.width + 20, stamp.height + 8, 4);
      const stampContainer = this.add.container(artRect.x + artRect.width - 60, artRect.y + 34, [stampBg, stamp]);
      stampContainer.setRotation(0.14);
      stamp.setPosition(-stamp.width / 2, -stamp.height / 2);
      stampBg.setPosition(0, 0);
    }

    const footerBg = this.add.graphics();
    footerBg.fillStyle(surface.ink.hex, 1).fillRect(footerRect.x, footerRect.y, footerRect.width, footerRect.height);

    const pad = phone ? 12 : 18;
    let y = footerRect.y + (phone ? 10 : 16);
    this.add
      .text(
        footerRect.x + pad,
        y,
        `${copy.status} · ${row.volume.boxCode}`.toUpperCase(),
        textStyle(typeRole.label, signal.caution.hex, 1),
      )
      .setLetterSpacing(1);
    if (copy.right) {
      this.add
        .text(
          footerRect.x + footerRect.width - pad,
          y,
          copy.right.toUpperCase(),
          textStyle(typeRole.label, surface.paper.hex, ink.meta),
        )
        .setOrigin(1, 0)
        .setLetterSpacing(1);
    }
    y += 18;

    const name = this.add.text(footerRect.x + pad, y, row.volume.name.toUpperCase(), {
      ...textStyle(bangers(phone ? 28 : 44, 0.92), surface.paper.hex),
      wordWrap: { width: footerRect.width - pad * 2, useAdvancedWrap: true },
    });
    y += name.height + 9;

    if (copy.hasPips) {
      const pipsRect: Rect = { x: footerRect.x + pad, y, width: footerRect.width - pad * 2, height: phone ? 7 : 8 };
      issuePips(this, pipsRect, row.pips, true);
      y += phone ? 15 : 18;
    }

    const subText = this.add.text(footerRect.x + pad, y, copy.sub, {
      ...textStyle(typeRole.emphasis, surface.paper.hex, ink.secondary),
      fontSize: phone ? "11px" : "12px",
      wordWrap: { width: footerRect.width - pad * 2, useAdvancedWrap: true },
    });
    y += subText.height + (phone ? 8 : 10);

    // Phone draws this screen's one CTA in the bottom action bar instead (`#drawPhone`) — the card itself keeps
    // going below the sub line (DOSSIER/START OVER + footnote, or nothing at all), matching the phone composition.
    if (!phone) {
      const ctaHeight = 58;
      const ctaRect: Rect = { x: footerRect.x + pad, y, width: footerRect.width - pad * 2, height: ctaHeight };
      const cta = this.#ctaFor(row);
      campaignActionButton(this, {
        kind: "primary",
        rect: ctaRect,
        title: cta.label,
        enabled: cta.enabled,
        ...(cta.reason !== undefined ? { reason: cta.reason } : {}),
        onClick: cta.onClick,
        titleSize: 21,
      });
      this.#stops.set("cta", { rect: ctaRect, activate: cta.onClick });
      y += ctaHeight + 8;
    }

    if (copy.hasAlt) {
      const altHeight = phone ? 40 : 48;
      const altWidth = (footerRect.width - pad * 2 - 8) / 2;
      copy.alt.forEach((action, index) => {
        const altRect: Rect = { x: footerRect.x + pad + index * (altWidth + 8), y, width: altWidth, height: altHeight };
        campaignActionButton(this, {
          kind: "onInk",
          rect: altRect,
          title: action.label,
          enabled: action.enabled,
          onClick: action.onClick,
          titleSize: phone ? 15 : 19,
        });
        this.#stops.set(`alt-${index}`, { rect: altRect, activate: action.onClick });
      });
      y += altHeight + 6;
      if (copy.foot) {
        this.add.text(footerRect.x + pad, y, copy.foot, {
          ...textStyle(typeRole.label, surface.paper.hex, ink.meta),
          fontSize: phone ? "9.5px" : "10.5px",
          wordWrap: { width: footerRect.width - pad * 2, useAdvancedWrap: true },
        });
      }
    }
  }

  #drawFeaturedArt(rect: Rect, row: SagaVolumeRow): void {
    const picture = volumeArtOf(row.volume.campaignId);
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

  // ---- Featured-card copy per status — pure string composition over one row, no navigation here -----------------

  #featuredCopy(row: SagaVolumeRow): {
    readonly status: string;
    readonly right: string;
    readonly sub: string;
    readonly hasPips: boolean;
    readonly hasAlt: boolean;
    readonly alt: readonly { label: string; enabled: boolean; onClick: () => void }[];
    readonly foot: string;
  } {
    const n = row.volume.number;
    switch (row.status) {
      case "done":
        return {
          status: "Complete",
          right: `Standard ${row.wonStandard ? "✓" : "○"} · Expert ${row.wonExpert ? "✓" : "○"}`,
          sub: `${row.rosterNames.join(" · ")} · ${row.totalIssues} issues`,
          hasPips: true,
          hasAlt: true,
          alt: this.#altActionsFor(row),
          foot: "A new run gets its own log. The finished one stays on the shelf to reread.",
        };
      case "live":
        return {
          status: "In progress",
          right: row.issueNumber !== null ? `Issue ${row.issueNumber} of ${row.totalIssues}` : "",
          sub: row.rosterNames.join(" · "),
          hasPips: true,
          hasAlt: true,
          alt: this.#altActionsFor(row),
          foot: "Starting over archives this run; it doesn't delete it.",
        };
      case "fresh":
        return {
          status: "Open",
          right: "Not started",
          sub: "Sign a new roster. Any hero can sign, including ones who finished an earlier volume.",
          hasPips: false,
          hasAlt: false,
          alt: [],
          foot: "",
        };
      case "sealed":
      default:
        return {
          status: "Sealed",
          right: "",
          sub: row.lockReason
            ? `This build doesn't ship Vol. ${n} yet.`
            : `Win Vol. ${n - 1} on Standard to open it. Its villains stay hidden until then.`,
          hasPips: false,
          hasAlt: false,
          alt: [],
          foot: "",
        };
    }
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
