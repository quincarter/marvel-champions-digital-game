import { FNE_STARTER_DECKS, PLAYABLE_CARDS } from "@mc/content";
import {
  applyCommand,
  cannotTakeDamage,
  createGame,
  locateCard,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  settle,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import {
  driveEvents,
  playFromHand,
  stageNemesisCardForReveal,
  stackSetAside,
  withForm,
} from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { heroThwarts } from "../../../wave9/testing.js";
import { WAVE11_DEPS } from "../../index.js";
import {
  FNE_ECHO_OBLIGATION_NEMESIS as REGISTRY,
  FNE_ECHO_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Echo's obligation and nemesis set (60060 Raised by the Kingpin; 60061 Kingpin, 60062 Master Manipulator, 60063
 * Kingpin's Henchman, 60064 Pawn of the Kingpin), docs/phase7-wave11.md section 7.2 and 8.4 line 9; the unique-rule
 * reading in docs/phase7-wave11-scenarios.md section S4.0. The printed Echo / Protection starter deck against Core's
 * Rhino. The obligation is in the encounter deck and the nemesis cards are set aside; each is revealed in a real
 * villain phase (Advance, 01186, absorbs Rhino's boost card first) or put into play by surgery where the test says so.
 */
const OBLIGATION = "60060";
const KINGPIN = "60061";
const MANIPULATOR = "60062";
const HENCHMAN = "60063";
const PAWN = "60064";
const ADVANCE = "01186";
const REFS = [
  "60060.obligation",
  "60060.when-revealed",
  "60060.raised-by-the-kingpin-response",
  "60061.kingpin-forced-interrupt",
  "60062.master-manipulator-constant",
  "60062.when-revealed",
  "60062.boost",
  "60063.kingpins-henchman-constant",
  "60064.when-revealed-alter-ego",
  "60064.when-revealed-hero",
];
const KINGPIN_SLOT = "kingpin-minion" as InstanceId;
const HENCHMAN_SLOT = "henchman-1" as InstanceId;

const seatOf = (deckId: string, extra: readonly string[] = []) => {
  const deck = FNE_STARTER_DECKS.find((d) => d.id === deckId)!;
  return {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards
      .flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id))
      .concat(extra as never[]),
  };
};

function newGame(seats: readonly string[] = ["fne-echo-protection"], extraDeck: readonly string[] = []): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    { ...config, players: seats.map((id, i) => seatOf(id, i === 0 ? extraDeck : [])) } as never,
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}
const heroGame = (): GameState => withForm(newGame(), { heroForm: 0 });

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const IN_PLAY = ["playArea", "villainArea"];
const inPlayIds = (s: GameState, code: string): InstanceId[] =>
  instancesOf(s, code).filter((i) => {
    const kind = locateCard(s, i)?.kind;
    return kind !== undefined && IN_PLAY.includes(kind);
  });
const only = (ids: readonly InstanceId[]): InstanceId => {
  expect(ids).toHaveLength(1);
  return ids[0]!;
};
const kingpinIn = (s: GameState): InstanceId => only(inPlayIds(s, KINGPIN));
const damageFrom = (events: readonly GameEvent[], source: InstanceId, target?: InstanceId) =>
  ofType(events, "damageDealt")
    .filter((e) => e.sourceInstanceId === source && (target === undefined || e.targetInstanceId === target))
    .reduce((sum, e) => sum + e.amount, 0);
const mainThreat = (s: GameState): number => inst(s, s.mainScheme.instanceId).threat;
const readied = (s: GameState, player: PlayerId = P1): GameState =>
  patchInstance(s, identityOf(s, player), { exhausted: false });
const basicAttack = (s: GameState, target: InstanceId) =>
  applyCommand(
    s,
    { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s), targetInstanceId: target },
    WAVE11_DEPS,
  );
const acceptFirst = (s: GameState) =>
  s.pendingChoice?.options[0] ? [s.pendingChoice.options[0].optionId] : firstLegal(s);
const endTurn = (s: GameState) => driveEvents(WAVE11_DEPS, s, { type: "endTurn", playerId: P1 });

/** Kingpin straight into play engaged with `player` (surgery, no reveal). */
const withKingpin = (state: GameState, player: PlayerId = P1): GameState =>
  engageMinion(state, KINGPIN, KINGPIN_SLOT as string, player);

/** The obligation on top of the encounter deck, behind Advance for Rhino's boost card, revealed by ending the turn. */
function revealObligation(state: GameState) {
  const result = endTurn(stackEncounterDeck(state, ADVANCE, OBLIGATION));
  return { ...result, id: only(inPlayIds(result.state, OBLIGATION)) };
}

/** A set-aside nemesis card dealt to the player as their encounter card in a real villain phase. */
const revealNemesis = (state: GameState, code: string) => endTurn(stageNemesisCardForReveal(state, code));

describe("wave 11 fne/echo/obligation-nemesis", () => {
  it("registers only valid definitions, every ref the cards print", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
  });

  it("skips only refs it does not register, each with a written reason", () => {
    for (const [id, reason] of Object.entries(SKIPPED)) {
      expect(id in REGISTRY, id).toBe(false);
      expect(reason.length, id).toBeGreaterThan(20);
    }
  });

  describe("60060 Raised by the Kingpin", () => {
    it("60060.when-revealed finds Kingpin and puts him into play engaged with Echo; the card stays in her play area", () => {
      const { state, id } = revealObligation(heroGame());
      expect(locateCard(state, id)).toEqual({ kind: "playArea", playerId: P1 });
      const kingpin = kingpinIn(state);
      expect(inst(state, kingpin).engagedWith).toBe(P1);
      expect(codeOf(state, kingpin)).toBe(KINGPIN);
    });

    it("60060.when-revealed engages a Kingpin already in play and keeps what is on him", () => {
      const hurt = patchInstance(withKingpin(heroGame(), P1), KINGPIN_SLOT, { damage: 2, engagedWith: null });
      const { state } = revealObligation(hurt);
      expect(inPlayIds(state, KINGPIN)).toEqual([KINGPIN_SLOT]);
      expect(inst(state, KINGPIN_SLOT).damage).toBe(2);
      expect(inst(state, KINGPIN_SLOT).engagedWith).toBe(P1);
    });

    it("60060.obligation: Echo cannot deal damage to Kingpin, anyone else can", () => {
      const { state } = revealObligation(heroGame());
      const kingpin = kingpinIn(state);
      // A target that cannot take the damage is no legal target of her attack at all.
      expect(basicAttack(readied(state), kingpin).ok).toBe(false);
      expect(cannotTakeDamage(state, WAVE11_DEPS, kingpin, [identityOf(state)])).toBe(true);
      expect(cannotTakeDamage(state, WAVE11_DEPS, kingpin, [state.activeVillainId!])).toBe(false);
    });

    it('60060.obligation: her events are blocked and her ally is not (RRG 1.8 "You, Your", p. 49)', () => {
      const { state } = revealObligation(heroGame());
      const kingpin = kingpinIn(state);
      const withAlly = stagedInPlay(state, "60039");
      const withEvent = stagedInPlay(withAlly.state, "60041");
      expect(cannotTakeDamage(withEvent.state, WAVE11_DEPS, kingpin, [withAlly.id])).toBe(false);
      expect(cannotTakeDamage(withEvent.state, WAVE11_DEPS, kingpin, [withEvent.id])).toBe(true);
    });

    it("Kingpin taken over as an ally with Karma still cannot take damage (FFG ruling, September 10, 2026, Ruling 2)", () => {
      const kingpin = KINGPIN_SLOT;
      const game = withKingpin(withForm(newGame(["fne-echo-protection"], ["38011"]), { heroForm: 0 }));
      const accepting = (s: GameState) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "chooseTriggers") return [choice.options[0]!.optionId];
        const hit = choice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === kingpin);
        return hit ? [hit.optionId] : firstLegal(s);
      };
      const { state } = playFromHand(WAVE11_DEPS, game, "38011", 4, accepting);
      expect(inst(state, kingpin).treatedAs?.kind).toBe("ally");
      // Master Manipulator (a side scheme in play) is what stops the damage; Kingpin is an ally now.
      expect(cannotTakeDamage(state, WAVE11_DEPS, kingpin, [state.activeVillainId!])).toBe(false);
      const withScheme = stageNemesisCardForReveal(state, MANIPULATOR);
      const revealed = endTurn(withScheme).state;
      expect(inst(revealed, kingpin).treatedAs?.kind).toBe("ally");
      expect(cannotTakeDamage(revealed, WAVE11_DEPS, kingpin, [revealed.activeVillainId!])).toBe(true);
    });

    it("60060.raised-by-the-kingpin-response puts the threat she thwarts on the card, removing it at 4", () => {
      const { state, id } = revealObligation(heroGame());
      const scheme = state.mainScheme.instanceId;
      const loaded = patchInstance(readied(state), scheme, { threat: 10 });
      const first = heroThwarts(WAVE11_DEPS, loaded, scheme, { pick: acceptFirst });
      expect(inst(first.state, scheme).threat).toBe(8);
      expect(inst(first.state, id).threat).toBe(2);
      const second = heroThwarts(WAVE11_DEPS, readied(first.state), scheme, { pick: acceptFirst });
      expect(locateCard(second.state, id)).toEqual({ kind: "removedFromGame" });
    });
  });

  describe("60061 Kingpin", () => {
    it("60061.kingpin-forced-interrupt: against the Maya Lopez player he schemes instead of attacking", () => {
      const staged = stackEncounterDeck(withKingpin(heroGame()), ADVANCE, ADVANCE);
      const before = mainThreat(staged);
      const { state, events } = endTurn(staged);
      expect(damageFrom(events, KINGPIN_SLOT)).toBe(0);
      expect(mainThreat(state)).toBeGreaterThanOrEqual(before + 3);
    });

    it("60061.kingpin-forced-interrupt: against any other player he attacks", () => {
      const two = withForm(
        withForm(newGame(["fne-echo-protection", "fne-daredevil-justice"]), { heroForm: 0 }),
        {
          heroForm: 0,
        },
        P2,
      );
      const staged = stackEncounterDeck(withKingpin(two, P2), ADVANCE, ADVANCE);
      const { events } = driveEvents(
        WAVE11_DEPS,
        staged,
        { type: "endTurn", playerId: P1 },
        { type: "endTurn", playerId: P2 },
      );
      expect(damageFrom(events, KINGPIN_SLOT, identityOf(two, P2))).toBeGreaterThan(0);
    });
  });

  describe("60062 Master Manipulator", () => {
    it("60062.when-revealed finds Kingpin and engages him with the revealing player", () => {
      const { state } = revealNemesis(heroGame(), MANIPULATOR);
      expect(inst(state, kingpinIn(state)).engagedWith).toBe(P1);
      expect(inPlayIds(state, MANIPULATOR)).toHaveLength(1);
    });

    it("60062.master-manipulator-constant: Kingpin cannot take damage while it is in play", () => {
      const { state } = revealNemesis(heroGame(), MANIPULATOR);
      const kingpin = kingpinIn(state);
      expect(cannotTakeDamage(state, WAVE11_DEPS, kingpin, [state.activeVillainId!])).toBe(true);
      expect(basicAttack(readied(state), kingpin).ok).toBe(false);
    });

    it("60062.boost: with Kingpin in play the scheme is revealed from the boost card", () => {
      // The scheme on top of the encounter deck is the boost card of Rhino's activation.
      const { state } = endTurn(stackSetAside(withKingpin(heroGame()), MANIPULATOR));
      expect(inPlayIds(state, MANIPULATOR)).toHaveLength(1);
    });

    it("60062.boost: without Kingpin in play the boost does nothing", () => {
      const { state } = endTurn(stackSetAside(heroGame(), MANIPULATOR));
      expect(inPlayIds(state, MANIPULATOR)).toHaveLength(0);
    });
  });

  describe("60063 Kingpin's Henchman", () => {
    it("60063.kingpins-henchman-constant: Kingpin cannot take damage while a Henchman is in play", () => {
      const alone = withKingpin(heroGame());
      const both = engageMinion(alone, HENCHMAN, HENCHMAN_SLOT as string);
      const source = identityOf(both);
      expect(cannotTakeDamage(alone, WAVE11_DEPS, KINGPIN_SLOT, [source])).toBe(false);
      expect(cannotTakeDamage(both, WAVE11_DEPS, KINGPIN_SLOT, [source])).toBe(true);
      expect(cannotTakeDamage(both, WAVE11_DEPS, HENCHMAN_SLOT, [source])).toBe(false);
    });
  });

  describe("60064 Pawn of the Kingpin", () => {
    it("60064.when-revealed-alter-ego: Kingpin in play schemes", () => {
      const staged = withForm(withKingpin(heroGame()), "alterEgo");
      const before = mainThreat(staged);
      const { state, events } = revealNemesis(staged, PAWN);
      expect(mainThreat(state)).toBeGreaterThanOrEqual(before + 3);
      // Control: Kingpin's own villain-phase activation schemes for his 3 SCH (he is engaged with the Maya Lopez
      // player); the Pawn's scheme is the second 3.
      const placedBy = (list: readonly GameEvent[]) =>
        ofType(list, "threatPlaced")
          .filter((e) => e.sourceInstanceId === KINGPIN_SLOT)
          .reduce((sum, e) => sum + e.amount, 0);
      const control = endTurn(stackEncounterDeck(staged, ADVANCE, ADVANCE));
      expect(placedBy(control.events)).toBe(3);
      expect(placedBy(events)).toBe(6);
      expect(ofType(events, "surgeTriggered")).toHaveLength(0);
    });

    it("60064.when-revealed-alter-ego: with no Kingpin in play the card gains surge", () => {
      const { events } = revealNemesis(withForm(heroGame(), "alterEgo"), PAWN);
      expect(ofType(events, "surgeTriggered")).toHaveLength(1);
      expect(ofType(events, "threatPlaced").filter((e) => e.sourceInstanceId === KINGPIN_SLOT)).toHaveLength(0);
    });

    it("60064.when-revealed-hero: deals damage equal to Echo's ATK to a hero", () => {
      const staged = heroGame();
      const { state, events } = revealNemesis(staged, PAWN);
      const pawn = only(instancesOf(state, PAWN));
      expect(damageFrom(events, pawn, identityOf(state))).toBe(2);
    });
  });
});
