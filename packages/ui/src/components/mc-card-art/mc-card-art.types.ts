import type { PictureSource } from "../../shared/picture.types.js";

/** What a card picture is given: the picture and which card (and face) it stands for. */
export interface CardArtProps {
  readonly picture: PictureSource | null;
  readonly cardId: string;
  readonly face?: unknown;
}
