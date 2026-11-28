// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, mount, press, stopsOf, wordsOf } from "../../test-support.js";
import "../mc-briefing-call.js";

afterEach(() => document.body.replaceChildren());

const head = { hint: "Answer this to open issue #1.", seat: null, phone: false };
const tile = (id: string) => ({
  stop: `role:${id}`,
  action: { type: "role", id },
  title: id,
  body: `${id} summary`,
  available: true,
});
const confirm = (id: string) => ({
  roleId: id,
  title: `COLOSSUS WILL BE THE ${id.toUpperCase()}`,
  chips: [],
  summary: "Summary.",
  relation: "Adds Aggression",
  notes: [],
  bar: { stops: { back: "role-back", confirm: "role-confirm" }, glyph: null },
  phone: false,
});

const roleCall = (key: string) => ({
  key,
  head,
  prompt: { who: null, explain: null, rule: "Choose a role." },
  glyph: null,
  ownsScroll: false,
  body: {
    kind: "role",
    tiles: { tiles: [tile("brawler"), tile("defender")], note: { heading: "What roles do", lines: [] } },
    confirms: new Map([["brawler", confirm("brawler")]]),
  },
});

const next = async (el: Element) => (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

describe("mc-briefing-call", () => {
  it("opens with the head and the prompt, then the kind of question", async () => {
    const el = await mount("mc-briefing-call", { call: roleCall("a") });
    expect(wordsOf(el)).toContain("YOUR CALL");
    expect(wordsOf(el)).toContain("Choose a role.");
    expect(stopsOf(el)).toEqual(["role:brawler", "role:defender"]);
  });

  it("a role tile opens its confirm step, where only Confirm answers and Back returns", async () => {
    const el = await mount("mc-briefing-call", { call: roleCall("a") });
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="role:brawler"]')!);
    await next(el);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stopsOf(el)).toEqual(["role-back", "role-confirm"]);
    expect(seen).toEqual([]);
    press(find(el, '[data-stop="role-back"]')!);
    await next(el);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stopsOf(el)).toContain("role:brawler");
    press(find(el, '[data-stop="role:brawler"]')!);
    await next(el);
    await new Promise((resolve) => setTimeout(resolve, 0));
    press(find(el, '[data-stop="role-confirm"]')!);
    expect(seen).toEqual([{ type: "answer", picked: ["brawler"] }]);
  });

  it("a new question starts afresh: the chosen role is forgotten", async () => {
    const el = await mount("mc-briefing-call", { call: roleCall("a") });
    press(find(el, '[data-stop="role:brawler"]')!);
    await next(el);
    await new Promise((resolve) => setTimeout(resolve, 0));
    (el as unknown as { call: unknown }).call = roleCall("b");
    await next(el);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stopsOf(el)).toContain("role:brawler");
  });
});
