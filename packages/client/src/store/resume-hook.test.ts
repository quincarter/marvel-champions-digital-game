import { afterEach, describe, expect, test } from "vitest";
import { runBeforeResume, setBeforeResume } from "./resume-hook.js";

afterEach(() => setBeforeResume(null));

describe("the before-resume hook", () => {
  test("with no hook it does nothing", async () => {
    await expect(runBeforeResume("g")).resolves.toBeUndefined();
  });

  test("runs with the game id and is awaited", async () => {
    const seen: string[] = [];
    setBeforeResume(async (id) => {
      await Promise.resolve();
      seen.push(id);
    });
    await runBeforeResume("g1");
    expect(seen).toEqual(["g1"]);
  });

  test("a hook that rejects or throws never blocks the resume", async () => {
    setBeforeResume(() => Promise.reject(new Error("offline")));
    await expect(runBeforeResume("g")).resolves.toBeUndefined();
    setBeforeResume(() => {
      throw new Error("sync bug");
    });
    await expect(runBeforeResume("g")).resolves.toBeUndefined();
  });
});
