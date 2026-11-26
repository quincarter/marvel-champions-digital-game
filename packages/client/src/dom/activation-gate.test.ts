import { describe, expect, it } from "vitest";
import { ActivationGate, sceneTakesPresses, type GatedScene } from "./activation-gate.js";

function fakeScene(): GatedScene & { running: boolean; inputOn: boolean; frame: () => void } {
  const listeners: Record<string, (() => void)[]> = {};
  const scene = {
    running: true,
    inputOn: true,
    sys: { isActive: () => scene.running },
    input: {
      get enabled() {
        return scene.inputOn;
      },
    },
    events: {
      on: (event: string, fn: () => void) => ((listeners[event] ??= []).push(fn), undefined),
      off: (event: string, fn: () => void) => {
        listeners[event] = (listeners[event] ?? []).filter((other) => other !== fn);
      },
    },
    // A scene that isn't running doesn't step, so no `postupdate` fires.
    frame: () => {
      if (scene.running) for (const fn of listeners.postupdate ?? []) fn();
    },
  };
  return scene;
}

/** What PopupSheet does for each `mc-activate`. */
function dispatch(gate: ActivationGate, action: () => void): void {
  if (gate.take()) action();
}

describe("ActivationGate", () => {
  it("calls the action once for two activations in the same frame", () => {
    const scene = fakeScene();
    const gate = new ActivationGate(scene);
    let calls = 0;
    dispatch(gate, () => calls++);
    dispatch(gate, () => calls++);
    expect(calls).toBe(1);
  });

  it("lets a later frame's activation through when the scene stays up (a Send that redraws)", () => {
    const scene = fakeScene();
    const gate = new ActivationGate(scene);
    let calls = 0;
    dispatch(gate, () => calls++);
    scene.frame();
    dispatch(gate, () => calls++);
    expect(calls).toBe(2);
  });

  it("does nothing after the scene stops or its input is disabled", () => {
    const scene = fakeScene();
    const gate = new ActivationGate(scene);
    let calls = 0;
    scene.inputOn = false;
    dispatch(gate, () => calls++);
    scene.inputOn = true;
    scene.running = false;
    dispatch(gate, () => calls++);
    expect(calls).toBe(0);
    expect(sceneTakesPresses(scene)).toBe(false);
  });

  it("holds a rapid double tap while a dismissal is under way: the stop is queued, so no frame reopens it", () => {
    const scene = fakeScene();
    const gate = new ActivationGate(scene);
    let calls = 0;
    // First tap closes the pop-up (the stop is processed at the next step); the second lands before it.
    dispatch(gate, () => calls++);
    dispatch(gate, () => calls++);
    scene.running = false;
    scene.frame();
    dispatch(gate, () => calls++);
    expect(calls).toBe(1);
  });
});
