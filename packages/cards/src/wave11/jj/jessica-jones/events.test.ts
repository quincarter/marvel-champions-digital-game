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
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { JJ_JESSICA_JONES_EVENTS as REGISTRY, JJ_JESSICA_JONES_EVENTS_SKIPPED as SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `jj/jessica-jones/events` (docs/phase7-wave11-hero-packs.md H8.4, H3.4, H3.22): "Big Mistake" 61004,
 * Breakthrough 61005, Snooping Around 61006 and Piecing It All Together 61007. Jessica's own identity and Alias
 * Investigations are another module, so these games seat the Core Spider-Man starter deck with the cards relabelled by
 * surgery, and Alias Investigations (61002) put into play with its evidence counters set by hand.
 */
const BIG_MISTAKE_A = "61004.big-mistake-action";
const BREAKTHROUGH_R = "61005.breakthrough-response";
const SNOOPING_A = "61006.snooping-around-action";
const PIECING_C = "61007.piecing-it-all-together-constant";
const PIECING_D = "61007.when-defeated";
const BIG_MISTAKE = "61004";
const BREAKTHROUGH = "61005";
const SNOOPING = "61006";
const PIECING = "61007";
const ALIAS = "61002";
const SECOND_CHANCE = "61028"; // another player side scheme
const MODOK = "01184"; // Core minion, 8 hit points, retaliate
const SHOCKER = "01103"; // Core minion, 3 hit points
const ADVANCE = "01186"; // Core treachery: "The villain schemes"
const BREAKIN = "01107"; // Core side scheme: 2 starting threat, "place an additional 1 [per_hero] threat here"

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const byCode = (s: GameState, code: string) => Object.values(s.instances).find((i) => i.cardId === cardId(code))!;

/** A Spider-Man game past setup (alter-ego form) in the wave 11 pool, with these card codes relabelled onto deck cards. */
function jjGame(...codes: readonly string[]): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const created = createGame({ ...base, requireLegalDecks: false }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE11_DEPS);
  const deck = playerOf(s, P1).deck;
  codes.forEach((code, i) => {
    s = patchInstance(s, deck[i]!, { cardId: cardId(code) });
  });
  return s;
}

/** Alias Investigations in play holding `evidence` counters, over a game with `codes` relabelled behind it. */
function withAlias(evidence: number, ...codes: readonly string[]) {
  const s = stagedInPlay(jjGame(ALIAS, ...codes), ALIAS, { counters: { evidence } });
  return { state: s.state, alias: s.id };
}

function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, WAVE11_DEPS);
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

/** Takes the option whose label contains `label` or that is on one of `cards`; anything else as `firstLegal`. */
const picks =
  (opts: { readonly label?: string; readonly cards?: readonly InstanceId[] }): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    const wanted = opts.cards ?? [];
    const hit = choice?.options.find(
      (o) =>
        (opts.label !== undefined && String((o as { label?: string }).label ?? "").includes(opts.label)) ||
        ((o.ref.kind === "card" || o.ref.kind === "ability") && wanted.includes(o.ref.instanceId)),
    );
    return hit ? [hit.optionId] : firstLegal(state);
  };

function staged(state: GameState, code: string, cost: number) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  return { state: given.state, id, command: play(P1, id, payWith(given.state, P1, cost, [id])) };
}

describe("Jessica Jones events registry", () => {
  it("registers only valid definitions, with the printed timing", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(REGISTRY[BIG_MISTAKE_A]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(REGISTRY[SNOOPING_A]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(REGISTRY[BREAKTHROUGH_R]!.trigger).toMatchObject({ kind: "response" });
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [BIG_MISTAKE_A, BREAKTHROUGH_R, SNOOPING_A, PIECING_C, PIECING_D].sort(),
    );
    expect(SKIPPED).toEqual({});
  });
});

describe(`${BIG_MISTAKE_A}: 3 damage to an enemy, optionally 1 evidence for 2 more and overkill or piercing`, () => {
  const heroGame = (evidence: number) => {
    const s = withAlias(evidence, BIG_MISTAKE);
    return { ...s, state: engageMinion(withForm(s.state, { heroForm: 0 }), MODOK, "modok") };
  };
  const MODOK_ID = "modok" as InstanceId;

  it("with no evidence counter offers no removal and deals exactly 3", () => {
    const g = heroGame(0);
    const { state, command } = staged(g.state, BIG_MISTAKE, 1);
    const { state: after } = drive(state, command, picks({ cards: [MODOK_ID] }));
    expect(inst(after, MODOK_ID).damage).toBe(3);
    expect(inst(after, g.alias).counters.evidence ?? 0).toBe(0);
  });

  it("declining the removal keeps the counter and deals 3", () => {
    const g = heroGame(2);
    const { state, command } = staged(g.state, BIG_MISTAKE, 1);
    const { state: after } = drive(state, command, picks({ cards: [MODOK_ID], label: "Do not" }));
    expect(inst(after, MODOK_ID).damage).toBe(3);
    expect(inst(after, g.alias).counters.evidence).toBe(2);
  });

  it("removing 1 evidence for overkill deals 5, and the excess over a 3-hit-point minion goes to the villain", () => {
    const g = heroGame(2);
    const shocker = "shocker" as InstanceId;
    const { state, command } = staged(engageMinion(g.state, SHOCKER, "shocker"), BIG_MISTAKE, 1);
    const { state: after } = drive(state, command, picks({ cards: [shocker], label: "overkill" }));
    expect(inst(after, g.alias).counters.evidence).toBe(1);
    expect(inst(after, after.activeVillainId!).damage).toBe(2);
  });

  it("removing 1 evidence for piercing deals 5 and discards the target's tough card", () => {
    const g = heroGame(1);
    const toughMinion = patchInstance(g.state, MODOK_ID, { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const { state, command } = staged(toughMinion, BIG_MISTAKE, 1);
    const { state: after } = drive(state, command, picks({ cards: [MODOK_ID], label: "piercing" }));
    expect(inst(after, MODOK_ID).damage).toBe(5);
    expect(inst(after, MODOK_ID).statuses.tough).toBe(0);
    expect(inst(after, g.alias).counters.evidence ?? 0).toBe(0);
  });

  it("is refused in alter-ego form", () => {
    const g = withAlias(1, BIG_MISTAKE);
    const { state, command } = staged(g.state, BIG_MISTAKE, 1);
    expect(sessionApply(startSession(state), command, WAVE11_DEPS).ok).toBe(false);
  });
});

describe(`${SNOOPING_A}: Alter-Ego Action (thwart): remove 4 threat, 2 evidence, discard the top encounter card`, () => {
  const setup = (top: string, evidence = 0) => {
    const g = withAlias(evidence, SNOOPING);
    const s = stackEncounterDeck(patchInstance(g.state, g.state.mainScheme.instanceId, { threat: 10 }), top);
    return { ...g, ...staged(s, SNOOPING, 0) };
  };

  it("thwarts 4, puts 2 evidence on Alias Investigations, and reveals a discarded minion", () => {
    const g = setup(SHOCKER, 1);
    const { state: after } = drive(g.state, g.command, picks({ cards: [g.state.mainScheme.instanceId] }));
    expect(mainThreat(after)).toBe(6);
    expect(inst(after, g.alias).counters.evidence).toBe(3);
    expect(byCode(after, SHOCKER).engagedWith).toBe(P1);
  });

  it("a discarded side scheme is revealed: it enters play with its starting threat and its When Revealed resolves", () => {
    const g = setup(BREAKIN);
    const { state: after } = drive(g.state, g.command, picks({ cards: [g.state.mainScheme.instanceId] }));
    const scheme = byCode(after, BREAKIN).instanceId;
    expect(after.villainArea).toContain(scheme);
    expect(inst(after, scheme).threat).toBe(3);
  });

  it("a discarded treachery stays in the discard pile unrevealed", () => {
    const g = setup(ADVANCE);
    const { state: after, events } = drive(g.state, g.command, picks({ cards: [g.state.mainScheme.instanceId] }));
    expect(mainThreat(after)).toBe(6);
    const advance = byCode(after, ADVANCE).instanceId;
    expect(Object.values(after.encounterDecks).some((pile) => pile.discard.includes(advance))).toBe(true);
    expect(ofType(events, "encounterCardRevealed").filter((e) => e.instanceId === advance)).toEqual([]);
  });
});

describe(`${BREAKTHROUGH_R}: after an evidence counter is placed on Alias Investigations, ready your identity`, () => {
  it("answers Snooping Around's placement once: readies the exhausted identity and returns to the deck", () => {
    const g = withAlias(0, SNOOPING, BREAKTHROUGH);
    const exhausted = patchInstance(g.state, identityOf(g.state), { exhausted: true });
    const given = moveToHand(exhausted, P1, BREAKTHROUGH);
    const [breakthrough] = given.ids as [InstanceId];
    const s = staged(given.state, SNOOPING, 0);
    const { state: after } = drive(s.state, s.command, picks({ cards: [breakthrough, s.state.mainScheme.instanceId] }));
    expect(inst(after, g.alias).counters.evidence).toBe(2);
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
    expect(playerOf(after, P1).deck).toContain(breakthrough);
    expect(playerOf(after, P1).hand).not.toContain(breakthrough);
    expect(playerOf(after, P1).discard).not.toContain(breakthrough);
  });

  it("cannot be played with no placement to answer", () => {
    const g = withAlias(0, BREAKTHROUGH);
    const given = moveToHand(g.state, P1, BREAKTHROUGH);
    const [breakthrough] = given.ids as [InstanceId];
    expect(sessionApply(startSession(given.state), play(P1, breakthrough, []), WAVE11_DEPS).ok).toBe(false);
  });
});

describe(`${PIECING_C} and ${PIECING_D}: outside the player side scheme limit; the defeating player draws 3`, () => {
  it("playing it with another player side scheme in play discards neither (one player, limit of one)", () => {
    const base = jjGame(SECOND_CHANCE, PIECING);
    const first = staged(base, SECOND_CHANCE, 0);
    const { state: one } = drive(first.state, first.command);
    const second = staged(one, PIECING, 0);
    const { state: both } = drive(second.state, second.command);
    expect(both.villainArea).toContain(byCode(both, PIECING).instanceId);
    expect(both.villainArea).toContain(byCode(both, SECOND_CHANCE).instanceId);
  });

  it("Piecing It All Together in play first, a second player side scheme played: nothing is discarded", () => {
    const first = staged(jjGame(PIECING, SECOND_CHANCE), PIECING, 0);
    const { state: one } = drive(first.state, first.command);
    const second = staged(one, SECOND_CHANCE, 0);
    const { state: both } = drive(second.state, second.command);
    expect(both.villainArea).toContain(byCode(both, PIECING).instanceId);
    expect(both.villainArea).toContain(byCode(both, SECOND_CHANCE).instanceId);
  });

  it("when defeated, the defeating player draws 3 cards", () => {
    const s = staged(jjGame(PIECING), PIECING, 0);
    const { state: played } = drive(s.state, s.command);
    const scheme = byCode(played, PIECING).instanceId;
    expect(inst(played, scheme).threat).toBe(6);
    const handBefore = playerOf(played, P1).hand.length;
    const { state: after } = drive(withForm(patchInstance(played, scheme, { threat: 1 }), { heroForm: 0 }, P1), {
      type: "basicThwart",
      thwarterInstanceId: identityOf(played),
      playerId: P1,
      schemeInstanceId: scheme,
    } as unknown as Command);
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 3);
  });
});
