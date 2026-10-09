import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  clickFocus,
  clickText,
  handInstanceFor,
  pressAt,
  pressKey,
  settle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import { clickStop, driveToBoard, hasStop, installWave6Helpers, routeStops, waitForScene } from "./wave6-helpers-a.js";
import { findVisibleText, gameFacts, handRectFor, hook, inspectAt, openApp } from "./wave6-helpers-b.js";

/**
 * Same-name conflicts (owner, 2026-10-03). Colossus (seat 1) and Shadowcat (seat 2): Colossus's own cards include the
 * Shadowcat ally, and Shadowcat's deck holds the basic Colossus ally, which prints the subtitle "Piotr Rasputin". Both
 * clash by FFG's own unique rule (RRG 1.8 pp. 45-46), so the pair clashes with the table option on or off. Take your
 * seats names the clash, Play opens the sheet, and each card is replaced or kept as a resource before the table is
 * dealt. The option itself adds a clash only for a bare-named ally: Thor / Aggression seated with Valkyrie /
 * Aggression, where the Valkyrie ally (06012, no subtitle) in Thor's deck clashes only with the option on.
 *
 * Seed 4 deals Colossus the Shadowcat ally (32002) in his opening hand with the Colossus ally replaced out of
 * Shadowcat's deck (the recommended replacement is the first card of the picker). Found by searching seeds against the
 * starter decks, so a changed deck or deal order fails here by name and the seed gets re-picked.
 */

const SEED = "4";
const SHEET = "NameConflictOverlay";

interface Entry {
  readonly line: string;
  readonly deckId: string;
  readonly cardId: string;
  readonly status: "pending" | "replaced" | "kept";
}

const sheet = {
  entries: (page: Page) => hook<Entry[]>(page, "__mcNameConflictDebug", "entries").then((e) => e ?? []),
  selected: (page: Page) => hook<string | null>(page, "__mcNameConflictDebug", "selected"),
  candidates: (page: Page) =>
    hook<{ id: string; name: string; tier: number }[]>(page, "__mcNameConflictDebug", "candidates").then(
      (c) => c ?? [],
    ),
};

/** Title → New game (the guide is quiet, as in the other setup specs), landing on Scenario select. */
async function startNewGame(page: Page): Promise<void> {
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await clickText(page, "NEW GAME", { sceneKey: "Title" });
  await waitForScene(page, "ScenarioSelect");
  await waitFor(async () => (await hasStop(page, "next", "ScenarioSelect")) || null, "scenario list", 15000);
}

/** Scenario select (Rhino) to Take your seats with the named heroes (search text, precon deck id) in seats 1 and 2. */
async function seatHeroes(page: Page, heroes: readonly (readonly [string, string])[]): Promise<void> {
  await clickStop(page, "scenario:rhino", "ScenarioSelect");
  await settle(page);
  await clickStop(page, "next", "ScenarioSelect");
  await waitForScene(page, "Seats");
  await waitFor(async () => (await hasStop(page, "hero-search", "Seats")) || null, "hero search", 10000);
  for (const [name, deck] of heroes) {
    await clickStop(page, "hero-search", "Seats");
    await settle(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(name);
    // A Team-Up partner is also on the Recommended shelf, which sits above the full list and is on screen.
    const recommended = `hero-rec:precon:${deck}`;
    await clickStop(page, (await hasStop(page, recommended, "Seats")) ? recommended : `hero:precon:${deck}`, "Seats");
    await settle(page);
  }
}

const seatColossusAndShadowcat = (page: Page): Promise<void> =>
  seatHeroes(page, [
    ["Colossus", "colossus-protection"],
    ["Shadowcat", "shadowcat-aggression"],
  ]);

const noticeText = (page: Page): Promise<unknown[]> =>
  findVisibleText(page, "can't be played with these heroes", "Seats");

/** The seated cards of both players in the dealt game, by card id (deck and hand together). */
async function dealtCardIds(page: Page): Promise<string[][]> {
  return gameFacts<string[][]>(
    page,
    `(state) => state.game.players.map((p) => [...p.hand, ...p.deck].map((id) => state.game.instances[id].cardId))`,
  );
}

async function setSameNameSetting(page: Page, on: boolean): Promise<void> {
  await clickStop(page, "settings", "Title");
  await waitForScene(page, "SettingsOverlay");
  await settle(page);
  const rows = (await findVisibleText(page, "Same-name hero and ally", "SettingsOverlay")).length;
  expect(rows, "Settings has the same-name row").toBeGreaterThan(0);
  const isOn = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { settings: { sameNameHeroAllyConflict: boolean } };
    };
    return appSession().settings.sameNameHeroAllyConflict;
  });
  if (isOn !== on) {
    // The toggle is the button at the row's right end.
    const row = (await routeStops(page, "SettingsOverlay"))?.stops.find(
      (stop) => stop.key === "row:same-name-conflict",
    );
    if (!row) throw new Error("no same-name row in Settings");
    await pressAt(page, row.rect.x + row.rect.width - 40, row.rect.y + row.rect.height / 2);
  }
  await waitFor(
    async () =>
      (await page.evaluate(async () => {
        const { appSession } = (await import("/src/session.ts")) as unknown as {
          appSession: () => { settings: { sameNameHeroAllyConflict: boolean } };
        };
        return appSession().settings.sameNameHeroAllyConflict;
      })) === on
        ? true
        : null,
    `the setting reads ${on ? "on" : "off"}`,
  );
  await clickStop(page, "back", "SettingsOverlay");
  await waitFor(async () => (!(await hasStop(page, "back", "SettingsOverlay")) ? true : null), "Settings closes");
}

test.describe("Same-name hero and ally conflicts", () => {
  test("Colossus and Shadowcat: the notice, the sheet, one card replaced and one kept as a resource, then the game", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const errors = trackPageErrors(page);
    await installWave6Helpers(page);
    await openApp(page, "unlock=all", { landing: "Title" });
    await startNewGame(page);
    await seatColossusAndShadowcat(page);

    // The notice under the seat cards names the count in words.
    await waitFor(async () => ((await noticeText(page)).length > 0 ? true : null), "the conflict notice", 8000);
    expect(await findVisibleText(page, "2 cards can't be played with these heroes", "Seats")).toHaveLength(1);

    // Play does not go on: it opens the sheet, one short line per clash, Continue not yet available.
    await clickStop(page, "play", "Seats");
    await waitForScene(page, SHEET);
    await settle(page);
    const entries = await sheet.entries(page);
    expect(entries.map((e) => e.line)).toEqual([
      "Colossus's deck: Shadowcat (Kitty Pryde) ally · Shadowcat is seated",
      "Shadowcat's deck: Colossus (Piotr Rasputin) ally · Colossus is seated",
    ]);
    expect(entries.map((e) => e.status)).toEqual(["pending", "pending"]);
    expect(await findVisibleText(page, "Keep as a resource", SHEET)).not.toHaveLength(0);
    // Continue does nothing while a card is unanswered; the Shadowcat ally is Colossus's own card, so it has no Replace.
    await clickStop(page, "continue", SHEET);
    await settle(page);
    expect((await activeScenes(page)).includes(SHEET), "the sheet stays open").toBe(true);
    expect(await hasStop(page, "replace:0", SHEET), "a hero's own card offers no Replace").toBe(false);
    expect(await hasStop(page, "replace:1", SHEET), "the basic Colossus ally does").toBe(true);

    // Colossus's Shadowcat ally is one of his own cards: kept as a resource.
    await clickStop(page, "keep:0", SHEET);
    await waitFor(
      async () => ((await sheet.entries(page))[0]?.status === "kept" ? true : null),
      "the first card is kept",
    );

    // The basic Colossus ally in Shadowcat's deck is replaced from the picker, the recommended card preselected.
    await clickStop(page, "replace:1", SHEET);
    await waitFor(
      async () => ((await sheet.candidates(page)).length > 0 ? true : null),
      "the picker lists cards",
      15000,
    );
    const candidates = await sheet.candidates(page);
    expect(candidates[0]!.tier, "an ally leads the list").toBe(0);
    const recommended = await sheet.selected(page);
    expect(recommended, "the recommended card is preselected").toBe(candidates[0]!.id);
    // The picker names a card by its printed name without the subtitle, so the same card is told apart by id.
    expect(
      candidates.some((c) => c.id === "32048" || c.id === "35021"),
      "the same card is not offered back",
    ).toBe(false);
    await clickStop(page, "confirm", SHEET);
    await waitFor(
      async () => ((await sheet.entries(page))[1]?.status === "replaced" ? true : null),
      "the second card is replaced",
    );

    // Every card answered: Continue goes on to Table setup, which names the table rule in its summary.
    await clickStop(page, "continue", SHEET);
    await waitForScene(page, "Setup");
    await settle(page);
    expect(
      await findVisibleText(page, "Hero and ally of one name", "Setup"),
      "the summary names the rule",
    ).not.toHaveLength(0);

    // The seed that deals Colossus the Shadowcat ally, then deal.
    await clickStop(page, "seed", "Setup");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(SEED);
    await page.keyboard.press("Enter");
    await settle(page);
    await clickStop(page, "deal-it-out", "Setup");
    await driveToBoard(page, { timeoutMs: 90000 });

    // The replaced card is not in Shadowcat's deck, its replacement is; the kept one is still in Colossus's.
    const [colossus, shadowcat] = await dealtCardIds(page);
    expect(shadowcat, "the Colossus ally was replaced out of Shadowcat's deck").not.toContain("32048");
    expect(shadowcat, "the recommended replacement is in its place").toContain(recommended);
    expect(colossus, "the kept Shadowcat ally is still in Colossus's deck").toContain("32002");

    // The kept card cannot be played (Inspect says why) but is offered as a resource.
    expect(await handInstanceFor(page, "32002"), "seed 4 deals Colossus the Shadowcat ally").not.toBeNull();
    await inspectAt(page, await handRectFor(page, "32002"), "right");
    expect(
      await findVisibleText(page, "already in play", "InspectOverlay"),
      "Inspect says why it cannot be played",
    ).not.toHaveLength(0);
    expect(
      await findVisibleText(page, "Use as resource", "InspectOverlay"),
      "Use as resource is offered",
    ).not.toHaveLength(0);
    await pressKey(page, "Escape");
    await waitFor(
      async () => ((await findVisibleText(page, "Use as resource", "InspectOverlay")).length === 0 ? true : null),
      "Inspect closes",
    );

    // And it pays: flip to hero form, start Piotr's Studio, spend the Shadowcat ally on its cost.
    // The Colossus and Shadowcat Team-Up opens its splash at the start of the turn, once the round band has passed
    // (`view/team-up-model.ts`, `scenes/board.ts#tryOpenTeamUpSplash`), and the splash takes every press for its 2.5 s:
    // a Flip or Decline pressed under it only dismisses the splash. Read its durable record, not the passing scene.
    await waitFor(
      async () =>
        (await page.evaluate(() => {
          const log = (window as unknown as { __mcTeamUpSplashLog?: { closed: boolean }[] }).__mcTeamUpSplashLog ?? [];
          return log.length > 0 && log.every((entry) => entry.closed);
        })) && !(await activeScenes(page)).includes("TeamUpSplashOverlay")
          ? true
          : null,
      "the Team-Up splash has come and gone",
      20000,
    );
    await clickFocus(page, "basic:changeForm");
    await waitFor(
      async () =>
        (await gameFacts<string>(page, "(state) => state.game.players[0].identity.form")) === "hero" ? true : null,
      "Colossus is a hero",
    );
    await settle(page);
    // Flipping asks whether to trigger Perseverance's response: declined.
    await waitFor(
      async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null),
      "the trigger sheet",
    );
    await settle(page);
    await clickText(page, "Decline", { sceneKey: "ChoiceOverlay" });
    await waitFor(
      async () => (!(await activeScenes(page)).includes("ChoiceOverlay") ? true : null),
      "the sheet closes",
    );
    const studio = await handInstanceFor(page, "32003");
    expect(studio, "Piotr's Studio is in hand").not.toBeNull();
    await clickFocus(page, `card:${studio}`);
    const ally = await handInstanceFor(page, "32002");
    await waitFor(
      async () =>
        (await page.evaluate(() => {
          const v = (
            window as unknown as { __mcBoardDebug?: { paymentView(): { sources: unknown[] } | null } }
          ).__mcBoardDebug?.paymentView();
          return v ? true : null;
        })) || null,
      "a payment opens",
    );
    await clickFocus(page, `card:${ally}`);
    const spent = await waitFor(
      async () =>
        page.evaluate((id) => {
          const v = (
            window as unknown as {
              __mcBoardDebug?: { paymentView(): { sources: { instanceId: string | null; spent: boolean }[] } | null };
            }
          ).__mcBoardDebug?.paymentView();
          return v?.sources.find((s) => s.instanceId === id)?.spent ? true : null;
        }, ally),
      "the Shadowcat ally is spent on the payment",
    );
    expect(spent).toBe(true);
    expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
  });

  test("with the setting off both Colossus and Shadowcat clashes remain (FFG's own rule), each decided on the sheet", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors = trackPageErrors(page);
    await installWave6Helpers(page);
    await openApp(page, "unlock=all", { landing: "Title" });
    await setSameNameSetting(page, false);
    await startNewGame(page);
    await seatColossusAndShadowcat(page);

    // The Colossus ally prints "Piotr Rasputin", so the unique rule alone clashes it beside the Colossus hero.
    await waitFor(async () => ((await noticeText(page)).length > 0 ? true : null), "the conflict notice", 8000);
    expect(await findVisibleText(page, "2 cards can't be played with these heroes", "Seats")).toHaveLength(1);
    await clickStop(page, "play", "Seats");
    await waitForScene(page, SHEET);
    await settle(page);
    expect((await sheet.entries(page)).map((e) => e.line)).toEqual([
      "Colossus's deck: Shadowcat (Kitty Pryde) ally · Shadowcat is seated",
      "Shadowcat's deck: Colossus (Piotr Rasputin) ally · Colossus is seated",
    ]);
    await clickStop(page, "keep:0", SHEET);
    await waitFor(
      async () => ((await sheet.entries(page))[0]?.status === "kept" ? true : null),
      "the first card is kept",
    );
    await clickStop(page, "keep:1", SHEET);
    await waitFor(
      async () => ((await sheet.entries(page))[1]?.status === "kept" ? true : null),
      "the second card is kept",
    );
    await clickStop(page, "continue", SHEET);
    await waitForScene(page, "Setup");
    await settle(page);
    expect(
      await findVisibleText(page, "Hero and ally of one name", "Setup"),
      "no table rule in the summary",
    ).toHaveLength(0);
    expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
  });

  test("the option adds a clash: Thor and Valkyrie list the Valkyrie ally with it on", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackPageErrors(page);
    await installWave6Helpers(page);
    await openApp(page, "unlock=all", { landing: "Title" });
    await setSameNameSetting(page, true);
    await startNewGame(page);
    await seatHeroes(page, [
      ["Thor", "thor-aggression"],
      ["Valkyrie", "valkyrie-aggression"],
    ]);
    await waitFor(async () => ((await noticeText(page)).length > 0 ? true : null), "the conflict notice", 8000);
    expect(await findVisibleText(page, "2 cards can't be played with these heroes", "Seats")).toHaveLength(1);
    await clickStop(page, "play", "Seats");
    await waitForScene(page, SHEET);
    await settle(page);
    const entries = await sheet.entries(page);
    expect(entries.map((e) => e.cardId)).toEqual(["06012", "25013"]);
    expect(entries[0]!.line).toBe("Thor's deck: Valkyrie ally · Valkyrie is seated");
    expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
  });

  test("the same Thor and Valkyrie table with the option off lists only FFG's own clash", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackPageErrors(page);
    await installWave6Helpers(page);
    await openApp(page, "unlock=all", { landing: "Title" });
    await setSameNameSetting(page, false);
    await startNewGame(page);
    await seatHeroes(page, [
      ["Thor", "thor-aggression"],
      ["Valkyrie", "valkyrie-aggression"],
    ]);
    await waitFor(async () => ((await noticeText(page)).length > 0 ? true : null), "the conflict notice", 8000);
    expect(await findVisibleText(page, "1 card can't be played with these heroes", "Seats")).toHaveLength(1);
    await clickStop(page, "play", "Seats");
    await waitForScene(page, SHEET);
    await settle(page);
    expect((await sheet.entries(page)).map((e) => e.cardId)).toEqual(["25013"]);
    expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
  });

  test("a table with no clash goes straight to Table setup", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    await installWave6Helpers(page);
    await openApp(page, "unlock=all", { landing: "Title" });
    await startNewGame(page);
    await clickStop(page, "scenario:rhino", "ScenarioSelect");
    await settle(page);
    await clickStop(page, "next", "ScenarioSelect");
    await waitForScene(page, "Seats");
    await settle(page);
    expect(await noticeText(page), "no notice for one hero").toHaveLength(0);
    await clickStop(page, "play", "Seats");
    await waitForScene(page, "Setup");
    expect(errors).toEqual([]);
  });
});
