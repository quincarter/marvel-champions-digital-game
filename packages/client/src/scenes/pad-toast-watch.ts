/**
 * Feeds the controller toast (`scenes/pad-toast.ts`) from the browser: `gamepadconnected` / `gamepaddisconnected`, and
 * a slow look for a pad that was already plugged in at load (browsers often report one only after its first press, or
 * not as an event at all). A connect is announced once per pad id per session (`view/pad-toast.ts`).
 */
import type Phaser from "phaser";
import { appSession } from "../session.js";
import { PadAnnounced, padConnectedMessage, padDisconnectedMessage, type PadToastMessage } from "../view/pad-toast.js";
import { SCENES } from "./keys.js";
import { sceneLoader } from "./scene-loader.js";

const POLL_MS = 1000;

export function startPadToastWatch(game: Phaser.Game): () => void {
  const announced = new PadAnnounced();
  const show = (message: PadToastMessage): void => {
    // Starting a running scene restarts it, so a newer notice replaces the one up.
    const start = (): void => {
      game.scene.start(SCENES.padToast, { message });
    };
    const loader = sceneLoader();
    if (loader) void loader.load(SCENES.padToast).then(start);
    else start();
  };
  const connected = (id: string): void => {
    if (announced.claim(id)) show(padConnectedMessage(id, appSession().settings.padGlyphFamily));
  };
  const onConnect = (event: Event): void => {
    const pad = (event as GamepadEvent).gamepad;
    if (pad) connected(pad.id);
  };
  const onDisconnect = (): void => show(padDisconnectedMessage());
  const poll = (): void => {
    for (const pad of globalThis.navigator?.getGamepads?.() ?? []) if (pad?.connected) connected(pad.id);
  };
  window.addEventListener("gamepadconnected", onConnect);
  window.addEventListener("gamepaddisconnected", onDisconnect);
  const timer = window.setInterval(poll, POLL_MS);
  poll();
  if (import.meta.env.DEV) {
    // Dev hook: `window.__mcPadToast()` (or `__mcPadToast("disconnected")`) shows the toast.
    (window as unknown as Record<string, unknown>)["__mcPadToast"] = (kind?: string): void =>
      show(
        kind === "disconnected"
          ? padDisconnectedMessage()
          : padConnectedMessage("054c-0ce6-DualSense Wireless Controller", appSession().settings.padGlyphFamily),
      );
  }
  return () => {
    window.removeEventListener("gamepadconnected", onConnect);
    window.removeEventListener("gamepaddisconnected", onDisconnect);
    window.clearInterval(timer);
  };
}
