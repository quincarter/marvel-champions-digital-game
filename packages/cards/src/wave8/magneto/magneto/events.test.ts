import { cardId, CORE_CARDS, MUT_GEN_CARDS, WAVE8_CARDS, WAVE8_STARTER_DECKS } from "@mc/content";
import { applyCommand, createGame, type EngineDeps, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  threatOn,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { NIGHTCRAWLER_OBLIGATION_NEMESIS } from "../../ncrawler/nightcrawler/obligation-nemesis.js";
import { MAGNETO_EVENTS, MAGNETO_EVENTS_SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Magneto's events (49008 to 49010), docs/phase7-wave8.md section 7.5, 3.76, 3.77 (the label query itself is proven
 * on fixtures in the engine's `prints-ability-query.test.ts`). His real starter deck
 * (`magneto-leadership`) against Rhino (Core, standard). Magneto: THW 2, ATK 2, DEF 2, 10 hit points. Hydra Mercenary
 * 01101 (guard, 3 hit points) is engaged and then swapped by surgery to the minion a test needs: Frenzy 49031 (4 hit
 * points, no guard), Hellfire Pawn 49040 (3 hit points, guard).
 */
const BLAST = "49008";
const SHARDS = "49009";
const MISSILE = "49010";
const WRAPPED = "49007";
const FRENZY = "49031";
const PAWN = "49040";
const REF = {
  blast: "49008.electromagnetic-blast-action",
  shards: "49009.metal-shards-action",
  missile: "49010.magnetic-missile-action",
} as const;

const MAGNETO = WAVE8_STARTER_DECKS.find((d) => d.id === "magneto-leadership")!;
const SEAT = {
  identityCardId: MAGNETO.identityCardId,
  aspects: MAGNETO.aspects,
  deck: MAGNETO.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
// Azazel's Sword (48029) is scripted with Nightcrawler's nemesis set: the label it prints is read from that script.
const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, MAGNETO_EVENTS, NIGHTCRAWLER_OBLIGATION_NEMESIS),
};
const POOL = [...CORE_CARDS, ...WAVE8_CARDS, ...MUT_GEN_CARDS.filter((c) => (c.id as string) === "32150")];
const BY_ID = new Map(POOL.map((c) => [c.id as string, c]));
const dataOf = (code: string) => BY_ID.get(code) as never as Record<string, unknown> & { abilities: { id: string }[] };

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const discardOf = (s: GameState): string[] => playerOf(s, P1).discard.map((id) => codeOf(s, id));
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const statusOn = (s: GameState, id: InstanceId, status: "stunned" | "tough"): number =>
  inst(s, id).statuses[status] ?? 0;
const iconsOf = (s: GameState, id: InstanceId): number => {
  const card = BY_ID.get(codeOf(s, id)) as { resourceIcons?: Record<string, number> };
  return Object.values(card.resourceIcons ?? {}).reduce((a, b) => a + b, 0);
};

function setupGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  } as never);
  const created = createGame({ ...config, players: [SEAT] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const heroGame = (): GameState => withForm(setupGame(), { heroForm: 0 });

/** Engages a minion with Magneto: a Hydra Mercenary, swapped to `code`. */
function withMinion(state: GameState, code = FRENZY): { state: GameState; minion: InstanceId } {
  const { state: engaged, id } = engageMinion(state, "01101", P1);
  return { state: patchInstance(engaged, id, { cardId: cardId(code) }), minion: id };
}
/** Takes a copy of `code` out of the hand and attaches it to `host` by surgery (no play, no cost). */
function attachFromHand(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const { state: staged, ids } = moveToHand(state, P1, code);
  const id = ids[0]!;
  const removed: GameState = {
    ...staged,
    players: staged.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host });
  return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
}

/** Picks the first of these ids a prompt offers (target, card or trigger), else the first legal answer. */
const taking =
  (...ids: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    const hits = choice ? ids.filter((id) => choice.options.some((o) => o.optionId === id)) : [];
    return choice && hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(s);
  };

interface Cast {
  before: GameState;
  state: GameState;
  events: readonly GameEvent[];
  card: InstanceId;
}
/** Plays `code` from the hand, paying `cost` with other hand cards by printed icons, answering choices with `pick`. */
function cast(base: GameState, code: string, cost: number, pick: Picker = firstLegal, deps = DEPS): Cast {
  const handed = moveToHand(base, P1, code);
  const card = handed.ids[0]!;
  const paying: InstanceId[] = [];
  let paid = 0;
  for (const h of playerOf(handed.state, P1).hand) {
    if (paid >= cost) break;
    if (h === card || iconsOf(handed.state, h) === 0) continue;
    paying.push(h);
    paid += iconsOf(handed.state, h);
  }
  if (paid < cost) throw new Error("not enough payers");
  const run = driveEventsPicking(deps, handed.state, pick, play(P1, card, paying));
  return { before: handed.state, state: run.state, events: run.events, card };
}
const attacks = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack" ? [e.event] : [],
  );

describe("registry and data", () => {
  it.each(Object.values(REF))("%s validates", (ref) => {
    expect(validateDefinition(MAGNETO_EVENTS[ref]!)).toEqual([]);
  });
  it("registers all three refs; nothing is skipped", () => {
    expect(Object.keys(MAGNETO_EVENTS).sort()).toEqual(Object.values(REF).sort());
    expect(MAGNETO_EVENTS_SKIPPED).toEqual({});
    const named = [BLAST, SHARDS, MISSILE].flatMap((c) => dataOf(c).abilities.map((a) => a.id));
    expect(named.sort()).toEqual(Object.values(REF).sort());
  });
  it("printed data: cost, icon, traits; Missile's current text carries the erratum", () => {
    const row = (c: string) => {
      const d = dataOf(c) as never as {
        type: string;
        cost: number;
        resourceIcons: Record<string, number>;
        traits: string[];
        text: { printed: string; current: string };
      };
      return [d.type, d.cost, d.resourceIcons, d.traits, d.text.current === d.text.printed];
    };
    expect(row(BLAST)).toEqual(["event", 2, { energy: 1 }, ["MAGNETIC", "SUPERPOWER", "THWART"], true]);
    expect(row(SHARDS)).toEqual(["event", 3, { physical: 1 }, ["ATTACK", "MAGNETIC", "SUPERPOWER"], true]);
    expect(row(MISSILE)).toEqual(["event", 1, { physical: 1 }, ["MAGNETIC", "SUPERPOWER"], false]);
    expect(MAGNETO_EVENTS[REF.missile]!.trigger).toEqual({ kind: "action", form: "hero" });
  });
});

describe("Metal Shards (49009): 7 damage to an enemy; if the attack defeats it, gain a tough status card", () => {
  it("7 damage to the villain, which is not defeated: no tough status card", () => {
    const base = heroGame();
    const run = cast(base, SHARDS, 3);
    expect(damageOn(run.state, villainOf(run.state))).toBe(damageOn(base, villainOf(base)) + 7);
    expect(statusOn(run.state, identityOf(run.state), "tough")).toBe(0);
    expect(discardOf(run.state)).toContain(SHARDS);
  });
  it("it is one attack by Magneto, and its damage is attack damage", () => {
    const run = cast(heroGame(), SHARDS, 3);
    const made = attacks(run.events);
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ attackerInstanceId: identityOf(run.state) });
    expect(made[0]!.results?.damage).toBe(7);
  });
  it("defeating a minion (Frenzy, 4 hit points) gives Magneto a tough status card; 7 damage is not capped", () => {
    const { state, minion } = withMinion(heroGame());
    const run = cast(state, SHARDS, 3, taking(minion));
    expect(run.events.some((e) => e.type === "characterDefeated" && e.instanceId === minion)).toBe(true);
    expect(statusOn(run.state, identityOf(run.state), "tough")).toBe(1);
  });
  it("a minion that survives (a tough status card absorbs the 7 damage) gives nothing", () => {
    const { state, minion } = withMinion(heroGame());
    const shielded = patchInstance(state, minion, { statuses: { tough: 1 } as never });
    const run = cast(shielded, SHARDS, 3, taking(minion));
    expect(statusOn(run.state, minion, "tough")).toBe(0);
    expect(run.events.some((e) => e.type === "characterDefeated" && e.instanceId === minion)).toBe(false);
    expect(statusOn(run.state, identityOf(run.state), "tough")).toBe(0);
  });
  it("guard applies: with a guard minion engaged the villain is not a choice", () => {
    const { state, minion } = withMinion(heroGame(), PAWN);
    const handed = moveToHand(state, P1, SHARDS);
    const choices: string[][] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTarget") choices.push(choice.options.map((o) => o.optionId));
      return firstLegal(s);
    };
    const paying = playerOf(handed.state, P1)
      .hand.filter((h) => h !== handed.ids[0] && iconsOf(handed.state, h) > 0)
      .slice(0, 3);
    driveEventsPicking(DEPS, handed.state, pick, play(P1, handed.ids[0]!, paying));
    // One target prompt at most (a lone legal target may be taken without asking); the villain is never among them.
    for (const offered of choices) expect(offered).not.toContain(villainOf(state));
    expect(minion).toBeDefined();
  });
  it("with a guard minion engaged and no other choice, the guard takes the 7 damage and is defeated", () => {
    const { state, minion } = withMinion(heroGame(), PAWN);
    const run = cast(state, SHARDS, 3);
    expect(run.events.some((e) => e.type === "characterDefeated" && e.instanceId === minion)).toBe(true);
    expect(damageOn(run.state, villainOf(run.state))).toBe(damageOn(state, villainOf(state)));
    expect(statusOn(run.state, identityOf(run.state), "tough")).toBe(1);
  });
});

describe("Magnetic Missile (49010, errata): discard a minion with Wrapped in Metal attached. Then 5 damage to an enemy and stun it", () => {
  function wrapped(code = FRENZY) {
    const { state: engaged, minion } = withMinion(heroGame(), code);
    const { state, id } = attachFromHand(engaged, WRAPPED, minion);
    return { state, minion, upgrade: id };
  }

  it("discards the wrapped minion and its Wrapped in Metal, then the villain takes 5 and is stunned", () => {
    const { state, minion, upgrade } = wrapped();
    const run = cast(state, MISSILE, 1);
    expect(playerOf(run.state, P1).playArea).not.toContain(minion);
    expect(discardOf(run.state)).toEqual(expect.arrayContaining([MISSILE, WRAPPED]));
    expect(playerOf(run.state, P1).discard).toContain(upgrade);
    expect(damageOn(run.state, villainOf(run.state))).toBe(damageOn(state, villainOf(state)) + 5);
    expect(statusOn(run.state, villainOf(run.state), "stunned")).toBe(1);
  });
  it("the minion is discarded, not defeated: no characterDefeated, it sits in the encounter discard pile", () => {
    const { state, minion } = wrapped();
    const run = cast(state, MISSILE, 1);
    expect(run.events.some((e) => e.type === "characterDefeated")).toBe(false);
    const pile = Object.values(run.state.encounterDecks).flatMap((d) => d.discard);
    expect(pile).toContain(minion);
  });
  it("a guard minion, wrapped, is discarded first, so the 5 damage is free to hit the villain (and it is not an attack)", () => {
    const { state } = wrapped("01101");
    const run = cast(state, MISSILE, 1);
    expect(attacks(run.events)).toHaveLength(0);
    expect(damageOn(run.state, villainOf(run.state))).toBe(damageOn(state, villainOf(state)) + 5);
  });
  it("the 5 damage may go to another minion (defeating it); an unwrapped minion is not the one discarded", () => {
    const { state, minion } = wrapped();
    const { state: both, minion: other } = withMinion(state, "01101");
    const run = cast(both, MISSILE, 1, taking(minion, other));
    expect(run.events.some((e) => e.type === "characterDefeated" && e.instanceId === other)).toBe(true);
    expect(run.events.some((e) => e.type === "characterDefeated" && e.instanceId === minion)).toBe(false);
    expect(damageOn(run.state, villainOf(run.state))).toBe(damageOn(both, villainOf(both)));
  });
  it("with no wrapped minion in play the event cannot be played", () => {
    const { state } = withMinion(heroGame());
    const handed = moveToHand(state, P1, MISSILE);
    const paying = playerOf(handed.state, P1)
      .hand.filter((h) => h !== handed.ids[0] && iconsOf(handed.state, h) > 0)
      .slice(0, 1);
    const result = applyCommand(handed.state, play(P1, handed.ids[0]!, paying), DEPS);
    expect(result.ok).toBe(false);
  });
});

describe("Electromagnetic Blast (49008): remove 3 threat from a scheme; if that was its last, you may discard a Hero Action / Hero Response attachment", () => {
  const SWORD = "48029"; // Azazel's Sword: Hero Response
  const SUIT = "01098"; // Armored Rhino Suit: a Forced Interrupt, no player ability
  const BREAKIN = "01107"; // Breakin' & Takin': a side scheme
  const METAL = "32150"; // Wrapped in Metal of Mutant Genesis: "Action", no form
  /** Takes an encounter-deck copy of `code` (swapped to `as` when given) and attaches it to `host` by surgery. */
  function attachEncounter(
    state: GameState,
    code: string,
    as = code,
    host: InstanceId = villainOf(state),
  ): { state: GameState; id: InstanceId } {
    const deckId = Object.keys(state.encounterDecks)[0]!;
    const pile = state.encounterDecks[deckId]!;
    const id = pile.deck.find((i) => state.instances[i]?.cardId === cardId(code));
    if (!id) throw new Error(`no ${code} in the encounter deck`);
    const moved: GameState = {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
    };
    const attached = patchInstance(moved, id, { attachedTo: host, faceup: true, cardId: cardId(as) });
    return {
      state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }),
      id,
    };
  }
  /** Breakin' & Takin' in play with `threat`, the Sword (a Hero Response) and the Suit (none) on the villain. */
  function board(threat: number) {
    const scheme = encounterCardInVillainArea(heroGame(), BREAKIN, threat);
    const sword = attachEncounter(scheme.state, SUIT, SWORD);
    const suit = attachEncounter(sword.state, SUIT);
    return { state: suit.state, scheme: scheme.id, sword: sword.id, suit: suit.id };
  }
  /** Every attachment a target prompt offered while the event resolved, and the answers `prefer` names first. */
  function blast(state: GameState, attachments: readonly InstanceId[], ...prefer: readonly string[]) {
    const offered: string[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      offered.push(...choice.options.map((o) => o.optionId).filter((o) => attachments.includes(o as InstanceId)));
      return taking(...prefer)(s);
    };
    return { run: cast(state, BLAST, 2, pick), offered };
  }
  const inPlay = (s: GameState, id: InstanceId): boolean => inst(s, id).attachedTo !== null;

  it("the Sword's label is read from its script: a Hero Response; Wrapped in Metal (32150) prints a plain Action", () => {
    expect(DEPS.abilities["48029.azazels-sword-response"]!.trigger).toMatchObject({ kind: "response", form: "hero" });
    expect(DEPS.abilities["32150.wrapped-in-metal-action"]!.trigger).toEqual({ kind: "action" });
  });
  it("a side scheme with 3 threat: 3 removed, the scheme is defeated, the Sword is discarded; the Suit is never offered", () => {
    const { state, scheme, sword, suit } = board(3);
    const { run, offered } = blast(state, [sword, suit], scheme, sword);
    expect(run.state.villainArea).not.toContain(scheme);
    expect(offered).toEqual([sword]);
    expect(inPlay(run.state, sword)).toBe(false);
    expect(inPlay(run.state, suit)).toBe(true);
    expect(run.events.some((e) => e.type === "characterDefeated")).toBe(false);
    expect(discardOf(run.state)).toContain(BLAST);
  });
  it("the scheme had 4: 1 threat left, no discard offered", () => {
    const { state, scheme, sword, suit } = board(4);
    const { run, offered } = blast(state, [sword, suit], scheme, sword);
    expect(threatOn(run.state, scheme)).toBe(1);
    expect(offered).toEqual([]);
    expect(inPlay(run.state, sword)).toBe(true);
  });
  it("the scheme had 2: 2 removed, its last threat, and the discard is offered", () => {
    const { state, scheme, sword, suit } = board(2);
    const { run, offered } = blast(state, [sword, suit], scheme, sword);
    expect(run.state.villainArea).not.toContain(scheme);
    expect(offered).toEqual([sword]);
    expect(inPlay(run.state, sword)).toBe(false);
  });
  it("the discard is optional: declined, the Sword stays", () => {
    const { state, scheme, sword, suit } = board(3);
    const prompts: number[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (!choice.options.some((o) => o.optionId === sword)) return taking(scheme)(s);
      prompts.push(choice.minSelections);
      return [];
    };
    const run = cast(state, BLAST, 2, pick);
    expect(prompts).toEqual([0]);
    expect(inPlay(run.state, sword)).toBe(true);
    expect(inPlay(run.state, suit)).toBe(true);
  });
  it("the main scheme's last threat counts too (3 of 3 removed)", () => {
    const base = heroGame();
    const sword = attachEncounter(patchInstance(base, base.mainScheme.instanceId, { threat: 3 }), SUIT, SWORD);
    const { run, offered } = blast(sword.state, [sword.id], sword.id);
    expect(mainThreat(run.state)).toBe(0);
    expect(offered).toEqual([sword.id]);
    expect(inPlay(run.state, sword.id)).toBe(false);
  });
  // On the villain by surgery: on Magneto himself its "cannot thwart" would stop the thwart event being played at all.
  it('the only attachment is Wrapped in Metal of Mutant Genesis ("Action", no form): nothing is offered', () => {
    const scheme = encounterCardInVillainArea(heroGame(), BREAKIN, 3);
    const metal = attachEncounter(scheme.state, SUIT, METAL);
    const { run, offered } = blast(metal.state, [metal.id], scheme.id, metal.id);
    expect(run.state.villainArea).not.toContain(scheme.id);
    expect(offered).toEqual([]);
    expect(inPlay(run.state, metal.id)).toBe(true);
  });
  it("with that Wrapped in Metal on Magneto he cannot thwart, so the event cannot be played", () => {
    const scheme = encounterCardInVillainArea(heroGame(), BREAKIN, 3);
    const metal = attachEncounter(scheme.state, SUIT, METAL, identityOf(scheme.state));
    expect(() => cast(metal.state, BLAST, 2)).toThrow(/no_valid_target/);
  });
  it("a player upgrade on a minion (Magneto's own Wrapped in Metal) is not an attachment: not offered", () => {
    const scheme = encounterCardInVillainArea(heroGame(), BREAKIN, 3);
    const { state: engaged, minion } = withMinion(scheme.state);
    const upgrade = attachFromHand(engaged, WRAPPED, minion);
    const { run, offered } = blast(upgrade.state, [upgrade.id], scheme.id, upgrade.id);
    expect(run.state.villainArea).not.toContain(scheme.id);
    expect(offered).toEqual([]);
    expect(inPlay(run.state, upgrade.id)).toBe(true);
  });
  it("confused: the confused card is discarded, no threat is removed, nothing is discarded, the event is spent", () => {
    const { state, scheme, sword, suit } = board(3);
    const confused = patchInstance(state, identityOf(state), { statuses: { confused: 1 } as never });
    const { run, offered } = blast(confused, [sword, suit], scheme, sword);
    expect(inst(run.state, identityOf(run.state)).statuses.confused ?? 0).toBe(0);
    expect(threatOn(run.state, scheme)).toBe(3);
    expect(offered).toEqual([]);
    expect(inPlay(run.state, sword)).toBe(true);
    expect(discardOf(run.state)).toContain(BLAST);
  });
});
