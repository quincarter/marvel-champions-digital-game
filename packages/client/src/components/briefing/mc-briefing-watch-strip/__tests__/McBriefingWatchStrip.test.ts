// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, mount, press } from "../../test-support.js";
import "../mc-briefing-watch-strip.js";

afterEach(() => document.body.replaceChildren());

const watch = { label: "Let people watch this game", on: false };

describe("mc-briefing-watch-strip", () => {
  it("shows the reason in words and no toggle while Open waits", async () => {
    const el = await mount("mc-briefing-watch-strip", { reason: "Answer this to open issue #3.", watch });
    expect(find(el, ".reason")?.textContent).toBe("Answer this to open issue #3.");
    expect(find(el, "mc-briefing-watch-toggle")).toBeNull();
  });

  it("with no reason it shows the toggle, whose press raises watch", async () => {
    const el = await mount("mc-briefing-watch-strip", { watch });
    const seen = briefingEvents(el);
    press(find(el, "mc-briefing-watch-toggle")!);
    expect(seen).toEqual([{ type: "watch" }]);
  });

  it("shows nothing when there is neither", async () => {
    const el = await mount("mc-briefing-watch-strip");
    expect(el.shadowRoot!.children.length).toBe(0);
  });
});
