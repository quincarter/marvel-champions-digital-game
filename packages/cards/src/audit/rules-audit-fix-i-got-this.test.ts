/**
 * "I Got This" (44021), FFG ruling #176 (post-RRG 1.5): the icons in play are checked when the card is played, and the
 * bullets then resolve in the order the player chooses. A bullet whose icon has since left play still resolves.
 */
import { cardId } from "@mc/content";
import { createGame, type CardInstance, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, firstLegal, inst, moveToHand, payWith, play, settle, type Picker } from "../testing/harness.js";
import { driveEventsPicking, withForm } from "../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../wave7/index.js";

vi.setConfig({ testTimeout: 120_000 });

const DEPS = WAVE7_DEPS;
const CROWD_CONTROL = "01108"; // side scheme, crisis icon
const BOMB_SCARE = "01109"; // side scheme, acceleration icon

function stage(): GameState {
  const config = wave7Scenario("stryfe", {
    players: [{ starterDeckId: "deadpool-pool" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
  });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const ready = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  const hero = withForm(ready, { heroForm: 0 }, P1);
  // No side scheme at all: Stryfe's Grasp (a crisis icon) would be one more crisis icon.
  return { ...hero, villainArea: [] };
}

function withScheme(state: GameState, code: string, threat: number): { state: GameState; id: InstanceId } {
  const id = `i-got-this-${code}` as InstanceId;
  const scheme = {
    instanceId: id,
    cardId: cardId(code),
    ownerId: null,
    controllerId: null,
    home: { kind: "activeEncounterDeck" },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
  } as unknown as CardInstance;
  return {
    id,
    state: { ...state, villainArea: [...state.villainArea, id], instances: { ...state.instances, [id]: scheme } },
  };
}

/** Plays the event; the player puts the last-offered option first and aims the threat removal at `scheme`. */
function playReversed(state: GameState, scheme: InstanceId) {
  const prompts: { kind: string; options: string[]; ordered?: boolean }[] = [];
  const pick: Picker = (s) => {
    const choice = s.pendingChoice;
    if (!choice) return [];
    const prompt = choice.prompt as { kind: string; slot?: string };
    prompts.push({ kind: prompt.kind, options: choice.options.map((o) => o.optionId) });
    if (prompt.kind === "chooseOption") return choice.options.map((o) => o.optionId).reverse();
    if (prompt.kind === "chooseTarget" && prompt.slot === "scheme") return [scheme];
    return firstLegal(s);
  };
  const given = moveToHand(state, P1, "44021");
  const id = given.ids[0]!;
  const paid = payWith(given.state, P1, 1, [id]);
  const driven = driveEventsPicking(DEPS, given.state, pick, play(P1, id, paid));
  return { ...driven, prompts };
}

const indexOf = (events: readonly GameEvent[], match: (e: GameEvent) => boolean): number => events.findIndex(match);

describe('"I Got This" (44021): ruling #176, the player orders the bullets and the icons are read on play', () => {
  it("the player chooses the order: threat removal first, then the damage", () => {
    const a = withScheme(stage(), CROWD_CONTROL, 3);
    const b = withScheme(a.state, BOMB_SCARE, 5);
    const r = playReversed(b.state, b.id);
    expect(r.prompts.some((p) => p.kind === "chooseOption")).toBe(true);
    const removed = indexOf(r.events, (e) => e.type === "threatRemoved");
    const damaged = indexOf(r.events, (e) => e.type === "damageDealt");
    expect(removed).toBeGreaterThanOrEqual(0);
    expect(damaged).toBeGreaterThan(removed);
  });

  it("an icon that leaves play mid-resolution does not skip its bullet (checked on play)", () => {
    const a = withScheme(stage(), CROWD_CONTROL, 2);
    const b = withScheme(a.state, BOMB_SCARE, 5);
    // Acceleration first, aimed at the 2-threat crisis scheme: it is defeated, and its crisis bullet still resolves.
    const r = playReversed(b.state, a.id);
    expect(r.state.villainArea).not.toContain(a.id);
    expect(inst(r.state, r.state.villains[0]!.instanceId).damage).toBe(3);
  });
});
