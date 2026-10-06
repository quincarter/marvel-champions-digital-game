import { expect, test, type Page } from "@playwright/test";
import { handInstanceFor, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { boardUp, facts, payWith, playFromHand, press } from "./x-men-helpers.js";

/**
 * Which of Deadpool's unusual wave 7 cards a human can finish on the real board with pointer input (audit,
 * docs/phase7-wave7-qa-deadpool-board.md). Each game is a replay-safe fixture (`store/dev-qa-deadpool-game.ts`): a real
 * game played forward to Deadpool on his own turn with the card in hand (Merc: in play). The tests play the card, answer
 * every prompt the way a player would, and read the outcome from the engine state against the card's script tests in
 * packages/cards/src/wave7/deadpool/. `test.fixme` pins a step the board cannot do today.
 */

const SHOTS = process.env.E2E_SHOTS ?? "";

/** `wonBefore`: the player's profile already holds a finished win (a stored game marked won) when the game starts. */
const launch = async (page: Page, which: string, wonBefore = false): Promise<void> => {
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(
    async ({ w, won }) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as {
        appSession: () => {
          store: { start: (c: unknown) => Promise<void>; listSaves: () => Promise<{ id: string }[]> };
        };
      };
      if (won) {
        const { IdbGameStorage } = (await import(/* @vite-ignore */ "/src/engine/idb-game-storage.ts")) as unknown as {
          IdbGameStorage: new () => { setStatus: (id: string, status: string) => Promise<void> };
        };
        await appSession().store.start({
          scenarioId: "rhino",
          difficulty: "standard",
          players: [{ starterDeckId: "core-spider-man-justice" }],
          seed: 1,
        });
        const earlier = (await appSession().store.listSaves())[0]!;
        await new IdbGameStorage().setStatus(earlier.id, "won");
      }
      const mod = (await import(/* @vite-ignore */ "/src/store/dev-qa-deadpool-game.ts")) as unknown as {
        startDeadpoolQaGame: (store: unknown, which: string) => Promise<void>;
      };
      await mod.startDeadpoolQaGame(appSession().store, w);
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
    },
    { w: which, won: wonBefore },
  );
  await boardUp(page);
};

const pending = (page: Page) =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: any } };
    };
    const g = appSession().store.state.game;
    const c = g?.pendingChoice;
    return c
      ? {
          prompt: c.prompt,
          title: c.title,
          min: c.minSelections,
          max: c.maxSelections,
          options: c.options.map((o: any) => [o.optionId, o.label]),
        }
      : null;
  });

const inHand = (page: Page, id: string): Promise<boolean> =>
  page.evaluate(async (i) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: any } };
    };
    return appSession().store.state.game.players[0].hand.includes(i);
  }, id);

const boardHas = async (page: Page, re: RegExp): Promise<boolean> =>
  (await visibleTexts(page)).some((t) => t.scene === "Board" && re.test(t.text.trim()));

const sheet = async (page: Page) => {
  const texts = (await visibleTexts(page)).filter((t) => t.scene === "ChoiceOverlay").map((t) => t.text);
  const keys = await page.evaluate(() => ((window as any).__mcChoiceDebug?.allRects() ?? []).map(([k]: [string]) => k));
  return { texts, keys };
};

const choiceRect = (page: Page, key: string) =>
  page.evaluate((k) => {
    const found = ((window as any).__mcChoiceDebug?.allRects() ?? []).find(([key]: [string]) => key === k);
    return (found?.[1] as { x: number; y: number; width: number; height: number } | undefined) ?? null;
  }, key);

const pressChoice = async (page: Page, key: string): Promise<void> => {
  const rect = await waitFor(() => choiceRect(page, key), `the sheet's "${key}" control`, 10000);
  await press(page, false, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 300, maxMs: 1500 });
};

/**
 * Picks `key` on the open sheet and presses Confirm, the way a player does. A press the sheet lost while its cards were
 * still fading in is repeated (the choice is read back from the engine, never assumed to have gone through).
 */
const answer = async (page: Page, key?: string): Promise<void> => {
  const before = JSON.stringify(await pending(page));
  for (let attempt = 0; attempt < 4; attempt++) {
    await settle(page, { quietMs: 500, maxMs: 2500 });
    const target =
      key ?? ((await pending(page))?.options[0]?.[0] ? `option:${(await pending(page))!.options[0][0]}` : null);
    if (target) await pressChoice(page, target);
    await pressChoice(page, "confirm");
    await settle(page, { quietMs: 400, maxMs: 2000 });
    if (JSON.stringify(await pending(page)) !== before) return;
  }
  throw new Error(`the sheet did not take the answer ${key ?? "(first option)"}`);
};

/** The open choice sheet's title, read from the engine's own pending choice (prompt kind and option labels). */
const asks = async (page: Page, kind: string): Promise<{ title: string; options: string[] }> => {
  const found = await waitFor(
    async () => {
      const p = await pending(page);
      return p && p.prompt.kind === kind ? p : null;
    },
    `a ${kind} choice`,
    15000,
  );
  await settle(page, { quietMs: 300, maxMs: 1500 });
  const title = (await sheet(page)).texts.find((t) => /:/.test(t) && !/^(SELECT|TAP)/.test(t) && t.length < 80) ?? "";
  return { title, options: found.options.map(([, label]: [string, string]) => label) };
};

const shot = async (page: Page, name: string): Promise<void> => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

const boardPress = async (page: Page, re: RegExp, scene = "Board", minY = 0): Promise<void> => {
  const t = await waitFor(
    async () =>
      (await visibleTexts(page)).find((x) => x.scene === scene && re.test(x.text.trim()) && x.y >= minY) ?? null,
    `text ${re}`,
    10000,
  );
  await press(page, false, t.x, t.y);
  await settle(page, { quietMs: 500, maxMs: 3000 });
};

/** Clears the villain phase recap that opens a game stopped after a villain phase. */
const dismissRecap = async (page: Page): Promise<void> => {
  const cont = (await visibleTexts(page)).find(
    (t) => t.scene === "VillainPhaseOverlay" && /^continue$/i.test(t.text.trim()),
  );
  if (!cont) return;
  await press(page, false, cont.x, cont.y);
  await settle(page, { quietMs: 600, maxMs: 3000 });
};

const handOf = (page: Page, seat = 0): Promise<string[]> =>
  page.evaluate(async (n) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: any } };
    };
    return appSession().store.state.game.players[n].hand.slice() as string[];
  }, seat);

/** Plays a hand card: a click, then the free "Play it" bar or a payment from `pay` other hand cards. */
const playCard = async (page: Page, code: string, pay: number): Promise<string> => {
  const card = (await handInstanceFor(page, code))!;
  expect(card, `${code} is in hand`).not.toBeNull();
  const hand = await handOf(page);
  const asked = async (): Promise<boolean> =>
    (await pending(page)) !== null || (await boardHas(page, /^(play it|pay)$/i)) || !(await inHand(page, card));
  await playFromHand(page, false, card, asked);
  if (await boardHas(page, /^play it$/i)) await boardPress(page, /^play it$/i);
  else if (await boardHas(page, /^pay$/i)) await payWith(page, false, hand.filter((id) => id !== card).slice(0, pay));
  await settle(page, { quietMs: 600, maxMs: 4000 });
  return card;
};

/** Opens a card in play (the tile's "USE" or "EXHAUST") and presses its ability button in Inspect. */
const useInPlay = async (page: Page, button: RegExp): Promise<void> => {
  await boardPress(page, /^▶ (use|exhaust)$/i);
  await boardPress(page, button, "InspectOverlay", 600);
};

const stateOf = <T>(page: Page, read: (game: any) => T): Promise<T> => facts(page, read);

const instanceOfCode = (page: Page, code: string): Promise<any> =>
  page.evaluate(async (c) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: any } };
    };
    const game = appSession().store.state.game;
    const entry = Object.entries<any>(game.instances).find(([, i]) => i.cardId === c);
    return entry ? { id: entry[0], ...entry[1] } : null;
  }, code);

test("Blackout (44053): pick a scheme, a resource type and the resource card; the threat moves onto the card", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await launch(page, "blackout");
  const before = await stateOf(page, (g) => Object.values<any>(g.instances).reduce((n, i) => n + (i.threat ?? 0), 0));
  await playCard(page, "44053", 0);
  await useInPlay(page, /^blackout$/i);
  const target = await asks(page, "chooseTarget");
  expect(target.title).toMatch(/choose a target/i);
  expect(target.options, "both schemes are offered by name").toEqual(["The Break-In!", "Involuntary Procedures"]);
  await shot(page, "blackout-prompt");
  await answer(page);
  const type = await asks(page, "chooseOption");
  expect(type.options.every((o) => /^Spend an \[(energy|mental|physical)\] resource$/.test(o))).toBe(true);
  await answer(page, "option:0");
  await asks(page, "spendResources");
  await shot(page, "blackout-spend");
  await answer(page);
  await waitFor(async () => ((await pending(page)) === null ? true : null), "the game continues", 15000);
  await shot(page, "blackout-done");
  const blackout = await instanceOfCode(page, "44053");
  expect(blackout.counters.energy, "one energy space is filled").toBe(1);
  const after = await stateOf(page, (g) => Object.values<any>(g.instances).reduce((n, i) => n + (i.threat ?? 0), 0));
  expect(after, "one threat left the scheme").toBe(before - 1);
});

test("Tic-Tac-Toe (44057): pick a damaged character, a resource type, the resource card and a column; the damage moves onto the card", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await launch(page, "ticTacToe");
  const dmg = (page: Page) => stateOf(page, (g) => g.instances[g.players[0].identity.instanceId].damage as number);
  const before = await dmg(page);
  expect(before, "Deadpool is damaged").toBeGreaterThan(0);
  await playCard(page, "44057", 0);
  await useInPlay(page, /^tic-tac-toe$/i);
  const source = await asks(page, "chooseTarget");
  expect(source.options).toEqual(["Deadpool"]);
  await shot(page, "tic-tac-toe-prompt");
  await answer(page);
  const type = await asks(page, "chooseOption");
  expect(type.options.every((o) => /^Spend an \[(energy|mental|physical)\] resource$/.test(o))).toBe(true);
  await answer(page, "option:0");
  await asks(page, "spendResources");
  await answer(page);
  const column = await asks(page, "chooseOption");
  expect(column.options, "the space is a column of the resource's row").toEqual(["Column 1", "Column 2", "Column 3"]);
  await shot(page, "tic-tac-toe-column");
  await answer(page, "option:0");
  await waitFor(async () => ((await pending(page)) === null ? true : null), "the game continues", 15000);
  await shot(page, "tic-tac-toe-done");
  expect(await dmg(page), "one damage was healed").toBe(before - 1);
  expect((await instanceOfCode(page, "44057")).counters["r1c1"]).toBe(1);
});

test("Rock, Paper, Scissors (44056): the hand card is picked up front on the board, then the top card is discarded and compared", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await launch(page, "rockPaperScissors");
  await playCard(page, "44056", 1);
  await useInPlay(page, /^rock.*scissors . exhaust$/i);
  await waitFor(
    async () => ((await boardHas(page, /choose a target for rock, paper, scissors/i)) ? true : null),
    "the board's target picker for the hand card",
    10000,
  );
  await shot(page, "rock-paper-scissors-prompt");
  const deckBefore = await stateOf(page, (g) => g.players[0].deck.length as number);
  const handBefore = await handOf(page);
  const pick = (await visibleTexts(page)).find(
    (t) => t.scene === "Board" && /^healing factor$/i.test(t.text.trim()) && t.y > 250,
  )!;
  await press(page, false, pick.x, pick.y);
  await settle(page, { quietMs: 600, maxMs: 4000 });
  await shot(page, "rock-paper-scissors-done");
  expect(await stateOf(page, (g) => g.players[0].deck.length as number), "the top card left the deck").toBe(
    deckBefore - 1,
  );
  expect((await instanceOfCode(page, "44056")).exhausted, "the upgrade is exhausted").toBe(true);
  expect(await handOf(page), "the picked card stays in hand; the discarded card joins it only if it lost").toEqual(
    expect.arrayContaining(handBefore),
  );
});

test("Armed to the Teeth (44009): the collection search lists WEAPON upgrades by name and the pick attaches facedown", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await launch(page, "armedToTheTeeth");
  await playCard(page, "44009", 2);
  await waitFor(
    async () => ((await pending(page))?.prompt.kind === "chooseTriggers" ? true : null),
    "the response",
    15000,
  );
  await answer(page);
  const search = await asks(page, "searchCollection");
  expect(search.title).toMatch(/search your collection/i);
  expect(search.options).toContain("Laser Swords");
  await shot(page, "armed-to-the-teeth-search");
  await answer(page, "option:44055");
  await waitFor(async () => ((await pending(page)) === null ? true : null), "the game continues", 15000);
  await shot(page, "armed-to-the-teeth-done");
  const armed = await instanceOfCode(page, "44009");
  const attached = await stateOf(page, (g) =>
    Object.values<any>(g.instances)
      .filter((i) => i.cardId === "44055")
      .map((i) => i.faceup as boolean),
  );
  expect(armed.attachments.length, "a card is attached to Armed to the Teeth").toBe(1);
  expect(attached, "Laser Swords is there, facedown").toEqual([false]);
});

test("The Merc with the Mouth (44032): the end of the player phase asks 'did you talk?' as a Yes / No sheet; No discards it", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await launch(page, "merc");
  await dismissRecap(page);
  expect(await instanceOfCode(page, "44032"), "the obligation is in Deadpool's play area").not.toBeNull();
  await boardPress(page, /^end turn$/i);
  const confirm = (await visibleTexts(page)).find((t) => t.scene !== "Board" && /^end turn$/i.test(t.text.trim()));
  if (confirm) {
    await press(page, false, confirm.x, confirm.y);
    await settle(page, { quietMs: 600, maxMs: 3000 });
  }
  // The hand limit comes first (6 cards): keep them all.
  if ((await pending(page))?.prompt.kind === "discardDownToHandSize") await pressChoice(page, "decline");
  const talked = await asks(page, "reportFact");
  expect(talked.title).toMatch(/did you talk this phase\?/i);
  expect(talked.options).toEqual(["Yes", "No"]);
  await shot(page, "merc-talked");
  await answer(page, "option:no");
  await waitFor(async () => ((await pending(page)) === null ? true : null), "the game continues", 15000);
  await shot(page, "merc-done");
  const inPlay = await stateOf(page, (g) =>
    g.players[0].playArea.some((id: string) => g.instances[id].cardId === "44032"),
  );
  expect(inPlay, "answering No discards the obligation").toBe(false);
});

test("Plot Convenience (44050): the player who owns it attaches an aspect card from hand facedown", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await launch(page, "plotConvenience");
  await dismissRecap(page);
  await playCard(page, "44050", 2);
  await useInPlay(page, /^plot convenience/i);
  const pick = await asks(page, "chooseCards");
  expect(pick.options.length, "an aspect card from the hand").toBeGreaterThan(0);
  await shot(page, "plot-convenience-attach");
  await answer(page);
  await waitFor(async () => ((await pending(page)) === null ? true : null), "the game continues", 15000);
  await shot(page, "plot-convenience-done");
  const plot = await instanceOfCode(page, "44050");
  expect(plot.attachments.length, "one card is under Plot Convenience").toBe(1);
});

// "Any player may trigger this ability" (Plot Convenience's printed text; script `triggerableBy: eachPlayer`; engine
// test precon-e2e.test.ts "Plot Convenience across two players"). On Spider-Man's turn the board shows Deadpool as a
// summary row; the card the engine lists for Spider-Man is a chip on that row ("view/other-seat-abilities.ts"), which
// opens in Inspect like any card. The fixture gives Spider-Man a Justice ally (Daredevil) to attach.
test("Plot Convenience (44050): another player triggers it from their own turn", async ({ page }) => {
  test.setTimeout(240_000);
  await launch(page, "plotConvenience");
  await dismissRecap(page);
  await playCard(page, "44050", 2);
  await boardPress(page, /^end turn$/i);
  const confirm = (await visibleTexts(page)).find((t) => t.scene !== "Board" && /^end turn$/i.test(t.text.trim()));
  if (confirm) await press(page, false, confirm.x, confirm.y);
  await settle(page, { quietMs: 800, maxMs: 4000 });
  await dismissRecap(page);
  const phone = page.viewportSize()!.width < 600;
  if (phone) await boardPress(page, /^team$/i);
  await shot(page, "plot-convenience-chip");
  // Spider-Man's turn: Deadpool's Plot Convenience is a chip on his row, and tapping it opens the card.
  await boardPress(page, /^▶ plot convenience$/i);
  await boardPress(page, /^plot convenience/i, "InspectOverlay", 600);
  for (let step = 0; step < 4 && (await pending(page)) === null; step++)
    await settle(page, { quietMs: 400, maxMs: 1500 });
  for (let step = 0; step < 3 && (await pending(page)) !== null; step++) {
    const open = (await pending(page))!;
    expect(["chooseOne", "chooseCards"]).toContain(open.prompt.kind);
    await shot(page, `plot-convenience-spider-${step}`);
    await answer(page);
  }
  await waitFor(async () => ((await pending(page)) === null ? true : null), "the game continues", 15000);
  const plot = await instanceOfCode(page, "44050");
  expect(plot.attachments.length, "one card is under Plot Convenience").toBe(1);
  const under = await stateOf(page, (g) => {
    const attached =
      g.instances[Object.entries<any>(g.instances).find(([, i]) => i.cardId === "44050")![0]].attachments[0];
    return {
      code: g.instances[attached].cardId,
      faceup: g.instances[attached].faceup,
      owner: g.players.findIndex((pl: any) => pl.playerId === g.instances[attached].ownerId),
      inSpiderHand: g.players[1].hand.includes(attached),
    };
  });
  expect(under, "Spider-Man's Daredevil sits facedown under it, out of his hand").toEqual({
    code: "01058",
    faceup: false,
    owner: 1,
    inSpiderHand: false,
  });
});

test("Git Gud (44028): with no previous-game fact it costs 2 less (free), and the board offers no way to say the player won", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await launch(page, "gitGud");
  const card = (await handInstanceFor(page, "44028"))!;
  await playFromHand(
    page,
    false,
    card,
    async () => (await boardHas(page, /^play it$/i)) || (await boardHas(page, /^pay$/i)),
  );
  await shot(page, "git-gud-prompt");
  expect(await boardHas(page, /^2→0$/), "the hand card shows 2 → 0").toBe(true);
  await boardPress(page, /^play it$/i);
  expect(await inHand(page, card), "Git Gud is played for free").toBe(false);
});

// Git Gud: "If you did not win your previous game of Marvel Champions, this costs 2 less" (script: `not(outsideFact
// ("wonPreviousGame"))`; spec Q48: the seat's profile history is snapshotted into `PlayerSetup.outsideFacts` at setup).
// The player's profile holds a finished win (a stored game marked won), then the staged game starts.
test("Git Gud (44028): a player whose previous game was a win pays the full 2", async ({ page }) => {
  test.setTimeout(240_000);
  await launch(page, "gitGud", true);
  const seatWon = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: any } };
    };
    return appSession().store.state.game.players[0].outsideFacts?.wonPreviousGame ?? null;
  });
  expect(seatWon, "setup snapshots the seat's profile history into outsideFacts").toBe(true);
  const card = (await handInstanceFor(page, "44028"))!;
  await playFromHand(
    page,
    false,
    card,
    async () => (await boardHas(page, /^play it$/i)) || (await boardHas(page, /^pay$/i)),
  );
  await shot(page, "git-gud-won-prompt");
  expect(await boardHas(page, /^pay$/i), "the full 2 must be paid").toBe(true);
  expect(await boardHas(page, /^2→0$/), "no 2 → 0 reduction after a win").toBe(false);
});
