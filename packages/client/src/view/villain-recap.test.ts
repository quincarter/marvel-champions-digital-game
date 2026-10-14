import { beforeAll, describe, expect, test } from "vitest";
import type { GameState, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { villainRecapOf, type VillainRecap } from "./villain-recap.js";
import { appendWalkthrough, emptyWalkthrough, type Walkthrough } from "./villain-walkthrough.js";

interface Played {
  readonly walkthrough: Walkthrough;
  readonly before: GameState;
  readonly after: GameState;
  readonly viewer: PlayerId;
}

/** Ends turns until one whole villain phase has been walked, keeping the state from before the command it began in. */
async function playOnePhase(): Promise<Played> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 2026,
  });
  const viewer = store.state.game!.players[0]!.playerId;
  let walkthrough = emptyWalkthrough(1);
  let before: GameState = store.state.game!;
  let started: GameState | null = null;
  for (let i = 0; i < 80 && !store.state.game!.outcome; i++) {
    const legal = store.state.legal;
    if (!legal) break;
    const prev = store.state.game!;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    } else if (legal.actions.kind === "turn") {
      const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
      if (!end) break;
      await store.dispatch(end.example);
    } else break;
    walkthrough = appendWalkthrough(walkthrough, store.state.lastEvents, store.state.game!, viewer, POOL_DEPS);
    if (walkthrough.activeStep !== null && !started) started = prev;
    if (started && walkthrough.complete) break;
  }
  before = started ?? before;
  return { walkthrough, before, after: store.state.game!, viewer };
}

describe("villainRecapOf", () => {
  let played: Played;
  let recap: VillainRecap;

  beforeAll(async () => {
    played = await playOnePhase();
    recap = villainRecapOf(played.walkthrough, played.before, played.after, played.viewer, POOL_DEPS);
  }, 60_000);

  test("reports the round and all five columns in order", () => {
    expect(recap.round).toBe(1);
    expect(recap.columns.map((c) => c.number)).toEqual([1, 2, 3, 4, 5]);
  });

  test("tiles: scheme threat, the viewer's HP first, the encounter deck, then the highlighted first player", () => {
    expect(recap.changes.map((c) => c.kind)).toEqual(["threat", "hp", "encounterDeck", "firstPlayer"]);
    const [threat, hp, deck, first] = recap.changes;
    expect(threat!.label).toBe(threat!.label.toUpperCase());
    expect(threat!.to!).toBeGreaterThan(threat!.from!);
    expect(threat!.max).not.toBeNull();
    expect(hp!.label).toMatch(/ · YOU$/);
    expect(hp!.max).not.toBeNull();
    if (hp!.from === hp!.to) expect(hp!.note).toBe("NO DAMAGE");
    expect(deck!.to!).toBeLessThan(deck!.from!);
    expect(first).toMatchObject({ label: "FIRST PLAYER", text: "NOW YOU", highlight: true });
  });

  test("a null before-state reads as no change", () => {
    const flat = villainRecapOf(played.walkthrough, null, played.after, played.viewer, POOL_DEPS);
    for (const tile of flat.changes.filter((c) => c.kind !== "firstPlayer")) expect(tile.from).toBe(tile.to);
  });

  test("step 1 holds the threat placed; step 2 one entry per activation with its numbers", () => {
    expect(recap.columns[0]!.entries[0]!.headline).toMatch(/threat/i);
    const activations = recap.columns[1]!.entries;
    expect(activations.length).toBeGreaterThan(0);
    expect(activations[0]!.headline).toMatch(/^Rhino (attacks|schemes against) /);
    expect(activations[0]!.cardInstanceId).not.toBeNull();
    expect(activations[0]!.detail).toMatch(/^(ATK|SCH) \d/);
  });

  test("step 3 says how many each were dealt, with the owners; step 4 has one entry per revealed card", () => {
    const deal = recap.columns[2]!.entries[0]!;
    expect(deal.headline).toBe("1 card each, facedown");
    expect(deal.dealt.map((d) => d.playerId)).toEqual(
      played.walkthrough.encounter.dealt.filter((d) => !d.duringReveal).map((d) => d.playerId),
    );
    const reveals = recap.columns[3]!.entries;
    expect(reveals.map((r) => r.cardInstanceId)).toEqual(
      played.walkthrough.encounter.revealed.map((r) => r.instanceId),
    );
    for (const entry of reveals) {
      expect(entry.headline.length).toBeGreaterThan(0);
      expect(entry.seatIsViewer).toBe(true);
      expect(entry.cardType).not.toBeNull();
    }
  });

  test("step 5 words the token pass as old to new", () => {
    expect(recap.columns[4]!.entries[0]).toMatchObject({ headline: "Token passes", detail: "you → you" });
  });
});
