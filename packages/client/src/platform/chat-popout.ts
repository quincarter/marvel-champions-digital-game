/**
 * Opening the chat's pop-out window (`live/chat-popout-protocol.ts`): a light DOM page (`chat-popout.html`), not a second
 * game. Desktop only: a web page in a desktop browser, or the Tauri app (a second app window). A phone or a tablet gets no
 * button; there is no window to put it in.
 */
import type { Platform } from "./platform.js";
import { detectPlatform } from "./platform.js";
import { currentRoomDevice } from "./room-device.js";
import type { DeviceForm } from "./room-device.js";

export const POPOUT_PAGE = "/chat-popout.html";
export const POPOUT_LABEL = "chat-popout";
export const POPOUT_SIZE = { width: 420, height: 640 } as const;

/** Where the pop-out page lives, with the room it joins (the channel is named for the room id) and the app's language. */
export function chatPopoutUrl(params: { readonly roomId: string; readonly lang: string }): string {
  const query = new URLSearchParams({ room: params.roomId, lang: params.lang });
  return `${POPOUT_PAGE}?${query.toString()}`;
}

/** Desktop only, and only where a BroadcastChannel exists to talk over; the native phone and tablet shells never. */
export function chatPopoutAllowed(facts: {
  readonly platform: Platform;
  readonly form: DeviceForm | null;
  readonly hasBroadcastChannel: boolean;
}): boolean {
  if (!facts.hasBroadcastChannel || facts.platform === "capacitor") return false;
  return facts.form === "desktop";
}

export function chatPopoutAvailable(): boolean {
  const platform = detectPlatform();
  return chatPopoutAllowed({
    platform,
    form: currentRoomDevice(platform)?.form ?? null,
    hasBroadcastChannel: typeof BroadcastChannel !== "undefined",
  });
}

/** Opens (or focuses) the window. Resolves false when the browser blocked it; the chat then stays in the lobby. */
export async function openChatPopout(roomId: string, lang: string): Promise<boolean> {
  const url = chatPopoutUrl({ roomId, lang });
  if (detectPlatform() === "tauri") {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const existing = await WebviewWindow.getByLabel(POPOUT_LABEL);
      if (existing) {
        await existing.setFocus();
        return true;
      }
      // `src-tauri/capabilities/default.json` lists this label and allows creating it.
      const created = new WebviewWindow(POPOUT_LABEL, {
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
  return globalThis.open(url, POPOUT_LABEL, features) !== null;
}
