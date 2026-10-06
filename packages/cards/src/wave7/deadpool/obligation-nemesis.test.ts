import {
  applyCommand,
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  action,
  dealDamage,
  defineAbilities,
  each,
  putIntoPlay,
  query,
  selectCards,
  chosen,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, stackSetAside, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES, wave7Scenario } from "../index.js";
import { DEADPOOL_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Deadpool's obligation and nemesis set (44032-44036), docs/phase7-wave7.md §7.3, §3.70, §3.78, §3.83 (Q50). His
 * precon (`deadpool-pool`) against Stryfe through `wave7Scenario` with the real registry. Nemesis cards sit in the
 * set-aside area until revealed; the obligation sits in the encounter deck. Stryfe's main scheme gets threat headroom
 * and Stryfe loses his tough status. Being a 'Pool deck it brings Crisis of Infinite Deadpools 44037 into the encounter
 * deck: `baseGame` takes it out so no villain phase here can reveal it.
 *
 * Fixtures: events whose own abilities belong to other modules are given inert stand-ins in `DEPS`. 44003 (cost 0)
 * deals 9 damage to his identity (exactly his hit points), 44004 (cost 0) puts Dogpool from your hand into play, 44006
 * (cost 1) deals 4, 44020 (cost 0) deals 1 damage to an ally named Deadpool, and the
 * Spider-Man seat's 01005 (cost 3) deals 1 damage to its player's identity (an Action another player tries to use
 * during Deadpool's turn).
 */
const MERC = "44032";
const BUTLER = "44033";
const PROCEDURES = "44034";
const TABULA = "44035";
const SOLDIER = "44036";
const CRISIS = "44037";
const HOPE = "40130";
const DOGPOOL = "44013";
const ALLY_DEADPOOL = "40024";
const WEB_KICK = "01005";

const MERC_CONSTANT = "44032.the-merc-with-the-mouth-constant";
const MERC_RESPONSE = "44032.the-merc-with-the-mouth-forced-response";
const BUTLER_INTERRUPT = "44033.butler-forced-interrupt";
const BUTLER_BOOST = "44033.boost";
const PROCEDURES_RESPONSE = "44034.involuntary-procedures-forced-response";
const TABULA_CONSTANT = "44035.tabula-rasa-16-constant";
const TABULA_ACTION = "44035.tabula-rasa-16-action";
const TABULA_BOOST = "44035.boost";
const SOLDIER_RESPONSE = "44036.mutated-soldier-forced-response";
const WALL = "44001b.break-the-fourth-wall";

const HURT_9 = "44003.exhausting-personality-action";
const HURT_ALLY_1 = "44020.get-rage-y-action";
const HURT_4 = "44006.yoo-hoo-action";
const DOGPOOL_IN = "44004.maximum-effort-action";
const WEB_KICK_ACTION = "01005.swinging-web-kick-action";

const FIXTURES = defineAbilities({
  [HURT_9]: action(dealDamage(9, yourIdentity)),
  [HURT_4]: action(dealDamage(4, yourIdentity)),
  [HURT_ALLY_1]: action(dealDamage(1, each(query("ally", { name: "Deadpool" })))),
  [DOGPOOL_IN]: action(
    selectCards("a", zone("hand", you, { filter: query("ally", { name: "Dogpool" }) })),
    putIntoPlay(chosen("a"), you),
  ),
  [WEB_KICK_ACTION]: action(dealDamage(1, yourIdentity)),
});
const DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, ...FIXTURES } };

const DEADPOOL = { starterDeckId: "deadpool-pool" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CABLE = { starterDeckId: "cable-leadership" } as const;
type Seat = typeof DEADPOOL | typeof SPIDER_MAN | typeof CABLE;
const HERO = { heroForm: 0 } as const;
const HEADROOM = 20;

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const stryfe = (s: GameState): InstanceId => s.activeVillainId!;
const encounterPile = (s: GameState) => s.encounterDecks[Object.keys(s.encounterDecks)[0]!]!;
const encounterDeckIds = (s: GameState): InstanceId[] => Object.values(s.encounterDecks).flatMap((d) => d.deck);
const encounterDiscard = (s: GameState): InstanceId[] => Object.values(s.encounterDecks).flatMap((d) => d.discard);
const isIn = (list: readonly InstanceId[], id: InstanceId): boolean => list.includes(id);
const removedCodes = (s: GameState): string[] => s.removedFromGame.map((id) => codeOf(s, id));
const events = <T extends GameEvent["type"]>(log: readonly GameEvent[], type: T) =>
  log.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const damageOn = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).damage;
const formOf = (s: GameState, p: PlayerId = P1) => playerOf(s, p).identity.form;
const run = (state: GameState, pick: Picker, ...commands: Command[]) =>
  driveEventsPicking(DEPS, state, pick, ...commands);
const endPhase = (state: GameState): Command[] => state.players.map((p) => endTurn(p.playerId));

/** Deadpool's seat(s) in a fresh Stryfe game, in the player phase, Crisis out of the deck; no headroom on identities. */
function baseGame(players: readonly Seat[] = [DEADPOOL], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  const lowered = patchInstance(settled, settled.mainScheme.instanceId, { threat: -30 });
  const calm = patchInstance(lowered, stryfe(lowered), {
    statuses: { ...inst(lowered, stryfe(lowered)).statuses, tough: 0 },
  });
  return {
    ...calm,
    encounterDecks: Object.fromEntries(
      Object.entries(calm.encounterDecks).map(([key, pile]) => [
        key,
        { ...pile, deck: pile.deck.filter((id) => codeOf(calm, id) !== CRISIS) },
      ]),
    ),
  };
}
/** `baseGame` with every identity's damage at -20, so no villain volley can defeat one. */
const roomy = (state: GameState): GameState =>
  state.players.reduce((acc, p) => patchInstance(acc, identityOf(acc, p.playerId), { damage: -HEADROOM }), state);
/** Every seat of `state` in hero form. */
const allHero = (state: GameState): GameState =>
  state.players.reduce((acc, p) => withForm(acc, HERO, p.playerId), state);
const heroGame = (players?: readonly Seat[], seed = 1): GameState => allHero(baseGame(players, seed));

/** The encounter deck with `id` `n` cards down. */
function behind(state: GameState, id: InstanceId, n: number): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const rest = pile.deck.filter((x) => x !== id);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...pile, deck: [...rest.slice(0, n), id, ...rest.slice(n)] },
    },
  };
}
type Revealed = { state: GameState; events: readonly GameEvent[]; id: InstanceId };
/** Reveals set-aside nemesis card `code` of `owner` in the villain phase, `fillers` cards ahead of it. */
function reveal(state: GameState, code: string, pick: Picker = firstLegal, fillers = state.players.length): Revealed {
  const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code)!;
  const set = stackSetAside(state, code, P1);
  return { ...run(behind(set, id, fillers), pick, ...endPhase(set)), id };
}
/** Reveals the obligation, which sits in the encounter deck. */
function revealMerc(state: GameState, pick: Picker = firstLegal, fillers = state.players.length): Revealed {
  const id = instancesOf(state, MERC)[0]!;
  return { ...run(behind(state, id, fillers), pick, ...endPhase(state)), id };
}
/** The Merc put into `owner`'s play area by surgery (it is a player-area obligation after its reveal). */
function withMerc(state: GameState, owner: PlayerId = P1): { state: GameState; id: InstanceId } {
  const id = instancesOf(state, MERC)[0]!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: Object.fromEntries(
        Object.entries(state.encounterDecks).map(([key, pile]) => [
          key,
          { ...pile, deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
        ]),
      ),
      players: state.players.map((p) => (p.playerId === owner ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: null } },
    },
  };
}
/** A set-aside card of P1 put into the villain area (a side scheme) with `threat` on it. */
function sideSchemeIn(state: GameState, code: string, threat: number): { state: GameState; id: InstanceId } {
  const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code)!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, threat } },
    },
  };
}
/** A set-aside minion of P1 engaged with `player`. */
function minionEngaged(state: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code)!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        setAside: p.setAside.filter((i) => i !== id),
        playArea: p.playerId === player ? [...p.playArea, id] : p.playArea,
      })),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, controllerId: null, engagedWith: player, exhausted: false },
      },
    },
  };
}
/** A copy of `code` from `player`'s pool put straight into their play area (surgery: no cost, no entering-play response). */
function ownCardInPlay(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const seat = playerOf(given.state, player);
  return {
    id,
    state: {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === player ? { ...p, hand: seat.hand.filter((i) => i !== id), playArea: [...seat.playArea, id] } : p,
      ),
      instances: {
        ...given.state.instances,
        [id]: { ...given.state.instances[id]!, faceup: true, controllerId: player },
      },
    },
  };
}
/** Stryfe is confused: he schemes nothing in alter-ego form, so only minions' threat can show. */
const stryfeInert = (s: GameState): GameState =>
  patchInstance(s, stryfe(s), { statuses: { ...inst(s, stryfe(s)).statuses, confused: 1, stunned: 1 } });
/** `player`'s first `n` hand cards become Core resource cards of `code` (01088 energy, 01089 mental, 01090 physical). */
function resourceHand(
  state: GameState,
  player: PlayerId,
  code: string,
  n: number,
): { state: GameState; ids: InstanceId[] } {
  const ids = playerOf(state, player).hand.slice(0, n);
  return { ids, state: ids.reduce((acc, id) => patchInstance(acc, id, { cardId: code as never }), state) };
}

/** Plays `code` from `player`'s pool as a real play, paying `cost` with other hand cards turned into Core energy. */
function playFixture(state: GameState, code: string, cost: number, player: PlayerId = P1, pick: Picker = firstLegal) {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const pay = payWith(given.state, player, cost, [id]);
  const paid = pay.reduce((acc, p) => patchInstance(acc, p, { cardId: "01088" as never }), given.state);
  return { ...driveEventsPicking(DEPS, paid, pick, play(player, id, pay)), id };
}

/** Answers the talked question with `said` ("yes" / "no"), declining every other prompt; records who was asked. */
function saying(said: "yes" | "no", asked: PlayerId[] = []): Picker {
  return (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "reportFact") {
      asked.push(choice.playerId);
      return [said];
    }
    return firstLegal(state);
  };
}

/** Applies `command`, then answers every prompt before the talked question with the first legal pick. */
function applyUntilTalked(state: GameState, command: Command): GameState {
  const result = applyCommand(state, command, DEPS);
  if (!result.ok) throw new Error(result.error.message);
  let current = result.state;
  while (current.pendingChoice && current.pendingChoice.prompt.kind !== "reportFact") {
    const c = current.pendingChoice;
    const next = applyCommand(
      current,
      {
        type: "resolveChoice",
        playerId: c.playerId,
        choiceId: c.choiceId,
        selectedOptionIds: firstLegal(current) as string[],
      },
      DEPS,
    );
    if (!next.ok) throw new Error(next.error.message);
    current = next.state;
  }
  return current;
}

describe("Deadpool obligation and nemesis registry", () => {
  const REFS = [
    MERC_CONSTANT,
    MERC_RESPONSE,
    BUTLER_INTERRUPT,
    BUTLER_BOOST,
    PROCEDURES_RESPONSE,
    TABULA_CONSTANT,
    TABULA_ACTION,
    TABULA_BOOST,
    SOLDIER_RESPONSE,
  ];
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(DEADPOOL_OBLIGATION_NEMESIS[id]!)).toEqual([]);
  });
  it("holds exactly the nine refs", () => {
    expect(Object.keys(DEADPOOL_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
  });
  it("his set is staged: the nemesis cards are set aside, the obligation is in the encounter deck, Crisis is out", () => {
    const base = baseGame();
    const aside = playerOf(base, P1).setAside.map((i) => codeOf(base, i));
    expect(aside.sort()).toEqual([BUTLER, PROCEDURES, TABULA, SOLDIER, SOLDIER].sort());
    expect(instancesOf(base, MERC)).toHaveLength(1);
    expect(isIn(encounterDeckIds(base), instancesOf(base, MERC)[0]!)).toBe(true);
    expect(encounterDeckIds(base).map((i) => codeOf(base, i))).not.toContain(CRISIS);
  });
});

describe("The Merc with the Mouth (44032): the obligation", () => {
  it("revealed, it is given to the Wade Wilson player and stays in their play area (not discarded)", () => {
    const { state, id } = revealMerc(baseGame());
    expect(isIn(playerOf(state, P1).playArea, id)).toBe(true);
    expect(isIn(encounterDiscard(state), id)).toBe(false);
  });
  it("two players: it goes to the Deadpool seat, whoever reveals it", () => {
    const base = baseGame([SPIDER_MAN, DEADPOOL]);
    const { state, id } = revealMerc(base);
    expect(isIn(playerOf(state, P2).playArea, id)).toBe(true);
    expect(isIn(playerOf(state, P1).playArea, id)).toBe(false);
  });
  it("Boost: its 2 boost icons add 2 to the villain's attack", () => {
    const base = heroGame();
    const id = instancesOf(base, MERC)[0]!;
    const staged = behind(base, id, 0);
    const { events: log } = run(staged, firstLegal, ...endPhase(staged));
    expect(events(log, "attackResolved")[0]).toMatchObject({ boostIcons: 2 });
  });

  describe("constant: allies you control cannot ready (and enter play exhausted)", () => {
    const hopeOf = (s: GameState): InstanceId => instancesOf(s, HOPE)[0]!;
    it("Hope Summers starts under the first player's control, ready", () => {
      const base = baseGame();
      expect(inst(base, hopeOf(base)).controllerId).toBe(P1);
      expect(inst(base, hopeOf(base)).exhausted).toBe(false);
    });
    it("control: without the Merc an exhausted ally of yours is readied when the player phase ends", () => {
      const base = patchInstance(baseGame(), hopeOf(baseGame()), { exhausted: true });
      const { state } = run(base, saying("yes"), ...endPhase(base));
      expect(inst(state, hopeOf(state)).exhausted).toBe(false);
    });
    it("with the Merc in your play area your exhausted ally stays exhausted through the ready step", () => {
      const base = baseGame();
      const merc = withMerc(patchInstance(base, hopeOf(base), { exhausted: true }));
      const { state } = run(merc.state, saying("yes"), ...endPhase(merc.state));
      expect(isIn(playerOf(state, P1).playArea, merc.id)).toBe(true);
      expect(inst(state, hopeOf(state)).exhausted).toBe(true);
    });
    it("only YOUR allies: the Merc is another player's, so Hope (under the first player's control) is readied", () => {
      const base = baseGame([SPIDER_MAN, DEADPOOL]);
      expect(inst(base, hopeOf(base)).controllerId).toBe(P1);
      const merc = withMerc(patchInstance(base, hopeOf(base), { exhausted: true }), P2);
      const { state } = run(merc.state, saying("yes"), ...endPhase(merc.state));
      expect(inst(state, hopeOf(state)).exhausted).toBe(false);
    });
    it("an ally put into play while the Merc is in your play area enters exhausted; without it, ready", () => {
      const hand = moveToHand(heroGame(), P1, DOGPOOL).state;
      const putDogpoolIn = (s: GameState): GameState => {
        const given = moveToHand(s, P1, "44004");
        return run(given.state, firstLegal, play(P1, given.ids[0]!, [])).state;
      };
      const without = putDogpoolIn(hand);
      const dogpoolWithout = instancesOf(without, DOGPOOL)[0]!;
      expect(isIn(playerOf(without, P1).playArea, dogpoolWithout)).toBe(true);
      expect(inst(without, dogpoolWithout).exhausted).toBe(false);
      const withIt = putDogpoolIn(withMerc(hand).state);
      const dogpoolWith = instancesOf(withIt, DOGPOOL)[0]!;
      expect(isIn(playerOf(withIt, P1).playArea, dogpoolWith)).toBe(true);
      expect(inst(withIt, dogpoolWith).exhausted).toBe(true);
    });
  });

  describe("Forced Response: after the player phase ends, if you have not talked this phase, discard this card", () => {
    it("asks the Wade Wilson player whether they talked: Yes or No, a report of the fact talkedThisPhase", () => {
      const merc = withMerc(baseGame());
      let prompt: GameState["pendingChoice"] = null;
      const pick: Picker = (s) => {
        if (s.pendingChoice?.prompt.kind === "reportFact") prompt = s.pendingChoice;
        return saying("yes")(s);
      };
      run(merc.state, pick, ...endPhase(merc.state));
      expect(prompt).toMatchObject({
        playerId: P1,
        prompt: { kind: "reportFact", fact: "talkedThisPhase", answer: "yesNo" },
        options: [{ optionId: "yes" }, { optionId: "no" }],
        authority: "player",
      });
    });
    it("reported yes: the Merc stays in play and the fact is logged as 1", () => {
      const merc = withMerc(baseGame());
      const { state, events: log } = run(merc.state, saying("yes"), ...endPhase(merc.state));
      expect(isIn(playerOf(state, P1).playArea, merc.id)).toBe(true);
      expect(isIn(encounterDiscard(state), merc.id)).toBe(false);
      expect(events(log, "factReported")).toEqual([
        { type: "factReported", playerId: P1, fact: "talkedThisPhase", bind: "talked", amount: 1 },
      ]);
    });
    it("reported no: the Merc is discarded (to the encounter discard pile) and the fact is logged as 0", () => {
      const merc = withMerc(baseGame());
      const { state, events: log } = run(merc.state, saying("no"), ...endPhase(merc.state));
      expect(isIn(playerOf(state, P1).playArea, merc.id)).toBe(false);
      expect(isIn(encounterDiscard(state), merc.id)).toBe(true);
      expect(events(log, "factReported")).toEqual([
        { type: "factReported", playerId: P1, fact: "talkedThisPhase", bind: "talked", amount: 0 },
      ]);
    });
    it("the question comes at the end of the player phase: before step one of the villain phase places any threat", () => {
      const merc = withMerc(baseGame());
      let at: GameState | null = null;
      const pick: Picker = (s) => {
        if (s.pendingChoice?.prompt.kind === "reportFact" && at === null) at = s;
        return saying("yes")(s);
      };
      run(merc.state, pick, ...endPhase(merc.state));
      const seen = at as unknown as GameState;
      expect(seen.step).toMatchObject({ phase: "villain", kind: "placeThreat" });
      expect(inst(seen, seen.mainScheme.instanceId).threat).toBe(
        inst(merc.state, merc.state.mainScheme.instanceId).threat,
      );
    });
    it("it is asked again every player phase it stays: yes, then no, discards it in the second", () => {
      const merc = withMerc(roomy(baseGame()));
      const asked: PlayerId[] = [];
      const first = run(merc.state, saying("yes", asked), ...endPhase(merc.state));
      expect(asked).toEqual([P1]);
      expect(isIn(playerOf(first.state, P1).playArea, merc.id)).toBe(true);
      const settled = settle(first.state, saying("yes", asked), (s) => s.step.phase === "player", DEPS);
      const second = run(settled, saying("no", asked), ...endPhase(settled));
      expect(asked).toEqual([P1, P1]);
      expect(isIn(playerOf(second.state, P1).playArea, merc.id)).toBe(false);
    });
    it("once discarded its constant is over: the ally it held exhausted is readied at the next phase end", () => {
      const base = roomy(baseGame());
      const hope = instancesOf(base, HOPE)[0]!;
      const merc = withMerc(patchInstance(base, hope, { exhausted: true }));
      const first = run(merc.state, saying("no"), ...endPhase(merc.state));
      expect(inst(first.state, hope).exhausted).toBe(true);
      const settled = settle(first.state, firstLegal, (s) => s.step.phase === "player", DEPS);
      const second = run(settled, saying("yes"), ...endPhase(settled));
      expect(inst(second.state, hope).exhausted).toBe(false);
    });
    it("no Merc in play: nobody is asked", () => {
      const asked: PlayerId[] = [];
      const { events: log } = run(baseGame(), saying("yes", asked), ...endPhase(baseGame()));
      expect(asked).toEqual([]);
      expect(events(log, "factReported")).toEqual([]);
    });

    describe("two players", () => {
      it("Merc on the Deadpool seat (P2): only P2 is asked, once, after BOTH turns have ended", () => {
        const base = withMerc(baseGame([SPIDER_MAN, DEADPOOL]), P2);
        const asked: PlayerId[] = [];
        const afterOne = run(base.state, saying("yes", asked), endTurn(P1));
        expect(asked).toEqual([]);
        expect(afterOne.state.step.phase).toBe("player");
        const { state, events: log } = run(afterOne.state, saying("no", asked), endTurn(P2));
        expect(asked).toEqual([P2]);
        expect(events(log, "factReported")).toMatchObject([{ playerId: P2, amount: 0 }]);
        expect(isIn(playerOf(state, P2).playArea, base.id)).toBe(false);
      });
      it("Merc on P1 with Spider-Man at P2: only P1 is asked", () => {
        const base = withMerc(baseGame([DEADPOOL, SPIDER_MAN]), P1);
        const asked: PlayerId[] = [];
        const { events: log } = run(base.state, saying("yes", asked), ...endPhase(base.state));
        expect(asked).toEqual([P1]);
        expect(events(log, "factReported")).toHaveLength(1);
      });
      it("the question is the Merc player's alone to answer: another player's answer is refused", () => {
        const base = withMerc(baseGame([DEADPOOL, SPIDER_MAN]), P1);
        const current = applyUntilTalked(run(base.state, firstLegal, endTurn(P1)).state, endTurn(P2));
        const choice = current.pendingChoice!;
        expect(choice).toMatchObject({ playerId: P1, prompt: { kind: "reportFact" } });
        const byP2 = applyCommand(
          current,
          { type: "resolveChoice", playerId: P2, choiceId: choice.choiceId, selectedOptionIds: ["no"] },
          DEPS,
        );
        expect(byP2.ok).toBe(false);
        const anythingElse = applyCommand(
          current,
          { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: ["maybe"] },
          DEPS,
        );
        expect(anythingElse.ok).toBe(false);
      });
    });

    it("replay: the logged answer reproduces the game (yes keeps it, no discards it)", () => {
      for (const said of ["yes", "no"] as const) {
        const merc = withMerc(baseGame());
        let session: GameSession = startSession(merc.state);
        const apply = (command: Command): void => {
          const result = sessionApply(session, command, DEPS);
          if (!result.ok) throw new Error(result.error.message);
          session = result.session;
        };
        apply(endTurn(P1));
        let answered = false;
        while (session.state.pendingChoice) {
          const c = session.state.pendingChoice;
          const talked = c.prompt.kind === "reportFact";
          if (talked) {
            expect(answered).toBe(false);
            answered = true;
          }
          apply({
            type: "resolveChoice",
            playerId: c.playerId,
            choiceId: c.choiceId,
            selectedOptionIds: talked ? [said] : (firstLegal(session.state) as string[]),
          });
        }
        expect(answered).toBe(true);
        expect(isIn(playerOf(session.state, P1).playArea, merc.id)).toBe(said === "yes");
        const replayed = replay(session.log, DEPS);
        expect(replayed.ok && replayed.state).toEqual(session.state);
      }
    });
  });

  describe("constant: other players cannot resolve player card abilities during your turn", () => {
    /** P2 (Spider-Man, hero form) tries to play Swinging Web Kick (cost 3, an Action here) during P1's turn. */
    function webKick(merc: boolean, actor: PlayerId = P2) {
      const base = heroGame([DEADPOOL, SPIDER_MAN]);
      const given = moveToHand(merc ? withMerc(base).state : base, actor, WEB_KICK);
      const id = given.ids[0]!;
      const paid = payWith(given.state, actor, 3, [id]).reduce(
        (acc, p) => patchInstance(acc, p, { cardId: "01088" as never }),
        given.state,
      );
      const command = play(actor, id, payWith(paid, actor, 3, [id]));
      return { state: paid, command, ok: applyCommand(paid, command, DEPS).ok };
    }
    it("control: without the Merc another player may play an Action event during Deadpool's turn", () => {
      expect(webKick(false).ok).toBe(true);
    });
    it.fails("ENGINE GAP (no predicate for whose turn it is): with the Merc in play P2's Action is refused during P1's turn", () => {
      expect(webKick(true).ok).toBe(false);
    });
    it("the Merc player's own abilities are untouched in their own turn", () => {
      const base = heroGame([DEADPOOL, SPIDER_MAN]);
      const merc = withMerc(base);
      const given = moveToHand(merc.state, P1, "44003");
      expect(applyCommand(given.state, play(P1, given.ids[0]!, []), DEPS).ok).toBe(true);
    });
  });

  describe("Standing exhaust (owner ruling 2026-10-05: no When Revealed header): allies already in play are exhausted", () => {
    it.fails("ENGINE GAP (no rule keeps a character exhausted; a stateCheck needs its own ref): an ally already in play and ready is exhausted once the Merc is in play", () => {
      const base = baseGame();
      const hope = instancesOf(base, HOPE)[0]!;
      expect(inst(base, hope).exhausted).toBe(false);
      const { state } = revealMerc(base);
      expect(inst(state, hope).exhausted).toBe(true);
    });
  });
});

describe("Butler (44033): the nemesis minion", () => {
  it("is revealed engaged with the Deadpool player with ATK 1, SCH 2 and 3 hit points", () => {
    const { state, id } = reveal(baseGame(), BUTLER);
    expect(inst(state, id).engagedWith).toBe(P1);
    expect(state.cardPool[codeOf(state, id) as never]).toMatchObject({ atk: 1, sch: 2, hp: 3 });
  });
  it("Boost: you are confused (hero form: the villain attacks the Deadpool player)", () => {
    const base = heroGame();
    const staged = stackSetAside(base, BUTLER, P1);
    const { state } = run(staged, firstLegal, ...endPhase(staged));
    expect(inst(state, identityOf(state)).statuses.confused).toBeGreaterThanOrEqual(1);
  });
  it("Boost: the same for the player the villain attacks in a two-player game, and only them", () => {
    const base = heroGame([DEADPOOL, SPIDER_MAN]);
    const staged = stackSetAside(base, BUTLER, P1);
    const { state, events: log } = run(staged, firstLegal, ...endPhase(staged));
    const victim = events(log, "attackResolved")[0]!.targetInstanceId;
    const other = victim === identityOf(state, P1) ? P2 : P1;
    expect(inst(state, victim).statuses.confused).toBe(1);
    expect(inst(state, identityOf(state, other)).statuses.confused ?? 0).toBe(0);
  });
  it("Boost: its 0 boost icons add nothing to the villain's attack", () => {
    const base = heroGame();
    const staged = stackSetAside(base, BUTLER, P1);
    const { events: log } = run(staged, firstLegal, ...endPhase(staged));
    expect(events(log, "attackResolved")[0]).toMatchObject({ boostIcons: 0 });
  });

  describe("Forced Interrupt: when Butler schemes, his threat goes on Involuntary Procedures if able", () => {
    /** Alter-ego game (Butler schemes), Butler engaged, Stryfe inert; `procedures` threat, or null for none in play. */
    function scheming(procedures: number | null) {
      let s = stryfeInert(baseGame());
      const butler = minionEngaged(s, BUTLER);
      s = butler.state;
      let side: InstanceId | null = null;
      if (procedures !== null) {
        const placed = sideSchemeIn(s, PROCEDURES, procedures);
        s = placed.state;
        side = placed.id;
      }
      const driven = run(s, firstLegal, ...endPhase(s));
      const resolved = events(driven.events, "schemeResolved").filter((e) => e.enemyInstanceId === butler.id);
      return { ...driven, butler: butler.id, side, resolved };
    }
    it("with Involuntary Procedures in play all of his threat (SCH 2 plus boost) goes on it, none on the main scheme", () => {
      const { state, side, butler, resolved, events: log } = scheming(3);
      expect(resolved).toHaveLength(1);
      const placed = resolved[0]!.threatPlaced;
      expect(resolved[0]!.baseSch).toBe(2);
      expect(placed).toBe(2 + resolved[0]!.boostIcons);
      expect(inst(state, side!).threat).toBe(3 + placed);
      const mine = events(log, "threatPlaced").filter((e) => e.sourceInstanceId === butler);
      expect(mine.map((e) => [e.schemeInstanceId, e.amount])).toEqual([[side, placed]]);
    });
    it("without it in play the threat goes on the main scheme", () => {
      const { state, butler, resolved, events: log } = scheming(null);
      expect(resolved).toHaveLength(1);
      const placed = resolved[0]!.threatPlaced;
      expect(placed).toBe(2 + resolved[0]!.boostIcons);
      const mine = events(log, "threatPlaced").filter((e) => e.sourceInstanceId === butler);
      expect(mine.map((e) => [e.schemeInstanceId, e.amount])).toEqual([[state.mainScheme.instanceId, placed]]);
    });
    it("hero form: Butler attacks (ATK 1) instead and no threat goes on Involuntary Procedures", () => {
      const base = roomy(heroGame());
      const butler = minionEngaged(base, BUTLER);
      const side = sideSchemeIn(butler.state, PROCEDURES, 3);
      const { state, events: log } = run(side.state, firstLegal, ...endPhase(side.state));
      const attack = events(log, "attackResolved").find((e) => e.enemyInstanceId === butler.id)!;
      expect(attack.baseAtk).toBe(1);
      expect(events(log, "threatPlaced").filter((e) => e.sourceInstanceId === butler.id)).toEqual([]);
      // The threat it did gain is Involuntary Procedures' own response to the attacks that damaged Deadpool.
      expect(inst(state, side.id).threat).toBeGreaterThan(3);
    });
  });
});

describe("Involuntary Procedures (44034): the side scheme", () => {
  it("is revealed with 6 threat and a hazard icon, in the villain area", () => {
    const { state, id } = reveal(baseGame(), PROCEDURES);
    expect(inst(state, id).threat).toBe(6);
    expect(isIn(state.villainArea, id)).toBe(true);
    expect(state.cardPool[codeOf(state, id) as never]).toMatchObject({ icons: ["hazard"] });
  });
  it("two players: still 6 threat (no per-player scaling)", () => {
    const { state, id } = reveal(baseGame([DEADPOOL, SPIDER_MAN]), PROCEDURES);
    expect(inst(state, id).threat).toBe(6);
  });
  it("Boost: its 3 boost icons add 3 to the villain's attack", () => {
    const base = heroGame();
    const staged = stackSetAside(base, PROCEDURES, P1);
    const { events: log } = run(staged, firstLegal, ...endPhase(staged));
    expect(events(log, "attackResolved")[0]).toMatchObject({ boostIcons: 3 });
  });

  /** Procedures in play with `threat`, Deadpool (hero form) takes 4 from the stand-in 44006, or whatever `then` does. */
  const withProcedures = (threat: number, base: GameState = heroGame()) => sideSchemeIn(base, PROCEDURES, threat);
  const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;

  describe("Forced Response: after Deadpool takes any amount of damage, place 1 threat here", () => {
    it("Deadpool takes 4: 1 threat is placed (6 -> 7)", () => {
      const side = withProcedures(6);
      const { state } = playFixture(side.state, "44006", 1);
      expect(damageOn(state)).toBe(4);
      expect(threatOf(state, side.id)).toBe(7);
    });
    it("two separate damages: 1 threat each time (6 -> 8)", () => {
      const side = withProcedures(6);
      const once = playFixture(side.state, "44006", 1).state;
      const twice = playFixture(once, "44006", 1).state;
      expect(damageOn(twice)).toBe(8);
      expect(threatOf(twice, side.id)).toBe(8);
    });
    it("Wade Wilson (alter-ego) takes damage: nothing, he is not 'Deadpool'", () => {
      const side = withProcedures(6, baseGame());
      const { state } = playFixture(side.state, "44006", 1);
      expect(formOf(state)).toBe("alterEgo");
      expect(damageOn(state)).toBe(4);
      expect(threatOf(state, side.id)).toBe(6);
    });
    it("damage a tough status card absorbs is not 'taken': no threat, and the tough card is gone", () => {
      const base = heroGame();
      const toughened = patchInstance(base, identityOf(base), {
        statuses: { ...inst(base, identityOf(base)).statuses, tough: 1 },
      });
      const side = withProcedures(6, toughened);
      const { state } = playFixture(side.state, "44006", 1);
      expect(damageOn(state)).toBe(0);
      expect(inst(state, identityOf(state)).statuses.tough).toBe(0);
      expect(threatOf(state, side.id)).toBe(6);
    });
    it("the ally Deadpool (40024) taking damage counts, whoever controls him (the other player's)", () => {
      const base = heroGame([DEADPOOL, CABLE]);
      const ally = ownCardInPlay(base, P2, ALLY_DEADPOOL);
      const side = withProcedures(6, ally.state);
      const { state } = playFixture(side.state, "44020", 0);
      expect(inst(state, ally.id).damage).toBe(1);
      expect(threatOf(state, side.id)).toBe(7);
    });
    it("another player's identity taking damage does not count (Spider-Man takes 1)", () => {
      const base = heroGame([DEADPOOL, SPIDER_MAN]);
      const side = withProcedures(6, base);
      const { state } = playFixture(side.state, WEB_KICK, 3, P2);
      expect(damageOn(state, P2)).toBe(1);
      expect(threatOf(state, side.id)).toBe(6);
    });
  });

  describe("Then, if there is 10 or more threat here, remove this card from the game", () => {
    it("at 9 threat one more is 10: removed from the game (not discarded, not in the villain area)", () => {
      const side = withProcedures(9);
      const { state } = playFixture(side.state, "44006", 1);
      expect(removedCodes(state)).toContain(PROCEDURES);
      expect(isIn(state.villainArea, side.id)).toBe(false);
      expect(isIn(encounterDiscard(state), side.id)).toBe(false);
    });
    it("at 8 threat one more is 9: it stays", () => {
      const side = withProcedures(8);
      const { state } = playFixture(side.state, "44006", 1);
      expect(threatOf(state, side.id)).toBe(9);
      expect(isIn(state.villainArea, side.id)).toBe(true);
      expect(removedCodes(state)).not.toContain(PROCEDURES);
    });
    it("already over 10 (12): the next damage makes 13 and it is removed", () => {
      const side = withProcedures(12);
      const { state } = playFixture(side.state, "44006", 1);
      expect(removedCodes(state)).toContain(PROCEDURES);
    });
    it("once removed, later damage to Deadpool places nothing anywhere", () => {
      const side = withProcedures(9);
      const first = playFixture(side.state, "44006", 1).state;
      const second = playFixture(first, "44006", 1);
      expect(damageOn(second.state)).toBe(8);
      expect(events(second.events, "threatPlaced")).toEqual([]);
    });
  });

  describe("against his regeneration (The Regeneratin' Degenerate, 44001a)", () => {
    it("lethal damage on the hero face: replaced by 1 hit point and Wade Wilson, as ever", () => {
      const side = withProcedures(6);
      const { state } = playFixture(side.state, "44003", 0);
      expect(formOf(state)).toBe("alterEgo");
      expect(damageOn(state)).toBe(8);
      expect(playerOf(state, P1).eliminated).toBe(false);
    });
    // §3.79: "Involuntary Procedures gains its threat from this damage". The response is read after the replacement,
    // when he is already Wade Wilson, so "Deadpool" no longer names him and the threat is not placed (it stays 6).
    it.fails("ENGINE GAP/RULES Q: the regenerating damage itself is 'Deadpool taking damage': 1 threat is placed", () => {
      const side = withProcedures(6);
      const { state } = playFixture(side.state, "44003", 0);
      expect(threatOf(state, side.id)).toBe(7);
    });
  });
});

describe("Tabula Rasa 16 (44035): the attachment", () => {
  const tabulaOn = (state: GameState, player: PlayerId = P1) => {
    const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === TABULA)!;
    const host = identityOf(state, player);
    return {
      id,
      host,
      state: {
        ...state,
        players: state.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
        instances: {
          ...state.instances,
          [id]: { ...state.instances[id]!, faceup: true, attachedTo: host },
          [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] },
        },
      },
    };
  };
  describe("revealed: attach to your identity", () => {
    it("it attaches to the revealing player's identity", () => {
      const { state, id } = reveal(baseGame(), TABULA);
      expect(inst(state, id).attachedTo).toBe(identityOf(state));
      expect(isIn(inst(state, identityOf(state)).attachments, id)).toBe(true);
    });
    it("two players: it attaches to the identity of the player it was revealed to (P2, dealt it second)", () => {
      const base = baseGame([DEADPOOL, SPIDER_MAN]);
      const { state, id } = reveal(base, TABULA, firstLegal, 3);
      expect(inst(state, id).attachedTo).toBe(identityOf(state, P2));
    });
  });
  describe("constant: your identity's printed text box is blank (both faces)", () => {
    const wall = (s: GameState) => use(P1, identityOf(s), WALL, [], { discard: [playerOf(s, P1).hand[0]!] });
    it("control: Wade Wilson uses Break the Fourth Wall without it", () => {
      const base = baseGame();
      expect(applyCommand(base, wall(base), DEPS).ok).toBe(true);
    });
    it("with it, Break the Fourth Wall (alter-ego text) is not offered", () => {
      const tab = tabulaOn(baseGame());
      expect(applyCommand(tab.state, wall(tab.state), DEPS).ok).toBe(false);
    });
    it("with it, Deadpool's lethal damage defeats him: no 1 hit point, no Wade Wilson, no token: eliminated", () => {
      const tab = tabulaOn(heroGame());
      const tokens = tab.state.mainScheme!.accelerationTokens;
      const { state } = playFixture(tab.state, "44003", 0);
      expect(playerOf(state, P1).eliminated).toBe(true);
      expect(state.mainScheme!.accelerationTokens).toBe(tokens);
    });
    it("control: without it the same damage is regenerated (hero face stays in play as Wade at 1 hit point)", () => {
      const { state } = playFixture(heroGame(), "44003", 0);
      expect(playerOf(state, P1).eliminated).toBe(false);
      expect(formOf(state)).toBe("alterEgo");
    });
    it("Wade Wilson at 0 hit points is eliminated with or without it", () => {
      const base = baseGame();
      const near = patchInstance(base, identityOf(base), { damage: 8 });
      const { state } = playFixture(near, "44006", 1);
      expect(playerOf(state, P1).eliminated).toBe(true);
    });
    it("two players: it blanks only the identity it is attached to (Spider-Man's is untouched)", () => {
      const tab = tabulaOn(heroGame([DEADPOOL, SPIDER_MAN]), P1);
      const { state } = playFixture(tab.state, "44003", 0);
      expect(playerOf(state, P1).eliminated).toBe(true);
      expect(playerOf(state, P2).eliminated).toBe(false);
    });
  });
  describe("Alter-Ego Action: spend [mental][mental] -> discard this card", () => {
    const useIt = (s: GameState, id: InstanceId, code: string, n: number) => {
      const hand = resourceHand(s, P1, code, n);
      return {
        state: hand.state,
        command: use(
          P1,
          id,
          TABULA_ACTION,
          hand.ids.map((fromHand) => ({ fromHand })),
        ),
        ids: hand.ids,
      };
    };
    it("two [mental] resources: it is discarded and the two cards are spent", () => {
      const tab = tabulaOn(baseGame());
      const go = useIt(tab.state, tab.id, "01089", 2);
      const { state } = run(go.state, firstLegal, go.command);
      expect(isIn(inst(state, tab.host).attachments, tab.id)).toBe(false);
      expect(isIn(encounterDiscard(state), tab.id)).toBe(true);
      for (const id of go.ids) expect(isIn(playerOf(state, P1).discard, id)).toBe(true);
    });
    it("once it is gone his text box is back: Break the Fourth Wall is offered again", () => {
      const tab = tabulaOn(baseGame());
      const go = useIt(tab.state, tab.id, "01089", 2);
      const { state } = run(go.state, firstLegal, go.command);
      const wall = use(P1, identityOf(state), WALL, [], { discard: [playerOf(state, P1).hand[0]!] });
      expect(applyCommand(state, wall, DEPS).ok).toBe(true);
    });
    it("one card with two [mental] icons pays for both", () => {
      const tab = tabulaOn(baseGame());
      const go = useIt(tab.state, tab.id, "01089", 1);
      const { state } = run(go.state, firstLegal, go.command);
      expect(isIn(inst(state, tab.host).attachments, tab.id)).toBe(false);
    });
    it("one [mental] icon is not enough, and two [energy] cards are the wrong type", () => {
      const tab = tabulaOn(baseGame());
      const one = useIt(tab.state, tab.id, "01003", 1);
      expect(applyCommand(one.state, one.command, DEPS).ok).toBe(false);
      const energy = useIt(tab.state, tab.id, "01088", 2);
      expect(applyCommand(energy.state, energy.command, DEPS).ok).toBe(false);
    });
    it("in hero form it is an Alter-Ego Action: refused", () => {
      const tab = tabulaOn(heroGame());
      const go = useIt(tab.state, tab.id, "01089", 2);
      expect(applyCommand(go.state, go.command, DEPS).ok).toBe(false);
    });
    // RRG "Attachment" (p. 8): "Only the player who controls the card to which that attachment is attached can trigger
    // abilities or pay costs on that attachment." The engine lets any player use it.
    it.fails("ENGINE GAP: two players: the Spider-Man seat cannot use it (it is not attached to their identity)", () => {
      const tab = tabulaOn(baseGame([DEADPOOL, SPIDER_MAN]), P1);
      const hand = resourceHand(tab.state, P2, "01089", 2);
      const command = use(
        P2,
        tab.id,
        TABULA_ACTION,
        hand.ids.map((fromHand) => ({ fromHand })),
      );
      expect(applyCommand(hand.state, command, DEPS).ok).toBe(false);
    });
  });
  describe("Boost: attach Tabula Rasa 16 to your identity", () => {
    it("as the villain's boost card it attaches to the attacked player's identity, blanking it", () => {
      const base = heroGame();
      const staged = stackSetAside(base, TABULA, P1);
      const id = encounterPile(staged).deck[0]!;
      const { state, events: log } = run(staged, firstLegal, ...endPhase(staged));
      expect(events(log, "attackResolved")[0]).toMatchObject({ boostIcons: 0 });
      expect(inst(state, id).attachedTo).toBe(identityOf(state));
    });
    it("two players: it attaches to the identity of the player attacked, not the other", () => {
      const base = heroGame([DEADPOOL, SPIDER_MAN]);
      const staged = stackSetAside(base, TABULA, P1);
      const id = encounterPile(staged).deck[0]!;
      const { state, events: log } = run(staged, firstLegal, ...endPhase(staged));
      const victim = events(log, "attackResolved")[0]!.targetInstanceId;
      expect(inst(state, id).attachedTo).toBe(victim);
    });
  });
});

describe("Mutated Soldier (44036): the minion, two copies", () => {
  it("has ATK 2, SCH 1, 5 hit points and toughness, and is revealed engaged with the Deadpool player", () => {
    const { state, id } = reveal(baseGame(), SOLDIER);
    expect(inst(state, id).engagedWith).toBe(P1);
    expect(state.cardPool[SOLDIER as never]).toMatchObject({ atk: 2, sch: 1, hp: 5 });
    expect(inst(state, id).statuses.tough).toBe(1);
  });
  it("there are two copies, both set aside", () => {
    const base = baseGame();
    expect(playerOf(base, P1).setAside.filter((i) => codeOf(base, i) === SOLDIER)).toHaveLength(2);
  });
  it("Boost: its 2 boost icons add 2 to the villain's attack", () => {
    const base = heroGame();
    const staged = stackSetAside(base, SOLDIER, P1);
    const { events: log } = run(staged, firstLegal, ...endPhase(staged));
    expect(events(log, "attackResolved")[0]).toMatchObject({ boostIcons: 2 });
  });

  describe("Forced Response: after Mutated Soldier activates, heal all damage from it", () => {
    it("hero form: it attacks, then all 3 damage on it is healed; Stryfe's own damage is not", () => {
      const base = roomy(heroGame());
      const soldier = minionEngaged(base, SOLDIER);
      const hurt = patchInstance(patchInstance(soldier.state, soldier.id, { damage: 3 }), stryfe(base), { damage: 2 });
      const { state, events: log } = run(hurt, firstLegal, ...endPhase(hurt));
      expect(events(log, "enemyActivated").some((e) => e.enemyInstanceId === soldier.id)).toBe(true);
      expect(inst(state, soldier.id).damage).toBe(0);
      expect(inst(state, stryfe(state)).damage).toBe(2);
    });
    it("alter-ego form: it schemes, then all damage is healed too", () => {
      const base = roomy(baseGame());
      const soldier = minionEngaged(base, SOLDIER);
      const hurt = patchInstance(soldier.state, soldier.id, { damage: 4 });
      const { state, events: log } = run(hurt, firstLegal, ...endPhase(hurt));
      expect(events(log, "schemeResolved").some((e) => e.enemyInstanceId === soldier.id)).toBe(true);
      expect(inst(state, soldier.id).damage).toBe(0);
    });
    it("with no damage there is nothing to heal and nothing goes wrong", () => {
      const base = roomy(heroGame());
      const soldier = minionEngaged(base, SOLDIER);
      const { state } = run(soldier.state, firstLegal, ...endPhase(soldier.state));
      expect(inst(state, soldier.id).damage).toBe(0);
    });
    it("two players: a Soldier engaged with the other player activates against them and heals", () => {
      const base = roomy(heroGame([DEADPOOL, SPIDER_MAN]));
      const soldier = minionEngaged(base, SOLDIER, P2);
      const hurt = patchInstance(soldier.state, soldier.id, { damage: 2 });
      const { state, events: log } = run(hurt, firstLegal, ...endPhase(hurt));
      const attacks = events(log, "attackResolved").filter((e) => e.enemyInstanceId === soldier.id);
      expect(attacks.map((e) => e.targetInstanceId)).toEqual([identityOf(state, P2)]);
      expect(inst(state, soldier.id).damage).toBe(0);
    });
    it("two copies: each heals itself and only itself", () => {
      const base = roomy(heroGame());
      const a = minionEngaged(base, SOLDIER);
      const b = minionEngaged(a.state, SOLDIER);
      const hurt = patchInstance(patchInstance(b.state, a.id, { damage: 1 }), b.id, { damage: 4 });
      const { state } = run(hurt, firstLegal, ...endPhase(hurt));
      expect(inst(state, a.id).damage).toBe(0);
      expect(inst(state, b.id).damage).toBe(0);
    });
  });
});
