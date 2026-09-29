/**
 * The `?screen=board&fixture=holdon-scheme`/`&fixture=holdon-lethal` dev jumps reach the boundary state they
 * promise: pressing End turn right there fires `hintsFor`'s `schemeFinish`/`lethal` hint (`view/guide-hints.ts`),
 * the same check the controller (G9b) makes before letting an `end-turn` command through.
 */
import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { hintsFor } from "../view/guide-hints.js";
import { defaultGuidePrefs } from "../guide/guide-prefs.js";
import {
  HOLDON_LETHAL_CONFIG,
  HOLDON_SCHEME_CONFIG,
  startHoldOnLethalGame,
  startHoldOnSchemeGame,
} from "./dev-hold-on-game.js";
import { SessionStore } from "./session-store.js";

describe("the holdon-scheme dev fixture", () => {
  test("stops on the player's turn with the schemeFinish hint one End turn away", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startHoldOnSchemeGame(store);

    const game = store.state.game!;
    const playerId = store.state.perspectiveId!;
    const player = game.players.find((p) => p.playerId === playerId)!;
    expect(game.outcome).toBeNull();
    expect(player.identity.form).toBe("hero");

    const actions = store.state.legal!.actions;
    expect(actions.kind).toBe("turn");
    if (actions.kind !== "turn") return;
    expect(actions.legal.some((e) => e.action.kind === "basicThwart")).toBe(true);

    const hints = hintsFor({ state: game, deps: POOL_DEPS, playerId, trigger: { kind: "endTurn" } }, defaultGuidePrefs);
    expect(hints.some((h) => h.key === "schemeFinish")).toBe(true);
  });

  test("replays identically from the same seed and stack", async () => {
    const a = new SessionStore(new LocalEngineHost());
    const b = new SessionStore(new LocalEngineHost());
    await startHoldOnSchemeGame(a);
    await startHoldOnSchemeGame(b);
    expect(a.state.game?.mainScheme).toEqual(b.state.game?.mainScheme);
    expect(a.state.game?.round).toBe(b.state.game?.round);
    expect(HOLDON_SCHEME_CONFIG.seed).toBe(9001);
  });
});

describe("the holdon-lethal dev fixture", () => {
  test("stops on the player's turn with the lethal hint one End turn away", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startHoldOnLethalGame(store);

    const game = store.state.game!;
    const playerId = store.state.perspectiveId!;
    const player = game.players.find((p) => p.playerId === playerId)!;
    expect(game.outcome).toBeNull();
    expect(player.identity.form).toBe("hero");

    const hints = hintsFor({ state: game, deps: POOL_DEPS, playerId, trigger: { kind: "endTurn" } }, defaultGuidePrefs);
    expect(hints.some((h) => h.key === "lethal")).toBe(true);
    expect(HOLDON_LETHAL_CONFIG.seed).toBe(7);
  });
});
