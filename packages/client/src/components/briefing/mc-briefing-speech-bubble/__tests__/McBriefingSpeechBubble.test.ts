// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { find, mount, wordsOf } from "../../test-support.js";
import "../mc-briefing-speech-bubble.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-speech-bubble", () => {
  it("names the speaker in capitals over the line", async () => {
    const el = await mount("mc-briefing-speech-bubble", { text: "We go in at dawn.", speaker: "Nick Fury" });
    expect(wordsOf(el)).toBe("NICK FURY We go in at dawn.");
    expect(find(el, ".who")?.textContent).toBe("NICK FURY");
  });

  it("draws narration with no speaker line", async () => {
    const el = await mount("mc-briefing-speech-bubble", { text: "Meanwhile..." });
    expect(find(el, ".who")).toBeNull();
    expect(find(el, ".words")?.textContent).toBe("Meanwhile...");
  });
});
