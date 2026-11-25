/**
 * In-game room chat (issue #881): a compact sheet over the board of a room game, opened from the whose-turn row's Chat
 * control, Pause, or the host's "Message them" prompt (which opens it with "Are you still there?" ready to send). It
 * shows the newest lines that fit, a text field and Send, through `say()` and the room's chat lines. Never drawn over
 * the table: the board has the keyboard and the pad back when it closes. Modeled on `scenes/online-name.ts`.
 */
import Phaser from "phaser";
import { t } from "../i18n/translate.js";
import { onRoomState, roomState, say, type RoomState } from "../platform/room.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { textStyle } from "../ui/theme.js";
import { McButton, McTextInput } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import { markChatRead } from "../view/room-chat-unread.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

export interface RoomChatData {
  /** Text put in the field to send, when the sheet opens (the "Are you still there?" nudge). */
  readonly draft?: string;
}

const LINE_GAP = 4;
const buttonType = { ...typeRole.label, size: 13 };

export class RoomChatOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #input: McTextInput | null = null;
  #value = "";
  #state: RoomState = roomState();
  #route: FocusRoute | null = null;
  #off: (() => void) | null = null;
  #lastLines = -1;

  constructor() {
    super(SCENES.roomChat);
  }

  init(data: RoomChatData = {}): void {
    this.#value = data.draft ?? "";
    this.#lastLines = -1;
  }

  create(): void {
    this.#route = new FocusRoute(this, {
      blocked: () => this.#input?.focused ?? false,
      onCancel: () => this.#close(),
      primary: () => "send",
    });
    bindTextFieldEscape(this, () => this.#input);
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#off = onRoomState((state) => {
      const changed = state.chat.length !== this.#lastLines;
      this.#state = state;
      if (changed && this.sys.isActive()) this.#draw();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#off?.();
      this.#off = null;
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#input?.destroy();
      this.#input = null;
      markChatRead(roomState().chat);
    });
    this.#draw();
    this.#input?.focus();
  }

  #close(): void {
    markChatRead(this.#state.chat);
    this.scene.stop();
  }

  #send(): void {
    const text = (this.#input?.value ?? this.#value).trim();
    if (text === "") return;
    say(text);
    // Cleared before the redraw, which keeps what the field holds: a second press must not send it again.
    this.#input?.setValue("");
    this.#value = "";
    this.#draw();
    this.#input?.focus();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    const wasFocused = this.#input?.focused ?? false;
    if (this.#input) this.#value = this.#input.value;
    this.#input?.destroy();
    this.#input = null;
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);

    const boxWidth = Math.min(520, width - 24);
    const textWidth = boxWidth - 32;
    const boxHeight = Math.min(height - 24, 420);
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.max(12, (height - boxHeight) / 3),
      width: boxWidth,
      height: boxHeight,
    };
    const ground = this.add.graphics();
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    const title = this.add.text(box.x + 16, box.y + 14, t("chat.title"), textStyle(typeRole.barTitle, surface.ink.hex));
    const fieldHeight = hit.primary;
    const footer = fieldHeight + 10 + hit.target + 16;
    const listTop = title.y + title.height + 10;
    const listHeight = box.y + box.height - footer - listTop;
    this.#lastLines = this.#state.chat.length;
    const shown = this.#state.chat.slice(-60);
    if (shown.length === 0) {
      this.add.text(box.x + 16, listTop, t("chat.empty"), textStyle(typeRole.body, surface.ink.hex, 0.7));
    }
    // Newest first, each line wrapped whole, until the list is full; then laid out oldest to newest.
    const made: Phaser.GameObjects.Text[] = [];
    let used = 0;
    for (let index = shown.length - 1; index >= 0; index -= 1) {
      const line = shown[index]!;
      const who = line.mine ? "" : `${line.name ?? ""}: `;
      const text = this.add
        .text(0, 0, `${who}${line.text}`, textStyle(typeRole.body, surface.ink.hex))
        .setFontSize(13)
        .setFontStyle(line.mine ? "bold" : "normal")
        .setWordWrapWidth(textWidth, true);
      const height = text.height + LINE_GAP;
      if (used + height > listHeight && made.length > 0) {
        text.destroy();
        break;
      }
      used += height;
      made.unshift(text);
    }
    let at = listTop;
    for (const text of made) {
      text.setPosition(box.x + 16, at);
      at += text.height + LINE_GAP;
    }
    const fieldRect: Rect = {
      x: box.x + 16,
      y: box.y + box.height - footer + 8,
      width: textWidth,
      height: fieldHeight,
    };
    this.#input = new McTextInput(this, {
      rect: fieldRect,
      value: this.#value,
      type: typeRole.body,
      placeholder: t("chat.placeholder"),
      maxLength: 280,
      onChange: (value) => {
        this.#value = value;
      },
    });
    const half = (textWidth - 12) / 2;
    const buttonY = fieldRect.y + fieldHeight + 10;
    const closeRect: Rect = { x: box.x + 16, y: buttonY, width: half, height: hit.target };
    const sendRect: Rect = { x: closeRect.x + half + 12, y: buttonY, width: half, height: hit.target };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: t("chat.close"),
        type: buttonType,
        rect: closeRect,
        onClick: () => this.#close(),
      }),
      new McButton(this, {
        kind: "primary",
        label: t("chat.send"),
        type: buttonType,
        rect: sendRect,
        onClick: () => this.#send(),
      }),
    );
    const stops = new Map<string, FocusStop>([
      ["field", { rect: fieldRect, activate: () => this.#input?.focus() }],
      ["close", { rect: closeRect, activate: () => this.#close() }],
      ["send", { rect: sendRect, activate: () => this.#send() }],
    ]);
    this.#route?.set(["field", "close", "send"], stops);
    if (wasFocused) this.#input.focus();
  }
}
