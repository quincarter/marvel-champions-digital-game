import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import { engageMinion } from "../../../wave9/falcon/testing.js";
import { P1, inst, mainThreat, patchInstance, playerOf, type Picker } from "../../../testing/harness.js";
import { IRON_FIST_IRON_FIST_EVENTS as REGISTRY, IRON_FIST_IRON_FIST_EVENTS_SKIPPED as SKIPPED } from "./events.js";
import {
  byLabel,
  chiOf,
  drive,
  ironFistGame,
  pickCard,
  staged,
  takeCounters,
  withChi,
  withTopOfDeck,
} from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

const DEEP_BREATHING = "64002.deep-breathing-action";
const DRAGON_PUNCH = "64003.dragon-punch-action";
const FISTS_OF_FURY = "64004.fists-of-fury-action";
const WAY_OF_THINGS = "64005.the-way-of-things-action";

const villainOf = (s: GameState) => s.activeVillainId as InstanceId;
const codes = (s: GameState, ids: readonly InstanceId[]) => ids.map((id) => inst(s, id).cardId as string);

describe("wave 11 iron_fist/iron-fist/events", () => {
  it("registers only valid definitions and skips none", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual([DEEP_BREATHING, DRAGON_PUNCH, FISTS_OF_FURY, WAY_OF_THINGS].sort());
    for (const id of Object.keys(REGISTRY))
      expect(REGISTRY[id]!.trigger, id).toMatchObject({ kind: "action", form: "hero" });
  });
});

describe(`${DEEP_BREATHING}: discard until an Iron Fist card, add it to hand`, () => {
  it("discards the cards above it and adds the first Iron Fist card to hand", () => {
    const staged1 = staged(ironFistGame(), "64002", 0);
    const state = withTopOfDeck(staged1.state, "01091", "01091", "64005", "64004");
    const command = staged1.command;
    const { state: after } = drive(state, command);
    const hand = codes(after, playerOf(after, P1).hand);
    expect(hand).toContain("64005");
    expect(hand).not.toContain("64004");
    const discard = codes(after, playerOf(after, P1).discard);
    expect(discard.filter((c) => c === "01091").length).toBeGreaterThanOrEqual(2);
    expect(discard).toContain("64002");
  });

  it("a basic card is not an Iron Fist card: it is discarded and the search goes on", () => {
    const staged1 = staged(ironFistGame(), "64002", 0);
    // A basic card (Avengers Mansion) above The Way of Things
    const state = withTopOfDeck(staged1.state, "01091", "64005");
    const command = staged1.command;
    const { state: after } = drive(state, command);
    expect(codes(after, playerOf(after, P1).hand)).toContain("64005");
    expect(codes(after, playerOf(after, P1).discard)).toContain("01091");
  });
});

describe(`${DRAGON_PUNCH}: 2 damage, optionally spend chi for more and a stun`, () => {
  it("with no chi deals 2 and offers nothing more", () => {
    const { state, id, command } = staged(ironFistGame(), "64003", 2);
    const { state: after } = drive(state, command, pickCard(villainOf(state)));
    expect(inst(after, villainOf(after)).damage).toBe(2);
    expect(inst(after, villainOf(after)).statuses.stunned).toBe(0);
    expect(playerOf(after, P1).discard).toContain(id);
  });

  it("declining the option keeps the chi", () => {
    const { state, command } = staged(withChi(ironFistGame(), 4), "64003", 2);
    const { state: after } = drive(state, command, byLabel("Do not", pickCard(villainOf(state))));
    expect(inst(after, villainOf(after)).damage).toBe(2);
    expect(chiOf(after)).toBe(4);
  });

  it("removing 2 chi deals 2 + 4 and does not stun (fewer than 3)", () => {
    const { state, command } = staged(withChi(ironFistGame(), 2), "64003", 2);
    const { state: after } = drive(
      state,
      command,
      byLabel("Remove up to", pickCard(villainOf(state), takeCounters(2))),
    );
    expect(chiOf(after)).toBe(0);
    expect(inst(after, villainOf(after)).damage).toBe(6);
    expect(inst(after, villainOf(after)).statuses.stunned).toBe(0);
  });

  it("removing 5 chi deals 2 + 10 and stuns", () => {
    const { state, command } = staged(withChi(ironFistGame(), 5), "64003", 2);
    const { state: after } = drive(
      state,
      command,
      byLabel("Remove up to", pickCard(villainOf(state), takeCounters(5))),
    );
    expect(chiOf(after)).toBe(0);
    expect(inst(after, villainOf(after)).damage).toBe(12);
    expect(inst(after, villainOf(after)).statuses.stunned).toBe(1);
  });
});

describe(`${DRAGON_PUNCH}: one damage instance`, () => {
  it("a tough enemy takes none of it: 3 chi removed, the tough card is discarded, the enemy is stunned", () => {
    const base = withChi(ironFistGame(), 3);
    const v = villainOf(base);
    const toughened = patchInstance(base, v, { statuses: { ...inst(base, v).statuses, tough: 1 } });
    const { state, command } = staged(toughened, "64003", 2);
    const { state: after } = drive(state, command, byLabel("Remove up to", pickCard(v, takeCounters(3))));
    expect(chiOf(after)).toBe(0);
    expect(inst(after, v).damage).toBe(0);
    expect(inst(after, v).statuses.tough).toBe(0);
    expect(inst(after, v).statuses.stunned).toBe(1);
  });
});

describe(`${FISTS_OF_FURY}: three separate 1-damage instructions`, () => {
  const MERCENARY = "01101"; // Core minion with guard, 3 hit points
  /** Picks `want` when offered, recording which enemies each prompt offered. */
  const recording =
    (want: InstanceId, offers: InstanceId[][]): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      const ids = (choice?.options ?? []).flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId] : []));
      if (choice?.prompt.kind === "chooseTarget") offers.push(ids);
      return pickCard(want)(state);
    };

  it("deals 3 damage in all when one enemy is chosen each time", () => {
    const { state, command } = staged(ironFistGame(), "64004", 1);
    const { state: after } = drive(state, command, pickCard(villainOf(state)));
    expect(inst(after, villainOf(after)).damage).toBe(3);
  });

  it("while a guard minion survives, the villain is never offered", () => {
    const { state, command } = staged(engageMinion(ironFistGame(), MERCENARY, "merc"), "64004", 1);
    const offers: InstanceId[][] = [];
    const { state: after } = drive(state, command, recording("merc" as InstanceId, offers));
    expect(offers.length).toBeGreaterThanOrEqual(2);
    expect(offers[0]).not.toContain(villainOf(state));
    expect(offers[1]).not.toContain(villainOf(state));
    expect(inst(after, villainOf(after)).damage).toBe(0);
  });

  it("a guard minion the first instance defeats frees the villain for the next (Q49)", () => {
    const base = patchInstance(engageMinion(ironFistGame(), MERCENARY, "merc"), "merc" as InstanceId, { damage: 2 });
    const { state, command } = staged(base, "64004", 1);
    const offers: InstanceId[][] = [];
    const { state: after } = drive(state, command, recording("merc" as InstanceId, offers));
    expect(offers[0]).not.toContain(villainOf(state));
    expect(offers[1]).toContain(villainOf(state));
    expect(playerOf(after, P1).playArea).not.toContain("merc");
  });
});

describe(`${WAY_OF_THINGS}: remove 2 threat, optionally 2 chi for 2 more`, () => {
  const withThreat = (s: GameState) => patchInstance(s, s.mainScheme.instanceId, { threat: 10 });

  it("with under 2 chi removes 2 threat and offers nothing more", () => {
    const { state, command } = staged(withThreat(withChi(ironFistGame(), 1)), "64005", 1);
    const { state: after } = drive(state, command);
    expect(mainThreat(after)).toBe(8);
    expect(chiOf(after)).toBe(1);
  });

  it("spending 2 chi removes 2 more threat", () => {
    const { state, command } = staged(withThreat(withChi(ironFistGame(), 3)), "64005", 1);
    const { state: after } = drive(state, command, byLabel("Remove 2 chi"));
    expect(mainThreat(after)).toBe(6);
    expect(chiOf(after)).toBe(1);
  });

  it("declining keeps the chi", () => {
    const { state, command } = staged(withThreat(withChi(ironFistGame(), 3)), "64005", 1);
    const { state: after } = drive(state, command, byLabel("Do not"));
    expect(mainThreat(after)).toBe(8);
    expect(chiOf(after)).toBe(3);
  });
});
