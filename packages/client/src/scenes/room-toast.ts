/**
 * The room's "joined" / "left" toasts (issue #880): ink panels with a paper border that slide in at the top right (a
 * phone's come down across the top, full width less the gutters) on any screen while the player is in a room, stack up
 * to three, hold about four seconds and fade. Each has a close button (a `McButton`); X on the keyboard and a press of
 * the right stick on a pad dismiss the newest. The scene runs only while a toast shows and stops itself after;
 * `scenes/room-notice-watch.ts` starts it and fills `roomToasts` (`view/room-toast.ts`).
 */
import Phaser from "phaser";
import { t } from "../i18n/translate.js";
import { appSession } from "../session.js";
import { signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton, fitText } from "../ui/widgets.js";
import { deviceText } from "../view/room-lobby-model.js";
import { ROOM_TOAST_HEIGHT, roomToastFrameAt, roomToastRects, roomToasts, type RoomToast } from "../view/room-toast.js";
import type { Rect } from "../view/layout.js";
import { bindExtraInput } from "./extra-input.js";
import { SCENES } from "./keys.js";

interface Drawn {
  readonly toast: RoomToast;
  readonly rect: Rect;
  readonly panel: Phaser.GameObjects.Container;
  readonly button: McButton;
}

/** The toast's words: "quin joined", with their device on the second line. */
export function roomToastWords(toast: RoomToast): { readonly line: string; readonly detail: string | null } {
  const { change } = toast;
  const name = change.name.trim() || t("room.toast.someone");
  return {
    line: t(change.kind === "joined" ? "room.toast.joined" : "room.toast.left", { name }),
    detail: deviceText(change.device),
  };
}

export class RoomToastScene extends Phaser.Scene {
  #drawn: Drawn[] = [];
  #key = "";
  #alive = false;

  constructor() {
    super(SCENES.roomToast);
  }

  create(): void {
    this.#key = "";
    this.#alive = true;
    const redraw = (): void => this.#draw();
    const off = roomToasts.subscribe(redraw);
    this.scale.on(Phaser.Scale.Events.RESIZE, redraw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      off();
      this.scale.off(Phaser.Scale.Events.RESIZE, redraw, this);
      this.#clear();
    });
    // Typing in a text field never dismisses (`bindExtraInput` skips it); the pad's R3 is Expand elsewhere, free here.
    bindExtraInput(this, {
      keys: { x: () => roomToasts.dismissTop() },
      intents: { expand: () => roomToasts.dismissTop() },
    });
    this.#draw();
  }

  override update(): void {
    const now = performance.now();
    if (roomToasts.expire(now)) return;
    if (roomToasts.toasts.length === 0) {
      this.scene.stop();
      return;
    }
    const reduced = appSession().settings.reducedMotion;
    const phone = this.scale.gameSize.width < 600;
    for (const { toast, panel, button, rect } of this.#drawn) {
      const frame = roomToastFrameAt(now - toast.shownAt, reduced);
      // From the right edge on a desktop or tablet, down from above on a phone.
      const dx = phone ? 0 : frame.slide * (rect.width + 24);
      const dy = phone ? -frame.slide * (rect.y + ROOM_TOAST_HEIGHT) : 0;
      for (const object of [panel, button.container]) object.setAlpha(frame.alpha).setPosition(dx, dy);
    }
  }

  debugState(): Record<string, unknown> {
    return {
      toasts: this.#drawn.map(({ toast, rect }) => ({ ...roomToastWords(toast), rect })),
    };
  }

  #clear(): void {
    for (const { button, panel } of this.#drawn) {
      button.destroy();
      panel.destroy(true);
    }
    this.#drawn = [];
  }

  #draw(): void {
    if (!this.#alive) return;
    const toasts = roomToasts.toasts;
    if (toasts.length === 0) {
      this.#clear();
      this.#key = "";
      return;
    }
    const { width } = this.scale.gameSize;
    // The same toasts at the same width are not redrawn (an expiry that removes none changes nothing).
    const key = `${width}:${toasts.map((x) => x.id).join(",")}`;
    if (key === this.#key) return;
    this.#key = key;
    this.#clear();
    const rects = roomToastRects(width, toasts.length);
    toasts.forEach((toast, i) => {
      const rect = rects[i]!;
      const words = roomToastWords(toast);
      const g = this.add.graphics();
      g.fillStyle(surface.ink.hex, 1).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 10);
      g.lineStyle(2, surface.paper.hex, 1).strokeRoundedRect(
        rect.x + 1,
        rect.y + 1,
        rect.width - 2,
        rect.height - 2,
        10,
      );
      // The side stripe: caution for someone arriving, paper-grey for someone leaving.
      g.fillStyle(toast.change.kind === "joined" ? signal.caution.hex : surface.paper.hex, 1).fillRoundedRect(
        rect.x + 6,
        rect.y + 10,
        4,
        rect.height - 20,
        2,
      );
      const buttonSize = 44;
      const textX = rect.x + 22;
      const textWidth = rect.x + rect.width - buttonSize - 14 - textX;
      const line = this.add.text(
        textX,
        rect.y + (words.detail ? 10 : 20),
        words.line,
        textStyle(typeRole.rowTitle, surface.paper.hex),
      );
      fitText(line, textWidth, 15);
      const items: Phaser.GameObjects.GameObject[] = [g, line];
      if (words.detail) {
        const detail = this.add
          .text(textX, rect.y + 32, words.detail, textStyle(typeRole.label, signal.caution.hex))
          .setFontSize(11);
        fitText(detail, textWidth, 11);
        items.push(detail);
      }
      const panel = this.add.container(0, 0, items).setDepth(1);
      const button = new McButton(this, {
        kind: "onInk",
        label: "×",
        type: typeRole.rowTitle,
        rect: {
          x: rect.x + rect.width - buttonSize - 8,
          y: rect.y + (rect.height - buttonSize) / 2,
          width: buttonSize,
          height: buttonSize,
        },
        onClick: () => roomToasts.dismiss(toast.id),
      });
      button.container.setDepth(2);
      this.#drawn.push({ toast, rect, panel, button });
    });
  }
}
