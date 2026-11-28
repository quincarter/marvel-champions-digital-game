// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-mod-update-bar.js";
import { hear, mount, press, stop } from "../../shared/__tests__/test-mount.js";
import type { McModUpdateBar } from "../McModUpdateBar.js";

describe("mc-mod-update-bar", () => {
  it("says its words and offers Update all, which raises update-all", async () => {
    const el = await mount<McModUpdateBar>("mc-mod-update-bar", {
      bar: {
        text: "2 installed packs have updates.",
        fraction: null,
        action: { id: "update-all", label: "Update all", enabled: true },
        show: null,
      },
    });
    expect(el.shadowRoot!.querySelector(".text")!.textContent).toBe("2 installed packs have updates.");
    const heard = hear(el);
    const button = stop<HTMLElement & { label: string }>(el, "update-all");
    expect(button.label).toBe("↑ Update all");
    press(button);
    expect(heard).toEqual([{ type: "update-all", action: "update-all" }]);
    el.remove();
  });

  it("shows a run's progress and Stop, and Show them under its own key", async () => {
    const el = await mount<McModUpdateBar>("mc-mod-update-bar", {
      bar: {
        text: "Updating 1 of 2: Wolverine",
        fraction: 0.5,
        action: { id: "stop", label: "Stop", enabled: true },
        show: { id: "show-failed", label: "Show them", enabled: true },
      },
    });
    expect(el.shadowRoot!.querySelector(".track")!.getAttribute("aria-valuenow")).toBe("50");
    const heard = hear(el);
    press(stop(el, "update-all-show"));
    press(stop(el, "update-all"));
    expect(heard).toEqual([
      { type: "update-all", action: "show-failed" },
      { type: "update-all", action: "stop" },
    ]);
    el.remove();
  });

  it("does nothing when a disabled button is pressed", async () => {
    const el = await mount<McModUpdateBar>("mc-mod-update-bar", {
      bar: {
        text: "Stopping after this one",
        fraction: 0.2,
        action: { id: "stop", label: "Stop", enabled: false },
        show: null,
      },
    });
    const heard = hear(el);
    press(stop(el, "update-all"));
    expect(heard).toEqual([]);
    el.remove();
  });

  it("draws nothing without a bar", async () => {
    const el = await mount<McModUpdateBar>("mc-mod-update-bar");
    expect(el.shadowRoot!.children.length).toBe(0);
    el.remove();
  });
});
