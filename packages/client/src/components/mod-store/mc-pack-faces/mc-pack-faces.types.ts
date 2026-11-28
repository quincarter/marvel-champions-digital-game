import type { CardRef, PictureFit } from "@mc/ui";

/** A picture of a pack's page: the URL (held by a lease while shown), where it came from, what to say while it is missing. */
export interface PackPicture {
  readonly src: string | null;
  /** Names where `src` came from (a pack file key), so a stale URL is asked for again. */
  readonly retry?: string;
  /** What the box says while there is no picture. */
  readonly missing: string;
}

/** A featured card's face: the card the hover popover and Inspect show for it. */
export interface PackFace extends PackPicture {
  readonly hover: CardRef | null;
}

/** The one square slot of a pack with neither a cover nor a featured card. */
export interface PackSquare extends PackPicture {
  readonly fit: PictureFit;
}

export interface PackFacesModel {
  readonly cover: PackPicture | null;
  readonly faces: readonly PackFace[];
  readonly square: PackSquare | null;
}

export interface McPackFacesProps {
  pictures: PackFacesModel | null;
}
