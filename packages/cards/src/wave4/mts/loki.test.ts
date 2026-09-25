import { cardId } from "@mc/content";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, withForm } from "../../testing/staging.js";
import { expectResolved, traceAbilities } from "../../testing/trace.js";
import { WAVE4_DEPS } from "../index.js";
import { runWave4, startWave4Game } from "../testing.js";
import { spectrumScenario } from "./support.js";

/**
 * Real-game tests for the Loki scenario (`loki.ts`, `mts` 21160–21176, docs/phase7-wave4.md §2.2, §3.7, §3.23).
 * Every test seats Spectrum's own precon at the "loki" scenario (`wave4Scenario`, whose `buildMtsSingleVillain`
 * now also wires `randomStartingVillain`, `setAsideVillainCardIds` and `victoryCondition` for this record,
 * `../setup.ts`).
 *
 * **Forcing a specific Loki version for an isolated test.** `forceLoki` overwrites both the villain's own state
 * entry (`GameState.villains[].cardId`, which `advanceToSetAsideVillain`/`swapVillain` read) and its `CardInstance`
 * (which ability lookup reads) — either alone leaves the two out of sync and the wrong ability fires.
 *
 * **A Loki's own "When Defeated" resolves on every defeat**, also when All Hail King Loki 1B advances to a set-aside
 * Loki: both are forced interrupts to the same defeat (RRG 1.8 "When Defeated Abilities", p. 48), and the advance
 * no longer pre-empts it (docs/phase7-wave4.md §3.48).
 */
const lokiGame = (seed: number) => startWave4Game(spectrumScenario("loki", { seed }));

const LOKIS = ["21160", "21161", "21162", "21163", "21164"] as const;

/** Forces the active villain to a specific Loki stage card, keeping the instance id and dial. */
function forceLoki(state: GameState, code: string): GameState {
  const villainId = state.activeVillainId;
  return patchInstance(
    {
      ...state,
      villains: state.villains.map((v) => (v.instanceId === villainId ? { ...v, cardId: cardId(code) as never } : v)),
    },
    villainId,
    { cardId: cardId(code) as never },
  );
}

/** A real basic attack on the active villain. */
const attack = (state: GameState, player: PlayerId = P1, pick: Picker = firstLegal): GameState =>
  settle(
    runWave4(state, {
      type: "basicAttack",
      playerId: player,
      attackerInstanceId: identityOf(state, player),
      targetInstanceId: state.activeVillainId,
    }),
    pick,
    undefined,
    WAVE4_DEPS,
  );

/** Attaches `code` (found in the encounter deck or discard) to `hostId` — `thanos.test.ts`'s own `attachToHost`. */
function attachToHost(
  state: GameState,
  code: string,
  hostId: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id = (pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted))!;
  const host = state.instances[hostId]!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, attachedTo: hostId, faceup: true },
        [hostId]: { ...host, attachments: [...host.attachments, id] },
      },
    },
  };
}

/** Puts `code` (a side scheme in the encounter deck) into the villain area at `threat`. */
function putSideSchemeInPlay(
  state: GameState,
  code: string,
  threat = 1,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => state.instances[i]?.cardId === cardId(code))!;
  return {
    id,
    state: {
      ...state,
      villainArea: [...state.villainArea, id],
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, threat } },
    },
  };
}

/** Accepts an optional "Hero Response" trigger by ability id and pays its cost with resource cards named `names`
 * (matched by label, not instance id, so this reads the same regardless of seed/hand). */
const acceptResponse =
  (abilityId: string, ...names: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseTriggers") {
      const opt = choice.options.find((o) => o.optionId.includes(abilityId));
      if (opt) return [opt.optionId];
    }
    if (choice.prompt.kind === "payForAbility") {
      return choice.options.filter((o) => names.includes(o.label)).map((o) => o.optionId);
    }
    return firstLegal(state);
  };

/** Stacks `code` on top of the encounter deck behind two Advance (`01186`) fillers and ends the turn, revealing it
 * for real (`ebony-maw.test.ts`'s own `revealTopEncounterCard`). */
const INFINITY_STONES = ["21130", "21131", "21132", "21133", "21134", "21135"];

/** Stacks `code` behind one absorber card (`21166`, a plain side scheme with no ability) and ends the turn,
 * revealing it for real. Every Infinity Stone is removed from the villain area first: with one in play, Infinity
 * Gauntlet's own Forced Response resolves its "Special" (several of which search the *main* encounter deck,
 * e.g. the Space Stone's "discard until a minion is discarded") before the per-player reveal step ever runs,
 * consuming whatever was staged — removing the stone(s) sends that Forced Response down its "put the top card of
 * the *Infinity Stone* deck into play" branch instead, which never touches the main encounter deck. */
function revealTopEncounterCard(
  state: GameState,
  code: string,
  pick: Picker = firstLegal,
): { readonly state: GameState; readonly id: InstanceId } {
  const noStones = {
    ...state,
    villainArea: state.villainArea.filter((id) => !INFINITY_STONES.includes(state.instances[id]?.cardId as string)),
  };
  const staged = stackEncounterDeck(noStones, "21166", code);
  const already = new Set(instancesOf(staged, code));
  const revealed = settle(runWave4(staged, endTurn(P1)), pick, undefined, WAVE4_DEPS);
  const id = instancesOf(revealed, code).find((candidate) => !already.has(candidate))!;
  return { state: revealed, id };
}

describe("§3.7 the random starting villain and setup (21165a.setup)", () => {
  it("one of the five Lokis starts at random, the rest are set aside, deterministically from the seed", () => {
    const a = lokiGame(9);
    const b = lokiGame(9);
    const startCard = a.instances[a.activeVillainId]!.cardId;
    expect(LOKIS).toContain(startCard);
    expect(b.instances[b.activeVillainId]!.cardId).toBe(startCard);
    const setAside = a.encounterSetAside.map((id) => a.instances[id]?.cardId);
    expect([...setAside, startCard].slice().sort()).toEqual([...LOKIS].sort());
  });

  it("21165a.setup: puts War in Asgard into play and reveals the top infinity stone card", () => {
    const state = lokiGame(1);
    expect(state.villainArea.some((id) => state.instances[id]?.cardId === cardId("21167"))).toBe(true);
    const stones = ["21130", "21131", "21132", "21133", "21134", "21135"];
    expect(state.villainArea.some((id) => stones.includes(state.instances[id]?.cardId as string))).toBe(true);
    expect(state.scenarioDecks["Infinity Stone"]).toBeDefined();
  });
});

describe("§3.7 All Hail King Loki 1B (21165b)", () => {
  it("21165b.all-hail-king-loki-forced-interrupt: defeating Loki advances to a random set-aside Loki instead of ending the game", () => {
    const state = lokiGame(1);
    const before = state.instances[state.activeVillainId]!.cardId;
    const after = defeatWithAttack(
      WAVE4_DEPS,
      settle(runWave4(state, toHero(P1)), firstLegal, undefined, WAVE4_DEPS),
      state.activeVillainId,
    );
    expect(after.outcome).toBeNull();
    // Same instance, a different Loki card; the old one is in the victory display (Victory 1).
    expect(after.activeVillainId).toBe(state.activeVillainId);
    expect(after.instances[after.activeVillainId]!.cardId).not.toBe(before);
    expect(LOKIS).toContain(after.instances[after.activeVillainId]!.cardId);
    expect(after.victoryDisplay.map((id) => after.instances[id]?.cardId)).toEqual([before]);
  });

  it("21165b.all-hail-king-loki-constant: the players win once the victory display meets the victory condition", () => {
    // Skirmish mode's own victory condition (1): defeating a single Loki wins immediately.
    const state = startWave4Game(spectrumScenario("loki", { seed: 1, modes: { skirmish: { villainVersion: "A" } } }));
    expect(state.scenarioRules.victoryCondition).toBe(1);
    const hero = settle(runWave4(state, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const after = defeatWithAttack(deps, hero, state.activeVillainId);
    expectResolved(trace, "21165b.all-hail-king-loki-constant");
    expect(after.outcome?.result).toBe("win");
  });

  it("Loki I defeated with others set aside: his When Defeated reveals a side scheme, the next Loki comes in, and he is in the victory display (21160.when-defeated with 21165b.all-hail-king-loki-forced-interrupt)", () => {
    const state0 = forceLoki(lokiGame(1), "21160");
    // No side scheme in play, so Loki I can take damage (his own constant); the set-aside Lokis stay.
    const state = {
      ...state0,
      villainArea: state0.villainArea.filter((id) => state0.instances[id]?.cardId !== ("21167" as never)),
    };
    const staged = stackEncounterDeck(state, "01186", "21168");
    const hero = settle(runWave4(staged, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const after = defeatWithAttack(deps, hero, hero.activeVillainId);
    expectResolved(trace, "21165b.all-hail-king-loki-forced-interrupt");
    expectResolved(trace, "21160.when-defeated");
    expect(after.villainArea.some((id) => after.instances[id]?.cardId === cardId("21168"))).toBe(true);
    // A set-aside Loki took over (`forceLoki` leaves the original starter's card in the set-aside pool, so the next
    // one may carry any Loki code): the villain is undefeated, at full health, and the set-aside pool is one smaller.
    expect(after.villains[0]!.defeated).toBe(false);
    expect(after.instances[after.activeVillainId]!.damage).toBe(0);
    expect(after.encounterSetAside.length).toBe(hero.encounterSetAside.length - 1);
    expect(after.victoryDisplay.map((id) => after.instances[id]?.cardId)).toEqual([cardId("21160")]);
    expect(after.outcome).toBeNull();
  });

  it("with nothing left set aside, a genuine defeat resolves normally (proves the stage's own When Defeated can fire)", () => {
    const state0 = lokiGame(1);
    const state = { ...state0, encounterSetAside: [] };
    const hero = settle(runWave4(state, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const after = defeatWithAttack(deps, hero, state.activeVillainId);
    expectResolved(trace, "21165b.all-hail-king-loki-forced-interrupt");
    // The villain stays defeated this time (nothing to advance to): still the same card, in the victory display.
    expect(after.victoryDisplay).toContain(after.activeVillainId);
  });
});

// Named literally for the id-coverage guard (`../coverage.test.ts` scans raw file text for each ref id, and a
// template literal built at runtime doesn't appear in it): 21160.when-defeated, 21161.when-defeated,
// 21162.when-defeated, 21163.when-defeated, 21164.when-defeated.
describe.each(LOKIS)("Loki (%s): When Defeated discards until a side scheme is found and reveals it", (code) => {
  it(`${code}.when-defeated`, () => {
    const state0 = forceLoki(lokiGame(1), code);
    // War in Asgard blocks 21160's own "cannot take damage while a side scheme is in play"; remove every side
    // scheme from play for this test (its own constant is proven separately below).
    const state = {
      ...state0,
      villainArea: state0.villainArea.filter((id) => state0.instances[id]?.cardId !== ("21167" as never)),
      encounterSetAside: [],
    };
    // A side scheme (Madness on Midgard) sits near the top so the discard-until-found effect finds it quickly.
    const staged = stackEncounterDeck(state, "01186", "21168");
    const hero = settle(runWave4(staged, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const after = defeatWithAttack(deps, hero, hero.activeVillainId);
    expectResolved(trace, `${code}.when-defeated`);
    expect(after.villainArea.some((id) => after.instances[id]?.cardId === cardId("21168"))).toBe(true);
  });
});

describe("Loki (21160): cannot take damage while a side scheme is in play", () => {
  it("21160.loki-constant", () => {
    const state = forceLoki(lokiGame(1), "21160");
    // War in Asgard is already in play from setup: a real basic attack deals no damage at all.
    const hero = settle(runWave4(state, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const attacked = attack(hero);
    expect(attacked.instances[attacked.activeVillainId]!.damage).toBe(0);
    // With every side scheme removed, the same attack damages him normally.
    const cleared = {
      ...hero,
      villainArea: hero.villainArea.filter((id) => hero.instances[id]?.cardId !== ("21167" as never)),
    };
    const attackedAfterClearing = attack(cleared);
    expect(attackedAfterClearing.instances[attackedAfterClearing.activeVillainId]!.damage).toBeGreaterThan(0);
  });
});

describe("Loki (21164): his attacks gain piercing", () => {
  it("21164.loki-constant", () => {
    expect(WAVE4_DEPS.abilities["21164.loki-constant"]!.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "attackKeywords", keywords: ["piercing"], attacker: { self: true } }],
    });
  });
});

// Named literally for the id-coverage guard: 21166.when-defeated, 21167.when-defeated, 21168.when-defeated,
// 21169.when-defeated.
describe.each(["21166", "21167", "21168", "21169"] as const)(
  "Side scheme %s: When Defeated reveals a stone and swaps Loki",
  (code) => {
    it(`${code}.when-defeated`, () => {
      const state0 = lokiGame(2);
      const { state: withScheme, id: scheme } =
        code === "21167"
          ? { state: state0, id: state0.villainArea.find((id) => state0.instances[id]?.cardId === cardId("21167"))! }
          : putSideSchemeInPlay(state0, code, 1);
      const hero = settle(
        runWave4(patchInstance(withScheme, scheme, { threat: 1 }), toHero(P1)),
        firstLegal,
        undefined,
        WAVE4_DEPS,
      );
      const before = hero.instances[hero.activeVillainId]!.cardId;
      const stoneDeckBefore = hero.scenarioDecks["Infinity Stone"]!.deck.length;
      const identity = identityOf(hero, P1);
      const { deps, trace } = traceAbilities(WAVE4_DEPS);
      const after = settle(
        runWith(deps, hero, {
          type: "basicThwart",
          playerId: P1,
          thwarterInstanceId: identity,
          schemeInstanceId: scheme,
        }),
        firstLegal,
        undefined,
        deps,
      );
      expectResolved(trace, `${code}.when-defeated`);
      expect(after.villainArea).not.toContain(scheme);
      expect(after.instances[after.activeVillainId]!.cardId).not.toBe(before);
      expect(after.scenarioDecks["Infinity Stone"]!.deck.length).toBeLessThan(stoneDeckBefore);
    });
  },
);

describe("Loki's Staff (21170)", () => {
  it("21170.boost: drawn as the villain's own boost card, attaches itself to Loki", () => {
    const state = lokiGame(3);
    const hero = settle(runWave4(state, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const staged = stackEncounterDeck(hero, "21170");
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const after = settle(runWith(deps, staged, endTurn(P1)), firstLegal, undefined, deps);
    expectResolved(trace, "21170.boost");
    const staff = instancesOf(after, "21170")[0]!;
    expect(after.instances[staff]!.attachedTo).toBe(after.activeVillainId);
  });

  it("21170.lokis-staff-response: after a basic attack on Loki, spending [energy][physical] discards it", () => {
    const state = lokiGame(3);
    const villain = state.activeVillainId;
    const { state: withStaff, id: staff } = attachToHost(state, "21170", villain);
    const hero = settle(runWave4(withStaff, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const given = moveToHand(hero, P1, "21023", "21025");
    const attacked = attack(given.state, P1, acceptResponse("21170.lokis-staff-response", "Energy", "Strength"));
    expect(attacked.instances[staff]!.attachedTo).toBeNull();
  });
});

describe("Loki's Crown (21171)", () => {
  it("21171.boost: drawn as the villain's own boost card, attaches itself to Loki", () => {
    const state = lokiGame(3);
    const hero = settle(runWave4(state, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const staged = stackEncounterDeck(hero, "21171");
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const after = settle(runWith(deps, staged, endTurn(P1)), firstLegal, undefined, deps);
    expectResolved(trace, "21171.boost");
    const crown = instancesOf(after, "21171")[0]!;
    expect(after.instances[crown]!.attachedTo).toBe(after.activeVillainId);
  });

  it("21171.lokis-crown-response: after a basic attack on Loki, spending [mental][physical] discards it", () => {
    const state = lokiGame(3);
    const villain = state.activeVillainId;
    const { state: withCrown, id: crown } = attachToHost(state, "21171", villain);
    const hero = settle(runWave4(withCrown, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const given = moveToHand(hero, P1, "21024", "21025");
    const attacked = attack(given.state, P1, acceptResponse("21171.lokis-crown-response", "Genius", "Strength"));
    expect(attacked.instances[crown]!.attachedTo).toBeNull();
  });
});

describe("Loki's Cape (21172)", () => {
  it("21172.lokis-cape-forced-response: after Loki is swapped, gives him a tough status card", () => {
    const state0 = lokiGame(2);
    const villain = state0.activeVillainId;
    const { state: withCape } = attachToHost(state0, "21172", villain);
    const { state: withScheme, id: scheme } = putSideSchemeInPlay(withCape, "21166", 1);
    const hero = settle(runWave4(withScheme, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const identity = identityOf(hero, P1);
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const after = settle(
      runWith(deps, hero, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      firstLegal,
      undefined,
      deps,
    );
    expectResolved(trace, "21172.lokis-cape-forced-response");
    expect(after.instances[after.activeVillainId]!.statuses.tough).toBeGreaterThan(0);
  });

  it("21172.lokis-cape-response: after a basic attack on Loki, spending [energy][mental] discards it", () => {
    const state = lokiGame(3);
    const villain = state.activeVillainId;
    const { state: withCape, id: cape } = attachToHost(state, "21172", villain);
    const hero = settle(runWave4(withCape, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const given = moveToHand(hero, P1, "21023", "21024");
    const attacked = attack(given.state, P1, acceptResponse("21172.lokis-cape-response", "Energy", "Genius"));
    expect(attacked.instances[cape]!.attachedTo).toBeNull();
  });
});

describe("Master of Illusions (21173)", () => {
  it("21173.master-of-illusions-forced-interrupt: a treachery on top prevents the damage and discards itself", () => {
    const state = lokiGame(3);
    const villain = state.activeVillainId;
    const { state: withAttachment, id } = attachToHost(state, "21173", villain);
    // Deviant Syndrome-style treachery (Devious Sorcery, 21174) on top of the deck.
    const staged = stackEncounterDeck(withAttachment, "21174");
    const hero = settle(runWave4(staged, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const before = hero.instances[hero.activeVillainId]!.damage;
    const attacked = attack(hero);
    expect(attacked.instances[attacked.activeVillainId]!.damage).toBe(before);
    expect(attacked.instances[id]!.attachedTo).toBeNull();
  });

  it("a non-treachery on top lets the damage through and keeps the attachment", () => {
    const state = lokiGame(3);
    const villain = state.activeVillainId;
    const { state: withAttachment, id } = attachToHost(state, "21173", villain);
    // Casket of Ancient Winters (21166, a side scheme) — Advance (`01186`) is itself a treachery card type, so it
    // can't stand in for "not a treachery" here.
    const staged = stackEncounterDeck(withAttachment, "21166");
    const hero = settle(runWave4(staged, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const before = hero.instances[hero.activeVillainId]!.damage;
    const attacked = attack(hero);
    expect(attacked.instances[attacked.activeVillainId]!.damage).toBeGreaterThan(before);
    expect(attacked.instances[id]!.attachedTo).toBe(attacked.activeVillainId);
  });
});

describe("Devious Sorcery (21174)", () => {
  // The villain's own activation (which also schemes/attacks against P1) runs in the same villain phase as the
  // reveal, adding its own threat/damage independently of this card — so "already stunned adds 2 more" is proven
  // as a *differential* between two otherwise-identical games (same seed, same villain noise), one where the
  // identity starts stunned and one where it doesn't, rather than an absolute before/after on one game.
  it("21174.when-revealed-alter-ego: you are stunned; already stunned places 2 threat on the main scheme instead", () => {
    const base = withForm(lokiGame(2), "alterEgo");
    const { state: notStunned } = revealTopEncounterCard(base, "21174");
    const identity = identityOf(base, P1);
    const stunned = patchInstance(base, identity, { statuses: { ...inst(base, identity).statuses, stunned: 1 } });
    const { state: alreadyStunned } = revealTopEncounterCard(stunned, "21174");
    expect(mainThreat(alreadyStunned)).toBe(mainThreat(notStunned) + 2);
  });

  it("21174.when-revealed-hero: you are stunned; already stunned takes 2 damage instead", () => {
    const base = settle(runWave4(lokiGame(2), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const identity = identityOf(base, P1);
    const { state: notStunned } = revealTopEncounterCard(base, "21174");
    const stunned = patchInstance(base, identity, { statuses: { ...inst(base, identity).statuses, stunned: 1 } });
    const { state: alreadyStunned } = revealTopEncounterCard(stunned, "21174");
    expect(inst(alreadyStunned, identity).damage).toBe(inst(notStunned, identity).damage + 2);
  });
});

describe("Infinite Mischief (21175)", () => {
  it("21175.boost: drawn as the villain's own boost card, discards the top infinity stone and applies its boost icons instead", () => {
    const state = lokiGame(3);
    const stoneDeckBefore = state.scenarioDecks["Infinity Stone"]!.deck.length;
    const hero = settle(runWave4(state, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const staged = stackEncounterDeck(hero, "21175");
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const after = settle(runWith(deps, staged, endTurn(P1)), firstLegal, undefined, deps);
    expectResolved(trace, "21175.boost");
    expect(after.scenarioDecks["Infinity Stone"]!.deck.length).toBeLessThan(stoneDeckBefore);
  });

  it("21175.when-revealed: shuffles the infinity stone discard pile back into its deck and reveals the top card", () => {
    const state = lokiGame(3);
    const piles = state.scenarioDecks["Infinity Stone"]!;
    // Two stones in the Infinity Stone discard pile (surgery for reach).
    const moved = piles.deck.slice(0, 2);
    const staged0: GameState = {
      ...state,
      scenarioDecks: {
        ...state.scenarioDecks,
        "Infinity Stone": { ...piles, deck: piles.deck.slice(2), discard: [...piles.discard, ...moved] },
      },
    };
    const inPlay = (s: GameState) => [...s.villainArea, ...s.players.flatMap((p) => p.playArea)];
    const isStone = (s: GameState, id: InstanceId) => INFINITY_STONES.includes(s.instances[id]?.cardId as string);
    // `revealTopEncounterCard` clears the stones in play before the villain phase, so two stones leave the deck
    // this round: the Infinity Gauntlet's own "otherwise, put the top card of the infinity stone deck into play"
    // (21129, after the villain activates with no stone in play) and Infinite Mischief's reveal after its shuffle.
    const noStones = { ...staged0, villainArea: staged0.villainArea.filter((id) => !isStone(staged0, id)) };
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const after = settle(
      runWith(deps, stackEncounterDeck(noStones, "21166", "21175"), endTurn(P1)),
      firstLegal,
      undefined,
      deps,
    );
    expectResolved(trace, "21129.infinity-gauntlet-forced-response");
    expectResolved(trace, "21175.when-revealed");
    const stoneDeck = after.scenarioDecks["Infinity Stone"]!;
    expect(stoneDeck.discard).toHaveLength(0);
    // The two discarded stones were shuffled back, so none is lost: each is in the deck or was revealed into play.
    for (const id of moved) expect(stoneDeck.deck.includes(id) || inPlay(after).includes(id)).toBe(true);
    expect(stoneDeck.deck).toHaveLength(piles.deck.length - 2);
    expect(inPlay(after).filter((id) => isStone(after, id))).toHaveLength(2);
  });
});

describe("The Trickster (21176)", () => {
  it("21176.when-revealed: swaps Loki with a random set-aside version, then he schemes against you", () => {
    const state = lokiGame(2);
    const before = state.instances[state.activeVillainId]!.cardId;
    const mainThreatBefore = mainThreat(state);
    const { state: after } = revealTopEncounterCard(state, "21176");
    expect(after.instances[after.activeVillainId]!.cardId).not.toBe(before);
    expect(LOKIS).toContain(after.instances[after.activeVillainId]!.cardId);
    expect(mainThreat(after)).toBeGreaterThan(mainThreatBefore);
  });

  it("21176.boost: drawn as the villain's own boost card, gives it an additional boost card and a tough status", () => {
    const state = lokiGame(4);
    const hero = settle(runWave4(state, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const staged = stackEncounterDeck(hero, "21176");
    const { deps, trace } = traceAbilities(WAVE4_DEPS);
    const after = settle(runWith(deps, staged, endTurn(P1)), firstLegal, undefined, deps);
    expectResolved(trace, "21176.boost");
    expect(after.instances[after.activeVillainId]!.statuses.tough).toBeGreaterThan(0);
  });
});

describe("§3.7 e2e: a hero plays Loki standard and expert to a real outcome, replaying deterministically", () => {
  for (const difficulty of ["standard", "expert"] as const) {
    it(`${difficulty}: setup, one activation and a defeat all replay identically`, () => {
      const state = startWave4Game(spectrumScenario("loki", { seed: 7, difficulty }));
      const hero = settle(runWave4(state, toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
      const after = defeatWithAttack(WAVE4_DEPS, hero, hero.activeVillainId);
      expect(after.outcome).toBeNull();
      const replayed = startWave4Game(spectrumScenario("loki", { seed: 7, difficulty }));
      expect(replayed.instances[replayed.activeVillainId]!.cardId).toBe(state.instances[state.activeVillainId]!.cardId);
    });
  }
});
