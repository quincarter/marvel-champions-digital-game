import { expect, test, type Page } from "@playwright/test";
import { clickFocus, handInstanceFor, settle } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { boardUp, facts, payWith, playFromHand, press, pressCard } from "./x-men-helpers.js";

/**
 * RRG 1.8 "Assault" (p. 8): a basic thwart against a scheme with assault uses ATK. With Keep Them Busy (43018, assault)
 * and a normal side scheme (Crowd Control 01108; the crisis icon keeps the main scheme off the list) both there to thwart, She-Hulk (ATK and THW differ) must be told so before the player picks:
 * the targeting panel's source line reads "Thwart 1 · ATK 3 vs assault", each scheme's tile says how much threat will come
 * off, and the threat that does come off is the ATK number. The fixture is `store/dev-assault-game.ts`.
 */

const SHOTS = process.env.E2E_SHOTS ?? "";
const KEEP_THEM_BUSY = "43018";

const shot = async (page: Page, name: string): Promise<void> => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

const boardTexts = async (page: Page): Promise<string[]> =>
  (await visibleTexts(page)).filter((t) => t.scene === "Board").map((t) => t.text.trim());

test("a thwart with an assault side scheme and a normal side scheme both in play previews both numbers and removes ATK", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: unknown };
    };
    const mod = (await import(/* @vite-ignore */ "/src/store/dev-assault-game.ts")) as unknown as {
      startAssaultSchemeGame: (store: unknown) => Promise<void>;
    };
    await mod.startAssaultSchemeGame(appSession().store);
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
  const cont = (await visibleTexts(page)).find(
    (t) => t.scene === "VillainPhaseOverlay" && /^continue$/i.test(t.text.trim()),
  );
  if (cont) await press(page, phone, cont.x, cont.y);
  await settle(page, { quietMs: 600, maxMs: 3000 });

  // Play Keep Them Busy from the hand, paying its one resource with another hand card.
  const card = (await handInstanceFor(page, KEEP_THEM_BUSY))!;
  expect(card, "Keep Them Busy is in hand").not.toBeNull();
  const hand = await facts(page, (g) => g.players[0].hand.slice() as string[]);
  await playFromHand(page, phone, card, async () => (await boardTexts(page)).some((t) => /^(play it|pay)$/i.test(t)));
  if ((await boardTexts(page)).some((t) => /^pay$/i.test(t))) {
    await payWith(page, phone, hand.filter((id) => id !== card).slice(0, 1));
  } else {
    const go = (await visibleTexts(page)).find((t) => t.scene === "Board" && /^play it$/i.test(t.text.trim()))!;
    await press(page, phone, go.x, go.y);
  }
  await settle(page, { quietMs: 600, maxMs: 4000 });

  const read = await facts(page, (g) => {
    const found = Object.entries<any>(g.instances).find(([, i]) => i.cardId === "43018");
    const normal = Object.entries<any>(g.instances).find(([, i]) => i.cardId === "01108");
    return {
      scheme: found ? (found[0] as string) : null,
      schemeThreat: found ? (found[1].threat as number) : -1,
      normal: normal ? (normal[0] as string) : null,
      normalThreat: normal ? (normal[1].threat as number) : -1,
    };
  });
  expect(read.scheme, "Keep Them Busy is in play").not.toBeNull();
  expect(read.normal, "a normal side scheme is also there to thwart").not.toBeNull();

  await clickFocus(page, "basic:thwart");
  await settle(page, { quietMs: 500, maxMs: 3000 });
  const texts = (await visibleTexts(page)).map((t) => t.text.trim());
  const line = texts.find((t) => /thwart/i.test(t) && /vs assault/i.test(t));
  expect(line, `the source line names both numbers (saw ${JSON.stringify(texts.slice(0, 60))})`).toMatch(
    /Thwart \d+ · ATK \d+ vs assault/,
  );
  const atk = Number(/ATK (\d+)/.exec(line!)![1]);
  const thw = Number(/Thwart (\d+)/.exec(line!)![1]);
  expect(atk).not.toBe(thw);
  // Each scheme's tile says what comes off: the normal one the THW number, the assault one the ATK number.
  expect(texts, "the normal scheme's tile reads THW").toContain(
    `${read.normalThreat} threat → ${read.normalThreat - thw} threat`,
  );
  expect(texts, "the assault scheme's tile reads ATK").toContain(
    atk >= read.schemeThreat ? "Cleared." : `${read.schemeThreat} threat → ${read.schemeThreat - atk} threat`,
  );
  await shot(page, `assault-targets-${phone ? "390" : "1440"}`);

  await pressCard(page, phone, read.scheme!);
  await settle(page, { quietMs: 800, maxMs: 4000 });
  const after = await facts(page, (g) => {
    const scheme = Object.values<any>(g.instances).find((i) => i.cardId === "43018");
    return scheme ? (scheme.threat as number | null) : null;
  });
  expect(read.schemeThreat - (after ?? 0), "the threat removed is the ATK number").toBe(
    Math.min(atk, read.schemeThreat),
  );
  await shot(page, `assault-thwarted-${phone ? "390" : "1440"}`);
});
