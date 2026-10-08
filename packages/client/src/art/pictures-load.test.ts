import { afterEach, describe, expect, test, vi } from "vitest";
import type Phaser from "phaser";
import { ensurePictureLoaded, type Picture } from "./pictures.js";

/** A stand-in for the DOM `Image`: the test settles each one by hand. */
class FakeImage {
  static all: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() {
    FakeImage.all.push(this);
  }
}
vi.stubGlobal("Image", FakeImage);
afterEach(() => {
  FakeImage.all = [];
});

/** Just enough of a scene: one shared texture manager and an active flag. */
class FakeScene {
  active = true;
  readonly textures: FakeTextures;
  readonly sys = { isActive: () => this.active };
  constructor(textures: FakeTextures) {
    this.textures = textures;
  }
  get asScene(): Phaser.Scene {
    return this as unknown as Phaser.Scene;
  }
}

class FakeTextures {
  readonly shared = new Set<string>();
  readonly added: string[] = [];
  exists(key: string): boolean {
    return this.shared.has(key);
  }
  addImage(key: string): void {
    this.added.push(key);
    this.shared.add(key);
  }
}

const PIC: Picture = { key: "wallpaper", url: "/wallpaper.png" };

describe("ensurePictureLoaded across scenes", () => {
  test("two scenes asking at once load the picture once, and both are told when it arrives", () => {
    const textures = new FakeTextures();
    const a = new FakeScene(textures);
    const b = new FakeScene(textures);
    let readyA = 0;
    let readyB = 0;
    expect(ensurePictureLoaded(a.asScene, PIC, () => readyA++)).toBeNull();
    expect(ensurePictureLoaded(b.asScene, PIC, () => readyB++)).toBeNull();
    expect(FakeImage.all.map((i) => i.src)).toEqual(["/wallpaper.png"]);
    FakeImage.all[0]!.onload?.();
    expect([readyA, readyB]).toEqual([1, 1]);
    expect(textures.added).toEqual(["wallpaper"]);
    expect(ensurePictureLoaded(b.asScene, PIC, () => readyB++)).toBe("wallpaper");
  });

  test("a waiting scene that has closed is not told", () => {
    const textures = new FakeTextures();
    const a = new FakeScene(textures);
    const b = new FakeScene(textures);
    let readyB = 0;
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    ensurePictureLoaded(b.asScene, PIC, () => readyB++);
    b.active = false;
    FakeImage.all[0]!.onload?.();
    expect(readyB).toBe(0);
  });

  test("the loading scene closing mid-load neither drops the load nor lets a later request start a second one", () => {
    const textures = new FakeTextures();
    const a = new FakeScene(textures);
    const b = new FakeScene(textures);
    let readyB = 0;
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    a.active = false;
    // The next screen asks while the first scene's file is still in flight.
    ensurePictureLoaded(b.asScene, PIC, () => readyB++);
    expect(FakeImage.all).toHaveLength(1);
    FakeImage.all[0]!.onload?.();
    expect(textures.added).toEqual(["wallpaper"]);
    expect(readyB).toBe(1);
  });

  test("the texture is added at most once even if it appeared meanwhile", () => {
    const textures = new FakeTextures();
    const a = new FakeScene(textures);
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    textures.shared.add("wallpaper");
    FakeImage.all[0]!.onload?.();
    expect(textures.added).toEqual([]);
  });

  test("a load that fails is forgotten, so a later request tries again", () => {
    const textures = new FakeTextures();
    const a = new FakeScene(textures);
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    FakeImage.all[0]!.onerror?.();
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    expect(FakeImage.all).toHaveLength(2);
  });

  test("different texture managers are independent", () => {
    const a = new FakeScene(new FakeTextures());
    const b = new FakeScene(new FakeTextures());
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    ensurePictureLoaded(b.asScene, PIC, () => undefined);
    expect(FakeImage.all).toHaveLength(2);
  });
});
