/**
 * A lesson step must not appear or change while something is playing over the board that the player is only watching
 * (the villain-phase walkthrough auto-advancing): `GuideControllerOptions.blocked` holds the change back, the held
 * view keeps what was on screen, the buttons do nothing, and the new step shows the moment the board waits again.
 * Owner, 2026-10-03: the Shadowcat "back to Solid" step used to pop up mid-walkthrough.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { EngineSessionCore } from "../engine/session-core.js";
import { MECHANIC_TRYIT_CONFIGS } from "./mechanic-tryit-config.js";
import { resetGuidePrefsCacheForTests } from "./guide-store.js";
import { GuideController } from "./guide-controller.js";
import type { Lesson, LessonObservation } from "../view/lesson-model.js";

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

beforeEach(() => {
  resetGuidePrefsCacheForTests();
  vi.stubGlobal("localStorage", fakeStorage());
});

const lesson: Lesson = {
  id: "hold-lesson",
  title: "Hold",
  steps: [
    { id: "a", copy: { title: "Step A", body: "a" }, mode: "acknowledge" },
    { id: "b", copy: { title: "Step B", body: "b" }, mode: "acknowledge" },
    { id: "c", overWalkthrough: true, copy: { title: "Step C", body: "c" }, mode: "acknowledge" },
    { id: "d", copy: { title: "Step D", body: "d" }, mode: "acknowledge" },
  ],
};

async function observation(): Promise<LessonObservation> {
  const core = new EngineSessionCore();
  const started = await core.start(MECHANIC_TRYIT_CONFIGS.storm.config);
  return {
    game: started.snapshot.state as unknown as LessonObservation["game"],
    lastEvents: [],
    perspectiveId: started.snapshot.state.players[0]!.playerId,
  };
}

const title = (controller: GuideController): string | null => controller.view().panel?.title ?? null;

describe("GuideController blocked", () => {
  test("holds a step change while blocked: the last step stays, buttons do nothing, the new step shows on release", async () => {
    let blocked = false;
    const controller = new GuideController(
      { lessons: [lesson], blocked: () => blocked, onComplete: () => undefined },
      await observation(),
    );
    expect(title(controller)).toBe("Step A");

    blocked = true;
    controller.primary(); // A is what is on screen, so it can still be acknowledged: B is now current underneath
    expect(title(controller)).toBe("Step A"); // held: B must not appear yet
    expect(controller.view().step?.id).toBe("a");
    controller.primary(); // a held view's buttons do nothing
    controller.skip();
    controller.back();
    expect(title(controller)).toBe("Step A");

    blocked = false;
    expect(title(controller)).toBe("Step B");
    expect(controller.view().step?.id).toBe("b");
  });

  test("never holds when not blocked (the default)", async () => {
    const controller = new GuideController({ lessons: [lesson], onComplete: () => undefined }, await observation());
    controller.primary();
    expect(title(controller)).toBe("Step B");
  });

  test("a step marked overWalkthrough shows over the walkthrough", async () => {
    let blocked = false;
    const controller = new GuideController(
      { lessons: [lesson], blocked: () => blocked, onComplete: () => undefined },
      await observation(),
    );
    controller.primary(); // to B
    expect(title(controller)).toBe("Step B");
    blocked = true;
    controller.primary(); // to C (overWalkthrough): shown even while blocked
    expect(title(controller)).toBe("Step C");
    controller.primary(); // to D: held
    expect(title(controller)).toBe("Step C");
    blocked = false;
    expect(title(controller)).toBe("Step D");
  });

  test("with nothing shown yet, a blocked controller draws nothing until released", async () => {
    let blocked = true;
    const controller = new GuideController(
      { lessons: [lesson], blocked: () => blocked, onComplete: () => undefined },
      await observation(),
    );
    expect(controller.view().active).toBe(false);
    expect(controller.view().panel).toBeNull();
    blocked = false;
    expect(title(controller)).toBe("Step A");
  });

  test("the finished panel is held too, and shows after the walkthrough ends", async () => {
    let blocked = false;
    const controller = new GuideController(
      { lessons: [lesson], blocked: () => blocked, onComplete: () => undefined, completeTitle: "All done" },
      await observation(),
    );
    controller.primary();
    controller.primary();
    controller.primary(); // now on D
    expect(title(controller)).toBe("Step D");
    blocked = true;
    controller.primary(); // D is on screen: acknowledging it finishes the lesson underneath
    expect(title(controller)).toBe("Step D");
    blocked = false;
    expect(title(controller)).toBe("All done");
  });
});
