import type { PopupButton, VolumeSliderProps } from "@mc/ui";

/** How far into the song it is, in seconds. */
export interface PlayerProgress {
  readonly seek: number;
  readonly duration: number;
}

/** What the Music tab's player shows; the scene builds it from the music controller and the settings. */
export interface ExtrasPlayerModel {
  /** "NOW PLAYING", "PAUSED" or "NOTHING PLAYING". */
  readonly status: string;
  /** The song, in capitals, or null while nothing plays. */
  readonly title: string | null;
  /** What is playing it ("Shuffling earned songs - Battle - Rhino"), or null. */
  readonly detail: string | null;
  readonly shuffle: PopupButton;
  readonly next: PopupButton;
  readonly pause: PopupButton;
  /** The volume slider (a desktop form factor only); null for none. */
  readonly volume: VolumeSliderProps | null;
}

export interface McExtrasPlayerProps {
  model: ExtrasPlayerModel | null;
  /** Read every quarter second for the bar and its clock; null while no song plays. */
  progress: (() => PlayerProgress | null) | null;
}
