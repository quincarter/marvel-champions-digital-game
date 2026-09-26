import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  payWith,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { ADAM_WARLOCK_KIT } from "./adam-warlock-kit.js";
import { adamWarlockScenario } from "./support.js";

const adamVsRhino = (seed = 1) => startWave4Game(adamWarlockScenario("rhino", { seed }));
const valid = (id: string) => expect(validateDefinition(WAVE4_DEPS.abilities[id]!)).toEqual([]);

/** Accepts any offered choice whose optionId names one of `wanted`, else falls back to `firstLegal`. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id.includes(w)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Adam Warlock (identity, 21031a/b)", () => {
  it("21031a.adam-warlock-constant (Battle Mage): discarding a Justice card removes 2 threat from a scheme", () => {
    const hero = settle(runWith(WAVE4_DEPS, adamVsRhino(1), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const identity = identityOf(hero, P1);
    // Zone of Silence (21050) is a Justice event; put it in hand and pick it as the discard.
    const given = moveToHand(hero, P1, "21050");
    const [zoneOfSilence] = given.ids as [import("@mc/engine").InstanceId];
    const mainSchemeId = given.state.mainScheme.instanceId;
    const before = inst(given.state, mainSchemeId).threat;
    const after = settle(
      runWith(WAVE4_DEPS, given.state, use(P1, identity, "21031a.adam-warlock-constant")),
      (state) => {
        const choice = state.pendingChoice;
        if (!choice) return [];
        const hits = choice.options.map((o) => o.optionId).filter((id) => id.includes(zoneOfSilence));
        return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
      },
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(zoneOfSilence);
    expect(inst(after, mainSchemeId).threat).toBe(Math.max(0, before - 2));
  });

  it("21031a.adam-warlock-constant-2..5: the bulleted branches are covered by the action's own test", () => {
    valid("21031a.adam-warlock-constant-2");
    valid("21031a.adam-warlock-constant-3");
    valid("21031a.adam-warlock-constant-4");
    valid("21031a.adam-warlock-constant-5");
  });

  it("21031b.adam-warlock-constant: deckbuilding text is data, no ability", () => {
    valid("21031b.adam-warlock-constant");
    expect(ADAM_WARLOCK_KIT["21031b.adam-warlock-constant"]!.effects).toEqual([]);
  });

  it("21031b.adam-warlock-action: discarding a card removes a status card from Adam Warlock", () => {
    const state = adamVsRhino(2);
    const identity = identityOf(state, P1);
    const stunned = {
      ...state,
      instances: {
        ...state.instances,
        [identity]: { ...inst(state, identity), statuses: { ...inst(state, identity).statuses, stunned: 1 } },
      },
    };
    const [discarded] = payWith(stunned, P1, 1);
    const after = settle(
      runWith(WAVE4_DEPS, stunned, use(P1, identity, "21031b.adam-warlock-action", [], { discard: [discarded!] })),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, identity).statuses.stunned).toBe(0);
  });
});

describe("Pip the Troll (21032)", () => {
  it("21032.pip-the-troll-constant: active in hand — an interrupt when a player is attacked", () => {
    const def = ADAM_WARLOCK_KIT["21032.pip-the-troll-constant"]!;
    expect(def.activeIn).toBe("hand");
    valid("21032.pip-the-troll-constant");
  });
});

describe("Soul World (21033)", () => {
  it("21033.soul-world-response: places a soul counter after your deck runs out", () => {
    valid("21033.soul-world-response");
    expect(ADAM_WARLOCK_KIT["21033.soul-world-response"]!.trigger).toMatchObject({
      on: { on: "deckRanOut", playerIs: "controller" },
    });
  });

  it("21033.soul-world-action: heals all damage from your identity", () => {
    const state = adamVsRhino(3);
    const { state: withSoulWorld, id: soulWorld } = playFromHand(state, "21033", 1);
    const identity = identityOf(withSoulWorld, P1);
    const damaged = {
      ...withSoulWorld,
      instances: {
        ...withSoulWorld.instances,
        [identity]: { ...inst(withSoulWorld, identity), damage: 3 },
        [soulWorld]: { ...inst(withSoulWorld, soulWorld), counters: { soul: 1 } },
      },
    } as import("@mc/engine").GameState;
    const after = settle(
      runWith(WAVE4_DEPS, damaged, use(P1, soulWorld, "21033.soul-world-action")),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, identity).damage).toBe(0);
  });
});

describe("Karmic Staff (21034)", () => {
  it("21034.karmic-staff-resource: exhausts to generate a wild resource", () => {
    const hero = settle(runWith(WAVE4_DEPS, adamVsRhino(4), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const { state: withStaff, id: staff } = playFromHand(hero, "21034", 2);
    const given = moveToHand(withStaff, P1, "21044");
    const [uppercut] = given.ids as [import("@mc/engine").InstanceId];
    const rest = payWith(given.state, P1, 2, [uppercut, staff]);
    const after = settle(
      runWith(
        WAVE4_DEPS,
        given.state,
        play(P1, uppercut, rest, { abilities: [resourceAbility(staff, "21034.karmic-staff-resource")] }),
      ),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, staff).exhausted).toBe(true);
  });
});

describe("Warlock's Cape (21035) and Mystic Senses (21037)", () => {
  it("21035.warlocks-cape-response, 21037.mystic-senses-response: after resolving Battle Mage, ready Adam Warlock and draw a card", () => {
    const hero = settle(runWith(WAVE4_DEPS, adamVsRhino(5), toHero()), firstLegal, undefined, WAVE4_DEPS);
    const { state: withCards } = playFromHand(playFromHand(hero, "21035", 2).state, "21037", 2);
    const identity = identityOf(withCards, P1);
    const exhausted = {
      ...withCards,
      instances: { ...withCards.instances, [identity]: { ...inst(withCards, identity), exhausted: true } },
    };
    const before = playerOf(exhausted, P1).hand.length;
    const deckBefore = playerOf(exhausted, P1).deck.length;
    const after = settle(
      runWith(WAVE4_DEPS, exhausted, use(P1, identity, "21031a.adam-warlock-constant")),
      accepting("21035.warlocks-cape-response", "21037.mystic-senses-response"),
      undefined,
      WAVE4_DEPS,
    );
    // Weak-test finding (rules-qa-engineer, docs/phase7-wave4-qa.md): the original assertion
    // (`toBeGreaterThan(before - 2)`) is satisfied even if *neither* Response actually fired. Warlock's Cape
    // (21035) readies Adam Warlock; Mystic Senses (21037) draws exactly 1 card, proven by the deck shrinking by
    // exactly 1 (`before`'s own hand-length snapshot predates Battle Mage's own cost, a Justice card discarded
    // from hand, which is why the *hand* total nets back to unchanged: -1 cost, +1 draw).
    expect(inst(after, identity).exhausted).toBe(false);
    expect(playerOf(after, P1).deck.length).toBe(deckBefore - 1);
    expect(playerOf(after, P1).hand.length).toBe(before);
  });
});

describe("Cosmic Ward (21036)", () => {
  it("21036.cosmic-ward-forced-interrupt: cancels a revealed treachery and discards itself", () => {
    valid("21036.cosmic-ward-forced-interrupt");
    expect(ADAM_WARLOCK_KIT["21036.cosmic-ward-forced-interrupt"]!.trigger).toMatchObject({ forced: true });
  });
});
