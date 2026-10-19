import { cardId } from "@mc/content";
import {
  createGame,
  playCostOf,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { moveToDiscard, withForm } from "../../testing/staging.js";
import { stagedInPlay } from "../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../cards.js";
import { WAVE11_DEPS } from "../index.js";
import { JJ_BASIC as REGISTRY } from "./basic.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `jj/basic` (docs/phase7-wave11-hero-packs.md H8.4): Hellcat 61025, Joys of Life 61026, Unbreakable Bond
 * 61027, Second Chance 61028 and Defend Our City 61029, played from a hand-built Jessica Jones deck (a Defender in
 * both forms) against Core's Rhino. Basic cards: the Spider-Man identity swapped in checks the non-Defender case.
 */
const HELLCAT_REF = "61025.hellcat-constant";
const JOYS_REF = "61026.joys-of-life-action";
const BOND_REF = "61027.unbreakable-bond-action";
const SECOND_CHANCE_REF = "61028.when-defeated";
const DEFEND_REF = "61029.when-defeated";
const HELLCAT = "61025";
const JOYS = "61026";
const BOND = "61027";
const SECOND_CHANCE = "61028";
const DEFEND = "61029";
const IDENTITY_SPECIFIC = "61003"; // Jessica Jones's set: identity-specific
const LUKE_ALLY = "61003"; // Luke Cage's ally in Jessica's set: the other half of the Team-Up
const FILLER = "01091"; // a basic card: not identity-specific, not a Team-Up
const SPIDER_MAN = "01001a";
const P2_SPECIFIC = "62008"; // Luke Cage's set (the second player): identity-specific

function jjGame(identity = "61001a", players = 1): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const deck = [
    HELLCAT,
    JOYS,
    BOND,
    SECOND_CHANCE,
    DEFEND,
    IDENTITY_SPECIFIC,
    ...Array(33).fill(FILLER),
  ] as readonly string[];
  const created = createGame(
    {
      ...base,
      requireLegalDecks: false,
      players: [
        { identityCardId: cardId(identity), aspects: ["justice"], deck: deck.map((c) => cardId(c)) },
        ...(players === 2
          ? [
              {
                identityCardId: cardId("62001a"),
                aspects: ["leadership"] as const,
                deck: [P2_SPECIFIC, ...Array(39).fill(FILLER)].map((c) => cardId(c)),
              },
            ]
          : []),
      ],
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}

function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, WAVE11_DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 100) throw new Error("choices did not settle");
    const choice = session.state.pendingChoice;
    const next = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      },
      WAVE11_DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
    events.push(...next.events);
  }
  const replayed = replay(session.log, WAVE11_DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
const refused = (state: GameState, command: Command): boolean =>
  !sessionApply(startSession(state), command, WAVE11_DEPS).ok;

/** Takes the option whose label starts with `label` when offered, else `fallback`. */
const byLabel =
  (label: string, fallback: Picker = firstLegal): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => o.label.startsWith(label));
    return hit ? [hit.optionId] : fallback(state);
  };

const pile = (s: GameState, zone: "hand" | "deck" | "discard" | "playArea"): readonly InstanceId[] =>
  playerOf(s, P1)[zone];
const codesOf = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((i) => String(inst(s, i).cardId));

/** A player side scheme code on the table (villain area) with 1 threat, so one thwart defeats it. */
function schemeOnTable(state: GameState, code: string): { state: GameState; scheme: InstanceId } {
  const scheme = instancesOf(state, code)[0]!;
  const out: GameState = {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: p.hand.filter((i) => i !== scheme),
      deck: p.deck.filter((i) => i !== scheme),
      discard: p.discard.filter((i) => i !== scheme),
    })),
    villainArea: [...state.villainArea, scheme],
  };
  return { scheme, state: patchInstance(out, scheme, { faceup: true, threat: 1, controllerId: P1 }) };
}
const thwartIt = (state: GameState, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: identityOf(state),
  schemeInstanceId: scheme,
});

describe("wave 11 jj/basic registry", () => {
  it("registers only valid definitions, with the printed timing, and skips nothing", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [HELLCAT_REF, JOYS_REF, BOND_REF, SECOND_CHANCE_REF, DEFEND_REF].sort(),
    );
    expect(REGISTRY[HELLCAT_REF]).toMatchObject({ activeIn: "hand", trigger: { kind: "action" } });
    expect(REGISTRY[JOYS_REF]!.trigger).toMatchObject({ kind: "action" });
    expect(REGISTRY[BOND_REF]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(REGISTRY[SECOND_CHANCE_REF]!.trigger).toMatchObject({ kind: "whenDefeated" });
    expect(REGISTRY[DEFEND_REF]!.trigger).toMatchObject({ kind: "whenDefeated" });
  });
});

describe(`${HELLCAT_REF}: an identity with the Defender trait (Jessica Jones in hero form; her alter-ego is a Civilian) puts Hellcat into play from hand, and she is discarded at the end of the phase`, () => {
  it("puts her into play for free and discards her at the end of the phase", () => {
    const given = moveToHand(withForm(jjGame(), { heroForm: 0 }), P1, HELLCAT);
    const hellcat = given.ids[0]!;
    const { state: inPlay } = drive(given.state, use(P1, hellcat, HELLCAT_REF));
    expect(pile(inPlay, "playArea")).toContain(hellcat);
    expect(pile(inPlay, "hand")).not.toContain(hellcat);
    const ended = drive(inPlay, endTurn(P1)).state;
    // Right after the player phase ends, before anything else happens: she is already gone.
    expect(pile(ended, "playArea")).not.toContain(hellcat);
    expect(pile(ended, "discard")).toContain(hellcat);
  });

  it("is refused for an identity without the Defender trait (Spider-Man)", () => {
    const given = moveToHand(withForm(jjGame(SPIDER_MAN), { heroForm: 0 }), P1, HELLCAT);
    expect(refused(given.state, use(P1, given.ids[0]!, HELLCAT_REF))).toBe(true);
  });
});

describe(`${JOYS_REF}: exhaust a Civilian alter-ego to ready a hero or ally, or the reverse`, () => {
  const staged = (state: GameState) => {
    const given = moveToHand(state, P1, JOYS);
    return { state: given.state, id: given.ids[0]!, command: play(P1, given.ids[0]!, []) };
  };
  const exhausted = (s: GameState, id: InstanceId): GameState => patchInstance(s, id, { exhausted: true });

  it("exhausts the alter-ego (Civilian) and readies a chosen ally", () => {
    const luke = stagedInPlay(jjGame(), LUKE_ALLY);
    const base = exhausted(luke.state, luke.id);
    const { state, command } = staged(base);
    const { state: after } = drive(state, command, byLabel("Exhaust a Civilian"));
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
    expect(inst(after, luke.id).exhausted).toBe(false);
  });

  it("exhausts an ally and readies the exhausted alter-ego; the first option is not offered while she is exhausted", () => {
    const luke = stagedInPlay(jjGame(), LUKE_ALLY);
    const base = exhausted(luke.state, identityOf(luke.state));
    const { state, command } = staged(base);
    const opened = sessionApply(startSession(state), command, WAVE11_DEPS);
    if (!opened.ok) throw new Error(opened.error.message);
    const labels = opened.session.state.pendingChoice?.options.map((o) => o.label) ?? [];
    expect(labels.some((l) => l.startsWith("Exhaust a Civilian"))).toBe(false);
    const { state: after } = drive(state, command, byLabel("Exhaust a hero or ally"));
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
    expect(inst(after, luke.id).exhausted).toBe(true);
  });

  it("offers neither option in hero form with the hero exhausted and no ally: there is nothing to exhaust", () => {
    const hero = withForm(jjGame(), { heroForm: 0 });
    const { state, command } = staged(exhausted(hero, identityOf(hero)));
    const opened = sessionApply(startSession(state), command, WAVE11_DEPS);
    const labels = opened.ok ? (opened.session.state.pendingChoice?.options.map((o) => o.label) ?? []) : [];
    expect(labels.filter((l) => l.startsWith("Exhaust"))).toEqual([]);
  });
});

describe(`${JOYS_REF}: with two players`, () => {
  const P2 = "p2" as PlayerId;
  /** Takes the card option for each wanted instance in turn; anything else as `firstLegal`. */
  const picks =
    (...targets: readonly InstanceId[]): Picker =>
    (state) => {
      const wanted = targets[0];
      const hit = state.pendingChoice?.options.find(
        (o) => o.ref.kind === "card" && wanted !== undefined && o.ref.instanceId === wanted,
      );
      if (hit) {
        targets = targets.slice(1);
        return [hit.optionId];
      }
      return byLabel("Exhaust a Civilian")(state);
    };
  const setup = () => {
    const luke = stagedInPlay(jjGame("61001a", 2), LUKE_ALLY);
    const base = patchInstance(luke.state, luke.id, { exhausted: true });
    const given = moveToHand(base, P1, JOYS);
    return { state: given.state, luke: luke.id, command: play(P1, given.ids[0]!, []), theirs: identityOf(base, P2) };
  };

  it("P1 exhausts P2's Civilian alter-ego (Alliance) and readies her own exhausted ally", () => {
    const s = setup();
    const { state: after } = drive(s.state, s.command, picks(s.theirs, s.luke));
    expect(inst(after, s.theirs).exhausted).toBe(true);
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
    expect(inst(after, s.luke).exhausted).toBe(false);
  });

  it("control: choosing her own alter-ego instead leaves P2's ready", () => {
    const s = setup();
    const { state: after } = drive(s.state, s.command, picks(identityOf(s.state), s.luke));
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
    expect(inst(after, s.theirs).exhausted).toBe(false);
    expect(inst(after, s.luke).exhausted).toBe(false);
  });
});

describe(`${BOND_REF}: remove 3 threat from a scheme, heal 3 among Jessica Jones and Luke Cage`, () => {
  const setup = (jjDamage: number, lukeDamage: number) => {
    const luke = stagedInPlay(withForm(jjGame(), { heroForm: 0 }), LUKE_ALLY);
    let s = patchInstance(luke.state, luke.id, { damage: lukeDamage });
    s = patchInstance(s, identityOf(s), { damage: jjDamage });
    s = patchInstance(s, s.mainScheme.instanceId, { threat: 10 });
    const given = moveToHand(s, P1, BOND);
    const id = given.ids[0]!;
    return { state: given.state, luke: luke.id, command: play(P1, id, payWith(given.state, P1, 1, [id])) };
  };

  it("removes 3 threat and heals a total of 3 from the two characters", () => {
    const { state, luke, command } = setup(2, 4);
    const { state: after } = drive(state, command);
    expect(mainThreat(after)).toBe(7);
    const healed = 2 + 4 - (inst(after, identityOf(after)).damage + inst(after, luke).damage);
    expect(healed).toBe(3);
  });

  it("heals only what is there: 1 damage on Jessica and 1 on Luke heal 2 in all", () => {
    const { state, luke, command } = setup(1, 1);
    const { state: after } = drive(state, command);
    expect(mainThreat(after)).toBe(7);
    expect(inst(after, identityOf(after)).damage + inst(after, luke).damage).toBe(0);
  });

  it("cannot be played without Luke Cage in play (Team-Up names both)", () => {
    const hero = withForm(jjGame(), { heroForm: 0 });
    const given = moveToHand(hero, P1, BOND);
    const id = given.ids[0]!;
    expect(refused(given.state, play(P1, id, payWith(given.state, P1, 1, [id])))).toBe(true);
  });
});

describe(`${SECOND_CHANCE_REF}: each player may shuffle their identity-specific cards from the discard pile into the deck`, () => {
  const defeated = (pick: Picker) => {
    let s = jjGame();
    s = moveToDiscard(s, P1, IDENTITY_SPECIFIC).state;
    s = moveToDiscard(s, P1, FILLER).state;
    const { state, scheme } = schemeOnTable(withForm(s, { heroForm: 0 }), SECOND_CHANCE);
    return drive(state, thwartIt(state, scheme), pick);
  };

  it("moves the identity-specific card into the deck and leaves the basic card in the discard pile", () => {
    const { state } = defeated(byLabel("Shuffle"));
    expect(codesOf(state, pile(state, "discard"))).not.toContain(IDENTITY_SPECIFIC);
    expect(codesOf(state, pile(state, "discard"))).toContain(FILLER);
    expect(codesOf(state, pile(state, "deck"))).toContain(IDENTITY_SPECIFIC);
  });

  it("moves nothing when the player declines", () => {
    const { state } = defeated(byLabel("Do not"));
    expect(codesOf(state, pile(state, "discard"))).toContain(IDENTITY_SPECIFIC);
    expect(codesOf(state, pile(state, "deck"))).not.toContain(IDENTITY_SPECIFIC);
  });
});

describe(`${SECOND_CHANCE_REF}: with two players`, () => {
  const P2 = "p2" as PlayerId;
  const twoPlayers = (pick: (player: PlayerId) => Picker) => {
    let s = jjGame("61001a", 2);
    s = moveToDiscard(s, P1, IDENTITY_SPECIFIC).state;
    s = moveToDiscard(s, P2, P2_SPECIFIC).state;
    const { state, scheme } = schemeOnTable(withForm(s, { heroForm: 0 }), SECOND_CHANCE);
    return drive(state, thwartIt(state, scheme), (st) => pick(st.pendingChoice!.playerId)(st)).state;
  };
  const code = (p: PlayerId) => (p === P1 ? IDENTITY_SPECIFIC : P2_SPECIFIC);
  const inDeck = (s: GameState, p: PlayerId) => codesOf(s, playerOf(s, p).deck).includes(code(p));
  const inDiscard = (s: GameState, p: PlayerId) => codesOf(s, playerOf(s, p).discard).includes(code(p));

  it("each player decides for themselves: P1 shuffles, P2 declines", () => {
    const s = twoPlayers((p) => (p === P1 ? byLabel("Shuffle") : byLabel("Do not")));
    expect([inDeck(s, P1), inDiscard(s, P1)]).toEqual([true, false]);
    expect([inDeck(s, P2), inDiscard(s, P2)]).toEqual([false, true]);
  });

  it("both shuffle", () => {
    const s = twoPlayers(() => byLabel("Shuffle"));
    expect([inDeck(s, P1), inDeck(s, P2)]).toEqual([true, true]);
  });
});

describe("61029 Defend Our City", () => {
  const TEAM_UP_EVENT = BOND; // Unbreakable Bond: Team-Up (Luke Cage), printed cost 1
  const defeated = (state: GameState, pick: Picker = firstLegal) => {
    const { state: staged, scheme } = schemeOnTable(withForm(state, { heroForm: 0 }), DEFEND);
    return drive(staged, thwartIt(staged, scheme), pick);
  };
  /** Takes the Team-Up card when the search offers one, else the first legal option. */
  const takeTeamUp: Picker = (state) => {
    const hit = state.pendingChoice?.options.find(
      (o) => o.ref.kind === "card" && String(inst(state, o.ref.instanceId as InstanceId).cardId) === TEAM_UP_EVENT,
    );
    return hit ? [hit.optionId] : firstLegal(state);
  };
  const priceOf = (state: GameState, id: InstanceId, player: PlayerId = P1) =>
    playCostOf(state, player, id, WAVE11_DEPS)?.current;

  it("the search takes a Team-Up card from the deck into hand, and the cost of Team-Up cards drops by 1 for the phase", () => {
    const given = defeated(jjGame(), takeTeamUp);
    const bond = pile(given.state, "hand").find((i) => String(inst(given.state, i).cardId) === BOND)!;
    expect(bond).toBeDefined();
    expect(pile(given.state, "deck")).not.toContain(bond);
    // Unbreakable Bond prints cost 1; the reduction floors it at 0.
    expect(priceOf(given.state, bond)).toBe(0);
    // A card without Team-Up is not reduced.
    const joys = moveToHand(given.state, P1, JOYS);
    expect(priceOf(joys.state, joys.ids[0]!)).toBe(playCostOf(joys.state, P1, joys.ids[0]!, WAVE11_DEPS)?.printed);
  });

  it("the search may find a Team-Up card in the discard pile too", () => {
    const base = moveToDiscard(jjGame(), P1, BOND);
    const inDeck = pile(base.state, "deck").filter((i) => String(inst(base.state, i).cardId) === BOND);
    expect(inDeck).toEqual([]); // the only copy was moved to the discard pile
    const given = defeated(base.state, takeTeamUp);
    expect(codesOf(given.state, pile(given.state, "hand"))).toContain(BOND);
    expect(pile(given.state, "discard")).not.toContain(base.id);
  });

  it("declining the search still reduces the cost of a Team-Up card that is already in hand", () => {
    const base = moveToHand(jjGame(), P1, BOND);
    const none: Picker = (state) => {
      const choice = state.pendingChoice!;
      return choice.prompt.kind === "chooseCards" ? [] : firstLegal(state);
    };
    const given = defeated(base.state, none);
    expect(codesOf(given.state, pile(given.state, "hand"))).toContain(BOND);
    expect(priceOf(given.state, base.ids[0]!)).toBe(0);
  });

  it("control: before the scheme is defeated the Team-Up card costs its printed amount", () => {
    const base = moveToHand(jjGame(), P1, BOND);
    expect(priceOf(base.state, base.ids[0]!)).toBe(playCostOf(base.state, P1, base.ids[0]!, WAVE11_DEPS)?.printed);
    expect(playCostOf(base.state, P1, base.ids[0]!, WAVE11_DEPS)?.printed).toBe(1);
  });

  it("the reduction ends with the phase: the cost is back after the turn ends", () => {
    const base = moveToHand(jjGame(), P1, BOND);
    const none: Picker = (state) => (state.pendingChoice?.prompt.kind === "chooseCards" ? [] : firstLegal(state));
    const given = defeated(base.state, none);
    expect(priceOf(given.state, base.ids[0]!)).toBe(0);
    const later = drive(given.state, endTurn(P1), none).state;
    expect(later.lastingEffects.filter((e) => e.kind === "ruleGrant")).toEqual([]);
    expect(priceOf(later, base.ids[0]!)).toBe(1);
  });

  it("Prerequisite (Defender): Jessica Jones can play it, Spider-Man cannot (engine HT13)", () => {
    const given = moveToHand(withForm(jjGame(), { heroForm: 0 }), P1, DEFEND);
    const id = given.ids[0]!;
    expect(refused(given.state, play(P1, id, payWith(given.state, P1, 0, [id])))).toBe(false);
    const spider = moveToHand(withForm(jjGame(SPIDER_MAN), { heroForm: 0 }), P1, DEFEND);
    const sid = spider.ids[0]!;
    expect(refused(spider.state, play(P1, sid, payWith(spider.state, P1, 0, [sid])))).toBe(true);
  });
});
