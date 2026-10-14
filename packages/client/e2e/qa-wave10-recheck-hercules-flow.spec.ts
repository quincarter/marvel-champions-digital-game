import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickFocus, clickText, handInstanceFor, pressAt, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { answerChoice, openApp, useIdentityAbility } from "./wave6-helpers-b.js";
import { SHOTS, endRound, startOnBoard } from "./qa-wave10-recheck-helpers.js";
import { facts, payWith, waitForBoardText } from "./x-men-helpers.js";

/**
 * Hercules played by hand (docs/qa-wave10-client.md section 5, "Labor cards ... not played"). The same staged game as the
 * "Try it" lesson (`guide/mechanic-tryit-config.ts`, seed 6002: Embody Pathos tops the Labor deck, Nemean Lion Skin the Gift
 * deck) but with the guide off and real pointer input for every step:
 * New Labors of Hercules (alter-ego action) -> Embody Pathos attaches to Bomb Scare -> flip -> thwart it to nothing -> the
 * Labor goes to the victory display -> Atonement puts the Gift into play -> The Gift of Battle's cost is reduced by one
 * per Gift card controlled, shown in the pay bar. Card text: `packages/content/src/data/hercules/cards.ts`.
 */

const BATTLE = "59009"; // cost 3, minus 1 per Gift card
const PAYER = "59024"; // "Avenge Me!": 1 [physical]
const PAYER_B = "59023"; // Recruitment Drive: [mental]

const gameFacts = {
  laborFinished: (g: any) =>
    g.victoryDisplay.some((id: string) => g.instances[id]?.cardId === "59003" || g.instances[id]?.cardId === "59002"),
  victory: (g: any) => (g.victoryDisplay as string[]).map((id) => g.instances[id]?.cardId as string),
  gifts: (g: any) =>
    Object.values(g.instances as Record<string, { cardId: string; attachedTo: string | null }>)
      .filter((i) => ["59005", "59006", "59007"].includes(i.cardId) && i.attachedTo !== null)
      .map((i) => i.cardId),
  threatOf: (g: any) =>
    Object.values(g.instances as Record<string, { cardId: string; threat?: number }>)
      .filter((i) => i.threat)
      .map((i) => `${i.cardId}:${i.threat}`),
};

/** Basic thwart: with two schemes in play the board asks for the target; the preview line names it, tap that card. */
async function thwartBombScare(page: Page): Promise<void> {
  await clickFocus(page, "basic:thwart");
  // Round 1: Embody Pathos is the only legal target (no prompt). Round 2: the main scheme is a legal target too.
  const hit = await waitFor(
    async () => (await visibleTexts(page)).find((t) => t.text === "Bomb Scare" && t.y > 250 && t.y < 400) ?? null,
    "the thwart target preview",
    3000,
  ).catch(() => null);
  if (hit) await pressAt(page, hit.x + 40, hit.y - 100);
  await settle(page, { quietMs: 500, maxMs: 4000 });
}

async function start(page: Page): Promise<void> {
  await startOnBoard(page, {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "hercules-leadership" }],
    seed: 6002,
    stack: {
      players: { 0: ["59009", "59011", "59024", "59024", "59024", "59023", "59023", "59023"] },
      encounter: ["01098", "01186"],
    },
  });
}

test("Hercules: a Labor revealed, finished, earns a Gift that cuts The Gift of Battle's cost in the pay bar", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await installWave6Helpers(page);
  await openApp(page);
  await start(page);

  // Alter ego: New Labors of Hercules reveals the Labor; Embody Pathos asks which side scheme it attaches to.
  await useIdentityAbility(page, "New Labors of Hercules");
  await answerChoice(page, 1);
  await settle(page, { quietMs: 600, maxMs: 4000 });
  const threatBefore = await facts(page, gameFacts.threatOf);
  expect(threatBefore.join(" "), "Bomb Scare is in play with the Labor on it").toMatch(/01109/);
  await page.screenshot({ path: `${SHOTS}/wave10-recheck-hercules-labor.png` });

  // The same action is now refused, and says why (Labor in play).
  await waitForBoardText(page, /Can't use: a Labor card is in play/i, "the refusal reason");

  // Flip to hero form (Atonement is printed on the hero side) and thwart until the Labor is gone.
  await clickFocus(page, "basic:changeForm");
  await settle(page, { quietMs: 400, maxMs: 3000 });
  await thwartBombScare(page);
  expect(await facts(page, gameFacts.laborFinished), "one thwart is not enough: Bomb Scare holds 6").toBe(false);
  // Wisdom of Athena (cost 3, remove 4 threat): paid with three Avenge Me!, finishes the Labor.
  const wisdom = (await handInstanceFor(page, "59011"))!;
  await clickFocus(page, `card:${wisdom}`);
  await waitForBoardText(page, /^PAYING 0 \/ 3$/i, "Wisdom of Athena costs 3 with no Gift");
  const handNow = await facts(page, (g) => g.players[0].hand as string[]);
  const codes = await facts(page, (g) =>
    Object.fromEntries(
      Object.entries(g.instances as Record<string, { cardId: string }>).map(([k, v]) => [k, v.cardId]),
    ),
  );
  await payWith(
    page,
    false,
    handNow.filter((id) => codes[id] === PAYER),
  );
  if ((await activeScenes(page)).includes("ChoiceOverlay")) await answerChoice(page, 0);
  await settle(page, { quietMs: 500, maxMs: 4000 });
  // 9 threat - 3 (his thwart) - 4 = 2 left: it takes a second turn, as the lesson says.
  expect(await facts(page, gameFacts.laborFinished)).toBe(false);
  await endRound(page);
  await thwartBombScare(page);
  if (!(await facts(page, gameFacts.laborFinished))) {
    throw new Error(
      `Labor not finished: victory ${await facts(page, (g) => JSON.stringify(g.victoryDisplay))}, threat ${await facts(page, gameFacts.threatOf)}`,
    );
  }
  // Atonement (response): accept, then decline the flip.
  for (let i = 0; i < 4 && (await activeScenes(page)).includes("ChoiceOverlay"); i++) {
    const stay = (await visibleTexts(page)).find((t) => t.scene === "ChoiceOverlay" && /do not flip/i.test(t.text));
    if (stay) {
      await clickText(page, stay.text, { sceneKey: "ChoiceOverlay" });
      await settle(page);
      if ((await activeScenes(page)).includes("ChoiceOverlay"))
        await clickText(page, "Confirm", { sceneKey: "ChoiceOverlay" });
      await settle(page);
    } else {
      await answerChoice(page, 0);
    }
  }
  await settle(page, { quietMs: 600, maxMs: 4000 });
  await page.screenshot({ path: `${SHOTS}/wave10-recheck-hercules-atonement.png` });
  expect(await facts(page, gameFacts.gifts), "Atonement put a Gift card into play").toEqual(["59005"]);

  // Hand fully drawn by Nemean Lion Skin (draw 4). The Gift of Battle: cost 3, one Gift controlled: the pay bar says 2.
  const battle = (await handInstanceFor(page, BATTLE))!;
  expect(battle).not.toBeNull();
  await clickFocus(page, `card:${battle}`);
  await waitForBoardText(page, /^PAYING 0 \/ 2$/i, "the cost is 3 less 1 Gift");
  const hand = await facts(page, (g) => g.players[0].hand as string[]);
  const instances = await facts(page, (g) =>
    Object.fromEntries(
      Object.entries(g.instances as Record<string, { cardId: string }>).map(([k, v]) => [k, v.cardId]),
    ),
  );
  const payers = hand.filter((id) => [PAYER, PAYER_B].includes(instances[id]!)).slice(0, 2);
  expect(payers.length, "two payers still in hand").toBe(2);
  await payWith(page, false, payers);
  await answerChoice(page, 0); // Rhino takes 5 damage
  await settle(page);
  expect(await facts(page, (g) => g.players[0].discard.length), "paid, played and discarded").toBeGreaterThanOrEqual(3);
  expect((await visibleTexts(page)).some((t) => /undefined|NaN|\[object/.test(t.text))).toBe(false);
});
