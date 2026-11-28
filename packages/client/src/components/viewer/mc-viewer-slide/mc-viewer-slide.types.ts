import type { PictureSource } from "@mc/ui";

export interface McViewerSlideProps {
  /** The picture, fitted whole; null when the file has none open yet. */
  picture: PictureSource | null;
  /** "Cover" or "Cover - 2 / 5". */
  caption: string;
  /** What it says in place of a picture ("No artwork for this one yet."). */
  empty: string;
  /** The file has more than one picture: the arrows show. */
  arrows: boolean;
}
