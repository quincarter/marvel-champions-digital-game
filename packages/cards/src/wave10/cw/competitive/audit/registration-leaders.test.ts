/**
 * Competitive card audit, group 1 (docs/competitive-card-audit.md): the registration leaders' player cards, the Iron Man
 * leader's 56129 to 56132 and the Captain Marvel leader's 56133 to 56136 (MC56 p. 3). Each card is played by the
 * registration team (p1) in a real two-team game (`./two-team.ts`); for p1 "your leader" is leader two and "the enemy
 * leader" is leader one.
 *
 * Sources: the cards' printed text (data `cw`), MC56 p. 16 (a leader attacking a leader: one boost card from the deck of
 * the area the attacker sits in, turned by the first player of the team in that area, no defender), pp. 16-17, 20
 * (scenario rules override RRG per Golden Rule, RRG p. 4); owner decisions Q5, Q6, Q11 (the inactive team's triggered
 * abilities fire in the other team's phase, it takes no actions), N11 of docs/competitive-mode-plan.md section 1.10;
 * RRG v1.8 "Interrupt" p. 24 (a "would" interrupt resolves before the attack initiates), "Response" p. 38.
 */

import type { AbilityDefinition, GameState, InstanceId } from "@mc/engine";
import { traitsOf } from "@mc/engine";
import { trait } from "@mc/content";
import { describe, expect, it, vi } from "vitest";
import {
  addCounters,
  defineAbilities,
  each,
  heal,
  host,
  on,
  query,
  response,
  yourLeader,
} from "../../../../dsl/index.js";
import { firstLegal, inst, playerOf } from "../../../../testing/harness.js";
import {
  P1,
  P2,
  acceptAll,
  attachFromDeck,
  boost,
  boostsDealtTo,
  endTurn,
  give,
  intoPlay,
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

const THE_FUTURIST = "56129";
const TARGET_LOCK = "56130";
const HIGH_TECH_SUIT = "56131";
const SUIT_UP = "56132";
const PROVOKED_RESPONSE = "56133";
const YOU_STARTED_THIS = "56134";
const ALPHA_FLIGHT_RECRUIT = "56135";
const RAW_POWER = "56136";
const ENERGY_CHANNEL = "56098";

/** No boost icons, and a 4-icon boost, so a leader's attack (ATK 2) deals 2 or 6. */
const NO_BOOST = boost("no-boost", 0);
const BIG_BOOST = boost("big-boost", 4);
const MENTAL = typedResource("res-mental", "mental");
const ENERGY = typedResource("res-energy", "energy");

/** "Hero Response" and "Forced Response" attachments for Target Lock's choice. */
/** The shipped Raw Power and Alpha Flight Recruit scripts with `anyGameArea: true` on the Channel query (the proposed fix). */
const FIXED_CHANNEL = query("attachment", { name: "Energy Channel", host: yourLeader, anyGameArea: true });
const FIXED_CHANNEL_REFS: Record<string, AbilityDefinition> = defineAbilities({
  "56136.raw-power-response": response(on.youSpendThis(), addCounters("energy", 2, each(FIXED_CHANNEL))),
  "56135.alpha-flight-recruit-response": response(on.countersPlaced("energy", FIXED_CHANNEL), heal(1, host)),
}) as never;

const NET_RESPONSE: AbilityDefinition = {
  trigger: { kind: "response", forced: false, form: "hero", on: { on: "cardEntersPlay" } },
  effects: [],
} as never;
const SPIKES_RESPONSE: AbilityDefinition = {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay" } },
  effects: [],
} as never;
const NET = stubAttachment({
  id: "net",
  name: "Net",
  attachesTo: { kind: "villain" },
  abilities: [{ id: "audit.net.hero-response" }],
});
const SPIKES = stubAttachment({
  id: "spikes",
  name: "Spikes",
  attachesTo: { kind: "villain" },
  abilities: [{ id: "audit.spikes.forced-response" }],
});

const SEAT_CARDS = [
  THE_FUTURIST,
  TARGET_LOCK,
  HIGH_TECH_SUIT,
  SUIT_UP,
  PROVOKED_RESPONSE,
  YOU_STARTED_THIS,
  ALPHA_FLIGHT_RECRUIT,
  RAW_POWER,
  ...[1, 2, 3, 4].flatMap(() => [MENTAL.id as string, ENERGY.id as string]),
];

function game(options: { deckOne?: readonly string[]; deckTwo?: readonly string[]; fixed?: boolean } = {}) {
  return twoTeamGame({
    ...options,
    filler: NO_BOOST,
    extraCards: [
      BIG_BOOST,
      MENTAL,
      ENERGY,
      NET,
      SPIKES,
      ...realCards(
        THE_FUTURIST,
        TARGET_LOCK,
        HIGH_TECH_SUIT,
        SUIT_UP,
        PROVOKED_RESPONSE,
        YOU_STARTED_THIS,
        ALPHA_FLIGHT_RECRUIT,
        RAW_POWER,
        ENERGY_CHANNEL,
      ),
    ],
    abilities: {
      "audit.net.hero-response": NET_RESPONSE,
      "audit.spikes.forced-response": SPIKES_RESPONSE,
      ...(options.fixed ? FIXED_CHANNEL_REFS : {}),
    },
    seatCards: SEAT_CARDS,
  });
}

const identityOf = (state: GameState, player: typeof P1 | typeof P2): InstanceId =>
  playerOf(state, player).identity.instanceId;

/** Gives p1 `code` and `n` resources of `payCode`, returning ids (surgery). */
function hand(state: GameState, code: string, payCode: string, n: number) {
  const card = give(state, P1, code);
  const paid: InstanceId[] = [];
  let current = card.state;
  for (let i = 0; i < n; i += 1) {
    const next = give(current, P1, payCode, paid);
    paid.push(next.id);
    current = next.state;
  }
  return { state: current, id: card.id, paid };
}

describe("The Futurist (56129): your Iron Man leader schemes, with no boost card", () => {
  const { state: start, deps } = game({ deckTwo: [BIG_BOOST.id as string] });
  const { one: schemeOne, two: schemeTwo } = schemesOf(start);
  const { two, deckTwo } = leadersOf(start);
  const given = hand(start, THE_FUTURIST, MENTAL.id as string, 2);
  const { state, events } = run(deps, given.state, firstLegal, play(P1, given.id, given.paid));

  it("leader two (your leader) places its SCH on the main scheme of its own area, none on yours", () => {
    expect(inst(state, schemeTwo).threat - inst(start, schemeTwo).threat).toBe(1);
    expect(inst(state, schemeOne).threat).toBe(inst(start, schemeOne).threat);
    expect(events.some((e) => e.type === "schemeResolved" && e.enemyInstanceId === two)).toBe(true);
  });

  it("deals it no boost card (the top of its deck is untouched) and the event is discarded", () => {
    expect(boostsDealtTo(events, two)).toEqual([]);
    expect(state.encounterDecks[deckTwo]!.deck[0]).toBe(start.encounterDecks[deckTwo]!.deck[0]);
    expect(playerOf(state, P1).discard).toContain(given.id);
  });
});

describe("Target Lock (56130): your leader attacks the enemy leader; [mental] discards a Hero Response/Interrupt attachment", () => {
  function lock(payCode: string) {
    const { state: start, deps } = game({ deckOne: ["net", "spikes"], deckTwo: [BIG_BOOST.id as string] });
    const { one, two, deckOne } = leadersOf(start);
    const net = attachFromDeck(start, deckOne, "net", one);
    const spikes = attachFromDeck(net.state, deckOne, "spikes", one);
    const given = hand(spikes.state, TARGET_LOCK, payCode, 2);
    const result = run(deps, given.state, acceptAll, play(P1, given.id, given.paid));
    return { ...result, one, two, net: net.id, spikes: spikes.id };
  }

  it("leader two attacks leader one with one boost card from its own area's deck: 2 + 4 damage, no defender", () => {
    const r = lock(MENTAL.id as string);
    expect(
      r.events.some(
        (e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === r.two && e.targetInstanceId === r.one,
      ),
    ).toBe(true);
    expect(r.events.some((e) => e.type === "defenderDeclared")).toBe(false);
    expect(boostsDealtTo(r.events, r.two)).toHaveLength(1);
    expect(inst(r.state, r.one).damage).toBe(6);
  });

  it("paid with [mental]: the Hero Response attachment on the enemy leader is discarded, the Forced Response one is not", () => {
    const r = lock(MENTAL.id as string);
    expect(inst(r.state, r.one).attachments).not.toContain(r.net);
    expect(inst(r.state, r.one).attachments).toContain(r.spikes);
  });

  it("paid with [energy] only: nothing is discarded", () => {
    const r = lock(ENERGY.id as string);
    expect(inst(r.state, r.one).attachments).toContain(r.net);
    expect(inst(r.state, r.one).attachments).toContain(r.spikes);
    expect(inst(r.state, r.one).damage).toBe(6);
  });
});

describe("High-Tech Suit (56131): attaches to your leader, counts as Tech, any player may spend [energy][mental] to discard it", () => {
  function suited() {
    const { state: start, deps } = game();
    const { two } = leadersOf(start);
    const given = hand(start, HIGH_TECH_SUIT, ENERGY.id as string, 1);
    const played = run(deps, given.state, firstLegal, play(P1, given.id, given.paid, two));
    return { ...played, deps, two, suit: given.id };
  }

  it("attaches to leader two (your leader) and counts as a Tech attachment", () => {
    const r = suited();
    expect(inst(r.state, r.suit).attachedTo).toBe(r.two);
    expect(traitsOf(r.state, r.suit, r.deps)).toContain(trait("TECH"));
  });

  // BUG (reported): `triggerableBy: eachPlayer` resolves to "each player in the card's own game area" (select.ts resolvePlayers,
  // Once and Future Kang insert), and the suit sits on leader two in area two, so its controller p1 (area one) is refused.
  it.fails("its controller discards it by spending [energy][mental]", () => {
    const r = suited();
    const pay = hand(r.state, ENERGY.id as string, MENTAL.id as string, 1);
    const used = run(r.deps, pay.state, acceptAll, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: r.suit,
      abilityId: "56131.high-tech-suit-action",
      payment: [{ fromHand: pay.id }, { fromHand: pay.paid[0]! }],
    });
    expect(inst(used.state, r.suit).attachedTo).toBeNull();
    expect(playerOf(used.state, P1).discard).toContain(r.suit);
  });

  it("the enemy team's player may trigger it too, on their own turn (RRG v1.8 Action p. 6: text naming who may)", () => {
    const r = suited();
    const turn = run(r.deps, r.state, firstLegal, endTurn(P1));
    const pay = hand(turn.state, ENERGY.id as string, MENTAL.id as string, 1);
    // `hand` moves cards for P1; give p2 the same two payers by taking the cards for P2.
    const e = give(turn.state, P2, ENERGY.id as string);
    const m = give(e.state, P2, MENTAL.id as string);
    void pay;
    const used = run(r.deps, m.state, acceptAll, {
      type: "useAbility",
      playerId: P2,
      cardInstanceId: r.suit,
      abilityId: "56131.high-tech-suit-action",
      payment: [{ fromHand: e.id }, { fromHand: m.id }],
    });
    expect(inst(used.state, r.suit).attachedTo).toBeNull();
  });
});

describe("Suit Up (56132): after you spend it, your Iron Man leader gets a tough status card", () => {
  it("spent to pay for a card, leader two (your leader) becomes tough and leader one does not", () => {
    const { state: start, deps } = game();
    const { one, two } = leadersOf(start);
    const upgrade = give(start, P1, "upgrade");
    const suit = give(upgrade.state, P1, SUIT_UP);
    const r = run(deps, suit.state, acceptAll, play(P1, upgrade.id, [suit.id], identityOf(start, P1)));
    expect(playerOf(r.state, P1).discard).toContain(suit.id);
    expect(inst(r.state, two).statuses.tough).toBe(1);
    expect(inst(r.state, one).statuses.tough).toBe(0);
  });
});

describe("Provoked Response (56133): the enemy leader would attack you; it attacks your Captain Marvel leader, capped at 3", () => {
  const { state: start, deps } = game({ deckOne: [BIG_BOOST.id as string] });
  const { one, two, deckOne } = leadersOf(start);
  const given = give(start, P1, PROVOKED_RESPONSE);
  const attached = run(deps, given.state, firstLegal, play(P1, given.id, [], identityOf(start, P1)));
  const { state, events } = run(deps, attached.state, firstLegal, endTurn(P1), endTurn(P2));

  it("leader one attacks leader two instead of p1, who takes nothing, and leader two takes 3 of the 6", () => {
    expect(
      events.some((e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === one && e.targetInstanceId === two),
    ).toBe(true);
    expect(inst(state, two).damage).toBe(3);
    expect(inst(state, identityOf(state, P1)).damage).toBe(0);
  });

  it("deals one boost card from leader one's deck, and discards the card", () => {
    const dealt = boostsDealtTo(events, one);
    expect(dealt).toHaveLength(1);
    expect(state.encounterDecks[deckOne]!.discard).toContain((dealt[0] as { instanceId: InstanceId }).instanceId);
    expect(playerOf(state, P1).discard).toContain(given.id);
    expect(resolved(events, "56133.provoked-response-forced-interrupt")).toBe(1);
  });

  it("the cap leaves no lasting rule behind", () => {
    expect(state.lastingEffects.filter((e) => JSON.stringify(e).includes("maxDamageTakenPerAttack"))).toEqual([]);
  });
});

describe("You Started This (56134): your Captain Marvel leader attacks the enemy leader; [energy] confuses it", () => {
  function started(payCode: string) {
    const { state: start, deps } = game({ deckTwo: [BIG_BOOST.id as string] });
    const { one, two } = leadersOf(start);
    const given = hand(start, YOU_STARTED_THIS, payCode, 2);
    const result = run(deps, given.state, acceptAll, play(P1, given.id, given.paid));
    return { ...result, one, two };
  }

  it("paid with [energy]: leader two attacks leader one (2 + 4) with no defender, and leader one is confused", () => {
    const r = started(ENERGY.id as string);
    expect(
      r.events.some(
        (e) => e.type === "enemyAttackedEnemy" && e.attackerInstanceId === r.two && e.targetInstanceId === r.one,
      ),
    ).toBe(true);
    expect(inst(r.state, r.one).damage).toBe(6);
    expect(inst(r.state, r.one).statuses.confused).toBe(1);
    expect(inst(r.state, r.two).statuses.confused).toBe(0);
  });

  it("paid with [mental]: the attack lands but nothing is confused", () => {
    const r = started(MENTAL.id as string);
    expect(inst(r.state, r.one).damage).toBe(6);
    expect(inst(r.state, r.one).statuses.confused).toBe(0);
  });
});

// BUG (reported): the Energy Channel query in competitive/leader-cards.ts lacks `anyGameArea: true`, so "your leader's Energy
// Channel" (a card in the other team's area) is never found. `fixed` swaps in the one-line fix; as shipped the three
// affected tests are `it.fails`, so they flip red the moment the file is fixed (remove `broken` then).
describe.each([[false], [true]])(
  "Raw Power (56136) and Alpha Flight Recruit (56135) with the Energy Channel on your Captain Marvel leader (fixed query: %s)",
  (fixed) => {
    const broken = fixed ? it : it.fails;
    /** Energy Channel on leader two (your leader) and on leader one, a damaged ally of p1's with the Recruit attached. */
    function table() {
      const { state: start, deps } = game({ deckOne: [ENERGY_CHANNEL], deckTwo: [ENERGY_CHANNEL], fixed });
      const { one, two, deckOne, deckTwo } = leadersOf(start);
      const mine = attachFromDeck(start, deckTwo, ENERGY_CHANNEL, two);
      const enemys = attachFromDeck(mine.state, deckOne, ENERGY_CHANNEL, one);
      const ally = intoPlay(enemys.state, P1, "ally");
      const damaged = patch(ally.state, ally.id, { damage: 2 });
      const recruit = give(damaged, P1, ALPHA_FLIGHT_RECRUIT);
      const attached = run(deps, recruit.state, acceptAll, play(P1, recruit.id, [], ally.id));
      return { state: attached.state, deps, one, two, mine: mine.id, enemys: enemys.id, ally: ally.id };
    }
    const counters = (s: GameState, id: InstanceId) => inst(s, id).counters["energy"] ?? 0;

    broken(
      "Raw Power spent: 2 energy counters on the Channel of your leader (leader two), none on the enemy leader's",
      () => {
        const t = table();
        const upgrade = give(t.state, P1, "upgrade");
        const power = give(upgrade.state, P1, RAW_POWER);
        const r = run(t.deps, power.state, acceptAll, play(P1, upgrade.id, [power.id], identityOf(t.state, P1)));
        expect(counters(r.state, t.mine)).toBe(2);
        expect(counters(r.state, t.enemys)).toBe(0);
        expect(playerOf(r.state, P1).discard).toContain(power.id);
      },
    );

    broken("Alpha Flight Recruit: after those counters are placed, it heals 1 damage from the attached ally", () => {
      const t = table();
      expect(inst(t.state, t.ally).damage).toBe(2);
      const upgrade = give(t.state, P1, "upgrade");
      const power = give(upgrade.state, P1, RAW_POWER);
      const r = run(t.deps, power.state, acceptAll, play(P1, upgrade.id, [power.id], identityOf(t.state, P1)));
      expect(inst(r.state, t.ally).damage).toBe(1);
    });

    it("Alpha Flight Recruit does not heal for counters on the enemy leader's Channel", () => {
      const t = table();
      // p1's hero attacks leader one: its Channel (not yours) gets the counter (Energy Channel, "after ... attacks Captain Marvel").
      const r = run(t.deps, t.state, acceptAll, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(t.state, P1),
        targetInstanceId: t.one,
      });
      expect(counters(r.state, t.enemys)).toBe(1);
      expect(inst(r.state, t.ally).damage).toBe(2);
    });

    broken(
      "cross-turn (Q11): p2 attacks your leader in its own hero phase, the Channel gains a counter and your Recruit heals",
      () => {
        const t = table();
        const turn = run(t.deps, t.state, acceptAll, endTurn(P1));
        const r = run(t.deps, turn.state, acceptAll, {
          type: "basicAttack",
          playerId: P2,
          attackerInstanceId: identityOf(t.state, P2),
          targetInstanceId: t.two,
        });
        expect(counters(r.state, t.mine)).toBe(1);
        expect(resolved(r.events, "56135.alpha-flight-recruit-response")).toBe(1);
        expect(inst(r.state, t.ally).damage).toBe(1);
      },
    );
  },
);
