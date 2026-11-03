import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, facts, payWith, playFromHand, press } from "./x-men-helpers.js";

/**
 * Slingshot (50013, issue #634): "Action: Spend a [energy] resource → put Slingshot into play from your hand". A tap on
 * her used to play her for 3 and nothing else. On the desktop a tap now asks "Which one?" (Play it, or her Action);
 * on a phone the tap opens Inspect, which offers Play it beside the Action. Either way the Action pays one [energy]
 * from another card, never from Slingshot herself, and puts her into play. The staged game
 * (`store/dev-slingshot-game.ts`) is Maria Hill's first turn with Slingshot and Energy in hand.
 */

const texts = async (page: Page, scene = "Board"): Promise<string[]> =>
  (await visibleTexts(page)).filter((t) => t.scene === scene).map((t) => t.text);

test("Slingshot's hand Action is offered on a tap, pays with another card, and puts her into play", async ({
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
    const game = (await import(/* @vite-ignore */ "/src/store/dev-slingshot-game.ts")) as any;
    const store = new SessionStore(new LocalEngineHost());
    (appSession() as { store: unknown }).store = store;
    await game.startSlingshotDevGame(store);
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
  const sling = await facts(
    page,
    (game) => game.players[0].hand.find((id: string) => game.instances[id].cardId === "50013") as string,
  );
  const energy = await facts(
    page,
    (game) => game.players[0].hand.find((id: string) => game.instances[id].cardId === "50025") as string,
  );
  const trail = () => store((s) => s.commandTrail.length);
  const paying = async (): Promise<boolean> => (await texts(page)).some((t) => /^pay$/i.test(t));

  if (phone) {
    // The tap opens Inspect: Play it and the Action side by side.
    const rect = await page.evaluate((id) => (window as any).__mcBoardDebug.focusRect(`card:${id}`), sling);
    await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await waitFor(async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect opens");
    await settle(page, { quietMs: 300, maxMs: 1500 });
    const sheet = await texts(page, "InspectOverlay");
    expect(
      sheet.some((t) => /^play it$/i.test(t)),
      "Inspect still offers Play it",
    ).toBe(true);
    const action = (await visibleTexts(page)).find(
      (t) => t.scene === "InspectOverlay" && /slingshot — spend 1 energy/i.test(t.text),
    );
    expect(action, "Inspect offers her Action").toBeDefined();
    if (SHOT) await page.screenshot({ path: `${SHOT}/slingshot-${info.project.name}-inspect.png` });
    await press(page, true, action!.x, action!.y);
  } else {
    const asking = async (): Promise<boolean> =>
      (await texts(page)).some((t) => /^2 action · spend 1 energy$/i.test(t));
    await playFromHand(page, false, sling, asking);
    await settle(page, { quietMs: 400, maxMs: 3000 });
    expect((await texts(page)).some((t) => /^1 play it · costs 3$/i.test(t))).toBe(true);
    if (SHOT) await page.screenshot({ path: `${SHOT}/slingshot-${info.project.name}-ask.png` });
    // Cancel sends nothing and leaves her in hand.
    const before = await trail();
    const cancel = await waitFor(
      async () => (await visibleTexts(page)).find((t) => t.scene === "Board" && /^cancel$/i.test(t.text)) ?? null,
      "the Cancel button",
      10000,
    );
    await press(page, false, cancel.x, cancel.y);
    await waitFor(async () => ((await asking()) ? null : true), "the question closes", 10000);
    expect(await trail(), "Cancel sends nothing").toBe(before);
    // Ask again and pick her Action.
    await playFromHand(page, false, sling, asking);
    const pick = await waitFor(
      async () =>
        (await visibleTexts(page)).find((t) => t.scene === "Board" && /^2 action · spend 1 energy$/i.test(t.text)) ??
        null,
      "the Action option",
      10000,
    );
    await press(page, false, pick.x, pick.y);
  }

  await waitFor(async () => ((await paying()) ? true : null), "the Action's payment opens", 15000);
  const sources = await page.evaluate(() =>
    ((window as any).__mcBoardDebug.paymentView()?.sources ?? []).map((s: { instanceId: string }) => s.instanceId),
  );
  expect(sources, "Energy can pay").toContain(energy);
  expect(sources, "Slingshot never pays for her own Action").not.toContain(sling);
  if (SHOT) await page.screenshot({ path: `${SHOT}/slingshot-${info.project.name}-pay.png` });
  await payWith(page, phone, [energy]);
  await waitFor(
    async () => ((await store((s) => s.commandTrail.at(-1).command.type)) === "useAbility" ? true : null),
    "the Action goes out",
    15000,
  );
  const last = await store((s) => s.commandTrail.at(-1).command);
  expect(last).toMatchObject({ cardInstanceId: sling, abilityId: "50013.slingshot-action" });
  expect(last.payment).toEqual([{ fromHand: energy }]);
  // "Choose a player" to control her: the one seat comes already picked, so Confirm.
  await waitFor(
    async () =>
      (await visibleTexts(page)).find((t) => t.scene !== "Board" && /^maria hill \/ maria hill/i.test(t.text)) ?? null,
    "the choose-a-player question",
    15000,
  );
  const confirm = await waitFor(
    async () => (await visibleTexts(page)).find((t) => t.scene !== "Board" && /^confirm$/i.test(t.text)) ?? null,
    "Confirm",
    10000,
  );
  await press(page, phone, confirm.x, confirm.y);
  await waitFor(
    async () =>
      (await facts(page, (game) => game.players[0].playArea.slice() as string[])).includes(sling) ? true : null,
    "Slingshot is in play",
    20000,
  );
});
