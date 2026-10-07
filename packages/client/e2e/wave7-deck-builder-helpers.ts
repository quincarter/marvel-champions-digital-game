import { expect, type Page } from "@playwright/test";
import { clickText, pressAt, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, routeStops, screens, visibleTexts, waitForScene, type Stop } from "./wave6-helpers-a.js";
import { hook } from "./wave6-helpers-b.js";

/**
 * Shared player-level drivers for the wave 7 deck builder QA specs (wave7-deck-builder-pool.spec.ts and
 * wave7-deck-builder-rules.spec.ts). Everything is pointer or keyboard through the screen's own controls; the only
 * reads are the focus-route stop list (control rects), visible text and the Decks screen's own debug rows.
 * Set MC_QA_PHONE=1 to run the same flows on a 390 x 844 touch viewport from the desktop project.
 */
export const SHOTS =
  "/private/tmp/claude-501/-Users-quincarter-Documents-Dev-marvel-champions-game/144e988e-5813-49ba-b244-097ac3ae5667/scratchpad/deck-builder";
export const PHONE = process.env.MC_QA_PHONE === "1";
export const shot = (page: Page, name: string): Promise<Buffer> =>
  page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width ?? 0}.png` });

export async function openDecks(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await page.addInitScript(() => {
    localStorage.setItem("mc-guide", JSON.stringify({ version: 1, level: "off", chooserSeen: true }));
  });
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await clickText(page, "Decks", { sceneKey: "Title" });
  await waitForScene(page, "Decks", 15000);
  await settle(page);
}

export const stopsOf = async (page: Page, scene: string): Promise<Stop[]> =>
  (await routeStops(page, scene))?.stops ?? [];
export const stopOf = async (page: Page, scene: string, key: string): Promise<Stop | undefined> =>
  (await stopsOf(page, scene)).find((s) => s.key === key);

/** Wheels over the control's own column until its rect sits inside the viewport (a virtual list scrolls by wheel). */
export async function scrollTo(page: Page, scene: string, key: string): Promise<Stop> {
  const size = page.viewportSize() ?? { width: 1440, height: 900 };
  for (let i = 0; i < 80; i++) {
    const stop = await waitFor(
      () => stopOf(page, scene, key).catch(() => undefined),
      `control "${key}" on ${scene}`,
      20000,
    );
    const { x, y, width, height } = stop.rect;
    const cy = y + height / 2;
    if (!/^(card:|identity:|deck:|new-deck|pool-card:)/.test(key)) {
      // A fixed control (Save, a filter chip): on a phone the whole column scrolls, so wheel the column until it is in view.
      const limit = size.width < 1000 && scene === "DeckBuilder" && key !== "filter-text" ? 420 : size.height - 20; // the phone builder's top region scrolls above a fixed search field and pool list
      if (
        key === "back" ? cy > 0 && cy < 120 : cy > 60 && cy < limit && x + width / 2 > 0 && x + width / 2 < size.width
      )
        return stop;
      if (size.width >= 1000)
        throw new Error(`"${key}" on ${scene} is outside the viewport at ${JSON.stringify(stop.rect)}`);
      await page.mouse.move(size.width / 2, 100);
      await page.mouse.wheel(0, cy <= 60 ? -200 : 200);
      await page.waitForTimeout(500);
      await settle(page, { quietMs: 200, maxMs: 800 });
      continue;
    }
    const bottom = scene === "Decks" ? size.height * 0.83 : size.height - 40;
    if (cy >= 150 && cy <= bottom && x + width / 2 > 0 && x + width / 2 < size.width) return stop;
    const wx = Math.min(Math.max(x + width / 2, 20), size.width - 20);
    await page.mouse.move(wx, Math.round(size.height * 0.5));
    await page.mouse.wheel(0, cy < 150 ? -300 : 300);
    await settle(page, { quietMs: 120, maxMs: 400 });
  }
  throw new Error(`could not scroll "${key}" into view on ${scene}`);
}

const tap = async (page: Page, x: number, y: number): Promise<void> => {
  if (PHONE) await page.touchscreen.tap(x, y);
  else await pressAt(page, x, y, { verify: false });
};

/** Presses a control by its route key (scrolling it into view first). */
export async function press(page: Page, scene: string, key: string): Promise<void> {
  if (PHONE && scene === "Decks" && key !== "back" && !(await stopOf(page, scene, key))) {
    // The phone Decks screen shows one tab at a time (Decks, Cards, Stats); open the one that holds the control.
    const tabKey = key.startsWith("stats-") ? "tab:stats" : key.startsWith("pool-") ? "tab:cards" : "tab:decks";
    const tab = (await stopOf(page, scene, tabKey))?.rect;
    if (tab) await tap(page, tab.x + tab.width / 2, tab.y + tab.height / 2);
    await settle(page, { quietMs: 200, maxMs: 800 });
  }
  const stop = await scrollTo(page, scene, key);
  await settle(page, { quietMs: 120, maxMs: 400 });
  const r = ((await stopOf(page, scene, key)) ?? stop).rect;
  await tap(page, r.x + r.width / 2, r.y + r.height / 2);
  await settle(page, { quietMs: 150, maxMs: 600 });
}

/** The pool row's own + (or -) button, by its geometry in `deck-builder.ts#renderCardRow`. */
export async function rowButton(page: Page, id: string, which: "plus" | "minus"): Promise<void> {
  await scrollTo(page, "DeckBuilder", `card:${id}`);
  await settle(page, { quietMs: 120, maxMs: 400 });
  const r = (await stopOf(page, "DeckBuilder", `card:${id}`))!.rect;
  await tap(page, r.x + r.width - (which === "plus" ? 30 : 90), r.y + (104 - 6) / 2);
  await settle(page, { quietMs: 150, maxMs: 600 });
}
export const add = (page: Page, id: string): Promise<void> => rowButton(page, id, "plus");
export const remove = (page: Page, id: string): Promise<void> => rowButton(page, id, "minus");

/** Every visible text of one scene. */
export async function texts(page: Page, scene: string): Promise<string[]> {
  return (await visibleTexts(page)).filter((t) => t.scene === scene).map((t) => t.text);
}
/** Types into a focused field (search boxes). */
export async function typeInto(page: Page, scene: string, key: string, value: string): Promise<void> {
  await press(page, scene, key);
  for (let i = 0; i < 40; i++) await page.keyboard.press("Backspace");
  await page.keyboard.type(value);
  await settle(page, { quietMs: 200, maxMs: 800 });
}

export interface DeckRow {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly selected: boolean;
  readonly status: string;
  readonly legal: boolean;
  readonly problems: string[];
  readonly cardCount: number;
}
export const deckRows = async (page: Page): Promise<DeckRow[]> =>
  (await hook<DeckRow[]>(page, "__mcDecksDebug", "decks")) ?? [];

export async function startNewDeck(page: Page, identityId: string): Promise<void> {
  for (let attempt = 0; attempt < 3 && !(await screens(page)).includes("DeckBuilder"); attempt++) {
    await press(page, "Decks", "new-deck");
    await waitFor(async () => ((await screens(page)).includes("DeckBuilder") ? true : null), "builder", 8000).catch(
      () => null,
    );
  }
  await waitForScene(page, "DeckBuilder", 15000);
  await settle(page);
  await press(page, "DeckBuilder", `identity:${identityId}`);
  await waitFor(async () => ((await stopOf(page, "DeckBuilder", "save")) ? true : null), "builder opens", 15000);
  await settle(page);
}
export { expect };

/** Taps the center of a visible text of `scene` (exact match, `nth` of the matches top-left first). */
export async function tapText(page: Page, scene: string, text: string, nth = 0): Promise<void> {
  const hits = (await visibleTexts(page))
    .filter((t) => t.scene === scene && t.text === text)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const hit = hits[nth];
  if (!hit) throw new Error(`no "${text}" text on ${scene}`);
  await tap(page, hit.x, hit.y);
  await settle(page, { quietMs: 150, maxMs: 600 });
}

/** A legal 40-card Deadpool 'Pool deck: his 15-card set plus 25 'Pool cards (name query, card id, copies). */
export const POOL_FILL: readonly (readonly [string, string, number])[] = [
  ["Barely", "44017", 3],
  ["I Got This", "44021", 3],
  ["Healing Factor", "44029", 3],
  ["Break Time", "44046", 1],
  ["Dogpool", "44013", 1],
  ["Headpool", "44014", 1],
  ["Kidpool", "44015", 1],
  ["Lady Deadpool", "44016", 1],
  ["Bob, Agent", "44043", 1],
  ["Pandapool", "44045", 1],
  ["Cutupper", "44018", 1],
  ["Get Rage", "44020", 1],
  ["Not my", "44022", 1],
  ["Mulligan", "44048", 3],
  ["Ambush", "44051", 3],
];
export async function fillPoolDeck(page: Page, alreadyHave: readonly string[] = []): Promise<void> {
  for (const [query, id, copies] of POOL_FILL) {
    if (alreadyHave.includes(id)) continue;
    await typeInto(page, "DeckBuilder", "filter-text", query);
    for (let i = 0; i < copies; i++) await add(page, id);
  }
  await typeInto(page, "DeckBuilder", "filter-text", "");
}
/** The builder's legality line: "Legal — N cards." or "N problem(s): ...". */
export async function legalityLine(page: Page): Promise<string> {
  return (await texts(page, "DeckBuilder")).find((x) => /^(\d+ problems?:|Legal)/.test(x)) ?? "";
}
/** The "YOUR DECK" panel's lines, as one string per card: "Name x N". */
export async function deckPanel(page: Page): Promise<string[]> {
  const t = await texts(page, "DeckBuilder");
  // Each line also carries its "-" remove control's label.
  return t.slice(t.indexOf("YOUR DECK") + 1, t.indexOf("PRECONSTRUCTED")).filter((x) => x !== "−");
}
/** The pool list's card ids as drawn right now. */
export async function poolIds(page: Page): Promise<string[]> {
  return (await stopsOf(page, "DeckBuilder")).filter((s) => s.key.startsWith("card:")).map((s) => s.key.slice(5));
}
export async function search(page: Page, q: string): Promise<string[]> {
  await typeInto(page, "DeckBuilder", "filter-text", q);
  return poolIds(page);
}
