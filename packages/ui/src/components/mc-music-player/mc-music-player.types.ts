import type { SheetRect } from "../../shared/sheet.types.js";
import type { ControlGlyphs, PopupButton } from "../../shared/popup.types.js";
import type { NowPlayingModel } from "../mc-now-playing/mc-now-playing.types.js";
import type { PlayerControlsModel } from "../mc-player-controls/mc-player-controls.types.js";
import type { TrackListModel } from "../mc-track-list/mc-track-list.types.js";
import type { VolumeSliderProps } from "../mc-volume-slider/mc-volume-slider.types.js";

/**
 * The music player: on a tablet or desktop a popover hanging from the music button (`icon`), on a phone a panel filling
 * the screen under the top bar. Geometry is in the panel layer's coordinates; every word is already translated.
 */
export interface MusicPlayerModel {
  readonly phone: boolean;
  /** Where the panel sits. */
  readonly panel: SheetRect;
  /** The music button, which the popover's caret points at. */
  readonly icon: SheetRect;
  readonly title: string;
  /** "2 of 221 earned". */
  readonly earned: string;
  /** Back (phone) or ✕ (popover). */
  readonly close: PopupButton;
  readonly nowPlaying: NowPlayingModel;
  readonly controls: PlayerControlsModel;
  /** The volume slider beside Pause, on a desktop form factor only. */
  readonly volume: VolumeSliderProps | null;
  readonly list: TrackListModel;
  /** "219 more to earn: ..." or "Every song earned.". */
  readonly foot: string;
  readonly glyphs?: ControlGlyphs;
}
