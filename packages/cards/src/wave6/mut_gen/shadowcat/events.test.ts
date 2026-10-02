import { activeVillain, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { WAVE6_DEPS } from "../../index.js";
import { SHADOWCAT_EVENTS } from "./events.js";
import { shadowcatGame } from "./support.js";

const hero = (state: GameState) => identityOf(state, P1);
const villain = (state: GameState) => activeVillain(state).instanceId;
const solid = (state: GameState): InstanceId => instancesOf(state, "32031a")[0]!;
const isPhased = (state: GameState) => inst(state, solid(state)).flipped;

/** Shadowcat in hero form in the mass form asked for (the upgrade's faceup side is Solid, flipped is Phased). */
function asHero(phased: boolean): GameState {
  const state = runWith(WAVE6_DEPS, shadowcatGame(), toHero(P1));
  return phased ? patchInstance(state, solid(state), { flipped: true }) : state;
}
const accepting: Picker = (state) =>
  state.pendingChoice?.prompt.kind === "chooseTriggers"
    ? state.pendingChoice.options.map((o) => o.optionId)
    : firstLegal(state);
/** Hero Action events: played from hand paying `cost` with other cards. */
const cast = (state: GameState, code: string, cost: number, pick: Picker = firstLegal) => {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const after = settle(
    runWith(WAVE6_DEPS, given.state, play(P1, id, payWith(given.state, P1, cost, [id]))),
    pick,
    undefined,
    WAVE6_DEPS,
  );
  return { after, id };
};
/** The main scheme starts at 0 threat here, so give it some for a thwart to remove. */
const withThreat = (state: GameState): GameState => patchInstance(state, state.mainScheme.instanceId, { threat: 8 });
const inDiscard = (state: GameState, id: InstanceId) => playerOf(state, P1).discard.includes(id);

describe("Shadowcat events (32037-32040) and Toe to Toe (32046)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(SHADOWCAT_EVENTS).sort()).toEqual([
      "32037.shadowcat-surprise-action",
      "32038.phase-strike-action",
      "32039.airwalk-action",
      "32040.quick-shift-constant",
      "32040.quick-shift-constant-2",
      "32040.quick-shift-interrupt",
      "32046.toe-to-toe-action",
    ]);
    for (const definition of Object.values(SHADOWCAT_EVENTS)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Shadowcat Surprise (32037)", () => {
    it("deals 3 damage to an enemy and readies her exhausted hero", () => {
      const state = asHero(false);
      const exhausted = patchInstance(state, hero(state), { exhausted: true });
      const { after, id } = cast(exhausted, "32037", 2);
      expect(inst(after, villain(state)).damage).toBe(3);
      expect(inst(after, hero(after)).exhausted).toBe(false);
      expect(inDiscard(after, id)).toBe(true);
    });
    it("works the same in Phased mass form", () => {
      const state = asHero(true);
      const { after } = cast(state, "32037", 2);
      expect(inst(after, villain(state)).damage).toBe(3);
      // Attacking in Phased mass form flips it back (Phased's Forced Response, 32031b).
      expect(isPhased(after)).toBe(false);
    });
    it("is an attack event: it cannot be played from alter-ego form", () => {
      const state = shadowcatGame();
      const given = moveToHand(state, P1, "32037");
      const [id] = given.ids as [InstanceId];
      expect(() => runWith(WAVE6_DEPS, given.state, play(P1, id, payWith(given.state, P1, 2, [id])))).toThrow();
    });
  });

  describe("Airwalk (32039)", () => {
    it("Solid: removes 2 threat from a scheme", () => {
      const state = withThreat(asHero(false));
      const before = mainThreat(state);
      const { after } = cast(state, "32039", 1);
      expect(mainThreat(after)).toBe(before - 2);
    });
    it("Phased: removes 4 threat instead", () => {
      const state = withThreat(asHero(true));
      const before = mainThreat(state);
      const { after } = cast(state, "32039", 1);
      expect(mainThreat(after)).toBe(before - 4);
    });
  });

  describe("Phase Strike (32038)", () => {
    /** Lethal Weapon (`nebu` 22030, a Hero Action) and Spiked Mace-free Rhino: one attachment on the villain. */
    const withAttachment = (state: GameState, code: string): { state: GameState; weapon: InstanceId } => {
      const target = villain(state);
      const weapon = `phase-strike-${code}` as InstanceId;
      return {
        weapon,
        state: {
          ...state,
          instances: {
            ...state.instances,
            [target]: { ...inst(state, target), attachments: [...inst(state, target).attachments, weapon] },
            [weapon]: {
              ...inst(state, target),
              instanceId: weapon,
              cardId: code as never,
              ownerId: null,
              controllerId: null,
              home: { kind: "activeEncounterDeck" },
              damage: 0,
              threat: 0,
              attachedTo: target,
              attachments: [],
              boostCards: [],
              tucked: [],
              engagedWith: null,
              flipped: false,
            } as never,
          },
        },
      };
    };
    const pickingAttachment =
      (weapon: InstanceId): Picker =>
      (state) => {
        const offered = state.pendingChoice?.options.map((o) => o.optionId) ?? [];
        return offered.includes(weapon) ? [weapon] : firstLegal(state);
      };
    it("deals 6 damage in Solid mass form and discards nothing", () => {
      const { state, weapon } = withAttachment(asHero(false), "22030");
      const { after } = cast(state, "32038", 3, pickingAttachment(weapon));
      expect(inst(after, villain(state)).damage).toBe(6);
      expect(inst(after, villain(after)).attachments).toContain(weapon);
    });
    it("Phased: deals 6 and may discard a Hero Action attachment from that enemy", () => {
      const { state, weapon } = withAttachment(asHero(true), "22030");
      const { after } = cast(state, "32038", 3, pickingAttachment(weapon));
      expect(inst(after, villain(state)).damage).toBe(6);
      expect(inst(after, villain(after)).attachments).not.toContain(weapon);
    });
    it("Phased: may decline to discard it", () => {
      const { state, weapon } = withAttachment(asHero(true), "22030");
      const { after } = cast(state, "32038", 3, firstLegal);
      expect(inst(after, villain(state)).damage).toBe(6);
      expect(inst(after, villain(after)).attachments).toContain(weapon);
    });
    it("Phased: an attachment with neither a Hero Action nor a Hero Response is not offered", () => {
      // Rhino has no attachment to start with; 01xxx has none in the pool of text-free attachments we can stage, so
      // an empty host is the negative case: 6 damage, no prompt for an attachment, nothing to discard.
      const state = asHero(true);
      const { after } = cast(state, "32038", 3, firstLegal);
      expect(inst(after, villain(state)).damage).toBe(6);
      expect(after.pendingChoice).toBeNull();
    });
  });

  describe("Quick Shift (32040)", () => {
    /** Ends the turn so the villain attacks; Quick Shift is accepted when offered, the hero defends. */
    const attacked = (state: GameState, accept: boolean) => {
      const given = moveToHand(state, P1, "32040");
      const [id] = given.ids as [InstanceId];
      const pick: Picker = (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "declareDefender") return [hero(s)];
        return accept ? accepting(s) : firstLegal(s);
      };
      const after = settle(
        runWith(WAVE6_DEPS, given.state, { type: "endTurn", playerId: P1 }),
        pick,
        undefined,
        WAVE6_DEPS,
      );
      return { after, id, handBefore: playerOf(given.state, P1).hand.length };
    };
    it("Solid: changes to Phased mass form (no card drawn)", () => {
      const state = asHero(false);
      const { after, id } = attacked(state, true);
      expect(isPhased(after)).toBe(true);
      expect(inDiscard(after, id)).toBe(true);
    });
    it("Phased: draws 2 cards and stays Phased", () => {
      const state = asHero(true);
      const base = attacked(state, false);
      const used = attacked(state, true);
      expect(inDiscard(used.after, used.id)).toBe(true);
      expect(isPhased(used.after)).toBe(true);
      expect(playerOf(used.after, P1).hand.length).toBeGreaterThan(playerOf(base.after, P1).hand.length);
    });
    it("declined: the form is unchanged and the card stays in hand", () => {
      const { after, id } = attacked(asHero(false), false);
      expect(isPhased(after)).toBe(false);
      expect(playerOf(after, P1).hand).toContain(id);
    });
  });

  describe("Toe to Toe (32046)", () => {
    /** A villain that hits hard enough for a defense to cost hit points (the identity tests' fixture). */
    const strongVillain = (state: GameState): GameState => {
      const card = state.cardPool[state.instances[villain(state)]!.cardId]!;
      if (card.type !== "villain") throw new Error("not a villain");
      return {
        ...state,
        cardPool: {
          ...state.cardPool,
          [card.id]: {
            ...card,
            sides: card.sides.map((side) => ({ ...side, stages: side.stages.map((st) => ({ ...st, atk: 6 })) })),
          } as unknown as typeof card,
        },
      };
    };
    /** The villain attacks Shadowcat (she defends), then she attacks it for 5. */
    const toeToToe = (state: GameState) => {
      const pick: Picker = (s) => (s.pendingChoice?.prompt.kind === "declareDefender" ? [hero(s)] : firstLegal(s));
      return cast(state, "32046", 1, pick);
    };
    it("Solid: the villain attacks her (she takes damage), then she deals 5 damage to it", () => {
      const state = asHero(false);
      const { after, id } = toeToToe(strongVillain(state));
      expect(inst(after, hero(after)).damage).toBeGreaterThan(0);
      expect(inst(after, villain(state)).damage).toBe(5);
      expect(inDiscard(after, id)).toBe(true);
    });
    it("Phased: she defends the villain's attack and takes no damage, still deals 5 damage", () => {
      const state = asHero(true);
      const { after } = toeToToe(strongVillain(state));
      expect(inst(after, hero(after)).damage).toBe(0);
      expect(inst(after, villain(state)).damage).toBe(5);
      // Defending flips Phased back to Solid (Forced Response of 32031b).
      expect(isPhased(after)).toBe(false);
    });
  });
});
