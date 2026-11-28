import type { PictureFit } from "@mc/ui";

/** A pack's picture as the tile takes it: the URL (held by a lease while shown), where it came from, how it sits. */
export interface PackThumb {
  readonly src: string | null;
  /** Names where `src` came from (a pack file key), so a stale URL is asked for again. */
  readonly retry?: string;
  readonly fit: PictureFit;
}

/** Everything a pack tile shows, already translated. */
export interface PackTileModel {
  readonly id: string;
  readonly name: string;
  /** "Hero pack · by Someone". */
  readonly meta: string;
  readonly summary: string;
  /** The size ("1.2 MB"). */
  readonly foot: string;
  /** The state chip's words with its mark ("+ Install", "✓ Installed", "↑ Update"). */
  readonly badge: string;
  /** The chip is the call to action: red. */
  readonly solid: boolean;
  /** The pack's initial, big and faint, while no picture has loaded. */
  readonly letter: string;
  readonly thumb: PackThumb;
}

export interface McPackTileProps {
  tile: PackTileModel | null;
}
