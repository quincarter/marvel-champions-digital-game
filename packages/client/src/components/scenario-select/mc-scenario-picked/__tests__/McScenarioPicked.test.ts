// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount, press, selectEvents, tap } from "../../test-support.js";
import "../mc-scenario-picked.js";

afterEach(() => document.body.replaceChildren());

const base = {
  heading: "Scenario stages",
  picked: true,
  emptyText: "Pick a villain",
  emptyHint: "Pick one",
  collapsible: false,
  open: false,
  summary: "RHINO I\u2013III",
  note: "",
  stages: [
    { name: "I \u00b7 RHINO", stats: "SCH 1", current: true },
    { name: "II \u00b7 RHINO", stats: "SCH 1", current: false },
  ],
  record: { label: "Record", tally: "Not played yet", subline: "", tone: "unplayed" },
  sets: [{ heading: "Encounter sets", value: "Rhino" }],
  stats: [{ label: "Main scheme", value: "x" }],
};

describe("mc-scenario-picked", () => {
  it("a wide panel shows its stages, record and sets, and no toggle", async () => {
    const el = await mount("mc-scenario-picked", { wide: true, model: base });
    expect(el.shadowRoot!.querySelectorAll("mc-scenario-stage")).toHaveLength(2);
    expect(inner(el, "mc-scenario-record")).not.toBeNull();
    expect(inner(el, "mc-scenario-set-block")).not.toBeNull();
    expect(inner(el, "[data-stop]")).toBeNull();
  });

  it("before a pick it says what it will show", async () => {
    const el = await mount("mc-scenario-picked", { wide: true, model: { ...base, picked: false } });
    expect(inner(el, ".note")!.textContent).toBe("Pick a villain");
    expect(el.shadowRoot!.querySelectorAll("mc-scenario-stage")).toHaveLength(0);
  });

  it("a narrow panel is one bar (the stages-toggle stop) while shut, with its summary", async () => {
    const el = await mount("mc-scenario-picked", { model: { ...base, collapsible: true } });
    const bar = inner<HTMLElement>(el, "button.bar")!;
    expect(bar.dataset.stop).toBe("stages-toggle");
    expect(bar.getAttribute("aria-expanded")).toBe("false");
    expect(inner(el, ".summary")!.textContent).toBe("RHINO I\u2013III");
    expect(el.shadowRoot!.querySelectorAll("mc-scenario-stage")).toHaveLength(0);
  });

  it("opens into a sheet with the stat strip and the stages, and a tap or a click on the bar presses stages-toggle", async () => {
    const el = await mount("mc-scenario-picked", { model: { ...base, collapsible: true, open: true } });
    const seen = selectEvents(el);
    expect(inner(el, "mc-scenario-stats")).not.toBeNull();
    expect(el.shadowRoot!.querySelectorAll("mc-scenario-stage")).toHaveLength(2);
    const bar = inner<HTMLElement>(el, "button.bar")!;
    tap(bar);
    press(bar);
    expect(seen).toEqual([
      { type: "press", key: "stages-toggle" },
      { type: "press", key: "stages-toggle" },
    ]);
  });
});
