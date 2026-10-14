import { expect, test, type Page } from "@playwright/test";
import {
  clickText,
  findText,
  hasText,
  installPageHelpers,
  isSceneUp,
  pressKey,
  settle,
  trackPageErrors,
  waitForText,
} from "./helpers.js";

/**
 * Enchantress (Trickster Takeover): the three mechanics the board learned with it, on `?screen=board&fixture=enchantress`
 * (a real game stopped at round 3's turn with a Kiss of Temptation owed, `store/dev-enchantress-game.ts`):
 *
 * - a Hypnotic Gaze's reverse side is hidden: Inspect says so, and nothing the page holds names a Trance until it flips;
 * - a Forced Action owed is marked on its card, End Turn is refused with the card named, using it clears it, and the
 *   Trance that flips in is owed again each round;
 * - the Crown's each-player cost reads in words, and Seduced's refusal names it.
 */
type Store = {
  state: unknown;
  dispatch: (command: unknown) => Promise<unknown>;
  resolveChoice: (ids: string[]) => Promise<unknown>;
};

/** Runs `body` against the page's session store (`store`) and returns what it returns. */
const withStore = <T>(page: Page, body: string): Promise<T> =>
  page.evaluate(async (source) => {
    const { appSession } = await import("/src/session.ts");
    return await new Function("store", `return (async () => {${source}})()`)(appSession().store as Store);
  }, body) as Promise<T>;

/** Everything a view is built from, as one string, for the secrets it must not hold. */
const heldState = (page: Page): Promise<string> =>
  withStore(
    page,
    `const { cardPool, rng, ...table } = store.state.game; return JSON.stringify([table, store.state.legal, store.state.lastEvents]);`,
  );

const FIVE_SECRETS = [
  "55007b",
  "55008b",
  "55009b",
  "55010b",
  "55011b",
  "Trance of",
  "55008a",
  "55009a",
  "55010a",
  "55011a",
];

const useForced = (page: Page): Promise<boolean> =>
  withStore(
    page,
    `const l = store.state.legal?.actions; const e = l?.kind === "turn" && l.legal.find((x) => x.action.kind === "useAbility" && /forced-action/.test(x.action.abilityId)); if (!e) return false; await store.dispatch(e.example); return true;`,
  );

const settleChoices = (page: Page): Promise<void> =>
  withStore(
    page,
    `for (let i = 0; i < 20; i++) { const l = store.state.legal?.actions; if (l?.kind !== "choice") return; await store.resolveChoice(l.choice.options.slice(0, l.choice.minSelections).map((o) => o.optionId)); }`,
  );

const canEnd = (page: Page): Promise<boolean> =>
  withStore(
    page,
    `const l = store.state.legal?.actions; return l?.kind === "turn" && l.legal.some((x) => x.action.kind === "endTurn");`,
  );

test.describe("Enchantress", () => {
  test("hidden Gaze, owed Forced Actions, the Crown's cost and Seduced", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackPageErrors(page);
    await installPageHelpers(page);
    await page.goto("/?screen=board&fixture=enchantress");
    await waitForText(page, "must use", { sceneKey: "Board", timeoutMs: 90_000 });
    await settle(page);

    // The Gaze counts toward its five, and nothing the page holds names a Trance.
    expect(await hasText(page, "2/5 charm", "Board")).toBe(true);
    expect(await hasText(page, "Kiss of Temptation", "Board")).toBe(true);
    const before = await heldState(page);
    for (const secret of FIVE_SECRETS) expect(before.includes(secret), `held state names ${secret}`).toBe(false);

    // Inspect says the reverse is hidden.
    await clickText(page, "Hypnotic Gaze", {
      sceneKey: "Board",
      minY: 300,
      until: () => isSceneUp(page, "InspectOverlay"),
    });
    await waitForText(page, "other side is hidden", { timeoutMs: 15_000 });
    expect(await hasText(page, "Trance")).toBe(false);
    await pressKey(page, "Escape");
    await settle(page);

    // End Turn is refused with the card named; the Crown's cost reads in words.
    expect(await canEnd(page)).toBe(false);
    expect(await hasText(page, "Use first: Kiss of Temptation", "Board")).toBe(true);
    await clickText(page, "Crown of the", {
      sceneKey: "Board",
      maxY: 300,
      until: () => isSceneUp(page, "InspectOverlay"),
    });
    await waitForText(page, "each player exhausts, takes 1 damage", { timeoutMs: 15_000 });
    await pressKey(page, "Escape");

    // Use the Kiss, end the turn through the villain phase: Seduced arrives, the Gaze reaches its fifth counter.
    expect(await useForced(page)).toBe(true);
    await settleChoices(page);
    expect(await canEnd(page)).toBe(true);
    await withStore(
      page,
      `const l = store.state.legal.actions; await store.dispatch(l.legal.find((x) => x.action.kind === "endTurn").example);`,
    );
    await settleChoices(page);
    await clickText(page, "Start player phase", { sceneKey: "VillainPhase", timeoutMs: 30_000 }).catch(() => undefined);
    await waitForText(page, "must use", { sceneKey: "Board", timeoutMs: 30_000 });
    const seduced = await withStore<string>(
      page,
      `const l = store.state.legal.actions; const a = l.illegal.find((x) => x.action.kind === "basicAttack"); return a ? a.message : "attack is legal";`,
    );
    expect(seduced).toBe("Seduced: you cannot make basic attacks");

    // Round 4: the Kiss again; its fifth counter flips the Gaze, and the Trance is owed in turn.
    expect(await useForced(page)).toBe(true);
    await settleChoices(page);
    await settle(page);
    expect(await hasText(page, "Trance of", "Board")).toBe(true);
    expect(await hasText(page, "must use", "Board")).toBe(true);
    expect(await canEnd(page)).toBe(false);
    expect(await hasText(page, "Use first: Trance of", "Board")).toBe(true);

    // Using the Trance clears it; next round it is owed again.
    expect(await useForced(page)).toBe(true);
    await settleChoices(page);
    expect(await canEnd(page)).toBe(true);
    await withStore(
      page,
      `const l = store.state.legal.actions; await store.dispatch(l.legal.find((x) => x.action.kind === "endTurn").example);`,
    );
    await settleChoices(page);
    await clickText(page, "Start player phase", { sceneKey: "VillainPhase", timeoutMs: 30_000 }).catch(() => undefined);
    await waitForText(page, "must use", { sceneKey: "Board", timeoutMs: 30_000 });
    expect(await canEnd(page)).toBe(false);
    expect((await findText(page, "Trance of", "Board")).length).toBeGreaterThan(0);

    expect(errors, `no page errors (${JSON.stringify(errors)})`).toEqual([]);
  });

  // Owner ruling 63B (2026-10-11): the Trance of Greed must play the card it draws when it can be paid for, so the
  // payment it asks for (`playFromHand.mustPay`) has no decline, and an empty or short answer is refused.
  test("a required payment cannot be dismissed", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    await installPageHelpers(page);
    await page.goto("/?screen=board&fixture=enchantress&at=greed-pay");
    await waitForText(page, "must use", { sceneKey: "Board", timeoutMs: 90_000 });
    expect(await useForced(page)).toBe(true);
    await waitForText(page, "You must play Daredevil", { timeoutMs: 30_000 });
    await settle(page);

    // The sheet says why, offers Confirm only (waiting on the payment) and no way to skip.
    expect(await hasText(page, "Spend 4 resources")).toBe(true);
    expect(await hasText(page, "Pay 4 more")).toBe(true);
    for (const skip of ["Decline", "Don't play it", "Cancel", "Pay nothing"]) {
      expect(await hasText(page, skip, "ChoiceOverlay"), skip).toBe(false);
    }
    // Escape does not close it, and an empty answer is refused with the prompt still open.
    await pressKey(page, "Escape");
    await settle(page);
    expect(await hasText(page, "You must play Daredevil")).toBe(true);
    expect(await withStore<boolean>(page, `return await store.resolveChoice([]);`)).toBe(false);
    expect(await withStore<string>(page, `return store.state.game.pendingChoice?.prompt.kind ?? "none";`)).toBe(
      "spendResources",
    );

    // Paying in full is the way out: the cheapest payment, and Daredevil is played.
    await withStore(
      page,
      `const c = store.state.game.pendingChoice; await store.resolveChoice(c.options.slice(0, c.minSelections).map((o) => o.optionId));`,
    );
    await settle(page);
    expect(await withStore<string>(page, `return store.state.game.pendingChoice?.prompt.kind ?? "none";`)).toBe("none");
    expect(errors, `no page errors (${JSON.stringify(errors)})`).toEqual([]);
  });
});
