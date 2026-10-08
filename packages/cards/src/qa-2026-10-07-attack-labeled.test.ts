/**
 * Owner rulings of 2026-10-07 on "(attack)" abilities (docs/phase7-wave8.md §4.1 Q48, Q49, Q50), proved on REAL cards.
 * The rule is the engine's (`packages/engine/src/resolve/attack-ability.ts`, fixtures in the engine's
 * `attack-label.test.ts`); no card script was rewritten for it, so these tests are what shows the shipped cards moved.
 *
 * - **Q48 = A.** Every ability labeled (attack) is an attack, whether or not it uses the hero's ATK. RRG 1.8 "Labeled
 *   Ability" (p. 26): "When a player resolves an ability labeled '(attack),' that ability is considered to be an attack
 *   made by that player's identity."
 * - **Q49 = A, qualified.** Guard restricts attack targeting, and is checked for every enemy the attack targets at the
 *   time that enemy would be attacked. RRG 1.8 "Guard" (p. 21): "that player cannot use cards they control to attack a
 *   villain without this keyword."
 * - **Q50 = B.** Each enemy the attack targets is attacked; an enemy that only takes its damage is not. RRG 1.8
 *   "Attack (Player Ability Type)" (p. 10): "Each attacked enemy with the retaliate X keyword that is still in play
 *   after the attack resolves deals its retaliate damage to the attacking character."
 *
 * Every card is played from a real Core Spider-Man (Justice) hand in a real Rhino game (`testing/qa-bench.ts`). Royal
 * Flush, Gunboat Diplomacy and 'Port and Punch need their own heroes and are proved in their packs' test files
 * (`wave6/gambit/gambit/events.test.ts`, `wave8/ncrawler/aspect-basic.test.ts`,
 * `wave8/ncrawler/nightcrawler/events.test.ts`); the wave 8 cards in theirs.
 */
import { cardId } from "@mc/content";
import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { firstLegal, identityOf, inst, P1, patchInstance, playerOf, type Picker } from "./testing/harness.js";
import { conjure, DEPS, drive, intoPlay, playOut, relabel, rhino, withTrait } from "./testing/qa-bench.js";
import { driveEventsPicking } from "./testing/staging.js";
import { engageMinion } from "./wave6/mut_gen/project-wideawake-testing.js";

const MERCENARY = "01101"; // Hydra Mercenary: 3 hit points, Guard.

/** A Hydra Mercenary engaged with P1, reprinted for this game: its keywords and hit points as given. */
function withMercenary(
  state: GameState,
  as: { readonly guard?: boolean; readonly retaliate?: number; readonly hp?: number } = { guard: true },
): { readonly state: GameState; readonly id: InstanceId } {
  const engaged = engageMinion(state, MERCENARY, P1);
  const printed = engaged.state.cardPool[cardId(MERCENARY)]!;
  if (printed.type !== "minion") throw new Error("Hydra Mercenary is not a minion");
  const card = {
    ...printed,
    hp: as.hp ?? printed.hp,
    keywords: [
      ...(as.guard ? [{ name: "guard" as const }] : []),
      ...(as.retaliate ? [{ name: "retaliate" as const, value: as.retaliate }] : []),
    ],
  };
  return { id: engaged.id, state: { ...engaged.state, cardPool: { ...engaged.state.cardPool, [card.id]: card } } };
}

/** "Increase the amount of damage the villain takes from each attack by 1" (the Cyclops ally's rule) in force. */
const villainMarked = (state: GameState): GameState => ({
  ...state,
  scenarioRules: {
    ...state.scenarioRules,
    rules: [
      ...(state.scenarioRules.rules ?? []),
      { kind: "increaseDamageTaken", target: { categories: ["villain"] }, amount: 1, fromAttack: true },
    ],
  },
});

const villainOf = (state: GameState): InstanceId => state.activeVillainId!;
/** The player attacks that resolved. */
const attacks = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack" ? [e.event] : [],
  );
/** Each instance of damage as it was initiated. */
const instances = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "dealDamage" ? [e.event] : [],
  );
const attacked = (events: readonly GameEvent[]): InstanceId[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterAttacked"
      ? [e.event.targetInstanceId]
      : [],
  );
const takenBy = (events: readonly GameEvent[], id: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === id ? [e.amount] : []));
/** The cards every target choice offered. */
const offers = (events: readonly GameEvent[]): string[][] =>
  events.flatMap((e) =>
    e.type === "choiceRequested" && e.choice.prompt.kind === "chooseTarget"
      ? [e.choice.options.map((o) => o.optionId)]
      : [],
  );
const skips = (events: readonly GameEvent[]): InstanceId[] =>
  events.flatMap((e) => (e.type === "attackTargetSkipped" ? [e.targetInstanceId] : []));

interface Case {
  readonly code: string;
  readonly name: string;
  readonly cost: number;
  /** The damage it prints to its enemy. */
  readonly damage: number;
  /** It names the villain rather than letting its player choose an enemy. */
  readonly villainOnly?: true;
}
/** Shipped "(attack)" Hero Actions with no attack effect, playable from any hero's hand in hero form. */
const CARDS: readonly Case[] = [
  { code: "18003", name: "Acrobatic Move", cost: 0, damage: 2 },
  { code: "18012", name: "Clobber", cost: 2, damage: 3 },
  { code: "18015", name: "First Hit", cost: 1, damage: 2, villainOnly: true },
  { code: "18020", name: "Hit and Run", cost: 3, damage: 2 },
  { code: "30007", name: "Swinging Web Pig", cost: 3, damage: 6 },
  { code: "31006", name: "Web-Trap", cost: 2, damage: 5 },
  { code: "36011", name: "Lightning Bolt", cost: 3, damage: 8 },
];

describe("Q48: each is one attack by the hero's identity, and its damage is attack damage (RRG 1.8 p. 26)", () => {
  for (const c of CARDS) {
    it(`${c.name} (${c.code}) on the villain`, () => {
      const given = conjure(rhino(), c.code);
      const villain = villainOf(given.state);
      const hero = identityOf(given.state);
      const done = playOut(given.state, given.id, c.cost, { target: villain });
      expect(done.accepted).toBe(true);
      expect(inst(done.state, villain).damage).toBe(c.damage);
      const made = attacks(done.events);
      expect(made).toHaveLength(1);
      expect(made[0]).toMatchObject({ attackerInstanceId: hero, labeled: true, basic: false });
      expect(made[0]!.attacked).toEqual([villain]);
      expect(made[0]!.results?.damage).toBe(c.damage);
      const toVillain = instances(done.events).filter((d) => d.targetInstanceId === villain);
      expect(toVillain.map((d) => [d.fromAttack, d.sourceInstanceId])).toEqual([[true, hero]]);
      expect(attacked(done.events)).toEqual([villain]);
    });

    it(`${c.name} (${c.code}): 'increase the damage that enemy takes from each attack by 1' adds 1`, () => {
      const given = conjure(villainMarked(rhino()), c.code);
      const villain = villainOf(given.state);
      const done = playOut(given.state, given.id, c.cost, { target: villain });
      expect(inst(done.state, villain).damage).toBe(c.damage + 1);
    });
  }

  for (const c of CARDS.filter((card) => !card.villainOnly)) {
    it(`${c.name} (${c.code}): a retaliating enemy answers the completed attack, once`, () => {
      const thorny = withMercenary(rhino(), { retaliate: 1, hp: 20 });
      const given = conjure(thorny.state, c.code);
      const hero = identityOf(given.state);
      const done = playOut(given.state, given.id, c.cost, { target: thorny.id });
      expect(takenBy(done.events, thorny.id)).toEqual([c.damage]);
      expect(attacked(done.events)).toEqual([thorny.id]);
      expect(takenBy(done.events, hero)).toEqual([1]);
    });
  }
});

describe("Q49: guard limits whom an '(attack)' ability may target (RRG 1.8 'Guard', p. 21)", () => {
  for (const c of CARDS) {
    it(`${c.name} (${c.code}) with a Hydra Mercenary engaged`, () => {
      const guarded = withMercenary(rhino(), { guard: true, hp: 20 });
      const given = conjure(guarded.state, c.code);
      const villain = villainOf(given.state);
      const done = playOut(given.state, given.id, c.cost, { target: villain });
      expect(inst(done.state, villain).damage).toBe(0);
      if (c.villainOnly) {
        // It names the villain alone: no valid target for the attack, so it cannot be played (RRG 1.8 "Target", p. 42).
        expect(done.accepted).toBe(false);
        expect(playerOf(done.state, P1).hand).toContain(given.id);
        return;
      }
      expect(done.accepted).toBe(true);
      // The enemy choice offers the guard minion and not the villain; a scheme choice (Hit and Run) is another matter.
      expect(offers(done.events).filter((options) => options.includes(guarded.id))).toEqual([[guarded.id]]);
      expect(offers(done.events).some((options) => options.includes(villain))).toBe(false);
      expect(inst(done.state, guarded.id).damage).toBe(c.damage);
    });
  }
});

describe("Row 64 (A4): an '(attack)' ability that names only the villain cannot be initiated past a guard minion", () => {
  // Owner decision, 2026-10-08 (docs/phase7-wave8.md §4.1 row 64), on RRG 1.8 "Target" (p. 43): "A target that cannot be
  // attacked is not a valid target for an attack-labeled ability." Whatever else the card does (the villain scheming,
  // a treachery revealed, boost icons canceled) does not make it playable. Each used to resolve and deal the villain
  // nothing.
  /** Rhino's game with no threat on the main scheme, so a scheme or a villain phase does not end it. */
  const calm = (seed = 1): GameState => {
    const state = rhino(seed);
    return patchInstance(state, state.mainScheme.instanceId, { threat: 0 });
  };
  const VILLAIN_ONLY: readonly Case[] = [
    { code: "15014", name: "Swift Retribution", cost: 1, damage: 4 },
    { code: "15028", name: "Browbeat", cost: 2, damage: 3 },
    { code: "16014", name: "Fighting Fit", cost: 2, damage: 5 },
    // 5 rather than 2: `calm` leaves no threat on the main scheme.
    { code: "18029", name: "Pivotal Moment", cost: 2, damage: 5 },
    // Return the Favor reveals a treachery first, which can do anything: only that it is played is checked.
    { code: "27015", name: "Return the Favor", cost: 0, damage: 0 },
  ];
  for (const c of VILLAIN_ONLY) {
    it(`${c.name} (${c.code}): refused with a Hydra Mercenary engaged, played without one`, () => {
      const guarded = withMercenary(calm(), { guard: true, hp: 20 });
      const held = conjure(guarded.state, c.code);
      const refused = playOut(held.state, held.id, c.cost);
      expect(refused.accepted).toBe(false);
      expect(playerOf(refused.state, P1).hand).toContain(held.id);
      expect(inst(refused.state, villainOf(refused.state)).damage).toBe(0);

      const open = conjure(calm(), c.code);
      const done = playOut(open.state, open.id, c.cost);
      expect(done.accepted).toBe(true);
      expect(playerOf(done.state, P1).hand).not.toContain(open.id);
      if (c.damage > 0) expect(takenBy(done.events, villainOf(open.state))).toEqual([c.damage]);
    });
  }

  describe("Attacrobatics (08006): '… cancel the boost icons on that card. Deal 1 damage to the villain for each boost icon canceled this way'", () => {
    const offeredIt = (events: readonly GameEvent[]): boolean =>
      events.some((e) => e.type === "choiceRequested" && e.choice.options.some((o) => o.optionId.includes("08006")));
    const villainPhase = (state: GameState) => drive(state, { type: "endTurn", playerId: P1 }, { use: ["08006"] });
    /** The boost icons on each boost card the villain turned faceup. */
    const flipped = (events: readonly GameEvent[]): number[] =>
      events.flatMap((e) => (e.type === "boostCardFlipped" ? [e.boostIcons] : []));
    // Seed 3: the villain's first boost card has 2 boost icons.

    it("no guard minion: it answers the villain's boost card and its damage is the hero's attack", () => {
      const ready = intoPlay(calm(3), "08006");
      const villain = villainOf(ready.state);
      const done = villainPhase(ready.state);
      expect(flipped(done.events)[0]).toBe(2);
      expect(offeredIt(done.events)).toBe(true);
      expect(playerOf(done.state, P1).discard).toContain(ready.id);
      const [made] = attacks(done.events).filter((a) => a.labeled === true);
      expect(made).toMatchObject({ attackerInstanceId: identityOf(ready.state), attacked: [villain] });
      expect(takenBy(done.events, villain)).toEqual([made!.results!.damage]);
      expect(made!.results!.damage).toBe(2);
    });

    it("a guard minion engaged: it is not offered, stays in play, and the boost icons are not canceled", () => {
      const guarded = withMercenary(calm(3), { guard: true, hp: 20 });
      const ready = intoPlay(guarded.state, "08006");
      const done = villainPhase(ready.state);
      expect(flipped(done.events).some((icons) => icons > 0)).toBe(true);
      expect(offeredIt(done.events)).toBe(false);
      expect(playerOf(done.state, P1).playArea).toContain(ready.id);
      expect(inst(done.state, villainOf(done.state)).damage).toBe(0);
      expect(skips(done.events)).toEqual([]);
    });
  });
});

describe("Row 65 (A6): a cancelled '(attack)' ability deals no damage (engine fixtures in attack-label.test.ts)", () => {
  // Owner decision, 2026-10-08 (docs/phase7-wave8.md §4.1 row 65). No shipped card cancels a player's attack: the
  // shipped cancels are of an enemy's activation (Webbed Up, Web Binding, Grasping Tendrils, Phased and Confused,
  // Tempus), of a card being played (Counterspell, Stryfe) and of a revealed card. So the rule is proved on engine
  // fixtures only, and this census fails when a card that can cancel a player's attack ships: give it a real-card
  // proof here then.
  it("no shipped ability cancels a player's attack", () => {
    const cancelsAnAttack = Object.entries(DEPS.abilities)
      .filter(([, definition]) => {
        const trigger = JSON.stringify(definition.trigger);
        return (
          definition.trigger.kind === "interrupt" &&
          /"on":"attack"/.test(trigger) &&
          JSON.stringify(definition.effects).includes('"cancelTriggeringEvent"')
        );
      })
      .map(([id]) => id);
    expect(cancelsAnAttack).toEqual([]);
  });
});

describe("Pitchback (28012): 'Hero Response (attack): After your hero attacks, deal 4 damage to an enemy'", () => {
  const aerial = (state: GameState): GameState => withTrait(state, "AERIAL");
  const basicAttack = (state: GameState) =>
    ({
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state),
      targetInstanceId: villainOf(state),
    }) as const;

  it("after a basic attack: it is a second attack by the hero, and it does not answer the attack it makes", () => {
    const given = conjure(aerial(rhino()), "28012");
    const villain = villainOf(given.state);
    const hero = identityOf(given.state);
    const before = inst(given.state, villain).damage;
    const done = drive(given.state, basicAttack(given.state), { use: ["28012"], pay: 1, target: villain });
    expect(done.accepted).toBe(true);
    const made = attacks(done.events);
    expect(made.map((a) => [a.attackerInstanceId, a.basic === true, a.labeled === true])).toEqual([
      [hero, true, false],
      [hero, false, true],
    ]);
    expect(made[1]!.results?.damage).toBe(4);
    // Spider-Man's basic attack (ATK 2), then Pitchback's 4.
    expect(takenBy(done.events, villain)).toEqual([2, 4]);
    expect(inst(done.state, villain).damage).toBe(before + 6);
    // One copy, played once: it is in the discard pile, and nothing is left asking.
    expect(playerOf(done.state, P1).discard).toContain(given.id);
    expect(done.state.pendingChoice).toBeNull();
    expect(done.state.stack).toEqual([]);
  });

  it("answers another '(attack)' ability that only deals damage: Clobber's 3 is an attack by the hero", () => {
    const clobber = conjure(aerial(rhino()), "18012");
    const given = conjure(clobber.state, "28012");
    const villain = villainOf(given.state);
    const done = playOut(given.state, clobber.id, 2, { use: ["28012"], pay: 1, target: villain });
    expect(done.accepted).toBe(true);
    expect(attacks(done.events).map((a) => a.results?.damage)).toEqual([3, 4]);
    expect(inst(done.state, villain).damage).toBe(7);
    expect(playerOf(done.state, P1).discard).toContain(given.id);
  });

  it("two copies in hand: each is played once and makes one attack; neither answers its own", () => {
    const first = conjure(aerial(rhino()), "28012");
    // `conjure` would find the copy already in hand: relabel another deck card and move that one.
    const spare = relabel(first.state, "28012");
    const second = {
      id: spare.id,
      state: {
        ...spare.state,
        players: spare.state.players.map((p) =>
          p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== spare.id), hand: [...p.hand, spare.id] } : p,
        ),
      },
    };
    expect(second.id).not.toBe(first.id);
    const villain = villainOf(second.state);
    const copies: readonly string[] = [first.id, second.id];
    // One copy per window, each paid for with a card that is not the other copy.
    const pick: Picker = (state) => {
      const choice = state.pendingChoice!;
      if (choice.prompt.kind === "payForCard") {
        return choice.options
          .filter((o) => !copies.includes(o.optionId))
          .slice(0, 1)
          .map((o) => o.optionId);
      }
      if (choice.prompt.kind === "chooseTarget") return [villain];
      const copy = choice.options.find((o) => o.optionId.includes("28012"));
      return copy ? [copy.optionId] : firstLegal(state);
    };
    const done = driveEventsPicking(DEPS, second.state, pick, basicAttack(second.state));
    expect(attacks(done.events).map((a) => a.labeled === true)).toEqual([false, true, true]);
    expect(attacks(done.events).map((a) => a.results?.damage)).toEqual([2, 4, 4]);
    expect(playerOf(done.state, P1).discard).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(done.state.pendingChoice).toBeNull();
  });

  it("guard: with a Hydra Mercenary engaged its 4 damage cannot go to the villain", () => {
    const guarded = withMercenary(aerial(rhino()), { guard: true, hp: 20 });
    const given = conjure(guarded.state, "28012");
    const done = drive(
      given.state,
      { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(given.state), targetInstanceId: guarded.id },
      { use: ["28012"], pay: 1, target: villainOf(given.state) },
    );
    expect(done.accepted).toBe(true);
    expect(inst(done.state, villainOf(done.state)).damage).toBe(0);
    expect(takenBy(done.events, guarded.id).at(-1)).toBe(4);
  });
});

describe("Dive Bomb (17028): 'Deal 7 damage to an enemy. Deal 1 damage to each other enemy.' (Q49, Q50)", () => {
  const staged = (as: Parameters<typeof withMercenary>[1] | null) => {
    const base = withTrait(rhino(), "AERIAL");
    const minion = as === null ? null : withMercenary(base, as);
    const given = conjure(minion?.state ?? base, "17028");
    return { ...given, minion: minion?.id ?? null, villain: villainOf(given.state), hero: identityOf(given.state) };
  };

  it("no guard: 7 to the villain, 1 to the other enemy, and both were attacked by the one attack", () => {
    const t = staged({ hp: 20, retaliate: 1 });
    const done = playOut(t.state, t.id, 4, { target: t.villain });
    expect(done.accepted).toBe(true);
    expect(takenBy(done.events, t.villain)).toEqual([7]);
    expect(takenBy(done.events, t.minion!)).toEqual([1]);
    expect(attacks(done.events)).toHaveLength(1);
    expect(attacks(done.events)[0]!.attacked).toEqual([t.villain, t.minion]);
    // The minion, named only by the second instruction, was attacked: it retaliates once.
    expect(takenBy(done.events, t.hero)).toEqual([1]);
  });

  it("a guard minion that survives: the villain is not offered as the target and is not reached by 'each other enemy'", () => {
    const t = staged({ guard: true, hp: 20 });
    const done = playOut(t.state, t.id, 4, { target: t.villain });
    expect(done.accepted).toBe(true);
    expect(offers(done.events)).toEqual([[t.minion]]);
    expect(takenBy(done.events, t.minion!)).toEqual([7]);
    expect(takenBy(done.events, t.villain)).toEqual([]);
    expect(skips(done.events)).toEqual([t.villain]);
    expect(attacked(done.events)).toEqual([t.minion]);
  });

  it("a guard minion the 7 defeats no longer guards: 'each other enemy' then attacks the villain for 1", () => {
    const t = staged({ guard: true });
    const done = playOut(t.state, t.id, 4, { target: t.villain });
    expect(offers(done.events)).toEqual([[t.minion]]);
    expect(playerOf(done.state, P1).playArea).not.toContain(t.minion);
    expect(takenBy(done.events, t.villain)).toEqual([1]);
    expect(skips(done.events)).toEqual([]);
    expect(attacks(done.events)[0]!.attacked).toEqual([t.minion, t.villain]);
  });

  it("a tough guard minion takes no damage and still guards: the villain takes nothing", () => {
    const t = staged({ guard: true });
    const tough = patchInstance(t.state, t.minion!, { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const done = playOut(tough, t.id, 4, { target: t.villain });
    expect(playerOf(done.state, P1).playArea).toContain(t.minion);
    expect(inst(done.state, t.villain).damage).toBe(0);
    expect(skips(done.events)).toEqual([t.villain]);
  });
});
