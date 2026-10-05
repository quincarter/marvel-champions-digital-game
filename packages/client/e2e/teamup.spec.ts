import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  clickFocus,
  clickText,
  guideStopped,
  handInstanceFor,
  pressAt,
  pressKey,
  settle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import {
  declineMulligans,
  findVisibleText,
  handRectFor,
  inspectAt,
  openApp,
  playHandCardByClicks,
  startGame,
  teamUpRings,
} from "./wave6-helpers-b.js";

/**
 * Team-Ups (wave 6, Gambit and Rogue): the splash, the ring on the hero panels, the panel, the TEAM-UP tag on a hand
 * card and Inspect's callout, plus a data check that every `art/teamups/` folder is wired to a real pair.
 *
 * Seed 5 deals Beauty and the Thief (37019 / 38020) to both Gambit and Rogue, so the tag and its Inspect callout are
 * read off the real hand; seed 4 deals Gambit the Rogue ally (37002) in a solo game. Both were found by searching
 * seeds against the starter decks, so a changed deck or deal order fails here by name and the seed gets re-picked.
 */

const SPLASH = "TeamUpSplashOverlay";
const INFO = "TeamUpInfoOverlay";
const INSPECT = "InspectOverlay";

const onScene = async (page: Page, key: string): Promise<boolean> => (await activeScenes(page)).includes(key);

async function forms(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game: { players: { identity: { form: string } }[] } } } };
    };
    return appSession().store.state.game.players.map((p) => p.identity.form);
  });
}

/** Flips the perspective seat to hero form by the Flip button. */
async function flipByClick(page: Page, seat: number): Promise<void> {
  await clickFocus(page, "basic:changeForm");
  await waitFor(async () => ((await forms(page))[seat] === "hero" ? true : null), `seat ${seat} is in hero form`);
  // No settle here: the flip that completes a pair opens the Team-Up splash, which closes itself 2.5 s after its
  // picture loads, and on a slow runner a settle outlasts it. Callers wait on the splash's own record.
}

interface SplashRecord {
  readonly label: string;
  readonly drawn: boolean;
  readonly closed: boolean;
}

/** The dev record of every Team-Up splash so far (`__mcTeamUpSplashLog`): durable, unlike the splash itself. */
async function splashLog(page: Page): Promise<SplashRecord[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __mcTeamUpSplashLog?: SplashRecord[] }).__mcTeamUpSplashLog?.map((e) => ({ ...e })) ?? [],
  );
}

/** Waits for a splash to have been drawn (title and picture) from the record, not by catching it on screen. */
async function waitForSplashDrawn(page: Page, count = 1): Promise<SplashRecord> {
  return waitFor(
    async () => {
      const drawn = (await splashLog(page)).filter((e) => e.drawn);
      return drawn.length >= count ? drawn[count - 1]! : null;
    },
    "the splash was drawn",
    20000,
  );
}

/** Taps the splash if it is still up (it closes itself after 2.5 s, so on a slow runner it may be gone), once and
 * unverified: a repeat would land on the table underneath. Then waits for the record to say it closed. */
async function tapSplashThenWaitClosed(page: Page): Promise<void> {
  if (await onScene(page, SPLASH)) await pressAt(page, 720, 450, { verify: false });
  await waitFor(
    async () => ((await splashLog(page)).every((e) => e.closed) && !(await onScene(page, SPLASH)) ? true : null),
    "the splash is closed",
    8000,
  );
}

/** Ends the perspective seat's turn through the confirm sheet; the Board hands the table to the next seat. */
async function endTurnByClick(page: Page): Promise<void> {
  const seatBefore = await perspectiveSeat(page);
  await clickFocus(page, "basic:endTurn");
  await waitFor(async () => ((await onScene(page, "EndTurnConfirmOverlay")) ? true : null), "the end-turn confirm");
  await settle(page);
  await clickText(page, "End turn", { sceneKey: "EndTurnConfirmOverlay" });
  // The table is handed to the next seat: wait for that (state), not for a guessed delay, or the next click lands on
  // the seat that just finished.
  await waitFor(async () => ((await perspectiveSeat(page)) !== seatBefore ? true : null), "the next seat is up");
  await waitFor(async () => (!(await onScene(page, "EndTurnConfirmOverlay")) ? true : null), "the confirm closes");
  await settle(page);
}

async function perspectiveSeat(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { perspectiveId: string | null } } };
    };
    return appSession().store.state.perspectiveId;
  });
}

/** Two seats, seed 5, mulligans declined, Gambit flipped and his turn ended: Rogue is next, still in alter-ego. */
async function twoSeatsToRogueTurn(page: Page): Promise<void> {
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["gambit-justice", "rogue-protection"], seed: 5 });
  await declineMulligans(page);
  // The pair is present from the start, so the splash opens with the first turn and closes itself.
  await waitForSplashDrawn(page);
  await waitFor(async () => (!(await onScene(page, SPLASH)) ? true : null), "the splash times out", 8000);
  await flipByClick(page, 0);
  await endTurnByClick(page);
}

test.describe("Team-Up: Gambit and Rogue", () => {
  test("the quiet ring from the first frame and the splash at game start; the ring turns solid when both flip", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    await openApp(page);
    await startGame(page, { scenarioId: "rhino", decks: ["gambit-justice", "rogue-protection"], seed: 5 });
    await declineMulligans(page);

    // Both seats are present (alter-ego forms), so the splash opens with the first turn. The title is drawn once the
    // picture has loaded, which takes a while on a slow runner, and the splash then closes itself: read the record
    // of it, not the moment.
    const splash = await waitForSplashDrawn(page);
    expect(splash.label.toUpperCase(), "the splash titles the pair").toBe("GAMBIT AND ROGUE");
    const picture = await page.evaluate(
      () =>
        (
          window as unknown as {
            __mcTeamUpSplashDebug?: { picture: () => { x: number; y: number; width: number; height: number } };
          }
        ).__mcTeamUpSplashDebug?.picture() ?? null,
    );
    expect(picture, "the splash picture is placed").not.toBeNull();
    expect(picture!.width).toBeGreaterThan(100);

    // The tap path: any tap on the splash closes it, and it does not come back.
    await tapSplashThenWaitClosed(page);
    expect(await teamUpRings(page), "the quiet ring is there with both in alter-ego").toHaveLength(2);
    expect(
      (await findVisibleText(page, "team-up", "Board")).length,
      "the hand card carries the quiet TEAM-UP tag",
    ).toBeGreaterThan(0);
    const quietRing = (await teamUpRings(page))[0]!;
    await page.mouse.move(quietRing.x + quietRing.width / 2, quietRing.y + quietRing.height / 2);
    await waitFor(async () => ((await teamUpRings(page)).some((r) => r.labelShown) ? true : null), "quiet label", 4000);
    expect(
      await findVisibleText(page, "Team-Up: Gambit and Rogue", "Board"),
      "the quiet label names only the pair",
    ).not.toHaveLength(0);
    expect(await findVisibleText(page, "Team-Up active", "Board"), "no active label while quiet").toEqual([]);
    await page.mouse.move(720, 450);
    expect(
      await findVisibleText(page, "needs hero form", "Board"),
      "both alter-egos carry the yellow blurb (own panel and the other hero's row)",
    ).toHaveLength(2);

    await flipByClick(page, 0);
    expect(await teamUpRings(page), "still quiet with only Gambit a hero").toHaveLength(2);
    expect((await findVisibleText(page, "needs hero form", "Board")).length, "only Rogue's panel keeps the blurb").toBe(
      1,
    );
    await endTurnByClick(page);
    await flipByClick(page, 1);
    // An absence has no state to wait for: hold the window open long enough for a wrongly re-opened splash to show.
    await page.waitForTimeout(3500);
    expect(await onScene(page, SPLASH), "no second splash when the pair becomes playable").toBe(false);
    expect(
      (await splashLog(page)).filter((e) => e.drawn),
      "one splash in the whole game",
    ).toHaveLength(1);

    // The ring, on both hero panels.
    const rings = await teamUpRings(page);
    expect(rings, "one ring per hero panel").toHaveLength(2);
    for (const ring of rings) {
      expect(ring.x).toBeGreaterThanOrEqual(0);
      expect(ring.x + ring.width).toBeLessThanOrEqual(1440);
      expect(ring.y + ring.height).toBeLessThanOrEqual(900);
    }
    const ring = rings[0]!;
    const cx = ring.x + ring.width / 2;
    const cy = ring.y + ring.height / 2;

    // Hover shows the label; leaving hides it.
    await page.mouse.move(cx, cy);
    await waitFor(async () => ((await teamUpRings(page)).some((r) => r.labelShown) ? true : null), "hover label", 4000);
    expect(await findVisibleText(page, "Team-Up active: Gambit and Rogue", "Board")).not.toHaveLength(0);
    // Showing the label redraws the board, which replaces the ring's zone under the pointer; the new zone can be hit
    // one frame later and only hears "over" on the next move. A real mouse supplies that move on its way out. This one
    // jumps, so give it the nudge a hand would, or on a slow runner the label never gets its "out".
    await page.mouse.move(cx + 2, cy + 2);
    await settle(page, { quietMs: 150, maxMs: 600 });
    await page.mouse.move(720, 450);
    await waitFor(
      async () => (!(await teamUpRings(page)).some((r) => r.labelShown) ? true : null),
      "label hides again",
      4000,
    );

    // A click opens the panel with the pair's card and the circle portrait.
    await pressAt(page, cx, cy);
    await waitFor(async () => ((await onScene(page, INFO)) ? true : null), "the ring opens the panel", 4000);
    await settle(page);
    expect(
      await findVisibleText(page, "Beauty and the Thief", INFO),
      "the panel lists the Team-Up card",
    ).not.toHaveLength(0);
    const portrait = await page.evaluate(() => {
      const game = (
        window as unknown as {
          __mcGame: {
            scene: { getScene: (k: string) => { children: { list: { type: string; texture?: { key: string } }[] } } };
          };
        }
      ).__mcGame;
      return game.scene
        .getScene("TeamUpInfoOverlay")
        .children.list.filter((o) => o.type === "Image" && o.texture?.key.includes(":badge:")).length;
    });
    expect(portrait, "the circle portrait is drawn").toBeGreaterThan(0);

    // The card row opens Inspect; Escape closes Inspect first, then the panel.
    const row = await page.evaluate(
      () =>
        (
          window as unknown as {
            __mcTeamUpInfoDebug?: { cardRects: () => { x: number; y: number; width: number; height: number }[] };
          }
        ).__mcTeamUpInfoDebug?.cardRects()[0] ?? null,
    );
    expect(row).not.toBeNull();
    await pressAt(page, row!.x + row!.width / 2, row!.y + row!.height / 2);
    await waitFor(async () => ((await onScene(page, INSPECT)) ? true : null), "the card row opens Inspect", 4000);
    await pressKey(page, "Escape");
    await waitFor(async () => (!(await onScene(page, INSPECT)) ? true : null), "Escape closes Inspect", 4000);
    expect(await onScene(page, INFO), "the panel is still open after the first Escape").toBe(true);
    await pressKey(page, "Escape");
    await waitFor(async () => (!(await onScene(page, INFO)) ? true : null), "the second Escape closes the panel", 4000);

    // T is the keyboard route to the same panel.
    await pressKey(page, "t");
    await waitFor(async () => ((await onScene(page, INFO)) ? true : null), "T opens the panel", 4000);
    await pressKey(page, "Escape");
    await waitFor(async () => (!(await onScene(page, INFO)) ? true : null), "Escape closes the T panel", 4000);

    expect(await guideStopped(page).catch(() => false)).toBe(false);
    expect(errors).toEqual([]);
  });

  test("the splash closes by itself, and Beauty and the Thief carries the tag and the Inspect callout", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    await twoSeatsToRogueTurn(page);

    // Before her flip Rogue holds Beauty and the Thief (38020), the pair present but not playable: quiet tag, "needs" callout.
    expect(await handInstanceFor(page, "38020"), "seed 5 deals Rogue Beauty and the Thief").not.toBeNull();
    expect(await findVisibleText(page, "team-up", "Board"), "quiet tag before the pair is playable").not.toEqual([]);
    await inspectAt(page, await handRectFor(page, "38020"), "right");
    expect(await findVisibleText(page, "Team-Up: needs Rogue in hero form.", INSPECT)).not.toHaveLength(0);
    await pressKey(page, "Escape");
    await waitFor(async () => (!(await onScene(page, INSPECT)) ? true : null), "Escape closes Inspect", 4000);

    await flipByClick(page, 1);
    await settle(page);

    const tags = await findVisibleText(page, "team-up", "Board");
    expect(tags.length, "the hand card carries a TEAM-UP tag").toBeGreaterThan(0);

    for (const how of ["right", "hold"] as const) {
      await inspectAt(page, await handRectFor(page, "38020"), how);
      const callout = await findVisibleText(page, "Team-Up active: Gambit and Rogue are both in play", INSPECT);
      expect(callout, `Inspect (${how}) shows the Team-Up active callout`).not.toHaveLength(0);
      await pressKey(page, "Escape");
      await waitFor(async () => (!(await onScene(page, INSPECT)) ? true : null), "Escape closes Inspect", 4000);
    }
    expect(errors).toEqual([]);
  });

  test("solo Gambit: the Rogue ally carries the tag, says so in Inspect, and playing her brings the pair together", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    await openApp(page);
    await startGame(page, { scenarioId: "rhino", decks: ["gambit-justice"], seed: 4 });
    await declineMulligans(page);
    expect(await handInstanceFor(page, "37002"), "seed 4 deals Gambit the Rogue ally").not.toBeNull();
    expect(await findVisibleText(page, "team-up", "Board"), "the quiet tag while Gambit is Remy").not.toEqual([]);

    await flipByClick(page, 0);
    expect(await teamUpRings(page), "Gambit alone makes no ring").toEqual([]);
    const tags = await findVisibleText(page, "team-up", "Board");
    expect(tags.length, "the ally carries the TEAM-UP tag").toBeGreaterThan(0);

    await inspectAt(page, await handRectFor(page, "37002"), "right");
    expect(await findVisibleText(page, "playing Rogue brings Gambit and Rogue together", INSPECT)).not.toHaveLength(0);
    await pressKey(page, "Escape");
    await waitFor(async () => (!(await onScene(page, INSPECT)) ? true : null), "Escape closes Inspect", 4000);

    await playHandCardByClicks(page, "37002");
    await waitForSplashDrawn(page);
    await tapSplashThenWaitClosed(page);
    await waitFor(async () => ((await teamUpRings(page)).length > 0 ? true : null), "the ring appears", 4000);
    expect(errors).toEqual([]);
  });
});

test("every art/teamups folder has a splash and a badge that load, and is named for a real pair", async ({ page }) => {
  test.setTimeout(180_000);
  const root = fileURLToPath(new URL("../../../art/teamups/", import.meta.url));
  const folders = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name);
  expect(folders.length, "there are Team-Up art folders").toBeGreaterThan(0);

  await openApp(page);
  const result = await page.evaluate(async (folders) => {
    const pool = (await import("/src/content/pool.ts")) as unknown as { POOL_CARDS: Iterable<unknown> };
    const model = (await import("/src/view/team-up-model.ts")) as unknown as {
      teamUpPairsOf: (cards: Iterable<unknown>) => { key: string; label: string }[];
    };
    const art = (await import("/src/art/team-up-art.ts")) as unknown as {
      TEAM_UP_ART: {
        pairs: Map<string, { splash: { url: string } | null; badge: { url: string } | null }>;
        unrecognized: string[];
      };
    };
    const load = (url: string): Promise<number> =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image.naturalWidth);
        image.onerror = () => resolve(0);
        image.src = url;
      });
    const pairKeys = model.teamUpPairsOf(pool.POOL_CARDS).map((p) => p.key);
    const rows: { folder: string; known: boolean; splash: number; badge: number }[] = [];
    for (const folder of folders) {
      const entry = art.TEAM_UP_ART.pairs.get(folder);
      rows.push({
        folder,
        known: pairKeys.includes(folder),
        splash: entry?.splash ? await load(entry.splash.url) : 0,
        badge: entry?.badge ? await load(entry.badge.url) : 0,
      });
    }
    return { rows, pairKeys, unrecognized: art.TEAM_UP_ART.unrecognized };
  }, folders);

  expect(result.unrecognized, "no stray file in art/teamups/").toEqual([]);
  for (const row of result.rows) {
    expect(row.known, `folder "${row.folder}" names a Team-Up pair in the card pool`).toBe(true);
    expect(row.splash, `${row.folder}/splash loads`).toBeGreaterThan(0);
    expect(row.badge, `${row.folder}/badge loads`).toBeGreaterThan(0);
  }
  for (const key of result.pairKeys) {
    expect(folders, `the pool's pair "${key}" has an art folder`).toContain(key);
  }
});
