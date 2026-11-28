// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, findAll, mount, press, stopsOf } from "../../test-support.js";
import "../mc-briefing-options.js";

afterEach(() => document.body.replaceChildren());

const option = (id: string, card: unknown = null) => ({ id, label: `Label ${id}`, card });
const base = { random: false, acceptValue: "accept", count: 1, optional: false, confirmGlyph: null };

describe("mc-briefing-options", () => {
  it("a single pick answers on the press of the option button", async () => {
    const el = await mount("mc-briefing-options", { model: { ...base, options: [option("a"), option("b")] } });
    expect(stopsOf(el)).toEqual(["call-option:0", "call-option:1"]);
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="call-option:1"]')!);
    expect(seen).toEqual([{ type: "answer", picked: ["b"] }]);
  });

  it("a multi pick toggles, and Confirm is a stop only once exactly count are chosen", async () => {
    const el = await mount("mc-briefing-options", {
      model: { ...base, count: 2, optional: true, options: [option("a"), option("b"), option("c")] },
    });
    expect(stopsOf(el)).not.toContain("call-confirm");
    press(find(el, '[data-stop="call-option:0"]')!);
    press(find(el, '[data-stop="call-option:2"]')!);
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(stopsOf(el)).toContain("call-confirm");
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="call-confirm"]')!);
    expect(seen).toEqual([{ type: "answer", picked: ["a", "c"] }]);
    press(find(el, '[data-stop="call-decline"]')!);
    expect(seen[1]).toEqual({ type: "answer", picked: [] });
  });

  it("an option that is a card has a picture stop that inspects and answers nothing", async () => {
    const el = await mount("mc-briefing-options", {
      model: {
        ...base,
        options: [option("a", { cardId: "01001", name: "Desperate Measures", shape: "portrait", picture: { src: null } })],
      },
    });
    expect(stopsOf(el)).toEqual(["call-inspect:0", "call-option:0"]);
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="call-inspect:0"]')!);
    expect(seen).toEqual([{ type: "inspect", cardId: "01001", name: "Desperate Measures" }]);
  });

  it("a random draw is Take it and Decline", async () => {
    const el = await mount("mc-briefing-options", { model: { ...base, random: true, options: [] } });
    expect(stopsOf(el)).toEqual(["call-decline", "call-accept"]);
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="call-accept"]')!);
    expect(seen).toEqual([{ type: "answer", picked: ["accept"] }]);
    expect(findAll(el, "mc-button")).toHaveLength(2);
  });
});
