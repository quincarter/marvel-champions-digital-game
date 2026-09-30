/**
 * The `?screen=board&fixture=tips` dev fixture reaches the boundary state it promises: round 2, the player's own
 * turn, a minion engaged from round 1's villain phase — and `view/guide-tips.ts#tipsFor` has a real, eligible
 * candidate there (the same check the tip mount's own scheduler makes on every store update, `view/tip-schedule.ts`).
 */
import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { defaultGuidePrefs } from "../guide/guide-prefs.js";
import { tipsFor } from "../view/guide-tips.js";
import { TIPS_CONFIG, startTipsGame, tipsFixtureReachedBoundary } from "./dev-tips-game.js";
import { SessionStore } from "./session-store.js";

describe("the tips dev fixture", () => {
  test("stops at round 2's player turn with a minion engaged", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startTipsGame(store);

    const game = store.state.game!;
    const playerId = store.state.perspectiveId!;
    expect(game.outcome).toBeNull();
    expect(game.round).toBe(2);

    const actions = store.state.legal!.actions;
    expect(actions.kind).toBe("turn");

    expect(tipsFixtureReachedBoundary(game, playerId)).toBe(true);
  });

  test("has an eligible tip at the fixture's stop point", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startTipsGame(store);

    const game = store.state.game!;
    const playerId = store.state.perspectiveId!;

    const tips = tipsFor(
      { game, lastEvents: store.state.lastEvents, perspectiveId: playerId },
      POOL_DEPS,
      defaultGuidePrefs,
    );
    expect(tips.length).toBe(1);
  });

  test("replays identically from the same seed and stack", async () => {
    const a = new SessionStore(new LocalEngineHost());
    const b = new SessionStore(new LocalEngineHost());
    await startTipsGame(a);
    await startTipsGame(b);
    expect(a.state.game?.mainScheme).toEqual(b.state.game?.mainScheme);
    expect(a.state.game?.round).toBe(b.state.game?.round);
    expect(TIPS_CONFIG.seed).toBe(4242);
  });
});
