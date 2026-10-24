/**
 * Keyboard and gamepad bindings for the Board.
 *
 * Both reduce every input to one of `GamepadIntent`'s five meanings and hand
 * it to the same `onIntent`, so the two input methods provably drive one route
 * rather than two that happen to agree today.
 */

import type Phaser from "phaser";
import { eventOnce } from "../../view/event-once.js";
import { gamepadIntentFor, GAMEPAD_AXIS, GAMEPAD_BUTTON, type GamepadIntent } from "../../view/gamepad.js";
import {
  detectPad,
  physicalIndexOf,
  resolvePadFamily,
  usesNintendoSwap,
  type PadIdentity,
} from "../../view/pad-family.js";
import { createPadRepeater, scrollDelta, stickDirection } from "../../view/pad-repeat.js";
import type { FocusDirection } from "../../view/spatial-nav.js";
import { notePadInput } from "../../platform/input-device.js";
import { appSession } from "../../session.js";
import { SCENES } from "../keys.js";

export interface IntentBinding {
  /** True while something above the board (a decision overlay, Inspect) owns input. */
  blocked(): boolean;
  onIntent(intent: GamepadIntent): void;
  /**
   * The right stick, called every frame it is past its deadzone with the pixels to scroll (positive dx right,
   * positive dy down) and the frame's time. Optional: a screen with nothing to scroll leaves it out.
   */
  onScroll?(dx: number, dy: number, dtMs: number): void;
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
  const manager = scene.scene.manager;
  const key = scene.scene.key;
  if (key !== SCENES.syncConflict && manager.isActive(SCENES.syncConflict) === true) return true;
  // The one-time "Set up cross-device sync?" question owns them the same way. The sync screen it opens is its own, and
  // so is a conflict prompt raised meanwhile (a Join can end in one): neither is held by it.
  if (key === SCENES.syncSetupPrompt || key === SCENES.syncData || key === SCENES.syncConflict) return false;
  return manager.isActive(SCENES.syncSetupPrompt) === true;
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
        // Shift+Enter is End turn, on every screen that binds this: only the Board claims it (its own shortcut handler), so
        // no other screen activates its focused stop on it either.
        if (event.shiftKey) break;
        event.preventDefault();
        binding.onIntent("activate");
        break;
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
 * A pad's identity does not change while it is connected: parse its id once, not every frame. Module-level so stacked
 * scenes hand `notePadInput` the very same object for one pad (it compares by identity, and two objects would flip the
 * input-mode state twice a frame).
 */
const identityCache = new Map<string, PadIdentity>();
function padIdentityOf(id: string): PadIdentity {
  let identity = identityCache.get(id);
  if (!identity) {
    identity = detectPad(id);
    identityCache.set(id, identity);
  }
  return identity;
}

/**
 * The guide / Steam / PS button is held: the pad is in the middle of a system chord (Steam + X opens the Steam Deck's
 * on-screen keyboard, Guide + X on a pad under Steam), so nothing it presses meanwhile belongs to the game
 * (`docs/controller-support.md`, owner decision 7). The button itself is never bound.
 */
function systemChordHeld(pad: Phaser.Input.Gamepad.Gamepad): boolean {
  return pad.buttons[GAMEPAD_BUTTON.home]?.pressed === true;
}

const DPAD_DIRECTION: ReadonlyArray<readonly [number, FocusDirection]> = [
  [GAMEPAD_BUTTON.dpadUp, "up"],
  [GAMEPAD_BUTTON.dpadDown, "down"],
  [GAMEPAD_BUTTON.dpadLeft, "left"],
  [GAMEPAD_BUTTON.dpadRight, "right"],
];
const DPAD_INDICES = new Set(DPAD_DIRECTION.map(([index]) => index));

/**
 * Gamepad navigation, over the same route the keyboard walks.
 *
 * `phaser4-rex-plugins` is the widget layer's concern, not input's — this is
 * Phaser's own built-in gamepad plugin (`main.ts` turns it on; it is off by
 * default). `gamepadIntentFor` (`view/gamepad.ts`) is the only thing that
 * knows a button index means "next" or "cancel"; this only listens and
 * forwards, exactly as `bindKeyboard` does for the keyboard's own keys.
 *
 * Two paths, because Phaser's `down` event fires once per press and knows nothing of a held button or a leaning
 * stick. Every button but the D-pad is a single press from `down`. The D-pad and the left stick are polled each frame
 * (the scene's update event) through `view/pad-repeat.ts`, which owns the deadzone, the hysteresis and the hold-to-
 * repeat timing, so a held direction walks the focus and the D-pad and stick share one repeater. The right stick
 * scrolls through `binding.onScroll`. Everything, repeat and scroll included, is held while `blocked()` or the sync
 * conflict prompt owns input, and a direction held when that begins does not repeat when it ends.
 *
 * Only pads the browser maps to the "standard" layout are used; any other is logged once and ignored, since the
 * intent table is positional and a guess at an unknown layout would press the wrong things.
 */
export function bindGamepad(scene: Phaser.Scene, binding: IntentBinding): void {
  const gamepad = scene.input.gamepad;
  if (!gamepad) return;

  const identityOf = (pad: Phaser.Input.Gamepad.Gamepad): PadIdentity => padIdentityOf(pad.id);
  const ignored = new Set<string>();
  const usable = (pad: Phaser.Input.Gamepad.Gamepad): boolean => {
    const mapping: unknown = pad.pad?.mapping;
    if (typeof mapping !== "string" || mapping === "standard") return true;
    if (!ignored.has(pad.id)) {
      ignored.add(pad.id);
      console.info(`Gamepad "${pad.id}" reports mapping "${mapping}", not "standard"; ignoring it.`);
    }
    return false;
  };
  // A scene that froze its own input (Team-Up splash, achievement list, Report issue) leaves the pad plugin and the
  // keyboard disabled while the per-frame poll still runs: it must not keep repeating a frozen direction or stick.
  const held = () =>
    binding.blocked() ||
    conflictPromptOwnsInput(scene) ||
    scene.input.enabled === false ||
    scene.input.keyboard?.enabled === false;

  gamepad.on("down", (pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    if (!usable(pad)) return;
    const identity = identityOf(pad);
    notePadInput(identity);
    if (systemChordHeld(pad)) return;
    // The D-pad is polled below, so a press isn't delivered twice.
    if (DPAD_INDICES.has(button.index)) return;
    if (held()) return;
    const settings = appSession().settings;
    const swap = usesNintendoSwap(
      resolvePadFamily(settings.padGlyphFamily, identity),
      settings.nintendoLayout,
      identity,
    );
    const intent = gamepadIntentFor(physicalIndexOf(button.index, swap));
    if (intent) binding.onIntent(intent);
  });

  const repeater = createPadRepeater();
  // Each pad's own left-stick hysteresis: one pad's lean must not hold another's engaged.
  const leftSticks = new Map<number, FocusDirection | null>();
  const onUpdate = (time: number, delta: number): void => {
    let direction: FocusDirection | null = null;
    let scroll: { dx: number; dy: number } | null = null;
    let lean: FocusDirection | null = null;
    for (const pad of gamepad.gamepads) {
      if (!pad?.connected || !usable(pad)) continue;
      const identity = identityOf(pad);
      if (systemChordHeld(pad)) {
        notePadInput(identity);
        continue;
      }
      let touched = false;
      for (const [index, dir] of DPAD_DIRECTION) {
        if (pad.buttons[index]?.pressed) {
          direction ??= dir;
          touched = true;
        }
      }
      const stick = stickDirection(
        pad.axes[GAMEPAD_AXIS.leftX]?.getValue() ?? 0,
        pad.axes[GAMEPAD_AXIS.leftY]?.getValue() ?? 0,
        leftSticks.get(pad.index) ?? null,
      );
      leftSticks.set(pad.index, stick);
      if (stick !== null) {
        lean ??= stick;
        touched = true;
      }
      const scrolled = scrollDelta(
        pad.axes[GAMEPAD_AXIS.rightX]?.getValue() ?? 0,
        pad.axes[GAMEPAD_AXIS.rightY]?.getValue() ?? 0,
        delta,
      );
      if (scrolled !== null) {
        scroll ??= scrolled;
        touched = true;
      }
      if (touched) notePadInput(identity);
    }
    const blocked = held();
    const fire = repeater.update(direction ?? lean, time, !blocked);
    if (fire) binding.onIntent(fire);
    if (scroll && !blocked) binding.onScroll?.(scroll.dx, scroll.dy, delta);
  };
  // The event names, not `Phaser.Scenes.Events`: a value import of Phaser would load it (and `window`) in unit tests.
  scene.events.on("update", onUpdate);
  scene.events.once("shutdown", () => scene.events.off("update", onUpdate));
}
