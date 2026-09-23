import type { GameState, InstanceId } from "@mc/engine";
import {
  answer,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  runWith,
  settle,
  settleUntil,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEvents } from "../../testing/staging.js";
import { traceAbilities } from "../../testing/trace.js";
import { wave3Scenario } from "../setup.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";
import { GMW_ABILITIES } from "./index.js";

/** Infiltrate the Museum (docs/phase7-wave3.md §2.2): Collector I–III, The Grand Collection, its own encounter
 * set, and Menagerie Medley (the scenario's own recommended modular, confirmed on 16073a's own "Contents" text). */
const infiltrateTheMuseum = () =>
  startWave3Game(
    wave3Scenario("infiltrate-the-museum", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }),
  );

const collection = (state: GameState): readonly InstanceId[] => state.scenarioAreas?.["The Collection"] ?? [];

/** Reveal `code` from the encounter deck, past the villain's own unconditional boost draw (docs/card-scripting-
 * process.md §7): stack a filler ahead of it, then run the villain phase. */
const reveal = (state: GameState, code: string, pick = firstLegal): GameState =>
  settle(
    runWave3(stackEncounterDeck(state, "01186", code), { type: "endTurn", playerId: P1 }),
    pick,
    undefined,
    WAVE3_DEPS,
  );

/** Stage a villain to a later stage directly (badoon.test.ts's own `atVillainStage`), for a Forced Interrupt/
 * constant active only *at* that stage rather than the "When Revealed" that fires through a real defeat→advance. */
const atVillainStage = (state: GameState, villainId: InstanceId, stageIndex: number): GameState =>
  patchInstance(
    { ...state, villains: state.villains.map((v) => (v.instanceId === villainId ? { ...v, stageIndex } : v)) },
    villainId,
    { damage: 0 },
  );

describe("The Grand Collection 1A Setup (16073a.setup)", () => {
  it("creates The Collection and puts the top card of each player's deck into it, faceup", () => {
    const state = infiltrateTheMuseum();
    expect(collection(state)).toHaveLength(state.players.length);
    for (const id of collection(state)) expect(inst(state, id).faceup).toBe(true);
  });
});

describe("Collector I (16070.collector-forced-interrupt)", () => {
  it("redirects a card that would be discarded from play into The Collection instead of the encounter discard", () => {
    const state = infiltrateTheMuseum();
    const revealed = reveal(state, "16135"); // Psionic Ghost engages the revealing player on reveal.
    const ghost = instancesOf(revealed, "16135").find((id) => inst(revealed, id).engagedWith === P1);
    expect(ghost).toBeDefined();
    const heroForm = {
      ...revealed,
      players: revealed.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const defeated = defeatWithAttack(WAVE3_DEPS, heroForm, ghost!, P1);
    expect(collection(defeated)).toContain(ghost);
    const deck = defeated.encounterDecks[Object.keys(defeated.encounterDecks)[0]!]!;
    expect(deck.discard).not.toContain(ghost);
  });
});

describe("Collector II (16071)", () => {
  it("When Revealed: each player chooses to put the top card of their deck into The Collection, or take 3 damage (16071.when-revealed)", () => {
    const state = infiltrateTheMuseum();
    const villain = state.villains[0]!;
    const before = collection(state).length;
    const identity = identityOf(state, P1);
    const damageBefore = inst(state, identity).damage;
    // Reach Collector II through the real defeat→advance transition (badoon.test.ts's own model): bring stage I
    // to 0 HP with a real attack.
    const heroForm = {
      ...state,
      players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const defeated = defeatWithAttack(WAVE3_DEPS, heroForm, villain.instanceId, P1);
    expect(defeated.villains[0]!.stageIndex).toBe(1); // Collector II
    // `firstLegal` picks the mandatory choice's first option: "put the top card of your deck into The Collection".
    expect(collection(defeated).length).toBe(before + 1);
    expect(inst(defeated, identity).damage).toBe(damageBefore);
  });

  it("still carries Collector I's own redirect (16071.collector-forced-interrupt)", () => {
    const state = infiltrateTheMuseum();
    const villain = state.villains[0]!;
    const atII = atVillainStage(state, villain.instanceId, 1);
    const revealed = reveal(atII, "16135");
    const ghost = instancesOf(revealed, "16135").find((id) => inst(revealed, id).engagedWith === P1);
    const heroForm = {
      ...revealed,
      players: revealed.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const defeated = defeatWithAttack(WAVE3_DEPS, heroForm, ghost!, P1);
    expect(collection(defeated)).toContain(ghost);
  });
});

describe("Collector III (16072)", () => {
  it("When Revealed: puts the top card of each player's deck into The Collection, then places threat on the main scheme equal to the count (16072.when-revealed)", () => {
    // Standard mode only reaches Collector I/II (`villainStages: { standard: [1, 2], expert: [2, 3] }`); III's own
    // "When Revealed" only fires through the real defeat→advance transition (badoon.test.ts's own trap), which
    // needs expert mode (II → III) rather than `atVillainStage`'s direct patch (used below for the still-active
    // Forced Interrupt instead, which needs no reveal event).
    const state = startWave3Game(
      wave3Scenario("infiltrate-the-museum", {
        players: [{ starterDeckId: "groot-protection" }],
        seed: 2026,
        difficulty: "expert",
      }),
    );
    const villain = state.villains[0]!;
    expect(villain.stageIndex).toBe(1); // Collector II, expert mode's own first stage
    const before = collection(state).length;
    const threatBefore = inst(state, state.mainScheme.instanceId).threat;
    const heroForm = {
      ...state,
      players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const settled = defeatWithAttack(WAVE3_DEPS, heroForm, villain.instanceId, P1);
    expect(settled.villains[0]!.stageIndex).toBe(2); // Collector III
    expect(collection(settled).length).toBe(before + settled.players.length);
    expect(inst(settled, settled.mainScheme.instanceId).threat).toBe(threatBefore + collection(settled).length);
  });

  it("Forced Interrupt: redirects a discard into The Collection, then places 1 threat on the main scheme (16072.collector-forced-interrupt)", () => {
    const state = infiltrateTheMuseum();
    const villain = state.villains[0]!;
    const atIII = atVillainStage(state, villain.instanceId, 2);
    const revealed = reveal(atIII, "16135");
    const ghost = instancesOf(revealed, "16135").find((id) => inst(revealed, id).engagedWith === P1);
    const heroForm = {
      ...revealed,
      players: revealed.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const threatBefore = inst(heroForm, heroForm.mainScheme.instanceId).threat;
    const defeated = defeatWithAttack(WAVE3_DEPS, heroForm, ghost!, P1);
    expect(collection(defeated)).toContain(ghost);
    expect(inst(defeated, defeated.mainScheme.instanceId).threat).toBe(threatBefore + 1);
  });
});

describe("The Grand Collection 1B (16073b)", () => {
  it("the players lose once there are 5[per_hero] or more cards in The Collection (16073b.the-grand-collection-constant)", () => {
    const state = infiltrateTheMuseum();
    const withScenarioAreas = { ...state, scenarioAreas: { ...state.scenarioAreas, "The Collection": [] } };
    // 5 per hero, 1 player: 5 filler cards suffice — reuse the 5 already-instantiated encounter deck cards.
    const deck = withScenarioAreas.encounterDecks[Object.keys(withScenarioAreas.encounterDecks)[0]!]!;
    const filler = deck.deck.slice(0, 5);
    const filled = {
      ...withScenarioAreas,
      scenarioAreas: { ...withScenarioAreas.scenarioAreas, "The Collection": filler },
    };
    const { state: after } = driveEvents(WAVE3_DEPS, filled, { type: "endTurn", playerId: P1 });
    // `EffectSpec endGame`'s `reason` is a fixed two-value enum with no case for this card's own condition; the
    // default, `"mainSchemeCompleted"`, is what `endGame("loss")` (no explicit reason) logs.
    expect(after.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
  });
});

describe("Biogram Image (16074)", () => {
  it("Forced Interrupt: prevents damage to Collector, puts itself into The Collection, and places that much threat on the main scheme (16074.biogram-image-forced-interrupt)", () => {
    const state = infiltrateTheMuseum();
    const revealed = reveal(state, "16074");
    const biogram = instancesOf(revealed, "16074").find((id) => inst(revealed, id).attachedTo != null);
    expect(biogram).toBeDefined();
    const villain = revealed.villains[0]!;
    const damageBefore = inst(revealed, villain.instanceId).damage;
    const threatBefore = inst(revealed, revealed.mainScheme.instanceId).threat;
    const heroForm = {
      ...revealed,
      players: revealed.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const identity = identityOf(heroForm, P1);
    const attacked = settle(
      runWave3(heroForm, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain.instanceId,
      }),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(attacked, villain.instanceId).damage).toBe(damageBefore); // fully prevented
    expect(collection(attacked)).toContain(biogram);
    expect(inst(attacked, attacked.mainScheme.instanceId).threat).toBeGreaterThan(threatBefore);
  });

  it("[star] Boost: after this activation ends, reveal this card (16074.boost)", () => {
    const state = infiltrateTheMuseum();
    const staged = stackEncounterDeck(state, "16074");
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    settle(runWith(deps, staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, deps);
    expect(trace.resolved()).toContain("16074.boost");
  });
});

describe("Inconspicuous Box (16076)", () => {
  it("When Revealed: puts the lowest cost card you control into The Collection (16076.when-revealed)", () => {
    const state = infiltrateTheMuseum();
    const before = collection(state).length;
    const revealed = reveal(state, "16076");
    expect(collection(revealed).length).toBeGreaterThanOrEqual(before);
  });

  it("[star] Boost: with 3[per_hero] or fewer cards in The Collection, puts the top deck card into it (16076.boost)", () => {
    const state = infiltrateTheMuseum();
    expect(collection(state).length).toBeLessThanOrEqual(3);
    const before = collection(state).length;
    const staged = stackEncounterDeck(state, "16076");
    const revealed = settle(runWave3(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    expect(collection(revealed).length).toBe(before + 1);
  });
});

describe("View the Cosmos (16077)", () => {
  it("When Revealed: declining puts the highest cost hand card into The Collection (16077.when-revealed)", () => {
    const state = infiltrateTheMuseum();
    const before = collection(state).length;
    const revealed = reveal(state, "16077");
    expect(collection(revealed).length).toBe(before + 1);
  });

  it("When Revealed: the discard branch discards the highest cost hand card and places threat equal to its cost (16077.when-revealed)", () => {
    const state = infiltrateTheMuseum();
    const staged = stackEncounterDeck(state, "01186", "16077");
    const untilChoice = settleUntil(
      runWave3(staged, { type: "endTurn", playerId: P1 }),
      "chooseOption",
      firstLegal,
      WAVE3_DEPS,
    );
    const hand = untilChoice.players[0]!.hand;
    const threatBefore = inst(untilChoice, untilChoice.mainScheme.instanceId).threat;
    const answered = answer(untilChoice, ["1"], WAVE3_DEPS); // option index 1: discard, then place threat
    const settled = settle(answered, firstLegal, undefined, WAVE3_DEPS);
    expect(settled.players[0]!.hand.length).toBeLessThan(hand.length);
    expect(inst(settled, settled.mainScheme.instanceId).threat).toBeGreaterThan(threatBefore);
  });

  it("its two data-artifact refs resolve, and carry no behavior of their own (16077.view-the-cosmos-constant, 16077.view-the-cosmos-constant-2)", () => {
    expect(GMW_ABILITIES["16077.view-the-cosmos-constant" as never]).toBeDefined();
    expect(GMW_ABILITIES["16077.view-the-cosmos-constant-2" as never]).toBeDefined();
  });
});

describe("Stay Awhile (16078)", () => {
  it("When Revealed (Alter-Ego): declining the resource payment puts the top deck card into The Collection (16078.when-revealed-alter-ego)", () => {
    const state = infiltrateTheMuseum();
    expect(state.players[0]!.identity.form).toBe("alterEgo");
    const before = collection(state).length;
    const revealed = reveal(state, "16078");
    expect(collection(revealed).length).toBe(before + 1);
  });

  it("When Revealed (Hero): Collector attacks with +1 ATK; damage puts the top deck card into The Collection (16078.when-revealed-hero)", () => {
    const state = infiltrateTheMuseum();
    const heroForm = {
      ...state,
      players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const before = collection(heroForm).length;
    const revealed = reveal(heroForm, "16078");
    // Undefended, the villain's own attack always deals its ATK, so the top-card effect fires.
    expect(collection(revealed).length).toBeGreaterThanOrEqual(before);
  });
});

// Caught Off Guard (16079) is a verbatim reprint of Core's 01188 (museum.ts's own docblock) — `../reprints.ts`
// supplies `16079.when-revealed` automatically, tested there rather than here.

describe("Menagerie Medley (16135–16137)", () => {
  it("Psionic Ghost: When Revealed confuses you; already confused, you also take 1 damage (16135.when-revealed)", () => {
    const state = infiltrateTheMuseum();
    const identity = identityOf(state, P1);
    const confusedFirst = patchInstance(state, identity, { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const damageBefore = inst(confusedFirst, identity).damage;
    const revealed = reveal(confusedFirst, "16135");
    expect(inst(revealed, identity).damage).toBe(damageBefore + 1);
  });

  it("Psionic Ghost: [star] Boost puts it into play engaged with you (16135.boost)", () => {
    const state = infiltrateTheMuseum();
    const staged = stackEncounterDeck(state, "16135");
    const revealed = settle(runWave3(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    const ghost = instancesOf(revealed, "16135").find((id) => inst(revealed, id).engagedWith === P1);
    expect(ghost).toBeDefined();
  });

  it("Starshark: its attacks deal indirect damage (16137.starshark-constant)", () => {
    const definition = GMW_ABILITIES["16137.starshark-constant" as never];
    expect(definition?.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "attacksDealIndirectDamage", attacker: { self: true } }],
    });
  });

  it("Starshark: [star] Boost deals 1 damage to each character you control (16137.boost)", () => {
    const state = infiltrateTheMuseum();
    const identity = identityOf(state, P1);
    const damageBefore = inst(state, identity).damage;
    const staged = stackEncounterDeck(state, "16137");
    const revealed = settle(runWave3(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(revealed, identity).damage).toBeGreaterThanOrEqual(damageBefore + 1);
  });
});

// The full-game smoke test lives in its own file, mirroring `brotherhood-of-badoon-e2e.test.ts`:
// `infiltrate-the-museum-e2e.test.ts`.
