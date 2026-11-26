import { PLAYABLE_CARDS } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  activeEncounterDeck,
  type GameState,
  type GameEvent,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import { P1, endTurn, firstLegal, identityOf, inst, patchInstance, playerOf, use } from "../../../testing/harness.js";
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
 * Wave 11 `elektra/elektra/obligation-nemesis`: Conditioned by the Hand 63028, Aka 63029, The Fist Fits in the Hand
 * 63030, Hand Katana 63031, Hand Blademaster 63032 and Hand Archer 63033. The cards are staged by surgery in a Core
 * hero's game (Elektra's own identity is scripted by another module); the Elektra-player and hero-form conditions are
 * checked on the definitions.
 */
const REFS = [
  "63028.obligation",
  "63028.conditioned-by-the-hand-forced-response",
  "63028.conditioned-by-the-hand-action",
  "63029.when-defeated",
  "63029.boost",
  "63030.the-fist-fits-in-the-hand-constant",
  "63031.hand-katana-action",
  "63032.hand-blademaster-constant",
  "63032.when-defeated",
  "63033.hand-archer-constant",
  "63033.when-defeated",
];
type Loose = {
  type: string;
  statModifiers?: unknown;
  boostIcons?: number;
  traits: unknown[];
  attachesTo?: unknown;
  icons?: unknown;
  keywords?: { name: string }[];
};
const cardById = (code: string) => PLAYABLE_CARDS.find((c) => String(c.id) === code) as unknown as Loose | undefined;
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

describe("63032 Hand Blademaster", () => {
  it("is alone: no bonus", () => {
    expect(profile(engageMinion(game(), "63032", A), A)).toMatchObject({ atk: 1, sch: 1 });
  });

  it("gets +1 SCH and +1 ATK once if there is another Hand minion, however many others", () => {
    const two = engageMinion(engageMinion(game(), "63032", A), "63032", B);
    expect(profile(two, A)).toMatchObject({ atk: 2, sch: 2 });
    const three = engageMinion(two, "63033", ARCHER);
    expect(profile(three, A)).toMatchObject({ atk: 2, sch: 2 });
    expect(profile(three, ARCHER)).toMatchObject({ atk: 1, sch: 1 });
  });

  it("does not count non-Hand minions", () => {
    const s = engageMinion(engageMinion(game(), "63032", A), "01102", "m-sandman");
    expect(profile(s, A)).toMatchObject({ atk: 1, sch: 1 });
  });
});

/** Ends P1's turn and answers every prompt first-legal until the villain phase is over, collecting the events. */
function villainPhaseEvents(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  let current = state;
  const step = (command: Parameters<typeof applyCommand>[1]) => {
    const r = applyCommand(current, command, DEPS);
    if (!r.ok) throw new Error(r.error.message);
    current = r.state;
    events.push(...r.events);
  };
  step(endTurn(P1));
  for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
    if (guard > 500) throw new Error("choices did not settle");
    const choice = current.pendingChoice;
    step({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: firstLegal(current),
    });
  }
  return events;
}

describe("63033 Hand Archer", () => {
  it("its attacks gain ranged (a constant, not a keyword)", () => {
    const keywords = (cardById("63033")?.keywords ?? []).map((k) => k.name);
    expect(keywords).toEqual(["quickstrike"]);
    const staged = engageMinion(engageMinion(game(), "63033", ARCHER), "63032", A);
    const hits = villainPhaseEvents(staged).flatMap((e) =>
      e.type === "triggerEvent" && e.event.kind === "dealDamage" && e.phase === "resolved" && e.event.fromAttack
        ? [e.event]
        : [],
    );
    const by = (id: InstanceId) => hits.filter((h) => h.sourceInstanceId === id);
    expect(by(ARCHER).length).toBeGreaterThan(0);
    expect(by(A).length).toBeGreaterThan(0);
    expect(by(ARCHER).every((h) => Boolean(h.ranged))).toBe(true);
    expect(by(A).some((h) => Boolean(h.ranged))).toBe(false);
  });
});

describe("63031 Hand Katana", () => {
  it("is data: a Weapon attachment, +2 ATK, boost 2, attaches to the Hand minion with the highest base HP else the villain", () => {
    const card = cardById("63031")!;
    expect([card.type, card.statModifiers, card.boostIcons, card.traits.map(String)]).toEqual([
      "attachment",
      { atk: 2 },
      2,
      ["WEAPON"],
    ]);
    expect(card.attachesTo).toMatchObject({
      kind: "ifAble",
      preferred: { kind: "superlative", order: "highest", measure: "printedHp" },
      otherwise: { kind: "villain" },
    });
  });

  it("Hero Action: spend 2 resources to discard it from its host", () => {
    const placed = engageMinion(game(), "63033", ARCHER);
    const katana = activeEncounterDeck(placed).deck.find((i) => placed.instances[i]!.cardId === "01186")!;
    const attached = patchInstance(
      patchInstance(placed, katana, { cardId: "63031" as never, faceup: true, attachedTo: ARCHER }),
      ARCHER,
      { attachments: [katana] },
    );
    expect(profile(attached, ARCHER)).toMatchObject({ atk: 3 });
    const hand = playerOf(attached, P1).hand.slice(0, 2);
    const after = drive(
      attached,
      accepting(),
      use(
        P1,
        katana,
        "63031.hand-katana-action",
        hand.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(inst(after, katana).attachedTo).toBeNull();
    expect(activeEncounterDeck(after).discard).toContain(katana);
  });
});

describe("63030 The Fist Fits in the Hand", () => {
  it("has a hazard scheme icon", () => {
    expect(cardById("63030")?.icons).toEqual(["hazard"]);
  });

  it("each Hand minion gets +1 SCH and +1 ATK, other minions do not", () => {
    const base = engageMinion(engageMinion(game(), "63033", ARCHER), "01102", "m-sandman");
    const retagged = patchInstance(
      base,
      activeEncounterDeck(base).deck.find((i) => base.instances[i]!.cardId === "01186")!,
      { cardId: "63030" as never },
    );
    const placed = encounterCardInVillainArea(retagged, "63030", 3);
    expect(profile(placed.state, ARCHER)).toMatchObject({ atk: 2, sch: 2 });
    expect(profile(placed.state, "m-sandman" as InstanceId)).toMatchObject({ atk: 3, sch: 2 });
  });
});

describe("When Defeated: shuffle this card into the encounter deck", () => {
  it.each([
    ["63032", "Hand Blademaster"],
    ["63033", "Hand Archer"],
  ])("%s (%s) is in the encounter deck after it is defeated", (code) => {
    const staged = patchInstance(engageMinion(game(), code, A), A, { damage: 2 });
    expect(identityOf(staged)).toBeDefined();
    const after = drive(staged, accepting(), basicAttack(identityOf(staged), A, P1));
    expect(activeEncounterDeck(after).deck).toContain(A);
  });

  it("63029 Aka too", () => {
    const staged = patchInstance(engageMinion(game(), "63029", A), A, { damage: 3 });
    const after = drive(staged, accepting(), basicAttack(identityOf(staged), A, P1));
    expect(activeEncounterDeck(after).deck).toContain(A);
  });
});
