import { AOS_CARDS, cardId, type EventCard, type ResourceCard } from "@mc/content";
import { applyCommand, type EngineDeps, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { MARIA_HILL_EVENTS, MARIA_HILL_EVENTS_SKIPPED } from "./events.js";
import { MARIA_HILL_IDENTITY } from "./identity.js";
import { engageHillMinion, inPlay, mariaGame, mariaHeroGame } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Maria Hill's events and resource (50003 to 50007), docs/phase7-wave9.md sections 3.6 and 3.11. The printed precon
 * `maria-hill-leadership` against Rhino; supports are staged with their counters and carry no abilities of their own.
 * S.H.I.E.L.D. supports used: Support Staff 50008 (cost 1, staff), Command Team 50016 (cost 2, command), Sky-Destroyer
 * 50057 (cost 3, defines no counter type; swapped in for a Front Organization), The Iliad 50009 (cost 6, mission). The
 * Front Organization 50028 has no S.H.I.E.L.D. trait. Core minions stand in as enemies: Shocker 01103 (3 hit points).
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, MARIA_HILL_IDENTITY, MARIA_HILL_EVENTS) };

const BULLETIN = "50003.all-points-bulletin-action";
const DOUBLE = "50004.on-the-double-action";
const REINFORCE = "50005.reinforcements-action";
const CALL = "50006.the-hard-call-action";
const FUNDING = "50007.special-funding-response";

const STAFF = "50008";
const ILIAD = "50009";
const COMMAND = "50016";
const FRONT = "50028";
const SKY = "50057";
const SHOCKER = "01103";

const SWAP = { "50028": SKY };
const heroGame = () => mariaHeroGame(1, SWAP);
const egoGame = () => mariaGame(1, SWAP);

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const exhaust = (s: GameState, id: InstanceId): GameState => patchInstance(s, id, { exhausted: true });
const discardCodes = (s: GameState): string[] => playerOf(s, P1).discard.map((id) => s.instances[id]!.cardId as string);
const cardOf = <T>(code: string): T => AOS_CARDS.find((c) => c.id === cardId(code)) as T;

/** Answers a chooseCards prompt with `ids` (when they are all offered), a trigger prompt with the ref `respond`. */
const picking =
  (opts: { readonly cards?: readonly InstanceId[]; readonly respond?: string } = {}): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "chooseTriggers" && opts.respond) {
      const hit = offered.find((o) => o.includes(opts.respond!));
      return hit ? [hit] : firstLegal(s);
    }
    if (opts.cards && choice.prompt.kind === "chooseCards") return opts.cards.filter((c) => offered.includes(c));
    return firstLegal(s);
  };

/** Offered ids of the first chooseCards prompt reached while `code` is played for `cost`. */
function offeredCards(state: GameState, code: string, cost: number): { offered: string[]; kind: string } {
  const given = moveToHand(state, P1, code);
  const event = given.ids[0]!;
  const result = applyCommand(given.state, play(P1, event, payWith(given.state, P1, cost, [event])), DEPS);
  if (!result.ok) throw new Error(result.error.message);
  const choice = result.state.pendingChoice!;
  return { offered: choice.options.map((o) => o.optionId as string), kind: choice.prompt.kind };
}

/** Plays the event `code` for `cost` (paid with other hand cards), answering each prompt with `pick`. */
function playEvent(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
  extra: Parameters<typeof play>[3] = {},
) {
  const given = moveToHand(state, P1, code);
  const event = given.ids[0]!;
  const handGiven = playerOf(given.state, P1).hand.length;
  const result = driveEventsPicking(
    DEPS,
    given.state,
    pick,
    play(P1, event, payWith(given.state, P1, cost, [event]), extra),
  );
  return { ...result, handGiven };
}

/** Whether resolving the first prompt of `code` (paid `cost`) with exactly `ids` is accepted. */
function accepts(state: GameState, code: string, cost: number, ids: readonly InstanceId[]): boolean {
  const given = moveToHand(state, P1, code);
  const event = given.ids[0]!;
  const started = applyCommand(given.state, play(P1, event, payWith(given.state, P1, cost, [event])), DEPS);
  if (!started.ok) throw new Error(started.error.message);
  const choice = started.state.pendingChoice!;
  return applyCommand(
    started.state,
    { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: [...ids] },
    DEPS,
  ).ok;
}

/** Whether `code` can be started at all (an event with no legal use is refused, RRG 1.8 "Play", p. 33). */
function playable(state: GameState, code: string, cost: number): boolean {
  const given = moveToHand(state, P1, code);
  const event = given.ids[0]!;
  return applyCommand(given.state, play(P1, event, payWith(given.state, P1, cost, [event])), DEPS).ok;
}

describe("Maria Hill events registry", () => {
  it("registers the four scripted refs, each validating, and skips only All-Points Bulletin", () => {
    expect(Object.keys(MARIA_HILL_EVENTS).sort()).toEqual([DOUBLE, REINFORCE, CALL, FUNDING].sort());
    for (const ref of Object.keys(MARIA_HILL_EVENTS))
      expect(validateDefinition(MARIA_HILL_EVENTS[ref]!), ref).toEqual([]);
    expect(Object.keys(MARIA_HILL_EVENTS_SKIPPED)).toEqual([BULLETIN]);
    expect(MARIA_HILL_EVENTS_SKIPPED[BULLETIN]).toMatch(/repeat/);
  });
  it("registered and skipped refs together are exactly the refs the five cards print", () => {
    const printed = ["50003", "50004", "50005", "50006", "50007"].flatMap((code) =>
      cardOf<{ abilities: { id: string }[] }>(code).abilities.map((a) => a.id),
    );
    expect([...Object.keys(MARIA_HILL_EVENTS), ...Object.keys(MARIA_HILL_EVENTS_SKIPPED)].sort()).toEqual(
      [...printed].sort(),
    );
  });
  it("triggers: On the Double and Reinforcements are Actions, The Hard Call a Hero Action, Special Funding a Response", () => {
    expect(MARIA_HILL_EVENTS[DOUBLE]!.trigger).toMatchObject({ kind: "action" });
    expect(MARIA_HILL_EVENTS[DOUBLE]!.trigger).not.toHaveProperty("form");
    expect(MARIA_HILL_EVENTS[REINFORCE]!.trigger).toMatchObject({ kind: "action" });
    expect(MARIA_HILL_EVENTS[REINFORCE]!.trigger).not.toHaveProperty("form");
    expect(MARIA_HILL_EVENTS[CALL]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(MARIA_HILL_EVENTS[FUNDING]!.trigger).toMatchObject({ kind: "response", forced: false });
  });
  it("printed costs and icons: 2 energy, 0 energy, 1 physical, 2 mental; Special Funding makes mental and physical", () => {
    for (const [code, cost, icons] of [
      ["50003", 2, { energy: 1 }],
      ["50004", 0, { energy: 1 }],
      ["50005", 1, { physical: 1 }],
      ["50006", 2, { mental: 1 }],
    ] as const) {
      expect(cardOf<EventCard>(code).cost, code).toBe(cost);
      expect(cardOf<EventCard>(code).resourceIcons, code).toEqual(icons);
    }
    expect(cardOf<ResourceCard>("50007").producesIcons).toEqual({ mental: 1, physical: 1 });
  });
});

describe(`${DOUBLE} (On the Double 50004): ready any number of S.H.I.E.L.D. supports, combined printed cost 6 or less`, () => {
  it("costs 0: no card is discarded for it, and it is discarded after it resolves", () => {
    const base = inPlay(egoGame(), ILIAD, { mission: 3 });
    const staged = exhaust(base.state, base.id);
    const { state, handGiven } = playEvent(staged, "50004", 0, picking({ cards: [base.id] }));
    expect(playerOf(state, P1).hand).toHaveLength(handGiven - 1);
    expect(discardCodes(state)).toContain("50004");
  });
  it("The Iliad (6) alone is allowed: it readies, its counters unchanged", () => {
    const a = inPlay(egoGame(), ILIAD, { mission: 3 });
    const staged = exhaust(a.state, a.id);
    const { state } = playEvent(staged, "50004", 0, picking({ cards: [a.id] }));
    expect(inst(state, a.id).exhausted).toBe(false);
    expect(inst(state, a.id).counters).toEqual({ mission: 3 });
  });
  it("Support Staff (1), Command Team (2) and Sky-Destroyer (3), total exactly 6, all ready", () => {
    let s = egoGame();
    const staff = inPlay(s, STAFF, { staff: 3 });
    const command = inPlay(staff.state, COMMAND, { command: 3 });
    const sky = inPlay(command.state, SKY);
    s = [staff.id, command.id, sky.id].reduce((acc, id) => exhaust(acc, id), sky.state);
    const { state } = playEvent(s, "50004", 0, picking({ cards: [staff.id, command.id, sky.id] }));
    for (const id of [staff.id, command.id, sky.id]) expect(inst(state, id).exhausted, id).toBe(false);
  });
  it("The Iliad and Support Staff (7) are refused, as are The Iliad and Command Team (8); The Iliad alone fits", () => {
    const iliad = inPlay(egoGame(), ILIAD, { mission: 3 });
    const staff = inPlay(iliad.state, STAFF, { staff: 3 });
    const command = inPlay(staff.state, COMMAND, { command: 3 });
    const staged = [iliad.id, staff.id, command.id].reduce((acc, id) => exhaust(acc, id), command.state);
    expect(accepts(staged, "50004", 0, [iliad.id, staff.id])).toBe(false);
    expect(accepts(staged, "50004", 0, [iliad.id, command.id])).toBe(false);
    expect(accepts(staged, "50004", 0, [iliad.id])).toBe(true);
    expect(accepts(staged, "50004", 0, [staff.id, command.id])).toBe(true);
  });
  it("offers only exhausted S.H.I.E.L.D. supports: a ready one and a Front Organization are not offered", () => {
    const exhaustedOne = inPlay(egoGame(), STAFF, { staff: 3 });
    const readyOne = inPlay(exhaustedOne.state, COMMAND, { command: 3 });
    const front = inPlay(readyOne.state, FRONT);
    const staged = exhaust(exhaust(front.state, exhaustedOne.id), front.id);
    const { offered, kind } = offeredCards(staged, "50004", 0);
    expect(kind).toBe("chooseCards");
    expect(offered).toEqual([exhaustedOne.id]);
  });
  it("cannot be played while every S.H.I.E.L.D. support is ready (spec 3.11), nor with none in play", () => {
    const ready = inPlay(egoGame(), ILIAD, { mission: 3 });
    expect(playable(ready.state, "50004", 0)).toBe(false);
    expect(playable(egoGame(), "50004", 0)).toBe(false);
  });
  it("cannot be played when the only exhausted support is not a S.H.I.E.L.D. support", () => {
    const front = inPlay(egoGame(), FRONT);
    expect(playable(exhaust(front.state, front.id), "50004", 0)).toBe(false);
  });
  it("is playable once a S.H.I.E.L.D. support is exhausted, in alter-ego and in hero form", () => {
    for (const make of [egoGame, heroGame]) {
      const a = inPlay(make(), ILIAD, { mission: 3 });
      expect(playable(exhaust(a.state, a.id), "50004", 0)).toBe(true);
    }
  });
  it("choosing none is legal: the supports stay exhausted and the event is still spent", () => {
    const a = inPlay(egoGame(), ILIAD, { mission: 3 });
    const { state } = playEvent(exhaust(a.state, a.id), "50004", 0, picking({ cards: [] }));
    expect(inst(state, a.id).exhausted).toBe(true);
    expect(discardCodes(state)).toContain("50004");
  });
});

describe(`${REINFORCE} (Reinforcements 50005): 1 all-purpose counter on each chosen S.H.I.E.L.D. support`, () => {
  it("costs 1: one other card is discarded and the event goes to the discard pile", () => {
    const a = inPlay(egoGame(), ILIAD, { mission: 3 });
    const { state, events, handGiven } = playEvent(a.state, "50005", 1, picking({ cards: [a.id] }));
    expect(playerOf(state, P1).hand).toHaveLength(handGiven - 2);
    expect(discardCodes(state)).toContain("50005");
    expect(events.filter((e: GameEvent) => e.type === "cardDiscardedFromHand")).toHaveLength(1);
  });
  it("The Iliad (6) alone: the counter becomes a mission counter, 3 to 4", () => {
    const a = inPlay(egoGame(), ILIAD, { mission: 3 });
    const { state } = playEvent(a.state, "50005", 1, picking({ cards: [a.id] }));
    expect(inst(state, a.id).counters).toEqual({ mission: 4 });
  });
  it("Support Staff, Command Team and Sky-Destroyer (total 6): staff 4, command 4, and 1 plain all-purpose counter", () => {
    const staff = inPlay(egoGame(), STAFF, { staff: 3 });
    const command = inPlay(staff.state, COMMAND, { command: 3 });
    const sky = inPlay(command.state, SKY);
    const { state } = playEvent(sky.state, "50005", 1, picking({ cards: [staff.id, command.id, sky.id] }));
    expect(inst(state, staff.id).counters).toEqual({ staff: 4 });
    expect(inst(state, command.id).counters).toEqual({ command: 4 });
    expect(inst(state, sky.id).counters).toEqual({ allPurpose: 1 });
  });
  it("The Iliad and Support Staff (7) are refused; one more than the cap is not allowed, exactly 6 is", () => {
    const iliad = inPlay(egoGame(), ILIAD, { mission: 3 });
    const staff = inPlay(iliad.state, STAFF, { staff: 3 });
    const command = inPlay(staff.state, COMMAND, { command: 3 });
    expect(accepts(command.state, "50005", 1, [iliad.id, staff.id])).toBe(false);
    expect(accepts(command.state, "50005", 1, [iliad.id])).toBe(true);
    expect(accepts(command.state, "50005", 1, [staff.id, command.id])).toBe(true);
  });
  it("a Front Organization (no S.H.I.E.L.D. trait) is not offered", () => {
    const front = inPlay(egoGame(), FRONT);
    const staff = inPlay(front.state, STAFF, { staff: 3 });
    expect(offeredCards(staff.state, "50005", 1).offered).toEqual([staff.id]);
  });
  it("choosing none is legal and places nothing", () => {
    const a = inPlay(egoGame(), ILIAD, { mission: 3 });
    const { state } = playEvent(a.state, "50005", 1, picking({ cards: [] }));
    expect(inst(state, a.id).counters).toEqual({ mission: 3 });
    expect(discardCodes(state)).toContain("50005");
  });
  it("with no S.H.I.E.L.D. support in play it still plays and does nothing", () => {
    expect(playable(egoGame(), "50005", 1)).toBe(true);
    const { state } = playEvent(egoGame(), "50005", 1);
    expect(discardCodes(state)).toContain("50005");
  });
  it("is playable in hero form too (an Action, not a Hero Action)", () => {
    const a = inPlay(heroGame(), ILIAD, { mission: 3 });
    const { state } = playEvent(a.state, "50005", 1, picking({ cards: [a.id] }));
    expect(inst(state, a.id).counters).toEqual({ mission: 4 });
  });
});

describe(`${CALL} (The Hard Call 50006): discard a S.H.I.E.L.D. support you control, X damage to each enemy`, () => {
  it("costs 2; discarding The Iliad (printed 6) deals 6 to Rhino and defeats Shocker (3 hit points)", () => {
    const a = inPlay(heroGame(), ILIAD, { mission: 3 });
    const staged = engageHillMinion(a.state, SHOCKER, "shocker");
    const { state, handGiven } = playEvent(staged, "50006", 2);
    expect(inst(state, villainOf(state)).damage).toBe(6);
    expect(playerOf(state, P1).playArea).not.toContain("shocker" as InstanceId);
    expect(playerOf(state, P1).discard).toContain(a.id);
    expect(playerOf(state, P1).playArea).not.toContain(a.id);
    expect(playerOf(state, P1).hand).toHaveLength(handGiven - 3);
    expect(discardCodes(state)).toContain("50006");
  });
  it("X is the printed cost, not the counters: Support Staff (1) deals 1 to each enemy", () => {
    const a = inPlay(heroGame(), STAFF, { staff: 3 });
    const staged = engageHillMinion(a.state, SHOCKER, "shocker");
    const { state } = playEvent(staged, "50006", 2);
    expect(inst(state, villainOf(state)).damage).toBe(1);
    expect(inst(state, "shocker" as InstanceId).damage).toBe(1);
  });
  it("Sky-Destroyer (3) deals 3: the villain and a minion both take it", () => {
    const a = inPlay(heroGame(), SKY);
    const staged = engageHillMinion(a.state, "01102", "sandman");
    const { state } = playEvent(staged, "50006", 2);
    expect(inst(state, villainOf(state)).damage).toBe(3);
    expect(inst(state, "sandman" as InstanceId).damage).toBe(3);
  });
  it("with several S.H.I.E.L.D. supports the player picks which one is discarded", () => {
    const staff = inPlay(heroGame(), STAFF, { staff: 3 });
    const iliad = inPlay(staff.state, ILIAD, { mission: 3 });
    const { state } = playEvent(iliad.state, "50006", 2, firstLegal, { costChoices: { discarded: [staff.id] } });
    expect(inst(state, villainOf(state)).damage).toBe(1);
    expect(playerOf(state, P1).playArea).toContain(iliad.id);
  });
  it("cannot be played without a S.H.I.E.L.D. support to discard, or with only a Front Organization", () => {
    expect(playable(heroGame(), "50006", 2)).toBe(false);
    const front = inPlay(heroGame(), FRONT);
    expect(playable(front.state, "50006", 2)).toBe(false);
  });
  it("is a Hero Action: refused in alter-ego form even with a support in play", () => {
    const a = inPlay(egoGame(), ILIAD, { mission: 3 });
    expect(playable(a.state, "50006", 2)).toBe(false);
  });
});

describe(`${FUNDING} (Special Funding 50007): 1 all-purpose counter on the S.H.I.E.L.D. support it paid for`, () => {
  const fundingCopies = (s: GameState): InstanceId[] =>
    playerOf(s, P1).hand.filter((id) => s.instances[id]!.cardId === cardId("50007"));
  /** Plays support `code` paying with Special Funding plus `extra` other cards. */
  function playPaidBySpecialFunding(state: GameState, code: string, extra = 0) {
    const given = moveToHand(state, P1, code, "50007");
    const [support, funding] = given.ids as [InstanceId, InstanceId];
    const result = driveEventsPicking(
      DEPS,
      given.state,
      picking({ respond: "50007" }),
      play(P1, support, [funding, ...payWith(given.state, P1, extra, [support, ...fundingCopies(given.state)])]),
    );
    return { ...result, support, funding };
  }

  it("Support Staff (cost 1) paid with Special Funding: enters with 3 staff counters and gains one more", () => {
    const { state, support, funding } = playPaidBySpecialFunding(egoGame(), STAFF);
    expect(playerOf(state, P1).playArea).toContain(support);
    expect(inst(state, support).counters).toEqual({ staff: 4 });
    expect(playerOf(state, P1).discard).toContain(funding);
  });
  it("Command Team (cost 2): Special Funding's two icons pay it exactly, command 3 to 4", () => {
    const { state, support } = playPaidBySpecialFunding(egoGame(), COMMAND);
    expect(inst(state, support).counters).toEqual({ command: 4 });
  });
  it("Sky-Destroyer (cost 3, defines no type) paid with Special Funding and 1 more card gets 1 plain all-purpose counter", () => {
    const { state, support } = playPaidBySpecialFunding(egoGame(), SKY, 1);
    expect(inst(state, support).counters).toEqual({ allPurpose: 1 });
  });
  it("works in hero form too (a Response on a resource card has no form)", () => {
    const { state, support } = playPaidBySpecialFunding(heroGame(), STAFF);
    expect(inst(state, support).counters).toEqual({ staff: 4 });
  });
  it("the counter goes on the support paid for, not on another S.H.I.E.L.D. support already in play", () => {
    const other = inPlay(egoGame(), ILIAD, { mission: 3 });
    const { state, support } = playPaidBySpecialFunding(other.state, STAFF);
    expect(inst(state, other.id).counters).toEqual({ mission: 3 });
    expect(inst(state, support).counters).toEqual({ staff: 4 });
  });
  it("does nothing when the support is paid for with other cards", () => {
    const given = moveToHand(egoGame(), P1, STAFF);
    const support = given.ids[0]!;
    const { state } = driveEventsPicking(
      DEPS,
      given.state,
      picking({ respond: "50007" }),
      play(P1, support, payWith(given.state, P1, 1, [support, ...fundingCopies(given.state)])),
    );
    expect(inst(state, support).counters).toEqual({ staff: 3 });
  });
  it("does nothing when it pays for an event (a support must be paid for), and no later support gains a counter", () => {
    const given = moveToHand(egoGame(), P1, "50005", "50007");
    const [event, funding] = given.ids as [InstanceId, InstanceId];
    const a = inPlay(given.state, ILIAD, { mission: 3 });
    const { state } = driveEventsPicking(
      DEPS,
      a.state,
      picking({ respond: "50007", cards: [a.id] }),
      play(P1, event, [funding]),
    );
    // Reinforcements itself adds 1 mission counter; Special Funding adds nothing.
    expect(inst(state, a.id).counters).toEqual({ mission: 4 });
    const later = playPaidBySpecialFunding(state, COMMAND);
    expect(inst(later.state, later.support).counters).toEqual({ command: 4 });
    expect(inst(later.state, a.id).counters).toEqual({ mission: 4 });
  });
});
