import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, focusRect, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame, type Rect } from "./wave6-helpers-b.js";
import { SHOT, facts, press } from "./x-men-helpers.js";

/**
 * Issue #244: after Ant-Man changed from Scott Lang to his Giant form, the identity card on the table and its hover
 * popover still showed the Tiny form. The Giant scan (`12001c.png`) was a copy of the Tiny one; the guard against that
 * is `src/art/hero-form-art.test.ts`. This drives the flip itself and checks both pictures are the Giant scan.
 */

const GIANT = "art:bundles/cards/12001c.png";
const TINY = "art:bundles/cards/12001a.png";

/** The texture keys drawn now in the Board scene, its hover popover included. */
const boardTextures = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    interface Obj {
      texture?: { key?: string };
      list?: Obj[];
      visible?: boolean;
    }
    const game = (
      window as unknown as {
        __mcGame: { scene: { getScene(key: string): { children: { list: Obj[] } } | null } };
      }
    ).__mcGame;
    const keys: string[] = [];
    const walk = (o: Obj): void => {
      if (o.visible === false) return;
      if (o.texture?.key) keys.push(o.texture.key);
      for (const child of o.list ?? []) walk(child);
    };
    for (const child of game.scene.getScene("Board")?.children.list ?? []) walk(child);
    return keys;
  });

test("issue #244: Ant-Man's Giant form shows the Giant card, on the table and in the hover popover", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "the hover popover is a mouse's; the table tile is checked on desktop");
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["ant-leadership"], seed: 3 });
  await declineMulligans(page);
  await settle(page, { quietMs: 1000, maxMs: 6000 });
  expect(await facts(page, (g) => g.players[0].identity.form)).toBe("alterEgo");

  // Flip, and pick the Giant form from "Which form?".
  const flip = await waitFor(() => focusRect(page, "basic:changeForm"), "the flip control", 15_000);
  await press(page, false, flip.x + flip.width / 2, flip.y + flip.height / 2);
  const giant = await waitFor(
    async () => (await findText(page, "Giant", "Board"))[0] ?? null,
    "the Giant choice in Which form?",
    10_000,
  );
  await press(page, false, giant.x, giant.y);
  await waitFor(
    async () => ((await facts(page, (g) => g.players[0].identity.heroFormIndex)) === 1 ? true : null),
    "Ant-Man changes to his Giant form",
    15_000,
  );
  // The form's own response (Giant Nuisance) asks first, with the Giant card as its source; decline it for the table.
  const decline = await waitFor(
    async () => (await findText(page, "DECLINE", "ChoiceOverlay"))[0] ?? null,
    "Giant Nuisance's trigger question",
    15_000,
  );
  await settle(page, { quietMs: 800, maxMs: 4000 });
  if (SHOT) await page.screenshot({ path: `${SHOT}/ant-man-giant-response.png` });
  await press(page, false, decline.x, decline.y);
  await waitFor(
    async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? null : true),
    "the question closes",
    15_000,
  );
  await settle(page, { quietMs: 800, maxMs: 6000 });

  await waitFor(async () => ((await boardTextures(page)).includes(GIANT) ? true : null), "the Giant card", 15_000);
  expect(await boardTextures(page), "the Tiny card is gone from the table").not.toContain(TINY);
  if (SHOT) await page.screenshot({ path: `${SHOT}/ant-man-giant-table.png` });

  // The hover popover over the identity shows the Giant card too.
  const identity = await facts(page, (g) => g.players[0].identity.instanceId as string);
  const rect = await waitFor(
    () =>
      page.evaluate(
        (id) =>
          (window as unknown as { __mcBoardDebug?: { hitRect(id: string): Rect | null } }).__mcBoardDebug?.hitRect(
            id,
          ) ?? null,
        identity,
      ),
    "the identity tile",
    10_000,
  );
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.move(x + 4, y + 4, { steps: 4 });
  const shown = await waitFor(
    () =>
      page.evaluate(
        () =>
          (window as unknown as { __mcBoardDebug?: { hoverShown(): string | null } }).__mcBoardDebug?.hoverShown() ??
          null,
      ),
    "the identity's hover popover",
    10_000,
  );
  expect(shown).toContain(identity);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  expect(await boardTextures(page), "the popover shows the Giant card").not.toContain(TINY);
  if (SHOT) await page.screenshot({ path: `${SHOT}/ant-man-giant-hover.png` });
  expect(errors).toEqual([]);
});
