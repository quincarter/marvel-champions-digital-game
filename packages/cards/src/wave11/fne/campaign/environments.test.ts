import { PLAYABLE_CARDS, campaignId, cardId } from "@mc/content";
import type { PlayModes } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  cardOf,
  cardsInPlay,
  createGame,
  type CampaignGameInput,
  type EffectSpec,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario } from "../../../core/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import { chosen, encounterSetAside, firstPlayer, putIntoPlay, query, selectCards } from "../../../dsl/index.js";
import {
  P1,
  P2,
  P3,
  endTurn,
  firstLegal,
  use,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  type Picker,
} from "../../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, moveToDiscard, withForm } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_CAMPAIGN_ENVIRONMENTS as REGISTRY, FNE_CAMPAIGN_ENVIRONMENTS_SKIPPED as SKIPPED } from "./environments.js";

vi.setConfig({ testTimeout: 240_000 });

const MUSEUM = "60205";
const GETAWAY = "60206";
const RACKET = "60207";
const RAFT = "60208";
const PRESSES = "60209";
const REFS = [
  "60205a.setup",
  "60205b.setup",
  "60206a.setup",
  "60206b.the-getaway-constant",
  "60206b.setup",
  "60207a.setup",
  "60207b.setup",
  "60208a.setup",
  "60208b.setup",
  "60209a.setup",
  "60209b.setup",
];
const ENVIRONMENTS = [MUSEUM, GETAWAY, RACKET, RAFT, PRESSES].map((code) => `${code}a`);

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const idsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((i) => codeOf(s, i) === code);
const hand = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).hand.map((i) => codeOf(s, i));
const discard = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((i) => codeOf(s, i));
const statuses = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).statuses;
const encounterDeckCodes = (s: GameState): string[] => activeEncounterDeck(s).deck.map((i) => codeOf(s, i));
const dealtTo = (s: GameState, p: PlayerId): string[] => playerOf(s, p).dealtEncounter.map((i) => codeOf(s, i));
const inPlayCodes = (s: GameState): string[] => cardsInPlay(s).map((i) => codeOf(s, i));

const SEATS = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
  { starterDeckId: "core-black-panther-protection" },
];

const STANDARD: PlayModes = { campaign: { campaignId: campaignId("fne-test") } };
const EXPERT: PlayModes = { campaign: { campaignId: campaignId("fne-test") }, expert: true };

interface Options {
  readonly players?: 1 | 2 | 3;
  readonly expert?: boolean;
  /** Environment cards (`60205a`) the campaign sets aside and puts into play together. */
  readonly envs: readonly { readonly id: string; readonly failed?: boolean }[];
  /** Further cards set aside (the Raft Breakout minions, the Daily Bugle supports). */
  readonly setAside?: readonly string[];
  /** Cards added to the encounter deck. */
  readonly encounterDeck?: readonly string[];
  /** Edits the state while it waits at the first mulligan: hands and piles are dealt, the afterMulligans window is not. */
  readonly prep?: (s: GameState) => GameState;
  readonly pick?: Picker;
  readonly seed?: number;
}

/**
 * Core Spider-Man (Captain Marvel, Black Panther) against Rhino, in a campaign game whose `afterMulligans` instruction
 * does what MC60 p. 9 step 12 does: set the environments aside, put each into play on its face, resolve its Setup.
 */
function newGame(o: Options): { state: GameState; events: GameEvent[]; asked: string[] } {
  const players = o.players ?? 1;
  const modes = o.expert ? EXPERT : STANDARD;
  const base = coreScenario("rhino", {
    players: SEATS.slice(0, players),
    seed: o.seed ?? 1,
    modes,
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const instructions = o.envs.flatMap((env, index) => {
    const effects: EffectSpec[] = [
      selectCards(`env${index}`, encounterSetAside(query("environment", { name: data(env.id).name }))),
      putIntoPlay(chosen(`env${index}`), firstPlayer, { otherFace: !!env.failed, resolveSetup: true }),
    ];
    return [
      {
        instructionId: `fne.env${index}`,
        text: "env",
        citation: "MC60 p. 9",
        window: "afterMulligans" as const,
        effects,
      },
    ];
  });
  const campaign: CampaignGameInput = {
    campaignId: campaignId("fne-test"),
    nodeId: "node",
    definitionVersion: "1",
    modes,
    log: { shared: {}, perSeat: [] },
    instructions,
    removedFromCampaign: [],
    seats: base.players.map((p, index) => ({
      seatNumber: index + 1,
      identityCardId: p.identityCardId,
      deck: p.deck,
      aspects: p.aspects ?? [],
      grantedCardIds: [],
    })),
    seed: 99,
    setAsideCards: o.envs.map((env) => data(env.id).id),
  } as CampaignGameInput;
  const created = createGame(
    {
      ...base,
      cards: [...(base.cards ?? []), ...WAVE11_CARDS],
      setAside: [...(base.setAside ?? []), ...(o.setAside ?? []).map((id) => data(id).id)],
      encounterDeck: [...base.encounterDeck, ...(o.encounterDeck ?? []).map(cardId)],
      campaign,
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const prepped = o.prep ? o.prep(created.state) : created.state;
  const asked: string[] = [];
  const pick = o.pick ?? firstLegal;
  const run = driveEventsPicking(WAVE11_DEPS, prepped, (s) => {
    asked.push(s.pendingChoice!.prompt.kind);
    return pick(s);
  });
  return { state: run.state, events: [...created.events, ...run.events], asked };
}

describe("registry", () => {
  it("registers every printed ref of the five environments' faces; nothing is skipped", () => {
    const printed = ENVIRONMENTS.flatMap((c) => abilityRefIds(data(c))).sort();
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("Art Museum Heist 60205", () => {
  it("60205a.setup: gives each identity a tough status card (two players)", () => {
    const { state } = newGame({ players: 2, envs: [{ id: "60205a" }] });
    expect(inPlayCodes(state)).toContain("60205a");
    expect(statuses(state, P1).tough).toBe(1);
    expect(statuses(state, P2).tough).toBe(1);
  });
  it("60205a.setup: gives nothing to the villain, and one tough card each in a solo game", () => {
    const { state } = newGame({ envs: [{ id: "60205a" }] });
    expect(statuses(state, P1).tough).toBe(1);
    expect(inst(state, state.activeVillainId!).statuses.tough).toBe(0);
  });
});

/** The first option of the pending choice whose label contains one of `texts`, tried in order; else the first legal answer. */
const labelled =
  (...texts: readonly string[]): Picker =>
  (s) => {
    const options = s.pendingChoice!.options;
    for (const text of texts) {
      const hit = options.find((o) => o.label.includes(text));
      if (hit) return [hit.optionId];
    }
    return firstLegal(s);
  };
/** Each player's own answer: `{ p1: ["Stun"], p2: ["Confuse"] }`. */
const perPlayer =
  (answers: Record<string, readonly string[]>): Picker =>
  (s) =>
    labelled(...(answers[s.pendingChoice!.playerId as string] ?? []))(s);

describe("Art Museum Heist, Failed 60205b", () => {
  it("60205b.setup: each player chooses to stun or confuse their identity (standard mode, two players)", () => {
    const { state } = newGame({
      players: 2,
      envs: [{ id: "60205a", failed: true }],
      pick: perPlayer({ p1: ["Stun"], p2: ["Confuse"] }),
    });
    expect(inPlayCodes(state)).toContain("60205a");
    expect(inst(state, idsOf(state, "60205a")[0]!).flipped).toBe(true);
    expect([statuses(state, P1).stunned, statuses(state, P1).confused]).toEqual([1, 0]);
    expect([statuses(state, P2).stunned, statuses(state, P2).confused]).toEqual([0, 1]);
  });
  it("60205b.setup: in expert mode both, and nothing is asked", () => {
    const { state, asked } = newGame({ players: 2, expert: true, envs: [{ id: "60205a", failed: true }] });
    for (const p of [P1, P2]) expect([statuses(state, p).stunned, statuses(state, p).confused]).toEqual([1, 1]);
    expect(asked.filter((kind) => kind !== "mulligan")).toEqual([]);
  });
});

const TYPE_OF = new Map((PLAYABLE_CARDS as readonly any[]).map((c) => [c.id as string, c.type as string]));
/** Surgery at the first mulligan: every card of `type` in the player's deck and discard pile is taken out of the game. */
const withoutCards =
  (type: string, player: PlayerId = P1) =>
  (s: GameState): GameState => {
    const owner = playerOf(s, player);
    const gone = [...owner.deck, ...owner.discard].filter((i) => TYPE_OF.get(codeOf(s, i)) === type);
    return {
      ...s,
      removedFromGame: [...s.removedFromGame, ...gone],
      players: s.players.map((p) =>
        p.playerId === player
          ? { ...p, deck: p.deck.filter((i) => !gone.includes(i)), discard: p.discard.filter((i) => !gone.includes(i)) }
          : p,
      ),
    };
  };
/** Surgery: `code` (from the player's hand or deck) is in their discard pile. */
const inDiscardPile =
  (code: string, player: PlayerId = P1) =>
  (s: GameState): GameState =>
    moveToDiscard(s, player, code).state;
const compose =
  (...steps: ((s: GameState) => GameState)[]) =>
  (s: GameState) =>
    steps.reduce((acc, f) => f(acc), s);
const shuffles = (events: readonly GameEvent[], s: GameState, player: PlayerId): number =>
  ofType(events, "deckShuffled").filter((e) => e.order.every((i) => playerOf(s, player).deck.includes(i))).length;

/**
 * The three optional searches (The Getaway: upgrade; Protection Racket: support; The Raft Breakout: ally). Spider-Man's
 * Core deck holds 01093 Tenacity (upgrade), 01063 Interrogation Room (support) and 01084 Nick Fury (ally); the test
 * moves the one it wants found into the discard pile, so the search must look there as well as in the deck.
 */
describe.each([
  { env: "60206a", noun: "upgrade", target: "01093" },
  { env: "60207a", noun: "support", target: "01063" },
  { env: "60208a", noun: "ally", target: "01084" },
])("$env: search for $noun", ({ env, noun, target }) => {
  const SEARCH = "Search";
  const DECLINE = "Do not search";
  /** Searches, then takes the copy of `code` that is in the discard pile (surgery put it there). */
  const finding =
    (code: string): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseCards") {
        const pile = playerOf(s, choice.playerId).discard;
        const hit = choice.options.find(
          (o) => pile.includes(o.optionId as InstanceId) && codeOf(s, o.optionId as InstanceId) === code,
        );
        if (hit) return [hit.optionId];
      }
      return labelled(SEARCH)(s);
    };
  const staged = inDiscardPile(target);

  it(`${env}.setup: a player searches their discard pile for the ${noun} and adds it to their hand (standard mode: no discard)`, () => {
    const baseline = newGame({ envs: [], prep: staged });
    const { state, events } = newGame({ envs: [{ id: env }], prep: staged, pick: finding(target) });
    expect(hand(state)).toContain(target);
    expect(discard(state)).not.toContain(target);
    expect(hand(state)).toHaveLength(hand(baseline.state).length + 1);
    expect(shuffles(events, state, P1)).toBeGreaterThanOrEqual(1);
  });

  it(`${env}.setup: "may": a player who declines adds nothing, and the deck is not shuffled`, () => {
    const baseline = newGame({ envs: [], prep: staged });
    const { state, events } = newGame({ envs: [{ id: env }], prep: staged, pick: labelled(DECLINE) });
    expect(hand(state)).toEqual(hand(baseline.state));
    expect(discard(state)).toContain(target);
    expect(shuffles(events, state, P1)).toBe(0);
  });

  it(`${env}.setup: in expert mode a player who added a card discards 1 card from their hand`, () => {
    const standard = newGame({ envs: [{ id: env }], prep: staged, pick: finding(target) });
    const { state } = newGame({ envs: [{ id: env }], prep: staged, expert: true, pick: finding(target) });
    expect(hand(state)).toHaveLength(hand(standard.state).length - 1);
    expect(discard(state)).toHaveLength(discard(standard.state).length + 1);
  });

  it(`${env}.setup: in expert mode a player who declines, or who finds no ${noun}, discards nothing`, () => {
    const baseline = newGame({ envs: [], expert: true, prep: staged });
    const declined = newGame({ envs: [{ id: env }], expert: true, prep: staged, pick: labelled(DECLINE) });
    expect(hand(declined.state)).toEqual(hand(baseline.state));
    expect(discard(declined.state)).toEqual(discard(baseline.state));
    const none = withoutCards(noun);
    const emptyBaseline = newGame({ envs: [], expert: true, prep: none });
    const empty = newGame({ envs: [{ id: env }], expert: true, prep: none, pick: labelled(SEARCH) });
    expect(hand(empty.state)).toEqual(hand(emptyBaseline.state));
    expect(discard(empty.state)).toEqual(discard(emptyBaseline.state));
  });

  it(`${env}.setup: each player decides for themself (three players: first and third search, second declines)`, () => {
    const baseline = newGame({ players: 3, expert: true, envs: [], prep: compose(inDiscardPile(target, P1)) });
    const { state } = newGame({
      players: 3,
      expert: true,
      envs: [{ id: env }],
      prep: compose(inDiscardPile(target, P1)),
      pick: (s) => (s.pendingChoice!.playerId === "p1" ? finding(target)(s) : labelled(DECLINE)(s)),
    });
    expect(hand(state, P1)).toContain(target);
    expect(hand(state, P1)).toHaveLength(hand(baseline.state, P1).length);
    expect(hand(state, P2)).toEqual(hand(baseline.state, P2));
    expect(hand(state, P3)).toEqual(hand(baseline.state, P3));
  });
});

const typeOf = (s: GameState, id: InstanceId): string => cardOf(s, id)!.type;
const attachmentsIn = (s: GameState, ids: readonly InstanceId[]) => ids.filter((i) => typeOf(s, i) === "attachment");
/** Surgery: the encounter deck keeps `keep` of its attachments (the first ones); the rest are out of the game. */
const keepingAttachments =
  (keep: number) =>
  (s: GameState): GameState => {
    const id = activeEncounterDeckId(s);
    const piles = s.encounterDecks[id]!;
    const all = attachmentsIn(s, piles.deck);
    const gone = all.slice(keep);
    return {
      ...s,
      removedFromGame: [...s.removedFromGame, ...gone],
      encounterDecks: { ...s.encounterDecks, [id]: { ...piles, deck: piles.deck.filter((i) => !gone.includes(i)) } },
    };
  };
const attachmentsInDeck = (s: GameState): InstanceId[] => attachmentsIn(s, activeEncounterDeck(s).deck);
const revealedAttachments = (s: GameState): InstanceId[] =>
  attachmentsIn(s, cardsInPlay(s)).filter((i) => inst(s, i).attachedTo !== undefined && inst(s, i).attachedTo !== null);

describe("The Getaway, Failed 60206b", () => {
  const HORN = "01100";

  it("60206b.setup: each player searches the encounter deck for an attachment and reveals it (two players, plenty of attachments)", () => {
    const first = newGame({ players: 2, envs: [{ id: "60206a", failed: true }], encounterDeck: [HORN, HORN] });
    const baseline = newGame({ players: 2, envs: [], encounterDeck: [HORN, HORN] });
    expect(revealedAttachments(first.state)).toHaveLength(revealedAttachments(baseline.state).length + 2);
    expect(attachmentsInDeck(first.state)).toHaveLength(attachmentsInDeck(baseline.state).length - 2);
    expect(dealtTo(first.state, P1)).toEqual([]);
    expect(dealtTo(first.state, P2)).toEqual([]);
    // Deck-searching ends with a shuffle of the encounter deck (RRG 1.8 "Search", p. 39).
    expect(ofType(first.events, "deckShuffled").length).toBeGreaterThan(ofType(baseline.events, "deckShuffled").length);
  });

  it("60206b.setup: a player who could not find an attachment is dealt a facedown encounter card instead", () => {
    // Exactly one attachment left: the first player finds it, the second cannot.
    const { state } = newGame({ players: 2, envs: [{ id: "60206a", failed: true }], prep: keepingAttachments(1) });
    expect(attachmentsInDeck(state)).toHaveLength(0);
    expect(revealedAttachments(state)).toHaveLength(1);
    expect(dealtTo(state, P1)).toEqual([]);
    expect(dealtTo(state, P2)).toHaveLength(1);
  });

  it("60206b.setup: with no attachment left every player is dealt one (three players)", () => {
    const { state } = newGame({ players: 3, envs: [{ id: "60206a", failed: true }], prep: keepingAttachments(0) });
    expect(revealedAttachments(state)).toHaveLength(0);
    for (const p of [P1, P2, P3]) expect(dealtTo(state, p)).toHaveLength(1);
  });

  /** A hero-form first player with the Horn on the villain, and three physical resources to pay its Hero Action with. */
  const physicalPayment = (s: GameState) =>
    playerOf(s, P1)
      .hand.filter((i) => ((cardOf(s, i) as any).resourceIcons?.physical ?? 0) >= 1)
      .slice(0, 3)
      .map((fromHand) => ({ fromHand }));
  const hornOf = (s: GameState): InstanceId => revealedAttachments(s).find((i) => codeOf(s, i) === HORN)!;
  const finding: Picker = (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseCards") {
      const hit = choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === HORN);
      if (hit) return [hit.optionId];
    }
    return firstLegal(s);
  };
  const withHand = (s: GameState): GameState => {
    // Three physical resources in hand: the physical-icon cards of the deck, moved up.
    const owner = playerOf(s, P1);
    const wanted = owner.deck.filter((i) => ((cardOf(s, i) as any).resourceIcons?.physical ?? 0) >= 1).slice(0, 3);
    return {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => !wanted.includes(i)), hand: [...p.hand, ...wanted] } : p,
      ),
    };
  };
  const tryHorn = (s: GameState) => {
    const horn = hornOf(s);
    const ready = withForm(s, { heroForm: 0 });
    const payment = physicalPayment(ready);
    expect(payment).toHaveLength(3);
    return applyCommand(ready, use(P1, horn, "01100.enhanced-ivory-horn-action", payment), WAVE11_DEPS);
  };

  it.each([
    { expert: true, stays: true },
    { expert: false, stays: false },
  ])(
    "60206b.setup: round 1 defeat of a minion holding an attachment (expert $expert): the attachment stays in play $stays",
    ({ expert, stays }) => {
      const { state } = newGame({
        envs: [{ id: "60206a", failed: true }],
        expert,
        encounterDeck: [HORN],
        pick: finding,
      });
      const horn = hornOf(state);
      const hostBefore = inst(state, horn).attachedTo as InstanceId;
      // Surgery: the Horn is on an engaged minion instead of the villain.
      const engaged = engageMinion(state, "60092", "mn");
      const moved = patchInstance(
        patchInstance(engaged, hostBefore, {
          attachments: inst(engaged, hostBefore).attachments.filter((i) => i !== horn),
        }),
        horn,
        { attachedTo: "mn" as InstanceId },
      );
      const withHorn = patchInstance(moved, "mn" as InstanceId, { attachments: [horn] });
      const after = defeatWithAttack(WAVE11_DEPS, withForm(withHorn, { heroForm: 0 }), "mn" as InstanceId);
      expect(cardsInPlay(after).includes("mn" as InstanceId)).toBe(false);
      expect(cardsInPlay(after).includes(horn)).toBe(stays);
      if (stays) expect(inst(after, horn).attachedTo ?? null).toBeNull();
    },
  );

  const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
  const attached = (s: GameState, id: InstanceId) => cardsInPlay(s).includes(id);

  it.each([
    {
      expert: true,
      firstRound: "stays",
      label: "in expert mode no attachment can be discarded from play in the first round",
    },
    { expert: false, firstRound: "goes", label: "in standard mode the constant does not apply" },
  ])("60206b.setup: $label, and from the second round it can", ({ expert, firstRound }) => {
    const { state } = newGame({
      envs: [{ id: "60206a", failed: true }],
      expert,
      encounterDeck: [HORN],
      prep: withHand,
      pick: finding,
    });
    const horn = hornOf(state);
    expect(state.round).toBe(1);
    const first = tryHorn(state);
    if (firstRound === "stays") {
      expect(!first.ok || attached(first.state, horn)).toBe(true);
    } else {
      expect(first.ok).toBe(true);
      if (first.ok) expect(attached(first.state, horn)).toBe(false);
      return;
    }
    // Round 2: the lasting rule ended with the first round.
    const next = driveEventsPicking(WAVE11_DEPS, state, declines, endTurn(P1)).state;
    expect(next.round).toBe(2);
    expect(attached(next, horn)).toBe(true);
    const again = tryHorn(withHand(next));
    expect(again.ok).toBe(true);
    if (again.ok) expect(attached(again.state, horn)).toBe(false);
  });
});

describe("Protection Racket, Failed 60207b", () => {
  it("60207b.setup: each player chooses and discards 1 card from their hand (two players)", () => {
    const base = newGame({ players: 2, envs: [] });
    const { state } = newGame({ players: 2, envs: [{ id: "60207a", failed: true }] });
    for (const p of [P1, P2]) {
      expect(hand(state, p)).toHaveLength(hand(base.state, p).length - 1);
      expect(discard(state, p)).toHaveLength(discard(base.state, p).length + 1);
    }
  });
  it("60207b.setup: 2 cards instead in expert mode", () => {
    const base = newGame({ players: 2, expert: true, envs: [] });
    const { state } = newGame({ players: 2, expert: true, envs: [{ id: "60207a", failed: true }] });
    for (const p of [P1, P2]) expect(hand(state, p)).toHaveLength(hand(base.state, p).length - 2);
  });
});

describe("The Raft Breakout, Failed 60208b", () => {
  const MINIONS = ["60144", "60145", "60146", "60147", "60148", "60149"];
  const stage = { setAside: MINIONS };

  it("60208b.setup: shuffles each minion of the set into the encounter deck (standard mode)", () => {
    const base = newGame({ envs: [], ...stage });
    const { state } = newGame({ envs: [{ id: "60208a", failed: true }], ...stage });
    const codes = encounterDeckCodes(state);
    for (const m of MINIONS) expect(codes).toContain(m);
    expect(codes).toHaveLength(encounterDeckCodes(base.state).length + 6);
    expect(state.encounterSetAside.map((i) => codeOf(state, i))).toEqual([]);
    expect(dealtTo(state, P1)).toEqual([]);
  });

  it("60208b.setup: in expert mode first deals 1 of them at random to each player facedown, then shuffles in the rest", () => {
    const base = newGame({ players: 2, expert: true, envs: [], ...stage });
    const { state } = newGame({ players: 2, expert: true, envs: [{ id: "60208a", failed: true }], ...stage });
    const one = dealtTo(state, P1);
    const two = dealtTo(state, P2);
    expect(one).toHaveLength(1);
    expect(two).toHaveLength(1);
    expect(one[0]).not.toBe(two[0]);
    for (const c of [...one, ...two]) expect(MINIONS).toContain(c);
    const rest = MINIONS.filter((m) => !one.includes(m) && !two.includes(m));
    const codes = encounterDeckCodes(state);
    for (const m of rest) expect(codes).toContain(m);
    expect(codes).toHaveLength(encounterDeckCodes(base.state).length + 4);
  });
});

describe("Stop the Presses!, Completed 60209a", () => {
  const SUPPORTS = ["60153", "60154", "60155", "60156"];
  const controllerOf = (s: GameState, id: InstanceId) => inst(s, id).controllerId;
  const pickSupport =
    (names: Record<string, string>): Picker =>
    (s) => {
      const c = s.pendingChoice!;
      const want = names[c.playerId as string];
      const hit =
        want && c.prompt.kind === "chooseCards"
          ? c.options.find((o) => codeOf(s, o.optionId as InstanceId) === want)
          : undefined;
      return hit ? [hit.optionId] : firstLegal(s);
    };

  it("60209a.setup: each player chooses 1 Daily Bugle support and puts it into play under their control", () => {
    const { state } = newGame({
      players: 2,
      envs: [{ id: "60209a" }],
      setAside: SUPPORTS,
      pick: pickSupport({ p1: "60155", p2: "60153" }),
    });
    const mine = idsOf(state, "60155")[0]!;
    const yours = idsOf(state, "60153")[0]!;
    expect(cardsInPlay(state)).toContain(mine);
    expect(cardsInPlay(state)).toContain(yours);
    expect(controllerOf(state, mine)).toBe(P1);
    expect(controllerOf(state, yours)).toBe(P2);
    // The unchosen ones stay in the set-aside area: this Setup removes nothing.
    expect(state.encounterSetAside.map((i) => codeOf(state, i)).sort()).toEqual(["60154", "60156"]);
    expect(state.removedFromGame.map((i) => codeOf(state, i))).toEqual([]);
  });

  it("60209a.setup: a player is offered none when the campaign has set aside fewer supports than players", () => {
    const { state } = newGame({ players: 2, envs: [{ id: "60209a" }], setAside: ["60154"] });
    const placed = cardsInPlay(state).filter((i) => codeOf(state, i) === "60154");
    expect(placed).toHaveLength(1);
    expect(controllerOf(state, placed[0]!)).toBe(P1);
    expect(state.encounterSetAside).toHaveLength(0);
  });
});

describe("Stop the Presses!, Failed 60209b", () => {
  it("60209b.setup: deals each player 1 facedown encounter card", () => {
    const { state } = newGame({ players: 2, envs: [{ id: "60209a", failed: true }] });
    expect(dealtTo(state, P1)).toHaveLength(1);
    expect(dealtTo(state, P2)).toHaveLength(1);
  });
  it("60209b.setup: the first player orders the deals (RRG 'Each Player', p. 17)", () => {
    const { asked } = newGame({ players: 2, expert: true, envs: [{ id: "60209a", failed: true }] });
    expect(asked.filter((kind) => kind !== "mulligan")).toEqual(["orderPlayers"]);
  });
  it("60209b.setup: 2 encounter cards instead in expert mode", () => {
    const { state } = newGame({ players: 2, expert: true, envs: [{ id: "60209a", failed: true }] });
    expect(dealtTo(state, P1)).toHaveLength(2);
    expect(dealtTo(state, P2)).toHaveLength(2);
  });
});

describe("several environments at once (MC60 p. 9 step 12)", () => {
  it("resolves every environment's Setup, the first player ordering them", () => {
    const { state } = newGame({
      players: 2,
      envs: [{ id: "60205a" }, { id: "60207a", failed: true }, { id: "60209a", failed: true }],
    });
    expect(statuses(state, P1).tough).toBe(1);
    expect(dealtTo(state, P1)).toHaveLength(1);
    expect(inPlayCodes(state)).toEqual(expect.arrayContaining(["60205a", "60207a", "60209a"]));
    // The Completed face is not flipped; the Failed ones are.
    expect(inst(state, idsOf(state, "60205a")[0]!).flipped).toBeFalsy();
    expect(inst(state, idsOf(state, "60207a")[0]!).flipped).toBe(true);
  });
});

describe("the first player orders the players (RRG 1.8 Each Player, p. 17)", () => {
  /** Answers the ordering prompt with these players in this order (their option ids end in the player id), else firstLegal. */
  const ordering =
    (order: readonly string[]): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "orderPlayers") return firstLegal(s);
      const ids = order.map((p) => choice.options.find((o) => o.optionId.endsWith(p))!.optionId);
      return ids;
    };
  const controllerOf = (s: GameState, id: InstanceId) => inst(s, id).controllerId;

  it("60209a.setup: with 2 supports for 3 players, the order decides who gets none", () => {
    const supports = ["60153", "60154"];
    const run = (order: readonly string[]) =>
      newGame({ players: 3, envs: [{ id: "60209a" }], setAside: supports, pick: ordering(order) }).state;
    const placed = (s: GameState) =>
      cardsInPlay(s)
        .filter((i) => supports.includes(codeOf(s, i)))
        .map((i) => controllerOf(s, i))
        .sort();
    expect(placed(run(["p1", "p2", "p3"]))).toEqual(["p1", "p2"]);
    expect(placed(run(["p3", "p2", "p1"]))).toEqual(["p2", "p3"]);
  });

  it("60206b.setup: with 1 attachment for 3 players, the order decides who finds it and who is dealt a card", () => {
    const run = (order: readonly string[]) =>
      newGame({
        players: 3,
        envs: [{ id: "60206a", failed: true }],
        prep: keepingAttachments(1),
        pick: ordering(order),
      }).state;
    const a = run(["p1", "p2", "p3"]);
    expect([P1, P2, P3].map((p) => dealtTo(a, p).length)).toEqual([0, 1, 1]);
    const b = run(["p3", "p1", "p2"]);
    expect([P1, P2, P3].map((p) => dealtTo(b, p).length)).toEqual([1, 1, 0]);
  });
});
