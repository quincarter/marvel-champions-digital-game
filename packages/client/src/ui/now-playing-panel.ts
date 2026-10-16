/**
 * "Now playing" with Shuffle and Next (#191): the head of the music player popover (`scenes/music-player.ts`), and,
 * expanded, the player at the top of Extras' Music tab (`scenes/extras.ts`), where it also shows how far through the
 * song it is.
 *
 * Compact: an ink strip (the note, the song, what is playing it), then Shuffle and Next under it.
 * Expanded: a taller ink block with the song in Bangers and a progress bar; Shuffle and Next stand at its right on a
 * wide screen, and under it on a phone.
 */
import type Phaser from "phaser";
import { accent, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { appSession } from "../session.js";
import { clockOf, nowPlayingTitleOf, type PlayerSong } from "../view/music-player.js";
import type { Rect } from "../view/layout.js";
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

export function nowPlayingPanelHeight(expanded: boolean, width: number): number {
  if (!expanded) return STRIP + GAP + CONTROL;
  return width >= SIDE_BY_SIDE_MIN ? BLOCK : BLOCK + GAP + CONTROL;
}

export interface NowPlayingPanel {
  readonly height: number;
  readonly buttons: readonly McButton[];
  /** Focus stops for Shuffle and Next, in order. */
  readonly stops: readonly { readonly id: "shuffle" | "next"; readonly rect: Rect; readonly activate: () => void }[];
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
    playing ? "NOW PLAYING" : "NOTHING PLAYING",
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
  return {
    height: nowPlayingPanelHeight(expanded, width),
    buttons,
    stops: [
      { id: "shuffle", rect: shuffleRect, activate: toggleShuffle },
      { id: "next", rect: nextRect, activate: skip },
    ],
    tick,
  };
}
