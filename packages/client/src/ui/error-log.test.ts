import { describe, expect, test, vi } from "vitest";
import { recentErrors, recordError } from "./error-log.js";

describe("recordError", () => {
  test("records an error with where it happened, and counts an immediate repeat instead of flooding", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const before = recentErrors().length;
    recordError(new TypeError("Cannot read properties of null (reading 'drawImage')"), "tween onUpdate");
    recordError(new TypeError("Cannot read properties of null (reading 'drawImage')"), "tween onUpdate");
    const added = recentErrors().slice(before);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ where: "tween onUpdate", count: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  test("keeps only the most recent ten", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 15; i++) recordError(new Error(`e${i}`), "frame");
    expect(recentErrors().length).toBeLessThanOrEqual(10);
    expect(recentErrors()[recentErrors().length - 1]?.message).toBe("e14");
    spy.mockRestore();
  });
});
