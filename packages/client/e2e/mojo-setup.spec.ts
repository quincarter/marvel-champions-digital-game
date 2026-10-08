import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, pressHookStop, settle, trackPageErrors, waitFor } from "./helpers.js";
import { dealToFirstTurn, findVisibleText, gameFacts, hook, openApp } from "./wave6-helpers-b.js";
import { boardRound, endTurnToNextRound, installWave6Helpers, scrollStopIntoView } from "./wave6-helpers-a.js";

/**
 * Table setup for MojoMania (wave 6, `docs/phase7-wave6.md` §3.63): Mojo asks for 1 + 1 per hero genre sets set aside, in
 * the order they come in; Spiral and MaGog draw their genre sets at random from the same six. Walked by real clicks from
 * New Game; the picker's state is read back from `__mcTableSetupDebug` (what the chips and header show) and the dealt game
 * from the store, the same state the Board's "set aside" panel draws.
 */

const GENRES = ["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"];

interface Option {
  readonly id: string;
  readonly kind: "set" | "random" | "extra";
  readonly name: string;
  readonly selected: boolean;
}

/** Presses a control by name once the screen has drawn it (a slow runner can be a moment behind a scene change). */
async function clickStop(page: Page, hookName: string, key: string): Promise<void> {
  await pressHookStop(page, hookName, key);
  await settle(page);
}

const setup = {
  options: (page: Page) => hook<Option[]>(page, "__mcTableSetupDebug", "options").then((o) => o ?? []),
  picks: (page: Page) => hook<string[]>(page, "__mcTableSetupDebug", "picks").then((o) => o ?? []),
  header: (page: Page) => hook<string>(page, "__mcTableSetupDebug", "modularHeader").then((o) => o ?? ""),
  deckSize: (page: Page) => hook<number>(page, "__mcTableSetupDebug", "encounterDeckSize").then((o) => o ?? -1),
  summary: (page: Page) =>
    hook<[string, string][]>(page, "__mcTableSetupDebug", "summary").then((o) => new Map(o ?? [])),
  // A short page keeps the grid in a scrolling panel, so bring the tile into the panel first (a no-op when the grid is drawn whole).
  pick: async (page: Page, id: string) => {
    await scrollModularTileIntoPanel(page, `modular:${id}`);
    await clickStop(page, "__mcTableSetupDebug", `modular:${id}`);
  },
};

const onSetup = async (page: Page): Promise<boolean> => (await activeScenes(page)).includes("Setup");

test.describe("Table setup: MojoMania", () => {
  test("Mojo with two heroes: three genre sets are picked in order, a fourth replaces the oldest, Random clears, Longshot adds a card, and Deal sets exactly those aside", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors = trackPageErrors(page);
    await openApp(page);

    // New Game -> the MojoMania pack -> Mojo -> two seats (Spider-Man and She-Hulk) -> Table setup.
    await clickText(page, "NEW GAME");
    await waitFor(
      async () => ((await activeScenes(page)).includes("ScenarioSelect") ? true : null),
      "Scenario select",
      8000,
    );
    await settle(page);
    await clickStop(page, "__mcScenarioSelectDebug", "scenario-chip:product:mojo");
    await settle(page);
    await clickStop(page, "__mcScenarioSelectDebug", "scenario:mojo");
    await clickStop(page, "__mcScenarioSelectDebug", "next");
    await waitFor(async () => ((await activeScenes(page)).includes("Seats") ? true : null), "Take your seats", 8000);
    await settle(page);
    await clickStop(page, "__mcSeatsDebug", "seat:1");
    // The tile sits in the Core Set shelf, below the Recommended shelf: scroll it into view, then click where it is.
    await scrollStopIntoView(page, "hero:precon:core-she-hulk-aggression", "Seats");
    await clickStop(page, "__mcSeatsDebug", "hero:precon:core-she-hulk-aggression");
    await waitFor(
      async () => ((await findVisibleText(page, "2 SEATS FILLED", "Seats")).length > 0 ? true : null),
      "two seats are filled",
      8000,
    );
    await clickStop(page, "__mcSeatsDebug", "play");
    await waitFor(async () => ((await onSetup(page)) ? true : null), "Table setup", 8000);
    await settle(page);

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
    await dealToFirstTurn(page);
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
  // its picker also offers every other unlocked modular set (the genre sets first, then each box's).
  for (const scenario of [
    { id: "spiral", cap: 3, header: /3 random/i, restricted: true },
    { id: "magog", cap: 1, header: /1 random/i, restricted: false },
  ] as const) {
    test(`${scenario.id}: the picker offers the genre sets${scenario.restricted ? " and nothing else" : " (and every other unlocked modular set)"}, and holds ${scenario.cap} pick${scenario.cap === 1 ? "" : "s"}`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      const errors = trackPageErrors(page);
      await openApp(page, `unlock=all&screen=table-setup&scenario=${scenario.id}`, { landing: "Setup" });
      await waitFor(
        async () => (await hook<unknown[]>(page, "__mcTableSetupDebug", "options")) ?? null,
        "setup hook",
        8000,
      );
      await settle(page);

      const sets = (await setup.options(page)).filter((o) => o.kind === "set").map((o) => o.id);
      if (scenario.restricted) expect([...sets].sort(), "only the six genre sets").toEqual([...GENRES].sort());
      else {
        for (const genre of GENRES) expect(sets, `${genre} is offered`).toContain(genre);
        expect(sets, "the Core modular sets are offered too").toContain("bomb_scare");
        expect(sets, "and another box's").toContain("shadow_king");
        expect(sets.slice(0, GENRES.length).sort(), "the genre sets lead").toEqual([...GENRES].sort());
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

/** Wheels the modular grid until a tile is inside its panel (the grid scrolls: a tile past its edge is not on screen). */
async function scrollModularTileIntoPanel(page: Page, key: string): Promise<void> {
  type Box = { x: number; y: number; width: number; height: number };
  for (let step = 0; step < 80; step++) {
    const [stop, panel] = await page.evaluate((k) => {
      const hook = (
        window as unknown as {
          __mcTableSetupDebug: { stops: () => (Box & { key: string })[]; modularViewport: () => Box | null };
        }
      ).__mcTableSetupDebug;
      return [hook.stops().find((s) => s.key === k) ?? null, hook.modularViewport()] as const;
    }, key);
    if (!stop) throw new Error(`no "${key}" control on Table setup`);
    // The grid is drawn whole (not scrolling) on a page with room, so the tile is on screen already.
    if (!panel) return;
    if (stop.y >= panel.y && stop.y + stop.height <= panel.y + panel.height) return;
    await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2);
    await page.mouse.wheel(0, stop.y < panel.y ? -200 : 200);
    await settle(page);
  }
  throw new Error(`could not scroll "${key}" into the modular grid`);
}

test.describe("Table setup: every unlocked modular set", () => {
  test("Rhino with The Shadow King (not recommended, from another box): picked in the scrolling grid, dealt, round 2", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors = trackPageErrors(page);
    await installWave6Helpers(page);
    await openApp(page, "unlock=all&screen=table-setup&scenario=rhino", { landing: "Setup" });
    await waitFor(
      async () => (await hook<unknown[]>(page, "__mcTableSetupDebug", "options")) ?? null,
      "setup hook",
      8000,
    );
    await settle(page);

    const before = await setup.deckSize(page);
    expect(await setup.picks(page), "Bomb Scare is the recommendation").toEqual(["bomb_scare"]);
    await scrollModularTileIntoPanel(page, "modular:shadow_king");
    await setup.pick(page, "shadow_king");
    expect(await setup.picks(page), "The Shadow King replaces it").toEqual(["shadow_king"]);
    expect(await setup.deckSize(page), "its 5 cards stand in for Bomb Scare's 6").toBe(before - 1);

    await clickStop(page, "__mcTableSetupDebug", "deal-it-out");
    await dealToFirstTurn(page);
    const shadowKingCards = await page.evaluate(async () => {
      const { appSession } = (await import("/src/session.ts")) as unknown as {
        appSession: () => { store: { state: { game: { instances: Record<string, { cardId: string }> } } } };
      };
      const { CARDS_BY_ID } = (await import("/src/content/pool.ts")) as unknown as {
        CARDS_BY_ID: ReadonlyMap<string, { encounterSetIds?: readonly string[] }>;
      };
      return Object.values(appSession().store.state.game.instances).filter((card) =>
        CARDS_BY_ID.get(card.cardId)?.encounterSetIds?.includes("shadow_king"),
      ).length;
    });
    expect(shadowKingCards, "The Shadow King's five cards are in the game").toBe(5);
    expect(await boardRound(page), "round 1").toBe(1);
    expect(await endTurnToNextRound(page, 1, { timeoutMs: 90000 }), "round 2 begins").toBe(2);
    expect(errors).toEqual([]);
  });
});
