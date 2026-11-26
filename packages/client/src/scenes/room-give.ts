/**
 * "Give <hero> to…" (issue #881): the host's picker, over the board, for an away or vacated seat. It lists the people in
 * the room who could take the hero (`assignCandidates`) and hands the seat to the one pressed. Modeled on
 * `scenes/room-ask.ts`; nothing is decided here, the room refuses what it will not allow.
 *
 * The box is a Lit panel over the canvas (`dom/popup-sheet.ts`); the scene keeps the press shield, the focus route (ring
 * in the panel layer) and the answers.
 */
import Phaser from "phaser";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { t } from "../i18n/translate.js";
import { assignSeat, roomState } from "../platform/room.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import type { Rect } from "../view/layout.js";
import { assignCandidates } from "../view/room-lobby-model.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface RoomGiveData {
  readonly seat: string;
  readonly hero: string;
}

const buttonType = { ...typeRole.label, size: 13 };

export class RoomGiveOverlay extends Phaser.Scene {
  #data: RoomGiveData = { seat: "", hero: "" };
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;
  /** What each button key of the last draw does. */
  #answers = new Map<string, () => void>();

  constructor() {
    super(SCENES.roomGive);
  }

  init(data: RoomGiveData): void {
    this.#data = data;
  }

  create(): void {
    this.#panel = new PopupSheet(this, (key) => this.#answers.get(key)?.());
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.scene.stop(),
      primary: () => "cancel",
    });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
    });
    this.#draw();
  }

  #draw(): void {
    destroyChildren(this);
    this.#answers.clear();
    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const b = this.#panel.begin(width, height);
    const people = assignCandidates(roomState());
    const boxWidth = Math.min(420, width - 32);
    const inner = boxWidth - 40;
    const titleSpec = typeRole.barTitle;
    const bodySpec = typeRole.body;
    const titleText = t("give.title", { hero: this.#data.hero });
    const titleSize = b.measure(titleText, titleSpec);
    const emptyOptions = { wrapWidth: inner };
    const emptyText = t("room.seat.giveNobody");
    const emptySize = people.length === 0 ? b.measure(emptyText, bodySpec, emptyOptions) : null;
    const listHeight = people.length === 0 ? (emptySize?.height ?? 0) : people.length * (hit.target + 6);
    const boxHeight = 20 + titleSize.height + 12 + listHeight + 10 + hit.target + 20;
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.max(12, (height - boxHeight) / 3),
      width: boxWidth,
      height: Math.min(boxHeight, height - 24),
    };
    b.box(box, { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 4 });
    b.text(box.x + 20, box.y + 20, titleText, titleSpec, { color: surface.ink.hex });
    let y = box.y + 20 + titleSize.height + 12;
    const order: string[] = [];
    const stops = new Map<string, FocusStop>();
    if (emptySize) b.text(box.x + 20, y, emptyText, bodySpec, { ...emptyOptions, color: surface.ink.hex, alpha: 0.85 });
    for (const person of people) {
      const rect: Rect = { x: box.x + 20, y, width: inner, height: hit.target };
      const give = (): void => {
        assignSeat(this.#data.seat, person.id);
        this.scene.stop();
      };
      const key = `give:${person.id}`;
      b.button({ key, rect, label: person.name, look: "primary", type: buttonType });
      this.#answers.set(key, give);
      order.push(key);
      stops.set(key, { rect, activate: give });
      y += hit.target + 6;
    }
    const cancelRect: Rect = {
      x: box.x + 20,
      y: box.y + box.height - 20 - hit.target,
      width: inner,
      height: hit.target,
    };
    const cancel = (): void => void this.scene.stop();
    b.button({ key: "cancel", rect: cancelRect, label: t("give.cancel"), look: "secondary", type: buttonType });
    this.#answers.set("cancel", cancel);
    order.push("cancel");
    stops.set("cancel", { rect: cancelRect, activate: cancel });
    this.#panel.mount(b, width, height);
    this.#route?.set(order, stops);
  }
}
