import { activeVillain, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { constant, increaseDamageTaken } from "../../../dsl/index.js";
import { mergeRegistries, validateDefinition } from "../../../dsl/validate.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE6_ABILITIES, WAVE6_DEPS } from "../../index.js";
import { CYCLOPS_EVENTS } from "./events.js";
import { cyclopsGame } from "./support.js";

const hero = (state: GameState) => identityOf(state, P1);
const villainOf = (state: GameState) => activeVillain(state).instanceId;

/** Exploit Weakness's own text (33005) if its module has not landed yet, so the FAQ fixture does not wait for it. */
const EXPLOIT = "33005.exploit-weakness-constant";
const DEPS: EngineDeps =
  EXPLOIT in WAVE6_ABILITIES
    ? WAVE6_DEPS
    : {
        abilities: mergeRegistries(WAVE6_ABILITIES, {
          [EXPLOIT]: constant(increaseDamageTaken({ hostOfSelf: true }, 1, { fromAttack: true })),
        }),
      };

/** Cyclops in hero form; `upgrades` copies of `code` attached to the active villain (read from the hand, then moved). */
function staged(upgrades: number, code = "33005"): GameState {
  let state = withForm(cyclopsGame("rhino", { seed: 3 }), { heroForm: 0 });
  const villain = villainOf(state);
  for (let i = 0; i < upgrades; i += 1) {
    const given = moveToHand(state, P1, code);
    const id = given.ids[0]!;
    state = patchInstance(
      {
        ...given.state,
        players: given.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: p.hand.filter((h) => h !== id) } : p,
        ),
      },
      id,
      { attachedTo: villain },
    );
    state = patchInstance(state, villain, { attachments: [...inst(state, villain).attachments, id] });
  }
  return state;
}

const cast = (state: GameState, code: string, cost: number, pick: Picker = firstLegal, deps = DEPS) => {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0] as InstanceId;
  return settle(runWith(deps, given.state, play(P1, id, payWith(given.state, P1, cost, [id]))), pick, undefined, deps);
};

describe("Cyclops events (33008-33010)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(CYCLOPS_EVENTS).sort()).toEqual([
      "33008.full-blast-interrupt",
      "33009.ricochet-beam-action",
      "33010.tactical-brilliance-action",
    ]);
    for (const definition of Object.values(CYCLOPS_EVENTS)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Ricochet Beam (33009)", () => {
    it("deals 3 to an enemy and 3 to an enemy with an upgrade attached", () => {
      const state = staged(1, "33006");
      const after = cast(state, "33009", 2);
      expect(inst(after, villainOf(state)).damage).toBe(6);
    });
    it("with no upgrade attached anywhere, only the first 3 damage is dealt", () => {
      const state = staged(0);
      const after = cast(state, "33009", 2);
      expect(inst(after, villainOf(state)).damage).toBe(3);
    });
    it("FAQ #9: Exploit Weakness adds 1 to each instance, 8 total on the same enemy", () => {
      const state = staged(1);
      const after = cast(state, "33009", 2);
      expect(inst(after, villainOf(state)).damage).toBe(8);
    });
  });

  describe("Tactical Brilliance (33010)", () => {
    const toDiscard = (state: GameState, code: string) => {
      const given = moveToHand(state, P1, code);
      const id = given.ids[0]!;
      return {
        id,
        state: {
          ...given.state,
          players: given.state.players.map((p) =>
            p.playerId === P1 ? { ...p, hand: p.hand.filter((h) => h !== id), discard: [...p.discard, id] } : p,
          ),
        },
      };
    };
    const withThreat = (state: GameState) => patchInstance(state, state.mainScheme.instanceId, { threat: 6 });
    const threatBefore = (state: GameState) => inst(state, state.mainScheme.instanceId).threat;

    it("removes 3 threat from a scheme and returns a chosen TACTIC card from the discard pile to the hand", () => {
      const base = withThreat(withForm(cyclopsGame("rhino", { seed: 3 }), { heroForm: 0 }));
      const tactic = toDiscard(base, "33006");
      const decoy = toDiscard(tactic.state, "33015");
      const after = cast(decoy.state, "33010", 2, (s) =>
        s.pendingChoice?.options.some((o) => o.optionId === tactic.id) ? [tactic.id] : firstLegal(s),
      );
      expect(inst(after, after.mainScheme.instanceId).threat).toBe(threatBefore(base) - 3);
      expect(playerOf(after, P1).hand).toContain(tactic.id);
      expect(playerOf(after, P1).discard).not.toContain(tactic.id);
      expect(playerOf(after, P1).discard).toContain(decoy.id);
    });

    it("with no TACTIC card in the discard pile it only removes the threat", () => {
      const base = withThreat(withForm(cyclopsGame("rhino", { seed: 3 }), { heroForm: 0 }));
      const handBefore = playerOf(base, P1).hand.length;
      const after = cast(base, "33010", 2);
      expect(inst(after, after.mainScheme.instanceId).threat).toBe(threatBefore(base) - 3);
      expect(playerOf(after, P1).hand).toHaveLength(handBefore - 2);
    });
  });

  describe("Full Blast (33008)", () => {
    const optic = (state: GameState) =>
      use(P1, hero(state), "33001a.cyclops-constant", [{ fromHand: playerOf(state, P1).hand[0]! }]);
    const wantFullBlast: Picker = (s) => {
      const opt = s.pendingChoice?.options.find((o) => o.label.includes("Full Blast"));
      if (opt) return [opt.optionId];
      // Full Blast costs 1: pay with the first card offered.
      return s.pendingChoice?.prompt.kind === "payForCard" ? [s.pendingChoice.options[0]!.optionId] : firstLegal(s);
    };
    const withBlast = (state: GameState) => moveToHand(state, P1, "33008");

    it("adds 8 damage to Optic Blast (3 + 8) for the exhaust cost, which exhausts Cyclops", () => {
      const state = withBlast(staged(1, "33006")).state;
      const exhausted = inst(state, hero(state)).exhausted;
      const after = settle(runWith(DEPS, state, optic(state)), wantFullBlast, undefined, DEPS);
      expect(inst(after, villainOf(state)).damage).toBe(11);
      expect(exhausted).toBe(false);
      expect(inst(after, hero(state)).exhausted).toBe(true);
      expect(playerOf(after, P1).discard.some((id) => String(after.instances[id]!.cardId) === "33008")).toBe(true);
    });

    it("is declined: Optic Blast deals its 3 and Cyclops stays ready", () => {
      const state = withBlast(staged(1, "33006")).state;
      const after = settle(runWith(DEPS, state, optic(state)), firstLegal, undefined, DEPS);
      expect(inst(after, villainOf(state)).damage).toBe(3);
    });

    it("is not offered for a basic attack", () => {
      const state = withBlast(staged(0)).state;
      const offered: string[] = [];
      const spy: Picker = (s) => {
        for (const o of s.pendingChoice?.options ?? []) offered.push(o.label);
        return firstLegal(s);
      };
      settle(
        runWith(DEPS, state, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: hero(state),
          targetInstanceId: villainOf(state),
        }),
        spy,
        undefined,
        DEPS,
      );
      expect(offered.some((l) => l.includes("Full Blast"))).toBe(false);
    });

    it("does nothing while Cyclops is exhausted: Optic Blast deals only its 3", () => {
      let state = withBlast(staged(1, "33006")).state;
      state = patchInstance(state, hero(state), { exhausted: true });
      const after = settle(runWith(DEPS, state, optic(state)), wantFullBlast, undefined, DEPS);
      expect(inst(after, villainOf(state)).damage).toBe(3);
    });
  });
});
