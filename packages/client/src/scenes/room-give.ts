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
import { layoutRoomGive } from "../view/room-give-layout.js";
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

  /** Leaves with the pop-up's exit (`PopupSheet.close`). */
  #stop(): void {
    this.#panel.close(() => this.scene.stop());
  }

  create(): void {
    this.#panel = new PopupSheet(this, (key) => this.#answers.get(key)?.(), undefined, {
      onDismiss: () => this.#stop(),
    });
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.#stop(),
      primary: () => "cancel",
      onScroll: (_dx, dy) => {
        const list = this.#panel.element?.elementOf("give-list");
        if (list) list.scrollTop += dy;
      },
    });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
    });
    this.#draw();
  }

  /** Where a panel part is now, scroll included. */
  #liveRect(key: string): Rect | null {
    const found = this.#panel.element?.elementOf(key);
    return found ? this.#panel.rectOf(found) : null;
  }

  #draw(): void {
    destroyChildren(this);
    this.#answers.clear();
    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const b = this.#panel.begin(width, height);
    const people = assignCandidates(roomState());
    const titleSpec = typeRole.barTitle;
    const bodySpec = typeRole.body;
    const titleText = t("give.title", { hero: this.#data.hero });
    const emptyText = t("room.seat.giveNobody");
    const wrap = { wrapWidth: Math.min(420, width - 32) - 40 };
    const titleSize = b.measure(titleText, titleSpec);
    const emptySize = people.length === 0 ? b.measure(emptyText, bodySpec, wrap) : null;
    const layout = layoutRoomGive({
      width,
      height,
      titleHeight: titleSize.height,
      emptyHeight: emptySize?.height ?? null,
      recipients: people.length,
      target: hit.target,
    });
    const { box, inner, list } = layout;
    b.box(box, { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 4 });
    b.text(box.x + 20, box.y + 20, titleText, titleSpec, { color: surface.ink.hex });
    const order: string[] = [];
    const stops = new Map<string, FocusStop>();
    if (emptySize) b.text(list.x, list.y, emptyText, bodySpec, { ...wrap, color: surface.ink.hex, alpha: 0.85 });
    // The recipients scroll in a region bounded to the box; Cancel stays outside it, always on screen.
    const recipients = people.map((person, n) => ({
      person,
      key: `give:${person.id}`,
      rect: { x: list.x, y: layout.rowTops[n]!, width: inner, height: hit.target } satisfies Rect,
    }));
    if (recipients.length > 0) {
      b.scroll("give-list", list, layout.contentHeight, (sb) => {
        for (const { person, key, rect } of recipients) {
          sb.button({ key, rect, label: person.name, look: "primary", type: buttonType });
        }
      });
    }
    for (const { person, key, rect } of recipients) {
      const give = (): void => {
        assignSeat(this.#data.seat, person.id);
        this.#stop();
      };
      this.#answers.set(key, give);
      order.push(key);
      const screenRect: Rect = { ...rect, y: list.y + rect.y };
      stops.set(key, {
        rect: () => this.#liveRect(key) ?? screenRect,
        view: () => this.#liveRect("give-list") ?? list,
        activate: give,
        ensureVisible: () => this.#panel.element?.elementOf(key)?.scrollIntoView({ block: "nearest" }),
      });
    }
    const cancelRect = layout.cancel;
    const cancel = (): void => this.#stop();
    b.button({ key: "cancel", rect: cancelRect, label: t("give.cancel"), look: "secondary", type: buttonType });
    this.#answers.set("cancel", cancel);
    order.push("cancel");
    stops.set("cancel", { rect: cancelRect, activate: cancel });
    this.#panel.mount(b, width, height);
    this.#route?.set(order, stops);
  }
}
