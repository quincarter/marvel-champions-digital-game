import { AOA_CARDS, CORE_CARDS } from "@mc/content";
import {
  createGame,
  keywordTotal,
  maxHitPoints,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, playFromHand, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { PRELATES, PRELATES_SKIPPED } from "./prelates.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Prelates (45179b to 45183b), docs/phase7-wave8.md §1.15, §3.22, §3.30, §3.32. There is no wave 8 scenario
 * builder yet, so the game is Core's Rhino config with the five Prelates added to the encounter deck by hand; each is
 * stacked on top and revealed by a real `endTurn` (the first player reveals it, so it engages them).
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, PRELATES) };

const SINISTER = "45179b";
const SHADOW_KING = "45180b";
const ABYSS = "45181b";
const SUGAR_MAN = "45182b";
const RASPUTIN = "45183b";
const PRELATE_CODES = [SINISTER, SHADOW_KING, ABYSS, SUGAR_MAN, RASPUTIN];
const REFS = [
  "45179b.mister-sinister-constant",
  "45180b.the-shadow-king-constant",
  "45180b.the-shadow-king-forced-response",
  "45181b.abyss-constant",
  "45181b.abyss-forced-response",
  "45182b.sugar-man-constant",
  "45182b.sugar-man-forced-interrupt",
  "45183b.mikhail-rasputin-constant",
  "45183b.mikhail-rasputin-forced-interrupt",
];
const DAREDEVIL = "01058"; // ally, THW 2, 3 hit points, cost 4
const JESSICA_JONES = "01059"; // ally, THW 1, 3 hit points

const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const inPlayOf = (s: GameState, code: string): InstanceId | undefined =>
  Object.keys(s.instances).find(
    (id) => codeOf(s, id as InstanceId) === code && s.instances[id as InstanceId]!.engagedWith === P1,
  ) as InstanceId | undefined;

function setupGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const created = createGame(
    { ...config, encounterDeck: [...config.encounterDeck, ...(PRELATE_CODES as never[])] },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

interface Plan {
  readonly choose?: string;
  readonly defend?: InstanceId;
  /** Collects the kind of every prompt the run asks. */
  readonly seen?: string[];
}
function drive(state: GameState, plan: Plan, ...commands: Command[]) {
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    plan.seen?.push(choice.prompt.kind);
    if (choice.prompt.kind === "declareDefender") {
      return plan.defend && choice.options.some((o) => o.optionId === plan.defend) ? [plan.defend] : ["decline"];
    }
    if (choice.prompt.kind === "chooseOption") {
      const hit = choice.options.find((o) => (plan.choose ? o.label.startsWith(plan.choose) : true));
      return [(hit ?? choice.options[0]!).optionId];
    }
    return firstLegal(s);
  };
  return driveEventsPicking(DEPS, state, pick, ...commands);
}

/** One end of turn: each enemy that activates draws a blank boost; then the player is dealt each of `reveals`. */
function round(
  state: GameState,
  opts: { reveals?: readonly string[]; hero?: boolean; plan?: Plan; boosts?: number } = {},
) {
  // Blank boost cards still in the deck or discard (the standard set has two copies of each of two).
  const pile = piles(state);
  const blanks = [...pile.deck, ...pile.discard]
    .map((id) => codeOf(state, id))
    .filter((c) => c === "01186" || c === "01187");
  const boosts = blanks.slice(0, opts.boosts ?? 3);
  const stacked = stackEncounterDeck(state, ...boosts, ...(opts.reveals ?? []));
  const form = opts.hero ? withForm(stacked, { heroForm: 0 }) : withForm(stacked, "alterEgo");
  return drive(form, opts.plan ?? {}, endTurn(P1));
}

/** Five deck cards moved to hand by surgery, to pay for allies. */
const fullHand = (s: GameState): GameState => {
  const owner = playerOf(s, P1);
  const take = owner.deck.slice(0, 8);
  return {
    ...s,
    players: s.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [...p.hand, ...take], deck: p.deck.filter((id) => !take.includes(id)) } : p,
    ),
  };
};

/** The Prelate `code` revealed by the first player, its reveal round over. */
function withPrelate(code: string, prep: (s: GameState) => GameState = (s) => s) {
  const revealed = round(prep(setupGame()), { reveals: [code], boosts: 1 }).state;
  const id = inPlayOf(revealed, code);
  if (!id) throw new Error(`${code} is not engaged with the first player`);
  return { state: revealed, id };
}

describe("registry", () => {
  it("registers every ref of the five Prelates, each a valid definition, none skipped", () => {
    expect(Object.keys(PRELATES).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(PRELATES)) expect(validateDefinition(def), id).toEqual([]);
    expect(PRELATES_SKIPPED).toEqual({});
  });

  it("every ability id the card data names is registered", () => {
    for (const code of PRELATE_CODES) {
      const ids = ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id);
      expect(ids.length, code).toBeGreaterThan(0);
      for (const id of ids) expect(Object.keys(PRELATES), id).toContain(id);
    }
  });
});

describe("data (scan check: stats as the spec table prints them)", () => {
  it("five elite Prelates with Toughness, Victory 3 and 3 boost icons", () => {
    const stats = PRELATE_CODES.map((c) => {
      const d = dataOf(c) as { atk: number; sch: number; hp: number; boostIcons: number };
      return [c, d.atk, d.sch, d.hp, d.boostIcons];
    });
    expect(stats).toEqual([
      [SINISTER, 1, 1, 5, 3],
      [SHADOW_KING, 1, 3, 5, 3],
      [ABYSS, 2, 2, 5, 3],
      [SUGAR_MAN, 3, 1, 5, 3],
      [RASPUTIN, 2, 2, 5, 3],
    ]);
  });
});

describe("engaging the first player", () => {
  it.each(PRELATE_CODES)("%s revealed by the first player engages them and enters with a tough status card", (code) => {
    const { state, id } = withPrelate(code);
    expect(inst(state, id).engagedWith).toBe(P1);
    expect(inst(state, id).statuses.tough).toBe(1);
  });

  it("Mister Sinister has retaliate 1", () => {
    const { state, id } = withPrelate(SINISTER);
    expect(keywordTotal(state, id, "retaliate", DEPS)).toBe(1);
  });
});

/** Rhino stunned: his attack is skipped, so only the Prelate's activation touches the player. */
const stunRhino = (s: GameState) =>
  patchInstance(s, s.activeVillainId!, { statuses: { stunned: 1, confused: 0, tough: 0 } });
const attacksOf = (run: readonly GameEvent[], id: InstanceId) =>
  events(run, "attackResolved").filter((e) => e.enemyInstanceId === id);
const discarded = (s: GameState, id: InstanceId) => playerOf(s, P1).discard.includes(id);
const heroDamage = (s: GameState) => inst(s, identityOf(s, P1)).damage;

describe("Mikhail Rasputin (45183b)", () => {
  it("FORCED INTERRUPT: when he attacks you, your identity takes 1 damage on top of the attack (ATK 2: 3 in all)", () => {
    const { state, id } = withPrelate(RASPUTIN);
    const run = round(stunRhino(state), { hero: true });
    const [attack] = attacksOf(run.events, id);
    expect(attack!.baseAtk).toBe(2);
    expect(attack!.damageDealt).toBe(2);
    expect(heroDamage(run.state) - heroDamage(state)).toBe(3);
  });

  it("does nothing in alter-ego form: he schemes instead and the identity takes no damage", () => {
    const { state, id } = withPrelate(RASPUTIN);
    const run = round(stunRhino(state));
    expect(attacksOf(run.events, id)).toHaveLength(0);
    expect(heroDamage(run.state)).toBe(heroDamage(state));
  });
});

describe("Sugar Man (45182b)", () => {
  // The hero carries a tough status card: piercing discards it first, so the full 3 damage lands (a plain attack would be prevented).
  const toughHero = (s: GameState) =>
    patchInstance(s, identityOf(s, P1), { statuses: { stunned: 0, confused: 0, tough: 1 } });

  it("FORCED INTERRUPT: his attack gains piercing, so the defender's tough status card does not stop it", () => {
    const { state, id } = withPrelate(SUGAR_MAN);
    const run = round(toughHero(stunRhino(state)), { hero: true });
    const [attack] = attacksOf(run.events, id);
    expect(attack!.baseAtk).toBe(3);
    expect(heroDamage(run.state) - heroDamage(state)).toBe(3);
    expect(inst(run.state, identityOf(run.state, P1)).statuses.tough).toBe(0);
  });

  const withAlly = () => {
    const base = withPrelate(SUGAR_MAN);
    const hurt = patchInstance(stunRhino(base.state), base.id, { damage: 4 });
    const ally = playFromHand(DEPS, fullHand(withForm(hurt, { heroForm: 0 })), DAREDEVIL, 4);
    return { ...base, state: ally.state, ally: ally.id };
  };

  it("if the attack defeats a character, he heals 5 damage", () => {
    const { state, id, ally } = withAlly();
    // 3 piercing damage on a 3 hit point ally who defends: defeated, so 4 damage is healed (down to 0).
    const run = round(state, { hero: true, plan: { defend: ally } });
    expect(events(run.events, "characterDefeated").some((e) => e.instanceId === ally)).toBe(true);
    expect(inst(run.state, id).damage).toBe(0);
  });

  it("if the attack defeats nobody, he is not healed", () => {
    const { state, id } = withAlly();
    const run = round(state, { hero: true });
    expect(heroDamage(run.state) - heroDamage(state)).toBe(3);
    expect(inst(run.state, id).damage).toBe(4);
  });
});

describe("The Shadow King (45180b)", () => {
  const withAllies = () => {
    const base = withPrelate(SHADOW_KING);
    const maria = playFromHand(DEPS, fullHand(stunRhino(base.state)), DAREDEVIL, 4);
    const jessica = playFromHand(DEPS, maria.state, JESSICA_JONES, 3);
    return { ...base, state: jessica.state, maria: maria.id, jessica: jessica.id };
  };
  const mainThreat = (s: GameState) => inst(s, s.mainScheme.instanceId).threat;

  it("FORCED RESPONSE: the ally with the highest THW (not the other) may be discarded", () => {
    const { state, maria, jessica } = withAllies();
    const run = round(state, { hero: true, plan: { choose: "Discard" } });
    expect(discarded(run.state, maria)).toBe(true);
    expect(discarded(run.state, jessica)).toBe(false);
  });

  it("or places threat on the main scheme equal to its THW (Daredevil: 2), discarding nothing", () => {
    const { state, maria } = withAllies();
    const discard = round(state, { hero: true, plan: { choose: "Discard" } });
    const place = round(state, { hero: true, plan: { choose: "Place" } });
    expect(mainThreat(place.state) - mainThreat(discard.state)).toBe(2);
    expect(discarded(place.state, maria)).toBe(false);
  });

  it("with no ally you control nothing happens and no choice is asked", () => {
    const { state } = withPrelate(SHADOW_KING);
    const seen: string[] = [];
    round(stunRhino(state), { hero: true, plan: { seen } });
    expect(seen).not.toContain("chooseOption");
  });
});

describe("Abyss (45181b)", () => {
  const abyssGame = () => {
    const base = withPrelate(ABYSS);
    return { ...base, state: stunRhino(base.state) };
  };

  it("has 5 hit points (1 player) with nothing attached", () => {
    const { state, id } = abyssGame();
    expect(maxHitPoints(state, id, DEPS)).toBe(5);
  });

  it("FORCED RESPONSE: after he activates against you, the top card of your deck is attached to him facedown, +2 hit points", () => {
    const { state, id } = abyssGame();
    const top = playerOf(state, P1).deck[0]!;
    const run = round(state, { hero: true });
    expect(inst(run.state, id).attachments).toContain(top);
    expect(inst(run.state, top).faceup).toBe(false);
    expect(playerOf(run.state, P1).deck).not.toContain(top);
    expect(maxHitPoints(run.state, id, DEPS)).toBe(7);
  });

  it("it triggers when he schemes against you too (alter-ego form), and again each activation: +4 after two", () => {
    const { state, id } = abyssGame();
    // Rhino's scheme threat would finish the main scheme: keep it at 0 between the rounds.
    const calm = (s: GameState) => patchInstance(s, s.mainScheme.instanceId, { threat: 0 });
    const first = round(calm(state));
    const second = round(calm(first.state));
    expect(inst(second.state, id).attachments).toHaveLength(2);
    expect(maxHitPoints(second.state, id, DEPS)).toBe(9);
  });

  it("defeated, every attached card goes to its owner's discard pile", () => {
    const { state, id } = abyssGame();
    const first = round(state, { hero: true });
    const attached = [...inst(first.state, id).attachments];
    expect(attached).toHaveLength(1);
    const killed = defeatWithAttack(
      DEPS,
      patchInstance(withForm(first.state, { heroForm: 0 }), id, { statuses: { stunned: 0, confused: 0, tough: 0 } }),
      id,
    );
    expect(playerOf(killed, P1).discard).toContain(attached[0]);
  });
});
