import {
  activeEncounterDeckId,
  createGame,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { action, dealDamage, each, query, revealEncounterCard, you } from "../../dsl/index.js";
import { defineAbilities } from "../../dsl/validate.js";
import {
  P1,
  firstLegal,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES, wave7Scenario } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * An ally under 'Pool-ized (44041) is a minion, and its own printed When Defeated then sees it as one: Lady Deadpool
 * (44016, "When Defeated: Defeat a non-ELITE minion.") and Dogpool (44013, "When Defeated: Deal 1 damage to an enemy.").
 * A defeated card is still in play while its When Defeated resolves (RRG 1.8 "When Defeated Abilities", p. 48), and
 * cannot be defeated again (RRG 1.8 "Defeat", p. 15; engine `alreadyDefeated`): Lady Deadpool is no target for her own
 * defeat, and Dogpool, who may still be dealt his own 1 damage, is defeated once.
 *
 * Test doubles: 44003 (cost 0) reveals the top card of the encounter deck, 44004 (cost 0) deals 20 damage to Lady
 * Deadpool as a minion. Every other ability is the shipped one.
 */
const POOLIZED = "44041";
const DOGPOOL = "44013";
const LADY_DEADPOOL = "44016";
const REVEAL = "44003";
const HIT_LADY = "44004";
const LADY_DEFEATED = "44016.when-defeated";
const DOGPOOL_DEFEATED = "44013.when-defeated";

const FIXTURES = defineAbilities({
  "44003.exhausting-personality-action": action(revealEncounterCard(you)),
  "44004.maximum-effort-action": action(dealDamage(20, each(query("minion", { name: "Lady Deadpool" })))),
});
const DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, ...FIXTURES } };

let cached: GameState | undefined;
/** Juggernaut past setup with Deadpool's 'Pool deck, in hero form, no threat on the main scheme. */
function baseGame(): GameState {
  if (cached) return cached;
  const config = wave7Scenario("juggernaut", {
    players: [{ starterDeckId: "deadpool-pool" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
  });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (x) => x.step.phase === "player", DEPS);
  s = patchInstance(s, s.mainScheme.instanceId, { threat: 0 });
  s = withForm(s, { heroForm: 0 }, P1);
  cached = s;
  return s;
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const idOf = (s: GameState, code: string): InstanceId => {
  const hit = (Object.keys(s.instances) as InstanceId[]).find((id) => codeOf(s, id) === code);
  if (!hit) throw new Error(`no ${code}`);
  return hit;
};

/** A copy of `code` from the player's deck, hand or discard put straight into their play area (surgery). */
function allyInPlay(state: GameState, player: PlayerId, code: string): GameState {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const seat = playerOf(given.state, player);
  return {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === player ? { ...p, hand: seat.hand.filter((i) => i !== id), playArea: [...seat.playArea, id] } : p,
    ),
    instances: {
      ...given.state.instances,
      [id]: { ...given.state.instances[id]!, faceup: true, controllerId: player },
    },
  };
}

/** One 'Pool-ized from the set-aside area on top of the encounter deck. */
function poolizedOnTop(state: GameState): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = state.encounterSetAside.find((i) => codeOf(state, i) === POOLIZED);
  if (!id) throw new Error("no 'Pool-ized set aside");
  return {
    ...state,
    encounterSetAside: state.encounterSetAside.filter((i) => i !== id),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: [id, ...pile.deck] } },
  };
}

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** The option labels of each target prompt for `slot`, in the order asked. */
  readonly offered: (slot: string) => readonly (readonly string[])[];
}

/** Plays `code` for 0 from hand; a prompt takes the option whose label starts with the next of `picks`, if offered. */
function playCode(state: GameState, code: string, picks: readonly string[] = []): Run {
  const given = moveToHand(state, P1, code);
  const left = [...picks];
  const asked: { slot: string; labels: readonly string[] }[] = [];
  const pick: Picker = (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTriggers") return [];
    if (choice.prompt.kind === "chooseTarget")
      asked.push({ slot: choice.prompt.slot, labels: choice.options.map((o) => o.label) });
    const hit = left[0] ? choice.options.find((o) => o.label.startsWith(left[0]!)) : undefined;
    if (!hit) return firstLegal(s);
    left.shift();
    return [hit.optionId];
  };
  const { state: after, events } = driveEventsPicking(DEPS, given.state, pick, play(P1, given.ids[0]!));
  return { state: after, events, offered: (slot) => asked.filter((a) => a.slot === slot).map((a) => a.labels) };
}

const defeats = (events: readonly GameEvent[], id: InstanceId): number =>
  events.filter((e) => e.type === "characterDefeated" && e.instanceId === id).length;
const resolutions = (events: readonly GameEvent[], abilityId: string): number =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === abilityId).length;

describe("a 'Pool-ized ally's own When Defeated (44016, 44013) resolves once per defeat", () => {
  it("Lady Deadpool, the only non-ELITE minion: she is not offered as her own target, is defeated once and discarded", () => {
    const staged = playCode(poolizedOnTop(allyInPlay(baseGame(), P1, LADY_DEADPOOL)), REVEAL).state;
    const lady = idOf(staged, LADY_DEADPOOL);
    expect(inst(staged, lady).treatedAs?.kind).toBe("minion");

    const run = playCode(staged, HIT_LADY);
    expect(run.offered("minion")).toEqual([]);
    expect(defeats(run.events, lady)).toBe(1);
    expect(resolutions(run.events, LADY_DEFEATED)).toBe(1);
    expect(run.state.pendingChoice).toBeNull();
    expect(run.state.stack).toEqual([]);
    expect(playerOf(run.state, P1).discard).toContain(lady);
  });

  it("with Dogpool also 'Pool-ized: Lady Deadpool's When Defeated offers only Dogpool; his 1 damage may go to himself, and each is defeated once", () => {
    const allies = allyInPlay(allyInPlay(baseGame(), P1, DOGPOOL), P1, LADY_DEADPOOL);
    // The first 'Pool-ized goes to Lady Deadpool (cost 4), the second to Dogpool (cost 3).
    const once = playCode(poolizedOnTop(allies), REVEAL).state;
    const staged = playCode(poolizedOnTop(once), REVEAL).state;
    const lady = idOf(staged, LADY_DEADPOOL);
    const dogpool = idOf(staged, DOGPOOL);
    expect(inst(staged, lady).treatedAs?.kind).toBe("minion");
    expect(inst(staged, dogpool).treatedAs?.kind).toBe("minion");

    const run = playCode(staged, HIT_LADY, ["Dogpool", "Dogpool"]);
    expect(run.offered("minion")).toEqual([["Dogpool"]]);
    // Damage is not a defeat: the RRG does not make a defeated card in play untargetable, so both stay candidates.
    expect(run.offered("enemy")).toHaveLength(1);
    expect(run.offered("enemy")[0]).toEqual(expect.arrayContaining(["Dogpool", "Lady Deadpool"]));
    expect(defeats(run.events, lady)).toBe(1);
    expect(defeats(run.events, dogpool)).toBe(1);
    expect(resolutions(run.events, LADY_DEFEATED)).toBe(1);
    expect(resolutions(run.events, DOGPOOL_DEFEATED)).toBe(1);
    expect(run.state.stack).toEqual([]);
    expect(playerOf(run.state, P1).discard).toEqual(expect.arrayContaining([lady, dogpool]));
  });
});
