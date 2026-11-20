/**
 * Concede in a Civil War Competitive game (issue #883, plan N12 A): "Concede for the team" and, in a 2v2, "Leave alone",
 * each with what it does in words, and Cancel. Opened by Pause in place of the single confirm. The choices and the
 * command each sends are `view/competitive-concede.ts`; the engine decides what a concession means.
 */
import Phaser from "phaser";
import { appSession } from "../session.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { t } from "../i18n/translate.js";
import { concedeChoicesOf, type ConcedeChoice } from "../view/competitive-concede.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

const INK = surface.ink.hex;
const PAPER = surface.paper.hex;

export class CompetitiveConcedeOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.competitiveConcede);
  }

  create(): void {
    this.#route = new FocusRoute(this, { onCancel: () => this.#close(), primary: () => "cancel" });
    const redraw = (): void => this.#draw();
    this.scale.on("resize", redraw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", redraw, this);
      for (const b of this.#buttons) b.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  #close(): void {
    this.scene.stop();
  }

  #choices(): readonly ConcedeChoice[] {
    const { game, perspectiveId } = appSession().store.state;
    return game && perspectiveId ? concedeChoicesOf(game, perspectiveId) : [];
  }

  async #send(choice: ConcedeChoice): Promise<void> {
    const ok = await appSession().store.dispatch(choice.command);
    if (ok) {
      this.#close();
      // The pause sheet underneath goes too: the game is over (the team) or this seat is out (alone).
      if (this.scene.isActive(SCENES.pause)) this.scene.stop(SCENES.pause);
    }
  }

  #draw(): void {
    for (const b of this.#buttons) b.destroy();
    this.#buttons = [];
    destroyChildren(this);
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    const choices = this.#choices();
    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const boxW = Math.min(520, width - 16);
    const x = (width - boxW) / 2 + 16;
    const w = boxW - 32;
    // Measure first so the box fits its words on the smallest phone.
    let y = 0;
    const lay = (text: string, size: number, bold: boolean, at: number): Phaser.GameObjects.Text =>
      this.add
        .text(x, at, text, textStyle(bold ? typeRole.rowTitle : typeRole.body, INK))
        .setFontSize(size)
        .setWordWrapWidth(w, true);
    const heights = choices.map((c) => lay(t(c.detailKey), 13, false, -1000).height);
    this.children.list.slice(-heights.length).forEach((n) => n.destroy());
    const total = 28 + choices.reduce((sum, _c, i) => sum + heights[i]! + hit.target + 18, 0) + hit.target + 16;
    const boxH = Math.min(height - 16, total + 30);
    const top = (height - boxH) / 2;
    const g = this.add.graphics();
    g.fillStyle(PAPER, 1).fillRect((width - boxW) / 2, top, boxW, boxH);
    g.lineStyle(4, INK, 1).strokeRect((width - boxW) / 2, top, boxW, boxH);
    y = top + 14;
    const button = (rect: Rect, label: string, kind: "primary" | "secondary", key: string, run: () => void): void => {
      this.#buttons.push(
        new McButton(this, { kind, label, type: { ...typeRole.label, size: 12 }, rect, onClick: run, wrap: true }),
      );
      stops.set(key, { rect, activate: run });
      order.push(key);
    };
    for (const choice of choices) {
      const detail = lay(t(choice.detailKey), 13, false, y);
      y += detail.height + 6;
      button(
        { x, y, width: w, height: hit.target },
        t(choice.labelKey),
        "secondary",
        choice.id,
        () => void this.#send(choice),
      );
      y += hit.target + 12;
    }
    button({ x, y, width: w, height: hit.target }, t("comp.over.cancel"), "primary", "cancel", () => this.#close());
    this.#route?.set(order, stops);
  }
}
