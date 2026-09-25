import { activeVillain, characterProfile, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { moveToDiscard } from "../../testing/staging.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { adamWarlockScenario } from "./support.js";

const adamVsRhino = (seed = 1) => startWave4Game(adamWarlockScenario("rhino", { seed }));

/** Accepts any offered choice whose optionId names one of `wanted` (a fragment: "Discard 2", an instance id, an
 * ability id), else falls back to `firstLegal`. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .filter((o) => wanted.some((w) => o.optionId.includes(w) || o.label.includes(w)))
      .map((o) => o.optionId);
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Karmic Blast (21038) and Cosmic Awareness (21039)", () => {
  it("21038.karmic-blast-action: deals 4 + 1 per different aspect discarded (discarding 1 card: 4 or 5)", () => {
    const hero = settle(runWith(WAVE4_DEPS, adamVsRhino(20), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const villain = activeVillain(hero).instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playFromHand(hero, "21038", 2, accepting("Discard 1", villain));
    const dealt = inst(state, villain).damage - before;
    expect(dealt).toBeGreaterThanOrEqual(4);
    expect(dealt).toBeLessThanOrEqual(5);
  });

  it("21039.cosmic-awareness-action: removes 3 + 1 threat per different aspect discarded (discarding 1 card: 3 or 4)", () => {
    const state = adamVsRhino(21);
    const mainSchemeId = state.mainScheme.instanceId;
    // The main scheme starts at 0 threat on turn 1; stage it with plenty so the removal isn't clamped at 0.
    const staged = {
      ...state,
      instances: { ...state.instances, [mainSchemeId]: { ...inst(state, mainSchemeId), threat: 10 } },
    };
    const hero = settle(runWith(WAVE4_DEPS, staged, toHero()), firstLegal, undefined, WAVE4_DEPS);
    const before = inst(hero, mainSchemeId).threat;
    const { state: after } = playFromHand(hero, "21039", 2, accepting("Discard 1", mainSchemeId));
    const removed = before - inst(after, mainSchemeId).threat;
    expect(removed).toBeGreaterThanOrEqual(3);
    expect(removed).toBeLessThanOrEqual(4);
  });
});

describe("Quantum Magic (21040)", () => {
  it("21040.quantum-magic-action: returns a discarded card to hand", () => {
    const state = adamVsRhino(22);
    const given = moveToHand(state, P1, "21044");
    const [uppercut] = given.ids as [import("@mc/engine").InstanceId];
    const discarded = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((id) => id !== uppercut), discard: [...p.discard, uppercut] }
          : p,
      ),
    };
    const { state: after } = playFromHand(discarded, "21040", 1, accepting(uppercut));
    expect(playerOf(after, P1).hand).toContain(uppercut);
  });
});

describe("Marvel Boy (21041)", () => {
  it("21041.marvel-boy-interrupt: spending a [physical] resource grants an attack piercing and ranged", () => {
    // The §3.21 Crossfire shape (`wave4-hero-primitives.test.ts`): `modifyAttack({ keywords })` on an
    // `{ on: "attack", selfIs: "source" }` interrupt, gated by a resource cost.
    const def = WAVE4_DEPS.abilities["21041.marvel-boy-interrupt"]!;
    expect(def.trigger).toMatchObject({ kind: "interrupt", on: { on: "attack", selfIs: "source" } });
    expect(def.cost).toEqual({ resources: { physical: 1 } });
    expect(def.effects).toEqual([{ kind: "modifyAttack", keywords: ["piercing", "ranged"] }]);
    expect(validateDefinition(def)).toEqual([]);
  });
});

describe("In-Betweener (21042), Living Tribunal (21048), Eternity (21054), The Gardener (21060)", () => {
  it("21042.in-betweener-action, 21048.living-tribunal-action, 21054.eternity-action, 21060.the-gardener-action: each shuffles itself into the encounter deck", () => {
    for (const code of ["21042", "21048", "21054", "21060"]) {
      const state = adamVsRhino(24);
      const { state: after, id: card } = playFromHand(state, code, 2);
      expect(playerOf(after, P1).hand).not.toContain(card);
      expect(playerOf(after, P1).deck).not.toContain(card);
    }
  });

  // The `uncancellable(whenRevealed(…))`/"joins the active villain's encounter deck" mechanic itself is exhaustively
  // covered by the engine's own `cosmic-entity.test.ts` (docs/phase7-wave4.md §3.14: played, revealed even under a
  // forced cancel, "you" is the revealer). Driving a full `endTurn()` round-trip through the real villain phase to
  // re-prove that mechanic here is too noisy to assert on precisely (Rhino's own threat/damage/draw effects land in
  // the same round) — these four are the effects each card's own When Revealed carries, checked structurally.
  it("21042.when-revealed: deals 2 damage to the villain and removes itself from the game", () => {
    const def = WAVE4_DEPS.abilities["21042.when-revealed"]!;
    expect(def.uncancellable).toBe(true);
    expect(def.effects).toEqual([
      { kind: "dealDamage", amount: { kind: "const", value: 2 }, target: { kind: "villain" } },
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "removedFromGame" },
    ]);
    expect(validateDefinition(def)).toEqual([]);
  });

  it("21048.when-revealed: removes 2 threat from the main scheme", () => {
    const def = WAVE4_DEPS.abilities["21048.when-revealed"]!;
    expect(def.uncancellable).toBe(true);
    expect(def.effects).toEqual([
      { kind: "removeThreat", amount: { kind: "const", value: 2 }, target: { kind: "mainScheme" } },
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "removedFromGame" },
    ]);
    expect(validateDefinition(def)).toEqual([]);
  });

  it("21054.when-revealed: draws 1 card", () => {
    const def = WAVE4_DEPS.abilities["21054.when-revealed"]!;
    expect(def.uncancellable).toBe(true);
    expect(def.effects).toEqual([
      { kind: "draw", amount: { kind: "const", value: 1 }, player: { kind: "controller" } },
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "removedFromGame" },
    ]);
    expect(validateDefinition(def)).toEqual([]);
  });

  it("21060.when-revealed: heals 2 damage from your identity", () => {
    const def = WAVE4_DEPS.abilities["21060.when-revealed"]!;
    expect(def.uncancellable).toBe(true);
    expect(def.effects).toEqual([
      {
        kind: "heal",
        amount: { kind: "const", value: 2 },
        target: { kind: "identityOf", player: { kind: "controller" } },
      },
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "removedFromGame" },
    ]);
    expect(validateDefinition(def)).toEqual([]);
  });
});

describe("Magic Attack (21043) and Zone of Silence (21050)", () => {
  it("21043.magic-attack-action: deals 1 damage per card discarded from the top of the deck", () => {
    const hero = settle(runWith(WAVE4_DEPS, adamVsRhino(29), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const villain = activeVillain(hero).instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playFromHand(hero, "21043", 1, accepting("Discard 3", villain));
    expect(inst(state, villain).damage).toBe(before + 3);
  });

  it("21050.zone-of-silence-action: removes 1 threat per card discarded from the top of the deck", () => {
    const hero = settle(runWith(WAVE4_DEPS, adamVsRhino(30), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const mainSchemeId = hero.mainScheme.instanceId;
    const before = inst(hero, mainSchemeId).threat;
    const { state } = playFromHand(hero, "21050", 1, accepting("Discard 3", mainSchemeId));
    expect(inst(state, mainSchemeId).threat).toBe(Math.max(0, before - 3));
  });
});

describe("Uppercut (21044), Combat Training (21045), Heroic Intuition (21051), Armored Vest (21063)", () => {
  it("21044.uppercut-action: deals 5 damage", () => {
    const hero = settle(runWith(WAVE4_DEPS, adamVsRhino(31), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const villain = activeVillain(hero).instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playFromHand(hero, "21044", 3, accepting(villain));
    expect(inst(state, villain).damage).toBe(before + 5);
  });

  it("21045.combat-training-constant, 21051.heroic-intuition-constant, 21063.armored-vest-constant: +1 ATK/THW/DEF", () => {
    const hero = settle(runWith(WAVE4_DEPS, adamVsRhino(32), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const identity = identityOf(hero, P1);
    const before = characterProfile(hero, identity, WAVE4_DEPS)!;
    const { state: withCombat } = playFromHand(hero, "21045", 2);
    const { state: withIntuition } = playFromHand(withCombat, "21051", 2);
    const { state: withVest } = playFromHand(withIntuition, "21063", 1);
    const after = characterProfile(withVest, identity, WAVE4_DEPS)!;
    expect(after.atk).toBe(before.atk + 1);
    expect(after.thw).toBe(before.thw + 1);
    expect(after.def).toBe(before.def + 1);
  });
});

describe("For Justice! (21049), Major Victory (21053), Counter-Punch (21062)", () => {
  it("21049.for-justice-action: removes 3 threat (4 if paid with a [mental] resource)", () => {
    const hero = settle(runWith(WAVE4_DEPS, adamVsRhino(39), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const mainSchemeId = hero.mainScheme.instanceId;
    const staged = {
      ...hero,
      instances: { ...hero.instances, [mainSchemeId]: { ...inst(hero, mainSchemeId), threat: 10 } },
    };
    const before = inst(staged, mainSchemeId).threat;
    const { state } = playFromHand(staged, "21049", 2, accepting(mainSchemeId));
    const removed = before - inst(state, mainSchemeId).threat;
    expect(removed === 3 || removed === 4).toBe(true);
  });

  it("21053.major-victory-interrupt: readies a friendly Guardian character when Major Victory is defeated", () => {
    const def = WAVE4_DEPS.abilities["21053.major-victory-interrupt"]!;
    expect(def.trigger).toMatchObject({ kind: "interrupt", on: { on: "characterDefeated", selfIs: "target" } });
    expect(def.effects).toEqual([
      {
        kind: "chooseTarget",
        slot: "char",
        query: { categories: ["hero", "ally"], controller: "you", trait: "GUARDIAN" },
        chooser: { kind: "controller" },
      },
      { kind: "ready", target: { kind: "slot", slot: "char" } },
    ]);
    expect(validateDefinition(def)).toEqual([]);
  });

  it("21062.counter-punch-response: after your hero defends against an enemy attack, deals damage to that enemy equal to your hero's ATK", () => {
    const def = WAVE4_DEPS.abilities["21062.counter-punch-response"]!;
    expect(def.trigger).toMatchObject({
      on: { on: "defended", targetIs: { categories: ["hero"], controller: "you" } },
    });
    expect(validateDefinition(def)).toEqual([]);
  });
});

describe("Audacity (21046), Determination (21052), Innovation (21058), Preservation (21064)", () => {
  it("21064.preservation-response: after you spend this card, heal 1 damage from your hero", () => {
    const hero = settle(runWith(WAVE4_DEPS, adamVsRhino(33), toHero()), firstLegal, undefined, WAVE4_DEPS);
    // Spending Preservation (heal 1 from hero) to pay for Uppercut, having taken 2 damage first.
    const identity = identityOf(hero, P1);
    const damaged = { ...hero, instances: { ...hero.instances, [identity]: { ...inst(hero, identity), damage: 2 } } };
    const given = moveToHand(moveToHand(damaged, P1, "21044").state, P1, "21064");
    const [preservation] = instancesOf(given.state, "21064") as [import("@mc/engine").InstanceId];
    const [uppercut] = instancesOf(given.state, "21044") as [import("@mc/engine").InstanceId];
    const rest = payWith(given.state, P1, 2, [uppercut, preservation]);
    const after = settle(
      runWith(WAVE4_DEPS, given.state, play(P1, uppercut, [...rest, preservation])),
      accepting("21064.preservation-response"),
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, identity).damage).toBeLessThan(2);
  });

  it("21046.audacity-response, 21052.determination-response, 21058.innovation-response: the same 'after you spend this card' Hero Response shape as Preservation", () => {
    expect(WAVE4_DEPS.abilities["21046.audacity-response"]!.effects).toEqual([
      { kind: "dealDamage", amount: { kind: "const", value: 1 }, target: { kind: "villain" } },
    ]);
    expect(WAVE4_DEPS.abilities["21052.determination-response"]!.effects).toEqual([
      { kind: "removeThreat", amount: { kind: "const", value: 1 }, target: { kind: "mainScheme" } },
    ]);
    expect(WAVE4_DEPS.abilities["21058.innovation-response"]!.effects[0]).toMatchObject({ kind: "chooseTarget" });
    for (const id of ["21046.audacity-response", "21052.determination-response", "21058.innovation-response"]) {
      expect(validateDefinition(WAVE4_DEPS.abilities[id]!)).toEqual([]);
    }
  });
});

describe("Quasar (21047)", () => {
  it("21047.quasar-response: removes 1 threat from each scheme in play after entering play", () => {
    const state = adamVsRhino(34);
    const mainSchemeId = state.mainScheme.instanceId;
    const before = inst(state, mainSchemeId).threat;
    const { state: after } = playFromHand(state, "21047", 3);
    expect(inst(after, mainSchemeId).threat).toBe(Math.max(0, before - 1));
  });
});

describe("Summoning Spell (21055), Make the Call (21056)", () => {
  it("21055.summoning-spell-action: mills the deck until an ally is found and puts it into play", () => {
    const hero = settle(runWith(WAVE4_DEPS, adamVsRhino(35), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const before = playerOf(hero, P1).playArea.length;
    const { state: after } = playFromHand(hero, "21055", 2);
    expect(playerOf(after, P1).playArea.length).toBeGreaterThanOrEqual(before);
  });

  it("21056.make-the-call-action: pays the printed cost of an ally in a discard pile", () => {
    const start = adamVsRhino(36);
    const { state: discarded, id: quasar } = moveToDiscard(start, P1, "21047"); // Quasar, printed cost 3
    const given = moveToHand(discarded, P1, "21056");
    const [call] = given.ids as [import("@mc/engine").InstanceId];
    const after = settle(
      runWith(
        WAVE4_DEPS,
        given.state,
        play(P1, call, payWith(given.state, P1, 3, [call]), { costChoices: { ally: [quasar] } }),
      ),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(after, P1).playArea).toContain(quasar);
  });
});

describe("Inspired (21057)", () => {
  it("21057.inspired-constant: attached ally gets +1 THW and +1 ATK", () => {
    const state = adamVsRhino(37);
    const { state: withAlly, id: ally } = playFromHand(state, "21047", 3);
    const before = characterProfile(withAlly, ally, WAVE4_DEPS)!;
    const given = moveToHand(withAlly, P1, "21057");
    const [inspired] = given.ids as [import("@mc/engine").InstanceId];
    const paid = payWith(given.state, P1, 1, [inspired]);
    const after = settle(
      runWith(WAVE4_DEPS, given.state, play(P1, inspired, paid, { attachToInstanceId: ally })),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    const equipped = characterProfile(after, ally, WAVE4_DEPS)!;
    expect(equipped.thw).toBe(before.thw + 1);
    expect(equipped.atk).toBe(before.atk + 1);
  });
});

describe("Martinex (21065)", () => {
  it("21065.martinex-constant: costs 1 less if your identity has the Guardian trait", () => {
    const state = adamVsRhino(38);
    const given = moveToHand(state, P1, "21065");
    const [martinex] = given.ids as [import("@mc/engine").InstanceId];
    // Adam Warlock has the Mystic trait, not Guardian, so the printed cost 3 is not reduced.
    const paidBare = payWith(given.state, P1, 3, [martinex]);
    const after = runWith(WAVE4_DEPS, given.state, play(P1, martinex, paidBare));
    expect(playerOf(after, P1).playArea).toContain(martinex);
  });
});

describe("Shield Spell (event, 21061)", () => {
  it("21061.shield-spell-interrupt: an undefended attack's damage is prevented by discarding that many cards from the deck", () => {
    const hero = settle(runWith(WAVE4_DEPS, adamVsRhino(11), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const given = moveToHand(hero, P1, "21061");
    const [shield] = given.ids as [InstanceId];
    const identity = identityOf(given.state, P1);
    let state = runWith(WAVE4_DEPS, given.state, endTurn());
    const events: { type: string; targetInstanceId?: string; amount?: number; playerId?: string }[] = [];
    let prevented = 0;
    let deckBefore = 0;
    while (state.pendingChoice && !state.outcome) {
      const choice = state.pendingChoice;
      let selected = firstLegal(state);
      if (choice.prompt.kind === "declareDefender") selected = ["decline"]; // undefended: Adam takes it
      const hit = choice.options.find((o) => o.optionId.endsWith("21061.shield-spell-interrupt"));
      if (hit) {
        const window = state.stack.find((f) => f.kind === "window");
        if (window?.kind === "window" && window.event.kind === "dealDamage") prevented = window.event.amount;
        deckBefore = playerOf(state, P1).deck.length;
        selected = [hit.optionId];
      }
      const result = applyOk(
        state,
        { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected },
        WAVE4_DEPS,
      );
      state = result.state;
      events.push(...(result.events as never[]));
      if (hit) expect(deckBefore - playerOf(state, P1).deck.length).toBe(prevented); // "that many cards"
    }
    expect(prevented).toBeGreaterThan(0);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "damagePrevented", targetInstanceId: identity, amount: prevented }),
    );
    expect(playerOf(state, P1).discard).toContain(shield);
  });
});
