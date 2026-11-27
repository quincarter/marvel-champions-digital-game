/** A picture card: a picture over a caption strip, with a status chip on the picture. */
export interface McPictureCardModel {
  /** The picture URL (lazy), or null for none: the faint `initial` stands in. */
  readonly src: string | null;
  /** Where the picture is cropped around, 0 to 1 down (a portrait face sits high). */
  readonly focusY: number;
  /** A gray, faded ghost of the picture on its ground (a locked card). */
  readonly dim: boolean;
  /** The chip word ("READ ▸", "LOCKED"), already translated. */
  readonly chip: string;
  /** `action`: a red chip (what a tap does); `locked`: an outlined ink chip. */
  readonly chipTone: "action" | "locked";
  readonly title: string;
  /** The caption second line. */
  readonly detail: string;
  /** `alert` prints the detail in red (what opens a locked card). */
  readonly detailTone: "meta" | "alert";
  /** The big faint letter shown when there is no picture, or it fails to load. */
  readonly initial: string;
  /** The caption strip height in px (52). */
  readonly captionHeight?: number;
}
