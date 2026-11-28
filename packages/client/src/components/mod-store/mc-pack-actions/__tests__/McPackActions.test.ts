// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pack-actions.js";
import { hear, mount, press, stop } from "../../shared/__tests__/test-mount.js";
import type { McPackActions } from "../McPackActions.js";

describe("mc-pack-actions", () => {
  it("draws a button per action under the key action:<id>, and raises pack-action when one is pressed", async () => {
    const el = await mount<McPackActions>("mc-pack-actions", {
      actions: [
        { id: "install", label: "Install", kind: "primary", enabled: true },
        { id: "remove", label: "Remove", kind: "secondary", enabled: true },
      ],
    });
    const heard = hear(el);
    press(stop(el, "action:install"));
    press(stop(el, "action:remove"));
    expect(heard).toEqual([
      { type: "pack-action", action: "install" },
      { type: "pack-action", action: "remove" },
    ]);
    expect(stop(el, "action:install").getAttribute("data-key")).toBe("action:install");
    el.remove();
  });

  it("keeps an unavailable button in place, dimmed, with its reason, and a press does nothing", async () => {
    const el = await mount<McPackActions>("mc-pack-actions", {
      actions: [{ id: "install", label: "Install", kind: "primary", enabled: false, reason: "Needs a newer app" }],
    });
    const button = stop<HTMLElement & { disabled: boolean; reason: string }>(el, "action:install");
    expect(button.disabled).toBe(true);
    expect(button.reason).toBe("Needs a newer app");
    const heard = hear(el);
    press(button);
    expect(heard).toEqual([]);
    el.remove();
  });
});
