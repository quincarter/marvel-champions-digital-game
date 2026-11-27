/** Where the subject sits in a cropped picture, 0 to 1 each way (a portrait's face sits high). */
export interface PictureFocus {
  readonly x: number;
  readonly y: number;
}

/** How a picture sits in its box: `cover` fills it, cropped around the focus; `contain` fits the whole picture. */
export type PictureFit = "cover" | "contain";

/** What shows round and behind a picture: spent ink (the default), ink, or parchment. */
export type PictureGround = "spent" | "ink" | "parchment";
