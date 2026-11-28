// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import type { PressEvent } from "@mc/ui";
import { find, mount, press } from "../../test-support.js";
import "../mc-briefing-watch-toggle.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-watch-toggle", () => {
  it("a press raises the watch action, and the tick says whether it is on", async () => {
    const el = await mount("mc-briefing-watch-toggle", { stop: "watch", label: "Let people watch this game" });
    const seen: PressEvent["detail"][] = [];
    el.addEventListener("mc-pressed", (event) => seen.push((event as PressEvent).detail));
    press(el);
    expect(seen).toEqual([{ action: { type: "watch" }, hold: false }]);
    expect(find(el, ".box")?.textContent).toBe("");
    (el as unknown as { checked: boolean }).checked = true;
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(find(el, ".box")?.textContent).toBe("✓");
  });
});
