import { JJ_CARDS, JJ_STARTER_DECKS, MTS_CARDS, type HeroIdentityCard } from "@mc/content";
import {
  activeVillain,
  applyCommand,
  characterProfile,
  createGame,
  type Command,
  type GameState,
  type InstanceId,
  villainOf as villainStateOf,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  answer,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  settle,
  use,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { towerDefenseScenario } from "../../../wave4/mts/tower-defense-setup.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { JJ_JESSICA_JONES_IDENTITY as REGISTRY, JJ_JESSICA_JONES_IDENTITY_SKIPPED as SKIPPED } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `jj/jessica-jones/identity` (docs/phase7-wave11-hero-packs.md H8.4, H3.4, H3.6): Jessica Jones 61001a/b and
 * Alias Investigations 61002, from her printed Justice starter deck against Core's Rhino. Hero face: THW 3, ATK 2,
 * DEF 1, 11 hit points, hand size 5; alter-ego face: REC 4, hand size 6.
 */
const GATHER = "61001a.star-gather-evidence";
const INCOGNITO = "61001b.incognito-mode";
const SETUP = "61001b.setup";
const ALIAS_RESPONSE = "61002.alias-investigations-response";
const ALIAS = "61002";
const SIDE_SCHEME = "01107"; // a Rhino side scheme

const IDENTITY = JJ_CARDS.find((c) => c.id === "61001a") as HeroIdentityCard;

function jessicaGame(): GameState {
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
  const created = createGame({ ...base, players: [seat] }, WAVE11_DEPS);
  if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}
const heroGame = (): GameState => withForm(jessicaGame(), { heroForm: 0 });

const aliasOf = (s: GameState): InstanceId => instancesOf(s, ALIAS)[0]!;
const evidence = (s: GameState): number => inst(s, aliasOf(s)).counters["evidence"] ?? 0;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;

/** Applies `command`, taking the choice option that names one of `take` when there is one, else the default. */
function drive(state: GameState, command: Command, take: readonly string[] = [GATHER]): GameState {
  const first = applyCommand(state, command, WAVE11_DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  let current = first.state;
  for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
    if (guard > 40) throw new Error(`choices did not settle (${current.pendingChoice.prompt.kind})`);
    const mine = current.pendingChoice.options.find((o) => take.some((t) => JSON.stringify(o).includes(t)));
    current = answer(current, mine ? [mine.optionId] : firstLegal(current), WAVE11_DEPS);
  }
  return current;
}

describe("Jessica Jones identity registry", () => {
  it("registers only valid definitions, with the printed timing", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(REGISTRY[GATHER]!.trigger).toMatchObject({ kind: "response" });
    expect(REGISTRY[INCOGNITO]!.trigger).toMatchObject({ kind: "action" });
    expect(REGISTRY[SETUP]!.trigger).toMatchObject({ kind: "setup" });
    expect(REGISTRY[ALIAS_RESPONSE]!.trigger).toMatchObject({ kind: "response" });
  });

  it("registers all four printed refs and skips none", () => {
    expect(SKIPPED).toEqual({});
    const printed = [...IDENTITY.hero.abilities, ...IDENTITY.alterEgo.abilities].map((a) => a.id as string);
    expect([...printed, ALIAS_RESPONSE].sort()).toEqual(Object.keys(REGISTRY).sort());
  });
});

describe(`${SETUP}: put Alias Investigations into play`, () => {
  it("opens with Alias Investigations in play, ready, with no evidence, and not in the deck or hand", () => {
    const s = jessicaGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    const [alias] = instancesOf(s, ALIAS);
    expect(alias).toBeDefined();
    expect(playerOf(s, P1).playArea).toContain(alias);
    expect(inst(s, alias!)).toMatchObject({ faceup: true, exhausted: false, controllerId: P1 });
    expect(playerOf(s, P1).deck).not.toContain(alias);
    expect(playerOf(s, P1).hand).not.toContain(alias);
    expect(evidence(s)).toBe(0);
  });
});

describe(`${INCOGNITO}: change to hero form, no change back this phase`, () => {
  it("changes her to hero form, then she cannot change back to alter-ego form this phase", () => {
    const s0 = jessicaGame();
    const s1 = drive(s0, use(P1, identityOf(s0), INCOGNITO), [INCOGNITO]);
    expect(playerOf(s1, P1).identity.form).toBe("hero");
    const back = applyCommand(s1, { type: "changeForm", playerId: P1 }, WAVE11_DEPS);
    expect(back.ok).toBe(false);
  });
});

describe(`${GATHER}: after you use a basic power, place 1 evidence counter on Alias Investigations`, () => {
  it("a basic thwart and a basic attack each place one counter, when taken", () => {
    const s0 = heroGame();
    const id = identityOf(s0);
    const withScheme = patchInstance(s0, s0.mainScheme.instanceId, { threat: 5 });
    const thwarted = drive(withScheme, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: id,
      schemeInstanceId: s0.mainScheme.instanceId,
    });
    expect(evidence(thwarted)).toBe(1);

    const attacked = drive(s0, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: id,
      targetInstanceId: villainOf(s0),
    });
    expect(evidence(attacked)).toBe(1);

    // A basic recover is an alter-ego power: she cannot use it in hero form, so it never earns evidence.
    const recover = applyCommand(
      patchInstance(s0, id, { damage: 4 }),
      { type: "basicRecover", playerId: P1 },
      WAVE11_DEPS,
    );
    expect(recover.ok).toBe(false);
  });

  it("defending a villain attack with DEF is a basic power too: one counter is placed", () => {
    const s0 = heroGame();
    const id = identityOf(s0);
    const current = applyCommand(s0, { type: "endTurn", playerId: P1 }, WAVE11_DEPS);
    if (!current.ok) throw new Error(current.error.message);
    let state = current.state;
    let defended = false;
    for (let guard = 0; state.pendingChoice && !state.outcome; guard++) {
      if (guard > 60) throw new Error("choices did not settle");
      const choice = state.pendingChoice;
      let pick: readonly string[];
      if (choice.prompt.kind === "declareDefender") {
        defended = true;
        pick = [id as string];
      } else {
        const mine = choice.options.find((o) => JSON.stringify(o).includes(GATHER));
        pick = mine ? [mine.optionId] : firstLegal(state);
      }
      state = answer(state, pick, WAVE11_DEPS);
    }
    expect(defended).toBe(true);
    expect(evidence(state)).toBe(1);
  });

  it("is optional: declined, nothing is placed", () => {
    const s0 = heroGame();
    const id = identityOf(s0);
    const s1 = drive(
      patchInstance(s0, s0.mainScheme.instanceId, { threat: 5 }),
      { type: "basicThwart", playerId: P1, thwarterInstanceId: id, schemeInstanceId: s0.mainScheme.instanceId },
      ["no such option"],
    );
    expect(evidence(s1)).toBe(0);
  });

  it("is not heard in alter-ego form: a basic recover there (the only form that can) places nothing", () => {
    const s = jessicaGame();
    const s1 = drive(patchInstance(s, identityOf(s), { damage: 4 }), { type: "basicRecover", playerId: P1 });
    expect(playerOf(s1, P1).identity.form).toBe("alterEgo");
    expect(evidence(s1)).toBe(0);
  });
});

describe(`${ALIAS_RESPONSE}: after a side scheme is defeated, exhaust to place 2 evidence; then may defeat the villain's stage`, () => {
  /** A side scheme with 1 threat in play, a villain with `left` hit points remaining and `held` evidence on Alias. */
  function table(left: number, held: number): { state: GameState; scheme: InstanceId } {
    const s0 = heroGame();
    const placed = encounterCardInVillainArea(s0, SIDE_SCHEME, 1);
    const hp = characterProfile(placed.state, villainOf(placed.state), WAVE11_DEPS)!.maxHp;
    let state = patchInstance(placed.state, villainOf(placed.state), { damage: hp - left });
    state = patchInstance(state, aliasOf(state), { counters: { evidence: held } });
    return { state, scheme: placed.id };
  }
  const thwart = (s: GameState, scheme: InstanceId): Command => ({
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: identityOf(s),
    schemeInstanceId: scheme,
  });

  it("places 2 evidence counters and exhausts itself; with too few counters the defeat is not offered", () => {
    const t = table(10, 0);
    const s1 = drive(t.state, thwart(t.state, t.scheme), [ALIAS_RESPONSE]);
    expect(evidence(s1)).toBe(2);
    expect(inst(s1, aliasOf(s1)).exhausted).toBe(true);
    expect(inst(s1, villainOf(s1)).damage).toBe(inst(t.state, villainOf(t.state)).damage);
  });

  it("with counters equal to the villain's remaining hit points, removes them all and defeats the stage", () => {
    const t = table(3, 1);
    expect(activeVillain(t.state).stageIndex).toBe(0);
    const s1 = drive(t.state, thwart(t.state, t.scheme), [ALIAS_RESPONSE, "Remove evidence counters"]);
    expect(evidence(s1)).toBe(0);
    expect(activeVillain(s1).stageIndex).toBe(1);
  });

  it("may be declined: the counters stay and the villain stays", () => {
    const t = table(3, 1);
    const s1 = drive(t.state, thwart(t.state, t.scheme), [ALIAS_RESPONSE, "Do not defeat"]);
    expect(evidence(s1)).toBe(3);
    expect(inst(s1, villainOf(s1)).damage).toBe(inst(t.state, villainOf(t.state)).damage);
  });

  it("is not offered while it is exhausted", () => {
    const t = table(3, 5);
    const exhausted = patchInstance(t.state, aliasOf(t.state), { exhausted: true });
    const s1 = drive(exhausted, thwart(exhausted, t.scheme), [ALIAS_RESPONSE]);
    expect(evidence(s1)).toBe(5);
  });
});

describe(`${ALIAS_RESPONSE} in Tower Defense: two villains, each locked while the other has hit points (issue #663)`, () => {
  const PROXIMA = "21092";
  const CORVUS = "21095";

  /** Jessica Jones against Proxima Midnight and Corvus Glaive, in hero form, with a Tower Defense side scheme at 1 threat
   * and `held` evidence on Alias Investigations. */
  function towerTable(held: number): { state: GameState; scheme: InstanceId } {
    const deck = JJ_STARTER_DECKS[0]!;
    const seat = {
      identityCardId: deck.identityCardId,
      aspects: deck.aspects,
      deck: deck.cards.flatMap((l) => Array.from({ length: l.quantity }, () => l.cardId)),
    };
    const created = createGame(
      towerDefenseScenario({ seed: 1, players: [seat], difficulty: "standard", modularSetIds: [] }),
      WAVE11_DEPS,
    );
    if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
    const s0 = withForm(
      settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS),
      { heroForm: 0 },
    );
    const sideScheme = Object.values(s0.instances)
      .map((i) => i!.cardId as string)
      .find((code) => MTS_CARDS.some((c) => c.id === code && c.type === "side_scheme"))!;
    const placed = encounterCardInVillainArea(s0, sideScheme, 1);
    return {
      state: patchInstance(placed.state, aliasOf(placed.state), { counters: { evidence: held } }),
      scheme: placed.id,
    };
  }
  const villainNamed = (s: GameState, code: string): InstanceId => instancesOf(s, code)[0]!;
  const thwart = (s: GameState, scheme: InstanceId): Command => ({
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: identityOf(s),
    schemeInstanceId: scheme,
  });

  it("does not offer the defeat while the other villain has hit points left: no counters are spent", () => {
    const t = towerTable(40);
    const proxima = villainNamed(t.state, PROXIMA);
    const offered: string[] = [];
    const first = applyCommand(t.state, thwart(t.state, t.scheme), WAVE11_DEPS);
    if (!first.ok) throw new Error(first.error.message);
    let s = first.state;
    for (let guard = 0; s.pendingChoice && guard < 20; guard++) {
      const choice = s.pendingChoice;
      offered.push(...choice.options.map((o) => o.label));
      const pick =
        choice.options.find((o) => o.optionId === proxima) ??
        choice.options.find((o) => JSON.stringify(o).includes(ALIAS_RESPONSE));
      s = answer(s, pick ? [pick.optionId] : firstLegal(s), WAVE11_DEPS);
    }
    expect(offered.some((label) => label.startsWith("Remove evidence counters"))).toBe(false);
    // 40 held + 2 placed; the Star's own "gather evidence" response is declined by `firstLegal`.
    expect(evidence(s)).toBe(42);
    expect(villainStateOf(s, proxima)?.stageIndex).toBe(villainStateOf(t.state, proxima)?.stageIndex);
  });

  it("with the other villain at 0 hit points, defeats the chosen villain's stage; the other stays at 0, undefeated", () => {
    const t = towerTable(40);
    const proxima = villainNamed(t.state, PROXIMA);
    const corvus = villainNamed(t.state, CORVUS);
    const corvusHp = characterProfile(t.state, corvus, WAVE11_DEPS)!.maxHp;
    const staged = patchInstance(t.state, corvus, { damage: corvusHp });
    const proximaHp = characterProfile(staged, proxima, WAVE11_DEPS)!.maxHp;
    const first = applyCommand(staged, thwart(staged, t.scheme), WAVE11_DEPS);
    if (!first.ok) throw new Error(first.error.message);
    let s = first.state;
    for (let guard = 0; s.pendingChoice && guard < 20; guard++) {
      const pick =
        s.pendingChoice.options.find((o) => o.optionId === proxima) ??
        s.pendingChoice.options.find((o) => /61002|Remove evidence/.test(JSON.stringify(o)));
      s = answer(s, pick ? [pick.optionId] : firstLegal(s), WAVE11_DEPS);
    }
    expect(villainStateOf(s, proxima)?.stageIndex).toBe(villainStateOf(staged, proxima)!.stageIndex + 1);
    expect(evidence(s)).toBe(42 - proximaHp);
    expect(villainStateOf(s, corvus)?.defeated).toBe(false);
    expect(villainStateOf(s, corvus)?.stageIndex).toBe(villainStateOf(staged, corvus)?.stageIndex);
    expect(s.outcome).toBeNull();
  });
});
