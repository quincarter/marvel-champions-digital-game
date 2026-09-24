/**
 * Settings ▸ Unlocks: the way around the unlock path (`progression/unlocks.ts`) for a player who doesn't want to
 * play through the campaigns. Champion points up top, one "Unlock everything" switch, then a scrolling list of the
 * campaigns and of every wave (with what opens it) and every hero in it, each campaign and hero with its own switch.
 *
 * Anything that costs points asks first (`scenes/unlock-confirm.ts`, shared with every screen that unlocks), saying what it costs, that it
 * isn't refunded, and how to earn the same thing by play. Switching something off never asks.
 *
 * Launched over Settings (`scenes/settings.ts`), the same ink-and-paper panel shape; ✕ or Escape stops only this
 * overlay, back to Settings. Rows and wording come from `view/unlocks-model.ts`; this scene draws them and saves a
 * choice through `setUnlockPrefs`, which every picker reads the next time it draws.
 */
import Phaser from "phaser";
import { ink, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton, label } from "../ui/widgets.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { overlayPanelLayout } from "../view/overlay-layout.js";
import { toggleRowHeight, type Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { progressionGuideOf } from "../view/progression-guide.js";
import {
  pointsRowOf,
  rowTapOf,
  switchLabel,
  switchToggleable,
  tapOf,
  unlockAllRowOf,
  unlockListRowsOf,
  type UnlockListRow,
  type UnlockTap,
} from "../view/unlocks-model.js";
import { askToUnlock } from "./unlock-confirm.js";
import { setUnlockPrefs, unlocks } from "../progression/progression.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";

const HEADER_HEIGHT = 60;
const ROW_HEIGHT = 48;
const PILL_WIDTH = 84;
const PILL_HEIGHT = 28;
/** Room at each row's right edge for the list's own scrollbar. */
const GUTTER = 14;

export class UnlocksOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  /** Showing "How it works" (`view/progression-guide.ts`) in place of the switches. */
  #guide = false;
  #guideRegion: McScrollRegion | null = null;
  readonly #guideScroll = new VariableListScroll();
  readonly #scroll = new ListScroll();

  constructor() {
    super(SCENES.unlocks);
  }

  create(): void {
    this.#motion = new OverlayMotion();
    this.#guide = false;
    this.#scroll.reset();
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.unlockConfirm),
      onCancel: () => (this.#guide ? this.#showGuide(false) : this.#close()),
      onPage: (direction) => {
        if (this.#guide) this.#guideRegion?.scrollByPx(direction * 240);
        else this.#list?.scrollByPage(direction);
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#list = null;
    });
    this.#draw();
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #apply(tap: UnlockTap): void {
    if (!tap) return;
    if (tap.kind === "apply") setUnlockPrefs(tap.prefs);
    else askToUnlock(this, tap.confirm.target, () => this.#draw());
    this.#draw();
  }

  #showGuide(on: boolean): void {
    this.#guide = on;
    this.#guideScroll.reset();
    this.#draw();
  }

  #toggleAll(): void {
    const current = unlocks();
    this.#apply(tapOf(current, { kind: "everything" }, current.prefs.unlockAll));
  }

  #tap(row: UnlockListRow): void {
    this.#apply(rowTapOf(unlocks(), row));
  }

  #draw(): void {
    if (this.#motion.leaving) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#list?.destroy();
    this.#list = null;
    this.#guideRegion?.destroy();
    this.#guideRegion = null;
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const { panel, header, body } = overlayPanelLayout({ x: 0, y: 0, width, height }, HEADER_HEIGHT, 0);
    const current = unlocks();
    const pointsRow = pointsRowOf(current);
    const allRow = unlockAllRowOf(current);
    const rows = unlockListRowsOf(current);

    // Swallows every tap that lands on no control of this overlay's own — the list's rows are tapped through
    // scene-level pointer events, which would otherwise also reach Settings, Pause or the Board underneath.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const panelsFrom = this.children.list.length;
    const ground = this.add.graphics();
    ground.fillStyle(surface.ink.hex, 1).fillRect(panel.x, panel.y, panel.width, panel.height);
    ground.lineStyle(4, surface.paper.hex, 1).strokeRect(panel.x, panel.y, panel.width, panel.height);
    ground.fillStyle(surface.paper.hex, 0.4).fillRect(header.x, header.y + header.height - 2, header.width, 2);

    const stops = new Map<string, FocusStop>();
    const closeSize = 32;
    const closeRect: Rect = {
      x: header.x + header.width - closeSize - 16,
      y: header.y + (header.height - closeSize) / 2,
      width: closeSize,
      height: closeSize,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "✕",
        type: typeRole.rowTitle,
        rect: closeRect,
        onClick: () => this.#close(),
      }),
    );
    stops.set("back", { rect: closeRect, activate: () => this.#close() });
    this.add
      .text(
        header.x + 16,
        header.y + header.height / 2,
        caseOf(typeRole.barTitle, this.#guide ? "How it works" : "Unlocks"),
        {
          ...textStyle(typeRole.barTitle, surface.paper.hex),
          fontSize: "24px",
        },
      )
      .setOrigin(0, 0.5);

    // The door between the switches and the explanation of what they mean.
    const guideRect: Rect = { x: closeRect.x - 12 - 128, y: closeRect.y, width: 128, height: closeRect.height };
    const toggleGuide = (): void => this.#showGuide(!this.#guide);
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: this.#guide ? "◂ Unlocks" : "How it works",
        type: typeRole.label,
        rect: guideRect,
        onClick: toggleGuide,
      }),
    );
    stops.set("guide", { rect: guideRect, activate: toggleGuide });

    if (this.#guide) {
      this.#drawGuide({ x: body.x + 16, y: body.y + 12, width: body.width - 32, height: body.height - 24 });
      this.#route?.set(["back", "guide"], stops);
      this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
      return;
    }

    // Champion points: the reason to play for it rather than switch it on.
    const rowWidth = body.width - 32;
    const pointsTitle = this.add.text(
      body.x + 16,
      body.y + 12,
      pointsRow.title,
      textStyle(typeRole.sectionHeader, surface.paper.hex),
    );
    const pointsDetail = this.add
      .text(
        body.x + 16,
        pointsTitle.y + pointsTitle.height + 4,
        pointsRow.detail,
        textStyle(typeRole.body, surface.paper.hex, 0.8),
      )
      .setFontSize(10)
      .setWordWrapWidth(rowWidth);

    // "Unlock everything": the same row shape as Settings' own toggles.
    const allRect: Rect = {
      x: body.x + 16,
      y: pointsDetail.y + pointsDetail.height + 14,
      width: rowWidth,
      height: toggleRowHeight(allRow.detail, rowWidth),
    };
    label(this, allRect.x, allRect.y + 2, allRow.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(
      12,
    );
    this.add
      .text(allRect.x, allRect.y + 20, allRow.detail, textStyle(typeRole.body, surface.paper.hex, 0.8))
      .setFontSize(10)
      .setWordWrapWidth(allRect.width - 100);
    const allToggle: Rect = {
      x: allRect.x + allRect.width - PILL_WIDTH,
      y: allRect.y + (allRect.height - 32) / 2,
      width: PILL_WIDTH,
      height: 32,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: allRow.on ? "secondary" : "quiet",
        label: allRow.on ? "ON" : "OFF",
        type: typeRole.label,
        rect: allToggle,
        selected: allRow.on,
        onClick: () => this.#toggleAll(),
      }),
    );
    stops.set("row:all", { rect: allRect, activate: () => this.#toggleAll() });

    const listTop = allRect.y + allRect.height + 4;
    const listRect: Rect = {
      x: body.x + 16,
      y: listTop,
      width: rowWidth,
      height: Math.max(ROW_HEIGHT, body.y + body.height - listTop - 12),
    };

    const renderRow = (index: number, rect: Rect): VirtualListRow => this.#renderRow(rows[index]!, rect);
    let list: McVirtualList;
    const order: string[] = ["back", "guide", "row:all"];
    rows.forEach((row, index) => {
      if (row.kind !== "hero" && row.kind !== "campaign") return;
      order.push(`row:${row.id}`);
      stops.set(`row:${row.id}`, {
        rect: () => list.rectFor(index),
        activate: () => this.#tap(row),
        ensureVisible: () => list.scrollIntoView(index),
      });
    });
    list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: ROW_HEIGHT,
      count: rows.length,
      scroll: this.#scroll,
      background: false,
      renderRow,
      onRowActivate: (index) => this.#tap(rows[index]!),
    });
    this.#list = list;

    this.#route?.set(order, stops);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
  }

  /** "How it works": every section of the guide, top to bottom, in one scrolling region. */
  #drawGuide(rect: Rect): void {
    const before = this.children.list.length;
    const textWidth = rect.width - 16;
    let y = rect.y;
    for (const section of progressionGuideOf()) {
      const heading = this.add
        .text(rect.x, y, section.heading, textStyle(typeRole.sectionHeader, surface.paper.hex))
        .setWordWrapWidth(textWidth);
      y += heading.height + 6;
      for (const paragraph of section.paragraphs) {
        const text = this.add
          .text(rect.x, y, paragraph, textStyle(typeRole.body, surface.paper.hex, 0.85))
          .setFontSize(12)
          .setWordWrapWidth(textWidth)
          .setLineSpacing(2);
        y += text.height + 6;
      }
      for (const bullet of section.bullets) {
        const dot = this.add
          .text(rect.x + 4, y, "•", textStyle(typeRole.body, surface.paper.hex, 0.85))
          .setFontSize(12);
        const text = this.add
          .text(rect.x + 18, y, bullet, textStyle(typeRole.body, surface.paper.hex, 0.85))
          .setFontSize(12)
          .setWordWrapWidth(textWidth - 18)
          .setLineSpacing(2);
        y += Math.max(dot.height, text.height) + 4;
      }
      y += 14;
    }
    const contentHeight = Math.max(1, y - rect.y);
    const added = this.children.list.slice(before);
    this.#guideRegion = new McScrollRegion(this, { rect, heights: [contentHeight], scroll: this.#guideScroll });
    this.#guideRegion.content.add(added);
  }

  #renderRow(row: UnlockListRow, rect: Rect): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const midY = rect.y + ROW_HEIGHT / 2;
    const right = rect.x + rect.width - GUTTER;
    if (row.kind === "section") {
      objects.push(label(this, rect.x, rect.y + ROW_HEIGHT - 18, row.title, typeRole.label, surface.paper.hex));
      return { objects };
    }
    if (row.kind === "wave") {
      const rule = this.add.graphics();
      rule.fillStyle(surface.paper.hex, 0.25).fillRect(rect.x, rect.y + ROW_HEIGHT - 6, rect.width - GUTTER, 1);
      const title = label(this, rect.x, midY - 2, row.title, typeRole.sectionHeader, surface.paper.hex, 1).setOrigin(
        0,
        0.5,
      );
      const status = label(
        this,
        right,
        midY - 2,
        row.status,
        typeRole.label,
        surface.paper.hex,
        row.open ? ink.secondary : 0.8,
      )
        .setOrigin(1, 0.5)
        .setFontSize(10);
      // A long lock reason gives way to the wave's own name rather than running over it.
      const room = rect.width - GUTTER - title.width - 16;
      if (status.width > room) status.setWordWrapWidth(room).setFontSize(9);
      objects.push(rule, title, status);
      return { objects };
    }

    const textWidth = rect.width - GUTTER - PILL_WIDTH - 24;
    const title = this.add
      .text(rect.x + 12, midY - 9, row.title, textStyle(typeRole.body, surface.paper.hex, 0.95))
      .setOrigin(0, 0.5)
      .setFontSize(14);
    const detail = this.add
      .text(rect.x + 12, midY + 10, row.detail, textStyle(typeRole.body, surface.paper.hex, 0.6))
      .setOrigin(0, 0.5)
      .setFontSize(10);
    if (detail.width > textWidth) detail.setFontSize(9);
    // Still too long on a phone: the full reason is in the confirm panel, so the row can cut it short.
    if (detail.width > textWidth) {
      let text = row.detail;
      while (text.length > 1 && detail.width > textWidth) {
        text = text.slice(0, -1);
        detail.setText(`${text.trimEnd()}…`);
      }
    }
    const toggleable = switchToggleable(row.state);
    const on = row.state === "on";
    const pill: Rect = { x: right - PILL_WIDTH, y: midY - PILL_HEIGHT / 2, width: PILL_WIDTH, height: PILL_HEIGHT };
    const g = this.add.graphics();
    if (on) g.fillStyle(surface.paper.hex, 1).fillRect(pill.x, pill.y, pill.width, pill.height);
    g.lineStyle(1.5, surface.paper.hex, toggleable ? 1 : 0.4).strokeRect(pill.x, pill.y, pill.width, pill.height);
    const pillText = label(
      this,
      pill.x + pill.width / 2,
      midY,
      switchLabel(row.state),
      typeRole.label,
      on ? surface.ink.hex : surface.paper.hex,
      toggleable ? 1 : 0.55,
    ).setOrigin(0.5, 0.5);
    objects.push(title, detail, g, pillText);
    return { objects };
  }
}
