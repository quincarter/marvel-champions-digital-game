/**
 * A seat that is out of the game (eliminated, or sitting out) on the local player's own board: the identity panel reads
 * DEFEATED with nothing live on it, the turn banner never says "Your turn", and no identity or villain dial goes
 * below 0 (RRG 1.8 "Hit Points", p. 22).
 */

import { maxHitPoints } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import type { GameState, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel, characterPanel } from "./board-model.js";

const KLAW_TWO: SessionConfig = {
  scenarioId: "klaw",
  difficulty: "standard",
  players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-black-panther-protection" }],
  seed: 77,
};

describe("the local seat once it is out of the game", () => {
  let state: GameState;
  let me: PlayerId;
  let other: PlayerId;

  beforeAll(async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(KLAW_TWO);
    for (let step = 0; step < 40; step++) {
      const legal = store.state.legal;
      if (legal?.actions.kind !== "choice") break;
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    }
    state = store.state.game!;
    me = store.state.perspectiveId!;
    other = state.players.find((player) => player.playerId !== me)!.playerId;
  }, 60_000);

  /** The viewer's seat out of the game, its identity past zero hit points and exhausted, as the bug report had it. */
  const withMeOut = (flags: { sittingOut?: true } = {}, active: PlayerId = me): GameState => {
    const identityId = state.players.find((player) => player.playerId === me)!.identity.instanceId;
    const max = maxHitPoints(state, identityId, CORE_DEPS)!;
    return {
      ...state,
      players: state.players.map((player) =>
        player.playerId === me ? { ...player, eliminated: true, ...flags } : player,
      ),
      instances: {
        ...state.instances,
        [identityId]: { ...state.instances[identityId]!, damage: max + 1, exhausted: true },
      },
      step: { phase: "player", kind: "turn", activePlayerId: active, remainingPlayerIds: [] },
    };
  };

  test("the identity panel reads defeated with no live stats, statuses, exhausted tag or HP plate", () => {
    const out = withMeOut();
    const panel = boardModel(out, me, CORE_DEPS).me;
    expect(boardModel(out, me, CORE_DEPS).meOut).toBe("defeated");
    expect(panel.defeat).toBe("defeated");
    expect(panel.stats).toEqual([]);
    expect(panel.statuses).toEqual([]);
    expect(panel.hp).toBeNull();
    expect(panel.exhausted).toBe(false);
  });

  test("a seat that sat the scenario out reads as sitting out", () => {
    const out = withMeOut({ sittingOut: true });
    expect(boardModel(out, me, CORE_DEPS).meOut).toBe("sittingOut");
    expect(boardModel(out, me, CORE_DEPS).me.defeat).toBe("sittingOut");
  });

  test("a live seat has no defeat state and keeps its stats", () => {
    const model = boardModel(state, me, CORE_DEPS);
    expect(model.meOut).toBeNull();
    expect(model.me.defeat).toBeUndefined();
    expect(model.me.stats.length).toBeGreaterThan(0);
  });

  test("the banner never says 'Your turn' for an out seat, even while the turn still sits on it", () => {
    const stuck = boardModel(withMeOut(), me, CORE_DEPS).stepLabel;
    expect(stuck).not.toContain("Your turn");
    expect(stuck).toContain("is defeated");
    expect(boardModel(withMeOut({ sittingOut: true }), me, CORE_DEPS).stepLabel).toContain("is sitting out");
  });

  test("when the turn has moved on, the banner names whose turn it is and that you are out", () => {
    const label = boardModel(withMeOut({}, other), me, CORE_DEPS).stepLabel;
    expect(label).not.toContain("Your turn");
    expect(label).toContain("'s turn");
    expect(label).toContain("you are out");
  });

  test("the villain phase also says you are out", () => {
    const out: GameState = { ...withMeOut(), step: { phase: "villain", kind: "placeThreat" } as GameState["step"] };
    expect(boardModel(out, me, CORE_DEPS).stepLabel).toContain("you are out");
  });

  test("an identity's hit points never read below zero, on its panel or its seat row", () => {
    const identityId = state.players.find((player) => player.playerId === me)!.identity.instanceId;
    const max = maxHitPoints(state, identityId, CORE_DEPS)!;
    const down: GameState = {
      ...state,
      instances: { ...state.instances, [identityId]: { ...state.instances[identityId]!, damage: max + 3 } },
    };
    expect(characterPanel(down, identityId, CORE_DEPS).hp).toEqual({ current: 0, max });
    expect(boardModel(down, other, CORE_DEPS).team[0]!.hp).toEqual({ current: 0, max });
    const tile = characterPanel(down, identityId, CORE_DEPS).stats.find((stat) => stat.label === "HP");
    expect(tile?.value).toBe(`0/${max}`);
  });

  test("a villain's dial stops at zero", () => {
    const villainId = boardModel(state, me, CORE_DEPS).villain!.instanceId;
    const max = maxHitPoints(state, villainId, CORE_DEPS)!;
    const down: GameState = {
      ...state,
      instances: { ...state.instances, [villainId]: { ...state.instances[villainId]!, damage: max + 5 } },
    };
    expect(characterPanel(down, villainId, CORE_DEPS).hp?.current).toBe(0);
  });
});
