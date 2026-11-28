/**
 * The body of the music player (`scenes/music-player.ts`) as `mc-sheet` parts: the header, "Now playing" with Shuffle,
 * Next and Pause (and, on a desktop form factor only, the volume slider), and the earned songs. It holds no state: the
 * scene hands in what is playing and what each control does, and reads the focus stops and rects back.
 */
import type { Track } from "../audio/music-catalog.js";
import type { SheetBuilder } from "../dom/sheet-builder.js";
import type { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { t } from "../i18n/translate.js";
import { accent, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { localizedWhere } from "../view/music-where.js";
import { PLAYER_FOOT_HEIGHT, PLAYER_ROW_HEIGHT, nowPlayingTitleOf, type PlayerSong } from "../view/music-player.js";
import type { FocusStop } from "./focus-route.js";

const BUTTON_TYPE: TypeSpec = { ...typeRole.label, size: 12 };
const STRIP = 60;
const CONTROL = 40;
const GAP = 8;
const HEAD = 44;
const PAUSE_WIDTH = 104;
/** The slider's own parts (`mc-sheet`): the − and + buttons and the percent it reads. */
const STEP_WIDTH = 36;
const PERCENT_WIDTH = 50;
const VOLUME_ROW_MAX = 520;

/** The song list's scroll region key. */
export const SONGS_KEY = "songs";

export interface MusicPlayerBodyOptions {
  readonly screen: { readonly width: number; readonly height: number };
  readonly panel: Rect;
  readonly icon: Rect;
  readonly phone: boolean;
  readonly songs: readonly PlayerSong[];
  readonly locked: number;
  readonly playing: Track | null;
  readonly paused: boolean;
  readonly shuffle: boolean;
  readonly volume: number;
  readonly withSlider: boolean;
  readonly actions: {
    readonly close: () => void;
    readonly outside: () => void;
    readonly shuffle: () => void;
    readonly next: () => void;
    readonly pause: () => void;
    readonly step: (direction: -1 | 1) => void;
    readonly play: (song: PlayerSong) => void;
  };
}

export interface MusicPlayerBody {
  /** What each key does when pressed. */
  readonly actions: Map<string, () => void>;
  readonly stops: Map<string, FocusStop>;
  readonly order: string[];
  readonly listRect: Rect;
  /** The slider's track box (a knob's radius past each end), or null where there is no slider. */
  readonly volumeRect: Rect | null;
}

export function drawMusicPlayerBody(
  b: SheetBuilder,
  glyphs: SheetGlyphs,
  options: MusicPlayerBodyOptions,
): MusicPlayerBody {
  const { screen, panel, icon, phone, songs, playing } = options;
  const actions = new Map<string, () => void>();
  const stops = new Map<string, FocusStop>();
  const order: string[] = [];
  const control = (key: string, rect: Rect, run: () => void): void => {
    actions.set(key, run);
    stops.set(key, { rect, activate: run });
    order.push(key);
  };

  // A tap outside the popover closes it; on a phone the panel is all there is below the bar.
  b.tap("outside", { x: 0, y: 0, width: screen.width, height: screen.height });
  actions.set("outside", options.actions.outside);
  if (!phone) b.box({ ...panel, x: panel.x + 6, y: panel.y + 6 }, { fill: surface.void.hex, fillAlpha: 0.28 });
  b.box(
    panel,
    phone ? { fill: surface.paper.hex } : { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 3 },
  );
  // The press area over the panel itself, so a press that misses a control is not "outside".
  b.tap("panel", panel);
  if (!phone) {
    // The caret up to the music button the popover hangs from.
    const cx = icon.x + icon.width / 2;
    b.poly(
      [
        [cx - 10, panel.y + 3],
        [cx + 10, panel.y + 3],
        [cx, panel.y - 8],
      ],
      { fill: surface.paper.hex },
    );
    b.poly(
      [
        [cx - 10, panel.y + 1.5],
        [cx, panel.y - 8],
        [cx + 10, panel.y + 1.5],
      ],
      { stroke: surface.ink.hex, strokeWidth: 3 },
    );
  }

  const pad = phone ? 16 : 14;
  const inner = { x: panel.x + pad, width: panel.width - pad * 2 };
  let y = panel.y + (phone ? 6 : 4);

  // Header: Back (phone) or ✕, the title and the earned count.
  const closeRect: Rect = phone
    ? { x: inner.x, y: y + (HEAD - 36) / 2, width: 92, height: 36 }
    : { x: inner.x + inner.width - 36, y: y + (HEAD - 36) / 2, width: 36, height: 36 };
  glyphs.button(b, {
    key: "close",
    rect: closeRect,
    label: phone ? `◂ ${t("common.back")}` : "✕",
    look: "quiet",
    type: BUTTON_TYPE,
    ids: ["cancel"],
    ground: "paper",
  });
  control("close", closeRect, options.actions.close);
  const titleX = phone ? closeRect.x + closeRect.width + 12 : inner.x;
  b.text(titleX, y + HEAD / 2, t("music.player.title"), typeRole.sectionHeader, {
    color: surface.ink.hex,
    origin: [0, 0.5],
  });
  b.text(
    phone ? inner.x + inner.width : closeRect.x - 10,
    y + HEAD / 2,
    t("music.player.earned", { count: songs.length, total: songs.length + options.locked }),
    typeRole.label,
    { color: surface.ink.hex, alpha: ink.secondary, origin: [1, 0.5] },
  );
  y += HEAD;

  // Now playing.
  const song = playing ? songs.find((one) => one.track.key === playing.key) : undefined;
  b.box({ x: inner.x, y, width: inner.width, height: STRIP }, { fill: surface.ink.hex });
  b.text(inner.x + 14 + 13, y + STRIP / 2, "♪", typeRole.sectionHeader, {
    color: surface.paper.hex,
    alpha: playing ? 1 : ink.disabled,
    size: 26,
    origin: [0.5, 0.5],
  });
  const textX = inner.x + 28 + 26;
  const textWidth = inner.x + inner.width - 14 - textX;
  b.text(
    textX,
    y + 10,
    playing ? (options.paused ? t("music.paused") : t("music.nowPlaying")) : t("music.nothingPlaying"),
    typeRole.label,
    { color: signal.caution.hex },
  );
  if (playing) {
    b.text(textX, y + 24, nowPlayingTitleOf(playing), typeRole.rowTitle, {
      color: surface.paper.hex,
      size: 16,
      fitWidth: textWidth,
    });
    const mode = options.shuffle ? t("music.shuffling") : song ? t("music.repeating") : t("music.screenOwn");
    b.text(textX, y + 44, mode, typeRole.body, {
      color: surface.paper.hex,
      alpha: ink.secondary,
      size: 10,
      fitWidth: textWidth,
    });
  }
  y += STRIP + GAP;

  // Shuffle and Next.
  const enabled = songs.length > 0;
  const half = (inner.width - GAP) / 2;
  const shuffleRect: Rect = { x: inner.x, y, width: half, height: CONTROL };
  const nextRect: Rect = { x: inner.x + half + GAP, y, width: half, height: CONTROL };
  const reason = t("music.earnFirst");
  glyphs.button(b, {
    key: "shuffle",
    rect: shuffleRect,
    label: options.shuffle ? t("music.shuffleOn") : t("music.shuffleOff"),
    look: "secondary",
    type: BUTTON_TYPE,
    selected: options.shuffle,
    ...(enabled ? {} : { disabled: reason }),
    ids: ["guide"],
    ground: "paper",
  });
  glyphs.button(b, {
    key: "next",
    rect: nextRect,
    label: t("music.next"),
    look: "secondary",
    type: BUTTON_TYPE,
    ...(enabled ? {} : { disabled: reason }),
    ids: ["zoneNext"],
    ground: "paper",
  });
  control("shuffle", shuffleRect, options.actions.shuffle);
  control("next", nextRect, options.actions.next);
  y += CONTROL + GAP;

  // Pause (Play while paused), then on a desktop form factor − , the slider and + with the percent.
  const volumeY = y;
  let volumeRect: Rect | null = null;
  const pauseRect: Rect = {
    x: inner.x,
    y: volumeY,
    width: options.withSlider ? PAUSE_WIDTH : inner.width,
    height: CONTROL,
  };
  glyphs.button(b, {
    key: "pause",
    rect: pauseRect,
    label: options.paused ? t("music.play") : t("music.pause"),
    look: "secondary",
    type: BUTTON_TYPE,
    selected: options.paused,
    ids: ["activate"],
    ground: "paper",
  });
  control("pause", pauseRect, options.actions.pause);
  if (options.withSlider) {
    const width = Math.min(inner.width - PAUSE_WIDTH - GAP, VOLUME_ROW_MAX - PAUSE_WIDTH - GAP);
    const slider: Rect = { x: inner.x + PAUSE_WIDTH + GAP, y: volumeY, width, height: CONTROL };
    b.slider({
      key: "volume",
      rect: slider,
      share: options.volume / 100,
      label: `${options.volume}%`,
      ground: "paper",
      stepLabels: ["−", "+"],
    });
    const down: Rect = { x: slider.x, y: slider.y, width: STEP_WIDTH, height: CONTROL };
    const up: Rect = {
      x: slider.x + width - PERCENT_WIDTH - STEP_WIDTH,
      y: slider.y,
      width: STEP_WIDTH,
      height: CONTROL,
    };
    control("volume-down", down, () => options.actions.step(-1));
    control("volume-up", up, () => options.actions.step(1));
    volumeRect = {
      x: slider.x + STEP_WIDTH + 10,
      y: slider.y,
      width: width - PERCENT_WIDTH - STEP_WIDTH - 10 - (STEP_WIDTH + 10),
      height: CONTROL,
    };
  }
  y += CONTROL + GAP;

  // The songs.
  const listRect: Rect = {
    x: inner.x,
    y,
    width: inner.width,
    height: Math.max(PLAYER_ROW_HEIGHT, panel.y + panel.height - PLAYER_FOOT_HEIGHT - y),
  };
  if (songs.length === 0) {
    b.text(listRect.x, listRect.y + 8, t("music.player.none"), typeRole.body, {
      color: surface.ink.hex,
      alpha: ink.secondary,
      size: 13,
    });
  } else {
    b.scroll(SONGS_KEY, listRect, songs.length * PLAYER_ROW_HEIGHT, (inner2) => {
      songs.forEach((one, index) => {
        songRow(inner2, one, index, listRect, one.track.key === playing?.key);
      });
    });
    songs.forEach((one, index) => {
      const key = `song:${one.id}`;
      const rect: Rect = {
        x: listRect.x,
        y: listRect.y + index * PLAYER_ROW_HEIGHT,
        width: listRect.width - 10,
        height: PLAYER_ROW_HEIGHT,
      };
      actions.set(key, () => options.actions.play(one));
      stops.set(key, { rect, activate: () => options.actions.play(one) });
      order.push(key);
    });
  }
  b.text(
    inner.x,
    panel.y + panel.height - PLAYER_FOOT_HEIGHT / 2,
    options.locked > 0 ? t("music.player.locked", { count: options.locked }) : t("music.player.all"),
    typeRole.body,
    { color: surface.ink.hex, alpha: ink.meta, size: 11, origin: [0, 0.5], fitWidth: inner.width },
  );
  return { actions, stops, order, listRect, volumeRect };
}

/** One song: a bordered row (ink while playing) with a red disc, the title and where it plays; the row is a tap. */
function songRow(b: SheetBuilder, song: PlayerSong, index: number, list: Rect, isPlaying: boolean): void {
  const top = index * PLAYER_ROW_HEIGHT;
  const row: Rect = { x: list.x, y: top + 3, width: list.width - 10, height: PLAYER_ROW_HEIGHT - 6 };
  b.box(row, {
    fill: isPlaying ? surface.ink.hex : surface.parchment.hex,
    stroke: surface.ink.hex,
    strokeWidth: 2,
  });
  const fg = isPlaying ? surface.paper.hex : surface.ink.hex;
  const disc = row.height - 14;
  const cx = row.x + 7 + disc / 2;
  const cy = row.y + row.height / 2;
  b.box({ x: cx - disc / 2, y: cy - disc / 2, width: disc, height: disc }, { fill: accent.heroRed.hex, round: true });
  b.text(cx + (isPlaying ? 0 : 1), cy, isPlaying ? "♪" : "▶", typeRole.rowTitle, {
    color: surface.paper.hex,
    size: isPlaying ? 15 : 12,
    origin: [0.5, 0.5],
  });
  const textX = row.x + 14 + disc;
  const textWidth = row.x + row.width - 10 - textX;
  b.text(textX, row.y + 6, song.title, typeRole.rowTitle, { color: fg, size: 13, fitWidth: textWidth });
  const where = localizedWhere(song.where);
  b.text(textX, row.y + row.height - 18, isPlaying ? t("music.player.playing", { where }) : where, typeRole.body, {
    color: fg,
    alpha: ink.secondary,
    size: 10,
    fitWidth: textWidth,
  });
  b.tap(`song:${song.id}`, { x: list.x, y: top, width: list.width - 10, height: PLAYER_ROW_HEIGHT });
}
