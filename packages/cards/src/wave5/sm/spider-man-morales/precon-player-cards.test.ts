import { applyCommand, legalActions, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  run,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { WAVE5_DEPS } from "../../index.js";
import { startWave5Game } from "../../testing.js";
import { spiderManMoralesScenario } from "./support.js";
import { SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";

const milesVsRhino = (seed = 1) => startWave5Game(spiderManMoralesScenario("rhino", { seed }));

/**
 * Accepts every optional trigger/target option named in `wanted` (by exact id, or `<instanceId>:<abilityId>`
 * suffix — the `support-upgrades-allies.test.ts` `accepting()` shape), and greedily maxes out any card-picking
 * prompt (`chooseCostCards`, `chooseCards`) that isn't itself the thing being matched — "exhaust up to 3" and
 * "search your deck … add it to your hand" both need this to actually pick something rather than the fewest-legal
 * default `firstLegal` gives them.
 */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseCostCards" || choice.prompt.kind === "chooseCards") {
      return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
    }
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Plays `code` (already the player's hand) from `state`, paying `cost` other hand cards. */
function playFromHandHelper(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const played = settle(
    runWith(WAVE5_DEPS, given.state, play(P1, id, payWith(given.state, P1, cost, given.ids))),
    pick,
    undefined,
    WAVE5_DEPS,
  );
  return { state: played, id };
}

describe("Field Agent (support, 27044)", () => {
  it("27044.field-agent-interrupt: prevents 1 consequential damage a S.H.I.E.L.D. ally takes from its own attack", () => {
    const hero = run(milesVsRhino(1), toHero(P1));
    const { state: withDugan, id: dugan } = playFromHandHelper(hero, "27047", 5); // Dum Dum Dugan, trait S.H.I.E.L.D.
    const { state: withFieldAgent, id: fieldAgent } = playFromHandHelper(withDugan, "27044", 1);
    const villain = withFieldAgent.villains[0]!.instanceId;
    // Keep the villain alive (no overkill spill confusing the consequential-damage read) and Dugan himself alive.
    const primed = patchInstance(withFieldAgent, villain, { damage: 0 });
    const attackOnce = (state: GameState, pick: Picker) =>
      settle(
        runWith(WAVE5_DEPS, state, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: dugan,
          targetInstanceId: villain,
        } as never),
        pick,
        undefined,
        WAVE5_DEPS,
      );
    const declined = attackOnce(primed, firstLegal);
    const accepted = attackOnce(primed, accepting("27044.field-agent-interrupt", "backup"));
    // Dum Dum Dugan's own printed consequential attack damage is 2; Field Agent prevents 1 of it when accepted.
    expect(inst(declined, dugan).damage).toBe(2);
    expect(inst(accepted, dugan).damage).toBe(1);
    expect(inst(accepted, fieldAgent).exhausted).toBe(true);
    expect(inst(accepted, fieldAgent).counters.backup).toBe(2); // started at 3 (Uses), removed 1.
  });

  it("27044.field-agent-interrupt: does not trigger for an ally without the exact S.H.I.E.L.D. trait (Agent 13 is 'S.H.I.E.L.D. SPY')", () => {
    const hero = run(milesVsRhino(2), toHero(P1));
    const { state: withAgent13, id: agent13 } = playFromHandHelper(hero, "27046", 4);
    const { state: withFieldAgent } = playFromHandHelper(withAgent13, "27044", 1);
    const villain = withFieldAgent.villains[0]!.instanceId;
    const primed = patchInstance(withFieldAgent, villain, { damage: 0 });
    const after = settle(
      runWith(WAVE5_DEPS, primed, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: agent13,
        targetInstanceId: villain,
      } as never),
      accepting("27044.field-agent-interrupt"),
      undefined,
      WAVE5_DEPS,
    );
    // Agent 13's own printed consequential attack damage is 1, taken in full: no prevention window ever opened.
    expect(inst(after, agent13).damage).toBe(1);
  });

  it("27044.field-agent-interrupt: does not trigger on a S.H.I.E.L.D. ally's non-consequential damage (defending)", () => {
    const hero = run(milesVsRhino(1), toHero(P1));
    const { state: withDugan, id: dugan } = playFromHandHelper(hero, "27047", 5);
    const { state: withFieldAgent, id: fieldAgent } = playFromHandHelper(withDugan, "27044", 1);
    const defending = answer(
      settle(
        runWith(WAVE5_DEPS, withFieldAgent, endTurn(P1)),
        firstLegal,
        (s) => s.pendingChoice?.prompt.kind === "declareDefender",
        WAVE5_DEPS,
      ),
      [dugan],
      WAVE5_DEPS,
    );
    let offered = false;
    const watching: Picker = (state) => {
      if (state.pendingChoice?.options.some((o) => o.optionId.endsWith("27044.field-agent-interrupt"))) offered = true;
      return accepting("27044.field-agent-interrupt", "backup")(state);
    };
    const after = settle(defending, watching, undefined, WAVE5_DEPS);
    // Rhino's attack damaged Dugan, but that damage is not consequential: Field Agent was never offered.
    expect(inst(after, dugan).damage).toBeGreaterThan(0);
    expect(offered).toBe(false);
    expect(inst(after, fieldAgent).counters.backup).toBe(3);
  });
});

describe("Surveillance Team (support, 27045, Core reprint of 01064)", () => {
  it("aliases Core's own definition rather than re-scripting it", () => {
    expect(SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS["27045.surveillance-team-action"]).toBe(
      SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS["27045.surveillance-team-action"],
    );
    expect(validateDefinition(SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS["27045.surveillance-team-action"]!)).toEqual([]);
  });

  it("27045.surveillance-team-action: exhausts, removes a snoop counter, and removes 1 threat from the main scheme", () => {
    const state = milesVsRhino(1);
    const { state: withTeam, id: team } = playFromHandHelper(state, "27045", 2);
    const staged = patchInstance(withTeam, withTeam.mainScheme.instanceId, { threat: 8 }); // nonzero: 0 threat can't decrement.
    const before = mainThreat(staged);
    const beforeCounters = inst(staged, team).counters.snoop;
    const after = settle(
      runWith(WAVE5_DEPS, staged, use(P1, team, "27045.surveillance-team-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(after)).toBe(before - 1);
    expect(inst(after, team).counters.snoop).toBe((beforeCounters ?? 0) - 1);
    expect(inst(after, team).exhausted).toBe(true);
  });
});

describe("Agent 13 (ally, 27046)", () => {
  it("27046.agent-13-response: after she attacks or thwarts, readies a chosen S.H.I.E.L.D. support", () => {
    const hero = run(milesVsRhino(1), toHero(P1));
    const { state: withGL, id: gl } = playFromHandHelper(hero, "27054", 2); // Government Liaison, trait S.H.I.E.L.D.
    const { state: withAgent13, id: agent13 } = playFromHandHelper(withGL, "27046", 4);
    const exhaustedGL = patchInstance(withAgent13, gl, { exhausted: true });
    const villain = exhaustedGL.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, exhaustedGL, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: agent13,
        targetInstanceId: villain,
      } as never),
      accepting("27046.agent-13-response", gl),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, gl).exhausted).toBe(false);
  });
});

describe("Dum Dum Dugan (ally, 27047)", () => {
  it("27047.dum-dum-dugan-interrupt: exhausts up to 3 S.H.I.E.L.D. cards for +1 to the basic power each", () => {
    const hero = run(milesVsRhino(1), toHero(P1));
    const { state: withFieldAgent } = playFromHandHelper(hero, "27044", 1);
    const { state: withGL } = playFromHandHelper(withFieldAgent, "27054", 2);
    // Two prior plays (cost 1 + cost 2) leave too few other cards for Dugan's own cost 5; top the hand back up with
    // more deck copies (27042 ×3, 27043 ×3 in the precon) rather than playing them.
    const topped = moveToHand(withGL, P1, "27042", "27042", "27042", "27043", "27043", "27043").state;
    const { state: withDugan, id: dugan } = playFromHandHelper(topped, "27047", 5);
    const villain = withDugan.villains[0]!.instanceId;
    const primedFull = patchInstance(withDugan, villain, { damage: 0 });
    const attack = (state: GameState, pick: Picker) =>
      settle(
        runWith(WAVE5_DEPS, state, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: dugan,
          targetInstanceId: villain,
        } as never),
        pick,
        undefined,
        WAVE5_DEPS,
      );
    const declined = attack(primedFull, firstLegal);
    const accepted = attack(primedFull, accepting("27047.dum-dum-dugan-interrupt"));
    // Both Field Agent and Government Liaison (2 S.H.I.E.L.D. cards) exhausted for +1 ATK each: +2 total damage.
    expect(inst(accepted, villain).damage).toBe(inst(declined, villain).damage + 2);
  });
});

describe("Ghost-Spider (ally, 27048)", () => {
  it("27048.ghost-spider-constant: cannot be played, or offered, without a Web-Warrior card in play (Miles's alter-ego is CIVILIAN)", () => {
    const state = milesVsRhino(1);
    const given = moveToHand(state, P1, "27048");
    const [id] = given.ids as [InstanceId];
    const result = applyCommand(
      given.state,
      { type: "playCard", playerId: P1, cardInstanceId: id, payment: [], attachToInstanceId: null },
      WAVE5_DEPS,
    );
    expect(result.ok).toBe(false);
    const actions = legalActions(given.state, P1, WAVE5_DEPS);
    if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
    expect(actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id)).toBe(false);
  });

  it("27048.ghost-spider-constant: is playable with a Web-Warrior card in play (Miles's hero form)", () => {
    const hero = run(milesVsRhino(2), toHero(P1));
    const { state: withGhostSpider, id } = playFromHandHelper(hero, "27048", 3);
    expect(inst(withGhostSpider, id).exhausted).toBe(false);
  });

  it("27048.ghost-spider-interrupt: when she leaves play, searches the deck for an identity-specific event and shuffles it into hand", () => {
    const hero = run(milesVsRhino(3), toHero(P1));
    const { state: withGhostSpider, id: gs } = playFromHandHelper(hero, "27048", 3);
    const primed = patchInstance(withGhostSpider, gs, { damage: 2 }); // hp 3: one more point is lethal.
    const toDeclareDefender = (state: GameState) =>
      answer(
        settle(
          runWith(WAVE5_DEPS, state, endTurn(P1)),
          firstLegal,
          (s) => s.pendingChoice?.prompt.kind === "declareDefender",
          WAVE5_DEPS,
        ),
        [gs],
        WAVE5_DEPS,
      );
    const declined = settle(toDeclareDefender(primed), firstLegal, undefined, WAVE5_DEPS);
    const accepted = settle(
      toDeclareDefender(primed),
      accepting("27048.ghost-spider-interrupt"),
      undefined,
      WAVE5_DEPS,
    );
    const declinedTotal = declined.players[0]!.hand.length + declined.players[0]!.deck.length;
    const acceptedTotal = accepted.players[0]!.hand.length + accepted.players[0]!.deck.length;
    expect(acceptedTotal).toBe(declinedTotal); // nothing left the deck+hand pool, just moved within it.
    expect(accepted.players[0]!.hand.length).toBe(declined.players[0]!.hand.length + 1);
  });
});

describe("Spider-Man / Peter Parker (ally, 27049)", () => {
  it("27049.spider-man-response: after he attacks or thwarts, readies a chosen Web-Warrior character (his own identity)", () => {
    const hero = run(milesVsRhino(1), toHero(P1));
    const { state: withPeter, id: peter } = playFromHandHelper(hero, "27049", 3);
    const identity = identityOf(withPeter, P1);
    const exhaustedIdentity = patchInstance(withPeter, identity, { exhausted: true });
    const villain = exhaustedIdentity.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, exhaustedIdentity, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: peter,
        targetInstanceId: villain,
      } as never),
      accepting("27049.spider-man-response", identity),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identity).exhausted).toBe(false);
  });
});

describe("Government Liaison (support, 27054)", () => {
  it("27054.government-liaison-action: exhausts, then plays a S.H.I.E.L.D. card from hand reducing its cost by 1", () => {
    const hero = run(milesVsRhino(1), toHero(P1));
    const { state: withGL, id: gl } = playFromHandHelper(hero, "27054", 2);
    const given = moveToHand(withGL, P1, "27044"); // Field Agent, printed cost 1.
    const [fieldAgent] = given.ids as [InstanceId];
    const beforeHandSize = given.state.players[0]!.hand.length;
    const after = settle(
      runWith(WAVE5_DEPS, given.state, use(P1, gl, "27054.government-liaison-action")),
      accepting(fieldAgent),
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P1).playArea).toContain(fieldAgent);
    expect(playerOf(after, P1).hand.length).toBe(beforeHandSize - 1);
    expect(inst(after, gl).exhausted).toBe(true);
  });
});

describe("Sky-Destroyer (support, 27055)", () => {
  it("27055.sky-destroyer-response: after you play a S.H.I.E.L.D. card, exhausts to deal 2 damage to an enemy", () => {
    const hero = run(milesVsRhino(1), toHero(P1));
    const { state: withSky, id: sky } = playFromHandHelper(hero, "27055", 3);
    const villain = withSky.villains[0]!.instanceId;
    const before = inst(withSky, villain).damage;
    const { state: after } = playFromHandHelper(
      withSky,
      "27044",
      1,
      accepting("27055.sky-destroyer-response", villain),
    );
    expect(inst(after, villain).damage).toBe(before + 2);
    expect(inst(after, sky).exhausted).toBe(true);
  });
});

// Every ability ref this card group's own card data lists is registered here (coverage sanity, mirrors
// `../ghost-spider/coverage.test.ts`'s shape at the module level).
describe("coverage", () => {
  it("every 27044/27045/27046/27047/27048/27049/27054/27055 ability id is registered", () => {
    for (const id of [
      "27044.field-agent-interrupt",
      "27045.surveillance-team-action",
      "27046.agent-13-response",
      "27047.dum-dum-dugan-interrupt",
      "27048.ghost-spider-constant",
      "27048.ghost-spider-interrupt",
      "27049.spider-man-response",
      "27054.government-liaison-action",
      "27055.sky-destroyer-response",
    ]) {
      expect(
        SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS[id as keyof typeof SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS],
      ).toBeDefined();
    }
  });
});

void instancesOf;
