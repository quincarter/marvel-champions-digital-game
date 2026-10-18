/**
 * "Now playing" with Shuffle and Next (#191): the head of the music player popover (`scenes/music-player.ts`), and,
 * expanded, the player at the top of Extras' Music tab (`scenes/extras.ts`), where it also shows how far through the
 * song it is.
 *
 * Compact: an ink strip (the note, the song, what is playing it), then Shuffle and Next under it.
 * Expanded: a taller ink block with the song in Bangers and a progress bar; Shuffle and Next stand at its right on a
 * wide screen, and under it on a phone.
 * Either way the last row is Pause (or Play) and, on a desktop form factor only, the music volume slider with its −
 * and + (#243): a phone or tablet player uses the device's own volume. The volume is a
 * setting (`Settings.musicVolume`), heard as the slider moves and saved when it is let go; the pause is the music
 * controller's, for this session.
 */
import type Phaser from "phaser";
import { accent, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { appSession } from "../session.js";
import { clockOf, nowPlayingTitleOf, steppedVolume, volumeAtTrack, type PlayerSong } from "../view/music-player.js";
import { clampMusicVolume } from "../settings.js";
import { hasDesktopWindow } from "../platform/desktop-window.js";
import { followsWindowsMixer, knownMixerVolume, readMixerVolume, writeMixerVolume } from "../platform/app-volume.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { bangers } from "./campaign-chrome.js";
import { drawMusicIcon } from "./music-icon.js";
import { textStyle } from "./theme.js";
import { McButton, fitText } from "./widgets.js";

const BUTTON_TYPE: TypeSpec = { ...typeRole.label, size: 12 };
const STRIP = 60;
const BLOCK = 116;
const CONTROL = 40;
const GAP = 8;
/** At this width an expanded panel keeps Shuffle and Next beside the song rather than under it. */
const SIDE_BY_SIDE_MIN = 560;
const SIDE_BUTTON_WIDTH = 150;

const PAUSE_WIDTH = 104;
const STEP_WIDTH = 40;
const PERCENT_WIDTH = 46;
const VOLUME_ROW_MAX = 520;

export function nowPlayingPanelHeight(expanded: boolean, width: number): number {
  const volumeRow = GAP + CONTROL;
  if (!expanded) return STRIP + GAP + CONTROL + volumeRow;
  return (width >= SIDE_BY_SIDE_MIN ? BLOCK : BLOCK + GAP + CONTROL) + volumeRow;
}

/** The ids of the panel's focus stops, in order. */
export type NowPlayingStopId = "shuffle" | "next" | "pause" | "volume-down" | "volume-up";

export interface NowPlayingPanel {
  readonly height: number;
  readonly buttons: readonly McButton[];
  /** Focus stops for Shuffle and Next, in order. */
  readonly stops: readonly { readonly id: NowPlayingStopId; readonly rect: Rect; readonly activate: () => void }[];
  /** Moves the progress bar on (expanded only); call it every frame. */
  tick(): void;
}

export function drawNowPlayingPanel(
  scene: Phaser.Scene,
  options: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly expanded: boolean;
    readonly songs: readonly PlayerSong[];
    /** After Shuffle or Next changed what plays: redraw. */
    readonly onChange: () => void;
  },
): NowPlayingPanel {
  const { x, y, width, expanded, songs } = options;
  const session = appSession();
  const music = session.music;
  const playing = music?.nowPlaying() ?? null;
  const shuffle = session.settings.musicShuffle;
  const side = expanded && width >= SIDE_BY_SIDE_MIN;
  const blockHeight = expanded ? BLOCK : STRIP;
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(x, y, width, blockHeight);

  const noteSize = expanded ? 44 : 26;
  const note = scene.add.graphics();
  drawMusicIcon(note, x + 14 + noteSize / 2, y + blockHeight / 2, noteSize, surface.paper.hex);
  note.setAlpha(playing ? 1 : ink.disabled);
  const textX = x + 28 + noteSize;
  const textRight = side ? x + width - SIDE_BUTTON_WIDTH - 28 : x + width - 14;
  const textWidth = textRight - textX;

  scene.add.text(
    textX,
    y + (expanded ? 16 : 10),
    playing ? (music?.paused() ? "PAUSED" : "NOW PLAYING") : "NOTHING PLAYING",
    textStyle(typeRole.label, signal.caution.hex),
  );
  const song = playing ? songs.find((one) => one.track.key === playing.key) : undefined;
  if (playing) {
    const titleSize = expanded ? 30 : 16;
    const title = scene.add
      .text(
        textX,
        y + (expanded ? 32 : 24),
        expanded ? nowPlayingTitleOf(playing).toUpperCase() : nowPlayingTitleOf(playing),
        textStyle(expanded ? bangers(titleSize) : typeRole.rowTitle, surface.paper.hex),
      )
      .setFontSize(titleSize);
    fitText(title, textWidth, titleSize);
    const mode = shuffle ? "Shuffling earned songs" : song ? "Repeating this song" : "This screen's own music";
    const detail = scene.add
      .text(
        textX,
        y + (expanded ? 66 : 44),
        expanded && song ? `${mode} · ${song.where}` : mode,
        textStyle(typeRole.body, surface.paper.hex, ink.secondary),
      )
      .setFontSize(expanded ? 12 : 10);
    fitText(detail, textWidth, expanded ? 12 : 10);
  }

  // The progress bar and its clock (expanded only), moved on by `tick`.
  let tick = (): void => {};
  if (expanded) {
    const barY = y + 92;
    const clock = scene.add
      .text(textRight, barY + 3, "", textStyle(typeRole.label, surface.paper.hex, ink.secondary))
      .setOrigin(1, 0.5);
    const bar = scene.add.graphics();
    let last = "";
    tick = () => {
      const progress = appSession().music?.progress() ?? null;
      const text = progress ? `${clockOf(progress.seek)} / ${clockOf(progress.duration)}` : "";
      if (text !== last) {
        last = text;
        clock.setText(text);
      }
      const barWidth = Math.max(0, textRight - textX - (clock.width || 76) - 12);
      const share = progress && progress.duration > 0 ? Math.min(1, progress.seek / progress.duration) : 0;
      bar.clear();
      bar.fillStyle(surface.paper.hex, 0.22).fillRect(textX, barY, barWidth, 6);
      bar.fillStyle(accent.heroRed.hex, 1).fillRect(textX, barY, barWidth * share, 6);
    };
    tick();
  }

  // Shuffle and Next.
  const enabled = songs.length > 0;
  let shuffleRect: Rect;
  let nextRect: Rect;
  if (side) {
    const bx = x + width - 14 - SIDE_BUTTON_WIDTH;
    shuffleRect = { x: bx, y: y + 14, width: SIDE_BUTTON_WIDTH, height: CONTROL };
    nextRect = { x: bx, y: y + 14 + CONTROL + GAP, width: SIDE_BUTTON_WIDTH, height: CONTROL };
  } else {
    const half = (width - GAP) / 2;
    const rowY = y + blockHeight + GAP;
    shuffleRect = { x, y: rowY, width: half, height: CONTROL };
    nextRect = { x: x + half + GAP, y: rowY, width: half, height: CONTROL };
  }
  const toggleShuffle = (): void => {
    if (!enabled) return;
    const next = { ...session.settings, musicShuffle: !session.settings.musicShuffle };
    session.music?.syncSettings(next);
    session.settings = next;
    options.onChange();
  };
  const skip = (): void => {
    if (!enabled) return;
    session.music?.next();
    options.onChange();
  };
  // On the ink block the buttons wear the bar's own skin; under it, the paper one.
  const kind = side ? "onInk" : "secondary";
  const buttons = [
    new McButton(scene, {
      kind,
      label: shuffle ? "Shuffle: on" : "Shuffle: off",
      type: BUTTON_TYPE,
      rect: shuffleRect,
      selected: shuffle,
      enabled,
      reason: "Earn a song first",
      onClick: toggleShuffle,
    }),
    new McButton(scene, {
      kind,
      label: "Next ▸▸",
      type: BUTTON_TYPE,
      rect: nextRect,
      enabled,
      reason: "Earn a song first",
      onClick: skip,
    }),
  ];

  // Pause and the volume, on the row under everything else.
  const rowY = y + nowPlayingPanelHeight(expanded, width) - CONTROL;
  const { width: screenWidth, height: screenHeight } = scene.scale.gameSize;
  const desktop = hasDesktopWindow() || formFactorFor(screenWidth, screenHeight) === "desktop";
  const volume = drawVolumeRow(scene, { x, y: rowY, width }, desktop, options.onChange);
  buttons.push(...volume.buttons);
  return {
    height: nowPlayingPanelHeight(expanded, width),
    buttons,
    stops: [
      { id: "shuffle", rect: shuffleRect, activate: toggleShuffle },
      { id: "next", rect: nextRect, activate: skip },
      ...volume.stops,
    ],
    tick,
  };
}

/**
 * Pause (Play while paused), then − , the slider and + with the percent. A press anywhere on the track sets the volume
 * there and a drag moves it, heard as it goes; letting go saves it. − and + step it by `MUSIC_VOLUME_STEP`
 * (`steppedVolume`), and are the keyboard's way to it. Without the slider (off a desktop form factor), Pause alone
 * takes the row.
 */
function drawVolumeRow(
  scene: Phaser.Scene,
  row: { readonly x: number; readonly y: number; readonly width: number },
  withSlider: boolean,
  onChange: () => void,
): { readonly buttons: McButton[]; readonly stops: NowPlayingPanel["stops"] } {
  const session = appSession();
  const music = session.music;
  const paused = music?.paused() ?? false;
  const togglePause = (): void => {
    if (!music) return;
    if (music.paused()) music.resume();
    else music.pause();
    onChange();
  };
  const pauseButton = (rect: Rect): McButton =>
    new McButton(scene, {
      kind: "secondary",
      label: paused ? "▶ Play" : "❚❚ Pause",
      type: BUTTON_TYPE,
      rect,
      selected: paused,
      onClick: togglePause,
    });
  if (!withSlider) {
    const rect: Rect = { x: row.x, y: row.y, width: row.width, height: CONTROL };
    return { buttons: [pauseButton(rect)], stops: [{ id: "pause", rect, activate: togglePause }] };
  }
  // A wide screen (Extras' Music tab) keeps the slider a hand's width, not the whole screen's.
  const width = Math.min(row.width, VOLUME_ROW_MAX);
  const pauseRect: Rect = { x: row.x, y: row.y, width: PAUSE_WIDTH, height: CONTROL };
  const downRect: Rect = { x: row.x + PAUSE_WIDTH + GAP, y: row.y, width: STEP_WIDTH, height: CONTROL };
  const upRect: Rect = {
    x: row.x + width - PERCENT_WIDTH - STEP_WIDTH,
    y: row.y,
    width: STEP_WIDTH,
    height: CONTROL,
  };
  const knob = 9;
  const track = {
    x: downRect.x + STEP_WIDTH + 10 + knob,
    width: Math.max(0, upRect.x - 10 - knob - (downRect.x + STEP_WIDTH + 10 + knob)),
  };
  const midY = row.y + CONTROL / 2;

  // In the Windows app the slider is the game's own entry in the Windows volume mixer; elsewhere, the music volume.
  const mixer = followsWindowsMixer();
  let shown = clampMusicVolume(mixer ? (knownMixerVolume() ?? 100) : session.settings.musicVolume);
  const bar = scene.add.graphics();
  const percent = scene.add.text(row.x + width, midY, "", textStyle(typeRole.label, surface.ink.hex)).setOrigin(1, 0.5);
  const paint = (): void => {
    bar.clear();
    bar.fillStyle(surface.ink.hex, 0.18).fillRect(track.x, midY - 3, track.width, 6);
    const at = track.x + (track.width * shown) / 100;
    bar.fillStyle(accent.heroRed.hex, 1).fillRect(track.x, midY - 3, at - track.x, 6);
    bar.fillStyle(surface.paper.hex, 1).fillCircle(at, midY, knob);
    bar.lineStyle(2, surface.ink.hex, 1).strokeCircle(at, midY, knob);
    percent.setText(`${shown}%`);
  };
  paint();
  /** Heard now; saved only when `save` (a drag saves once, on release). */
  const set = (volume: number, save: boolean): void => {
    shown = clampMusicVolume(volume);
    if (mixer) {
      writeMixerVolume(shown);
      paint();
      return;
    }
    const next = { ...session.settings, musicVolume: shown };
    music?.syncSettings(next);
    if (save) session.settings = next;
    paint();
  };

  // The mixer may have moved since the panel was drawn last: read it, and show it if it changed.
  if (mixer) {
    void readMixerVolume().then((read) => {
      if (read === null || read === shown || !bar.active) return;
      shown = read;
      paint();
    });
  }

  const zone = scene.add
    .zone(track.x - knob, row.y, track.width + knob * 2, CONTROL)
    .setOrigin(0, 0)
    .setInteractive({ draggable: true, useHandCursor: true });
  zone.setName("music-volume");
  zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => set(volumeAtTrack(pointer.x, track), false));
  zone.on("drag", (pointer: Phaser.Input.Pointer) => set(volumeAtTrack(pointer.x, track), false));
  zone.on("dragend", () => set(shown, true));
  zone.on("pointerup", () => set(shown, true));

  const step = (direction: -1 | 1): void => set(steppedVolume(shown, direction), true);
  const buttons = [
    pauseButton(pauseRect),
    new McButton(scene, {
      kind: "quiet",
      label: "−",
      type: BUTTON_TYPE,
      rect: downRect,
      onClick: () => step(-1),
    }),
    new McButton(scene, {
      kind: "quiet",
      label: "+",
      type: BUTTON_TYPE,
      rect: upRect,
      onClick: () => step(1),
    }),
  ];
  return {
    buttons,
    stops: [
      { id: "pause", rect: pauseRect, activate: togglePause },
      { id: "volume-down", rect: downRect, activate: () => step(-1) },
      { id: "volume-up", rect: upRect, activate: () => step(1) },
    ],
  };
}
