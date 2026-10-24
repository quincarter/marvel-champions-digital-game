/**
 * Keyboard and gamepad bindings for the Board.
 *
 * Both reduce every input to one of `GamepadIntent`'s five meanings and hand
 * it to the same `onIntent`, so the two input methods provably drive one route
 * rather than two that happen to agree today.
 */

import type Phaser from "phaser";
import { eventOnce } from "../../view/event-once.js";
import { navIntentOf, typingInTextField } from "../../view/keyboard-intent.js";
import type { KeyboardHand } from "../../view/input-shortcuts.js";
import { gamepadIntentFor, GAMEPAD_AXIS, GAMEPAD_BUTTON, type GamepadIntent } from "../../view/gamepad.js";
import {
  detectPad,
  physicalIndexOf,
  resolvePadFamily,
  usesNintendoSwap,
  type PadIdentity,
} from "../../view/pad-family.js";
import {
  NO_TRIGGERS,
  TRIGGER_BUTTONS,
  isLayerButton,
  layerOfHolds,
  triggerHoldAfter,
  type TriggerHold,
} from "../../view/pad-layer-hold.js";
import type { PadLayer } from "../../view/pad-layer-bindings.js";
import { createInspectHold, type InspectHold } from "../../view/inspect-hold.js";
import { createHoldTap } from "../../view/pad-hold-tap.js";
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
  /**
   * LT or RT is held (or let go: null), called on each change. A screen that wants the hold layers
   * (`view/pad-layers.ts`) wires this with `onLayerPress`; one that does not keeps every button's base meaning.
   */
  onLayer?(layer: PadLayer | null): void;
  /**
   * A face button or bumper pressed while a layer is held, as its standard-layout meaning index (0-5, after the
   * Nintendo swap). Left out, the press keeps its base intent.
   */
  onLayerPress?(layer: PadLayer, meaningIndex: number): void;
  /**
   * Splits View: a tap calls this (the Board reopens the villain phase recap) and a hold of about 400 ms sends the
   * `view` intent (the game log). Left out, View is the `view` intent the moment it is pressed, as on every other screen.
   */
  onViewTap?(): void;
  /**
   * Splits Inspect (Y, or E / O): a tap still sends the `inspect` intent, on release; a hold of about 300 ms calls this
   * with true (the focused card shows enlarged, `view/inspect-hold.ts`) and the release then calls it with false and
   * does not inspect. Called with false too when the screen is blocked mid-hold. Left out, or while `zoomEnabled`
   * says no, Inspect is the `inspect` intent the moment it is pressed, as on every other screen.
   */
  onInspectZoom?(zooming: boolean): void;
  /** False while the zoom is switched off (Card hover size "off"): a hold then behaves as a tap, Inspect at once. */
  zoomEnabled?(): boolean;
}

/** One hold machine per binding, shared by its keyboard and pad paths so the first input to press owns the hold. */
const inspectHolds = new WeakMap<IntentBinding, InspectHold>();

function splitsInspect(binding: IntentBinding): boolean {
  return binding.onInspectZoom !== undefined && binding.zoomEnabled?.() !== false;
}

function inspectHoldOf(scene: Phaser.Scene, binding: IntentBinding): InspectHold {
  let hold = inspectHolds.get(binding);
  if (hold) return hold;
  hold = createInspectHold();
  inspectHolds.set(binding, hold);
  const machine = hold;
  const owns = (): boolean =>
    binding.blocked() ||
    conflictPromptOwnsInput(scene) ||
    scene.input.enabled === false ||
    scene.input.keyboard?.enabled === false;
  // Polled each frame by the scene's own update event, for both inputs: a hold fires without another key or button event.
  const onUpdate = (): void => {
    if (owns()) {
      if (machine.cancel() === "close") binding.onInspectZoom?.(false);
      return;
    }
    if (machine.poll(scene.time.now) === "zoom") binding.onInspectZoom?.(true);
  };
  scene.events.on("update", onUpdate);
  scene.events.once("shutdown", () => {
    scene.events.off("update", onUpdate);
    if (machine.cancel() === "close") binding.onInspectZoom?.(false);
    inspectHolds.delete(binding);
  });
  return hold;
}

/** An Inspect release from `source`: a tap inspects (unless something now owns input), a released hold closes the zoom. */
function releaseInspect(scene: Phaser.Scene, binding: IntentBinding, source: "pad" | "key"): void {
  const result = inspectHoldOf(scene, binding).release(source, scene.time.now);
  if (result === "close") binding.onInspectZoom?.(false);
  else if (result === "inspect" && !binding.blocked() && !conflictPromptOwnsInput(scene)) binding.onIntent("inspect");
}

/**
 * Keyboard navigation.
 *
 * Tab and Shift+Tab walk `focusOrder`, the arrows move to the nearest stop in
 * their direction (`view/spatial-nav.ts`), Select (Space or Enter, the hand's own key) acts on what is
 * focused, Inspect (E / O) inspects it, and Back (Q / U, Escape) backs out of a mode. WASD or IJKL move like the arrows. A canvas has no focus of
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

/** The keyboard hand in use now, read live so a change on the Controls screen applies without a restart. */
export function currentKeyboardHand(): KeyboardHand {
  return appSession().settings.keyboardHand;
}

export function bindKeyboard(scene: Phaser.Scene, binding: IntentBinding): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return;
  const firstDelivery = eventOnce();
  const firstRelease = eventOnce();
  if (binding.onInspectZoom) inspectHoldOf(scene, binding);
  // Releasing E / O ends the Inspect hold: a tap opens Inspect, a held zoom just closes.
  keyboard.on("keyup", (event: KeyboardEvent) => {
    if (!binding.onInspectZoom || !firstRelease(event)) return;
    if (navIntentOf(event, currentKeyboardHand()) !== "inspect") return;
    releaseInspect(scene, binding, "key");
  });
  keyboard.on("keydown", (event: KeyboardEvent) => {
    // Phaser replays a frame's queue on every key event, so a chord (Shift+Tab) arrives more than once.
    if (!firstDelivery(event)) return;
    if (binding.blocked() || conflictPromptOwnsInput(scene)) return;
    // Typing in a text field (`McTextInput`'s DOM input) is never a shortcut.
    if (typingInTextField(event)) return;
    // Matched by physical key through the shortcut table (`view/keyboard-intent.ts`), for the hand in use. Shift+Enter
    // and Shift+Space are End turn (the Board claims them) and never Select, on every screen bound here.
    const intent = navIntentOf(event, currentKeyboardHand());
    if (intent === null) return;
    // Everything but Escape and the guide toggle stops the browser acting on the key too (Tab moving DOM focus, Space
    // scrolling the page, the arrows scrolling it).
    if (intent !== "cancel" && intent !== "inspect" && intent !== "toggleGuide") event.preventDefault();
    if (intent === "inspect" && splitsInspect(binding)) {
      inspectHoldOf(scene, binding).press("key", scene.time.now);
      return;
    }
    binding.onIntent(intent);
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

  // Each pad's own trigger hysteresis (`view/pad-layer-hold.ts`), and the layer last reported through `onLayer`.
  const triggers = new Map<number, TriggerHold>();
  // The trigger's value read from the browser's own Gamepad at the moment asked: Phaser's copy is only as fresh as its
  // last poll, so a trigger pulled in the same frame as a face button would still read as up.
  const rawTrigger = (pad: Phaser.Input.Gamepad.Gamepad, index: number): number => {
    const browser = globalThis.navigator?.getGamepads?.()?.[pad.index] ?? pad.pad;
    return browser?.buttons?.[index]?.value ?? pad.buttons[index]?.value ?? 0;
  };
  const readTriggers = (pad: Phaser.Input.Gamepad.Gamepad): TriggerHold => {
    const next = triggerHoldAfter(
      triggers.get(pad.index) ?? NO_TRIGGERS,
      rawTrigger(pad, TRIGGER_BUTTONS.lt),
      rawTrigger(pad, TRIGGER_BUTTONS.rt),
    );
    triggers.set(pad.index, next);
    return next;
  };
  let reportedLayer: PadLayer | null = null;
  /** The layer any usable pad holds now (the first pulled wins, across pads), reported through `onLayer` on change. */
  const syncLayer = (blocked: boolean): PadLayer | null => {
    const holds: TriggerHold[] = [];
    for (const pad of gamepad.gamepads) {
      if (!pad?.connected || !usable(pad) || systemChordHeld(pad)) continue;
      holds.push(readTriggers(pad));
    }
    // A blocked screen has no layer to show: a trigger held through an overlay ends the layer at once.
    const layer = blocked ? null : layerOfHolds(holds, reportedLayer);
    if (layer !== reportedLayer) {
      reportedLayer = layer;
      binding.onLayer?.(layer);
    }
    return layer;
  };
  if (binding.onInspectZoom) inspectHoldOf(scene, binding);
  const viewHold = createHoldTap();
  const VIEW_BUTTON = 8;

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
    const meaning = physicalIndexOf(button.index, swap);
    if (binding.onViewTap && meaning === VIEW_BUTTON) {
      viewHold.press(scene.time.now);
      return;
    }
    if (binding.onLayerPress && isLayerButton(meaning)) {
      // The layer across every pad, not only the one pressed: a trigger on one pad and a button on another still counts.
      const layer = syncLayer(false);
      if (layer !== null) {
        binding.onLayerPress(layer, meaning);
        return;
      }
    }
    const intent = gamepadIntentFor(meaning);
    if (intent === "inspect" && splitsInspect(binding)) {
      inspectHoldOf(scene, binding).press("pad", scene.time.now);
      return;
    }
    if (intent) binding.onIntent(intent);
  });

  gamepad.on("up", (pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    if (binding.onInspectZoom && usable(pad) && !DPAD_INDICES.has(button.index)) {
      const settings = appSession().settings;
      const identity = identityOf(pad);
      const swap = usesNintendoSwap(
        resolvePadFamily(settings.padGlyphFamily, identity),
        settings.nintendoLayout,
        identity,
      );
      if (gamepadIntentFor(physicalIndexOf(button.index, swap)) === "inspect") releaseInspect(scene, binding, "pad");
    }
    if (!binding.onViewTap || button.index !== VIEW_BUTTON || !usable(pad)) return;
    if (viewHold.release(scene.time.now) === "tap" && !held()) binding.onViewTap();
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
    if (binding.onLayer || binding.onLayerPress) syncLayer(blocked);
    if (binding.onViewTap) {
      if (blocked) viewHold.cancel();
      else if (viewHold.poll(scene.time.now) === "hold") binding.onIntent("view");
    }
    const fire = repeater.update(direction ?? lean, time, !blocked);
    if (fire) binding.onIntent(fire);
    if (scroll && !blocked) binding.onScroll?.(scroll.dx, scroll.dy, delta);
  };
  // The event names, not `Phaser.Scenes.Events`: a value import of Phaser would load it (and `window`) in unit tests.
  scene.events.on("update", onUpdate);
  scene.events.once("shutdown", () => scene.events.off("update", onUpdate));
}
