// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount, stopKeys } from "../../shared/test-support.js";
import "../mc-games-panel.js";
import type { McGamesPanel } from "../McGamesPanel.js";
import type { GamesPanelModel } from "../mc-games-panel.types.js";

afterEach(() => document.body.replaceChildren());

const row = (cardId: string, label: string, kind: "add" | "remove") => ({
  cardId,
  name: cardId,
  detail: "why",
  picture: { src: null },
  action: { label, kind },
});

const model = (over: Partial<GamesPanelModel> = {}): GamesPanelModel => ({
  reading: null,
  headline: "12 games, 9 won",
  insight: "Your deck leans on energy.",
  first: [
    { id: "cut", title: "Cut", rows: [row("c1", "Cut", "remove")] },
    { id: "try", title: "Try", rows: [row("t1", "Add", "add")] },
  ],
  against: null,
  then: [{ id: "keep", title: "Keep", rows: [] }],
  nothing: null,
  note: "Suggestions only.",
  ...over,
});

describe("mc-games-panel", () => {
  it("says it is reading, and only that, while the games load", async () => {
    const el = await mount<McGamesPanel>("mc-games-panel", { model: model({ reading: "Reading your games..." }) });
    expect(inner(el, ".reading")!.textContent).toBe("Reading your games...");
    expect(inner(el, ".headline")).toBeNull();
  });

  it("lists the cut and try sections in order, each button a stop", async () => {
    const el = await mount<McGamesPanel>("mc-games-panel", { model: model() });
    expect(inner(el, ".headline")!.textContent).toBe("12 games, 9 won");
    expect(inner(el, ".insight")!.textContent).toBe("Your deck leans on energy.");
    expect(stopKeys(el)).toEqual(["games:Cut:c1", "games:Add:t1"]);
  });

  it("puts the Against block between the first sections and the rest", async () => {
    const el = await mount<McGamesPanel>("mc-games-panel", {
      model: model({
        against: {
          stepper: null,
          sources: [{ id: "yours", label: "You", chosen: true }],
          note: null,
          share: null,
        },
        then: [{ id: "wins", title: "Wins", rows: [row("w1", "Add", "add")] }],
      }),
    });
    expect(stopKeys(el)).toEqual(["games:Cut:c1", "games:Add:t1", "games:source:yours", "games:Add:w1"]);
  });
});
