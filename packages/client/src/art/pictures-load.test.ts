import { afterEach, describe, expect, test, vi } from "vitest";
import type Phaser from "phaser";
import {
  ensureBakedPictureLoaded,
  ensurePictureLoaded,
  isPictureSettled,
  onPictureLoadFailed,
  PICTURE_BATCH_MS,
  type Picture,
} from "./pictures.js";
import { PictureWait } from "../ui/picture-wait.js";

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

describe("ensurePictureLoaded holds arrivals until the batch is in", () => {
  test("pictures loading together tell a scene once, after the last one arrives", async () => {
    const textures = new FakeTextures();
    const scene = new FakeScene(textures);
    let redraws = 0;
    const redraw = (): void => {
      redraws++;
    };
    const covers: Picture[] = [1, 2, 3].map((n) => ({ key: `cover-${n}`, url: `/cover-${n}.png` }));
    for (const cover of covers) ensurePictureLoaded(scene.asScene, cover, redraw);
    FakeImage.all[0]!.onload?.();
    FakeImage.all[1]!.onload?.();
    await settled();
    expect(redraws).toBe(0);
    expect(textures.added).toEqual(["cover-1", "cover-2"]);
    FakeImage.all[2]!.onload?.();
    await settled();
    expect(redraws).toBe(1);
  });

  test("a picture that never arrives holds the others only so long", async () => {
    vi.useFakeTimers();
    try {
      const textures = new FakeTextures();
      const scene = new FakeScene(textures);
      let redraws = 0;
      ensurePictureLoaded(scene.asScene, { key: "fast", url: "/fast.png" }, () => redraws++);
      ensurePictureLoaded(scene.asScene, { key: "slow", url: "/slow.png" }, () => redraws++);
      FakeImage.all[0]!.onload?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(redraws).toBe(0);
      await vi.advanceTimersByTimeAsync(PICTURE_BATCH_MS);
      expect(redraws).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("isPictureSettled (#713 review)", () => {
  test("loading is not settled; loaded is, and so is a load that failed and was forgotten", async () => {
    const textures = new FakeTextures();
    const scene = new FakeScene(textures);
    const good: Picture = { key: "good", url: "/good.png" };
    const missing: Picture = { key: "missing", url: "/missing.png" };
    ensurePictureLoaded(scene.asScene, good, () => undefined);
    ensurePictureLoaded(scene.asScene, missing, () => undefined);
    expect(isPictureSettled(scene.asScene, "good")).toBe(false);
    expect(isPictureSettled(scene.asScene, "missing")).toBe(false);
    FakeImage.all.find((i) => i.src === "/good.png")!.onload?.();
    FakeImage.all.find((i) => i.src === "/missing.png")!.onerror?.();
    await settled();
    expect(isPictureSettled(scene.asScene, "good")).toBe(true);
    expect(textures.exists("missing")).toBe(false);
    expect(isPictureSettled(scene.asScene, "missing")).toBe(true);
  });
});

describe("a picture that fails after an earlier batch was told (#713 review)", () => {
  test("the wait settles when the last picture fails, not at the cap", async () => {
    vi.useFakeTimers();
    try {
      const textures = new FakeTextures();
      const scene = new FakeScene(textures);
      const wait = new PictureWait((key) => isPictureSettled(scene.asScene, key));
      const off = onPictureLoadFailed(wait.arrived);
      const a: Picture = { key: "a", url: "/a.png" };
      const b: Picture = { key: "b", url: "/b.png" };
      ensurePictureLoaded(scene.asScene, a, wait.arrived);
      ensurePictureLoaded(scene.asScene, b, wait.arrived);
      wait.expect("a");
      wait.expect("b");
      let done = false;
      void wait.settled().then(() => (done = true));
      // A arrives; B is still loading when the batch timer flushes, so only A's batch is told.
      FakeImage.all.find((i) => i.src === "/a.png")!.onload?.();
      await vi.advanceTimersByTimeAsync(PICTURE_BATCH_MS + 1);
      expect(done).toBe(false);
      // Then B fails: its waiters are never told, but the failure listener is.
      FakeImage.all.find((i) => i.src === "/b.png")!.onerror?.();
      await vi.advanceTimersByTimeAsync(1);
      expect(done).toBe(true);
      off();
    } finally {
      vi.useRealTimers();
    }
  });

  test("a failure listener stops hearing once it is removed", async () => {
    const textures = new FakeTextures();
    const scene = new FakeScene(textures);
    const heard: string[] = [];
    const off = onPictureLoadFailed((key) => heard.push(key));
    ensurePictureLoaded(scene.asScene, { key: "x", url: "/x.png" }, () => undefined);
    FakeImage.all.find((i) => i.src === "/x.png")!.onerror?.();
    await settled();
    off();
    ensurePictureLoaded(scene.asScene, { key: "y", url: "/y.png" }, () => undefined);
    FakeImage.all.find((i) => i.src === "/y.png")!.onerror?.();
    await settled();
    expect(heard).toEqual(["x"]);
  });
});

describe("ensureBakedPictureLoaded reuses a copy already in (#713)", () => {
  test("a copy baked for a larger slot draws a smaller one at once, with nothing loaded", () => {
    const textures = new FakeTextures();
    textures.shared.add("cover#@512x256");
    const scene = new FakeScene(textures);
    let told = 0;
    expect(
      ensureBakedPictureLoaded(
        scene.asScene,
        { key: "cover", url: "/cover.png" },
        { width: 256, height: 128 },
        false,
        () => told++,
      ),
    ).toBe("cover#@512x256");
    expect(FakeImage.all).toEqual([]);
    expect(told).toBe(0);
  });

  test("the full picture covers any color slot, but not a gray one", () => {
    const textures = new FakeTextures();
    textures.shared.add("cover");
    const scene = new FakeScene(textures);
    const picture: Picture = { key: "cover", url: "/cover.png" };
    expect(ensureBakedPictureLoaded(scene.asScene, picture, { width: 1024, height: 512 }, false, () => undefined)).toBe(
      "cover",
    );
    expect(
      ensureBakedPictureLoaded(scene.asScene, picture, { width: 256, height: 128 }, true, () => undefined),
    ).toBeNull();
  });

  test("a smaller copy doesn't cover a larger slot", () => {
    const textures = new FakeTextures();
    textures.shared.add("cover#@256x128");
    const scene = new FakeScene(textures);
    expect(
      ensureBakedPictureLoaded(
        scene.asScene,
        { key: "cover", url: "/cover.png" },
        { width: 512, height: 256 },
        false,
        () => undefined,
      ),
    ).toBeNull();
  });
});
