/**
 * Elektra's hero events (63006 Acrobatic Prowess, 63007 Killer Blow, 63008 Move Unseen, 63009 Sai Strike) from a
 * real hero-form game against Core's Rhino. Sources: ruling Oct 12, 2026 R2 ("Elektra" is the hero face), Sep 10, 2026
 * R3 (A) (held boost cards), RRG 1.8 "'For Each'" p. 20.
 */
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { ELEKTRA_DEPS, elektraHeroGame, ninjaDeck } from "./elektra.testing.js";
import { ELEKTRA_ELEKTRA_EVENTS as REGISTRY, ELEKTRA_ELEKTRA_EVENTS_SKIPPED as SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

const PROWESS = "63006.acrobatic-prowess-action";
const KILLER_BLOW = "63007.killer-blow-action";
const MOVE_UNSEEN = "63008.move-unseen-action";
const SAI_STRIKE = "63009.sai-strike-action";
const DEPS = { abilities: { ...ELEKTRA_DEPS.abilities, ...REGISTRY } };
const SHOCKER = "01103"; // Core minion without guard, 3 hit points

type Picker = (s: GameState) => readonly string[];
/** Answers a number prompt with `n`, an enemy prompt with `enemy`; everything else as `firstLegal`. */
const answering =
  (n: number, enemy?: InstanceId): Picker =>
  (s) => {
    const c = s.pendingChoice!;
    if (c.prompt.kind === "chooseNumber") return [String(n)];
    const hit = enemy ? c.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === enemy) : undefined;
    return hit ? [hit.optionId] : firstLegal(s);
  };

function played(state: GameState, code: string, cost: number, pick: Picker) {
  const given = moveToHand(state, P1 as PlayerId, code);
  const id = given.ids[0]!;
  const run = driveEventsPicking(DEPS, given.state, pick, play(P1, id, payWith(given.state, P1, cost, [id])));
  return { state: run.state, id };
}
const villainOf = (s: GameState) => s.activeVillainId as InstanceId;

describe("elektra/elektra/events registry", () => {
  it("registers only valid definitions, all hero actions, and skips none", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual([PROWESS, KILLER_BLOW, MOVE_UNSEEN, SAI_STRIKE].sort());
    for (const [id, d] of Object.entries(REGISTRY)) {
      expect(validateDefinition(d), id).toEqual([]);
      expect(d.trigger, id).toMatchObject({ kind: "action", form: "hero" });
    }
  });
});

describe(`${PROWESS}: ready Elektra and give her a facedown boost card`, () => {
  it("readies her and she holds one facedown card for her next basic power", () => {
    const base = elektraHeroGame();
    const tired = patchInstance(base, identityOf(base), { exhausted: true });
    const { state } = played(tired, "63006", 1, firstLegal);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    const held = inst(state, identityOf(state)).boostCards.filter((b) => inst(state, b).heldForBasicPowers === true);
    expect(held.length).toBe(1);
  });
});

describe(`${KILLER_BLOW}: up to 5 damage; a defeat shuffles a Ninja card into the encounter deck`, () => {
  it("5 damage to the villain, no defeat: the Ninja deck is untouched", () => {
    const base = elektraHeroGame();
    const { state } = played(base, "63007", 2, answering(5, villainOf(base)));
    expect(inst(state, villainOf(state)).damage).toBe(5);
    expect(ninjaDeck(state).length).toBe(ninjaDeck(base).length);
  });
  it("the player picks the amount: 2 damage", () => {
    const base = elektraHeroGame();
    const { state } = played(base, "63007", 2, answering(2, villainOf(base)));
    expect(inst(state, villainOf(state)).damage).toBe(2);
  });
  it("defeating a minion shuffles the top Ninja card in", () => {
    const base = engageMinion(elektraHeroGame(), SHOCKER, "shock");
    const { state } = played(base, "63007", 2, answering(5, "shock" as InstanceId));
    expect(ninjaDeck(state).length).toBe(ninjaDeck(base).length - 1);
  });
  it("a minion left alive shuffles nothing", () => {
    const base = engageMinion(elektraHeroGame(), SHOCKER, "shock");
    const { state } = played(base, "63007", 2, answering(2, "shock" as InstanceId));
    expect(inst(state, "shock" as InstanceId).damage).toBe(2);
    expect(ninjaDeck(state).length).toBe(ninjaDeck(base).length);
  });
});

describe(`${MOVE_UNSEEN}: remove up to 4 threat, then shuffle a Ninja card in`, () => {
  it("removes the chosen amount (3 of the 4) and shuffles one Ninja card", () => {
    const base = elektraHeroGame();
    const { state } = played(base, "63008", 2, answering(3));
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(1);
    expect(ninjaDeck(state).length).toBe(ninjaDeck(base).length - 1);
  });
  it("shuffles the Ninja card even when 0 threat is removed", () => {
    const base = elektraHeroGame();
    const { state } = played(base, "63008", 2, answering(0));
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(4);
    expect(ninjaDeck(state).length).toBe(ninjaDeck(base).length - 1);
  });
});

describe(`${SAI_STRIKE}: 3 damage, then a Ninja card for each Elektra's Sai you control`, () => {
  it("with no Sai: 3 damage and no shuffle", () => {
    const base = elektraHeroGame();
    const { state } = played(base, "63009", 1, answering(0, villainOf(base)));
    expect(inst(state, villainOf(state)).damage).toBe(3);
    expect(ninjaDeck(state).length).toBe(ninjaDeck(base).length);
  });
  it("with two Sai: two Ninja cards, one shuffle each", () => {
    const one = stagedInPlay(elektraHeroGame(), "63012", { attach: true });
    const two = stagedInPlay(one.state, "63012", { attach: true });
    const { state } = played(two.state, "63009", 1, answering(0, villainOf(two.state)));
    expect(inst(state, villainOf(state)).damage).toBe(3);
    expect(ninjaDeck(state).length).toBe(ninjaDeck(two.state).length - 2);
  });
});
