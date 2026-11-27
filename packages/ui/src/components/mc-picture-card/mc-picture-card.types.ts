/** A colored stamp on a card's picture (an aspect's name on its printed frame color). */
export interface PictureCardStamp {
  /** The stamp's word, already translated. */
  readonly label: string;
  /** The stamp's fill and the word's ink (CSS colors). */
  readonly fill: string;
  readonly ink: string;
}

/** A picture card: a picture over a caption strip, with a status chip on the picture. */
export interface McPictureCardModel {
  /** The picture URL (lazy), or null for none: the faint `initial` stands in. */
  readonly src: string | null;
  /** Where the picture is cropped around, 0 to 1 down (a portrait face sits high). */
  readonly focusY: number;
  /** A gray, faded ghost of the picture on its ground (a locked card). */
  readonly dim: boolean;
  /** The chip word ("READ ▸", "LOCKED"), already translated; empty draws no chip. */
  readonly chip: string;
  /** `action`: a red chip (what a tap does); `locked`: an outlined ink chip. */
  readonly chipTone: "action" | "locked";
  readonly title: string;
  /** The title in the display face (a villain’s name) rather than the bold body face. */
  readonly titleDisplay?: boolean;
  /** The caption second line. */
  readonly detail: string;
  /** How many lines the detail may take (1; 2 for a sentence). */
  readonly detailLines?: 1 | 2;
  /** `alert` prints the detail in red (what opens a locked card); `caution` in the ink at full strength and bold. */
  readonly detailTone: "meta" | "alert" | "caution";
  /** The big faint letter shown when there is no picture, or it fails to load. */
  readonly initial: string;
  /** The caption strip height in px (52). */
  readonly captionHeight?: number;
  /** Colored stamps along the foot of the picture, left to right (a hero's aspects). */
  readonly stamps?: readonly PictureCardStamp[];
  /** A small label at the picture's top right ("SEAT 2", "LOCKED"): ink plate, paper word. Empty or absent draws none. */
  readonly tag?: string;
  /** A one-line note at the picture's top left on an outlined ink plate ("TEAM-UP WITH ..."). Empty or absent draws none. */
  readonly plate?: string;
  /** The chosen card: the heavy red frame (and a red shape that is not color alone: the tag says what it is). */
  readonly selected?: boolean;
  /** With `titleDisplay`: the display face's size in px (the style's own when absent). */
  readonly titleSize?: number;
}
