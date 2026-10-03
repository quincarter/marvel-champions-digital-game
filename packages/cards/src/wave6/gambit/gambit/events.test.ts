import { cardId } from "@mc/content";
import {
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { moveToDiscard, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { GAMBIT_EVENTS } from "./events.js";
import { gambitGame } from "./support.js";

const DEPS = WAVE6_DEPS;
const CHARGED_CARD = "37006";
const ROYAL_FLUSH = "37007";
const NATURAL_AGILITY = "37008";
const CREOLE_CHARMER = "37009";
const STEALTH_STRIKE = "37014";
const BREAKING_AND_ENTERING = "37015";
const BEAUTY_AND_THE_THIEF = "37019";
const HIT_AND_RUN = "37020";
const MUTANT_EDUCATION = "37021";
const X_MEN_INSTRUCTION = "37031";
const THROW = "37001a.throw-de-card";
const MODOK = "01184"; // 8 HP, retaliate 2, a minion.
const MERCENARY = "01101"; // Hydra Mercenary: 3 HP, guard.
const X_MANSION = "37018";

const hero = (seed = 1): GameState => withForm(gambitGame("rhino", { seed }), { heroForm: 0 });
const remy = (seed = 1): GameState => gambitGame("rhino", { seed });
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const charges = (state: GameState): number => inst(state, identityOf(state, P1)).counters.charge ?? 0;
const withCharges = (state: GameState, count: number): GameState =>
  patchInstance(state, identityOf(state, P1), { counters: { charge: count } });
const damageOf = (state: GameState, id: InstanceId): number => inst(state, id).damage;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** Applies `command`, answering each choice with `pick`; the log replays to the same state. */
function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 100) throw new Error(`choices did not settle (${session.state.pendingChoice.prompt.kind})`);
    const choice = session.state.pendingChoice;
    const next = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      },
      DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
    events.push(...next.events);
  }
  const replayed = replay(session.log, DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
const rejected = (state: GameState, command: Command): boolean => !sessionApply(startSession(state), command, DEPS).ok;

/**
 * A picker: uses Throw de Card whenever offered with `throwCount` counters (none: declines it), takes each of
 * `targets` in order when a choice offers it, and answers anything else as `firstLegal`.
 */
const picks = (opts: { throwCount?: number | undefined; targets?: readonly InstanceId[] } = {}): Picker => {
  const targets = [...(opts.targets ?? [])];
  return (state) => {
    const choice = state.pendingChoice;
    if (opts.throwCount !== undefined && choice?.prompt.kind === "chooseTriggers") {
      const offered = choice.options.filter((o) => o.optionId.includes(THROW));
      if (offered.length > 0) return offered.map((o) => o.optionId);
    }
    if (opts.throwCount !== undefined && choice?.prompt.kind === "chooseCostCounters") return [String(opts.throwCount)];
    if (choice?.prompt.kind === "payForAbility") return choice.options.slice(0, 1).map((o) => o.optionId);
    const hit =
      choice && choice.prompt.kind !== "chooseTriggers"
        ? choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === targets[0])
        : undefined;
    if (hit) {
      targets.shift();
      return [hit.optionId];
    }
    return firstLegal(state);
  };
};

/** `code` in P1's hand and the command that plays it paying `cost` with other hand cards. */
function staged(state: GameState, code: string, cost: number) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  return { state: given.state, id, command: play(P1, id, payWith(given.state, P1, cost, [id])) };
}

/** An encounter card turned into `code` and put into play engaged with P1 (surgery). */
function engaged(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const donor = state.encounterDecks[deckId]!.deck.find((i) => state.instances[i]!.cardId !== cardId(code))!;
  const swapped = patchInstance(state, donor, { cardId: cardId(code) });
  return engageMinion(swapped, code);
}

/** A hero of another deck, past setup, in `form`, for the trait checks (Gambit's own faces both pass SPY or THIEF). */
function otherHero(starterDeckId: string, form: "hero" | "alterEgo"): GameState {
  const created = createGame(wave6Scenario("rhino", { seed: 1, players: [{ starterDeckId }] }), DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const ready = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return withForm(ready, form === "hero" ? { heroForm: 0 } : "alterEgo");
}
/** A copy of `code` in P1's hand even when their deck lacks it: the top deck card is turned into it (surgery). */
function conjured(state: GameState, code: string): GameState {
  const top = playerOf(state, P1).deck[0]!;
  return patchInstance(state, top, { cardId: cardId(code) });
}
/** `code` (a card of P1's precon) put straight into play under P1 (surgery: no cost, no enter-play). */
function inPlayNow(state: GameState, code: string): GameState {
  const owner = playerOf(state, P1);
  const id = [...owner.hand, ...owner.deck].find((i) => state.instances[i]?.cardId === cardId(code))!;
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: p.hand.filter((i) => i !== id),
            deck: p.deck.filter((i) => i !== id),
            playArea: [...p.playArea, id],
          }
        : p,
    ),
    instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: P1 } },
  };
}
/** An encounter-deck card turned into Sonic Converter (01118, 3 boost icons): Rhino's deck does not hold one. */
const boostCardIn = (state: GameState): GameState => {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  return patchInstance(state, state.encounterDecks[deckId]!.deck[0]!, { cardId: cardId("01118") });
};
const withMainThreat = (state: GameState, threat: number): GameState =>
  patchInstance(state, state.mainScheme.instanceId, { threat });

describe("Gambit's events (37006-37009, 37014, 37015, 37019-37021, 37031)", () => {
  it("registers exactly the ability refs the card data names, all valid", () => {
    expect(Object.keys(GAMBIT_EVENTS).sort()).toEqual(
      [
        "37006.charged-card-action",
        "37007.royal-flush-action",
        "37008.natural-agility-interrupt",
        "37009.creole-charmer-action",
        "37014.stealth-strike-action",
        "37015.breaking-and-entering-constant",
        "37015.breaking-and-entering-action",
        "37019.beauty-and-the-thief-constant",
        "37020.hit-and-run-constant",
        "37021.mutant-education-action",
        "37031.x-men-instruction-action",
      ].sort(),
    );
    for (const definition of Object.values(GAMBIT_EVENTS)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Charged Card (37006): 4 damage, keywords from Throw de Card's counters", () => {
    /** Charged Card at a MODOK (8 HP, retaliate 2) holding 1 tough status card, with `thrown` counters thrown. */
    const atModok = (thrown: number | undefined) => {
      const base = engaged(withCharges(hero(), 3), MODOK);
      const withTough = patchInstance(base.state, base.id, {
        statuses: { ...inst(base.state, base.id).statuses, tough: 1 },
      });
      const { state, command } = staged(withTough, CHARGED_CARD, 2);
      const { state: after } = drive(state, command, picks({ throwCount: thrown, targets: [base.id] }));
      return { before: state, after, modok: base.id };
    };

    it("0 thrown: plain 4 damage, no ranged (the tough card is spent, retaliate 2 hits Gambit), no piercing", () => {
      const { before, after, modok } = atModok(undefined);
      expect(charges(after)).toBe(3);
      expect(inst(after, modok).statuses.tough).toBe(0);
      expect(damageOf(after, modok)).toBe(0);
      expect(damageOf(after, identityOf(after))).toBe(damageOf(before, identityOf(before)) + 2);
    });

    it("1 thrown: 5 damage, ranged (no retaliate) but not piercing (the tough card absorbs it)", () => {
      const { before, after, modok } = atModok(1);
      expect(charges(after)).toBe(2);
      expect(inst(after, modok).statuses.tough).toBe(0);
      expect(damageOf(after, modok)).toBe(0);
      expect(damageOf(after, identityOf(after))).toBe(damageOf(before, identityOf(before)));
    });

    it("2 thrown: 6 damage, ranged and piercing (the tough card is discarded first)", () => {
      const { before, after, modok } = atModok(2);
      expect(charges(after)).toBe(1);
      expect(inst(after, modok).statuses.tough).toBe(0);
      expect(damageOf(after, modok)).toBe(6);
      expect(damageOf(after, identityOf(after))).toBe(damageOf(before, identityOf(before)));
    });

    it("3 thrown: 7 damage with ranged and piercing as well", () => {
      const { before, after, modok } = atModok(3);
      expect(charges(after)).toBe(0);
      expect(damageOf(after, modok)).toBe(7);
      expect(damageOf(after, identityOf(after))).toBe(damageOf(before, identityOf(before)));
    });

    it.each([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 4],
    ])(
      "at a 3 HP minion with %i thrown, %i excess damage goes to the villain (overkill only at 3)",
      (thrown, excess) => {
        const base = engaged(withCharges(hero(), 3), MERCENARY);
        const { state, command } = staged(base.state, CHARGED_CARD, 2);
        const { state: after } = drive(
          state,
          command,
          picks({ throwCount: thrown === 0 ? undefined : thrown, targets: [base.id] }),
        );
        expect(damageOf(after, villainOf(after))).toBe(excess);
      },
    );

    it("is a Hero Action: refused in alter-ego form; goes to the discard pile", () => {
      const { state, command } = staged(remy(), CHARGED_CARD, 2);
      expect(rejected(state, command)).toBe(true);
      const hand = staged(hero(), CHARGED_CARD, 2);
      const { state: after } = drive(hand.state, hand.command);
      expect(playerOf(after, P1).discard).toContain(hand.id);
      expect(damageOf(after, villainOf(after))).toBe(4);
    });
  });

  describe("Royal Flush (37007): 1 charge counter, then three instances of 0 damage", () => {
    it("places 1 counter and deals no damage with no Throw de Card", () => {
      const { state, command } = staged(hero(), ROYAL_FLUSH, 3);
      const { state: after, events } = drive(state, command);
      expect(charges(after)).toBe(1);
      expect(damageOf(after, villainOf(after))).toBe(0);
      expect(ofType(events, "damageDealt")).toEqual([]);
    });

    it("2 thrown from 3: +2 on each of the three instances (6 on the villain), counter placed after (2 left)", () => {
      const { state, command } = staged(withCharges(hero(), 3), ROYAL_FLUSH, 3);
      const { state: after } = drive(state, command, picks({ throwCount: 2 }));
      expect(damageOf(after, villainOf(after))).toBe(6);
      expect(charges(after)).toBe(2);
    });

    it("each instance picks its own enemy, and a target may repeat", () => {
      const base = engaged(withCharges(hero(), 1), MODOK);
      const { state, command } = staged(base.state, ROYAL_FLUSH, 3);
      const villain = villainOf(state);
      const { state: after } = drive(state, command, picks({ throwCount: 1, targets: [villain, base.id, base.id] }));
      expect(damageOf(after, villainOf(after))).toBe(1);
      expect(damageOf(after, base.id)).toBe(2);
      expect(charges(after)).toBe(1);
    });

    it("is a Hero Action", () => {
      const { state, command } = staged(remy(), ROYAL_FLUSH, 3);
      expect(rejected(state, command)).toBe(true);
    });
  });

  describe("Natural Agility (37008): place 1 charge counter (cost), +1 DEF per counter", () => {
    /**
     * Rhino attacks Gambit (ATK 2, +3 from a boost card of 3 icons = 5 against DEF 3), Natural Agility in hand.
     * Gambit is declared the defender; `accept` plays Natural Agility in the window.
     */
    const defending = (held: number, accept: boolean) => {
      const given = moveToHand(withCharges(hero(), held), P1, NATURAL_AGILITY);
      const reached = settle(
        runEndTurn(stackEncounterDeck(boostCardIn(given.state), "01118")),
        firstLegal,
        (s) => s.pendingChoice?.prompt.kind === "declareDefender",
        DEPS,
      );
      expect(reached.pendingChoice?.prompt.kind).toBe("declareDefender");
      const choice = reached.pendingChoice!;
      const acceptNaturalAgility: Picker = (state) => {
        const open = state.pendingChoice;
        if (!open) return [];
        if (open.prompt.kind === "payForCard") return [open.options[0]!.optionId];
        const mine = open.options.filter((o) => o.optionId.includes("37008.natural-agility-interrupt"));
        return accept && mine.length > 0 ? [mine[0]!.optionId] : firstLegal(state);
      };
      const { state: after, events } = drive(
        reached,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: [identityOf(reached)],
        },
        acceptNaturalAgility,
      );
      // The villain's attack is the first one resolved; its damage lands just after, before the next attack resolves.
      const resolvedAt = events.flatMap((e, index) => (e.type === "attackResolved" ? [index] : []));
      expect(resolvedAt.length).toBeGreaterThan(1); // Rhino's attack, then the next round's
      const hit = ofType(events.slice(0, resolvedAt[1]), "damageDealt").find(
        (e) => e.targetInstanceId === identityOf(after),
      );
      return { taken: hit?.amount ?? 0, after, id: given.ids[0]! };
    };
    const runEndTurn = (state: GameState): GameState => runWith(DEPS, state, endTurn());

    it("declined: Gambit takes 5 - 3 = 2", () => {
      const { taken, after } = defending(0, false);
      expect(taken).toBe(2);
      expect(charges(after)).toBe(0);
    });

    it("with 0 counters held: places 1 (the cost), so +1 DEF for that attack and 1 damage taken", () => {
      const { taken, after, id } = defending(0, true);
      expect(charges(after)).toBe(1);
      expect(taken).toBe(1);
      expect(playerOf(after, P1).discard).toContain(id);
    });

    it("with 1 counter held: places a second, +2 DEF, no damage taken", () => {
      const { taken, after } = defending(1, true);
      expect(charges(after)).toBe(2);
      expect(taken).toBe(0);
    });
  });
  describe("Creole Charmer (37009): Alter-Ego Action (thwart), 3 threat, confuse the villain on the last threat", () => {
    it("removes 3 threat and leaves the villain alone while threat remains", () => {
      const { state, command } = staged(withMainThreat(remy(), 5), CREOLE_CHARMER, 2);
      const { state: after } = drive(state, command);
      expect(mainThreat(after)).toBe(2);
      expect(inst(after, villainOf(after)).statuses.confused).toBe(0);
    });

    it("confuses the villain when it removes the last threat from the scheme", () => {
      const { state, command } = staged(withMainThreat(remy(), 3), CREOLE_CHARMER, 2);
      const { state: after } = drive(state, command);
      expect(mainThreat(after)).toBe(0);
      expect(inst(after, villainOf(after)).statuses.confused).toBe(1);
    });

    it("with only 2 threat on the scheme, still removes the last threat (and confuses)", () => {
      const { state, command } = staged(withMainThreat(remy(), 2), CREOLE_CHARMER, 2);
      const { state: after } = drive(state, command);
      expect(mainThreat(after)).toBe(0);
      expect(inst(after, villainOf(after)).statuses.confused).toBe(1);
    });

    it("is an Alter-Ego Action: refused in hero form", () => {
      const { state, command } = staged(withMainThreat(hero(), 5), CREOLE_CHARMER, 2);
      expect(rejected(state, command)).toBe(true);
    });
  });

  describe("Stealth Strike (37014): 4 damage; if that enemy is defeated, remove 2 threat from a scheme", () => {
    it("defeating a minion removes 2 threat (a 3 HP minion takes 4)", () => {
      const base = engaged(withMainThreat(hero(), 10), MERCENARY);
      const { state, command } = staged(base.state, STEALTH_STRIKE, 3);
      const { state: after } = drive(state, command, picks({ targets: [base.id] }));
      expect(playerOf(after, P1).hand).not.toContain(base.id);
      expect(mainThreat(after)).toBe(8);
    });

    it("does not remove threat when the enemy survives: 4 damage to the villain", () => {
      const { state, command } = staged(withMainThreat(hero(), 10), STEALTH_STRIKE, 3);
      const { state: after } = drive(state, command);
      expect(damageOf(after, villainOf(after))).toBe(4);
      expect(mainThreat(after)).toBe(10);
    });

    it("is a Hero Action", () => {
      const { state, command } = staged(remy(), STEALTH_STRIKE, 3);
      expect(rejected(state, command)).toBe(true);
    });
  });

  describe("Breaking and Entering (37015): play only with a SPY or THIEF identity; Action (thwart) 3", () => {
    it("removes 3 threat from a scheme, in either of Gambit's THIEF forms", () => {
      for (const form of [hero(), remy()]) {
        const { state, command } = staged(withMainThreat(form, 8), BREAKING_AND_ENTERING, 2);
        const { state: after } = drive(state, command);
        expect(mainThreat(after)).toBe(5);
      }
    });

    it("an identity with neither trait (Spider-Man) cannot, in either form", () => {
      for (const form of ["hero", "alterEgo"] as const) {
        const state = conjured(otherHero("core-spider-man-justice", form), BREAKING_AND_ENTERING);
        const { state: given, command } = staged(state, BREAKING_AND_ENTERING, 2);
        expect(rejected(given, command)).toBe(true);
      }
    });
  });

  describe("Beauty and the Thief (37019): Team-Up (Gambit and Rogue), 4 damage and 4 threat", () => {
    it("is refused without Rogue in play (Team-Up)", () => {
      const { state, command } = staged(hero(), BEAUTY_AND_THE_THIEF, 2);
      expect(rejected(state, command)).toBe(true);
    });

    it("with the Rogue ally (37002) in play, deals 4 damage and removes 4 threat", () => {
      const { state, command } = staged(withMainThreat(inPlayNow(hero(), "37002"), 10), BEAUTY_AND_THE_THIEF, 2);
      const outcome = rejected(state, command);
      if (outcome) throw new Error("Team-Up with the Rogue ally in play should be legal");
      const { state: after } = drive(state, command);
      expect(damageOf(after, villainOf(after))).toBe(4);
      expect(mainThreat(after)).toBe(6);
    });

    it("is a Hero Action", () => {
      const { state, command } = staged(inPlayNow(remy(), "37002"), BEAUTY_AND_THE_THIEF, 2);
      expect(rejected(state, command)).toBe(true);
    });
  });

  describe("Hit and Run (37020): Hero Action (attack/thwart), 2 damage and 2 threat", () => {
    it("deals 2 damage to an enemy and removes 2 threat from a scheme", () => {
      const { state, command } = staged(withMainThreat(hero(), 10), HIT_AND_RUN, 3);
      const { state: after } = drive(state, command);
      expect(damageOf(after, villainOf(after))).toBe(2);
      expect(mainThreat(after)).toBe(8);
    });

    it("is a Hero Action", () => {
      const { state, command } = staged(remy(), HIT_AND_RUN, 3);
      expect(rejected(state, command)).toBe(true);
    });
  });

  describe("Mutant Education (37021) and X-Men Instruction (37031)", () => {
    /** Chooses the cards of `codes` (up to 2) when offered the discard pile, noting what was offered. */
    const choosing =
      (offered: string[], ...codes: string[]): Picker =>
      (state) => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "chooseCards") {
          for (const o of choice.options) {
            if (o.ref.kind === "card") offered.push(state.instances[o.ref.instanceId]!.cardId as string);
          }
          return choice.options
            .filter((o) => o.ref.kind === "card" && codes.includes(state.instances[o.ref.instanceId]!.cardId as string))
            .slice(0, 2)
            .map((o) => o.optionId);
        }
        return firstLegal(state);
      };
    const discardPile = (state: GameState): string[] =>
      playerOf(state, P1).discard.map((i) => state.instances[i]!.cardId as string);
    const deckSet = (state: GameState): InstanceId[] => [...playerOf(state, P1).deck];

    it("Mutant Education shuffles up to 2 identity-specific cards from the discard pile into the deck, drawing none without X-Mansion", () => {
      const a = moveToDiscard(remy(), P1, "37006");
      const b = moveToDiscard(a.state, P1, "37007");
      const c = moveToDiscard(b.state, P1, "37008");
      const d = moveToDiscard(c.state, P1, HIT_AND_RUN);
      const { state, id, command } = staged(d.state, MUTANT_EDUCATION, 0);
      const offered: string[] = [];
      const handBefore = playerOf(state, P1).hand.length;
      const { state: after } = drive(state, command, choosing(offered, "37006", "37007", "37008"));
      expect(new Set(offered)).toEqual(new Set(["37006", "37007", "37008"])); // not the basic Hit and Run
      expect(discardPile(after)).toContain(HIT_AND_RUN);
      expect(discardPile(after).filter((code) => ["37006", "37007", "37008"].includes(code))).toHaveLength(1);
      expect(deckSet(after)).toContain(a.id);
      expect(deckSet(after)).toContain(b.id);
      expect(deckSet(after)).not.toContain(c.id);
      expect(playerOf(after, P1).hand).toHaveLength(handBefore - 1);
      expect(playerOf(after, P1).discard).toContain(id);
    });

    it("Mutant Education draws 1 card when X-Mansion is in play", () => {
      const a = moveToDiscard(inPlayNow(remy(), X_MANSION), P1, "37006");
      const { state, command } = staged(a.state, MUTANT_EDUCATION, 0);
      const handBefore = playerOf(state, P1).hand.length;
      const { state: after } = drive(state, command, choosing([], "37006"));
      expect(deckSet(after)).toContain(a.id);
      expect(playerOf(after, P1).hand).toHaveLength(handBefore - 1 + 1);
    });

    it("Mutant Education may choose none", () => {
      const a = moveToDiscard(remy(), P1, "37006");
      const { state, command } = staged(a.state, MUTANT_EDUCATION, 0);
      const { state: after } = drive(state, command);
      expect(discardPile(after)).toContain("37006");
      expect(deckSet(after)).not.toContain(a.id);
    });

    it("X-Men Instruction shuffles up to 2 X-MEN allies (not other X-MEN cards) from the discard pile into the deck", () => {
      const a = moveToDiscard(remy(), P1, "37011");
      const b = moveToDiscard(a.state, P1, "37012");
      const c = moveToDiscard(b.state, P1, X_MANSION);
      const { state, command } = staged(conjured(c.state, X_MEN_INSTRUCTION), X_MEN_INSTRUCTION, 0);
      const offered: string[] = [];
      const handBefore = playerOf(state, P1).hand.length;
      const { state: after } = drive(state, command, choosing(offered, "37011", "37012", X_MANSION));
      expect(new Set(offered)).toEqual(new Set(["37011", "37012"]));
      expect(deckSet(after)).toContain(a.id);
      expect(deckSet(after)).toContain(b.id);
      expect(discardPile(after)).toContain(X_MANSION);
      expect(playerOf(after, P1).hand).toHaveLength(handBefore - 1);
    });

    it("X-Men Instruction draws 1 card when X-Mansion is in play", () => {
      const a = moveToDiscard(inPlayNow(remy(), X_MANSION), P1, "37011");
      const { state, command } = staged(conjured(a.state, X_MEN_INSTRUCTION), X_MEN_INSTRUCTION, 0);
      const handBefore = playerOf(state, P1).hand.length;
      const { state: after } = drive(state, command, choosing([], "37011"));
      expect(playerOf(after, P1).hand).toHaveLength(handBefore);
    });

    it("both are Alter-Ego Actions needing a MUTANT identity: refused in Gambit's hero form (THIEF, X-MEN) and for Spider-Man", () => {
      for (const code of [MUTANT_EDUCATION, X_MEN_INSTRUCTION]) {
        const hand = staged(conjured(hero(), code), code, 0);
        expect(rejected(hand.state, hand.command)).toBe(true);
        const spider = staged(conjured(otherHero("core-spider-man-justice", "alterEgo"), code), code, 0);
        expect(rejected(spider.state, spider.command)).toBe(true);
      }
    });
  });
});
