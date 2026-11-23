/**
 * The game in progress in the address (single player, reload resume): while a saved game is being played the address
 * carries `?game=<saveId>`, so a refresh (on purpose or by accident) resumes that save straight into the game, the way
 * Continue does, instead of exiting to Title. Set with `replaceState` (`address-params.ts`) and removed when the game is
 * over or the player leaves to Title.
 *
 * Resuming reads the local save only: nothing here touches the network, and the resume it leads to skips the
 * before-resume device sync (`SessionStore.resume`'s `sync: false`), so single player never waits on the network. The parameter
 * never replaces `?room=` or `?watching=`: a room's game is found through the room, and only an address with neither takes a
 * game.
 */
import type { ReceiveLinkHistory, ReceiveLinkLocation } from "../save-data/receive-link.js";
import { clearPlaceParam, paramOf, placeParamIn, setPlaceParam } from "./address-params.js";

const SAVE_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** The save id the address names, or null. Does not clear it. */
export function gameLinkOf(location: ReceiveLinkLocation | undefined = globalThis.location): string | null {
  const raw = paramOf("game", location);
  return raw !== null && SAVE_ID.test(raw) ? raw : null;
}

/** Takes `?game=` out of the address (no new history entry); everything else stays. */
export function clearGameAddress(
  location: ReceiveLinkLocation | undefined = globalThis.location,
  history: ReceiveLinkHistory | undefined = globalThis.history,
): void {
  clearPlaceParam("game", location, history);
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
 * still resuming keeps its `?game=`.
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
  const other = placeParamIn(location);
  if (other !== null && other !== "game") return;
  setPlaceParam("game", state.gameId, location, history);
}
