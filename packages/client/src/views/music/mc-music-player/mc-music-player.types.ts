import type { ControlGlyphs, VolumeSliderProps } from "@mc/ui";
import type { McNowPlayingProps } from "../../../components/music/mc-now-playing/mc-now-playing.types.js";
import type { McPlayerControlsProps } from "../../../components/music/mc-player-controls/mc-player-controls.types.js";
import type { McTrackListProps } from "../../../components/music/mc-track-list/mc-track-list.types.js";

/** A rect in the panel layer's coordinates. */
export interface MusicAnchor {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * What the Music player hands its `mc-music-player`: on a tablet or desktop a popover hanging from the music button
 * (`anchor`), on a phone a panel filling the screen under the top bar. Every word is already translated; the layout
 * (width, height, where the popover sits) is the stylesheet's, from the anchor.
 */
export interface MusicPlayerModel {
  readonly phone: boolean;
  /** The music button, which the popover hangs from and its caret points at. */
  readonly anchor: MusicAnchor;
  readonly title: string;
  /** "2 of 221 earned". */
  readonly earned: string;
  /** Back (phone) or the cross (popover). */
  readonly closeLabel: string;
  readonly nowPlaying: McNowPlayingProps;
  /** Shuffle, Next and Pause: the words and what is chosen. */
  readonly controls: Omit<McPlayerControlsProps, "withSlider" | "glyphs">;
  /** The volume slider beside Pause, on a desktop form factor only. */
  readonly volume: VolumeSliderProps | null;
  readonly list: McTrackListProps;
  /** "219 more to earn: ..." or "Every song earned.". */
  readonly foot: string;
  /** The key or pad glyphs hung on the controls (`close`, `shuffle`, `next`, `pause`), by key. */
  readonly glyphs: ControlGlyphs;
}
