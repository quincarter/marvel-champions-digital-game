// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { find, findAll, mount, press, stepEvents, stopsOf, wordsOf } from "../../test-support.js";
import "../mc-briefing-role-tiles.js";

afterEach(() => document.body.replaceChildren());

const tile = (id: string, available = true) => ({
  stop: `role:${id}`,
  action: { type: "role", id },
  title: id,
  body: `${id} summary`,
  available,
});

const model = {
  tiles: [tile("brawler"), tile("defender", false)],
  note: { heading: "What roles do", lines: ["Role upgrades.", "Role-building."] },
};

describe("mc-briefing-role-tiles", () => {
  it("a role tile is a stop that selects that role, and the note names what roles do", async () => {
    const el = await mount("mc-briefing-role-tiles", { model });
    expect(stopsOf(el)).toEqual(["role:brawler"]);
    const seen = stepEvents(el);
    press(find(el, '[data-stop="role:brawler"]')!);
    expect(seen).toEqual([{ type: "role", id: "brawler" }]);
    expect(wordsOf(el)).toContain("WHAT ROLES DO");
    expect(findAll(el, "mc-briefing-option-tile")).toHaveLength(2);
  });

  it("a taken role takes no press", async () => {
    const el = await mount("mc-briefing-role-tiles", { model });
    const seen = stepEvents(el);
    press(findAll(el, "mc-press-card")[1]!);
    expect(seen).toEqual([]);
  });
});
