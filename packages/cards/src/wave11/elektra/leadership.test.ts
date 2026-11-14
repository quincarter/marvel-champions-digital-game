import { type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { P1, inst, patchInstance, playerOf, type Picker } from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { WAVE11_DEPS } from "../index.js";
import { engageMinion, stagedInPlay } from "../../wave9/falcon/testing.js";
import { ELEKTRA_LEADERSHIP as REGISTRY, ELEKTRA_LEADERSHIP_SKIPPED as SKIPPED } from "./leadership.js";
import { CAPTAIN_MARVEL_LEADERSHIP, SANDMAN, basicAttack, drive, elektraAspectGame } from "./aspect-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `elektra/leadership`: Moondragon 63038, in the deck of Core's Captain Marvel (Leadership) against Rhino. Her
 * printed ATK 1, THW 1 and 1 consequential damage per power; hit points 5.
 */
const MOONDRAGON = "63038";
const REF = "63038.moondragon-interrupt";
const A = "m-sandman-a" as InstanceId;

/** Moondragon in play, and a Sandman (4 hit points) engaged with P1. */
function setup() {
  const staged = stagedInPlay(elektraAspectGame(MOONDRAGON, CAPTAIN_MARVEL_LEADERSHIP), MOONDRAGON);
  return { state: engageMinion(staged.state, SANDMAN, A), id: staged.id };
}
/** Takes the interrupt when \`take\`, and chooses \`x\` when asked for a number. */
const answering =
  (take: boolean, x: number): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => String(o.optionId));
    if (choice.prompt.kind === "chooseTriggers") return take ? ids : [];
    const hit = ids.find((i) => i === String(x) || i.endsWith(`:${x}`));
    return hit !== undefined ? [hit] : ids.slice(0, choice.minSelections);
  };

describe("registry", () => {
  it("registers the interrupt, skips nothing, and it validates", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY)).toEqual([REF]);
    expect(validateDefinition(REGISTRY[REF]!)).toEqual([]);
    expect(REGISTRY[REF]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
  });
});

describe(`${REF}: choose 1 to 3: +X to the power and +X consequential damage for this use`, () => {
  it("declined, her attack deals 1 and she takes 1 consequential damage", () => {
    const { state, id } = setup();
    const after = drive(state, answering(false, 0), basicAttack(id, A));
    expect(inst(after, A).damage).toBe(1);
    expect(inst(after, id).damage).toBe(1);
  });

  it.each([1, 2, 3])("choosing %i, she attacks for 1+%i and takes 1+%i consequential damage", (x) => {
    const { state, id } = setup();
    const hurt = patchInstance(state, A, { damage: 0 });
    const after = drive(hurt, answering(true, x), basicAttack(id, A));
    // A Sandman has 4 hit points: 1+3 defeats it, so only the damage she takes is read for 3.
    if (x < 3) expect(inst(after, A).damage).toBe(1 + x);
    expect(inst(after, id).damage).toBe(1 + x);
  });

  it("applies to a thwart too: +2 THW and 3 consequential damage for X = 2", () => {
    const { state, id } = setup();
    const scheme = encounterCardInVillainArea(state, "01107", 5);
    const after = drive(scheme.state, answering(true, 2), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: id,
      schemeInstanceId: scheme.id,
    });
    expect(inst(after, scheme.id).threat).toBe(2);
    expect(inst(after, id).damage).toBe(3);
  });

  it("is for that use only: her next attack is the plain one", () => {
    const { state, id } = setup();
    const first = drive(state, answering(true, 2), basicAttack(id, A));
    expect(inst(first, A).damage).toBe(3);
    const ready = patchInstance(first, id, { exhausted: false, damage: 0 });
    const second = drive(ready, answering(false, 0), basicAttack(id, A));
    expect(playerOf(second, P1).playArea).not.toContain(A); // 3 + 1 = its 4 hit points
    expect(inst(second, id).damage).toBe(1);
  });
});

describe(`${REF} with villainous: the Villainous give comes first, after the attack's "would" interrupts`, () => {
  // Villainous = Forced Interrupt: when this character uses a basic power (RRG 1.8 "Villainous", p. 47), Moondragon's
  // own triggering condition, so it initiates before her optional interrupt ("Forced", p. 20); "would" interrupts to
  // the attack go first, and a "would" cancel gives no card ("'Would'", p. 48). Rules expert verdict.
  const villainous = (s: GameState, id: InstanceId): GameState => ({
    ...s,
    lastingEffects: [
      ...s.lastingEffects,
      {
        id: "test.villainous",
        kind: "keywordGrant",
        keyword: { name: "villainous" },
        targets: [id],
        affects: null,
        scope: { selfInstanceId: null, controllerId: null, vars: {}, bindings: {} },
        duration: { kind: "endOfRound" },
      } as never,
    ],
  });
  const taking: Picker = (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => String(o.optionId));
    if (choice.prompt.kind === "chooseTriggers") return ids.filter((i) => i.endsWith(REF));
    return ids.slice(0, Math.max(1, choice.minSelections));
  };
  const resolvedAt = (events: readonly GameEvent[], ref: string) =>
    events.findIndex((e) => e.type === "abilityResolved" && (e.abilityId as string) === ref);

  it("her card is given before her interrupt resolves", () => {
    const { state, id } = setup();
    const { events } = driveEventsPicking(WAVE11_DEPS, villainous(state, id), taking, basicAttack(id, A));
    const dealt = events.findIndex((e) => e.type === "boostCardDealt");
    expect(dealt).toBeGreaterThanOrEqual(0);
    expect(resolvedAt(events, REF)).toBeGreaterThan(dealt);
    expect(resolvedAt(events, "keyword:villainous")).toBeLessThan(dealt);
  });

  it("a 'would attack' cancel: no card is given and her interrupt is never offered", () => {
    // Test only: Moon Knight's ref made "Forced Interrupt: When a character would attack, cancel that attack".
    const cancelling = {
      abilities: {
        ...WAVE11_DEPS.abilities,
        "63039.moon-knight-interrupt": {
          trigger: { kind: "interrupt", forced: true, would: true, on: { on: "attack" } },
          effects: [{ kind: "cancelTriggeringEvent" }],
        } as never,
      },
    };
    const { state, id } = setup();
    const granted = villainous(state, id);
    const spare = playerOf(granted, P1).deck.at(-1)!;
    const knight = stagedInPlay(patchInstance(granted, spare, { cardId: "63039" as never }), "63039");
    const seen: string[] = [];
    const pick: Picker = (s) => {
      for (const o of s.pendingChoice!.options) seen.push(String(o.optionId));
      return taking(s);
    };
    const { state: after, events } = driveEventsPicking(cancelling, knight.state, pick, basicAttack(id, A));
    expect(events.some((e) => e.type === "boostCardDealt")).toBe(false);
    expect(seen.some((o) => o.endsWith(REF))).toBe(false);
    expect(inst(after, A).damage).toBe(0);
  });
});
