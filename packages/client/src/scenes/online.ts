/**
 * Play online (issue #880): "Host a room" or "Join a room" with its 6-character code. Only an entry point: nothing
 * online starts, no worker and no connection, until the player presses Host or Join, and a device with no connection (or a
 * service that is down) says so here, in a line, and leaves everything else in the game alone. The first time, the
 * player is asked for an online name (`scenes/online-name.ts`).
 *
 * Once the room answers, the lobby opens (`scenes/room-lobby.ts`); a room that cannot open is worded here
 * (`view/room-lobby-model.ts`), never on a screen that is already the lobby.
 */
import Phaser from "phaser";
import { t } from "../i18n/translate.js";
import { onRoomState, hostRoom, joinRoom, leaveRoom, onlineName } from "../platform/room.js";
import { surface, typeRole, hit } from "../tokens.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { textStyle } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { McButton, McTextInput, fitText } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import { joinTargetFromInput, tidyJoinInput } from "../view/room-join-input.js";
import { problemWords, wordsText } from "../view/room-lobby-model.js";
import { cssOf } from "../ui/theme.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { OnlineNameData } from "./online-name.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

export interface OnlineData {
  /** A room code or id from a `#join=` link: joined as soon as the screen is up (after a name, when none is set). */
  readonly join?: string;
  /** A `#join=` link that named no room. */
  readonly invalidLink?: boolean;
}

type Busy = null | "host" | "join";

export class OnlineScene extends Phaser.Scene {
  #data: OnlineData = {};
  #buttons: McButton[] = [];
  #input: McTextInput | null = null;
  #code = "";
  #busy: Busy = null;
  /** A line under the buttons: why the last try did not open a room. */
  #message: string | null = null;
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #alive = false;
  #off: (() => void) | null = null;

  constructor() {
    super(SCENES.online);
  }

  init(data: OnlineData): void {
    this.#data = data ?? {};
    this.#busy = null;
    this.#message = this.#data.invalidLink ? t("online.codeInvalid") : null;
    this.#code = "";
  }

  create(): void {
    this.#alive = true;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#hints = new GlyphHints(this);
    this.#route = new FocusRoute(this, {
      blocked: () => (this.#input?.focused ?? false) || this.scene.isActive(SCENES.onlineName),
      onCancel: () => this.#back(),
    });
    bindTextFieldEscape(
      this,
      () => this.#input,
      () => this.scene.isActive(SCENES.onlineName),
    );
    this.scale.on("resize", this.#draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#off?.();
      this.#off = null;
      this.#hints.dispose();
      this.scale.off("resize", this.#draw, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#input?.destroy();
      this.#input = null;
    });
    this.#draw();
    fadeScreenIn(this);
    if (this.#data.join) this.#startJoin(this.#data.join);
  }

  #back(): void {
    if (this.#busy) {
      this.#stopWaiting();
      leaveRoom();
      this.#busy = null;
      this.#draw();
      return;
    }
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.title);
  }

  /** Needs a name first: asks for one, then runs `then`. */
  #withName(then: () => void): void {
    if (onlineName() !== "") return then();
    this.scene.launch(SCENES.onlineName, {
      onDone: () => {
        if (this.#alive) {
          this.#draw();
          then();
        }
      },
    } satisfies OnlineNameData);
  }

  #offline(): boolean {
    const noNetwork = typeof navigator !== "undefined" && navigator.onLine === false;
    if (noNetwork || !syncServiceUrl()) {
      this.#message = t(noNetwork ? "online.offline" : "room.problem.noService");
      this.#draw();
      return true;
    }
    return false;
  }

  #host(): void {
    if (this.#busy || this.#offline()) return;
    this.#withName(() => {
      this.#busy = "host";
      this.#message = null;
      this.#watchFor();
      void hostRoom();
      this.#draw();
    });
  }

  #join(): void {
    if (this.#busy) return;
    const target = joinTargetFromInput(this.#input?.value ?? this.#code);
    if (!target) {
      this.#message = t("online.codeInvalid");
      this.#draw();
      return;
    }
    this.#startJoin(target);
  }

  #startJoin(target: string): void {
    // No connection (or no service): said here before a name is asked for.
    if (this.#offline()) return;
    this.#withName(() => {
      this.#busy = "join";
      this.#message = null;
      this.#watchFor();
      void joinRoom(target);
      this.#draw();
    });
  }

  /** Waits for the room to answer: on to the lobby once it is up, else the reason, here. */
  #watchFor(): void {
    this.#stopWaiting();
    this.#off = onRoomState((state) => {
      if (!this.#alive || !this.#busy) return;
      if (state.connection === "connected") {
        this.#stopWaiting();
        this.scale.off("resize", this.#draw, this);
        goToScreen(this, SCENES.roomLobby);
      } else if (state.connection === "ended") {
        this.#stopWaiting();
        this.#message = wordsText(problemWords(state.problem ?? "unavailable"));
        this.#busy = null;
        leaveRoom();
        this.#draw();
      }
    });
  }

  #stopWaiting(): void {
    this.#off?.();
    this.#off = null;
  }

  #draw(): void {
    if (!this.#alive) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    if (this.#input) this.#code = this.#input.value;
    this.#input?.destroy();
    this.#input = null;
    destroyChildren(this);
    this.#hints.reset();

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : `◂ ${t("online.back")}`,
      onBack: () => this.#back(),
      hints: phone ? null : this.#hints,
      title: t("online.title"),
    });
    if (bar.back) this.#buttons.push(bar.back);
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    if (bar.backRect) {
      stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
      order.push("back");
    }

    const column = Math.min(520, width - gutter * 2);
    const left = (width - column) / 2;
    let y = bar.height + 20;
    const busy = this.#busy !== null;

    // The name, with a way to change it.
    const name = onlineName();
    const nameLine = this.add
      .text(
        left,
        y + hit.target / 2,
        name ? t("online.playingAs", { name }) : t("online.nameTitle"),
        textStyle(typeRole.rowTitle, surface.ink.hex),
      )
      .setOrigin(0, 0.5);
    const changeRect: Rect = { x: left + column - 130, y, width: 130, height: hit.target };
    fitText(nameLine, column - 140, typeRole.rowTitle.size);
    const change = (): void => {
      this.scene.launch(SCENES.onlineName, { onDone: () => this.#alive && this.#draw() } satisfies OnlineNameData);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: name ? t("online.change") : t("online.nameSettingNone"),
        type: typeRole.label,
        rect: changeRect,
        enabled: !busy,
        onClick: change,
      }),
    );
    stops.set("name", { rect: changeRect, activate: change });
    order.push("name");
    y += hit.target + 18;

    // Host a room.
    y = this.#paragraph(left, y, column, t("online.hostDetail"));
    const hostRect: Rect = { x: left, y: y + 8, width: column, height: hit.primary };
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#busy === "host" ? t("online.connecting") : t("online.host"),
        type: bangers(22),
        rect: hostRect,
        enabled: !busy,
        onClick: () => this.#host(),
      }),
    );
    stops.set("host", { rect: hostRect, activate: () => this.#host() });
    order.push("host");
    y = hostRect.y + hostRect.height + 28;

    // Join a room.
    y = this.#paragraph(left, y, column, t("online.joinDetail"));
    const joinWidth = 110;
    const fieldRect: Rect = { x: left, y: y + 8, width: column - joinWidth - 10, height: hit.primary };
    this.#input = new McTextInput(this, {
      rect: fieldRect,
      value: this.#code,
      type: typeRole.body,
      placeholder: t("online.codePlaceholder"),
      maxLength: 80,
      onChange: (value) => {
        this.#code = value;
        const tidy = tidyJoinInput(value);
        if (tidy !== value) this.#input?.setValue(tidy);
      },
    });
    const joinRect: Rect = {
      x: fieldRect.x + fieldRect.width + 10,
      y: fieldRect.y,
      width: joinWidth,
      height: hit.primary,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: this.#busy === "join" ? "…" : t("online.joinGo"),
        type: typeRole.label,
        rect: joinRect,
        enabled: !busy,
        onClick: () => this.#join(),
      }),
    );
    stops.set("code", { rect: fieldRect, activate: () => this.#input?.focus() });
    stops.set("join", { rect: joinRect, activate: () => this.#join() });
    order.push("code", "join");
    y = fieldRect.y + fieldRect.height + 14;

    const message = this.#busy ? t("online.connecting") : this.#message;
    if (message) {
      this.add
        .text(left, y, message, textStyle(typeRole.rowTitle, surface.ink.hex))
        .setWordWrapWidth(column, true)
        .setFontSize(15);
    }
    this.#route?.set(order, stops);
  }

  #paragraph(x: number, y: number, width: number, text: string): number {
    const line = this.add
      .text(x, y, text, textStyle(typeRole.body, surface.ink.hex, 0.85))
      .setWordWrapWidth(width, true);
    return y + line.height;
  }
}
