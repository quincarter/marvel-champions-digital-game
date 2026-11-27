/** Where the subject sits in a cropped picture, 0 to 1 each way (a portrait face sits high). */
export interface PictureFocus {
  readonly x: number;
  readonly y: number;
  /**
   * The crop is centered on the point and kept inside the picture (the client own cover crop, as a hero `focus.json`
   * means it) instead of the point being a CSS `object-position` share of the overflow.
   */
  readonly centered?: boolean;
}

/** How a picture sits in its box: `cover` fills it, cropped around the focus; `contain` fits the whole picture. */
export type PictureFit = "cover" | "contain";

/** What shows round and behind a picture: spent ink (the default), ink, or parchment. */
export type PictureGround = "spent" | "ink" | "parchment";

/**
 * A picture as one value (a card scan or a hero face, lazy-loaded, with a plain ground and a word when it is missing):
 * what a tile, card or row takes as `picture` instead of `src` / `missing` / `fit` / `subject` one by one.
 */
export interface PictureSource {
  /** The URL; null (or a file that fails to load) shows `missing` on `fill`. */
  readonly src: string | null;
  /** The ground behind the picture (a CSS colour, normally a token variable); left out, the tile `ground`. */
  readonly fill?: string;
  /** What the box says while there is no picture, already translated. */
  readonly missing?: string;
  /** Fills the box, cropped, around this focal point (0 to 1 each way); left out, the whole picture is fitted. */
  readonly cover?: PictureFocus;
  /** Names where `src` came from, so a URL gone stale under a lazy image can be asked for again (`mc-image-error`). */
  readonly retry?: string;
}
