/**
 * Competitive card audit, group 4 (docs/competitive-card-audit.md): the Synthezoid Smackdown leader player cards,
 * She-Hulk 57032 to 57035 (played by the registration team, p1) and Vision 57074 to 57077 (57076 and 57077 played by
 * the resistance team, p2; 57074 and 57075 by p1, which only changes which leader is "your leader"), each in a real
 * two-team game (`./two-team.ts`). For p1 "your leader" is leader two (in p2's area) and "the enemy leader" is leader
 * one; for p2 the other way round. 57075 follows reading A of docs/competitive-mode-plan.md section 1.10 (bullets
 * checked once, then the flip; FFG ruling Feb 28, 2026 #5).
 *
 * Sources: the cards' printed text (data `synthezoid`), MC56 p. 16 (a leader attacking a leader: one boost card from
 * the deck of the area the attacker sits in, no defender), pp. 16-17, 20 (scenario rules override RRG per Golden Rule,
 * RRG p. 4); owner decisions Q5, Q6, Q11, N11 of docs/competitive-mode-plan.md section 1.10; RRG v1.8 "Interrupt"
 * p. 24, "Response" p. 38, "Then" p. 44, "Search" p. 39; Phased Out's current text from the errata of RRG v1.8 p. 70
 * and the March 19, 2026 ruling (Hero Action, not Hero Interrupt).
 */

import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { firstLegal, inst, playerOf, type Picker } from "../../../../testing/harness.js";
import {
  P1,
  P2,
  acceptAll,
  attachFromDeck,
  boost,
  endTurn,
  give,
  leadersOf,
  patch,
  play,
  realCards,
  resolved,
  run,
  schemesOf,
  stubAttachment,
  twoTeamGame,
  typedResource,
} from "./two-team.js";

vi.setConfig({ testTimeout: 120_000 });

const OUT_OF_ORDER = "57032";
const SMASH = "57033";
const MAKE_ME_ANGRY = "57034";
const LEGAL_COUNSEL = "57035";
const CALCULATED_RISK = "57074";
const SYNTHEZOID_STRIKE = "57075";
const PHASED_OUT = "57076";
const ANDROID_ASSISTANCE = "57077";
const FIGHTING_DIRTY = "56208";
const DENSE = "57046a";

const NO_BOOST = boost("no-boost", 0);
const BIG_BOOST = boost("big-boost", 4);
/** Encounter cards to pick out of a searched deck: one within the top 5, one below it. */
const RISK_TOP = boost("risk-top", 0);
const RISK_DEEP = boost("risk-deep", 0);
const PHYSICAL = typedResource("res-physical", "physical");
const ENERGY = typedResource("res-energy", "energy");
const MENTAL = typedResource("res-mental", "mental");
const GEAR = stubAttachment({ id: "hero-gear", attachesTo: { kind: "anyCard" } });

const SEAT_CARDS = [
  OUT_OF_ORDER,
  SMASH,
  MAKE_ME_ANGRY,
  LEGAL_COUNSEL,
  CALCULATED_RISK,
  SYNTHEZOID_STRIKE,
  PHASED_OUT,
  ANDROID_ASSISTANCE,
  FIGHTING_DIRTY,
  ...[1, 2, 3, 4, 5, 6].flatMap(() => [PHYSICAL.id as string, ENERGY.id as string, MENTAL.id as string]),
];

function game(options: { deckOne?: readonly string[]; deckTwo?: readonly string[] } = {}) {
  return twoTeamGame({
    ...options,
    filler: NO_BOOST,
    extraCards: [
      BIG_BOOST,
      RISK_TOP,
      RISK_DEEP,
      PHYSICAL,
      ENERGY,
      MENTAL,
      GEAR,
      ...realCards(
        OUT_OF_ORDER,
        SMASH,
        MAKE_ME_ANGRY,
        LEGAL_COUNSEL,
        CALCULATED_RISK,
        SYNTHEZOID_STRIKE,
        PHASED_OUT,
        ANDROID_ASSISTANCE,
        FIGHTING_DIRTY,
        DENSE,
      ),
    ],
    seatCards: SEAT_CARDS,
  });
}

type Game = ReturnType<typeof game>;
type Seat = typeof P1 | typeof P2;
const identityOf = (state: GameState, player: Seat): InstanceId => playerOf(state, player).identity.instanceId;

/** p2's turn: p1 ends its hero turn first. */
const toResistance = (deps: Game["deps"], state: GameState) => run(deps, state, firstLegal, endTurn(P1)).state;

/** Gives `player` `code` and `n` resources of `payCode` (surgery). */
function hand(state: GameState, player: Seat, code: string, payCode: string, n: number) {
  const card = give(state, player, code);
  const paid: InstanceId[] = [];
  let current = card.state;
  for (let i = 0; i < n; i += 1) {
    const next = give(current, player, payCode, paid);
    paid.push(next.id);
    current = next.state;
  }
  return { state: current, id: card.id, paid };
}

/**
 * A resource card of `player` spent to pay for an upgrade played on their identity: the "when/after you spend it"
 * window.
 */
function spendResource(deps: Game["deps"], state: GameState, player: Seat, code: string) {
  const upgrade = give(state, player, "upgrade");
  const resource = give(upgrade.state, player, code);
  return run(deps, resource.state, acceptAll, play(player, upgrade.id, [resource.id], identityOf(state, player)));
}

const attacked = (events: readonly GameEvent[], attacker: InstanceId, target: InstanceId) =>
  events.some(
    (e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === attacker && e.targetInstanceId === target,
  );

describe("You're Out of Order! (57032): threat that would be placed on the main scheme, prevent 3 of it", () => {
  /** Leader one (p1's enemy) schemes in the villain phase with a 4-icon boost card. */
  function villainPhase(holdsCard: boolean) {
    const { state: start, deps } = game({ deckOne: [BIG_BOOST.id as string] });
    const { one: schemeOne } = schemesOf(start);
    // p1 ends its turn first (a hand-size prompt would discard the card), then holds the card through the villain
    // phase.
    const afterP1 = toResistance(deps, start);
    const base = holdsCard ? hand(afterP1, P1, OUT_OF_ORDER, ENERGY.id as string, 1).state : afterP1;
    // Accept every trigger and payment, but keep the card out of the hand-size discard the hand surgery causes.
    const keep = hand(afterP1, P1, OUT_OF_ORDER, ENERGY.id as string, 1).id;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "discardDownToHandSize")
        return choice.options.map((o) => o.optionId as string).filter((id) => id !== (keep as string));
      // Pay for the event with one energy resource, never with the event itself.
      if (choice.prompt.kind === "payForCard")
        return [choice.options.find((o) => (o as { label?: string }).label === ENERGY.id)!.optionId as string];
      return acceptAll(s);
    };
    const result = run(deps, base, pick, endTurn(P2));
    return { ...result, schemeOne, before: inst(start, schemeOne).threat };
  }

  it("step 1 places 1 threat on p1's own main scheme; the card prevents all of it (up to 3), and resolves once", () => {
    const without = villainPhase(false);
    const withCard = villainPhase(true);
    expect(inst(without.state, without.schemeOne).threat).toBe(without.before + 1);
    expect(inst(withCard.state, withCard.schemeOne).threat).toBe(withCard.before);
    expect(resolved(withCard.events, "57032.youre-out-of-order-interrupt")).toBe(1);
  });
});

describe("She-Hulk Smash (57033): your She-Hulk leader attacks the enemy leader; [physical] stuns it", () => {
  function smash(payCode: string) {
    const { state: start, deps } = game({ deckTwo: [BIG_BOOST.id as string] });
    const { one, two } = leadersOf(start);
    const given = hand(start, P1, SMASH, payCode, 2);
    const result = run(deps, given.state, acceptAll, play(P1, given.id, given.paid));
    return { ...result, one, two };
  }

  it("leader two (your leader) attacks leader one, a boost card from its own area's deck, no defender (2+4)", () => {
    const r = smash(PHYSICAL.id as string);
    expect(attacked(r.events, r.two, r.one)).toBe(true);
    expect(r.events.some((e) => e.type === "defenderDeclared")).toBe(false);
    expect(inst(r.state, r.one).damage).toBe(6);
  });

  it("paid with [physical]: the enemy leader (leader one) is stunned, your leader is not", () => {
    const r = smash(PHYSICAL.id as string);
    expect(inst(r.state, r.one).statuses.stunned).toBe(1);
    expect(inst(r.state, r.two).statuses.stunned).toBe(0);
  });

  it("paid with [energy] only: the attack lands, nothing is stunned", () => {
    const r = smash(ENERGY.id as string);
    expect(inst(r.state, r.one).damage).toBe(6);
    expect(inst(r.state, r.one).statuses.stunned).toBe(0);
  });
});

describe("Make Me Angry (57034): after a hero or leader attacks She-Hulk, she attacks back, then discard", () => {
  function attached() {
    const { state: start, deps } = game({ deckOne: [BIG_BOOST.id as string], deckTwo: [BIG_BOOST.id as string] });
    const { one, two } = leadersOf(start);
    const given = hand(start, P1, MAKE_ME_ANGRY, PHYSICAL.id as string, 1);
    const played = run(deps, given.state, acceptAll, play(P1, given.id, given.paid, two));
    return { deps, one, two, card: given.id, state: toResistance(deps, played.state) };
  }

  it("attaches to your leader (leader two, in p2's area)", () => {
    const a = attached();
    expect(inst(a.state, a.card).attachedTo).toBe(a.two);
  });

  it("a hero attacks her: she attacks that hero in turn, and the card is discarded", () => {
    const a = attached();
    const hero = identityOf(a.state, P2);
    const { state, events } = run(a.deps, a.state, acceptAll, {
      type: "basicAttack",
      playerId: P2,
      attackerInstanceId: hero,
      targetInstanceId: a.two,
    } as never);
    expect(resolved(events, "57034.make-me-angry-forced-response")).toBe(1);
    expect(
      events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === a.two && e.targetInstanceId === hero),
    ).toBe(true);
    expect(playerOf(state, P1).discard).toContain(a.card);
  });

  it("the other leader attacks her (Fighting Dirty): she attacks that leader back, leader versus leader", () => {
    const a = attached();
    const given = hand(a.state, P2, FIGHTING_DIRTY, PHYSICAL.id as string, 2);
    const { state, events } = run(a.deps, given.state, acceptAll, play(P2, given.id, given.paid));
    expect(attached_(events, a.one, a.two)).toBe(true);
    expect(attacked(events, a.two, a.one)).toBe(true);
    expect(resolved(events, "57034.make-me-angry-forced-response")).toBe(1);
    expect(playerOf(state, P1).discard).toContain(a.card);
  });
});

/** Leader `attacker` attacked leader `target`. */
const attached_ = attacked;

describe("Legal Counsel (57035): after you spend it, move 1 threat from the main scheme to your leader's", () => {
  const { state: start, deps } = game();
  const { one: schemeOne, two: schemeTwo } = schemesOf(start);
  const seeded = patch(start, schemeOne, { threat: 5 });
  const { state } = spendResource(deps, seeded, P1, LEGAL_COUNSEL);

  it("p1's main scheme (leader one's) loses 1 and leader two's main scheme, in p2's area, gains 1", () => {
    expect(inst(state, schemeOne).threat).toBe(4);
    expect(inst(state, schemeTwo).threat - inst(seeded, schemeTwo).threat).toBe(1);
  });
});

describe("Calculated Risk (57074): search your leader's deck's top 5, deal one to the enemy first player", () => {
  const FILL = NO_BOOST.id as string;
  const { state: start, deps } = game({
    deckTwo: [FILL, FILL, RISK_TOP.id as string, FILL, FILL, FILL, RISK_DEEP.id as string],
  });
  const { deckOne, deckTwo } = leadersOf(start);
  const marker = (code: string) => start.encounterDecks[deckTwo]!.deck.find((i) => inst(start, i).cardId === code)!;
  const top = marker(RISK_TOP.id as string);
  const deep = marker(RISK_DEEP.id as string);
  let offered: readonly string[] = [];
  const pickTop: Picker = (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseCards") {
      offered = choice.options.map((o) => JSON.stringify(o.ref));
      return [choice.options.find((o) => JSON.stringify(o.ref).includes(top as string))!.optionId as string];
    }
    return acceptAll(s);
  };
  const given = hand(start, P1, CALCULATED_RISK, ENERGY.id as string, 2);
  const { state, events } = run(deps, given.state, pickTop, play(P1, given.id, given.paid));
  const shuffledDecks = events.flatMap((e) =>
    e.type === "deckShuffled" && e.zone.kind === "encounterDeck" ? [e.zone.deckId as string] : [],
  );

  it("p1 searches leader two's deck (in p2's area): exactly its top 5 are offered, not a card below them", () => {
    expect(resolved(events, "57074.calculated-risk-action")).toBe(1);
    expect(offered).toHaveLength(5);
    expect(offered.some((ref) => ref.includes(top as string))).toBe(true);
    expect(offered.some((ref) => ref.includes(deep as string))).toBe(false);
  });

  it("the card is dealt facedown to p2, the first player on the enemy team, and leaves that deck", () => {
    expect(playerOf(state, P2).dealtEncounter).toContain(top);
    expect(playerOf(state, P1).dealtEncounter).not.toContain(top);
    expect(state.encounterDecks[deckTwo]!.deck).not.toContain(top);
    expect(inst(state, top).faceup).toBe(false);
  });

  it("then leader two's deck is shuffled (RRG Search p. 39), and p1's own deck is not", () => {
    expect(shuffledDecks).toContain(deckTwo as string);
    expect(shuffledDecks).not.toContain(deckOne as string);
  });
});

describe("Synthezoid Strike (57075): leader attack; Dense: +1 ATK and piercing; Intangible: flip first", () => {
  /** Leader two (p1's "your leader") holds the mass form attachment, Dense side up or flipped to Intangible. */
  function strike(face: "Dense" | "Intangible", tough = false) {
    const { state: start, deps } = game({ deckTwo: [DENSE] });
    const { one, two, deckTwo } = leadersOf(start);
    const dense = attachFromDeck(start, deckTwo, DENSE, two);
    let state = face === "Intangible" ? patch(dense.state, dense.id, { flipped: true }) : dense.state;
    if (tough) state = patch(state, one, { statuses: { ...inst(state, one).statuses, tough: 1 } });
    const given = hand(state, P1, SYNTHEZOID_STRIKE, ENERGY.id as string, 2);
    const result = run(deps, given.state, acceptAll, play(P1, given.id, given.paid));
    return { ...result, one, two, attachment: dense.id };
  }

  it("Dense: leader two hits leader one for ATK 2 + Dense's printed 1 + this card's 1, no defender", () => {
    const r = strike("Dense");
    expect(attacked(r.events, r.two, r.one)).toBe(true);
    expect(r.events.some((e) => e.type === "defenderDeclared")).toBe(false);
    expect(inst(r.state, r.one).damage).toBe(4);
    expect(inst(r.state, r.attachment).flipped).toBe(false);
  });

  it("Dense: the attack gains piercing, so the enemy leader's tough status card does not stop it", () => {
    const r = strike("Dense", true);
    expect(inst(r.state, r.one).statuses.tough).toBe(0);
    expect(inst(r.state, r.one).damage).toBe(4);
  });

  it("Intangible: flips to Dense first; Dense's printed +1 ATK applies, not this card's +1 or piercing", () => {
    const r = strike("Intangible");
    expect(inst(r.state, r.attachment).flipped).toBe(false);
    expect(inst(r.state, r.one).damage).toBe(3);
    const toughened = strike("Intangible", true);
    expect(inst(toughened.state, toughened.one).statuses.tough).toBe(0);
    expect(inst(toughened.state, toughened.one).damage).toBe(0);
  });
});

describe("Phased Out (57076): discard an attachment on the enemy leader with Hero Action or Hero Response", () => {
  it("chooses among the enemy leader's attachments that print a Hero Action or Hero Response (current text)", () => {
    const { deps } = game();
    const ability = deps.abilities["57076.phased-out-action"]!;
    const choose = (ability.effects as readonly { kind: string; query?: unknown }[]).find(
      (e) => e.kind === "chooseTarget",
    ) as { query: { host: unknown; printsAbility: unknown } };
    expect(choose.query.host).toEqual({ kind: "leader", of: "enemy" });
    expect(choose.query.printsAbility).toEqual({ kinds: ["action", "response"], form: "hero" });
  });
});

describe("Android Assistance (57077): when you spend it, flip your Vision leader's mass form attachment", () => {
  const { state: start, deps } = game({ deckOne: [DENSE] });
  const { one, deckOne } = leadersOf(start);
  const dense = attachFromDeck(start, deckOne, DENSE, one);
  const turn = toResistance(deps, dense.state);
  const { state } = spendResource(deps, turn, P2, ANDROID_ASSISTANCE);

  it("flips the attachment on leader one (your leader, the other team's area), which stays attached", () => {
    expect(inst(state, dense.id).attachedTo).toBe(one);
    expect(inst(turn, dense.id).flipped).toBe(false);
    expect(inst(state, dense.id).flipped).toBe(true);
  });
});
