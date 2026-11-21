import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, findText, hasText, isSceneUp, settle, waitFor } from "./helpers.js";
import { communityHeroPackIds, serveCatalog, stageCatalog } from "./pack-catalog-helpers.js";
import { installWave6Helpers, visibleTexts, waitForScene } from "./wave6-helpers-a.js";
import { openApp, quietGuide } from "./wave6-helpers-b.js";

/**
 * Deck builder (issue #920): the chosen identity sits under the title as one row with its picture, its name and a
 * "Read card" cue. A press on the row, or its pad stop, opens Inspect on the hero side, and Inspect's side toggle reads
 * the alter-ego, so a player can see what the hero does while building.
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const stopRect = (page: Page, scene: string, key: string): Promise<Rect | null> =>
  page.evaluate(
    ([s, k]) =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: Rect }[]> }).__mcFocusRoutes[
        s!
      ]?.().find((stop) => stop.key === k)?.rect ?? null,
    [scene, key],
  );

async function inspectTexts(page: Page): Promise<string> {
  return (await visibleTexts(page))
    .filter((t) => t.scene === "InspectOverlay")
    .map((t) => t.text)
    .join("\n");
}

async function waitForInspect(page: Page): Promise<void> {
  await waitFor(async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect opens");
  await settle(page);
}

test("the identity row opens the identity in Inspect, and its toggle reads the alter-ego", async ({ page }) => {
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  // The first precon is the Core Set's Spider-Man (Peter Parker).
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
  const button = await waitFor(() => stopRect(page, "DeckBuilder", "identity-card"), "the identity row", 15_000);
  await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
  await waitForInspect(page);
  const hero = await inspectTexts(page);
  expect(hero).toMatch(/spider-man/i);
  expect(hero).toMatch(/show alter-ego/i);

  const toggle = (await visibleTexts(page)).find(
    (t) => t.scene === "InspectOverlay" && /^show alter-ego$/i.test(t.text.trim()),
  );
  expect(toggle, "the side toggle").toBeTruthy();
  await page.mouse.click(toggle!.x, toggle!.y);
  await waitFor(
    async () =>
      /peter parker/i.test(await inspectTexts(page)) && /show hero/i.test(await inspectTexts(page)) ? true : null,
    "the alter-ego side",
  );
});

test("a press on the identity's name opens it too", async ({ page }) => {
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
  await waitFor(() => stopRect(page, "DeckBuilder", "identity-card"), "the identity row", 15_000);
  const name = await waitFor(
    async () =>
      (await visibleTexts(page)).find(
        (t) => t.scene === "DeckBuilder" && /^spider-man \(peter parker\)$/i.test(t.text.trim()),
      ) ?? null,
    "the identity's name",
  );
  await page.mouse.click(name.x, name.y);
  await waitForInspect(page);
  expect(await inspectTexts(page)).toMatch(/show alter-ego/i);
});

/** Clicks the Inspect side toggle ("Show …") by its text, by touch on a phone. */
async function stepSide(page: Page, label: RegExp, touch: boolean): Promise<void> {
  const toggle = await waitFor(
    async () =>
      (await visibleTexts(page)).find((t) => t.scene === "InspectOverlay" && label.test(t.text.trim())) ?? null,
    "the side toggle",
  );
  if (touch) await page.touchscreen.tap(toggle.x, toggle.y);
  else await page.mouse.click(toggle.x, toggle.y);
}

test("on a phone, a touch tap on the row opens Inspect and a tap on the toggle reads the alter-ego", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "a touch gesture, on the phone project (hasTouch)");
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
  const row = await waitFor(() => stopRect(page, "DeckBuilder", "identity-card"), "the identity row", 15_000);
  await page.touchscreen.tap(row.x + row.width / 2, row.y + row.height / 2);
  await waitForInspect(page);
  expect(await inspectTexts(page)).toMatch(/spider-man/i);
  await stepSide(page, /^show alter-ego$/i, true);
  await waitFor(async () => (/peter parker/i.test(await inspectTexts(page)) ? true : null), "the alter-ego side");
});

test("the keyboard reaches the identity row and Enter opens it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "phone", "keyboard focus is a desktop route");
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
  await waitFor(() => stopRect(page, "DeckBuilder", "identity-card"), "the identity row", 15_000);
  const focus = (): Promise<string | null> =>
    page.evaluate(
      () =>
        (window as unknown as { __mcFocusState?: Record<string, () => { focus: string | null }> }).__mcFocusState?.[
          "DeckBuilder"
        ]?.().focus ?? null,
    );
  // Arrow keys move by position (`view/spatial-nav.ts`): the first wakes the ring. Walk to the aspect column (left,
  // then down), and Up from its top aspect lands on the identity row directly above it.
  const trace: string[] = [];
  for (let i = 0; i < 40 && (await focus()) !== "identity-card"; i++) {
    const at = await focus();
    trace.push(String(at));
    const target = (await stopRect(page, "DeckBuilder", "identity-card"))!;
    const here = at ? await stopRect(page, "DeckBuilder", at) : null;
    const key = at?.startsWith("aspect:")
      ? "ArrowUp"
      : here && here.x > target.x + 40
        ? "ArrowLeft"
        : "ArrowDown";
    await page.keyboard.press(key);
    await page.waitForTimeout(80);
  }
  expect(await focus(), trace.join(" > ")).toBe("identity-card");
  await page.keyboard.press("Enter");
  await waitForInspect(page);
  expect(await inspectTexts(page)).toMatch(/show alter-ego/i);
});

/** A community hero pack's identity, read from its card files: its id and both face names. */
function communityIdentity(packId: string): { id: string; hero: string; alterEgo: string } {
  const dir = fileURLToPath(new URL(`../../../content-packs/community/${packId}/cards`, import.meta.url));
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
    const card = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
      id?: string;
      type?: string;
      hero?: { faceName?: string };
      alterEgo?: { faceName?: string };
    };
    if (card.type === "hero_identity")
      return { id: card.id!, hero: card.hero!.faceName!, alterEgo: card.alterEgo!.faceName! };
  }
  throw new Error(`no identity in ${packId}`);
}

test("a community pack's hero opens the same way, both sides", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === "phone", "the pack install path runs once, on desktop");
  test.setTimeout(300_000);
  const packId = communityHeroPackIds()[0];
  test.skip(!packId, "no community hero pack fetched (pnpm packs:fetch)");
  await installWave6Helpers(page);
  const names = communityIdentity(packId!);
  const staged = await stageCatalog(baseURL!, [packId!]);
  try {
    await serveCatalog(page, staged);
    await quietGuide(page);
    await page.goto(`/?screen=mod-store&pack=${packId}`);
    await waitForScene(page, "ModStore");
    await waitForScene(page, "ModNoticeOverlay");
    expect(await hasText(page, "Got it", "ModNoticeOverlay")).toBe(true);
    await clickText(page, "Got it", { sceneKey: "ModNoticeOverlay" });
    await waitFor(async () => (!(await isSceneUp(page, "ModNoticeOverlay")) ? true : null), "the notice closes");
    await settle(page);
    await clickText(page, "INSTALL (", { sceneKey: "ModStore", timeoutMs: 30_000 });
    await waitFor(
      async () => ((await findText(page, "REMOVE", "ModStore")).length > 0 ? true : null),
      `${packId} installs`,
      90_000,
    );

    // A new deck, as a player starts one: the hero picker, a search for the pack's hero, its tile, an empty deck. A
    // fresh load first, so the installed pack is read into the pool at boot as it is for a returning player.
    await page.goto("/?screen=deck-builder");
    await waitForScene(page, "DeckBuilder");
    await settle(page);
    await page.evaluate(() => {
      const game = (
        window as unknown as { __mcGame: { scene: { stop(k: string): void; start(k: string, d: object): void } } }
      ).__mcGame;
      game.scene.start("DeckBuilder", {});
    });
    await waitForScene(page, "DeckBuilder");
    await settle(page);
    const search = await waitFor(() => stopRect(page, "DeckBuilder", "identity-search"), "the hero search", 15_000);
    await page.mouse.click(search.x + search.width / 2, search.y + search.height / 2);
    await page.keyboard.type(names.hero);
    const tile = await waitFor(
      () => stopRect(page, "DeckBuilder", `identity:${names.id}`),
      "the pack hero's tile",
      15_000,
    );
    await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height / 2);
    const empty = await waitFor(
      async () =>
        (await stopRect(page, "DeckBuilder", "start:empty")) ??
        ((await stopRect(page, "DeckBuilder", "identity-card")) ? "chosen" : null),
      "the Start from step or the builder",
      15_000,
    );
    if (empty !== "chosen") await page.mouse.click(empty.x + empty.width / 2, empty.y + empty.height / 2);
    const row = await waitFor(() => stopRect(page, "DeckBuilder", "identity-card"), "the identity row", 15_000);
    await settle(page);
    const rowText = (await visibleTexts(page))
      .filter((t) => t.scene === "DeckBuilder" && t.y >= row.y && t.y <= row.y + row.height)
      .map((t) => t.text)
      .join(" ");
    expect(rowText.toLowerCase()).toContain(names.hero.toLowerCase());
    await page.mouse.click(row.x + row.width / 2, row.y + row.height / 2);
    await waitForInspect(page);
    expect((await inspectTexts(page)).toLowerCase()).toContain(names.hero.toLowerCase());
    await stepSide(page, /^show alter-ego$/i, false);
    await waitFor(
      async () => ((await inspectTexts(page)).toLowerCase().includes(names.alterEgo.toLowerCase()) ? true : null),
      "the pack hero's alter-ego side",
    );
  } finally {
    staged.dispose();
  }
});
