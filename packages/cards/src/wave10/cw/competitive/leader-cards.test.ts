import { CW_CARDS, PLAYABLE_CARDS, WAVE10_STARTER_DECKS, cardId, type DeckContents } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  createGame,
  legalActions,
  resolveValue,
  validateDeck,
  type AbilityDefinition,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { competitiveOnlyTexts, validateDefinition } from "../../../dsl/validate.js";
import { refCount } from "../../../dsl/values.js";
import { enemyLeader, yourLeader } from "../../../dsl/index.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import {
  BLACK_CAT,
  BLANK,
  CAPTAIN_MARVEL,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  heroForm,
  piles,
  heroAttacks,
  schemesBy,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { CAPTAIN_MARVEL_SCENARIO, WAVE10_DEPS, civilWarGame, engageMinion, stagedInPlay } from "../../testing.js";
import { COMPETITIVE_LEADER_CARDS, COMPETITIVE_LEADER_CARDS_SKIPPED } from "./leader-cards.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The sixteen leader-specific basic player cards of the Civil War box (MC56 p. 3: "These leader-specific player cards
 * are used only when playing in competitive mode"; docs/competitive-mode-plan.md sections 1.6, 2.1, 4 tasks 11 and 13).
 * The data marks them competitive-only and `validateDeck` refuses a cooperative deck that lists one, so none can be
 * seated in a real game. The tests run at the levels the engine allows, as `standard-pvp.test.ts` does:
 *
 * - registry: every ref registered once, valid, and the `competitiveOnly` sentences pinned;
 * - the cooperative guard: the exact refusal for each of the sixteen;
 * - two-team values: `yourLeader` and `enemyLeader` on the engine's two-team fixture;
 * - STAGED: this card cannot appear cooperatively. A card put into a hand by direct state arrangement in a real game,
 *   showing what the cooperative reading of MC56 p. 6 does: "the enemy leader" is the villain, "the enemy team" is the
 *   players, "your leader" cannot be resolved and "Do as much as you can".
 *
 * Missing from the engine, so not tested as a resolution: a leader attacking a leader, a leader scheming, a leader's
 * main scheme, redirecting an attack onto a leader (plan milestone M3).
 */
const TEAM_FIXTURE = new URL("../../../../../engine/src/testing/team.ts", import.meta.url).href;
interface TwoTeamFixture {
  readonly twoTeamState: (options?: {
    readonly sizes?: readonly [number, number];
    readonly seed?: number;
  }) => GameState;
}
const { twoTeamState } = (await import(/* @vite-ignore */ TEAM_FIXTURE)) as TwoTeamFixture;

const REFS = [
  "56129.the-futurist-action",
  "56130.target-lock-action",
  "56131.high-tech-suit-constant",
  "56131.high-tech-suit-action",
  "56132.suit-up-response",
  "56133.provoked-response-forced-interrupt",
  "56134.you-started-this-action",
  "56135.alpha-flight-recruit-response",
  "56136.raw-power-response",
  "56207.no-you-move-forced-interrupt",
  "56208.fighting-dirty-action",
  "56209.recruited-by-cap-action",
  "56210.the-peoples-hero-response",
  "56211.double-agent-action",
  "56212.spider-blast-action",
  "56213.hard-to-hit-constant",
  "56213.hard-to-hit-forced-response",
  "56214.secret-contact-response",
];
const CODES = [
  ...["56129", "56130", "56131", "56132"],
  ...["56133", "56134", "56135", "56136"],
  ...["56207", "56208", "56209", "56210"],
  ...["56211", "56212", "56213", "56214"],
];
const def = (ref: string): AbilityDefinition => COMPETITIVE_LEADER_CARDS[ref]!;
const dataOf = (code: string) => CW_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;

describe("registry", () => {
  it("registers the 18 refs, each a valid definition, and skips nothing", () => {
    expect(Object.keys(COMPETITIVE_LEADER_CARDS).sort()).toEqual([...REFS].sort());
    for (const [id, definition] of Object.entries(COMPETITIVE_LEADER_CARDS))
      expect(validateDefinition(definition), id).toEqual([]);
    expect(COMPETITIVE_LEADER_CARDS_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the sixteen cards", () => {
    const refs = CODES.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    for (const ref of REFS.filter((r) => r.endsWith("-action") && !r.includes("high-tech")))
      expect(def(ref).trigger, ref).toMatchObject({ kind: "action" });
    expect(def("56131.high-tech-suit-action").trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(def("56131.high-tech-suit-constant").trigger).toMatchObject({ kind: "constant" });
    for (const ref of REFS.filter((r) => r.endsWith("-response") && !r.startsWith("56213")))
      expect(def(ref).trigger, ref).toMatchObject({ kind: "response", forced: false });
    expect(def("56133.provoked-response-forced-interrupt").trigger).toMatchObject({ kind: "interrupt", forced: true });
    expect(def("56207.no-you-move-forced-interrupt").trigger).toMatchObject({ kind: "interrupt", forced: true });
    expect(def("56213.hard-to-hit-forced-response").trigger).toMatchObject({ kind: "response", forced: true });
  });

  it("High-Tech Suit: hero action, spend [energy][mental], any player may trigger it, discards the card", () => {
    const action = def("56131.high-tech-suit-action");
    expect(action.cost).toMatchObject({ resources: { energy: 1, mental: 1 } });
    expect(action.trigger).toMatchObject({ triggerableBy: expect.anything() });
    expect(action.effects).toMatchObject([{ kind: "discardFromPlay" }]);
  });

  it("the data: High-Tech Suit and Hard to Hit attach to your leader; Alpha Flight Recruit to an ally", () => {
    expect(dataOf("56131").attachesTo).toEqual({ kind: "leader", of: "yours" });
    expect(dataOf("56213").attachesTo).toEqual({ kind: "leader", of: "yours" });
    expect(dataOf("56135").attachesTo).toEqual({ kind: "ally" });
  });

  it("competitiveOnlyTexts lists exactly the sentences the engine cannot run, none dropped", () => {
    const listed = Object.fromEntries(
      Object.entries(COMPETITIVE_LEADER_CARDS)
        .map(([ref, definition]) => [ref, competitiveOnlyTexts(definition)] as const)
        .filter(([, texts]) => texts.length > 0),
    );
    // Every sentence is scripted (M3): the leader attacks, the redirects, a leader scheming, the 3-damage cap.
    expect(listed).toEqual({});
  });

  it("the sentences that need no second team are real effects, not markers", () => {
    const kinds = (ref: string) => def(ref).effects.map((e) => e.kind);
    // The marker's `if` on inCompetitiveMode comes first, then the rider's `if` on the resource paid.
    const rider = (ref: string) =>
      (def(ref).effects[1] as unknown as { then: { kind: string }[] }).then.map((e) => e.kind);
    expect(rider("56130.target-lock-action")).toEqual(["chooseTarget", "discardFromPlay"]);
    expect(rider("56134.you-started-this-action")).toEqual(["giveStatus"]);
    expect(rider("56208.fighting-dirty-action")).toEqual(["giveStatus"]);
    expect(rider("56212.spider-blast-action")).toEqual(["giveStatus"]);
    expect(kinds("56136.raw-power-response")).toEqual(["addCounters"]);
    expect(kinds("56214.secret-contact-response")).toEqual(["addCounters"]);
    expect(kinds("56132.suit-up-response")).toEqual(["giveStatus"]);
    expect(kinds("56210.the-peoples-hero-response")).toEqual(["giveBoostCard"]);
    expect(kinds("56209.recruited-by-cap-action")).toEqual(["chooseTarget", "choosePlayer", "engage"]);
    expect(kinds("56211.double-agent-action")[0]).toBe("removeThreat");
  });
});

describe("the cooperative guard", () => {
  const contents = (id: string): DeckContents => {
    const deck = WAVE10_STARTER_DECKS.find((d) => d.id === id)!;
    return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
  };

  it("the data marks all sixteen competitive-only, with their leader set", () => {
    const sets = ["iron_man_leader", "captain_marvel_leader", "captain_america_leader", "spider_woman_leader"];
    CODES.forEach((code, i) =>
      expect(dataOf(code).specificTo, code).toEqual({ kind: "competitive", encounterSetId: sets[Math.floor(i / 4)] }),
    );
  });

  it.each(CODES)("%s: a cooperative deck listing it is refused, with the competitive-mode message", (code) => {
    const deck = contents("tigra-aggression");
    const [, ...rest] = deck.cards;
    const verdict = validateDeck({ ...deck, cards: [{ cardId: cardId(code), quantity: 1 }, ...rest] }, PLAYABLE_CARDS);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    const problem = verdict.problems.find((p) => p.code === "competitive_card")!;
    expect(problem.message).toMatch(
      / is used only in competitive \(team-vs-team\) mode\. Competitive mode is coming soon\.$/,
    );
    expect(problem.message.startsWith((dataOf(code) as { name: string }).name)).toBe(true);
  });

  it("createGame refuses competitive mode outright", () => {
    const config = coreScenario("rhino", { players: [SPIDER_MAN], seed: 1 } as never);
    const refused = createGame({ ...config, gameMode: "competitive" } as never, WAVE10_DEPS);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("mode_unavailable");
  });
});

describe("two-team values (the engine's fixture)", () => {
  const ctx = (seat: "p1" | "p2" | "p3") => ({
    selfInstanceId: null,
    controllerId: seat as never,
    event: null,
    bindings: {},
    deps: WAVE10_DEPS,
  });

  it("each team has one leader of its own: yourLeader and enemyLeader both resolve to one card", () => {
    const state = twoTeamState({ sizes: [1, 1] });
    for (const seat of ["p1", "p2"] as const) {
      expect(resolveValue(state, refCount(yourLeader), ctx(seat))).toBe(1);
      expect(resolveValue(state, refCount(enemyLeader), ctx(seat))).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// STAGED: this card cannot appear cooperatively. Core's Rhino game with the card put into a hand by hand.
// ---------------------------------------------------------------------------

const POOL = PLAYABLE_CARDS.length > 0 ? [...PLAYABLE_CARDS, ...WAVE10_CARDS] : WAVE10_CARDS;
const ENERGY = "01088";
const GENIUS = "01089"; // mental
const STRENGTH = "01090"; // physical
const VEST = "01081"; // a Core upgrade of cost 1, to spend a resource on
const SHOCKER = "01103";

type Seat = typeof SPIDER_MAN | typeof CAPTAIN_MARVEL;

function rhinoGame(seats: readonly Seat[] = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  } as never);
  const created = createGame(config, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS);
  return heroForm(settled, ...settled.players.map((p) => p.playerId));
}

/** `code` as a card in P1's hand: a deck card turned into it (staging surgery). */
function giveCard(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const donor = playerOf(state, P1).deck.find((i) => codeOf(state, i) !== code)!;
  const turned = patchInstance(state, donor, { cardId: cardId(code) as never });
  const given = moveToHand(turned, P1, code);
  return { state: given.state, id: given.ids[0]! };
}

/** `n` other cards of P1's hand turned into `payCode`, to pay with. */
function payers(state: GameState, exclude: InstanceId, payCode: string, n: number) {
  const chosen = playerOf(state, P1)
    .hand.filter((i) => i !== exclude)
    .slice(0, n);
  const turned = chosen.reduce((s, i) => patchInstance(s, i, { cardId: cardId(payCode) as never }), state);
  return { state: turned, ids: chosen };
}

/** Accepts every optional trigger it is offered, otherwise the first legal option. */
const acceptAll: Picker = (s) => {
  const choice = s.pendingChoice!;
  if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId as string);
  return firstLegal(s);
};

/** A cost-2 event of the box played from hand, paid with two cards of `payCode`. */
function playEvent(code: string, payCode: string, pick: Picker = firstLegal, seats?: Seat[]) {
  const start = rhinoGame(seats);
  const given = giveCard(start, code);
  const paid = payers(given.state, given.id, payCode, 2);
  const before = paid.state;
  const result = driveEventsPicking(WAVE10_DEPS, before, pick, play(P1, given.id, paid.ids));
  return { before, ...result, id: given.id };
}

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const statusesOn = (s: GameState, id: InstanceId) => inst(s, id).statuses;
const sumOf = (s: GameState, key: "tough" | "stunned" | "confused") =>
  Object.values(s.instances).reduce((n, i) => n + i.statuses[key], 0);
const counterTotal = (s: GameState) =>
  Object.values(s.instances).reduce((n, i) => n + Object.values(i.counters).reduce((a, b) => a + b, 0), 0);

describe("STAGED The Futurist (56129): your leader schemes, which cannot be resolved", () => {
  it("is played and discarded; Rhino does not scheme and nothing changes on the table", () => {
    const run = playEvent("56129", ENERGY);
    expect(playerOf(run.state, P1).discard).toContain(run.id);
    expect(schemesBy(run.state, run.events, "01094")).toHaveLength(0);
    expect(mainThreat(run.state)).toBe(mainThreat(run.before));
    expect(sumOf(run.state, "tough") + sumOf(run.state, "stunned") + sumOf(run.state, "confused")).toBe(0);
  });
});

describe("STAGED Target Lock (56130)", () => {
  it("with [mental] paid and no Hero Response or Hero Interrupt attachment on the enemy leader, nothing changes", () => {
    const run = playEvent("56130", GENIUS);
    expect(attacksBy(run.state, run.events, "01094")).toHaveLength(0);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(0);
    expect(inst(run.state, villainOf(run.state)).attachments).toEqual([]);
  });
});

describe("STAGED You Started This, Fighting Dirty, Spider-Blast: the attack cannot be resolved, the rider is a sentence of its own", () => {
  // MC56 p. 6: "Do as much as you can." The rider names the enemy leader (the villain) and the resource paid, not the
  // attack, so it still resolves. The plan's table (2.3, task 11) reads these cards as changing no state; the rider is
  // an independent sentence, so this follows the rulebook and flags the difference.
  it("You Started This: paid with [energy], the enemy leader is confused; paid with [mental], it is not", () => {
    const paid = playEvent("56134", ENERGY);
    expect(statusesOn(paid.state, villainOf(paid.state)).confused).toBe(1);
    const other = playEvent("56134", GENIUS);
    expect(statusesOn(other.state, villainOf(other.state)).confused).toBe(0);
  });

  it("Fighting Dirty: paid with [physical], the enemy leader is stunned; paid with [energy], it is not", () => {
    const paid = playEvent("56208", STRENGTH);
    expect(statusesOn(paid.state, villainOf(paid.state)).stunned).toBe(1);
    const other = playEvent("56208", ENERGY);
    expect(statusesOn(other.state, villainOf(other.state)).stunned).toBe(0);
  });

  it("Spider-Blast: paid with [mental], the enemy leader is confused; paid with [physical], it is not", () => {
    const paid = playEvent("56212", GENIUS);
    expect(statusesOn(paid.state, villainOf(paid.state)).confused).toBe(1);
    const other = playEvent("56212", STRENGTH);
    expect(statusesOn(other.state, villainOf(other.state)).confused).toBe(0);
  });

  it("none of them makes Rhino attack", () => {
    for (const [code, pay] of [
      ["56134", ENERGY],
      ["56208", STRENGTH],
      ["56212", GENIUS],
    ] as const) {
      const run = playEvent(code, pay);
      expect(attacksBy(run.state, run.events, "01094"), code).toHaveLength(0);
      expect(inst(run.state, villainOf(run.state)).damage, code).toBe(0);
    }
  });
});

describe("STAGED Double Agent (56211): removes exactly 2 threat from the main scheme and places none elsewhere", () => {
  it("2 threat leave the main scheme", () => {
    const start = patchInstance(rhinoGame(), rhinoGame().mainScheme.instanceId, { threat: 5 });
    const given = giveCard(start, "56211");
    const paid = payers(given.state, given.id, ENERGY, 2);
    const run = driveEventsPicking(WAVE10_DEPS, paid.state, firstLegal, play(P1, given.id, paid.ids));
    expect(mainThreat(paid.state)).toBe(5);
    expect(mainThreat(run.state)).toBe(3);
    const elsewhere = Object.values(run.state.instances).reduce((n, i) => n + i.threat, 0);
    expect(elsewhere).toBe(3);
  });
});

describe("STAGED Recruited by Cap (56209): a minion engaged with you engages a player on the enemy team (the players)", () => {
  it("with two players, the minion moves to the player chosen from both seats", () => {
    const start = engageMinion(rhinoGame([SPIDER_MAN, CAPTAIN_MARVEL]), SHOCKER, "shocker-1", P1);
    const given = giveCard(start, "56209");
    const paid = payers(given.state, given.id, ENERGY, 3);
    // The chooser's options are both seats; the second is picked.
    const pickSecond: Picker = (s) => {
      const choice = s.pendingChoice!;
      const second = choice.options.find((o) => JSON.stringify(o.ref).includes(P2));
      return second ? [second.optionId as string] : firstLegal(s);
    };
    const run = driveEventsPicking(WAVE10_DEPS, paid.state, pickSecond, play(P1, given.id, paid.ids));
    expect(inst(run.state, "shocker-1" as InstanceId).engagedWith).toBe(P2);
  });

  it("with no minion engaged with you, nothing happens", () => {
    const run = playEvent("56209", ENERGY);
    expect(Object.values(run.state.instances).filter((i) => i.engagedWith !== null)).toEqual([]);
  });
});

describe("STAGED the leader resources (56132, 56136, 56210, 56214): spending one triggers nothing without your leader", () => {
  /** Plays a cost-1 Core upgrade paid with the resource card, accepting every trigger offered. */
  function spend(code: string) {
    const start = rhinoGame();
    const vest = giveCard(start, VEST);
    const res = giveCard(vest.state, code);
    const before = res.state;
    const run = driveEventsPicking(WAVE10_DEPS, before, acceptAll, play(P1, vest.id, [res.id]));
    return { before, ...run, res: res.id, vest: vest.id };
  }

  it.each(["56132", "56136", "56210", "56214"])("%s is spent, and no status, counter or boost card appears", (code) => {
    const run = spend(code);
    // The resource was spent (it left the hand for the discard pile) and the upgrade it paid for is in play.
    expect(playerOf(run.state, P1).discard).toContain(run.res);
    expect(inst(run.state, run.vest).attachedTo).not.toBeNull();
    expect(sumOf(run.state, "tough")).toBe(0);
    expect(counterTotal(run.state)).toBe(counterTotal(run.before));
    expect(inst(run.state, villainOf(run.state)).boostCards).toEqual(
      inst(run.before, villainOf(run.before)).boostCards,
    );
    expect(piles(run.state).deck.length).toBe(piles(run.before).deck.length);
  });
});

describe("STAGED the leader upgrades with no host (56131 High-Tech Suit, 56213 Hard to Hit)", () => {
  it.each(["56131", "56213"])(
    "%s has no host cooperatively: it is not a legal play and the engine refuses it",
    (code) => {
      const given = giveCard(rhinoGame(), code);
      const paid = payers(given.state, given.id, ENERGY, 1);
      const offered = legalActions(paid.state, P1, WAVE10_DEPS);
      expect(offered.kind).toBe("turn");
      if (offered.kind === "turn")
        expect(offered.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === given.id)).toBe(false);
      const refused = applyCommand(paid.state, play(P1, given.id, paid.ids), WAVE10_DEPS);
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
    },
  );
});

describe("STAGED Alpha Flight Recruit (56135): attaches to an ally; Energy Channel of your leader never exists", () => {
  it("can be played on an ally, which is not healed by anything", () => {
    const start = rhinoGame();
    const ally = stagedInPlay(giveCard(start, BLACK_CAT).state, BLACK_CAT);
    const given = giveCard(ally.state, "56135");
    const damaged = patchInstance(given.state, ally.id, { damage: 1 });
    const run = driveEventsPicking(
      WAVE10_DEPS,
      damaged,
      acceptAll,
      play(P1, given.id, [], { attachToInstanceId: ally.id }),
    );
    expect(run.state.instances[given.id]).toBeDefined();
    expect(inst(run.state, ally.id).damage).toBe(1);
  });
});

describe("STAGED Provoked Response (56133), No, You Move! (56207): the redirect cannot be resolved", () => {
  // Owner's answer to question 11 = A (2026-10-11), the like case of Darkforce: "Do as much as you can" - the forced
  // ability triggers, the instruction aimed at "your leader" does nothing, and the card is discarded. The attack
  // goes on against you as it would have.
  it.each(["56133", "56207"])("%s: Rhino's attack still lands on you, and the card is discarded", (code) => {
    const start = rhinoGame();
    const staged = stagedInPlay(giveCard(start, code).state, code, { attach: true });
    const stacked = stackEncounterDeck(staged.state, BLANK, BLANK);
    const run = driveEventsPicking(WAVE10_DEPS, stacked, firstLegal, endTurn(P1));
    expect(attacksBy(run.state, run.events, "01094")).toHaveLength(1);
    expect(cardsInPlay(run.state)).not.toContain(staged.id);
  });
});

describe("STAGED against a real Captain Marvel: her Energy Channel is the enemy leader's, not yours", () => {
  const channelOf = (s: GameState): InstanceId =>
    Object.keys(s.instances).find((i) => codeOf(s, i as InstanceId) === "56098") as InstanceId;
  const energyOn = (s: GameState): number => inst(s, channelOf(s)).counters["energy"] ?? 0;

  function cmGame(): GameState {
    return heroForm(
      civilWarGame(CAPTAIN_MARVEL_SCENARIO, {
        mainSchemeStageIds: ["56121b", "56124b"] as never,
        leaderSideScheme: "discarded",
      }),
    );
  }

  it("Raw Power spent: no energy counter is placed on the villain's Energy Channel (it stays at 1)", () => {
    const start = cmGame();
    const vest = giveCard(start, VEST);
    const res = giveCard(vest.state, "56136");
    // One counter is already there, so a placement on the villain's Channel (3) would show.
    const loaded = patchInstance(res.state, channelOf(res.state), { counters: { energy: 1 } });
    const run = driveEventsPicking(WAVE10_DEPS, loaded, acceptAll, play(P1, vest.id, [res.id]));
    expect(playerOf(run.state, P1).discard).toContain(res.id);
    expect(energyOn(run.state)).toBe(1);
  });

  it("an Alpha Flight Recruit on an ally does not heal when counters land on the villain's Energy Channel", () => {
    const start = cmGame();
    const ally = stagedInPlay(giveCard(start, BLACK_CAT).state, BLACK_CAT);
    const given = giveCard(ally.state, "56135");
    const damaged = patchInstance(given.state, ally.id, { damage: 1 });
    const attached = driveEventsPicking(
      WAVE10_DEPS,
      damaged,
      acceptAll,
      play(P1, given.id, [], { attachToInstanceId: ally.id }),
    );
    expect(energyOn(attached.state)).toBe(0);
    // A real placement on the villain's Channel: Captain Marvel's own Forced Response when she is attacked.
    const attacked = heroAttacks(WAVE10_DEPS, attached.state, villainOf(attached.state));
    expect(energyOn(attacked.state)).toBe(1);
    expect(inst(attacked.state, ally.id).damage).toBe(1);
  });
});
