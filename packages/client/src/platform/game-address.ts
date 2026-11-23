/**
 * The game in progress in the address (single player, reload resume): while a saved game is being played the address
 * carries `#game=<saveId>`, so a refresh (on purpose or by accident) resumes that save straight into the game, the way
 * Continue does, instead of exiting to Title. Written with `replaceState` (no history entry) and removed when the game is
 * over or the player leaves to Title.
 *
 * Resuming reads the local save only: nothing here, or in the resume it leads to, touches the network. The hash never
 * overwrites another one (`#room=`, `#watch=`, a link being opened): a room's game is found through the room
 * (`#room=`), and only an address with no hash, or this one, takes a game.
 */
import type { ReceiveLinkHistory, ReceiveLinkLocation } from "../save-data/receive-link.js";

const GAME_HASH = /^#?game=([A-Za-z0-9_-]{1,80})$/;

/** The save id the address names, or null. Does not clear it. */
export function gameLinkOf(location: ReceiveLinkLocation | undefined = globalThis.location): string | null {
  const match = location ? GAME_HASH.exec(location.hash) : null;
  return match?.[1] ?? null;
}

/** Takes `#game=` out of the address (no new history entry); any other hash stays. */
export function clearGameAddress(
  location: ReceiveLinkLocation | undefined = globalThis.location,
  history: ReceiveLinkHistory | undefined = globalThis.history,
): void {
  if (!location || !history || !/^#?game=/.test(location.hash)) return;
  try {
    history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  } catch {
    // An address that cannot be rewritten: the game itself still works.
  }
}

/** What `syncGameAddress` reads of the session store. */
export interface GameAddressState {
  readonly status: string;
  readonly gameId: string | null;
  readonly game: { readonly outcome?: unknown } | null;
}

/**
 * Keeps the address in step with the game on the table: its save id while it is being played (and is not a guided run,
 * whose guidance a plain resume would lose), nothing once it is over. An idle store changes nothing, so a boot that is
 * still resuming keeps its `#game=`.
 */
export function syncGameAddress(
  state: GameAddressState,
  guided: boolean,
  location: ReceiveLinkLocation | undefined = globalThis.location,
  history: ReceiveLinkHistory | undefined = globalThis.history,
): void {
  if (!location || !history) return;
  if (state.status !== "playing" || !state.gameId) return;
  if (state.game?.outcome || guided) {
    clearGameAddress(location, history);
    return;
  }
  if (location.hash !== "" && location.hash !== "#" && gameLinkOf(location) === null) return;
  if (gameLinkOf(location) === state.gameId) return;
  try {
    history.replaceState(history.state, "", `${location.pathname}${location.search}#game=${state.gameId}`);
  } catch {
    // See clearGameAddress.
  }
}
