import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { reachVillainRecap } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, openApp } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Every card thumbnail in the villain-phase recap opens the hover popover on desktop. Two bugs kept some quiet: the
 * hover list held one rect per card, so the villain's second "attacks" row took the first row's place, and the
 * steps scroll without a redraw, so a thumbnail scrolled up from under the footer bar kept its old rect.
 * Two heroes in hero form against Ultron: Ultron attacks each of them, so the recap shows him twice.
 */

interface Hit {
  readonly id: string;
  readonly hidden: boolean;
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

const hits = async (page: Page): Promise<Hit[]> => (await allHits(page)).filter((hit) => !hit.hidden);

const allHits = (page: Page): Promise<Hit[]> =>
  page.evaluate(
    () => (window as unknown as { __mcVillainHoverDebug?: { hits(): Hit[] } }).__mcVillainHoverDebug?.hits() ?? [],
  );

const shown = (page: Page): Promise<string | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcVillainHoverDebug?: { shown(): string | null } }).__mcVillainHoverDebug?.shown() ??
      null,
  );

async function flipAndPass(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          dispatch: (c: unknown) => Promise<void>;
          state: { legal?: { actions: { legal?: { action: { kind: string }; example: unknown }[] } } };
        };
      };
    };
    const { store } = appSession();
    const flip = store.state.legal?.actions.legal?.find((e) => e.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  });
  await settle(page);
}

async function setup(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: "ultron",
      difficulty: "standard",
      players: [{ starterDeckId: "core-captain-marvel-leadership" }, { starterDeckId: "core-spider-man-justice" }],
      seed: 166,
    });
    const scenes = (
      window as unknown as {
        __mcGame: {
          scene: {
            getScenes: (a: boolean) => { sys: { settings: { key: string } } }[];
            stop: (k: string) => void;
            start: (k: string) => void;
          };
        };
      }
    ).__mcGame.scene;
    for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
    scenes.start("Board");
  });
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20000);
  await settle(page);
  await declineMulligans(page);
  await settle(page);
}

/** Rests the mouse on a thumbnail's middle and waits for the popover; true once it shows that card. */
async function hovers(page: Page, hit: Hit): Promise<boolean> {
  await page.mouse.move(4, 4);
  await page.waitForTimeout(150);
  await page.mouse.move(hit.rect.x + hit.rect.width / 2, hit.rect.y + hit.rect.height / 2, { steps: 4 });
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    if ((await shown(page)) === hit.id) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

test("every card in the villain-phase recap hovers, the villain's second attack row and scrolled cards included", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "the hover popover is desktop-only");
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await installWave6Helpers(page);
  await openApp(page);
  await setup(page);
  // Both heroes in hero form, so Ultron attacks each of them.
  await flipAndPass(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          dispatch: (c: unknown) => Promise<void>;
          state: { legal?: { actions: { legal?: { action: { kind: string }; example: unknown }[] } } };
        };
      };
    };
    const { store } = appSession();
    const end = store.state.legal?.actions.legal?.find((e) => e.action.kind === "endTurn");
    if (end) await store.dispatch(end.example);
  });
  await settle(page);
  await flipAndPass(page);

  await reachVillainRecap(page, false);
  await settle(page);
  expect(await activeScenes(page)).toContain("VillainPhaseOverlay");

  const first = await hits(page);
  const villainRows = first.filter((h, i) => first.findIndex((o) => o.id === h.id) !== i);
  expect(villainRows.length, "a card shown in two rows is noted in both").toBeGreaterThan(0);
  if (SHOT) await page.screenshot({ path: `${SHOT}/villain-recap-hover-start-${info.project.name}.png` });

  // Each thumbnail on screen now, in turn. One cut off by the footer bar cannot be pressed either (its tap target is
  // only live wholly inside the steps region), so it is checked after scrolling it into view.
  const quiet: Hit[] = [];
  for (const hit of first) if (!(await hovers(page, hit))) quiet.push(hit);
  for (const row of villainRows)
    expect(await hovers(page, row), `the repeated ${row.id} hovers in every row`).toBe(true);

  // The first of the repeated villain's rows: the one that used to stay quiet.
  const top = first.find((h) => h.id === villainRows[0]!.id)!;
  expect(await hovers(page, top)).toBe(true);
  if (SHOT) await page.screenshot({ path: `${SHOT}/villain-recap-hover-first-row-${info.project.name}.png` });

  // Scroll each quiet one's own region down until it is wholly in view, then hover it where it now is.
  for (const hit of quiet) {
    let now: Hit | undefined = hit;
    for (let i = 0; i < 6 && now; i++) {
      await page.mouse.move(now.rect.x + now.rect.width / 2, now.rect.y + now.rect.height / 2);
      await page.mouse.wheel(0, 160);
      await page.waitForTimeout(150);
      now = (await hits(page)).find((h) => h.id === hit.id && Math.abs(h.rect.x - hit.rect.x) < 2);
    }
    expect(now, `${hit.id} is still in the recap after scrolling`).toBeTruthy();
    expect(await hovers(page, now!), `${hit.id} hovers once scrolled into view`).toBe(true);
  }

  // Scroll the attacks' column: its cards move up without a redraw, and each hovers where it now is.
  const second = first.filter((h) => h.id === top.id)[1]!;
  await page.mouse.move(second.rect.x + second.rect.width / 2, second.rect.y + second.rect.height / 2);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(300);
  const moved = (await hits(page)).filter((h) => h.id === top.id && Math.abs(h.rect.x - second.rect.x) < 2);
  const scrolled = moved.find((h) => h.rect.y < second.rect.y - 20 && h.rect.height >= second.rect.height - 1);
  expect(scrolled, "the villain's second row moved up with the scroll").toBeTruthy();
  expect(await hovers(page, scrolled!), "the scrolled row hovers where it now is").toBe(true);
  if (SHOT) await page.screenshot({ path: `${SHOT}/villain-recap-hover-scrolled-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
