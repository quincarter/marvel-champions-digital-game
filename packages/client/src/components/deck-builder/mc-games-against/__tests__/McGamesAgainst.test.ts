// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-games-against.js";
import type { McGamesAgainst } from "../McGamesAgainst.js";
import type { GamesAgainstModel } from "../mc-games-against.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<GamesAgainstModel> = {}): GamesAgainstModel => ({
  stepper: { headline: "Against Rhino", steppable: true, previousLabel: "Previous villain" },
  sources: [
    { id: "yours", label: "You", chosen: true },
    { id: "everyone", label: "Everyone", chosen: false },
  ],
  note: null,
  share: null,
  ...over,
});

describe("mc-games-against", () => {
  it("names the stepper and the two sources by the stop keys the specs use", async () => {
    const el = await mount<McGamesAgainst>("mc-games-against", { model: model() });
    expect(stopKeys(el)).toEqual(["games:previous", "games:against", "games:source:yours", "games:source:everyone"]);
  });

  it("steps the villain both ways and chooses a source", async () => {
    const el = await mount<McGamesAgainst>("mc-games-against", { model: model() });
    const seen = builderEvents(el);
    press(stop(el, "games:previous"));
    press(stop(el, "games:against"));
    press(stop(el, "games:source:everyone"));
    expect(seen).toEqual([
      { type: "games-step", dir: -1 },
      { type: "games-step", dir: 1 },
      { type: "games-source", source: "everyone" },
    ]);
  });

  it("ticks the chosen source and leaves a single villain as a dimmed label with no stop", async () => {
    const el = await mount<McGamesAgainst>("mc-games-against", {
      model: model({ stepper: { headline: "Against Rhino", steppable: false, previousLabel: "" } }),
    });
    expect((stop(el, "games:source:yours") as unknown as { label: string }).label).toBe("✓ You");
    expect(stopKeys(el)).toEqual(["games:source:yours", "games:source:everyone"]);
  });

  it("offers Share only when the model has it, with its line, and says so when pressed", async () => {
    const el = await mount<McGamesAgainst>("mc-games-against", {
      model: model({
        share: { label: "Share my games", line: "Nothing is sent until you press this." },
        note: "Reading...",
      }),
    });
    const seen = builderEvents(el);
    press(stop(el, "games:share"));
    expect(seen).toEqual([{ type: "games-share" }]);
    expect(inner(el, ".share .line")!.textContent).toBe("Nothing is sent until you press this.");
    expect(inner(el, ".note")!.textContent).toBe("Reading...");
  });
});
