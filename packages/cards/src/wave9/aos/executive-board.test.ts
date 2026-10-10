import { AOS_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import { createGame, statBonus, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  firstLegal,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { BLANK, FILLER_A, FILLER_B, SPIDER_MAN, codeOf, dataOf, heroForm, onlyDeck, setKit } from "../testing.js";
import { EXECUTIVE_BOARD, EXECUTIVE_BOARD_SKIPPED } from "./executive-board.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The S.H.I.E.L.D. Executive Board set (50181a to 50184c), docs/phase7-wave9.md sections 3.26 to 3.28, owner answers
 * Q1 and Q11 (both A). Rhino (Core) against a Spider-Man starter deck; the Board Members are put in play by surgery
 * (a Board Member environment in the villain area with the secret counters a test names), the A.I.M. Interference
 * cards are revealed by the real villain phase, and the Hero Actions are used for real.
 */
const MEDICAL = "50181a";
const MEDICAL_AID = "50181b";
const SURVEILLANCE = "50182a";
const SURVEILLANCE_AID = "50182b";
const TACTICAL = "50183a";
const TACTICAL_AID = "50183b";
const AIM_ENERGY = "50184a";
const AIM_MENTAL = "50184b";
const AIM_PHYSICAL = "50184c";
const ENVIRONMENTS = [MEDICAL, SURVEILLANCE, TACTICAL];
const REFS = [
  "50181a.chief-medical-officer-constant",
  "50181a.chief-medical-officer-action",
  "50181b.medical-officers-aid-forced-response",
  "50181b.medical-officers-aid-constant",
  "50182a.chief-surveillance-officer-constant",
  "50182a.chief-surveillance-officer-action",
  "50182b.surveillance-officers-aid-forced-response",
  "50182b.surveillance-officers-aid-constant",
  "50183a.chief-tactical-officer-constant",
  "50183a.chief-tactical-officer-action",
  "50183b.tactical-officers-aid-forced-response",
  "50183b.tactical-officers-aid-constant",
  "50184a.when-revealed",
  "50184a.boost",
  "50184b.when-revealed",
  "50184b.boost",
  "50184c.when-revealed",
  "50184c.boost",
];
const ALL = [MEDICAL, MEDICAL_AID, SURVEILLANCE, SURVEILLANCE_AID, TACTICAL, TACTICAL_AID];
// Core cards with one printed resource of a type, to pay a Hero Action with.
const ENERGY_CARDS = ["01002", "01006"];
const MENTAL_CARDS = ["01004", "01005"];
const PHYSICAL_CARDS = ["01003", "01008"];

const { deps: DEPS, setupGame, villainPhase } = setKit("s.h.i.e.l.d._executive_board", EXECUTIVE_BOARD);

/** The same game as `setupGame`, in expert mode. */
function setupExpert(): GameState {
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed: 1,
    difficulty: "expert",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOS_CARDS],
  });
  const cards = AOS_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("s.h.i.e.l.d._executive_board")),
  );
  const copies = cards.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

/** The three Board Member environments (put in play by Setup) with the secret counters a test names; none named has 0. */
function withMembers(state: GameState, secrets: Readonly<Record<string, number>>): GameState {
  let current = state;
  for (const [code, n] of Object.entries(secrets)) {
    const id = idOf(state, code);
    current = patchInstance(current, id, { counters: n > 0 ? { secret: n } : {} });
  }
  return current;
}
/** The instance of a Board Member environment `code`: in the villain area, or (flipped) its attachment face on the villain. */
const idOf = (s: GameState, code: string): InstanceId => {
  const inPlay = s.villainArea.find((i) => codeOf(s, i) === code);
  if (inPlay) return inPlay;
  const aid = `${code.slice(0, -1)}b`;
  const flipped = (Object.keys(s.instances) as InstanceId[]).find(
    (i) => codeOf(s, i) === aid && s.instances[i]!.attachedTo,
  );
  if (!flipped) throw new Error(`no ${code} in play`);
  return flipped;
};
const secretsOn = (s: GameState, id: InstanceId) => inst(s, id).counters["secret"] ?? 0;
const villainOf = (s: GameState) => s.villains[0]!.instanceId;
const PLACE = "Place the counter";
const rest = (s: GameState, ...codes: readonly string[]) => onlyDeck(s, BLANK, ...codes, FILLER_A, FILLER_B);

/** Answers a chooseOption by the label it contains, a chooseCards/target by `target`, a payment from `pay` hand cards. */
function scripted(opts: { label?: string | readonly string[]; target?: InstanceId; pay?: number } = {}): Picker {
  return (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseOption" && opts.label) {
      for (const label of [opts.label].flat()) {
        const hit = choice.options.find((o) => o.label.includes(label!));
        if (hit) return [hit.optionId];
      }
    }
    if (choice.prompt.kind === "chooseTarget" && opts.target) {
      const hit = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === opts.target);
      if (hit) return [hit.optionId];
    }
    if (choice.prompt.kind === "spendResources" || choice.prompt.kind === "payForAbility") {
      return choice.options
        .map((o) => o.optionId)
        .filter((id) => id.startsWith("hand:"))
        .slice(0, opts.pay ?? 0);
    }
    return firstLegal(s);
  };
}
/** Reveals `aim` in the next villain phase, `label` answering the choices; Rhino's boost is a blank. */
const reveal = (state: GameState, aim: string, pick: Picker = scripted({ label: PLACE })) =>
  villainPhase(rest(state, aim), [], pick);

describe("registry", () => {
  it("registers the eighteen refs of the nine cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(EXECUTIVE_BOARD).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(EXECUTIVE_BOARD)) expect(validateDefinition(def), id).toEqual([]);
    expect(EXECUTIVE_BOARD_SKIPPED).toEqual({});
  });

  it("the data names exactly the registered refs for the nine cards", () => {
    const codes = [...ALL, AIM_ENERGY, AIM_MENTAL, AIM_PHYSICAL];
    const refs = codes.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("Setup puts the three Board Member environments in play, with no secret counters, and the other faces in the deck", () => {
    const s = setupGame();
    expect(s.villainArea.map((id) => codeOf(s, id)).filter((c) => ENVIRONMENTS.includes(c))).toEqual(ENVIRONMENTS);
    for (const c of ENVIRONMENTS) expect(secretsOn(s, idOf(s, c))).toBe(0);
  });

  it("the attachment faces are data: attach to the villain, permanent, +1 ATK, +1 SCH, +1 ATK", () => {
    const stats = [MEDICAL_AID, SURVEILLANCE_AID, TACTICAL_AID].map((c) => dataOf(c).statModifiers);
    expect(stats).toEqual([{ atk: 1 }, { sch: 1 }, { atk: 1 }]);
    for (const c of [MEDICAL_AID, SURVEILLANCE_AID, TACTICAL_AID]) {
      expect(dataOf(c).attachesTo).toEqual({ kind: "villain" });
      expect(dataOf(c).keywords).toEqual([{ name: "permanent" }]);
    }
  });
});

describe("A.I.M. Interference (50184a to 50184c): When Revealed", () => {
  it("places 1 secret counter on each Board Member card when nothing is spent", () => {
    const state = withMembers(heroForm(setupGame()), { [MEDICAL]: 1, [SURVEILLANCE]: 2, [TACTICAL]: 0 });
    const run = reveal(state, AIM_ENERGY);
    const counts = ENVIRONMENTS.map((c) => secretsOn(run.state, idOf(run.state, c)));
    expect(counts).toEqual([2, 3, 1]);
  });

  it("spending a [energy] resource prevents one placing, the player naming which card gets none", () => {
    let state = heroForm(setupGame());
    state = withMembers(state, { [MEDICAL]: 2, [SURVEILLANCE]: 2, [TACTICAL]: 2 });
    const moved = moveToHand(state, P1, ...ENERGY_CARDS);
    state = moved.state;
    const medical = idOf(state, MEDICAL);
    // Prevent the Medical Officer's counter (the first card asked about), let the other two be placed.
    let spent = false;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseOption") {
        const spend = choice.options.find((o) => o.label.includes("prevent"));
        const place = choice.options.find((o) => o.label.includes("Place the counter"))!;
        if (spend && !spent) {
          spent = true;
          return [spend.optionId];
        }
        return [place.optionId];
      }
      if (choice.prompt.kind === "spendResources") return [`hand:${moved.ids[0]}`];
      return firstLegal(s);
    };
    const run = reveal(state, AIM_ENERGY, pick);
    const counts = ENVIRONMENTS.map((c) => secretsOn(run.state, idOf(run.state, c)));
    expect(spent).toBe(true);
    expect(counts.filter((n) => n === 2)).toHaveLength(1);
    expect(counts.filter((n) => n === 3)).toHaveLength(2);
    expect(medical).toBeDefined();
    expect(playerOf(run.state, P1).discard).toContain(moved.ids[0]);
    expect(playerOf(run.state, P1).hand).toContain(moved.ids[1]);
  });

  it("the [physical] card works the same way on a Board Member attachment too (both faces are Board Member cards)", () => {
    const state = withMembers(heroForm(setupGame()), { [MEDICAL]: 3 });
    const first = reveal(state, AIM_PHYSICAL);
    const medical = idOf(first.state, MEDICAL);
    expect(inst(first.state, medical).cardId).toBe(MEDICAL_AID);
    const second = reveal(first.state, AIM_PHYSICAL);
    expect(secretsOn(second.state, medical)).toBe(5);
  });
});

describe("the flip (50181a to 50183a)", () => {
  it("at the fourth secret counter the Medical Officer turns into its attachment on the villain, keeping all 4 counters (Q1 = A), and the villain gets +1 ATK", () => {
    const state = withMembers(heroForm(setupGame()), { [MEDICAL]: 3 });
    const medical = idOf(state, MEDICAL);
    const villain = villainOf(state);
    const atk = statBonus(state, DEPS, villain, "atk");
    const run = reveal(state, AIM_ENERGY);
    const card = inst(run.state, medical);
    expect(card.cardId).toBe(MEDICAL_AID);
    expect(card.attachedTo).toBe(villain);
    expect(run.state.villainArea).not.toContain(medical);
    expect(card.counters).toEqual({ secret: 4 });
    expect(statBonus(run.state, DEPS, villain, "atk")).toBe(atk + 1);
  });

  it("the Surveillance Officer turns into a +1 SCH attachment", () => {
    const state = withMembers(heroForm(setupGame()), { [SURVEILLANCE]: 3 });
    const villain = villainOf(state);
    const sch = statBonus(state, DEPS, villain, "sch");
    const run = reveal(state, AIM_MENTAL);
    expect(inst(run.state, idOf(run.state, SURVEILLANCE)).cardId).toBe(SURVEILLANCE_AID);
    expect(statBonus(run.state, DEPS, villain, "sch")).toBe(sch + 1);
  });

  it("at 2 counters (standard) a card does not turn; at 3 in expert mode it does", () => {
    const standard = reveal(withMembers(heroForm(setupGame()), { [TACTICAL]: 2 }), AIM_PHYSICAL);
    expect(inst(standard.state, idOf(standard.state, TACTICAL)).cardId).toBe(TACTICAL);
    expect(secretsOn(standard.state, idOf(standard.state, TACTICAL))).toBe(3);
    const expert = reveal(withMembers(heroForm(setupExpert()), { [TACTICAL]: 2 }), AIM_PHYSICAL);
    const card = inst(expert.state, idOf(expert.state, TACTICAL));
    expect(card.cardId).toBe(TACTICAL_AID);
    expect(card.counters).toEqual({ secret: 3 });
  });

  it("after the flip the Hero Action is gone (the attachment face has none)", () => {
    const state = withMembers(heroForm(setupGame()), { [MEDICAL]: 3 });
    const run = reveal(state, AIM_ENERGY);
    const medical = idOf(run.state, MEDICAL);
    expect(((dataOf(MEDICAL_AID).abilities ?? []) as { id: string }[]).map((a) => a.id)).not.toContain(
      "50181a.chief-medical-officer-action",
    );
    expect(inst(run.state, medical).cardId).toBe(MEDICAL_AID);
  });
});

describe("the players lose with 3 Board Member attachments in play", () => {
  it("two attachments do not lose the game", () => {
    const state = withMembers(heroForm(setupGame()), { [MEDICAL]: 3, [SURVEILLANCE]: 3, [TACTICAL]: 0 });
    const run = reveal(state, AIM_ENERGY);
    expect(inst(run.state, idOf(run.state, MEDICAL)).cardId).toBe(MEDICAL_AID);
    expect(inst(run.state, idOf(run.state, SURVEILLANCE)).cardId).toBe(SURVEILLANCE_AID);
    expect(run.state.outcome).toBeNull();
  });

  it("the third attachment loses the game", () => {
    const state = withMembers(heroForm(setupGame()), { [MEDICAL]: 3, [SURVEILLANCE]: 3, [TACTICAL]: 3 });
    const run = reveal(state, AIM_ENERGY);
    expect(run.state.outcome).toMatchObject({ result: "loss" });
  });
});

describe("Forced Responses of the attachments", () => {
  /** A Board Member flipped by a first A.I.M. Interference (4 counters); the second one places a fifth. */
  function flipped(code: string, others: Readonly<Record<string, number>> = {}) {
    const state = withMembers(heroForm(setupGame()), { [code]: 3, ...others });
    return reveal(state, AIM_ENERGY).state;
  }

  it("Medical Officer's Aid: the first player may heal 2 damage from the villain", () => {
    const start = flipped(MEDICAL);
    const villain = villainOf(start);
    const damaged = patchInstance(start, villain, { damage: 5 });
    const run = reveal(damaged, AIM_ENERGY, scripted({ label: ["Heal 2 damage from the villain", PLACE] }));
    expect(secretsOn(run.state, idOf(run.state, MEDICAL))).toBe(5);
    expect(inst(run.state, villain).damage).toBe(3);
  });

  it("Medical Officer's Aid: or deal 1 damage to the friendly character with the fewest remaining hit points", () => {
    const start = flipped(MEDICAL);
    const hero = start.players[0]!.identity.instanceId;
    const before = inst(start, hero).damage;
    const run = reveal(start, AIM_ENERGY, scripted({ label: ["fewest remaining", PLACE] }));
    expect(inst(run.state, hero).damage).toBeGreaterThan(before);
  });

  it("answers each placing once, however many counters were placed (one A.I.M. places one)", () => {
    const start = flipped(MEDICAL);
    const villain = villainOf(start);
    const run = reveal(
      patchInstance(start, villain, { damage: 6 }),
      AIM_ENERGY,
      scripted({ label: ["Heal 2", PLACE] }),
    );
    expect(inst(run.state, villain).damage).toBe(4);
  });

  /** The same villain phase with a blank in place of the A.I.M. card: what happens without the placing. */
  const control = (state: GameState) => villainPhase(onlyDeck(state, BLANK, FILLER_A, FILLER_B), []).state;

  it("Surveillance Officer's Aid: places 2 threat on the main scheme", () => {
    const start = flipped(SURVEILLANCE);
    const scheme = start.mainScheme.instanceId;
    const run = reveal(start, AIM_ENERGY);
    expect(secretsOn(run.state, idOf(run.state, SURVEILLANCE))).toBe(5);
    // Incite 1 puts 1 threat on the main scheme too; the Forced Response adds its 2.
    expect(inst(run.state, scheme).threat).toBe(inst(control(start), scheme).threat + 1 + 2);
  });

  it("Tactical Officer's Aid: deals 2 damage to a friendly character", () => {
    const start = flipped(TACTICAL);
    const hero = start.players[0]!.identity.instanceId;
    const run = reveal(start, AIM_ENERGY);
    expect(secretsOn(run.state, idOf(run.state, TACTICAL))).toBe(5);
    expect(inst(run.state, hero).damage).toBe(inst(control(start), hero).damage + 2);
  });
});

describe("Hero Actions of the environments", () => {
  /** Hero form, the card in the villain area with 2 secret counters, `cards` in hand. */
  function table(code: string, cards: readonly string[]) {
    const base = withMembers(heroForm(setupGame()), { [code]: 2 });
    const moved = moveToHand(base, P1, ...cards);
    return { state: moved.state, ids: moved.ids, member: idOf(moved.state, code) };
  }
  const act = (state: GameState, member: InstanceId, ref: string, ids: readonly InstanceId[], pick = firstLegal) =>
    driveEventsPicking(
      DEPS,
      state,
      pick,
      use(
        P1,
        member,
        ref,
        ids.map((fromHand) => ({ fromHand })),
      ),
    );

  it("Chief Medical Officer: spend [energy][energy], remove 1 secret counter, heal 1 damage from a friendly character", () => {
    const { state, ids, member } = table(MEDICAL, ENERGY_CARDS);
    const hero = state.players[0]!.identity.instanceId;
    const hurt = patchInstance(state, hero, { damage: 3 });
    const run = act(hurt, member, "50181a.chief-medical-officer-action", ids, scripted({ target: hero }));
    expect(secretsOn(run.state, member)).toBe(1);
    expect(inst(run.state, hero).damage).toBe(2);
    for (const id of ids) expect(playerOf(run.state, P1).discard).toContain(id);
  });

  it("Chief Surveillance Officer: spend [mental][mental], remove 1 secret counter, remove 2 threat from a scheme", () => {
    const { state, ids, member } = table(SURVEILLANCE, MENTAL_CARDS);
    const scheme = state.mainScheme.instanceId;
    const loaded = patchInstance(state, scheme, { threat: 7 });
    const run = act(loaded, member, "50182a.chief-surveillance-officer-action", ids, scripted({ target: scheme }));
    expect(secretsOn(run.state, member)).toBe(1);
    expect(inst(run.state, scheme).threat).toBe(5);
  });

  it("Chief Tactical Officer: spend [physical][physical], remove 1 secret counter, deal 2 damage to an enemy", () => {
    const { state, ids, member } = table(TACTICAL, PHYSICAL_CARDS);
    const villain = villainOf(state);
    const run = act(state, member, "50183a.chief-tactical-officer-action", ids, scripted({ target: villain }));
    expect(secretsOn(run.state, member)).toBe(1);
    expect(inst(run.state, villain).damage).toBe(2);
  });

  it("the wrong resource type does not pay for it: [physical] cards cannot pay the Medical Officer's [energy][energy]", () => {
    const { state, ids, member } = table(MEDICAL, PHYSICAL_CARDS);
    expect(() => act(state, member, "50181a.chief-medical-officer-action", ids)).toThrow();
  });
});
