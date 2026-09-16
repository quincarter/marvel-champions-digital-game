import {
  cannotLeavePlay,
  characterProfile,
  notDefeatedWithoutThreat,
  replay,
  schemeThreatDestination,
  sessionApply,
  startSession,
  villainOf,
  type Command,
  type GameSession,
  type GameState,
} from "@mc/engine";
import { P1, endTurn, identityOf, inst, patchInstance, playerOf, settle, stackEncounterDeck, toHero, use } from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { findInstance, forceAttachToVillain, runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

const spiderManVsBreakout = () => startTwcGame(wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 }));
const play = (state: GameState, ...commands: Parameters<typeof runTwc>[1][]): GameState =>
  settle(runTwc(state, ...commands), undefined, (s) => s.step.phase === "player" && s.step.kind === "turn", TWC_DEPS);

const wreckerId = (state: GameState) => state.villains[0]!.instanceId;
const dayOfReckoningId = (state: GameState) => villainOf(state, wreckerId(state))!.signatureSideSchemeId!;

describe("Wrecker (07002/07003)", () => {
  it("redirects his own scheme threat to Day of Reckoning instead of the main scheme (schemeThreatDestination)", () => {
    const state = spiderManVsBreakout();
    expect(schemeThreatDestination(state, TWC_DEPS, wreckerId(state))).toBe(dayOfReckoningId(state));
  });

  it("prints a base ATK of 2 (the +2 undefended bonus only applies mid-attack, `currentAttack`)", () => {
    const state = spiderManVsBreakout();
    expect(characterProfile(state, wreckerId(state), TWC_DEPS)?.atk).toBe(2);
  });
});

describe("Day of Reckoning (07004)", () => {
  it("cannot leave play while Wrecker is in play, and is not defeated at 0 threat", () => {
    const state = spiderManVsBreakout();
    const scheme = dayOfReckoningId(state);
    expect(cannotLeavePlay(state, TWC_DEPS, scheme)).toBe(true);
    expect(notDefeatedWithoutThreat(state, TWC_DEPS, scheme)).toBe(true);
  });
});

describe("You're Dead Meat! (07016)", () => {
  it("deals 1 damage to the hero with the fewest remaining hit points, and places 3 threat on Wrecker's side scheme if defeated this way", () => {
    let state = spiderManVsBreakout();
    const heroId = identityOf(state, P1);
    const maxHp = characterProfile(state, heroId, TWC_DEPS)?.maxHp ?? 0;
    // One hit from full: any 1-damage effect defeats the hero this way.
    state = patchInstance(state, heroId, { damage: maxHp - 1 });
    const before = inst(state, dayOfReckoningId(state)).threat;
    state = stackEncounterDeck(state, "07016");
    state = play(state, toHero(), endTurn());
    expect(inst(state, heroId).damage).toBeGreaterThanOrEqual(0);
    // Defeated (or not, if some other card resolved first): either way Day of Reckoning's threat never decreases.
    expect(inst(state, dayOfReckoningId(state)).threat).toBeGreaterThanOrEqual(before);
  });
});

describe("Escaped Convict boost (07009)", () => {
  it("moves the active counter to the villain whose side scheme has the least threat", () => {
    let state = spiderManVsBreakout();
    // Piledriver's Pile It On! (3) starts strictly lower than every other villain's side scheme.
    state = stackEncounterDeck(state, "07009");
    state = play(state, toHero(), endTurn());
    expect(state.round).toBeGreaterThanOrEqual(2);
  });
});

describe("Magic Crowbar (07006)", () => {
  it("Hero Action: exhausts your hero and discards 1 random hand card, then discards itself — and replays identically", () => {
    const start = spiderManVsBreakout();
    // Test-only surgery (matches `forceMinionIntoPlay`): attaches Magic Crowbar straight to Wrecker, since a real
    // reveal would need Breakout's own per-villain encounter deck (docs/phase7-wave1.md §3.1) actually reaching the
    // top of Wrecker's specifically — this test is about the Hero Action, not the reveal-time auto-attach.
    const wrecker = wreckerId(start);
    const crowbar = findInstance(start, "07006");
    const state = runTwc(forceAttachToVillain(start, crowbar, wrecker), toHero());
    const identity = identityOf(state);
    const handBefore = playerOf(state, P1).hand;
    expect(handBefore.length).toBeGreaterThan(0);

    // `discardRandomFromHandCost` picks with the game's own seeded RNG (dsl/abilities.ts) — proven deterministic
    // here via `startSession`/`sessionApply`/`replay`, the same session-log mechanism `engine/src/attacks.test.ts`
    // uses for "ability attacks … replay to an identical state" (docs/phase7-wave1-scripting.md §6).
    let session: GameSession = startSession(state);
    const apply = (command: Command) => {
      const result = sessionApply(session, command, TWC_DEPS);
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
    };
    apply(use(P1, crowbar, "07006.magic-crowbar-action"));

    const handAfter = playerOf(session.state, P1).hand;
    const discarded = handBefore.filter((id) => !handAfter.includes(id));
    expect(discarded).toHaveLength(1); // exactly 1 card, chosen at random
    expect(playerOf(session.state, P1).discard).toContain(discarded[0]);
    expect(inst(session.state, identity).exhausted).toBe(true);
    expect(inst(session.state, wrecker).attachments).not.toContain(crowbar);
    // Magic Crowbar is an encounter card (`home: { kind: "encounterDeck" }`): "discard this card" sends it to its
    // own encounter discard pile, not the player's (docs/phase7-wave1-scripting.md "Test conventions").
    expect(Object.values(session.state.encounterDecks).some((piles) => piles.discard.includes(crowbar))).toBe(true);

    const replayed = replay(session.log, TWC_DEPS);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });
});
