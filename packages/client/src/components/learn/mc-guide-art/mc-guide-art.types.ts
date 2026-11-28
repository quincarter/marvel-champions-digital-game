import type { PictureSource } from "@mc/ui";

/** The properties of `mc-guide-art`. */
export interface GuideArtProps {
  /** The title art, or none. */
  readonly picture: PictureSource | null;
  /** The banner's words ("NEW TO THE FIGHT?"), already translated. */
  readonly heading: string;
  /** The wide screen's left panel. */
  readonly wide: boolean;
}
