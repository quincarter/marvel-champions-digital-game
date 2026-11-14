/**
 * Links into the game that still name the old address: a shared replay (`#replay=`, `replay/replay-link.ts`), a save
 * transfer (`#receive=`) or a device-sync link (`#link=`, `save-data/receive-link.ts`). Installed apps and old QR codes
 * keep making them until they update, and once the old address serves the moved page they land there. The moved page
 * offers to carry the link on to the game's new address with its fragment intact, rather than dropping the replay or
 * the transfer the player came for.
 */

export type GameLinkKind = "replay" | "receive" | "link";

export interface GameLink {
  readonly kind: GameLinkKind;
  /** The game's new address with the link's fragment on it. */
  readonly url: string;
}

const GAME_LINK = /^#(replay|receive|link)=[^#\s]+$/;

/** The game link `hash` carries, forwarded to `gameUrl`, or `null` when it carries none. */
export function gameLinkOf(hash: string, gameUrl: string): GameLink | null {
  const match = GAME_LINK.exec(hash);
  if (!match) return null;
  return { kind: match[1] as GameLinkKind, url: `${gameUrl}${hash}` };
}
