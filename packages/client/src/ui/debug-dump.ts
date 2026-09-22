/**
 * Ctrl+Shift+D (Cmd+Shift+D on a Mac): copies a JSON snapshot of what the screen and the store each believe to the
 * clipboard, in every build including production.
 *
 * It exists for the bugs a refresh erases. The 2026-09-21 "frozen on the defend screen, can't click anything" report
 * could not be reproduced: after a reload the same decision was answerable, because a resumed game arrives without
 * the villain-phase walkthrough that had been open underneath. What was needed was the state *at the moment of the
 * freeze* — which scenes were running in which order, whether each overlay was taking input or thought it was
 * leaving, and what decision the engine was waiting on. That is exactly and only what this collects. It reads; it
 * never changes anything.
 */
import type Phaser from "phaser";
import { appSession } from "../session.js";
import { recentErrors } from "./error-log.js";

interface DebugReporter {
  debugState(): Record<string, unknown>;
}

const reports = (scene: Phaser.Scene): scene is Phaser.Scene & DebugReporter =>
  typeof (scene as Partial<DebugReporter>).debugState === "function";

export function debugSnapshot(game: Phaser.Game): Record<string, unknown> {
  const manager = game.scene;
  const scenes = manager.getScenes(false).map((scene) => {
    const input = (scene as { input?: Phaser.Input.InputPlugin & { _list?: readonly unknown[] } }).input;
    return {
      key: scene.scene.key,
      index: manager.getIndex(scene.scene.key),
      active: scene.sys.isActive(),
      visible: scene.sys.settings.visible,
      status: scene.sys.settings.status,
      inputEnabled: input?.enabled ?? null,
      interactiveObjects: input?._list?.length ?? null,
      ...(reports(scene) && scene.sys.isActive() ? { self: safely(() => scene.debugState()) } : {}),
    };
  });
  const state = appSession().store.state;
  const choice = state.game?.pendingChoice ?? null;
  return {
    at: new Date().toISOString(),
    viewport: { width: game.scale.gameSize.width, height: game.scale.gameSize.height },
    /** Whether the game loop is still ticking: a frame count that stops moving is a dead loop. */
    frame: game.loop.frame,
    /** The last errors the frame guard caught (`ui/frame-guard.ts`), newest last. */
    errors: recentErrors(),
    scenes: scenes.filter((scene) => scene.active).sort((a, b) => a.index - b.index),
    store: {
      version: state.version,
      inFlight: state.inFlight,
      error: state.error,
      perspectiveId: state.perspectiveId,
      round: state.game?.round ?? null,
      step: state.game?.step ?? null,
      stack: state.game?.stack.map((frame) => frame.kind) ?? null,
      pendingChoice: choice
        ? {
            choiceId: choice.choiceId,
            kind: choice.prompt.kind,
            playerId: choice.playerId,
            min: choice.minSelections,
            max: choice.maxSelections,
            options: choice.options.map((option) => option.label),
          }
        : null,
      legal: state.legal ? { playerId: state.legal.playerId, kind: state.legal.actions.kind } : null,
    },
  };
}

function safely(read: () => Record<string, unknown>): Record<string, unknown> {
  try {
    return read();
  } catch (cause) {
    return { error: String(cause) };
  }
}

/** Binds the shortcut on the window. Called once from `main.ts`. */
export function installDebugDump(game: Phaser.Game): void {
  window.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== "d") return;
    event.preventDefault();
    const text = JSON.stringify(debugSnapshot(game), null, 2);
    console.info("[mc] debug snapshot\n" + text);
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (!clipboard) {
      banner("Debug snapshot written to the browser console.");
      return;
    }
    void clipboard.writeText(text).then(
      () => banner("Debug snapshot copied to the clipboard — paste it into the bug report."),
      () => banner("Debug snapshot written to the browser console (clipboard unavailable)."),
    );
  });
}

/** A plain DOM banner for a few seconds: this must work even when the canvas is the thing that's stuck. */
function banner(message: string): void {
  const node = document.createElement("div");
  node.textContent = message;
  node.style.cssText =
    "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:99999;padding:10px 16px;" +
    "background:#14110d;color:#f4efe4;font:600 14px system-ui,sans-serif;border:2px solid #f4efe4;";
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 4000);
}
