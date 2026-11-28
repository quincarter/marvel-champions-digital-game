import type { PictureSource } from "@mc/ui";
import type { ShieldCard } from "../../../view/campaign-shield-model.js";

/** A card in a picture row, with the few words under it and the picture the scene leased. */
export interface ShieldPicture extends ShieldCard {
  readonly caption: string;
  readonly picture: PictureSource;
}
