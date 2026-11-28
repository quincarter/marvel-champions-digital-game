// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { find, mount, wordsOf } from "../../test-support.js";
import "../mc-briefing-speaker.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-speaker", () => {
  it("shows a picture portrait beside the bubble", async () => {
    const el = await mount("mc-briefing-speaker", {
      model: { portrait: { picture: { src: "hero.png" }, initial: null }, speaker: "Colossus", text: "Ready." },
    });
    expect(find(el, "mc-picture-tile")).not.toBeNull();
    expect(wordsOf(el)).toContain("COLOSSUS");
    expect(wordsOf(el)).toContain("Ready.");
  });

  it("a voice with no picture draws its initial and never a face", async () => {
    const el = await mount("mc-briefing-speaker", {
      model: { portrait: { picture: null, initial: "n" }, speaker: null, text: "A narrator." },
    });
    expect(find(el, "mc-picture-tile")).toBeNull();
    expect(find(el, ".initial")?.textContent).toBe("N");
  });
});
