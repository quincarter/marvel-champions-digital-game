/**
 * The music volume the Extras Music tab's slider shows and moves: the same rule the music popover follows
 * (`scenes/music-player.ts`). In the Windows app the slider is the game's own entry in the Windows volume mixer (read now,
 * then followed through the shell's change events, except while the slider is in the hand or its last change is still on its
 * way); elsewhere it is the `musicVolume` setting, heard as the slider moves and saved when it is let go.
 */
import { appSession } from "../../session.js";
import { clampMusicVolume } from "../../settings.js";
import {
  followsWindowsMixer,
  knownMixerVolume,
  onMixerChange,
  readMixerVolume,
  writeMixerVolume,
} from "../../platform/app-volume.js";
import { steppedVolume, volumeAtTrack } from "../../view/music-player.js";

export class MusicVolume {
  #volume = 100;
  #changedAt = 0;
  #dragging = false;
  #alive = false;
  #off: (() => void) | null = null;
  /** Called when the volume the slider shows changed from outside (the mixer). */
  readonly #changed: () => void;

  constructor(changed: () => void) {
    this.#changed = changed;
  }

  /** The volume shown, 0 to 100. */
  get value(): number {
    return this.#volume;
  }

  /** Reads the starting volume and, in the Windows app, follows the mixer. */
  start(): void {
    this.#alive = true;
    const mixer = followsWindowsMixer();
    this.#volume = clampMusicVolume(mixer ? (knownMixerVolume() ?? 100) : appSession().settings.musicVolume);
    if (!mixer) return;
    const show = (read: number | null): void => {
      if (!this.#alive || read === null || read === this.#volume || this.#dragging) return;
      if (Date.now() - this.#changedAt < 1000) return;
      this.#volume = read;
      this.#changed();
    };
    void readMixerVolume().then(show);
    this.#off = onMixerChange(({ volume }) => show(volume));
  }

  stop(): void {
    this.#alive = false;
    this.#off?.();
    this.#off = null;
  }

  /** A press or drag along the slider's track: `share` 0 to 1; `commit` is the release. */
  slide(share: number, commit: boolean): void {
    this.#dragging = !commit;
    this.#set(volumeAtTrack(share, { x: 0, width: 1 }), commit);
  }

  /** The slider's minus (-1) or plus (1). */
  step(direction: -1 | 1): void {
    this.#set(steppedVolume(this.#volume, direction), true);
  }

  /** Heard now; saved only when `save` (a drag saves once, on release). The mixer is the Windows app's own slider. */
  #set(volume: number, save: boolean): void {
    const session = appSession();
    this.#volume = clampMusicVolume(volume);
    if (followsWindowsMixer()) {
      this.#changedAt = Date.now();
      writeMixerVolume(this.#volume);
    } else {
      const next = { ...session.settings, musicVolume: this.#volume };
      session.music?.syncSettings(next);
      if (save) session.settings = next;
    }
    this.#changed();
  }
}
