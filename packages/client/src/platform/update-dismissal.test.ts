import { describe, expect, it } from "vitest";
import { dismissUpdate, dismissedUpdateVersion, isUpdateDismissed, UPDATE_DISMISSED_KEY } from "./update-dismissal.js";

function memory(): Pick<Storage, "getItem" | "setItem"> & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

describe("update banner dismissal", () => {
  it("remembers the dismissed version and hides only that release", () => {
    const storage = memory();
    expect(dismissedUpdateVersion(storage)).toBeNull();
    expect(isUpdateDismissed("0.21.0", dismissedUpdateVersion(storage))).toBe(false);
    dismissUpdate("0.21.0", storage);
    expect(storage.data.get(UPDATE_DISMISSED_KEY)).toBe("0.21.0");
    expect(isUpdateDismissed("0.21.0", dismissedUpdateVersion(storage))).toBe(true);
  });

  it("a newer release shows the banner again", () => {
    const storage = memory();
    dismissUpdate("0.21.0", storage);
    expect(isUpdateDismissed("0.22.0", dismissedUpdateVersion(storage))).toBe(false);
  });

  it("an unreadable or absent store means nothing is dismissed and never throws", () => {
    expect(dismissedUpdateVersion(null)).toBeNull();
    expect(() => dismissUpdate("0.21.0", null)).not.toThrow();
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(dismissedUpdateVersion(broken)).toBeNull();
    expect(() => dismissUpdate("0.21.0", broken)).not.toThrow();
  });
});
