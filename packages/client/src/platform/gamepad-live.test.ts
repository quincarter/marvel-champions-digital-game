import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { installGamepadLive } from "./gamepad-live.js";
import type Phaser from "phaser";

// Phaser's own wrapper, from its source (the package exports only its bundle): the patch has to work on the real
// class, against a pad whose fields are prototype getters as a browser `Gamepad`'s are.
const PhaserGamepad = createRequire(import.meta.url)("../../node_modules/phaser/src/input/gamepad/Gamepad.js") as new (
  manager: unknown,
  pad: unknown,
) => Wrapper;

interface Wrapper {
  readonly connected: boolean;
  update(pad: unknown): void;
  on(event: string, listener: (index: number) => void): void;
}

class FakePad {
  readonly #buttons: { value: number; pressed: boolean }[];
  readonly #stamp: number;
  readonly #connected: boolean;
  constructor(pressed: number[], stamp: number, connected = true) {
    this.#buttons = [0, 1, 2, 3].map((index) => {
      const down = pressed.includes(index);
      return { value: down ? 1 : 0, pressed: down };
    });
    this.#stamp = stamp;
    this.#connected = connected;
  }
  get id(): string {
    return "8BitDo Ultimate 2 Wireless Controller";
  }
  get index(): number {
    return 0;
  }
  get mapping(): string {
    return "standard";
  }
  get connected(): boolean {
    return this.#connected;
  }
  get timestamp(): number {
    return this.#stamp;
  }
  get buttons(): { value: number; pressed: boolean }[] {
    return this.#buttons;
  }
  get axes(): number[] {
    return [0, 0, 0, 0];
  }
}

installGamepadLive({ Input: { Gamepad: { Gamepad: PhaserGamepad } } } as unknown as typeof Phaser);

const wrapperOf = (pad: FakePad): { downs: number[]; wrapper: Wrapper } => {
  const downs: number[] = [];
  const wrapper = new PhaserGamepad({ emit: () => true }, pad);
  wrapper.on("down", (index: number) => downs.push(index));
  return { downs, wrapper };
};

describe("installGamepadLive", () => {
  it("reads a reconnected pad from the live object, not the dropped one", () => {
    const { wrapper } = wrapperOf(new FakePad([], 1));
    wrapper.update(new FakePad([], 2, false));
    expect(wrapper.connected).toBe(false);
    wrapper.update(new FakePad([], 3));
    expect(wrapper.connected).toBe(true);
  });

  it("takes a press whose timestamp is on another clock than performance.now()", () => {
    const { downs, wrapper } = wrapperOf(new FakePad([], 0));
    wrapper.update(new FakePad([0], 0.001));
    expect(downs).toEqual([0]);
  });

  it("fires nothing for a button already down at creation until it is let go and pressed again", () => {
    const { downs, wrapper } = wrapperOf(new FakePad([1], 0));
    wrapper.update(new FakePad([1], 0));
    expect(downs).toEqual([]);
    wrapper.update(new FakePad([], 0));
    wrapper.update(new FakePad([1], 0));
    expect(downs).toEqual([1]);
  });
});
