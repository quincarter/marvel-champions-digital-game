import { MUT_GEN_CARDS, cardId } from "@mc/content";
import {
  activeVillain,
  applyCommand,
  cardsInPlay,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { buildCrossHeroDeck, playFromAnotherHerosDeck } from "../../testing/cross-hero.js";
import {
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { WAVE6_CARDS, WAVE6_DEPS, WAVE6_ABILITIES, wave6Scenario } from "../index.js";
import { withForm } from "../../testing/staging.js";
import { colossusGame } from "./colossus/support.js";
import { MUT_GEN_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";

/**
 * The precon aspect and basic cards no hero folder owns (`mut_gen` 32014-32018, 32021, 32050, 32051). Rulings under
 * test: RRG 1.8 FAQ "Powerful Punch (#14)" and "Mutant Protectors (#17)" (p. 63), the Magik FAQ note (p. 64: Mutant
 * Protectors puts an ally into play, it does not play it), the July 9, 2026 ruling (1) (redirecting an attack with
 * Powerful Punch is not "initiated against you"). Shadowcat's mass-form flip timing after Powerful Punch is for her e2e.
 */
const BLACK_PANTHER = "core-black-panther-protection";
const SPIDER_MAN = "core-spider-man-justice";
const game = {
  deps: WAVE6_DEPS,
  cards: WAVE6_CARDS,
  buildScenario: (players: Parameters<typeof wave6Scenario>[1]["players"]) =>
    wave6Scenario("rhino", { seed: 11, players }),
};

const villainOf = (state: GameState) => activeVillain(state).instanceId;
const inPlay = (state: GameState, id: InstanceId) => cardsInPlay(state).includes(id);
const inDiscard = (state: GameState, id: InstanceId, player: PlayerId = P1) =>
  playerOf(state, player).discard.includes(id);

/** A Core hero's real precon with one copy of `code` added, past setup, in hero form. */
function coreGame(code: string, hero: string = BLACK_PANTHER): GameState {
  const setup = buildCrossHeroDeck(WAVE6_CARDS, hero, code);
  const created = createGame(game.buildScenario([setup]), WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
  return runWith(WAVE6_DEPS, opened, toHero(P1));
}

/** `player`'s hand becomes exactly `codes` plus `fillers` other cards of their deck (to pay costs with), so the end of
 * turn needs no discard and the card under test cannot be thrown away. */
function withHand(state: GameState, player: PlayerId, codes: readonly string[], fillers: number): GameState {
  const owner = playerOf(state, player);
  let current: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: [], deck: [...p.deck, ...owner.hand] } : p,
    ),
  };
  const ids = moveToHand(current, player, ...codes);
  current = ids.state;
  const spare = playerOf(current, player)
    .deck.filter((id) => !codes.includes(current.instances[id]!.cardId) && cardTypeOf(current, id) !== "treachery")
    .slice(0, fillers);
  return {
    ...current,
    players: current.players.map((p) =>
      p.playerId === player
        ? { ...p, hand: [...p.hand, ...spare], deck: p.deck.filter((id) => !spare.includes(id)) }
        : p,
    ),
  };
}
const cardTypeOf = (state: GameState, id: InstanceId) =>
  (state.cardPool[state.instances[id]!.cardId] as { type: string }).type;

const handIdOf = (state: GameState, player: PlayerId, code: string): InstanceId =>
  playerOf(state, player).hand.find((id) => state.instances[id]!.cardId === cardId(code))!;

const handIdByCode = (state: GameState, code: string): InstanceId | undefined =>
  Object.keys(state.instances).find((id) => state.instances[id as InstanceId]!.cardId === cardId(code)) as
    | InstanceId
    | undefined;

/** Accepts the interrupt/response named, pays `pay` other hand cards (or the `with` ids) for it, declines anything else. */
const using =
  (
    ability: string | readonly string[],
    options: { readonly pay?: number; readonly with?: readonly InstanceId[]; readonly keep?: readonly string[] } = {},
  ): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseTriggers") {
      const wanted = typeof ability === "string" ? [ability] : ability;
      const hit = choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
      return hit.length > 0 ? hit : firstLegal(state);
    }
    if (choice.prompt.kind === "payForCard" || choice.prompt.kind === "payForAbility") {
      const ids = options.with?.map((id) => `hand:${id}`);
      // `keep`: printed ids of hand cards that must not be paid with (one the test still needs in hand).
      const spare = choice.options.filter(
        (o) =>
          choice.prompt.kind === "payForAbility" ||
          !(options.keep ?? []).some((code) => o.optionId === `hand:${handIdByCode(state, code)}`),
      );
      return ids ?? spare.slice(0, options.pay ?? 0).map((o) => o.optionId);
    }
    return firstLegal(state);
  };

/** Ends P1's turn and settles the villain phase with `pick`, returning every event (the villain's attack is the one
 * Rhino makes against the engaged player). */
function villainPhase(
  state: GameState,
  pick: Picker,
  players: readonly PlayerId[] = [P1],
  flipFirst = false,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let current = state;
  const step = (command: Parameters<typeof applyOk>[1]) => {
    const result = applyOk(current, command, WAVE6_DEPS);
    current = result.state;
    events.push(...result.events);
  };
  const settleAll = () => {
    for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
      if (guard > 200) throw new Error("did not settle");
      const choice = current.pendingChoice;
      step({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(current),
      });
    }
  };
  for (const player of players) {
    // Players take their turns in order, so a later player changes to hero form only once it is their turn.
    if (flipFirst && playerOf(current, player).identity.form !== "hero") {
      step(toHero(player));
      settleAll();
    }
    step(endTurn(player));
    settleAll();
  }
  return { state: current, events };
}
const kinds = (events: readonly GameEvent[], type: GameEvent["type"]) => events.filter((e) => e.type === type);
/** The trigger announcements of one kind (`triggerEvent`'s own `event.kind`), as plain objects. */
const announced = (events: readonly GameEvent[], kind: string): Record<string, unknown>[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && (e.event as { kind: string }).kind === kind ? [e.event as never] : [],
  );

describe("registry", () => {
  const CODES = ["32014", "32015", "32016", "32017", "32018", "32021", "32050", "32051"];
  it("names every ability ref of every card (32014-32018, 32021, 32050, 32051), all valid", () => {
    const named = MUT_GEN_CARDS.filter((c) => CODES.includes(c.id)).flatMap((c) =>
      "abilities" in c ? c.abilities.map((a) => a.id as string) : [],
    );
    expect(named.sort()).toEqual(
      [
        "32014.powerful-punch-constant",
        "32015.bait-and-switch-action",
        "32016.perseverance-response",
        "32017.mutant-protectors-interrupt",
        "32018.defensive-energy-interrupt",
        "32021.shadow-and-steel-constant",
        "32050.shadow-and-steel-constant",
        "32051.ready-to-rumble-response",
      ].sort(),
    );
    expect(Object.keys(MUT_GEN_PRECON_PLAYER_CARDS).sort()).toEqual(named);
    for (const ref of named) {
      expect(WAVE6_ABILITIES[ref], ref).toBeDefined();
      expect(validateDefinition(WAVE6_ABILITIES[ref]!), ref).toEqual([]);
    }
  });
  it("the reprints are the originals' own scripts (Bait and Switch 15030, Perseverance 13033, Ready to Rumble 21022)", () => {
    expect(MUT_GEN_PRECON_PLAYER_CARDS["32015.bait-and-switch-action"]).toBe(
      WAVE6_ABILITIES["15030.bait-and-switch-action"],
    );
    expect(MUT_GEN_PRECON_PLAYER_CARDS["32016.perseverance-response"]).toBe(
      WAVE6_ABILITIES["13033.perseverance-response"],
    );
    expect(MUT_GEN_PRECON_PLAYER_CARDS["32051.ready-to-rumble-response"]).toBe(
      WAVE6_ABILITIES["21022.ready-to-rumble-response"],
    );
  });
});

describe("Powerful Punch (32014)", () => {
  const ABILITY = "32014.powerful-punch-constant";
  const setup = () => withHand(coreGame("32014"), P1, ["32014"], 2);

  it("when the villain attacks: 4 damage to it as an attack, then the hero defends; the card is spent", () => {
    const state = setup();
    const card = handIdOf(state, P1, "32014");
    const baseline = villainPhase(state, firstLegal);
    const punched = villainPhase(state, using(ABILITY, { pay: 2 }));
    // Black Panther's own retaliation and Rhino's second attack (the Charge treachery) add the same damage either way.
    expect(inst(punched.state, villainOf(state)).damage - inst(baseline.state, villainOf(state)).damage).toBe(4);
    expect(inDiscard(punched.state, card)).toBe(true);
    // The (attack) label: a real attack by the hero (RRG "Labeled Ability"), heard as one.
    const hero = identityOf(state, P1);
    expect(
      announced(punched.events, "characterAttacked").some(
        (e) => e.attackerInstanceId === hero && e.targetInstanceId === villainOf(state),
      ),
    ).toBe(true);
    expect(announced(baseline.events, "characterAttacked").some((e) => e.attackerInstanceId === hero)).toBe(false);
  });

  it("(defense): the hero is the defender, but it is not a basic defense, so its DEF does not reduce the damage", () => {
    const state = setup();
    const baseline = villainPhase(state, firstLegal);
    const punched = villainPhase(state, using(ABILITY, { pay: 2 }));
    const hero = identityOf(state, P1);
    expect(inst(punched.state, hero).damage).toBe(inst(baseline.state, hero).damage);
  });

  it("not offered while the hero is stunned: the attack-labeled ability is cancelled (costs paid) and the stun is removed", () => {
    const ready = setup();
    const hero = identityOf(ready, P1);
    const state = patchInstance(ready, hero, { statuses: { ...inst(ready, hero).statuses, stunned: 1 } });
    const baseline = villainPhase(state, firstLegal);
    const punched = villainPhase(state, using(ABILITY, { pay: 2 }));
    expect(inst(punched.state, villainOf(state)).damage).toBe(inst(baseline.state, villainOf(state)).damage);
    expect(kinds(punched.events, "cardPlayed")).toHaveLength(1);
    expect(kinds(punched.events, "statusRemoved")).toContainEqual(
      expect.objectContaining({ instanceId: hero, status: "stunned", reason: "cancelledAttack" }),
    );
  });

  it("only an interrupt to an attack: not offered at any other time", () => {
    const state = setup();
    const card = handIdOf(state, P1, "32014");
    const result = applyCommand(state, play(P1, card, payWith(state, P1, 2, [card])), WAVE6_DEPS);
    expect(result.ok).toBe(false);
  });
});

describe("Powerful Punch (32014) when another player is attacked (ruling July 9, 2026 (1); FAQ #14)", () => {
  it("plays against an attack initiated against another player: the puncher becomes the target and the defender", () => {
    const punchDeck = buildCrossHeroDeck(WAVE6_CARDS, BLACK_PANTHER, "32014");
    const created = createGame(
      game.buildScenario([{ starterDeckId: "core-spider-man-justice" }, punchDeck]),
      WAVE6_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
    state = runWith(WAVE6_DEPS, state, toHero(P1));
    state = withHand(withHand(state, P1, [], 0), P2, ["32014"], 2);
    const baseline = villainPhase(state, firstLegal, [P1, P2], true);
    const punched = villainPhase(state, using("32014.powerful-punch-constant", { pay: 2 }), [P1, P2], true);
    const firstAttack = (events: readonly GameEvent[]) =>
      kinds(events, "attackResolved")[0] as { targetInstanceId: InstanceId };
    expect(firstAttack(baseline.events).targetInstanceId).toBe(identityOf(state, P1));
    expect(firstAttack(punched.events).targetInstanceId).toBe(identityOf(state, P2));
    // The 4 damage is the puncher's own attack, not Spider-Man's.
    expect(kinds(punched.events, "damageDealt")).toContainEqual(
      expect.objectContaining({
        targetInstanceId: villainOf(state),
        amount: 4,
        sourceInstanceId: identityOf(state, P2),
      }),
    );
    // Spider-Man took nothing from the redirected attack (the baseline's first attack hit him).
    expect(kinds(baseline.events, "damageDealt")).toContainEqual(
      expect.objectContaining({ targetInstanceId: identityOf(state, P1), sourceInstanceId: villainOf(state) }),
    );
    expect(kinds(punched.events, "damageDealt")[0]).toMatchObject({ targetInstanceId: villainOf(state), amount: 4 });
    expect(kinds(punched.events, "damageDealt")[1]).toMatchObject({ targetInstanceId: identityOf(state, P2) });
  });
});

describe("Bait and Switch (32015), from a Core hero's deck", () => {
  const prepared =
    (extra: (state: GameState, id: InstanceId) => GameState = (state) => state) =>
    (state: GameState, id: InstanceId) =>
      extra(patchInstance(runWith(WAVE6_DEPS, state, toHero(P1)), state.mainScheme.instanceId, { threat: 10 }), id);
  it("the villain attacks you, then removes 4 threat from the main scheme", () => {
    const { state, cardInstanceId } = playFromAnotherHerosDeck("32015", game, { setup: prepared() });
    expect(mainThreat(state)).toBe(6);
    expect(inDiscard(state, cardInstanceId)).toBe(true);
    // Rhino's ATK is 2 and the attack was not defended (the default picker declines), plus its boost icons.
    expect(inst(state, identityOf(state, P1)).damage).toBeGreaterThanOrEqual(2);
  });
  it("a confused hero's (thwart) ability is cancelled (cost paid): no attack, no threat removed", () => {
    const { state } = playFromAnotherHerosDeck("32015", game, {
      setup: prepared((s) => {
        const hero = identityOf(s, P1);
        return patchInstance(s, hero, { statuses: { ...inst(s, hero).statuses, confused: 1 } });
      }),
    });
    expect(mainThreat(state)).toBe(10);
    expect(inst(state, identityOf(state, P1)).damage).toBe(0);
    expect(inst(state, identityOf(state, P1)).statuses.confused).toBe(0);
  });
});

describe("Perseverance (32016), from a Core hero's deck", () => {
  const ABILITY = "32016.perseverance-response";
  /** Black Panther in alter-ego form with Perseverance (and one card to pay) in hand. */
  const alterEgo = () => {
    const setup = buildCrossHeroDeck(WAVE6_CARDS, BLACK_PANTHER, "32016");
    const created = createGame(game.buildScenario([setup]), WAVE6_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
    return withHand(opened, P1, ["32016"], 2);
  };
  const flip = (state: GameState, pick: Picker) =>
    settle(runWith(WAVE6_DEPS, state, toHero(P1)), pick, undefined, WAVE6_DEPS);

  it("after you change form: gives your hero a tough status card (card spent)", () => {
    const state = alterEgo();
    const card = handIdOf(state, P1, "32016");
    const after = flip(state, using(ABILITY, { pay: 1 }));
    expect(inst(after, identityOf(after, P1)).statuses.tough).toBe(1);
    expect(inDiscard(after, card)).toBe(true);
  });
  it("optional: declined, no tough card and the card stays in hand", () => {
    const state = alterEgo();
    const card = handIdOf(state, P1, "32016");
    const after = flip(state, firstLegal);
    expect(inst(after, identityOf(after, P1)).statuses.tough).toBe(0);
    expect(playerOf(after, P1).hand).toContain(card);
  });
  it("a Hero Response: changing to alter-ego form does not offer it", () => {
    // Form changes once per round: flip to hero, play out the round, and flip back in the next one.
    const flipped = settle(runWith(WAVE6_DEPS, alterEgo(), toHero(P1)), firstLegal, undefined, WAVE6_DEPS);
    const nextRound = villainPhase(flipped, firstLegal).state;
    expect(nextRound.step.phase).toBe("player");
    const hero = withHand(nextRound, P1, ["32016"], 2);
    const seen: string[] = [];
    const recording: Picker = (state) => {
      for (const option of state.pendingChoice?.options ?? []) seen.push(option.optionId);
      return firstLegal(state);
    };
    const back = settle(runWith(WAVE6_DEPS, hero, toHero(P1)), recording, undefined, WAVE6_DEPS);
    expect(playerOf(hero, P1).identity.form).toBe("hero");
    expect(playerOf(back, P1).identity.form).toBe("alterEgo");
    expect(seen.some((id) => id.includes(ABILITY))).toBe(false);
    expect(inst(back, identityOf(back, P1)).statuses.tough).toBe(0);
  });
});

describe("Mutant Protectors (32017)", () => {
  const ABILITY = "32017.mutant-protectors-interrupt";
  /** Colossus (X-MEN) in hero form with Mutant Protectors, Nightcrawler (an X-MEN ally) and one card to pay in hand. */
  const colossus = (codes: readonly string[] = ["32017", "32011"]) =>
    withHand(withForm(colossusGame(), { heroForm: 0 }), P1, codes, 1);

  it("puts an X-MEN ally from hand into play (not played), exhausted, and declares it the defender", () => {
    const state = colossus();
    const nightcrawler = handIdOf(state, P1, "32011");
    const result = villainPhase(state, using(ABILITY, { pay: 1, keep: ["32011"] }));
    // Put into play, not played: only Mutant Protectors itself is a played card (Magik FAQ, RRG 1.8 p. 64).
    expect(kinds(result.events, "cardPlayed").map((e) => (e as { cardId: string }).cardId)).toEqual(["32017"]);
    expect(kinds(result.events, "cardMoved")).toContainEqual(
      expect.objectContaining({
        instanceId: nightcrawler,
        from: { kind: "hand", playerId: P1 },
        to: { kind: "playArea", playerId: P1 },
      }),
    );
    expect(kinds(result.events, "cardExhausted")).toContainEqual(expect.objectContaining({ instanceId: nightcrawler }));
    // The player is still the target of the attack, the ally the defender: it takes the attack's damage.
    const first = kinds(result.events, "attackResolved")[0] as { targetInstanceId: InstanceId };
    expect(first.targetInstanceId).toBe(nightcrawler);
    const hits = kinds(result.events, "damageDealt") as {
      targetInstanceId: InstanceId;
      sourceInstanceId: InstanceId;
    }[];
    expect(hits.find((e) => e.sourceInstanceId === villainOf(state))!.targetInstanceId).toBe(nightcrawler);
    // Rhino's 2 damage defeats Nightcrawler (2 hit points); the hero is untouched by that attack.
    expect(hits.find((e) => e.sourceInstanceId === villainOf(state))).toMatchObject({ amount: 2 });
    expect(kinds(result.events, "characterDefeated")).toContainEqual(
      expect.objectContaining({ instanceId: nightcrawler }),
    );
  });

  it("not offered without an X-MEN ally in hand", () => {
    const state = colossus(["32017"]);
    const seen: string[] = [];
    const recording: Picker = (s) => {
      for (const option of s.pendingChoice?.options ?? []) seen.push(option.optionId);
      return firstLegal(s);
    };
    const result = villainPhase(state, recording);
    expect(seen.some((id) => id.includes(ABILITY))).toBe(false);
    expect(playerOf(result.state, P1).hand).toContain(handIdOf(state, P1, "32017"));
  });

  // FAQ "Mutant Protectors (#17)" (RRG 1.8 p. 63): the hero is not the defender while the ally defends. The (defense)
  // label announces `defended` for the hero as well as for the ally (engine, `declareLabeledDefense`), so a "when/
  // after you defend" ability of the hero hears it. `it.fails`: passes while that gap exists, fails (remove the
  // `.fails`) once the engine announces only the ally.
  it.fails("announces only the ally as the defender, not the hero too (engine gap, FAQ #17)", () => {
    const state = colossus();
    const result = villainPhase(state, using(ABILITY, { pay: 1, keep: ["32011"] }));
    const defenders = announced(result.events, "defended").map((e) => e.defenderInstanceId);
    expect(defenders).toEqual([handIdOf(state, P1, "32011")]);
  });
  it.todo(
    "FAQ #17: if the ally leaves play before damage is dealt, the hero becomes the defender (not a basic defense) and hears 'after you defend' responses; needs an engine path (Nightcrawler's own interrupt returns the ally to hand and prevents the damage, the attack still resolves against the ally)",
  );

  it("a Core hero (no X-MEN trait) cannot play it at all: refused, in or out of an attack", () => {
    const state = withHand(coreGame("32017"), P1, ["32017"], 1);
    const card = handIdOf(state, P1, "32017");
    const refused = applyCommand(state, play(P1, card, payWith(state, P1, 1, [card])), WAVE6_DEPS);
    expect(refused.ok).toBe(false);
    const seen: string[] = [];
    const recording: Picker = (s) => {
      for (const option of s.pendingChoice?.options ?? []) seen.push(option.optionId);
      return firstLegal(s);
    };
    const result = villainPhase(state, recording);
    expect(seen.some((id) => id.includes(ABILITY))).toBe(false);
    expect(playerOf(result.state, P1).hand).toContain(card);
  });
});

describe("Defensive Energy (32018)", () => {
  const ABILITY = "32018.defensive-energy-interrupt";
  /** Black Panther in hero form holding Defensive Energy, a Defense event (Powerful Punch, 2 resources) and fillers. */
  const holding = (extra: readonly string[] = []) => {
    const setup = buildCrossHeroDeck(WAVE6_CARDS, BLACK_PANTHER, "32018");
    const withPunch = { ...setup, deck: [...setup.deck, cardId("32014"), ...extra.map((c) => cardId(c))] };
    const created = createGame(game.buildScenario([withPunch]), WAVE6_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
    return withHand(runWith(WAVE6_DEPS, opened, toHero(P1)), P1, ["32018", "32014", ...extra], 2);
  };
  const handSize = (state: GameState) => playerOf(state, P1).hand.length;

  it("when spent to play a Defense event: draw 1 card", () => {
    const state = holding();
    const energy = handIdOf(state, P1, "32018");
    const filler = playerOf(state, P1).hand.find((id) => !["32018", "32014"].includes(state.instances[id]!.cardId))!;
    const spentWith = (paying: readonly InstanceId[], pick: Picker) =>
      villainPhase(state, (s) =>
        s.pendingChoice?.prompt.kind === "payForCard" ? paying.map((id) => `hand:${id}`) : pick(s),
      );
    const drawn = spentWith([energy, filler], using(["32014.powerful-punch-constant", ABILITY]));
    const plain = spentWith(
      [
        filler,
        playerOf(state, P1).hand.filter(
          (id) => id !== energy && id !== filler && state.instances[id]!.cardId !== cardId("32014"),
        )[0]!,
      ],
      using("32014.powerful-punch-constant"),
    );
    // Powerful Punch resolved both times; the energy card was spent in the first only, and drew a card.
    expect(inDiscard(drawn.state, energy)).toBe(true);
    expect(kinds(drawn.events, "cardDrawn").length - kinds(plain.events, "cardDrawn").length).toBe(1);
    expect(inDiscard(plain.state, energy)).toBe(false);
  });

  it("not when spent to play an event that is not a Defense event (Bait and Switch, a Thwart event)", () => {
    const state = holding(["32015"]);
    const energy = handIdOf(state, P1, "32018");
    const bait = handIdOf(state, P1, "32015");
    const seen: string[] = [];
    const before = handSize(state);
    const result = settle(
      runWith(WAVE6_DEPS, state, play(P1, bait, [energy])),
      (s) => {
        for (const option of s.pendingChoice?.options ?? []) seen.push(option.optionId);
        return firstLegal(s);
      },
      undefined,
      WAVE6_DEPS,
    );
    expect(inDiscard(result, bait)).toBe(true);
    expect(inDiscard(result, energy)).toBe(true);
    expect(seen.some((id) => id.includes(ABILITY))).toBe(false);
    // Both cards left the hand and nothing was drawn.
    expect(handSize(result)).toBe(before - 2);
  });
});

describe("Shadow and Steel (32021, 32050)", () => {
  /** Colossus (P1, hero form) and Shadowcat (P2): the two named Team-Up characters are both in play. */
  function duo(): GameState {
    const state = colossusGame("rhino", { extraPlayers: [{ starterDeckId: "shadowcat-aggression" }] });
    return withForm(state, { heroForm: 0 });
  }
  const ABILITY = (code: string) => `${code}.shadow-and-steel-constant`;

  it.each(["32021", "32050"])(
    "%s: a Core deck cannot include it (Team-Up: the identity must be Colossus or Shadowcat)",
    (code) => {
      const built = buildCrossHeroDeck(WAVE6_CARDS, SPIDER_MAN, code);
      const created = createGame(game.buildScenario([built]), WAVE6_DEPS);
      expect(created.ok).toBe(false);
    },
  );

  it("32021, played by Colossus when the villain attacks: prevents all damage and deals 4 damage to the villain", () => {
    const state = withHand(withHand(duo(), P1, ["32021"], 2), P2, [], 0);
    const baseline = villainPhase(state, firstLegal, [P1, P2], true);
    const played = villainPhase(state, using(ABILITY("32021"), { pay: 2 }), [P1, P2], true);
    const colossus = identityOf(state, P1);
    expect(kinds(played.events, "damageDealt")[0]).toMatchObject({
      targetInstanceId: villainOf(state),
      amount: 4,
      sourceInstanceId: colossus,
    });
    expect(kinds(baseline.events, "damageDealt")[0]).toMatchObject({ targetInstanceId: colossus });
    // All of the attack's damage was prevented (it is still dealt, but Colossus takes none from it).
    expect(kinds(played.events, "damagePrevented").length).toBeGreaterThan(0);
    expect(inst(played.state, colossus).damage).toBeLessThan(inst(baseline.state, colossus).damage);
  });

  it("32050, played by Shadowcat against an attack on Colossus: she becomes the defender and takes none of it", () => {
    const state = withHand(withHand(duo(), P2, ["32050"], 2), P1, [], 0);
    const played = villainPhase(state, using(ABILITY("32050"), { pay: 2 }), [P1, P2], true);
    const shadowcat = identityOf(state, P2);
    expect(kinds(played.events, "attackResolved")[0]).toMatchObject({ targetInstanceId: shadowcat });
    expect(kinds(played.events, "damageDealt")[0]).toMatchObject({
      targetInstanceId: villainOf(state),
      amount: 4,
      sourceInstanceId: shadowcat,
    });
    expect(inst(played.state, identityOf(state, P1)).damage).toBe(0);
  });

  it("is not offered without both named characters in play (Colossus alone)", () => {
    const state = withHand(withForm(colossusGame(), { heroForm: 0 }), P1, ["32021"], 2);
    const seen: string[] = [];
    const result = villainPhase(state, (s) => {
      for (const option of s.pendingChoice?.options ?? []) seen.push(option.optionId);
      return firstLegal(s);
    });
    expect(seen.some((id) => id.includes(ABILITY("32021")))).toBe(false);
    expect(playerOf(result.state, P1).hand).toContain(handIdOf(state, P1, "32021"));
  });
});

describe("Ready to Rumble (32051), from a Core hero's deck", () => {
  const ABILITY = "32051.ready-to-rumble-response";
  it("under your control; after you change form, discard it to ready your hero", () => {
    const { state, cardInstanceId } = playFromAnotherHerosDeck("32051", game, { coreHero: SPIDER_MAN });
    expect(inPlay(state, cardInstanceId)).toBe(true);
    const hero = identityOf(state, P1);
    const exhausted = patchInstance(state, hero, { exhausted: true });
    const accepting = using(ABILITY);
    const after = settle(runWith(WAVE6_DEPS, exhausted, toHero(P1)), accepting, undefined, WAVE6_DEPS);
    expect(inst(after, hero).exhausted).toBe(false);
    expect(inDiscard(after, cardInstanceId)).toBe(true);
  });
  it("optional: declined, the hero stays exhausted and the card stays in play", () => {
    const { state, cardInstanceId } = playFromAnotherHerosDeck("32051", game, { coreHero: SPIDER_MAN });
    const hero = identityOf(state, P1);
    const exhausted = patchInstance(state, hero, { exhausted: true });
    const after = settle(runWith(WAVE6_DEPS, exhausted, toHero(P1)), firstLegal, undefined, WAVE6_DEPS);
    expect(inst(after, hero).exhausted).toBe(true);
    expect(inPlay(after, cardInstanceId)).toBe(true);
  });
  it("Energy, Genius and Strength (32052-32054) carry no ability", () => {
    for (const code of ["32052", "32053", "32054"]) {
      const card = MUT_GEN_CARDS.find((c) => c.id === code)!;
      expect("abilities" in card ? card.abilities : []).toEqual([]);
    }
  });
});
