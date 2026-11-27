/**
 * Concede in a Civil War Competitive game (issue #883, plan N12 A): "Concede for the team" and, in a 2v2, "Leave alone",
 * each with what it does in words, and Cancel. Opened by Pause in place of the single confirm. The choices and the
 * command each sends are `view/competitive-concede.ts`; the engine decides what a concession means.
 */
import Phaser from "phaser";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { appSession } from "../session.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { t } from "../i18n/translate.js";
import { concedeChoicesOf, type ConcedeChoice } from "../view/competitive-concede.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

const INK = surface.ink.hex;
const PAPER = surface.paper.hex;

/** A Lit panel over the canvas (`dom/popup-sheet.ts`), above Pause's; the scene keeps the shield, route and commands. */
export class CompetitiveConcedeOverlay extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;
  /** What each button does this draw, by key. */
  #actions = new Map<string, () => void>();

  constructor() {
    super(SCENES.competitiveConcede);
  }

  create(): void {
    this.#panel = new PopupSheet(this, (key) => this.#actions.get(key)?.(), undefined, {
      onDismiss: () => this.#close(),
    });
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#panel.leaving,
      onCancel: () => this.#close(),
      primary: () => "cancel",
    });
    const redraw = (): void => this.#draw();
    this.scale.on("resize", redraw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", redraw, this);
    });
    this.#draw();
  }

  #close(): void {
    this.#panel.close();
  }

  #choices(): readonly ConcedeChoice[] {
    const { game, perspectiveId } = appSession().store.state;
    return game && perspectiveId ? concedeChoicesOf(game, perspectiveId) : [];
  }

  async #send(choice: ConcedeChoice): Promise<void> {
    const ok = await appSession().store.dispatch(choice.command);
    if (ok) {
      // The pause sheet underneath goes too: the game is over (the team) or this seat is out (alone). Whether or not
      // this sheet was already leaving when the dispatch came back (Escape while it was awaited).
      if (this.scene.isActive(SCENES.pause)) this.scene.stop(SCENES.pause);
      this.#close();
    }
  }

  #draw(): void {
    destroyChildren(this);
    this.#actions = new Map();
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    const choices = this.#choices();
    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const b = this.#panel.begin(width, height);
    const boxW = Math.min(520, width - 16);
    const x = (width - boxW) / 2 + 16;
    const w = boxW - 32;
    const detailSpec = typeRole.body;
    const detailOptions = { size: 13, wrapWidth: w };
    // Measure first so the box fits its words on the smallest phone.
    const heights = choices.map((c) => b.measure(t(c.detailKey), detailSpec, detailOptions).height);
    const total = 28 + choices.reduce((sum, _c, i) => sum + heights[i]! + hit.target + 18, 0) + hit.target + 16;
    const boxH = Math.min(height - 16, total + 30);
    const top = (height - boxH) / 2;
    b.box({ x: (width - boxW) / 2, y: top, width: boxW, height: boxH }, { fill: PAPER, stroke: INK, strokeWidth: 4 });
    let y = top + 14;
    const button = (rect: Rect, label: string, look: "primary" | "secondary", key: string, run: () => void): void => {
      b.button({ key, rect, label, look, type: { ...typeRole.label, size: 12 } });
      this.#actions.set(key, run);
      stops.set(key, { rect, activate: run });
      order.push(key);
    };
    for (const choice of choices) {
      const detail = b.text(x, y, t(choice.detailKey), detailSpec, { ...detailOptions, color: INK });
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
    this.#panel.mount(b, width, height);
    this.#route?.set(order, stops);
  }
}
