import { describe, expect, test } from "vitest";
import { SAGA_VIEW_KEY, rememberSagaVolumesView, sagaVolumesView } from "./saga-view.js";

const memory = (): Pick<Storage, "getItem" | "setItem"> => {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => void values.set(key, value) };
};

describe("the Saga's volumes view", () => {
  test("starts on the screen's default, and keeps the player's choice", () => {
    const storage = memory();
    expect(sagaVolumesView("grid", storage)).toBe("grid");
    expect(sagaVolumesView("list", storage)).toBe("list");
    rememberSagaVolumesView("list", storage);
    expect(sagaVolumesView("grid", storage)).toBe("list");
    rememberSagaVolumesView("grid", storage);
    expect(sagaVolumesView("list", storage)).toBe("grid");
  });

  test("anything unreadable is the screen's default", () => {
    const storage = memory();
    storage.setItem(SAGA_VIEW_KEY, "shelf");
    expect(sagaVolumesView("list", storage)).toBe("list");
    expect(sagaVolumesView("grid", null)).toBe("grid");
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(sagaVolumesView("list", broken)).toBe("list");
    expect(() => rememberSagaVolumesView("list", broken)).not.toThrow();
  });
});
