import { activeEncounterDeck } from "./query.js";
import { withEncounterPiles } from "./testing/scenario.js";
import { flat, type CardId } from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { sessionApply, startSession, type GameSession } from "./engine.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubMainScheme, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, newGame, resolvePending, run, runWith, settle, settleUntil } from "./testing/scenario.js";
import { auditVillainPhases } from "./villain/audit.js";

// Phase 3: who decides on the encounter side's behalf (RRG "First Player"), and the villain-phase audit.
const p1 = playerId("p1");
const p2 = playerId("p2");
const endTurn = (player: PlayerId): Command => ({ type: "endTurn", playerId: player });
const copies = (id: CardId, n = 20): readonly CardId[] => Array.from({ length: n }, () => id);

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(40), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(60), acceleration: flat(0) }],
});

interface Asked {
  readonly kind: string;
  readonly playerId: PlayerId;
  readonly authority: string;
}

/** Answers every choice with its fewest legal options (declining defense), recording who was asked what. */
function settleRecording(state: GameState, deps: EngineDeps, asked: Asked[]): GameState {
  let current = state;
  for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
    if (guard > 200) throw new Error("choices did not settle");
    const choice = current.pendingChoice;
    asked.push({ kind: choice.prompt.kind, playerId: choice.playerId, authority: choice.authority });
    const picks =
      choice.prompt.kind === "declareDefender"
        ? ["decline"]
        : choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
    current = resolvePending(current, picks, deps);
  }
  return current;
}

/** Test surgery: the encounter deck's first cards become copies of `order`, in order. */
function stackEncounter(state: GameState, ...order: readonly CardId[]): GameState {
  const rest = [...activeEncounterDeck(state).deck];
  const top: InstanceId[] = [];
  for (const card of order) {
    const index = rest.findIndex((id) => state.instances[id]?.cardId === card);
    if (index < 0) throw new Error(`no ${card} in the encounter deck`);
    top.push(rest[index] as InstanceId);
    rest.splice(index, 1);
  }
  return withEncounterPiles(state, { deck: [...top, ...rest] });
}

describe("RRG 'First Player': an encounter card with several eligible targets", () => {
  it("an attachment's host is picked by the first player, even when another player revealed it", () => {
    const shackles = stubAttachment({ id: "shackles", attachesTo: { kind: "anyCharacter" } });
    const start = newGame({
      players: 2,
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [shackles],
      encounterDeck: copies(shackles.id),
    });

    const roundOne: Asked[] = [];
    const roundTwo = settleRecording(run(start, endTurn(p1), endTurn(p2)), DEFAULT_DEPS, roundOne);
    const hostPicks = (asked: readonly Asked[]) => asked.filter((a) => a.kind === "chooseAttachmentTarget");
    expect(hostPicks(roundOne)).toEqual([
      { kind: "chooseAttachmentTarget", playerId: p1, authority: "firstPlayerTargets" },
      { kind: "chooseAttachmentTarget", playerId: p1, authority: "firstPlayerTargets" },
    ]);

    // The token has passed: now p2 picks for both reveals, p1's included.
    expect(roundTwo.firstPlayerId).toBe(p2);
    const secondRound: Asked[] = [];
    settleRecording(run(roundTwo, endTurn(p2), endTurn(p1)), DEFAULT_DEPS, secondRound);
    expect(hostPicks(secondRound).map((a) => a.playerId)).toEqual([p2, p2]);
  });

  it("a script's `chooser: firstPlayer` is the first player's pick for the card; a plain 'choose' stays with the resolving player", () => {
    const ability = stubAbility("pick", {
      trigger: { kind: "whenRevealed" },
      effects: [
        {
          kind: "chooseTarget",
          slot: "targeted",
          query: { categories: ["character"] },
          chooser: { kind: "firstPlayer" },
        },
        { kind: "chooseTarget", slot: "chosen", query: { categories: ["character"] }, chooser: { kind: "controller" } },
      ],
    });
    const card = stubTreachery({ id: "pick", boostIcons: 0, abilities: [ability.ref] });
    const deps = depsOf(ability);
    const start = newGame({
      players: 2,
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [card],
      encounterDeck: copies(card.id),
      deps,
    });

    const asked: Asked[] = [];
    settleRecording(runWith(deps, start, endTurn(p1), endTurn(p2)), deps, asked);
    expect(asked.filter((a) => a.kind === "chooseTarget")).toEqual([
      // p1's reveal
      { kind: "chooseTarget", playerId: p1, authority: "firstPlayerTargets" },
      { kind: "chooseTarget", playerId: p1, authority: "player" },
      // p2's reveal: the targeting still goes to the first player; the "choose" is p2's
      { kind: "chooseTarget", playerId: p1, authority: "firstPlayerTargets" },
      { kind: "chooseTarget", playerId: p2, authority: "player" },
    ]);
  });
});

describe("RRG 'First Player': several enemies attacking or scheming from one effect", () => {
  const grunt = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 5, boostIcons: 0 });
  const blank = stubTreachery({ id: "blank", boostIcons: 0 });
  const rally = stubAbility("rally", {
    trigger: { kind: "whenRevealed" },
    effects: [{ kind: "enemyScheme", enemies: { kind: "each", query: { categories: ["minion"] } } }],
  });
  const call = stubTreachery({ id: "call", boostIcons: 0, abilities: [rally.ref] });
  const deps = depsOf(rally);

  it("are ordered by the first player, and resolve one at a time in that order", () => {
    const start = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [grunt, blank, call],
      encounterDeck: [...copies(grunt.id, 2), call.id, ...copies(blank.id, 10)],
      deps,
    });
    // Solo, alter-ego: each round draws the villain's boost card, then deals one card.
    let state = stackEncounter(start, blank.id, grunt.id, blank.id, grunt.id, blank.id, call.id);
    state = settle(runWith(deps, state, endTurn(p1)), defaultPick, deps);
    state = settle(runWith(deps, state, endTurn(p1)), defaultPick, deps);
    const grunts = mustPlayer(state, p1).playArea.filter((id) => state.instances[id]?.cardId === grunt.id);
    expect(grunts).toHaveLength(2);

    const atOrder = settleUntil(runWith(deps, state, endTurn(p1)), "orderEnemies", deps);
    const choice = atOrder.pendingChoice;
    expect(choice?.prompt).toEqual({ kind: "orderEnemies", activation: "scheme" });
    expect(choice?.playerId).toBe(p1);
    expect(choice?.authority).toBe("firstPlayerOrders");
    expect(choice?.ordered).toBe(true);
    expect([...(choice?.options.map((o) => o.optionId) ?? [])].sort()).toEqual([...grunts].sort());

    const reversed = [...(choice?.options.map((o) => o.optionId) ?? [])].reverse();
    let session: GameSession = startSession(atOrder);
    const result = sessionApply(
      session,
      { type: "resolveChoice", playerId: p1, choiceId: choice?.choiceId as never, selectedOptionIds: reversed },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
    const schemed = result.events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyScheme"
        ? [e.event.enemyInstanceId]
        : [],
    );
    expect(schemed).toEqual(reversed);
  });
});

/** Two stub players who only end turns and take the fewest options, for `rounds` rounds. */
function playRounds(state: GameState, rounds: number): GameSession {
  let session = startSession(state);
  for (let guard = 0; guard < 500 && !session.state.outcome; guard++) {
    const current = session.state;
    if (current.round > rounds && current.step.kind === "turn") break;
    const choice = current.pendingChoice;
    const command: Command = choice
      ? {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds:
            choice.prompt.kind === "declareDefender"
              ? ["decline"]
              : choice.options.slice(0, choice.minSelections).map((o) => o.optionId),
        }
      : { type: "endTurn", playerId: current.step.kind === "turn" ? current.step.activePlayerId : p1 };
    const result = sessionApply(session, command);
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
  }
  return session;
}

describe("auditVillainPhases", () => {
  it("replays a log and records each villain phase: threat, activations, boosts, cards dealt and revealed, the token", () => {
    const session = playRounds(newGame({ players: 2 }), 3);
    const audit = auditVillainPhases(session.log);
    expect(audit.violations).toEqual([]);
    expect(
      audit.phases.map((phase) => [phase.round, phase.firstPlayerId, phase.nextFirstPlayerId, phase.completed]),
    ).toEqual([
      [1, p1, p2, true],
      [2, p2, p1, true],
      [3, p1, p2, true],
    ]);
    const [first] = audit.phases;
    expect(first?.accelerationThreat).toEqual({ placed: 1, expected: 1 });
    expect(first?.playerOrder).toEqual([p1, p2]);
    // Both players are in alter-ego form: the villain schemes against each, in player order.
    expect(first?.activations.map((a) => [a.playerId, a.activation])).toEqual([
      [p1, "scheme"],
      [p2, "scheme"],
    ]);
    expect(first?.boostCards).toHaveLength(2);
    expect(first?.boostCards.every((b) => b.boostIcons === 1)).toBe(true);
    expect(first?.dealt.map((d) => d.playerId)).toEqual([p1, p2]);
    expect(first?.revealed.map((r) => r.playerId)).toEqual([p1, p2]);
    expect(audit.phases[1]?.playerOrder).toEqual([p2, p1]);
  });

  it("reports a command the engine rejects as a replay violation", () => {
    const session = playRounds(newGame({ players: 2 }), 1);
    const step = session.state.step;
    const idle = step.kind === "turn" && step.activePlayerId === p1 ? p2 : p1;
    const audit = auditVillainPhases({ ...session.log, commands: [...session.log.commands, endTurn(idle)] });
    expect(audit.violations.map((v) => v.rule)).toEqual(["replay"]);
  });
});
