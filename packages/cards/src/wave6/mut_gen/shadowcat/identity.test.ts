import { cardId } from "@mc/content";
import {
  applyCommand,
  replay,
  startSession,
  sessionApply,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  applyOk,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  playerOf,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { engageMinion } from "../project-wideawake-testing.js";
import { WAVE6_DEPS } from "../../index.js";
import { SHADOWCAT_IDENTITY } from "./identity.js";
import { shadowcatGame } from "./support.js";

const SOLID_ID = cardId("32031a");
const identity = (state: GameState) => identityOf(state, P1);
const solid = (state: GameState): InstanceId => instancesOf(state, "32031a")[0]!;
const isPhased = (state: GameState) => inst(state, solid(state)).flipped;
const phaseControl = (state: GameState) => use(P1, identity(state), "32030b.kitty-pryde-constant");

/** Accepts every optional trigger offered; chooses the identity as defender when asked (`defend`). */
const accepting =
  (defend = true): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
    if (choice?.prompt.kind === "declareDefender") return defend ? [identity(state)] : ["decline"];
    return firstLegal(state);
  };
const declining: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "declareDefender") return [identity(state)];
  return firstLegal(state);
};

/** One command, then every prompt answered with `pick`; the events of the whole chain. */
function drive(state: GameState, command: Command, pick: Picker = accepting()) {
  const events: GameEvent[] = [];
  let current = state;
  const first = applyOk(current, command, WAVE6_DEPS);
  current = first.state;
  events.push(...first.events);
  for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
    if (guard > 100) throw new Error("choices did not settle");
    const choice = current.pendingChoice;
    const next = applyOk(
      current,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: pick(current) },
      WAVE6_DEPS,
    );
    current = next.state;
    events.push(...next.events);
  }
  return { state: current, events };
}

/** Shadowcat in hero form, the mass form Solid or Phased, and the once-per-round flip fresh. */
function asHero(phased = false, scenario = "rhino"): GameState {
  const start = shadowcatGame(scenario);
  // Phase Control is printed on the alter-ego face, so it is used before changing to hero form.
  const ready = phased ? drive(start, phaseControl(start)).state : start;
  return drive(ready, toHero(P1)).state;
}
const attackVillain = (state: GameState): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identity(state),
  targetInstanceId: state.villains[0]!.instanceId,
});
const ignoredEvents = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "keywordIgnored" ? [e.event] : [],
  );
const formChanges = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "formChanged").length;

/** A villain that hits hard enough for a defense to cost hit points. */
const strongVillain = (state: GameState): GameState => {
  const villain = state.cardPool[state.instances[state.villains[0]!.instanceId]!.cardId]!;
  if (villain.type !== "villain") throw new Error("not a villain");
  return {
    ...state,
    cardPool: {
      ...state.cardPool,
      [villain.id]: {
        ...villain,
        sides: villain.sides.map((side) => ({ ...side, stages: side.stages.map((s) => ({ ...s, atk: 9 })) })),
      } as unknown as typeof villain,
    },
  };
};
/** Ends the turn with Kitty defending (the one villain attack), 1 hit-point count back. */
const villainAttacks = (state: GameState, pick: Picker = accepting()) => {
  const staged = stackEncounterDeck(strongVillain(state), "01186", "01186");
  return drive(staged, { type: "endTurn", playerId: P1 }, pick);
};
const damage = (state: GameState) => inst(state, identity(state)).damage;

function expectReplays(state: GameState, commands: readonly Command[], pick: Picker): void {
  let session = startSession(state);
  for (const command of commands) {
    let result = sessionApply(session, command, WAVE6_DEPS);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
    for (let guard = 0; result.session.state.pendingChoice && guard < 100; guard++) {
      const choice = result.session.state.pendingChoice;
      result = sessionApply(
        result.session,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(result.session.state),
        },
        WAVE6_DEPS,
      );
      if (!result.ok) throw new Error(result.error.message);
    }
    session = result.session;
  }
  const replayed = replay(session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

describe("Kitty Pryde / Shadowcat (identity, 32030a/b) and Solid / Phased (32031a/b)", () => {
  it("registers the seven refs the card data names, all valid", () => {
    expect(Object.keys(SHADOWCAT_IDENTITY).sort()).toEqual([
      "32030a.shadowcat-constant",
      "32030b.kitty-pryde-constant",
      "32030b.setup",
      "32031a.solid-resource",
      "32031a.solid-response",
      "32031b.phased-constant",
      "32031b.phased-forced-response",
    ]);
    for (const definition of Object.values(SHADOWCAT_IDENTITY)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("32030b.setup", () => {
    it("puts Solid into play from the set-aside area, Solid side up, attached to her identity", () => {
      const state = shadowcatGame();
      const id = solid(state);
      expect(inst(state, id).flipped).toBe(false);
      expect(inst(state, id).attachedTo).toBe(identity(state));
      const player = playerOf(state, P1);
      expect([...player.deck, ...player.hand, ...player.discard, ...player.setAside]).not.toContain(id);
      expect(state.instances[id]!.cardId).toBe(SOLID_ID);
    });
  });

  describe("32030b.kitty-pryde-constant (Phase Control)", () => {
    it("flips the mass form upgrade to Phased as a mass form change, never the hero/alter-ego flip", () => {
      const state = shadowcatGame();
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
      const { state: after, events } = drive(state, phaseControl(state));
      expect(isPhased(after)).toBe(true);
      expect(formChanges(events)).toBe(1);
      expect(playerOf(after, P1).identity.changedFormThisRound).toBe(false);
      expect(playerOf(after, P1).identity.form).toBe("alterEgo");
      // The once-per-round hero flip is still there to spend.
      const hero = drive(after, toHero(P1)).state;
      expect(playerOf(hero, P1).identity.form).toBe("hero");
    });

    it("is limited to once per round, and the limit stays with the card across hero/alter-ego flips (ruling Jan 26, 2026 (6) #2)", () => {
      const state = shadowcatGame();
      const used = drive(state, phaseControl(state)).state;
      expect(applyCommand(used, phaseControl(used), WAVE6_DEPS).ok).toBe(false);
      // Flip to hero and back to alter-ego within the round: still used up.
      const hero = drive(used, toHero(P1)).state;
      expect(applyCommand(hero, phaseControl(hero), WAVE6_DEPS).ok).toBe(false);
    });
  });

  describe("32031a.solid-resource", () => {
    it("generates one physical resource, for attack and defense events only, as a hero resource", () => {
      const definition = SHADOWCAT_IDENTITY["32031a.solid-resource"];
      expect(definition.trigger).toMatchObject({ kind: "resource", form: "hero" });
      expect(definition.generates).toEqual({ physical: 1 });
      expect(definition.cost).toEqual({ exhaustSelf: true });
      expect(JSON.stringify(definition.generatesFor)).toContain("ATTACK");
      expect(JSON.stringify(definition.generatesFor)).toContain("DEFENSE");
    });
  });

  describe("32031a.solid-response (Solid)", () => {
    it("after she attacks in Solid mass form, offers the flip; accepting it flips to Phased as a form change", () => {
      const state = asHero();
      expect(isPhased(state)).toBe(false);
      const { state: after, events } = drive(state, attackVillain(state), accepting());
      expect(isPhased(after)).toBe(true);
      expect(formChanges(events)).toBe(1);
      expect(playerOf(after, P1).identity.changedFormThisRound).toBe(true); // the earlier hero flip, untouched by this
    });

    it("is optional: declining leaves her Solid", () => {
      const state = asHero();
      const { state: after } = drive(state, attackVillain(state), declining);
      expect(isPhased(after)).toBe(false);
    });

    it("after she defends in Solid mass form, offers the flip", () => {
      const state = asHero();
      const { state: after } = villainAttacks(state);
      expect(damage(after)).toBeGreaterThan(0);
      expect(isPhased(after)).toBe(true);
    });
  });

  describe("32031b.phased-constant and phased-forced-response (Phased)", () => {
    it("while she defends, she cannot take damage; defending flips Phased back to Solid (forced)", () => {
      const state = asHero(true);
      expect(isPhased(state)).toBe(true);
      const { state: after, events } = villainAttacks(state, declining);
      expect(damage(after)).toBe(0);
      expect(isPhased(after)).toBe(false);
      expect(formChanges(events)).toBe(1);
    });

    // A window's candidates are fixed as it opens (docs/phase7-wave6.md §3.79): Solid was not faceup when she attacked
    // in Phased form, so its response does not answer that attack, though Phased's forced flip turns it faceup.
    it("the Solid face that appears from Phased's own flip hears nothing of that same defense or attack", () => {
      const state = asHero(true);
      const first = applyOk(state, attackVillain(state), WAVE6_DEPS);
      expect(isPhased(first.state)).toBe(false);
      expect(first.state.pendingChoice).toBeNull();
    });

    it("the damage prevention covers only defending: she takes damage when she does not defend", () => {
      const state = asHero(true);
      const staged = stackEncounterDeck(strongVillain(state), "01186", "01186");
      const { state: after } = drive(staged, { type: "endTurn", playerId: P1 }, accepting(false));
      expect(damage(after)).toBeGreaterThan(0);
      expect(isPhased(after)).toBe(true); // she did not defend, so nothing flipped it
    });

    it("after she attacks in Phased mass form, the card flips back to Solid (a form change, forced: no prompt for it)", () => {
      const state = asHero(true);
      const { state: after, events } = drive(state, attackVillain(state), declining);
      expect(isPhased(after)).toBe(false);
      expect(formChanges(events)).toBe(1);
    });

    it("her flips never spend the hero/alter-ego once-per-round change", () => {
      const state = shadowcatGame();
      const flipped = drive(state, phaseControl(state)).state; // alter-ego, Phased
      expect(playerOf(flipped, P1).identity.changedFormThisRound).toBe(false);
      const hero = drive(flipped, toHero(P1)).state; // the one change this round
      const attacked = drive(hero, attackVillain(hero), declining).state; // Phased: flips back to Solid, forced
      expect(isPhased(attacked)).toBe(false);
      expect(playerOf(attacked, P1).identity.form).toBe("hero");
      expect(playerOf(attacked, P1).identity.changedFormThisRound).toBe(true); // only the change to hero
    });
  });

  describe("32030a.shadowcat-constant (Selective Intangibility) and Q6", () => {
    const hydra = (state: GameState) => engageMinion(state, "01101");

    it("is a characterIgnores of guard, patrol and the crisis icon on her identity, only while Phased", () => {
      const definition = SHADOWCAT_IDENTITY["32030a.shadowcat-constant"];
      expect(definition.trigger).toMatchObject({ kind: "constant" });
      const [rule] = (definition.trigger as { rules: readonly Record<string, unknown>[] }).rules;
      expect(rule).toMatchObject({ kind: "characterIgnores", ignores: ["guard", "patrol", "crisis"] });
      expect(JSON.stringify(rule!.while)).toContain("Phased");
    });

    // The `keywordIgnored` announcement itself (one event per card ignored, only while an ability listens, Q6) is
    // `packages/engine/src/keyword-ignored.test.ts`; no scripted card listens yet (Acute Control, 32034, is not scripted).
    it("Phased: attacks the villain past an engaged guard minion (the rule applies, nothing listens)", () => {
      const base = asHero(true);
      const { state } = hydra(base);
      const result = drive(state, attackVillain(state), declining);
      expect(inst(result.state, result.state.villains[0]!.instanceId).damage).toBeGreaterThan(0);
    });

    it("Q6: Phased with no guard minion engaged ignores nothing: no event", () => {
      const state = asHero(true);
      const result = drive(state, attackVillain(state), declining);
      expect(inst(result.state, result.state.villains[0]!.instanceId).damage).toBeGreaterThan(0);
      expect(ignoredEvents(result.events)).toEqual([]);
    });

    it("Q6: Phased attacking the guard minion itself ignores nothing", () => {
      const base = asHero(true);
      const { state, id: minion } = hydra(base);
      const result = drive(
        state,
        { type: "basicAttack", playerId: P1, attackerInstanceId: identity(state), targetInstanceId: minion },
        declining,
      );
      expect(ignoredEvents(result.events)).toEqual([]);
    });

    it("Solid: the guard minion stops her attack on the villain", () => {
      const base = asHero(false);
      const { state } = hydra(base);
      expect(applyCommand(state, attackVillain(state), WAVE6_DEPS).ok).toBe(false);
    });
  });

  it("a short game with shadowcat-aggression replays deep-equal", () => {
    const state = asHero(false);
    const commands: Command[] = [attackVillain(state)];
    expectReplays(state, commands, accepting());
    // And across the villain phase with her Phased and defending.
    const phased = asHero(true);
    expectReplays(
      stackEncounterDeck(strongVillain(phased), "01186", "01186"),
      [{ type: "endTurn", playerId: P1 }],
      declining,
    );
  });
});
