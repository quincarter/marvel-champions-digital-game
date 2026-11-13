import {
  BUILTIN_PACKS,
  CORE_BUILTIN_PACK,
  WAVE1_ABILITIES,
  WAVE1_BUILTIN_PACKS,
  WAVE1_DEPS,
  wave1Scenario,
  type BuiltinPack,
} from "@mc/cards";
import { playToOutcome } from "@mc/cards/testing";
import { createGame } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { builtinGameDeps, validateBuiltinPack } from "./builtin.js";
import { customContentOfPacks, type PackGameContent } from "./game.js";
import { splitIssues } from "./validate.js";

/** What each built-in pack is played with: Core under every wave 1 product. */
const requiresOf = (pack: BuiltinPack): readonly BuiltinPack[] =>
  pack === CORE_BUILTIN_PACK ? [] : [CORE_BUILTIN_PACK];

/**
 * The card abilities a built-in pack leaves unscripted, by pack id: none for Core and wave 1. A script dropped from a
 * pack shows up as unscripted and fails the test; a later wave lists its known gaps here.
 */
const KNOWN_UNSCRIPTED: Readonly<Record<string, readonly string[]>> = {};

describe("built-in packs through the SDK", () => {
  it.each(BUILTIN_PACKS.map((pack) => [pack.manifest.id, pack] as const))("%s passes the SDK's checks", (id, pack) => {
    const { defects, unscripted } = splitIssues(validateBuiltinPack(pack, { requires: requiresOf(pack) }));
    expect(defects).toEqual([]);
    expect(unscripted.map((issue) => issue.message.replace(/^ability "(.*)" is not scripted$/, "$1")).sort()).toEqual(
      KNOWN_UNSCRIPTED[id] ?? [],
    );
  });

  it("carry the whole wave 1 registry between them, reprint aliases included", () => {
    const { abilities } = builtinGameDeps(BUILTIN_PACKS);
    expect(Object.keys(abilities).sort()).toEqual(Object.keys(WAVE1_ABILITIES).sort());
    for (const [id, definition] of Object.entries(abilities)) expect(WAVE1_ABILITIES[id]).toBe(definition);
  });

  // A Captain America precon (reprint aliases included: Make the Call is one) against Risky Business, on deps built from
  // the packs alone, plays the same game as on WAVE1_DEPS.
  it("play a wave 1 game on deps built from the packs alone, the same as on the wave's registry", () => {
    const play = (deps: typeof WAVE1_DEPS) => {
      const config = wave1Scenario("risky-business", { players: [{ starterDeckId: "cap-leadership" }], seed: 7 });
      const created = createGame(config, deps);
      if (!created.ok) throw new Error(created.error.message);
      const run = playToOutcome(created.state, deps, { maxCommands: 4000 });
      return { outcome: run.outcome, rounds: run.rounds, log: run.session.log };
    };
    const fromPacks = play(builtinGameDeps(BUILTIN_PACKS));
    expect(fromPacks.outcome).not.toBeNull();
    expect(fromPacks).toEqual(play(WAVE1_DEPS));
  });

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

  it("reports a wave 1 scenario checked without the Core pack it needs", () => {
    const gob = WAVE1_BUILTIN_PACKS.find((pack) => pack.manifest.id === "gob")!;
    const { defects } = splitIssues(validateBuiltinPack(gob));
    expect(defects.some((issue) => /which is not registered/.test(issue.message))).toBe(true);
  });
});
