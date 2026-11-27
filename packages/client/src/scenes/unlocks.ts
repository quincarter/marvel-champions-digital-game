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
 *
 * **A Lit panel over the canvas** (`mc-sheet`, `dom/popup-sheet.ts`, `dom/sheet-builder.ts`), at the rects the Phaser
 * screen drew: the ink panel and its header (title, "How it works", ✕ with its Cancel glyph), the points text, the two
 * switch rows and the list, scrolled natively. The scene keeps the press shield, the entrance and exit motion, the
 * focus route (ring in the panel layer, `dom/dom-ring.ts`) and the choices.
 */
import Phaser from "phaser";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { ink, surface, typeRole, type TypeSpec } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { OverlayMotion } from "../ui/transitions.js";
import { formFactorFor, toggleRowHeight, type Rect } from "../view/layout.js";
import { overlayPanelLayout } from "../view/overlay-layout.js";
import { progressionGuideOf } from "../view/progression-guide.js";
import {
  pointsRowOf,
  printAndPlayRowOf,
  printAndPlayTapOf,
  rowTapOf,
  switchLabel,
  switchToggleable,
  tapOf,
  unlockAllRowOf,
  unlockListRowsOf,
  type UnlockAllRow,
  type UnlockListRow,
  type UnlockTap,
} from "../view/unlocks-model.js";
import { setUnlockPrefs, unlocks } from "../progression/progression.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { askToUnlock } from "./unlock-confirm.js";

const HEADER_HEIGHT = 60;
const ROW_HEIGHT = 48;
const PILL_WIDTH = 84;
const PILL_HEIGHT = 28;
/** Room at each row's right edge for the list's own scrollbar. */
const GUTTER = 14;
/** The scrolling keys in the panel. */
const LIST = "list";
const GUIDE = "guide-text";

const BODY: TypeSpec = typeRole.body;

/** Launch data, for a Settings search result: a row to show, or a section of "How it works" to open on. */
export interface UnlocksSceneData {
  readonly row?: string;
  readonly guideSection?: number;
}

export class UnlocksOverlay extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;
  #glyphs!: SheetGlyphs;
  #motion = new OverlayMotion();
  /** Showing "How it works" (`view/progression-guide.ts`) in place of the switches. */
  #guide = false;
  /** Where each guide section starts, from the top of the text. */
  #guideTops: number[] = [];
  /** What each key in the panel does when pressed, this draw. */
  #actions = new Map<string, () => void>();
  #viewport: Rect = { x: 0, y: 0, width: 0, height: 0 };

  constructor() {
    super(SCENES.unlocks);
  }

  create(data: UnlocksSceneData = {}): void {
    // Phaser hands a later launch with no data this same object again: take the row or section once.
    this.sys.settings.data = {};
    this.#motion = new OverlayMotion();
    // A search result that opened on the guide backs out to the search, as it came.
    const cameForGuide = data.guideSection !== undefined;
    this.#guide = cameForGuide;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    const offLanguage = onLanguageChange(onResize);
    this.#panel = new PopupSheet(this, (key) => this.#actions.get(key)?.());
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.scene.isActive(SCENES.unlockConfirm),
      // LB / RB switch between the switches and "How it works"; PageUp / PageDown page the list or the text.
      onTab: (direction) => {
        if (this.#guide !== (direction === 1)) this.#showGuide(direction === 1);
      },
      onHomeEnd: (edge) => this.#scroller()?.scrollTo({ top: edge === "home" ? 0 : 1e6 }),
      onCancel: () => (this.#guide && !cameForGuide ? this.#showGuide(false) : this.#close()),
      onPage: (direction) => this.#scroller()?.scrollBy({ top: direction * Math.max(120, this.#viewport.height - 60) }),
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#glyphs.dispose();
      this.scale.off("resize", onResize, this);
      offLanguage();
    });
    this.#draw();
    if (data.guideSection !== undefined) this.#scroller()?.scrollTo({ top: this.#guideTops[data.guideSection] ?? 0 });
    if (data.row !== undefined) this.#showRow(data.row);
  }

  #scroller(): HTMLElement | null {
    return this.#panel.element?.elementOf(this.#guide ? GUIDE : LIST) ?? null;
  }

  /** Brings a row into view and puts the ring on it (a Settings search result). A scenario row has no stop: in view only. */
  #showRow(id: string): void {
    this.#panel.element?.elementOf(`row:${id}`)?.scrollIntoView({ block: "nearest" });
    this.#route?.focusKey(`row:${id}`);
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
    this.#draw();
  }

  #toggleAll(): void {
    const current = unlocks();
    this.#apply(tapOf(current, { kind: "everything" }, current.prefs.unlockAll));
  }

  #togglePrintAndPlay(): void {
    setUnlockPrefs(printAndPlayTapOf(unlocks()));
    this.#draw();
  }

  #tap(row: UnlockListRow): void {
    this.#apply(rowTapOf(unlocks(), row));
  }

  /** A key's press, and the stop for a part inside the scrolling list (its box is read off the panel). */
  #press(key: string, action: () => void): void {
    this.#actions.set(key, action);
  }

  #listStop(key: string, activate: () => void): FocusStop {
    const region = this.#panel;
    const viewport = (): Rect => {
      const list = region.element?.elementOf(LIST);
      return (list && region.rectOf(list)) || this.#viewport;
    };
    return {
      rect: () => {
        const found = region.element?.elementOf(key);
        return (found && region.rectOf(found)) || viewport();
      },
      view: viewport,
      activate,
      ensureVisible: () => region.element?.elementOf(key)?.scrollIntoView({ block: "nearest" }),
    };
  }

  #draw(): void {
    if (this.#motion.leaving) return;
    destroyChildren(this);
    this.#glyphs.reset();
    this.#actions = new Map();

    const { width, height } = this.scale.gameSize;
    const { panel, header, body } = overlayPanelLayout({ x: 0, y: 0, width, height }, HEADER_HEIGHT, 0);
    const current = unlocks();
    const pointsRow = pointsRowOf(current);
    const allRow = unlockAllRowOf(current);
    const rows = unlockListRowsOf(current);

    // Swallows every press that lands on no control of this overlay's own, so none reaches Settings, Pause or the Board.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    // Nothing drawn: the entrance and exit tween this, and the panel rises and fades with it (`DomRegion.follow`).
    const anchor = this.add.graphics();
    // Before the first mount: the sheet then has this anchor as its one motion owner (no built-in slide on top).
    this.#panel.follow(anchor);
    const b = this.#panel.begin(width, height);
    b.box(panel, { fill: surface.ink.hex, stroke: surface.paper.hex, strokeWidth: 4 });
    b.box(
      { x: header.x, y: header.y + header.height - 2, width: header.width, height: 2 },
      { fill: surface.paper.hex, fillAlpha: 0.4 },
    );

    const stops = new Map<string, FocusStop>();
    const closeSize = 32;
    const closeRect: Rect = {
      x: header.x + header.width - closeSize - 16,
      y: header.y + (header.height - closeSize) / 2,
      width: closeSize,
      height: closeSize,
    };
    this.#glyphs.button(b, {
      key: "back",
      rect: closeRect,
      label: "✕",
      look: "secondary",
      type: typeRole.rowTitle,
      ids: ["cancel"],
      ground: "ink",
    });
    this.#press("back", () => this.#close());
    stops.set("back", { rect: closeRect, activate: () => this.#close() });
    b.text(
      header.x + 16,
      header.y + header.height / 2,
      this.#guide ? t("unlocks.guideTitle") : t("settings.unlocks.title"),
      typeRole.barTitle,
      { size: 24, color: surface.paper.hex, origin: [0, 0.5] },
    );

    // The door between the switches and the explanation of what they mean.
    const guideRect: Rect = { x: closeRect.x - 12 - 128, y: closeRect.y, width: 128, height: closeRect.height };
    const toggleGuide = (): void => this.#showGuide(!this.#guide);
    this.#glyphs.button(b, {
      key: "guide",
      rect: guideRect,
      label: this.#guide ? "◂ " + t("settings.unlocks.title") : t("unlocks.guideTitle"),
      look: "quiet",
      type: typeRole.label,
      // LB / RB (and the zone keys) flip between the two views.
      ids: [this.#guide ? "zonePrevious" : "zoneNext"],
      ground: "ink",
    });
    this.#press("guide", toggleGuide);
    stops.set("guide", { rect: guideRect, activate: toggleGuide });

    if (this.#guide) {
      this.#drawGuide(b, { x: body.x + 16, y: body.y + 12, width: body.width - 32, height: body.height - 24 });
      this.#panel.mount(b, width, height);
      this.#route?.set(["back", "guide"], stops);
      this.#enter(anchor);
      return;
    }

    // Champion points: the reason to play for it rather than switch it on.
    const rowWidth = body.width - 32;
    const pointsTitle = b.text(body.x + 16, body.y + 12, pointsRow.title, typeRole.sectionHeader, {
      color: surface.paper.hex,
    });
    const pointsDetail = b.text(body.x + 16, body.y + 12 + pointsTitle.height + 4, pointsRow.detail, BODY, {
      size: 10,
      color: surface.paper.hex,
      alpha: 0.8,
      wrapWidth: rowWidth,
    });
    const pointsBottom = body.y + 12 + pointsTitle.height + 4 + pointsDetail.height;

    // Switch rows ("Unlock everything", then the print-and-play opt-in): the same row shape as Settings' own toggles.
    const switchRow = (key: string, row: UnlockAllRow, y: number, onTap: () => void): Rect => {
      const rect: Rect = {
        x: body.x + 16,
        y,
        width: rowWidth,
        height: toggleRowHeight(row.detail, rowWidth, formFactorFor(width, height) === "desktop"),
      };
      b.text(rect.x, rect.y + 2, row.title, typeRole.label, {
        size: 12,
        color: surface.paper.hex,
        alpha: ink.secondary,
        fitWidth: rect.width - 100,
      });
      b.text(rect.x, rect.y + 20, row.detail, BODY, {
        size: 10,
        color: surface.paper.hex,
        alpha: 0.8,
        wrapWidth: rect.width - 100,
      });
      const toggle: Rect = {
        x: rect.x + rect.width - PILL_WIDTH,
        y: rect.y + (rect.height - 32) / 2,
        width: PILL_WIDTH,
        height: 32,
      };
      b.button({
        key,
        rect: toggle,
        label: row.on ? t("settings.toggleOn") : t("settings.toggleOff"),
        look: row.on ? "secondary" : "quiet",
        selected: row.on,
        type: typeRole.label,
      });
      this.#press(key, onTap);
      stops.set(key, { rect, activate: onTap });
      return rect;
    };
    const allRect = switchRow("row:all", allRow, pointsBottom + 14, () => this.#toggleAll());
    const pnpRect = switchRow("row:pnp", printAndPlayRowOf(current), allRect.y + allRect.height, () =>
      this.#togglePrintAndPlay(),
    );

    const listTop = pnpRect.y + pnpRect.height + 4;
    const listRect: Rect = {
      x: body.x + 16,
      y: listTop,
      width: rowWidth,
      height: Math.max(ROW_HEIGHT, body.y + body.height - listTop - 12),
    };
    this.#viewport = listRect;

    const order: string[] = ["back", "guide", "row:all", "row:pnp"];
    b.scroll(LIST, listRect, rows.length * ROW_HEIGHT, (inner) => {
      rows.forEach((row, index) =>
        this.#renderRow(inner, row, {
          x: listRect.x,
          y: index * ROW_HEIGHT,
          width: listRect.width,
          height: ROW_HEIGHT,
        }),
      );
    });
    for (const row of rows) {
      if (row.kind !== "hero" && row.kind !== "campaign") continue;
      order.push(`row:${row.id}`);
      stops.set(
        `row:${row.id}`,
        this.#listStop(`row:${row.id}`, () => this.#tap(row)),
      );
    }
    this.#panel.mount(b, width, height);
    this.#route?.set(order, stops);
    this.#enter(anchor);
  }

  #enter(anchor: Phaser.GameObjects.Graphics): void {
    this.#motion.enter(this, { scrim: [], panels: [anchor] });
  }

  /** "How it works": every section of the guide, top to bottom, in one scrolling region. */
  #drawGuide(b: SheetBuilder, rect: Rect): void {
    this.#viewport = rect;
    const textWidth = rect.width - 16;
    this.#guideTops = [];
    // The region's height is only known once the text is measured, so its parts are built first and handed over.
    const inner = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    let y = 0;
    for (const section of progressionGuideOf()) {
      this.#guideTops.push(y);
      const heading = inner.text(0, y, section.heading, typeRole.sectionHeader, {
        color: surface.paper.hex,
        wrapWidth: textWidth,
      });
      y += heading.height + 6;
      for (const paragraph of section.paragraphs) {
        const text = inner.text(0, y, paragraph, BODY, {
          size: 12,
          color: surface.paper.hex,
          alpha: 0.85,
          wrapWidth: textWidth,
          lineSpacing: 2,
        });
        y += text.height + 6;
      }
      for (const bullet of section.bullets) {
        const dot = inner.text(4, y, "•", BODY, { size: 12, color: surface.paper.hex, alpha: 0.85 });
        const text = inner.text(18, y, bullet, BODY, {
          size: 12,
          color: surface.paper.hex,
          alpha: 0.85,
          wrapWidth: textWidth - 18,
          lineSpacing: 2,
        });
        y += Math.max(dot.height, text.height) + 4;
      }
      y += 14;
    }
    b.scroll(GUIDE, rect, Math.max(1, y), (target) => {
      target.nodes.push(...inner.nodes);
    });
  }

  #renderRow(b: SheetBuilder, row: UnlockListRow, rect: Rect): void {
    const midY = rect.y + ROW_HEIGHT / 2;
    const right = rect.x + rect.width - GUTTER;
    if (row.kind === "section") {
      // A long section title wraps onto a second line (stepping the type down first), sitting on the row's foot.
      const wrap = rect.width - GUTTER;
      const lines = b.measure(row.title, typeRole.label, { wrapWidth: wrap });
      b.text(rect.x, rect.y + ROW_HEIGHT - 6 - Math.ceil(lines.height), row.title, typeRole.label, {
        color: surface.paper.hex,
        alpha: ink.label,
        wrapWidth: wrap,
        maxLines: 2,
      });
      return;
    }
    if (row.kind === "wave") {
      const title = b.measure(row.title, typeRole.sectionHeader);
      const statusAlpha = row.open ? ink.secondary : 0.8;
      const status = b.measure(row.status, typeRole.label, { size: 10 });
      // A long lock reason gives way to the wave's own name rather than running over it: when it has too little room
      // beside the title it drops under it (left-aligned, wrapped to the row's width), never squeezed into a sliver.
      const room = rect.width - GUTTER - title.width - 16;
      let ruleY = rect.y + ROW_HEIGHT - 6;
      b.box({ x: rect.x, y: rect.y, width: 1, height: 1 }, { key: `row:${row.id}` });
      if (status.width > room && room < 140) {
        b.text(rect.x, rect.y + 13, row.title, typeRole.sectionHeader, { color: surface.paper.hex, origin: [0, 0.5] });
        b.text(rect.x, rect.y + 25, row.status, typeRole.label, {
          size: 9,
          color: surface.paper.hex,
          alpha: statusAlpha,
          wrapWidth: rect.width - GUTTER,
        });
        ruleY = rect.y + ROW_HEIGHT - 1;
      } else {
        b.text(rect.x, midY - 2, row.title, typeRole.sectionHeader, { color: surface.paper.hex, origin: [0, 0.5] });
        const wrapped = status.width > room;
        b.text(right, midY - 2, row.status, typeRole.label, {
          size: wrapped ? 9 : 10,
          color: surface.paper.hex,
          alpha: statusAlpha,
          origin: [1, 0.5],
          ...(wrapped ? { wrapWidth: room, align: "right" as const } : {}),
        });
      }
      b.box(
        { x: rect.x, y: ruleY, width: rect.width - GUTTER, height: 1 },
        { fill: surface.paper.hex, fillAlpha: 0.25 },
      );
      return;
    }

    const textWidth = rect.width - GUTTER - PILL_WIDTH - 24;
    b.text(rect.x + 12, midY - 9, row.title, BODY, {
      size: 14,
      color: surface.paper.hex,
      alpha: 0.95,
      origin: [0, 0.5],
      fitWidth: textWidth,
    });
    // A long detail steps its type down to the room beside the pill; still too long on a phone, it wraps to a second
    // line under a title lifted a little, never cut.
    const small = b.measure(row.detail, BODY, { size: 10 }).width;
    const tiny = small > textWidth ? b.measure(row.detail, BODY, { size: 9 }).width : small;
    if (tiny > textWidth) {
      b.text(rect.x + 12, midY - 1, row.detail, BODY, {
        size: 9,
        color: surface.paper.hex,
        alpha: 0.6,
        wrapWidth: textWidth,
      });
    } else {
      b.text(rect.x + 12, midY + 10, row.detail, BODY, {
        size: small > textWidth ? 9 : 10,
        color: surface.paper.hex,
        alpha: 0.6,
        origin: [0, 0.5],
      });
    }
    const toggleable = switchToggleable(row.state);
    const on = row.state === "on";
    const pill: Rect = { x: right - PILL_WIDTH, y: midY - PILL_HEIGHT / 2, width: PILL_WIDTH, height: PILL_HEIGHT };
    b.box(pill, {
      ...(on ? { fill: surface.paper.hex } : {}),
      stroke: surface.paper.hex,
      strokeWidth: 1.5,
      ...(toggleable ? {} : { alpha: 0.4 }),
    });
    b.text(pill.x + pill.width / 2, midY, switchLabel(row.state), typeRole.label, {
      color: on ? surface.ink.hex : surface.paper.hex,
      alpha: toggleable ? 1 : 0.55,
      origin: [0.5, 0.5],
    });
    const key = `row:${row.id}`;
    if (row.kind === "hero" || row.kind === "campaign") {
      b.tap(key, rect);
      this.#press(key, () => this.#tap(row));
    } else {
      b.box({ x: rect.x, y: rect.y, width: 1, height: 1 }, { key });
    }
  }
}
