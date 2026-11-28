import { expect, test, type Page } from "@playwright/test";
import { findText, settle } from "./helpers.js";
import {
  assertNoRawText,
  clickStop,
  installWave6Helpers,
  routeStops,
  screens,
  scrollStopIntoView,
  waitForScene,
} from "./wave6-helpers-a.js";

/**
 * The Briefing's "Your call" shows the cards a pick is about as pictures, and each picture opens the card in Inspect
 * (`view/campaign-briefing-model.ts`'s `sideSchemePickCards` / `cardPickOptionsOf`, drawn by
 * `scenes/campaign/briefing/calls/pick-art.ts`). Two boxes: NeXt Evolution's side-scheme pick at issue #1 (six rows, three
 * cards each: the scheme, the environment it earns, the encounter card it brings) and Age of Apocalypse's Desperate
 * Measures offer (a plain pick whose one option is a card). Reading a card never answers the question, the list keeps
 * its scroll position across Inspect, and PICK still records the choice. Runs come from `campaign/dev-fixtures.ts`.
 */

const SCHEMES = [
  "Establish Safehouse",
  "Mission Prep",
  "Assemble the Team",
  "Gear Up",
  "Practice Maneuvers",
  "Prepare Defenses",
];

async function openBriefing(page: Page, seed: string, stop: string): Promise<void> {
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title");
  const runId = await page.evaluate(
    async ([fn, at]) => {
      const fixtures = (await import("/src/campaign/dev-fixtures.ts")) as unknown as Record<
        string,
        (service: unknown, stop: string) => Promise<{ id: string }>
      >;
      const service = (window as unknown as { __mcCampaign: { service: unknown } }).__mcCampaign.service;
      return (await fixtures[fn!]!(service, at!)).id;
    },
    [seed, stop],
  );
  await page.evaluate((id) => {
    const game = (window as unknown as { __mcGame: any }).__mcGame;
    for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.sys.settings.key);
    game.scene.start("CampaignBriefing", { runId: id });
  }, runId);
  await waitForScene(page, "CampaignBriefing");
  await settle(page);
}

const stopKeys = async (page: Page): Promise<string[]> =>
  (await routeStops(page, "CampaignBriefing"))?.stops.map((stop) => stop.key) ?? [];

const stopRect = async (page: Page, key: string) =>
  (await routeStops(page, "CampaignBriefing"))?.stops.find((stop) => stop.key === key)?.rect ?? null;

/** How many card scans the Briefing has drawn (images whose texture is a card's art). */
const cardScansDrawn = (page: Page): Promise<number> =>
  page.evaluate(() => {
    interface Obj {
      type?: string;
      texture?: { key?: string };
      list?: Obj[];
    }
    const scene = (window as unknown as { __mcGame: any }).__mcGame.scene.getScene("CampaignBriefing");
    let count = 0;
    const walk = (object: Obj): void => {
      if (object.type === "Image" && String(object.texture?.key).startsWith("art:bundles/cards/")) count += 1;
      for (const child of object.list ?? []) walk(child);
    };
    for (const child of scene.children.list as Obj[]) walk(child);
    return count;
  });

async function inspectAndClose(page: Page, key: string, cardName: string): Promise<void> {
  await scrollStopIntoView(page, key, "CampaignBriefing");
  const before = await stopRect(page, key);
  await clickStop(page, key, "CampaignBriefing");
  await expect.poll(async () => (await screens(page)).includes("InspectOverlay"), { message: key }).toBe(true);
  await expect.poll(async () => (await findText(page, cardName, "InspectOverlay")).length).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await screens(page)).includes("InspectOverlay")).toBe(false);
  await settle(page);
  expect(await stopRect(page, key), `${key} is where it was before Inspect`).toEqual(before);
}

test("NeXt Evolution issue #1: each side scheme shows its three cards, each opens Inspect, and Pick still picks", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openBriefing(page, "seedNextEvolRun", "fresh");
  await expect.poll(async () => (await findText(page, "YOUR CALL", "CampaignBriefing")).length).toBeGreaterThan(0);

  // Six rows, each with a picture per card and its own Pick.
  const keys = await stopKeys(page);
  for (const name of SCHEMES) {
    for (const part of ["scheme", "environment", "encounter"]) {
      expect(keys, `${name}'s ${part} picture`).toContain(`call-scheme:${name}:${part}`);
    }
    expect(keys, `${name}'s Pick`).toContain(`call-option:${name}`);
  }
  expect((await findText(page, "PICK", "CampaignBriefing")).filter((t) => t.text.trim() === "PICK")).toHaveLength(6);
  // The scans themselves are on the page: 18 pictures once the art has arrived.
  await expect.poll(() => cardScansDrawn(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(18);
  await assertNoRawText(page, "side-scheme picker");
  expect(keys, "Open issue waits on the pick").not.toContain("open");

  // Reading a card opens Inspect and answers nothing; the last row is reached by scrolling and stays put.
  await inspectAndClose(page, "call-scheme:Establish Safehouse:scheme", "ESTABLISH SAFEHOUSE");
  await inspectAndClose(page, "call-scheme:Prepare Defenses:environment", "PREPARED DEFENSES");
  await inspectAndClose(page, "call-scheme:Prepare Defenses:encounter", "UNDER PRESSURE");
  expect(await stopKeys(page), "still asking").toContain("call-option:Prepare Defenses");

  // Pick records the choice: the settled row shows the same three pictures and the issue can be opened.
  await clickStop(page, "call-option:Prepare Defenses", "CampaignBriefing");
  await expect.poll(async () => await stopKeys(page), { timeout: 30_000 }).toContain("open");
  const settled = await stopKeys(page);
  expect(settled.filter((key) => key.startsWith("call-"))).toEqual([]);
  for (const part of ["scheme", "environment", "encounter"]) expect(settled).toContain(`scheme-chosen:${part}`);
  await inspectAndClose(page, "scheme-chosen:environment", "PREPARED DEFENSES");
});

test("NeXt Evolution on a phone: the stacked rows show the same pictures and Pick still picks", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openBriefing(page, "seedNextEvolRun", "fresh");
  await expect.poll(async () => (await stopKeys(page)).filter((key) => key.startsWith("call-scheme:")).length).toBe(18);
  await inspectAndClose(page, "call-scheme:Gear Up:encounter", "OVERBURDENED");
  await scrollStopIntoView(page, "call-option:Gear Up", "CampaignBriefing");
  await clickStop(page, "call-option:Gear Up", "CampaignBriefing");
  await expect.poll(async () => await stopKeys(page), { timeout: 30_000 }).toContain("open");
});

test("Age of Apocalypse: a pick whose option is a card shows the card, which opens Inspect, and the button still takes it", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openBriefing(page, "seedAoaRun", "afterIssue3");
  await expect.poll(async () => await stopKeys(page)).toContain("call-inspect:0");
  expect((await findText(page, "SEAT 1", "CampaignBriefing")).length).toBeGreaterThan(0);
  await expect.poll(() => cardScansDrawn(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
  await inspectAndClose(page, "call-inspect:0", "DESPERATE MEASURES");
  expect((await findText(page, "SEAT 1", "CampaignBriefing")).length, "reading did not answer").toBeGreaterThan(0);

  // The option's own button answers for seat 1; seat 2 is asked the same thing next.
  await clickStop(page, "call-option:0", "CampaignBriefing");
  await expect.poll(async () => (await findText(page, "SEAT 2", "CampaignBriefing")).length).toBeGreaterThan(0);
  expect(await stopKeys(page)).toContain("call-inspect:0");
});
