/** The "Play online" feature panel, already worded and translated. */
export interface TitlePromoInput {
  /** Beside the menu column (`side`, a wide screen), or a caption box over the art panel (`art`). */
  readonly variant: "side" | "art";
  /** The title as typed ("Play online"); drawn in capitals with an exclamation mark. */
  readonly title: string;
  readonly pitch: string;
  /** The "N live" chip text; null before an answer. The words carry the meaning, never the green dot alone. */
  readonly live: string | null;
  readonly host: string;
  readonly join: string;
  /** False while online play cannot be used (offline): the panel dims and its buttons are unavailable. */
  readonly available: boolean;
}
