/** Where the subject sits in a cropped picture, 0 to 1 each way. */
export interface PictureFocusPoint {
  readonly x: number;
  readonly y: number;
}

/** The weight of a section header: a family heading is large, a pack heading inside it small. */
export type SectionHeaderSize = "large" | "small";
