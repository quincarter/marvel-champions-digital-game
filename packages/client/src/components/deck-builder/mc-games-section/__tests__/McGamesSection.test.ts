// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount, stopKeys } from "../../shared/test-support.js";
import "../mc-games-section.js";
import type { McGamesSection } from "../McGamesSection.js";

afterEach(() => document.body.replaceChildren());

const row = (cardId: string) => ({
  cardId,
  name: `Card ${cardId}`,
  detail: "why",
  picture: { src: null },
  action: { label: "Cut", kind: "remove" as const },
});

describe("mc-games-section", () => {
  it("draws its title and a row per card", async () => {
    const el = await mount<McGamesSection>("mc-games-section", {
      model: { id: "cut", title: "Cards to cut", rows: [row("a"), row("b")] },
    });
    expect(inner(el, ".title")!.textContent).toBe("Cards to cut");
    expect(stopKeys(el)).toEqual(["games:Cut:a", "games:Cut:b"]);
  });

  it("draws nothing for a section with no card", async () => {
    const el = await mount<McGamesSection>("mc-games-section", {
      model: { id: "cut", title: "Cards to cut", rows: [] },
    });
    expect(inner(el, ".title")).toBeNull();
  });
});
