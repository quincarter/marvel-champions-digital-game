import { WAVE10_STARTER_DECKS } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  keywordTotal,
  maxHitPoints,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  play,
  playerOf,
  putOnTopOfDeck,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { codeOf } from "../../../wave9/testing.js";
import { HULKLING_DECK, IRON_MAN_SCENARIO, WAVE10_DEPS as DEPS, civilWarGame } from "../../testing.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole-game test for Hulkling's printed starter deck (`hulkling-protection`, cards 56030 to 56053, checked against the
 * MC56 rulebook p. 18) in the Civil War scenario `registration-iron-man`: docs/phase7-wave10-box-heroes.md B8.4 line 10.
 * Three rounds of real commands, one decision at a time, the deck as printed. The opening hand and the draws are the
 * seed's; the cards a round needs, the encounter cards of a villain phase and the top of the deck for Super Skrull are
 * placed by test surgery, each surgery closing a logged segment and opening the next, so every segment replays
 * deep-equal from its own log. The board is quiet: the main scheme pair Homeland Security / No Going Back, Stark Tower put
 * back in the deck.
 *
 * Authorities: the printed cards; MC56 p. 18; RRG 1.8 (docs/rules/mc_rulesreference_v18_compressed.md): "Stun, Stunned" p. 41 (a
 * stunned character's attack is replaced by discarding the card), "Tough" p. 44, "Defend, Defense" pp. 14-15 (a
 * defense-labeled ability is not a basic defense), "Find" p. 19, "Cost" p. 13 (resources generated for a card are paid for
 * that card). FFG rulings: January 11, 2026 Ruling 1 (Teddy Altman bars a second Shapeshift upgrade; Armored Defense
 * still gives the tough card when its damage defeats the attacker). Owner answers: 14 = A (Skrull Business: the milled
 * card is still read by Super Skrull), 15 = B (Fantastic Powers dresses a Super Skrull already in play).
 *
 * Quickstrike and When Revealed: Hellcat (round 1) stuns Hulkling with her When Revealed, then attacks (RRG
 * "Quickstrike" p. 36; the owner's answer 30B of 2026-10-12); nothing asserted here depends on that order.
 */

interface Plan {
  readonly take?: readonly string[];
  readonly cards?: readonly string[];
  /** Cards that must not pay for a card (a payForCard prompt takes the first other card). */
  readonly keep?: readonly string[];
  readonly defend?: boolean;
  /** Only take triggers of attacks by the enemy with this code. */
  readonly against?: string;
}
const planner = (plan: Plan): Picker => {
  const taken = new Set<string>();
  return (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const ev = choice.prompt.event as { enemyInstanceId?: InstanceId };
        if (plan.against && ev.enemyInstanceId && codeOf(s, ev.enemyInstanceId) !== plan.against) return [];
        const hit = offered.find((o) => plan.take?.some((t) => o.endsWith(t) && !taken.has(t)));
        const which = hit ? plan.take!.find((t) => hit.endsWith(t))! : null;
        if (which) taken.add(which);
        return hit ? [hit] : [];
      }
      case "declareDefender":
        return plan.defend && offered.includes(identityOf(s) as string) ? [identityOf(s) as string] : ["decline"];
      case "payForCard": {
        const spare = choice.options.filter(
          (o) => !plan.keep?.includes(codeOf(s, o.optionId.replace("hand:", "") as InstanceId)),
        );
        return [(spare[0] ?? choice.options[0]!).optionId];
      }
      default: {
        for (const code of plan.cards ?? []) {
          const hit = choice.options.find((o) => o.ref.kind === "card" && codeOf(s, o.ref.instanceId) === code);
          if (hit) return [hit.optionId];
        }
        return firstLegal(s);
      }
    }
  };
};

let session: GameSession;
let state: GameState;
const segments: { readonly log: GameSession["log"]; readonly end: GameState }[] = [];

const act = (plan: Plan, ...commands: readonly Command[]): GameEvent[] => {
  const pick = planner(plan);
  const events: GameEvent[] = [];
  const settleOne = () => {
    while (state.pendingChoice && !state.outcome) {
      const choice = state.pendingChoice;
      const r = sessionApply(
        session,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(state),
        },
        DEPS,
      );
      if (!r.ok) throw new Error(r.error.message);
      session = r.session;
      state = r.session.state;
      events.push(...r.events);
    }
  };
  settleOne();
  for (const command of commands) {
    const r = sessionApply(session, command, DEPS);
    if (!r.ok) throw new Error(`${command.type}: ${r.error.code}: ${r.error.message}`);
    session = r.session;
    state = r.session.state;
    events.push(...r.events);
    settleOne();
  }
  return events;
};
const surgery = (next: GameState) => {
  segments.push({ log: session.log, end: state });
  state = next;
  session = startSession(next);
};
const give = (...codes: string[]) => surgery(moveToHand(state, P1, ...codes).state);
const stack = (...codes: string[]) => surgery(stackEncounterDeck(state, ...codes));
const onTop = (...codes: string[]) => surgery(putOnTopOfDeck(state, P1, ...codes).state);

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const pileCodes = (): string[] => {
  const pile = state.encounterDecks[Object.keys(state.encounterDecks)[0]!]!;
  return [...pile.deck, ...pile.discard].map((i) => codeOf(state, i));
};
const handId = (code: string): InstanceId => {
  const id = playerOf(state, P1).hand.find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`${code} is not in hand`);
  return id;
};
const handCodes = (): string[] => playerOf(state, P1).hand.map((i) => codeOf(state, i));
const inPlayId = (code: string): InstanceId => {
  const id = cardsInPlay(state).find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`${code} is not in play`);
  return id;
};
const isInPlay = (code: string): boolean => cardsInPlay(state).some((i) => codeOf(state, i) === code);
const hulk = (): InstanceId => identityOf(state);
const damageOn = (id: InstanceId): number => inst(state, id).damage;
/** Hand cards (not `except`) that can pay for a card: never the ones the game still needs. */
const fodder = (n: number, ...except: string[]): InstanceId[] =>
  playerOf(state, P1)
    .hand.filter((i) => !except.includes(codeOf(state, i)))
    .slice(0, n);

const SHAPE_CHANGER = "56029b.shape-changer";
const KEEP = ["56038", "56037", "56033", "56036"];

describe("Hulkling (Protection) precon against Iron Man in registration-iron-man, seed 1", () => {
  it("setup: the printed 40 cards, hand of 5 in alter-ego form (Teddy Altman)", () => {
    state = civilWarGame(IRON_MAN_SCENARIO, {
      starterDeckId: HULKLING_DECK,
      mainSchemeStageIds: ["56121b", "56124b"] as never,
      leaderSideScheme: "discarded",
    });
    session = startSession(state);
    const p = playerOf(state, P1);
    expect(p.identity.form).toBe("alterEgo");
    expect(p.hand).toHaveLength(5);
    expect(p.deck).toHaveLength(35);
    const printed = WAVE10_STARTER_DECKS.find((d) => d.id === HULKLING_DECK)!.cards.flatMap((c) =>
      Array.from({ length: c.quantity }, () => c.cardId as string),
    );
    expect(printed).toHaveLength(40);
    expect([...p.hand, ...p.deck].map((i) => codeOf(state, i)).sort()).toEqual([...printed].sort());
    expect(p.setAside.map((i) => codeOf(state, i)).sort()).toEqual(["56055", "56056", "56057", "56058", "56058"]);
    expect(maxHitPoints(state, state.activeVillainId!, DEPS)).toBe(12);
  });

  it("round 1, alter ego: Shape-Changer finds a Shapeshift upgrade (four candidates), limit once per round", () => {
    const events = act({ cards: ["56034"] }, use(P1, hulk(), SHAPE_CHANGER));
    expect(ofType(events, "deckShuffled")).toHaveLength(1);
    expect(handCodes()).toContain("56034");
    expect(handCodes()).toHaveLength(6);
    expect(applyCommand(state, use(P1, hulk(), SHAPE_CHANGER), DEPS).ok).toBe(false);
  });

  it("round 1: Armored Shape is played in alter-ego form; Teddy Altman's constant then refuses a second Shapeshift upgrade (FFG Jan 11, 2026 Ruling 1)", () => {
    const armored = handId("56034");
    act({}, play(P1, armored, fodder(2, "56034", "56038", "56037"), { attachToInstanceId: hulk() }));
    expect(inst(state, armored).attachedTo).toBe(hulk());
    give("56033");
    const refused = applyCommand(
      state,
      play(P1, handId("56033"), fodder(2, "56033"), { attachToInstanceId: hulk() }),
      DEPS,
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error.code).toBe("no_valid_target");
      expect(refused.error.message).toContain("cannot enter play");
    }
    // Nothing is discarded to make room ("cannot play a second and discard down"): Armored Shape stays.
    expect(isInPlay("56034")).toBe(true);
    const flipped = act({}, { type: "changeForm", playerId: P1 });
    expect(ofType(flipped, "formChanged")).toMatchObject([{ to: "hero" }]);
  });

  it("round 1 villain phase: Iron Man is defended (Armored Shape: DEF 3 and retaliate 1); Hellcat attacks and Armored Defense (cost 1) deals 3 and defeats him; Hulkling still gets a tough card", () => {
    stack("01186", "56079");
    const events = act(
      { defend: true, against: "56079", take: ["56038.armored-defense-interrupt"], keep: KEEP },
      endTurn(),
    );
    // Iron Man: ATK 2, defended by Hulkling (Armored Shape +2 DEF over his 1): nothing gets through, retaliate 1 hits back.
    const ironMan = state.activeVillainId!;
    expect(ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === ironMan)).toMatchObject([
      { baseAtk: 2, defenseReduction: 3, damageDealt: 0 },
    ]);
    expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === ironMan)).toMatchObject([
      { amount: 1, sourceInstanceId: hulk() },
    ]);
    // Armored Defense: damage equal to his DEF (1 + 2 = 3) to the attacker, who has 3 hit points.
    const armoredDefense = ofType(events, "cardPlayed").filter((e) => (e.cardId as string) === "56038");
    expect(armoredDefense).toMatchObject([{ resourcesPaid: 1 }]);
    const hellcat = ofType(events, "encounterCardRevealed").find((e) => (e.cardId as string) === "56079")!.instanceId;
    expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === hellcat)).toMatchObject([
      { amount: 3, sourceInstanceId: armoredDefense[0]!.instanceId },
    ]);
    expect(ofType(events, "characterDefeated").map((e) => e.instanceId)).toEqual([hellcat]);
    expect(ofType(events, "activationSkipped")).toMatchObject([{ enemyInstanceId: hellcat, reason: "leftPlay" }]);
    // The attack ended with the defeat, and still: "After this attack, give Hulkling a tough status card" (FFG Jan 11,
    // 2026 Ruling 1, third question). Hulkling took no damage.
    expect(ofType(events, "statusGiven").filter((e) => e.status === "tough")).toMatchObject([{ instanceId: hulk() }]);
    expect(inst(state, hulk()).statuses.tough).toBe(1);
    expect(damageOn(hulk())).toBe(0);
    // Hellcat's When Revealed (you are stunned) resolves before her Quickstrike attack (RRG "Quickstrike" p. 36, the
    // owner's answer 30B over FFG Feb 28, 2026 Ruling 4); nothing here depends on the order.
    expect(inst(state, hulk()).statuses.stunned).toBe(1);
    expect(state.round).toBe(2);
    expect([...handCodes()].sort()).toEqual(["56033", "56037", "56038"]);
  });
});

const ALIEN = "56036.alien-physiology-resource";
const alienPays = (id: InstanceId) => ({ ability: { instanceId: id, abilityId: ALIEN as never } });

describe("round 2: shapes and Alien Physiology", () => {
  it("round 2: Hulkling starts exhausted (he defended); Alien Physiology (cost 3) is played from three cards", () => {
    expect(inst(state, hulk()).exhausted).toBe(true);
    give("56036", "56046", "56046", "56046");
    const ap = handId("56036");
    act(
      {},
      play(
        P1,
        ap,
        playerOf(state, P1).hand.filter((i) => codeOf(state, i) === "56046"),
        { attachToInstanceId: hulk() },
      ),
    );
    expect(inst(state, ap).attachedTo).toBe(hulk());
  });

  it("round 2: Hulk Shape is paid for by Alien Physiology alone (2 resources for a Hulkling card); Chosen Shape discards Armored Shape and readies Hulkling", () => {
    const ap = inPlayId("56036");
    const armored = inPlayId("56034");
    const hulkShape = handId("56033");
    const events = act({}, play(P1, hulkShape, [], { attachToInstanceId: hulk(), abilities: [alienPays(ap)] }));
    expect(ofType(events, "resourcesGenerated")).toMatchObject([{ instanceId: ap, amount: 2 }]);
    expect(ofType(events, "cardPlayed")).toMatchObject([{ instanceId: hulkShape, resourcesPaid: 2 }]);
    expect(inst(state, ap).exhausted).toBe(true);
    // Chosen Shape (Forced Response): the other Shapeshift upgrade is discarded, Hulkling is readied.
    expect(isInPlay("56034")).toBe(false);
    expect(playerOf(state, P1).discard).toContain(armored);
    expect(ofType(events, "cardReadied").map((e) => e.instanceId)).toEqual([hulk()]);
    expect(inst(state, hulk()).exhausted).toBe(false);
    expect(inst(state, hulkShape).attachedTo).toBe(hulk());
  });
});

describe("round 2: events and Hulk Shape's Response", () => {
  const HULK_RESPONSE = "56033.hulk-shape-response";
  it("round 2: Hulkling is still stunned (Hellcat's When Revealed): his basic attack is replaced by discarding the stunned card; he exhausts and deals nothing (RRG 'Stun, Stunned' p. 41)", () => {
    const villain = state.activeVillainId!;
    const before = damageOn(villain);
    expect(inst(state, hulk()).statuses.stunned).toBe(1);
    const events = act(
      {},
      { type: "basicAttack", playerId: P1, attackerInstanceId: hulk(), targetInstanceId: villain },
    );
    expect(inst(state, hulk()).statuses.stunned).toBe(0);
    expect(inst(state, hulk()).exhausted).toBe(true);
    expect(ofType(events, "damageDealt")).toHaveLength(0);
    expect(damageOn(villain)).toBe(before);
  });

  it("round 2: Shapeshifter (cost 0) finds Imitation Shape; Hulk Shape's Response after the event deals 2 to Iron Man", () => {
    give("56040");
    const hulkShape = inPlayId("56033");
    const villain = state.activeVillainId!;
    const before = damageOn(villain);
    const events = act({ cards: ["56035"], take: [HULK_RESPONSE] }, play(P1, handId("56040"), []));
    expect(ofType(events, "cardPlayed")).toMatchObject([{ resourcesPaid: 0 }]);
    expect(ofType(events, "deckShuffled")).toHaveLength(1);
    expect(handCodes()).toContain("56035");
    expect(ofType(events, "damageDealt")).toMatchObject([
      { targetInstanceId: villain, amount: 2, sourceInstanceId: hulkShape },
    ]);
    expect(inst(state, hulkShape).exhausted).toBe(true);
    expect(damageOn(villain)).toBe(before + 2);
  });

  it("round 2: Shapeshifter Strike deals 5 and readies Hulk Shape, so the Response is heard again (a second 2 damage)", () => {
    give("56048", "56048");
    const hulkShape = inPlayId("56033");
    const villain = state.activeVillainId!;
    const before = damageOn(villain);
    const strike = handId("56037");
    const pay = playerOf(state, P1).hand.filter((i) => codeOf(state, i) === "56048");
    const events = act({ take: [HULK_RESPONSE] }, play(P1, strike, pay));
    expect(ofType(events, "damageDealt").map((e) => [e.targetInstanceId, e.amount, e.sourceInstanceId])).toEqual([
      [villain, 5, hulk()],
      [villain, 2, hulkShape],
    ]);
    // "Ready your Shapeshift upgrade" came before the "after you play an event" Response could use it again.
    expect(ofType(events, "cardReadied").map((e) => e.instanceId)).toEqual([hulkShape]);
    expect(inst(state, hulkShape).exhausted).toBe(true);
    expect(damageOn(villain)).toBe(before + 7);
  });

  it("round 2: Imitation Shape (cost 2) replaces Hulk Shape; Chosen Shape readies Hulkling again", () => {
    give("56049", "56049");
    const imitation = handId("56035");
    const hulkShape = inPlayId("56033");
    const pay = playerOf(state, P1).hand.filter((i) => codeOf(state, i) === "56049");
    act({}, play(P1, imitation, pay, { attachToInstanceId: hulk() }));
    expect(isInPlay("56033")).toBe(false);
    expect(playerOf(state, P1).discard).toContain(hulkShape);
    expect(inst(state, imitation).attachedTo).toBe(hulk());
    expect(damageOn(state.activeVillainId!)).toBeLessThan(12);
  });

  it("round 2 villain phase: Imitation Shape turns Iron Man's attack into a scheme; Shadow of the Past brings Super Skrull and Skrull Business", () => {
    stack("01186", "01190");
    const ironMan = state.activeVillainId!;
    const events = act({}, endTurn());
    expect(ofType(events, "enemyActivated").filter((e) => e.enemyInstanceId === ironMan)).toMatchObject([
      { activation: "attack" },
    ]);
    expect(ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === ironMan)).toHaveLength(0);
    const scheme = ofType(events, "schemeResolved").filter((e) => e.enemyInstanceId === ironMan);
    expect(scheme).toHaveLength(1);
    expect(damageOn(hulk())).toBe(0);
    const skrull = inPlayId("56055");
    expect(inst(state, skrull).engagedWith).toBe(P1);
    expect(isInPlay("56056")).toBe(true);
    expect(
      playerOf(state, P1)
        .setAside.map((i) => codeOf(state, i))
        .sort(),
    ).toEqual([]);
    expect(pileCodes()).toEqual(expect.arrayContaining(["56057", "56058"]));
    expect(state.round).toBe(3);
  });
});

describe("round 3: Alien Physiology for another card, the nemesis set", () => {
  it("round 3: Alien Physiology generates 1 (not 2) for Defensive Conditioning, a Protection card, so a card pays the other half", () => {
    const ap = inPlayId("56036");
    expect(inst(state, ap).exhausted).toBe(false);
    give("56046", "56046");
    const [cond, extra] = playerOf(state, P1).hand.filter((i) => codeOf(state, i) === "56046") as [
      InstanceId,
      InstanceId,
    ];
    // One resource from the upgrade is not the cost of 2.
    expect(applyCommand(state, play(P1, cond, [], { abilities: [alienPays(ap)] }), DEPS).ok).toBe(false);
    const events = act({}, play(P1, cond, [extra], { abilities: [alienPays(ap)] }));
    expect(ofType(events, "resourcesGenerated")).toMatchObject([{ instanceId: ap, amount: 1 }]);
    expect(ofType(events, "cardPlayed")).toMatchObject([{ instanceId: cond, resourcesPaid: 2 }]);
  });

  it("round 3: Winged Shape (cost 2) replaces Imitation Shape, so Super Skrull's attacks will not be turned into schemes", () => {
    give("56032", "56053", "56053");
    const winged = handId("56032");
    const imitation = inPlayId("56035");
    const pay = playerOf(state, P1).hand.filter((i) => codeOf(state, i) === "56053");
    act({}, play(P1, winged, pay, { attachToInstanceId: hulk() }));
    expect(isInPlay("56035")).toBe(false);
    expect(playerOf(state, P1).discard).toContain(imitation);
    expect(inst(state, hulk()).exhausted).toBe(false);
  });

  it("round 3: Hulkling attacks Super Skrull for 2 (ATK 1 +1 from Winged Shape)", () => {
    const skrull = inPlayId("56055");
    act({}, { type: "basicAttack", playerId: P1, attackerInstanceId: hulk(), targetInstanceId: skrull });
    expect(damageOn(skrull)).toBe(2);
    expect(maxHitPoints(state, skrull, DEPS)).toBe(5);
  });
});

describe("round 3 villain phase: Super Skrull, Skrull Business and Fantastic Powers", () => {
  it("Iron Man's attack meets the tough card Armored Defense gave; Super Skrull's attack mills the top card under Skrull Business and it still counts (energy: +2 ATK); Fantastic Powers dresses the Super Skrull already in play (he keeps his damage) and he attacks again", () => {
    const skrull = inPlayId("56055");
    const business = inPlayId("56056");
    const ironMan = state.activeVillainId!;
    onTop("56037");
    const strike = playerOf(state, P1).deck[0]!;
    expect(codeOf(state, strike)).toBe("56037");
    stack("01186", "56057");
    const skrullId = skrull;
    const events = act({}, endTurn());
    expect(state.outcome).toBeNull();

    // Iron Man: ATK 2, nothing declared, the tough status card from round 1 takes it (RRG "Tough" p. 44).
    expect(ofType(events, "damagePrevented").filter((e) => e.targetInstanceId === hulk())).toMatchObject([
      { amount: 2, reason: "tough" },
    ]);
    expect(ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === ironMan)).toMatchObject([
      { baseAtk: 2, damageDealt: 2 },
    ]);

    // Super Skrull, first attack: the Strike (printed energy) is discarded from the top and goes under Skrull Business
    // (its Forced Response), yet "energy" is still read from it (owner question 14 = A): ATK 1 + 2.
    const attacks = ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === skrullId);
    expect(attacks).toHaveLength(2);
    expect(attacks[0]).toMatchObject({ baseAtk: 3, damageDealt: 3 });
    expect(ofType(events, "deckDiscardStillCounted")[0]).toMatchObject({
      instanceId: strike,
      takenByInstanceId: business,
    });
    expect(inst(state, business).tucked).toContain(strike);
    expect(playerOf(state, P1).discard).not.toContain(strike);

    // Fantastic Powers: Super Skrull was already in play, so he is not put into play or revealed again (owner question
    // 15 = B; RRG "Find" p. 19): the one reveal is Fantastic Powers, and his damage stays.
    expect(ofType(events, "encounterCardRevealed").map((e) => e.cardId as string)).toEqual(["56057"]);
    expect(inst(state, skrull).engagedWith).toBe(P1);
    expect(damageOn(skrull)).toBe(2);
    const powers = inPlayId("56057");
    expect(inst(state, powers).attachedTo).toBe(skrull);
    expect(maxHitPoints(state, skrull, DEPS)).toBe(8);
    expect(keywordTotal(state, skrull, "retaliate", DEPS)).toBe(1);
    // Hero form: "Super Skrull attacks you", with the +1 ATK of Fantastic Powers: ATK 1 + 1, and his Forced Interrupt
    // runs again (the second milled card, "I Can Do This All Day", has a mental icon: Hulkling discards a card).
    expect(attacks[1]).toMatchObject({ baseAtk: 2, damageDealt: 2 });
    expect(inst(state, business).tucked).toHaveLength(2);
    expect(inst(state, business).tucked.map((i) => codeOf(state, i))).toEqual(["56037", "56047"]);
    expect(ofType(events, "cardDiscardedFromHand")).toHaveLength(1);
    expect(damageOn(hulk())).toBe(5);
    expect(state.round).toBe(4);
  });
});

describe("the whole game", () => {
  it("ends in round 4 with Hulkling alive, the nemesis set in play, and no prompt or outcome left open", () => {
    expect(state.outcome).toBeNull();
    expect(state.pendingChoice).toBeNull();
    for (const code of ["56029a", "56032", "56036", "56046", "56055", "56056", "56057"]) {
      expect(cardsInPlay(state).some((i) => codeOf(state, i) === code)).toBe(true);
    }
    // One Shapeshift upgrade in play at a time throughout: only Winged Shape is left.
    expect(
      cardsInPlay(state).filter((i) => ["56032", "56033", "56034", "56035"].includes(codeOf(state, i))),
    ).toHaveLength(1);
  });

  it("every logged segment replays from its own first state, command by command, to the state it ended in (deep-equal)", () => {
    const all = [...segments, { log: session.log, end: state }];
    for (const { log, end } of all) {
      const replayed = replay(log, DEPS);
      if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
      expect(replayed.state).toEqual(end);
    }
    expect(all).toHaveLength(12);
    expect(all.reduce((n, seg) => n + seg.log.commands.length, 0)).toBeGreaterThan(30);
  });
});
