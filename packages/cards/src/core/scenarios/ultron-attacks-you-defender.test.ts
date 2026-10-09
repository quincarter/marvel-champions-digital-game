/**
 * "[enemy] attacks you" in a two-player game, with real cards: Ultron I's "Forced Response: After Ultron attacks you,
 * choose to either place 1 threat on the main scheme or put the top card of your deck into play facedown, engaged with
 * you as a Drone minion" (01134) and Spider-Man's "Interrupt: When the villain attacks you, draw 1 card" (01001a).
 *
 * RRG 1.8 "Defend, Defense" (pp. 15-16): "the 'you' in an ability that triggers 'when [enemy] attacks you' refers to
 * the player against whom the attack initiated, while the 'you' in an ability that triggers 'after [enemy] attacks
 * you' refers to the player whose character defended the attack." Owner ruling 2026-10-09 (docs/phase7-wave8.md §4.1
 * row 91).
 */
import { cardId } from "@mc/content";
import { activeEncounterDeck, type GameState, type PlayerId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { CORE_DEPS } from "../index.js";
import { coreScenario } from "../setup.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  playerOf,
  startCoreGame,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";

const ADVANCE = "01186";
const SPIDER_SENSE = "01001a.spider-sense";
const dronesOf = (state: GameState, player: PlayerId) =>
  playerOf(state, player).playArea.filter((id) => inst(state, id).facedownAs !== null);

/**
 * Iron Man (seat 1) and Spider-Man (seat 2) in hero form against Ultron I, the encounter deck topped with 0-icon boost
 * cards. Both end their turns, and Ultron attacks each in turn.
 */
function villainPhase(defender: (state: GameState, attacked: PlayerId) => string) {
  const start = startCoreGame(
    coreScenario("ultron", {
      players: [{ starterDeckId: "core-iron-man-aggression" }, { starterDeckId: "core-spider-man-justice" }],
      seed: 8,
    }),
  );
  const heroes = withForm(withForm(start, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
  const staged = activeEncounterDeck(heroes)
    .deck.slice(0, 8)
    .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), heroes);
  const ultron = staged.activeVillainId!;
  /** Who chose for Ultron's forced response, and who was offered Spider-Sense, in the order of the attacks. */
  const chose: PlayerId[] = [];
  const sensed: { offeredTo: PlayerId; attacked: PlayerId }[] = [];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    const prompt = choice.prompt;
    if (prompt.kind === "declareDefender" && prompt.attack.enemyInstanceId === ultron) {
      return [defender(s, choice.playerId)];
    }
    if (prompt.kind === "chooseOption") {
      chose.push(choice.playerId);
      // The first attack's choice is a Drone for "you"; the second's is 1 threat, so only one player gains a Drone.
      return [chose.length === 1 ? "1" : "0"];
    }
    if (prompt.kind === "chooseTriggers" && choice.options.some((o) => o.optionId.includes(SPIDER_SENSE))) {
      if (prompt.event.kind !== "enemyAttack") throw new Error("Spider-Sense offered outside an attack");
      sensed.push({ offeredTo: choice.playerId, attacked: prompt.event.attackedPlayerId });
    }
    return firstLegal(s);
  };
  const before = { p1: dronesOf(staged, P1).length, p2: dronesOf(staged, P2).length };
  const { state } = driveEventsPicking(CORE_DEPS, staged, pick, endTurn(P1), endTurn(P2));
  const gained = { p1: dronesOf(state, P1).length - before.p1, p2: dronesOf(state, P2).length - before.p2 };
  return { chose, sensed, gained };
}

describe("Ultron I (01134), 'After Ultron attacks you', in a two-player game", () => {
  it("nobody defends: each attacked player chooses for the attack on them", () => {
    const result = villainPhase(() => "decline");
    expect(result.chose).toEqual([P1, P2]);
    expect(result.gained).toEqual({ p1: 1, p2: 0 });
  });

  it("each player defends their own attack: still the attacked player", () => {
    const result = villainPhase((s, attacked) => identityOf(s, attacked));
    expect(result.chose).toEqual([P1, P2]);
    expect(result.gained).toEqual({ p1: 1, p2: 0 });
  });

  it("the other player's hero defends: the defending player chooses, and the Drone is theirs (RRG p. 16)", () => {
    const result = villainPhase((s, attacked) => {
      const other = identityOf(s, attacked === P1 ? P2 : P1);
      return s.pendingChoice!.options.some((o) => o.optionId === other) ? other : "decline";
    });
    // Spider-Man defends the attack on Iron Man and Iron Man the attack on Spider-Man.
    expect(result.chose).toEqual([P2, P1]);
    expect(result.gained).toEqual({ p1: 0, p2: 1 });
    // "When the villain attacks you" stays with the player the attack was initiated against: Spider-Sense is offered
    // for the attack on Spider-Man only, though he defended the other one.
    expect(result.sensed).toEqual([{ offeredTo: P2, attacked: P2 }]);
  });
});
