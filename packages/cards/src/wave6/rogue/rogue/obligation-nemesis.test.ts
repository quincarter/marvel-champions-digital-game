import { cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  activeVillain,
  cardsInPlay,
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
  instancesOf,
  mainThreat,
  P1,
  P2,
  patchInstance,
  playerOf,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea, stackSetAside, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { ROGUE_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { rogueGame } from "./support.js";

const DEPS = WAVE6_DEPS;
const ADVANCE = "01186";
const ONE_ICON = "01188"; // Caught Off Guard: 1 boost icon
const FILLER = "01187";
const DEADLY_TOUCH = "38024";
const MYSTIQUE = "38025";
const MANIPULATIONS = "38026";
const MISLED = "38027";
const SKIN = "38001a.skin-contact";
const MERCENARY = "01101";
const DEADLY_REF = "38024.obligation";
const MYSTIQUE_FR = "38025.mystique-forced-response";
const MANIPULATIONS_REF = "38026.when-defeated";
const MISLED_WR = "38027.when-revealed";
const MISLED_FR = "38027.misled-forced-response";
const REFS = [DEADLY_REF, MYSTIQUE_FR, MANIPULATIONS_REF, MISLED_WR, MISLED_FR] as const;

/** Applies `command`, answering every choice with `pick`; the log replays to the same state. */
function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 200) throw new Error(`choices did not settle (${session.state.pendingChoice.prompt.kind})`);
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

const SECOND = [{ starterDeckId: "core-spider-man-justice" }];
const heroGame = (extra: typeof SECOND = []): GameState =>
  withForm(rogueGame("rhino", { seed: 1, extraPlayers: extra }), { heroForm: 0 });
const villainOf = (state: GameState): InstanceId => activeVillain(state)!.instanceId;
const rogueOf = (state: GameState): InstanceId => identityOf(state, P1);
const stunned = (state: GameState): GameState =>
  patchInstance(state, villainOf(state), { statuses: { ...inst(state, villainOf(state)).statuses, stunned: 1 } });
const resolved = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));
const inPlayIds = (state: GameState, code: string): InstanceId[] =>
  instancesOf(state, code).filter((id) => cardsInPlay(state).includes(id));
const damageOn = (state: GameState, id: InstanceId): number => inst(state, id).damage;
const encounterPiles = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!;
const setAsideCopies = (state: GameState, code: string, player = P1) =>
  playerOf(state, player).setAside.filter((i) => inst(state, i).cardId === cardId(code));
const deckCopies = (state: GameState, code: string, player = P1) =>
  playerOf(state, player).deck.filter((i) => inst(state, i).cardId === cardId(code));

/** Picks `wanted` when a prompt offers it (recording what was offered); anything else as `firstLegal`. */
const choosing =
  (wanted: readonly InstanceId[], offered: string[][] = []): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice && choice.prompt.kind !== "chooseTriggers" && choice.options.some((o) => o.ref.kind === "card")) {
      offered.push(choice.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId as string] : [])));
      const hit = choice.options.find((o) => o.ref.kind === "card" && wanted.includes(o.ref.instanceId as InstanceId));
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };

/** Skin Contact: Touched onto `host` (Rogue's own action). */
const touchOnto = (state: GameState, host: InstanceId): GameState =>
  drive(state, use(P1, rogueOf(state), SKIN), choosing([host])).state;

/** `code` revealed by P1 in the villain phase (the villain stunned, so hero form draws no boost for an attack). */
function reveal(game: GameState, code: string, pick: Picker = firstLegal, fillers = 0) {
  const staged = stackEncounterDeck(
    stackSetAside(stunned(game), code),
    ...Array.from({ length: fillers }, () => ADVANCE),
    code,
  );
  const { state, events } = drive(staged, endTurn(P1), pick);
  return { state, events, ids: instancesOf(state, code) };
}
/** The Deadly Touch obligation is in the encounter deck: stacked on top (the stunned villain draws no boost in hero form). */
function revealDeadlyTouch(game: GameState) {
  const staged =
    game.players.length > 1
      ? // The villain's stun is spent on P1; it attacks P2 and draws a boost card first, and P2 is dealt a card after P1.
        stackEncounterDeck(stunned(game), ONE_ICON, DEADLY_TOUCH, FILLER)
      : stackEncounterDeck(stunned(game), DEADLY_TOUCH);
  const first = drive(staged, endTurn(P1));
  // With a second player, the phase waits for their turn to end too.
  const second =
    first.state.step.phase === "player" && first.state.step.kind === "turn" && first.state.step.activePlayerId === P2
      ? drive(first.state, endTurn(P2))
      : { ...first, events: [] };
  return {
    state: second.state,
    events: [...first.events, ...second.events],
    id: instancesOf(first.state, DEADLY_TOUCH)[0]!,
  };
}
/** An ally (Spider-Woman, 01011) of P1's by surgery: the first deck card, in the play area. */
function withAlly(state: GameState): { state: GameState; id: InstanceId } {
  const id = playerOf(state, P1).deck[0]!;
  const patched = patchInstance(state, id, { cardId: cardId("01011"), controllerId: P1, faceup: true });
  return {
    id,
    state: {
      ...patched,
      players: patched.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}

describe("Rogue's obligation and nemesis set (38024-38027)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(ROGUE_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
    for (const definition of Object.values(ROGUE_OBLIGATION_NEMESIS))
      expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Deadly Touch (38024)", () => {
    const damageFrom = (events: readonly GameEvent[], source: InstanceId) =>
      events.flatMap((e) => (e.type === "damageDealt" && e.sourceInstanceId === source ? [e] : []));
    const threatFrom = (events: readonly GameEvent[], source: InstanceId) =>
      events.flatMap((e) => (e.type === "threatPlaced" && e.sourceInstanceId === source ? [e] : []));

    it("38024.obligation: Touched on an ally: that ally (not Rogue) takes 2 damage", () => {
      const ally = withAlly(heroGame());
      const touched = touchOnto(ally.state, ally.id);
      const { state, events, id } = revealDeadlyTouch(touched);
      expect(damageFrom(events, id)).toEqual([expect.objectContaining({ targetInstanceId: ally.id, amount: 2 })]);
      expect(damageOn(state, rogueOf(state))).toBe(damageOn(touched, rogueOf(touched)));
      expect(threatFrom(events, id)).toEqual([]);
    });

    it("38024.obligation: Touched on another player's hero (a friendly character): that hero takes 2 damage", () => {
      const game = withForm(heroGame(SECOND), { heroForm: 0 }, P2);
      const p2 = identityOf(game, P2);
      const touched = touchOnto(game, p2);
      const { events, id } = revealDeadlyTouch(touched);
      expect(damageFrom(events, id)).toEqual([expect.objectContaining({ targetInstanceId: p2, amount: 2 })]);
      expect(threatFrom(events, id)).toEqual([]);
    });

    it("38024.obligation: Touched on an enemy: 2 threat on the main scheme and no damage from the card", () => {
      const minion = engageMinion(heroGame(), MERCENARY, P1);
      const touched = touchOnto(minion.state, minion.id);
      const { state, events, id } = revealDeadlyTouch(touched);
      expect(threatFrom(events, id)).toEqual([
        expect.objectContaining({ schemeInstanceId: state.mainScheme.instanceId, amount: 2 }),
      ]);
      expect(damageFrom(events, id)).toEqual([]);
      expect(encounterPiles(state).discard).toContain(id);
    });

    it("38024.obligation: Touched set aside (attached to nothing): 2 threat on the main scheme, no damage", () => {
      const { state, events, id } = revealDeadlyTouch(heroGame());
      expect(resolved(events)).toContain(DEADLY_REF);
      expect(threatFrom(events, id)).toEqual([
        expect.objectContaining({ schemeInstanceId: state.mainScheme.instanceId, amount: 2 }),
      ]);
      expect(damageFrom(events, id)).toEqual([]);
      expect(encounterPiles(state).discard).toContain(id);
    });
  });

  describe("Mystique (38025)", () => {
    it("is revealed from the set-aside nemesis cards and engages Rogue", () => {
      const { state, ids } = reveal(heroGame(), MYSTIQUE);
      expect(ids).toHaveLength(1);
      expect(inst(state, ids[0]!).engagedWith).toBe(P1);
    });

    it("38025.mystique-forced-response: searches the set-aside area for a Misled and shuffles it into your deck", () => {
      const game = heroGame();
      const copies = setAsideCopies(game, MISLED);
      expect(copies).toHaveLength(3);
      const decked = deckCopies(game, MISLED).length;
      const offered: string[][] = [];
      const { state, events } = reveal(game, MYSTIQUE, choosing([copies[1]!], offered));
      expect(resolved(events)).toContain(MYSTIQUE_FR);
      expect(offered.flat()).toEqual(expect.arrayContaining(copies));
      expect(deckCopies(state, MISLED)).toEqual([copies[1]]);
      expect(deckCopies(state, MISLED).length).toBe(decked + 1);
      expect(setAsideCopies(state, MISLED)).toHaveLength(2);
    });

    it("38025.mystique-forced-response: also finds a Misled in the encounter deck or its discard pile", () => {
      const game = heroGame();
      const [inDeck, inDiscard] = setAsideCopies(game, MISLED) as [InstanceId, InstanceId];
      const deckId = activeEncounterDeckId(game);
      const piles = encounterPiles(game);
      const moved: GameState = {
        ...game,
        players: game.players.map((p) =>
          p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== inDeck && i !== inDiscard) } : p,
        ),
        encounterDecks: {
          ...game.encounterDecks,
          [deckId]: { deck: [...piles.deck, inDeck], discard: [...piles.discard, inDiscard] },
        },
      };
      const offered: string[][] = [];
      const { state } = reveal(moved, MYSTIQUE, choosing([inDiscard], offered));
      expect(offered.flat()).toEqual(expect.arrayContaining([inDeck, inDiscard]));
      expect(deckCopies(state, MISLED)).toEqual([inDiscard]);
    });
  });

  describe("Mystique's Manipulations (38026, RRG 1.8 erratum p. 69)", () => {
    const inVillainArea = (game: GameState, threat: number) =>
      encounterCardInVillainArea(stackSetAside(game, MANIPULATIONS), MANIPULATIONS, threat);
    /** `thwarter` removes the scheme's last threat (basic thwart), choosing `wanted` at any search prompt. */
    const defeat = (
      state: GameState,
      scheme: InstanceId,
      thwarter: typeof P1,
      wanted: InstanceId[],
      seen: string[][],
    ) => {
      const command = {
        type: "basicThwart",
        playerId: thwarter,
        thwarterInstanceId: identityOf(state, thwarter),
        schemeInstanceId: scheme,
      } as unknown as Command;
      return drive(state, command, choosing(wanted, seen));
    };
    /** A Misled moved from the set-aside area into the encounter deck, so the search can find it. */
    const misledInDeck = (game: GameState, count = 1): { state: GameState; ids: InstanceId[] } => {
      const ids = setAsideCopies(game, MISLED).slice(0, count);
      const deckId = activeEncounterDeckId(game);
      const piles = encounterPiles(game);
      return {
        ids,
        state: {
          ...game,
          players: game.players.map((p) =>
            p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => !ids.includes(i)) } : p,
          ),
          encounterDecks: { ...game.encounterDecks, [deckId]: { ...piles, deck: [...piles.deck, ...ids] } },
        },
      };
    };

    it("38026.when-defeated: the defeating player searches the encounter deck and discard pile and shuffles a Misled into their deck", () => {
      const withMisled = misledInDeck(heroGame());
      const scheme = inVillainArea(withMisled.state, 1);
      const seen: string[][] = [];
      const { state, events } = defeat(scheme.state, scheme.id, P1, withMisled.ids, seen);
      expect(resolved(events)).toContain(MANIPULATIONS_REF);
      expect(deckCopies(state, MISLED)).toEqual(withMisled.ids);
      expect(encounterPiles(state).deck).not.toContain(withMisled.ids[0]);
    });

    it("38026.when-defeated: with two players, the player who defeated it (not the first player) gets the card", () => {
      const game = withForm(heroGame(SECOND), { heroForm: 0 }, P2);
      const withMisled = misledInDeck(game);
      const scheme = inVillainArea(withMisled.state, 1);
      const p2Turn: GameState = {
        ...scheme.state,
        step: { phase: "player", kind: "turn", activePlayerId: P2, remainingPlayerIds: [] },
      };
      const { state } = defeat(p2Turn, scheme.id, P2, withMisled.ids, []);
      expect(deckCopies(state, MISLED, P2)).toEqual(withMisled.ids);
      expect(deckCopies(state, MISLED, P1)).toEqual([]);
    });

    it("38026.when-defeated: a Misled still set aside is not found (the text names only the deck and discard pile)", () => {
      const game = heroGame();
      const scheme = inVillainArea(game, 1);
      const { state } = defeat(scheme.state, scheme.id, P1, [], []);
      expect(deckCopies(state, MISLED)).toEqual([]);
      expect(setAsideCopies(state, MISLED)).toHaveLength(3);
    });
  });

  describe("Misled (38027, x3)", () => {
    it("38027.when-revealed: shuffles itself into the revealing player's deck and gains surge", () => {
      const { state, events, ids } = reveal(heroGame(), MISLED);
      expect(resolved(events)).toContain(MISLED_WR);
      expect(ids.filter((i) => playerOf(state, P1).deck.includes(i))).toHaveLength(1);
      expect(events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
      expect(inPlayIds(state, MISLED)).toEqual([]);
    });

    it("38027.misled-forced-response: drawn in a plain Rogue game, it stays in your hand and 2 threat goes on the main scheme", () => {
      // No Mystique modular set and no `staysInHand` rule: its own "after this card enters your hand" keeps it in the
      // hand (docs/phase7-wave6.md §3.10), not the wave 5 §4.1 Q4 fallback (dealt facedown, draw 1).
      const game = heroGame();
      expect(game.scenarioRules.rules ?? []).toEqual([]);
      const id = setAsideCopies(game, MISLED)[0]!;
      const base: GameState = {
        ...game,
        players: game.players.map((p) =>
          p.playerId === P1
            ? { ...p, setAside: p.setAside.filter((i) => i !== id), hand: [], deck: [id, ...p.deck] }
            : p,
        ),
      };
      const threat = mainThreat(base);
      const { state, events } = drive(patchInstance(base, id, { faceup: false }), endTurn(P1));
      expect(playerOf(state, P1).hand).toContain(id);
      expect(events.some((e) => e.type === "cardMoved" && e.instanceId === id && e.to.kind === "dealtEncounter")).toBe(
        false,
      );
      expect(resolved(events)).toContain(MISLED_FR);
      expect(mainThreat(state)).toBeGreaterThanOrEqual(threat + 2);
      expect(
        events.filter(
          (e) => e.type === "threatPlaced" && e.schemeInstanceId === state.mainScheme.instanceId && e.amount === 2,
        ),
      ).toHaveLength(1);
    });
  });

  it("P2 exists only in the two-player cases", () => {
    expect(heroGame(SECOND).players.map((p) => p.playerId)).toEqual([P1, P2]);
  });
});
