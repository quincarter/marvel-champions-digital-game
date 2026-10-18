import { JJ_STARTER_DECKS, cardId } from "@mc/content";
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
  P2,
  payWith,
  play,
  moveToHand,
  endTurn,
  firstLegal,
  instancesOf,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import {
  JJ_JESSICA_JONES_SUPPORT_UPGRADES_ALLIES as REGISTRY,
  JJ_JESSICA_JONES_SUPPORT_UPGRADES_ALLIES_SKIPPED as SKIPPED,
} from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `jj/jessica-jones/support-upgrades-allies` (docs/phase7-wave11-hero-packs.md H8.4): Luke Cage 61003, Calling
 * in Favors 61008, 4K Digital Camcorder 61009, Circumstantial Evidence 61010, Leather Jacket 61011, "Now I'm Ticked
 * Off!" 61012, Reluctant Flier 61013 and Stakeout 61014. As in the events module's test, the games seat the Core
 * Spider-Man starter deck with cards relabelled by surgery, and Alias Investigations (61002) in play.
 */
const LUKE_A = "61003.luke-cage-action";
const FAVORS_A = "61008.calling-in-favors-action";
const CAMCORDER_A = "61009.4k-digital-camcorder-action";
const EVIDENCE_R = "61010.circumstantial-evidence-response";
const JACKET_C = "61011.leather-jacket-constant";
const JACKET_R = "61011.leather-jacket-response";
const TICKED_FR = "61012.now-im-ticked-off-forced-response";
const FLIER_I = "61013.reluctant-flier-interrupt";
const STAKEOUT_A = "61014.stakeout-action";
const STAKEOUT_I = "61014.stakeout-interrupt";
const LUKE = "61003";
const FAVORS = "61008";
const CAMCORDER = "61009";
const EVIDENCE = "61010";
const JACKET = "61011";
const TICKED = "61012";
const FLIER = "61013";
const STAKEOUT = "61014";
const ALIAS = "61002";
const WHIRLWIND = "01130"; // Core minion, 6 hit points, not Elite
const SANDMAN = "01102"; // Core Elite minion, 4 hit points
const SHOCKER = "01103"; // Core minion, 3 hit points
const MARIA_HILL = "01067"; // Core ally, cost 2
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

const refused = (state: GameState, command: Command) => !sessionApply(startSession(state), command, WAVE11_DEPS).ok;

/** Takes the option on one of `cards` (or whose label contains `label`); anything else as `firstLegal`. */
const picks =
  (opts: { readonly label?: string; readonly cards?: readonly InstanceId[] }): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    const wanted = opts.cards ?? [];
    const hit = choice?.options.find(
      (o) =>
        (opts.label !== undefined && String((o as { label?: string }).label ?? "").includes(opts.label)) ||
        ((o.ref.kind === "card" || o.ref.kind === "ability") && wanted.includes(o.ref.instanceId)) ||
        wanted.includes(o.optionId as InstanceId),
    );
    return hit ? [hit.optionId] : firstLegal(state);
  };

describe("Jessica Jones support, upgrade and ally registry", () => {
  it("registers only valid definitions, with the printed timing, and skips nothing", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(REGISTRY[FAVORS_A]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(REGISTRY[CAMCORDER_A]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(REGISTRY[TICKED_FR]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY[FLIER_I]!.trigger).toMatchObject({ kind: "interrupt", form: "hero" });
    expect(REGISTRY[STAKEOUT_I]!.trigger).toMatchObject({ kind: "interrupt" });
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [
        LUKE_A,
        FAVORS_A,
        CAMCORDER_A,
        EVIDENCE_R,
        JACKET_C,
        JACKET_R,
        TICKED_FR,
        FLIER_I,
        STAKEOUT_A,
        STAKEOUT_I,
      ].sort(),
    );
    expect(SKIPPED).toEqual({});
  });
});

describe(`${LUKE_A}: exhaust Luke Cage and deal 1 damage to him, give him a tough status card`, () => {
  it("leaves him exhausted with 1 damage and a tough status card", () => {
    const g = stagedInPlay(jjGame(LUKE), LUKE);
    const { state: after } = drive(g.state, use(P1, g.id, LUKE_A));
    expect(inst(after, g.id).exhausted).toBe(true);
    expect(inst(after, g.id).damage).toBe(1);
    expect(inst(after, g.id).statuses.tough).toBe(1);
  });

  it("is refused while he is exhausted", () => {
    const g = stagedInPlay(jjGame(LUKE), LUKE);
    expect(refused(patchInstance(g.state, g.id, { exhausted: true }), use(P1, g.id, LUKE_A))).toBe(true);
  });
});

describe(`${FAVORS_A}: remove 2 evidence, exhaust, search for an ally and play it for 2 less`, () => {
  const setup = (evidence: number) => {
    const a = withAlias(evidence, FAVORS, MARIA_HILL);
    const favors = stagedInPlay(a.state, FAVORS);
    return { ...a, state: favors.state, favors: favors.id };
  };

  it("plays the ally free of its 2 cost, spends 2 evidence and exhausts the support", () => {
    const g = setup(3);
    const hill = byCode(g.state, MARIA_HILL).instanceId;
    const { state: after, events } = drive(g.state, use(P1, g.favors, FAVORS_A), picks({ cards: [hill] }));
    expect(inst(after, g.alias).counters.evidence).toBe(1);
    expect(inst(after, g.favors).exhausted).toBe(true);
    expect(playerOf(after, P1).playArea).toContain(hill);
    expect(
      ofType(events, "cardPlayed").map((e) => ({ id: e.instanceId, from: e.from, counts: e.countsAsFrom })),
    ).toEqual([{ id: hill, from: "deck", counts: "hand" }]);
  });

  it("is refused with only 1 evidence counter, and in hero form", () => {
    expect(refused(setup(1).state, use(P1, setup(1).favors, FAVORS_A))).toBe(true);
    const g = setup(3);
    expect(refused(withForm(g.state, { heroForm: 0 }), use(P1, g.favors, FAVORS_A))).toBe(true);
  });
});

describe(`${CAMCORDER_A}: remove X evidence (2 less than the minion's hit points), discard the minion`, () => {
  const SHOCKER_ID = "shocker" as InstanceId;
  const WHIRL_ID = "whirl" as InstanceId;
  const setup = (evidence: number, damage = 0) => {
    const a = withAlias(evidence, CAMCORDER);
    const cam = stagedInPlay(a.state, CAMCORDER);
    const withMinions = engageMinion(engageMinion(cam.state, SHOCKER, "shocker"), WHIRLWIND, "whirl");
    return { ...a, cam: cam.id, state: patchInstance(withMinions, SHOCKER_ID, { damage }) };
  };

  it("a 3-hit-point minion costs 1 evidence: the minion is discarded, the camcorder exhausted", () => {
    const g = setup(5);
    const { state: after } = drive(g.state, use(P1, g.cam, CAMCORDER_A, [], { minion: [SHOCKER_ID] }));
    expect(inst(after, g.alias).counters.evidence).toBe(4);
    expect(inst(after, g.cam).exhausted).toBe(true);
    expect(playerOf(after, P1).playArea).not.toContain(SHOCKER_ID);
    expect(playerOf(after, P1).playArea).toContain(WHIRL_ID);
  });

  it("a minion with 1 hit point left costs nothing (X is never below 0)", () => {
    const g = setup(0, 2);
    const { state: after } = drive(g.state, use(P1, g.cam, CAMCORDER_A, [], { minion: [SHOCKER_ID] }));
    expect(playerOf(after, P1).playArea).not.toContain(SHOCKER_ID);
    expect(inst(after, g.alias).counters.evidence ?? 0).toBe(0);
  });

  it("a 6-hit-point minion costs 4: not offered with 3 evidence, paid with 4", () => {
    const g = setup(3);
    const only = patchInstance(g.state, SHOCKER_ID, { damage: 0 });
    // Shocker alone would cost 1, so take it out of play to leave only Whirlwind as a choice.
    const whirlOnly = {
      ...only,
      players: only.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== SHOCKER_ID) })),
    };
    expect(refused(whirlOnly, use(P1, g.cam, CAMCORDER_A))).toBe(true);
    const four = patchInstance(whirlOnly, g.alias, { counters: { evidence: 4 } });
    const { state: after } = drive(four, use(P1, g.cam, CAMCORDER_A, [], { minion: [WHIRL_ID] }));
    expect(inst(after, g.alias).counters.evidence ?? 0).toBe(0);
    expect(playerOf(after, P1).playArea).not.toContain(WHIRL_ID);
  });
  it("an Elite minion is not a choice, however much evidence there is", () => {
    const g = setup(9);
    const elite = engageMinion(g.state, SANDMAN, "sandman");
    const sandmanOnly = {
      ...elite,
      players: elite.players.map((p) => ({
        ...p,
        playArea: p.playArea.filter((id) => id !== SHOCKER_ID && id !== WHIRL_ID),
      })),
    };
    expect(refused(sandmanOnly, use(P1, g.cam, CAMCORDER_A))).toBe(true);
  });
});

describe(`${EVIDENCE_R}: after an enemy is defeated, exhaust to place 1 evidence counter`, () => {
  it("answers a defeat by a basic attack", () => {
    const a = withAlias(0, EVIDENCE);
    const up = stagedInPlay(a.state, EVIDENCE, { attach: true });
    const hurt = patchInstance(
      engageMinion(withForm(up.state, { heroForm: 0 }), SHOCKER, "shocker"),
      "shocker" as InstanceId,
      { damage: 2 },
    );
    const { state: after } = drive(
      hurt,
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(hurt),
        targetInstanceId: "shocker" as InstanceId,
      } as Command,
      picks({ cards: [up.id] }),
    );
    expect(playerOf(after, P1).playArea).not.toContain("shocker");
    expect(inst(after, a.alias).counters.evidence).toBe(1);
    expect(inst(after, up.id).exhausted).toBe(true);
  });
});

/** The Jessica Jones starter deck's game past setup (alter-ego form, Alias Investigations in play), with codes relabelled. */
function jessicaGame(...codes: readonly string[]): GameState {
  return buildJessica(false, codes);
}
/** The same game with the Core Spider-Man deck seated as player 2. */
const jessicaDuo = (...codes: readonly string[]): GameState => buildJessica(true, codes);
function buildJessica(duo: boolean, codes: readonly string[]): GameState {
  const deck = JJ_STARTER_DECKS[0]!;
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const seat = {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap((l) => Array.from({ length: l.quantity }, () => l.cardId)),
  };
  const created = createGame(
    { ...base, players: duo ? [seat, ...base.players] : [seat], requireLegalDecks: false },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
  let s = settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE11_DEPS);
  const pool = playerOf(s, P1).deck;
  codes.forEach((code, i) => {
    s = patchInstance(s, pool[i]!, { cardId: cardId(code) });
  });
  return s;
}
const aliasIn = (s: GameState): InstanceId => instancesOf(s, ALIAS)[0]!;
const evidenceOn = (s: GameState): number => inst(s, aliasIn(s)).counters["evidence"] ?? 0;

/** Defends with the identity when asked; anything else as `firstLegal`. */
const defending: Picker = (s) => {
  const kind = s.pendingChoice?.prompt.kind;
  if (kind === "declareDefender") return [identityOf(s)];
  if (kind === "chooseTriggers") return s.pendingChoice!.options.map((o) => o.optionId);
  return firstLegal(s);
};

describe(`${JACKET_C} and ${JACKET_R}: Jessica Jones gets +2 DEF; after you defend, place 1 evidence counter`, () => {
  const setup = (withJacket: boolean) => {
    const base = withForm(jessicaGame(JACKET), { heroForm: 0 });
    const attached = withJacket ? stagedInPlay(base, JACKET, { attach: true }).state : base;
    return stackEncounterDeck(attached, ADVANCE, ADVANCE);
  };

  it("without the jacket the defense takes 1 damage and places the one counter her own response does", () => {
    const { state: after } = drive(setup(false), endTurn(P1), defending);
    expect(inst(after, identityOf(after)).damage).toBe(1);
    expect(evidenceOn(after)).toBe(1);
  });

  it("with the jacket she takes no damage (DEF +2) and the jacket places a second counter", () => {
    const { state: after } = drive(setup(true), endTurn(P1), defending);
    expect(inst(after, identityOf(after)).damage).toBe(0);
    expect(evidenceOn(after)).toBe(2);
  });
});

/** Declines to defend; takes every trigger offered; anything else as `firstLegal`. */
const undefended: Picker = (s) => {
  const kind = s.pendingChoice?.prompt.kind;
  if (kind === "declareDefender") return ["decline"];
  if (kind === "chooseTriggers") return s.pendingChoice!.options.map((o) => o.optionId);
  return firstLegal(s);
};
const HYDRA_MERCENARY = "01101"; // Core minion with 1 boost icon: Rhino's attack of 2 becomes 3

describe(`${FLIER_I}: when you would take at least 3 damage from an attack, discard it, prevent the damage, take 1`, () => {
  const setup = (boost: string) => {
    const base = withForm(jessicaGame(FLIER), { heroForm: 0 });
    const flier = stagedInPlay(base, FLIER, { attach: true });
    return { ...flier, state: stackEncounterDeck(flier.state, boost, ADVANCE) };
  };

  it("a 3-damage attack is prevented, 1 damage is taken and the card is discarded", () => {
    const g = setup(HYDRA_MERCENARY);
    const { state: after } = drive(g.state, endTurn(P1), undefended);
    expect(inst(after, identityOf(after)).damage).toBe(1);
    expect(inst(after, identityOf(after)).attachments).not.toContain(g.id);
    expect(playerOf(after, P1).discard).toContain(g.id);
  });

  it("a 2-damage attack does not offer it: the damage is taken in full and the card stays", () => {
    const g = setup(ADVANCE);
    const { state: after } = drive(g.state, endTurn(P1), undefended);
    expect(inst(after, identityOf(after)).damage).toBe(2);
    expect(inst(after, identityOf(after)).attachments).toContain(g.id);
  });
});

describe(`${TICKED_FR}: after the villain activates against a player, hero form if in alter-ego, and 5 damage`, () => {
  const setup = (heroForm: boolean) => {
    const base = jessicaGame(TICKED);
    const ticked = stagedInPlay(base, TICKED, { attach: true });
    const staged = engageMinion(ticked.state, SHOCKER, "shocker");
    return {
      ...ticked,
      state: stackEncounterDeck(heroForm ? withForm(staged, { heroForm: 0 }) : staged, ADVANCE, ADVANCE),
    };
  };

  it("her alter ego is schemed against: she changes to hero form, the villain and the engaged minion take 5, it is discarded", () => {
    const g = setup(false);
    const { state: after } = drive(g.state, endTurn(P1), undefended);
    expect(playerOf(after, P1).identity.form).toBe("hero");
    expect(inst(after, after.activeVillainId!).damage).toBe(5);
    expect(playerOf(after, P1).playArea).not.toContain("shocker");
    expect(playerOf(after, P1).discard).toContain(g.id);
  });

  it("in hero form the form change is skipped but the 5 damage and the discard still happen", () => {
    const g = setup(true);
    const { state: after, events } = drive(g.state, endTurn(P1), undefended);
    expect(ofType(events, "formChanged")).toEqual([]);
    expect(playerOf(after, P1).identity.form).toBe("hero");
    expect(inst(after, after.activeVillainId!).damage).toBe(5);
    expect(playerOf(after, P1).playArea).not.toContain("shocker");
    expect(playerOf(after, P1).discard).toContain(g.id);
  });
});

describe(`${TICKED_FR}: two players, a stun, and the printed label`, () => {
  it("carries the (attack) label", () => {
    expect(REGISTRY[TICKED_FR]!.label).toEqual(["attack"]);
  });

  it("the villain activating against player 2 flips Jessica, hurts player 2's minion and not the one engaged with her", () => {
    const duo = jessicaDuo(TICKED);
    const ticked = stagedInPlay(duo, TICKED, { attach: true });
    // Player 2 is first player, so the villain activates against her first, while Jessica is still an alter ego.
    const seated = engageMinion(engageMinion(ticked.state, SHOCKER, "s2", P2), WHIRLWIND, "s1");
    const first = stackEncounterDeck({ ...seated, firstPlayerId: P2 }, ADVANCE, ADVANCE);
    const mid = drive(first, endTurn(P1), undefended).state;
    const { state: after, events } = drive(mid, endTurn(P2), undefended);
    expect(
      ofType(events, "formChanged")
        .filter((e) => e.playerId === P1)
        .map((e) => e.to),
    ).toContain("hero");
    const fives = ofType(events, "damageDealt")
      .filter((e) => e.amount === 5)
      .map((e) => e.targetInstanceId);
    expect(fives).toEqual([after.activeVillainId, "s2"]);
    expect(playerOf(after, P2).playArea).not.toContain("s2");
    expect(inst(after, "s1" as InstanceId).damage).toBe(0);
    expect(playerOf(after, P1).discard).toContain(ticked.id);
  });

  it("a stunned Jessica cannot use the (attack) ability: it is cancelled, the stun is removed and the card stays", () => {
    const ticked = stagedInPlay(jessicaGame(TICKED), TICKED, { attach: true });
    const stunned = patchInstance(ticked.state, identityOf(ticked.state), {
      statuses: { stunned: 1, confused: 0, tough: 0 },
    });
    // A minion as the reveal, so the villain activates only once (a treachery "The villain schemes" would activate it again).
    const { state: after } = drive(stackEncounterDeck(stunned, ADVANCE, HYDRA_MERCENARY), endTurn(P1), undefended);
    expect(inst(after, identityOf(after)).statuses.stunned).toBe(0);
    expect(inst(after, after.activeVillainId!).damage).toBe(0);
    expect(inst(after, identityOf(after)).attachments).toContain(ticked.id);
  });
});

describe(`${FLIER_I} with ${JACKET_R}: a (defense) ability makes her the defender`, () => {
  it("using Reluctant Flier counts as defending, so the jacket places a counter", () => {
    const base = withForm(jessicaGame(FLIER, JACKET), { heroForm: 0 });
    const flier = stagedInPlay(base, FLIER, { attach: true });
    const jacket = stagedInPlay(flier.state, JACKET, { attach: true });
    const { state: after } = drive(stackEncounterDeck(jacket.state, HYDRA_MERCENARY, ADVANCE), endTurn(P1), undefended);
    expect(inst(after, identityOf(after)).damage).toBe(1);
    expect(evidenceOn(after)).toBe(1);
  });
});

describe(`${STAKEOUT_A} and ${STAKEOUT_I}: attach to a non-permanent encounter side scheme; thwarts there remove 2 more`, () => {
  const setup = (threat: number) => {
    const base = withForm(jessicaGame(STAKEOUT), { heroForm: 0 });
    const stake = stagedInPlay(base, STAKEOUT);
    const scheme = encounterCardInVillainArea(stake.state, BREAKIN, threat);
    return { id: stake.id, scheme: scheme.id, state: scheme.state };
  };

  it("attaches itself to the side scheme", () => {
    const g = setup(3);
    const { state: after } = drive(g.state, use(P1, g.id, STAKEOUT_A), picks({ cards: [g.scheme] }));
    expect(inst(after, g.id).attachedTo).toBe(g.scheme);
    expect(inst(after, g.scheme).attachments).toContain(g.id);
  });

  it("is refused once it is attached (no longer in the play area)", () => {
    const g = setup(3);
    const { state: attached } = drive(g.state, use(P1, g.id, STAKEOUT_A), picks({ cards: [g.scheme] }));
    expect(refused(attached, use(P1, g.id, STAKEOUT_A))).toBe(true);
  });

  const thwart = (g: ReturnType<typeof setup>, state: GameState) =>
    drive(
      state,
      {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(state),
        schemeInstanceId: g.scheme,
      } as Command,
      defending,
    );

  it("a thwart of 3 on a scheme with 3 threat defeats it: 2 evidence from Stakeout, and it is discarded with the scheme", () => {
    const g = setup(3);
    const { state: attached } = drive(g.state, use(P1, g.id, STAKEOUT_A), picks({ cards: [g.scheme] }));
    const { state: after } = thwart(g, attached);
    // 1 from her basic-power response, 2 from Alias Investigations answering the defeated side scheme, 2 from Stakeout.
    expect(evidenceOn(after)).toBe(5);
    expect(playerOf(after, P1).discard).toContain(g.id);
  });

  it("a thwart of 3 on a scheme with 8 threat removes 5 (2 more) and places no Stakeout counters", () => {
    const g = setup(8);
    const { state: attached } = drive(g.state, use(P1, g.id, STAKEOUT_A), picks({ cards: [g.scheme] }));
    const { state: after } = thwart(g, attached);
    expect(inst(after, g.scheme).threat).toBe(3);
    expect(evidenceOn(after)).toBe(1);
    expect(inst(after, g.id).attachedTo).toBe(g.scheme);
  });
});

describe("further edges", () => {
  it(`${LUKE_A} with a tough card already held: it absorbs the 1 damage and a new one is given`, () => {
    const g = stagedInPlay(jjGame(LUKE), LUKE);
    const held = patchInstance(g.state, g.id, { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const { state: after } = drive(held, use(P1, g.id, LUKE_A));
    expect(inst(after, g.id).statuses.tough).toBe(1);
    // The held tough card absorbs the cost damage (RRG 1.8 "Tough"), then a new one is given.
    expect(inst(after, g.id).damage).toBe(0);
    expect(inst(after, g.id).exhausted).toBe(true);
  });

  it(`${CAMCORDER_A}: the discarded minion goes to the encounter discard pile and its When Defeated does not resolve`, () => {
    const a = withAlias(9, CAMCORDER);
    const cam = stagedInPlay(a.state, CAMCORDER);
    const soldier = engageMinion(cam.state, "01182", "soldier"); // Hydra Soldier, with a When Defeated
    const { state: after, events } = drive(
      soldier,
      use(P1, cam.id, CAMCORDER_A, [], { minion: ["soldier" as InstanceId] }),
    );
    expect(Object.values(after.encounterDecks).some((pile) => pile.discard.includes("soldier" as InstanceId))).toBe(
      true,
    );
    expect(ofType(events, "abilityResolved").map((e) => e.abilityId)).not.toContain("01182.when-defeated");
  });

  it(`${STAKEOUT_A} is refused when the only side scheme in play is a player side scheme`, () => {
    const base = withForm(jjGame(STAKEOUT, "61007"), { heroForm: 0 });
    const stake = stagedInPlay(base, STAKEOUT);
    const given = moveToHand(stake.state, P1, "61007");
    const [piecing] = given.ids as [InstanceId];
    const { state: played } = drive(given.state, play(P1, piecing, payWith(given.state, P1, 0, [piecing])));
    expect(played.villainArea).toContain(piecing);
    expect(refused(played, use(P1, stake.id, STAKEOUT_A))).toBe(true);
  });
});
