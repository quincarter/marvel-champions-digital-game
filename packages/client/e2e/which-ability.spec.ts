import { expect, test, type Page } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, facts, payWith, playFromHand, press } from "./x-men-helpers.js";

/**
 * A played event with two usable Action abilities asks which one before any payment (RRG 1.8 "Event", p. 18).
 * No real card has two usable at once, so the staged game (`store/dev-which-ability-game.ts`) runs the engine on the
 * main thread and lifts Adaptive Plumage's two face conditions. Cancel returns the card with nothing spent; picking
 * "If you are Archangel" opens that ability's payment and the command goes out naming it.
 */

const texts = async (page: Page): Promise<string[]> =>
  (await visibleTexts(page)).filter((t) => t.scene === "Board").map((t) => t.text);

test("a two-ability event asks which one; Cancel spends nothing; the pick is sent as abilityId", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const { SessionStore } = (await import(/* @vite-ignore */ "/src/store/session-store.ts")) as any;
    const { LocalEngineHost } = (await import(/* @vite-ignore */ "/src/engine/local-host.ts")) as any;
    const game = (await import(/* @vite-ignore */ "/src/store/dev-which-ability-game.ts")) as any;
    game.unscopeAdaptivePlumage();
    const store = new SessionStore(new LocalEngineHost());
    (appSession() as { store: unknown }).store = store;
    await game.startWhichAbilityDevGame(store);
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
  await boardUp(page);

  const store = <T>(read: (s: any) => T): Promise<T> =>
    page.evaluate(async (source) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
      return new Function("s", `return (${source})(s)`)(appSession().store.state);
    }, read.toString()) as Promise<T>;

  const card = await facts(
    page,
    (game) => game.players[0].hand.find((id: string) => game.instances[id].cardId === "42003") as string,
  );
  const hand = await facts(page, (game) => game.players[0].hand.slice() as string[]);
  const filler = hand.filter((id) => id !== card).slice(0, 3);
  const trail = () => store((s) => s.commandTrail.length);
  const asking = async (): Promise<boolean> => (await texts(page)).some((t) => /^2 if you are archangel$/i.test(t));

  // Open the question, then back out of it.
  await playFromHand(page, phone, card, asking);
  await settle(page, { quietMs: 400, maxMs: 3000 });
  expect((await texts(page)).some((t) => /^1 if you are angel$/i.test(t))).toBe(true);
  if (SHOT) await page.screenshot({ path: `${SHOT}/which-ability-${info.project.name}-ask.png` });
  const commandsBefore = await trail();
  const cancel = await waitFor(
    async () => (await visibleTexts(page)).find((t) => t.scene === "Board" && /^cancel$/i.test(t.text)) ?? null,
    "the Cancel button",
    10000,
  );
  await press(page, phone, cancel.x, cancel.y);
  await waitFor(async () => ((await asking()) ? null : true), "the question closes", 10000);
  expect(await trail(), "Cancel sends nothing").toBe(commandsBefore);
  expect(await facts(page, (game) => game.players[0].hand.length)).toBe(hand.length);

  // Ask again and pick the second ability.
  await playFromHand(page, phone, card, asking);
  const pick = await waitFor(
    async () =>
      (await visibleTexts(page)).find((t) => t.scene === "Board" && /^2 if you are archangel$/i.test(t.text)) ?? null,
    "the Archangel option",
    10000,
  );
  await press(page, phone, pick.x, pick.y);
  await waitFor(
    async () => ((await texts(page)).some((t) => /^pay$/i.test(t)) ? true : null),
    "its payment opens",
    10000,
  );
  if (SHOT) await page.screenshot({ path: `${SHOT}/which-ability-${info.project.name}-pay.png` });
  await payWith(page, phone, filler);
  await waitFor(
    async () => ((await store((s) => s.commandTrail.at(-1).command.type)) === "playCard" ? true : null),
    "the play goes out",
    15000,
  );
  const last = await store((s) => s.commandTrail.at(-1).command);
  expect(last.cardInstanceId).toBe(card);
  expect(last.abilityId, "the command names the ability picked").toBe("42003.adaptive-plumage-hero-action");
});
