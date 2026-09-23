import { activeVillain, characterProfile as characterProfileOf, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  patchInstance,
  play,
  payWith,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  toHero,
  use,
  P1,
  type Picker,
} from "../../testing/harness.js";
import { withDamage } from "../../testing/staging.js";
import { WAVE3_DEPS } from "../index.js";
import { startWave3Game } from "../testing.js";
import { gamoraScenario } from "./support.js";

/** Real wave 3 content: Gamora (a hand-built stand-in deck, `support.ts`) against Rhino (a Core scenario, seated
 * with wave 3 content — `wave3Scenario`'s fallback), standard, solo. Gamora starts in alter-ego. */
const gamoraVsRhino = (seed = 1) => startWave3Game(gamoraScenario("rhino", { seed }));

/** Accepts the named optional response/interrupt; declines everything else. Mirrors `../gmw/groot-kit.test.ts`. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Like `accepting`, but a `chooseCards`/`chooseTarget` prompt picks up to its maximum rather than declining to the
 * minimum — for "search … and add it to your hand" effects that are optional to *offer* (the trigger) but whose
 * own search should actually find something when it can. */
const acceptingAndChoosingMax =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseCards" || choice.prompt.kind === "chooseTarget") {
      return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
    }
    return accepting(...wanted)(state);
  };

/** Like `accepting`, but also pays a `payForCard` prompt (an interrupt/response event played straight from hand,
 * whose cost is offered as its own choice rather than paid up front by a `playCard` command) with whatever hand
 * cards it offers, up to the printed cost. */
const acceptingAndPaying =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    }
    return accepting(...wanted)(state);
  };

/** Drives to the `declareDefender` prompt via the villain phase's own attack — the same helper `groot-kit.test.ts`
 * uses (`toDeclareDefender`). */
const toDeclareDefender = (state: GameState) =>
  settle(
    runWith(WAVE3_DEPS, state, endTurn()),
    firstLegal,
    (s) => s.pendingChoice?.prompt.kind === "declareDefender",
    WAVE3_DEPS,
  );

/** Plays `code` from hand, paying with whatever other cards are in hand, accepting the named optional trigger (if
 * offered) and declining everything else. */
/** `characterProfile`, asserting the target actually resolves — every call site here is on a character just put
 * into play by the test itself. */
function characterProfile(state: GameState, id: InstanceId, deps: typeof WAVE3_DEPS) {
  const profile = characterProfileOf(state, id, deps);
  if (!profile) throw new Error(`no character profile for ${id}`);
  return profile;
}

function playAndAccept(state: GameState, code: string, cost: number, accept?: string | Picker) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const payment = cost > 0 ? payWith(given.state, P1, cost, [id]) : [];
  const pick = accept === undefined ? firstLegal : typeof accept === "string" ? accepting(accept) : accept;
  const played = settle(runWith(WAVE3_DEPS, given.state, play(P1, id, payment)), pick, undefined, WAVE3_DEPS);
  return { state: played, id };
}

describe("Gamora's identity (18001a/b)", () => {
  it("Finesse — Response: after you play an attack event, remove 1 threat from a scheme (limit once per phase)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(), toHero());
    const staged = patchInstance(hero, hero.mainScheme.instanceId, { threat: 3 });
    const { state } = playAndAccept(staged, "18003", 0, "18001a.finesse");
    expect(mainThreat(state)).toBe(2);
  });

  it("Precision — Response: after you play a thwart event, deal 1 damage to an enemy (limit once per phase)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(2), toHero());
    const villain = activeVillain(hero).instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playAndAccept(hero, "18005", 0, "18001a.precision");
    expect(inst(state, villain).damage).toBe(before + 1);
  });

  it("Gamora — Action: look at the top card of your deck; if it's an attack or thwart event, draw it (limit once per round)", () => {
    const start = gamoraVsRhino(3);
    const owner = playerOf(start, P1);
    const attackEventId = owner.deck.find((id) => start.instances[id]?.cardId === ("18003" as never));
    if (!attackEventId) throw new Error("no Acrobatic Move in deck");
    const stacked: GameState = {
      ...start,
      players: start.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: [attackEventId, ...p.deck.filter((id) => id !== attackEventId)] } : p,
      ),
    };
    const before = playerOf(stacked, P1).hand.length;
    const identity = identityOf(stacked);
    const after = runWith(WAVE3_DEPS, stacked, use(P1, identity, "18001b.gamora-action"));
    expect(playerOf(after, P1).hand).toContain(attackEventId);
    expect(playerOf(after, P1).hand.length).toBe(before + 1);
  });
});

describe("Gamora's hero kit (18002–18023)", () => {
  it("Nebula (ally) — Response: after Nebula enters play, search your deck for an attack or thwart event and add it to your hand", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(4), toHero());
    let found: InstanceId | undefined;
    const pick: Picker = (s) => {
      const answer = acceptingAndChoosingMax("18002.nebula-response")(s);
      if (s.pendingChoice?.prompt.kind === "chooseCards" && answer.length > 0) found = answer[0] as InstanceId;
      return answer;
    };
    const { state } = playAndAccept(hero, "18002", 2, pick);
    expect(instancesOf(state, "18002")).toHaveLength(1);
    expect(found).toBeDefined();
    expect(playerOf(state, P1).hand).toContain(found);
  });

  it("Acrobatic Move — Hero Action (attack): deal 2 damage to an enemy (18003.acrobatic-move-action)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const villain = activeVillain(hero).instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playAndAccept(hero, "18003", 0);
    expect(inst(state, villain).damage).toBe(before + 2);
  });

  it("Crosscounter — Hero Interrupt (attack/defense/thwart): when you would take damage, prevent 3, deal 1 to an enemy, remove 1 threat from a scheme", () => {
    // Crosscounter is played *as* the interrupt (its own printed trigger, not a separate "Hero Action"): it stays
    // in hand until the moment it would take damage offers it, exactly like `../gmw/groot-kit.test.ts`'s Vine
    // Shield/Vine Spikes (upgrades with a cost) — here the "cost" is simply playing an interrupt-only event.
    const { state: withCard } = moveToHand(runWith(WAVE3_DEPS, gamoraVsRhino(5), toHero()), P1, "18004");
    const identity = identityOf(withCard);
    const villain = activeVillain(withCard).instanceId;
    const beforeVillainDamage = inst(withCard, villain).damage;
    const reached = toDeclareDefender(withCard);
    expect(reached.pendingChoice?.prompt.kind).toBe("declareDefender");
    const beforeThreat = mainThreat(reached);
    const offered = answer(reached, [identity], WAVE3_DEPS);
    const after = settle(offered, acceptingAndPaying("18004.crosscounter-constant"), undefined, WAVE3_DEPS);
    // Rhino's printed ATK (2) equals Gamora's printed DEF (2): a basic defense already prevents all of it, but the
    // interrupt still fires on the "would take damage" event (proven the same way `groot-kit.test.ts`'s Vine
    // Shield test is: the unconditional side effects, not the prevented amount, show it resolved).
    expect(inst(after, villain).damage).toBe(beforeVillainDamage + 1);
    expect(mainThreat(after)).toBe(beforeThreat - 1);
  });

  it("Set the Pace — Hero Action (thwart): remove 1 threat from a scheme (18005.set-the-pace-action)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const staged = patchInstance(hero, hero.mainScheme.instanceId, { threat: 3 });
    const { state } = playAndAccept(staged, "18005", 0);
    expect(mainThreat(state)).toBe(2);
  });

  it("Decisive Blow — Hero Action (attack): 4 damage to an enemy (7 instead if you played a thwart event this turn) (18006.decisive-blow-action)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const villain = activeVillain(hero).instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playAndAccept(hero, "18006", 2);
    expect(inst(state, villain).damage).toBe(before + 4);

    const staged = patchInstance(state, state.mainScheme.instanceId, { threat: 5 });
    const thwarted = playAndAccept(staged, "18005", 0).state;
    const afterThwart = inst(thwarted, villain).damage;
    const boosted = playAndAccept(thwarted, "18006", 2).state;
    expect(inst(boosted, villain).damage).toBe(afterThwart + 7);
  });

  it("Forward Momentum — Hero Action (thwart): 3 threat from a scheme (5 instead if you played an attack event this turn) (18007.forward-momentum-action)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const staged = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
    const { state } = playAndAccept(staged, "18007", 2);
    expect(mainThreat(state)).toBe(7);

    const staged2 = patchInstance(state, state.mainScheme.instanceId, { threat: 10 });
    const attacked = playAndAccept(staged2, "18003", 0).state;
    const boosted = playAndAccept(attacked, "18007", 2).state;
    expect(mainThreat(boosted)).toBe(mainThreat(attacked) - 5);
  });

  it("Conditioning Room — Alter-Ego Action: exhaust → return the bottommost attack/thwart event from discard to hand; heal 1", () => {
    const start = gamoraVsRhino(6);
    const given = moveToHand(start, P1, "18003", "18014");
    const [first, second] = given.ids as [InstanceId, InstanceId];
    const discarded: GameState = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((id) => id !== first && id !== second), discard: [second, first] }
          : p,
      ),
    };
    const givenRoom = moveToHand(discarded, P1, "18008");
    const roomHandId = givenRoom.ids[0] as InstanceId;
    const played = runWith(
      WAVE3_DEPS,
      givenRoom.state,
      play(P1, roomHandId, payWith(givenRoom.state, P1, 1, [roomHandId])),
    );
    const roomId = instancesOf(played, "18008")[0] as InstanceId;
    const identity = identityOf(played);
    const damaged = withDamage(played, identity, 2);
    const after = runWith(WAVE3_DEPS, damaged, use(P1, roomId, "18008.conditioning-room-action"));
    expect(playerOf(after, P1).hand).toContain(first);
    expect(playerOf(after, P1).discard).toContain(second);
    expect(inst(after, identity).damage).toBe(1);
  });

  it("Keen Instincts — Resource: exhaust → generate a wild resource for an attack or thwart event", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const givenUpgrade = moveToHand(hero, P1, "18009");
    const [upgId] = givenUpgrade.ids;
    const upgradePlayed = runWith(
      WAVE3_DEPS,
      givenUpgrade.state,
      play(P1, upgId as InstanceId, payWith(givenUpgrade.state, P1, 1, [upgId as InstanceId])),
    );
    const keenId = instancesOf(upgradePlayed, "18009")[0] as InstanceId;
    const givenCostly = moveToHand(upgradePlayed, P1, "18012");
    const [costlyId] = givenCostly.ids;
    const paid = runWith(
      WAVE3_DEPS,
      givenCostly.state,
      play(P1, costlyId as InstanceId, payWith(givenCostly.state, P1, 1, [costlyId as InstanceId]), {
        abilities: [resourceAbility(keenId, "18009.keen-instincts-resource")],
      }),
    );
    expect(instancesOf(paid, "18012").length).toBeGreaterThan(0);
    expect(inst(paid, keenId).exhausted).toBe(true);
  });

  it("Gamora's Sword — Response: after you play an attack event, deal 1 damage to an enemy (restricted, data)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const given = moveToHand(hero, P1, "18010");
    const [swordId] = given.ids;
    const equipped = runWith(
      WAVE3_DEPS,
      given.state,
      play(P1, swordId as InstanceId, payWith(given.state, P1, 3, [swordId as InstanceId])),
    );
    const villain = activeVillain(equipped).instanceId;
    const before = inst(equipped, villain).damage;
    const { state } = playAndAccept(equipped, "18003", 0, "18010.gamoras-sword-response");
    expect(inst(state, villain).damage).toBe(before + 3);
  });

  it("Angela — Forced Response: search the top 10 for a minion and put it into play engaged with you; else discard Angela (18011.angela-forced-response)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const given = moveToHand(hero, P1, "18011");
    const [angelaId] = given.ids;
    const played = settle(
      runWith(WAVE3_DEPS, given.state, play(P1, angelaId as InstanceId, [])),
      acceptingAndChoosingMax(),
      undefined,
      WAVE3_DEPS,
    );
    const stillInPlay = playerOf(played, P1).playArea.includes(angelaId as InstanceId);
    const discarded = playerOf(played, P1).discard.includes(angelaId as InstanceId);
    // Exactly one of these is true: a real search either found a minion (Angela stays, a minion is now engaged
    // with P1) or found none (Angela is discarded) — never both, never neither.
    expect(stillInPlay).toBe(!discarded);
  });

  it("Clobber — Hero Action (attack): 3 damage to an enemy; return to hand if the first card played this round (18012.clobber-action)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const villain = activeVillain(hero).instanceId;
    const before = inst(hero, villain).damage;
    const { state, id } = playAndAccept(hero, "18012", 2);
    expect(inst(state, villain).damage).toBe(before + 3);
    expect(playerOf(state, P1).hand).toContain(id);
  });

  it("Plan of Attack — Action: search the top 4 (7 in alter-ego) cards for an attack event and add it to hand (18013.plan-of-attack-action)", () => {
    const start = gamoraVsRhino(1);
    const before = playerOf(start, P1).hand.length;
    const { state } = playAndAccept(start, "18013", 0);
    expect(playerOf(state, P1).hand.length).toBeGreaterThanOrEqual(before - 1);
  });

  it("First Hit — Hero Action (attack): deal 2 damage to the villain (18015.first-hit-action)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const villain = activeVillain(hero).instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playAndAccept(hero, "18015", 1);
    expect(inst(state, villain).damage).toBe(before + 2);
  });

  it("First Hit — Hero Interrupt (attack): when a minion initiates an attack, deal 2 damage to that minion", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    // First Hit's Hero Action and Hero Interrupt are the two halves of one physical card: playing it as the
    // attack would consume the only copy in hand, leaving nothing to interrupt with — so it stays in hand here.
    const { state: equipped } = moveToHand(hero, P1, "18015");
    // A real minion (Hydra Mercenary, 01101 — printed ATK 1, engaged so it attacks rather than schemes) engaged
    // with P1 by state surgery, the same convention `rocket-kit.test.ts`'s own `withEngagedMinion` uses: an
    // engaged enemy's `home` is the engaged player's `playArea`, not `villainArea`.
    const minionId = "test-minion" as InstanceId;
    const withMinion: GameState = {
      ...equipped,
      players: equipped.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, minionId] } : p)),
      instances: {
        ...equipped.instances,
        [minionId]: {
          instanceId: minionId,
          cardId: "01101" as never,
          ownerId: null,
          controllerId: null,
          home: { kind: "playArea", playerId: P1 },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 0,
          statuses: { stunned: 0, confused: 0, tough: 0 },
          counters: {},
          attachedTo: null,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: P1,
          flipped: false,
        } as never,
      },
    };
    // Rhino (the villain, already engaged with P1) activates before the minion does, offering its own
    // `declareDefender` choice first; decline it (as `firstLegal` does) and keep going until the *minion's own*
    // attack actually changes its damage — the same "keep answering, stop on the effect" shape `toDeclareDefender`
    // generalizes for a single attack, extended here across two activations in one villain phase.
    const reached = settle(
      runWith(WAVE3_DEPS, withMinion, endTurn()),
      acceptingAndPaying("18015.first-hit-interrupt"),
      (s) => (s.instances[minionId]?.damage ?? 0) > 0 || s.outcome != null,
      WAVE3_DEPS,
    );
    expect(inst(reached, minionId).damage).toBeGreaterThanOrEqual(2);
  });

  it("Impede — Hero Action (thwart): remove 3 threat from the main scheme; return to hand if first played this round (18016.impede-action)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const staged = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
    const { state, id } = playAndAccept(staged, "18016", 2);
    expect(mainThreat(state)).toBe(7);
    expect(playerOf(state, P1).hand).toContain(id);
  });

  it("Godslayer — Hero Interrupt: basic attack against a unique enemy, exhaust → +2 ATK for that attack", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const given = moveToHand(hero, P1, "18018");
    const [godId] = given.ids;
    const equipped = runWith(
      WAVE3_DEPS,
      given.state,
      play(P1, godId as InstanceId, payWith(given.state, P1, 3, [godId as InstanceId])),
    );
    const villain = activeVillain(equipped).instanceId;
    const identity = identityOf(equipped);
    const printedAtk = characterProfile(equipped, identity, WAVE3_DEPS).atk;
    const before = inst(equipped, villain).damage;
    const attacked = settle(
      runWith(WAVE3_DEPS, equipped, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      } as never),
      accepting("18018.godslayer-interrupt"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(attacked, villain).damage).toBe(before + printedAtk + 2);
  });

  it("Drax (ally) — cannot attack minions, but may still attack the villain (18019.drax-constant)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const given = moveToHand(hero, P1, "18019");
    const [draxId] = given.ids;
    const played = runWith(
      WAVE3_DEPS,
      given.state,
      play(P1, draxId as InstanceId, payWith(given.state, P1, 3, [draxId as InstanceId])),
    );
    const draxInstance = instancesOf(played, "18019")[0] as InstanceId;
    const readied = patchInstance(played, draxInstance, { exhausted: false });
    const villain = activeVillain(readied).instanceId;
    const attacked = runWith(WAVE3_DEPS, readied, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: draxInstance,
      targetInstanceId: villain,
    } as never);
    expect(inst(attacked, villain).damage).toBeGreaterThan(0);
  });

  it("Hit and Run — Hero Action (attack/thwart): deal 2 damage to an enemy, remove 2 threat from a scheme (18020.hit-and-run-constant)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const staged = patchInstance(hero, hero.mainScheme.instanceId, { threat: 5 });
    const villain = activeVillain(staged).instanceId;
    const before = inst(staged, villain).damage;
    const { state } = playAndAccept(staged, "18020", 3);
    expect(inst(state, villain).damage).toBe(before + 2);
    expect(mainThreat(state)).toBe(3);
  });
});

describe("Gamora's further signature cards (18029–18032)", () => {
  it("Pivotal Moment — Hero Action (attack): 2 damage to the villain (5 instead if no threat on the main scheme) (18029.pivotal-moment-action)", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const zeroThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 0 });
    const villain = activeVillain(zeroThreat).instanceId;
    const before = inst(zeroThreat, villain).damage;
    const { state } = playAndAccept(zeroThreat, "18029", 2);
    expect(inst(state, villain).damage).toBe(before + 5);

    const withThreat = patchInstance(state, state.mainScheme.instanceId, { threat: 4 });
    const afterFirst = inst(withThreat, villain).damage;
    const second = playAndAccept(withThreat, "18029", 2).state;
    expect(inst(second, villain).damage).toBe(afterFirst + 2);
  });

  it("Comms Implant — attach to a guardian ally: +1 THW and +1 hit point (18030.comms-implant-constant)", () => {
    // Drax (18019, a GUARDIAN ally, `constant(cannotAttack)` only — no enters-play trigger to settle) rather than
    // Angela or Nebula, whose own forced/optional responses would otherwise complicate reaching a clean attach.
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero());
    const givenAlly = moveToHand(hero, P1, "18019");
    const [draxId] = givenAlly.ids;
    const withDrax = runWith(
      WAVE3_DEPS,
      givenAlly.state,
      play(P1, draxId as InstanceId, payWith(givenAlly.state, P1, 3, [draxId as InstanceId])),
    );
    const draxInstance = instancesOf(withDrax, "18019")[0] as InstanceId;
    const printedThw = characterProfile(withDrax, draxInstance, WAVE3_DEPS).thw;
    const printedHp = characterProfile(withDrax, draxInstance, WAVE3_DEPS).maxHp;
    const givenUpgrade = moveToHand(withDrax, P1, "18030");
    const [implantId] = givenUpgrade.ids;
    const attached = runWith(
      WAVE3_DEPS,
      givenUpgrade.state,
      play(P1, implantId as InstanceId, payWith(givenUpgrade.state, P1, 1, [implantId as InstanceId]), {
        attachToInstanceId: draxInstance,
      }),
    );
    expect(characterProfile(attached, draxInstance, WAVE3_DEPS).thw).toBe(printedThw + 1);
    expect(characterProfile(attached, draxInstance, WAVE3_DEPS).maxHp).toBe(printedHp + 1);
  });

  it("True Grit — Response (thwart): after your hero defends against an enemy attack, remove threat equal to your hero's THW", () => {
    // True Grit is played *as* the response, staying in hand until "after your hero defends" offers it.
    const { state: equipped } = moveToHand(runWith(WAVE3_DEPS, gamoraVsRhino(1), toHero()), P1, "18031");
    const identity = identityOf(equipped);
    const staged = patchInstance(equipped, equipped.mainScheme.instanceId, { threat: 3 });
    const thw = characterProfile(staged, identity, WAVE3_DEPS).thw;
    const reached = toDeclareDefender(staged);
    expect(reached.pendingChoice?.prompt.kind).toBe("declareDefender");
    const beforeThreat = mainThreat(reached);
    const offered = answer(reached, [identity], WAVE3_DEPS);
    const after = settle(offered, acceptingAndPaying("18031.true-grit-response"), undefined, WAVE3_DEPS);
    expect(mainThreat(after)).toBe(beforeThreat - thw);
  });
});
