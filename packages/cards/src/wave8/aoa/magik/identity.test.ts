import { AOA_CARDS, AOA_STARTER_DECKS, CORE_CARDS, cardId } from "@mc/content";
import {
  applyCommand,
  createGame,
  getInstance,
  handSize,
  maxHitPoints,
  shownDeckTop,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  applyOk,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  play,
  playerOf,
  settle,
  toHero,
} from "../../../testing/harness.js";
import { driveEventsPicking, withDamage } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { MAGIK_IDENTITY, MAGIK_IDENTITY_SKIPPED } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Magik / Illyana Rasputin (45030a/b), docs/phase7-wave8.md section 7.1, 3.48, 3.49, 3.60. Her real starter deck
 * (`magik-aggression`) against Rhino (Core, standard) through the Core and Age of Apocalypse pools, with only her
 * identity scripted: the rest of her kit is other modules', so this file reads where those cards are and what they
 * cost, never what they do. The top of the deck is stacked by surgery.
 */
const FACEUP = "45030a.magik-constant";
const PLAYABLE = "45030a.magik-constant-2";
const INTERRUPT = "45030b.illyana-rasputin-interrupt";

/** Cards of the deck: Limbo (support, cost 1), Colossus (ally, cost 3), Scrying (a SPELL event), Soul Strike (a SPELL), Stepping Disc, Strength (resource). */
const LIMBO = "45032";
const COLOSSUS = "45031";
const SCRYING = "45036";
const SOUL_STRIKE = "45039";
const EXORCISM = "45038";
const STEPPING_DISC = "45037";

const DECK = AOA_STARTER_DECKS.find((d) => d.id === "magik-aggression")!;
const MAGIK_SEAT = {
  identityCardId: DECK.identityCardId,
  aspects: DECK.aspects,
  deck: DECK.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, ...MAGIK_IDENTITY } };

const codeOf = (s: GameState, id: InstanceId): string => (getInstance(s, id)?.cardId as string | undefined) ?? "?";
const deckOf = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).deck.map((id) => codeOf(s, id));
const handOf = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const discardOf = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const topOf = (s: GameState): InstanceId => playerOf(s, P1).deck[0]!;
const shown = (s: GameState) => shownDeckTop(s, DEPS, P1);

function setupGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  } as never);
  const created = createGame({ ...config, players: [MAGIK_SEAT] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

/** Test surgery: these cards (taken from the deck, then the discard pile or hand) go on top of the deck, in order. The discard pile is cleared into the deck's bottom. */
function stackDeck(state: GameState, ...wanted: readonly string[]): GameState {
  const owner = playerOf(state, P1);
  const used: InstanceId[] = [];
  for (const code of wanted) {
    const id = [...owner.deck, ...owner.discard, ...owner.hand].find(
      (c) => codeOf(state, c) === code && !used.includes(c),
    );
    if (!id) throw new Error(`no ${code}`);
    used.push(id);
  }
  const strip = (zone: readonly InstanceId[]) => zone.filter((id) => !used.includes(id));
  const takenFromHand = owner.hand.length - strip(owner.hand).length;
  const rest = [...strip(owner.deck), ...strip(owner.discard)];
  const refill = rest.slice(rest.length - takenFromHand);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            deck: [...used, ...rest.slice(0, rest.length - takenFromHand)],
            discard: [],
            hand: [...strip(owner.hand), ...refill],
          }
        : p,
    ),
  };
}

/** Moves the named cards from the deck to the discard pile. */
function discarding(state: GameState, ...codes: readonly string[]): GameState {
  const owner = playerOf(state, P1);
  const ids = codes.map((code) => owner.deck.find((c) => codeOf(state, c) === code)!);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: p.deck.filter((c) => !ids.includes(c)), discard: [...ids, ...p.discard] } : p,
    ),
  };
}

const heroOf = (s: GameState): GameState => ({
  ...s,
  players: s.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero", heroFormIndex: 0 } })),
});

/** Picks the interrupt when `accept`, a SPELL by `spell` code when the card is asked for. */
const picker = (opts: { accept: boolean; spell?: string }) => (s: GameState) => {
  const choice = s.pendingChoice!;
  if (choice.prompt.kind === "chooseTriggers") {
    const own = opts.accept ? choice.options.find((o) => o.optionId.endsWith(INTERRUPT)) : undefined;
    return own ? [own.optionId] : [];
  }
  if (opts.spell) {
    const wanted = choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === opts.spell);
    if (wanted) return [wanted.optionId];
  }
  return firstLegal(s);
};

const applyCommandResult = (state: GameState, command: Command) => applyCommand(state, command, DEPS);
const cardPlayed = (events: readonly GameEvent[]) => events.filter((e) => e.type === "cardPlayed");

describe("Magik identity registry", () => {
  it.each([FACEUP, PLAYABLE, INTERRUPT])("%s validates", (id) => {
    expect(validateDefinition(MAGIK_IDENTITY[id]!)).toEqual([]);
  });
  it("registers the two constants of the hero face and the alter-ego interrupt; nothing is skipped", () => {
    expect(Object.keys(MAGIK_IDENTITY).sort()).toEqual([FACEUP, PLAYABLE, INTERRUPT]);
    const card = AOA_CARDS.find((c) => c.id === cardId("45030a")) as never as {
      hero: { abilities: { id: string }[] };
      alterEgo: { abilities: { id: string }[] };
    };
    expect(card.hero.abilities.map((a) => a.id)).toEqual([FACEUP, PLAYABLE]);
    expect(card.alterEgo.abilities.map((a) => a.id)).toEqual([INTERRUPT]);
    expect(MAGIK_IDENTITY_SKIPPED).toEqual({});
  });
  it("shapes: two separate constants, the second carrying the once-per-phase limit", () => {
    expect(MAGIK_IDENTITY[FACEUP]!.trigger).toMatchObject({ kind: "constant", rules: [{ kind: "topOfDeckFaceup" }] });
    expect(MAGIK_IDENTITY[FACEUP]!.limit).toBeUndefined();
    expect(MAGIK_IDENTITY[PLAYABLE]!.trigger).toMatchObject({
      kind: "constant",
      playableTopOfDeck: { costReduction: 1 },
    });
    expect(MAGIK_IDENTITY[PLAYABLE]!.limit).toEqual({ count: 1, period: "phase" });
    expect(MAGIK_IDENTITY[INTERRUPT]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
    expect(MAGIK_IDENTITY[INTERRUPT]!.limit).toEqual({ count: 1, period: "phase" });
  });
});

describe("printed stats, read from the game", () => {
  it("alter-ego form: hand size 6, 10 hit points, REC 3", () => {
    const s = setupGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(playerOf(s, P1).hand).toHaveLength(6);
    expect(handSize(s, P1, DEPS)).toBe(6);
    expect(maxHitPoints(s, identityOf(s), DEPS)).toBe(10);
    const after = applyOk(withDamage(s, identityOf(s), 7), { type: "basicRecover", playerId: P1 }, DEPS).state;
    expect(inst(after, identityOf(after)).damage).toBe(4);
  });
  it("hero form: hand size 5, 10 hit points, ATK 2, THW 1", () => {
    const s = heroOf(setupGame());
    expect(handSize(s, P1, DEPS)).toBe(5);
    expect(maxHitPoints(s, identityOf(s), DEPS)).toBe(10);
    const rhino = s.activeVillainId!;
    const hit = settle(
      applyOk(
        s,
        { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s), targetInstanceId: rhino },
        DEPS,
      ).state,
      firstLegal,
      undefined,
      DEPS,
    );
    expect(inst(hit, rhino).damage - inst(s, rhino).damage).toBe(2);
    const main = s.mainScheme.instanceId;
    const thwarted = settle(
      applyOk(
        patchInstance(s, main, { threat: 5 }),
        { type: "basicThwart", playerId: P1, thwarterInstanceId: identityOf(s), schemeInstanceId: main },
        DEPS,
      ).state,
      firstLegal,
      undefined,
      DEPS,
    );
    expect(inst(thwarted, main).threat).toBe(4);
  });
});

describe("45030a.magik-constant: the top card of her deck is faceup", () => {
  it("in hero form the top card is shown to everyone; in alter-ego form it is not", () => {
    const hero = heroOf(setupGame());
    expect(shown(hero)).toBe(topOf(hero));
    const ego = setupGame();
    expect(shown(ego)).toBeNull();
  });
  it("logs deckTopShown on the change to hero form and follows the top card as it changes", () => {
    const s = stackDeck(setupGame(), LIMBO, COLOSSUS);
    const changed = driveEventsPicking(DEPS, s, picker({ accept: false }), toHero());
    expect(changed.events.some((e) => e.type === "deckTopShown" && e.cardId === cardId(LIMBO))).toBe(true);
    expect(shown(changed.state)).toBe(topOf(changed.state));
    expect(codeOf(changed.state, topOf(changed.state))).toBe(LIMBO);
  });
  it("is still in the deck: not in hand, not drawn, order unchanged", () => {
    const s = heroOf(stackDeck(setupGame(), LIMBO, COLOSSUS));
    expect(deckOf(s).slice(0, 2)).toEqual([LIMBO, COLOSSUS]);
    expect(handOf(s)).not.toContain(LIMBO);
    expect(handSize(s, P1, DEPS)).toBe(5);
  });
});

describe("45030a.magik-constant-2: play the top card as if from hand, 1 less, once per phase", () => {
  it("plays Limbo (cost 1) from the top of the deck for 0, from the deck top counted as the hand", () => {
    const s = heroOf(stackDeck(setupGame(), LIMBO, COLOSSUS));
    const limbo = topOf(s);
    const handBefore = handOf(s);
    const played = driveEventsPicking(DEPS, s, picker({ accept: false }), play(P1, limbo));
    expect(playerOf(played.state, P1).playArea).toContain(limbo);
    expect(handOf(played.state)).toEqual(handBefore);
    expect(codeOf(played.state, topOf(played.state))).toBe(COLOSSUS);
    expect(shown(played.state)).toBe(topOf(played.state));
    const event = cardPlayed(played.events).find((e) => (e as { instanceId?: InstanceId }).instanceId === limbo);
    expect(event).toMatchObject({ from: "deckTop", countsAsFrom: "hand" });
  });

  it("the cost is reduced by 1: Colossus (cost 3) is paid with 2 resources from the hand", () => {
    const s = heroOf(stackDeck(setupGame(), COLOSSUS, STEPPING_DISC));
    const colossus = topOf(s);
    const fromHand = playerOf(s, P1).hand.slice(0, 2);
    const played = driveEventsPicking(DEPS, s, picker({ accept: false }), play(P1, colossus, fromHand));
    expect(playerOf(played.state, P1).playArea).toContain(colossus);
    // Two cards of the hand of 6 paid; Colossus came from the deck, so the hand is not refilled.
    expect(playerOf(played.state, P1).hand.length).toBe(4);
  });

  it("only once per phase: the next top card is not offered after the first play", () => {
    const s = heroOf(stackDeck(setupGame(), LIMBO, COLOSSUS));
    const first = driveEventsPicking(DEPS, s, picker({ accept: false }), play(P1, topOf(s))).state;
    const second = applyCommandResult(first, play(P1, topOf(first)));
    expect(second.ok).toBe(false);
  });

  it("is off in alter-ego form", () => {
    const s = stackDeck(setupGame(), LIMBO, COLOSSUS);
    expect(applyCommandResult(s, play(P1, topOf(s))).ok).toBe(false);
  });
});

describe("45030b.illyana-rasputin-interrupt: before she changes to hero form, a SPELL from the discard pile goes on top of her deck", () => {
  const withSpells = () =>
    discarding(stackDeck(setupGame(), SCRYING, SOUL_STRIKE, EXORCISM, LIMBO), SCRYING, SOUL_STRIKE);

  it("is offered while she is still Illyana Rasputin, with the top of the deck still facedown", () => {
    const s = withSpells();
    const asked: { form: string; shown: InstanceId | null }[] = [];
    driveEventsPicking(
      DEPS,
      s,
      (st) => {
        if (st.pendingChoice!.prompt.kind === "chooseTriggers")
          asked.push({ form: playerOf(st, P1).identity.form, shown: shown(st) ?? null });
        return picker({ accept: true, spell: SOUL_STRIKE })(st);
      },
      toHero(),
    );
    expect(asked).toEqual([{ form: "alterEgo", shown: null }]);
  });

  it("accepted, the chosen SPELL is on top of the deck as she arrives in hero form, and it is the card shown", () => {
    const run = driveEventsPicking(DEPS, withSpells(), picker({ accept: true, spell: SOUL_STRIKE }), toHero());
    expect(playerOf(run.state, P1).identity.form).toBe("hero");
    expect(codeOf(run.state, topOf(run.state))).toBe(SOUL_STRIKE);
    expect(discardOf(run.state)).toEqual([SCRYING]);
    expect(shown(run.state)).toBe(topOf(run.state));
    // The SPELL moved before the identity turned; the top card is shown only once she is Magik.
    const types = run.events.map((e) => e.type);
    expect(types.indexOf("deckTopShown")).toBeGreaterThan(types.indexOf("formChanged"));
    const shownEvents = run.events.filter((e) => e.type === "deckTopShown");
    expect(shownEvents).toHaveLength(1);
    expect(shownEvents[0]).toMatchObject({ instanceId: topOf(run.state) });
  });

  it("declined, the change to hero form still happens and the deck is untouched", () => {
    const s = withSpells();
    const run = driveEventsPicking(DEPS, s, picker({ accept: false }), toHero());
    expect(playerOf(run.state, P1).identity.form).toBe("hero");
    expect(discardOf(run.state).sort()).toEqual([SCRYING, SOUL_STRIKE].sort());
    expect(deckOf(run.state)).toEqual(deckOf(s));
  });

  it("with no SPELL in her discard pile it is not offered", () => {
    const s = stackDeck(setupGame(), SCRYING, SOUL_STRIKE, EXORCISM, LIMBO);
    let asked = false;
    const run = driveEventsPicking(
      DEPS,
      s,
      (st) => {
        asked ||= st.pendingChoice!.prompt.kind === "chooseTriggers";
        return picker({ accept: true })(st);
      },
      toHero(),
    );
    expect(asked).toBe(false);
    expect(playerOf(run.state, P1).identity.form).toBe("hero");
  });

  it("the change to alter-ego form is not the one it names: not offered", () => {
    const s = discarding(heroOf(stackDeck(setupGame(), SCRYING, SOUL_STRIKE, EXORCISM, LIMBO)), SCRYING);
    let asked = false;
    const run = driveEventsPicking(
      DEPS,
      s,
      (st) => {
        asked ||= st.pendingChoice!.prompt.kind === "chooseTriggers";
        return picker({ accept: true })(st);
      },
      { type: "changeForm", playerId: P1 },
    );
    expect(asked).toBe(false);
    expect(playerOf(run.state, P1).identity.form).toBe("alterEgo");
  });
});
