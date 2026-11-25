/**
 * "Choose a game mode" (the room host's picker, over the lobby): three boxes of cards, Standard, Epic and Competitive,
 * each with its own art, a comic title band and a tagline, and an info panel for the mode in focus. A tap or press
 * picks a box (on a desktop the pointer over a box shows its info first); the Play button hands the pick back to the
 * lobby, which does exactly what its old three buttons did (`scenes/room-lobby.ts`). Layout math is
 * `view/room-mode-picker.ts`. Every press is `onTap` or `McButton` (issue #227), and nothing here scrolls.
 */
import Phaser from "phaser";
import { t } from "../i18n/translate.js";
import { onRoomState } from "../platform/room.js";
import { accent, signal, surface, typeRole } from "../tokens.js";
import { bangers, drawPicture, villainPicture } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { onTap } from "../ui/tap.js";
import { textStyle } from "../ui/theme.js";
import { McButton, fitText } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import {
  ROOM_MODES,
  ROOM_MODE_COPY,
  modeInFocus,
  modePickerLayout,
  tileParts,
  type ModePickerLayout,
  type RoomModeId,
} from "../view/room-mode-picker.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface RoomModePickerData {
  /** The mode the room is in now. */
  readonly current: RoomModeId;
  /** The Play press: the lobby's own choose. The sheet closes after it. */
  readonly onChoose: (mode: RoomModeId) => void;
  /** Watch the live room and close when it is gone (off for the dev preview, which has no room). */
  readonly watch?: boolean;
}

const INK = surface.ink.hex;
const PAPER = surface.paper.hex;
const RED = accent.heroRed.hex;
const YELLOW = signal.caution.hex;

export class RoomModePickerOverlay extends Phaser.Scene {
  #data: RoomModePickerData = { current: "standard", onChoose: () => undefined };
  #picked: RoomModeId = "standard";
  #over: RoomModeId | null = null;
  #layout: ModePickerLayout = modePickerLayout(375, 667);
  #buttons: McButton[] = [];
  #infoNodes: Phaser.GameObjects.GameObject[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.roomModePicker);
  }

  init(data: RoomModePickerData): void {
    this.#data = data;
    this.#picked = data.current;
    this.#over = null;
  }

  create(): void {
    this.#route = new FocusRoute(this, {
      onCancel: () => this.scene.stop(),
      primary: () => "play",
      onFocusChange: (key) => {
        const mode = ROOM_MODES.find((m) => key === `mode:${m}`) ?? null;
        if (mode === this.#over) return;
        this.#over = mode;
        this.#drawInfo();
      },
    });
    const redraw = (): void => this.#draw();
    this.scale.on("resize", redraw, this);
    // The room ending, the connection ending, or the host losing the lobby (a game started) closes the picker: Play
    // would otherwise send a change to a room that is gone.
    const off = this.#data.watch
      ? onRoomState((state) => {
          if (state.role !== "host" || state.connection === "ended" || state.started) this.scene.stop();
        })
      : null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", redraw, this);
      off?.();
      this.#clearButtons();
    });
    this.#draw();
  }

  #clearButtons(): void {
    for (const b of this.#buttons) b.destroy();
    this.#buttons = [];
  }

  #pick(mode: RoomModeId): void {
    this.#picked = mode;
    this.#over = null;
    this.#draw();
  }

  #draw(): void {
    this.#clearButtons();
    destroyChildren(this);
    this.#infoNodes = [];
    const { width, height } = this.scale.gameSize;
    const l = modePickerLayout(width, height);
    this.#layout = l;
    const compact = l.kind === "compact";

    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.78).fillRect(0, 0, width, height);

    // The page: a paper box with a hard ink offset shadow, and the title band across its top.
    const g = this.add.graphics();
    const { box } = l;
    g.fillStyle(INK, 1).fillRect(box.x + 6, box.y + 6, box.width, box.height);
    g.fillStyle(PAPER, 1).fillRect(box.x, box.y, box.width, box.height);
    g.fillStyle(INK, 1).fillRect(l.title.x, l.title.y, l.title.width, l.title.height);
    g.fillStyle(RED, 1).fillRect(l.title.x, l.title.y + l.title.height - 5, l.title.width, 5);
    g.lineStyle(4, INK, 1).strokeRect(box.x, box.y, box.width, box.height);
    const heading = this.add
      .text(
        box.x + 16,
        l.title.y + (l.title.height - 5) / 2,
        t("room.modes.pick").toUpperCase(),
        textStyle(bangers(compact ? 24 : 32), PAPER),
      )
      .setOrigin(0, 0.5);
    fitText(heading, box.width - 32, compact ? 24 : 32);

    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    for (const [i, mode] of ROOM_MODES.entries()) {
      const tile = l.tiles[i]!;
      this.#drawTile(mode, tile, l);
      const key = `mode:${mode}`;
      stops.set(key, { rect: tile, activate: () => this.#pick(mode) });
      order.push(key);
    }

    const label = t(ROOM_MODE_COPY[this.#picked].title);
    const same = this.#picked === this.#data.current;
    const play = (): void => {
      if (!same) this.#data.onChoose(this.#picked);
      this.scene.stop();
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: t("epic.sheet.close"),
        type: typeRole.label,
        rect: l.cancel,
        onClick: () => this.scene.stop(),
      }),
      new McButton(this, {
        kind: "primary",
        label: same ? t("room.modes.current", { mode: label }) : t("room.modes.use", { mode: label }),
        type: typeRole.label,
        rect: l.confirm,
        enabled: !same,
        onClick: play,
        wrap: true,
      }),
    );
    stops.set("play", { rect: l.confirm, activate: () => (same ? undefined : play()) });
    stops.set("cancel", { rect: l.cancel, activate: () => this.scene.stop() });
    order.push("play", "cancel");
    this.#route?.set(order, stops);
    this.#drawInfo();
  }

  /** One box of cards: its art, a halftone fade, the title band with the tagline, the pick's red frame and flag. */
  #drawTile(mode: RoomModeId, tile: Rect, l: ModePickerLayout): void {
    const copy = ROOM_MODE_COPY[mode];
    const picked = mode === this.#picked;
    const compact = l.kind === "compact";
    const lift = picked ? 6 : 0;
    const r: Rect = { ...tile, y: tile.y - lift };
    const { art, band } = tileParts(r, l.tagline);
    const g = this.add.graphics();
    g.fillStyle(INK, 1).fillRect(r.x + 5, r.y + 5, r.width, r.height);
    g.fillStyle(INK, 1).fillRect(r.x, r.y, r.width, r.height);

    const again = (): void => {
      if (this.sys.isActive()) this.#draw();
    };
    const halves = copy.art.length;
    copy.art.forEach((id, i) => {
      const slot: Rect =
        halves === 1
          ? art
          : { x: art.x + (i * art.width) / halves, y: art.y, width: art.width / halves, height: art.height };
      drawPicture(this, villainPicture(id), slot, again, { scaleToSlot: true, focusY: 0.3 });
    });
    if (halves > 1) {
      const mid = this.add.graphics();
      mid.lineStyle(3, INK, 1).lineBetween(art.x + art.width / 2, art.y, art.x + art.width / 2, art.y + art.height);
      const vs = this.add
        .text(art.x + art.width / 2, art.y + art.height * 0.4, "VS", textStyle(bangers(compact ? 18 : 28), PAPER))
        .setOrigin(0.5)
        .setStroke(cssInk(), 5);
      vs.setAngle(-8);
    }

    // Halftone: ink dots thickening toward the band, the way the comic pages shade a panel's foot.
    const dots = this.add.graphics();
    const step = compact ? 6 : 8;
    const fade = Math.min(art.height * 0.4, 70);
    dots.fillStyle(INK, 0.85);
    for (let row = 0; row * step < fade; row++) {
      const y = art.y + art.height - row * step - step / 2;
      const radius = Math.max(0.6, (step / 2) * (1 - (row * step) / fade) * 0.95);
      for (let x = art.x + (row % 2 ? step / 2 : 0) + step / 2; x < art.x + art.width; x += step) {
        dots.fillCircle(x, y, radius);
      }
    }

    // The title band.
    const bands = this.add.graphics();
    bands.fillStyle(INK, 1).fillRect(band.x, band.y, band.width, band.height);
    bands.fillStyle(picked ? RED : YELLOW, 1).fillRect(band.x, band.y, band.width, 4);
    const titleSize = compact ? 18 : l.kind === "strip" ? 28 : 30;
    const name = this.add
      .text(
        band.x + band.width / 2,
        band.y + 6 + (l.tagline ? 0 : (band.height - 6) / 2 - 2),
        t(copy.title).toUpperCase(),
        textStyle(bangers(titleSize), PAPER),
      )
      .setOrigin(0.5, l.tagline ? 0 : 0.5);
    fitText(name, band.width - 10, titleSize);
    if (l.tagline) {
      this.add
        .text(band.x + band.width / 2, name.y + name.height + 2, t(copy.tagline), {
          ...textStyle(typeRole.label, YELLOW),
          align: "center",
          fontStyle: "italic 800",
        })
        .setFontSize(12)
        .setWordWrapWidth(band.width - 16, true)
        .setOrigin(0.5, 0);
    }

    // The frame: ink for a box, heavy red for the picked one, with a flag that says so without colour.
    const frame = this.add.graphics();
    frame.lineStyle(picked ? 5 : 3, picked ? RED : INK, 1).strokeRect(r.x, r.y, r.width, r.height);
    if (picked) {
      const flag = this.add
        .text(r.x + r.width - 6, r.y + 6, "✔", textStyle(bangers(compact ? 16 : 22), INK))
        .setOrigin(1, 0);
      const fw = flag.width + 12;
      const fh = flag.height + 4;
      const back = this.add.graphics();
      back.fillStyle(YELLOW, 1).fillRect(r.x + r.width - fw - 2, r.y + 2, fw, fh);
      back.lineStyle(2, INK, 1).strokeRect(r.x + r.width - fw - 2, r.y + 2, fw, fh);
      this.children.bringToTop(flag);
      flag.setPosition(r.x + r.width - 8, r.y + 4);
    }

    // The press: the whole box. The pointer over it (a desktop) shows its info first.
    const zone = this.add.zone(r.x, r.y, r.width, r.height).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    onTap(zone, () => this.#pick(mode), `roommode:${mode}`);
    zone.on("pointerover", () => {
      if (this.#over === mode) return;
      this.#over = mode;
      this.#drawInfo();
    });
    zone.on("pointerout", () => {
      if (this.#over !== mode) return;
      this.#over = null;
      this.#drawInfo();
    });
  }

  /** The info panel for the mode in focus: a caption panel with the mode's name, tagline and four labelled facts. */
  #drawInfo(): void {
    for (const n of this.#infoNodes) n.destroy();
    this.#infoNodes = [];
    const l = this.#layout;
    const mode = modeInFocus(this.#picked, this.#over);
    const copy = ROOM_MODE_COPY[mode];
    const { info } = l;
    const add = <T extends Phaser.GameObjects.GameObject>(node: T): T => {
      this.#infoNodes.push(node);
      return node;
    };
    const compact = l.kind === "compact";
    const g = add(this.add.graphics());
    g.fillStyle(INK, 1).fillRect(info.x + 5, info.y + 5, info.width, info.height);
    g.fillStyle(PAPER, 1).fillRect(info.x, info.y, info.width, info.height);
    g.lineStyle(3, INK, 1).strokeRect(info.x, info.y, info.width, info.height);
    // The notch up to the tile this describes, where the info sits under the tiles.
    if (l.kind !== "side") {
      const tile = l.tiles[ROOM_MODES.indexOf(mode)]!;
      const cx = tile.x + tile.width / 2;
      g.fillStyle(YELLOW, 1).fillTriangle(cx - 12, info.y, cx + 12, info.y, cx, info.y - 11);
      g.lineStyle(3, INK, 1)
        .lineBetween(cx - 12, info.y, cx, info.y - 11)
        .lineBetween(cx + 12, info.y, cx, info.y - 11);
    }

    const pad = compact ? 10 : 16;
    const x = info.x + pad;
    const w = info.width - pad * 2;
    // The header strip: the mode's name in Bangers on caution yellow, then its tagline.
    const headH = compact ? 34 : 46;
    g.fillStyle(YELLOW, 1).fillRect(info.x, info.y, info.width, headH);
    g.lineStyle(3, INK, 1).strokeRect(info.x, info.y, info.width, headH);
    const name = add(
      this.add
        .text(
          x,
          info.y + headH / 2,
          t(copy.title).toUpperCase(),
          textStyle(bangers(compact ? 22 : 30), surface.inkOnHue.hex),
        )
        .setOrigin(0, 0.5),
    );
    fitText(name, w * 0.5, compact ? 22 : 30);
    add(
      this.add
        .text(info.x + info.width - pad, info.y + headH / 2, t(copy.tagline), {
          ...textStyle(typeRole.label, surface.inkOnHue.hex),
          fontStyle: "italic 800",
        })
        .setFontSize(compact ? 11 : 13)
        .setWordWrapWidth(w * 0.5, true)
        .setOrigin(1, 0.5)
        .setAlign("right"),
    );

    // The facts: shrink the type until all four fit the panel.
    const avail = info.height - headH - pad - 6;
    for (const size of compact
      ? [15, 14, 13, 12, 11, 10]
      : l.kind === "strip"
        ? [20, 19, 18, 17, 16, 15, 14, 13, 12, 11]
        : [19, 18, 17, 16, 15, 14, 13, 12, 11]) {
      const made: Phaser.GameObjects.Text[] = [];
      let y = info.y + headH + pad * 0.8;
      for (const fact of copy.facts) {
        const label = this.add
          .text(x, y, t(fact.label).toUpperCase(), { ...textStyle(typeRole.label, RED), fontStyle: "800" })
          .setFontSize(size - 2);
        const body = this.add
          .text(x, y + label.height, t(fact.text), textStyle(typeRole.body, INK))
          .setFontSize(size)
          .setWordWrapWidth(w, true);
        made.push(label, body);
        y += label.height + body.height + (compact ? 6 : 10);
      }
      if (y - (info.y + headH) <= avail + pad || size === (compact ? 10 : 11)) {
        for (const m of made) add(m);
        break;
      }
      for (const m of made) m.destroy();
    }
  }
}

const cssInk = (): string => `#${INK.toString(16).padStart(6, "0")}`;
