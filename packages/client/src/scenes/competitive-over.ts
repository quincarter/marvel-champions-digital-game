/**
 * The Civil War Competitive result sheet (issue #883, plan M9; MC56 p. 17): over the game-over screen, one row per team
 * with its result in words, how each won, and the tie-break panel (every measure the engine read, the deciding one
 * marked) when the teams tied on win conditions. All of it comes from `view/competitive-over.ts`; nothing is computed
 * here. The list scrolls inside a masked region and Close sits below it, so no control is on a scrolling region.
 */
import Phaser from "phaser";
import { appSession } from "../session.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { t } from "../i18n/translate.js";
import { competitiveOverOf, type CompetitiveOver } from "../view/competitive-over.js";
import type { Rect } from "../view/layout.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface CompetitiveOverData {
  /** Dev preview: a made-up result to draw instead of the live game's. */
  readonly preview?: CompetitiveOver;
}

const INK = surface.ink.hex;
const PAPER = surface.paper.hex;

export class CompetitiveOverOverlay extends Phaser.Scene {
  #data: CompetitiveOverData = {};
  #buttons: McButton[] = [];
  #region: McScrollRegion | null = null;
  #scroll = new VariableListScroll();
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();

  constructor() {
    super(SCENES.competitiveOver);
  }

  init(data: CompetitiveOverData): void {
    this.#data = data ?? {};
    this.#scroll = new VariableListScroll();
  }

  create(): void {
    this.#route = new FocusRoute(this, { onCancel: () => this.scene.stop(), primary: () => "close" });
    const redraw = (): void => this.#draw();
    this.scale.on("resize", redraw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", redraw, this);
      this.#clear();
    });
    this.#draw();
  }

  #over(): CompetitiveOver | null {
    if (this.#data.preview) return this.#data.preview;
    const { game, config } = appSession().store.state;
    return game ? competitiveOverOf(game, config?.localSeats) : null;
  }

  #clear(): void {
    for (const b of this.#buttons) b.destroy();
    this.#buttons = [];
    this.#region?.destroy();
    this.#region = null;
  }

  #text(x: number, y: number, text: string, size: number, width: number, bold = false): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, textStyle(bold ? typeRole.rowTitle : typeRole.body, INK))
      .setFontSize(size)
      .setWordWrapWidth(width, true);
  }

  #draw(): void {
    this.#clear();
    destroyChildren(this);
    this.#stops = new Map();
    const over = this.#over();
    if (!over) {
      this.scene.stop();
      return;
    }
    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const boxW = Math.min(560, width - 16);
    const boxH = Math.min(height - 16, 640);
    const box: Rect = { x: (width - boxW) / 2, y: (height - boxH) / 2, width: boxW, height: boxH };
    const g = this.add.graphics();
    g.fillStyle(PAPER, 1).fillRect(box.x, box.y, box.width, box.height);
    g.lineStyle(4, INK, 1).strokeRect(box.x, box.y, box.width, box.height);
    const title = this.add
      .text(box.x + 16, box.y + 12, `${t("comp.over.heading")}: ${over.headline}`, textStyle(typeRole.barTitle, INK))
      .setWordWrapWidth(box.width - 32, true);
    const closeRect: Rect = {
      x: box.x + 16,
      y: box.y + box.height - 12 - hit.target,
      width: box.width - 32,
      height: hit.target,
    };
    const close = (): void => {
      this.scene.stop();
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: t("comp.over.close"),
        type: { ...typeRole.label, size: 12 },
        rect: closeRect,
        onClick: close,
      }),
    );
    this.#stops.set("close", { rect: closeRect, activate: close });
    const top = title.y + title.height + 8;
    const inner: Rect = { x: box.x + 12, y: top, width: box.width - 24, height: closeRect.y - 8 - top };
    this.#list(inner, over);
    this.#route?.set(["close"], this.#stops);
  }

  #list(inner: Rect, over: CompetitiveOver): void {
    const region = new McScrollRegion(this, {
      rect: inner,
      heights: [inner.height],
      scroll: this.#scroll,
      clipInteractive: true,
    });
    this.#region = region;
    const before = this.children.list.length;
    const w = inner.width - 12;
    const x = inner.x;
    let y = inner.y + 2;
    const g = this.add.graphics();
    for (const row of over.rows) {
      const head = `${row.mine ? "▶ " : ""}${row.sideLabel}: ${row.resultLabel}`;
      y += this.#text(x, y, head, 17, w, true).height + 2;
      for (const condition of row.conditions) y += this.#text(x + 12, y, `• ${condition}`, 13, w - 12).height + 2;
      y += 8;
    }
    if (over.reason) y += this.#text(x, y, over.reason, 14, w, true).height + 8;
    const panel = over.tieBreak;
    if (panel) {
      g.fillStyle(INK, 1).fillRect(x, y, w, 2);
      y += 8;
      y += this.#text(x, y, t("comp.over.title"), 17, w, true).height + 2;
      y += this.#text(x, y, panel.summary, 14, w, true).height + 8;
      for (const measure of panel.measures) {
        // The deciding measure is marked with a glyph and the word, never only a colour or weight.
        const mark = measure.decided ? "★ " : "";
        y += this.#text(x, y, `${mark}${measure.label}`, 13, w, measure.decided).height + 2;
        const values = measure.values.map((v) => `${v.sideLabel} ${v.value}`).join("   ·   ");
        y += this.#text(x + 12, y, values, 13, w - 12).height + 8;
      }
    }
    const added = this.children.list.slice(before).filter((n) => n !== region.root);
    if (added.length > 0) region.content.add(added);
    region.refresh();
  }
}
