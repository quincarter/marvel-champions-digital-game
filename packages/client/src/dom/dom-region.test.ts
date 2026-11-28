import { describe, expect, it } from "vitest";
import {
  clipWithHoles,
  coveredAbove,
  disjointUnion,
  forwardMouseMoves,
  holesAbove,
  GUARDED_EVENTS,
  panelZIndex,
  regionOpacity,
  inputCoveredAbove,
  regionTakesEvents,
  ringZIndex,
} from "./dom-region.js";

describe("regionTakesEvents", () => {
  it("lets an event through only while the scene takes presses and its panel is shown and not hidden", () => {
    expect(regionTakesEvents(true, true, false)).toBe(true);
    // Another modal opened over this panel: a hold armed before it must not Inspect.
    expect(regionTakesEvents(true, false, false)).toBe(false);
    expect(regionTakesEvents(false, true, false)).toBe(false);
    expect(regionTakesEvents(true, true, true)).toBe(false);
  });

  it("guards the inspect a hold raises as well as the activation", () => {
    expect(GUARDED_EVENTS).toEqual([
      "mc-activate",
      "mc-music",
      "mc-inspect",
      "mc-slide",
      "mc-step",
      "mc-search",
      "mc-submit",
      "mc-info",
      "mc-sort",
      "mc-filter-sheet",
      "mc-input",
      "mc-field-focus",
      "mc-search-focus",
      "mc-tile-focus",
      "mc-seats",
      "mc-setup",
      "mc-deck-check",
      "mc-card-inspect",
      "mc-scenario-select",
      "mc-title",
      "mc-decks",
    ]);
  });
});

describe("regionOpacity", () => {
  it("follows the camera fade: hidden while black, clear once the fade is over", () => {
    expect(regionOpacity({ isRunning: true, isComplete: false, alpha: 1 }, 1)).toBe(0);
    expect(regionOpacity({ isRunning: true, isComplete: false, alpha: 0.25 }, 1)).toBe(0.75);
    // A finished fade-out leaves the screen black until the next screen starts.
    expect(regionOpacity({ isRunning: false, isComplete: true, alpha: 1 }, 1)).toBe(0);
    expect(regionOpacity({ isRunning: false, isComplete: false, alpha: 1 }, 1)).toBe(1);
    expect(regionOpacity(undefined, 0.5)).toBe(0.5);
  });
});

describe("coveredAbove", () => {
  const chrome = new Set(["MusicButton", "AchievementToast"]);
  const scenes = [
    { key: "Board", active: true, visible: true },
    { key: "Credits", active: true, visible: true },
    { key: "Pause", active: false, visible: true },
    { key: "MusicButton", active: true, visible: true },
    { key: "AchievementToast", active: true, visible: true },
  ];

  it("is not covered by chrome or by a scene that isn't up", () => {
    expect(coveredAbove(scenes, "Credits", chrome)).toBe(false);
  });

  it("is covered by a paused scene above it that is still drawn (as `active` here means drawn)", () => {
    const paused = scenes.map((scene) => (scene.key === "Pause" ? { ...scene, active: true } : scene));
    expect(coveredAbove(paused, "Credits", chrome)).toBe(true);
    const hidden = paused.map((scene) => (scene.key === "Pause" ? { ...scene, visible: false } : scene));
    expect(coveredAbove(hidden, "Credits", chrome)).toBe(false);
  });

  it("is covered by a scene above it that is up", () => {
    expect(coveredAbove(scenes, "Board", chrome)).toBe(true);
    const paused = scenes.map((scene) => (scene.key === "Pause" ? { ...scene, active: true } : scene));
    expect(coveredAbove(paused, "Credits", chrome)).toBe(true);
  });
});

describe("coveredAbove, scenes a panel stays shown under", () => {
  const chrome = new Set<string>();
  const scenes = [
    { key: "Board", active: true, visible: true },
    { key: "ReplayTransport", active: true, visible: true },
    { key: "Pause", active: true, visible: true },
  ];

  it("ignores a scene it is told to stay shown under, and still hides under any other", () => {
    const passes = new Set(["ReplayTransport"]);
    expect(coveredAbove(scenes.slice(0, 2), "Board", chrome)).toBe(true);
    expect(coveredAbove(scenes.slice(0, 2), "Board", chrome, passes)).toBe(false);
    expect(coveredAbove(scenes, "Board", chrome, passes), "Pause still covers it").toBe(true);
  });
});

describe("clipWithHoles", () => {
  const box = { x: 100, y: 50, width: 400, height: 300 };

  it("cuts a toast that lands over the panel out of it, in the panel's own coordinates", () => {
    expect(clipWithHoles(box, [{ x: 300, y: 300, width: 400, height: 100 }])).toBe(
      'path(evenodd, "M0 0H400V300H0ZM200 250H400V300H200Z")',
    );
  });

  it("leaves the panel whole when nothing overlaps it", () => {
    expect(clipWithHoles(box, [])).toBeNull();
    expect(clipWithHoles(box, [{ x: 0, y: 0, width: 50, height: 40 }])).toBeNull();
  });
});

describe("disjointUnion", () => {
  const area = (rects: readonly { width: number; height: number }[]) =>
    rects.reduce((sum, r) => sum + r.width * r.height, 0);

  it("covers two overlapping cutouts once, so the panel never comes back where they overlap", () => {
    // A toast's box and its tap zone, overlapping: 100x40 and 60x60 sharing a 40x20 corner.
    const parts = disjointUnion([
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 60, y: 20, width: 60, height: 60 },
    ]);
    expect(area(parts)).toBe(100 * 40 + 60 * 60 - 40 * 20);
    for (const [i, a] of parts.entries())
      for (const b of parts.slice(i + 1))
        expect(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height).toBe(false);
  });

  it("leaves one rect as it is", () => {
    expect(disjointUnion([{ x: 5, y: 6, width: 7, height: 8 }])).toEqual([{ x: 5, y: 6, width: 7, height: 8 }]);
  });
});

describe("coveredAbove with a pop-up that draws its own panel", () => {
  const chrome = new Set(["MusicButton"]);
  const scenes = [
    { key: "Board", active: true, visible: true },
    { key: "Pause", active: true, visible: true },
    { key: "Confirm", active: true, visible: true, overlay: true },
    { key: "MusicButton", active: true, visible: true },
  ];

  it("leaves the panel under it shown, since the pop-up's scrim and panel are DOM above it", () => {
    expect(coveredAbove(scenes, "Pause", chrome)).toBe(false);
  });

  it("still covers the scene below Pause, which Pause (not an overlay) draws over", () => {
    expect(coveredAbove(scenes, "Board", chrome)).toBe(true);
  });

  it("is covered by a Phaser-drawn scene above the pop-up all the same", () => {
    const over = [...scenes.slice(0, 3), { key: "Inspect", active: true, visible: true }];
    expect(coveredAbove(over, "Pause", chrome)).toBe(true);
  });

  it("is covered only while a non-overlay scene is drawn above", () => {
    const gone = scenes.map((scene) => (scene.key === "Confirm" ? { ...scene, active: false } : scene));
    expect(coveredAbove(gone, "Pause", chrome)).toBe(false);
    const phaser = scenes.map((scene) => (scene.key === "Confirm" ? { ...scene, overlay: false } : scene));
    expect(coveredAbove(phaser, "Pause", chrome)).toBe(true);
  });
});

describe("inputCoveredAbove with a pop-up that draws its own panel", () => {
  const chrome = new Set(["MusicButton"]);
  const scenes = [
    { key: "Settings", active: true, visible: true },
    { key: "OnlineName", active: true, visible: true, overlay: true },
    { key: "MusicButton", active: true, visible: true },
  ];

  it("takes input from the panel under a DOM pop-up that coveredAbove leaves drawn", () => {
    expect(coveredAbove(scenes, "Settings", chrome)).toBe(false);
    expect(inputCoveredAbove(scenes, "Settings", chrome)).toBe(true);
  });

  it("lets chrome scenes and shownUnder scenes through", () => {
    expect(
      inputCoveredAbove(
        scenes.filter((scene) => scene.key !== "OnlineName"),
        "Settings",
        chrome,
      ),
    ).toBe(false);
    expect(inputCoveredAbove(scenes, "Settings", chrome, new Set(["OnlineName"]))).toBe(false);
  });

  it("ignores a pop-up that is gone, hidden or below, and a scene that is not listed", () => {
    const gone = scenes.map((scene) => (scene.key === "OnlineName" ? { ...scene, active: false } : scene));
    expect(inputCoveredAbove(gone, "Settings", chrome)).toBe(false);
    expect(inputCoveredAbove(scenes, "OnlineName", chrome)).toBe(false);
    expect(inputCoveredAbove(scenes, "Nope", chrome)).toBe(false);
  });
});

describe("panelZIndex", () => {
  const scenes = [{ key: "Board" }, { key: "Pause" }, { key: "Confirm" }];

  it("stacks panels in the scenes' draw order, so a pop-up drawn above Pause sits above its panel", () => {
    expect(panelZIndex(scenes, "Confirm")).toBeGreaterThan(panelZIndex(scenes, "Pause"));
    expect(panelZIndex(scenes, "Pause")).toBeGreaterThan(panelZIndex(scenes, "Board"));
  });

  it("follows a scene brought to the top", () => {
    const moved = [{ key: "Board" }, { key: "Confirm" }, { key: "Pause" }];
    expect(panelZIndex(moved, "Pause")).toBeGreaterThan(panelZIndex(moved, "Confirm"));
  });

  it("puts a scene's focus ring over its own panel and under the panel of the scene above", () => {
    expect(ringZIndex(scenes, "Pause")).toBeGreaterThan(panelZIndex(scenes, "Pause"));
    expect(ringZIndex(scenes, "Pause")).toBeLessThan(panelZIndex(scenes, "Confirm"));
  });

  it("gives a scene that is not listed no stacking", () => {
    expect(panelZIndex(scenes, "Nope")).toBe(0);
  });
});

describe("holesAbove", () => {
  it("is empty for a scene with no overlay above it, or one not listed", () => {
    expect(holesAbove([{ key: "Board" }, { key: "Pause" }], "Board")).toEqual([]);
    expect(holesAbove([{ key: "Board" }], "Nope")).toEqual([]);
  });
});

describe("forwardMouseMoves", () => {
  const move = (pointerType: string, clientX = 40, clientY = 90): Event =>
    Object.assign(new Event("pointermove"), { pointerType, clientX, clientY, screenX: 5, screenY: 6, buttons: 0 });

  it("passes a mouse move on to the canvas at the same client coordinates, and stops when told", () => {
    const panel = new EventTarget();
    const canvas = new EventTarget();
    const heard: Event[] = [];
    canvas.addEventListener("mousemove", (event) => heard.push(event));
    const off = forwardMouseMoves(panel, canvas, (init) => Object.assign(new Event("mousemove"), init));
    panel.dispatchEvent(move("mouse"));
    expect(heard).toHaveLength(1);
    expect(heard[0]).toMatchObject({ type: "mousemove", clientX: 40, clientY: 90, buttons: 0 });
    off();
    panel.dispatchEvent(move("mouse"));
    expect(heard).toHaveLength(1);
  });

  it("leaves a finger and a pen alone", () => {
    const panel = new EventTarget();
    const canvas = new EventTarget();
    let count = 0;
    canvas.addEventListener("mousemove", () => count++);
    forwardMouseMoves(panel, canvas, () => new Event("mousemove"));
    panel.dispatchEvent(move("touch"));
    panel.dispatchEvent(move("pen"));
    expect(count).toBe(0);
  });
});
