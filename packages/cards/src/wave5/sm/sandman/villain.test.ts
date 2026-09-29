import { encounterSetId } from "@mc/content";
import {
  activeEncounterDeck,
  activeVillain,
  createGame,
  type GameEvent,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  applyOk,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  picking,
  playerOf,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
  endTurn,
  P1,
} from "../../../testing/harness.js";
import { runWave5, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

/** Ghost-Spider's own real precon against Sandman, with Bomb Scare standing in for the box's own Down to Earth
 * modular (not scripted yet, docs/phase7-wave5.md §2.2) — the shared final report's own "already-scripted modular"
 * substitution. */
const sandmanGame = (overrides: Partial<GameSetupConfig> = {}, seed = 1) => {
  const config = ghostSpiderScenario("sandman", { seed, modularSetIds: [encounterSetId("bomb_scare")] });
  const created = createGame({ ...config, ...overrides }, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
};

const CITY_STREETS = () => "27065";
const cityStreetsCounters = (state: ReturnType<typeof sandmanGame>) =>
  inst(state, instancesOf(state, CITY_STREETS())[0]!).counters["sand"] ?? 0;

describe("Sandman (27061-27063): Sand Blast / Sand Wave", () => {
  it("27061.sandman-constant: Sandman (I) attacks undefended; that attack is indirect damage to identity, and Surging Sands resolves", () => {
    const state = sandmanGame();
    const before = cityStreetsCounters(state); // 4 from setup
    expect(before).toBe(4);
    const deckBefore = activeEncounterDeck(state).discard.length;
    // Assault (01187, Core's Standard set, included in every `sm` scenario's deck): "When Revealed (Hero): The
    // villain attacks you." Declines every defense (`firstLegal`), so the attack is undefended.
    const after = settle(
      runWave5(stackEncounterDeck(state, "01187"), toHero(P1), endTurn(P1)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identityOf(after)).damage).toBeGreaterThanOrEqual(2); // Sandman (I)'s ATK 2, indirect
    // Surging Sands placed 1 more sand counter (4 -> 5) and discarded 5 cards from the top of the encounter deck.
    expect(cityStreetsCounters(after)).toBe(5);
    expect(activeEncounterDeck(after).discard.length).toBeGreaterThanOrEqual(deckBefore + 5);
  });

  it("27062.when-revealed: Sandman (II) starting stage resolves Surging Sands at setup (expert start)", () => {
    const state = sandmanGame({ villainStartStageIndex: 1, villainLastStageIndex: 1 });
    expect(activeVillain(state).stageIndex).toBe(1);
    // Setup put 4 sand counters on City Streets, then Sandman (II)'s own When Revealed (entering play as the
    // starting stage fires it, `core/scenarios/rhino.ts`'s own expert-start precedent) resolved Surging Sands once.
    expect(cityStreetsCounters(state)).toBe(5);
  });

  it("27063.when-revealed + sandman-constant: Sandman (III) places a sand counter, resolves Surging Sands, and his attack gains overkill", () => {
    const state = sandmanGame({ villainStartStageIndex: 2, villainLastStageIndex: 2 });
    expect(activeVillain(state).stageIndex).toBe(2);
    // 4 (setup) + 1 (When Revealed's own counter) + 1 (Surging Sands' own counter) = 6.
    expect(cityStreetsCounters(state)).toBe(6);
    const deckBefore = activeEncounterDeck(state).discard.length;
    const after = settle(
      runWave5(stackEncounterDeck(state, "01187"), toHero(P1), endTurn(P1)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    // Sand Wave: the attack gains overkill; undefended, so the whole 3 ATK lands on identity and Surging Sands
    // resolves again (6 -> 7), discarding 7 more cards.
    expect(inst(after, identityOf(after)).damage).toBeGreaterThanOrEqual(3);
    expect(cityStreetsCounters(after)).toBe(7);
    expect(activeEncounterDeck(after).discard.length).toBeGreaterThanOrEqual(deckBefore + 7);
  });
});

/** Puts P1's copy of the ally `code` into play under P1's control (test surgery). */
function allyIntoPlay(start: GameState, code: string): { readonly state: GameState; readonly ally: InstanceId } {
  const found = moveToHand(start, P1, code);
  const ally = found.ids[0]!;
  const seat = playerOf(found.state, P1);
  const state: GameState = {
    ...found.state,
    players: found.state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: seat.hand.filter((id) => id !== ally), playArea: [...seat.playArea, ally] } : p,
    ),
  };
  return { state: patchInstance(state, ally, { controllerId: P1, faceup: true }), ally };
}

/**
 * "If your identity takes any amount of damage from that attack" on an indirect attack (docs/phase7-wave5.md §4.1
 * Q65): the attacked player divides Sand Blast's indirect damage among the characters they control (RRG 1.8 "Indirect
 * Damage", p. 24), and Surging Sands resolves only if the identity's share was actually taken.
 */
describe("Sandman (I) (27061): Sand Blast reads the identity's own share of the indirect damage", () => {
  const SPIDER_UK = "27012"; // Ghost-Spider precon ally, 5 HP: room for all of Sand Blast's 2.

  /** Hero form, Spider-UK in play; Sandman's boost card is Advance (0 boost icons), so the attack is his ATK 2. */
  function atSandBlast(surgingSandsExpected: boolean, tough = false) {
    const withAlly = allyIntoPlay(sandmanGame(), SPIDER_UK);
    const ally = withAlly.ally;
    let state = withAlly.state;
    const identity = identityOf(state);
    if (tough) state = patchInstance(state, identity, { statuses: { ...inst(state, identity).statuses, tough: 1 } });
    // P1's dealt encounter card is the other Advance too, so nothing else touches City Streets: it comes right after
    // the boost card, or after the 5 cards Surging Sands discards (4 setup counters + 1) when it is expected to resolve.
    const discarded = surgingSandsExpected ? ["01112", "01110", "01111", "01190", "01189"] : [];
    state = stackEncounterDeck(state, "01186", ...discarded, "01186");
    const prompt = settleUntil(
      runWave5(state, toHero(P1), endTurn(P1)),
      "assignIndirectDamage",
      firstLegal,
      WAVE5_DEPS,
    );
    expect(prompt.pendingChoice?.prompt).toMatchObject({ kind: "assignIndirectDamage", amount: 2 });
    return { state: prompt, ally, identity, sand: cityStreetsCounters(prompt) };
  }

  /**
   * Assigns `toIdentity` of the 2 points to the identity and the rest to Spider-UK, then declines everything optional
   * until the attack (and its end-of-attack Surging Sands) is off the stack. `identity`/`ally` are the damage Sandman
   * himself dealt on the way, so the encounter card P1 is dealt afterwards doesn't blur it.
   */
  function assign(at: ReturnType<typeof atSandBlast>, toIdentity: number) {
    const choice = at.state.pendingChoice!;
    const options = choice.options.map((o) => o.optionId);
    let selected: readonly string[] = [
      ...options.filter((o) => o.startsWith(`${at.identity}#`)).slice(0, toIdentity),
      ...options.filter((o) => o.startsWith(`${at.ally}#`)).slice(0, 2 - toIdentity),
    ];
    const attacking = (s: GameState) => s.stack.some((f) => f.kind === "event" && f.event.kind === "enemyAttack");
    let state = at.state;
    const events: GameEvent[] = [];
    while (state.pendingChoice && attacking(state)) {
      const pending = state.pendingChoice;
      const step = applyOk(
        state,
        { type: "resolveChoice", playerId: pending.playerId, choiceId: pending.choiceId, selectedOptionIds: selected },
        WAVE5_DEPS,
      );
      state = step.state;
      events.push(...step.events);
      selected = firstLegal(state);
    }
    const sandman = activeVillain(at.state).instanceId;
    const taken = (id: InstanceId) =>
      events.reduce(
        (sum, e) =>
          e.type === "damageDealt" && e.sourceInstanceId === sandman && e.targetInstanceId === id
            ? sum + e.amount
            : sum,
        0,
      );
    return { state, identity: taken(at.identity), ally: taken(at.ally) };
  }

  it("all of it on the identity: Surging Sands resolves", () => {
    const at = atSandBlast(true);
    const after = assign(at, 2);
    expect(after).toMatchObject({ identity: 2, ally: 0 });
    expect(cityStreetsCounters(after.state)).toBe(at.sand + 1);
  });

  it("all of it on an ally: the identity takes none, so Surging Sands does not resolve", () => {
    const at = atSandBlast(false);
    const after = assign(at, 0);
    expect(after).toMatchObject({ identity: 0, ally: 2 });
    expect(cityStreetsCounters(after.state)).toBe(at.sand);
  });

  it("split between the identity and an ally: Surging Sands resolves", () => {
    const at = atSandBlast(true);
    const after = assign(at, 1);
    expect(after).toMatchObject({ identity: 1, ally: 1 });
    expect(cityStreetsCounters(after.state)).toBe(at.sand + 1);
  });

  it("the identity's share absorbed by its tough status card is not taken: Surging Sands does not resolve", () => {
    const at = atSandBlast(false, true);
    const after = assign(at, 2);
    expect(after).toMatchObject({ identity: 0, ally: 0 });
    expect(inst(after.state, at.identity).statuses.tough).toBe(0);
    expect(cityStreetsCounters(after.state)).toBe(at.sand);
  });
});

/**
 * Sand Wave's overkill (docs/phase7-wave5.md §4.1 Q65): an ally that defends and is defeated spills the excess onto its
 * controller's identity (RRG 1.8 "Overkill", p. 31), which is damage the identity takes from that attack, though the
 * ally was the attacked character.
 */
describe("Sandman (III) (27063): Sand Wave's overkill spill is damage your identity takes", () => {
  /** Stage III (6 sand counters) attacks with Advance (0 boost icons) as his boost card: ATK 3, into `allyCode` defending. */
  function sandWaveDefendedBy(allyCode: string, surgingSandsExpected: boolean) {
    const start = sandmanGame({ villainStartStageIndex: 2, villainLastStageIndex: 2 });
    const { state, ally } = allyIntoPlay(start, allyCode);
    // As `atSandBlast`: P1 is dealt the other Advance, after the 7 cards Surging Sands discards (6 + 1) if it resolves.
    const discarded = surgingSandsExpected ? ["01112", "01110", "01111", "01190", "01189", "27072", "27130"] : [];
    const stacked = stackEncounterDeck(state, "01186", ...discarded, "01186");
    const sand = cityStreetsCounters(stacked);
    const after = settle(runWave5(stacked, toHero(P1), endTurn(P1)), picking(ally), undefined, WAVE5_DEPS);
    return { after, ally, sand };
  }

  it("Silk (2 HP) defends and is defeated: 1 spills onto the identity, so Surging Sands resolves", () => {
    const { after, ally, sand } = sandWaveDefendedBy("27010", true);
    expect(playerOf(after, P1).discard).toContain(ally);
    expect(inst(after, identityOf(after)).damage).toBe(1);
    expect(cityStreetsCounters(after)).toBe(sand + 1);
  });

  it("Spider-UK (5 HP) defends and survives: nothing spills, so Surging Sands does not resolve", () => {
    const { after, ally, sand } = sandWaveDefendedBy("27012", false);
    expect(inst(after, ally).damage).toBe(3);
    expect(inst(after, identityOf(after)).damage).toBe(0);
    expect(cityStreetsCounters(after)).toBe(sand);
  });
});
