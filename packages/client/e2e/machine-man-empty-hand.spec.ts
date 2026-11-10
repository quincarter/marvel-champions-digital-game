import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { startOnBoard } from "./qa-wave10-recheck-helpers.js";

/**
 * Issue #654: Machine Man (26022), "Interrupt: When Machine Man attacks or thwarts, spend up to 3 resources of any
 * type → …", was offered with an empty hand. Saying yes opened a payment with nothing to pick and no way out, and the
 * game could not go on. "Up to" needs at least one resource (RRG 1.8 "Cost", p. 14), so with nothing to spend he is
 * not offered and his attack simply happens.
 *
 * Vision (Protection) against Rhino, seed 24: Machine Man is in the opening hand, and playing every card leaves him in
 * play, ready, with the hand empty.
 */

const SHOTS = process.env.E2E_SHOTS ?? "";
const MACHINE_MAN = "26022";

const SIZES = [
  { name: "desktop-1440x900", width: 1440, height: 900, touch: false },
  { name: "se-375x667", width: 375, height: 667, touch: true },
  // Screenshot sizes only: the suite itself stays desktop and phone.
  ...(SHOTS
    ? ([
        { name: "pixel-412x924", width: 412, height: 924, touch: true },
        { name: "tablet-portrait-820x1180", width: 820, height: 1180, touch: true },
        { name: "tablet-1180x820", width: 1180, height: 820, touch: true },
      ] as const)
    : []),
] as const;

interface Staged {
  readonly machineMan: string | null;
  readonly hand: number;
  readonly villain: string;
}

/** Plays Machine Man, then every other card the hand can pay for, until he is in play and the hand is empty. */
const emptyTheHand = (page: Page): Promise<Staged> =>
  page.evaluate(async (code) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: any } };
    const store = appSession().store;
    const machineIn = (): string | undefined => {
      const game = store.state.game;
      return game.players[0].playArea.find((id: string) => game.instances[id].cardId === code);
    };
    for (let step = 0; step < 80; step++) {
      const game = store.state.game;
      const actions = store.state.legal?.actions;
      if (!actions || game.outcome) break;
      if (actions.kind === "choice") {
        const c = actions.choice;
        // A payment takes everything it may; anything else its minimum.
        const count = c.prompt.kind.startsWith("pay") ? c.maxSelections : c.minSelections;
        await store.resolveChoice(c.options.slice(0, count).map((o: { optionId: string }) => o.optionId));
        continue;
      }
      if (machineIn() && game.players[0].hand.length === 0) break;
      const plays = actions.legal.filter((e: any) => e.action.kind === "playCard");
      const next =
        plays.find((e: any) => game.instances[e.action.instanceId]?.cardId === code) ?? (machineIn() && plays[0]);
      if (!next) break;
      await store.dispatch(next.example);
    }
    const game = store.state.game;
    return {
      machineMan: machineIn() ?? null,
      hand: game.players[0].hand.length,
      villain: store.state.legal?.actions.legal?.find((e: any) => e.action.kind === "basicAttack")?.example
        .targetInstanceId,
    };
  }, MACHINE_MAN);

const damageOf = (page: Page, villain: string): Promise<number> =>
  page.evaluate(async (id) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: any } };
    return appSession().store.state.game.instances[id].damage as number;
  }, villain);

for (const size of SIZES) {
  test.describe(`Machine Man with an empty hand at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.touch });

    test("his attack goes ahead with no payment asked", async ({ page }) => {
      test.setTimeout(180_000);
      await installWave6Helpers(page);
      await openApp(page);
      await startOnBoard(page, {
        scenarioId: "rhino",
        difficulty: "standard",
        players: [{ starterDeckId: "vision-protection" }],
        seed: 24,
      });
      const staged = await emptyTheHand(page);
      expect(staged.machineMan, "Machine Man is in play").not.toBeNull();
      expect(staged.hand, "the hand is empty").toBe(0);
      await settle(page, { quietMs: 600, maxMs: 4000 });
      const before = await damageOf(page, staged.villain);

      const attacked = await page.evaluate(async (machine) => {
        const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: any } };
        const store = appSession().store;
        const attack = store.state.legal?.actions.legal?.find(
          (e: any) => e.action.kind === "basicAttack" && e.action.instanceId === machine,
        );
        if (!attack) {
          const a = store.state.legal?.actions;
          return `no attack: ${a?.kind} ${a?.choice?.prompt.kind ?? ""} ${(a?.legal ?? []).map((e: any) => e.action.kind + ":" + (e.action.instanceId ?? "")).join(",")} ex=${store.state.game.instances[machine].exhausted}`;
        }
        await store.dispatch(attack.example);
        return store.state.game.pendingChoice?.prompt.kind ?? "none";
      }, staged.machineMan!);
      expect(attacked, "nothing is asked: no interrupt, no payment").toBe("none");
      await settle(page, { quietMs: 600, maxMs: 4000 });
      expect(await activeScenes(page)).not.toContain("ChoiceOverlay");
      expect(await damageOf(page, staged.villain)).toBeGreaterThan(before);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/machine-man-empty-hand-${size.name}.png` });
    });
  });
}
