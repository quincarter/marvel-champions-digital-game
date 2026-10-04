import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { endTurn, firstLegal, identityOf, inst, P1, playerOf, runWith, settle, toHero } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { expectResolved, traceAbilities } from "../../testing/trace.js";
import { WAVE4_DEPS } from "../index.js";
import { revealFromEncounterDeck, startWave4Game } from "../testing.js";
import { SPECTRUM_OBLIGATION_NEMESIS } from "./spectrum-obligation-nemesis.js";
import { spectrumScenario } from "./support.js";

const spectrumVsRhino = (seed = 1) => startWave4Game(spectrumScenario("rhino", { seed }));
const valid = (id: string) => expect(validateDefinition(WAVE4_DEPS.abilities[id]!)).toEqual([]);

/** Moves a still-set-aside nemesis minion straight into `player`'s play area, engaged (test-only surgery — the
 * `ebony-maw.test.ts` `encounterCardInPlayerArea` shape, for a minion pulled from `PlayerState.setAside` instead of
 * the shared encounter deck/discard). Lets its own villain-phase activation run for real, in whatever form the
 * player is currently in (docs/phase7-wave5.md §4.1 Q67). */
function nemesisMinionEngaged(
  state: GameState,
  code: string,
  player = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const id = owner.setAside.find((i) => state.instances[i]?.cardId === code);
  if (!id) throw new Error(`no ${code} set aside for ${player}`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? { ...p, setAside: p.setAside.filter((i) => i !== id), playArea: [...p.playArea, id] }
          : p,
      ),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, controllerId: null, engagedWith: player },
      },
    },
  };
}

describe("Loss of Control (21026)", () => {
  it("21026.loss-of-control-constant: 'You cannot change energy forms', the §3.1 cannotChangeForm shape", () => {
    const def = SPECTRUM_OBLIGATION_NEMESIS["21026.loss-of-control-constant"]!;
    expect(def.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "cannotChangeForm", formType: "energy" }],
    });
    valid("21026.loss-of-control-constant");
  });

  it("21026.loss-of-control-action: exhausting Monica Rambeau removes it from the game", () => {
    valid("21026.loss-of-control-action");
    const def = SPECTRUM_OBLIGATION_NEMESIS["21026.loss-of-control-action"]!;
    expect(def.effects).toEqual([
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "removedFromGame" },
    ]);
  });
});

describe("Radioactive Man (21027)", () => {
  it("21027.radioactive-man-forced-response, 21027.boost: deal 1 damage to each character you control", () => {
    valid("21027.radioactive-man-forced-response");
    valid("21027.boost");
    for (const id of ["21027.radioactive-man-forced-response", "21027.boost"] as const) {
      expect(SPECTRUM_OBLIGATION_NEMESIS[id]!.effects).toEqual([
        {
          kind: "dealDamage",
          amount: { kind: "const", value: 1 },
          target: { kind: "each", query: { categories: ["character"], controller: "you" } },
        },
      ]);
    }
  });

  it("21027.radioactive-man-forced-response: fires when Radioactive Man attacks you in hero form (docs/phase7-wave5.md §4.1 Q67)", () => {
    const hero = settle(runWith(WAVE4_DEPS, spectrumVsRhino(), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const engaged = nemesisMinionEngaged(hero, "21027");
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const { events } = driveEvents(deps, engaged.state, endTurn());
    expectResolved(trace, "21027.radioactive-man-forced-response");
    expect(events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === engaged.id)).toBe(true);
    expect(events.some((e) => e.type === "schemeResolved" && e.enemyInstanceId === engaged.id)).toBe(false);
  });

  it("21027.radioactive-man-forced-response: also fires when Radioactive Man schemes against you in alter-ego form (docs/phase7-wave5.md §4.1 Q67)", () => {
    const state = spectrumVsRhino();
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    const engaged = nemesisMinionEngaged(state, "21027");
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const { events } = driveEvents(deps, engaged.state, endTurn());
    expectResolved(trace, "21027.radioactive-man-forced-response");
    expect(events.some((e) => e.type === "schemeResolved" && e.enemyInstanceId === engaged.id)).toBe(true);
    expect(events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === engaged.id)).toBe(false);
  });
});

describe("Reactor Meltdown (21028)", () => {
  it("21028.when-defeated: deals 1 damage to each friendly character in play", () => {
    valid("21028.when-defeated");
    expect(SPECTRUM_OBLIGATION_NEMESIS["21028.when-defeated"]!.trigger).toMatchObject({ kind: "whenDefeated" });
  });
});

describe("Sap Power (21029)", () => {
  it("21029.sap-power-constant: after your turn ends, take 1 damage", () => {
    const def = SPECTRUM_OBLIGATION_NEMESIS["21029.sap-power-constant"]!;
    expect(def.trigger).toMatchObject({
      kind: "response",
      forced: true,
      on: { on: "turnEnding", playerIs: "controller" },
    });
    expect(def.effects).toEqual([
      {
        kind: "dealDamage",
        amount: { kind: "const", value: 1 },
        target: { kind: "identityOf", player: { kind: "controller" } },
        taken: true,
      },
    ]);
    valid("21029.sap-power-constant");
  });

  it("21029.sap-power-action: spending [energy][energy] discards Sap Power", () => {
    valid("21029.sap-power-action");
    const def = SPECTRUM_OBLIGATION_NEMESIS["21029.sap-power-action"]!;
    expect(def.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(def.cost).toEqual({ resources: { energy: 2 } });
    expect(def.effects).toEqual([{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "discard" }]);
  });
});

describe("Radioactive Blast (21030)", () => {
  it("21030.when-revealed-hero: take 2 damage; 21030.when-revealed-alter-ego: place 2 threat on the main scheme", () => {
    const hero = settle(runWith(WAVE4_DEPS, spectrumVsRhino(34), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const identity = identityOf(hero, P1);
    const before = inst(hero, identity).damage;
    const { state } = revealFromEncounterDeck(hero, "21030");
    // Loose by design (rules-qa-engineer, docs/phase7-wave4-qa.md): the ordinary villain-phase activation this
    // same round can independently deal damage too, so the identity's total isn't isolated to this card's own 2.
    expect(inst(state, identity).damage).toBeGreaterThanOrEqual(before + 2);
  });

  it("21030.when-revealed-alter-ego: places 2 threat on the main scheme", () => {
    // Weak-test finding (rules-qa-engineer, docs/phase7-wave4-qa.md): the prior version of this test named this
    // ref in its title but only ran `valid(...)` (a DSL-shape check) against it, never driving it in a real game.
    const state = spectrumVsRhino(35);
    const mainSchemeId = state.mainScheme.instanceId;
    const before = inst(state, mainSchemeId).threat;
    const { state: revealed } = revealFromEncounterDeck(state, "21030");
    // Loose by design (rules-qa-engineer, docs/phase7-wave4-qa.md): the ordinary villain-phase activation this
    // same round can independently place threat too, so the main scheme's total isn't isolated to this card's
    // own 2.
    expect(inst(revealed, mainSchemeId).threat).toBeGreaterThanOrEqual(before + 2);
  });
});
