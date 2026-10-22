/**
 * A constant on a player card that reads "the main scheme" while several main schemes share the play area lets its
 * controller choose which one counts, each time it has an effect: RRG 1.8 p. 63 (Venom Goblin FAQ, "The player using
 * the effect chooses one main scheme on which to count the acceleration tokens") and post-RRG 1.5 #132 (Dec 22, 2023:
 * Venom 22013 and Cable 44002 by name). Engine interpretation, contributor's rules call 2026-10-16 (bluefireF5ran): the
 * engine takes the choice best for that player instead of asking, the most tokens for Cable, and Venom's reduction if
 * any scheme has no threat. Montage has its own ruling, post-RRG 1.5 #188 (May 16, 2024: "you can choose any main
 * scheme to check").
 */
import { cardId } from "@mc/content";
import { createGame, currentName, statBonus, type GameSetupConfig, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  play,
  runWith,
  settle,
  toHero,
  type Picker,
} from "./testing/harness.js";
import { towerDefenseScenario } from "./wave4/mts/tower-defense-setup.js";
import { ghostSpiderScenarioWithExtras } from "./wave5/sm/ghost-spider/support.js";
import { WAVE7_CARDS, WAVE7_DEPS as DEPS } from "./wave7/index.js";

/** Venom Goblin, one player (Lower 1 threat, Midtown 2 with the glider, Upper 0), with `codes` in play under P1. */
function venomGoblinWith(...codes: readonly string[]): { readonly state: GameState; readonly ids: InstanceId[] } {
  return startWith(ghostSpiderScenarioWithExtras("venom-goblin", { seed: 7, extraCodes: codes }), codes);
}

/** Tower Defense (two main schemes, Focused Defense on one), one player, with `codes` in play under P1. */
function towerDefenseWith(...codes: readonly string[]): { readonly state: GameState; readonly ids: InstanceId[] } {
  const base = towerDefenseScenario({ seed: 1, players: [{ starterDeckId: "spectrum-leadership" }] });
  const config: GameSetupConfig = {
    ...base,
    requireLegalDecks: false,
    players: base.players.map((p) => ({ ...p, deck: [...p.deck, ...codes.map((code) => cardId(code))] })),
  };
  return startWith(config, codes);
}

function startWith(
  config: GameSetupConfig,
  codes: readonly string[],
): { readonly state: GameState; readonly ids: InstanceId[] } {
  const created = createGame({ ...config, cards: WAVE7_CARDS }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const started = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  const given = moveToHand(started, P1, ...codes);
  const ids = [...given.ids];
  const state: GameState = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === P1
        ? { ...p, hand: p.hand.filter((id) => !ids.includes(id)), playArea: [...p.playArea, ...ids] }
        : p,
    ),
  };
  return {
    ids,
    state: ids.reduce((s, id) => patchInstance(s, id, { controllerId: P1, faceup: true }), state),
  };
}

const schemeIds = (state: GameState): readonly InstanceId[] => [
  state.mainScheme.instanceId,
  ...(state.extraMainSchemes ?? []).map((s) => s.instanceId),
];
const schemeNamed = (state: GameState, name: string): InstanceId => {
  const found = schemeIds(state).find((id) => currentName(state, id) === name);
  if (!found) throw new Error(`no main scheme named ${name}`);
  return found;
};
function withTokens(state: GameState, name: string, accelerationTokens: number): GameState {
  const id = schemeNamed(state, name);
  return state.mainScheme.instanceId === id
    ? { ...state, mainScheme: { ...state.mainScheme, accelerationTokens } }
    : {
        ...state,
        extraMainSchemes: (state.extraMainSchemes ?? []).map((s) =>
          s.instanceId === id ? { ...s, accelerationTokens } : s,
        ),
      };
}

describe("RRG 1.8 p. 63 / Ruling 132 (Dec 22, 2023): a player card's constant chooses which main scheme counts", () => {
  it("Cable (44002) counts the acceleration tokens on the main scheme best for his controller, to a maximum of 3", () => {
    const { state, ids } = venomGoblinWith("44002");
    const [cable] = ids as [InstanceId];
    // The glider's scheme (Midtown) has none; Upper has 2.
    const two = withTokens(withTokens(state, "Midtown Manhattan", 0), "Upper Manhattan", 2);
    expect(statBonus(two, DEPS, cable, "thw")).toBe(2);
    expect(statBonus(two, DEPS, cable, "atk")).toBe(2);
    const five = withTokens(two, "Lower Manhattan", 5);
    expect(statBonus(five, DEPS, cable, "thw")).toBe(3);
  });

  it("Venom (22013) takes 1 less consequential damage while any main scheme has no threat", () => {
    const { state, ids } = venomGoblinWith("22013");
    const [venom] = ids as [InstanceId];
    const staged = patchInstance(
      patchInstance(
        patchInstance(state, schemeNamed(state, "Lower Manhattan"), { threat: 1 }),
        schemeNamed(state, "Midtown Manhattan"),
        {
          threat: 2,
        },
      ),
      schemeNamed(state, "Upper Manhattan"),
      { threat: 0 },
    );
    expect(statBonus(staged, DEPS, venom, "consequentialAttack")).toBe(-1);
    expect(statBonus(staged, DEPS, venom, "consequentialThwart")).toBe(-1);
    // Threat on every main scheme: no scheme to choose that satisfies "no threat".
    const allThreat = patchInstance(staged, schemeNamed(staged, "Upper Manhattan"), { threat: 1 });
    expect(statBonus(allThreat, DEPS, venom, "consequentialAttack")).toBe(0);
  });

  it("with Focused Defense (Tower Defense), a player card's constant reads only the scheme it is attached to (MC21 p. 10)", () => {
    const { state, ids } = towerDefenseWith("22013");
    const [venom] = ids as [InstanceId];
    const [focusedDefense] = instancesOf(state, "21101") as [InstanceId];
    const focused = state.instances[focusedDefense]!.attachedTo!;
    const other = schemeIds(state).find((id) => id !== focused)!;
    const otherEmpty = patchInstance(patchInstance(state, focused, { threat: 2 }), other, { threat: 0 });
    expect(statBonus(otherEmpty, DEPS, venom, "consequentialAttack")).toBe(0);
    const focusedEmpty = patchInstance(patchInstance(state, focused, { threat: 0 }), other, { threat: 2 });
    expect(statBonus(focusedEmpty, DEPS, venom, "consequentialAttack")).toBe(-1);
  });
});

describe("Determination (22016): 'remove 1 threat from the main scheme' asks which one (MC27 Venom Goblin FAQ; MC21 p. 10 for Tower Defense)", () => {
  /** Spends Determination to pay for Heroic Intuition, answering the main scheme prompt with `scheme`. */
  function spendDetermination(
    start: GameState,
    ids: readonly InstanceId[],
    scheme: (offered: readonly string[]) => string,
  ) {
    const [determination, intuition] = ids as [InstanceId, InstanceId];
    // The helpers put the cards in play; Determination and Heroic Intuition belong in hand.
    const inHand = {
      ...start,
      players: start.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: [...p.hand, ...ids], playArea: p.playArea.filter((id) => !ids.includes(id)) }
          : p,
      ),
    };
    const given = { state: settle(runWith(DEPS, inHand, toHero()), firstLegal, undefined, DEPS) };
    const filler = given.state.players.find((p) => p.playerId === P1)!.hand.find((id) => !ids.includes(id))!;
    const offers: (readonly string[])[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      const offered = choice.options.map((o) => o.optionId);
      const hit = offered.find(
        (o) => o.endsWith(":22016.determination-response") || o === "22016.determination-response",
      );
      if (hit) return [hit];
      if (offered.every((o) => schemeIds(s).includes(o as InstanceId))) {
        offers.push(offered);
        return [scheme(offered)];
      }
      return firstLegal(s);
    };
    const after = settle(
      runWith(DEPS, given.state, play(P1, intuition, [determination, filler])),
      pick,
      undefined,
      DEPS,
    );
    return { after, offers };
  }

  it("Venom Goblin: the player is offered all three main schemes and the chosen one loses the threat", () => {
    const { state, ids } = venomGoblinWith("22016", "22019");
    const staged = schemeIds(state).reduce((s, id) => patchInstance(s, id, { threat: 3 }), state);
    const upper = schemeNamed(staged, "Upper Manhattan");
    const { after, offers } = spendDetermination(staged, ids, () => upper);
    expect([...offers[0]!].sort()).toEqual([...schemeIds(staged)].sort());
    expect(offers[0]).toHaveLength(3);
    expect(after.instances[upper]!.threat).toBe(2);
    expect(schemeIds(after).filter((id) => after.instances[id]!.threat === 3)).toHaveLength(2);
  });

  it("Tower Defense: the player is asked which of the two main schemes", () => {
    const { state, ids } = towerDefenseWith("22016", "22019");
    const staged = schemeIds(state).reduce((s, id) => patchInstance(s, id, { threat: 3 }), state);
    const [, second] = schemeIds(staged) as [InstanceId, InstanceId];
    const { after, offers } = spendDetermination(staged, ids, () => second);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toHaveLength(2);
    expect(after.instances[second]!.threat).toBe(2);
    expect(after.instances[state.mainScheme.instanceId]!.threat).toBe(3);
  });
});
