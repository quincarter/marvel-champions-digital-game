import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, trackPageErrors, waitFor } from "./helpers.js";
import { hook, openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * Issue #227 on the shelf headers (#753) and the Random buttons (#762): on a phone, a vertical swipe of the shelf list
 * that lifts over a shelf header, its "SEE ALL" end or a Random button must fold nothing, open no box and pick nothing.
 * A plain tap on a header still folds its shelf (the control).
 */

interface Stop extends Rect {
  readonly key: string;
}

const SCREENS = [
  {
    scene: "ScenarioSelect",
    query: "screen=scenario-select&unlock=all",
    hook: "__mcScenarioSelectDebug",
    header: "scenario-shelf:",
    randoms: ["random-box", "random-scenario"],
  },
  { scene: "Seats", query: "screen=seats&unlock=all", hook: "__mcSeatsDebug", header: "hero-shelf:", randoms: [] },
] as const;

type Screen = (typeof SCREENS)[number];
type Point = { x: number; y: number };

const stopsOf = async (page: Page, screen: Screen): Promise<Stop[]> =>
  (await hook<Stop[]>(page, screen.hook, "stops")) ?? [];

/** Everything a stray press could change: fold state, an open box, a chosen scenario, the scenes up. */
async function state(page: Page, screen: Screen) {
  return {
    folded: [...((await hook<string[]>(page, screen.hook, "folded")) ?? [])].sort(),
    drilledPack: await hook<string | null>(page, screen.hook, "drilledPack"),
    selected: screen.scene === "ScenarioSelect" ? await hook<string | null>(page, screen.hook, "selectedId") : null,
    scenes: await activeScenes(page),
  };
}

const touchOf = (page: Page) => async () => {
  const cdp = await page.context().newCDPSession(page);
  return {
    send: (type: string, p?: Point) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ ...p, id: 1 }] : [] }),
    done: () => cdp.detach(),
  };
};

/**
 * A finger down on `at`, dragged `dy` px up or down the list and back, and lifted on `at` again: a swipe whose press and
 * release are both on the control, but which is no tap. Paused before the lift so no coast carries the list on.
 */
async function swipeBackOnto(page: Page, at: Point, dy: number): Promise<void> {
  const touch = await touchOf(page)();
  const steps = 6;
  await touch.send("touchStart", at);
  for (let i = 1; i <= steps; i++) await touch.send("touchMove", { x: at.x, y: at.y + (dy * i) / steps });
  for (let i = steps - 1; i >= 0; i--) await touch.send("touchMove", { x: at.x, y: at.y + (dy * i) / steps });
  await page.waitForTimeout(150);
  await touch.send("touchEnd");
  await touch.done();
}

/** A finger down in the list at `from`, dragged straight to `to` and lifted there (the list scrolls under it). */
async function swipeTo(page: Page, from: Point, to: Point): Promise<void> {
  const touch = await touchOf(page)();
  const steps = 8;
  await touch.send("touchStart", from);
  for (let i = 1; i <= steps; i++)
    await touch.send("touchMove", {
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
    });
  await page.waitForTimeout(150);
  await touch.send("touchEnd");
  await touch.done();
}

/** Opens the screen. */
async function open(page: Page, screen: Screen): Promise<void> {
  await openApp(page, screen.query, { landing: screen.scene });
  await waitFor(
    async () => ((await stopsOf(page, screen)).some((s) => s.key.startsWith(screen.header)) ? true : null),
    "the shelf headers",
    30_000,
  );
  await settle(page);
}

/** A shelf header inside the list, with room to swipe above or below it, as its id, rect and the swipe's direction. */
async function visibleHeader(page: Page, screen: Screen) {
  const list = (await hook<Rect>(page, screen.hook, "listRect"))!;
  const found = (await stopsOf(page, screen))
    .filter((s) => s.key.startsWith(screen.header))
    .find((s) => s.y >= list.y && s.y + s.height <= list.y + list.height);
  expect(found, "a shelf header inside the list").toBeTruthy();
  const midY = found!.y + found!.height / 2;
  return {
    id: found!.key.slice(screen.header.length),
    rect: found!,
    list,
    dy: midY + 50 < list.y + list.height ? 50 : -50,
    title: { x: found!.x + 60, y: midY },
    seeAll: { x: found!.x + found!.width - 40, y: midY },
  };
}

for (const screen of SCREENS) {
  test(`issue #227: a swipe of the ${screen.scene} list that lifts over a shelf header or its SEE ALL folds and opens nothing; a tap folds`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "phone", "a touch swipe");
    test.setTimeout(120_000);
    const errors = trackPageErrors(page);
    await open(page, screen);
    const before = await state(page, screen);
    const h = await visibleHeader(page, screen);

    await swipeBackOnto(page, h.title, h.dy);
    await settle(page);
    expect(await state(page, screen), "a swipe that lifted on the header changed nothing").toEqual(before);

    // The list may have shifted a hair under the swipe: read the header again for the SEE ALL end.
    const again = await visibleHeader(page, screen);
    await swipeBackOnto(page, again.seeAll, again.dy);
    await settle(page);
    expect(await state(page, screen), "a swipe that lifted on SEE ALL changed nothing").toEqual(before);

    // A swipe that starts lower in the list and lifts over the header's SEE ALL end, as a finger scrolling the list does.
    const third = await visibleHeader(page, screen);
    await swipeTo(page, { x: third.title.x, y: third.list.y + third.list.height - 20 }, third.seeAll);
    await settle(page);
    const swiped = await state(page, screen);
    expect(swiped.folded, "nothing folded").toEqual(before.folded);
    expect(swiped.drilledPack, "no box opened").toBe(before.drilledPack);
    expect(swiped.scenes).toEqual(before.scenes);
    expect(swiped.selected).toBe(before.selected);

    // Control: a plain tap on a header folds its shelf.
    const target = await visibleHeader(page, screen);
    await page.touchscreen.tap(target.title.x, target.title.y);
    await waitFor(
      async () => ((await state(page, screen)).folded.includes(target.id) ? true : null),
      "a tap on the header folds its shelf",
      10_000,
    );
    expect((await state(page, screen)).drilledPack).toBe(before.drilledPack);
    expect(errors).toEqual([]);
  });
}

const randomScreen = SCREENS[0];

for (const id of randomScreen.randoms) {
  test(`issue #227: a swipe of the ScenarioSelect list that lifts over ${id} picks nothing`, async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "a touch swipe");
    test.setTimeout(120_000);
    const errors = trackPageErrors(page);
    await open(page, randomScreen);
    const before = await state(page, randomScreen);
    const b = (await stopsOf(page, randomScreen)).find((x) => x.key === id)!;
    const at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };

    // Press on the button, drag down into the list and back, lift on the button.
    await swipeBackOnto(page, at, 60);
    await settle(page);
    expect(await state(page, randomScreen), "a swipe that lifted on the button changed nothing").toEqual(before);

    // Start in the list, swipe up so the finger lifts over the button.
    const list = (await hook<Rect>(page, randomScreen.hook, "listRect"))!;
    await swipeTo(page, { x: at.x, y: list.y + 80 }, at);
    await settle(page);
    const after = await state(page, randomScreen);
    expect(after.selected, "no scenario picked").toBe(before.selected);
    expect(after.drilledPack, "no box opened").toBe(before.drilledPack);
    expect(after.folded, "nothing folded").toEqual(before.folded);
    expect(errors).toEqual([]);
  });
}
