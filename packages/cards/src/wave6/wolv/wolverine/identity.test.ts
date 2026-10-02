import { cardId } from "@mc/content";
import {
  cardsInPlay,
  legalActions,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  stackEncounterDeck,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { WOLVERINE_IDENTITY } from "./identity.js";
import { wolverineGame } from "./support.js";

/** Declines the optional responses (`chooseTriggers`); anything else takes its first option. */
const decline: Picker = (state) => (state.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : firstLegal(state));
/** Takes every offered optional response; anything else takes its first option. */
const accept: Picker = (state) =>
  state.pendingChoice?.prompt.kind === "chooseTriggers"
    ? [state.pendingChoice.options[0]!.optionId]
    : firstLegal(state);
const clawsOf = (state: GameState): InstanceId => instancesOf(state, "35002")[0]!;
/** The villain is stunned and the encounter deck is stacked with harmless cards, so the villain phase deals no damage. */
const quiet = (state: GameState): GameState => {
  const villain = state.villains[0]!.instanceId;
  const stunned = patchInstance(state, villain, { statuses: { ...inst(state, villain).statuses, stunned: 1 } });
  return stackEncounterDeck(stunned, "01186");
};
const damageOf = (state: GameState): number => inst(state, identityOf(state, P1)).damage;

/** The next player phase begins: the turn ends, the villain phase plays out, `pick` answers any optional response. */
const nextPlayerPhase = (state: GameState, pick: Picker): GameState =>
  settle(runWith(WAVE6_DEPS, state, { type: "endTurn", playerId: P1 }), pick, undefined, WAVE6_DEPS);

describe("Wolverine / Logan (35001a/b)", () => {
  it("registers the identity refs the card data names, all valid", () => {
    expect(Object.keys(WOLVERINE_IDENTITY).sort()).toEqual([
      "35001a.wolverine-constant",
      "35001b.logan-constant",
      "35002.wolverines-claws-action",
    ]);
    for (const definition of Object.values(WOLVERINE_IDENTITY)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("35001b.logan-constant (Snikt! Setup)", () => {
    it("puts Wolverine's Claws into play from the set-aside area, attached to his identity", () => {
      const state = wolverineGame();
      const claws = clawsOf(state);
      expect(instancesOf(state, "35002")).toHaveLength(1);
      expect(inst(state, claws).cardId).toBe(cardId("35002"));
      expect(cardsInPlay(state)).toContain(claws);
      expect(inst(state, claws).attachedTo).toBe(identityOf(state, P1));
      expect(inst(state, identityOf(state, P1)).attachments).toContain(claws);
    });

    it("takes it from neither the deck, the hand nor the discard pile, and none is left set aside", () => {
      const state = wolverineGame();
      const claws = clawsOf(state);
      const player = playerOf(state, P1);
      expect(player.deck).not.toContain(claws);
      expect(player.hand).not.toContain(claws);
      expect(player.discard).not.toContain(claws);
      expect(player.setAside).not.toContain(claws);
    });

    it("is not searched for: the Claws is out of the starting deck, so Logan's setup never drew or shuffled it", () => {
      const state = wolverineGame();
      expect(playerOf(state, P1).hand).toHaveLength(6);
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    });
  });

  describe("form flips (hero Wolverine / alter-ego Logan)", () => {
    it("starts as Logan and flips to Wolverine and back, once per round", () => {
      const state = wolverineGame();
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
      const hero = settle(runWith(WAVE6_DEPS, state, toHero(P1)), decline, undefined, WAVE6_DEPS);
      expect(playerOf(hero, P1).identity.form).toBe("hero");
      expect(() => runWith(WAVE6_DEPS, hero, toHero(P1))).toThrow(/already_changed_form/);
      const back = settle(
        runWith(WAVE6_DEPS, withForm(state, { heroForm: 0 }), toHero(P1)),
        decline,
        undefined,
        WAVE6_DEPS,
      );
      expect(playerOf(back, P1).identity.form).toBe("alterEgo");
      // The Claws stays attached across the flip.
      expect(cardsInPlay(back)).toContain(clawsOf(back));
    });
  });

  describe("35001a.wolverine-constant (Healing Factor)", () => {
    const damaged = (state: GameState, damage: number): GameState =>
      quiet(patchInstance(withForm(state, { heroForm: 0 }), identityOf(state, P1), { damage }));

    it("Response: after the player phase begins, heals 2 damage", () => {
      const after = nextPlayerPhase(damaged(wolverineGame(), 5), accept);
      const declined = nextPlayerPhase(damaged(wolverineGame(), 5), decline);
      expect(damageOf(declined)).toBe(5);
      expect(damageOf(after)).toBe(3);
    });

    it("heals only what is there (never below 0)", () => {
      const after = nextPlayerPhase(damaged(wolverineGame(), 1), accept);
      const declined = nextPlayerPhase(damaged(wolverineGame(), 1), decline);
      expect(damageOf(declined)).toBe(1);
      expect(damageOf(after)).toBe(0);
    });

    it("is not live as Logan (alter-ego form)", () => {
      const base = wolverineGame();
      const state = quiet(patchInstance(base, identityOf(base, P1), { damage: 5 }));
      const after = nextPlayerPhase(state, accept);
      const declined = nextPlayerPhase(state, decline);
      expect(damageOf(declined)).toBe(5);
      expect(damageOf(after)).toBe(5);
    });

    it("replays deep-equal", () => {
      const state = damaged(wolverineGame(), 5);
      let session = startSession(state);
      const result = sessionApply(session, { type: "endTurn", playerId: P1 }, WAVE6_DEPS);
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
      for (let guard = 0; session.state.pendingChoice && guard < 50; guard++) {
        const choice = session.state.pendingChoice;
        const next = sessionApply(
          session,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: accept(session.state),
          },
          WAVE6_DEPS,
        );
        if (!next.ok) throw new Error(next.error.message);
        session = next.session;
      }
      const replayed = replay(session.log, WAVE6_DEPS);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(session.state);
    });
  });

  describe("35002.wolverines-claws-action (with Lunging Strike 35010, §3.42)", () => {
    const CLAWS = "35002.wolverines-claws-action";
    /** Wolverine in hero form; a tough Hydra Mercenary (3 hit points) engaged with him; `codes` in his hand. */
    const staged = (...codes: string[]) => {
      const engaged = engageMinion(withForm(wolverineGame(), { heroForm: 0 }), "01101", P1);
      const minion = engaged.id;
      const tough = patchInstance(engaged.state, minion, {
        statuses: { ...inst(engaged.state, minion).statuses, tough: 1 },
      });
      const given = moveToHand(tough, P1, ...codes);
      return { state: given.state, ids: given.ids, minion };
    };
    const at =
      (id: InstanceId): Picker =>
      (s) =>
        s.pendingChoice?.options.some((o) => o.optionId === id) ? [id] : decline(s);
    const villainOf = (state: GameState) => state.villains[0]!.instanceId;
    /** Runs the commands through a session, answering with `pick`, and checks the log replays deep-equal. */
    const drive = (state: GameState, pick: Picker, ...commands: Command[]): GameState => {
      let session = startSession(state);
      const answerAll = () => {
        for (let guard = 0; session.state.pendingChoice && guard < 50; guard++) {
          const choice = session.state.pendingChoice;
          const next = sessionApply(
            session,
            {
              type: "resolveChoice",
              playerId: choice.playerId,
              choiceId: choice.choiceId,
              selectedOptionIds: pick(session.state),
            },
            WAVE6_DEPS,
          );
          if (!next.ok) throw new Error(next.error.message);
          session = next.session;
        }
      };
      for (const command of commands) {
        const result = sessionApply(session, command, WAVE6_DEPS);
        if (!result.ok) throw new Error(result.error.message);
        session = result.session;
        answerAll();
      }
      const replayed = replay(session.log, WAVE6_DEPS);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(session.state);
      return session.state;
    };

    it("plays Lunging Strike for 0, Wolverine takes 3 (its printed cost), piercing and overkill both apply", () => {
      const { state, ids, minion } = staged("35010");
      const strike = ids[0]!;
      const hand = playerOf(state, P1).hand.length;
      const after = drive(state, at(minion), use(P1, clawsOf(state), CLAWS, [], { event: [strike] }));
      expect(damageOf(after)).toBe(3);
      expect(inst(after, clawsOf(after)).exhausted).toBe(true);
      // Only the event left the hand: no resources were paid for it.
      expect(playerOf(after, P1).hand).toHaveLength(hand - 1);
      expect(playerOf(after, P1).discard).toContain(strike);
      // Piercing: the minion's tough card was discarded and the 8 damage dealt; overkill: 5 more spills to Rhino.
      expect(cardsInPlay(after)).not.toContain(minion);
      expect(inst(after, villainOf(after)).damage).toBe(5);
      // "That attack" only: nothing is left granting piercing.
      expect(after.lastingEffects.filter((e) => e.kind === "ruleGrant")).toEqual([]);
    });

    it("Lunging Strike played from hand: no piercing, no overkill (tough absorbs the attack)", () => {
      const { state, ids, minion } = staged("35010");
      const strike = ids[0]!;
      const payment = playerOf(state, P1)
        .hand.filter((id) => id !== strike)
        .slice(0, 3)
        .map((fromHand) => ({ fromHand }));
      const after = drive(state, at(minion), {
        type: "playCard",
        playerId: P1,
        cardInstanceId: strike,
        payment,
        attachToInstanceId: null,
      });
      expect(cardsInPlay(after)).toContain(minion);
      expect(inst(after, minion).statuses.tough).toBe(0);
      expect(inst(after, minion).damage).toBe(0);
      expect(inst(after, villainOf(after)).damage).toBe(0);
      expect(damageOf(after)).toBe(0);
    });

    it("another ATTACK event through the Claws gains piercing but not overkill (Berserker Barrage, cost 2)", () => {
      const { state, ids, minion } = staged("35008");
      const barrage = ids[0]!;
      // Declines Berserker Barrage's repeat, so only the Claws' cost damages Wolverine.
      const pick: Picker = (s) => {
        const stop = s.pendingChoice?.options.find((o) => o.label.includes("Do not repeat"));
        return stop ? [stop.optionId] : at(minion)(s);
      };
      const after = drive(state, pick, use(P1, clawsOf(state), CLAWS, [], { event: [barrage] }));
      expect(damageOf(after)).toBe(2);
      // 4 damage through the tough card defeats the 3-hit-point minion; no overkill, so Rhino takes nothing.
      expect(cardsInPlay(after)).not.toContain(minion);
      expect(inst(after, villainOf(after)).damage).toBe(0);
    });

    it("only an ATTACK event in hand can be chosen, and the cost needs one", () => {
      const { state, ids } = staged("35012", "35010");
      const [healing, strike] = ids;
      expect(() => drive(state, decline, use(P1, clawsOf(state), CLAWS, [], { event: [healing!] }))).toThrow(
        /not a legal choice/,
      );
      const actions = legalActions(state, P1, WAVE6_DEPS);
      if (actions.kind !== "turn") throw new Error("not P1's turn");
      const claws = actions.legal.find(
        (entry) => entry.action.kind === "useAbility" && entry.action.instanceId === clawsOf(state),
      );
      expect(claws?.targets).toContain(strike);
      expect(claws?.targets).not.toContain(healing);
    });
  });
});
