// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-pool-pick.js";
import type { McPoolPick } from "../McPoolPick.js";
import type { PoolPickModel } from "../mc-pool-pick.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<PoolPickModel> = {}): PoolPickModel => ({
  title: "Pick packs",
  subtitle: "Choose several.",
  allLabel: "All packs",
  allChosen: false,
  rows: [
    { kind: "heading", text: "Core" },
    { kind: "choice", id: "core", name: "Core Set", selected: true },
    { kind: "choice", id: "ant", name: "Ant-Man", selected: false },
  ],
  doneLabel: "Done",
  ...over,
});

describe("mc-pool-pick", () => {
  it("names All, every choice and Done as the stops the specs use", async () => {
    const el = await mount<McPoolPick>("mc-pool-pick", { model: model() });
    expect(stopKeys(el)).toEqual(["pick:all", "pick:core", "pick:ant", "done"]);
  });

  it("says which choice toggled, All, and close", async () => {
    const el = await mount<McPoolPick>("mc-pool-pick", { model: model() });
    const seen = builderEvents(el);
    press(stop(el, "pick:ant"));
    press(stop(el, "pick:all"));
    press(stop(el, "done"));
    expect(seen).toEqual([{ type: "pick-toggle", id: "ant" }, { type: "pick-all" }, { type: "sheet-close" }]);
  });

  it("ticks what is chosen in words, never colour alone", async () => {
    const el = await mount<McPoolPick>("mc-pool-pick", { model: model({ allChosen: true }) });
    expect((stop(el, "pick:core") as unknown as { label: string }).label).toBe("✓ Core Set");
    expect((stop(el, "pick:ant") as unknown as { label: string }).label).toBe("Ant-Man");
    expect((stop(el, "pick:all") as unknown as { label: string }).label).toBe("✓ All packs");
  });

  it("puts a heading before each group", async () => {
    const el = await mount<McPoolPick>("mc-pool-pick", { model: model() });
    expect(inner(el, ".head")!.textContent).toBe("Core");
  });
});
