/**
 * "Give <hero> to…" (issue #881): the host's picker, over the board, for an away or vacated seat. It lists the people in
 * the room who could take the hero (`assignCandidates`) and hands the seat to the one pressed. Modeled on
 * `scenes/room-ask.ts`; nothing is decided here, the room refuses what it will not allow.
 */
import Phaser from "phaser";
import { t } from "../i18n/translate.js";
import { assignSeat, roomState } from "../platform/room.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
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
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.roomGive);
  }

  init(data: RoomGiveData): void {
    this.#data = data;
  }

  create(): void {
    this.#route = new FocusRoute(this, { onCancel: () => this.scene.stop(), primary: () => "cancel" });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const people = assignCandidates(roomState());
    const boxWidth = Math.min(420, width - 32);
    const inner = boxWidth - 40;
    const title = this.add.text(
      0,
      0,
      t("give.title", { hero: this.#data.hero }),
      textStyle(typeRole.barTitle, surface.ink.hex),
    );
    const empty =
      people.length === 0
        ? this.add
            .text(0, 0, t("room.seat.giveNobody"), textStyle(typeRole.body, surface.ink.hex, 0.85))
            .setWordWrapWidth(inner, true)
        : null;
    const listHeight = people.length === 0 ? (empty?.height ?? 0) : people.length * (hit.target + 6);
    const boxHeight = 20 + title.height + 12 + listHeight + 10 + hit.target + 20;
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.max(12, (height - boxHeight) / 3),
      width: boxWidth,
      height: Math.min(boxHeight, height - 24),
    };
    const ground = this.add.graphics();
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    // The text sits above the ground, which was added after it.
    for (const object of [title, ...(empty ? [empty] : [])]) this.children.bringToTop(object);
    title.setPosition(box.x + 20, box.y + 20);
    let y = title.y + title.height + 12;
    const order: string[] = [];
    const stops = new Map<string, FocusStop>();
    empty?.setPosition(box.x + 20, y);
    for (const person of people) {
      const rect: Rect = { x: box.x + 20, y, width: inner, height: hit.target };
      const give = (): void => {
        assignSeat(this.#data.seat, person.id);
        this.scene.stop();
      };
      this.#buttons.push(
        new McButton(this, { kind: "primary", label: person.name, type: buttonType, rect, onClick: give }),
      );
      order.push(`give:${person.id}`);
      stops.set(`give:${person.id}`, { rect, activate: give });
      y += hit.target + 6;
    }
    const cancelRect: Rect = {
      x: box.x + 20,
      y: box.y + box.height - 20 - hit.target,
      width: inner,
      height: hit.target,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: t("give.cancel"),
        type: buttonType,
        rect: cancelRect,
        onClick: () => this.scene.stop(),
      }),
    );
    order.push("cancel");
    stops.set("cancel", { rect: cancelRect, activate: () => this.scene.stop() });
    this.#route?.set(order, stops);
  }
}
