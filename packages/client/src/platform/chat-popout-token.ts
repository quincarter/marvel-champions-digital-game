/**
 * The owning tab's pop-out token across a reload (`live/chat-popout-protocol.ts`). The token only ever lived in the room
 * worker, so a reload of the main tab left an open pop-out window beating at a channel nobody listened to. It is kept in
 * `sessionStorage` (one per tab, so another tab of the same browser never sees it and isolation holds), keyed by room id,
 * and handed back to the new worker once the same room is joined again. It is dropped when the pop-out is brought back or
 * closes, and when the room is left or over.
 */
import { isPopoutToken } from "../live/chat-popout-protocol.js";

const KEY = "mc-chat-popout";

export interface TokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const tabStorage = (): TokenStorage | null => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
};

/** Remembers `token` as this tab's pop-out for `roomId`. */
export function savePopoutToken(roomId: string, token: string, storage: TokenStorage | null = tabStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify({ roomId, token }));
  } catch {
    // Storage full or blocked: the pop-out just will not survive a reload.
  }
}

/** This tab's saved token for `roomId`, or null (none, another room's, or malformed). */
export function loadPopoutToken(roomId: string, storage: TokenStorage | null = tabStorage()): string | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== "object" || saved === null) return null;
    const { roomId: savedRoom, token } = saved as { roomId?: unknown; token?: unknown };
    return savedRoom === roomId && isPopoutToken(token) ? token : null;
  } catch {
    return null;
  }
}

export function clearPopoutToken(storage: TokenStorage | null = tabStorage()): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Hands the saved token back to the room worker, once per room per page load: on the first state of a room it is in.
 * A state with no room (left) or an ended one drops the saved token.
 */
export class PopoutRearm {
  #armedFor: string | null = null;

  constructor(
    private readonly arm: (token: string) => void,
    private readonly storage: TokenStorage | null = tabStorage(),
  ) {}

  onState(state: { readonly role: string; readonly connection: string; readonly roomId: string | null }): void {
    if (state.role === "none" || state.connection === "ended" || state.connection === "idle" || !state.roomId) {
      if (state.role === "none" || state.connection === "ended") {
        this.#armedFor = null;
        clearPopoutToken(this.storage);
      }
      return;
    }
    if (this.#armedFor === state.roomId) return;
    this.#armedFor = state.roomId;
    const token = loadPopoutToken(state.roomId, this.storage);
    if (token) this.arm(token);
  }
}
