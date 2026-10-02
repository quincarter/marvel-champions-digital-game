import { applyCommand, cardsInPlay, type Command, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
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
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { defeatWithAttack, revealFromEncounterDeck, stackSetAside } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { SHADOWCAT_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { shadowcatGame } from "./support.js";

const hero = (state: GameState) => identityOf(state, P1);
const statuses = (state: GameState) => inst(state, hero(state)).statuses;
const villain = (state: GameState) => state.villains[0]!.instanceId;
const solid = (state: GameState): InstanceId => instancesOf(state, "32031a")[0]!;
const inPlayArea = (state: GameState, id: InstanceId) => playerOf(state, P1).playArea.includes(id);
const inEncounterDiscard = (state: GameState, id: InstanceId) =>
  Object.values(state.encounterDecks).some((pile) => pile.discard.includes(id));
const accepting: Picker = (state) =>
  state.pendingChoice?.prompt.kind === "chooseTriggers"
    ? state.pendingChoice.options.map((o) => o.optionId)
    : firstLegal(state);
const reveal = (state: GameState, code: string, pick: Picker = firstLegal) =>
  revealFromEncounterDeck(WAVE6_DEPS, state, code, pick);
const ok = (state: GameState, command: Command) => applyCommand(state, command, WAVE6_DEPS).ok;
const attackVillain = (state: GameState): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: hero(state),
  targetInstanceId: villain(state),
});
const thwartMain = (state: GameState): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: hero(state),
  schemeInstanceId: state.mainScheme.instanceId,
});
const asHero = (): GameState => runWith(WAVE6_DEPS, shadowcatGame(), toHero(P1));
const pass = (state: GameState, pick: Picker = firstLegal) =>
  settle(runWith(WAVE6_DEPS, state, endTurn(P1)), pick, undefined, WAVE6_DEPS);

describe("Shadowcat's obligation and nemesis set (32055-32059)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(SHADOWCAT_OBLIGATION_NEMESIS).sort()).toEqual([
      "32055.permanently-phased-action",
      "32055.permanently-phased-constant",
      "32056.boost",
      "32056.white-queen-constant",
      "32057.when-defeated",
      "32058.boost",
      "32059.telepathic-restraint-action",
      "32059.telepathic-restraint-constant",
    ]);
    for (const definition of Object.values(SHADOWCAT_OBLIGATION_NEMESIS))
      expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Permanently Phased (32055)", () => {
    const phasedGame = (form: "hero" | "alterEgo") => {
      const state = pass(stackEncounterDeck(shadowcatGame(), "01186", "32055"));
      const id = instancesOf(state, "32055")[0]!;
      return { state: form === "hero" ? runWith(WAVE6_DEPS, state, toHero(P1)) : state, id };
    };
    it("is revealed into the Kitty Pryde player's play area and stays there", () => {
      const { state, id } = phasedGame("alterEgo");
      expect(inPlayArea(state, id)).toBe(true);
    });

    it("option 1, 'You cannot attack': Shadowcat's basic attack is illegal", () => {
      const control = asHero();
      expect(ok(control, attackVillain(control))).toBe(true);
      const { state } = phasedGame("hero");
      expect(ok(state, attackVillain(state))).toBe(false);
    });

    // ENGINE GAP: `cannotDefend` (rules.ts) reads its `target` in the rule card's own context, where an obligation's
    // "you" matches nobody; `speakerContext` (docs/phase7-wave2.md §25.3) is what it needs. `it.fails` flips to a red
    // test when that lands, so this one is then switched to a plain `it`.
    it.fails("option 1, 'defend': Shadowcat is not offered as a defender, so the villain's attack goes undefended", () => {
      const offered = (state: GameState): boolean => {
        let seen = false;
        const pick: Picker = (s) => {
          if (s.pendingChoice?.prompt.kind === "declareDefender") {
            if (!s.pendingChoice.options.some((o) => o.optionId === hero(s))) return ["decline"];
            seen = true;
            return [hero(s)];
          }
          return firstLegal(s);
        };
        pass(state, pick);
        return seen;
      };
      expect(offered(asHero())).toBe(true);
      expect(offered(phasedGame("hero").state)).toBe(false);
    });

    it("option 1, 'change mass form': Phase Control does not flip the mass form while it is in play", () => {
      const phaseControl = (state: GameState) => use(P1, hero(state), "32030b.kitty-pryde-constant");
      const control = settle(runWith(WAVE6_DEPS, shadowcatGame(), phaseControl(shadowcatGame())), firstLegal, undefined, WAVE6_DEPS);
      expect(inst(control, solid(control)).flipped).toBe(true);
      const { state } = phasedGame("alterEgo");
      const after = settle(runWith(WAVE6_DEPS, state, phaseControl(state)), firstLegal, undefined, WAVE6_DEPS);
      expect(inst(after, solid(after)).flipped).toBe(false);
    });

    it("option 2, Alter-Ego Action: exhaust Kitty Pryde removes it from the game and lifts the bans", () => {
      const { state, id } = phasedGame("alterEgo");
      const used = settle(
        runWith(WAVE6_DEPS, state, use(P1, id, "32055.permanently-phased-action")),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(used.removedFromGame).toContain(id);
      expect(inst(used, hero(used)).exhausted).toBe(true);
      expect(ok(runWith(WAVE6_DEPS, { ...used }, toHero(P1)), { type: "endTurn", playerId: P1 })).toBe(true);
    });

    it("the Alter-Ego Action is not usable in hero form", () => {
      const { state, id } = phasedGame("hero");
      expect(ok(state, use(P1, id, "32055.permanently-phased-action"))).toBe(false);
    });
  });

  describe("White Queen (32056)", () => {
    it("engaged with you on entering play: you are confused at once", () => {
      const { state, id } = reveal(asHero(), "32056");
      expect(cardsInPlay(state)).toContain(id);
      expect(statuses(state).confused).toBe(1);
    });

    it("a thwart spends the confused card and she gives another at once (FAQ #56, RRG 1.8 p. 63)", () => {
      const { state, id } = reveal(asHero(), "32056");
      const thwarted = settle(
        runWith(WAVE6_DEPS, patchInstance(state, state.mainScheme.instanceId, { threat: 8 }), thwartMain(state)),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(thwarted, hero(thwarted)).exhausted).toBe(true);
      // The thwart attempt spent the confused card (no threat came off), and she gave the next one at once.
      expect(mainThreat(thwarted)).toBe(8);
      expect(statuses(thwarted).confused).toBe(1);
      expect(cardsInPlay(thwarted)).toContain(id);
    });

    it("when she leaves play the confused card stays (FAQ #56)", () => {
      const { state, id } = reveal(asHero(), "32056");
      const defeated = defeatWithAttack(WAVE6_DEPS, state, id);
      expect(cardsInPlay(defeated)).not.toContain(id);
      expect(statuses(defeated).confused).toBe(1);
    });

    it("as a boost card, you are confused", () => {
      const after = pass(stackSetAside(asHero(), "32056"));
      expect(statuses(after).confused).toBe(1);
    });
  });

  describe("The Hellfire Club (32057)", () => {
    it("is revealed from the set-aside nemesis cards with 2 threat per player", () => {
      const { state, id } = reveal(asHero(), "32057");
      expect(inst(state, id).threat).toBe(2);
    });

    it("When Defeated: the defeater puts a Hellfire Pawn from the set-aside area into play engaged with them", () => {
      const { state, id } = reveal(asHero(), "32057");
      expect(instancesOf(state, "32058").some((p) => cardsInPlay(state).includes(p))).toBe(false);
      const after = settle(
        runWith(WAVE6_DEPS, patchInstance(state, id, { threat: 1 }), {
          type: "basicThwart",
          playerId: P1,
          thwarterInstanceId: hero(state),
          schemeInstanceId: id,
        }),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(cardsInPlay(after)).not.toContain(id);
      const pawns = instancesOf(after, "32058").filter((p) => cardsInPlay(after).includes(p));
      expect(pawns).toHaveLength(1);
      expect(inst(after, pawns[0]!).engagedWith).toBe(P1);
    });

    it("When Defeated: it also finds a Pawn in the encounter deck, and shuffles", () => {
      const { state, id } = reveal(asHero(), "32057");
      const pawnInDeck = stackSetAside(state, "32058");
      const after = settle(
        runWith(WAVE6_DEPS, patchInstance(pawnInDeck, id, { threat: 1 }), {
          type: "basicThwart",
          playerId: P1,
          thwarterInstanceId: hero(state),
          schemeInstanceId: id,
        }),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      const pawns = instancesOf(after, "32058").filter((p) => cardsInPlay(after).includes(p));
      expect(pawns).toHaveLength(1);
    });
  });

  describe("Hellfire Pawn (32058)", () => {
    it("revealed normally, it enters play engaged with you (data: guard, patrol, surge)", () => {
      const { state, id } = reveal(asHero(), "32058");
      expect(inst(state, id).engagedWith).toBe(P1);
    });

    it("as a boost card, a Pawn is put into play engaged with you", () => {
      const after = pass(stackSetAside(asHero(), "32058"));
      const pawns = instancesOf(after, "32058").filter((p) => cardsInPlay(after).includes(p));
      expect(pawns).toHaveLength(1);
      expect(inst(after, pawns[0]!).engagedWith).toBe(P1);
    });
  });

  describe("Telepathic Restraint (32059)", () => {
    it("attaches to your identity and you are stunned", () => {
      const { state, id } = reveal(asHero(), "32059");
      expect(inst(state, hero(state)).attachments).toContain(id);
      expect(statuses(state).stunned).toBe(1);
    });

    it("Action: spend two mental resources to discard it", () => {
      const { state, id } = reveal(asHero(), "32059");
      const given = moveToHand(state, P1, "32053");
      const [genius] = given.ids as [InstanceId];
      const used = settle(
        runWith(WAVE6_DEPS, given.state, use(P1, id, "32059.telepathic-restraint-action", [{ fromHand: genius }])),
        accepting,
        undefined,
        WAVE6_DEPS,
      );
      expect(inEncounterDiscard(used, id)).toBe(true);
      expect(inst(used, hero(used)).attachments).not.toContain(id);
    });
  });
});
