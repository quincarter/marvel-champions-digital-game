import { FNE_STARTER_DECKS, PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  createGame,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import { coreScenario } from "../../../core/setup.js";
import {
  P1,
  P2,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveStepwise, encounterCardInVillainArea, withDamage, withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_DEPS } from "../../index.js";
import {
  FNE_ECHO_SUPPORT_UPGRADES_ALLIES as REGISTRY,
  FNE_ECHO_SUPPORT_UPGRADES_ALLIES_SKIPPED as SKIPPED,
} from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Echo's ally, support and upgrades (docs/phase7-wave11.md section 8.4 line 8): Daredevil 60039, The Rez 60042,
 * American Sign Language 60043, Choreography 60044, Echo's Katana 60045, Improvisation 60046 and Muscle Memory 60047,
 * in the printed starter deck `fne-echo-protection` against Core's Rhino. Each card is put in play (or in hand) by
 * surgery, so the other Echo modules are not relied on. Hero face: 60037a; alter-ego face: Maya Lopez 60037b.
 */
const DAREDEVIL = "60039.daredevil-response";
const REZ = "60042.the-rez-action";
const ASL = "60043.american-sign-language-resource";
const CHOREOGRAPHY = "60044.choreography-action";
const KATANA = "60045.echos-katana-response";
const IMPROVISATION = "60046.improvisation-response";
const MUSCLE_MEMORY = "60047.muscle-memory-action";
const IDS = [DAREDEVIL, REZ, ASL, CHOREOGRAPHY, KATANA, IMPROVISATION, MUSCLE_MEMORY];

const FIRST_AID = "01086"; // basic event, cost 1, no traits
const HAYMAKER = "01087"; // basic event, cost 2, Attack: "Hero Action (attack): Deal 3 damage to an enemy."
const FOR_JUSTICE = "01060"; // Justice event, cost 2, Thwart
const BACKFLIP = "01003"; // Spider-Man's event, cost 0, Defense
const STUDY_THE_TAPE = "60041"; // Echo's identity-specific event
const MINION = "01184"; // Core minion, 8 hit points
const ARMY_OF_ONE = "60048"; // protection event, printed cost 1
const GET_THEIR_ATTENTION = "60049"; // protection event, printed cost 2
const TEAM_INVESTIGATION = "40053"; // Alliance event, printed cost 2 per player (4 in two players)
const IN_HARMS_WAY = "60050"; // Attack and Thwart event, cost 2 (plus 1 per ally)
const SIDE_SCHEME = "01107"; // Core side scheme
const MINION_ID = "minion-1" as InstanceId;

function newGame(seed = 1, twoPlayers = false): GameState {
  const deck = FNE_STARTER_DECKS.find((d) => d.id === "fne-echo-protection")!;
  const config = coreScenario("rhino", {
    players: twoPlayers
      ? [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-spider-man-justice" }]
      : [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const seat = {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
  const created = createGame({ ...config, players: twoPlayers ? [seat, config.players[1]!] : [seat] }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}
const heroGame = (): GameState => withForm(newGame(), { heroForm: 0 });
const heroGame2p = (): GameState => withForm(newGame(1, true), { heroForm: 0 });
const alterEgoGame = (): GameState => withForm(newGame(), "alterEgo");

const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const handCodes = (s: GameState): string[] => playerOf(s, P1).hand.map((i) => codeOf(s, i));
const discardCodes = (s: GameState): string[] => playerOf(s, P1).discard.map((i) => codeOf(s, i));
const identity = (s: GameState) => inst(s, identityOf(s));

/** Makes a deck card a copy of `code` (the retag keeps the deck's size right) and returns the state. */
function conjure(state: GameState, code: string): GameState {
  const deck = playerOf(state, P1).deck.filter((i) => codeOf(state, i) !== code);
  return patchInstance(state, deck[deck.length - 1]!, { cardId: cardId(code) });
}
/** Exactly `code` then `others` in P1's hand, each a retagged deck card. */
function handOf(state: GameState, code: string, ...others: readonly string[]) {
  let current = state;
  const ids: InstanceId[] = [];
  for (const c of [code, ...others]) {
    const id = playerOf(current, P1).deck.find((i) => !ids.includes(i))!;
    current = patchInstance(current, id, { cardId: cardId(c) });
    current = {
      ...current,
      players: current.players.map((p) => (p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id) } : p)),
    };
    ids.push(id);
  }
  return {
    id: ids[0]!,
    others: ids.slice(1),
    state: {
      ...current,
      players: current.players.map((p) => (p.playerId === P1 ? { ...p, hand: ids } : p)),
    } as GameState,
  };
}
/** `code` in play (or attached to the identity), by surgery, retagged from the deck. */
const inPlay = (state: GameState, code: string, attach = false) => stagedInPlay(conjure(state, code), code, { attach });
/** Cards tucked under the identity: each code is a retagged deck card, taken out of every zone. */
function withTucked(state: GameState, ...codes: readonly string[]): GameState {
  let current = state;
  const tucked: InstanceId[] = [];
  for (const code of codes) {
    const id = playerOf(current, P1).deck.find((i) => !tucked.includes(i))!;
    current = patchInstance(current, id, { cardId: cardId(code) });
    current = {
      ...current,
      players: current.players.map((p) => (p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id) } : p)),
    };
    tucked.push(id);
  }
  return patchInstance(current, identityOf(current), { tucked });
}

/** Applies `command`, then answers choices with `pick` until none is left. */
const drive = (state: GameState, command: Command, pick: Picker = accepting()) => {
  const first = applyOk(state, command, WAVE11_DEPS);
  const rest = driveStepwise(WAVE11_DEPS, first.state, pick);
  return { state: rest.state, events: [...first.events, ...rest.events] as readonly GameEvent[] };
};
const accepted = (state: GameState, command: Command): boolean => {
  try {
    applyOk(state, command, WAVE11_DEPS);
    return true;
  } catch {
    return false;
  }
};
const rejected = (state: GameState, command: Command): boolean => !accepted(state, command);

/** Takes the option for one of `abilityIds` when a window offers it, else the first legal pick. */
const accepting =
  (...abilityIds: readonly string[]): Picker =>
  (state) => {
    const options = state.pendingChoice?.options ?? [];
    const hit =
      options.find((o) => abilityIds.some((a) => o.optionId.endsWith(`:${a}`))) ??
      options.find((o) => o.ref.kind === "card" && o.ref.instanceId === MINION_ID);
    return hit ? [hit.optionId] : firstLegal(state);
  };

describe("wave 11 fne/echo/support-upgrades-allies", () => {
  it("registers only valid definitions, all seven refs of the seven cards, none skipped", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(Object.keys(REGISTRY).sort()).toEqual([...IDS].sort());
    expect(SKIPPED).toEqual({});
  });

  it("has the printed timing: Responses, an Alter-Ego Action, Hero Actions and a Hero Resource", () => {
    const t = (id: string) => REGISTRY[id]!.trigger;
    expect(t(DAREDEVIL)).toMatchObject({ kind: "response", forced: false });
    expect(t(REZ)).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(t(ASL)).toMatchObject({ kind: "resource", form: "hero", forAnyPlayer: true });
    expect(t(CHOREOGRAPHY)).toEqual({ kind: "action" });
    expect(t(KATANA)).toMatchObject({ kind: "response", form: "hero", forced: false });
    expect(t(IMPROVISATION)).toMatchObject({ kind: "response", form: "hero", forced: false });
    expect(t(MUSCLE_MEMORY)).toMatchObject({ kind: "action", form: "hero" });
  });

  describe("Daredevil 60039", () => {
    function attackedWithDaredevil(accept: boolean) {
      const ally = inPlay(heroGame(), "60039");
      const scheme = ally.state.mainScheme.instanceId;
      const staged = handOf(patchInstance(ally.state, scheme, { threat: 5 }), FIRST_AID);
      // A basic thwart (his THW 2); the attack would meet a retaliating minion that defeats his 3 hit points.
      const command: Command = {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: ally.id,
        schemeInstanceId: scheme,
      };
      const done = drive(staged.state, command, accept ? accepting(DAREDEVIL) : accepting());
      return { ...done, aid: staged.id };
    }

    it("after he uses a basic power, the next event costs 1 less: First Aid (cost 1) is then played for nothing", () => {
      const run = attackedWithDaredevil(true);
      expect(inst(run.state, run.state.mainScheme.instanceId).threat).toBe(3);
      expect(accepted(run.state, play(P1, run.aid, []))).toBe(true);
    });

    it("without the reduction (response declined) the same event cannot be played for nothing", () => {
      const run = attackedWithDaredevil(false);
      expect(rejected(run.state, play(P1, run.aid, []))).toBe(true);
    });

    it("the reduction is spent by one event only", () => {
      const run = attackedWithDaredevil(true);
      const second = handOf(run.state, FIRST_AID, FIRST_AID);
      const first = drive(second.state, play(P1, second.id, []));
      expect(discardCodes(first.state)).toContain(FIRST_AID);
      expect(rejected(first.state, play(P1, second.others[0]!, []))).toBe(true);
    });
  });

  describe("The Rez 60042", () => {
    it("heals Maya Lopez by the highest cost among the cards tucked under her", () => {
      const rez = inPlay(alterEgoGame(), "60042");
      const hurt = withDamage(withTucked(rez.state, ARMY_OF_ONE, GET_THEIR_ATTENTION), identityOf(rez.state), 5);
      const run = drive(hurt, use(P1, rez.id, REZ));
      expect(identity(run.state).damage).toBe(3);
      expect(inst(run.state, rez.id).exhausted).toBe(true);
    });

    it("heals nothing when no card is tucked under her", () => {
      const rez = inPlay(alterEgoGame(), "60042");
      const hurt = withDamage(rez.state, identityOf(rez.state), 5);
      const run = drive(hurt, use(P1, rez.id, REZ));
      expect(identity(run.state).damage).toBe(5);
    });

    it("is an Alter-Ego Action: refused in hero form", () => {
      const rez = inPlay(heroGame(), "60042");
      expect(rejected(rez.state, use(P1, rez.id, REZ))).toBe(true);
    });
  });

  describe("American Sign Language 60043", () => {
    it("pays for an event with its [wild] resource, exhausting itself", () => {
      const asl = inPlay(heroGame(), "60043", true);
      const staged = handOf(asl.state, FIRST_AID);
      const run = drive(staged.state, play(P1, staged.id, [], { abilities: [resourceAbility(asl.id, ASL)] }));
      expect(discardCodes(run.state)).toContain(FIRST_AID);
      expect(inst(run.state, asl.id).exhausted).toBe(true);
    });

    it("cannot be used in alter-ego form (Hero Resource)", () => {
      const asl = inPlay(alterEgoGame(), "60043", true);
      const staged = handOf(asl.state, FIRST_AID);
      expect(rejected(staged.state, play(P1, staged.id, [], { abilities: [resourceAbility(asl.id, ASL)] }))).toBe(true);
    });
  });

  describe("Choreography 60044", () => {
    it("shuffles an aspect or basic event, never an identity-specific one, from the discard pile into the deck", () => {
      const choreo = inPlay(heroGame(), "60044", true);
      const withDiscard = handOf(choreo.state, STUDY_THE_TAPE, FIRST_AID);
      const discarded: GameState = {
        ...withDiscard.state,
        players: withDiscard.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: [], discard: [withDiscard.id, ...withDiscard.others] } : p,
        ),
      };
      const deckBefore = playerOf(discarded, P1).deck.length;
      const run = drive(discarded, use(P1, choreo.id, CHOREOGRAPHY));
      expect(discardCodes(run.state)).toEqual([STUDY_THE_TAPE]);
      expect(playerOf(run.state, P1).deck).toHaveLength(deckBefore + 1);
      expect(playerOf(run.state, P1).deck.map((i) => codeOf(run.state, i))).toContain(FIRST_AID);
      expect(handCodes(run.state)).toEqual([]);
      expect(inst(run.state, choreo.id).exhausted).toBe(true);
    });

    it("in alter-ego form it also draws 1 card, even with no event to shuffle", () => {
      const choreo = inPlay(alterEgoGame(), "60044", true);
      const before = playerOf(choreo.state, P1).hand.length;
      const run = drive(choreo.state, use(P1, choreo.id, CHOREOGRAPHY));
      expect(playerOf(run.state, P1).hand).toHaveLength(before + 1);
    });

    it("in hero form it draws nothing, and with no event to shuffle it cannot be used at all", () => {
      const choreo = inPlay(heroGame(), "60044", true);
      expect(rejected(choreo.state, use(P1, choreo.id, CHOREOGRAPHY))).toBe(true);
      const withTape = handOf(choreo.state, FIRST_AID);
      const discarded: GameState = {
        ...withTape.state,
        players: withTape.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: [], discard: [withTape.id] } : p,
        ),
      };
      const run = drive(discarded, use(P1, choreo.id, CHOREOGRAPHY));
      expect(handCodes(run.state)).toEqual([]);
    });
  });

  describe("Echo's Katana 60045 and Improvisation 60046", () => {
    /** Haymaker (cost 2, Attack) played with two First Aids, with these upgrades on Echo, who has 3 damage. */
    function playedHaymaker(code: string, pick: Picker) {
      const placed = inPlay(engageMinion(heroGame(), MINION, "minion-1"), code, true);
      const hurt = withDamage(placed.state, identityOf(placed.state), 3);
      const staged = handOf(hurt, HAYMAKER, FIRST_AID, FIRST_AID);
      return { ...drive(staged.state, play(P1, staged.id, staged.others), pick), upgrade: placed.id };
    }

    it("Katana deals damage equal to the event's printed cost (Haymaker's 3, then 2), exhausting itself", () => {
      const run = playedHaymaker("60045", accepting(KATANA));
      expect(inst(run.state, MINION_ID).damage).toBe(5);
      expect(inst(run.state, run.upgrade).exhausted).toBe(true);
    });

    it("Katana is optional: declined, only Haymaker's 3 lands and it stays ready", () => {
      const run = playedHaymaker("60045", accepting());
      expect(inst(run.state, MINION_ID).damage).toBe(3);
      expect(inst(run.state, run.upgrade).exhausted).toBe(false);
    });

    it("Improvisation heals 1 damage from Echo after an Attack event", () => {
      const declined = playedHaymaker("60046", accepting());
      const run = playedHaymaker("60046", accepting(IMPROVISATION));
      // The minion's retaliate is dealt either way; the response heals 1 of it.
      expect(identity(run.state).damage).toBe(identity(declined.state).damage - 1);
      expect(inst(run.state, MINION_ID).damage).toBe(3);
    });

    it("Improvisation does nothing after an event with none of its traits (First Aid)", () => {
      const placed = inPlay(engageMinion(heroGame(), MINION, "minion-1"), "60046", true);
      const hurt = withDamage(placed.state, identityOf(placed.state), 3);
      const staged = handOf(hurt, FIRST_AID, FIRST_AID);
      const run = drive(staged.state, play(P1, staged.id, staged.others), accepting(IMPROVISATION));
      expect(identity(run.state).damage).toBe(3);
      expect(inst(run.state, MINION_ID).damage).toBe(0);
    });

    it("Improvisation removes 1 threat from a scheme after a Defense event (Backflip, played against Rhino's attack)", () => {
      const threatAfterVillainPhase = (accept: boolean): number => {
        const placed = inPlay(heroGame(), "60046", true);
        const staged = handOf(placed.state, BACKFLIP);
        const pick: Picker = (state) => {
          const choice = state.pendingChoice!;
          if (choice.prompt.kind === "declareDefender") {
            const echo = choice.options.find((o) => o.optionId !== "decline");
            return [echo!.optionId];
          }
          const wanted = choice.options.find(
            (o) =>
              o.optionId.endsWith(":01003.backflip-interrupt") || (accept && o.optionId.endsWith(`:${IMPROVISATION}`)),
          );
          return wanted ? [wanted.optionId] : firstLegal(state);
        };
        const run = drive(staged.state, endTurn(), pick);
        expect(discardCodes(run.state)).toContain(BACKFLIP);
        return inst(run.state, run.state.mainScheme.instanceId).threat;
      };
      expect(threatAfterVillainPhase(false) - threatAfterVillainPhase(true)).toBe(1);
    });

    it("Improvisation's Thwart line also follows For Justice! (cost 2)", () => {
      const placed = inPlay(engageMinion(heroGame(), MINION, "minion-1"), "60046", true);
      const threatened = patchInstance(placed.state, placed.state.mainScheme.instanceId, { threat: 5 });
      const staged = handOf(threatened, FOR_JUSTICE, FIRST_AID, FIRST_AID);
      const run = drive(staged.state, play(P1, staged.id, staged.others), accepting(IMPROVISATION));
      expect(inst(run.state, MINION_ID).damage).toBe(1);
    });
  });

  describe("further rulings and tables", () => {
    it("Katana's attack gains piercing: it discards a tough status card and still deals its damage", () => {
      const placed = inPlay(engageMinion(heroGame(), MINION, "minion-1"), "60045", true);
      const toughened = patchInstance(placed.state, MINION_ID, {
        statuses: { ...inst(placed.state, MINION_ID).statuses, tough: 1 },
      });
      const staged = handOf(toughened, FIRST_AID, FIRST_AID);
      const run = drive(staged.state, play(P1, staged.id, staged.others.slice(0, 1)), accepting(KATANA));
      expect(inst(run.state, MINION_ID).damage).toBe(1);
      expect(inst(run.state, MINION_ID).statuses.tough).toBe(0);
    });

    it("Katana reads the printed cost per player: Team Investigation (2 per player) is 4 in two players", () => {
      const base = heroGame2p();
      const top = base.encounterDecks[activeEncounterDeckId(base)]!.deck[0]!;
      const side = encounterCardInVillainArea(
        patchInstance(base, top, { cardId: cardId(SIDE_SCHEME) }),
        SIDE_SCHEME,
        9,
      );
      const placed = inPlay(engageMinion(side.state, MINION, "minion-1"), "60045", true);
      const staged = handOf(placed.state, TEAM_INVESTIGATION, FIRST_AID, FIRST_AID, FIRST_AID, FIRST_AID);
      const run = drive(staged.state, play(P1, staged.id, staged.others), accepting(KATANA));
      expect(inst(run.state, MINION_ID).damage).toBe(4);
    });

    it("American Sign Language pays for another player's event in a two-player game", () => {
      const asl = inPlay(withForm(heroGame2p(), { heroForm: 0 }, P2), "60043", true);
      const p2 = playerOf(asl.state, P2).deck[0]!;
      const given = patchInstance(asl.state, p2, { cardId: cardId(FIRST_AID) });
      const state: GameState = {
        ...given,
        players: given.players.map((p) =>
          p.playerId === P2 ? { ...p, hand: [p2], deck: p.deck.filter((i) => i !== p2) } : p,
        ),
      };
      const run = drive(state, play(P2, p2, [], { abilities: [resourceAbility(asl.id, ASL)] }));
      expect(inst(run.state, asl.id).exhausted).toBe(true);
      expect(playerOf(run.state, P2).discard.map((i) => codeOf(run.state, i))).toContain(FIRST_AID);
    });

    it("American Sign Language is refused for a card that is not an event (an upgrade)", () => {
      const asl = inPlay(heroGame(), "60043", true);
      const staged = handOf(asl.state, "60044");
      const host = identityOf(staged.state);
      expect(
        accepted(staged.state, play(P1, staged.id, [staged.others[0] ?? playerOf(staged.state, P1).deck[0]!])),
      ).toBe(false);
      expect(
        rejected(
          staged.state,
          play(P1, staged.id, [], { abilities: [resourceAbility(asl.id, ASL)], attachToInstanceId: host }),
        ),
      ).toBe(true);
    });

    it("Improvisation resolves both lines for an event with two of its traits (In Harm's Way: Attack and Thwart)", () => {
      const result = (pick: Picker) => {
        const placed = inPlay(engageMinion(heroGame(), MINION, "minion-1"), "60046", true);
        const prepared = withDamage(
          patchInstance(placed.state, placed.state.mainScheme.instanceId, { threat: 5 }),
          identityOf(placed.state),
          3,
        );
        const staged = handOf(prepared, IN_HARMS_WAY, FIRST_AID, FIRST_AID, FIRST_AID);
        return drive(staged.state, play(P1, staged.id, staged.others), pick).state;
      };
      const declined = result(accepting());
      const taken = result(accepting(IMPROVISATION));
      expect(identity(taken).damage).toBe(identity(declined).damage - 1);
      expect(inst(taken, MINION_ID).damage).toBe(inst(declined, MINION_ID).damage + 1);
    });
  });

  describe("Muscle Memory 60047", () => {
    it("adds an event tucked under Echo to the hand, exhausting itself", () => {
      const mm = inPlay(heroGame(), "60047", true);
      const run = drive(withTucked(mm.state, ARMY_OF_ONE), use(P1, mm.id, MUSCLE_MEMORY));
      expect(handCodes(run.state)).toContain(ARMY_OF_ONE);
      expect(identity(run.state).tucked).toEqual([]);
      expect(inst(run.state, mm.id).exhausted).toBe(true);
    });

    it("is a Hero Action: refused in alter-ego form", () => {
      const mm = inPlay(alterEgoGame(), "60047", true);
      expect(rejected(withTucked(mm.state, ARMY_OF_ONE), use(P1, mm.id, MUSCLE_MEMORY))).toBe(true);
    });
  });
});
