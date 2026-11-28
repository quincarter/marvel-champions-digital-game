import type { CardRef } from "@mc/ui";

/** One card of a pack's gallery, already translated. */
export interface GalleryTileModel {
  /** The gallery's own key for the card (`galleryFocusKey`): the tile's focus stop, and what a tap says. */
  readonly key: string;
  readonly name: string;
  /** "Event · Attack", "Hero identity". */
  readonly typeLine: string;
  /** Copies the pack holds: "×2" shows past one. */
  readonly quantity: number;
  /** The picture's URL (held by a lease while shown); null while it loads or when there is none. */
  readonly src: string | null;
  /** Names where `src` came from (a pack file key), so a stale URL is asked for again. */
  readonly retry?: string;
  /** What the picture box says while there is no picture: the card's name. */
  readonly missing: string;
  /** The card the hover popover and Inspect show for this picture; null leaves the picture without either. */
  readonly hover: CardRef | null;
}

export interface McPackCardProps {
  card: GalleryTileModel | null;
}
