// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pack-state-chip.js";
import { mount } from "../../shared/__tests__/test-mount.js";
import type { McPackStateChip } from "../McPackStateChip.js";

describe("mc-pack-state-chip", () => {
  it("says a mark and the words, and is outlined unless it is the call to action", async () => {
    const el = await mount<McPackStateChip>("mc-pack-state-chip", { text: "✓ Installed" });
    expect(el.shadowRoot!.querySelector(".chip")!.textContent).toBe("✓ Installed");
    expect(el.hasAttribute("solid")).toBe(false);
    el.solid = true;
    el.text = "+ Install";
    await el.updateComplete;
    expect(el.hasAttribute("solid")).toBe(true);
    expect(el.shadowRoot!.querySelector(".chip")!.textContent).toBe("+ Install");
    el.remove();
  });
});
