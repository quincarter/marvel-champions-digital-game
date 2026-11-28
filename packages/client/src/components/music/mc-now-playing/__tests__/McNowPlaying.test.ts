// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-now-playing.js";

afterEach(() => document.body.replaceChildren());

describe("mc-now-playing", () => {
  it("says what plays and what plays it, and goes idle when nothing plays", async () => {
    const el = document.createElement("mc-now-playing");
    el.status = "NOW PLAYING";
    el.song = "Main Title";
    el.detail = "Repeating this song";
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector(".status")!.textContent).toBe("NOW PLAYING");
    expect(root.querySelector(".title")!.textContent).toBe("Main Title");
    expect(root.querySelector(".detail")!.textContent).toBe("Repeating this song");
    expect(el.hasAttribute("idle")).toBe(false);
    el.status = "NOTHING PLAYING";
    el.song = null;
    el.detail = null;
    await el.updateComplete;
    expect(el.hasAttribute("idle")).toBe(true);
    expect(root.querySelector(".title")).toBeNull();
    expect(root.querySelector(".detail")).toBeNull();
  });
});
