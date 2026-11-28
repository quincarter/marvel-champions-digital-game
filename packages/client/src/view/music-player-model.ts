/**
 * What the music player pop-up (`scenes/music-player.ts`) hands its `mc-music-player` element: the header, "Now
 * playing", the controls, the volume and the earned songs, every word in the app's language. Pure: what is playing and
 * what is earned come in as arguments.
 */
import type { ControlGlyphs, MusicPlayerModel } from "@mc/ui";
import type { Track } from "../audio/music-catalog.js";
import { t } from "../i18n/translate.js";
import type { Rect } from "./layout.js";
import { nowPlayingTitleOf, playerPanelRect, type PlayerSong } from "./music-player.js";
import { localizedWhere } from "./music-where.js";

export interface MusicPlayerInput {
  readonly screen: { readonly width: number; readonly height: number };
  readonly phone: boolean;
  readonly icon: Rect;
  readonly songs: readonly PlayerSong[];
  readonly locked: number;
  readonly playing: Track | null;
  readonly paused: boolean;
  readonly shuffle: boolean;
  readonly volume: number;
  /** A volume slider is drawn (a desktop form factor). */
  readonly withSlider: boolean;
  readonly glyphs?: ControlGlyphs;
}

/** The panel's rect: a popover grows by the gaps between its parts, which the fixed rows of the old layout did not have. */
function panelOf(input: MusicPlayerInput): Rect {
  const panel = playerPanelRect(input.icon, input.screen, input.phone, input.songs.length);
  if (input.phone) return panel;
  return { ...panel, height: Math.min(panel.height + 40, input.screen.height - panel.y - 8) };
}

export function musicPlayerModelOf(input: MusicPlayerInput): MusicPlayerModel {
  const { songs, playing } = input;
  const song = playing ? songs.find((one) => one.track.key === playing.key) : undefined;
  const enabled = songs.length > 0;
  const reason = t("music.earnFirst");
  const mode = input.shuffle ? t("music.shuffling") : song ? t("music.repeating") : t("music.screenOwn");
  return {
    phone: input.phone,
    panel: panelOf(input),
    icon: input.icon,
    title: t("music.player.title"),
    earned: t("music.player.earned", { count: songs.length, total: songs.length + input.locked }),
    close: { key: "close", label: input.phone ? `◂ ${t("common.back")}` : "✕", kind: "quiet" },
    nowPlaying: {
      status: playing ? (input.paused ? t("music.paused") : t("music.nowPlaying")) : t("music.nothingPlaying"),
      title: playing ? nowPlayingTitleOf(playing) : null,
      detail: playing ? mode : null,
    },
    controls: {
      shuffle: {
        key: "shuffle",
        label: input.shuffle ? t("music.shuffleOn") : t("music.shuffleOff"),
        kind: "secondary",
        selected: input.shuffle,
        ...(enabled ? {} : { disabled: reason }),
      },
      next: { key: "next", label: t("music.next"), kind: "secondary", ...(enabled ? {} : { disabled: reason }) },
      pause: {
        key: "pause",
        label: input.paused ? t("music.play") : t("music.pause"),
        kind: "secondary",
        selected: input.paused,
      },
      withSlider: input.withSlider,
      ...(input.glyphs ? { glyphs: input.glyphs } : {}),
    },
    volume: input.withSlider ? { value: input.volume, label: `${input.volume}%`, stepLabels: ["−", "+"] } : null,
    list: {
      empty: t("music.player.none"),
      tracks: songs.map((one) => {
        const where = localizedWhere(one.where);
        const isPlaying = one.track.key === playing?.key;
        return {
          key: `song:${one.id}`,
          title: one.title,
          where: isPlaying ? t("music.player.playing", { where }) : where,
          playing: isPlaying,
        };
      }),
    },
    foot: input.locked > 0 ? t("music.player.locked", { count: input.locked }) : t("music.player.all"),
    ...(input.glyphs ? { glyphs: input.glyphs } : {}),
  };
}
