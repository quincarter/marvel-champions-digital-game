// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { mount, wordsOf } from "../../test-support.js";
import "../mc-briefing-call-prompt.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-call-prompt", () => {
  it("names who decides, the box plain words, then the printed rule under its label", async () => {
    const el = await mount("mc-briefing-call-prompt", {
      model: { who: "Seat 2", explain: "Pick a role for this hero.", rule: "Each player chooses a role." },
    });
    expect(wordsOf(el)).toBe("SEAT 2 Pick a role for this hero. THE RULE Each player chooses a role.");
  });

  it("with no plain words it is the printed rule alone", async () => {
    const el = await mount("mc-briefing-call-prompt", { model: { who: null, explain: null, rule: "Choose one." } });
    expect(wordsOf(el)).toBe("Choose one.");
  });
});
