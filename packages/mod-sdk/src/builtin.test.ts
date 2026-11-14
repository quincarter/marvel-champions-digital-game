import {
  BUILTIN_PACKS,
  CORE_BUILTIN_PACK,
  WAVE1_BUILTIN_PACKS,
  WAVE1_DEPS,
  WAVE2_DEPS,
  WAVE3_DEPS,
  WAVE11_ABILITIES,
  PLAYABLE_DEPS,
  playableScenario,
  wave1Scenario,
  wave2Scenario,
  wave3Scenario,
  type BuiltinPack,
} from "@mc/cards";
import { playToOutcome } from "@mc/cards/testing";
import {
  WAVE4_SCENARIOS,
  WAVE4_STARTER_DECKS,
  WAVE5_SCENARIOS,
  WAVE5_STARTER_DECKS,
  WAVE6_SCENARIOS,
  WAVE6_STARTER_DECKS,
  WAVE7_SCENARIOS,
  WAVE7_STARTER_DECKS,
  WAVE8_SCENARIOS,
  WAVE8_STARTER_DECKS,
  WAVE9_SCENARIOS,
  WAVE9_STARTER_DECKS,
  WAVE10_SCENARIOS,
  WAVE10_STARTER_DECKS,
  WAVE11_SCENARIOS,
  WAVE11_STARTER_DECKS,
} from "@mc/content";
import { createGame, type EngineDeps, type GameSetupConfig } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { builtinGameDeps, validateBuiltinPack } from "./builtin.js";
import { customContentOfPacks, type PackGameContent } from "./game.js";
import { splitIssues } from "./validate.js";

/**
 * The products a built-in pack really depends on, besides the Core Set every product is played with: what its cards,
 * sets and scenarios may name. Anything else it names is an undeclared cross-product dependency, which the SDK check
 * reports. Each entry is needed: the test below drops each and expects a defect.
 */
const PRODUCT_REQUIRES: Readonly<Record<string, readonly string[]>> = {
  // Agents of S.H.I.E.L.D.'s Thunderbolts scenario (50130a) draws its modular sets from the Thunderbolt minions'
  // sets, one in each of the cycle's hero packs (MC50 p. 15).
  aos: ["bp", "silk", "falcon", "winter"],
};

const packById = (id: string): BuiltinPack => {
  const pack = BUILTIN_PACKS.find((candidate) => candidate.manifest.id === id);
  if (!pack) throw new Error(`no built-in pack ${id}`);
  return pack;
};

/** What a built-in pack is validated with: the Core Set, plus the products `PRODUCT_REQUIRES` declares for it. */
const requiresOf = (pack: BuiltinPack): readonly BuiltinPack[] =>
  pack === CORE_BUILTIN_PACK ? [] : [CORE_BUILTIN_PACK, ...(PRODUCT_REQUIRES[pack.manifest.id] ?? []).map(packById)];

/**
 * The card abilities a built-in pack leaves unscripted, by pack id. A script dropped from a pack shows up as
 * unscripted and fails the test; a product with known gaps lists them here.
 */
const KNOWN_UNSCRIPTED: Readonly<Record<string, readonly string[]>> = {
  // Synthezoid Smackdown's competitive leader cards: competitive mode isn't shipped
  // (`wave10/synthezoid/competitive/leader-cards.ts`).
  synthezoid: [
    "57032.youre-out-of-order-interrupt",
    "57033.she-hulk-smash-action",
    "57034.make-me-angry-forced-response",
    "57035.legal-counsel-response",
    "57074.calculated-risk-action",
    "57075.synthezoid-strike-action",
    "57076.phased-out-action",
    "57077.android-assistance-interrupt",
  ],
};

describe("built-in packs through the SDK", () => {
  it.each(BUILTIN_PACKS.map((pack) => [pack.manifest.id, pack] as const))("%s passes the SDK's checks", (id, pack) => {
    const { defects, unscripted } = splitIssues(validateBuiltinPack(pack, { requires: requiresOf(pack) }));
    expect(defects).toEqual([]);
    expect(unscripted.map((issue) => issue.message.replace(/^ability "(.*)" is not scripted$/, "$1")).sort()).toEqual(
      KNOWN_UNSCRIPTED[id] ?? [],
    );
  });

  it.each(Object.entries(PRODUCT_REQUIRES).flatMap(([id, deps]) => deps.map((dep) => [id, dep] as const)))(
    "%s needs %s: without it the check reports what it names",
    (id, dep) => {
      const pack = packById(id);
      const without = requiresOf(pack).filter((other) => other.manifest.id !== dep);
      expect(splitIssues(validateBuiltinPack(pack, { requires: without })).defects).not.toEqual([]);
    },
  );

  it("reports a hero given another hero's nemesis set from the same product, and accepts Ironheart's forms", () => {
    const [spiderMan, captainMarvel] = CORE_BUILTIN_PACK.cards.filter((card) => card.type === "hero_identity");
    if (spiderMan?.type !== "hero_identity" || captainMarvel?.type !== "hero_identity")
      throw new Error("Core has two heroes");
    const broken: BuiltinPack = {
      ...CORE_BUILTIN_PACK,
      cards: CORE_BUILTIN_PACK.cards.map((card) =>
        card === spiderMan ? { ...card, nemesisEncounterSetId: captainMarvel.nemesisEncounterSetId } : card,
      ) as BuiltinPack["cards"],
    };
    const messages = splitIssues(validateBuiltinPack(broken)).defects.map((issue) => `${issue.path}: ${issue.message}`);
    expect(messages).toContain(
      `cards/${spiderMan.id}: nemesis set "${captainMarvel.nemesisEncounterSetId}" is not this hero's nemesis set`,
    );
    const ironheart = packById("ironheart");
    const forms = ironheart.cards.filter((card) => card.type === "hero_identity");
    expect(forms.length).toBeGreaterThan(1);
    expect(splitIssues(validateBuiltinPack(ironheart, { requires: requiresOf(ironheart) })).defects).toEqual([]);
  });

  it("reports a reference to a product the pack doesn't require", () => {
    // Core's Rhino naming a modular set of the Black Panther pack, which Core doesn't require.
    const rhino = CORE_BUILTIN_PACK.scenarios[0]!;
    const bpSet = packById("bp").encounterSets.find((set) => set.nemesisOfIdentityId === undefined)!;
    const broken: BuiltinPack = {
      ...CORE_BUILTIN_PACK,
      scenarios: [{ ...rhino, recommendedModularSetIds: [bpSet.id] }, ...CORE_BUILTIN_PACK.scenarios.slice(1)],
    };
    const messages = splitIssues(validateBuiltinPack(broken, { requires: requiresOf(CORE_BUILTIN_PACK) })).defects.map(
      (issue) => issue.message,
    );
    expect(messages).toContain(`scenario ${rhino.id} names encounter set ${bpSet.id}, which is not registered`);
    // The same reference passes once the Black Panther pack is a declared requirement.
    const withBp = validateBuiltinPack(broken, { requires: [packById("bp")] });
    expect(splitIssues(withBp).defects.map((issue) => issue.message)).not.toContain(
      `scenario ${rhino.id} names encounter set ${bpSet.id}, which is not registered`,
    );
  });

  it("carry the whole wave 11 registry (every wave) between them, reprint aliases included", () => {
    const { abilities } = builtinGameDeps(BUILTIN_PACKS);
    expect(Object.keys(abilities).sort()).toEqual(Object.keys(WAVE11_ABILITIES).sort());
    for (const [id, definition] of Object.entries(abilities)) expect(WAVE11_ABILITIES[id]).toBe(definition);
  });

  // Each wave's game, on deps built from the packs alone, plays the same as on that wave's own registry: Captain
  // America (Make the Call is a reprint alias) at Risky Business, Hawkeye at Crossbones, and Rocket Raccoon at the
  // Brotherhood of Badoon.
  it.each([
    [
      "wave 1",
      () => wave1Scenario("risky-business", { players: [{ starterDeckId: "cap-leadership" }], seed: 7 }),
      WAVE1_DEPS,
    ],
    [
      "wave 2",
      () => wave2Scenario("crossbones", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 7 }),
      WAVE2_DEPS,
    ],
    [
      "wave 3",
      () =>
        wave3Scenario("brotherhood-of-badoon", { players: [{ starterDeckId: "rocket-raccoon-aggression" }], seed: 7 }),
      WAVE3_DEPS,
    ],
  ] as const)(
    "play a %s game on deps built from the packs alone, the same as on the wave's registry",
    (_, setup, wave) => {
      const play = (deps: EngineDeps) => {
        const created = createGame(setup(), deps);
        if (!created.ok) throw new Error(created.error.message);
        const run = playToOutcome(created.state, deps, { maxCommands: 4000 });
        return { outcome: run.outcome, rounds: run.rounds, log: run.session.log };
      };
      const fromPacks = play(builtinGameDeps(BUILTIN_PACKS));
      expect(fromPacks.outcome).not.toBeNull();
      expect(fromPacks).toEqual(play(wave));
    },
  );

  // Waves 4 to 11: the wave's first scenario with its first precon, set up by the playable pool's builder, plays the
  // same on deps built from the packs alone as on the playable pool's own registry.
  it.each(
    (
      [
        ["wave 4", WAVE4_SCENARIOS, WAVE4_STARTER_DECKS],
        ["wave 5", WAVE5_SCENARIOS, WAVE5_STARTER_DECKS],
        ["wave 6", WAVE6_SCENARIOS, WAVE6_STARTER_DECKS],
        ["wave 7", WAVE7_SCENARIOS, WAVE7_STARTER_DECKS],
        ["wave 8", WAVE8_SCENARIOS, WAVE8_STARTER_DECKS],
        ["wave 9", WAVE9_SCENARIOS, WAVE9_STARTER_DECKS],
        ["wave 10", WAVE10_SCENARIOS, WAVE10_STARTER_DECKS],
        ["wave 11", WAVE11_SCENARIOS, WAVE11_STARTER_DECKS],
      ] as const
    ).map(([name, scenarios, decks]) => [name, String(scenarios[0]!.id), String(decks[0]!.id)] as const),
  )(
    "play a %s game (%s, %s) on deps built from the packs alone, the same as on the playable pool",
    (_, scenario, deck) => {
      const setup = (): GameSetupConfig => playableScenario(scenario, { players: [{ starterDeckId: deck }], seed: 7 });
      const play = (deps: EngineDeps) => {
        const created = createGame(setup(), deps);
        if (!created.ok) throw new Error(created.error.message);
        const run = playToOutcome(created.state, deps, { maxCommands: 4000 });
        return { outcome: run.outcome, rounds: run.rounds, log: run.session.log };
      };
      const fromPacks = play(builtinGameDeps(BUILTIN_PACKS));
      expect(fromPacks.outcome).not.toBeNull();
      expect(fromPacks).toEqual(play(PLAYABLE_DEPS));
    },
  );

  it("are content the SDK's aggregation helpers take", () => {
    const asPackContent: readonly PackGameContent[] = BUILTIN_PACKS;
    const content = customContentOfPacks(asPackContent);
    expect(content.cards).toHaveLength(BUILTIN_PACKS.reduce((n, pack) => n + pack.cards.length, 0));
    expect(content.scenarios).toHaveLength(BUILTIN_PACKS.reduce((n, pack) => n + pack.scenarios.length, 0));
  });

  it("refuses two packs scripting one ability", () => {
    expect(() => builtinGameDeps([CORE_BUILTIN_PACK, CORE_BUILTIN_PACK])).toThrow(/scripted by two built-in packs/);
  });

  it("reports a broken script", () => {
    const [id, definition] = Object.entries(CORE_BUILTIN_PACK.abilities)[0]!;
    const broken: BuiltinPack = {
      ...CORE_BUILTIN_PACK,
      abilities: { ...CORE_BUILTIN_PACK.abilities, [id]: { ...definition, trigger: () => undefined } as never },
    };
    const { defects } = splitIssues(validateBuiltinPack(broken));
    expect(defects.some((issue) => issue.path === `abilities/${id}`)).toBe(true);
  });

  it("reports a script dropped from a pack as unscripted, apart from defects", () => {
    const [id] = Object.keys(CORE_BUILTIN_PACK.abilities);
    const rest = Object.fromEntries(Object.entries(CORE_BUILTIN_PACK.abilities).filter(([key]) => key !== id));
    const { unscripted, defects } = splitIssues(validateBuiltinPack({ ...CORE_BUILTIN_PACK, abilities: rest }));
    expect(defects).toEqual([]);
    expect(unscripted.map((issue) => issue.message)).toContain(`ability "${id}" is not scripted`);
  });

  it("reports a scenario whose sets or villain are missing", () => {
    const gob = WAVE1_BUILTIN_PACKS.find((pack) => pack.manifest.id === "gob")!;
    const scenario = gob.scenarios[0]!;
    const [ownSet] = scenario.encounterSetIds;
    const broken: BuiltinPack = {
      ...gob,
      encounterSets: gob.encounterSets.filter((set) => set.id !== ownSet),
      cards: gob.cards.filter((card) => card.id !== scenario.villainCardId),
    };
    const messages = splitIssues(validateBuiltinPack(broken, { requires: [CORE_BUILTIN_PACK] })).defects.map(
      (issue) => issue.message,
    );
    expect(messages).toContain(`scenario ${scenario.id} names encounter set ${ownSet}, which is not registered`);
    expect(messages).toContain(
      `villainCardId "${scenario.villainCardId}" is in neither this pack nor the packs it requires`,
    );
  });

  it("reports an identity's missing obligation and nemesis set, a mistyped precon identity and an unknown card", () => {
    const cap = WAVE1_BUILTIN_PACKS.find((pack) => pack.manifest.id === "cap")!;
    const identity = cap.cards.find((card) => card.type === "hero_identity")!;
    if (identity.type !== "hero_identity") throw new Error("cap has an identity");
    const deck = cap.decks[0]!;
    const broken: BuiltinPack = {
      ...cap,
      cards: cap.cards.filter((card) => card.id !== identity.obligationCardId),
      encounterSets: cap.encounterSets.filter((set) => set.id !== identity.nemesisEncounterSetId),
      decks: [
        {
          ...deck,
          identityCardId: identity.obligationCardId,
          cards: [...deck.cards, { cardId: "99999" as never, quantity: 1 }],
        },
      ],
    };
    const messages = splitIssues(validateBuiltinPack(broken, { requires: [CORE_BUILTIN_PACK] })).defects.map(
      (issue) => `${issue.path}: ${issue.message}`,
    );
    const nowhere = "is in neither this pack nor the packs it requires";
    expect(messages).toContain(`cards/${identity.id}: obligationCardId "${identity.obligationCardId}" ${nowhere}`);
    expect(messages).toContain(`cards/${identity.id}: nemesis set "${identity.nemesisEncounterSetId}" ${nowhere}`);
    expect(messages).toContain(`decks/${deck.id}: identity "${identity.obligationCardId}" ${nowhere}`);
    expect(messages).toContain(`decks/${deck.id}: card "99999" ${nowhere}`);
    // A card of the nemesis set now names a set nobody registers.
    expect(messages.some((m) => m.includes(`encounter set "${identity.nemesisEncounterSetId}" ${nowhere}`))).toBe(true);
  });

  it("reports a precon identity of the wrong type, and a clash with a required pack instead of throwing", () => {
    const deck = CORE_BUILTIN_PACK.decks[0]!;
    const ally = CORE_BUILTIN_PACK.cards.find((card) => card.type === "ally")!;
    const broken: BuiltinPack = { ...CORE_BUILTIN_PACK, decks: [{ ...deck, identityCardId: ally.id }] };
    const messages = splitIssues(validateBuiltinPack(broken, { requires: [CORE_BUILTIN_PACK] })).defects.map(
      (issue) => `${issue.path}: ${issue.message}`,
    );
    expect(messages).toContain(`decks/${deck.id}: identity "${ally.id}" is a ally, not a hero_identity`);
    const [firstScript] = Object.keys(CORE_BUILTIN_PACK.abilities);
    expect(messages).toContain(`abilities/${firstScript}: is also scripted by a pack this one requires`);
    expect(messages).toContain(`cards/${CORE_BUILTIN_PACK.cards[0]!.id}: is also a card of a pack this one requires`);
  });

  it("reports an identity whose nemesis set is another hero's", () => {
    const spiderMan = CORE_BUILTIN_PACK.cards.find((card) => card.type === "hero_identity")!;
    const otherNemesis = WAVE1_BUILTIN_PACKS[0]!.encounterSets.find((set) => set.nemesisOfIdentityId !== undefined)!;
    const broken: BuiltinPack = {
      ...CORE_BUILTIN_PACK,
      cards: CORE_BUILTIN_PACK.cards.map((card) =>
        card === spiderMan ? { ...card, nemesisEncounterSetId: otherNemesis.id } : card,
      ) as BuiltinPack["cards"],
    };
    const messages = splitIssues(validateBuiltinPack(broken, { requires: [WAVE1_BUILTIN_PACKS[0]!] })).defects.map(
      (issue) => issue.message,
    );
    expect(messages).toContain(`nemesis set "${otherNemesis.id}" is not this hero's nemesis set`);
  });

  it("reports a wave 1 scenario checked without the Core pack it needs", () => {
    const gob = WAVE1_BUILTIN_PACKS.find((pack) => pack.manifest.id === "gob")!;
    const { defects } = splitIssues(validateBuiltinPack(gob));
    expect(defects.some((issue) => /which is not registered/.test(issue.message))).toBe(true);
  });
});
