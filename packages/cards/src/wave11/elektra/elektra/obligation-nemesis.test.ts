import { characterProfile, activeEncounterDeck, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import { P1, identityOf, patchInstance } from "../../../testing/harness.js";
import { encounterCardInVillainArea } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave9/falcon/testing.js";
import { WAVE11_DEPS as DEPS } from "../../index.js";
import { SHE_HULK_AGGRESSION, accepting, basicAttack, drive, elektraAspectGame } from "../aspect-testing.js";
import {
  ELEKTRA_ELEKTRA_OBLIGATION_NEMESIS as REGISTRY,
  ELEKTRA_ELEKTRA_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `elektra/elektra/obligation-nemesis`: Conditioned by the Hand 63040, Aka 63041, The Fist Fits in the Hand
 * 63042, Hand Blademaster 63044 and Hand Archer 63045. PROVISIONAL text (recorded from a gameplay video and a fan
 * preview, placeholder codes). The cards are staged by surgery in a Core hero's game (Elektra's own identity is
 * scripted by another module); the Elektra-player and hero-form conditions are checked on the definitions.
 */
const REFS = [
  "63040.obligation",
  "63040.conditioned-by-the-hand-forced-response",
  "63040.conditioned-by-the-hand-action",
  "63041.when-defeated",
  "63041.boost",
  "63042.the-fist-fits-in-the-hand-constant",
  "63044.hand-blademaster-constant",
  "63044.when-defeated",
  "63045.when-defeated",
];
const game = (): GameState => elektraAspectGame("01088", SHE_HULK_AGGRESSION);
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, DEPS)!;
const A = "m-blade-a" as InstanceId;
const B = "m-blade-b" as InstanceId;
const ARCHER = "m-archer" as InstanceId;

describe("registry", () => {
  it("registers every ref, skips none, and each validates", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });
});

describe("63044 Hand Blademaster", () => {
  it("gets +1 SCH and +1 ATK for each other Hand minion in play", () => {
    const one = engageMinion(game(), "63044", A);
    expect(profile(one, A)).toMatchObject({ atk: 1, sch: 1 });
    const two = engageMinion(one, "63044", B);
    expect(profile(two, A)).toMatchObject({ atk: 2, sch: 2 });
    const three = engageMinion(two, "63045", ARCHER);
    expect(profile(three, A)).toMatchObject({ atk: 3, sch: 3 });
    expect(profile(three, ARCHER)).toMatchObject({ atk: 1, sch: 1 });
  });

  it("does not count non-Hand minions", () => {
    const s = engageMinion(engageMinion(game(), "63044", A), "01102", "m-sandman");
    expect(profile(s, A)).toMatchObject({ atk: 1, sch: 1 });
  });
});

describe("63042 The Fist Fits in the Hand", () => {
  it("each Hand minion gets +1 SCH and +1 ATK, other minions do not", () => {
    const base = engageMinion(engageMinion(game(), "63045", ARCHER), "01102", "m-sandman");
    const retagged = patchInstance(
      base,
      activeEncounterDeck(base).deck.find((i) => base.instances[i]!.cardId === "01186")!,
      { cardId: "63042" as never },
    );
    const placed = encounterCardInVillainArea(retagged, "63042", 3);
    expect(profile(placed.state, ARCHER)).toMatchObject({ atk: 2, sch: 2 });
    expect(profile(placed.state, "m-sandman" as InstanceId)).toMatchObject({ atk: 3, sch: 2 });
  });
});

describe("When Defeated: shuffle this card into the encounter deck", () => {
  it.each([
    ["63044", "Hand Blademaster"],
    ["63045", "Hand Archer"],
  ])("%s (%s) is in the encounter deck after it is defeated", (code) => {
    const staged = patchInstance(engageMinion(game(), code, A), A, { damage: 2 });
    expect(identityOf(staged)).toBeDefined();
    const after = drive(staged, accepting(), basicAttack(identityOf(staged), A, P1));
    expect(activeEncounterDeck(after).deck).toContain(A);
  });

  it("63041 Aka too", () => {
    const staged = patchInstance(engageMinion(game(), "63041", A), A, { damage: 3 });
    const after = drive(staged, accepting(), basicAttack(identityOf(staged), A, P1));
    expect(activeEncounterDeck(after).deck).toContain(A);
  });
});
