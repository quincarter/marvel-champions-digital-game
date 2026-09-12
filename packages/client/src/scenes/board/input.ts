/**
 * Keyboard and gamepad bindings for the Board.
 *
 * Both reduce every input to one of `GamepadIntent`'s five meanings and hand
 * it to the same `onIntent`, so the two input methods provably drive one route
 * rather than two that happen to agree today.
 */

import type Phaser from "phaser";
import { gamepadIntentFor, type GamepadIntent } from "../../view/gamepad.js";

export interface IntentBinding {
  /** True while something above the board (a decision overlay, Inspect) owns input. */
  blocked(): boolean;
  onIntent(intent: GamepadIntent): void;
}

/**
 * Keyboard navigation.
 *
 * Arrows and Tab walk `focusOrder`, Enter and Space act on what is focused,
 * `I` inspects it, and Escape backs out of a mode. A canvas has no focus of
 * its own, so all of this is ours to state — including the visible ring,
 * which is the selection ring drawn static rather than pulsing (a pulse means
 * "the board is waiting for you", and focus is not a prompt).
 */
export function bindKeyboard(scene: Phaser.Scene, binding: IntentBinding): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return;
  keyboard.on("keydown", (event: KeyboardEvent) => {
    if (binding.blocked()) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
      case "Tab":
        event.preventDefault();
        binding.onIntent(event.shiftKey && event.key === "Tab" ? "previous" : "next");
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        binding.onIntent("previous");
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        binding.onIntent("activate");
        break;
      case "i":
      case "I":
        binding.onIntent("inspect");
        break;
      case "Escape":
        binding.onIntent("cancel");
        break;
      default:
        break;
    }
  });
}

/**
 * Gamepad navigation, over the same route the keyboard walks.
 *
 * `phaser4-rex-plugins` is the widget layer's concern, not input's — this is
 * Phaser's own built-in gamepad plugin (`main.ts` turns it on; it is off by
 * default). `gamepadIntentFor` (`view/gamepad.ts`) is the only thing that
 * knows a button index means "next" or "cancel"; this only listens and
 * forwards, exactly as `bindKeyboard` does for the keyboard's own keys.
 *
 * `Gamepad.on("down", ...)` (bound below via the plugin, not the pad
 * instance) fires once per press, not once per held frame, so there is no
 * repeat-rate to manage the way a keyboard's OS auto-repeat already handles
 * itself. Continuous analog-stick movement is not wired — a D-pad or the
 * face buttons cover every intent this board has, and a stick's constant
 * drift would need its own deadzone-and-repeat timer this pass doesn't
 * need to take on.
 */
export function bindGamepad(scene: Phaser.Scene, binding: IntentBinding): void {
  const gamepad = scene.input.gamepad;
  if (!gamepad) return;
  gamepad.on("down", (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    if (binding.blocked()) return;
    const intent = gamepadIntentFor(button.index);
    if (intent) binding.onIntent(intent);
  });
}
