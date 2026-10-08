import { AOA_CARDS, CORE_CARDS, WAVE6_CARDS, WAVE7_CARDS, campaignId, cardId, type AnyCard } from "@mc/content";
import {
  createGame,
  legalActions,
  locateCard,
  sessionApply,
  startSession,
  type CampaignGameInput,
  type EngineDeps,
  type GameEvent,
  type GameSession,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type RuleSpec,
  type ScenarioSetupInstruction,
  type TargetRef,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import {
  firstLegal,
  instancesOf,
  moveToHand,
  P1,
  P2,
  play,
  playerOf,
  settle,
  toHero,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { WAVE8_DEPS } from "../../index.js";
import { wave8Scenario } from "../../setup.js";
import {
  allySearchInstruction,
  MISSION_AREA,
  MISSION_RULES,
  missionSetupInstruction,
  PROFESSOR_X_CANNOT_ENTER_PLAY,
  removeOverseersPrelate,
} from "./mission-rules.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Campaign Instructions of MC45 p. 20 that the engine pieces of docs/phase7-wave8.md §3.43, §3.44 and §3.46 are
 * for, with the box's own cards: the ally search that counts toward the starting hand, scenario 5's "Professor X cannot
 * enter play during this game", and scenario 3's Prelate that is the drawn Overseer's other face. The campaign
 * definition does not exist yet, so each game here is built the way its game builder will: the instruction or rule
 * passed in the setup config.
 */
const POOL: readonly AnyCard[] = [...CORE_CARDS, ...WAVE6_CARDS, ...WAVE7_CARDS, ...AOA_CARDS];
const DEPS: EngineDeps = WAVE8_DEPS;
const printed = (code: string): TargetRef => ({ kind: "find", query: { printedId: cardId(code) } });
const typeOf = (state: GameState, id: InstanceId): string | undefined =>
  state.cardPool[state.instances[id]!.cardId]?.type;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const EVACUATE = "45167a";
const SUGAR_MAN = "45182a";
const ABYSS = "45181a";
const PROFESSOR_X = ["32019", "37017"] as const;
const MAKE_THE_CALL = "01071";

/** Spider-Man (and Captain Marvel) against Rhino, with the campaign's rules and instructions passed in. */
function rhino(opts: {
  readonly players?: 1 | 2;
  readonly deck?: readonly string[];
  /** Keeps only these cards of each starter deck (by predicate over the card), for a deck with no ally. */
  readonly keep?: (card: AnyCard) => boolean;
  readonly rules?: readonly RuleSpec[];
  readonly instructions?: readonly ScenarioSetupInstruction[];
  readonly mission?: boolean;
}): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }].slice(
      0,
      opts.players ?? 1,
    ),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const byId = new Map(POOL.map((card) => [card.id as string, card]));
  const created = createGame(
    {
      ...config,
      players: config.players.map((p) => ({
        ...p,
        deck: [
          ...p.deck.filter((id) => opts.keep?.(byId.get(id)!) ?? true),
          ...(opts.deck ?? []).map((c) => cardId(c)),
        ],
      })),
      requireLegalDecks: false,
      setAside: [...(config.setAside ?? []), ...(opts.mission ? [cardId(EVACUATE), cardId(SUGAR_MAN)] : [])],
      scenarioRuleSpecs: [
        ...(config.scenarioRuleSpecs ?? []),
        ...(opts.mission ? MISSION_RULES : []),
        ...(opts.rules ?? []),
      ],
      scenarioSetupInstructions: [
        ...(config.scenarioSetupInstructions ?? []),
        ...(opts.mission ? [missionSetupInstruction(printed(EVACUATE), printed(SUGAR_MAN))] : []),
        ...(opts.instructions ?? []),
      ],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return created.state;
}
const toFirstTurn = (state: GameState): GameState => settle(state, firstLegal, (s) => s.step.phase === "player", DEPS);

describe("§3.44 the ally search of every scenario's Campaign Instructions (MC45 p. 20)", () => {
  /** Answers the open choice through a session, collecting the events. */
  function answer(run: { session: GameSession; events: GameEvent[] }, selected: readonly string[]): void {
    const choice = run.session.state.pendingChoice!;
    const result = sessionApply(
      run.session,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected },
      DEPS,
    );
    if (!result.ok) throw new Error(result.error.message);
    run.session = result.session;
    run.events.push(...result.events);
  }
  const drawn = (events: readonly GameEvent[], player: typeof P1): number =>
    of(events, "cardDrawn").filter((e) => e.playerId === player).length;

  it("Peter Parker (hand size 6): the search is asked with an empty hand and offers only allies; he holds the ally, draws 5 and holds 6; a mulligan of the ally and 2 others draws 3", () => {
    const created = rhino({ instructions: [allySearchInstruction()] });
    const search = created.pendingChoice!;
    expect(search.playerId).toBe(P1);
    expect(playerOf(created, P1).hand).toHaveLength(0);
    expect(search.options.length).toBeGreaterThan(0);
    for (const option of search.options) expect(typeOf(created, option.optionId as InstanceId)).toBe("ally");
    expect([search.minSelections, search.maxSelections]).toEqual([1, 1]);
    const deckBefore = playerOf(created, P1).deck.length;

    const run = { session: startSession(created), events: [] as GameEvent[] };
    const ally = search.options[0]!.optionId as InstanceId;
    answer(run, [ally]);
    const atMulligan = run.session.state;
    expect(atMulligan.pendingChoice?.prompt).toMatchObject({ kind: "mulligan", handSize: 6 });
    expect(of(run.events, "startingHandCreditApplied")).toEqual([
      { type: "startingHandCreditApplied", playerId: P1, handSize: 6, credit: 1, drawn: 5 },
    ]);
    expect(drawn(run.events, P1)).toBe(5);
    expect(playerOf(atMulligan, P1).hand).toHaveLength(6);
    expect(playerOf(atMulligan, P1).hand).toContain(ally);
    expect(playerOf(atMulligan, P1).deck).toHaveLength(deckBefore - 6);
    // "If any portion of a deck is searched … shuffle that entire deck" (RRG 1.8 "Search", p. 39).
    expect(
      of(run.events, "deckShuffled").some(
        (e) => e.zone.kind === "deck" && "playerId" in e.zone && e.zone.playerId === P1,
      ),
    ).toBe(true);

    const others = playerOf(atMulligan, P1)
      .hand.filter((id) => id !== ally)
      .slice(0, 2);
    const before = run.events.length;
    answer(run, [ally, ...others]);
    expect(drawn(run.events.slice(before), P1)).toBe(3);
    expect(playerOf(run.session.state, P1).hand).toHaveLength(6);
  });

  it("two players search in player order, and each draws one fewer", () => {
    const created = rhino({ players: 2, instructions: [allySearchInstruction()] });
    const run = { session: startSession(created), events: [] as GameEvent[] };
    const asked: string[] = [];
    while (run.session.state.pendingChoice && run.session.state.pendingChoice.prompt.kind !== "mulligan") {
      const choice = run.session.state.pendingChoice;
      asked.push(choice.playerId);
      answer(run, [choice.options[0]!.optionId]);
    }
    expect(asked).toEqual([P1, P2]);
    for (const player of [P1, P2]) {
      const size = of(run.events, "startingHandCreditApplied").find((e) => e.playerId === player)!;
      expect(size).toMatchObject({ credit: 1, drawn: size.handSize - 1 });
      expect(playerOf(run.session.state, player).hand).toHaveLength(size.handSize);
    }
  });

  it("a deck with no ally: nothing found, nobody asked, 6 drawn", () => {
    const created = rhino({ keep: (card) => card.type !== "ally", instructions: [allySearchInstruction()] });
    expect(created.pendingChoice?.prompt.kind).toBe("mulligan");
    expect(playerOf(created, P1).hand).toHaveLength(6);
    expect(playerOf(created, P1)).not.toHaveProperty("startingHandCredit");
  });

  it("expert campaign: only an ally sharing a trait with the hero side is offered, though Peter Parker is up", () => {
    // Spider-Man's hero side is [AVENGER]; Peter Parker's side is [GENIUS]. Hawkeye 01066 is an [AVENGER] ally.
    const HAWKEYE = "01066";
    const created = rhino({ deck: [HAWKEYE], instructions: [allySearchInstruction({ sharesTraitWithHero: true })] });
    const identity = created.cardPool[playerOf(created, P1).identity.cardId]!;
    if (identity.type !== "hero_identity") throw new Error("not an identity");
    expect(playerOf(created, P1).identity.form).toBe("alterEgo");
    expect(identity.alterEgo.traits.some((t) => identity.hero.traits.includes(t))).toBe(false);
    const search = created.pendingChoice!;
    expect(search.prompt.kind).toBe("chooseCards");
    const offered = search.options.map((o) => created.cardPool[created.instances[o.optionId as InstanceId]!.cardId]!);
    expect(offered.map((card) => card.id)).toContain(HAWKEYE);
    for (const card of offered) {
      expect(card.type).toBe("ally");
      expect(("traits" in card ? card.traits : []).some((t) => identity.hero.traits.includes(t))).toBe(true);
    }
    // Fewer than every ally of the deck: the Justice precon's other allies are no Avengers.
    const allies = playerOf(created, P1).deck.filter((id) => typeOf(created, id) === "ally");
    expect(search.options.length).toBeLessThan(allies.length);
  });

  it("expert campaign, a deck whose allies share no trait with the hero: nothing found, nobody asked, 6 drawn", () => {
    const sharesNone = (card: AnyCard): boolean =>
      card.type !== "ally" || !card.traits.some((t) => (t as string) === "AVENGER");
    const created = rhino({ keep: sharesNone, instructions: [allySearchInstruction({ sharesTraitWithHero: true })] });
    expect(playerOf(created, P1).deck.some((id) => typeOf(created, id) === "ally")).toBe(true);
    expect(created.pendingChoice?.prompt.kind).toBe("mulligan");
    expect(playerOf(created, P1).hand).toHaveLength(6);
    expect(playerOf(created, P1)).not.toHaveProperty("startingHandCredit");
  });

  it("a standalone game of the same scenario: 6 drawn, no search", () => {
    const created = rhino({});
    expect(created.pendingChoice?.prompt.kind).toBe("mulligan");
    expect(playerOf(created, P1).hand).toHaveLength(6);
  });
});

describe("§3.43 scenario 5: 'Professor X cannot enter play during this game' (MC45 p. 20)", () => {
  const INTO = { scenarioPlayArea: MISSION_AREA } as const;
  const X23 = "45012";
  /** Spider-Man in hero form at his first turn, the mission in play, both printings of Professor X in hand. */
  function table(rules: readonly RuleSpec[]) {
    const game = toFirstTurn(rhino({ deck: [...PROFESSOR_X, X23, MAKE_THE_CALL], rules, mission: true }));
    const { state, ids } = moveToHand(game, P1, ...PROFESSOR_X, X23, MAKE_THE_CALL);
    const hero = driveEventsPicking(DEPS, state, firstLegal, toHero(P1)).state;
    const [mutGen, gambit, x23, call] = ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    return { state: hero, professors: [mutGen, gambit] as const, x23, call };
  }
  const playEntry = (state: GameState, id: InstanceId) => {
    const listed = legalActions(state, P1, DEPS);
    if (listed.kind !== "turn") throw new Error(listed.kind);
    return {
      legal: listed.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === id),
      illegal: listed.illegal.find((a) => a.action.kind === "playCard" && a.action.instanceId === id),
    };
  };
  const payment = (state: GameState, except: readonly InstanceId[], count: number): InstanceId[] =>
    playerOf(state, P1)
      .hand.filter((id) => !except.includes(id))
      .slice(0, count);

  it("in hand, either printing is not a legal play to his own area or to the mission, and the refusal costs nothing", () => {
    const { state, professors, x23, call } = table([PROFESSOR_X_CANNOT_ENTER_PLAY]);
    for (const professor of professors) {
      expect(playEntry(state, professor).legal).toBeUndefined();
      const pay = payment(state, [...professors, x23, call], 3);
      for (const into of [false, true]) {
        const command = play(P1, professor, pay);
        const result = sessionApply(
          startSession(state),
          into && command.type === "playCard" ? { ...command, into: INTO } : command,
          DEPS,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toBe("Professor X cannot enter play during this game");
      }
    }
    // Another ally still has both places.
    expect(playEntry(state, x23).legal?.destinations).toEqual([MISSION_AREA]);
  });

  it("spent as a resource, he works: both printings help pay for X-23", () => {
    const { state, professors, x23, call } = table([PROFESSOR_X_CANNOT_ENTER_PLAY]);
    const third = payment(state, [...professors, x23, call], 1);
    const after = driveEventsPicking(DEPS, state, firstLegal, play(P1, x23, [...professors, ...third])).state;
    expect(locateCard(after, x23)).toMatchObject({ kind: "playArea" });
    for (const professor of professors) expect(playerOf(after, P1).discard).toContain(professor);
  });

  it("Make the Call cannot choose him from a discard pile, and is not charged for the refusal", () => {
    const { state, professors, x23, call } = table([PROFESSOR_X_CANNOT_ENTER_PLAY]);
    const [professor] = professors;
    const discarded: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((id) => id !== professor), discard: [professor, ...p.discard] }
          : p,
      ),
    };
    const pay = payment(discarded, [...professors, x23, call], 3);
    const result = sessionApply(
      startSession(discarded),
      play(P1, call, pay, { costChoices: { ally: [professor] } }),
      DEPS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("Professor X cannot enter play during this game");
    expect(playerOf(discarded, P1).hand).toContain(call);
    const entry = playEntry(discarded, call);
    const listed = entry.legal ?? entry.illegal;
    expect(listed && "targets" in listed ? listed.targets : []).not.toContain(professor);
  });

  it("the same deck in scenario 4 (no such rule): playable to either place", () => {
    const { state, professors } = table([]);
    for (const professor of professors) {
      expect(playEntry(state, professor).legal?.destinations).toEqual([MISSION_AREA]);
    }
    const [professor] = professors;
    const pay = payment(state, [...professors], 3);
    const after = driveEventsPicking(DEPS, state, firstLegal, play(P1, professor, pay)).state;
    expect(locateCard(after, professor)).toMatchObject({ kind: "playArea" });
  });
});

describe("§3.46 scenario 3 in a campaign: the Prelate that is the drawn Overseer's other face (MC45 p. 14, Q21 = A)", () => {
  const PRELATES = ["45179b", "45180b", "45181b", "45182b", "45183b"];
  const SEAT = { starterDeckId: "bishop-leadership" } as const;
  const codes = (state: GameState, ids: readonly InstanceId[]): string[] =>
    ids.map((id) => state.instances[id]!.cardId as string).sort();
  /** Every Prelate of the game, by where it is. */
  const prelates = (state: GameState) => {
    const where = (code: string) => instancesOf(state, code).map((id) => locateCard(state, id)?.kind);
    return Object.fromEntries(PRELATES.map((code) => [code, where(code)]));
  };

  /** The Apocalypse scenario; in a campaign, `overseer` is the Overseer drawn for this game. */
  function apocalypse(overseer?: string, seed = 1): GameState {
    const config: GameSetupConfig = wave8Scenario("apocalypse", { players: [SEAT], seed });
    const campaign: CampaignGameInput | undefined =
      overseer === undefined
        ? undefined
        : {
            campaignId: campaignId("aoa"),
            nodeId: "apocalypse",
            definitionVersion: "test",
            modes: { campaign: { campaignId: campaignId("aoa") } },
            log: { shared: {}, perSeat: [{ seatNumber: 1, fields: {} }] },
            instructions: [
              {
                instructionId: "aoa.apocalypse.prelate",
                text: "The Prelate on the reverse of the Overseer in play is not available in this game.",
                citation: "MC45 p. 14",
                window: "beforeScenarioSetup",
                effects: removeOverseersPrelate(printed(overseer)),
              },
            ],
            removedFromCampaign: [],
            seats: [
              {
                seatNumber: 1,
                identityCardId: config.players[0]!.identityCardId,
                deck: [...config.players[0]!.deck],
                aspects: [],
                grantedCardIds: [],
              },
            ],
            seed: 99,
            setAsideCards: [cardId(overseer)],
          };
    const created = createGame(
      {
        ...config,
        cards: [...new Map([...config.cards, ...POOL].map((card) => [card.id, card])).values()],
        requireLegalDecks: false,
        ...(campaign ? { campaign } : {}),
      },
      DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    return toFirstTurn(created.state);
  }

  it("standalone: five Prelates, one revealed by the 1A Setup and four set aside", () => {
    const state = apocalypse();
    expect(state.removedFromGame).toEqual([]);
    const setAside = codes(state, state.encounterSetAside).filter((code) => PRELATES.includes(code));
    expect(setAside).toHaveLength(4);
  });

  it("Sugar Man drawn as the Overseer: 45182b is removed from the game before the 1A Setup, one of the other four is revealed and three stay set aside", () => {
    const state = apocalypse(SUGAR_MAN);
    expect(codes(state, state.removedFromGame)).toEqual(["45182b"]);
    const setAside = codes(state, state.encounterSetAside).filter((code) => PRELATES.includes(code));
    expect(setAside).toHaveLength(3);
    expect(setAside).not.toContain("45182b");
    // The Overseer itself is a separate card of this game, untouched.
    expect(instancesOf(state, SUGAR_MAN)).toHaveLength(1);
    // Whatever the seed, the 1A Setup never reveals the Overseer's own Prelate.
    for (const seed of [2, 3, 4, 5, 6, 7, 8]) {
      expect(prelates(apocalypse(SUGAR_MAN, seed))["45182b"]).toEqual(["removedFromGame"]);
    }
  });

  it("Abyss drawn instead (Sugar Man struck from the log, or a retry that drew again): 45181b is removed and 45182b is in the game", () => {
    const state = apocalypse(ABYSS);
    expect(codes(state, state.removedFromGame)).toEqual(["45181b"]);
    expect(prelates(state)["45182b"]).not.toEqual(["removedFromGame"]);
    expect(instancesOf(state, "45182b")).toHaveLength(1);
  });
});
