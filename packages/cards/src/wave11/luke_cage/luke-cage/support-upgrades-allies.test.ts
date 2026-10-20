import { cardId } from "@mc/content";
import {
  characterProfile,
  createGame,
  keywordTotal,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_DEPS } from "../../index.js";
import { WAVE11_CARDS } from "../../cards.js";
import {
  LUKE_CAGE_LUKE_CAGE_SUPPORT_UPGRADES_ALLIES as REGISTRY,
  LUKE_CAGE_LUKE_CAGE_SUPPORT_UPGRADES_ALLIES_SKIPPED as SKIPPED,
} from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `luke_cage/luke-cage/support-upgrades-allies` (docs/phase7-wave11-hero-packs.md H8.4, H3.2, H3.15, H3.23):
 * Jessica Jones 62002, Fogwell's Gym 62007, Burstein Process 62008, Cruisin' for a Bruisin' 62009, Metal Bracer 62010
 * and Power Man 62011, from a hand-built Luke Cage deck against Core's Rhino (Luke Cage: ATK 2, THW 2, DEF 1, 10 hit
 * points; Shocker: ATK 2, 3 hit points). The full wave script is in force, so Luke's own Unbreakable Skin and its Forced
 * Response (1 unpreventable damage after a tough card is discarded) are part of every scenario.
 */
const JESSICA_C = "62002.jessica-jones-constant";
const GYM_R = "62007.fogwells-gym-response";
const BURSTEIN_A = "62008.burstein-process-action";
const CRUISIN_C = "62009.cruisin-for-a-bruisin-constant";
const CRUISIN_R = "62009.cruisin-for-a-bruisin-response";
const BRACER_C = "62010.metal-bracer-constant";
const BRACER_I = "62010.metal-bracer-interrupt";
const POWER_MAN_R = "62011.power-man-response";
const JESSICA = "62002";
const GYM = "62007";
const BURSTEIN = "62008";
const CRUISIN = "62009";
const BRACER = "62010";
const POWER_MAN = "62011";
const KNUCKLE_SANDWICH = "62004"; // Deal 3 damage to an enemy; may discard a tough status card from Luke Cage to return it
const SHOCKER = "01103"; // Core minion: ATK 2, 3 hit points, no guard
const HYDRA_MERCENARY = "01101"; // Core minion: ATK 1, guard
const FILLER = "01091";

function lukeGame(form: "hero" | "alterEgo" = "hero"): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const deck = [JESSICA, GYM, BURSTEIN, CRUISIN, BRACER, POWER_MAN, KNUCKLE_SANDWICH, ...Array(40).fill(FILLER)].slice(
    0,
    40,
  );
  const created = createGame(
    {
      ...base,
      requireLegalDecks: false,
      players: [{ identityCardId: cardId("62001a"), aspects: ["leadership"], deck: deck.map((c) => cardId(c)) }],
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  return form === "hero" ? withForm(opened, { heroForm: 0 }) : opened;
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

/** Takes the option whose label starts with one of `labels` when offered, else `fallback`. */
const byLabel =
  (labels: readonly string[], fallback: Picker = firstLegal): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => labels.some((l) => o.label.startsWith(l)));
    return hit ? [hit.optionId] : fallback(state);
  };
/** Accepts an offered response or interrupt of this card (an option naming it), else the first legal answer. */
const accepting =
  (card: InstanceId, fallback: Picker = firstLegal): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find(
      (o) => (o.ref.kind === "card" || o.ref.kind === "ability") && o.ref.instanceId === card,
    );
    return hit ? [hit.optionId] : fallback(state);
  };
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const pickVillain: Picker = (state) => {
  const hit = state.pendingChoice?.options.find(
    (o) => o.ref.kind === "card" && o.ref.instanceId === state.activeVillainId,
  );
  return hit ? [hit.optionId] : firstLegal(state);
};
const tough = (s: GameState): number => inst(s, identityOf(s)).statuses.tough;
const withTough = (s: GameState, n: number): GameState =>
  patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, tough: n } });
const damageOf = (s: GameState, id: InstanceId = identityOf(s)): number => inst(s, id).damage;
const thwOf = (s: GameState, id: InstanceId): number => characterProfile(s, id, WAVE11_DEPS)!.thw;

/** Knuckle Sandwich, its tough-discard option taken, aimed at the villain: the way to discard a tough card on demand. */
function knuckle(state: GameState) {
  const given = moveToHand(state, P1, KNUCKLE_SANDWICH);
  const [id] = given.ids as [InstanceId];
  return { state: given.state, command: play(P1, id, payWith(given.state, P1, 1, [id])) };
}
/** Takes the card's own response or interrupt when offered, else the tough-discard option, else the villain target. */
const discardingTough =
  (accept?: InstanceId): Picker =>
  (state) =>
    (accept === undefined
      ? byLabel(["Discard a tough"], pickVillain)
      : accepting(accept, byLabel(["Discard a tough"], pickVillain)))(state);

describe("wave 11 luke_cage/luke-cage/support-upgrades-allies registry", () => {
  it("registers only valid definitions, with the printed timing, and skips nothing", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [JESSICA_C, GYM_R, BURSTEIN_A, CRUISIN_C, CRUISIN_R, BRACER_C, BRACER_I, POWER_MAN_R].sort(),
    );
    for (const id of [JESSICA_C, CRUISIN_C, BRACER_C])
      expect(REGISTRY[id]!.trigger, id).toMatchObject({ kind: "constant" });
    expect(REGISTRY[GYM_R]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[BURSTEIN_A]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(REGISTRY[CRUISIN_R]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[BRACER_I]!.trigger).toMatchObject({ kind: "interrupt", form: "hero" });
    expect(REGISTRY[POWER_MAN_R]!.trigger).toMatchObject({ kind: "response", form: "hero" });
  });
});

describe(`${JESSICA_C}: +1 THW for each tough status card on your identity, to a maximum of +4`, () => {
  it.each([
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 5],
  ])("with %i tough card(s) on Luke Cage her THW is %i (printed 1)", (n, thw) => {
    const jessica = stagedInPlay(withTough(lukeGame(), n), JESSICA);
    expect(thwOf(jessica.state, jessica.id)).toBe(thw);
  });
});

describe(`${GYM_R}: after a tough card is discarded from a Defender character, exhaust the gym to ready it`, () => {
  const setup = () => {
    const gym = stagedInPlay(withTough(lukeGame(), 1), GYM);
    const exhaustedLuke = patchInstance(gym.state, identityOf(gym.state), { exhausted: true });
    return { gym: gym.id, ...knuckle(exhaustedLuke) };
  };

  it("readies Luke Cage (a Defender in hero form) and exhausts the gym", () => {
    const s = setup();
    const { state } = drive(s.state, s.command, discardingTough(s.gym));
    expect(tough(state)).toBe(0);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(inst(state, s.gym).exhausted).toBe(true);
  });

  it("also answers a tough card discarded from a Defender ally: Jessica Jones attacks, her tough card absorbs the consequential damage, the gym readies her", () => {
    const gym = stagedInPlay(engageMinion(lukeGame(), SHOCKER, "shock"), GYM);
    const jessica = stagedInPlay(gym.state, JESSICA);
    const armed = patchInstance(jessica.state, jessica.id, {
      statuses: { ...inst(jessica.state, jessica.id).statuses, tough: 1 },
    });
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: jessica.id,
      targetInstanceId: "shock" as InstanceId,
    };
    const { state } = drive(armed, attack, accepting(gym.id));
    expect(inst(state, jessica.id).statuses.tough).toBe(0);
    expect(inst(state, jessica.id).exhausted).toBe(false);
    expect(inst(state, gym.id).exhausted).toBe(true);
    const declined = drive(armed, attack, firstLegal).state;
    expect(inst(declined, jessica.id).exhausted).toBe(true);
    expect(inst(declined, gym.id).exhausted).toBe(false);
  });

  it("leaves him exhausted and the gym ready when the response is declined", () => {
    const s = setup();
    const { state } = drive(s.state, s.command, discardingTough());
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
    expect(inst(state, s.gym).exhausted).toBe(false);
  });
});

describe(`${BURSTEIN_A}: Alter-Ego Action, exhaust: give Luke Cage a tough card (2 instead if he has none)`, () => {
  const run = (toughStart: number) => {
    const process = stagedInPlay(withTough(lukeGame("alterEgo"), toughStart), BURSTEIN, { attach: true });
    const { state } = drive(process.state, use(P1, process.id, BURSTEIN_A));
    return { toughNow: tough(state), exhausted: inst(state, process.id).exhausted };
  };

  it("with none: gives 2 and exhausts the upgrade", () => {
    expect(run(0)).toEqual({ toughNow: 2, exhausted: true });
  });

  it("with 1 held: gives 1 more", () => {
    expect(run(1)).toEqual({ toughNow: 2, exhausted: true });
  });

  it("with 3 held (any number allowed): gives 1 more", () => {
    expect(run(3)).toEqual({ toughNow: 4, exhausted: true });
  });

  it("is refused in hero form", () => {
    const process = stagedInPlay(lukeGame("hero"), BURSTEIN, { attach: true });
    expect(refused(process.state, use(P1, process.id, BURSTEIN_A))).toBe(true);
  });
});

describe(`${CRUISIN_C}: attacks against the attached minion deal 2 additional damage and gain overkill`, () => {
  /** Cruisin' attached to the engaged Shocker by surgery, so only the constant is under test. */
  function attached() {
    const withMinion = engageMinion(lukeGame(), SHOCKER, "shock");
    const cruisin = stagedInPlay(withMinion, CRUISIN, { attach: true });
    const minion = "shock" as InstanceId;
    const loose = patchInstance(cruisin.state, identityOf(cruisin.state), { attachments: [] });
    const upgraded = patchInstance(loose, cruisin.id, { attachedTo: minion });
    return patchInstance(upgraded, minion, { attachments: [cruisin.id] });
  }
  const basicAttack = (state: GameState): Command => ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: identityOf(state),
    targetInstanceId: "shock" as InstanceId,
  });

  it("Luke Cage's basic attack (2) deals 4 to the 3 hit point minion; the excess 1 overkills into the villain", () => {
    const state = attached();
    const { state: after } = drive(state, basicAttack(state));
    expect(playerOf(after, P1).playArea).not.toContain("shock");
    expect(damageOf(after, villainOf(after))).toBe(1);
  });

  it("control, without Cruisin': the same attack leaves the minion with 2 damage and the villain untouched", () => {
    const state = engageMinion(lukeGame(), SHOCKER, "shock");
    const { state: after } = drive(state, basicAttack(state));
    expect(damageOf(after, "shock" as InstanceId)).toBe(2);
    expect(damageOf(after, villainOf(after))).toBe(0);
  });
});

describe(`${CRUISIN_R}: after you play this card, engage attached minion`, () => {
  /** Shocker in play engaged with nobody (in the villain area). */
  function unengagedShocker(): GameState {
    const engaged = engageMinion(lukeGame(), SHOCKER, "shock");
    const id = "shock" as InstanceId;
    return patchInstance(
      {
        ...engaged,
        players: engaged.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== id) })),
        villainArea: [...engaged.villainArea, id],
      },
      id,
      { engagedWith: null },
    );
  }
  const playOnto = (state: GameState) => {
    const given = moveToHand(state, P1, CRUISIN);
    const [id] = given.ids as [InstanceId];
    return { state: given.state, id, command: play(P1, id, [], { attachToInstanceId: "shock" as InstanceId }) };
  };

  it("engages the minion with you when the response is taken", () => {
    const s = playOnto(unengagedShocker());
    expect(inst(s.state, "shock" as InstanceId).engagedWith).toBe(null);
    const { state } = drive(s.state, s.command, accepting(s.id));
    expect(inst(state, "shock" as InstanceId).attachments).toEqual([s.id]);
    expect(inst(state, "shock" as InstanceId).engagedWith).toBe(P1);
    expect(playerOf(state, P1).playArea).toContain("shock");
  });

  it("leaves the minion unengaged when the response is declined", () => {
    const s = playOnto(unengagedShocker());
    const { state } = drive(s.state, s.command, firstLegal);
    expect(inst(state, "shock" as InstanceId).attachments).toEqual([s.id]);
    expect(inst(state, "shock" as InstanceId).engagedWith).toBe(null);
  });
});

describe(`${BRACER_C}: Luke Cage gains retaliate 1`, () => {
  it("has retaliate 1 only while Metal Bracer is attached", () => {
    const base = lukeGame();
    expect(keywordTotal(base, identityOf(base), "retaliate", WAVE11_DEPS)).toBe(0);
    const bracer = stagedInPlay(base, BRACER, { attach: true });
    expect(keywordTotal(bracer.state, identityOf(bracer.state), "retaliate", WAVE11_DEPS)).toBe(1);
  });
});

describe(`${BRACER_I}: when damage would be dealt to Luke Cage, exhaust Metal Bracer to reduce it by 1`, () => {
  /** The villain is stunned, so the only attack is Shocker's (ATK 2) at the end of the turn. */
  function shockerAttacks(pick: (bracer: InstanceId) => Picker, hero = true) {
    const base = lukeGame(hero ? "hero" : "alterEgo");
    const villain = villainOf(base);
    const quiet = patchInstance(base, villain, { statuses: { ...inst(base, villain).statuses, stunned: 1 } });
    const bracer = stagedInPlay(engageMinion(quiet, SHOCKER, "shock"), BRACER, { attach: true });
    const { state } = drive(bracer.state, endTurn(P1), pick(bracer.id));
    return { state, bracer: bracer.id };
  }

  it("taken: 2 damage becomes 1 and the bracer is exhausted", () => {
    const r = shockerAttacks((bracer) => accepting(bracer));
    expect(damageOf(r.state)).toBe(1);
    expect(inst(r.state, r.bracer).exhausted).toBe(true);
  });

  it("declined: the full 2 damage and the bracer stays ready", () => {
    const r = shockerAttacks(() => firstLegal);
    expect(damageOf(r.state)).toBe(2);
    expect(inst(r.state, r.bracer).exhausted).toBe(false);
  });
});

describe(`${BRACER_I}: before tough ("would be dealt", ruling August 26, 2026 - Ruling 2)`, () => {
  /** Luke with 1 tough card and the bracer, the villain stunned, and one minion of `atk` attacking at the end of turn. */
  function attackedThroughTough(minion: string, pick: (bracer: InstanceId) => Picker) {
    const base = lukeGame();
    const villain = villainOf(base);
    const quiet = patchInstance(base, villain, { statuses: { ...inst(base, villain).statuses, stunned: 1 } });
    const bracer = stagedInPlay(engageMinion(withTough(quiet, 1), minion, "minion"), BRACER, { attach: true });
    const { state, events } = drive(bracer.state, endTurn(P1), pick(bracer.id));
    return { state, events, bracer: bracer.id };
  }

  it("a 1-ATK attack: Bracer reduces the damage dealt to 0, so the tough card is kept and Luke takes nothing", () => {
    const r = attackedThroughTough(HYDRA_MERCENARY, (bracer) => accepting(bracer));
    expect(inst(r.state, r.bracer).exhausted).toBe(true);
    expect(tough(r.state)).toBe(1);
    expect(damageOf(r.state)).toBe(0);
    expect(r.events).toContainEqual(expect.objectContaining({ type: "damageReduced", amount: 1 }));
    expect(r.events.some((e) => e.type === "damagePrevented")).toBe(false);
  });

  it("a 2-ATK attack: Bracer is offered first and takes 1 off; the tough card stops the rest, then Luke's 1", () => {
    const r = attackedThroughTough(SHOCKER, (bracer) => accepting(bracer));
    expect(inst(r.state, r.bracer).exhausted).toBe(true);
    expect(tough(r.state)).toBe(0);
    // Unbreakable Skin's Forced Response: 1 unpreventable damage after the tough card is discarded.
    expect(damageOf(r.state)).toBe(1);
  });

  it("declined: the tough card absorbs the attack, and Bracer is not offered against Luke's unpreventable 1", () => {
    let offers = 0;
    const r = attackedThroughTough(SHOCKER, (bracer) => (state) => {
      const options = state.pendingChoice?.options ?? [];
      if (options.some((o) => (o.ref.kind === "card" || o.ref.kind === "ability") && o.ref.instanceId === bracer))
        offers++;
      return firstLegal(state);
    });
    expect(offers).toBe(1);
    expect(tough(r.state)).toBe(0);
    expect(damageOf(r.state)).toBe(1);
    expect(inst(r.state, r.bracer).exhausted).toBe(false);
  });
});

describe(`${POWER_MAN_R}: after a tough card is discarded from Luke Cage, exhaust Power Man to draw a card`, () => {
  const setup = () => {
    const power = stagedInPlay(withTough(lukeGame(), 1), POWER_MAN, { attach: true });
    return { power: power.id, ...knuckle(power.state) };
  };

  it("draws a card and exhausts the upgrade", () => {
    const s = setup();
    const before = playerOf(s.state, P1).hand.length;
    const { state } = drive(s.state, s.command, discardingTough(s.power));
    expect(inst(state, s.power).exhausted).toBe(true);
    // Hand: Knuckle Sandwich played (-1) and 1 card paid with (-1), the tough card returns it (+1), Power Man draws (+1).
    expect(playerOf(state, P1).hand.length).toBe(before);
  });

  it("draws nothing when declined", () => {
    const s = setup();
    const before = playerOf(s.state, P1).hand.length;
    const { state } = drive(s.state, s.command, discardingTough());
    expect(inst(state, s.power).exhausted).toBe(false);
    expect(playerOf(state, P1).hand.length).toBe(before - 1);
  });
});
