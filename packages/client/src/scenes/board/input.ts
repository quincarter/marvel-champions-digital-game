/**
 * Keyboard and gamepad bindings for the Board.
 *
 * Both reduce every input to one of `GamepadIntent`'s five meanings and hand
 * it to the same `onIntent`, so the two input methods provably drive one route
 * rather than two that happen to agree today.
 */

import type Phaser from "phaser";
import { eventOnce } from "../../view/event-once.js";
import { gamepadIntentFor, type GamepadIntent } from "../../view/gamepad.js";
import { SCENES } from "../keys.js";

export interface IntentBinding {
  /** True while something above the board (a decision overlay, Inspect) owns input. */
  blocked(): boolean;
  onIntent(intent: GamepadIntent): void;
}

/**
 * Keyboard navigation.
 *
 * Tab and Shift+Tab walk `focusOrder`, the arrows move to the nearest stop in
 * their direction (`view/spatial-nav.ts`), Enter and Space act on what is focused,
 * `I` inspects it, and Escape backs out of a mode. A canvas has no focus of
 * its own, so all of this is ours to state — including the visible ring,
 * which is the selection ring drawn static rather than pulsing (a pulse means
 * "the board is waiting for you", and focus is not a prompt).
 */
/**
 * True while device sync's conflict prompt is up and `scene` is not it: the prompt owns the keyboard and the pad
 * (it is a question the sync is waiting on), so every other screen's keys and buttons are held, whatever its own
 * `blocked` says. Every route and the Board bind through `bindKeyboard` / `bindGamepad`, so this is the one place.
 */
export function conflictPromptOwnsInput(scene: Phaser.Scene): boolean {
  return scene.scene.key !== SCENES.syncConflict && scene.scene.manager.isActive(SCENES.syncConflict) === true;
}

export function bindKeyboard(scene: Phaser.Scene, binding: IntentBinding): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return;
  const firstDelivery = eventOnce();
  keyboard.on("keydown", (event: KeyboardEvent) => {
    // Phaser replays a frame's queue on every key event, so a chord (Shift+Tab) arrives more than once.
    if (!firstDelivery(event)) return;
    if (binding.blocked() || conflictPromptOwnsInput(scene)) return;
    switch (event.key) {
      case "Tab":
        event.preventDefault();
        binding.onIntent(event.shiftKey ? "previous" : "next");
        break;
      // The arrows move the way they point, to the nearest stop on screen (issue #206); Tab keeps the route order.
      case "ArrowRight":
        event.preventDefault();
        binding.onIntent("right");
        break;
      case "ArrowLeft":
        event.preventDefault();
        binding.onIntent("left");
        break;
      case "ArrowDown":
        event.preventDefault();
        binding.onIntent("down");
        break;
      case "ArrowUp":
        event.preventDefault();
        binding.onIntent("up");
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
      case "g":
      case "G":
        // Guided mode's own focus-region toggle (docs/guided-mode.md §3.10, §7): moves keyboard/pad focus into
        // whatever guide surface is showing (the rail/callout, the villain-phase/defend guide strip, or an
        // opportunistic tip toast) and back out to the board. A screen with nothing to focus there just ignores it
        // (`IntentBinding.onIntent` implementations that never wire a "toggleGuide" case are a no-op).
        binding.onIntent("toggleGuide");
        break;
      case "PageDown":
        event.preventDefault();
        binding.onIntent("pageNext");
        break;
      case "PageUp":
        event.preventDefault();
        binding.onIntent("pagePrevious");
        break;
      case "Home":
        event.preventDefault();
        binding.onIntent("home");
        break;
      case "End":
        event.preventDefault();
        binding.onIntent("end");
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
    if (binding.blocked() || conflictPromptOwnsInput(scene)) return;
    const intent = gamepadIntentFor(button.index);
    if (intent) binding.onIntent(intent);
  });
}
