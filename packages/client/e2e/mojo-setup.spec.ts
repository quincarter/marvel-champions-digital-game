import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, trackPageErrors, waitFor } from "./helpers.js";
import { findVisibleText, gameFacts, hook, openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * Table setup for MojoMania (wave 6, `docs/phase7-wave6.md` §3.63): Mojo asks for 1 + 1 per hero genre sets set aside, in
 * the order they come in; Spiral and MaGog draw their genre sets at random from the same six. Walked by real clicks from
 * New Game; the picker's state is read back from `__mcTableSetupDebug` (what the chips and header show) and the dealt game
 * from the store, the same state the Board's "set aside" panel draws.
 */

const GENRES = ["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"];

interface Stop extends Rect {
  readonly key: string;
}
interface Option {
  readonly id: string;
  readonly kind: "set" | "random" | "extra";
  readonly name: string;
  readonly selected: boolean;
}

async function clickStop(page: Page, hookName: string, key: string): Promise<void> {
  const stops = (await hook<Stop[]>(page, hookName, "stops")) ?? [];
  const stop = stops.find((s) => s.key === key);
  if (!stop) throw new Error(`no "${key}" among ${stops.map((s) => s.key).join(", ")}`);
  await page.mouse.click(stop.x + stop.width / 2, stop.y + stop.height / 2);
  await page.waitForTimeout(500);
}

const setup = {
  options: (page: Page) => hook<Option[]>(page, "__mcTableSetupDebug", "options").then((o) => o ?? []),
  picks: (page: Page) => hook<string[]>(page, "__mcTableSetupDebug", "picks").then((o) => o ?? []),
  header: (page: Page) => hook<string>(page, "__mcTableSetupDebug", "modularHeader").then((o) => o ?? ""),
  deckSize: (page: Page) => hook<number>(page, "__mcTableSetupDebug", "encounterDeckSize").then((o) => o ?? -1),
  summary: (page: Page) =>
    hook<[string, string][]>(page, "__mcTableSetupDebug", "summary").then((o) => new Map(o ?? [])),
  pick: (page: Page, id: string) => clickStop(page, "__mcTableSetupDebug", `modular:${id}`),
};

const onSetup = async (page: Page): Promise<boolean> => (await activeScenes(page)).includes("Setup");

test.describe("Table setup: MojoMania", () => {
  test("Mojo with two heroes: three genre sets are picked in order, a fourth replaces the oldest, Random clears, Longshot adds a card, and Deal sets exactly those aside", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = trackPageErrors(page);
    await openApp(page);

    // New Game -> the MojoMania pack -> Mojo -> two seats (Spider-Man and She-Hulk) -> Table setup.
    await clickText(page, "NEW GAME");
    await waitFor(
      async () => ((await activeScenes(page)).includes("ScenarioSelect") ? true : null),
      "Scenario select",
      8000,
    );
    await page.waitForTimeout(900);
    await clickStop(page, "__mcScenarioSelectDebug", "scenario-chip:product:mojo");
    await page.waitForTimeout(1500);
    await clickStop(page, "__mcScenarioSelectDebug", "scenario:mojo");
    await clickStop(page, "__mcScenarioSelectDebug", "next");
    await waitFor(async () => ((await activeScenes(page)).includes("Seats") ? true : null), "Take your seats", 8000);
    await page.waitForTimeout(900);
    await clickStop(page, "__mcSeatsDebug", "seat:1");
    await clickStop(page, "__mcSeatsDebug", "hero:precon:core-she-hulk-aggression");
    await page.waitForTimeout(500);
    await clickStop(page, "__mcSeatsDebug", "play");
    await waitFor(async () => ((await onSetup(page)) ? true : null), "Table setup", 8000);
    await page.waitForTimeout(1000);

    // The header asks for 3 sets (1 + 1 per hero), none chosen yet: they are drawn at random.
    expect(await setup.header(page), "the header asks for 3 set-aside sets").toMatch(/3 set aside/i);
    expect(await findVisibleText(page, "3 set aside", "Setup"), "and says so on screen").not.toHaveLength(0);
    const options = await setup.options(page);
    expect(
      options
        .filter((o) => o.kind === "set")
        .map((o) => o.id)
        .sort(),
      "the picker offers the six genre sets",
    ).toEqual([...GENRES].sort());
    expect(
      options.some((o) => o.kind === "random" && o.selected),
      "Random reads as chosen while nothing is picked",
    ).toBe(true);
    expect(
      options.some((o) => o.kind === "extra" && o.id === "longshot"),
      "Longshot is offered as an extra",
    ).toBe(true);

    // Three picks, in order, each showing as chosen.
    for (const [i, id] of (["crime", "horror", "western"] as const).entries()) {
      await setup.pick(page, id);
      expect(await setup.picks(page), `after pick ${i + 1}`).toEqual(
        (["crime", "horror", "western"] as const).slice(0, i + 1),
      );
    }
    const chosen = (await setup.options(page)).filter((o) => o.kind === "set" && o.selected).map((o) => o.id);
    expect(chosen.sort()).toEqual(["crime", "horror", "western"]);
    expect(
      (await setup.options(page)).find((o) => o.kind === "random")!.selected,
      "Random lets go once there are picks",
    ).toBe(false);
    expect(await setup.header(page), "the header reads chosen").toMatch(/3 set aside, chosen/i);
    expect(await setup.header(page), "and says which one joins").toMatch(/one joins at random/i);
    expect((await setup.summary(page)).get("Set aside"), "the summary names the sets").toBe("Crime, Horror, Western");

    // A fourth pick is not refused: it replaces the oldest pick and keeps the rest in order.
    await setup.pick(page, "sci-fi");
    expect(await setup.picks(page), "the fourth pick drops the first").toEqual(["horror", "western", "sci-fi"]);
    expect((await setup.summary(page)).get("Set aside")).toBe("Horror, Western, Sci-Fi");

    // Random clears the picks.
    await setup.pick(page, "random");
    expect(await setup.picks(page)).toEqual([]);
    expect((await setup.options(page)).find((o) => o.kind === "random")!.selected).toBe(true);

    // Longshot is an extra set: it toggles, and changes the encounter deck by exactly one card.
    const before = await setup.deckSize(page);
    await setup.pick(page, "longshot");
    expect((await setup.options(page)).find((o) => o.id === "longshot")!.selected, "Longshot is on").toBe(true);
    expect(await setup.deckSize(page), "Longshot adds a card").toBe(before + 1);
    await setup.pick(page, "longshot");
    expect((await setup.options(page)).find((o) => o.id === "longshot")!.selected, "Longshot is off again").toBe(false);
    expect(await setup.deckSize(page), "and takes it away").toBe(before);

    // Pick the three to deal, then Deal: the game sets exactly those aside, in that order.
    for (const id of ["western", "crime", "horror"]) await setup.pick(page, id);
    expect(await setup.picks(page)).toEqual(["western", "crime", "horror"]);
    await clickStop(page, "__mcTableSetupDebug", "deal-it-out");
    await waitFor(
      async () => ((await activeScenes(page)).includes("SetupDeal") ? true : null),
      "the deal screen",
      15000,
    );
    await page.waitForTimeout(1200);
    for (let seat = 0; seat < 2; seat++) {
      await clickText(page, "Keep all", { sceneKey: "SetupDeal" });
      await page.waitForTimeout(900);
    }
    await waitFor(
      async () => ((await activeScenes(page)).includes("Board") ? true : null),
      "the first player turn",
      20000,
    );
    await page.waitForTimeout(1200);
    // 1B brings one set in at random (its card text), so two of the three picks are still set aside, in pick order.
    const setAside = await gameFacts<string[]>(
      page,
      "(s) => (s.game.setAsideModularSets ?? []).map((set) => set.encounterSetId)",
    );
    const picked = ["western", "crime", "horror"];
    expect(setAside, "two of the picks are still set aside").toHaveLength(2);
    expect(
      setAside.every((id) => picked.includes(id)),
      "and they are among the picks",
    ).toBe(true);
    expect(setAside, "in the order they were picked").toEqual(picked.filter((id) => setAside.includes(id)));
    expect(
      await findVisibleText(page, "Set aside 2", "Board"),
      "the Board's set-aside panel counts them",
    ).not.toHaveLength(0);
    expect(errors).toEqual([]);
  });

  // Spiral's and Mojo's pools are restricted to the six genre sets; MaGog's is only its random recommendation (Q44), so
  // its picker also offers the Core modular sets.
  for (const scenario of [
    { id: "spiral", cap: 3, header: /3 random/i, restricted: true },
    { id: "magog", cap: 1, header: /1 random/i, restricted: false },
  ] as const) {
    test(`${scenario.id}: the picker offers the genre sets${scenario.restricted ? " and nothing else" : " (and the Core modular sets)"}, and holds ${scenario.cap} pick${scenario.cap === 1 ? "" : "s"}`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      const errors = trackPageErrors(page);
      await openApp(page, `unlock=all&screen=table-setup&scenario=${scenario.id}`, { landing: "Setup" });
      await waitFor(
        async () => (await hook<unknown[]>(page, "__mcTableSetupDebug", "options")) ?? null,
        "setup hook",
        8000,
      );
      await page.waitForTimeout(800);

      const sets = (await setup.options(page)).filter((o) => o.kind === "set").map((o) => o.id);
      if (scenario.restricted) expect([...sets].sort(), "only the six genre sets").toEqual([...GENRES].sort());
      else {
        for (const genre of GENRES) expect(sets, `${genre} is offered`).toContain(genre);
        expect(sets.length, "the Core modular sets are offered too").toBeGreaterThan(GENRES.length);
      }
      expect(await setup.header(page), "the header names the count").toMatch(scenario.header);

      for (const id of GENRES) await setup.pick(page, id);
      const picks = await setup.picks(page);
      expect(picks, "never more than the scenario's count, the newest kept").toHaveLength(scenario.cap);
      expect(picks).toEqual(GENRES.slice(GENRES.length - scenario.cap));
      await setup.pick(page, "random");
      expect(await setup.picks(page), "Random clears").toEqual([]);
      expect(errors).toEqual([]);
    });
  }
});
