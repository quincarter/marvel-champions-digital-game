/**
 * Opening the chat's pop-out window (`live/chat-popout-protocol.ts`): a light DOM page (`chat-popout.html`), not a second
 * game. Offered wherever the lobby has room for a floating or side-by-side chat (the layout decides: `view/room-lobby-
 * layout.ts`), in a browser or the Tauri app (a second app window); never in the native phone/tablet shell, which has no
 * window to put it in.
 */
import type { Platform } from "./platform.js";
import { detectPlatform } from "./platform.js";

export const POPOUT_PAGE = "/chat-popout.html";
/**
 * A pop-out's window name and Tauri label start with this and end with its token (`chatPopoutLabel`): one window per
 * pop-out, so a window from an earlier room or another tab is never reused. `src-tauri/capabilities/chat-popout.json`
 * matches the prefix.
 */
export const POPOUT_LABEL_PREFIX = "chat-popout-";
export const POPOUT_SIZE = { width: 420, height: 640 } as const;

/** The window name for a token: the browser's named window, and the Tauri window label (letters, digits, `-` and `_`). */
export const chatPopoutLabel = (token: string): string =>
  `${POPOUT_LABEL_PREFIX}${token.replace(/[^A-Za-z0-9_-]/g, "_")}`;

/** Where the pop-out page lives, with the room it joins (the channel is named for the room id) and the app's language. */
export function chatPopoutUrl(params: {
  readonly roomId: string;
  readonly token: string;
  readonly lang: string;
}): string {
  const query = new URLSearchParams({ room: params.roomId, token: params.token, lang: params.lang });
  return `${POPOUT_PAGE}?${query.toString()}`;
}

/** Wherever a BroadcastChannel exists to talk over, except the native phone and tablet shell. */
export function chatPopoutAllowed(facts: {
  readonly platform: Platform;
  readonly hasBroadcastChannel: boolean;
}): boolean {
  return facts.hasBroadcastChannel && facts.platform !== "capacitor";
}

export function chatPopoutAvailable(): boolean {
  return chatPopoutAllowed({
    platform: detectPlatform(),
    hasBroadcastChannel: typeof BroadcastChannel !== "undefined",
  });
}

/** Opens (or focuses) the room's window. Resolves false when it could not open (a blocked pop-up); the chat stays in the lobby. */
export async function openChatPopout(roomId: string, token: string, lang: string): Promise<boolean> {
  const url = chatPopoutUrl({ roomId, token, lang });
  const label = chatPopoutLabel(token);
  if (detectPlatform() === "tauri") {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const existing = await WebviewWindow.getByLabel(label);
      if (existing) {
        await existing.setFocus();
        return true;
      }
      // Creating a window is `main`'s permission (`capabilities/default.json`); the window gets only `chat-popout.json`.
      const created = new WebviewWindow(label, {
        url,
        title: "Marvel Champions",
        ...POPOUT_SIZE,
        minWidth: 320,
        minHeight: 360,
        backgroundColor: "#0e0c0a",
      });
      return await new Promise<boolean>((resolve) => {
        void created.once("tauri://created", () => resolve(true));
        void created.once("tauri://error", () => resolve(false));
      });
    } catch {
      return false;
    }
  }
  const features = `popup=yes,width=${POPOUT_SIZE.width},height=${POPOUT_SIZE.height}`;
  return globalThis.open(url, label, features) !== null;
}
