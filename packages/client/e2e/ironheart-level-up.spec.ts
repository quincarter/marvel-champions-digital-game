import { expect, test } from "@playwright/test";
import { waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, facts, press } from "./x-men-helpers.js";

/**
 * Ironheart's Level Up! (29001a, an Action on her hero-form identity: remove 6 progress counters, ready her, swap to
 * Version 2) announces itself with the phase band across the table, "IRONHEART LEVELS UP! · VERSION 2 OF 3"
 * (it is not interactive). Setup is the store: her starter deck against Rhino, flipped to hero form, on the
 * main-thread engine (`LocalEngineHost`) so the page's own ability deps can be edited. Six progress counters take six
 * rounds of Child Prodigy, so the test drops the 6-counter cost from Level Up! (as `dev-which-ability-game.ts` lifts
 * Plumage's face conditions); the activation itself is real pointer input on her identity card.
 */

const boardTexts = async (page: import("@playwright/test").Page) =>
  (await visibleTexts(page)).filter((t) => t.scene === "Board");

test("Ironheart: Level Up! swaps to Version 2 and plays the level-up band", async ({ page }, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const { SessionStore } = (await import(/* @vite-ignore */ "/src/store/session-store.ts")) as any;
    const { LocalEngineHost } = (await import(/* @vite-ignore */ "/src/engine/local-host.ts")) as any;
    const { POOL_DEPS } = (await import(/* @vite-ignore */ "/src/content/pool.ts")) as any;
    const { nextTurn } = (await import(/* @vite-ignore */ "/src/store/dev-game-steps.ts")) as any;
    const level = POOL_DEPS.abilities["29001a.level-up"];
    delete level.cost;
    const store = new SessionStore(new LocalEngineHost());
    (appSession() as { store: unknown }).store = store;
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "ironheart-leadership" }],
      seed: 2901,
    });
    const turn = await nextTurn(store);
    const flip = turn?.legal.find((e: any) => e.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
    await nextTurn(store);
    const scenes = (window as any).__mcGame.scene;
    for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
    scenes.start("Board");
  });
  await boardUp(page);
  const identityCard = () => facts(page, (g) => g.instances[g.players[0].identity.instanceId].cardId as string);
  expect(await identityCard()).toBe("29001a");
  expect(await facts(page, (g) => g.players[0].identity.form)).toBe("hero");

  // Her identity card carries the Action as a button on the board.
  const levelUp = await waitFor(
    async () => (await boardTexts(page)).find((t) => /level up!?$/i.test(t.text.trim())) ?? null,
    "the Level Up! action on her identity",
    15000,
  );
  await press(page, phone, levelUp.x, levelUp.y);
  // The card opens Inspect, whose red button is the activation.
  const confirm = await waitFor(
    async () =>
      (await visibleTexts(page)).find((t) => t.scene === "InspectOverlay" && /level up!$/i.test(t.text.trim())) ?? null,
    "Inspect offers Level Up!",
    15000,
  );
  await press(page, phone, confirm.x, confirm.y);

  // The level-up moment is the phase band, read from its durable log rather than from pixels.
  const bandLog = () =>
    page.evaluate(() =>
      (
        window as unknown as { __mcBoardDebug: { phaseBandLog: () => { caption: string; played: boolean }[] } }
      ).__mcBoardDebug.phaseBandLog(),
    );
  const CAPTION = "IRONHEART LEVELS UP! · VERSION 2 OF 3";
  await waitFor(
    async () => ((await bandLog()).some((b) => b.caption === CAPTION) ? true : null),
    "the level-up band is queued",
    20000,
  );
  if (SHOT) await page.screenshot({ path: `${SHOT}/ironheart-level-up-${info.project.name}.png` });
  await waitFor(
    async () => ((await bandLog()).find((b) => b.caption === CAPTION)?.played ? true : null),
    "the level-up band has played",
    20000,
  );
  expect(await identityCard()).toBe("29002a");
});
