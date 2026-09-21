/**
 * The log is built from a real Core game's events, not hand-written fixtures,
 * so it is exercised against the shapes the engine actually emits.
 */

import { activeVillain } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import type { GameEvent, GameState, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { appendEvents, emptyLog, logLine, type LogState } from "./log-lines.js";

/** Plays a real Rhino solo game far enough to produce a villain phase. */
async function playedGame(): Promise<{ log: LogState; state: GameState; viewer: PlayerId }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 2026,
  });

  let log = emptyLog();
  const viewer = store.state.game!.players[0]!.playerId;
  const record = (): void => {
    log = appendEvents(log, store.state.lastEvents, store.state.game!, viewer, POOL_DEPS);
  };
  record();

  for (let step = 0; step < 60 && !store.state.game!.outcome; step++) {
    const legal = store.state.legal;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    } else if (legal.actions.kind === "turn") {
      const entry = legal.actions.legal.find((e) => e.action.kind === "endTurn") ?? legal.actions.legal[0];
      if (!entry) break;
      await store.dispatch(entry.example);
    } else break;
    record();
  }

  return { log, state: store.state.game!, viewer };
}

describe("game log", () => {
  let played: Awaited<ReturnType<typeof playedGame>>;

  beforeAll(async () => {
    played = await playedGame();
  }, 60_000);

  test("produces readable beats with round references", () => {
    const { lines } = played.log;

    expect(lines.length).toBeGreaterThan(5);
    for (const line of lines) {
      expect(line.ref).toMatch(/^R\d+\.\d+$/);
      expect(line.text.length).toBeGreaterThan(0);
      // No line may leak an engine id: those are the bookkeeping we drop.
      expect(line.text).not.toMatch(/\b(inst|frame|choice)-\d+/);
    }
  });

  test("addresses the perspective seat in the second person and names the rest", () => {
    const mine = played.log.lines.find((line) => line.text.startsWith("You "));
    expect(mine).toBeDefined();
  });

  test("numbers beats within a round and restarts them on the next round", () => {
    const byRound = new Map<number, string[]>();
    for (const line of played.log.lines) {
      byRound.set(line.round, [...(byRound.get(line.round) ?? []), line.ref]);
    }
    for (const [round, refs] of byRound) {
      // Beats are 1-based and strictly increasing inside a round.
      const beats = refs.map((ref) => Number(ref.split(".")[1]));
      expect(beats[0], `round ${round}`).toBe(round === 0 ? beats[0] : 1);
      for (let i = 1; i < beats.length; i++) expect(beats[i]).toBe(beats[i - 1]! + 1);
    }
  });

  test("drops engine bookkeeping rather than printing an engine trace", () => {
    const noisy: GameEvent[] = [
      { type: "framePushed", frameId: "frame-1" as never, frame: "event", description: "x" },
      { type: "framePopped", frameId: "frame-1" as never, frame: "event" },
      { type: "targetChosen", slot: "target", instanceIds: [] },
      { type: "abilityUseRecorded", instanceId: "inst-1" as never, abilityId: "a" as never, uses: 1 },
    ];

    for (const event of noisy) {
      expect(logLine(event, played.state, played.viewer, POOL_DEPS), event.type).toBeNull();
    }
  });

  test("a spent Tough is struck through, so a 0-damage hit never looks like a bug", () => {
    const beat = logLine(
      { type: "damagePrevented", targetInstanceId: activeVillain(played.state).instanceId, amount: 3, reason: "tough" },
      played.state,
      played.viewer,
      POOL_DEPS,
    );

    expect(beat).not.toBeNull();
    expect(beat!.tags).toEqual([{ status: "tough", spent: true }]);
    expect(beat!.text).toContain("took 0 damage");
  });

  test("a status being given is tagged, not struck", () => {
    const beat = logLine(
      { type: "statusGiven", instanceId: activeVillain(played.state).instanceId, status: "stunned" },
      played.state,
      played.viewer,
      POOL_DEPS,
    );

    expect(beat!.tags).toEqual([{ status: "stunned", spent: false }]);
  });

  /**
   * The scheme half of the villain's breakdown (`schemeResolved`, RRG 1.8 "Scheme (Enemy Activation)", p. 39 and
   * "Boost", p. 11), worded the same way the attack half already is: total first, then each term.
   */
  test("a scheme activation reads like the attack breakdown, with the threat term only when something changed it", () => {
    const villain = activeVillain(played.state).instanceId;
    const scheme = played.state.mainScheme.instanceId;

    const plain = logLine(
      {
        type: "schemeResolved",
        enemyInstanceId: villain,
        schemeInstanceId: scheme,
        baseSch: 1,
        boostIcons: 2,
        threatBonus: 0,
        threatPlaced: 3,
      },
      played.state,
      played.viewer,
      POOL_DEPS,
    );
    expect(plain!.text).toContain("schemed for 3 threat");
    expect(plain!.text).toContain("(SCH 1 + 2 boost)");
    expect(plain!.voice).toBe("villain");

    const reduced = logLine(
      {
        type: "schemeResolved",
        enemyInstanceId: villain,
        schemeInstanceId: scheme,
        baseSch: 1,
        boostIcons: 2,
        threatBonus: -1,
        threatPlaced: 2,
      },
      played.state,
      played.viewer,
      POOL_DEPS,
    );
    expect(reduced!.text).toContain("(SCH 1 + 2 boost − 1 threat)");
  });

  /** A player card (Attacrobatics, Target Acquired) cancelling a boost card mid-activation (RRG 1.8 "Boost", p. 11). */
  test("a cancelled boost card says which part was cancelled", () => {
    const villain = activeVillain(played.state).instanceId;

    const icons = logLine(
      { type: "boostCancelled", instanceId: villain, scope: "icons" },
      played.state,
      played.viewer,
      POOL_DEPS,
    );
    expect(icons!.text).toContain("boost icons are cancelled");
    expect(icons!.voice).toBe("player");

    const ability = logLine(
      { type: "boostCancelled", instanceId: villain, scope: "ability" },
      played.state,
      played.viewer,
      POOL_DEPS,
    );
    expect(ability!.text).toContain("Boost ability is cancelled");
  });

  /**
   * RRG 1.8 "Unique Icon". The board shows no change when an entry is refused,
   * so the log line is the only thing that stops it reading as a bug — the same
   * reason `threatRemovalBlocked` earns a line.
   */
  test("a refused unique entry says what blocked it, and whether the card was discarded", () => {
    const villain = activeVillain(played.state).instanceId;
    const scheme = played.state.mainScheme.instanceId;

    const noEffect = logLine(
      {
        type: "uniqueEntryBlocked",
        instanceId: scheme,
        cardId: played.state.instances[scheme]!.cardId,
        matchedInstanceId: villain,
        disposition: "noEffect",
      },
      played.state,
      played.viewer,
      POOL_DEPS,
    );
    expect(noEffect!.text).toContain("can't enter play");
    expect(noEffect!.text).not.toContain("discarded");

    const discarded = logLine(
      {
        type: "uniqueEntryBlocked",
        instanceId: scheme,
        cardId: played.state.instances[scheme]!.cardId,
        matchedInstanceId: villain,
        disposition: "discarded",
      },
      played.state,
      played.viewer,
      POOL_DEPS,
    );
    expect(discarded!.text).toContain("is discarded");
    expect(discarded!.voice).toBe("scenario");
  });

  test("keeps only the most recent lines so the list never grows without bound", () => {
    const many: GameEvent[] = Array.from({ length: 30 }, (_u, i) => ({ type: "roundStarted", round: i + 1 }));
    const capped = appendEvents(emptyLog(), many, played.state, played.viewer, POOL_DEPS, 10);

    expect(capped.lines).toHaveLength(10);
    expect(capped.lines.at(-1)!.text).toContain("Round 30");
    // Ids stay unique across the trim, so a virtualized list can key on them.
    expect(new Set(capped.lines.map((line) => line.id)).size).toBe(10);
  });

  test("stays quiet for a resolved ability with nothing to say — no printed label, no cost, not a Special", () => {
    const deps = { abilities: { "test.bare": { trigger: { kind: "response" }, effects: [] } as never } };
    const beat = logLine(
      {
        type: "abilityResolved",
        instanceId: activeVillain(played.state).instanceId,
        abilityId: "test.bare" as never,
        controllerId: played.viewer,
      },
      played.state,
      played.viewer,
      deps,
    );
    expect(beat).toBeNull();
  });
});

/**
 * Doctor Strange's Invocation deck (PLAN.md Phase 7 wave 1, reported
 * 2026-09-16: "the Special doesn't seem to be firing, or I can't tell"). The
 * engine was already right (`packages/cards/src/wave1/drs/doctor-strange
 * .test.ts`); the client simply never said anything happened. This plays a
 * real Doctor Strange game exactly the way the Board does (`SessionStore` +
 * `legalActions`' own example), the same setup `view/board-model-invocation
 * .test.ts` already proved reaches the Invocation deck.
 */
describe("game log: abilityResolved", () => {
  test("names an Invocation card's Special, and the hero action that paid for it — not just that a card left the deck", async () => {
    const store = new SessionStore(new LocalEngineHost());
    // Seed 3 deals Master of the Mystic Arts (09005) into the opening hand (see `board-model-invocation.test.ts`'s
    // own note on this seed).
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "drs-protection" }],
      seed: 3,
    });
    for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
      const { choice } = store.state.legal.actions as {
        choice: { options: readonly { optionId: string }[]; minSelections: number };
      };
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    }
    let legal = store.state.legal!.actions;
    if (legal.kind === "turn") {
      const flip = legal.legal.find((e) => e.action.kind === "changeForm");
      if (flip) await store.dispatch(flip.example);
    }

    legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const playMota = legal.legal.find(
      (entry) =>
        entry.action.kind === "playCard" && store.state.game!.instances[entry.action.instanceId]?.cardId === "09005",
    );
    if (!playMota) throw new Error("expected Master of the Mystic Arts to be playable");
    let log = emptyLog();
    await store.dispatch(playMota.example);
    log = appendEvents(log, store.state.lastEvents, store.state.game!, store.state.perspectiveId, POOL_DEPS);

    // A "choose a target" (Seven Rings of Raggadorr) or similar decision may follow the Special resolving — the
    // same generic answer `board-model-invocation.test.ts` uses.
    let afterLegal = store.state.legal?.actions;
    while (afterLegal?.kind === "choice") {
      await store.resolveChoice(
        afterLegal.choice.options.slice(0, afterLegal.choice.minSelections).map((option) => option.optionId),
      );
      log = appendEvents(log, store.state.lastEvents, store.state.game!, store.state.perspectiveId, POOL_DEPS);
      afterLegal = store.state.legal?.actions;
    }

    const texts = log.lines.map((line) => line.text);
    // Whichever Invocation card was on top, its Special is named — never left silent because it has no printed
    // ability label of its own (RRG "Special" is the only name it has).
    expect(texts.some((text) => text.endsWith(" — Special."))).toBe(true);
    // The hero action that paid for it is named too, by the engine's own cost terms (`ability-label.ts`).
    expect(texts).toContain("Master of the Mystic Arts — pay a card's printed cost.");
  });
});
