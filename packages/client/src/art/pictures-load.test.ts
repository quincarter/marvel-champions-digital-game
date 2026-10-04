import { describe, expect, test } from "vitest";
import type Phaser from "phaser";
import { ensurePictureLoaded, type Picture } from "./pictures.js";

/** Just enough of a scene for the loader guard: one shared texture manager, a loader and events of its own. */
class FakeScene {
  readonly loads: string[] = [];
  active = true;
  readonly #handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  readonly #eventHandlers = new Map<string, (() => void)[]>();
  loading = false;
  readonly textures: { exists(key: string): boolean; shared: Set<string> };
  readonly load = {
    image: (key: string) => {
      this.loads.push(key);
    },
    on: (event: string, fn: (...args: unknown[]) => void) => {
      this.#handlers.set(event, [...(this.#handlers.get(event) ?? []), fn]);
    },
    off: (event: string, fn: (...args: unknown[]) => void) => {
      this.#handlers.set(
        event,
        (this.#handlers.get(event) ?? []).filter((h) => h !== fn),
      );
    },
    isLoading: () => this.loading,
    start: () => {
      this.loading = true;
    },
  };
  readonly events = {
    once: (event: string, fn: () => void) => {
      this.#eventHandlers.set(event, [...(this.#eventHandlers.get(event) ?? []), fn]);
    },
    off: (event: string, fn: () => void) => {
      this.#eventHandlers.set(
        event,
        (this.#eventHandlers.get(event) ?? []).filter((h) => h !== fn),
      );
    },
  };
  readonly sys = { isActive: () => this.active };

  constructor(textures: { exists(key: string): boolean; shared: Set<string> }) {
    this.textures = textures;
  }
  emit(event: string, ...args: unknown[]): void {
    for (const fn of [...(this.#handlers.get(event) ?? [])]) fn(...args);
  }
  shutdown(): void {
    this.active = false;
    for (const fn of [...(this.#eventHandlers.get("shutdown") ?? [])]) fn();
  }
  get asScene(): Phaser.Scene {
    return this as unknown as Phaser.Scene;
  }
}

const manager = () => {
  const shared = new Set<string>();
  return { exists: (key: string) => shared.has(key), shared };
};
const PIC: Picture = { key: "wallpaper", url: "/wallpaper.png" };

describe("ensurePictureLoaded across scenes", () => {
  test("two scenes asking at once load the picture once, and both are told when it arrives", () => {
    const textures = manager();
    const a = new FakeScene(textures);
    const b = new FakeScene(textures);
    let readyA = 0;
    let readyB = 0;
    expect(ensurePictureLoaded(a.asScene, PIC, () => readyA++)).toBeNull();
    expect(ensurePictureLoaded(b.asScene, PIC, () => readyB++)).toBeNull();
    expect(a.loads).toEqual(["wallpaper"]);
    expect(b.loads, "the second scene does not call load.image").toEqual([]);
    textures.shared.add("wallpaper");
    a.emit("filecomplete-image-wallpaper");
    expect([readyA, readyB]).toEqual([1, 1]);
    expect(ensurePictureLoaded(b.asScene, PIC, () => readyB++)).toBe("wallpaper");
  });

  test("a waiting scene that has closed is not told", () => {
    const textures = manager();
    const a = new FakeScene(textures);
    const b = new FakeScene(textures);
    let readyB = 0;
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    ensurePictureLoaded(b.asScene, PIC, () => readyB++);
    b.active = false;
    a.emit("filecomplete-image-wallpaper");
    expect(readyB).toBe(0);
  });

  test("when the loading scene shuts down mid-load, the next waiting scene takes the load over", () => {
    const textures = manager();
    const a = new FakeScene(textures);
    const b = new FakeScene(textures);
    let readyB = 0;
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    ensurePictureLoaded(b.asScene, PIC, () => readyB++);
    a.shutdown();
    expect(b.loads).toEqual(["wallpaper"]);
    textures.shared.add("wallpaper");
    b.emit("filecomplete-image-wallpaper");
    expect(readyB).toBe(1);
  });

  test("a load that fails is forgotten, so a later request tries again", () => {
    const textures = manager();
    const a = new FakeScene(textures);
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    a.emit("loaderror", { key: "wallpaper" });
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    expect(a.loads).toEqual(["wallpaper", "wallpaper"]);
  });

  test("different texture managers are independent", () => {
    const a = new FakeScene(manager());
    const b = new FakeScene(manager());
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    ensurePictureLoaded(b.asScene, PIC, () => undefined);
    expect([a.loads.length, b.loads.length]).toEqual([1, 1]);
  });
});
