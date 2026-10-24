/**
 * Keys and pad buttons for a screen that needs one or two things the shared route has no intent for (Peek and Expand on a
 * decision popup) or that has no route at all (a splash that closes on A or B).
 *
 * It rides the same two bindings every screen uses (`scenes/board/input.ts`), so the sync conflict prompt, a held
 * D-pad and the Nintendo layout swap behave here exactly as they do everywhere else. A key is matched by its
 * lowercase `event.key`; a chord (Ctrl, Alt, Meta) is never a shortcut, so the browser's own keys stay the browser's.
 */

import type Phaser from "phaser";
import { eventOnce } from "../view/event-once.js";
import type { GamepadIntent } from "../view/gamepad.js";
import { peekExpandOf, typingInTextField } from "../view/keyboard-intent.js";
import { bindGamepad, conflictPromptOwnsInput, currentKeyboardHand } from "./board/input.js";
import { SCENES } from "./keys.js";

export interface ExtraInput {
  /** True while something above this screen owns input. */
  readonly blocked?: () => boolean;
  /** Lowercase key (or "escape", "enter", " ") to what it does. */
  readonly keys?: Readonly<Record<string, () => void>>;
  /**
   * The decision popup's Peek and Expand keys, by physical key for the keyboard hand in use (R / F under the left,
   * P / ; under the right: `view/input-shortcuts.ts`). Matched on `event.code`, unlike `keys`.
   */
  readonly peekExpand?: { readonly peek?: () => void; readonly expand?: () => void };
  /** Pad intent to what it does; an intent left out is ignored by this binding (the screen's route still sees it). */
  readonly intents?: Readonly<Partial<Record<GamepadIntent, () => void>>>;
}

export function bindExtraInput(scene: Phaser.Scene, input: ExtraInput): void {
  const blocked = (): boolean => input.blocked?.() === true;
  const keys = input.keys;
  if (keys) {
    const firstDelivery = eventOnce();
    scene.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!firstDelivery(event)) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (blocked() || conflictPromptOwnsInput(scene) || typingInTextField(event)) return;
      const action = keys[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      action();
    });
  }
  const peekExpand = input.peekExpand;
  if (peekExpand) {
    const firstDelivery = eventOnce();
    scene.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!firstDelivery(event)) return;
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
      if (blocked() || conflictPromptOwnsInput(scene) || typingInTextField(event)) return;
      const which = peekExpandOf(event, currentKeyboardHand());
      const action = which === null ? undefined : peekExpand[which];
      if (!action) return;
      event.preventDefault();
      action();
    });
  }
  const intents = input.intents;
  if (intents) {
    bindGamepad(scene, {
      blocked,
      onIntent: (intent) => intents[intent]?.(),
    });
  }
}

/**
 * Menu / Start / + while a screen over the Board owns the pad (the decision popup, the villain phase): the Board is
 * blocked then, so it cannot open Pause itself. Same launch as `BoardScene#openPause`, only while a game's board is up.
 */
export function openPauseOverBoard(scene: Phaser.Scene): void {
  if (!scene.scene.isActive(SCENES.board) || scene.scene.isActive(SCENES.pause)) return;
  scene.scene.launch(SCENES.pause);
}
