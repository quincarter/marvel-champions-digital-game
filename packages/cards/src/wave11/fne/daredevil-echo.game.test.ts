import { FNE_STARTER_DECKS, PLAYABLE_CARDS } from "@mc/content";
import {
  applyCommand,
  createGame,
  replay,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { playToOutcome } from "../../testing/driver.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  runWith,
  settle,
  type Picker,
} from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { WAVE11_DEPS } from "../index.js";

vi.setConfig({ testTimeout: 600_000 });

/**
 * Wave 11 box game (docs/phase7-wave11.md section 8.4 line 15): the printed Daredevil / Justice (P1) and Echo /
 * Protection (P2) starter decks seated together against Core's Rhino, standard mode, played whole by the greedy driver
 * (testing/driver.ts, which knows no card names). Each game must replay deep-equal and end with no pending prompt.
 *
 * Focused check of the Team-Up event See No Evil, Hear No Evil (60055, Echo's deck): playable only while both Daredevil
 * and Echo are in play (RRG 1.8 "Team-Up" p. 43; here Daredevil's identity is at the table) and, as a Hero Action
 * (attack/thwart), "Choose 2 of the following (you may choose the same option twice): deal 3 damage to an enemy;
 * remove 3 threat from a scheme". The greedy driver may never play it, so that part is staged (hand surgery only).
 */
const SEE_NO_EVIL = "60055";
const ECHO_DECK = FNE_STARTER_DECKS.find((d) => d.id === "fne-echo-protection")!;
const DAREDEVIL_DECK = FNE_STARTER_DECKS.find((d) => d.id === "fne-daredevil-justice")!;

const seatOf = (deck: (typeof FNE_STARTER_DECKS)[number]) => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  deck: deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
});

function newGame(seed: number, seats = [DAREDEVIL_DECK, ECHO_DECK]): GameState {
  const config = coreScenario("rhino", {
    players: seats.map(() => ({ starterDeckId: "core-spider-man-justice" })),
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame({ ...config, players: seats.map(seatOf) }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return created.state;
}

function playGame(seed: number) {
  const initial = newGame(seed);
  const run = playToOutcome(initial, WAVE11_DEPS, { maxCommands: 4000 });
  const replayed = replay(run.session.log, WAVE11_DEPS);
  if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
  let state = run.session.log.initialState;
  const events: GameEvent[] = [];
  for (const command of run.session.log.commands) {
    const result = applyCommand(state, command, WAVE11_DEPS);
    if (!result.ok) throw new Error(`log command refused: ${result.error.message}`);
    state = result.state;
    events.push(...result.events);
  }
  return { run, replayed, events };
}

describe("Daredevil + Echo starter decks against Rhino (standard), greedy driver", () => {
  for (const seed of [3, 11]) {
    it(`seed ${seed}: reaches an outcome, replays deep-equal and leaves no pending prompt`, () => {
      const { run, replayed, events } = playGame(seed);
      expect(run.outcome, `no outcome after ${run.commands} commands`).not.toBeNull();
      expect(run.session.state.pendingChoice).toBeNull();
      expect(replayed.state).toEqual(run.session.state);
      // Both heroes took part: each player's own cards were played.
      const played = events.flatMap((e) => (e.type === "cardPlayed" ? [e] : []));
      expect(played.length).toBeGreaterThan(5);
      const owners = new Set(played.map((e) => inst(run.session.state, e.instanceId as InstanceId).controllerId));
      expect(owners.size, "both players played cards").toBe(2);
    });
  }
});

describe("See No Evil, Hear No Evil (60055), Team-Up with Daredevil and Echo, staged", () => {
  /** Hero form, the card moved to Echo's hand, nothing else changed. */
  const staged = (seats?: Parameters<typeof newGame>[1], owner = P2): GameState => {
    const opened = settle(newGame(1, seats), firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
    const heroes = seats ? seats.map((_, i) => (i === 0 ? P1 : P2)) : [P1, P2];
    const hero = heroes.reduce((s, p) => withForm(s, { heroForm: 0 }, p), opened);
    return moveToHand(hero, owner, SEE_NO_EVIL).state;
  };
  const cardIn = (s: GameState) => playerOf(s, P2).hand.find((i) => inst(s, i).cardId === SEE_NO_EVIL)!;
  const playIt = (s: GameState): Command =>
    play(
      P2,
      cardIn(s),
      playerOf(s, P2)
        .hand.filter((i) => i !== cardIn(s))
        .slice(0, 2),
    );
  const choosing =
    (...wanted: readonly string[]): Picker =>
    (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
      const hits = choice.options.filter((o) => wanted.some((w) => o.optionId.endsWith(w)));
      return hits.length > 0 ? hits.slice(0, choice.maxSelections).map((o) => o.optionId) : firstLegal(s);
    };
  const drive = (s: GameState, pick: Picker): GameState =>
    settle(runWith(WAVE11_DEPS, s, playIt(s)), pick, undefined, WAVE11_DEPS);

  it("is playable with Daredevil at the table; damage option twice deals 6 to the villain", () => {
    const start = staged();
    expect(applyCommand(start, playIt(start), WAVE11_DEPS).ok).toBe(true);
    const villain = start.activeVillainId!;
    const after = drive(start, choosing("0#1", "0#2", villain));
    expect(inst(after, villain).damage).toBe(6);
    expect(after.pendingChoice).toBeNull();
    // Cost 2 was paid by discarding two cards; the event left the hand (Watch and Learn may tuck it under Echo).
    expect(playerOf(after, P2).hand).not.toContain(cardIn(start));
    expect(playerOf(after, P2).hand.length).toBe(playerOf(start, P2).hand.length - 3);
  });

  it("mixes the options: 3 damage to an enemy and 3 threat from a scheme", () => {
    const start = staged();
    const scheme = start.mainScheme.instanceId;
    const villain = start.activeVillainId!;
    const threatened = patchInstance(start, scheme, { threat: 9 });
    const after = drive(threatened, choosing("0#1", "1#2", villain));
    expect(inst(after, villain).damage).toBe(3);
    expect(inst(after, scheme).threat).toBe(6);
  });

  it("is refused when Daredevil is not at the table and not in play (RRG 1.8 Team-Up, p. 43)", () => {
    const alone = staged([ECHO_DECK], P1);
    const id = playerOf(alone, P1).hand.find((i) => inst(alone, i).cardId === SEE_NO_EVIL)!;
    const command = play(
      P1,
      id,
      playerOf(alone, P1)
        .hand.filter((i) => i !== id)
        .slice(0, 2),
    );
    expect(applyCommand(alone, command, WAVE11_DEPS).ok).toBe(false);
  });
});

/** Takes every optional trigger offered; any other prompt gets the first legal answer. */
const accepting: Picker = (s) =>
  s.pendingChoice?.prompt.kind === "chooseTriggers" ? s.pendingChoice.options.map((o) => o.optionId) : firstLegal(s);

function drive(state: GameState, command: Command, pick: Picker = accepting): GameState {
  const first = applyCommand(state, command, WAVE11_DEPS);
  if (!first.ok) throw new Error(first.error.message);
  return settle(first.state, pick, undefined, WAVE11_DEPS);
}

describe("Daredevil + Echo together, staged", () => {
  const RADAR_SENSE = "60005";
  const KNOW_YOUR_ENEMY = "60023"; // Justice event, cost 1, Discount 1 (Martial Artist), "Remove 1 threat" twice
  const REFLEXES = "60040a";
  const table = (): GameState => {
    const opened = settle(newGame(1), firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
    return withForm(withForm(opened, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
  };

  it("a Sense upgrade is heard only by its controller: Echo attacking the enemy does not trigger Daredevil's Radar Sense", () => {
    // Daredevil's Forced/Response text uses "you" = the upgrade's controller (RRG 1.8 "Controller", p. 9).
    const base = table();
    const villain = base.activeVillainId!;
    const id = `u-radar-${villain}` as InstanceId;
    const added = {
      ...base,
      instances: {
        ...base.instances,
        [id]: {
          ...inst(base, identityOf(base, P1)),
          instanceId: id,
          cardId: RADAR_SENSE,
          ownerId: P1,
          controllerId: P1,
          home: { kind: "playArea", playerId: P1 },
          exhausted: false,
          attachedTo: villain,
          attachments: [],
          tucked: [],
        },
      },
    } as never as GameState;
    const worn = patchInstance(added, villain, { attachments: [...inst(added, villain).attachments, id] });
    const attack = (player: typeof P1 | typeof P2): Command => ({
      type: "basicAttack",
      playerId: player,
      attackerInstanceId: identityOf(worn, player),
      targetInstanceId: villain,
    });
    // Echo's attack (ATK 2): Radar Sense is not offered to her; the upgrade stays attached.
    const turn = applyCommand(worn, endTurn(P1), WAVE11_DEPS);
    if (!turn.ok) throw new Error(turn.error.message);
    const echo = drive(turn.state, attack(P2));
    expect(inst(echo, villain).damage).toBe(2);
    expect(inst(echo, villain).attachments).toContain(id);
    // Control: Daredevil's own attack (ATK 2) is answered by Radar Sense for 3 more.
    const daredevil = drive(worn, attack(P1));
    expect(inst(daredevil, villain).damage).toBe(5);
    expect(inst(daredevil, villain).attachments).not.toContain(id);
  });

  it("Watch and Learn tucks Daredevil's played Justice event under Echo, and Photographic Reflexes plays it as printed", () => {
    // Watch and Learn (60037a): "After a player plays an aspect or basic event, tuck that event under here from that
    // player's discard pile." Photographic Reflexes (60040, MC60 FAQ p. 26): play a tucked event as if in hand, -2 cost.
    const base = table();
    const withEvent = moveToHand(base, P1, KNOW_YOUR_ENEMY);
    const eventId = withEvent.ids[0]!;
    const threatened = patchInstance(withEvent.state, base.mainScheme.instanceId, { threat: 9 });
    const played = drive(threatened, play(P1, eventId));
    // Printed: remove 1 threat twice.
    expect(inst(played, base.mainScheme.instanceId).threat).toBe(7);
    expect(inst(played, identityOf(played, P2)).tucked).toEqual([eventId]);
    expect(playerOf(played, P1).discard).not.toContain(eventId);

    const ready = moveToHand(played, P2, REFLEXES);
    const reflexesId = ready.ids[0]!;
    const again = drive(ready.state, play(P2, eventId));
    expect(inst(again, base.mainScheme.instanceId).threat).toBe(5);
    expect(inst(again, identityOf(again, P2)).tucked).toEqual([]);
    expect(playerOf(again, P2).discard).toContain(reflexesId);
    // The event returns to its owner's discard pile, and Watch and Learn does not tuck it a second time.
    expect(playerOf(again, P1).discard).toContain(eventId);
  });
});
