/** The one event the music player's elements speak to the scene in. */
export const MUSIC_EVENT = "mc-music";

/**
 * What `mc-music` carries:
 * - `press`: a control was pressed, by its focus-stop key (`close`, `shuffle`, `next`, `pause`, `song:<id>`, or `outside`
 *   for a tap beside the panel);
 * - `slide`: the volume slider's track was pressed or dragged (`share` 0 to 1, `commit` on release);
 * - `step`: the volume slider's minus (-1) or plus (1).
 */
export type MusicEventDetail =
  | { readonly type: "press"; readonly key: string }
  | { readonly type: "slide"; readonly share: number; readonly commit: boolean }
  | { readonly type: "step"; readonly direction: -1 | 1 };

export type MusicEvent = CustomEvent<MusicEventDetail>;

declare global {
  interface HTMLElementEventMap {
    "mc-music": MusicEvent;
  }
}
