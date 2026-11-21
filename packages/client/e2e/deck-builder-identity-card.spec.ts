import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, findText, hasText, isSceneUp, settle, waitFor } from "./helpers.js";
import { serveCatalog, stageCatalog } from "./pack-catalog-helpers.js";
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

async function waitForInspect(page: Page): Promise<void> {
  await waitFor(async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect opens");
  await settle(page);
}

/** A whole line that reads exactly `text`, any case. */
const exactly = (text: string): RegExp => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

const SPIDER_MAN = exactly("Spider-Man (Peter Parker)");
const PETER_PARKER = exactly("Peter Parker");

/**
 * Inspect shows `side` of the identity whose title line matches `title`: that title, the side's type line ("HERO · …"
 * or "ALTER-EGO · …") and the toggle to the other side. A name alone could appear elsewhere on the sheet.
 */
async function expectFace(page: Page, title: RegExp, side: "hero" | "alterEgo"): Promise<void> {
  const typeLine = side === "hero" ? /^hero( ·|$)/i : /^alter-ego( ·|$)/i;
  const toggle = side === "hero" ? /^show alter-ego$/i : /^show hero$/i;
  await waitFor(async () => {
    const lines = (await visibleTexts(page)).filter((t) => t.scene === "InspectOverlay").map((t) => t.text.trim());
    const shown = [title, typeLine, toggle].every((wanted) => lines.some((line) => wanted.test(line)));
    return shown ? true : null;
  }, `Inspect on the ${side} side of ${title}`);
}

/** Presses the Inspect side toggle ("Show …") by its text, by touch on a phone. */
async function stepSide(page: Page, label: RegExp, touch: boolean): Promise<void> {
  const toggle = await waitFor(
    async () =>
      (await visibleTexts(page)).find((t) => t.scene === "InspectOverlay" && label.test(t.text.trim())) ?? null,
    "the side toggle",
  );
  if (touch) await page.touchscreen.tap(toggle.x, toggle.y);
  else await page.mouse.click(toggle.x, toggle.y);
}

/** Hero side, flip to the alter-ego, flip back: each step checked by its title, type line and toggle. */
async function flipBothWays(page: Page, hero: RegExp, alterEgo: RegExp, touch: boolean): Promise<void> {
  await expectFace(page, hero, "hero");
  await stepSide(page, /^show alter-ego$/i, touch);
  await expectFace(page, alterEgo, "alterEgo");
  await stepSide(page, /^show hero$/i, touch);
  await expectFace(page, hero, "hero");
}

test("the identity row opens the identity in Inspect, and its toggle reads the alter-ego", async ({ page }) => {
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  // The first precon is the Core Set's Spider-Man (Peter Parker).
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
  const row = await waitFor(() => stopRect(page, "DeckBuilder", "identity-card"), "the identity row", 15_000);
  await page.mouse.click(row.x + row.width / 2, row.y + row.height / 2);
  await waitForInspect(page);
  await flipBothWays(page, SPIDER_MAN, PETER_PARKER, false);
});

test("a press on the identity's name opens it too", async ({ page }) => {
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
  await waitFor(() => stopRect(page, "DeckBuilder", "identity-card"), "the identity row", 15_000);
  const name = await waitFor(
    async () =>
      (await visibleTexts(page)).find((t) => t.scene === "DeckBuilder" && SPIDER_MAN.test(t.text.trim())) ?? null,
    "the identity's name",
  );
  await page.mouse.click(name.x, name.y);
  await waitForInspect(page);
  await expectFace(page, SPIDER_MAN, "hero");
});

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
  await flipBothWays(page, SPIDER_MAN, PETER_PARKER, true);
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
    const key = at?.startsWith("aspect:") ? "ArrowUp" : here && here.x > target.x + 40 ? "ArrowLeft" : "ArrowDown";
    await page.keyboard.press(key);
    await page.waitForTimeout(80);
  }
  expect(await focus(), trace.join(" > ")).toBe("identity-card");
  await page.keyboard.press("Enter");
  await waitForInspect(page);
  // The deck's own identity, not just any card with a side toggle.
  await expectFace(page, SPIDER_MAN, "hero");
});

/** The Mod Store hero this spec installs, pinned so the case never shifts as packs are added upstream. */
const COMMUNITY_HERO_PACK = "carnage-nep";

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
  const packId = COMMUNITY_HERO_PACK;
  // Missing, the case fails rather than skipping: the suite needs the community packs fetched.
  const packDir = fileURLToPath(new URL(`../../../content-packs/community/${packId}`, import.meta.url));
  if (!existsSync(packDir)) throw new Error(`${packDir} is missing: run \`pnpm packs:fetch\` before the e2e suite`);
  await installWave6Helpers(page);
  const names = communityIdentity(packId);
  const staged = await stageCatalog(baseURL!, [packId]);
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

    // A new deck, as a player starts one: a fresh load (the installed pack is read into the pool at boot, as for a
    // returning player), Decks & Collection's "+ New deck", the hero picker, a search, the hero's tile, an empty deck.
    await page.goto("/?screen=decks");
    await waitForScene(page, "Decks");
    await settle(page);
    const newDeck = await waitFor(() => stopRect(page, "Decks", "new-deck"), "+ New deck", 15_000);
    await page.mouse.click(newDeck.x + newDeck.width / 2, newDeck.y + newDeck.height / 2);
    await waitForScene(page, "DeckBuilder");
    await settle(page);
    const search = await waitFor(() => stopRect(page, "DeckBuilder", "identity-search"), "the hero search", 15_000);
    await page.mouse.click(search.x + search.width / 2, search.y + search.height / 2);
    await page.keyboard.type(names.hero);
    // The search runs off the main thread: wait until it has narrowed the picker to this one hero before pressing.
    const heroTiles = (): Promise<string[]> =>
      page.evaluate(() =>
        (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string }[]> }).__mcFocusRoutes
          .DeckBuilder!()
          .map((stop) => stop.key)
          .filter((key) => key.startsWith("identity:")),
      );
    await waitFor(
      async () => ((await heroTiles()).join() === `identity:${names.id}` ? true : null),
      "the search narrows to the pack hero",
      15_000,
    );
    await settle(page);
    // The tile's name bar picks the hero. The first press may only take the caret out of the search field, so press
    // again until the picker has moved on.
    const picked = async (): Promise<boolean> =>
      (await stopRect(page, "DeckBuilder", "start:empty")) !== null ||
      (await stopRect(page, "DeckBuilder", "identity-card")) !== null;
    for (let i = 0; i < 3 && !(await picked()); i++) {
      const tile = await stopRect(page, "DeckBuilder", `identity:${names.id}`);
      if (tile) await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height - 20);
      await page.waitForTimeout(800);
    }
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
    // The hero's title may carry its alter-ego in brackets, as "Spider-Man (Peter Parker)" does.
    const heroTitle = new RegExp(`${exactly(names.hero).source.slice(0, -1)}( \\(.+\\))?$`, "i");
    await flipBothWays(page, heroTitle, exactly(names.alterEgo), false);
  } finally {
    staged.dispose();
  }
});
