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

/** Lets a settled image reach the texture manager (the load resolves through a promise). */
const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const PIC: Picture = { key: "wallpaper", url: "/wallpaper.png" };

describe("ensurePictureLoaded across scenes", () => {
  test("two scenes asking at once load the picture once, and both are told when it arrives", async () => {
    const textures = new FakeTextures();
    const a = new FakeScene(textures);
    const b = new FakeScene(textures);
    let readyA = 0;
    let readyB = 0;
    expect(ensurePictureLoaded(a.asScene, PIC, () => readyA++)).toBeNull();
    expect(ensurePictureLoaded(b.asScene, PIC, () => readyB++)).toBeNull();
    expect(FakeImage.all.map((i) => i.src)).toEqual(["/wallpaper.png"]);
    FakeImage.all[0]!.onload?.();
    await settled();
    expect([readyA, readyB]).toEqual([1, 1]);
    expect(textures.added).toEqual(["wallpaper"]);
    expect(ensurePictureLoaded(b.asScene, PIC, () => readyB++)).toBe("wallpaper");
  });

  test("a waiting scene that has closed is not told", async () => {
    const textures = new FakeTextures();
    const a = new FakeScene(textures);
    const b = new FakeScene(textures);
    let readyB = 0;
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    ensurePictureLoaded(b.asScene, PIC, () => readyB++);
    b.active = false;
    FakeImage.all[0]!.onload?.();
    await settled();
    expect(readyB).toBe(0);
  });

  test("the loading scene closing mid-load neither drops the load nor lets a later request start a second one", async () => {
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
    await settled();
    expect(textures.added).toEqual(["wallpaper"]);
    expect(readyB).toBe(1);
  });

  test("the texture is added at most once even if it appeared meanwhile", async () => {
    const textures = new FakeTextures();
    const a = new FakeScene(textures);
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    textures.shared.add("wallpaper");
    FakeImage.all[0]!.onload?.();
    await settled();
    expect(textures.added).toEqual([]);
  });

  test("a load that fails is forgotten, so a later request tries again", async () => {
    const textures = new FakeTextures();
    const a = new FakeScene(textures);
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    FakeImage.all[0]!.onerror?.();
    await settled();
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    expect(FakeImage.all).toHaveLength(2);
  });

  test("different texture managers are independent", async () => {
    const a = new FakeScene(new FakeTextures());
    const b = new FakeScene(new FakeTextures());
    ensurePictureLoaded(a.asScene, PIC, () => undefined);
    ensurePictureLoaded(b.asScene, PIC, () => undefined);
    expect(FakeImage.all).toHaveLength(2);
  });
});

describe("ensurePictureLoaded decodes off the main thread where it can", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("Image", FakeImage);
  });

  test("the fetched file is decoded by createImageBitmap and handed over as a canvas, not an Image", async () => {
    const bitmap = { width: 640, height: 360, close: vi.fn() };
    const transferred: unknown[] = [];
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ transferFromImageBitmap: (b: unknown) => transferred.push(b) }),
    };
    const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => "blob" }));
    const decode = vi.fn(async () => bitmap);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("createImageBitmap", decode);
    vi.stubGlobal("document", { createElement: () => canvas });
    const sources: unknown[] = [];
    const textures = new FakeTextures();
    textures.addImage = (key: string, source?: unknown) => {
      textures.added.push(key);
      textures.shared.add(key);
      sources.push(source);
    };
    const scene = new FakeScene(textures);
    let ready = 0;
    expect(ensurePictureLoaded(scene.asScene, PIC, () => ready++)).toBeNull();
    await settled();
    expect(fetchMock).toHaveBeenCalledWith("/wallpaper.png");
    expect(decode).toHaveBeenCalledWith("blob");
    expect(FakeImage.all).toHaveLength(0);
    expect(sources).toEqual([canvas]);
    expect([canvas.width, canvas.height]).toEqual([640, 360]);
    expect(transferred).toEqual([bitmap]);
    expect(ready).toBe(1);
  });

  test("a fetch that fails falls back to a plain Image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("refused");
      }),
    );
    vi.stubGlobal("createImageBitmap", vi.fn());
    const textures = new FakeTextures();
    const scene = new FakeScene(textures);
    ensurePictureLoaded(scene.asScene, PIC, () => undefined);
    await settled();
    expect(FakeImage.all.map((image) => image.src)).toEqual(["/wallpaper.png"]);
    FakeImage.all[0]!.onload?.();
    await settled();
    expect(textures.added).toEqual(["wallpaper"]);
  });
});
