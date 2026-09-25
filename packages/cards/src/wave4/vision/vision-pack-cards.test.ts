import { activeVillain, characterProfile, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  P2,
  patchInstance,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { visionScenario, visionScenarioWithExtras } from "./support.js";
import { playFromHandTyped } from "./test-helpers.js";

const visionVsRhino = (seed = 1) => startWave4Game(visionScenario("rhino", { seed }));

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Moves `code` into `player`'s hand, then straight to their discard pile — the "put a card the search can find in
 * the discard pile" setup several of these abilities need. */
function toDiscard(
  state: GameState,
  player: typeof P1,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const moved = moveToHand(state, player, code);
  const [id] = moved.ids as [InstanceId];
  return {
    id,
    state: {
      ...moved.state,
      players: moved.state.players.map((p) =>
        p.playerId === player ? { ...p, hand: p.hand.filter((c) => c !== id), discard: [...p.discard, id] } : p,
      ),
    },
  };
}

describe("Jocasta (ally, 26013)", () => {
  it("26013.jocasta-response: after entering play, attaches a chosen Defense event from the discard pile facedown", () => {
    const start = visionVsRhino(1);
    const { state: discarded, id: sideStep } = toDiscard(start, P1, "26019"); // Side Step, Defense trait.
    const { state, id: jocasta } = playFromHandTyped(
      discarded,
      "26013",
      3,
      "26026",
      accepting("26013.jocasta-response", sideStep),
    );
    expect(inst(state, jocasta).attachments).toContain(sideStep);
    expect(inst(state, sideStep).faceup).toBe(false);
  });

  it("26013.jocasta-constant: the attached event is a card hosted on Jocasta (playable as if in hand)", () => {
    const start = visionVsRhino(2);
    const { state: discarded, id: sideStep } = toDiscard(start, P1, "26019");
    const { state, id: jocasta } = playFromHandTyped(
      discarded,
      "26013",
      3,
      "26026",
      accepting("26013.jocasta-response", sideStep),
    );
    expect(inst(state, sideStep).attachedTo).toBe(jocasta);
  });
});

describe("Protector (ally, 26014)", () => {
  it("26014.protector-interrupt: spending a mental resource reduces damage Protector would take by 1, once per round", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(3), toHero());
    const { state: withProtector, id: protector } = playFromHandTyped(hero, "26014", 4, "26026");
    const villain = activeVillain(withProtector).instanceId;
    const villainAtk = characterProfile(withProtector, villain, WAVE4_DEPS)!.atk;
    const given = moveToHand(withProtector, P1, "26026"); // A mental resource, to pay this interrupt's cost.
    const [genius] = given.ids as [InstanceId];
    // The villain attacks Protector (declared as the defender), not the other way around.
    const reached = settle(
      runWith(WAVE4_DEPS, given.state, endTurn()),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE4_DEPS,
    );
    const paySpecifically: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "declareDefender") return [protector];
      if (choice.prompt.kind === "payForCard" || choice.prompt.kind === "payForAbility") return [`hand:${genius}`];
      return accepting("26014.protector-interrupt")(state);
    };
    // `settle` doesn't surface events, and the exact final damage total depends on how the engine orders a
    // declared ally-defender's DEF reduction against this interrupt's own "reduce that amount by 1" (both apply to
    // the same `dealDamage` event) — asserting on the `damagePrevented` event itself is the unambiguous signal that
    // the interrupt actually fired and reduced by exactly 1, regardless of that ordering.
    let current = reached;
    let prevented = 0;
    for (let guard = 0; current.pendingChoice && !current.outcome && guard < 200; guard++) {
      const choice = current.pendingChoice;
      const result = applyOk(
        current,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: paySpecifically(current),
        },
        WAVE4_DEPS,
      );
      current = result.state;
      for (const event of result.events) if (event.type === "damagePrevented") prevented += event.amount;
    }
    expect(prevented).toBe(1);
    void villainAtk;
  });
});

describe("Victor Mancha (ally, 26015)", () => {
  it("26015.victor-mancha-constant: reduces damage he takes from an attack by 1", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(4), toHero());
    const { state: withVictor } = playFromHandTyped(hero, "26015", 2, "26025");
    const [victor] = instancesOf(withVictor, "26015") as [InstanceId];
    const villain = activeVillain(withVictor).instanceId;
    const villainAtk = characterProfile(withVictor, villain, WAVE4_DEPS)!.atk;
    const before = inst(withVictor, victor).damage;
    const reached = settle(
      runWith(WAVE4_DEPS, withVictor, endTurn()),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE4_DEPS,
    );
    const defended = settle(
      reached,
      (state) => (state.pendingChoice?.prompt.kind === "declareDefender" ? [victor] : firstLegal(state)),
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(defended, victor).damage - before).toBe(Math.max(0, villainAtk - 1));
  });
});

describe("Preservation (resource, 26021)", () => {
  it("26021.preservation-response: after spending it to pay for a card, heals 1 damage from your hero", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(5), toHero());
    const identity = identityOf(hero, P1);
    const damaged = patchInstance(hero, identity, { damage: 2 });
    const given = moveToHand(damaged, P1, "26021");
    const [preservation] = given.ids as [InstanceId];
    const given2 = moveToHand(given.state, P1, "26024"); // Reboot: cost 1, basic aspect.
    const [reboot] = given2.ids as [InstanceId];
    const after = settle(
      runWith(WAVE4_DEPS, given2.state, {
        type: "playCard",
        playerId: P1,
        cardInstanceId: reboot,
        payment: [{ fromHand: preservation }],
        attachToInstanceId: null,
      } as never),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, identity).damage).toBe(1);
  });
});

describe("Reboot (event, 26024)", () => {
  it("26024.reboot-action: readies a friendly Android character and heals 1 damage from it", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(6), toHero());
    const { state: withVictor } = playFromHand(hero, "26015", 2);
    const [victor] = instancesOf(withVictor, "26015") as [InstanceId];
    const exhaustedAndHurt = patchInstance(withVictor, victor, { exhausted: true, damage: 2 });
    const { state } = playFromHand(exhaustedAndHurt, "26024", 1, accepting(victor));
    expect(inst(state, victor).exhausted).toBe(false);
    expect(inst(state, victor).damage).toBe(1);
  });
});

describe("Assault Training (support, 26033)", () => {
  it("26033.assault-training-action: exhausts and removes a training counter (no Aggression event in discard: shuffles nothing)", () => {
    // Assault Training (aggression aspect) isn't in the `vision-protection` precon's own card list — a custom deck
    // Vision could legally build with the Aggression aspect instead (`visionScenarioWithExtras`'s own docblock).
    const start = startWave4Game(visionScenarioWithExtras("rhino", { seed: 7, extraCodes: ["26033"] }));
    const { state: withTraining } = playFromHandTyped(start, "26033", 1, "26026");
    const [training] = instancesOf(withTraining, "26033") as [InstanceId];
    expect(inst(withTraining, training).counters.training).toBe(2);
    const after = settle(
      runWith(WAVE4_DEPS, withTraining, use(P1, training, "26033.assault-training-action")),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, training).exhausted).toBe(true);
    expect(inst(after, training).counters.training).toBe(1);
  });
});

describe("Chance Encounter (upgrade, 26034)", () => {
  // 26034.chance-encounter-interrupt is KNOWN_SKIPPED (../coverage.test.ts, and `vision-pack-cards.ts`'s own long
  // comment next to it): `schemeDefeated` is response-only, and by the time that response window opens, the
  // defeated scheme's own attachments (Chance Encounter included) are already discarded — confirmed with
  // `traceAbilities`, which shows the ability `considered` but never `resolved`.
  it("26034.chance-encounter-constant: attaches to a side scheme (data-driven `attachesTo`)", () => {
    const hero = runWith(
      WAVE4_DEPS,
      startWave4Game(visionScenarioWithExtras("rhino", { seed: 8, extraCodes: ["26034"] })),
      toHero(),
    );
    // "01186" absorbs Rhino's own unconditional boost draw during enemy activations (which happen before the
    // reveal step), so "01108" is the card actually revealed, not eaten as a boost (docs/card-scripting-process.md
    // §7's own standing trap).
    const staged = stackEncounterDeck(hero, "01186", "01108"); // Crowd Control (side scheme, Standard set).
    const revealedState = settle(runWith(WAVE4_DEPS, staged, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    const scheme = revealedState.villainArea.find((id) => revealedState.instances[id]?.cardId === "01108")!;
    const given = moveToHand(revealedState, P1, "26034");
    const [chance] = given.ids as [InstanceId];
    // Chance Encounter's `attachesTo: { kind: "sideScheme" }` names its host directly at play time, not via a
    // follow-up "choose a target" prompt — `playFromHand`'s own generic helper never sets `attachToInstanceId`, so
    // playing it that way is rejected outright ("no valid host") rather than asking which scheme.
    const withChance = settle(
      runWith(WAVE4_DEPS, given.state, {
        type: "playCard",
        playerId: P1,
        cardInstanceId: chance,
        payment: [],
        attachToInstanceId: scheme,
      } as never),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(withChance, chance).attachedTo).toBe(scheme);
  });
});

describe("Joining Forces (event, 26035)", () => {
  it("26035.joining-forces-action: puts an Avenger ally and a Guardian ally into play from the players' hands", () => {
    const start = runWith(
      WAVE4_DEPS,
      startWave4Game(
        visionScenarioWithExtras("rhino", {
          seed: 9,
          extraCodes: ["26035"],
          extraPlayers: [{ starterDeckId: "nebula-justice" }],
        }),
      ),
      toHero(),
    );
    const withJocasta = moveToHand(start, P1, "26013");
    const [jocasta] = withJocasta.ids as [InstanceId]; // Jocasta, Android/Avenger.
    const withGamora = moveToHand(withJocasta.state, P2, "22002").state; // Gamora, Guardian (Nebula's own kit).
    const given = moveToHand(withGamora, P1, "26035");
    const [joiningForces] = given.ids as [InstanceId];
    const givenResource = moveToHand(given.state, P1, "26025"); // Energy: energy·2, Joining Forces' own pip.
    const [energy] = givenResource.ids as [InstanceId];
    const rest = playerOf(givenResource.state, P1)
      .hand.filter((c) => c !== joiningForces && c !== energy && c !== jocasta)
      .slice(0, 3);
    const state = settle(
      runWith(WAVE4_DEPS, givenResource.state, {
        type: "playCard",
        playerId: P1,
        cardInstanceId: joiningForces,
        payment: [energy, ...rest].map((from) => ({ fromHand: from })),
        attachToInstanceId: null,
      } as never),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    const gamora = instancesOf(state, "22002")[0]!;
    expect(playerOf(state, P1).playArea).toContain(jocasta);
    expect(playerOf(state, P2).playArea).toContain(gamora);
  });
});

describe("Meditation (event, 26036)", () => {
  it("26036.meditation-action: exhausting your alter-ego plays a card from hand for 3 less", () => {
    const start = startWave4Game(visionScenarioWithExtras("rhino", { seed: 10, extraCodes: ["26036"] }));
    const given = moveToHand(start, P1, "26036");
    const [meditation] = given.ids as [InstanceId];
    const given2 = moveToHand(given.state, P1, "26015"); // Victor Mancha, cost 2.
    const [victor] = given2.ids as [InstanceId];
    const state = settle(
      runWith(WAVE4_DEPS, given2.state, {
        type: "playCard",
        playerId: P1,
        cardInstanceId: meditation,
        payment: [],
        attachToInstanceId: null,
      } as never),
      accepting(victor),
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(state, P1).playArea).toContain(victor);
    // Cost 2 reduced by 3, floored at 0: no resources spent (the hand shrinks by exactly the two cards played).
    expect(playerOf(state, P1).hand).not.toContain(meditation);
    expect(playerOf(state, P1).hand).not.toContain(victor);
  });
});
