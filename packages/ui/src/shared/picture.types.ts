/** A picture a component shows: a card scan or a hero's face, lazy-loaded, with a plain ground and a word when it is missing. */
export interface PictureSource {
  /** The URL; null (or a file that fails to load) shows `missing` on `fill`. */
  readonly src: string | null;
  /** The ground behind the picture (a CSS colour, normally a token variable). */
  readonly fill?: string;
  /** What the box says while there is no picture, already translated. */
  readonly missing?: string;
  /** Fills the box, cropped, around this focal point (0 to 1 each way); left out, the whole picture is fitted. */
  readonly cover?: { readonly x: number; readonly y: number; readonly centered?: boolean };
  /** Names where `src` came from, so a URL gone stale under a lazy image can be asked for again (`mc-image-error`). */
  readonly retry?: string;
}
