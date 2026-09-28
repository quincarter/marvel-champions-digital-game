import { describe, expect, it } from "vitest";
import { cardId, trait } from "@mc/content";
import {
  activeAbilityRefs,
  applyCommand,
  canAttack,
  hasKeyword,
  keywordTotal,
  maxHitPoints,
  paymentFor,
  statBonus,
  traitsOf,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  play,
  payWith,
  run,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea, playFromHand } from "../../testing/staging.js";
import { WAVE5_CARDS, WAVE5_DEPS } from "../index.js";
import { startWave5Game } from "../testing.js";
import { ironheartScenario } from "./support.js";

const ironheartVsRhino = (seed = 1) => startWave5Game(ironheartScenario("rhino", { seed }));

/** Accepts every optional trigger/target option named in `wanted` (by exact id, `<instanceId>:<abilityId>` suffix,
 * or a chosen target's own instance id) and greedily maxes out any cost-payment/card-picking prompt that isn't
 * itself the thing being matched — `wave5/sm/spider-man-morales/precon-player-cards.test.ts`'s own `accepting()`. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (
      choice.prompt.kind === "chooseCostCards" ||
      choice.prompt.kind === "chooseCards" ||
      choice.prompt.kind === "payForAbility"
    ) {
      return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
    }
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Plays `code` (already in the player's hand) from `state`, paying `cost` other hand cards, driven by `pick`. */
function playFromHandHelper(
  state: ReturnType<typeof ironheartVsRhino>,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const after = settle(
    runWith(WAVE5_DEPS, given.state, play(P1, id, payWith(given.state, P1, cost, [id]))),
    pick,
    undefined,
    WAVE5_DEPS,
  );
  return { state: after, id };
}

/** Pulls `n` more cards into P1's hand from the precon deck (distinct resource-icon cards, well under each printed
 * quantity), so a second/third costly play in the same test doesn't run the real hand dry mid-sequence. */
const TOPUP_CODES = [
  "29017",
  "29017",
  "29017",
  "29018",
  "29018",
  "29018",
  "29019",
  "29019",
  "29019",
  "29027",
  "29027",
  "29027",
  "29021",
  "29021",
];
function topUp(state: GameState, n: number): GameState {
  return moveToHand(state, P1, ...TOPUP_CODES.slice(0, n)).state;
}

const AERIAL = trait("AERIAL");
const CHAMPION = trait("CHAMPION");

describe("Brawn (ally, 29004)", () => {
  const BRAWN = "29004.brawn-constant";
  /** Ironheart in hero form with Brawn in play, `exhausted` as given, and Morale Boost (29019, cost 1) in hand. */
  function brawnTable(exhausted: boolean, seed = 1) {
    const hero = run(ironheartVsRhino(seed), toHero(P1));
    const { state: withBrawn, id: brawn } = playFromHand(WAVE5_DEPS, hero, "29004", 4);
    const given = moveToHand(topUp(patchInstance(withBrawn, brawn, { exhausted }), 2), P1, "29019", "29019");
    const [boost, boost2] = given.ids as [InstanceId, InstanceId];
    return { state: given.state, brawn, boost, boost2 };
  }
  const brawnPays = (brawn: InstanceId) => [{ ability: { instanceId: brawn, abilityId: BRAWN as never } }];
  const optionOf = (brawn: InstanceId) => `ability:${brawn}:${BRAWN}`;

  it("29004.brawn-constant: exhausted Brawn is a payment source worth exactly one [mental], and pays a 1-cost card alone", () => {
    const { state, brawn, boost } = brawnTable(true);
    const source = paymentFor(state, P1, { kind: "playCard", instanceId: boost }, {}, WAVE5_DEPS)?.sources.find(
      (s) => s.optionId === optionOf(brawn),
    );
    expect(source).toMatchObject({ kind: "resourceAbility", instanceId: brawn });
    expect(source?.pool).toEqual({ physical: 0, mental: 1, energy: 0, wild: 0 });

    const result = applyCommand(state, play(P1, boost, [], { abilities: brawnPays(brawn) }), WAVE5_DEPS);
    expect(result.ok).toBe(true);
    expect(result.ok && result.events.find((e) => e.type === "resourcesGenerated")).toMatchObject({
      pool: { mental: 1, physical: 0, energy: 0, wild: 0 },
    });
  });

  it("29004.brawn-constant: ready Brawn has no resource ability — not offered, and a payment naming it is refused", () => {
    const { state, brawn, boost } = brawnTable(false);
    const query = paymentFor(state, P1, { kind: "playCard", instanceId: boost }, {}, WAVE5_DEPS);
    expect(query?.sources.map((s) => s.optionId)).not.toContain(optionOf(brawn));
    const result = applyCommand(state, play(P1, boost, [], { abilities: brawnPays(brawn) }), WAVE5_DEPS);
    expect(!result.ok && result.error.code).toBe("no_valid_target");
  });

  it("29004.brawn-constant: limit once per phase — refused a second time this phase, available again next phase", () => {
    const { state, brawn, boost, boost2 } = brawnTable(true);
    const once = settle(
      runWith(WAVE5_DEPS, state, play(P1, boost, [], { abilities: brawnPays(brawn) })),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(once, brawn).exhausted).toBe(true);
    const twice = applyCommand(once, play(P1, boost2, [], { abilities: brawnPays(brawn) }), WAVE5_DEPS);
    expect(!twice.ok && twice.error.code).toBe("limit_reached");
    expect(
      paymentFor(once, P1, { kind: "playCard", instanceId: boost2 }, {}, WAVE5_DEPS)?.sources.map((s) => s.optionId),
    ).not.toContain(optionOf(brawn));

    // Through the villain phase into the next player phase (a new phase: RRG 1.8 "Limit", pp. 26–27).
    const nextRound = settle(
      runWith(WAVE5_DEPS, once, endTurn(P1)),
      firstLegal,
      (s) => s.step.phase === "player" && s.pendingChoice === null,
      WAVE5_DEPS,
    );
    expect(nextRound.step.phase).toBe("player");
    expect(nextRound.outcome ?? null).toBeNull();
    const given = moveToHand(nextRound, P1, "29019");
    const [boost3] = given.ids as [InstanceId];
    const again = patchInstance(given.state, brawn, { exhausted: true });
    const result = applyCommand(again, play(P1, boost3, [], { abilities: brawnPays(brawn) }), WAVE5_DEPS);
    expect(result.ok).toBe(true);
  });
});

describe("Cloud 9 (ally, 29014)", () => {
  it("29014.cloud-9-action: exhausts to give each Aerial character the chosen player controls +1 THW until the end of the phase", () => {
    const hero = run(ironheartVsRhino(1), toHero(P1));
    const { state: withCloud9, id: cloud9 } = playFromHand(WAVE5_DEPS, hero, "29014", 3);
    expect(traitsOf(withCloud9, cloud9, WAVE5_DEPS)).toContain(AERIAL); // Cloud 9 herself is Aerial.
    expect(statBonus(withCloud9, WAVE5_DEPS, cloud9, "thw")).toBe(0);
    const after = settle(
      runWith(WAVE5_DEPS, withCloud9, use(P1, cloud9, "29014.cloud-9-action")),
      accepting(P1),
      undefined,
      WAVE5_DEPS,
    );
    expect(statBonus(after, WAVE5_DEPS, cloud9, "thw")).toBe(1); // She herself is an Aerial character P1 controls.
    expect(inst(after, cloud9).exhausted).toBe(true);
  });

  it("29014.cloud-9-action: a non-Aerial character the same player controls is unaffected", () => {
    const hero = run(ironheartVsRhino(2), toHero(P1));
    const { state: withCloud9, id: cloud9 } = playFromHand(WAVE5_DEPS, hero, "29014", 3);
    const { state: withPatriot, id: patriot } = playFromHandHelper(withCloud9, "29016", 3, accepting());
    expect(traitsOf(withPatriot, patriot, WAVE5_DEPS)).not.toContain(AERIAL);
    const after = settle(
      runWith(WAVE5_DEPS, withPatriot, use(P1, cloud9, "29014.cloud-9-action")),
      accepting(P1),
      undefined,
      WAVE5_DEPS,
    );
    expect(statBonus(after, WAVE5_DEPS, patriot, "thw")).toBe(0); // Patriot prints no Aerial trait.
  });
});

describe("Falcon (ally, 29015)", () => {
  it("29015.falcon-response: after Falcon attacks, spending [energy] readies another chosen champion character", () => {
    const hero = run(ironheartVsRhino(1), toHero(P1));
    const { state: withFalcon, id: falcon } = playFromHand(WAVE5_DEPS, hero, "29015", 4);
    // Patriot declines his own "choose a champion character" response here (no other champion to target yet).
    const { state: withPatriot, id: patriot } = playFromHandHelper(topUp(withFalcon, 6), "29016", 3, accepting());
    expect(traitsOf(withPatriot, patriot, WAVE5_DEPS)).toContain(CHAMPION);
    const exhaustedPatriot = patchInstance(withPatriot, patriot, { exhausted: true });
    const villain = exhaustedPatriot.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, exhaustedPatriot, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: falcon,
        targetInstanceId: villain,
      } as never),
      accepting("29015.falcon-response", patriot),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, patriot).exhausted).toBe(false); // Readied by Falcon's response.
  });

  it("29015.falcon-response: declined, the exhausted target stays exhausted", () => {
    const hero = run(ironheartVsRhino(2), toHero(P1));
    const { state: withFalcon, id: falcon } = playFromHand(WAVE5_DEPS, hero, "29015", 4);
    const { state: withPatriot, id: patriot } = playFromHandHelper(topUp(withFalcon, 6), "29016", 3, accepting());
    const exhaustedPatriot = patchInstance(withPatriot, patriot, { exhausted: true });
    const villain = exhaustedPatriot.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, exhaustedPatriot, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: falcon,
        targetInstanceId: villain,
      } as never),
      firstLegal, // declines every optional response/target by default
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, patriot).exhausted).toBe(true);
  });
});

describe("Patriot (ally, 29016)", () => {
  it("29016.patriot-response: after he enters play, the chosen champion character gets +1 THW/ATK/DEF until the end of the round", () => {
    const hero = run(ironheartVsRhino(1), toHero(P1));
    const given = moveToHand(hero, P1, "29016");
    const [patriotHand] = given.ids as [InstanceId];
    const paid = payWith(given.state, P1, 3, [patriotHand]);
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, patriotHand, paid)),
      // The trigger offer itself is `<patriotId>:29016.patriot-response`; the chooseTarget that follows offers
      // candidates by their own raw instance id — Patriot's own id matches both.
      accepting("29016.patriot-response", patriotHand),
      undefined,
      WAVE5_DEPS,
    );
    expect(statBonus(after, WAVE5_DEPS, patriotHand, "thw")).toBe(1);
    expect(statBonus(after, WAVE5_DEPS, patriotHand, "atk")).toBe(1);
    expect(statBonus(after, WAVE5_DEPS, patriotHand, "def")).toBe(1);
  });

  it("29016.patriot-response: a non-champion character (Agent 13, trait S.H.I.E.L.D. SPY only) is never offered as a target", () => {
    const hero = run(ironheartVsRhino(2), toHero(P1));
    const { state: withAgent13, id: agent13 } = playFromHandHelper(hero, "29022", 4, accepting());
    expect(traitsOf(withAgent13, agent13, WAVE5_DEPS)).not.toContain(CHAMPION);
    const given = moveToHand(topUp(withAgent13, 3), P1, "29016");
    const [patriotHand] = given.ids as [InstanceId];
    const paid = payWith(given.state, P1, 3, [patriotHand]);
    const reached = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, patriotHand, paid)),
      accepting("29016.patriot-response"), // accept the trigger offer, then inspect the ensuing chooseTarget prompt
      (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
      WAVE5_DEPS,
    );
    const choice = reached.pendingChoice;
    expect(choice).toBeDefined();
    expect(choice?.prompt.kind).toBe("chooseTarget");
    expect(choice?.options.some((o) => o.optionId === agent13 || o.optionId.endsWith(`:${agent13}`))).toBe(false);
    expect(choice?.options.some((o) => o.optionId === patriotHand || o.optionId.endsWith(`:${patriotHand}`))).toBe(
      true,
    );
  });
});

describe("Agent 13 (ally, 29022) — a second printing of `sm` 27046", () => {
  it("29022.agent-13-response: aliased to the exact same effect as 27046 — after she attacks, readies a chosen S.H.I.E.L.D. support", () => {
    const hero = run(ironheartVsRhino(1), toHero(P1));
    const { state: withFacility, id: facility } = playFromHand(WAVE5_DEPS, hero, "29020", 3); // R&D Facility, trait S.H.I.E.L.D.
    const { state: withAgent13, id: agent13 } = playFromHand(WAVE5_DEPS, topUp(withFacility, 6), "29022", 4);
    const exhaustedFacility = patchInstance(withAgent13, facility, { exhausted: true });
    const villain = exhaustedFacility.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, exhaustedFacility, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: agent13,
        targetInstanceId: villain,
      } as never),
      accepting("29022.agent-13-response", facility),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, facility).exhausted).toBe(false);
  });
});

describe("Snowguard (ally, 29023)", () => {
  const playSnowguard = (state: ReturnType<typeof ironheartVsRhino>, label: string) => {
    const hero = run(state, toHero(P1));
    return playFromHandHelper(hero, "29023", 4, (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      // First accept the "Response:" trigger offer itself, then pick the named quantity option it opens.
      if (choice.prompt.kind === "chooseTriggers") {
        const hit = choice.options.find((o) => o.optionId.endsWith(":29023.snowguard-response"));
        return hit ? [hit.optionId] : firstLegal(s);
      }
      const hit = choice.options.find((o) => o.label === label);
      return hit ? [hit.optionId] : firstLegal(s);
    });
  };

  it("29023.snowguard-response + -constant: placing 0 shift counters grants no bonus", () => {
    const { state: after, id: snowguard } = playSnowguard(ironheartVsRhino(1), "Place no shift counters");
    expect(statBonus(after, WAVE5_DEPS, snowguard, "atk")).toBe(0);
    expect(statBonus(after, WAVE5_DEPS, snowguard, "thw")).toBe(0);
    expect(maxHitPoints(after, snowguard, WAVE5_DEPS)).toBe(3); // printed hp, no +5.
    expect(hasKeyword(after, snowguard, "overkill", WAVE5_DEPS)).toBe(false);
    expect(keywordTotal(after, snowguard, "retaliate", WAVE5_DEPS)).toBe(0);
  });

  it("29023.snowguard-constant (1 shift counter): +3 ATK and her attacks gain overkill, nothing else", () => {
    const { state: after, id: snowguard } = playSnowguard(ironheartVsRhino(2), "Place 1 shift counter");
    expect(statBonus(after, WAVE5_DEPS, snowguard, "atk")).toBe(3);
    expect(hasKeyword(after, snowguard, "overkill", WAVE5_DEPS)).toBe(true);
    expect(statBonus(after, WAVE5_DEPS, snowguard, "thw")).toBe(0);
    expect(traitsOf(after, snowguard, WAVE5_DEPS)).not.toContain(AERIAL);
    expect(maxHitPoints(after, snowguard, WAVE5_DEPS)).toBe(3);
  });

  it("29023.snowguard-constant-2 (2 shift counters): +3 THW and gains the Aerial trait, nothing else", () => {
    const { state: after, id: snowguard } = playSnowguard(ironheartVsRhino(3), "Place 2 shift counters");
    expect(statBonus(after, WAVE5_DEPS, snowguard, "thw")).toBe(3);
    expect(traitsOf(after, snowguard, WAVE5_DEPS)).toContain(AERIAL);
    expect(statBonus(after, WAVE5_DEPS, snowguard, "atk")).toBe(0);
    expect(hasKeyword(after, snowguard, "overkill", WAVE5_DEPS)).toBe(false);
    expect(maxHitPoints(after, snowguard, WAVE5_DEPS)).toBe(3);
  });

  it("29023.snowguard-constant-3 (3 shift counters): +5 hit points and retaliate 1, nothing else", () => {
    const { state: after, id: snowguard } = playSnowguard(ironheartVsRhino(4), "Place 3 shift counters");
    expect(maxHitPoints(after, snowguard, WAVE5_DEPS)).toBe(8); // printed 3 + 5.
    expect(keywordTotal(after, snowguard, "retaliate", WAVE5_DEPS)).toBe(1);
    expect(statBonus(after, WAVE5_DEPS, snowguard, "atk")).toBe(0);
    expect(statBonus(after, WAVE5_DEPS, snowguard, "thw")).toBe(0);
    expect(traitsOf(after, snowguard, WAVE5_DEPS)).not.toContain(AERIAL);
  });
});

describe("Vivian (ally, 29024)", () => {
  /**
   * Ironheart (hero form) vs Rhino with one of each kind of candidate in play (test surgery): Armored Rhino Suit
   * (01098) attached to Rhino; Hydra Mercenary (01101, guard, non-Elite) and Sandman (01102, Elite) engaged with P1;
   * Breakin' & Takin' (01107) and a permanent side scheme — Light at the End (`sm` 27102a), standing in for a Crowd
   * Control (01108) copy — in the villain area.
   */
  function vivianBoard(seed: number) {
    const hero = run(ironheartVsRhino(seed), toHero(P1));
    const rhino = hero.villains[0]!.instanceId;
    const suit = encounterCardInVillainArea(hero, "01098");
    const merc = encounterCardInVillainArea(suit.state, "01101");
    const sandman = encounterCardInVillainArea(merc.state, "01102");
    const breakin = encounterCardInVillainArea(sandman.state, "01107", 2);
    const light = encounterCardInVillainArea(breakin.state, "01108", 2);
    const lightCard = WAVE5_CARDS.find((card) => card.id === cardId("27102a"))!;
    const s = light.state;
    const state: GameState = {
      ...s,
      cardPool: { ...s.cardPool, [lightCard.id]: lightCard },
      villainArea: s.villainArea.filter((id) => id !== suit.id && id !== merc.id && id !== sandman.id),
      players: s.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, merc.id, sandman.id] } : p)),
      instances: {
        ...s.instances,
        [rhino]: { ...inst(s, rhino), attachments: [...inst(s, rhino).attachments, suit.id] },
        [suit.id]: { ...inst(s, suit.id), attachedTo: rhino },
        [merc.id]: { ...inst(s, merc.id), engagedWith: P1 },
        [sandman.id]: { ...inst(s, sandman.id), engagedWith: P1 },
        [light.id]: { ...inst(s, light.id), cardId: lightCard.id },
      },
    };
    return { state, rhino, suit: suit.id, merc: merc.id, sandman: sandman.id, breakin: breakin.id, light: light.id };
  }

  /** Plays Vivian, accepts her Response, and stops at its chooseTarget prompt. */
  function toVivianChoice(state: GameState) {
    const given = moveToHand(state, P1, "29024");
    const [vivian] = given.ids as [InstanceId];
    const reached = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, vivian, payWith(given.state, P1, 2, [vivian]))),
      accepting("29024.vivian-response"),
      (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
      WAVE5_DEPS,
    );
    const choice = reached.pendingChoice;
    if (choice?.prompt.kind !== "chooseTarget") throw new Error("Vivian's Response did not reach its target choice");
    return { state: reached, vivian, options: choice.options.map((o) => o.optionId) };
  }
  const offers = (options: readonly string[], id: InstanceId) => options.some((o) => o === id || o.endsWith(`:${id}`));
  const optionFor = (options: readonly string[], id: InstanceId) =>
    options.find((o) => o === id || o.endsWith(`:${id}`))!;
  const blanksOf = (state: GameState) => state.lastingEffects.filter((e) => e.kind === "blankTextBox");

  /** Picks `target` at Vivian's choice and settles everything after it. */
  function vivianBlanks(seed: number, pickTarget: (board: ReturnType<typeof vivianBoard>) => InstanceId) {
    const board = vivianBoard(seed);
    const { state, options } = toVivianChoice(board.state);
    const target = pickTarget(board);
    const after = settle(answer(state, [optionFor(options, target)], WAVE5_DEPS), firstLegal, undefined, WAVE5_DEPS);
    return { board, target, after };
  }

  it("29024.vivian-response offers an attachment, a non-Elite minion and a non-permanent side scheme — never an Elite minion or a permanent side scheme", () => {
    const board = vivianBoard(1);
    const { options } = toVivianChoice(board.state);
    expect(offers(options, board.suit)).toBe(true);
    expect(offers(options, board.merc)).toBe(true);
    expect(offers(options, board.breakin)).toBe(true);
    expect(offers(options, board.sandman)).toBe(false); // Elite.
    expect(offers(options, board.light)).toBe(false); // Permanent.
    expect(offers(options, board.rhino)).toBe(false); // The villain is none of the three.
    expect(offers(options, board.state.mainScheme.instanceId)).toBe(false);
  });

  it("29024.vivian-response on an attachment: Armored Rhino Suit's text box is blank until the end of the round, its Armor trait kept", () => {
    const { board, after } = vivianBlanks(1, (b) => b.suit);
    expect(activeAbilityRefs(board.state, board.suit, WAVE5_DEPS).length).toBeGreaterThan(0);
    expect(blanksOf(after)).toEqual([
      expect.objectContaining({
        targets: [board.suit],
        sourceCardId: cardId("29024"),
        duration: { kind: "endOfRound" },
      }),
    ]);
    expect(activeAbilityRefs(after, board.suit, WAVE5_DEPS)).toEqual([]);
    expect(traitsOf(after, board.suit, WAVE5_DEPS)).toContain(trait("ARMOR"));
    // Only the chosen card.
    expect(hasKeyword(after, board.merc, "guard", WAVE5_DEPS)).toBe(true);
  });

  it("29024.vivian-response on a non-Elite minion: Hydra Mercenary loses guard (a printed keyword) but keeps its Hydra trait", () => {
    const { board, after } = vivianBlanks(2, (b) => b.merc);
    expect(hasKeyword(board.state, board.merc, "guard", WAVE5_DEPS)).toBe(true);
    expect(blanksOf(after)).toEqual([
      expect.objectContaining({ targets: [board.merc], duration: { kind: "endOfRound" } }),
    ]);
    expect(hasKeyword(after, board.merc, "guard", WAVE5_DEPS)).toBe(false);
    expect(traitsOf(after, board.merc, WAVE5_DEPS)).toContain(trait("HYDRA"));
    // With guard blank, Ironheart may attack Rhino again (RRG 1.8 "Guard").
    expect(canAttack(board.state, identityOf(board.state, P1), board.rhino, WAVE5_DEPS)).toBe(false);
    expect(canAttack(after, identityOf(after, P1), board.rhino, WAVE5_DEPS)).toBe(true);
    expect(activeAbilityRefs(after, board.suit, WAVE5_DEPS).length).toBeGreaterThan(0);
  });

  it("29024.vivian-response on a non-permanent side scheme: Breakin' & Takin' is blank until the end of the round, and not after", () => {
    const { board, after } = vivianBlanks(3, (b) => b.breakin);
    expect(activeAbilityRefs(board.state, board.breakin, WAVE5_DEPS).length).toBeGreaterThan(0);
    expect(blanksOf(after)).toEqual([
      expect.objectContaining({ targets: [board.breakin], duration: { kind: "endOfRound" } }),
    ]);
    expect(activeAbilityRefs(after, board.breakin, WAVE5_DEPS)).toEqual([]);
    const nextRound = settle(
      runWith(WAVE5_DEPS, after, endTurn(P1)),
      firstLegal,
      (s) => s.round > after.round,
      WAVE5_DEPS,
    );
    expect(nextRound.round).toBe(after.round + 1);
    expect(blanksOf(nextRound)).toEqual([]);
  });
});
