import { cardId } from "@mc/content";
import { activeVillain, characterProfile, encounterDeckOf, villainOf, type GameState, type InstanceId } from "@mc/engine";
import { P1, endTurn, identityOf, inst, patchInstance, settle } from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

/** Runs commands, then settles every resulting choice (least-committal pick) up to the next player phase. */
const play = (state: GameState, ...commands: Parameters<typeof runTwc>[1][]): GameState =>
  settle(runTwc(state, ...commands), undefined, (s) => s.step.phase === "player" && s.step.kind === "turn", TWC_DEPS);

/**
 * Breakout end to end (docs/phase7-wave1.md §2.3, §3.1, §3.2): four villains in play at once, the active counter,
 * Breakout 1B's own "move the active counter" forced response, and — with the real Breakout card/ability data
 * rather than the synthetic fixtures `packages/engine/src/multi-villain.test.ts` already proves the underlying
 * mechanism with — a real villain defeat moving "active" to another villain and routing an encounter card to its
 * own villain's discard (ruling, Jan 17, 2026 (5)).
 */
const spiderManVsBreakout = () => startTwcGame(wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 }));

const nameOf = (state: GameState, id: InstanceId): string => state.cardPool[inst(state, id).cardId]?.name ?? id;
const villainNamed = (state: GameState, name: string): InstanceId => {
  const found = state.villains.find((v) => nameOf(state, v.instanceId) === name);
  if (!found) throw new Error(`no villain ${name}`);
  return found.instanceId;
};

describe("wave1Scenario('breakout')", () => {
  it("1A's setup puts all four villains and their signature side schemes into play, Wrecker active", () => {
    const state = spiderManVsBreakout();
    expect(state.villains.map((v) => nameOf(state, v.instanceId))).toEqual(["Wrecker", "Thunderball", "Piledriver", "Bulldozer"]);
    expect(state.activeVillainId).toBe(villainNamed(state, "Wrecker"));
    expect(activeVillain(state).instanceId).toBe(villainNamed(state, "Wrecker"));
    const schemeThreat = (villainName: string) => inst(state, villainOf(state, villainNamed(state, villainName))!.signatureSideSchemeId!).threat;
    expect(schemeThreat("Wrecker")).toBe(6); // Day of Reckoning
    expect(schemeThreat("Thunderball")).toBe(5); // Thunderstruck
    expect(schemeThreat("Piledriver")).toBe(3); // Pile It On!
    expect(schemeThreat("Bulldozer")).toBe(4); // Clear the Road
    expect(state.villains.every((v) => v.encounterDeckId)).toBe(true);
    expect(new Set(state.villains.map((v) => v.encounterDeckId)).size).toBe(4);
  });

  it("1B's Forced Response places 1 threat on every side scheme after villain phase step one", () => {
    const before = spiderManVsBreakout();
    const after = play(before, endTurn(P1));
    const schemeThreat = (state: GameState, villainName: string) => inst(state, villainOf(state, villainNamed(state, villainName))!.signatureSideSchemeId!).threat;
    // Thunderball, Piledriver and Bulldozer don't activate this round (only the active villain, Wrecker, does in
    // villain phase step 2), so 1B's own +1 is the only thing that touches their side schemes.
    for (const name of ["Thunderball", "Piledriver", "Bulldozer"]) {
      expect(schemeThreat(after, name)).toBe(schemeThreat(before, name) + 1);
    }
    // Wrecker's own scheme redirect (07002.wrecker-constant) also fires: step two has him scheme (nothing is
    // engaged with him), and his own "When Wrecker schemes, place the threat on his side scheme instead of the
    // main scheme" constant redirects that onto Day of Reckoning too, on top of 1B's +1.
    expect(schemeThreat(after, "Wrecker")).toBeGreaterThan(schemeThreat(before, "Wrecker") + 1);
    // Day of Reckoning is still the highest of the four, so the active counter stays on Wrecker.
    expect(after.activeVillainId).toBe(villainNamed(after, "Wrecker"));
  });

  it("defeating the active villain moves the counter to the next-highest side scheme and routes cards per villain", () => {
    let state = spiderManVsBreakout();
    state = runTwc(state, { type: "changeForm", playerId: P1 });
    const wrecker = villainNamed(state, "Wrecker");
    const heroId = identityOf(state, P1);
    const heroAtk = characterProfile(state, heroId, TWC_DEPS)?.atk ?? 1;
    const maxHp = characterProfile(state, wrecker, TWC_DEPS)?.maxHp ?? 0;
    state = patchInstance(state, wrecker, { damage: Math.max(0, maxHp - heroAtk), exhausted: false });
    state = runTwc(state, { type: "basicAttack", playerId: P1, attackerInstanceId: heroId, targetInstanceId: wrecker });

    expect(villainOf(state, wrecker)?.defeated).toBe(true);
    // Day of Reckoning is removed from the game (not defeated: no discard), and Thunderstruck (5) is now the
    // highest of the three remaining villains' side schemes (Pile It On! 3, Clear the Road 4), so the counter moves
    // to Thunderball.
    const dayOfReckoning = villainOf(state, wrecker)?.signatureSideSchemeId as InstanceId;
    expect(state.removedFromGame).toContain(dayOfReckoning);
    expect(state.villainArea).not.toContain(dayOfReckoning);
    expect(state.activeVillainId).toBe(villainNamed(state, "Thunderball"));

    // A Corrupt Prison Guard from Piledriver's own deck, defeated while Thunderball is active, goes to Piledriver's
    // own discard pile — never the active villain's (ruling, Jan 17, 2026 (5); §3.2).
    const piledriver = villainNamed(state, "Piledriver");
    const piledriverDeckId = villainOf(state, piledriver)!.encounterDeckId;
    const guardId = encounterDeckOf(state, piledriverDeckId).deck.find((id) => inst(state, id).cardId === cardId("07037"));
    if (!guardId) throw new Error("no Corrupt Prison Guard in Piledriver's deck");
    state = {
      ...state,
      encounterDecks: { ...state.encounterDecks, [piledriverDeckId]: { ...encounterDeckOf(state, piledriverDeckId), deck: encounterDeckOf(state, piledriverDeckId).deck.filter((id) => id !== guardId) } },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, guardId] } : p)),
      instances: { ...state.instances, [guardId]: { ...inst(state, guardId), faceup: true, engagedWith: P1 } },
    };
    const guardHp = characterProfile(state, guardId, TWC_DEPS)?.maxHp ?? 0;
    state = patchInstance(state, guardId, { damage: Math.max(0, guardHp - heroAtk) });
    state = patchInstance(state, heroId, { exhausted: false });
    state = runTwc(state, { type: "basicAttack", playerId: P1, attackerInstanceId: heroId, targetInstanceId: guardId });
    expect(encounterDeckOf(state, piledriverDeckId).discard).toContain(guardId);
    const thunderballDeckId = villainOf(state, villainNamed(state, "Thunderball"))!.encounterDeckId;
    expect(encounterDeckOf(state, thunderballDeckId).discard).not.toContain(guardId);
  });
});
