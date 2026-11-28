/**
 * What the music player pop-up (`scenes/music-player.ts`) hands its `mc-music-player` element: the header, "Now
 * playing", the controls, the volume and the earned songs, every word in the app's language. Pure: what is playing and
 * what is earned come in as arguments. The layout is the element's CSS; only the music button's rect comes in.
 */
import type { ControlGlyphs } from "@mc/ui";
import type { Track } from "../audio/music-catalog.js";
import type { MusicPlayerModel } from "../views/music/mc-music-player/mc-music-player.types.js";
import { t } from "../i18n/translate.js";
import type { Rect } from "./layout.js";
import { nowPlayingTitleOf, type PlayerSong } from "./music-player.js";
import { localizedWhere } from "./music-where.js";

export interface MusicPlayerInput {
  readonly phone: boolean;
  /** The music button, which the popover hangs from. */
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

export function musicPlayerModelOf(input: MusicPlayerInput): MusicPlayerModel {
  const { songs, playing } = input;
  const song = playing ? songs.find((one) => one.track.key === playing.key) : undefined;
  const enabled = songs.length > 0;
  const mode = input.shuffle ? t("music.shuffling") : song ? t("music.repeating") : t("music.screenOwn");
  return {
    phone: input.phone,
    anchor: input.icon,
    title: t("music.player.title"),
    earned: t("music.player.earned", { count: songs.length, total: songs.length + input.locked }),
    closeLabel: input.phone ? `◂ ${t("common.back")}` : "✕",
    nowPlaying: {
      status: playing ? (input.paused ? t("music.paused") : t("music.nowPlaying")) : t("music.nothingPlaying"),
      song: playing ? nowPlayingTitleOf(playing) : null,
      detail: playing ? mode : null,
    },
    controls: {
      shuffleLabel: input.shuffle ? t("music.shuffleOn") : t("music.shuffleOff"),
      nextLabel: t("music.next"),
      pauseLabel: input.paused ? t("music.play") : t("music.pause"),
      shuffleOn: input.shuffle,
      paused: input.paused,
      reason: enabled ? "" : t("music.earnFirst"),
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
    glyphs: input.glyphs ?? {},
  };
}
