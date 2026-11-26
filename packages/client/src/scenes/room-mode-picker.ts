/**
 * "Choose a game mode" (the room host's picker, over the lobby): three boxes of cards, Standard, Epic and Competitive,
 * each with its own art, a comic title band and a tagline, and an info panel for the mode in focus. A tap or press
 * picks a box (on a desktop the pointer over a box shows its info first); the Play button hands the pick back to the
 * lobby, which does exactly what its old three buttons did (`scenes/room-lobby.ts`). Layout math is
 * `view/room-mode-picker.ts`. Every press is a tap (issue #227), and nothing here scrolls.
 *
 * The whole page is a Lit panel over the canvas (`dom/popup-sheet.ts`, an `mc-sheet`): the box, the title band, the
 * tiles with their villain art, halftone and flag, the info panel, the buttons. The scene keeps the press shield, the
 * focus route (ring in the panel layer), the room watch and the answers.
 */
import Phaser from "phaser";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import type { SheetBuilder } from "../dom/sheet-builder.js";
import { t } from "../i18n/translate.js";
import { onRoomState } from "../platform/room.js";
import { accent, signal, surface, typeRole } from "../tokens.js";
import { bangers, villainPicture } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
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
/** Taglines keep their case (Phaser did not capitalise them). */
const TAGLINE = { ...typeRole.label, uppercase: false };

export class RoomModePickerOverlay extends Phaser.Scene {
  #data: RoomModePickerData = { current: "standard", onChoose: () => undefined };
  #picked: RoomModeId = "standard";
  #over: RoomModeId | null = null;
  #layout: ModePickerLayout = modePickerLayout(375, 667);
  #size = { width: 375, height: 667 };
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;

  constructor() {
    super(SCENES.roomModePicker);
  }

  init(data: RoomModePickerData): void {
    this.#data = data;
    this.#picked = data.current;
    this.#over = null;
  }

  create(): void {
    this.#panel = new PopupSheet(
      this,
      (key) => {
        const mode = ROOM_MODES.find((m) => key === `mode:${m}`);
        if (mode) this.#pick(mode);
        else if (key === "play") this.#play();
        else if (key === "cancel") this.scene.stop();
      },
      // The pointer over a box (a desktop) shows its info first; off it, back to the pick's.
      (key, over) => {
        const mode = ROOM_MODES.find((m) => key === `mode:${m}`);
        if (!mode) return;
        if (over) this.#setOver(mode);
        else if (this.#over === mode) this.#setOver(null);
      },
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.scene.stop(),
      primary: () => "play",
      onFocusChange: (key) => this.#setOver(ROOM_MODES.find((m) => key === `mode:${m}`) ?? null),
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
    });
    this.#draw();
  }

  #pick(mode: RoomModeId): void {
    this.#picked = mode;
    this.#over = null;
    this.#draw();
  }

  /** Shows the info of the mode under the pointer or the ring (null: the pick's). */
  #setOver(mode: RoomModeId | null): void {
    if (mode === this.#over || !this.sys.isActive()) return;
    this.#over = mode;
    this.#build();
  }

  #play(): void {
    if (this.#picked !== this.#data.current) this.#data.onChoose(this.#picked);
    this.scene.stop();
  }

  #draw(): void {
    destroyChildren(this);
    const { width, height } = this.scale.gameSize;
    this.#size = { width, height };
    this.#layout = modePickerLayout(width, height);
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.#build();

    const l = this.#layout;
    const same = this.#picked === this.#data.current;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    for (const [i, mode] of ROOM_MODES.entries()) {
      const key = `mode:${mode}`;
      stops.set(key, { rect: l.tiles[i]!, activate: () => this.#pick(mode) });
      order.push(key);
    }
    stops.set("play", { rect: l.confirm, activate: () => (same ? undefined : this.#play()) });
    stops.set("cancel", { rect: l.cancel, activate: () => this.scene.stop() });
    order.push("play", "cancel");
    this.#route?.set(order, stops);
  }

  /** The panel's parts for the pick and the mode in focus, mounted now: a pick redraws all, a hover only the info. */
  #build(): void {
    const { width, height } = this.#size;
    const l = this.#layout;
    const compact = l.kind === "compact";
    const b = this.#panel.begin(width, height, 0.78);

    // The page: a paper box with a hard ink offset shadow, and the title band across its top.
    const { box } = l;
    b.box({ ...box, x: box.x + 6, y: box.y + 6 }, { fill: INK });
    b.box(box, { fill: PAPER });
    b.box(l.title, { fill: INK });
    b.box({ ...l.title, y: l.title.y + l.title.height - 5, height: 5 }, { fill: RED });
    b.box(box, { stroke: INK, strokeWidth: 4 });
    b.text(
      box.x + 16,
      l.title.y + (l.title.height - 5) / 2,
      t("room.modes.pick").toUpperCase(),
      bangers(compact ? 24 : 32),
      { color: PAPER, origin: [0, 0.5], fitWidth: box.width - 32 },
    );

    for (const [i, mode] of ROOM_MODES.entries()) this.#drawTile(b, mode, l.tiles[i]!, l);

    const label = t(ROOM_MODE_COPY[this.#picked].title);
    const same = this.#picked === this.#data.current;
    b.button({
      key: "cancel",
      rect: l.cancel,
      label: t("epic.sheet.close"),
      look: "secondary",
      type: typeRole.label,
    });
    b.button({
      key: "play",
      rect: l.confirm,
      label: same ? t("room.modes.current", { mode: label }) : t("room.modes.use", { mode: label }),
      look: "primary",
      type: typeRole.label,
      ...(same ? { disabled: true as const } : {}),
    });
    this.#drawInfo(b);
    this.#panel.mount(b, width, height);
  }

  /** One box of cards: its art, a halftone fade, the title band with the tagline, the pick's red frame and flag. */
  #drawTile(b: SheetBuilder, mode: RoomModeId, tile: Rect, l: ModePickerLayout): void {
    const copy = ROOM_MODE_COPY[mode];
    const picked = mode === this.#picked;
    const compact = l.kind === "compact";
    const lift = picked ? 6 : 0;
    const r: Rect = { ...tile, y: tile.y - lift };
    const { art, band } = tileParts(r, l.tagline);
    b.box({ ...r, x: r.x + 5, y: r.y + 5 }, { fill: INK });
    b.box(r, { fill: INK });

    const halves = copy.art.length;
    copy.art.forEach((id, i) => {
      const slot: Rect =
        halves === 1
          ? art
          : { x: art.x + (i * art.width) / halves, y: art.y, width: art.width / halves, height: art.height };
      b.image(slot, {
        src: villainPicture(id)?.url ?? null,
        fill: INK,
        cover: { x: 0.5, y: 0.3 },
        key: `art:${mode}:${i}`,
      });
    });
    if (halves > 1) {
      b.box({ x: art.x + art.width / 2 - 1.5, y: art.y, width: 3, height: art.height }, { fill: INK });
      b.text(art.x + art.width / 2, art.y + art.height * 0.4, "VS", bangers(compact ? 18 : 28), {
        color: PAPER,
        origin: [0.5, 0.5],
        angle: -8,
        stroke: { color: INK, width: 5 },
      });
    }

    // Halftone: ink dots thickening toward the band, the way the comic pages shade a panel's foot.
    b.halftone(art, {
      color: INK,
      step: compact ? 6 : 8,
      fade: Math.min(art.height * 0.4, 70),
      alpha: 0.85,
    });

    // The title band.
    b.box(band, { fill: INK });
    b.box({ x: band.x, y: band.y, width: band.width, height: 4 }, { fill: picked ? RED : YELLOW });
    const titleSize = compact ? 18 : l.kind === "strip" ? 28 : 30;
    const titleSpec = bangers(titleSize);
    const name = t(copy.title).toUpperCase();
    const nameY = band.y + 6 + (l.tagline ? 0 : (band.height - 6) / 2 - 2);
    b.text(band.x + band.width / 2, nameY, name, titleSpec, {
      color: PAPER,
      origin: [0.5, l.tagline ? 0 : 0.5],
      fitWidth: band.width - 10,
    });
    if (l.tagline) {
      const nameHeight = b.measure(name, titleSpec).height;
      b.text(band.x + band.width / 2, nameY + nameHeight + 2, t(copy.tagline), TAGLINE, {
        color: YELLOW,
        size: 12,
        italic: true,
        align: "center",
        origin: [0.5, 0],
        wrapWidth: band.width - 16,
      });
    }

    // The frame: ink for a box, heavy red for the picked one, with a flag that says so without colour.
    b.box(r, { stroke: picked ? RED : INK, strokeWidth: picked ? 5 : 3 });
    if (picked) {
      const flagSpec = bangers(compact ? 16 : 22);
      const flag = b.measure("✔", flagSpec);
      const fw = flag.width + 12;
      const fh = flag.height + 4;
      b.box(
        { x: r.x + r.width - fw - 2, y: r.y + 2, width: fw, height: fh },
        { fill: YELLOW, stroke: INK, strokeWidth: 2 },
      );
      b.text(r.x + r.width - 8, r.y + 4, "✔", flagSpec, { color: INK, origin: [1, 0] });
    }

    // The press: the whole box. The pointer over it (a desktop) shows its info first.
    b.tap(`mode:${mode}`, r, { track: true });
  }

  /** The info panel for the mode in focus: a caption panel with the mode's name, tagline and four labelled facts. */
  #drawInfo(b: SheetBuilder): void {
    const l = this.#layout;
    const mode = modeInFocus(this.#picked, this.#over);
    const copy = ROOM_MODE_COPY[mode];
    const { info } = l;
    const compact = l.kind === "compact";
    b.box({ ...info, x: info.x + 5, y: info.y + 5 }, { fill: INK });
    b.box(info, { fill: PAPER, stroke: INK, strokeWidth: 3 });
    // The notch up to the tile this describes, where the info sits under the tiles.
    if (l.kind !== "side") {
      const tile = l.tiles[ROOM_MODES.indexOf(mode)]!;
      const cx = tile.x + tile.width / 2;
      b.poly(
        [
          [cx - 12, info.y],
          [cx + 12, info.y],
          [cx, info.y - 11],
        ],
        { fill: YELLOW },
      );
      b.poly(
        [
          [cx - 12, info.y],
          [cx, info.y - 11],
          [cx + 12, info.y],
        ],
        { stroke: INK, strokeWidth: 3 },
      );
    }

    const pad = compact ? 10 : 16;
    const x = info.x + pad;
    const w = info.width - pad * 2;
    // The header strip: the mode's name in Bangers on caution yellow, then its tagline.
    const headH = compact ? 34 : 46;
    b.box({ ...info, height: headH }, { fill: YELLOW, stroke: INK, strokeWidth: 3 });
    b.text(x, info.y + headH / 2, t(copy.title).toUpperCase(), bangers(compact ? 22 : 30), {
      color: surface.inkOnHue.hex,
      origin: [0, 0.5],
      fitWidth: w * 0.5,
    });
    b.text(info.x + info.width - pad, info.y + headH / 2, t(copy.tagline), TAGLINE, {
      color: surface.inkOnHue.hex,
      size: compact ? 11 : 13,
      italic: true,
      origin: [1, 0.5],
      align: "right",
      wrapWidth: w * 0.5,
    });

    // The facts: shrink the type until all four fit the panel.
    const avail = info.height - headH - pad - 6;
    const sizes = compact
      ? [15, 14, 13, 12, 11, 10]
      : l.kind === "strip"
        ? [20, 19, 18, 17, 16, 15, 14, 13, 12, 11]
        : [19, 18, 17, 16, 15, 14, 13, 12, 11];
    const smallest = compact ? 10 : 11;
    for (const size of sizes) {
      const placed: { y: number; label: string; text: string }[] = [];
      let y = info.y + headH + pad * 0.8;
      for (const fact of copy.facts) {
        const label = t(fact.label).toUpperCase();
        const text = t(fact.text);
        placed.push({ y, label, text });
        const labelHeight = b.measure(label, typeRole.label, { size: size - 2 }).height;
        const bodyHeight = b.measure(text, typeRole.body, { size, wrapWidth: w }).height;
        y += labelHeight + bodyHeight + (compact ? 6 : 10);
      }
      if (y - (info.y + headH) <= avail + pad || size === smallest) {
        for (const fact of placed) {
          const labelHeight = b.measure(fact.label, typeRole.label, { size: size - 2 }).height;
          b.text(x, fact.y, fact.label, typeRole.label, { color: RED, size: size - 2 });
          b.text(x, fact.y + labelHeight, fact.text, typeRole.body, { color: INK, size, wrapWidth: w });
        }
        break;
      }
    }
  }
}
